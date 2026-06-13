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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const INGESTION_VERSION =
  'ts_expression_aware_ingestion_v4_safe_auxiliary_consumption';

const BAD_EXPRESSION_STARTS = [
  'jeg',
  'du',
  'han',
  'hun',
  'vi',
  'dere',
  'de',
  'det',
];

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
  auxiliary_consumed?: string[] | null;
};

function isCovered(covered: Set<number>, start: number, end: number): boolean {
  for (let i = start; i <= end; i++) {
    if (covered.has(i)) return true;
  }
  return false;
}

function markCovered(covered: Set<number>, start: number, end: number) {
  for (let i = start; i <= end; i++) {
    covered.add(i);
  }
}

async function loadExpressions(): Promise<ExpressionRow[]> {
  const { data, error } = await supabase
    .from('expression_catalog')
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

  return (data ?? [])
    .map((row: any) => {
      const key = normalizeExpression(row.normalized_key);

      return {
        id: row.id,
        lemma: row.lemma,
        display_form: row.display_form,
        normalized_key: key,
        pos: row.pos ?? 'expression',
        expression_subtype: row.expression_subtype ?? null,
        token_len: tokenize(key).length,
      };
    })
    .filter((row) => {
      if (!row.normalized_key) return false;
      if (row.normalized_key.includes('/')) return false;
      if (/[гґ]/i.test(row.normalized_key)) return false;

      const firstToken = tokenize(row.normalized_key)[0];

      if (BAD_EXPRESSION_STARTS.includes(firstToken)) {
        return false;
      }

      return row.token_len >= 2;
    })
    .sort((a, b) => {
      if (b.token_len !== a.token_len) {
        return b.token_len - a.token_len;
      }

      return b.normalized_key.length - a.normalized_key.length;
    });
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

async function planItems(
  text: string,
  expressions: ExpressionRow[],
  verbMaps: VerbMaps,
): Promise<PlannedItem[]> {
  const tokens = tokenize(text).map((t) => normalizeExpression(t));
  const covered = new Set<number>();
  const items: PlannedItem[] = [];

  for (const expr of expressions) {
    const exprTokens = tokenize(expr.normalized_key).map((t) =>
      normalizeExpression(t)
    );

    if (!exprTokens.length || exprTokens.length > tokens.length) {
      continue;
    }

    for (
      let start = 0;
      start <= tokens.length - exprTokens.length;
      start++
    ) {
      const end = start + exprTokens.length - 1;

      if (isCovered(covered, start, end)) continue;

      const slice = tokens.slice(start, end + 1);

      const exactMatch = slice.join(' ') === exprTokens.join(' ');

      const compoundNormalizedSlice = normalizeCompoundTokens(
        slice,
        verbMaps.presensToInfinitiv,
        verbMaps.perfektumToInfinitiv,
      );

      const compoundNormalizedKey = compoundNormalizedSlice.join(' ');

      const compoundMatch =
        compoundNormalizedKey === exprTokens.join(' ');

      if (!exactMatch && !compoundMatch) {
        continue;
      }

      const rawSurface = slice.join(' ');

      const plannedItem: PlannedItem = {
        raw_input: rawSurface,
        normalized_input: expr.normalized_key,
        normalized_lemma: expr.normalized_key,
        surface_form: rawSurface,
        pos: 'expression',
        match_type: 'expression',
        expression_id: expr.id,
        token_start: start,
        token_end: end,
        expression_subtype: expr.expression_subtype,
        resolved: null,
        match_strategy: compoundMatch
          ? 'compound_normalized'
          : 'exact_expression',
        compound_normalized: compoundMatch
          ? compoundNormalizedKey
          : null,
        auxiliary_consumed: null,
      };

      items.push(plannedItem);

      markCovered(covered, start, end);

      const helperStart = start - 3;

      if (
        compoundMatch &&
        helperStart >= 0 &&
        (tokens[helperStart] === 'kommer' ||
          tokens[helperStart] === 'kom') &&
        tokens[helperStart + 1] === 'til' &&
        tokens[helperStart + 2] === 'å'
      ) {
        markCovered(covered, helperStart, start - 1);

        plannedItem.auxiliary_consumed = tokens.slice(
          helperStart,
          start,
        );
      }
    }
  }

  for (let index = 0; index < tokens.length; index++) {
    if (covered.has(index)) continue;

    const surface = tokens[index];
    const normalized = normalize(surface);

    if (!normalized || normalized.length < 2) {
      continue;
    }

    const resolved = await resolveSurfaceForm(surface);

    items.push({
      raw_input: surface,
      normalized_input: normalized,
      normalized_lemma: resolved?.lemma ?? normalized,
      surface_form: surface,
      pos: resolved?.pos ?? null,
      match_type: 'token',
      expression_id: null,
      token_start: index,
      token_end: index,
      resolved,
      match_strategy: 'token',
      compound_normalized: null,
      auxiliary_consumed: null,
    });
  }

  return items.sort((a, b) => a.token_start - b.token_start);
}

async function insertSourceChecks(
  jobId: string,
  itemId: string,
  lexemeId: string | null,
  query: string,
  queryType: 'expression' | 'token',
) {
  for (const source of SOURCES) {
    const { error } = await supabase.from('lexeme_source_checks').insert({
      job_id: jobId,
      item_id: itemId,
      lexeme_id: lexemeId,
      source,
      stage: 'lemma',
      query,
      query_type: queryType,
      status: 'pending',
      attempt_count: 0,
      max_attempts: 3,
      evidence: {},
      urls: [],
      verification_version: 1,
    });

    if (error) throw error;
  }
}

async function insertItems(jobId: string, items: PlannedItem[]) {
  let expressionItems = 0;
  let tokenItems = 0;

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
          auxiliary_consumed: item.auxiliary_consumed ?? null,
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

    await insertSourceChecks(
      jobId,
      data.id,
      item.resolved?.lexeme_id ?? null,
      item.normalized_input,
      item.match_type,
    );
  }

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

    const expressions = await loadExpressions();
    const verbMaps = await loadVerbMaps();

    const plannedItems = await planItems(text, expressions, verbMaps);

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
          safe_auxiliary_consumption: true,
          bad_expression_starts_filter: true,
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