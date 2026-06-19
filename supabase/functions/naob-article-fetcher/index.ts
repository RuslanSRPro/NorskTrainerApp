import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
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

function buildNaobUrl(lemma: string): string {
  return `https://naob.no/søk?q=${encodeURIComponent(lemma)}&from=ordbok`;
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Use POST' }, 405);
    }

    const body = await req.json().catch(() => ({}));

    const lemma =
      body.lemma == null ? null : normalizeKey(String(body.lemma));

    const forceRefresh = Boolean(body.force_refresh ?? false);

    if (!lemma) {
      return jsonResponse(
        {
          ok: false,
          error: 'lemma is required',
          example: {
            lemma: 'ta hensyn til',
            force_refresh: false,
          },
        },
        400,
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          ok: false,
          error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
        },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const normalizedKey = normalizeKey(lemma);

    if (!forceRefresh) {
      const { data: cached, error: cacheError } = await supabase
        .from('naob_article_cache')
        .select('id, lemma, normalized_key, url, fetched_at, updated_at')
        .eq('normalized_key', normalizedKey)
        .maybeSingle();

      if (cacheError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'cache_lookup',
            error: safeStringify(cacheError),
            details: cacheError,
          },
          500,
        );
      }

      if (cached) {
        return jsonResponse({
          ok: true,
          cache_hit: true,
          lemma,
          normalized_key: normalizedKey,
          url: cached.url,
          cached,
        });
      }
    }

    const url = buildNaobUrl(lemma);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'NorskTrainerApp/1.0 educational lexical research contact=annasubbotina11@gmail.com',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nb,no;q=0.9,en;q=0.5',
      },
      redirect: 'follow',
    });

    const html = await response.text();

    if (!response.ok) {
      return jsonResponse(
        {
          ok: false,
          stage: 'fetch_naob',
          lemma,
          normalized_key: normalizedKey,
          url,
          final_url: response.url,
          status: response.status,
          status_text: response.statusText,
          html_preview: html.slice(0, 1000),
        },
        502,
      );
    }

    const { data: saved, error: upsertError } = await supabase
      .from('naob_article_cache')
      .upsert(
        {
          lemma,
          normalized_key: normalizedKey,
          url: response.url || url,
          html,
          fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'normalized_key',
        },
      )
      .select('id, lemma, normalized_key, url, fetched_at, updated_at')
      .single();

    if (upsertError) {
      return jsonResponse(
        {
          ok: false,
          stage: 'save_cache',
          error: safeStringify(upsertError),
          details: upsertError,
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      cache_hit: false,
      lemma,
      normalized_key: normalizedKey,
      url,
      final_url: response.url,
      status: response.status,
      html_length: html.length,
      html_preview: html.slice(0, 300),
      saved,
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