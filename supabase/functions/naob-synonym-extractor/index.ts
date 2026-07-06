import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
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
    .replace(/&oslash;/g, 'ø')
    .replace(/&aelig;/g, 'æ')
    .replace(/&Aring;/g, 'Å')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&AElig;/g, 'Æ')
    .replace(/&#160;/g, ' ');
}

function stripTags(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

// ── Nesting-aware closing tag finder ─────────────────────────────────────────
function findClosingDiv(html: string, startPos: number): number {
  let depth = 1;
  let pos = startPos;

  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div>', pos);

    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) return nextClose + 6;
      pos = nextClose + 6;
    }
  }

  return -1;
}

// ── Extract uttrykksbetydning block ───────────────────────────────────────────
// Uses nesting-aware search. Stops before sitatseksjon to avoid
// including citations in the gloss.
function extractBetydningBlock(html: string, searchFrom: number): {
  block: string;
  endPos: number;
} | null {
  const openTag = 'class="uttrykksbetydning"';
  const divStart = html.indexOf(openTag, searchFrom);
  if (divStart === -1) return null;

  const tagOpen = html.lastIndexOf('<div', divStart);
  if (tagOpen === -1) return null;

  const tagClose = html.indexOf('>', divStart);
  if (tagClose === -1) return null;

  const endPos = findClosingDiv(html, tagClose + 1);
  if (endPos === -1) return null;

  let block = html.slice(tagOpen, endPos);

  // Cut off at sitatseksjon — citations live there, not in uttrykksbetydning
  const sitatPos = block.indexOf('sitatseksjon');
  if (sitatPos !== -1) {
    const sitatDivPos = block.lastIndexOf('<div', sitatPos);
    if (sitatDivPos !== -1) {
      block = block.slice(0, sitatDivPos);
    }
  }

  // Also cut off at ul — example lists start there
  // (some articles put examples directly in uttrykksbetydning without sitatseksjon)
  const ulPos = block.indexOf('<ul');
  if (ulPos !== -1) {
    block = block.slice(0, ulPos);
  }

  return { block, endPos };
}

// ── Types ─────────────────────────────────────────────────────────────────────

const EXTRACTOR_VERSION = 3;

type GlossEntry = {
  expression_lemma: string;
  anchor_id: string;             // never null — synthetic fallback used
  anchor_id_source: 'naob' | 'synthetic';
  gloss_text: string | null;
  gloss_type: 'direct' | 'reference' | 'no_gloss';
  context_label: string | null;
  gloss_index: number;
};

type ParsedGloss = Omit<GlossEntry, 'expression_lemma' | 'anchor_id'>;

// ── Parse uttrykksbetydning block ─────────────────────────────────────────────
// Three confirmed patterns from real NAOB data:
//   1. direct:    inline-eske divs → join as gloss ("gi akt på; bli var")
//   2. reference: content starts with "se " → reference to another article
//   3. no_gloss:  only context label / empty → ordtak or idiom without synonym
function parseUttrykksbetydning(block: string): ParsedGloss {
  // Extract context label from bedeutningsskiller (e.g. "særlig om svar")
  const contextMatch = block.match(
    /<div[^>]*class="[^"]*\bbetydningsskiller\b[^"]*"[^>]*>([\s\S]*?)<\/div>/,
  );
  const contextLabel = contextMatch
    ? stripTags(contextMatch[1]).replace(/^[;,\s]+|[;,\s]+$/g, '').trim() || null
    : null;

  // Extract all div.inline-eske, excluding bedeutningsskiller
  const inlineRe =
    /<div[^>]*class="([^"]*\binline-eske\b[^"]*)"[^>]*>([\s\S]*?)<\/div>/g;

  const glossParts: string[] = [];
  let isReference = false;
  let referenceText = '';

  let im: RegExpExecArray | null;

  while ((im = inlineRe.exec(block)) !== null) {
    const classes = im[1];
    const content = stripTags(im[2]);

    // Skip context divs — already captured above
    if (classes.includes('bedeutningsskiller')) continue;

    // Skip citation divs (should be cut off by extractBetydningBlock,
    // but guard here too)
    if (classes.includes('sitat')) continue;

    if (!content.trim()) continue;

    // Detect reference pattern: "se gidde", "se julemerker"
    // Do NOT break — there may be real gloss parts collected before this.
    // Mark as reference only if NO real gloss parts were collected yet.
    if (/^\s*se\s+/i.test(content)) {
      if (glossParts.length === 0) {
        // Pure reference — no direct gloss found before this
        isReference = true;
        referenceText = content.trim();
      }
      // If glossParts already has content, this "se" is a cross-reference
      // appended after a real gloss — ignore it, keep the direct gloss.
      continue;
    }

    // Clean separator characters and collect
    const cleaned = content
      .replace(/^[\s;|]+/, '')
      .replace(/[\s;|]+$/, '')
      .trim();

    if (!cleaned) continue;

    // Skip if this part duplicates the context label
    // e.g. context_label = "sjelden", gloss part = "sjelden" → skip
    if (contextLabel && cleaned.toLowerCase() === contextLabel.toLowerCase()) continue;

    glossParts.push(cleaned);
  }

  if (isReference) {
    return {
      gloss_text: referenceText,
      gloss_type: 'reference',
      context_label: contextLabel,
      gloss_index: 1,
    };
  }

  if (glossParts.length > 0) {
    // Multiple inline-eske = multiple synonyms, join with "; "
    // e.g. "gi akt på" + "bli var" → "gi akt på; bli var"
    const fullGloss = glossParts.join('; ');
    return {
      gloss_text: fullGloss,
      gloss_type: 'direct',
      context_label: contextLabel,
      gloss_index: 1,
    };
  }

  // No gloss — ordtak, idiom, or citation-only entry.
  // gloss_text stays null — semantically correct ("gloss is absent").
  // Deduplication is safe: conflict key is
  //   (normalized_key, naob_slug, anchor_id, gloss_index)
  // which never contains null, so NULL != NULL is not a problem here.
  return {
    gloss_text: null,
    gloss_type: 'no_gloss',
    context_label: contextLabel,
    gloss_index: 1,
  };
}

