import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildCompletionEnforcementFailureSummary,
  COMPLETION_ENFORCEMENT_CANARY_JOB_IDS_ENV,
  COMPLETION_ENFORCEMENT_MODE_ENV,
  COMPLETION_ENFORCEMENT_SUMMARY_FIELD,
  resolveCompletionEnforcementRollout,
  type CompletionEnforcementRollout,
  type CompletionEnforcementSummary,
} from '../_shared/completion-contract/v1/enforcement.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const COMPLETION_ENFORCEMENT_MODE = Deno.env.get(
  COMPLETION_ENFORCEMENT_MODE_ENV,
);
const COMPLETION_ENFORCEMENT_CANARY_JOB_IDS = Deno.env.get(
  COMPLETION_ENFORCEMENT_CANARY_JOB_IDS_ENV,
);

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

// Store deferred pages in the existing JSONB offsets so a single failed item
// cannot keep the entire job at the same offset indefinitely.
const RETRY_PAGE_PREFIX = '__d10_retry_page__';
const MAX_DEFERRED_PAGE_ATTEMPTS = 3;
const MISSING_OFFICIAL_FORMS_PREFIX = '__d10_missing_official_forms__';

function missingOfficialForms(offsets: Record<string, number>): string[] {
  return Object.keys(offsets)
    .filter((key) => key.startsWith(MISSING_OFFICIAL_FORMS_PREFIX))
    .map((key) => key.slice(MISSING_OFFICIAL_FORMS_PREFIX.length));
}


function retryPageKey(chain: Chain, offset: number): string {
  return `${RETRY_PAGE_PREFIX}${chain}__${offset}`;
}

function pendingRetryPages(offsets: Record<string, number>): Array<{
  chain: Chain;
  offset: number;
  key: string;
  attempts: number;
}> {
  return Object.entries(offsets).flatMap(([key, attempts]) => {
    if (!key.startsWith(RETRY_PAGE_PREFIX)) return [];
    const suffix = key.slice(RETRY_PAGE_PREFIX.length);
    const separator = suffix.lastIndexOf('__');
    if (separator < 0) return [];
    const chain = suffix.slice(0, separator) as Chain;
    const offset = Number(suffix.slice(separator + 2));
    if (!ENRICHMENT_CHAINS.includes(chain) || !Number.isSafeInteger(offset) || offset < 0) return [];
    return [{ chain, offset, key, attempts }];
  }).sort((a, b) => ENRICHMENT_CHAINS.indexOf(a.chain) - ENRICHMENT_CHAINS.indexOf(b.chain) || a.offset - b.offset);
}


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

type AppliedCompletionEnforcementSummary = Omit<
  CompletionEnforcementSummary,
  'enforcement_applied'
> & {
  enforcement_applied: true;
  rollout_mode: CompletionEnforcementRollout['mode'];
  enforced_status: 'completed' | 'needs_manual_review';
  enforced_at: string;
};

function isCompletionEnforcementSummary(
  value: unknown,
): value is CompletionEnforcementSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Record<string, unknown>;
  return summary.shadow_mode === false &&
    summary.enforcement_applied === false &&
    (summary.decision === 'allow_completed' ||
      summary.decision === 'needs_manual_review') &&
    typeof summary.learner_ready === 'boolean' &&
    typeof summary.snapshot_token === 'string' &&
    typeof summary.contract_version === 'string';
}

function applyCompletionEnforcementSummary(
  summary: CompletionEnforcementSummary,
  rollout: CompletionEnforcementRollout,
  status: AppliedCompletionEnforcementSummary['enforced_status'],
): AppliedCompletionEnforcementSummary {
  return {
    ...summary,
    enforcement_applied: true,
    rollout_mode: rollout.mode,
    enforced_status: status,
    enforced_at: new Date().toISOString(),
  };
}

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

async function saveState(state: SupervisorState): Promise<boolean> {
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
    return false;
  }

  return true;
}

async function updateJobStatus(
  jobId: string,
  status: string,
  summaryPatch?: Record<string, unknown>,
): Promise<boolean> {
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
    return false;
  }

  return true;
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

