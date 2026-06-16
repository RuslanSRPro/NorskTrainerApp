import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'NorskTrainerApp/ordbokene-debug',
    },
  });

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      url,
      body: await res.text(),
    };
  }

  return await res.json();
}

function getArticleIds(payload: any): {
  bm: number[];
  nn: number[];
} {
  return {
    bm: payload?.articles?.bm ?? [],
    nn: payload?.articles?.nn ?? [],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const body = await req.json().catch(() => ({}));

  const queries =
    Array.isArray(body.queries) && body.queries.length
      ? body.queries.map(String)
      : ['gå', 'hus', 'barn', 'glede seg til', 'ta vare på'];

  const results = [];

  for (const query of queries) {
    const encoded = encodeURIComponent(query);

    const articlesExactUrl =
      `https://ord.uib.no/api/articles?w=${encoded}&dict=bm,nn&scope=e`;

    const articlesInflectedUrl =
      `https://ord.uib.no/api/articles?w=${encoded}&dict=bm,nn&scope=i`;

    const suggestUrl =
      `https://ord.uib.no/api/suggest?q=${encoded}&dict=bm,nn&include=eif&n=20`;

    const articlesExact = await fetchJson(articlesExactUrl);
    const articlesInflected = await fetchJson(articlesInflectedUrl);
    const suggest = await fetchJson(suggestUrl);

    const exactIds = getArticleIds(articlesExact);
    const inflectedIds = getArticleIds(articlesInflected);

    const bmArticleId =
      exactIds.bm[0] ??
      inflectedIds.bm[0] ??
      null;

    const nnArticleId =
      exactIds.nn[0] ??
      inflectedIds.nn[0] ??
      null;

    const bmArticleUrl = bmArticleId
      ? `https://ord.uib.no/bm/article/${bmArticleId}.json`
      : null;

    const nnArticleUrl = nnArticleId
      ? `https://ord.uib.no/nn/article/${nnArticleId}.json`
      : null;

    const bmArticle = bmArticleUrl
      ? await fetchJson(bmArticleUrl)
      : null;

    const nnArticle = nnArticleUrl
      ? await fetchJson(nnArticleUrl)
      : null;

    results.push({
      query,
      urls: {
        articlesExactUrl,
        articlesInflectedUrl,
        suggestUrl,
        bmArticleUrl,
        nnArticleUrl,
      },
      articlesExact,
      articlesInflected,
      suggest,
      bmArticle,
      nnArticle,
    });
  }

  return Response.json(
    {
      ok: true,
      results,
    },
    { headers: corsHeaders },
  );
});