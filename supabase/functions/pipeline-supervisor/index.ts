import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_JOBS_PER_TICK = 3;
const LOCK_STALE_SECONDS = 60;
const WORKER_TIMEOUT_MS = 45000;
const BATCH_LIMIT = 3;

// ДОБАВЛЕНО (05.08.2026): для этих цепочек job-enrichment-batch-worker
// НЕ использует runChunked/CONCURRENCY=3 (как остальные) — весь список
// уходит ОДНИМ HTTP-вызовом в ai-enrichment-worker, который сам батчит до
// BATCH_SIZE=10 в ОДИН запрос к Gemini (см. ai-enrichment-worker/index.ts,
// processCandidatesBatch/callGeminiBatch). Значит больший limit здесь — не
// больше параллельных внешних вызовов (всё ещё один round-trip к Gemini),
// а полнее использование уже поддерживаемой пакетности. Замер на живых
// данных (job a958eced, 05.08.2026): при limit=3 цепочка
// expression_ai_fallback давала ~6.2 items/мин — практически на пределе
// теоретического максимума для BATCH_LIMIT=3 при тике 30с. Подняли до 10,
// совпадает с BATCH_SIZE самого ai-enrichment-worker — тот же один
// Gemini-вызов, но до ~3.3x больше items за тик.
// ФИКС (07.08.2026): поднято 10→20, синхронно с BATCH_SIZE в
// ai-enrichment-worker (оба числа держим вместе — раздельное поднятие
// эффекта не даёт, см. комментарий там).
// ФИКС (20.08.2026): добавлена 'translation_reorder' — та же логика, её
// собственный job-scoped вызов теперь тоже уходит одним HTTP-вызовом с
// массивом lexeme_ids в translation-aspect-reorder-worker (который сам
// эффективно батчит группы по 20 в один Gemini-вызов внутри, см. её
// отдельный файл v2). limit здесь фактически больше не имеет значения для
// этой конкретной цепочки — enqueueTranslationReorderEnrichment теперь
// игнорирует offset/limit и всегда забирает job целиком за один шаг (см.
// её собственный комментарий в job-enrichment-batch-worker) — но
// добавление в AI_FALLBACK_CHAINS оставлено для консистентности и на
// случай, если это поведение когда-нибудь изменится обратно на постраничное.
const AI_FALLBACK_BATCH_LIMIT = 20;
const AI_FALLBACK_CHAINS = new Set(['expression_ai_fallback', 'authoritative_ai_fallback', 'translation_reorder']);

// ФИКС (20.08.2026, найдено при разборе стоимости): добавлена
// 'translation_reorder' — раньше эта цепочка была полностью реализована
// в job-enrichment-batch-worker, но НИКОГДА не входила в этот список, то
// есть обычный round-robin её никогда не вызывал. Единственный путь, каким
// она реально работала — отдельный глобальный pg_cron (каждые 2 минуты,
// по всей базе, независимо от job'ов), вызывавший translation-aspect-
// reorder-worker напрямую и притом БЕЗ батчинга по группам (Gemini
// вызывался отдельно на каждую multi-variant группу) — измерено 4132
// реальных AI-решения за 05.08-19.08, вероятная главная статья расхода.
// Позиция — МЕЖДУ 'authoritative_ai_fallback' и
// 'translation_canonicalization', как и предписано собственным
// комментарием enqueueTranslationReorderEnrichment в
// job-enrichment-batch-worker (все варианты перевода уже на месте к этому
// моменту, а canonicalization должна видеть УЖЕ переставленный порядок).
// Отдельный глобальный cron (id=3 в cron.job) предлагается отключить —
// `SELECT cron.unschedule(3)` — ПОСЛЕ деплоя этой правки, не раньше.
const ENRICHMENT_CHAINS = [
  'ordbokene',
  'naob',
  'naob_synonyms',
  'lexeme_translation',
  'expression_translation',
  'authoritative',
  'expression_ai_fallback',
  'authoritative_ai_fallback',
  'translation_reorder',
  'translation_canonicalization',
  'forms',
] as const;

type Chain = (typeof ENRICHMENT_CHAINS)[number];

type WorkerCallResult = {
  ok: boolean;
  status: number;
  data: any;
  network_error?: string;
};

