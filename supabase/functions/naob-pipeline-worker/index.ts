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

async function invokeFunction(functionName: string, payload: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

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

function buildCandidateSlugs(expressionLemma: string, sourceLemma?: string | null): string[] {
  const parts = normalizeKey(expressionLemma).split(' ').filter(Boolean);
  const candidates = new Set<string>();

  if (sourceLemma) {
    const source = normalizeKey(sourceLemma);
    candidates.add(source);
    candidates.add(`${source}_2`);
    candidates.add(`${source}_3`);
  }

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
      body.source_lemma == null
        ? null
        : normalizeKey(String(body.source_lemma));

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
            source_lemma: 'merke',
            candidate_slugs: ['legge', 'merke_2'],
            force_refresh: false,
            update_catalog: true,
          },
        },
        400,
      );
    }

    const candidateSlugs =
      inputCandidateSlugs.length > 0
        ? inputCandidateSlugs
        : buildCandidateSlugs(expressionLemma, sourceLemma);

    const batchResult = await invokeFunction('naob-expression-batch-worker', {
      expression_lemma: expressionLemma,
      source_lemma: sourceLemma,
      candidate_slugs: candidateSlugs,
      force_refresh: forceRefresh,
      update_catalog: updateCatalog,
    });

    return jsonResponse({
      ok: batchResult.ok,
      pipeline: 'naob_pipeline_v1',
      expression_lemma: expressionLemma,
      source_lemma: sourceLemma,
      candidate_slugs: candidateSlugs,
      update_catalog: updateCatalog,
      force_refresh: forceRefresh,
      steps: {
        naob_expression_batch_worker: {
          ok: batchResult.ok,
          status: batchResult.status,
          data: batchResult.data,
        },
      },
      result: {
        matched: batchResult.data?.matched ?? false,
        best_slug: batchResult.data?.best_slug ?? null,
        naob_status: batchResult.data?.best_result?.naob_status ?? null,
        diagnostic_status:
          batchResult.data?.best_result?.diagnostic_status ?? null,
        catalog_update: batchResult.data?.best_result?.catalog_update ?? null,
      },
      note:
        'NAOB Pipeline V1 orchestrates NAOB expression enrichment only. It does not run Ordbokene, Wiktionary, Lexin, semantic audit, or full verification yet.',
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        pipeline: 'naob_pipeline_v1',
        stage: 'unhandled_exception',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
      },
      500,
    );
  }
});