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

async function runLexicalWorker(jobId: string) {
  const batches = [];
  const warnings: string[] = [];

  // A job can easily contain more than 100 source checks because each token
  // is checked against several sources. Do not promote until all checks are
  // really finished. `claimed === 0` alone is not a reliable completion signal.
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
      // ФИКС: раньше этот fetch не был обёрнут в try/catch — если
      // lexical-worker обрывался платформой посреди выполнения (что
      // подтверждённо происходит на multi-word "ta"-семействе из-за
      // последовательной обработки claimed checks внутри lexical-worker),
      // соединение рвалось необработанным исключением, которое роняло
      // ВЕСЬ job-orchestrator целиком с HTTP 500 — а job оставался
      // навечно в статусе 'processing', потому что ничего не откатывало
      // его обратно и никто не перезапускал orchestrator автоматически.
      // Теперь такой обрыв — это просто ещё один "нет прогресса в этом
      // раунде", обрабатываемый той же логикой reset_stuck_source_checks
      // + warnings ниже, вместо падения всего job'а.
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
      }

      continue;
    }

    const workerJson = await safeJson(workerResponse);
    batches.push(workerJson);

    if (!workerResponse.ok || workerJson.ok === false) {
      // ФИКС: раньше это был throw, который ронял весь job. Теперь —
      // тот же принцип, что и выше: не падаем, логируем, пробуем
      // эскалировать зависшие checks и продолжаем со следующим раундом.
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
      }

      continue;
    }

    let remaining = await getRemainingSourceCheckCount(jobId);

    if (remaining === 0) {
      break;
    }

    if (!workerJson.claimed || workerJson.claimed === 0) {
      // ФИКС: раньше здесь сразу бросалось исключение, которое роняло ВЕСЬ
      // job (promotion/enrichment/audit для всех 56 items из-за 12 застрявших).
      // reset_stuck_source_checks вызывается только ОДИН раз, в самом начале
      // всего job-orchestrator запуска (см. serve() выше) — если check
      // зависает в 'processing' ПОСЕРЕДИНЕ текущего прогона (не до его
      // начала), тот единственный вызов reset его не увидит. Пытаемся
      // эскалировать зависшие checks здесь же, внутри цикла, перед тем как
      // сдаваться.
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

      // Если после свежей эскалации всё ещё что-то остаётся claimed=0 —
      // это либо retry_scheduled с будущим next_retry_at (легитимно ждать),
      // либо что-то, что reset не смог разрешить прямо сейчас (эскалация до
      // failed происходит только после max_attempts). Не роняем ВЕСЬ job из-за
      // этого — продолжаем с тем, что уже готово. job-completion-auditor
      // (финальный шаг ниже) увидит и, если нужно, сам добьёт то, что
      // осталось неполным, вместо того чтобы весь job навечно застревал в
      // 'pending' без promotion вообще.
      warnings.push(
        `lexical-worker claimed 0 checks but ${remaining} source checks still remain for job ${jobId} even after mid-loop escalation — proceeding with partial results, job-completion-auditor will report/heal the rest.`,
      );
      break;
    }

    if (round === maxRounds - 1) {
      warnings.push(
        `lexical-worker reached maxRounds=${maxRounds} but ${remaining} source checks are still pending/processing for job ${jobId} — proceeding with partial results.`,
      );
    }
  }

  if (warnings.length) {
    console.warn('runLexicalWorker: completed with warnings for job', jobId, warnings);
  }

  return { batches, warnings };
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

      const { batches: lexicalBatches, warnings: lexicalWarnings } =
        await runLexicalWorker(jobId);

      const promotedCount =
        await rpcOrThrow<number>(
          'promote_verification_results_for_job',
          {
            p_job_id: jobId,
          },
        );

      // ============================================================
      // ФИКС: enrichment больше НЕ запускается отсюда.
      //
      // Раньше здесь было 5 фоновых цепочек (Ordbokene, NAOB, Expression
      // translation+AI, Authoritative+AI, 360° neighborhood), собранных в
      // один Promise.all и запущенных через EdgeRuntime.waitUntil() —
      // каждая цепочка обрабатывала до 20 items последовательным
      // for...await, БЕЗ пагинации. Диагностика по данным entity_translations
      // показала: для job'а с 23 "ta"-expressions автоматический AI-перевод
      // реально дошёл только до 2 из них, после чего вся фоновая цепочка
      // замолкала на 4+ минуты без единой ошибки — сам job при этом уже
      // отчитался статусом 'ready' клиенту, поэтому проблема была не видна
      // снаружи вообще (см. stopper_investigation_summary.md и переписку
      // от 2026-07-06 про диагностику AI-перевода).
      //
      // Теперь enrichment вынесен в job-enrichment-batch-worker — он
      // обрабатывает ОДНУ цепочку небольшим батчем (offset/limit/has_more)
      // за один вызов. job-orchestrator лишь помечает job как готовый к
      // enrichment-стадии; реальную докрутку до полного завершения делает
      // pipeline-supervisor, вызывающий job-enrichment-batch-worker в
      // цикле, пока has_more не станет false по всем цепочкам.
      //
      // enrichment_pending: true в summary — явный флаг для
      // pipeline-supervisor, что после build_result/versioning для этого
      // job'а ещё нужно прогнать enrichment-цепочки.
      // ============================================================

      if (promotedCount > 0) {
        await supabase.rpc('append_job_summary_field', {
          p_job_id: jobId,
          p_field: 'enrichment_pending',
          p_value: {
            promoted_count: promotedCount,
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
        promoted_count: promotedCount,
        enrichment_pending: promotedCount > 0,
        semantic_audit_batches: semanticAuditBatches,
        build_result: buildResult,
        counters,
        final_versioning: versioningResult,
      });
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