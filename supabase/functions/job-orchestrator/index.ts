import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { runHomographStep } from '../_shared/d10-homograph-cards.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  loadJobEntities,
  versionCompletedJob,
} from '../_shared/final-versioning.ts';
import { OrdbokeneClient } from '../_shared/authoritative-morphology-v2/mod.ts';
import {
  SURFACE_PROBE_STAGE,
  surfaceProbeDecision,
} from '../_shared/d10-surface-probe.ts';

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
// D10 25.10.2026 (agreed): content versioning. The card content (translations,
// forms, examples) "before" this job; the first capture of an entity wins.
// Never breaks the job: an error is only logged.
async function captureJobContentBefore(jobId: string, stage: string): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('d10_capture_job_content_before_v1', { p_job_id: jobId });
    if (error) console.warn('[content-versioning] capture failed', jobId, stage, error.message ?? error);
    else if (data === -1) console.warn('[content-versioning] capture returned -1', jobId, stage);
  } catch (e) {
    console.warn('[content-versioning] capture threw', jobId, stage, e instanceof Error ? e.message : e);
  }
}

const PROMOTION_BATCH_LIMIT = 3;

// D10 27.10.2026 (agreed): "surface as lemma" probes (_shared/d10-surface-probe.ts).
// Before the lexical worker: one Ordbøkene lookup per probe; the SQL function
// splits the probe into part-of-speech items (they get the normal five source
// checks, processed by the lexical worker on this same tick) or closes it.
// Ordbøkene not answering -> attempt + 1 (closed at max_attempts by the SQL
// function). Returns how many probes still wait: while any does, this tick
// stops before promotion and the job is not finalised.
const SURFACE_PROBES_PER_TICK = 5;

async function resolveSurfaceProbes(jobId: string): Promise<{
  resolved: number;
  remaining: number;
  warnings: string[];
}> {
  const warnings: string[] = [];
  const { data, error } = await supabase
    .from('lexeme_processing_items')
    .select('id, normalized_lemma')
    .eq('job_id', jobId)
    .eq('current_stage', SURFACE_PROBE_STAGE)
    .order('id')
    .limit(SURFACE_PROBES_PER_TICK);
  if (error) throw new Error(`surface probes read failed: ${safeStringify(error)}`);

  let resolved = 0;
  const client = new OrdbokeneClient();
  for (const probe of (data ?? []) as Array<{ id: string; normalized_lemma: string | null }>) {
    const word = String(probe.normalized_lemma ?? '').trim();
    let outcome: 'split' | 'no_headword' | 'retry' = 'no_headword';
    let pos: string[] = [];
    let evidence: Record<string, unknown> = { query: word, reason: 'empty_word', version: 'd10_surface_probe_v1' };
    if (word) {
      try {
        const decision = surfaceProbeDecision(word, await client.lookup(word, ['bm']));
        outcome = decision.outcome;
        pos = decision.pos;
        evidence = decision.evidence;
      } catch (lookupError) {
        outcome = 'retry';
        evidence = { query: word, error: lookupError instanceof Error ? lookupError.message : String(lookupError),
          version: 'd10_surface_probe_v1' };
      }
    }
    const { data: result, error: rpcError } = await supabase.rpc('d10_resolve_surface_probe_v1', {
      p_item_id: probe.id,
      p_outcome: outcome,
      p_pos: pos,
      p_evidence: evidence,
    });
    // A database error is not an Ordbøkene outage: fail the tick like any
    // rpcOrThrow step, so pipeline-supervisor counts it (no silent endless retry).
    if (rpcError) {
      throw new Error(`RPC d10_resolve_surface_probe_v1 failed for ${probe.id}: ${safeStringify(rpcError)}`);
    }
    if ((result as any)?.closed === true) resolved += 1;
    if ((result as any)?.outcome === 'retry') {
      warnings.push(`surface probe ${probe.id} (${word}): Ordbøkene did not answer, attempt ${(result as any)?.attempt}`);
    }
  }

  const { count, error: countError } = await supabase
    .from('lexeme_processing_items')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('current_stage', SURFACE_PROBE_STAGE);
  if (countError) throw new Error(`surface probes count failed: ${safeStringify(countError)}`);
  if (warnings.length) console.warn('job-orchestrator: surface probe warnings for job', jobId, warnings);
  return { resolved, remaining: count ?? 0, warnings };
}

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

  // One orchestrator invocation processes one full lexical-worker page.
  // Chaining up to 50 HTTP calls here made the outer supervisor request
  // duration depend on job size and could exceed its 45-second budget.
  // Remaining checks stay checkpointed and continue on the next tick.
  const maxRounds = 1;

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

