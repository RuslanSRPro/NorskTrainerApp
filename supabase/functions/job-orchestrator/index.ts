import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

serve(async (_req) => {
  try {
    const { data: jobs, error: jobsError } = await supabase
      .from('lexeme_processing_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(10);

    if (jobsError) {
      throw jobsError;
    }

    const processedJobs: unknown[] = [];

    for (const job of jobs ?? []) {
      const jobId = job.id;

      // reset stuck source checks
      await supabase.rpc('reset_stuck_source_checks', {
        p_job_id: jobId,
      });

      // run batches
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

        if (!workerJson.claimed || workerJson.claimed === 0) {
          break;
        }
      }

      // rebuild UI result
      await supabase.rpc('build_text_analysis_result', {
        p_job_id: jobId,
      });

      // refresh job counters
      const { data: counters } = await supabase.rpc(
        'recalculate_job_progress',
        {
          p_job_id: jobId,
        },
      );

      processedJobs.push({
        job_id: jobId,
        counters,
      });
    }

    return Response.json({
      ok: true,
      processed_jobs: processedJobs,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error
          ? error.message
          : String(error),
      },
      {
        status: 500,
      },
    );
  }
});