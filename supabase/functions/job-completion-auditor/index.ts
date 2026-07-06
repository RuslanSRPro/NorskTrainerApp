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

// ============================================================================
// job-completion-auditor
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
// Режимы:
//   heal: false (по умолчанию) — только отчёт, ничего не меняет в БД.
//   heal: true — для каждого incomplete item сразу вызывает
//                ai-enrichment-worker в реальном режиме (dry_run: false).
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

type AuditItem = {
  kind: 'lexeme' | 'expression';
  id: string;
  lemma: string;
  complete: boolean;
  missing?: string[];
  healed?: boolean;
  heal_error?: string;
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
    const limit = Math.min(Number(body.limit ?? 8), 15);

    // ФИКС: offset для постраничной обработки — без него повторный вызов
    // с тем же limit всегда брал бы первые N той же выборки, никогда не
    // продвигаясь дальше по списку items этого job'а.
    const offset = Math.max(Number(body.offset ?? 0), 0);

    const { data: items, error, count: totalCount } = await supabase
      .from('lexeme_processing_items')
      .select('id, lexeme_id, expression_id, normalized_lemma, surface_form, match_type', {
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

    const audited: AuditItem[] = [];
    const auditErrors: Record<string, unknown>[] = [];

    for (const item of items ?? []) {
      const isExpression = item.match_type === 'expression' && item.expression_id;
      const isLexeme = item.match_type === 'token' && item.lexeme_id;

      // Пропускаем items, которые ещё не промоушены ни в lexeme, ни в
      // expression_catalog — им ещё рано проверять полноту перевода,
      // это отдельная (более ранняя) стадия пайплайна.
      if (!isExpression && !isLexeme) continue;

      const lemma = item.normalized_lemma ?? item.surface_form ?? '';

      try {
        const checkPayload = isExpression
          ? { expression_id: item.expression_id, dry_run: true, limit: 1 }
          : { lexeme_id: item.lexeme_id, dry_run: true, limit: 1 };

        const checkResult = await callAiEnrichmentWorker(checkPayload);

        if (!checkResult.ok) {
          auditErrors.push({
            kind: isExpression ? 'expression' : 'lexeme',
            id: isExpression ? item.expression_id : item.lexeme_id,
            lemma,
            error: safeStringify(checkResult.data),
          });
          continue;
        }

        const candidate = (checkResult.data?.processed ?? [])[0];

        // candidates_found: 0 означает, что ai-enrichment-worker не нашёл
        // саму запись (например, verification_status ещё не дошёл до
        // eligible-множества) — это отдельная, более ранняя проблема, не
        // "нет перевода", поэтому помечаем отдельно, а не как incomplete.
        if ((checkResult.data?.candidates_found ?? 0) === 0) {
          audited.push({
            kind: isExpression ? 'expression' : 'lexeme',
            id: isExpression ? item.expression_id : item.lexeme_id,
            lemma,
            complete: false,
            missing: ['not_found_or_not_yet_eligible'],
          });
          continue;
        }

        const isComplete = Boolean(candidate?.skipped);

        const auditEntry: AuditItem = {
          kind: isExpression ? 'expression' : 'lexeme',
          id: isExpression ? item.expression_id : item.lexeme_id,
          lemma,
          complete: isComplete,
          missing: isComplete ? undefined : candidate?.missing,
        };

        if (!isComplete && heal) {
          try {
            const targetId = isExpression ? item.expression_id : item.lexeme_id;

            const healPayload = isExpression
              ? { expression_id: targetId, dry_run: false, limit: 1 }
              : { lexeme_id: targetId, dry_run: false, limit: 1 };

            const healResult = await callAiEnrichmentWorker(healPayload);

            // Раньше здесь доверяли только верхнеуровневому healResult.ok —
            // но ai-enrichment-worker возвращает ok: true на весь HTTP-ответ,
            // даже если КОНКРЕТНЫЙ кандидат провалился (например, Gemini
            // ответил 503 "high demand"). В этом случае провалившийся item
            // попадает в data.errors[], а не в data.processed[], но общий
            // ok остаётся true — аудитор ложно считал это успешным heal.
            //
            // Теперь ищем конкретно НАШ id среди processed[] (без write_errors)
            // и среди errors[] (явный провал) — не полагаясь только на общий ok.
            const healedEntries = Array.isArray(healResult.data?.processed)
              ? healResult.data.processed
              : [];
            const healErrorEntries = Array.isArray(healResult.data?.errors)
              ? healResult.data.errors
              : [];

            const matchedProcessed = healedEntries.find(
              (p: any) => p && (p.id === targetId || p.expression_id === targetId || p.lexeme_id === targetId),
            );
            const matchedError = healErrorEntries.find(
              (e: any) => e && (e.id === targetId || e.expression_id === targetId || e.lexeme_id === targetId),
            );

            if (matchedError) {
              auditEntry.healed = false;
              auditEntry.heal_error = safeStringify(matchedError.error ?? matchedError);
            } else if (
              matchedProcessed &&
              (!matchedProcessed.write_errors || matchedProcessed.write_errors.length === 0)
            ) {
              auditEntry.healed =
                Boolean(matchedProcessed.skipped) ||
                (matchedProcessed.translations_written ?? 0) > 0 ||
                Boolean(matchedProcessed.example_written);

              if (!auditEntry.healed) {
                auditEntry.heal_error =
                  'ai-enrichment-worker processed the item but wrote nothing (unexpected empty result)';
              }
            } else if (matchedProcessed?.write_errors?.length) {
              auditEntry.healed = false;
              auditEntry.heal_error = safeStringify(matchedProcessed.write_errors);
            } else if (!healResult.ok) {
              auditEntry.healed = false;
              auditEntry.heal_error = safeStringify(healResult.data ?? healResult.status);
            } else {
              // Не нашли ни в processed, ни в errors — сама функция могла
              // не дойти до этого кандидата вообще (например, из-за общего
              // сбоя запроса до цикла). Не считаем это успехом по умолчанию.
              auditEntry.healed = false;
              auditEntry.heal_error =
                'target id not found in ai-enrichment-worker response (neither processed nor errors)';
            }
          } catch (healError) {
            auditEntry.healed = false;
            auditEntry.heal_error = safeStringify(healError);
          }
        }

        audited.push(auditEntry);
      } catch (itemError) {
        auditErrors.push({
          kind: isExpression ? 'expression' : 'lexeme',
          id: isExpression ? item.expression_id : item.lexeme_id,
          lemma,
          error: safeStringify(itemError),
        });
      }
    }

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