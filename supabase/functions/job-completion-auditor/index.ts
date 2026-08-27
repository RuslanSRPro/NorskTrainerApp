import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_ENRICHMENT_WORKER = 'ai-enrichment-worker';

// ФОРМЫ-ПОДДЕРЖИВАЮЩИЕ части речи — те же три, что использует
// forms-enrichment-worker (см. его собственный тип Pos).
const FORMS_ELIGIBLE_POS = new Set(['verb', 'noun', 'adjective']);

// ============================================================================
// job-completion-auditor (v2 — batched check + heal)
//
// Финальный шаг всего пайплайна analyze-text: проверяет, реально ли у всех
// promoted items этого job'а (и lexemes, и expressions) есть перевод —
// вместо того чтобы полагаться на то, что каждый промежуточный enrichment-шаг
// (Ordbokene, NAOB, Lexin, AI-fallback) действительно отработал. За один
// день расследований мы нашли минимум четыре места, где эти шаги тихо не
// доходили до цели (несовпадение expression_id/lexeme_id ключей, общий
// лимит между lexeme- и expression-циклами, отсутствие verification_status
// у expression-линкованных lexeme-строк, отсутствие Lexin-вызова для
// expressions вообще) — и ни один из них не был виден по логам самого
// job-orchestrator, только по прямому SQL-аудиту постфактум.
//
// НЕ дублирует логику "что считается пробелом" — вызывает ai-enrichment-worker
// в режиме dry_run для каждого item и интерпретирует его ответ. Если логика
// проверки пробелов изменится, чинить нужно только там, а не здесь тоже.
//
// ФИКС (07.08.2026, найдено на живых данных: job'ы d9862d26 и 4ed2b863
// оба дошли до pipeline_supervisor_state.stage='done' с ПУСТЫМИ формами
// (lexeme_form_variants) для части lexemes): ai-enrichment-worker's
// checkCandidateMissing() — единственный источник "что считается
// пробелом" для этого аудитора — проверяет ТОЛЬКО translation_ua/
// translation_en/example/notes. Формы (lexeme_form_variants) НИКОГДА не
// были частью этой проверки — она сознательно про AI-fallback конкретно
// для переводов/примеров, не общая проверка полноты пайплайна. Значит
// сам аудитор, полагаясь только на неё, был структурно не способен
// заметить отсутствие форм: если у lexeme уже был перевод (обычно
// приходит быстрее — Lexin/AI-цепочки идут РАНЬШЕ 'forms', которая
// последняя, девятая из десяти цепочек) — candidate.skipped=true,
// isComplete=true, и job считался готовым, даже если forms-цепочка
// физически ещё не успела отработать.
//
// Добавлена ОТДЕЛЬНАЯ, независимая от ai-enrichment-worker проверка:
// для lexeme-items с pos IN (verb, noun, adjective) — есть ли вообще
// хоть одна строка в lexeme_form_variants. Не трогаем логику
// ai-enrichment-worker (она размечена как AI-fallback-специфичная, не
// общая проверка полноты) — держим этот критерий отдельно и явно здесь,
// в месте, которое реально решает "job done или нет".
//
// ФИКС (эта версия): callAiEnrichmentWorker теперь оборачивает сам fetch()
// в try/catch на самом близком к источнику уровне. Ранее сетевые сбои
// (timeout, обрыв соединения, rate-limit платформы) при массовом цикле по
// многим items подряд иногда всплывали как необработанные исключения —
// внешний try/catch в цикле их формально ловил, но при определённых
// условиях (например, сбой при попытке прочитать response.text() на уже
// оборванном соединении) ошибка могла проявляться нестандартно. Теперь
// любой сбой на этом шаге гарантированно возвращает структурированный
// { ok: false, status: 0, data: { error: "..." } } вместо возможности
// пробросить что-либо необработанное дальше.
//
// ФИКС (batched check+heal, 20.08.2026): найдено при разборе стоимости —
// этот аудитор вызывал ai-enrichment-worker ОТДЕЛЬНО на каждый item, и
// для check (dry_run:true), и для heal (dry_run:false, limit:1). check
// сам по себе бесплатен (checkCandidateMissing — чтение БД, без Gemini),
// но heal с limit:1 — это ПОЛНЫЙ одиночный Gemini-вызов (весь промпт,
// весь NAOB+Lexin контекст) НА ОДНО слово, хотя ai-enrichment-worker уже
// умеет батчить до 20 items в ОДИН вызов (тот же промпт-оверхед делится
// на 20 items вместо одного). При батче аудита до 15 items это означало
// до 15 отдельных Gemini-вызовов на страницу вместо одного. Сравнение
// со старым замером (2300 слов/выражений, 170 крон, 3 месяца назад) с
// текущим (~1013 записей, 600 крон) показывает падение эффективности в
// ~8 раз — вероятно, во многом объясняется именно этим.
//
// Теперь: (1) check по-прежнему бесплатный, но батчится в ОДИН вызов на
// всю страницу (экономит только Edge Function overhead, не деньги — но
// не вредит); (2) heal тоже батчится в ОДИН вызов на всю страницу (все
// lexeme_ids + expression_ids этой страницы разом) — это и есть реальная
// экономия, до ~15x на heal-пути. Результат batch-вызова сопоставляется
// обратно с каждым конкретным item'ом по id (batch-ответ уже содержит
// id/lexeme_id/expression_id на каждый processed/error элемент — то же
// сопоставление, что раньше делалось поштучно, теперь один раз на весь
// массив).
// ============================================================================

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function callAiEnrichmentWorker(
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${AI_ENRICHMENT_WORKER}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let text: string;
    try {
      text = await response.text();
    } catch (readError) {
      return {
        ok: false,
        status: response.status || 0,
        data: {
          ok: false,
          error: `Failed to read response body: ${safeStringify(readError)}`,
        },
      };
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return { ok: response.ok && data?.ok !== false, status: response.status, data };
  } catch (fetchError) {
    // Ловим сетевые ошибки/таймауты/обрывы соединения на самом источнике,
    // не полагаясь только на внешний try/catch в цикле вызова.
    return {
      ok: false,
      status: 0,
      data: {
        ok: false,
        error: `fetch to ${AI_ENRICHMENT_WORKER} failed: ${safeStringify(fetchError)}`,
      },
    };
  }
}

