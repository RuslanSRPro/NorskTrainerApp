import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// Confirmed from live HTML inspection of naob_article_cache:
// jf.-links always follow this exact pattern — one link per block, no
// multi-link variants observed across merke_2, ha_2, ta_2:
//
//   jf. <span><a href="/ordbok/{slug}">{display_text}</a></span>
//
// HTML entities in display_text (e.g. &aring; → å) are decoded before
// storing as target_text. The href slug is preserved as-is for future
// naob-structure-extractor lookup.

const NAOB_SOURCE = 'NAOB';
const RELATION_TYPE = 'related_candidate';
const CONFIDENCE = 'medium'; // jf. is a cross-reference, not a sub-article
const STATUS = 'candidate';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    },
  });
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

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&aring;/g, 'å')
    .replace(/&Aring;/g, 'Å')
    .replace(/&oslash;/g, 'ø')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&aelig;/g, 'æ')
    .replace(/&AElig;/g, 'Æ')
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&#160;/g, ' ');
}

type JfLink = {
  naob_slug: string;
  target_text: string;
  href: string;
};

// Extracts all jf.-links from a NAOB article HTML.
// Pattern (confirmed on live data): jf. <span><a href="/ordbok/{slug}">{text}</a></span>
function extractJfLinks(html: string): JfLink[] {
  const links: JfLink[] = [];
  const seen = new Set<string>();

  // Match: jf. <span><a href="/ordbok/{slug}">{text}</a></span>
  const re = /jf\.\s*<span><a\s+href="\/ordbok\/([^"]+)">([^<]+)<\/a><\/span>/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null) {
    const rawSlug = m[1].trim();
    const rawText = m[2].trim();
    const targetText = normalizeKey(decodeHtmlEntities(rawText));

    if (!rawSlug || !targetText) continue;

    // Some slugs contain an anchor fragment pointing to a specific sense:
    // e.g. "landemerke#52966099", "merke_1#52987828".
    // Strip the fragment for the lookup slug (article URL doesn't include it),
    // but preserve the full raw slug in evidence for future sense-level linking.
    const naobSlug = rawSlug.split('#')[0];

    // Deduplicate by clean slug — same article can be referenced from
    // multiple senses within a large article.
    if (seen.has(naobSlug)) continue;
    seen.add(naobSlug);

    links.push({
      naob_slug: naobSlug,
      target_text: targetText,
      href: `/ordbok/${rawSlug}`, // preserve full href with anchor in evidence
    });
  }

  return links;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return jsonResponse({ ok: true });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Use POST' }, 405);
    }

    const body = await req.json().catch(() => ({}));

    const naobSlug = body.naob_slug == null
      ? null
      : normalizeKey(String(body.naob_slug));

    const expressionId = body.expression_id == null
      ? null
      : String(body.expression_id);

    const dryRun = body.dry_run !== false;

    if (!naobSlug) {
      return jsonResponse(
        { ok: false, error: 'naob_slug is required' },
        400,
      );
    }

    if (!expressionId) {
      return jsonResponse(
        { ok: false, error: 'expression_id is required' },
        400,
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Load cached article HTML
    const { data: article, error: articleError } = await supabase
      .from('naob_article_cache')
      .select('normalized_key, html, url')
      .eq('normalized_key', naobSlug)
      .maybeSingle();

    if (articleError) {
      return jsonResponse(
        {
          ok: false,
          stage: 'load_article_cache',
          error: safeStringify(articleError),
        },
        500,
      );
    }

    if (!article?.html) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: 'Article not found in naob_article_cache. Run naob-structure-extractor first.',
        naob_slug: naobSlug,
        expression_id: expressionId,
      });
    }

    const jfLinks = extractJfLinks(article.html);

    if (jfLinks.length === 0) {
      return jsonResponse({
        ok: true,
        naob_slug: naobSlug,
        expression_id: expressionId,
        jf_links_found: 0,
        upserted: 0,
        dry_run: dryRun,
        note: 'No jf.-links found in this article.',
      });
    }

    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        naob_slug: naobSlug,
        expression_id: expressionId,
        jf_links_found: jfLinks.length,
        would_upsert: jfLinks.length,
        links: jfLinks,
      });
    }

    // Build relation rows — source is expression_catalog, not lexemes,
    // because NAOB jf.-links are discovered while processing an expression
    // article (e.g. merke_2 → bumerke, kainsmerke).
    const relations = jfLinks.map((link) => ({
      source_entity_type: 'expression',
      source_entity_id: expressionId,
      relation_type: RELATION_TYPE,
      target_text: link.target_text,
      // target_entity_type/id left null — relation-resolver will fill them
      // once the target expression/lexeme exists in the catalog.
      target_entity_type: null,
      target_entity_id: null,
      source: NAOB_SOURCE,
      confidence: CONFIDENCE,
      status: STATUS,
      evidence: {
        evidence_type: 'naob_jf_link',
        naob_slug: naobSlug,
        target_naob_slug: link.naob_slug,
        naob_url: article.url,
        href: link.href,
        raw_target_text: link.target_text,
      },
      urls: [article.url],
      updated_at: new Date().toISOString(),
    }));

    let upserted = 0;
    const upsertErrors: any[] = [];

    for (const relation of relations) {
      const { error } = await supabase
        .from('authoritative_semantic_relations')
        .upsert(relation, {
          onConflict:
            'source_entity_type,source_entity_id,relation_type,target_text,source',
        });

      if (error) {
        upsertErrors.push({
          target_text: relation.target_text,
          error: safeStringify(error),
        });
        continue;
      }

      upserted++;
    }

    if (upsertErrors.length > 0) {
      return jsonResponse(
        {
          ok: false,
          stage: 'upsert_relations',
          naob_slug: naobSlug,
          expression_id: expressionId,
          jf_links_found: jfLinks.length,
          upserted,
          upsert_errors: upsertErrors,
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      dry_run: false,
      naob_slug: naobSlug,
      expression_id: expressionId,
      jf_links_found: jfLinks.length,
      upserted,
      relation_type: RELATION_TYPE,
      source: NAOB_SOURCE,
      confidence: CONFIDENCE,
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