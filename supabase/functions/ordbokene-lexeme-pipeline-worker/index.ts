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

function normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
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

async function lookupOrdbokeneArticleId(
  lemma: string,
  dictionaryCode: string,
) {
  const normalizedLemma = normalizeKey(lemma);

  const lookupUrl =
    `https://ord.uib.no/api/articles?w=${encodeURIComponent(normalizedLemma)}&dict=bm,nn&scope=e`;

  const response = await fetch(lookupUrl);
  const text = await response.text();

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Ordbokene lookup returned non-JSON response: ${text}`);
  }

  if (!response.ok) {
    throw new Error(
      `Ordbokene lookup failed with status ${response.status}: ${text}`,
    );
  }

  const articleIds = data?.articles?.[dictionaryCode];

  if (!Array.isArray(articleIds) || articleIds.length === 0) {
    throw new Error(
      `No Ordbokene article found for lemma="${normalizedLemma}", dictionary_code="${dictionaryCode}"`,
    );
  }

  return {
    article_id: Number(articleIds[0]),
    lookup_url: lookupUrl,
    raw_lookup: data,
  };
}

function compactFunctionResult(result: any) {
  const data = result?.data ?? {};

  return {
    ok: result?.ok,
    status: result?.status,
    data: {
      ok: data?.ok,
      cache_hit: data?.cache_hit,
      article_id: data?.article_id,
      dictionary_code: data?.dictionary_code,
      lemma: data?.lemma,
      word_class: data?.word_class,
      parent_article_id: data?.parent_article_id,
      parent_dictionary_code: data?.parent_dictionary_code,
      parent_lemma: data?.parent_lemma,
      parent_lexeme_id: data?.parent_lexeme_id,
      processed: data?.processed,
      found: data?.found,
      saved: data?.saved,
      skipped: data?.skipped,
      would_promote: data?.would_promote,
      promoted: data?.promoted,
      duplicates: data?.duplicates,
      high_review_priority: data?.high_review_priority,
      would_upsert: data?.would_upsert,
      upserted: data?.upserted,
      relation_type: data?.relation_type,
      source: data?.source,
      confidence: data?.confidence,
      status_value: data?.status,
      error: data?.error,
      stage: data?.stage,
      results_count: Array.isArray(data?.results) ? data.results.length : undefined,
    },
  };
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));

    const inputLemma =
      body.lemma == null ? null : normalizeKey(String(body.lemma));

    const dictionaryCode = String(body.dictionary_code ?? 'bm').trim();

    let articleId =
      body.article_id == null ? null : Number(body.article_id);

    const parentLexemeId =
      body.parent_lexeme_id == null ? null : String(body.parent_lexeme_id);

    const dryRun = Boolean(body.dry_run ?? true);
    const compact = Boolean(body.compact ?? true);

    const runResolver = Boolean(body.run_resolver ?? true);

    const maxPromotionBatches = Math.min(
      Number(body.max_promotion_batches ?? 10),
      20,
    );

    const maxResolverRuns = Math.min(
      Number(body.max_resolver_runs ?? 5),
      20,
    );

    if (!articleId && !inputLemma) {
      return jsonResponse(
        {
          ok: false,
          error: 'Provide either lemma or article_id',
          examples: [
            {
              lemma: 'komme',
              dictionary_code: 'bm',
              dry_run: true,
            },
            {
              article_id: 59502,
              dictionary_code: 'bm',
              parent_lexeme_id: 'a0d747f1-8f1d-490c-acc7-4917a0fc73ea',
              dry_run: true,
            },
          ],
        },
        400,
      );
    }

    const steps: Record<string, unknown> = {};

    if (!articleId && inputLemma) {
      const lookup = await lookupOrdbokeneArticleId(
        inputLemma,
        dictionaryCode,
      );

      articleId = lookup.article_id;

      steps.article_lookup = {
        ok: true,
        lemma: inputLemma,
        dictionary_code: dictionaryCode,
        article_id: articleId,
        lookup_url: lookup.lookup_url,
        raw_lookup: lookup.raw_lookup,
      };
    } else {
      steps.article_lookup = {
        ok: true,
        skipped: true,
        reason: 'article_id was provided directly',
        article_id: articleId,
      };
    }

    if (!articleId || Number.isNaN(articleId)) {
      return jsonResponse(
        {
          ok: false,
          error: 'Could not resolve article_id',
          lemma: inputLemma,
          dictionary_code: dictionaryCode,
        },
        400,
      );
    }

    const articleFetch = await invokeFunction('ordbokene-article-fetcher', {
      article_id: articleId,
      dictionary_code: dictionaryCode,
    });

    steps.article_fetch = compact
      ? compactFunctionResult(articleFetch)
      : articleFetch;

    if (!articleFetch.ok) {
      return jsonResponse({
        ok: false,
        failed_step: 'article_fetch',
        lemma: inputLemma,
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
        steps,
      });
    }

    const expressionExtraction = await invokeFunction(
      'ordbokene-expression-extractor',
      {
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: false,
      },
    );

    steps.expression_extraction = compact
      ? compactFunctionResult(expressionExtraction)
      : expressionExtraction;

    if (!expressionExtraction.ok) {
      return jsonResponse({
        ok: false,
        failed_step: 'expression_extraction',
        lemma: inputLemma,
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
        steps,
      });
    }

    const promotionRuns = [];

    if (dryRun) {
      const promotionDryRun = await invokeFunction(
        'ordbokene-expression-promotion-worker',
        {
          parent_article_id: articleId,
          parent_dictionary_code: dictionaryCode,
          dry_run: true,
        },
      );

      promotionRuns.push(
        compact ? compactFunctionResult(promotionDryRun) : promotionDryRun,
      );

      if (!promotionDryRun.ok) {
        return jsonResponse({
          ok: false,
          failed_step: 'expression_promotion',
          lemma: inputLemma,
          article_id: articleId,
          dictionary_code: dictionaryCode,
          dry_run: dryRun,
          steps: {
            ...steps,
            expression_promotion: promotionRuns,
          },
        });
      }
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

        promotionRuns.push(compact ? compactFunctionResult(run) : run);

        const data = run.data as {
          processed?: number;
          promoted?: number;
          duplicates?: number;
        };

        if (!run.ok) break;
        if (!data.processed || data.processed === 0) break;
        if (data.processed < 20) break;
      }

      const failedPromotion = promotionRuns.find((run: any) => !run.ok);

      if (failedPromotion) {
        steps.expression_promotion = promotionRuns;

        return jsonResponse({
          ok: false,
          failed_step: 'expression_promotion',
          lemma: inputLemma,
          article_id: articleId,
          dictionary_code: dictionaryCode,
          dry_run: dryRun,
          steps,
        });
      }
    }

    steps.expression_promotion = promotionRuns;

    const subArticlePayload: Record<string, unknown> = {
      parent_article_id: articleId,
      parent_dictionary_code: dictionaryCode,
      dry_run: dryRun,
    };

    if (parentLexemeId) {
      subArticlePayload.parent_lexeme_id = parentLexemeId;
    }

    if (inputLemma) {
      subArticlePayload.parent_lemma = inputLemma;
    }

    const hasExpressionRelations = await invokeFunction(
      'ordbokene-sub-article-relation-worker',
      subArticlePayload,
    );

    steps.has_expression_relations = compact
      ? compactFunctionResult(hasExpressionRelations)
      : hasExpressionRelations;

    if (!hasExpressionRelations.ok) {
      return jsonResponse({
        ok: false,
        failed_step: 'has_expression_relations',
        lemma: inputLemma,
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
        steps,
      });
    }

    const articleRefRelations = await invokeFunction(
      'ordbokene-article-ref-relation-worker',
      {
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
      },
    );

    steps.article_ref_relations = compact
      ? compactFunctionResult(articleRefRelations)
      : articleRefRelations;

    if (!articleRefRelations.ok) {
      return jsonResponse({
        ok: false,
        failed_step: 'article_ref_relations',
        lemma: inputLemma,
        article_id: articleId,
        dictionary_code: dictionaryCode,
        dry_run: dryRun,
        steps,
      });
    }

    const resolverRuns = [];

    if (dryRun) {
      steps.relation_resolver = {
        ok: true,
        skipped: true,
        reason:
          'relation-resolver is skipped in dry_run because it currently mutates database state and has no dry_run mode.',
      };
    } else if (runResolver) {
      for (let i = 0; i < maxResolverRuns; i += 1) {
        const resolverPayload: Record<string, unknown> = {
  dry_run: false,
  limit: 20,
};

if (inputLemma) {
  resolverPayload.source_lemma = inputLemma;
}

if (parentLexemeId) {
  resolverPayload.source_entity_id = parentLexemeId;
}

const resolverRun = await invokeFunction('relation-resolver', resolverPayload);

        resolverRuns.push(compact ? compactFunctionResult(resolverRun) : resolverRun);

        const data = resolverRun.data as {
          processed?: number;
        };

        if (!resolverRun.ok) break;
        if (!data.processed || data.processed === 0) break;
        if (data.processed < 20) break;
      }

      steps.relation_resolver = resolverRuns;

      const failedResolver = resolverRuns.find((run: any) => !run.ok);

      if (failedResolver) {
        return jsonResponse({
          ok: false,
          failed_step: 'relation_resolver',
          lemma: inputLemma,
          article_id: articleId,
          dictionary_code: dictionaryCode,
          dry_run: dryRun,
          steps,
        });
      }
    } else {
      steps.relation_resolver = {
        ok: true,
        skipped: true,
        reason: 'run_resolver=false',
      };
    }

    return jsonResponse({
      ok: true,
      pipeline: 'ordbokene_lexeme_pipeline_v3',
      lemma: inputLemma,
      article_id: articleId,
      dictionary_code: dictionaryCode,
      parent_lexeme_id: parentLexemeId,
      dry_run: dryRun,
      compact,
      run_resolver: runResolver,
      steps,
      note:
        'v3 accepts lemma, resolves Ordbokene article_id automatically, runs Ordbokene enrichment, and runs relation-resolver on real runs. Lexical verification is still not included.',
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