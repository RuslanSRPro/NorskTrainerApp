import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalize,
  normalizeExpression,
  tokenize,
} from '../_shared/nlp/normalize.ts';
import { normalizeCompoundTokens } from '../_shared/nlp/morphology.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SOURCES = ['NAOB', 'Ordbokene', 'Lexin', 'Språkrådet', 'Wiktionary'];

const INGESTION_VERSION =
  'ts_expression_aware_ingestion_v7_strict_verified_expressions';

const MAX_PHRASE_TOKENS = 8;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type ExpressionRow = {
  id: string;
  lemma: string;
  display_form: string;
  normalized_key: string;
  pos: string;
  expression_subtype: string | null;
  token_len: number;
};

type VerbMaps = {
  presensToInfinitiv: Map<string, string>;
  perfektumToInfinitiv: Map<string, string>;
};

type SurfaceResolution = {
  lexeme_id: string;
  lemma: string;
  pos: string;
  form_type: string;
  grammatical_features: Record<string, unknown>;
  confidence: string;
  source: string;
};

type PlannedItem = {
  raw_input: string;
  normalized_input: string;
  normalized_lemma: string;
  surface_form: string;
  pos: string | null;
  match_type: 'expression' | 'token';
  expression_id: string | null;
  token_start: number;
  token_end: number;
  expression_subtype?: string | null;
  resolved?: SurfaceResolution | null;
  match_strategy?: 'exact_expression' | 'compound_normalized' | 'token';
  compound_normalized?: string | null;
};

function markCovered(covered: Set<number>, start: number, end: number) {
  for (let i = start; i <= end; i++) {
    covered.add(i);
  }
}

// Replaces the previous hasStrongWholeUnitEvidence() raw-evidence filter.
// That function re-derived its own notion of "strong enough to trust" by
// inspecting verification_evidence directly — a third place in the system
// reinventing the same interpretation as services/verification.ts
// (client) and aggregateVerificationTier() (server), with its own slightly
// different rules. trusted_expressions_v1 already encodes the single
// canonical trust verdict (expression_semantic_enrichment.review_status =
// 'trusted', written only by semantic-audit-worker), so querying it
// directly removes both the duplication and the risk of a fourth
// diverging interpretation. See architecture-audit-full.md.
async function loadExpressions(): Promise<Map<string, ExpressionRow>> {
  const { data, error } = await supabase
    .from('trusted_expressions_v1')
    .select(`
      id,
      lemma,
      display_form,
      normalized_key,
      pos,
      expression_subtype
    `)
    .not('normalized_key', 'is', null);

  if (error) throw error;

  const dict = new Map<string, ExpressionRow>();

  for (const row of data ?? []) {
    const key = normalizeExpression(row.normalized_key);

    if (!key) continue;
    if (key.includes('/')) continue;
    if (/[гґ]/i.test(key)) continue;

    const item: ExpressionRow = {
      id: row.id,
      lemma: row.lemma,
      display_form: row.display_form,
      normalized_key: key,
      pos: row.pos ?? 'expression',
      expression_subtype: row.expression_subtype ?? null,
      token_len: tokenize(key).length,
    };

    if (item.token_len < 2) continue;

    if (!dict.has(key)) {
      dict.set(key, item);
    }

    if (key.includes('seg')) {
      for (const pron of ['meg', 'deg', 'oss', 'dere']) {
        const variant = key.replace(/\bseg\b/g, pron);
        if (variant !== key && !dict.has(variant)) {
          dict.set(variant, item);
        }
      }
    }
  }

  return dict;
}

async function loadVerbMaps(): Promise<VerbMaps> {
  const { data, error } = await supabase
    .from('verb_forms')
    .select('infinitiv, presens, perfektum');

  if (error) throw error;

  const presensToInfinitiv = new Map<string, string>();
  const perfektumToInfinitiv = new Map<string, string>();

  for (const row of data ?? []) {
    const infinitiv = normalize(row.infinitiv ?? '');
    const presens = normalize(row.presens ?? '');
    const perfektum = normalize(row.perfektum ?? '');

    if (infinitiv && presens) {
      presensToInfinitiv.set(presens, infinitiv);
    }

    if (infinitiv && perfektum) {
      perfektumToInfinitiv.set(perfektum, infinitiv);
    }
  }

  return {
    presensToInfinitiv,
    perfektumToInfinitiv,
  };
}

