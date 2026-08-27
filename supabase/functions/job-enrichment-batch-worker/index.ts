import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// job-enrichment-batch-worker (v3)
//
// ФИКС v2 (два критичных бага в v1):
//
// 1. НЕТ ТАЙМАУТА на внешние fetch-вызовы вообще. Если один item завис
//    (NAOB/Ordbokene/Lexin/Gemini не отвечают), весь for-цикл висит
//    бесконечно — пока внешний таймаут pipeline-supervisor (45с) не оборвёт
//    соединение СНАРУЖИ. При этом сам fetch внутри этой функции продолжает
//    висеть на сервере (не отменяется автоматически обрывом вызывающей
//    стороны), а на следующий тик всё повторяется на том же offset —
//    диагностировано по last_error: "The signal has been aborted" в
//    pipeline_supervisor_state, застрявшем на одном и том же offset много
//    тиков подряд. Добавлен AbortController с таймаутом 20с на каждый
//    внешний вызов — заметно короче внешнего таймаута supervisor'а (45с),
//    чтобы этот воркер ГАРАНТИРОВАННО успевал вернуть структурированный
//    ответ (успех или классифицированная ошибка) до того, как supervisor
//    оборвёт свой вызов по таймауту.
//
// 2. Возвращались только {processed, has_more, next_offset, total} — БЕЗ
//    failed/retryable/permanent. pipeline-supervisor's classifyWorkerResult
//    явно проверяет result.data.failed/retryable/permanent — без этих
//    полей частичные сбои (отдельные items не прошли, но не таймаут)
//    были НЕВИДИМЫ supervisor'у: он видел просто ok:true и шёл дальше,
//    молча теряя данные. Теперь каждая цепочка возвращает эти поля.
//
// Заодно: последовательный for...await заменён на чанкованный параллелизм
// (по 3 одновременно) — то же ускорение, что и раньше обсуждали, без
// возврата к риску слишком резкого всплеска соединений (не 8-20 разом,
// а маленькими группами).
//
// ФИКС (forms integration): добавлена цепочка 'forms' —
// enqueueFormsEnrichment вызывает forms-enrichment-worker в job-scoped
// режиме (передаёт конкретные lexeme_id текущего job'а через body.lexemeIds),
// а не глобальный batch по алфавиту. См. VALID_CHAINS и switch ниже.
//
// ФИКС (naob_synonyms integration): добавлена цепочка 'naob_synonyms',
// размещённая в round-robin СРАЗУ ПОСЛЕ 'naob'. Round-robin проходит
// каждую цепочку полностью (до has_more=false) прежде чем перейти к
// следующей, поэтому к моменту старта 'naob_synonyms' кэш
// naob_article_cache уже гарантированно заполнен статьями для всех
// expression'ов этого job'а — их туда кладёт предыдущая, 'naob'-цепочка.
// 'naob_synonyms' не ходит на сайт NAOB заново: она подбирает slug тем же
// способом, что и naob-pipeline-worker (buildCandidateSlugs), ищет
// совпадение в уже тёплом кэше и вызывает naob-synonym-extractor с
// dry_run:false. Прямой связи lexeme/expression → naob_slug в схеме нет,
// поэтому slug каждый раз перевычисляется из леммы, а не читается из
// колонки.
//
// ФИКС (translation canonicalization integration):
// добавлена отдельная job-scoped цепочка 'translation_canonicalization'
// после authoritative_ai_fallback и перед forms.
//
// Цепочка:
//   1) собирает lexeme_id token-items текущей страницы job;
//   2) вызывает translation-canonicalization-worker одним batch-запросом;
//   3) после успешной канонизации вызывает RPC
//      sync_lexeme_translation_columns для каждой уникальной лексемы,
//      чтобы lexemes.translation_ua / translation_en сразу получили
//      итоговые канонические значения.
//
// ФИКС (lexeme_translation integration, 11.07.2026):
// authoritative-enrichment-pipeline-worker (цепочка 'authoritative') делает
// promoteExpressionIfVerified только для item_type === 'expression' — для
// item_type === 'lexeme' (обычные однословные лексемы, match_type='token')
// он собирает verification evidence (Ordbokene/NAOB "есть ли слово в
// словаре"), но НИКОГДА не пишет entity_translations. lexin-enrichment-worker
// (парсинг Lexin, извлечение реальных переводов) вызывался автоматически
// ТОЛЬКО из enqueueExpressionTranslationEnrichment — то есть только для
// match_type='expression'. Для обычных слов Lexin-переводы никогда не
// подтягивались автоматически; 'translation_canonicalization' (которая
// рассчитывает на уже существующие Lexin primary-переводы) для обычных слов
// канонизировать было нечего, кроме случайных ai_fallback-записей.
//
// Добавлена цепочка 'lexeme_translation' — зеркало
// enqueueExpressionTranslationEnrichment, но для лексем. В
// pipeline-supervisor размещена ДО 'authoritative', чтобы Lexin-переводы
// были готовы до authoritative_ai_fallback (иначе AI может решить, что
// перевод "отсутствует", и сгенерировать fallback раньше, чем настоящий
// Lexin-перевод вообще появится) и до translation_canonicalization.
//
// Lexin повторно в 'translation_canonicalization' здесь НЕ вызывается: к
// этому моменту 'lexeme_translation'/'expression_translation' уже
// завершены, а authoritative_ai_fallback уже закрыл недостающие данные.
//
// ФИКС (translation_reorder integration, 25.07.2026): добавлена цепочка
// 'translation_reorder' МЕЖДУ 'authoritative_ai_fallback' и
// 'translation_canonicalization'. Найдено на живых данных (arbeide):
// Lexin отдаёт варианты перевода одного смысла (напр. "працювати"/
// "попрацювати" — видова пара одного дієслова) в произвольном порядке,
// не по лингвистической базовости — сайт lexin.oslomet.no показывает
// "працювати" как основний варіант, а наш парсер молча брав перший по
// порядку появления в JSON-відповіді ("попрацювати"). Это влияло на
// итоговое значение lexemes.translation_ua, потому что
// sync_lexeme_translation_columns (внутри 'translation_canonicalization')
// берёт DISTINCT ON (source_entry_id) — только ОДИН перевод на статью,
// с наименьшим translation_rank. 'translation_reorder' вызывает
// translation-aspect-reorder-worker (Gemini), который переставляет
// translation_rank внутри каждой multi-variant группы так, чтобы базова
// форма шла первой — с защитой от AI-галлюцинаций (проверка, что набор
// слов до/после совпадает). Обязательно ДО 'translation_canonicalization'
// — иначе canonicalization/sync зафиксирует ещё неправильный порядок.
//
// ФИКС (20.08.2026, найдено при разборе стоимости): 'translation_reorder'
// была полностью реализована (enqueueTranslationReorderEnrichment), но
// НИКОГДА не была добавлена ни в VALID_CHAINS, ни в switch ниже — то есть
// физически недостижима через этот воркер вообще. Единственный путь, каким
// эта логика реально работала — отдельный ГЛОБАЛЬНЫЙ pg_cron (каждые 2
// минуты, по всей базе, независимо от job'ов), который звал
// translation-aspect-reorder-worker напрямую в global-batch режиме. Тот
// путь к тому же вызывал Gemini ОТДЕЛЬНО на каждую multi-variant группу
// (без батчинга) — измерено 4132 реальных AI-решения за 05.08-19.08,
// на порядок больше всего остального вместе взятого, вероятная главная
// статья расхода. Теперь: (1) 'translation_reorder' добавлена в
// VALID_CHAINS и switch — цепочка наконец достижима через обычный job-
// scoped пайплайн; (2) enqueueTranslationReorderEnrichment переписана —
// НЕ постранично (offset/limit больше не используются для пагинации
// здесь), а забирает ВСЕ lexeme_id job'а разом за один шаг (has_more
// всегда false) — к моменту, когда pipeline-supervisor доходит до этой
// цепочки (после authoritative_ai_fallback), все переводы job'а уже
// записаны, нет смысла растягивать на несколько тиков; сам
// translation-aspect-reorder-worker (см. его отдельный файл, v2) уже
// эффективно батчит группы по 20 в один Gemini-вызов внутри. Отдельный
// глобальный cron (id=3 в cron.job) предлагается отключить —
// см. `SELECT cron.unschedule(3)` — раз job-scoped путь покрывает все
// новые переводы сам.
//
// ФИКС (20.08.2026, второй): next_offset у 'translation_reorder' был
// null — из-за этого pipeline-supervisor записывал
// enrichment_offsets['translation_reorder'] как 0 даже после полной
// обработки всего job'а (Number(null) ?? offset → 0 || offset → offset,
// см. processOneStep в pipeline-supervisor), и done_count в
// get_job_chain_progress навсегда показывал 0 для этой цепочки, хотя
// is_complete корректно становился true (по первому условию —
// chain_index уже сдвинулся дальше). Теперь next_offset = rawItems.length
// — done_count отображается верно, has_more по-прежнему всегда false.
//
// ФИКС (24.08.2026, найдено на живых данных: job e785ccf2, "brenne"):
// isRetryable() не распознавал "missing_in_batch_response" (тот самый
// редкий, но ожидаемый случай, когда translation-aspect-reorder-worker's
// batch-режим не находит ref для одной группы в ответе Gemini — см. её
// собственный файл, v2) — классифицировался как permanent, из-за чего
// ОДНА пропущенная группа из 30 (99% успеха) блокировала ВЕСЬ job в
// needs_manual_review. Теперь retryable — следующий тик просто повторит
// попытку для job'а целиком, что почти наверняка пройдёт (Gemini редко
// повторяет один и тот же пропуск дважды подряд).
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_BATCH_LIMIT = 3;
const MAX_BATCH_LIMIT = 8;
const CONCURRENCY = 3;