// ДОБАВЛЕНО (07.08.2026): независимая проверка "есть ли хоть одна форма"
// для lexeme с pos, которая вообще способна иметь формы. Возвращает true,
// если формы уже есть ИЛИ если этот pos в принципе не нуждается в формах
// (adverb, pronoun, expression и т.д. — им нечего проверять здесь).
async function hasRequiredForms(lexemeId: string, pos: string | null | undefined): Promise<boolean> {
  const safePos = String(pos ?? '').toLowerCase();

  if (!FORMS_ELIGIBLE_POS.has(safePos)) {
    return true; // формы не нужны для этой части речи — не блокируем на этом
  }

  const { count, error } = await supabase
    .from('lexeme_form_variants')
    .select('id', { count: 'exact', head: true })
    .eq('lexeme_id', lexemeId);

  if (error) {
    // Сбой самой проверки — не считаем это "формы есть", но и не роняем
    // весь аудит; помечаем как false (safer default: считаем, что формы
    // ещё не подтверждены), фиксируя ошибку через console.error.
    console.error('job-completion-auditor: hasRequiredForms check failed', lexemeId, safeStringify(error));
    return false;
  }

  return (count ?? 0) > 0;
}

// ДОБАВЛЕНО (07.08.2026, ВТОРОЙ фикс, найдено на job 8083a03a, 356 items):
// этот аудитор выбирает items через
// `WHERE lexeme_id IS NOT NULL OR expression_id IS NOT NULL` — items,
// ЕЩЁ НЕ ПРОМОУШЕННЫЕ (current_stage='source_checks', ни lexeme_id, ни
// expression_id ещё не проставлены), физически невидимы для этого
// запроса. Значит аудитор проверял ТОЛЬКО уже промоушенную часть job'а
// (202 из 356 items в конкретном случае), находил её полной, и объявлял
// ВЕСЬ job готовым — полностью не замечая 154 items, которые вообще не
// дошли до верификации. pipeline-supervisor затем ошибочно переводил
// job в 'done', хотя реальная работа (даже верификация, не говоря уже
// об обогащении) для трети job'а не начиналась.
//
// Добавлена явная, отдельная проверка: сколько items этого job'а всё
// ещё сидят на current_stage='source_checks' (то есть ждут промоушена).
// Если таких > 0 — это возвращается отдельным полем
// `unpromoted_items_remaining` в ответе. pipeline-supervisor должен
// (см. соответствующий фикс там) проверять это поле ПЕРЕД тем, как
// помечать job 'done', и если оно > 0 — переводить job обратно на
// stage='orchestrator' (не 'enrichment' — там для них всё равно нечего
// делать, им нужен runLexicalWorker/promotion), а не завершать его.
//
// Дешёвый head-запрос (только count, без выборки строк) — считает items
// job'а, которые ещё НЕ дошли до промоушена вообще, та самая "слепая
// зона" основного запроса аудитора выше.
async function countUnpromotedItems(jobId: string): Promise<number> {
  const { count, error } = await supabase
    .from('lexeme_processing_items')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('current_stage', 'source_checks');

  if (error) {
    console.error('job-completion-auditor: countUnpromotedItems failed', jobId, safeStringify(error));
    // Безопасный дефолт при сбое самой проверки: считаем, что 0 непонятно,
    // лучше НЕ блокировать job навсегда из-за ошибки этого запроса — но
    // явно логируем, чтобы это было видно.
    return 0;
  }

  return count ?? 0;
}

