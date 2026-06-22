import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  'SUPABASE_SERVICE_ROLE_KEY',
)!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

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

async function runLexicalWorker(jobId: string) {
  const batches = [];

  for (let i = 0; i < 5; i++) {
    const workerResponse = await fetch(
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

    const workerJson = await safeJson(workerResponse);
    batches.push(workerJson);

    if (!workerJson.claimed || workerJson.claimed === 0) {
      break;
    }
  }

  return batches;
}

async function runFormEnrichment(jobId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/form-enrichment-worker`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 50,
        job_id: jobId,
      }),
    },
  );

  return await safeJson(response);
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

async function runSemanticNormalizationWorker(jobId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/semantic-normalization-worker`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: 50,
        job_id: jobId,
      }),
    },
  );

  return await safeJson(response);
}

// --- Variant B / Ordbokene deep enrichment pipeline ----------------------
//
// Triggered once per job, after promote_verification_results_for_job, for
// every item that was just promoted into lexemes/expression_catalog. Runs
// in the background via EdgeRuntime.waitUntil() — does not block the
// response. ordbokene-lexeme-pipeline-worker resolves the article itself
// from `lemma`, so no separate article lookup is needed here.
//
// NAOB (via authoritative-enrichment-pipeline-worker) is intentionally not
// wired in yet — its NAOB path requires a `source_lemma` whose derivation
// from job-orchestrator's available data has not been worked out, and
// source-runners.ts has not been reviewed. Ordbokene-only for now.
//
// Known limitation: if job-orchestrator is invoked again for the same job
// while items are still in current_stage='semantic_audit' (e.g. a retry),
// this will re-trigger enrichment for the same lemmas. That is wasteful but
// not unsafe — ordbokene-lexeme-pipeline-worker's promoteStandaloneExpression
// and ordbokene-expression-promotion-worker both already skip existing
// expression_catalog rows rather than overwriting them.
//
// Cap of 20 items per run mirrors the existing maxPromotionBatches /
// maxResolverRuns pattern inside ordbokene-lexeme-pipeline-worker itself —
// a backlog beyond that is simply picked up on a later orchestrator run.
const ORDBOKENE_ENRICHMENT_BATCH_LIMIT = 20;