// ФИКС: было отсутствует. Должен быть заметно короче внешнего таймаута
// pipeline-supervisor (45000мс) на вызов ЭТОЙ функции целиком — иначе
// гонка таймаутов (см. шапку файла).
const WORKER_TIMEOUT_MS = 20000;

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

type WorkerResult = { ok: boolean; status: number; data: any };

async function callWorkerJson(
  workerName: string,
  payload: Record<string, unknown>,
  timeoutMs = WORKER_TIMEOUT_MS,
): Promise<WorkerResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${workerName}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text().catch(() => '');

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return { ok: response.ok && data?.ok !== false, status: response.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: safeStringify(err), timeout: true, worker: workerName },
    };
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(status: number, data: any): boolean {
  const text = JSON.stringify(data ?? '').toLowerCase();
  return (
    status === 0 ||
    status === 429 ||
    (status >= 500 && status <= 599) ||
    // ФИКС: Cloudflare 520 ("Web server is returning an unknown error") и
    // похожие нестандартные 5xx приходят не как HTTP-статус самого вызова
    // (тот часто 200 — воркер сам успешно ответил телом {ok:false,...}),
    // а ВЛОЖЕННО, внутри data.errors[].data.steps.<step>.status. Точный
    // список кодов выше эту вложенность не видит. Регексп ловит любой
    // "status": 5xx где угодно в теле ответа, включая вложенные шаги
    // article_fetch/similar в ordbokene-lexeme-pipeline-worker и т.п.
    /"status"\s*:\s*5\d\d/.test(text) ||
    text.includes('timeout') ||
    text.includes('temporarily') ||
    text.includes('unavailable') ||
    text.includes('high demand') ||
    text.includes('wallclocktime') ||
    text.includes('worker_resource_limit') ||
    // ДОБАВЛЕНО (07.08.2026): Gemini billing/quota-ошибки — найдено на
    // живых данных ("prepayment credits are depleted", HTTP 429 внутри
    // тела ответа от вложенного вызова к Gemini, не как статус самого
    // вызова к этой функции — буквальная проверка status===429 на
    // ВНЕШНЕМ HTTP-статусе этого сбоя не ловила, потому что сам вызов к
    // job-enrichment-batch-worker возвращал 200, а 429 был спрятан
    // внутри вложенного errors[].error текста). RESOURCE_EXHAUSTED бывает
    // и временным (rate limit — само пройдёт на следующем тике), и
    // постоянным (кредиты кончились — нужно вручную пополнить баланс) —
    // но в ОБОИХ случаях правильнее дать supervisor'у повторить попытку
    // на следующих тиках, а не сразу блокировать весь job в
    // needs_manual_review. Если баланс реально исчерпан навсегда — job
    // будет просто ждать на retry, пока пользователь не пополнит, что
    // лучше, чем ошибочно считать это permanent и требовать полного
    // перезапуска job'а вручную.
    text.includes('resource_exhausted') ||
    text.includes('quota') ||
    // ФИКС (24.08.2026): см. комментарий в шапке файла — редкий, ожидаемый
    // пропуск одной группы в batch-ответе Gemini у translation-aspect-
    // reorder-worker не должен блокировать весь job.
    text.includes('missing_in_batch_response') ||
    /"code"\s*:\s*429/.test(text)
  );
}

