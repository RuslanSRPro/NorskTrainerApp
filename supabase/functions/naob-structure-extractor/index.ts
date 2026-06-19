import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type NaobStatus = 'uttrykk' | 'example' | 'not_found';

type DiagnosticStatus =
  | 'matched_uttrykk'
  | 'matched_example'
  | 'expression_found_unstructured'
  | 'expression_not_found_in_article';

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
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

function buildNaobArticleUrl(naobSlug: string): string {
  return `https://naob.no/ordbok/${encodeURIComponent(naobSlug)}`;
}

function isSearchPage(finalUrl: string): boolean {
  return finalUrl.includes('/søk') || finalUrl.includes('/sok');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function findExpressionInHtml(
  html: string,
  expressionLemma: string,
): {
  naob_status: NaobStatus;
  diagnostic_status: DiagnosticStatus;
  found_in: string | null;
  match_context: string | null;
} {
  const needle = normalizeKey(expressionLemma);

  const tocStart = html.indexOf('UTTRYKKSFORTEGNELSE');
  const tocEnd = html.indexOf('BETYDNING OG BRUK', tocStart);

  if (tocStart !== -1 && tocEnd !== -1) {
    const toc = html.slice(tocStart, tocEnd);
    const anchorRe = /href="#[^"]+">([\s\S]*?)<\/a>/g;

    let m: RegExpExecArray | null;
    while ((m = anchorRe.exec(toc)) !== null) {
      const linkText = normalizeKey(stripHtml(m[1]));
      const linkBase = linkText.replace(/\s*\(.*\)$/, '').trim();

      if (linkText === needle || linkBase === needle) {
        return {
          naob_status: 'uttrykk',
          diagnostic_status: 'matched_uttrykk',
          found_in: 'UTTRYKKSFORTEGNELSE anchor',
          match_context: m[0],
        };
      }
    }
  }

  const uttrykkRe =
    /<div[^>]*class="[^"]*\buttrykk\b[^"]*\binline-eske\b[^"]*"[^>]*>([\s\S]*?)<\/div>/g;

  let um: RegExpExecArray | null;
  while ((um = uttrykkRe.exec(html)) !== null) {
    const divText = normalizeKey(stripHtml(um[1]));
    const divBase = divText.replace(/\s*\(.*\)$/, '').trim();

    if (divText === needle || divBase === needle) {
      return {
        naob_status: 'uttrykk',
        diagnostic_status: 'matched_uttrykk',
        found_in: 'UTTRYKK headword › div.uttrykk.inline-eske',
        match_context: html.slice(um.index, um.index + um[0].length + 400),
      };
    }
  }

  const redeksRe =
    /<div[^>]*class="[^"]*\bredeks\b[^"]*\binline-eske\b[^"]*"[^>]*>([\s\S]*?)<\/div>/g;

  let rm: RegExpExecArray | null;
  while ((rm = redeksRe.exec(html)) !== null) {
    const divText = normalizeKey(stripHtml(rm[1]));

    if (
      divText === needle ||
      needle.startsWith(divText + ' ') ||
      divText.startsWith(needle)
    ) {
      const pos = rm.index;
      const before = html.slice(Math.max(0, pos - 6000), pos);

      const overskriftRe =
        /<div[^>]*class="[^"]*\boverskrift\b[^"]*"[^>]*>([\s\S]*?)<\/div>/g;

      let lastOverskrift = '';
      let om: RegExpExecArray | null;

      while ((om = overskriftRe.exec(before)) !== null) {
        lastOverskrift = stripHtml(om[1]).trim().toUpperCase();
      }

      const naobStatus: NaobStatus =
        lastOverskrift === 'EKSEMPLER'
          ? 'example'
          : lastOverskrift === 'UTTRYKK'
            ? 'uttrykk'
            : 'not_found';

      return {
        naob_status: naobStatus,
        diagnostic_status:
          naobStatus === 'example'
            ? 'matched_example'
            : naobStatus === 'uttrykk'
              ? 'matched_uttrykk'
              : 'expression_found_unstructured',
        found_in: `${lastOverskrift || 'unknown'} › div.redeks.inline-eske`,
        match_context: html.slice(
          Math.max(0, pos - 300),
          pos + rm[0].length + 300,
        ),
      };
    }
  }

  const plainText = stripHtml(html);
  const lowerPlainText = plainText.toLowerCase();
  const pos = lowerPlainText.indexOf(needle);

  if (pos !== -1) {
    return {
      naob_status: 'not_found',
      diagnostic_status: 'expression_found_unstructured',
      found_in: 'unknown_context',
      match_context: plainText.slice(Math.max(0, pos - 250), pos + 350),
    };
  }

  return {
    naob_status: 'not_found',
    diagnostic_status: 'expression_not_found_in_article',
    found_in: null,
    match_context: null,
  };
}