async function enqueueOrdbokeneEnrichment(jobId: string) {
  const { data: promotedItems, error } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, lexeme_id, normalized_lemma, surface_form, match_type')
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .or('expression_id.not.is.null,lexeme_id.not.is.null')
    .limit(ORDBOKENE_ENRICHMENT_BATCH_LIMIT);

  if (error) {
    console.error(
      'enqueueOrdbokeneEnrichment: failed to load promoted items for job',
      jobId,
      safeStringify(error),
    );
    return;
  }

  for (const item of promotedItems ?? []) {
    const lemma = item.normalized_lemma ?? item.surface_form;
    if (!lemma) continue;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/ordbokene-lexeme-pipeline-worker`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lemma,
            parent_lexeme_id: item.lexeme_id ?? null,
            dry_run: false,
          }),
        },
      );

      const result = await safeJson(response);

      if (!result.ok) {
        console.error(
          'enqueueOrdbokeneEnrichment: pipeline failed for',
          lemma,
          'job',
          jobId,
          safeStringify(result),
        );
      }
    } catch (enrichError) {
      console.error(
        'enqueueOrdbokeneEnrichment: request failed for',
        lemma,
        'job',
        jobId,
        safeStringify(enrichError),
      );
    }
  }
}
// ---------------------------------------------------------------------

// --- Variant B / NAOB enrichment pipeline ---------------------------------
//
// Same trigger point and same EdgeRuntime.waitUntil() background pattern as
// Ordbokene above, but only for items with an expression_id — the NAOB
// chain (naob-pipeline-worker → naob-expression-batch-worker →
// naob-structure-extractor) is expression-only by construction, it has no
// lexeme mode at all (unlike ordbokene-lexeme-pipeline-worker). Calling it
// for a plain lexeme would be meaningless.
//
// naob-pipeline-worker requires `expression_lemma`, not `lemma` — different
// field name than the Ordbokene worker. source_lemma is intentionally left
// unset here; buildCandidateSlugs() inside naob-expression-batch-worker
// already falls back to trying every token of the expression when
// source_lemma is absent (see architecture-audit-full.md section 46).
//
// expression_review_status is no longer computed by this pipeline's TS code
// at all — a database trigger recomputes it from ordbokene_status +
// naob_status whenever either column changes (section 46-47), so no extra
// coordination is needed here between the two enrichment calls below.
const NAOB_ENRICHMENT_BATCH_LIMIT = 20;

async function enqueueNaobEnrichment(jobId: string) {
  const { data: promotedItems, error } = await supabase
    .from('lexeme_processing_items')
    .select('id, expression_id, normalized_lemma, surface_form, match_type')
    .eq('job_id', jobId)
    .eq('current_stage', 'semantic_audit')
    .not('expression_id', 'is', null)
    .limit(NAOB_ENRICHMENT_BATCH_LIMIT);

  if (error) {
    console.error(
      'enqueueNaobEnrichment: failed to load promoted items for job',
      jobId,
      safeStringify(error),
    );
    return;
  }

  for (const item of promotedItems ?? []) {
    const expressionLemma = item.normalized_lemma ?? item.surface_form;
    if (!expressionLemma) continue;

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/naob-pipeline-worker`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            expression_lemma: expressionLemma,
            update_catalog: true,
          }),
        },
      );

      const result = await safeJson(response);

      if (!result.ok) {
        console.error(
          'enqueueNaobEnrichment: pipeline failed for',
          expressionLemma,
          'job',
          jobId,
          safeStringify(result),
        );
      }
    } catch (enrichError) {
      console.error(
        'enqueueNaobEnrichment: request failed for',
        expressionLemma,
        'job',
        jobId,
        safeStringify(enrichError),
      );
    }
  }
}
// ---------------------------------------------------------------------

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

      const lexicalBatches =
        await runLexicalWorker(jobId);

      const promotedCount =
        await rpcOrThrow<number>(
          'promote_verification_results_for_job',
          {
            p_job_id: jobId,
          },
        );

      if (promotedCount > 0) {
        EdgeRuntime.waitUntil(
          enqueueOrdbokeneEnrichment(jobId).catch((backgroundError) => {
            console.error(
              'Background Ordbokene enrichment failed for job',
              jobId,
              safeStringify(backgroundError),
            );
          }),
        );

        // Separate, independent background task from Ordbokene above — a
        // failure or slowdown in one source's enrichment should not affect
        // the other.
        EdgeRuntime.waitUntil(
          enqueueNaobEnrichment(jobId).catch((backgroundError) => {
            console.error(
              'Background NAOB enrichment failed for job',
              jobId,
              safeStringify(backgroundError),
            );
          }),
        );
      }

      const formEnqueued =
        await rpcOrThrow<number>(
          'enqueue_form_enrichment_for_job',
          {
            p_job_id: jobId,
          },
        );

      const formEnrichment =
        await runFormEnrichment(jobId);

      const semanticAuditBatches =
        await runSemanticAuditWorker(jobId);

      const semanticNormalization =
        await runSemanticNormalizationWorker(jobId);

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

      processedJobs.push({
        job_id: jobId,
        lexical_batches: lexicalBatches,
        promoted_count: promotedCount,
        ordbokene_enrichment_queued: promotedCount > 0,
        naob_enrichment_queued: promotedCount > 0,
        form_enqueued: formEnqueued,
        form_enrichment: formEnrichment,
        semantic_audit_batches: semanticAuditBatches,
        semantic_normalization: semanticNormalization,
        build_result: buildResult,
        counters,
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