type ChainResult = {
  processed: number;
  successful: number;
  failed: number;
  retryable: number;
  permanent: number;
  has_more: boolean;
  next_offset: number | null;
  total: number | null;
  errors?: Record<string, unknown>[];
};

const EMPTY_RESULT: ChainResult = {
  processed: 0,
  successful: 0,
  failed: 0,
  retryable: 0,
  permanent: 0,
  has_more: false,
  next_offset: null,
  total: 0,
};

async function runChunked<T>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<WorkerResult>,
): Promise<{ successful: number; failed: number; retryable: number; permanent: number; errors: Record<string, unknown>[] }> {
  let successful = 0;
  let failed = 0;
  let retryable = 0;
  let permanent = 0;
  const errors: Record<string, unknown>[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(chunk.map((item) => processor(item)));

    for (let j = 0; j < settled.length; j++) {
      const outcome = settled[j];

      if (outcome.status === 'rejected') {
        failed++;
        retryable++;
        errors.push({ item: chunk[j], retryable: true, error: safeStringify(outcome.reason) });
        continue;
      }

      const result = outcome.value;

      if (result.ok) {
        successful++;
        continue;
      }

      failed++;
      const retry = isRetryable(result.status, result.data);
      if (retry) retryable++;
      else permanent++;

      errors.push({ item: chunk[j], retryable: retry, status: result.status, data: result.data });
    }
  }

  return { successful, failed, retryable, permanent, errors };
}

function buildResult(processed: number, stats: Awaited<ReturnType<typeof runChunked<any>>>, count: number | null, offset: number, limit: number): ChainResult {
  const hasMore = (count ?? 0) > offset + limit;
  return {
    processed,
    successful: stats.successful,
    failed: stats.failed,
    retryable: stats.retryable,
    permanent: stats.permanent,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    total: count ?? null,
    errors: stats.errors.length ? stats.errors : undefined,
  };
}

// ----------------------------------------------------------------------------
// Ordbokene enrichment
// ----------------------------------------------------------------------------
async function enqueueOrdbokeneEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, lexeme_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .or('expression_id.not.is.null,lexeme_id.not.is.null')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const items = (promotedItems ?? []).filter((item) => item.normalized_lemma ?? item.surface_form);

  const stats = await runChunked(items, CONCURRENCY, (item) => {
    const lemma = item.normalized_lemma ?? item.surface_form;
    return callWorkerJson('ordbokene-lexeme-pipeline-worker', { lemma, parent_lexeme_id: item.lexeme_id ?? null, dry_run: false });
  });

  return buildResult(items.length, stats, count, offset, limit);
}

// ----------------------------------------------------------------------------
// NAOB enrichment (expression-only)
// ----------------------------------------------------------------------------
async function enqueueNaobEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('expression_id', 'is', null)
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const items = (promotedItems ?? []).filter((item) => item.normalized_lemma ?? item.surface_form);

  const stats = await runChunked(items, CONCURRENCY, (item) => {
    const expressionLemma = item.normalized_lemma ?? item.surface_form;
    return callWorkerJson('naob-pipeline-worker', { expression_lemma: expressionLemma, update_catalog: true });
  });

  return buildResult(items.length, stats, count, offset, limit);
}

// ----------------------------------------------------------------------------
// NAOB synonyms (uttrykksbetydning glosses)
//
// Та же логика подбора slug'а из леммы, что и в naob-pipeline-worker
// (buildCandidateSlugs) — здесь она используется не для запроса к NAOB
// напрямую, а только для поиска уже закэшированной статьи в
// naob_article_cache (её туда кладёт предыдущая, 'naob'-цепочка,
// отработавшая раньше в этом же тике round-robin'а). Если совпадения нет
// — считаем item пропущенным (успех, не ошибка): значит и 'naob'-цепочка
// для него не нашла статью.
// ----------------------------------------------------------------------------

function normalizeSlugKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildCandidateSlugs(expressionLemma: string, sourceLemma?: string | null): string[] {
  const parts = normalizeSlugKey(expressionLemma).split(' ').filter(Boolean);
  const candidates = new Set<string>();

  if (sourceLemma) {
    const source = normalizeSlugKey(sourceLemma);
    candidates.add(source);
    candidates.add(`${source}_2`);
    candidates.add(`${source}_3`);
  }

  for (const part of parts) {
    candidates.add(part);
    candidates.add(`${part}_2`);
    candidates.add(`${part}_3`);
  }

  return Array.from(candidates);
}

async function enqueueNaobSynonymsEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('expression_id', 'is', null)
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const items = (promotedItems ?? []).filter((item) => item.expression_id && (item.normalized_lemma ?? item.surface_form));

  if (items.length === 0) {
    const hasMore = (count ?? 0) > offset + limit;
    return { ...EMPTY_RESULT, has_more: hasMore, next_offset: hasMore ? offset + limit : null, total: count ?? null };
  }

  const expressionIds = items.map((item) => item.expression_id as string);

  const { data: catalogRows } = await supabase
    .from('expression_catalog')
    .select('id, root_lemma')
    .in('id', expressionIds);

  const rootLemmaByExpressionId = new Map<string, string | null>();
  for (const row of catalogRows ?? []) {
    rootLemmaByExpressionId.set(row.id, row.root_lemma ?? null);
  }

  const stats = await runChunked(items, CONCURRENCY, async (item) => {
    const expressionLemma = normalizeSlugKey(item.normalized_lemma ?? item.surface_form ?? '');
    const rootLemma = rootLemmaByExpressionId.get(item.expression_id as string) ?? null;
    const candidateSlugs = buildCandidateSlugs(expressionLemma, rootLemma);

    if (candidateSlugs.length === 0) {
      return { ok: true, status: 200, data: { skipped: true, reason: 'no_candidate_slugs' } };
    }

    const { data: cached } = await supabase
      .from('naob_article_cache')
      .select('normalized_key')
      .in('normalized_key', candidateSlugs)
      .order('fetched_at', { ascending: false })
      .limit(1);

    const matchedSlug = cached?.[0]?.normalized_key;

    if (!matchedSlug) {
      // Статья ещё не в кэше — вероятно, и 'naob'-цепочка не нашла для
      // этого item'а совпадения. Не ошибка, просто нечего извлекать.
      return { ok: true, status: 200, data: { skipped: true, reason: 'not_in_naob_cache' } };
    }

    return callWorkerJson('naob-synonym-extractor', { naob_slug: matchedSlug, dry_run: false });
  });

  return buildResult(items.length, stats, count, offset, limit);
}

// ----------------------------------------------------------------------------
// Lexeme translation (Lexin) — зеркало enqueueExpressionTranslationEnrichment,
// но для обычных однословных лексем (match_type='token'), а не выражений.
//
// authoritative-enrichment-pipeline-worker (цепочка 'authoritative') НЕ
// пишет entity_translations для item_type='lexeme' — только verification
// evidence (Ordbokene/NAOB "есть ли слово в словаре"). lexin-enrichment-worker
// нужно вызывать явно, отдельной цепочкой, иначе Lexin primary-переводы для
// обычных слов никогда не появляются автоматически.
// ----------------------------------------------------------------------------
async function enqueueLexemeTranslationEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, lexeme_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const rawItems = (promotedItems ?? []).filter((item) => item.lexeme_id && (item.normalized_lemma ?? item.surface_form));

  // ФИКС (дедупликация, 11.07.2026): один и тот же lexeme_id может
  // встретиться в нескольких items этой страницы — слово, повторяющееся
  // N раз в исходном тексте, создаёт N отдельных items в
  // lexeme_processing_items, но lexeme_id у них один и тот же. Без
  // дедупа lexin-enrichment-worker вызывался бы по разу на каждое
  // повторение — лишние HTTP-вызовы, лишние обращения к Lexin, лишние
  // upsert'ы в entity_translations с одинаковыми данными. Дедуп по
  // lexeme_id перед runChunked гарантирует один внешний вызов на
  // уникальное слово, независимо от того, сколько раз оно встретилось в
  // тексте. Пагинация (count/offset/limit) остаётся по сырым строкам
  // lexeme_processing_items — это отдельный, независимый механизм.
  const uniqueByLexemeId = new Map<string, any>();
  for (const item of rawItems) {
    if (!uniqueByLexemeId.has(item.lexeme_id as string)) {
      uniqueByLexemeId.set(item.lexeme_id as string, item);
    }
  }
  const items = [...uniqueByLexemeId.values()];

  const stats = await runChunked(items, CONCURRENCY, (item) => {
    const lemma = item.normalized_lemma ?? item.surface_form;
    return callWorkerJson('lexin-enrichment-worker', { lexeme_id: item.lexeme_id, lemma, dry_run: false });
  });

  return buildResult(items.length, stats, count, offset, limit);
}

// ----------------------------------------------------------------------------
// Expression translation (Lexin)
// ----------------------------------------------------------------------------
async function enqueueExpressionTranslationEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('expression_id', 'is', null)
    .eq('match_type', 'expression')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const rawItems = (promotedItems ?? []).filter((item) => item.expression_id && (item.normalized_lemma ?? item.surface_form));

  // ФИКС (та же дедупликация, что и в enqueueLexemeTranslationEnrichment,
  // 11.07.2026): одно и то же выражение, повторяющееся в тексте, создаёт
  // несколько items с одним и тем же expression_id — дедуп перед
  // runChunked гарантирует один вызов lexin-enrichment-worker на
  // уникальное выражение.
  const uniqueByExpressionId = new Map<string, any>();
  for (const item of rawItems) {
    if (!uniqueByExpressionId.has(item.expression_id as string)) {
      uniqueByExpressionId.set(item.expression_id as string, item);
    }
  }
  const items = [...uniqueByExpressionId.values()];

  const stats = await runChunked(items, CONCURRENCY, (item) => {
    const expressionLemma = item.normalized_lemma ?? item.surface_form;
    return callWorkerJson('lexin-enrichment-worker', { expression_id: item.expression_id, lemma: expressionLemma, dry_run: false });
  });

  return buildResult(items.length, stats, count, offset, limit);
}

