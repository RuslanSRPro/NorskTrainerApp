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

function tokenCount(value: string): number {
  return normalizeKey(value).split(' ').filter(Boolean).length;
}

// ФИКС: единая функция для превращения ошибки Supabase/Postgrest (сырой
// объект {message, details, hint, code}, НЕ экземпляр Error) в читаемое
// сообщение. Раньше `throw error` (без обёртки в new Error) приводило к
// тому, что catch-блок в конце файла делал String(err) на объекте — что
// даёт буквально "[object Object]" вместо реального текста ошибки.
// Диагностировано на job'ах, падавших на лемме "møte" — реальная причина
// (несколько строк в lexemes) была полностью замаскирована этим багом.
function toReadableError(err: any, context: string): Error {
  if (err instanceof Error) return err;

  const message = err?.message ?? 'unknown error';
  const code = err?.code ? ` (code: ${err.code})` : '';
  const details = err?.details ? ` — ${err.details}` : '';

  return new Error(`${context}: ${message}${code}${details}`);
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
    return {
      found: false,
      article_id: null,
      lookup_url: lookupUrl,
      raw_lookup: data,
    };
  }

  return {
    found: true,
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

  // ФИКС: throw error -> throw toReadableError(...) — см. комментарий у
  // определения toReadableError выше. article_id+dictionary_code — реальный
  // composite unique key в этой таблице (в отличие от lexemes.lemma), так
  // что .maybeSingle() здесь корректна и не должна падать на нормальных
  // данных; но если когда-нибудь появится дубль — ошибка теперь хотя бы
  // будет читаемой, а не "[object Object]".
  if (error) throw toReadableError(error, `getArticleCacheRow(${articleId}, ${dictionaryCode})`);
  return data;
}

