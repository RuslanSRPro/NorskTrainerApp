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

function tokenCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function firstExample(examples: unknown): string | null {
  if (!Array.isArray(examples)) return null;

  const first = examples.find(
    (item) => typeof item === 'string' && item.trim(),
  );

  return typeof first === 'string' ? first.trim() : null;
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 20), 100);
    const dryRun = Boolean(body.dry_run ?? true);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { ok: false, error: 'Missing Supabase env vars' },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: candidates, error: candidateError } = await supabase
      .from('ordbokene_expression_candidates')
      .select(
        [
          'id',
          'lemma',
          'normalized_key',
          'definition_preview',
          'examples',
          'candidate_article_id',
          'candidate_dictionary_code',
          'candidate_kind',
          'status',
          'promoted_expression_id',
        ].join(', '),
      )
      .eq('status', 'candidate')
      .eq('candidate_kind', 'expression')
      .is('promoted_expression_id', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (candidateError) {
      return jsonResponse(
        {
          ok: false,
          stage: 'load_candidates',
          error: candidateError.message,
          details: candidateError,
        },
        500,
      );
    }

    const results = [];

    for (const candidate of candidates ?? []) {
      const normalizedKey = normalizeKey(
        candidate.normalized_key ?? candidate.lemma,
      );

      const tokens = tokenCount(candidate.lemma);

      const reviewPriority = tokens <= 2 ? 'high' : 'normal';

      const reviewReason =
        tokens <= 2
          ? 'Short phrasal expression: valuable but higher duplicate/ambiguity risk'
          : null;

      const { data: existingExpression, error: existingError } = await supabase
        .from('expression_catalog')
        .select('id, normalized_key')
        .eq('normalized_key', normalizedKey)
        .maybeSingle();

      if (existingError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'check_existing_expression',
            normalized_key: normalizedKey,
            error: existingError.message,
            details: existingError,
          },
          500,
        );
      }

      if (existingExpression) {
        if (!dryRun) {
          const { error: duplicateUpdateError } = await supabase
            .from('ordbokene_expression_candidates')
            .update({
              status: 'duplicate',
              promoted_expression_id: existingExpression.id,
              review_priority: reviewPriority,
              review_reason: reviewReason,
              review_note:
                'Promotion skipped: matched existing expression_catalog.normalized_key',
              updated_at: new Date().toISOString(),
            })
            .eq('id', candidate.id);

          if (duplicateUpdateError) {
            return jsonResponse(
              {
                ok: false,
                stage: 'mark_duplicate',
                candidate_id: candidate.id,
                error: duplicateUpdateError.message,
                details: duplicateUpdateError,
              },
              500,
            );
          }
        }

        results.push({
          candidate_id: candidate.id,
          lemma: candidate.lemma,
          normalized_key: normalizedKey,
          token_count: tokens,
          review_priority: reviewPriority,
          review_reason: reviewReason,
          action: dryRun ? 'would_mark_duplicate' : 'marked_duplicate',
          expression_id: existingExpression.id,
        });

        continue;
      }

      const sourceUrl =
        `https://ord.uib.no/${candidate.candidate_dictionary_code}/article/${candidate.candidate_article_id}.json`;

      if (dryRun) {
        results.push({
          candidate_id: candidate.id,
          lemma: candidate.lemma,
          normalized_key: normalizedKey,
          token_count: tokens,
          review_priority: reviewPriority,
          review_reason: reviewReason,
          action: 'would_promote',
          source_url: sourceUrl,
        });

        continue;
      }

      const { data: insertedExpression, error: insertError } = await supabase
        .from('expression_catalog')
        .insert({
          lemma: candidate.lemma,
          display_form: candidate.lemma,
          normalized_key: normalizedKey,
          language: 'no',
          pos: 'expression',
          expression_subtype: 'ordbokene_sub_article',

          example: firstExample(candidate.examples),
          notes_ua: candidate.definition_preview,

          source_ordbokene: true,
          source_manual: false,
          source_gemini: false,
          source_naob: false,
          source_wiktionary: false,

          source_urls: [sourceUrl],

          raw_sources: {
            source: 'Ordbokene',
            source_type: 'sub_article',
            article_id: candidate.candidate_article_id,
            dictionary_code: candidate.candidate_dictionary_code,
            definition_preview: candidate.definition_preview,
            examples: candidate.examples ?? [],
            token_count: tokens,
            review_priority: reviewPriority,
            review_reason: reviewReason,
          },

          verification: 'needs_review',
          confidence: 'medium',
          verification_status: 'candidate',
          verification_tier: 'candidate',

          verification_evidence: {
            source: 'Ordbokene',
            evidence_type: 'sub_article',
            article_id: candidate.candidate_article_id,
            dictionary_code: candidate.candidate_dictionary_code,
            source_url: sourceUrl,
            token_count: tokens,
            review_priority: reviewPriority,
            review_reason: reviewReason,
          },

          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'insert_expression_catalog',
            candidate_id: candidate.id,
            lemma: candidate.lemma,
            normalized_key: normalizedKey,
            error: insertError.message,
            details: insertError,
          },
          500,
        );
      }

      const { error: updateError } = await supabase
        .from('ordbokene_expression_candidates')
        .update({
          status: 'promoted',
          promoted_expression_id: insertedExpression.id,
          promoted_at: new Date().toISOString(),
          review_priority: reviewPriority,
          review_reason: reviewReason,
          review_note:
            reviewReason ??
            'Promoted to expression_catalog from Ordbokene sub_article',
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id);

      if (updateError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'update_candidate_promoted',
            candidate_id: candidate.id,
            expression_id: insertedExpression.id,
            error: updateError.message,
            details: updateError,
          },
          500,
        );
      }

      results.push({
        candidate_id: candidate.id,
        lemma: candidate.lemma,
        normalized_key: normalizedKey,
        token_count: tokens,
        review_priority: reviewPriority,
        review_reason: reviewReason,
        action: 'promoted',
        expression_id: insertedExpression.id,
      });
    }

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      processed: candidates?.length ?? 0,
      would_promote: results.filter((r) => r.action === 'would_promote').length,
      promoted: results.filter((r) => r.action === 'promoted').length,
      duplicates: results.filter(
        (r) =>
          r.action === 'would_mark_duplicate' ||
          r.action === 'marked_duplicate',
      ).length,
      high_review_priority: results.filter(
        (r) => r.review_priority === 'high',
      ).length,
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