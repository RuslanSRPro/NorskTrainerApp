import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

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

async function invokeFunction(
  functionName: string,
  payload: Record<string, unknown>,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));

    const articleId = Number(body.article_id);
    const dictionaryCode = String(body.dictionary_code ?? 'bm');
    const parentLexemeId =
      body.parent_lexeme_id == null ? null : String(body.parent_lexeme_id);
    const dryRun = Boolean(body.dry_run ?? true);

    const maxPromotionBatches = Math.min(
      Number(body.max_promotion_batches ?? 10),
      20,
    );

    if (!articleId || Number.isNaN(articleId)) {
      return jsonResponse(
        {
          ok: false,
          error: 'article_id is required',
        },
        400,
      );
    }

    const steps: Record<string, unknown> = {};

    steps.article_fetch = await invokeFunction('ordbokene-article-fetcher', {
      article_id: articleId,
      dictionary_code: dictionaryCode,
    });

    const articleFetch = steps.article_fetch as { ok: boolean };
    if (!articleFetch.ok) {
      return jsonResponse({
        ok: false,
        failed_step: 'article_fetch',
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
        steps,
      });
    }

    steps.expression_extraction = await invokeFunction(
      'ordbokene-expression-extractor',
      {
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: false,
      },
    );

    const extraction = steps.expression_extraction as { ok: boolean };
    if (!extraction.ok) {
      return jsonResponse({
        ok: false,
        failed_step: 'expression_extraction',
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
        steps,
      });
    }

    const promotionRuns = [];

    if (dryRun) {
      promotionRuns.push(
        await invokeFunction('ordbokene-expression-promotion-worker', {
          parent_article_id: articleId,
          parent_dictionary_code: dictionaryCode,
          dry_run: true,
        }),
      );
    } else {
      for (let i = 0; i < maxPromotionBatches; i += 1) {
        const run = await invokeFunction(
          'ordbokene-expression-promotion-worker',
          {
            parent_article_id: articleId,
            parent_dictionary_code: dictionaryCode,
            dry_run: false,
          },
        );

        promotionRuns.push(run);

        const data = run.data as {
          processed?: number;
          promoted?: number;
          duplicates?: number;
        };

        if (!run.ok) break;
        if (!data.processed || data.processed === 0) break;
        if (data.processed < 20) break;
      }
    }

    steps.expression_promotion = promotionRuns;

    const failedPromotion = promotionRuns.find((run) => !run.ok);
    if (failedPromotion) {
      return jsonResponse({
        ok: false,
        failed_step: 'expression_promotion',
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
        steps,
      });
    }

    const subArticlePayload: Record<string, unknown> = {
      parent_article_id: articleId,
      parent_dictionary_code: dictionaryCode,
      dry_run: dryRun,
    };

    if (parentLexemeId) {
      subArticlePayload.parent_lexeme_id = parentLexemeId;
    }

    steps.has_expression_relations = await invokeFunction(
      'ordbokene-sub-article-relation-worker',
      subArticlePayload,
    );

    const hasExpression = steps.has_expression_relations as { ok: boolean };
    if (!hasExpression.ok) {
      return jsonResponse({
        ok: false,
        failed_step: 'has_expression_relations',
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
        steps,
      });
    }

    steps.article_ref_relations = await invokeFunction(
      'ordbokene-article-ref-relation-worker',
      {
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
      },
    );

    const articleRef = steps.article_ref_relations as { ok: boolean };
    if (!articleRef.ok) {
      return jsonResponse({
        ok: false,
        failed_step: 'article_ref_relations',
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
        steps,
      });
    }

    return jsonResponse({
      ok: true,
      pipeline: 'ordbokene_lexeme_pipeline_v1',
      article_id: articleId,
      dictionary_code: dictionaryCode,
      parent_lexeme_id: parentLexemeId,
      dry_run: dryRun,
      steps,
      note:
        'This orchestrator runs Ordbokene enrichment only. Lexical verification is not included in v1.',
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