// ----------------------------------------------------------------------------
// Expression AI-fallback
//
// ФИКС: раньше вызывал ai-enrichment-worker ОТДЕЛЬНО на каждый item
// (через runChunked/callWorkerJson, до CONCURRENCY=3 параллельно, но
// каждый — свой HTTP-запрос и свой отдельный вызов к Gemini). Теперь один
// запрос к ai-enrichment-worker с МАССИВОМ expression_ids — сама функция
// внутри батчит вызовы к Gemini (см. ai-enrichment-worker v2), экономя на
// промпт-оверхеде.
// ----------------------------------------------------------------------------
async function enqueueExpressionAiFallbackEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('expression_id', 'is', null)
    .eq('match_type', 'expression')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const items = (promotedItems ?? []).filter((item) => item.expression_id);
  const expressionIds = items.map((item) => item.expression_id as string);

  if (expressionIds.length === 0) {
    const hasMore = (count ?? 0) > offset + limit;
    return { ...EMPTY_RESULT, has_more: hasMore, next_offset: hasMore ? offset + limit : null, total: count ?? null };
  }

  const result = await callWorkerJson('ai-enrichment-worker', { expression_ids: expressionIds, dry_run: false });

  const stats = result.ok
    ? {
        successful: Number(result.data?.processed_count ?? 0) + Number(result.data?.skipped_count ?? 0),
        failed: Number(result.data?.error_count ?? 0),
        retryable: isRetryable(result.status, result.data) ? Number(result.data?.error_count ?? 0) : 0,
        permanent: isRetryable(result.status, result.data) ? 0 : Number(result.data?.error_count ?? 0),
        errors: Array.isArray(result.data?.errors) ? result.data.errors : [],
      }
    : {
        successful: 0,
        failed: expressionIds.length,
        retryable: isRetryable(result.status, result.data) ? expressionIds.length : 0,
        permanent: isRetryable(result.status, result.data) ? 0 : expressionIds.length,
        errors: [{ stage: 'ai_batch_call', error: safeStringify(result.data) }],
      };

  return buildResult(items.length, stats, count, offset, limit);
}

// ----------------------------------------------------------------------------
// Authoritative verification (lexemes) + AI-fallback
// ----------------------------------------------------------------------------
async function enqueueAuthoritativeEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, lexeme_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const items = (promotedItems ?? []).filter((item) => item.lexeme_id && (item.normalized_lemma ?? item.surface_form));

  const stats = await runChunked(items, CONCURRENCY, (item) => {
    const lemma = item.normalized_lemma ?? item.surface_form;
    return callWorkerJson('authoritative-enrichment-pipeline-worker', { item_type: 'lexeme', lemma, lexeme_id: item.lexeme_id, force_refresh: false });
  });

  return buildResult(items.length, stats, count, offset, limit);
}

async function enqueueAiFallbackEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, lexeme_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const items = (promotedItems ?? []).filter((item) => item.lexeme_id);
  const lexemeIds = items.map((item) => item.lexeme_id as string);

  if (lexemeIds.length === 0) {
    const hasMore = (count ?? 0) > offset + limit;
    return { ...EMPTY_RESULT, has_more: hasMore, next_offset: hasMore ? offset + limit : null, total: count ?? null };
  }

  // ФИКС: было по одному через runChunked — теперь один вызов с массивом
  // lexeme_ids, ai-enrichment-worker сам батчит вызовы к Gemini внутри.
  const result = await callWorkerJson('ai-enrichment-worker', { lexeme_ids: lexemeIds, dry_run: false });

  const stats = result.ok
    ? {
        successful: Number(result.data?.processed_count ?? 0) + Number(result.data?.skipped_count ?? 0),
        failed: Number(result.data?.error_count ?? 0),
        retryable: isRetryable(result.status, result.data) ? Number(result.data?.error_count ?? 0) : 0,
        permanent: isRetryable(result.status, result.data) ? 0 : Number(result.data?.error_count ?? 0),
        errors: Array.isArray(result.data?.errors) ? result.data.errors : [],
      }
    : {
        successful: 0,
        failed: lexemeIds.length,
        retryable: isRetryable(result.status, result.data) ? lexemeIds.length : 0,
        permanent: isRetryable(result.status, result.data) ? 0 : lexemeIds.length,
        errors: [{ stage: 'ai_batch_call', error: safeStringify(result.data) }],
      };

  return buildResult(items.length, stats, count, offset, limit);
}

// ----------------------------------------------------------------------------
// Translation reorder (AI-упорядочивание видових пар внутри одного смысла)
//
// Job-scoped, по образцу forms: собирает lexeme_id текущей страницы
// (match_type='token', current_stage='semantic_audit'), передаёт одним
// batch-вызовом в translation-aspect-reorder-worker. Воркер сам находит
// multi-variant группы (>1 перевода на source_entry_id) и переставляет
// базову форму первой через Gemini — одиночные варианты помечает без
// AI-вызова, дорого не выходит даже в маленьком батче.
//
// ВАЖНО: должна идти ПОСЛЕ authoritative_ai_fallback (все варианты
// перевода — и Lexin, и AI-fallback — уже на месте) и ДО
// translation_canonicalization (та читает translation_rank для выбора
// "лучшего" перевода через sync_lexeme_translation_columns — если запустить
// её раньше, canonicalization зафиксирует ещё неправильный порядок).
//
// ФИКС (20.08.2026): было постранично (offset/limit из аргументов функции,
// как у остальных enqueue*) — теперь offset/limit здесь ИГНОРИРУЮТСЯ
// (оставлены в сигнатуре только ради единообразия вызова из switch ниже).
// Цепочка забирает ВСЕ lexeme_id job'а разом за один шаг, has_more всегда
// false — см. подробный комментарий в шапке файла (ФИКС 20.08.2026).
//
// ФИКС (20.08.2026, второй): next_offset теперь = rawItems.length (было
// null) — иначе pipeline-supervisor записывает enrichment_offsets
// ['translation_reorder'] как 0 даже после полной обработки, и
// done_count в get_job_chain_progress навсегда показывает 0 для этой
// цепочки. См. подробный комментарий в шапке файла.
// ----------------------------------------------------------------------------
async function enqueueTranslationReorderEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error } = await supabase
    .from('lexeme_processing_items')
    .select('id, lexeme_id, match_type')
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token')
    .order('id', { ascending: true });

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const rawItems = (promotedItems ?? []).filter((item) => item.lexeme_id);
  const lexemeIds = [...new Set(rawItems.map((item) => item.lexeme_id as string))];

  if (lexemeIds.length === 0) {
    return { ...EMPTY_RESULT, total: 0 };
  }

  const result = await callWorkerJson('translation-aspect-reorder-worker', { lexemeIds, dryRun: false }, 60000);

  const stats = result.ok
    ? {
        successful: Number(result.data?.reordered ?? 0) + Number(result.data?.left_as_is ?? 0) + Number(result.data?.single_variant_marked ?? 0),
        failed: Number(result.data?.failed ?? 0),
        retryable: isRetryable(result.status, result.data) ? Number(result.data?.failed ?? 0) : 0,
        permanent: isRetryable(result.status, result.data) ? 0 : Number(result.data?.failed ?? 0),
        errors: Array.isArray(result.data?.results)
          ? result.data.results.filter((r: any) => r.action === 'failed')
          : [],
      }
    : {
        successful: 0,
        failed: lexemeIds.length,
        retryable: isRetryable(result.status, result.data) ? lexemeIds.length : 0,
        permanent: isRetryable(result.status, result.data) ? 0 : lexemeIds.length,
        errors: [{ stage: 'translation_reorder_batch_call', error: safeStringify(result.data) }],
      };

  return {
    processed: rawItems.length,
    successful: stats.successful,
    failed: stats.failed,
    retryable: stats.retryable,
    permanent: stats.permanent,
    has_more: false,
    next_offset: rawItems.length,
    total: rawItems.length,
    errors: stats.errors.length ? stats.errors : undefined,
  };
}

