import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadJobEntities,
  versionCompletedJob,
} from '../_shared/final-versioning.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  'SUPABASE_SERVICE_ROLE_KEY',
)!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const CURRENT_VERIFICATION_VERSION = 5;
const CURRENT_METHOD_VERSION = 1;

// ФИКС (05.08.2026): было 60с — оказалось слишком коротким порогом
// устаревания лока. Реальная обработка job-orchestrator (runLexicalWorker
// до 50 раундов, каждый — настоящий внешний вызов) может легитимно
// занимать дольше минуты. При коротком пороге cron pipeline-supervisor
// мог "украсть" лок у ещё живого, работающего вызова, посчитав его
// мёртвым — оба запуска продолжали работать параллельно над одним job'ом,
// одновременно пытаясь промоушить одни и те же items. Найдено на живых
// данных: job e66914c9 (30 прилагательных) — duplicate key error на
// (lemma, pos) = (rask, noun), два разных "касания" одной lexeme-записи
// с разрывом ~20 минут. Job самовосстановился и завершился успешно, но
// сама гонка реальна. Новый порог — заведомо больше реалистичного
// максимума обработки одного job'а.
//
// ВАЖНО: это порог для ОТДЕЛЬНОГО лок-ресурса
// (lexeme_processing_jobs.orchestrator_locked_at), см. комментарий ниже
// в основном цикле — не путать с pipeline_supervisor_state.locked_at.
const LOCK_STALE_SECONDS = 900; // 15 минут (было 60с)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch (e) {
    return {
      ok: false,
      error: safeStringify(e),
      http_status: response.status,
      http_status_text: response.statusText,
    };
  }
}

async function getRemainingSourceCheckCount(jobId: string): Promise<number> {
  const result = await supabase
    .from('lexeme_source_checks')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .in('status', ['pending', 'processing', 'retry_scheduled']);

  if (!result) {
    throw new Error(
      `getRemainingSourceCheckCount returned undefined for job ${jobId}`,
    );
  }

  if (result.error) {
    throw new Error(
      `getRemainingSourceCheckCount failed for job ${jobId}: ${safeStringify(
        result.error,
      )}`,
    );
  }

  return result.count ?? 0;
}

type LexicalWorkerRunResult = {
  batches: any[];
  warnings: string[];
  incomplete: boolean;
  remaining: number;
};

