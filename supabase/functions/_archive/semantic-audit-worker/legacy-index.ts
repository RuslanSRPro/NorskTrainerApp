import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env variables');
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const body = await req.json().catch(() => ({}));

    const limit = body.limit ?? 50;
    const jobId = body.job_id
      ? String(body.job_id)
      : null;

    // =========================
    // CLAIM LEXEME AUDITS
    // =========================

    const {
      data: lexemeAudits,
      error: lexemeError,
    } = await supabase.rpc(
      'claim_next_semantic_audit',
      {
        p_limit: limit,
        p_job_id: jobId,
      },
    );

    if (lexemeError) {
      throw lexemeError;
    }

    // =========================
    // CLAIM EXPRESSION AUDITS
    // =========================

    const {
      data: expressionAudits,
      error: expressionError,
    } = await supabase.rpc(
      'claim_next_expression_semantic_audit',
      {
        p_limit: limit,
        p_job_id: jobId,
      },
    );

    if (expressionError) {
      throw expressionError;
    }

    // =========================
    // PLACEHOLDER PROCESSING
    // =========================
    // later:
    // AI semantic analysis
    // confidence scoring
    // semantic normalization
    // relation extraction
    // graph updates
    // downgrade protection
    // history versioning

    return new Response(
      JSON.stringify({
        ok: true,

        requested_job_id: jobId,

        lexeme_claimed:
          lexemeAudits?.length ?? 0,

        expression_claimed:
          expressionAudits?.length ?? 0,

        lexeme_audits: lexemeAudits ?? [],

        expression_audits:
          expressionAudits ?? [],
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : String(err),
      }),
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