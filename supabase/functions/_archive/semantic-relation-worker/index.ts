import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type UnitRow = {
  semantic_unit_id: string;
  canonical_form: string;
  normalized_form: string;
  semantic_type: string;
  pos: string | null;
  confidence: string | null;
};

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (typeof value === 'string') return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function insertRelation(
  sourceUnitId: string,
  targetUnitId: string,
  relationType: string,
  confidence: string,
  evidence: Record<string, unknown>,
) {
  if (sourceUnitId === targetUnitId) return;

  const { error } = await supabase
    .from('semantic_unit_relations')
    .upsert(
      {
        source_unit_id: sourceUnitId,
        target_unit_id: targetUnitId,
        relation_type: relationType,
        confidence,
        source: 'semantic_relation_worker_v1',
        evidence,
        status: 'active',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'source_unit_id,target_unit_id,relation_type',
      },
    );

  if (error) throw error;
}

async function buildVariantRelations(unit: UnitRow) {
  const { data: variants, error } = await supabase
    .from('semantic_unit_variants')
    .select('semantic_unit_id, variant_form')
    .eq('variant_form', unit.canonical_form);

  if (error) throw error;

  for (const variant of variants ?? []) {
    if (variant.semantic_unit_id !== unit.semantic_unit_id) {
      await insertRelation(
        unit.semantic_unit_id,
        variant.semantic_unit_id,
        'variant',
        'high',
        {
          reason: 'same_variant_form',
          variant_form: unit.canonical_form,
        },
      );
    }
  }
}


serve(async (_req) => {
  try {
    const { data: rows, error } = await supabase.rpc(
      'claim_next_semantic_relation_build',
      { p_limit: 30 },
    );

    if (error) {
      throw new Error(
        `claim_next_semantic_relation_build failed: ${safeStringify(error)}`,
      );
    }

    const results = [];

    for (const unit of (rows ?? []) as UnitRow[]) {
      try {
        await buildVariantRelations(unit);

        
        const { error: completeError } = await supabase.rpc(
          'complete_semantic_relation_build',
          {
            p_semantic_unit_id: unit.semantic_unit_id,
          },
        );

        if (completeError) {
          throw completeError;
        }

        results.push({
          semantic_unit_id: unit.semantic_unit_id,
          canonical_form: unit.canonical_form,
          ok: true,
        });
      } catch (e) {
        results.push({
          semantic_unit_id: unit.semantic_unit_id,
          canonical_form: unit.canonical_form,
          ok: false,
          error: safeStringify(e),
        });
      }
    }

    return Response.json({
      ok: true,
      claimed: rows?.length ?? 0,
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