async function finalizeWithCompletionEnforcement(
  jobId: string,
  state: SupervisorState,
  rollout: CompletionEnforcementRollout,
  legacyAuditResult: WorkerCallResult,
): Promise<Record<string, unknown>> {
  // Snapshot RPC accepts only terminal jobs. During enforcement the DB job is
  // provisionally terminal, while supervisor state deliberately stays on
  // `audit`. Package 3A read-side still refuses to expose `completed` unless
  // the same completion contract evaluates learner_ready=true.
  const terminalPrepared = await updateJobStatus(jobId, 'completed');

  if (!terminalPrepared) {
    state.last_error = 'completion contract gate could not prepare terminal snapshot';
    await saveState(state);
    return {
      job_id: jobId,
      stage: state.stage,
      step: 'completion-contract-enforcement',
      classification: 'retryable_error',
      enforcement_applied: false,
      reason: state.last_error,
    };
  }

  const contractResult = await callWorker('job-completion-auditor', {
    job_id: jobId,
    mode: 'contract_enforce',
  });
  const rawSummary = contractResult.data?.summary;

  if (!contractResult.ok || !isCompletionEnforcementSummary(rawSummary)) {
    const error = safeStringify(
      contractResult.network_error ?? contractResult.data ??
        'INVALID_COMPLETION_ENFORCEMENT_RESPONSE',
    );
    const failureSummary = buildCompletionEnforcementFailureSummary(
      error,
      rollout.mode,
    );
    const statusUpdated = await updateJobStatus(jobId, 'needs_manual_review', {
      [COMPLETION_ENFORCEMENT_SUMMARY_FIELD]: failureSummary,
      supervisor_last_error: error,
    });

    if (statusUpdated) {
      state.stage = 'needs_manual_review';
      state.last_error = error;
      await saveState(state);
    } else {
      state.last_error = `completion contract failed closed, but status update failed: ${error}`;
      await saveState(state);
    }

    return {
      job_id: jobId,
      stage: state.stage,
      step: 'completion-contract-enforcement',
      classification: statusUpdated
        ? 'blocked_manual_review'
        : 'retryable_error',
      enforcement_applied: statusUpdated,
      reason: 'contract_evaluation_failed',
      detail: contractResult.data,
    };
  }

  const allowCompleted = rawSummary.decision === 'allow_completed' &&
    rawSummary.learner_ready === true;
  const enforcedStatus = allowCompleted
    ? 'completed' as const
    : 'needs_manual_review' as const;
  const appliedSummary = applyCompletionEnforcementSummary(
    rawSummary,
    rollout,
    enforcedStatus,
  );
  const statusUpdated = await updateJobStatus(jobId, enforcedStatus, {
    [COMPLETION_ENFORCEMENT_SUMMARY_FIELD]: appliedSummary,
    ...(allowCompleted
      ? {
        supervisor_completed_at: new Date().toISOString(),
        supervisor_last_error: null,
      }
      : {
        supervisor_last_error:
          `completion contract blocked completion: ${rawSummary.decision_reason}`,
      }),
  });

  if (!statusUpdated) {
    state.last_error =
      `completion contract decision could not update job status: ${enforcedStatus}`;
    await saveState(state);
    return {
      job_id: jobId,
      stage: state.stage,
      step: 'completion-contract-enforcement',
      classification: 'retryable_error',
      enforcement_applied: false,
      decision: rawSummary.decision,
      reason: state.last_error,
    };
  }

  state.stage = allowCompleted ? 'done' : 'needs_manual_review';
  state.last_error = allowCompleted
    ? null
    : `completion contract blocked completion: ${rawSummary.decision_reason}`;
  const stateSaved = await saveState(state);

  return {
    job_id: jobId,
    stage: state.stage,
    step: 'completion-contract-enforcement',
    classification: allowCompleted ? 'success' : 'blocked_manual_review',
    items_checked: legacyAuditResult.data?.items_checked,
    items_still_incomplete_after_heal:
      legacyAuditResult.data?.items_still_incomplete_after_heal,
    has_more: false,
    enforcement_applied: true,
    rollout_mode: rollout.mode,
    rollout_reason: rollout.reason,
    decision: rawSummary.decision,
    decision_reason: rawSummary.decision_reason,
    learner_ready: rawSummary.learner_ready,
    state_saved: stateSaved,
    contract_enforcement: appliedSummary,
  };
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
    const retryPage = state.enrichment_chain_index >= ENRICHMENT_CHAINS.length
      ? pendingRetryPages(state.enrichment_offsets)[0]
      : undefined;
    if (state.enrichment_chain_index >= ENRICHMENT_CHAINS.length && !retryPage) {
      const missing = missingOfficialForms(state.enrichment_offsets);
      state.stage = missing.length ? 'needs_manual_review' : 'audit';
      state.last_error = missing.length
        ? `No official Bokmål article/forms for ${missing.length} lexemes: ${missing.slice(0, 12).join(', ')}`
        : null;
      await saveState(state);
      if (missing.length) await updateJobStatus(jobId, 'needs_manual_review', {
        supervisor_last_error: state.last_error,
        supervisor_failed_step: 'enrichment[forms]',
        forms_missing_official_article_ids: missing,
      });
      return { job_id: jobId, stage: state.stage, classification: missing.length ? 'blocked_manual_review' : 'success' };
    }
    const chain: Chain = retryPage?.chain ?? ENRICHMENT_CHAINS[state.enrichment_chain_index];
    const offset = retryPage?.offset ?? state.enrichment_offsets[chain] ?? 0;

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

    // A missing official article is an honest no-forms outcome, not a
    // transport failure. Visit the other pages before reporting the job as
    // incomplete; never fabricate forms or mark the job completed.
    const formErrors = Array.isArray(result.data?.errors) ? result.data.errors : [];
    const processedForms = Number(result.data?.processed);
    const missingOnly = chain === 'forms' && !result.network_error &&
      processedForms > 0 && Number(result.data?.failed) === formErrors.length &&
      formErrors.length > 0 && Number(result.data?.retryable) === 0 &&
      result.data?.permanent === formErrors.length &&
      (result.data?.has_more === true || result.data?.has_more === false) &&
      (result.data?.has_more === false ||
        (Number.isSafeInteger(result.data?.next_offset) && result.data.next_offset > offset)) &&
      formErrors.every((item: any) => item?.status === 'not_found' &&
        item?.persisted === false &&
        item?.articleProjection?.status === 'no_source_article' &&
        Array.isArray(item?.articleIds) && item.articleIds.length === 0 &&
        typeof item?.lexemeId === 'string');

    if (missingOnly) {
      for (const item of formErrors) {
        state.enrichment_offsets[`${MISSING_OFFICIAL_FORMS_PREFIX}${item.lexemeId}`] = 1;
      }
      if (retryPage) delete state.enrichment_offsets[retryPage.key];
      else {
        state.enrichment_offsets[chain] = result.data.has_more
          ? result.data.next_offset : offset + processedForms;
        if (!result.data.has_more) state.enrichment_chain_index++;
      }
      const atEnd = state.enrichment_chain_index >= ENRICHMENT_CHAINS.length &&
        pendingRetryPages(state.enrichment_offsets).length === 0;
      const missing = missingOfficialForms(state.enrichment_offsets);
      state.stage = atEnd ? 'needs_manual_review' : 'enrichment';
      state.last_error = atEnd
        ? `No official Bokmål article/forms for ${missing.length} lexemes: ${missing.slice(0, 12).join(', ')}`
        : null;
      await saveState(state);
      if (atEnd) await updateJobStatus(jobId, 'needs_manual_review', {
        supervisor_last_error: state.last_error,
        supervisor_failed_step: 'enrichment[forms]',
        forms_missing_official_article_ids: missing,
      });
      return { job_id: jobId, stage: state.stage, step: 'enrichment[forms]',
        classification: atEnd ? 'blocked_manual_review' : 'success',
        no_official_article: formErrors.length, next_offset: state.enrichment_offsets[chain] };
    }

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
      // Only move past a page when the batch worker returned a complete,
      // structured page result. Network errors and failed page loads stay put.
      const processed = Number(result.data?.processed);
      const failed = Number(result.data?.failed);
      const next = result.data?.next_offset;
      const hasMore = result.data?.has_more;
      const completePage = !result.network_error && processed > 0 &&
        failed > 0 && Number(result.data?.retryable) === failed &&
        (hasMore === true || hasMore === false) &&
        (hasMore === false || (Number.isSafeInteger(next) && next > offset));

      if (completePage) {
        const key = retryPage?.key ?? retryPageKey(chain, offset);
        const attempts = retryPage ? (state.enrichment_offsets[key] ?? 0) + 1 : 0;
        if (attempts >= MAX_DEFERRED_PAGE_ATTEMPTS) {
          state.stage = 'needs_manual_review';
          state.last_error = `enrichment[${chain}] page ${offset}: ${MAX_DEFERRED_PAGE_ATTEMPTS} deferred retries failed: ${safeStringify(result.data)}`;
          await saveState(state);
          await updateJobStatus(jobId, 'needs_manual_review', {
            supervisor_last_error: state.last_error,
            supervisor_failed_step: `enrichment[${chain}]`,
          });
          return { job_id: jobId, stage: state.stage, step: `enrichment[${chain}]`, classification: 'blocked_manual_review' };
        }
        state.enrichment_offsets[key] = attempts;
        if (!retryPage) {
          state.enrichment_offsets[chain] = hasMore ? Number(next) : offset + processed;
          if (!hasMore) state.enrichment_chain_index++;
        }
        // Failed pages are retried after all chains, so downstream forms for
        // the successful items do not wait for one timed-out item.
        state.last_error = null;
        await saveState(state);
        return { job_id: jobId, stage: state.stage, step: `enrichment[${chain}]`,
          classification: 'retryable_error', deferred_page: offset, failed,
          detail: result.data };
      }
      state.last_error = safeStringify(result.data ?? result.network_error);
      await saveState(state);
      return { job_id: jobId, stage: state.stage, step: `enrichment[${chain}]`,
        classification, detail: result.network_error ?? result.data };
    }

    if (retryPage) {
      delete state.enrichment_offsets[retryPage.key];
      // Replay downstream chains for the lexeme whose upstream page just
      // recovered. Their calls must run again before auditing completion.
      for (let i = ENRICHMENT_CHAINS.indexOf(chain) + 1; i < ENRICHMENT_CHAINS.length; i++) {
        state.enrichment_offsets[ENRICHMENT_CHAINS[i]] = 0;
      }
      state.enrichment_chain_index = ENRICHMENT_CHAINS.indexOf(chain) + 1;
      state.last_error = null;
      await saveState(state);
      return { job_id: jobId, stage: state.stage,
        step: `enrichment[${chain}]`, classification: 'success', recovered_page: offset };
    }

    const hasMore = Boolean(result.data?.has_more);
    const nextOffset = Number(result.data?.next_offset ?? offset);

    state.enrichment_offsets[chain] = hasMore ? nextOffset : nextOffset || offset;
    state.last_error = null;

    if (!hasMore) {
      const nextIndex = state.enrichment_chain_index + 1;

      // Defer audit until every failed page has been retried. Keeping the
      // index at length lets the next tick process the pending retry pages.
      state.enrichment_chain_index = nextIndex;
      if (nextIndex >= ENRICHMENT_CHAINS.length &&
        pendingRetryPages(state.enrichment_offsets).length === 0) {
        const missing = missingOfficialForms(state.enrichment_offsets);
        state.stage = missing.length ? 'needs_manual_review' : 'audit';
        if (missing.length) state.last_error =
          `No official Bokmål article/forms for ${missing.length} lexemes: ${missing.slice(0, 12).join(', ')}`;
      }
    }

    await saveState(state);
    if (state.stage === 'needs_manual_review') await updateJobStatus(jobId, 'needs_manual_review', {
      supervisor_last_error: state.last_error,
      supervisor_failed_step: 'enrichment[forms]',
      forms_missing_official_article_ids: missingOfficialForms(state.enrichment_offsets),
    });

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
        // recalculate_job_progress can mark the job done while source-check
        // items are still waiting for promotion. Keep it discoverable by cron.
        const resumed = await updateJobStatus(jobId, 'processing');
        if (!resumed) {
          return {
            job_id: jobId,
            stage: state.stage,
            step: 'job-completion-auditor',
            classification: 'retryable_error',
            reason: 'could not resume job with unpromoted items',
          };
        }
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
        const enforcementRollout = resolveCompletionEnforcementRollout(
          jobId,
          COMPLETION_ENFORCEMENT_MODE,
          COMPLETION_ENFORCEMENT_CANARY_JOB_IDS,
        );

        if (enforcementRollout.enforce) {
          return await finalizeWithCompletionEnforcement(
            jobId,
            state,
            enforcementRollout,
            result,
          );
        }

        state.stage = 'done';
        state.last_error = null;

        await updateJobStatus(jobId, 'completed', {
          supervisor_completed_at: new Date().toISOString(),
        });

        // Package 3B shadow observation is deliberately post-terminal:
        // get_completion_evidence_snapshot_v1 rejects non-terminal jobs.
        // Persist the legacy terminal decision first, then ask the auditor
        // to record completion-contract/v1 diagnostics. A shadow failure is
        // observable but never changes the legacy status or stage.
        await saveState(state);

        const contractShadowResult = await callWorker(
          'job-completion-auditor',
          {
            job_id: jobId,
            mode: 'contract_shadow',
          },
        );

        if (!contractShadowResult.ok) {
          console.error(
            'pipeline-supervisor: completion contract shadow failed',
            jobId,
            safeStringify(
              contractShadowResult.network_error ?? contractShadowResult.data,
            ),
          );
        }

        return {
          job_id: jobId,
          stage: state.stage,
          step: 'job-completion-auditor',
          classification: 'success',
          items_checked: result.data?.items_checked,
          items_still_incomplete_after_heal:
            result.data?.items_still_incomplete_after_heal,
          has_more: false,
          contract_shadow: {
            attempted: true,
            recorded: contractShadowResult.ok,
            detail: contractShadowResult.data,
          },
        };
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
