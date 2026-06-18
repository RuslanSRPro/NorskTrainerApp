import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function inferBaseLemma(
  lemma: string,
  pos: string | null,
): string | null {
  const s = lemma.toLowerCase();

  if (pos !== 'verb') {
    return null;
  }

  // Already infinitive/base form in Norwegian.
  // Do not convert bytte → byte, hente → hene, sitte → site.
  if (s.endsWith('e')) {
    return null;
  }

  // present → infinitive
  // snakker → snakke
  // gleder → glede
  if (s.endsWith('er')) {
    return s.slice(0, -2) + 'e';
  }

  // weak past
  // snakket → snakke
  if (s.endsWith('et')) {
    return s.slice(0, -2) + 'e';
  }

  // weak past
  // kjøpte → kjøpe
  if (s.endsWith('te')) {
    return s.slice(0, -2) + 'e';
  }

  // participle
  // snakket/lagt-like simple fallback
  if (s.endsWith('t')) {
    return s.slice(0, -1) + 'e';
  }

  return null;
}

async function upsertRelation(
  sourceLexemeId: string,
  targetLexemeId: string,
  relationType: string,
  evidence: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('lexeme_relations')
    .upsert({
      source_lexeme_id: sourceLexemeId,
      target_lexeme_id: targetLexemeId,
      relation_type: relationType,
      confidence: 'medium',
      source: 'grammar_family_worker',
      evidence,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
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
    const limit =
      typeof body.limit === 'number' && body.limit > 0
        ? body.limit
        : 50;

    const { data: lexemes, error } = await supabase
      .from('lexemes')
      .select(`
        id,
        lemma,
        pos
      `)
      .eq('pos', 'verb')
      .limit(limit);

    if (error) {
      throw error;
    }

    const results = [];

    for (const lexeme of lexemes ?? []) {
      try {
        const baseLemma = inferBaseLemma(
          lexeme.lemma,
          lexeme.pos,
        );

        if (!baseLemma) {
          results.push({
            lemma: lexeme.lemma,
            linked: false,
            skipped: true,
            reason: 'already_base_or_not_inferrable',
          });

          continue;
        }

        const { data: target, error: targetError } = await supabase
          .from('lexemes')
          .select('id, lemma')
          .eq('lemma', baseLemma)
          .maybeSingle();

        if (targetError) {
          throw targetError;
        }

        if (!target) {
          results.push({
            lemma: lexeme.lemma,
            base: baseLemma,
            linked: false,
            reason: 'target_not_found',
          });

          continue;
        }

        await upsertRelation(
          lexeme.id,
          target.id,
          'grammar_family',
          {
            inferred: true,
            worker: 'grammar-family-worker-v2',
            source_lemma: lexeme.lemma,
            target_lemma: target.lemma,
            rule: 'simple_norwegian_verb_surface_to_infinitive',
          },
        );

        results.push({
          lemma: lexeme.lemma,
          base: target.lemma,
          linked: true,
        });
      } catch (e) {
        results.push({
          lemma: lexeme.lemma,
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
        processed: results.length,
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