async function runLexicalWorker(jobId: string): Promise<LexicalWorkerRunResult> {
  const batches = [];
  const warnings: string[] = [];

  const maxRounds = 50;

  for (let round = 0; round < maxRounds; round++) {
    let workerResponse: Response;

    try {
      workerResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/lexical-worker`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            limit: 20,
            job_id: jobId,
          }),
        },
      );
    } catch (fetchError) {
      warnings.push(
        `lexical-worker request failed for job ${jobId} on round ${round}: ${safeStringify(
          fetchError,
        )} — treating as no-progress round.`,
      );

      try {
        await rpcOrThrow<number>('reset_stuck_source_checks', { p_job_id: jobId });
      } catch (resetError) {
        console.error(
          'runLexicalWorker: reset_stuck_source_checks after fetch failure failed for job',
          jobId,
          safeStringify(resetError),
        );
      }

      const remainingAfterFailure = await getRemainingSourceCheckCount(jobId);

      if (remainingAfterFailure === 0) break;

      if (round === maxRounds - 1) {
        warnings.push(
          `lexical-worker reached maxRounds=${maxRounds} after repeated request failures, ${remainingAfterFailure} source checks still remain for job ${jobId} — proceeding with partial results.`,
        );

        return { batches, warnings, incomplete: true, remaining: remainingAfterFailure };
      }

      continue;
    }

    const workerJson = await safeJson(workerResponse);
    batches.push(workerJson);

    if (!workerResponse.ok || workerJson.ok === false) {
      warnings.push(
        `lexical-worker returned non-ok for job ${jobId} on round ${round}: ${safeStringify(
          workerJson,
        )} — treating as no-progress round.`,
      );

      try {
        await rpcOrThrow<number>('reset_stuck_source_checks', { p_job_id: jobId });
      } catch (resetError) {
        console.error(
          'runLexicalWorker: reset_stuck_source_checks after non-ok response failed for job',
          jobId,
          safeStringify(resetError),
        );
      }

      const remainingAfterNonOk = await getRemainingSourceCheckCount(jobId);

      if (remainingAfterNonOk === 0) break;

      if (round === maxRounds - 1) {
        warnings.push(
          `lexical-worker reached maxRounds=${maxRounds} after repeated non-ok responses, ${remainingAfterNonOk} source checks still remain for job ${jobId} — proceeding with partial results.`,
        );

        return { batches, warnings, incomplete: true, remaining: remainingAfterNonOk };
      }

      continue;
    }

    let remaining = await getRemainingSourceCheckCount(jobId);

    if (remaining === 0) {
      break;
    }

    if (!workerJson.claimed || workerJson.claimed === 0) {
      try {
        await rpcOrThrow<number>('reset_stuck_source_checks', { p_job_id: jobId });
      } catch (resetError) {
        console.error(
          'runLexicalWorker: mid-loop reset_stuck_source_checks failed for job',
          jobId,
          safeStringify(resetError),
        );
      }

      remaining = await getRemainingSourceCheckCount(jobId);

      if (remaining === 0) {
        break;
      }

      warnings.push(
        `lexical-worker claimed 0 checks but ${remaining} source checks still remain for job ${jobId} even after mid-loop escalation — this batch of orchestrator work is incomplete, pipeline-supervisor will retry the orchestrator stage.`,
      );

      return { batches, warnings, incomplete: true, remaining };
    }

    if (round === maxRounds - 1) {
      warnings.push(
        `lexical-worker reached maxRounds=${maxRounds} but ${remaining} source checks are still pending/processing for job ${jobId} — proceeding with partial results.`,
      );

      return { batches, warnings, incomplete: true, remaining };
    }
  }

  if (warnings.length) {
    console.warn('runLexicalWorker: completed with warnings for job', jobId, warnings);
  }

  return { batches, warnings, incomplete: false, remaining: 0 };
}

async function runSemanticAuditWorker(jobId: string) {
  const batches = [];

  for (let i = 0; i < 5; i++) {
    const workerResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/semantic-audit-worker`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          limit: 20,
          job_id: jobId,
        }),
      },
    );

    const workerJson = await safeJson(workerResponse);
    batches.push(workerJson);

    const claimed =
      (workerJson.lexeme_claimed ?? 0) +
      (workerJson.expression_claimed ?? 0);

    if (!claimed) {
      break;
    }
  }

  return batches;
}