// D10 07.11.2026 (agreed, variant A, D10_family_dictionary_first_v1): the family 360
// of a verb seen for the first time. Its expressions and bindings were created only
// by the ordbokene enrichment chain, i.e. after family injection, so they never got
// into a job. Right before family injection: for promoted verb roots of the job
// without bindings, run ordbokene-lexeme-pipeline-worker (the same call the ordbokene
// chain makes); the injection then adds the expressions to this job (total_items
// grows). Up to 2 roots per call, the rest on the next call; a root is retried at
// most 3 times. A failure never fails the job (the step is then skipped).
// D10 07.11.2026 (agreed, D10_naob_family_v1): the same step also takes the NAOB
// expressions of the verb (naob-family-expressions-worker), once per verb, for old
// verbs too; Ordbøkene is called only when the verb has no Ordbøkene bindings yet.
const FAMILY_DICTIONARY_ROOTS_PER_CALL = 2;
const FAMILY_DICTIONARY_TIMEOUT_MS = 40000;
const FAMILY_NAOB_TIMEOUT_MS = 30000;
const FAMILY_DICTIONARY_BUDGET_MS = 25000;

async function callFamilyWorker(name: string, payload: Record<string, unknown>, timeoutMs: number): Promise<{
  ok: boolean;
  json: unknown;
  detail: Record<string, unknown>;
}> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await safeJson(response);
    const ok = response.ok && (json as { ok?: unknown } | null)?.ok !== false;
    return {
      ok,
      json,
      detail: ok
        ? { http_status: response.status }
        : { http_status: response.status, body: safeStringify(json).slice(0, 2000) },
    };
  } catch (workerError) {
    return { ok: false, json: null, detail: { error: safeStringify(workerError).slice(0, 2000) } };
  }
}

