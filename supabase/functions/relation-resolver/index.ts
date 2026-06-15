import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL')!;

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
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

async function resolveExpression(target: string) {
  const { data, error } = await supabase
    .from('expression_catalog')
    .select('id, lemma, display_form, normalized_key')
    .eq('normalized_key', target)
    .maybeSingle();

  if (error) {
    throw new Error(
      `resolveExpression failed: ${safeStringify(error)}`,
    );
  }

  return data;
}

async function resolveLexeme(target: string) {
  const { data, error } = await supabase
    .from('lexemes')
    .select('id, lemma')
    .eq('lemma', target)
    .maybeSingle();

  if (error) {
    throw new Error(
      `resolveLexeme failed: ${safeStringify(error)}`,
    );
  }

  return data;
}

serve(async (_req) => {
  try {
    const { data: rows, error } =
      await supabase.rpc(
        'claim_next_relation_candidates',
        {
          p_limit: 20,
        },
      );

    if (error) {
      throw new Error(
        `claim_next_relation_candidates failed: ${safeStringify(error)}`,
      );
    }

    const results = [];

    for (const row of rows ?? []) {
      try {
        const target = normalize(row.target_text);

        let resolvedType:
          | 'lexeme'
          | 'expression'
          | null = null;

        let resolvedId: string | null = null;

        const expression =
          await resolveExpression(target);

        if (expression?.id) {
          resolvedType = 'expression';
          resolvedId = expression.id;
        }

        if (!resolvedId) {
          const lexeme =
            await resolveLexeme(target);

          if (lexeme?.id) {
            resolvedType = 'lexeme';
            resolvedId = lexeme.id;
          }
        }

        const { error: completeError } =
          await supabase.rpc(
            'complete_relation_resolution',
            {
              p_relation_id: row.id,
              p_target_entity_type:
                resolvedType,
              p_target_entity_id:
                resolvedId,
              p_status: resolvedId
                ? 'resolved'
                : 'candidate',
            },
          );

        if (completeError) {
          throw new Error(
            `complete_relation_resolution failed: ${safeStringify(completeError)}`,
          );
        }

        results.push({
          relation_id: row.id,
          target_text: target,
          resolved: Boolean(resolvedId),
          target_entity_type: resolvedType,
          target_entity_id: resolvedId,
          ok: true,
        });
      } catch (e) {
        results.push({
          relation_id: row.id,
          ok: false,
          error: safeStringify(e),
        });
      }
    }

    return Response.json({
      ok: true,
      processed: rows?.length ?? 0,
      results,
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: safeStringify(e),
      },
      {
        status: 500,
      },
    );
  }
});