type Classification =
  | 'success'
  | 'retryable_error'
  | 'permanent_error'
  | 'blocked_manual_review';

type SupervisorState = {
  job_id: string;
  stage: 'orchestrator' | 'enrichment' | 'audit' | 'done' | 'needs_manual_review';
  enrichment_chain_index: number;
  enrichment_offsets: Record<string, number>;
  audit_offset: number;
  last_error: string | null;
};

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

async function callWorker(
  name: string,
  payload: Record<string, unknown>,
  timeoutMs = WORKER_TIMEOUT_MS,
): Promise<WorkerCallResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
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

    return {
      ok: response.ok && data?.ok !== false,
      status: response.status,
      data,
    };
  } catch (fetchError) {
    return {
      ok: false,
      status: 0,
      data: {
        error: safeStringify(fetchError),
        timeout: true,
        worker: name,
      },
      network_error: `fetch to ${name} failed: ${safeStringify(fetchError)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

function classifyWorkerResult(result: WorkerCallResult): Classification {
  if (result.network_error) return 'retryable_error';

  if (typeof result.data?.failed === 'number' && result.data.failed > 0) {
    if ((result.data?.permanent ?? 0) > 0) return 'blocked_manual_review';
    if ((result.data?.retryable ?? 0) > 0) return 'retryable_error';
    return 'retryable_error';
  }

  const text = JSON.stringify(result.data ?? '').toLowerCase();

  if (!result.ok) {
    if (
      result.status === 0 ||
      result.status === 429 ||
      result.status === 500 ||
      result.status === 502 ||
      result.status === 503 ||
      result.status === 504 ||
      /"status"\s*:\s*5\d\d/.test(text) ||
      text.includes('timeout') ||
      text.includes('temporarily') ||
      text.includes('unavailable') ||
      text.includes('high demand') ||
      text.includes('wallclocktime') ||
      text.includes('worker_resource_limit') ||
      text.includes('earlydrop') ||
      text.includes('resource_exhausted') ||
      text.includes('quota')
    ) {
      return 'retryable_error';
    }

    return 'permanent_error';
  }

  if ((result.data?.failed ?? 0) > 0) {
    if ((result.data?.retryable ?? 0) > 0 && (result.data?.permanent ?? 0) === 0) {
      return 'retryable_error';
    }

    if ((result.data?.permanent ?? 0) > 0) {
      return 'blocked_manual_review';
    }

    return 'retryable_error';
  }

  if ((result.data?.error_count ?? 0) > 0) {
    if (
      text.includes('503') ||
      text.includes('429') ||
      text.includes('unavailable') ||
      text.includes('high demand')
    ) {
      return 'retryable_error';
    }

    return 'blocked_manual_review';
  }

  if ((result.data?.audit_errors ?? 0) > 0) {
    if (
      text.includes('502') ||
      text.includes('503') ||
      text.includes('429') ||
      text.includes('bad gateway') ||
      text.includes('unavailable') ||
      text.includes('high demand') ||
      text.includes('timeout')
    ) {
      return 'retryable_error';
    }

    return 'blocked_manual_review';
  }

  return 'success';
}

async function loadState(jobId: string): Promise<SupervisorState> {
  const { data, error } = await supabase
    .from('pipeline_supervisor_state')
    .select('*')
    .eq('job_id', jobId)
    .maybeSingle();

  if (error) {
    console.error('pipeline-supervisor: failed to load state', jobId, safeStringify(error));
  }

  if (data) {
    return {
      job_id: jobId,
      stage: data.stage,
      enrichment_chain_index: data.enrichment_chain_index ?? 0,
      enrichment_offsets: data.enrichment_offsets ?? {},
      audit_offset: data.audit_offset ?? 0,
      last_error: data.last_error ?? null,
    };
  }

  return {
    job_id: jobId,
    stage: 'orchestrator',
    enrichment_chain_index: 0,
    enrichment_offsets: {},
    audit_offset: 0,
    last_error: null,
  };
}

async function saveState(state: SupervisorState): Promise<void> {
  const { error } = await supabase.from('pipeline_supervisor_state').upsert({
    job_id: state.job_id,
    stage: state.stage,
    enrichment_chain_index: state.enrichment_chain_index,
    enrichment_offsets: state.enrichment_offsets,
    audit_offset: state.audit_offset,
    last_error: state.last_error,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('pipeline-supervisor: failed to save state', state.job_id, safeStringify(error));
  }
}

async function updateJobStatus(jobId: string, status: string, summaryPatch?: Record<string, unknown>): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (summaryPatch) {
    const { data: existing } = await supabase
      .from('lexeme_processing_jobs')
      .select('summary')
      .eq('id', jobId)
      .maybeSingle();

    payload.summary = {
      ...(existing?.summary ?? {}),
      ...summaryPatch,
    };
  }

  const { error } = await supabase
    .from('lexeme_processing_jobs')
    .update(payload)
    .eq('id', jobId);

  if (error) {
    console.error('pipeline-supervisor: failed to update job status', jobId, status, safeStringify(error));
  }
}

async function checkEnrichmentPending(jobId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('lexeme_processing_jobs')
    .select('summary')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    console.error(
      'pipeline-supervisor: checkEnrichmentPending failed to load job summary',
      jobId,
      safeStringify(error),
    );
    return false;
  }

  return Boolean(data?.summary?.enrichment_pending);
}

async function claimJob(jobId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_pipeline_supervisor_job', {
    p_job_id: jobId,
    p_stale_seconds: LOCK_STALE_SECONDS,
  });

  if (error) {
    console.error('pipeline-supervisor: claim failed', jobId, safeStringify(error));
    return false;
  }

  return Boolean(data);
}

async function releaseJob(jobId: string): Promise<void> {
  const { error } = await supabase.rpc('release_pipeline_supervisor_job', {
    p_job_id: jobId,
  });

  if (error) {
    console.error('pipeline-supervisor: release failed', jobId, safeStringify(error));
  }
}

async function processOneStep(jobId: string): Promise<Record<string, unknown>> {
  const state = await loadState(jobId);

  if (state.stage === 'done' || state.stage === 'needs_manual_review') {
    return {
      job_id: jobId,
      stage: state.stage,
      action: 'skipped',
      reason: 'already terminal',
    };
  }

  if (state.stage === 'orchestrator') {
    const result = await callWorker('job-orchestrator', { job_id: jobId });
    const classification = classifyWorkerResult(result);

    if (classification === 'permanent_error' || classification === 'blocked_manual_review') {
      state.stage = 'needs_manual_review';
      state.last_error = safeStringify(result.data ?? result.network_error);
      await saveState(state);
      await updateJobStatus(jobId, 'needs_manual_review', {
        supervisor_last_error: state.last_error,
      });

      return {
        job_id: jobId,
        stage: state.stage,
        step: 'job-orchestrator',
        classification,
        detail: result.data,
      };
    }

    if (classification === 'retryable_error') {
      state.last_error = safeStringify(result.data ?? result.network_error);
      await saveState(state);

      return {
        job_id: jobId,
        stage: state.stage,
        step: 'job-orchestrator',
        classification,
        detail: result.network_error ?? result.data,
      };
    }

    const firstJobResult = result.data?.processed_jobs?.[0];

    const orchestratorSkipped = firstJobResult?.action === 'skipped';

    if (orchestratorSkipped) {
      state.last_error = null;
      await saveState(state); // stage НЕ меняем — остаёмся в 'orchestrator'

      return {
        job_id: jobId,
        stage: state.stage,
        step: 'job-orchestrator',
        classification: 'success',
        orchestrator_skipped: true,
        reason: firstJobResult?.reason,
        note: 'job-orchestrator run was locked by an in-flight call, retrying orchestrator stage on next tick',
      };
    }

    const orchestratorIncomplete = Boolean(firstJobResult?.orchestrator_incomplete);

    if (orchestratorIncomplete) {
      state.last_error = null;
      await saveState(state);

      return {
        job_id: jobId,
        stage: state.stage,
        step: 'job-orchestrator',
        classification: 'success',
        orchestrator_incomplete: true,
        source_checks_remaining: firstJobResult?.source_checks_remaining,
        note: 'large batch, retrying orchestrator stage on next tick',
      };
    }

    const enrichmentPending = await checkEnrichmentPending(jobId);

    state.stage = enrichmentPending ? 'enrichment' : 'audit';
    state.last_error = null;
    await saveState(state);

    return {
      job_id: jobId,
      stage: state.stage,
      step: 'job-orchestrator',
      classification: 'success',
    };
  }

  if (state.stage === 'enrichment') {
    const chain: Chain = ENRICHMENT_CHAINS[state.enrichment_chain_index % ENRICHMENT_CHAINS.length];
    const offset = state.enrichment_offsets[chain] ?? 0;

    // ДОБАВЛЕНО (05.08.2026): точечно больший limit для двух AI-цепочек —
    // см. комментарий у AI_FALLBACK_BATCH_LIMIT/AI_FALLBACK_CHAINS выше.
    const effectiveLimit = AI_FALLBACK_CHAINS.has(chain) ? AI_FALLBACK_BATCH_LIMIT : BATCH_LIMIT;

    const result = await callWorker('job-enrichment-batch-worker', {
      job_id: jobId,
      chain,
      offset,
      limit: effectiveLimit,
    });

    const classification = classifyWorkerResult(result);

    if (classification === 'permanent_error' || classification === 'blocked_manual_review') {
      state.stage = 'needs_manual_review';
      state.last_error = safeStringify(result.data ?? result.network_error);
      await saveState(state);
      await updateJobStatus(jobId, 'needs_manual_review', {
        supervisor_last_error: state.last_error,
        supervisor_failed_step: `enrichment[${chain}]`,
      });

      return {
        job_id: jobId,
        stage: state.stage,
        step: `enrichment[${chain}]`,
        classification,
        detail: result.data,
      };
    }

    if (classification === 'retryable_error') {
      state.last_error = safeStringify(result.data ?? result.network_error);
      await saveState(state);

      return {
        job_id: jobId,
        stage: state.stage,
        step: `enrichment[${chain}]`,
        classification,
        detail: result.network_error ?? result.data,
      };
    }

    const hasMore = Boolean(result.data?.has_more);
    const nextOffset = Number(result.data?.next_offset ?? offset);

    state.enrichment_offsets[chain] = hasMore ? nextOffset : nextOffset || offset;
    state.last_error = null;

    if (!hasMore) {
      const nextIndex = state.enrichment_chain_index + 1;

      if (nextIndex >= ENRICHMENT_CHAINS.length) {
        state.stage = 'audit';
      } else {
        state.enrichment_chain_index = nextIndex;
      }
    }

    await saveState(state);

    return {
      job_id: jobId,
      stage: state.stage,
      step: `enrichment[${chain}]`,
      classification: 'success',
      processed: result.data?.processed,
      successful: result.data?.successful,
      failed: result.data?.failed,
      has_more_this_chain: hasMore,
      chain_done: !hasMore,
    };
  }

  if (state.stage === 'audit') {
    const previousLastError = state.last_error;

    const result = await callWorker('job-completion-auditor', {
      job_id: jobId,
      heal: true,
      limit: BATCH_LIMIT,
      offset: state.audit_offset,
    });

    const classification = classifyWorkerResult(result);

    if (classification === 'permanent_error' || classification === 'blocked_manual_review') {
      state.stage = 'needs_manual_review';
      state.last_error = safeStringify(result.data ?? result.network_error);
      await saveState(state);
      await updateJobStatus(jobId, 'needs_manual_review', {
        supervisor_last_error: state.last_error,
        supervisor_failed_step: 'job-completion-auditor',
      });

      return {
        job_id: jobId,
        stage: state.stage,
        step: 'job-completion-auditor',
        classification,
        detail: result.data,
      };
    }

    if (classification === 'retryable_error') {
      state.last_error = safeStringify(result.data ?? result.network_error);
      await saveState(state);

      return {
        job_id: jobId,
        stage: state.stage,
        step: 'job-completion-auditor',
        classification,
        detail: result.network_error ?? result.data,
      };
    }

    const hasMore = Boolean(result.data?.has_more);
    const nextOffset = Number(result.data?.next_offset ?? state.audit_offset);

    state.audit_offset = hasMore ? nextOffset : state.audit_offset;
    state.last_error = null;

    if (!hasMore) {
      // ДОБАВЛЕНО (07.08.2026): job-completion-auditor теперь явно
      // сообщает, остались ли items, вообще не дошедшие до промоушена
      // (audit их физически не видит своим обычным запросом — см.
      // комментарий в job-completion-auditor/index.ts,
      // countUnpromotedItems). Если такие есть, audit-цикл не может их
      // починить сам — им нужен runLexicalWorker/
      // promote_verification_results_for_job, то есть стадия
      // 'orchestrator', не 'audit' и не 'done'.
      const unpromotedRemaining = Number(result.data?.unpromoted_items_remaining ?? 0);

      if (unpromotedRemaining > 0) {
        state.stage = 'orchestrator';
        state.audit_offset = 0;
        state.last_error = null;
        await saveState(state);

        return {
          job_id: jobId,
          stage: state.stage,
          step: 'job-completion-auditor',
          classification: 'success',
          unpromoted_items_remaining: unpromotedRemaining,
          note: 'audit found unpromoted items invisible to its own query — routing back to orchestrator stage to finish verification/promotion',
        };
      }

      const stillIncomplete = Number(result.data?.items_still_incomplete_after_heal ?? 0);

      if (stillIncomplete > 0) {
        if (previousLastError === '__second_pass_incomplete__') {
          state.stage = 'needs_manual_review';
          state.last_error = `still incomplete after 2 full heal passes: ${stillIncomplete} items`;
          await saveState(state);
          await updateJobStatus(jobId, 'needs_manual_review', {
            supervisor_last_error: state.last_error,
          });

          return {
            job_id: jobId,
            stage: state.stage,
            step: 'job-completion-auditor',
            classification: 'blocked_manual_review',
            items_still_incomplete_after_heal: stillIncomplete,
          };
        }

        state.audit_offset = 0;
        state.last_error = '__second_pass_incomplete__';
      } else {
        state.stage = 'done';
        state.last_error = null;

        await updateJobStatus(jobId, 'completed', {
          supervisor_completed_at: new Date().toISOString(),
        });
      }
    }

    await saveState(state);

    return {
      job_id: jobId,
      stage: state.stage,
      step: 'job-completion-auditor',
      classification: 'success',
      items_checked: result.data?.items_checked,
      items_still_incomplete_after_heal: result.data?.items_still_incomplete_after_heal,
      has_more: hasMore,
    };
  }

  return {
    job_id: jobId,
    stage: state.stage,
    action: 'no-op',
  };
}

async function processOneStepWithLock(jobId: string): Promise<Record<string, unknown>> {
  const claimed = await claimJob(jobId);

  if (!claimed) {
    return {
      job_id: jobId,
      action: 'skipped',
      reason: 'locked by another in-flight tick',
    };
  }

  try {
    return await processOneStep(jobId);
  } finally {
    await releaseJob(jobId);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const explicitJobId =
      typeof body.job_id === 'string' && body.job_id.trim()
        ? body.job_id.trim()
        : null;

    let jobIds: string[];
    let debugInfo: Record<string, unknown> = {};

    if (explicitJobId) {
      jobIds = [explicitJobId];
    } else {
      const candidateLimit = Math.max(MAX_JOBS_PER_TICK * 20, 200);

      const { data: candidateJobs, error: candidateError } = await supabase
        .rpc('get_active_pipeline_jobs', { p_limit: candidateLimit });

      if (candidateError) {
        return jsonResponse({
          ok: false,
          stage: 'discover_jobs',
          error: safeStringify(candidateError),
        }, 500);
      }

      const candidateIds = (candidateJobs ?? []).map((j: any) => j.id as string);

      jobIds = candidateIds.slice(0, MAX_JOBS_PER_TICK);

      debugInfo = {
        candidates_found: candidateIds.length,
        selected_for_this_tick: jobIds.length,
      };
    }

    const results: Record<string, unknown>[] = [];

    for (const jobId of jobIds) {
      try {
        results.push(await processOneStepWithLock(jobId));
      } catch (err) {
        results.push({
          job_id: jobId,
          error: safeStringify(err),
        });
      }
    }

    return jsonResponse({
      ok: true,
      jobs_processed: jobIds.length,
      debug: debugInfo,
      results,
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