async function runFamilyDictionaryStep(jobId: string): Promise<{
  processed: number;
  remaining: number;
  roots: string[];
}> {
  const started = Date.now();
  let page: {
    ok?: boolean;
    roots?: Array<{
      lexeme_id: string; lemma: string; pos: string; article_id: number;
      need_ordbokene: boolean; need_naob: boolean;
    }>;
    remaining?: number;
  } | null = null;
  try {
    const { data, error } = await supabase.rpc('d10_family_dictionary_roots_page_v2', {
      p_job_id: jobId,
      p_limit: FAMILY_DICTIONARY_ROOTS_PER_CALL,
    });
    if (error) throw error;
    page = data;
  } catch (pageError) {
    console.error('job-orchestrator: family dictionary roots failed for job', jobId, safeStringify(pageError));
    return { processed: 0, remaining: 0, roots: [] };
  }
  const roots = page?.ok === true && Array.isArray(page.roots) ? page.roots : [];
  let processed = 0;
  const done: string[] = [];
  for (const root of roots) {
    if (processed > 0 && Date.now() - started > FAMILY_DICTIONARY_BUDGET_MS) break;
    const outcome: string[] = [];
    if (root.need_ordbokene) {
      const result = await callFamilyWorker('ordbokene-lexeme-pipeline-worker', {
        lemma: root.lemma, parent_lexeme_id: root.lexeme_id, entity_mode: 'lexeme',
        pos: root.pos, expression_id: null, article_id: root.article_id,
        parent_article_id: null, dictionary_code: 'bm', dry_run: false, force_refresh: false,
      }, FAMILY_DICTIONARY_TIMEOUT_MS);
      try {
        await rpcOrThrow('d10_family_dictionary_record_v1', {
          p_job_id: jobId,
          p_root_lexeme_id: root.lexeme_id,
          p_article_id: root.article_id,
          p_ok: result.ok,
          p_detail: result.detail,
        });
      } catch (recordError) {
        console.error('job-orchestrator: family dictionary record failed for job', jobId, safeStringify(recordError));
      }
      if (!result.ok) console.warn('job-orchestrator: family dictionary step failed for root', jobId, root.lemma, safeStringify(result.detail));
      outcome.push(`ordbokene:${result.ok ? 'ok' : 'retry'}`);
    }
    if (root.need_naob) {
      const result = await callFamilyWorker('naob-family-expressions-worker', {
        lexeme_id: root.lexeme_id, lemma: root.lemma,
      }, FAMILY_NAOB_TIMEOUT_MS);
      const answer = result.json as { slugs?: unknown; bind?: unknown; status?: unknown } | null;
      try {
        await rpcOrThrow('d10_family_naob_record_v1', {
          p_job_id: jobId,
          p_root_lexeme_id: root.lexeme_id,
          p_ok: result.ok,
          p_slugs: Array.isArray(answer?.slugs) ? answer!.slugs : [],
          p_detail: result.ok
            ? { status: answer?.status ?? null, bind: answer?.bind ?? null }
            : result.detail,
        });
      } catch (recordError) {
        console.error('job-orchestrator: family NAOB record failed for job', jobId, safeStringify(recordError));
      }
      if (!result.ok) console.warn('job-orchestrator: family NAOB step failed for root', jobId, root.lemma, safeStringify(result.detail));
      outcome.push(`naob:${result.ok ? 'ok' : 'retry'}`);
    }
    processed++;
    done.push(`${root.lemma}:${root.article_id}:${outcome.join(',')}`);
  }
  return { processed, remaining: Number(page?.remaining ?? 0), roots: done };
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

    // pipeline-supervisor sets this after family injection failed 3 times for
    // the job: the job continues without new family members, and the skipped
    // step is listed in the final needs_manual_review report.
    const skipFamilyInjection = body.skip_family_injection === true;
    // D10 stage D2: lets pipeline-supervisor or a manual call skip second cards.
    const skipHomographCards = body.skip_homograph_cards === true;

    const requestedRunId =
      typeof body.run_id === 'string' &&
      body.run_id.trim().length > 0
        ? body.run_id.trim()
        : null;

    let jobsQuery = supabase
      .from('lexeme_processing_jobs')
      .select('*')
      // Explicit recovery may resume a job that source-check progress
      // prematurely marked done before promotion ran.
      .in('status', requestedJobId
        ? ['pending', 'processing', 'ready', 'done', 'partial', 'retry_scheduled']
        : ['pending', 'processing', 'ready', 'partial', 'retry_scheduled'])
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

      if (job.status === 'done') {
        const { count, error } = await supabase
          .from('lexeme_processing_items')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          // D10 27.10.2026: a waiting surface probe is unfinished work too
          .in('current_stage', ['source_checks', SURFACE_PROBE_STAGE]);
        if (error) throw error;
        if (!count) {
          // D10 09.11.2026 (D10_family_dictionary_continue_v1): the dictionary step of family 360 adds no
          // items until it is finished, so a done job whose verb roots still wait for it (Ordbøkene / NAOB)
          // is not skipped: the call goes on to the dictionary step. Test f1eaa6b8: 2 of 21 verbs, then skipped.
          let dictionaryWaiting = false;
          if (job.input_type !== 'synonym_candidate' && !skipFamilyInjection) {
            const { data: waitPage, error: waitError } = await supabase.rpc('d10_family_dictionary_roots_page_v2', {
              p_job_id: jobId,
              p_limit: 1,
            });
            if (waitError) {
              console.warn('job-orchestrator: family dictionary wait check failed for job', jobId, safeStringify(waitError));
            }
            dictionaryWaiting = !waitError && waitPage?.ok === true && Array.isArray(waitPage.roots) && waitPage.roots.length > 0;
          }
          if (!dictionaryWaiting) {
            processedJobs.push({ job_id: jobId, action: 'skipped', reason: 'no unpromoted items' });
            continue;
          }
        }
      }

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
          await loadJobEntities(
            supabase as unknown as Parameters<typeof loadJobEntities>[0],
            jobId,
          );
        await captureJobContentBefore(jobId, 'start');

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

        // D10 27.10.2026 (agreed): surface probes first, so their part-of-speech
        // items are checked by the lexical worker on this same tick.
        const surfaceProbes = await resolveSurfaceProbes(jobId);

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

        // D10 27.10.2026 (agreed): a probe that is still waiting (Ordbøkene did
        // not answer) keeps the job in the orchestrator stage: no promotion,
        // no final result yet. pipeline-supervisor retries on the next tick;
        // the probe is closed at its max_attempts by the SQL function.
        if (surfaceProbes.remaining > 0) {
          processedJobs.push({
            job_id: jobId,
            lexical_batches: lexicalBatches,
            orchestrator_incomplete: true,
            surface_probes_remaining: surfaceProbes.remaining,
            surface_probe_warnings: surfaceProbes.warnings.length ? surfaceProbes.warnings : undefined,
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

        // Expansion queues independent POS checks. Do not promote until they finish.
        const expandedChecksRemaining = await getRemainingSourceCheckCount(jobId);
        if (expandedChecksRemaining > 0) {
          processedJobs.push({
            job_id: jobId,
            lexical_batches: lexicalBatches,
            multi_pos_expanded: multiPosExpanded,
            orchestrator_incomplete: true,
            source_checks_remaining: expandedChecksRemaining,
            enrichment_pending: false,
          });
          continue;
        }

        const promotedCount =
          await rpcOrThrow<number>(
            'promote_verification_results_for_job',
            {
              p_job_id: jobId,
              p_limit: PROMOTION_BATCH_LIMIT,
            },
          );

        const { count: promotionRemaining, error: promotionRemainingError } =
          await supabase
            .from('lexeme_processing_items')
            .select('id', { count: 'exact', head: true })
            .eq('job_id', jobId)
            .eq('current_stage', 'source_checks');

        if (promotionRemainingError) throw promotionRemainingError;

        if ((promotionRemaining ?? 0) > 0) {
          processedJobs.push({
            job_id: jobId,
            lexical_batches: lexicalBatches,
            lexical_warnings: lexicalWarnings.length ? lexicalWarnings : undefined,
            orchestrator_incomplete: true,
            promotion_batch_limit: PROMOTION_BATCH_LIMIT,
            promoted_count: promotedCount,
            promotion_remaining: promotionRemaining,
            promotion_stalled: promotedCount === 0,
            enrichment_pending: false,
          });
          continue;
        }

        // D10 16.10.2026 (step B point 4): a part-of-speech clone without an
        // article of its own (brenne noun) becomes a grey card and goes to the
        // enrichment chains, instead of stopping the job at admission_gate.
        // Idempotent. A failure never fails the job: the clone then stays a
        // grey candidate at the gate (not counted as blocked).
        // Runs BEFORE the family and homograph steps (fix 16.10, passe adj.):
        // the homograph step then sees the grey card, gives it its main
        // article (lowest homograph number) and creates the second card (R9).
        try {
          const gray = await rpcOrThrow<{ ok: boolean; created: number; linked: number; skipped: number }>(
            'd10_promote_gray_pos_clones_v1', { p_job_id: jobId });
          if (gray && (gray.created > 0 || gray.linked > 0)) {
            console.log('job-orchestrator: grey POS clone cards', jobId, safeStringify(gray));
          }
        } catch (grayError) {
          console.error(
            'job-orchestrator: grey POS clone step failed for job',
            jobId,
            safeStringify(grayError),
          );
        }

        // Add family members only after a token has been promoted with an
        // exact Bokmål article and lexeme identity. The RPC inserts the item,
        // its own source checks and an idempotency ledger in one transaction.
        // A failure is reported to pipeline-supervisor instead of failing the
        // whole orchestrator call, so the supervisor can count it and, after
        // repeated failures, continue the job without family injection.
        // D10 27.10.2026 (agreed, D10_synonym_child_job_v1): a child job of
        // NAOB synonym candidates gets full cards and homographs, but no
        // family 360 (the cards are marked deferred_by_policy and can be
        // processed again in full from "Problem words").
        if (!skipFamilyInjection && job.input_type !== 'synonym_candidate') {
          // D10 07.11.2026 (D10_family_dictionary_first_v1): dictionary expressions of
          // new verb roots first, so the injection below can add them to this job.
          const familyDictionary = await runFamilyDictionaryStep(jobId);
          if (familyDictionary.processed > 0) {
            processedJobs.push({
              job_id: jobId,
              promoted_count: promotedCount,
              family_dictionary_roots: familyDictionary.roots,
              family_dictionary_remaining: familyDictionary.remaining,
              orchestrator_incomplete: true,
              enrichment_pending: false,
            });
            continue;
          }
          let familyPage!: { ok: boolean; added: number; has_more: boolean };
          try {
            familyPage = await rpcOrThrow<{
              ok: boolean;
              added: number;
              has_more: boolean;
            }>('d10_inject_verified_job_family_page_v1', {
              p_job_id: jobId,
              p_limit: 10,
            });
            if (familyPage?.ok !== true ||
                !Number.isInteger(familyPage.added) || familyPage.added < 0 ||
                typeof familyPage.has_more !== 'boolean') {
              throw new Error(`FAMILY_INJECTION_INVALID_RESPONSE:${safeStringify(familyPage)}`);
            }
          } catch (familyError) {
            processedJobs.push({
              job_id: jobId,
              promoted_count: promotedCount,
              orchestrator_incomplete: true,
              family_injection_error: safeStringify(familyError),
              enrichment_pending: false,
            });
            continue;
          }
          if (familyPage.added > 0 || familyPage.has_more) {
            processedJobs.push({
              job_id: jobId,
              promoted_count: promotedCount,
              family_candidates_added: familyPage.added,
              family_has_more: familyPage.has_more,
              orchestrator_incomplete: true,
              enrichment_pending: false,
            });
            continue;
          }
        }

        // D10 stage D2 (R9-auto, plan D10_stage_d_plan_v3): second cards.
        // For every promoted main card, homonym articles of the same POS with a
        // different paradigm get their own card (Roman homograph number), which
        // is added to this job as its own item and then follows the normal
        // path (checks, promotion by article, all enrichment chains). Same
        // forms -> one card (R8). A failure here never fails the job: it is
        // logged and the job continues without new second cards.
        if (!skipHomographCards) {
          let homograph: Awaited<ReturnType<typeof runHomographStep>> | null = null;
          try {
            homograph = await runHomographStep(
              (name, args) => supabase.rpc(name, args),
              async (url) => {
                const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
                if (!response.ok) throw new Error(`HTTP_${response.status}`);
                return response.json();
              },
              jobId,
            );
          } catch (homographError) {
            console.error(
              'job-orchestrator: homograph step failed for job',
              jobId,
              safeStringify(homographError),
            );
          }
          if (homograph?.errors.length) {
            console.warn('job-orchestrator: homograph step warnings', jobId, homograph.errors);
          }
          if (homograph && (homograph.added > 0 || (homograph.hasMore && homograph.decided > 0))) {
            processedJobs.push({
              job_id: jobId,
              promoted_count: promotedCount,
              homograph_cards_added: homograph.added,
              homograph_decisions: homograph.decided,
              homograph_has_more: homograph.hasMore,
              orchestrator_incomplete: true,
              enrichment_pending: false,
            });
            continue;
          }
        }

        // D10 24.10.2026 (agreed): a noun WITHOUT an Ordbøkene article is
        // divided by its NAOB articles with the same rule (naob-forms-worker,
        // mode "split"): the lowest article -> the main card, own forms + own
        // meaning -> own card II, III added to this job (so it follows checks,
        // translations and all enrichment chains). Up to 2 words per call;
        // the rest on the next tick. A failure never fails the job.
        if (!skipHomographCards) {
          let naobSplit: { added?: number; has_more?: boolean; results?: unknown } | null = null;
          try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/naob-forms-worker`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ mode: 'split', jobId }),
              signal: AbortSignal.timeout(25000),
            });
            naobSplit = await safeJson(response);
            if (!response.ok) {
              console.error('job-orchestrator: NAOB division failed for job', jobId, safeStringify(naobSplit));
              naobSplit = null;
            }
          } catch (naobError) {
            console.error('job-orchestrator: NAOB division failed for job', jobId, safeStringify(naobError));
          }
          if (naobSplit && (Number(naobSplit.added ?? 0) > 0 || naobSplit.has_more === true)) {
            processedJobs.push({
              job_id: jobId,
              promoted_count: promotedCount,
              naob_cards_added: Number(naobSplit.added ?? 0),
              naob_division_has_more: naobSplit.has_more === true,
              orchestrator_incomplete: true,
              enrichment_pending: false,
            });
            continue;
          }
        }

        const { count: pendingEnrichmentCount } = await supabase
          .from('lexeme_processing_items')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', jobId)
          .eq('current_stage', 'semantic_audit')
          .or('lexeme_id.not.is.null,expression_id.not.is.null');

        // Family expressions with weak evidence remain gray at admission_gate,
        // but still need the expression enrichment chains.
        const { data: familyEnrichmentPage, error: familyEnrichmentError } =
          await supabase.rpc('d10_family_enrichment_items_page_v1', {
            p_job_id: jobId, p_offset: 0, p_limit: 1,
          });
        if (familyEnrichmentError || familyEnrichmentPage?.ok !== true) {
          throw new Error(`FAMILY_ENRICHMENT_PREFLIGHT_FAILED:${safeStringify(familyEnrichmentError ?? familyEnrichmentPage)}`);
        }
        const enrichmentNeeded = (pendingEnrichmentCount ?? 0) > 0 ||
          Number(familyEnrichmentPage.total ?? 0) > 0;

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

        await captureJobContentBefore(jobId, 'final');

        const versioningResult =
          await versionCompletedJob(
            supabase as unknown as Parameters<typeof versionCompletedJob>[0],
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