// ----------------------------------------------------------------------------
// Translation canonicalization + sync (lexemes)
//
// Эта цепочка запускается ПОСЛЕ authoritative и authoritative_ai_fallback.
// Она не ходит в Lexin повторно. На вход получает только lexeme_id текущего
// job, канонизирует уже записанные Lexin primary-переводы и затем собирает
// итоговые lexemes.translation_ua / lexemes.translation_en через существующую
// RPC sync_lexeme_translation_columns.
// ----------------------------------------------------------------------------
async function enqueueTranslationCanonicalization(
  jobId: string,
  offset: number,
  limit: number,
): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, lexeme_id, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return {
      ...EMPTY_RESULT,
      failed: 1,
      retryable: 1,
      errors: [{
        stage: 'load_translation_canonicalization_items',
        error: safeStringify(error),
      }],
    };
  }

  const rawItems = (promotedItems ?? []).filter((item) => item.lexeme_id);
  const lexemeIds = [
    ...new Set(rawItems.map((item) => item.lexeme_id as string)),
  ];

  const hasMore = (count ?? 0) > offset + limit;
  const nextOffset = hasMore ? offset + limit : null;

  if (lexemeIds.length === 0) {
    return {
      ...EMPTY_RESULT,
      processed: rawItems.length,
      has_more: hasMore,
      next_offset: nextOffset,
      total: count ?? null,
    };
  }

  // ФИКС (precheck, 11.07.2026): лёгкая проверка перед вызовом
  // translation-canonicalization-worker — есть ли среди lexemeIds вообще
  // хоть одна Lexin primary-строка с canonical_translation IS NULL. Это
  // ЗЕРКАЛО собственного фильтра воркера (source='lexin', translation_type
  // in (primary, expression_primary), translation_rank=1,
  // canonical_translation IS NULL — см. findCanonCandidates). Если таких
  // строк нет вообще — воркер гарантированно вернёт "nothing to
  // canonicalize", и сам HTTP-вызов можно не делать. На большом refresh
  // это убирает тысячи пустых вызовов.
  //
  // sync НИЖЕ по-прежнему выполняется для ВСЕХ lexemeIds независимо от
  // этой проверки — перевод мог прийти через ai_fallback (не lexin), и
  // canonicalization этим не занимается, но sync обязан подхватить и
  // такие переводы в lexemes.translation_ua/en.
  const { data: candidateRows, error: candidateCheckError } = await supabase
    .from('entity_translations')
    .select('lexeme_id')
    .in('lexeme_id', lexemeIds)
    .eq('source', 'lexin')
    .in('translation_type', ['primary', 'expression_primary'])
    .eq('translation_rank', 1)
    .is('canonical_translation', null)
    .limit(1);

  const hasCanonicalizationWork =
    !candidateCheckError && (candidateRows?.length ?? 0) > 0;

  if (hasCanonicalizationWork) {
    const canonicalization = await callWorkerJson(
      'translation-canonicalization-worker',
      {
        lexeme_ids: lexemeIds,
        force_recanonicalize: false,
        dry_run: false,
      },
    );

    if (!canonicalization.ok) {
      const retry = isRetryable(canonicalization.status, canonicalization.data);

      return {
        processed: rawItems.length,
        successful: 0,
        failed: lexemeIds.length,
        retryable: retry ? lexemeIds.length : 0,
        permanent: retry ? 0 : lexemeIds.length,
        has_more: hasMore,
        next_offset: nextOffset,
        total: count ?? null,
        errors: [{
          stage: 'translation_canonicalization_batch_call',
          retryable: retry,
          status: canonicalization.status,
          data: canonicalization.data,
        }],
      };
    }
  }

  // Канонизатор может законно вернуть "Nothing to canonicalize":
  // sync всё равно нужен, поскольку Lexin/AI могли обновить исходные строки,
  // а итоговые колонки lexemes должны быть пересобраны.
  const syncSettled = await Promise.allSettled(
    lexemeIds.map(async (lexemeId) => {
      const { error: syncError } = await supabase.rpc(
        'sync_lexeme_translation_columns',
        { p_lexeme_id: lexemeId },
      );

      if (syncError) {
        throw new Error(`${lexemeId}: ${safeStringify(syncError)}`);
      }

      return lexemeId;
    }),
  );

  const syncErrors: Record<string, unknown>[] = [];
  let synced = 0;

  for (let i = 0; i < syncSettled.length; i++) {
    const outcome = syncSettled[i];
    const lexemeId = lexemeIds[i];

    if (outcome.status === 'fulfilled') {
      synced++;
    } else {
      syncErrors.push({
        stage: 'sync_lexeme_translation_columns',
        lexeme_id: lexemeId,
        error: safeStringify(outcome.reason),
      });
    }
  }

  const failed = syncErrors.length;

  return {
    processed: rawItems.length,
    successful: synced,
    failed,
    retryable: failed,
    permanent: 0,
    has_more: hasMore,
    next_offset: nextOffset,
    total: count ?? null,
    errors: syncErrors.length ? syncErrors : undefined,
  };
}

