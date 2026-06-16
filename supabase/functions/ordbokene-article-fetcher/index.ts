import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type DictCode = 'bm' | 'nn';

function getLemma(payload: any): string | null {
  return (
    payload?.lemmas?.[0]?.lemma ??
    payload?.lemmas?.[0]?.final_lexeme ??
    null
  );
}

function getWordClass(payload: any): string | null {
  return (
    payload?.word_class ??
    payload?.lemmas?.[0]?.inflection_class ??
    null
  );
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'NorskTrainerApp/ordbokene-article-fetcher',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${await res.text()}`);
  }

  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));

  const articleId = Number(body.article_id);
  const dictionaryCode = String(body.dictionary_code ?? 'bm') as DictCode;
  const forceRefresh = Boolean(body.force_refresh ?? false);

  if (!Number.isFinite(articleId) || articleId <= 0) {
    return Response.json(
      {
        ok: false,
        error: 'article_id is required',
      },
      {
        status: 400,
        headers: corsHeaders,
      },
    );
  }

  if (!['bm', 'nn'].includes(dictionaryCode)) {
    return Response.json(
      {
        ok: false,
        error: 'dictionary_code must be bm or nn',
      },
      {
        status: 400,
        headers: corsHeaders,
      },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      {
        ok: false,
        error: 'Missing Supabase env vars',
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey,
  );

  if (!forceRefresh) {
    const { data, error } = await supabase.rpc(
      'get_ordbokene_article_cache',
      {
        p_article_id: articleId,
        p_dictionary_code: dictionaryCode,
      },
    );

    if (error) {
      throw new Error(
        `get_ordbokene_article_cache failed: ${error.message}`,
      );
    }

    const cached = Array.isArray(data) ? data[0]?.payload : null;

    if (cached) {
      return Response.json(
        {
          ok: true,
          cache_hit: true,
          article_id: articleId,
          dictionary_code: dictionaryCode,
          lemma: getLemma(cached),
          word_class: getWordClass(cached),
          payload: cached,
        },
        { headers: corsHeaders },
      );
    }
  }

  const url =
    `https://ord.uib.no/${dictionaryCode}/article/${articleId}.json`;

  const payload = await fetchJson(url);

  const lemma = getLemma(payload);
  const wordClass = getWordClass(payload);

  const { error: saveError } = await supabase.rpc(
    'save_ordbokene_article_cache',
    {
      p_article_id: articleId,
      p_dictionary_code: dictionaryCode,
      p_lemma: lemma,
      p_word_class: wordClass,
      p_payload: payload,
    },
  );

  if (saveError) {
    throw new Error(
      `save_ordbokene_article_cache failed: ${saveError.message}`,
    );
  }

  return Response.json(
    {
      ok: true,
      cache_hit: false,
      article_id: articleId,
      dictionary_code: dictionaryCode,
      lemma,
      word_class: wordClass,
      payload,
    },
    { headers: corsHeaders },
  );
});