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

type FormEnrichment = {
  canonical_form: string;
  form_type: string;
  grammatical_features: Record<string, unknown>;
  accepted_variants: string[];
  quality: string;
  source: string;
  evidence: Record<string, unknown>;
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

function normalizeForm(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function inferPos(surface: string, lemma: string): string {
  const s = surface.toLowerCase();

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

  if (pronouns.includes(s)) return 'pronoun';
  if (prepositions.includes(s)) return 'preposition';

  if (surface.includes(' ') || lemma.includes(' ')) {
    return 'expression';
  }

  if (
    s.endsWith('ing') ||
    s.endsWith('het') ||
    s.endsWith('else') ||
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

  return 'unknown';
}

async function lookupLexemeFormVariant(
  row: any,
): Promise<FormEnrichment | null> {
  const lexemeId = row.lexeme_id;
  const surface = String(row.surface_form ?? '').trim();

  if (!lexemeId || !surface) {
    return null;
  }

  const normalizedSurface = normalizeForm(surface);

  const { data, error } = await supabase
    .from('lexeme_form_variants')
    .select(`
      lexeme_id,
      value,
      normalized_value,
      pos,
      form_type,
      variant_type,
      is_primary,
      is_accepted,
      source_verified,
      evidence
    `)
    .eq('lexeme_id', lexemeId)
    .eq('normalized_value', normalizedSurface)
    .order('is_primary', { ascending: false })
    .order('is_accepted', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const variant = data?.[0];

  if (!variant) {
    return null;
  }

  const features: Record<string, unknown> = {
    pos: variant.pos ?? row.pos ?? 'unknown',
    source_priority: 'lexeme_form_variants',
    variant_type: variant.variant_type ?? null,
    is_primary: variant.is_primary ?? null,
    is_accepted: variant.is_accepted ?? null,
  };

  return {
    canonical_form:
      row.normalized_lemma ??
      variant.normalized_value ??
      variant.value ??
      normalizedSurface,
    form_type:
      variant.form_type ??
      variant.variant_type ??
      'base',
    grammatical_features: features,
    accepted_variants: [variant.value],
    quality: 'resolver_verified_form_v1',
    source: 'lexeme_form_variants',
    evidence: {
      table: 'lexeme_form_variants',
      matched_value: variant.value,
      normalized_value: variant.normalized_value,
      lexeme_id: variant.lexeme_id,
      source_verified: variant.source_verified ?? null,
      variant_evidence: variant.evidence ?? {},
      version: 'form-enrichment-worker-v4',
    },
  };
}

function enrichFormWithRules(row: any): FormEnrichment {
  const surface = normalizeForm(row.surface_form ?? '');
  const lemma = normalizeForm(row.normalized_lemma ?? surface);

  const inferredPos =
    row.pos && row.pos !== 'unknown'
      ? row.pos
      : inferPos(surface, lemma);

  const features: Record<string, unknown> = {
    pos: inferredPos,
    inferred_pos: inferredPos,
    source_priority: 'internal_rules',
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

  if (lemma) {
    acceptedVariants.push(lemma);
  }

  if (surface && surface !== lemma) {
    acceptedVariants.push(surface);
  }

  return {
    canonical_form: lemma,
    form_type: formType,
    grammatical_features: features,
    accepted_variants: [...new Set(acceptedVariants)],
    quality: 'rule_based_v2',
    source: 'internal_rules_v2',
    evidence: {
      rule_engine: true,
      version: 'form-enrichment-worker-v4',
      fallback: true,
    },
  };
}

async function enrichForm(row: any): Promise<FormEnrichment> {
  const verifiedVariant = await lookupLexemeFormVariant(row);

  if (verifiedVariant) {
    return verifiedVariant;
  }

  return enrichFormWithRules(row);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const limit =
      typeof body.limit === 'number' && body.limit > 0
        ? body.limit
        : 20;

    const jobId =
      typeof body.job_id === 'string' &&
      body.job_id.trim().length > 0
        ? body.job_id.trim()
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
        const enriched = await enrichForm(row);

        const { error: updateError } =
          await supabase.rpc(
            'update_form_enrichment_status',
            {
              p_id: row.id,
              p_status: 'done',
              p_quality: enriched.quality,
              p_canonical_form:
                enriched.canonical_form,
              p_form_type:
                enriched.form_type,
              p_grammatical_features:
                enriched.grammatical_features,
              p_accepted_variants:
                enriched.accepted_variants,
              p_source: enriched.source,
              p_evidence: enriched.evidence,
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
          quality: enriched.quality,
          source: enriched.source,
          ok: true,
        });
      } catch (e) {
        const message = safeStringify(e);

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
            p_error_message: message,
          },
        );

        results.push({
          id: row.id,
          surface_form: row.surface_form,
          ok: false,
          error: message,
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
        error: safeStringify(e),
      },
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});