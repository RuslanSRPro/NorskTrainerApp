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

async function getSupabaseClient() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
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

async function getArticleCacheRow(articleId: number, dictionaryCode: string) {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('ordbokene_article_cache')
    .select('article_id, dictionary_code, lemma, word_class, payload')
    .eq('article_id', articleId)
    .eq('dictionary_code', dictionaryCode)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getParentLexemeIdByLemma(lemma: string | null) {
  if (!lemma) return null;

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('lexemes')
    .select('id, lemma, pos')
    .eq('lemma', normalizeKey(lemma))
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

function classifyExpressionSubtype(lemma: string): string {
  const normalized = normalizeKey(lemma);
  const parts = normalized.split(' ');

  if (parts.length === 1) return 'fixed_expression';

  if (/\bseg\b/.test(normalized)) {
    return 'reflexive_particle_verb';
  }

  const first = parts[0];
  const last = parts[parts.length - 1];

  const particles = new Set([
    'av',
    'på',
    'opp',
    'ut',
    'inn',
    'over',
    'under',
    'til',
    'fra',
    'med',
    'imot',
    'igjen',
    'fram',
    'frem',
    'ned',
    'bort',
  ]);

  const prepositions = new Set([
    'av',
    'på',
    'i',
    'til',
    'for',
    'fra',
    'med',
    'mot',
    'om',
    'over',
    'under',
    'etter',
    'gjennom',
  ]);

  const commonVerbs = new Set([
    'ta',
    'gå',
    'komme',
    'få',
    'bli',
    'sette',
    'stå',
    'ha',
    'gi',
    'holde',
    'legge',
    'slå',
    'trekke',
    'se',
    'si',
    'gjøre',
  ]);

  if (
    parts.length >= 3 &&
    commonVerbs.has(first) &&
    (particles.has(last) || prepositions.has(last))
  ) {
    return 'support_verb_construction';
  }

  if (parts.length === 2 && commonVerbs.has(first) && particles.has(last)) {
    return 'particle_verb';
  }

  if (parts.length === 2 && commonVerbs.has(first) && prepositions.has(last)) {
    return 'prepositional_verb';
  }

  return 'fixed_expression';
}

async function promoteStandaloneExpression(args: {
  articleId: number;
  dictionaryCode: string;
  lemma: string;
  dryRun: boolean;
}) {
  const supabase = await getSupabaseClient();

  const normalized = normalizeKey(args.lemma);
  const sourceUrl =
    `https://ord.uib.no/${args.dictionaryCode}/article/${args.articleId}.json`;

  const payload = {
    lemma: normalized,
    display_form: args.lemma,
    normalized_key: normalized,
    language: args.dictionaryCode === 'nn' ? 'nn' : 'nb',
    pos: 'expression',
    expression_subtype: classifyExpressionSubtype(normalized),
    source_ordbokene: true,
    source_urls: [sourceUrl],
    raw_sources: {
      Ordbokene: {
        article_id: args.articleId,
        dictionary_code: args.dictionaryCode,
        url: sourceUrl,
        ingestion_mode: 'standalone_expression',
      },
    },
    verification: 'source_verified',
    confidence: 'high',
    source_verified: 'Ordbokene',
    verification_status: 'source_verified',
    linguistic_evidence: 'Ordbokene standalone expression article',
    verification_tier: 'authoritative',
    verification_evidence: {
      source: 'Ordbokene',
      article_id: args.articleId,
      dictionary_code: args.dictionaryCode,
      evidence_type: 'standalone_expression_article',
    },
    updated_at: new Date().toISOString(),
  };

  if (args.dryRun) {
    return {
      ok: true,
      dry_run: true,
      would_upsert: 1,
      expression: payload,
    };
  }

  const { data, error } = await supabase
    .from('expression_catalog')
    .upsert(payload, {
      onConflict: 'normalized_key',
    })
    .select('id, lemma, normalized_key, expression_subtype')
    .single();

  if (error) throw error;

  return {
    ok: true,
    dry_run: false,
    upserted: 1,
    expression: data,
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

    const articleCacheRow = await getArticleCacheRow(articleId, dictionaryCode);

    const cacheLemma =
      typeof articleCacheRow?.lemma === 'string'
        ? normalizeKey(articleCacheRow.lemma)
        : inputLemma;

    const parentLexemeIdFromCache = await getParentLexemeIdByLemma(cacheLemma);

    const entityMode =
      body.entity_mode != null
        ? String(body.entity_mode)
        : parentLexemeIdFromCache
          ? 'lexeme'
          : 'expression';

    steps.entity_detection = {
      ok: true,
      entity_mode: entityMode,
      cache_lemma: cacheLemma,
      parent_lexeme_id: parentLexemeIdFromCache,
      word_class: articleCacheRow?.word_class ?? null,
    };

    if (entityMode === 'expression') {
      const standaloneExpression = await promoteStandaloneExpression({
        articleId,
        dictionaryCode,
        lemma: cacheLemma ?? inputLemma ?? '',
        dryRun,
      });

      steps.standalone_expression_promotion = standaloneExpression;

      steps.expression_extraction = {
        ok: true,
        skipped: true,
        reason: 'Standalone expression article does not act as parent lexeme.',
      };

      steps.expression_promotion = {
        ok: true,
        skipped: true,
        reason: 'Standalone expression was promoted directly.',
      };

      steps.has_expression_relations = {
        ok: true,
        skipped: true,
        reason: 'Standalone expression has no parent lexeme has_expression relation.',
      };

      steps.article_ref_relations = {
        ok: true,
        skipped: true,
        reason:
          'Article ref worker currently requires parent lexeme. Expression-level article refs will be handled by expression pipeline v2.',
      };

      steps.relation_resolver = {
        ok: true,
        skipped: true,
        reason: 'No lexeme-scoped relations created for standalone expression.',
      };

      return jsonResponse({
        ok: true,
        pipeline: 'ordbokene_lexeme_pipeline_v4',
        lemma: inputLemma,
        article_id: articleId,
        dictionary_code: dictionaryCode,
        entity_mode: entityMode,
        dry_run: dryRun,
        compact,
        steps,
        note:
          'v4 supports standalone expression articles by promoting them directly to expression_catalog.',
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

    if (parentLexemeId || parentLexemeIdFromCache) {
      subArticlePayload.parent_lexeme_id =
        parentLexemeId ?? parentLexemeIdFromCache;
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
          'relation-resolver is skipped in dry_run because it currently mutates database state.',
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

        if (parentLexemeId || parentLexemeIdFromCache) {
          resolverPayload.source_entity_id =
            parentLexemeId ?? parentLexemeIdFromCache;
        }

        const resolverRun = await invokeFunction(
          'relation-resolver',
          resolverPayload,
        );

        resolverRuns.push(
          compact ? compactFunctionResult(resolverRun) : resolverRun,
        );

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
      pipeline: 'ordbokene_lexeme_pipeline_v4',
      lemma: inputLemma,
      article_id: articleId,
      dictionary_code: dictionaryCode,
      entity_mode: entityMode,
      parent_lexeme_id: parentLexemeId ?? parentLexemeIdFromCache,
      dry_run: dryRun,
      compact,
      run_resolver: runResolver,
      steps,
      note:
        'v4 supports lexeme mode and standalone expression mode. Lexical verification is still not included.',
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