// ФИКС: было .maybeSingle(), которая БРОСАЕТ ошибку при >1 строке.
// Норвежский язык имеет законную омонимию по части речи — например "møte"
// существует как ДВЕ отдельные записи в lexemes: глагол ("встречать") и
// существительное ("встреча"), обе полностью верифицированы. Это не
// дубликат/ошибка данных, а нормальная лингвистическая ситуация — код
// просто не был готов к ней. Диагностировано: job'ы падали с
// "unhandled_exception" / "[object Object]" на лемме "møte".
//
// Теперь функция явно обрабатывает 0/1/N совпадений и никогда не бросает
// исключение из-за неоднозначности — при N>1 возвращает parentLexemeId:
// null и ambiguous: true, чтобы вызывающий код мог решить, что делать,
// вместо падения всего pipeline.
async function getParentLexemeIdByLemma(lemma: string | null): Promise<{
  parentLexemeId: string | null;
  ambiguous: boolean;
  candidateCount: number;
}> {
  if (!lemma) return { parentLexemeId: null, ambiguous: false, candidateCount: 0 };

  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from('lexemes')
    .select('id, lemma, pos')
    .eq('lemma', normalizeKey(lemma));

  if (error) {
    throw toReadableError(error, `getParentLexemeIdByLemma("${lemma}")`);
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return { parentLexemeId: null, ambiguous: false, candidateCount: 0 };
  }

  if (rows.length === 1) {
    return { parentLexemeId: rows[0].id, ambiguous: false, candidateCount: 1 };
  }

  // Несколько lexemes с одинаковой леммой (омонимия по части речи) — не
  // выбираем "наугад" первую попавшуюся, это могло бы привязать
  // standalone-выражение не к тому значению слова.
  return { parentLexemeId: null, ambiguous: true, candidateCount: rows.length };
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
    'av', 'på', 'opp', 'ut', 'inn', 'over', 'under', 'til', 'fra', 'med',
    'imot', 'igjen', 'fram', 'frem', 'ned', 'bort',
  ]);

  const prepositions = new Set([
    'av', 'på', 'i', 'til', 'for', 'fra', 'med', 'mot', 'om', 'over',
    'under', 'etter', 'gjennom',
  ]);

  const commonVerbs = new Set([
    'ta', 'gå', 'komme', 'få', 'bli', 'sette', 'stå', 'ha', 'gi', 'holde',
    'legge', 'slå', 'trekke', 'se', 'si', 'gjøre',
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

  const { data: existing, error: existingError } = await supabase
    .from('expression_catalog')
    .select('id, normalized_key, verification_tier')
    .eq('normalized_key', normalized)
    .maybeSingle();

  // ФИКС: throw error -> throw toReadableError(...)
  if (existingError) throw toReadableError(existingError, `promoteStandaloneExpression: checking existing row for "${normalized}"`);

  if (existing) {
    return {
      ok: true,
      dry_run: args.dryRun,
      skipped: true,
      reason:
        'expression_catalog row already exists for this normalized_key; not overwritten.',
      existing_expression_id: existing.id,
      existing_verification_tier: existing.verification_tier,
    };
  }

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
    ordbokene_status: 'expr_entry',
    verification: 'needs_review',
    confidence: 'medium',
    source_verified: 'Ordbokene',
    verification_status: 'candidate',
    linguistic_evidence: 'Ordbokene standalone expression article',
    verification_tier: 'candidate',
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
    .insert(payload)
    .select('id, lemma, normalized_key, expression_subtype')
    .single();

  // ФИКС: throw error -> throw toReadableError(...)
  if (error) throw toReadableError(error, `promoteStandaloneExpression: inserting "${normalized}"`);

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

      steps.article_lookup = {
        ok: true,
        lemma: inputLemma,
        dictionary_code: dictionaryCode,
        found: lookup.found,
        article_id: lookup.article_id,
        lookup_url: lookup.lookup_url,
        raw_lookup: lookup.raw_lookup,
      };

      if (!lookup.found) {
        return jsonResponse({
          ok: true,
          pipeline: 'ordbokene_lexeme_pipeline_v4',
          lemma: inputLemma,
          article_id: null,
          dictionary_code: dictionaryCode,
          entity_mode: body.item_type === 'expression' ? 'expression' : 'unknown',
          ordbokene_status: 'not_listed',
          diagnostic_status: 'article_not_found',
          confidence: 1,
          dry_run: dryRun,
          compact,
          run_resolver: runResolver,
          steps,
          note:
            'No Ordbokene article found. This is valid negative source evidence, not a technical error.',
        });
      }

      articleId = lookup.article_id;
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

    // ФИКС: getParentLexemeIdByLemma теперь возвращает объект
    // {parentLexemeId, ambiguous, candidateCount} вместо голого
    // string|null, и никогда не бросает исключение из-за омонимии.
    const parentLookup = await getParentLexemeIdByLemma(cacheLemma);
    const parentLexemeIdFromCache = parentLookup.parentLexemeId;

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
      // ФИКС: новые диагностические поля — видно в логах/ответе, если для
      // леммы нашлось несколько lexemes (омонимия), вместо тихого выбора
      // "первой попавшейся" или падения всего pipeline.
      parent_lexeme_ambiguous: parentLookup.ambiguous,
      parent_lexeme_candidate_count: parentLookup.candidateCount,
      word_class: articleCacheRow?.word_class ?? null,
    };

    if (entityMode === 'expression') {
      const candidateLemma = cacheLemma ?? inputLemma ?? '';
      const candidateTokenCount = tokenCount(candidateLemma);

      if (candidateTokenCount <= 1) {
        steps.standalone_expression_promotion = {
          ok: true,
          skipped: true,
          reason: parentLookup.ambiguous
            ? `Single-token lemma matches ${parentLookup.candidateCount} lexemes (homonyms by part of speech) — this pipeline cannot disambiguate which one to link without part-of-speech data from the article. Not treated as a standalone expression; also not linked to any single lexeme.`
            : 'Single-token lemma with no existing parent lexeme is not a standalone expression — it is an unverified lexeme. This pipeline does not create lexeme rows; verification path A must process it first.',
        };

        steps.expression_extraction = {
          ok: true,
          skipped: true,
          reason: 'Skipped: single-token lemma, not an expression article.',
        };

        steps.expression_promotion = {
          ok: true,
          skipped: true,
          reason: 'Skipped: single-token lemma, not an expression article.',
        };

        steps.has_expression_relations = {
          ok: true,
          skipped: true,
          reason: 'Skipped: single-token lemma, not an expression article.',
        };

        steps.article_ref_relations = {
          ok: true,
          skipped: true,
          reason: 'Skipped: single-token lemma, not an expression article.',
        };

        steps.relation_resolver = {
          ok: true,
          skipped: true,
          reason: 'Skipped: single-token lemma, not an expression article.',
        };

        return jsonResponse({
          ok: true,
          pipeline: 'ordbokene_lexeme_pipeline_v4',
          lemma: inputLemma,
          article_id: articleId,
          dictionary_code: dictionaryCode,
          entity_mode: parentLookup.ambiguous ? 'ambiguous_lexeme' : 'unverified_lexeme',
          ordbokene_status: 'entry',
          diagnostic_status: parentLookup.ambiguous
            ? 'single_token_lemma_ambiguous_homonym'
            : 'single_token_lemma_not_yet_in_lexemes',
          confidence: 1,
          dry_run: dryRun,
          compact,
          run_resolver: runResolver,
          steps,
          note: parentLookup.ambiguous
            ? `Lemma matches ${parentLookup.candidateCount} lexemes with the same spelling but different parts of speech (e.g. verb/noun homonyms). This pipeline does not disambiguate — handled as informational, not an error.`
            : 'Single-token lemma found in Ordbokene but has no matching row in lexemes yet. This pipeline does not create lexeme rows — verification path A (lexical-worker / promote_verification_results_for_job) must process this word first.',
        });
      }

      const standaloneExpression = await promoteStandaloneExpression({
        articleId,
        dictionaryCode,
        lemma: candidateLemma,
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
        ordbokene_status: 'expr_entry',
        diagnostic_status: 'matched_article_lookup',
        confidence: 1,
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
      ordbokene_status: entityMode === 'lexeme' ? 'entry' : 'expr_entry',
      diagnostic_status: 'matched_article_lookup',
      confidence: 1,
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
        // ФИКС: err instanceof Error ? err.message : String(err) давало
        // "[object Object]" для сырых PostgrestError-объектов, проброшенных
        // через `throw error` без обёртки. Теперь все внутренние throw
        // используют toReadableError(...) -> всегда настоящий Error с
        // читаемым .message, так что эта строка работает как задумано.
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null,
      },
      500,
    );
  }
});