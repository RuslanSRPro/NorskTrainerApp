import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_JOBS_PER_TICK = 1;
const LOCK_STALE_SECONDS = 60;
const WORKER_TIMEOUT_MS = 45000;
const BATCH_LIMIT = 3;

const ENRICHMENT_CHAINS = [
  'ordbokene',
  'naob',
  'expression_translation',
  'expression_ai_fallback',
  'authoritative',
  'authoritative_ai_fallback',
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

  const text = JSON.stringify(result.data ?? '').toLowerCase();

  if (!result.ok) {
    if (
      result.status === 0 ||
      result.status === 429 ||
      result.status === 500 ||
      result.status === 502 ||
      result.status === 503 ||
      result.status === 504 ||
      text.includes('timeout') ||
      text.includes('temporarily') ||
      text.includes('unavailable') ||
      text.includes('high demand') ||
      text.includes('wallclocktime') ||
      text.includes('worker_resource_limit') ||
      text.includes('earlydrop')
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

  if ((result.data?.audit_errors ?? 0) > 0) return 'blocked_manual_review';

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

    const enrichmentPending = Boolean(result.data?.processed_jobs?.[0]?.enrichment_pending);

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

    const result = await callWorker('job-enrichment-batch-worker', {
      job_id: jobId,
      chain,
      offset,
      limit: BATCH_LIMIT,
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
      has_more,
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
      // ============================================================
      // ФИКС: раньше здесь брали "N самых старых job'ов со статусом
      // pending/processing/ready" через .limit(), и ТОЛЬКО ПОСЛЕ этого
      // в JS отфильтровывали среди них те, что уже done/needs_manual_review.
      // Если lexeme_processing_jobs.status не переходил в 'completed'
      // одновременно с pipeline_supervisor_state.stage='done', эти
      // "мёртвые" записи навсегда занимали весь LIMIT-срез (самые старые
      // по created_at) — и более новые job'ы никогда не попадали в
      // выборку вообще, сколько бы их ни было. Диагностика подтвердила:
      // job'ы недельной давности (29-30 июня) навсегда блокировали
      // очередь для 127+ новых verification_refresh job'ов.
      //
      // Теперь исключаем done/needs_manual_review НА УРОВНЕ SQL (через
      // отдельный запрос к pipeline_supervisor_state + .not('id','in',...)),
      // ДО применения .limit() — так LIMIT всегда отрезает от реально
      // пригодных к обработке job'ов.
      // ============================================================

      const candidateLimit = Math.max(MAX_JOBS_PER_TICK * 20, 200);

      const { data: doneOrReviewRows, error: doneOrReviewError } = await supabase
        .from('pipeline_supervisor_state')
        .select('job_id')
        .in('stage', ['done', 'needs_manual_review']);

      if (doneOrReviewError) {
        return jsonResponse({
          ok: false,
          stage: 'discover_excluded',
          error: safeStringify(doneOrReviewError),
        }, 500);
      }

      const excludedIds = (doneOrReviewRows ?? []).map((r: any) => r.job_id as string);

      let jobsQuery = supabase
        .from('lexeme_processing_jobs')
        .select('id, status, created_at')
        .in('status', ['pending', 'processing', 'ready'])
        .order('created_at', { ascending: true })
        .limit(candidateLimit);

      if (excludedIds.length > 0) {
        jobsQuery = jobsQuery.not('id', 'in', `(${excludedIds.join(',')})`);
      }

      const { data: candidateJobs, error: candidateError } = await jobsQuery;

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
        excluded_done_or_review: excludedIds.length,
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