// ── Main extractor ────────────────────────────────────────────────────────────
function extractGlosses(html: string): GlossEntry[] {
  const results: GlossEntry[] = [];

  const uttrykkClass = 'class="uttrykk inline-eske"';
  let searchPos = 0;

  while (true) {
    const uttrykkPos = html.indexOf(uttrykkClass, searchPos);
    if (uttrykkPos === -1) break;

    // Find closing </div> of this uttrykk headword div
    const divEnd = html.indexOf('</div>', uttrykkPos);
    if (divEnd === -1) break;

    const uttrykkDiv = html.slice(uttrykkPos - 5, divEnd + 6);
    const expressionLemma = normalizeKey(stripTags(uttrykkDiv));

    if (!expressionLemma || expressionLemma.length < 2) {
      searchPos = divEnd + 6;
      continue;
    }

    // Look backwards for anchor id (within 400 chars before uttrykk div)
    const lookbackStart = Math.max(0, uttrykkPos - 400);
    const lookbackHtml = html.slice(lookbackStart, uttrykkPos);
    const anchorMatches = lookbackHtml.match(/id="(\d+)"/g);
    const anchorIdRaw = anchorMatches
      ? anchorMatches[anchorMatches.length - 1].replace(/id="|"/g, '')
      : null;

    // Synthetic fallback: use position in HTML as stable anchor when NAOB id not found.
    // Ensures conflict key (normalized_key, naob_slug, anchor_id, gloss_index) is never null,
    // preventing duplicates on repeated runs.
    const anchorId = anchorIdRaw ?? `synthetic_${uttrykkPos}`;
    const anchorIdSource: 'naob' | 'synthetic' = anchorIdRaw ? 'naob' : 'synthetic';

    // Find uttrykksbetydning block after the uttrykk div
    const bedeutningResult = extractBetydningBlock(html, divEnd);

    if (!bedeutningResult) {
      searchPos = divEnd + 6;
      continue;
    }

    const parsed = parseUttrykksbetydning(bedeutningResult.block);

    results.push({
      expression_lemma: expressionLemma,
      anchor_id: anchorId,
      anchor_id_source: anchorIdSource,
      ...parsed,
    });

    searchPos = bedeutningResult.endPos;
  }

  return results;
}

// ── HTTP handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Use POST' }, 405);
    }

    const body = await req.json().catch(() => ({}));

    const naobSlug = body.naob_slug
      ? String(body.naob_slug).trim()
      : null;

    const dryRun = Boolean(body.dry_run ?? true);
    const limit = Math.min(Number(body.limit ?? 5), 50);

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

    // Load articles from cache
    let query = supabase
      .from('naob_article_cache')
      .select('normalized_key, html, fetched_at');

    if (naobSlug) {
      query = query.eq('normalized_key', naobSlug);
    } else {
      query = query.order('fetched_at', { ascending: false }).limit(limit);
    }

    const { data: articles, error: articleError } = await query;

    if (articleError) {
      return jsonResponse(
        { ok: false, stage: 'load_cache', error: articleError.message },
        500,
      );
    }

    const results: Array<{
      naob_slug: string;
      glosses_found: number;
      glosses_by_type: Record<string, number>;
      sample: GlossEntry[];
      upserted?: number;
      error?: string;
    }> = [];

    for (const article of articles ?? []) {
      const glosses = extractGlosses(article.html);

      const byType = glosses.reduce((acc, g) => {
        acc[g.gloss_type] = (acc[g.gloss_type] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      if (dryRun) {
        results.push({
          naob_slug: article.normalized_key,
          glosses_found: glosses.length,
          glosses_by_type: byType,
          sample: glosses.slice(0, 5),
        });
        continue;
      }

      // Write to naob_expression_glosses
      let upserted = 0;
      let saveError: string | undefined;

      const rows = glosses.map((g) => ({
        normalized_key: g.expression_lemma,
        naob_slug: article.normalized_key,
        anchor_id: g.anchor_id,
        anchor_id_source: g.anchor_id_source,
        expression_lemma: g.expression_lemma,
        gloss_text: g.gloss_text,
        gloss_type: g.gloss_type,
        context_label: g.context_label,
        gloss_index: g.gloss_index,
        extractor_version: EXTRACTOR_VERSION,
      }));

      // Batch upsert in chunks of 100
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const { error } = await supabase
          .from('naob_expression_glosses')
          .upsert(chunk, {
            onConflict: 'normalized_key,naob_slug,anchor_id,gloss_index',
            // No ignoreDuplicates — allow updates when parser improves
          });

        if (error) {
          saveError = error.message;
          break;
        }

        upserted += chunk.length;
      }

      results.push({
        naob_slug: article.normalized_key,
        glosses_found: glosses.length,
        glosses_by_type: byType,
        sample: glosses.slice(0, 3),
        upserted,
        error: saveError,
      });
    }

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      articles_processed: results.length,
      total_glosses: results.reduce((s, r) => s + r.glosses_found, 0),
      results,
    });

  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        stage: 'unhandled_exception',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
      },
      500,
    );
  }
});