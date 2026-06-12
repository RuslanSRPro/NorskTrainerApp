import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

type EntityType = 'lexeme' | 'expression';

type Row = {
  enrichment_id: string;
  entity_type: EntityType;
  entity_id: string;
  lemma: string;
  pos: string | null;
  review_status: string;
  semantic_confidence: string | null;
};

function normalizeSemanticForm(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:()"']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\ben\b/g, '')
    .replace(/\bet\b/g, '')
    .replace(/\bei\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function semanticType(row: Row): string {
  if (row.entity_type === 'expression') return 'expression';
  if (row.pos === 'expression') return 'expression';
  return 'lexeme';
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

async function claimLexemes(limit: number): Promise<Row[]> {
  const { data, error } = await supabase.rpc(
    'claim_next_semantic_normalization',
    { p_limit: limit },
  );

  if (error) {
    throw new Error(
      `claim_next_semantic_normalization failed: ${safeStringify(error)}`,
    );
  }

  return (data ?? []).map((row: any) => ({
    enrichment_id: row.enrichment_id,
    entity_type: 'lexeme',
    entity_id: row.lexeme_id,
    lemma: row.lemma,
    pos: row.pos,
    review_status: row.review_status,
    semantic_confidence: row.semantic_confidence,
  }));
}

async function claimExpressions(limit: number): Promise<Row[]> {
  const { data, error } = await supabase.rpc(
    'claim_next_expression_semantic_normalization',
    { p_limit: limit },
  );

  if (error) {
    throw new Error(
      `claim_next_expression_semantic_normalization failed: ${safeStringify(error)}`,
    );
  }

  return (data ?? []).map((row: any) => ({
    enrichment_id: row.enrichment_id,
    entity_type: 'expression',
    entity_id: row.expression_id,
    lemma: row.lemma,
    pos: row.pos ?? 'expression',
    review_status: row.review_status,
    semantic_confidence: row.semantic_confidence,
  }));
}

async function completeNormalization(
  row: Row,
  semanticUnitId: string,
): Promise<void> {
  if (row.entity_type === 'expression') {
    const { error } = await supabase.rpc(
      'complete_expression_semantic_normalization',
      {
        p_enrichment_id: row.enrichment_id,
        p_semantic_unit_id: semanticUnitId,
      },
    );

    if (error) {
      throw new Error(
        `complete_expression_semantic_normalization failed: ${safeStringify(error)}`,
      );
    }

    return;
  }

  const { error } = await supabase.rpc(
    'complete_semantic_normalization',
    {
      p_enrichment_id: row.enrichment_id,
      p_semantic_unit_id: semanticUnitId,
    },
  );

  if (error) {
    throw new Error(
      `complete_semantic_normalization failed: ${safeStringify(error)}`,
    );
  }
}

async function ensureSemanticUnit(row: Row): Promise<string> {
  const canonicalForm = row.lemma.trim();
  const normalizedForm = normalizeSemanticForm(canonicalForm);
  const unitType = semanticType(row);

  const { data: existingUnit, error: existingError } = await supabase
    .from('canonical_semantic_units')
    .select('id')
    .eq('normalized_form', normalizedForm)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingUnit?.id) {
    return existingUnit.id;
  }

  const { data: insertedUnit, error: insertError } = await supabase
    .from('canonical_semantic_units')
    .insert({
      canonical_form: canonicalForm,
      normalized_form: normalizedForm,
      semantic_type: unitType,
      pos: row.pos,
      trusted: true,
      confidence: row.semantic_confidence,
      source_count: 1,
      primary_source:
        row.entity_type === 'expression'
          ? 'trusted_expressions_v1'
          : 'trusted_lexemes_v1',
    })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedUnit.id;
}

async function attachVariant(
  row: Row,
  semanticUnitId: string,
): Promise<void> {
  const canonicalForm = row.lemma.trim();

  const insertPayload =
    row.entity_type === 'expression'
      ? {
          semantic_unit_id: semanticUnitId,
          lexeme_id: null,
          variant_form: canonicalForm,
          variant_type: 'trusted_expression',
          confidence: row.semantic_confidence,
        }
      : {
          semantic_unit_id: semanticUnitId,
          lexeme_id: row.entity_id,
          variant_form: canonicalForm,
          variant_type: 'trusted_lexeme',
          confidence: row.semantic_confidence,
        };

  const { error } = await supabase
    .from('semantic_unit_variants')
    .insert(insertPayload);

  if (error) {
    const msg = safeStringify(error);
    if (!msg.includes('duplicate')) {
      throw error;
    }
  }
}

serve(async (_req) => {
  try {
    const lexemeRows = await claimLexemes(50);
    const remaining = Math.max(0, 50 - lexemeRows.length);
    const expressionRows = remaining > 0
      ? await claimExpressions(remaining)
      : [];

    const rows = [...lexemeRows, ...expressionRows];
    const results = [];

    for (const row of rows) {
      try {
        const semanticUnitId = await ensureSemanticUnit(row);
        await attachVariant(row, semanticUnitId);
        await completeNormalization(row, semanticUnitId);

        results.push({
          entity_type: row.entity_type,
          lemma: row.lemma,
          normalized_form: normalizeSemanticForm(row.lemma),
          semantic_unit_id: semanticUnitId,
          ok: true,
        });
      } catch (e) {
        results.push({
          entity_type: row.entity_type,
          lemma: row.lemma,
          ok: false,
          error: safeStringify(e),
        });
      }
    }

    return Response.json({
      ok: true,
      claimed: rows.length,
      lexemes_claimed: lexemeRows.length,
      expressions_claimed: expressionRows.length,
      results,
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: safeStringify(e),
      },
      { status: 500 },
    );
  }
});