async function rpcOrThrow<T = unknown>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await supabase.rpc(name, args);

  if (!result) {
    throw new Error(`RPC ${name} returned undefined`);
  }

  if (result.error) {
    throw new Error(
      `RPC ${name} failed: ${safeStringify(result.error)}`,
    );
  }

  return result.data as T;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const requestedJobId =
      typeof body.job_id === 'string' &&
      body.job_id.trim().length > 0
        ? body.job_id.trim()
        : null;

    const requestedRunId =
      typeof body.run_id === 'string' &&
      body.run_id.trim().length > 0
        ? body.run_id.trim()
        : null;

    let jobsQuery = supabase
      .from('lexeme_processing_jobs')
      .select('*')
      .in('status', ['pending', 'processing', 'ready'])
      .order('created_at', {
        ascending: true,
      });

    if (requestedJobId) {
      jobsQuery = jobsQuery
        .eq('id', requestedJobId)
        .limit(1);
    } else {
      jobsQuery = jobsQuery.limit(10);
    }

    const { data: jobs, error: jobsError } =
      await jobsQuery;

    if (jobsError) {
      throw jobsError;
    }

    const processedJobs = [];

    for (const job of jobs ?? []) {
      const jobId = job.id;

      // ДОБАВЛЕНО (04.08.2026): лок против параллельного выполнения
      // job-orchestrator для одного и того же job_id.
      //
      // ВАЖНО: это ОТДЕЛЬНЫЙ, независимый лок-ресурс
      // (lexeme_processing_jobs.orchestrator_locked_at) — НЕ
      // pipeline_supervisor_state.locked_at. Изначальная версия этого
      // фикса ошибочно переиспользовала claim_pipeline_supervisor_job на
      // тот же ресурс, что и pipeline-supervisor — но supervisor держит
      // СВОЙ лок (pipeline_supervisor_state.locked_at) на всё время
      // своего HTTP-вызова к этой функции (см. processOneStepWithLock в
      // pipeline-supervisor/index.ts), поэтому попытка взять тот же
      // ресурс здесь всегда видела бы "уже занято" — самоблокировка
      // (self-deadlock) обычного, штатного пути supervisor'а, а не
      // только редкой гонки. Найдено при ревью, до деплоя (04.08.2026).
      // claim_job_orchestrator_run — независимая RPC на отдельную
      // колонку, никем больше не используемую, поэтому конфликта с
      // локом supervisor'а нет.
      //
      // Сама гонка, которую это защищает: analyze-text вызывает
      // job-orchestrator напрямую через EdgeRuntime.waitUntil() сразу
      // при создании job'а — если в этот момент cron pipeline-supervisor
      // тоже подхватит тот же job_id (job.status в этот момент обычно
      // 'processing', что проходит фильтр и здесь, и в
      // get_active_pipeline_jobs), оба вызова могли раньше одновременно
      // выполнять runLexicalWorker/promote_verification_results_for_job/
      // build_text_analysis_result для одного job'а.
      const claimed = await rpcOrThrow<boolean>(
        'claim_job_orchestrator_run',
        {
          p_job_id: jobId,
          p_stale_seconds: LOCK_STALE_SECONDS,
        },
      );

      if (!claimed) {
        processedJobs.push({
          job_id: jobId,
          action: 'skipped',
          reason: 'locked by another in-flight job-orchestrator run',
        });

        continue;
      }

      try {
        const runId =
          requestedRunId ??
          job.summary?.run_id ??
          `text-analysis-${jobId}`;

        const beforeVersioningSnapshot =
          await loadJobEntities(supabase, jobId);

        await supabase
          .from('lexeme_processing_jobs')
          .update({
            status: 'processing',
            started_at:
              job.started_at ??
              new Date().toISOString(),
            updated_at:
              new Date().toISOString(),
          })
          .eq('id', jobId);

        await rpcOrThrow<number>(
          'reset_stuck_source_checks',
          {
            p_job_id: jobId,
          },
        );

        const {
          batches: lexicalBatches,
          warnings: lexicalWarnings,
          incomplete: orchestratorIncomplete,
          remaining: sourceChecksRemaining,
        } = await runLexicalWorker(jobId);

        if (orchestratorIncomplete) {
          processedJobs.push({
            job_id: jobId,
            lexical_batches: lexicalBatches,
            lexical_warnings: lexicalWarnings.length ? lexicalWarnings : undefined,
            orchestrator_incomplete: true,
            source_checks_remaining: sourceChecksRemaining,
            enrichment_pending: false,
          });

          continue;
        }

        // ДОБАВЛЕНО (12.08.2026, Шаг Б): перед промоушеном расширяем
        // items, у которых verification evidence (NAOB) показывает
        // БОЛЬШЕ частей речи, чем уже назначено (или чем изначально
        // ничего не назначено — совсем новое слово). Клонирует
        // lexeme_processing_items + lexeme_source_checks на каждый
        // дополнительный найденный POS, используя УЖЕ полученную
        // evidence — без повторных запросов к NAOB/Ordbokene. После
        // расширения promote_verification_results_for_job (уже
        // pos-aware, см. Шаг A) сам корректно создаст/сопоставит
        // отдельные лексемы для каждого клона — здесь больше ничего
        // менять не нужно. Идемпотентно (safe на повторных тиках) —
        // проверяет exists перед каждым клонированием. Подтверждено на
        // живых данных (job 878f282e, 15 клонов, 5 из 5 выборочно
        // проверенных вручную — все реальные, не ложные срабатывания).
        let multiPosExpanded = 0;

        try {
          multiPosExpanded = await rpcOrThrow<number>(
            'expand_multi_pos_occurrences_for_job',
            {
              p_job_id: jobId,
            },
          );
        } catch (expandError) {
          // Не роняем весь job из-за сбоя этого не-критичного шага —
          // просто логируем и идём дальше без расширения на этом тике;
          // если это временный сбой, следующий тик подхватит остаток
          // (функция идемпотентна).
          console.error(
            'job-orchestrator: expand_multi_pos_occurrences_for_job failed for job',
            jobId,
            safeStringify(expandError),
          );
        }

        const promotedCount =
          await rpcOrThrow<number>(
            'promote_verification_results_for_job',
            {
              p_job_id: jobId,
            },
          );

        const { count: pendingEnrichmentCount } = await supabase
          .from('lexeme_processing_items')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .eq('current_stage', 'semantic_audit')
          .or('lexeme_id.not.is.null,expression_id.not.is.null');

        const enrichmentNeeded = (pendingEnrichmentCount ?? 0) > 0;

        if (enrichmentNeeded) {
          await supabase.rpc('append_job_summary_field', {
            p_job_id: jobId,
            p_field: 'enrichment_pending',
            p_value: {
              promoted_count: promotedCount,
              pending_enrichment_count: pendingEnrichmentCount,
              queued_at: new Date().toISOString(),
            },
          }).then(
            () => {},
            (rpcError: unknown) => {
              console.error(
                'job-orchestrator: append_job_summary_field(enrichment_pending) failed for job',
                jobId,
                safeStringify(rpcError),
              );
            },
          );
        }

        const semanticAuditBatches =
          await runSemanticAuditWorker(jobId);

        const buildResult =
          await rpcOrThrow<string>(
            'build_text_analysis_result',
            {
              p_job_id: jobId,
            },
          );

        const counters =
          await rpcOrThrow<Record<string, unknown>>(
            'recalculate_job_progress',
            {
              p_job_id: jobId,
            },
          );

        const versioningResult =
          await versionCompletedJob(
            supabase,
            {
              jobId,
              runId,
              before: beforeVersioningSnapshot,
              verificationVersion: CURRENT_VERIFICATION_VERSION,
              methodVersion: CURRENT_METHOD_VERSION,
            },
          );

        processedJobs.push({
          job_id: jobId,
          lexical_batches: lexicalBatches,
          lexical_warnings: lexicalWarnings.length ? lexicalWarnings : undefined,
          orchestrator_incomplete: false,
          multi_pos_expanded: multiPosExpanded,
          promoted_count: promotedCount,
          pending_enrichment_count: pendingEnrichmentCount,
          enrichment_pending: enrichmentNeeded,
          semantic_audit_batches: semanticAuditBatches,
          build_result: buildResult,
          counters,
          final_versioning: versioningResult,
        });
      } finally {
        // ДОБАВЛЕНО (04.08.2026): освобождаем лок вне зависимости от
        // исхода (успех, ошибка, orchestrator_incomplete-continue) —
        // finally гарантированно отработает даже при `continue` внутри
        // try-блока цикла.
        await supabase
          .rpc('release_job_orchestrator_run', { p_job_id: jobId })
          .then(
            () => {},
            (releaseError: unknown) => {
              console.error(
                'job-orchestrator: release_job_orchestrator_run failed for job',
                jobId,
                safeStringify(releaseError),
              );
            },
          );
      }
    }

    return Response.json(
      {
        ok: true,
        requested_job_id: requestedJobId,
        processed_jobs: processedJobs,
      },
      {
        headers: corsHeaders,
      },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: safeStringify(error),
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});