// ----------------------------------------------------------------------------
// Forms enrichment (verb/noun/adjective inflections)
//
// Job-scoped: собирает lexeme_id текущего job'а (та же выборка items, что
// у authoritative/ai_fallback — match_type='token', current_stage=
// 'semantic_audit'), фильтрует по pos in (verb, noun, adjective) — только
// такие POS вообще имеют парадигмы форм — и передаёт их одним батч-вызовом
// в forms-enrichment-worker через body.lexemeIds (job-scoped режим этого
// воркера, см. его index.ts). Та же схема, что у ai_fallback-цепочек:
// один HTTP-вызов с массивом id вместо runChunked по одному.
// ----------------------------------------------------------------------------
async function enqueueFormsEnrichment(jobId: string, offset: number, limit: number): Promise<ChainResult> {
  const { data: promotedItems, error, count } = await supabase
    .from('lexeme_processing_items')
    .select('id, lexeme_id, normalized_lemma, surface_form, match_type', { count: 'exact' })
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token')
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return { ...EMPTY_RESULT, failed: 1, retryable: 1, errors: [{ stage: 'load_items', error: safeStringify(error) }] };

  const rawItems = (promotedItems ?? []).filter((item) => item.lexeme_id);
  const lexemeIds = rawItems.map((item) => item.lexeme_id as string);

  if (lexemeIds.length === 0) {
    const hasMore = (count ?? 0) > offset + limit;
    return { ...EMPTY_RESULT, has_more: hasMore, next_offset: hasMore ? offset + limit : null, total: count ?? null };
  }

  // forms-enrichment-worker покрывает только verb/noun/adjective — остальные
  // pos на этой странице не считаем ошибкой, просто у них нет форм по природе.
  const { data: posRows } = await supabase.from('lexemes').select('id, pos').in('id', lexemeIds);
  const eligibleIds = (posRows ?? [])
    .filter((r) => ['verb', 'noun', 'adjective'].includes(r.pos))
    .map((r) => r.id as string);

  if (eligibleIds.length === 0) {
    const hasMore = (count ?? 0) > offset + limit;
    return { ...EMPTY_RESULT, processed: rawItems.length, has_more: hasMore, next_offset: hasMore ? offset + limit : null, total: count ?? null };
  }

  const result = await callWorkerJson('forms-enrichment-worker', { lexemeIds: eligibleIds, dryRun: false });

  const stats = result.ok
    ? {
        successful: Number(result.data?.sourceVerified ?? 0) + Number(result.data?.needsReview ?? 0),
        failed: Number(result.data?.failed ?? 0),
        retryable: isRetryable(result.status, result.data) ? Number(result.data?.failed ?? 0) : 0,
        permanent: isRetryable(result.status, result.data) ? 0 : Number(result.data?.failed ?? 0),
        errors: Array.isArray(result.data?.results)
          ? result.data.results.filter((r: any) => r.action === 'failed')
          : [],
      }
    : {
        successful: 0,
        failed: eligibleIds.length,
        retryable: isRetryable(result.status, result.data) ? eligibleIds.length : 0,
        permanent: isRetryable(result.status, result.data) ? 0 : eligibleIds.length,
        errors: [{ stage: 'forms_batch_call', error: safeStringify(result.data) }],
      };

  return buildResult(rawItems.length, stats, count, offset, limit);
}

// ----------------------------------------------------------------------------
// 360° neighborhood enrichment (то же упрощение семантики BFS, что и раньше)
// ----------------------------------------------------------------------------
const NEIGHBORS_PER_LEXEME = 15;

async function discoverMeaningExtensions(lexemeIds: string[]): Promise<string[]> {
  if (!lexemeIds.length) return [];

  const discovered = new Set<string>();

  const { data: lexemeRows } = await supabase.from('lexemes').select('id, lemma').in('id', lexemeIds);
  const lemmas = (lexemeRows ?? []).map((l) => l.lemma).filter(Boolean);

  if (lemmas.length > 0) {
    const { data: expressions } = await supabase
      .from('expression_catalog')
      .select('lexeme_id')
      .in('root_lemma', lemmas)
      .not('lexeme_id', 'is', null)
      .limit(lexemeIds.length * NEIGHBORS_PER_LEXEME);

    for (const expr of expressions ?? []) {
      if (expr.lexeme_id) discovered.add(expr.lexeme_id);
    }
  }

  const { data: asr } = await supabase
    .from('authoritative_semantic_relations')
    .select('target_entity_id')
    .in('source_entity_id', lexemeIds)
    .not('target_entity_id', 'is', null)
    .in('status', ['candidate', 'trusted'])
    .limit(lexemeIds.length * NEIGHBORS_PER_LEXEME);

  for (const rel of asr ?? []) {
    if (rel.target_entity_id) discovered.add(rel.target_entity_id);
  }

  for (const id of lexemeIds) discovered.delete(id);

  return [...discovered];
}

