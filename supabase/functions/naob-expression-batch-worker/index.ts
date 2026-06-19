import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function invokeStructureExtractor(payload: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/naob-structure-extractor`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  const text = await response.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function buildCandidateSlugs(expressionLemma: string): string[] {
  const parts = normalizeKey(expressionLemma).split(' ').filter(Boolean);
  const candidates = new Set<string>();

  for (const part of parts) {
    candidates.add(part);
    candidates.add(`${part}_2`);
    candidates.add(`${part}_3`);
  }

  return Array.from(candidates);
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

    const sourceLemma =
      body.source_lemma == null ? null : normalizeKey(String(body.source_lemma));

    const forceRefresh = Boolean(body.force_refresh ?? false);
    const updateCatalog = Boolean(body.update_catalog ?? true);

    const inputCandidateSlugs = Array.isArray(body.candidate_slugs)
      ? body.candidate_slugs.map((v: unknown) => normalizeKey(String(v)))
      : [];

    if (!expressionLemma) {
      return jsonResponse(
        {
          ok: false,
          error: 'expression_lemma is required',
          example: {
            expression_lemma: 'legge merke til',
            candidate_slugs: ['legge', 'legge_2', 'merke', 'merke_2'],
            update_catalog: true,
          },
        },
        400,
      );
    }

    const candidateSlugs =
      inputCandidateSlugs.length > 0
        ? inputCandidateSlugs
        : buildCandidateSlugs(expressionLemma);

    const attempts = [];

    for (const naobSlug of candidateSlugs) {
      // Important:
      // intermediate attempts must NOT update expression_catalog.
      // Otherwise a failed early slug can temporarily write not_listed/unverified.
      const result = await invokeStructureExtractor({
        expression_lemma: expressionLemma,
        source_lemma: sourceLemma,
        naob_slug: naobSlug,
        force_refresh: forceRefresh,
        update_catalog: false,
      });

      attempts.push({
        naob_slug: naobSlug,
        ok: result.ok,
        status: result.status,
        naob_status: result.data?.naob_status ?? null,
        diagnostic_status: result.data?.diagnostic_status ?? null,
        found_in: result.data?.found_in ?? null,
        catalog_update: result.data?.catalog_update ?? null,
        error: result.ok ? null : result.data?.error ?? result.data,
      });

      if (
        result.ok &&
        ['matched_uttrykk', 'matched_example'].includes(
          result.data?.diagnostic_status,
        )
      ) {
        let finalResult = result;

        if (updateCatalog) {
          finalResult = await invokeStructureExtractor({
            expression_lemma: expressionLemma,
            source_lemma: sourceLemma,
            naob_slug: naobSlug,
            force_refresh: false,
            update_catalog: true,
          });
        }

        return jsonResponse({
          ok: true,
          expression_lemma: expressionLemma,
          matched: true,
          best_slug: naobSlug,
          best_result: finalResult.data,
          attempts,
        });
      }
    }

    return jsonResponse({
      ok: true,
      expression_lemma: expressionLemma,
      matched: false,
      best_slug: null,
      best_result: null,
      attempts,
      note:
        'No candidate slug produced matched_uttrykk or matched_example. Review attempts and consider adding manual candidate_slugs.',
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