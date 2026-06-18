import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body.limit ?? 50), 200);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        {
          ok: false,
          error: 'Missing Supabase env vars',
        },
        500,
      );
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const { data: candidates, error: candidateError } =
      await supabase
        .from('ordbokene_expression_candidates')
        .select('id, normalized_key, lemma')
        .eq('status', 'candidate')
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
        String(candidate.normalized_key ?? ''),
      );

      if (!normalizedKey) {
        results.push({
          candidate_id: candidate.id,
          ok: false,
          status: 'skipped',
          reason: 'missing normalized_key',
        });
        continue;
      }

      const {
        data: existingExpression,
        error: expressionError,
      } = await supabase
        .from('expression_catalog')
        .select('id, normalized_key')
        .eq('normalized_key', normalizedKey)
        .maybeSingle();

      if (expressionError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'lookup_expression_catalog',
            normalized_key: normalizedKey,
            error: expressionError.message,
            details: expressionError,
          },
          500,
        );
      }

      if (!existingExpression) {
        results.push({
          candidate_id: candidate.id,
          lemma: candidate.lemma,
          normalized_key: normalizedKey,
          status: 'candidate',
          matched: false,
          action: 'waiting_review',
        });
        continue;
      }

      const { error: updateError } = await supabase
        .from('ordbokene_expression_candidates')
        .update({
          status: 'duplicate',
          promoted_expression_id: existingExpression.id,
          review_note:
            'Matched existing expression_catalog.normalized_key',
          updated_at: new Date().toISOString(),
        })
        .eq('id', candidate.id);

      if (updateError) {
        return jsonResponse(
          {
            ok: false,
            stage: 'update_candidate_duplicate',
            candidate_id: candidate.id,
            normalized_key: normalizedKey,
            expression_id: existingExpression.id,
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
        status: 'duplicate',
        matched: true,
        expression_id: existingExpression.id,
      });
    }

    return jsonResponse({
      ok: true,
      processed: candidates?.length ?? 0,
      matched_duplicates: results.filter((r) => r.matched === true).length,
      new_candidates_waiting_review: results.filter(
        (r) => r.action === 'waiting_review',
      ).length,
      skipped: results.filter((r) => r.status === 'skipped').length,
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