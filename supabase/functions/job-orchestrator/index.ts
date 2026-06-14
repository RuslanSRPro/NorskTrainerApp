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
    if (value instanceof Error) {
      return value.message;
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
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

    const workerJson = await workerResponse.json();

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

  return await response.json();
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

    const workerJson = await workerResponse.json();

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

  return await response.json();
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
      typeof body.job_id === 'string'
        ? body.job_id
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

      await supabase.rpc(
        'reset_stuck_source_checks',
        {
          p_job_id: jobId,
        },
      );

      const lexicalBatches =
        await runLexicalWorker(jobId);

      const {
        data: promotedCount,
        error: promotionError,
      } = await supabase.rpc(
        'promote_verification_results_for_job',
        {
          p_job_id: jobId,
        },
      );

      if (promotionError) {
        throw promotionError;
      }

      const {
        data: formEnqueued,
        error: formEnqueueError,
      } = await supabase.rpc(
        'enqueue_form_enrichment_for_job',
        {
          p_job_id: jobId,
        },
      );

      if (formEnqueueError) {
        throw formEnqueueError;
      }

      const formEnrichment =
        await runFormEnrichment(jobId);

      const semanticAuditBatches =
        await runSemanticAuditWorker(jobId);

      const semanticNormalization =
        await runSemanticNormalizationWorker(
          jobId,
        );

      const {
        data: buildResult,
        error: buildError,
      } = await supabase.rpc(
        'build_text_analysis_result',
        {
          p_job_id: jobId,
        },
      );

      if (buildError) {
        throw buildError;
      }

      const {
        data: counters,
        error: countersError,
      } = await supabase.rpc(
        'recalculate_job_progress',
        {
          p_job_id: jobId,
        },
      );

      if (countersError) {
        throw countersError;
      }

      processedJobs.push({
        job_id: jobId,
        lexical_batches: lexicalBatches,
        promoted_count: promotedCount,
        form_enqueued: formEnqueued,
        form_enrichment: formEnrichment,
        semantic_audit_batches:
          semanticAuditBatches,
        semantic_normalization:
          semanticNormalization,
        build_result: buildResult,
        counters,
      });
    }

    return Response.json(
      {
        ok: true,
        requested_job_id:
          requestedJobId,
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
        error:
          error instanceof Error
            ? error.message
            : safeStringify(error),
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});