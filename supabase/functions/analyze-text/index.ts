import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json();

    const text = String(body.text || '').trim();

    if (!text) {
      return Response.json(
        {
          ok: false,
          error: 'Text is required',
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    // create ingestion job
    const { data: jobId, error: jobError } = await supabase.rpc(
      'create_text_analysis_job',
      {
        p_text: text,
      },
    );

    if (jobError) {
      throw jobError;
    }

    // optionally trigger orchestrator
    const orchestratorResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/job-orchestrator`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_id: jobId,
        }),
      },
    );

    let orchestratorResult = null;

    try {
      orchestratorResult =
        await orchestratorResponse.json();
    } catch {
      orchestratorResult = null;
    }

    // return initial progress
    const { data: job } = await supabase
      .from('lexeme_processing_jobs')
      .select(`
        id,
        status,
        total_items,
        done_items,
        partial_items,
        failed_items,
        skipped_items,
        summary,
        created_at
      `)
      .eq('id', jobId)
      .single();

    return Response.json(
      {
        ok: true,
        job,
        orchestrator: orchestratorResult,
      },
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});