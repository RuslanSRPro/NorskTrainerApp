import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Use POST' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ ok: false, error: 'Missing env vars' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const rows = body.rows as Array<{
      normalized_word: string;
      frequency_raw: number;
      frequency_rank: number;
      source: string;
    }>;

    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonResponse({ ok: false, error: 'rows array is required' }, 400);
    }

    const { error, count } = await supabase
      .from('word_frequency_reference')
      .upsert(rows, { onConflict: 'normalized_word,source', count: 'exact' });

    if (error) {
      return jsonResponse({ ok: false, error: error.message, details: error }, 500);
    }

    return jsonResponse({ ok: true, inserted: rows.length, count });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});