import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  'SUPABASE_SERVICE_ROLE_KEY',
)!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function inferPos(
  surface: string,
  lemma: string,
): string {
  const s = surface.toLowerCase();
  const l = lemma.toLowerCase();

  const pronouns = [
    'jeg',
    'meg',
    'du',
    'deg',
    'han',
    'hun',
    'vi',
    'oss',
    'dere',
    'de',
    'dem',
    'det',
  ];

  const prepositions = [
    'til',
    'på',
    'i',
    'av',
    'for',
    'med',
    'hos',
    'fra',
    'om',
  ];

  if (pronouns.includes(s)) {
    return 'pronoun';
  }

  if (prepositions.includes(s)) {
    return 'preposition';
  }

  if (
    s.endsWith('ing') ||
    s.endsWith('het') ||
    s.endsWith('else')
  ) {
    return 'noun';
  }
if (
  s.endsWith('en') ||
  s.endsWith('et') ||
  s.endsWith('ene')
) {
  return 'noun';
}
  if (
    s.endsWith('er') ||
    s.endsWith('te') ||
    s.endsWith('et')
  ) {
    return 'verb';
  }

  if (
    s.endsWith('lig') ||
    s.endsWith('isk') ||
    s.endsWith('som')
  ) {
    return 'adjective';
  }

  if (surface.includes(' ')) {
    return 'expression';
  }

  return 'unknown';
}

function enrichForm(row: any) {
  const surface = row.surface_form?.toLowerCase() ?? '';
  const lemma = row.normalized_lemma?.toLowerCase() ?? '';

  const inferredPos =
    row.pos && row.pos !== 'unknown'
      ? row.pos
      : inferPos(surface, lemma);

  const features: Record<string, unknown> = {
    pos: inferredPos,
    inferred_pos: inferredPos,
  };

  const acceptedVariants: string[] = [];

  let formType = 'base';

  if (inferredPos === 'noun') {
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
    }
  }

  if (inferredPos === 'verb') {
    if (surface.endsWith('er')) {
      formType = 'present';
      features.tense = 'present';
    } else if (
      surface.endsWith('te') ||
      surface.endsWith('et')
    ) {
      formType = 'past';
      features.tense = 'past';
    } else if (surface.endsWith('t')) {
      formType = 'past_participle';
      features.tense = 'participle';
    }
  }

  if (inferredPos === 'adjective') {
    if (surface.endsWith('ere')) {
      formType = 'comparative';
      features.degree = 'comparative';
    } else if (
      surface.endsWith('est') ||
      surface.endsWith('este')
    ) {
      formType = 'superlative';
      features.degree = 'superlative';
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const limit = body.limit ?? 20;

    const jobId =
      typeof body.job_id === 'string'
        ? body.job_id
        : null;

    const { data: rows, error } = await supabase.rpc(
      'claim_next_form_enrichment',
      {
        p_limit: limit,
        p_job_id: jobId,
      },
    );

    if (error) {
      throw error;
    }

    const results = [];

    for (const row of rows ?? []) {
      try {
        const enriched = enrichForm(row);

        const { error: updateError } =
          await supabase.rpc(
            'update_form_enrichment_status',
            {
              p_id: row.id,
              p_status: 'done',
              p_quality: 'rule_based_v2',
              p_canonical_form:
                enriched.canonical_form,
              p_form_type:
                enriched.form_type,
              p_grammatical_features:
                enriched.grammatical_features,
              p_accepted_variants:
                enriched.accepted_variants,
              p_source: 'internal_rules_v2',
              p_evidence: {
                rule_engine: true,
                version:
                  'form-enrichment-worker-v2',
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
          inferred_pos:
            enriched.grammatical_features.pos,
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
            p_error_message:
              e instanceof Error
                ? e.message
                : String(e),
          },
        );

        results.push({
          id: row.id,
          surface_form: row.surface_form,
          ok: false,
          error:
            e instanceof Error
              ? e.message
              : String(e),
        });
      }
    }

    return Response.json(
      {
        ok: true,
        requested_job_id: jobId,
        claimed: rows?.length ?? 0,
        results,
      },
      {
        headers: corsHeaders,
      },
    );
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : String(e),
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});