type AuditItem = {
  kind: 'lexeme' | 'expression';
  id: string;
  lemma: string;
  complete: boolean;
  missing?: string[];
  healed?: boolean;
  heal_error?: string;
};

type PageItem = {
  id: string;
  lexeme_id: string | null;
  expression_id: string | null;
  normalized_lemma: string | null;
  surface_form: string | null;
  match_type: string | null;
  lexemes: { pos: string | null } | null;
};

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

    const body = await req.json().catch(() => ({}));

    const jobIdRaw = String(body.job_id ?? '').trim();

    if (!jobIdRaw) {
      return jsonResponse({ ok: false, error: 'job_id is required' }, 400);
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRe.test(jobIdRaw)) {
      return jsonResponse({ ok: false, error: 'job_id must be a valid uuid', job_id: jobIdRaw }, 400);
    }

    const jobId = jobIdRaw;

    // heal по умолчанию false — вызов без heal:true только отчитывается,
    // не меняя БД. Явное соответствие комментарию в шапке файла.
    const heal = Boolean(body.heal ?? false);

    // ФИКС: лимит резко снижен (было 50/200). Каждый item в heal-режиме
    // делает реальный HTTP-вызов к ai-enrichment-worker, который сам
    // внутри может дожидаться ответа Gemini — при 50-100 items подряд
    // суммарное время надёжно превышает лимит времени выполнения Edge
    // Function (подтверждено логами: reason: "WallClockTime", функция
    // обрывается платформой посреди выполнения, не долетая до return).
    // Небольшой, гарантированно укладывающийся в лимит батч + явный
    // has_more — вызывающая сторона (pipeline-watchdog / ручной повтор)
    // продолжает сама, пока has_more не станет false.
    //
    // ФИКС (batched check+heal, 20.08.2026): раньше это ограничение было
    // нужно, потому что КАЖДЫЙ item здесь означал ДВА отдельных HTTP-
    // вызова к ai-enrichment-worker (check + heal), каждый из которых МОГ
    // ждать ответ Gemini. Теперь heal батчится в ОДИН вызов на всю
    // страницу — время выполнения куда меньше зависит от количества
    // items на странице (один batch-вызов Gemini, не N последовательных).
    // Лимит всё равно оставлен консервативным (18 вместо 15) — небольшой
    // запас, а не резкое расширение, так как ai-enrichment-worker сам
    // внутри батчит по 20 (см. BATCH_SIZE там) — 18 items одной страницы
    // укладываются в один internal-batch без остатка.
    const limit = Math.min(Number(body.limit ?? 8), 18);

    // ФИКС: offset для постраничной обработки — без него повторный вызов
    // с тем же limit всегда брал бы первые N той же выборки, никогда не
    // продвигаясь дальше по списку items этого job'а.
    const offset = Math.max(Number(body.offset ?? 0), 0);

    // ДОБАВЛЕНО (07.08.2026): нужен pos лексемы для новой проверки форм —
    // добавили lexemes(pos) через join в select.
    const { data: items, error, count: totalCount } = await supabase
      .from('lexeme_processing_items')
      .select('id, lexeme_id, expression_id, normalized_lemma, surface_form, match_type, lexemes(pos)', {
        count: 'exact',
      })
      .eq('job_id', jobId)
      .or('lexeme_id.not.is.null,expression_id.not.is.null')
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return jsonResponse({ ok: false, stage: 'load_items', error: safeStringify(error) }, 500);
    }

    const hasMore = (totalCount ?? 0) > offset + limit;
    const nextOffset = hasMore ? offset + limit : null;

    const auditErrors: Record<string, unknown>[] = [];

    // Отфильтровываем items, которые ещё не промоушены ни в lexeme, ни в
    // expression_catalog — им ещё рано проверять полноту перевода, это
    // отдельная (более ранняя) стадия пайплайна.
    const eligibleItems = (items ?? []).filter((item: PageItem) => {
      const isExpression = item.match_type === 'expression' && item.expression_id;
      const isLexeme = item.match_type === 'token' && item.lexeme_id;
      return isExpression || isLexeme;
    });

    // ─── Шаг 1: ОДИН batch-вызов на ПРОВЕРКУ (dry_run) для всей страницы ──
    // dry_run сам по себе бесплатен (checkCandidateMissing — чтение БД,
    // без Gemini) — батчируем в основном чтобы сократить количество
    // Edge Function invocations, не ради денег, но заодно не вредит.
    const checkLexemeIds = eligibleItems
      .filter((i) => i.match_type === 'token' && i.lexeme_id)
      .map((i) => i.lexeme_id as string);
    const checkExpressionIds = eligibleItems
      .filter((i) => i.match_type === 'expression' && i.expression_id)
      .map((i) => i.expression_id as string);

    let checkProcessedById = new Map<string, any>();

    if (checkLexemeIds.length > 0 || checkExpressionIds.length > 0) {
      const checkResult = await callAiEnrichmentWorker({
        lexeme_ids: checkLexemeIds,
        expression_ids: checkExpressionIds,
        dry_run: true,
      });

      if (!checkResult.ok) {
        // Общий сбой всего batch-вызова проверки — фиксируем один раз,
        // не пытаясь угадать по каждому item'у отдельно; ниже это даст
        // 'not_found_or_not_yet_eligible' для всех, что логически ближе
        // к правде, чем тихий провал.
        auditErrors.push({
          kind: 'batch_check',
          error: safeStringify(checkResult.data),
        });
      } else {
        for (const p of checkResult.data?.processed ?? []) {
          const key = p.kind === 'expression' ? p.id : p.id;
          if (key) checkProcessedById.set(String(key), p);
        }
      }
    }

    // ─── Шаг 2: определяем, что каждому item'у не хватает, независимая
    // проверка форм — как раньше, но без сетевого вызова на каждый item ──
    type AuditWorkItem = {
      kind: 'lexeme' | 'expression';
      id: string;
      lemma: string;
      isComplete: boolean;
      missingFields: string[];
      onlyMissingIsForms: boolean;
    };

    const workItems: AuditWorkItem[] = [];

    for (const item of eligibleItems) {
      const isExpression = item.match_type === 'expression' && Boolean(item.expression_id);
      const targetId = isExpression ? (item.expression_id as string) : (item.lexeme_id as string);
      const lemma = item.normalized_lemma ?? item.surface_form ?? '';

      const candidate = checkProcessedById.get(targetId);

      if (!candidate) {
        // Не нашёлся в ответе batch-проверки — либо общий сбой (уже
        // залогирован выше), либо ai-enrichment-worker не считает эту
        // запись подходящим кандидатом (candidates_found был бы 0 в
        // одиночном режиме) — то же значение, что и раньше.
        workItems.push({
          kind: isExpression ? 'expression' : 'lexeme',
          id: targetId,
          lemma,
          isComplete: false,
          missingFields: ['not_found_or_not_yet_eligible'],
          onlyMissingIsForms: false,
        });
        continue;
      }

      let isComplete = Boolean(candidate.skipped);
      const missingFields: string[] = isComplete ? [] : (candidate.missing ?? []);

      workItems.push({
        kind: isExpression ? 'expression' : 'lexeme',
        id: targetId,
        lemma,
        isComplete,
        missingFields,
        onlyMissingIsForms: false, // уточняется ниже, после проверки форм
      });
    }

    // Независимая проверка форм — ТОЛЬКО для lexeme-items, как раньше.
    for (const w of workItems) {
      if (!w.isComplete || w.kind !== 'lexeme') continue;

      const sourceItem = eligibleItems.find(
        (i) => i.match_type === 'token' && i.lexeme_id === w.id,
      );
      const lexemePos = sourceItem?.lexemes?.pos ?? null;
      const formsOk = await hasRequiredForms(w.id, lexemePos);

      if (!formsOk) {
        w.isComplete = false;
        w.missingFields.push('forms');
      }
    }

    for (const w of workItems) {
      w.onlyMissingIsForms = w.missingFields.length === 1 && w.missingFields[0] === 'forms';
    }

    // ─── Шаг 3: ОДИН batch-вызов на HEAL для ВСЕХ несовершённых items
    // этой страницы разом (кроме тех, у кого не хватает только 'forms' —
    // ai-enrichment-worker их всё равно не починит) ──────────────────────
    const toHeal = workItems.filter((w) => !w.isComplete && !w.onlyMissingIsForms);

    const healResultById = new Map<string, { healed: boolean; heal_error?: string }>();

    if (heal && toHeal.length > 0) {
      const healLexemeIds = toHeal.filter((w) => w.kind === 'lexeme').map((w) => w.id);
      const healExpressionIds = toHeal.filter((w) => w.kind === 'expression').map((w) => w.id);

      const healResult = await callAiEnrichmentWorker({
        lexeme_ids: healLexemeIds,
        expression_ids: healExpressionIds,
        dry_run: false,
      });

      const healedEntries = Array.isArray(healResult.data?.processed) ? healResult.data.processed : [];
      const healErrorEntries = Array.isArray(healResult.data?.errors) ? healResult.data.errors : [];

      for (const w of toHeal) {
        const matchedProcessed = healedEntries.find(
          (p: any) => p && (p.id === w.id || p.expression_id === w.id || p.lexeme_id === w.id),
        );
        const matchedError = healErrorEntries.find(
          (e: any) => e && (e.id === w.id || e.expression_id === w.id || e.lexeme_id === w.id),
        );

        if (matchedError) {
          healResultById.set(w.id, { healed: false, heal_error: safeStringify(matchedError.error ?? matchedError) });
        } else if (
          matchedProcessed &&
          (!matchedProcessed.write_errors || matchedProcessed.write_errors.length === 0)
        ) {
          const healedOk =
            Boolean(matchedProcessed.skipped) ||
            (matchedProcessed.translations_written ?? 0) > 0 ||
            Boolean(matchedProcessed.example_written);

          healResultById.set(w.id, {
            healed: healedOk,
            heal_error: healedOk
              ? undefined
              : 'ai-enrichment-worker processed the item but wrote nothing (unexpected empty result)',
          });
        } else if (matchedProcessed?.write_errors?.length) {
          healResultById.set(w.id, { healed: false, heal_error: safeStringify(matchedProcessed.write_errors) });
        } else if (!healResult.ok) {
          healResultById.set(w.id, {
            healed: false,
            heal_error: safeStringify(healResult.data ?? healResult.status),
          });
        } else {
          healResultById.set(w.id, {
            healed: false,
            heal_error: 'target id not found in ai-enrichment-worker batch response (neither processed nor errors)',
          });
        }
      }
    }

    // ─── Сборка финального ответа — тот же формат, что и раньше ───────────
    const audited: AuditItem[] = workItems.map((w) => {
      const entry: AuditItem = {
        kind: w.kind,
        id: w.id,
        lemma: w.lemma,
        complete: w.isComplete,
        missing: w.isComplete ? undefined : w.missingFields,
      };

      if (!w.isComplete && heal && !w.onlyMissingIsForms) {
        const healOutcome = healResultById.get(w.id);
        if (healOutcome) {
          entry.healed = healOutcome.healed;
          entry.heal_error = healOutcome.heal_error;
        }
      } else if (!w.isComplete && w.onlyMissingIsForms) {
        entry.heal_error =
          'forms are missing but not healable via ai-enrichment-worker; waiting for forms-enrichment-worker chain';
      }

      return entry;
    });

    const incomplete = audited.filter((a) => !a.complete);
    const healedCount = audited.filter((a) => a.healed).length;
    const stillIncompleteAfterHeal = audited.filter((a) => !a.complete && a.healed === false);

    // Записываем краткую сводку прямо в lexeme_processing_jobs.summary —
    // чтобы get-job-status / любой другой потребитель мог увидеть результат
    // аудита без похода в логи Edge Function.
    //
    // ФИКС: completion_audit теперь записывает состояние ЭТОГО батча плюс
    // явный batch_complete: !hasMore — раньше запись перезаписывалась с
    // нуля при каждом вызове одним и тем же полем 'completion_audit',
    // что при батчинге стирало бы прогресс предыдущих батчей тем же
    // job'а. offset/next_offset позволяют внешнему вызывающему (или
    // pipeline-watchdog) понять, что именно этот срез уже проверен и
    // куда продолжать.
    //
    // ДОБАВЛЕНО (07.08.2026): проверяем непромоушенные items ТОЛЬКО когда
    // эта страница — последняя (!hasMore) — не нужно делать этот запрос
    // на каждой промежуточной странице, только когда решается финальный
    // вопрос "весь job готов или нет".
    const unpromotedItemsRemaining = hasMore ? 0 : await countUnpromotedItems(jobId);

    await supabase
      .rpc('append_job_summary_field', {
        p_job_id: jobId,
        p_field: 'completion_audit',
        p_value: {
          batch_offset: offset,
          batch_limit: limit,
          batch_checked: audited.length,
          batch_complete: audited.length - incomplete.length,
          batch_incomplete: incomplete.length,
          batch_healed: healedCount,
          batch_still_incomplete_after_heal: stillIncompleteAfterHeal.length,
          unpromoted_items_remaining: unpromotedItemsRemaining,
          has_more: hasMore,
          next_offset: nextOffset,
          total_items_in_job: totalCount ?? null,
          audited_at: new Date().toISOString(),
        },
      })
      .then(
        () => {},
        // Если RPC ещё не создана в БД — не роняем весь аудит из-за этого,
        // просто логируем.
        (rpcError: unknown) => {
          console.error(
            'job-completion-auditor: append_job_summary_field failed',
            safeStringify(rpcError),
          );
        },
      );

    return jsonResponse({
      ok: true,
      job_id: jobId,
      heal,
      offset,
      limit,
      total_items_in_job: totalCount ?? null,
      has_more: hasMore,
      next_offset: nextOffset,
      items_checked: audited.length,
      items_complete: audited.length - incomplete.length,
      items_incomplete: incomplete.length,
      items_healed: healedCount,
      items_still_incomplete_after_heal: stillIncompleteAfterHeal.length,
      unpromoted_items_remaining: unpromotedItemsRemaining,
      audit_errors: auditErrors.length,
      audited,
      errors: auditErrors,
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        stage: 'unhandled_exception',
        error: safeStringify(err),
        stack: err instanceof Error ? err.stack : null,
      },
      500,
    );
  }
});