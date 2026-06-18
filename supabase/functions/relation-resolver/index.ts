import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function normalize(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
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

async function resolveSourceLexemeId(sourceLemma: string) {
  const { data, error } = await supabase
    .from('lexemes')
    .select('id, lemma')
    .eq('lemma', normalize(sourceLemma))
    .maybeSingle();

  if (error) {
    throw new Error(`resolveSourceLexemeId failed: ${safeStringify(error)}`);
  }

  return data?.id ?? null;
}

async function resolveExpression(target: string) {
  const { data, error } = await supabase
    .from('expression_catalog')
    .select('id, lemma, display_form, normalized_key')
    .eq('normalized_key', target)
    .maybeSingle();

  if (error) {
    throw new Error(`resolveExpression failed: ${safeStringify(error)}`);
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
    throw new Error(`resolveLexeme failed: ${safeStringify(error)}`);
  }

  return data;
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));

    const dryRun = Boolean(body.dry_run ?? false);
    const limit = Math.min(Number(body.limit ?? 20), 100);

    const sourceEntityIdInput =
      body.source_entity_id == null ? null : String(body.source_entity_id);

    const sourceLemmaInput =
      body.source_lemma == null ? null : normalize(String(body.source_lemma));

    let sourceEntityId = sourceEntityIdInput;

    if (!sourceEntityId && sourceLemmaInput) {
      sourceEntityId = await resolveSourceLexemeId(sourceLemmaInput);
    }

    let query = supabase
      .from('authoritative_semantic_relations')
      .select(
        [
          'id',
          'source_entity_type',
          'source_entity_id',
          'relation_type',
          'target_text',
          'target_entity_type',
          'target_entity_id',
          'source',
          'status',
          'updated_at',
        ].join(', '),
      )
      .is('target_entity_id', null)
      .not('target_text', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (sourceEntityId) {
      query = query.eq('source_entity_id', sourceEntityId);
    }

    if (body.relation_type != null) {
      query = query.eq('relation_type', String(body.relation_type));
    }

    const { data: rows, error } = await query;

    if (error) {
      throw new Error(`load relation candidates failed: ${safeStringify(error)}`);
    }

    const results = [];

    for (const row of rows ?? []) {
      try {
        const target = normalize(row.target_text);

        let resolvedType: 'lexeme' | 'expression' | null = null;
        let resolvedId: string | null = null;

        const expression = await resolveExpression(target);

        if (expression?.id) {
          resolvedType = 'expression';
          resolvedId = expression.id;
        }

        if (!resolvedId) {
          const lexeme = await resolveLexeme(target);

          if (lexeme?.id) {
            resolvedType = 'lexeme';
            resolvedId = lexeme.id;
          }
        }

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('authoritative_semantic_relations')
            .update({
              target_entity_type: resolvedType,
              target_entity_id: resolvedId,
              status: resolvedId ? 'resolved' : 'candidate',
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);

          if (updateError) {
            throw new Error(
              `update relation failed: ${safeStringify(updateError)}`,
            );
          }
        }

        results.push({
          relation_id: row.id,
          source_entity_id: row.source_entity_id,
          relation_type: row.relation_type,
          target_text: target,
          resolved: Boolean(resolvedId),
          target_entity_type: resolvedType,
          target_entity_id: resolvedId,
          action: dryRun
            ? resolvedId
              ? 'would_resolve'
              : 'would_keep_candidate'
            : resolvedId
              ? 'resolved'
              : 'kept_candidate',
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

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      scoped: Boolean(sourceEntityId),
      source_entity_id: sourceEntityId,
      source_lemma: sourceLemmaInput,
      processed: rows?.length ?? 0,
      resolved: results.filter((r) => r.resolved).length,
      unresolved: results.filter((r) => r.ok && !r.resolved).length,
      results,
    });
  } catch (e) {
    return jsonResponse(
      {
        ok: false,
        error: safeStringify(e),
      },
      500,
    );
  }
});