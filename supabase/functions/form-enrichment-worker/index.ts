import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

function enrichForm(row: any) {
  const surface = row.surface_form?.toLowerCase() ?? '';
  const lemma = row.normalized_lemma?.toLowerCase() ?? '';
  const pos = row.pos;

  const features: Record<string, unknown> = {};
  const acceptedVariants: string[] = [];

  let formType = 'base';

  if (pos === 'noun') {
    if (surface.endsWith('ene')) {
      formType = 'plural_definite';
      features.number = 'plural';
      features.definiteness = 'definite';
    } else if (surface.endsWith('a')) {
      formType = 'plural_definite';
      features.number = 'plural';
      features.definiteness = 'definite';
    } else if (surface.endsWith('en')) {
      formType = 'singular_definite';
      features.number = 'singular';
      features.definiteness = 'definite';
    } else if (surface.endsWith('et')) {
      formType = 'singular_definite';
      features.number = 'singular';
      features.definiteness = 'definite';
    } else if (surface.endsWith('er')) {
      formType = 'plural_indefinite';
      features.number = 'plural';
      features.definiteness = 'indefinite';
    } else {
      formType = 'base';
    }
  }

  if (pos === 'verb') {
    if (surface === 'er') {
      formType = 'present';
      features.tense = 'present';
    } else if (surface === 'vil') {
      formType = 'modal_present';
      features.tense = 'present';
      features.modal = true;
    } else if (surface.endsWith('te') || surface.endsWith('et')) {
      formType = 'past';
      features.tense = 'past';
    } else if (surface.endsWith('t')) {
      formType = 'past_participle';
      features.tense = 'participle';
    }
  }

  if (pos === 'adjective') {
    if (surface.endsWith('ere')) {
      formType = 'comparative';
      features.degree = 'comparative';
    } else if (surface.endsWith('est') || surface.endsWith('este')) {
      formType = 'superlative';
      features.degree = 'superlative';
    } else if (surface.endsWith('t')) {
      formType = 'neuter_singular';
      features.gender = 'neuter';
      features.number = 'singular';
    } else if (surface.endsWith('e')) {
      formType = 'plural_or_definite';
      features.number = 'plural_or_definite';
    }
  }

  acceptedVariants.push(lemma);

  return {
    canonical_form: lemma,
    form_type: formType,
    grammatical_features: features,
    accepted_variants: acceptedVariants,
  };
}

serve(async (_req) => {
  try {
    const { data: rows, error } = await supabase.rpc(
      'claim_next_form_enrichment',
      {
        p_limit: 20,
      },
    );

    if (error) {
      throw error;
    }

    const results = [];

    for (const row of rows ?? []) {
      try {
        const enriched = enrichForm(row);

        const { error: updateError } = await supabase.rpc(
          'update_form_enrichment_status',
          {
            p_id: row.id,
            p_status: 'done',
            p_quality: 'rule_based',
            p_canonical_form: enriched.canonical_form,
            p_form_type: enriched.form_type,
            p_grammatical_features: enriched.grammatical_features,
            p_accepted_variants: enriched.accepted_variants,
            p_source: 'internal_rules',
            p_evidence: {
              rule_engine: true,
              version: 'form-enrichment-worker-v1',
            },
            p_error_message: null,
          },
        );

        if (updateError) {
          throw updateError;
        }

        results.push({
          id: row.id,
          surface_form: row.surface_form,
          form_type: enriched.form_type,
          ok: true,
        });
      } catch (e) {
        await supabase.rpc(
          'update_form_enrichment_status',
          {
            p_id: row.id,
            p_status: 'failed',
            p_quality: null,
            p_canonical_form: null,
            p_form_type: null,
            p_grammatical_features: {},
            p_accepted_variants: [],
            p_source: null,
            p_evidence: {},
            p_error_message: e instanceof Error
              ? e.message
              : String(e),
          },
        );

        results.push({
          id: row.id,
          surface_form: row.surface_form,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
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
        error: e instanceof Error ? e.message : String(e),
      },
      {
        status: 500,
      },
    );
  }
});