async function fetchOrLoadNaobArticle(args: {
  supabase: ReturnType<typeof createClient>;
  naobSlug: string;
  forceRefresh: boolean;
}) {
  const normalizedSlug = normalizeKey(args.naobSlug);
  const articleUrl = buildNaobArticleUrl(normalizedSlug);

  if (!args.forceRefresh) {
    const { data: cached, error } = await args.supabase
      .from('naob_article_cache')
      .select('html, url, fetched_at')
      .eq('normalized_key', normalizedSlug)
      .maybeSingle();

    if (error) throw error;

    if (cached?.html) {
      return {
        cache_hit: true,
        html: cached.html as string,
        article_url: articleUrl,
        final_url: cached.url as string,
      };
    }
  }

  const response = await fetch(articleUrl, {
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

  if (isSearchPage(response.url)) {
    throw new Error(
      `NAOB redirected to search page. naob_slug may be incorrect. article_url=${articleUrl}, final_url=${response.url}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `NAOB fetch failed. status=${response.status}, url=${articleUrl}, final_url=${response.url}`,
    );
  }

  const { error: upsertError } = await args.supabase
    .from('naob_article_cache')
    .upsert(
      {
        lemma: normalizedSlug,
        normalized_key: normalizedSlug,
        url: response.url,
        html,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'normalized_key' },
    );

  if (upsertError) throw upsertError;

  return {
    cache_hit: false,
    html,
    article_url: articleUrl,
    final_url: response.url,
  };
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

    const expressionLemma =
      body.expression_lemma == null
        ? null
        : normalizeKey(String(body.expression_lemma));

    const naobSlug =
      body.naob_slug == null ? null : normalizeKey(String(body.naob_slug));

    const sourceLemma =
      body.source_lemma == null ? null : normalizeKey(String(body.source_lemma));

    const forceRefresh = Boolean(body.force_refresh ?? false);
    const updateCatalog = Boolean(body.update_catalog ?? true);

    if (!expressionLemma || !naobSlug) {
      return jsonResponse(
        {
          ok: false,
          error: 'expression_lemma and naob_slug are required',
          example: {
            expression_lemma: 'ta hensyn til',
            source_lemma: 'ta',
            naob_slug: 'ta_2',
            force_refresh: false,
            update_catalog: true,
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

    const article = await fetchOrLoadNaobArticle({
      supabase,
      naobSlug,
      forceRefresh,
    });

    const detected = findExpressionInHtml(article.html, expressionLemma);
    const normalizedKey = normalizeKey(expressionLemma);

    const evidencePayload = {
      source: 'NAOB',
      evidence_type: 'naob_expression_structure',
      expression_lemma: expressionLemma,
      normalized_key: normalizedKey,
      source_lemma: sourceLemma,
      naob_slug: naobSlug,
      naob_url: article.final_url,
      naob_status: detected.naob_status,
      diagnostic_status: detected.diagnostic_status,
      found_in: detected.found_in,
      match_context: detected.match_context,
      cache_hit: article.cache_hit,
    };

    const { data: savedEvidence, error: evidenceError } = await supabase
      .from('naob_expression_evidence')
      .upsert(
        {
          expression_lemma: expressionLemma,
          normalized_key: normalizedKey,
          source_lemma: sourceLemma,
          naob_slug: naobSlug,
          naob_url: article.final_url,
          naob_status: detected.naob_status,
          found_in: detected.found_in,
          match_context: detected.match_context,
          evidence: evidencePayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'normalized_key,naob_slug' },
      )
      .select('id, expression_lemma, normalized_key, naob_slug, naob_status')
      .single();

    if (evidenceError) {
      return jsonResponse(
        {
          ok: false,
          stage: 'save_evidence',
          error: safeStringify(evidenceError),
          details: evidenceError,
        },
        500,
      );
    }

    let catalogUpdate = null;

    if (updateCatalog) {
      const { data, error } = await supabase
        .from('expression_catalog')
        .update({
          naob_status:
            detected.naob_status === 'not_found'
              ? 'not_listed'
              : detected.naob_status,
          expression_review_status:
            detected.naob_status === 'not_found' ? 'unverified' : 'partial',
          updated_at: new Date().toISOString(),
        })
        .eq('normalized_key', normalizedKey)
        .select(
          'id, lemma, normalized_key, naob_status, expression_review_status',
        )
        .maybeSingle();

      if (error) {
        return jsonResponse(
          {
            ok: false,
            stage: 'update_expression_catalog',
            error: safeStringify(error),
            details: error,
          },
          500,
        );
      }

      catalogUpdate = data;
    }

    return jsonResponse({
      ok: true,
      expression_lemma: expressionLemma,
      normalized_key: normalizedKey,
      source_lemma: sourceLemma,
      naob_slug: naobSlug,
      naob_url: article.final_url,
      cache_hit: article.cache_hit,
      html_length: article.html.length,
      naob_status: detected.naob_status,
      diagnostic_status: detected.diagnostic_status,
      found_in: detected.found_in,
      match_context: detected.match_context,
      saved_evidence: savedEvidence,
      catalog_update: catalogUpdate,
      note:
        detected.diagnostic_status === 'expression_found_unstructured'
          ? 'Expression was found in page, but its NAOB block type could not be determined. Inspect match_context manually.'
          : detected.diagnostic_status === 'expression_not_found_in_article'
            ? 'Expression was not found in this NAOB article. The naob_slug may be wrong, or NAOB may not list this expression in the article.'
            : null,
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