async function resolveSurfaceForm(
  surfaceForm: string,
): Promise<SurfaceResolution | null> {
  const { data, error } = await supabase.rpc('resolve_surface_form', {
    p_surface_form: surfaceForm,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;

  if (!row?.lexeme_id || !row?.lemma) {
    return null;
  }

  return {
    lexeme_id: row.lexeme_id,
    lemma: row.lemma,
    pos: row.pos,
    form_type: row.form_type,
    grammatical_features: row.grammatical_features ?? {},
    confidence: row.confidence,
    source: row.source,
  };
}

function findKnownExpression(
  tokensRaw: string[],
  tokensNorm: string[],
  start: number,
  expressionDict: Map<string, ExpressionRow>,
  verbMaps: VerbMaps,
): {
  expr: ExpressionRow;
  rawSurface: string;
  normalizedKey: string;
  end: number;
  matchStrategy: 'exact_expression' | 'compound_normalized';
  compoundNormalized: string | null;
} | null {
  const maxLen = Math.min(
    MAX_PHRASE_TOKENS,
    tokensNorm.length - start,
  );

  for (let len = maxLen; len >= 2; len--) {
    const rawSlice = tokensRaw.slice(start, start + len);
    const normSlice = tokensNorm.slice(start, start + len);

    const rawSurface = rawSlice.join(' ');
    const normKey = normSlice.join(' ');

    const exact = expressionDict.get(normKey);

    if (exact) {
      return {
        expr: exact,
        rawSurface,
        normalizedKey: exact.normalized_key,
        end: start + len - 1,
        matchStrategy: 'exact_expression',
        compoundNormalized: null,
      };
    }

    const normalizedTokens = normalizeCompoundTokens(
      normSlice,
      verbMaps.presensToInfinitiv,
      verbMaps.perfektumToInfinitiv,
    );

    const compoundKey = normalizedTokens.join(' ');

    if (compoundKey !== normKey) {
      const compound = expressionDict.get(compoundKey);

      if (compound) {
        return {
          expr: compound,
          rawSurface,
          normalizedKey: compound.normalized_key,
          end: start + len - 1,
          matchStrategy: 'compound_normalized',
          compoundNormalized: compoundKey,
        };
      }
    }
  }

  return null;
}

async function planItems(
  text: string,
  expressionDict: Map<string, ExpressionRow>,
  verbMaps: VerbMaps,
): Promise<PlannedItem[]> {
  const tokensRaw = tokenize(text);
  const tokensNorm = tokensRaw.map((t) => normalizeExpression(t));

  const covered = new Set<number>();
  const items: PlannedItem[] = [];

  for (let index = 0; index < tokensNorm.length; index++) {
    if (covered.has(index)) continue;

    const expressionMatch = findKnownExpression(
      tokensRaw,
      tokensNorm,
      index,
      expressionDict,
      verbMaps,
    );

    if (expressionMatch) {
      const expr = expressionMatch.expr;

      items.push({
        raw_input: expressionMatch.rawSurface,
        normalized_input: expressionMatch.normalizedKey,
        normalized_lemma: expressionMatch.normalizedKey,
        surface_form: expressionMatch.rawSurface,
        pos: 'expression',
        match_type: 'expression',
        expression_id: expr.id,
        token_start: index,
        token_end: expressionMatch.end,
        expression_subtype: expr.expression_subtype,
        resolved: null,
        match_strategy: expressionMatch.matchStrategy,
        compound_normalized: expressionMatch.compoundNormalized,
      });

      markCovered(covered, index, expressionMatch.end);
      continue;
    }

    const rawSurface = tokensRaw[index];
    const normalized = normalize(rawSurface);

    if (!normalized || normalized.length < 2) {
      covered.add(index);
      continue;
    }

    const resolved = await resolveSurfaceForm(rawSurface);

    items.push({
      raw_input: rawSurface,
      normalized_input: normalized,
      normalized_lemma: resolved?.lemma ?? normalized,
      surface_form: rawSurface,
      pos: resolved?.pos ?? null,
      match_type: 'token',
      expression_id: null,
      token_start: index,
      token_end: index,
      resolved,
      match_strategy: 'token',
      compound_normalized: null,
    });

    covered.add(index);
  }

  return items.sort((a, b) => a.token_start - b.token_start);
}

async function insertSourceChecksBatch(
  jobId: string,
  rows: Array<{
    itemId: string;
    lexemeId: string | null;
    query: string;
    queryType: 'expression' | 'token';
  }>,
) {
  const sourceRows = rows.flatMap((row) =>
    SOURCES.map((source) => ({
      job_id: jobId,
      item_id: row.itemId,
      lexeme_id: row.lexemeId,
      source,
      stage: 'lemma',
      query: row.query,
      query_type: row.queryType,
      status: 'pending',
      attempt_count: 0,
      max_attempts: 3,
      evidence: {},
      urls: [],
      verification_version: 1,
    }))
  );

  if (!sourceRows.length) return;

  const { error } = await supabase
    .from('lexeme_source_checks')
    .insert(sourceRows);

  if (error) throw error;
}

async function insertItems(jobId: string, items: PlannedItem[]) {
  let expressionItems = 0;
  let tokenItems = 0;

  const sourceCheckRows: Array<{
    itemId: string;
    lexemeId: string | null;
    query: string;
    queryType: 'expression' | 'token';
  }> = [];

  for (const item of items) {
    const { data, error } = await supabase
      .from('lexeme_processing_items')
      .insert({
        job_id: jobId,
        expression_id: item.expression_id,
        lexeme_id: null,
        raw_input: item.raw_input,
        normalized_input: item.normalized_input,
        normalized_lemma: item.normalized_lemma,
        surface_form: item.surface_form,
        pos: item.pos,
        match_type: item.match_type,
        status: 'pending',
        current_stage: 'source_checks',
        attempt_count: 0,
        max_attempts: 3,
        result_summary: {
          ingestion_version: INGESTION_VERSION,
          token_start: item.token_start,
          token_end: item.token_end,
          expression_subtype: item.expression_subtype ?? null,
          match_strategy: item.match_strategy ?? null,
          compound_normalized: item.compound_normalized ?? null,
          resolved_lexeme_id: item.resolved?.lexeme_id ?? null,
          resolved_lemma: item.resolved?.lemma ?? null,
          resolved_pos: item.resolved?.pos ?? null,
          resolved_form_type: item.resolved?.form_type ?? null,
          resolved_confidence: item.resolved?.confidence ?? null,
          resolved_source: item.resolved?.source ?? null,
          resolved_features:
            item.resolved?.grammatical_features ?? null,
        },
      })
      .select('id')
      .single();

    if (error) throw error;

    if (item.match_type === 'expression') {
      expressionItems++;
    } else {
      tokenItems++;
    }

    sourceCheckRows.push({
      itemId: data.id,
      lexemeId: item.resolved?.lexeme_id ?? null,
      query: item.normalized_input,
      queryType: item.match_type,
    });
  }

  await insertSourceChecksBatch(jobId, sourceCheckRows);

  return {
    expressionItems,
    tokenItems,
  };
}

async function triggerOrchestrator(jobId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/job-orchestrator`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: jobId,
      }),
    },
  );

  try {
    return await response.json();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body.text || '').trim();

    if (!text) {
      return Response.json(
        {
          ok: false,
          error: 'Text is required',
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const { data: jobId, error: jobError } = await supabase.rpc(
      'create_empty_text_analysis_job',
      {
        p_text: text,
        p_user_id: body.user_id ?? null,
        p_ingestion_version: INGESTION_VERSION,
      },
    );

    if (jobError) throw jobError;

    const expressionDict = await loadExpressions();
    const verbMaps = await loadVerbMaps();

    const plannedItems = await planItems(
      text,
      expressionDict,
      verbMaps,
    );

    const { expressionItems, tokenItems } = await insertItems(
      jobId,
      plannedItems,
    );

    const { error: jobUpdateError } = await supabase
      .from('lexeme_processing_jobs')
      .update({
        total_items: plannedItems.length,
        summary: {
          ingestion_version: INGESTION_VERSION,
          total_items: plannedItems.length,
          expression_items: expressionItems,
          token_items: tokenItems,
          source_checks_per_item: SOURCES.length,
          surface_resolver: true,
          compound_normalization: true,
          legacy_aligned_expression_parser: true,
          strict_verified_expression_catalog: true,
          raw_token_preservation: true,
          batched_source_checks: true,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (jobUpdateError) throw jobUpdateError;

    const orchestratorResult = await triggerOrchestrator(jobId);

    const { data: job } = await supabase
      .from('lexeme_processing_jobs')
      .select(`
        id,
        status,
        total_items,
        done_items,
        partial_items,
        failed_items,
        skipped_items,
        summary,
        created_at
      `)
      .eq('id', jobId)
      .single();

    return Response.json(
      {
        ok: true,
        job,
        ingestion: {
          planned_items: plannedItems,
          expression_items: expressionItems,
          token_items: tokenItems,
        },
        orchestrator: orchestratorResult,
      },
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
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