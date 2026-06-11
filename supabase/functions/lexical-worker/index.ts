import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processSourceCheck } from './process-source-check.ts';
import type { SourceCheck } from './types.ts';

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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const limit = body.limit ?? 5;

    const { data: checks, error } = await supabase.rpc(
      'claim_next_source_checks',
      {
        p_limit: limit,
      },
    );

    if (error) throw error;

    const results = [];

    for (const check of checks as SourceCheck[]) {
      try {
        await processSourceCheck(supabase, check);
        results.push({
          id: check.id,
          source: check.source,
          query: check.query,
          ok: true,
        });
      } catch (err) {
        results.push({
          id: check.id,
          source: check.source,
          query: check.query,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        claimed: checks?.length ?? 0,
        results,
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
        error: err instanceof Error ? err.message : String(err),
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