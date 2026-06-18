import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));

    const parentArticleId =
      body.parent_article_id == null ? null : Number(body.parent_article_id);

    const parentDictionaryCode = String(
      body.parent_dictionary_code ?? body.dictionary_code ?? 'bm',
    ).trim();

    const parentLexemeId =
      body.parent_lexeme_id == null ? null : String(body.parent_lexeme_id);

    const parentLemmaInput =
      body.parent_lemma == null ? null : normalizeKey(String(body.parent_lemma));

    const limit = Math.min(Number(body.limit ?? 100), 500);
    const dryRun = Boolean(body.dry_run ?? true);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { ok: false, error: 'Missing Supabase env vars' },
        500,
      );
    }

    if (!parentArticleId && !parentLemmaInput && !parentLexemeId) {
      return jsonResponse(
        {
          ok: false,
          error:
            'Provide parent_article_id, parent_lemma, or parent_lexeme_id. Do not rely on default lemma.',
        },
        400,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let parentLexemeQuery = supabase
      .from('lexemes')
      .select('id, lemma, pos')
      .limit(1);

    if (parentLexemeId) {
      parentLexemeQuery = parentLexemeQuery.eq('id', parentLexemeId);
    } else if (parentLemmaInput) {
      parentLexemeQuery = parentLexemeQuery.eq('lemma', parentLemmaInput);
    } else if (parentArticleId) {
      const { data: cacheRow, error: cacheError } = await supabase
        .from('ordbokene_article_cache')
        .select('lemma')
        .eq('article_id', parentArticleId)
        .eq('dictionary_code', parentDictionaryCode)
        .maybeSingle();

      if (cacheError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'load_article_cache',
            parent_article_id: parentArticleId,
            parent_dictionary_code: parentDictionaryCode,
            error: cacheError.message,
            details: cacheError,
          },
          500,
        );
      }

      if (!cacheRow?.lemma) {
        return jsonResponse(
          {
            ok: false,
            stage: 'load_article_cache',
            error:
              'Could not infer parent lemma from ordbokene_article_cache. Provide parent_lemma or parent_lexeme_id.',
            parent_article_id: parentArticleId,
            parent_dictionary_code: parentDictionaryCode,
          },
          404,
        );
      }

      parentLexemeQuery = parentLexemeQuery.eq(
        'lemma',
        normalizeKey(String(cacheRow.lemma)),
      );
    }

    const { data: parentLexemes, error: parentError } =
      await parentLexemeQuery;

    if (parentError) {
      return jsonResponse(
        {
          ok: false,
          stage: 'load_parent_lexeme',
          error: parentError.message,
          details: parentError,
        },
        500,
      );
    }

    const parentLexeme = parentLexemes?.[0] ?? null;

    if (!parentLexeme) {
      return jsonResponse(
        {
          ok: false,
          stage: 'load_parent_lexeme',
          error: 'Parent lexeme not found',
          parent_article_id: parentArticleId,
          parent_dictionary_code: parentDictionaryCode,
          parent_lemma: parentLemmaInput,
          parent_lexeme_id: parentLexemeId,
        },
        404,
      );
    }

    let candidateQuery = supabase
      .from('ordbokene_expression_candidates')
      .select(
        [
          'id',
          'parent_lemma',
          'parent_article_id',
          'parent_dictionary_code',
          'lemma',
          'normalized_key',
          'candidate_article_id',
          'candidate_dictionary_code',
          'status',
          'promoted_expression_id',
          'candidate_kind',
          'review_priority',
          'review_reason',
          'created_at',
        ].join(', '),
      )
      .in('status', ['promoted', 'duplicate'])
      .not('promoted_expression_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (parentArticleId) {
      candidateQuery = candidateQuery.eq('parent_article_id', parentArticleId);
    }

    if (parentDictionaryCode) {
      candidateQuery = candidateQuery.eq(
        'parent_dictionary_code',
        parentDictionaryCode,
      );
    }

    if (!parentArticleId && parentLexeme.lemma) {
      candidateQuery = candidateQuery.eq(
        'parent_lemma',
        normalizeKey(String(parentLexeme.lemma)),
      );
    }

    const { data: candidates, error: candidateError } = await candidateQuery;

    if (candidateError) {
      return jsonResponse(
        {
          ok: false,
          stage: 'load_candidates',
          parent_article_id: parentArticleId,
          parent_dictionary_code: parentDictionaryCode,
          parent_lemma: parentLexeme.lemma,
          error: candidateError.message,
          details: candidateError,
        },
        500,
      );
    }

    const results = [];

    for (const candidate of candidates ?? []) {
      const targetText = normalizeKey(
        candidate.normalized_key ?? candidate.lemma,
      );

      const sourceUrl =
        `https://ord.uib.no/${candidate.candidate_dictionary_code}/article/${candidate.candidate_article_id}.json`;

      const relationPayload = {
        source_entity_type: 'lexeme',
        source_entity_id: parentLexeme.id,
        relation_type: 'has_expression',
        target_text: targetText,
        target_entity_type: 'expression',
        target_entity_id: candidate.promoted_expression_id,
        source: 'Ordbokene',
        confidence: 'high',
        status: 'candidate',
        evidence: {
          source: 'Ordbokene',
          evidence_type: 'sub_article',
          parent_lemma: candidate.parent_lemma,
          parent_article_id: candidate.parent_article_id,
          parent_dictionary_code: candidate.parent_dictionary_code,
          candidate_lemma: candidate.lemma,
          candidate_article_id: candidate.candidate_article_id,
          candidate_dictionary_code: candidate.candidate_dictionary_code,
          candidate_kind: candidate.candidate_kind,
          review_priority: candidate.review_priority,
          review_reason: candidate.review_reason,
        },
        urls: [sourceUrl],
        updated_at: new Date().toISOString(),
      };

      if (dryRun) {
        results.push({
          candidate_id: candidate.id,
          target_text: targetText,
          target_expression_id: candidate.promoted_expression_id,
          action: 'would_upsert_relation',
          relation_type: relationPayload.relation_type,
        });
        continue;
      }

      const { data: insertedRelation, error: upsertError } = await supabase
        .from('authoritative_semantic_relations')
        .upsert(relationPayload, {
          onConflict:
            'source_entity_type,source_entity_id,relation_type,target_text,source',
        })
        .select('id')
        .single();

      if (upsertError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'upsert_relation',
            candidate_id: candidate.id,
            target_text: targetText,
            error: upsertError.message,
            details: upsertError,
          },
          500,
        );
      }

      results.push({
        candidate_id: candidate.id,
        target_text: targetText,
        target_expression_id: candidate.promoted_expression_id,
        relation_id: insertedRelation.id,
        action: 'upserted_relation',
        relation_type: relationPayload.relation_type,
      });
    }

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      parent_article_id: parentArticleId,
      parent_dictionary_code: parentDictionaryCode,
      parent_lemma: parentLexeme.lemma,
      parent_lexeme_id: parentLexeme.id,
      processed: candidates?.length ?? 0,
      would_upsert: results.filter(
        (r) => r.action === 'would_upsert_relation',
      ).length,
      upserted: results.filter((r) => r.action === 'upserted_relation').length,
      results,
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        stage: 'unhandled_exception',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
      },
      500,
    );
  }
});