async function getFrontierForDepth(jobId: string, depth: number): Promise<string[]> {
  const { data: promotedItems } = await supabase
    .from('lexeme_processing_items')
    .select('lexeme_id')
    .eq('job_id', jobId)
    .not('lexeme_id', 'is', null)
    .eq('match_type', 'token');

  const depth1Frontier = [...new Set((promotedItems ?? []).map((i) => i.lexeme_id).filter(Boolean) as string[])];

  if (depth <= 1) return depth1Frontier;

  const depth1Neighbors = await discoverMeaningExtensions(depth1Frontier);
  if (!depth1Neighbors.length) return [];

  const { data: enriched } = await supabase
    .from('entity_translations')
    .select('lexeme_id')
    .in('lexeme_id', depth1Neighbors)
    .eq('source', 'lexin');

  return [...new Set((enriched ?? []).map((e) => e.lexeme_id).filter(Boolean) as string[])];
}

async function enqueueNeighborhoodEnrichment(jobId: string, depth: number, offset: number, limit: number): Promise<ChainResult & { depth: number }> {
  const frontier = await getFrontierForDepth(jobId, depth);
  if (!frontier.length) return { ...EMPTY_RESULT, depth };

  const allNeighbors = await discoverMeaningExtensions(frontier);
  if (!allNeighbors.length) return { ...EMPTY_RESULT, depth };

  const { data: alreadyEnriched } = await supabase
    .from('entity_translations')
    .select('lexeme_id')
    .in('lexeme_id', allNeighbors)
    .eq('source', 'lexin');

  const enrichedSet = new Set((alreadyEnriched ?? []).map((t) => t.lexeme_id));
  const toEnrich = allNeighbors.filter((id) => !enrichedSet.has(id));
  const pageIds = toEnrich.slice(offset, offset + limit);

  if (!pageIds.length) return { ...EMPTY_RESULT, total: toEnrich.length, depth };

  const { data: targetLexemes } = await supabase.from('lexemes').select('id, lemma').in('id', pageIds);
  const items = (targetLexemes ?? []).filter((t) => t.id && t.lemma);

  const stats = await runChunked(items, CONCURRENCY, async (target) => {
    const authoritative = await callWorkerJson('authoritative-enrichment-pipeline-worker', {
      item_type: 'lexeme', lemma: target.lemma, lexeme_id: target.id, force_refresh: false,
    });
    if (!authoritative.ok) return authoritative;
    return callWorkerJson('ai-enrichment-worker', { lexeme_id: target.id, dry_run: false, limit: 1 });
  });

  const hasMore = offset + limit < toEnrich.length;

  return {
    processed: items.length,
    successful: stats.successful,
    failed: stats.failed,
    retryable: stats.retryable,
    permanent: stats.permanent,
    has_more: hasMore,
    next_offset: hasMore ? offset + limit : null,
    total: toEnrich.length,
    errors: stats.errors.length ? stats.errors : undefined,
    depth,
  };
}

// ----------------------------------------------------------------------------
// HTTP entrypoint
// ----------------------------------------------------------------------------
// ФИКС (20.08.2026): 'translation_reorder' добавлена — раньше отсутствовала
// здесь, из-за чего enqueueTranslationReorderEnrichment была недостижима
// через этот воркер целиком (см. шапку файла, ФИКС 20.08.2026).
const VALID_CHAINS = [
  'ordbokene', 'naob', 'naob_synonyms', 'lexeme_translation', 'expression_translation', 'expression_ai_fallback',
  'authoritative', 'authoritative_ai_fallback', 'translation_reorder', 'translation_canonicalization',
  'neighborhood', 'forms',
] as const;

type Chain = (typeof VALID_CHAINS)[number];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    const jobId = String(body.job_id ?? '').trim();
    if (!jobId) return jsonResponse({ ok: false, error: 'job_id is required' }, 400);

    const chain = body.chain as Chain;
    if (!VALID_CHAINS.includes(chain)) {
      return jsonResponse({ ok: false, error: `chain must be one of: ${VALID_CHAINS.join(', ')}` }, 400);
    }

    const limit = Math.min(Math.max(Number(body.limit ?? DEFAULT_BATCH_LIMIT), 1), MAX_BATCH_LIMIT);
    const offset = Math.max(Number(body.offset ?? 0), 0);
    const depth = Math.min(Math.max(Number(body.depth ?? 1), 1), 2);

    let result: ChainResult & { depth?: number };

    switch (chain) {
      case 'ordbokene': result = await enqueueOrdbokeneEnrichment(jobId, offset, limit); break;
      case 'naob': result = await enqueueNaobEnrichment(jobId, offset, limit); break;
      case 'naob_synonyms': result = await enqueueNaobSynonymsEnrichment(jobId, offset, limit); break;
      case 'lexeme_translation': result = await enqueueLexemeTranslationEnrichment(jobId, offset, limit); break;
      case 'expression_translation': result = await enqueueExpressionTranslationEnrichment(jobId, offset, limit); break;
      case 'expression_ai_fallback': result = await enqueueExpressionAiFallbackEnrichment(jobId, offset, limit); break;
      case 'authoritative': result = await enqueueAuthoritativeEnrichment(jobId, offset, limit); break;
      case 'authoritative_ai_fallback': result = await enqueueAiFallbackEnrichment(jobId, offset, limit); break;
      case 'translation_reorder': result = await enqueueTranslationReorderEnrichment(jobId, offset, limit); break;
      case 'translation_canonicalization': result = await enqueueTranslationCanonicalization(jobId, offset, limit); break;
      case 'forms': result = await enqueueFormsEnrichment(jobId, offset, limit); break;
      case 'neighborhood': result = await enqueueNeighborhoodEnrichment(jobId, depth, offset, limit); break;
    }

    return jsonResponse({ ok: result.failed === 0, job_id: jobId, chain, offset, limit, ...result });
  } catch (err) {
    return jsonResponse(
      { ok: false, stage: 'unhandled_exception', error: safeStringify(err), stack: err instanceof Error ? err.stack : null },
      500,
    );
  }
});