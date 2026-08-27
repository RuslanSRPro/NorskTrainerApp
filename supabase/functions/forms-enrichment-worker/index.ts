// supabase/functions/forms-enrichment-worker/index.ts

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  CURRENT_RUN_ID,
  CURRENT_METHOD_VERSION,
  DEFAULT_BATCH_SIZE,
} from '../_shared/lexicon-run-config.ts';

const WORKER_NAME = 'forms-enrichment-worker';

type Pos = 'verb' | 'noun' | 'adjective';
type VariantType = 'main' | 'alternative' | 'secondary' | 'review';

type RequestBody = {
  batchSize?: number;
  runId?: string;
  pos?: Pos;
  dryRun?: boolean;
  debugRaw?: boolean;

  // For direct testing without selecting from DB
  lookupWord?: string;
  lookupPos?: Pos;

  // Job-scoped mode: specific lexeme ids from a single analyze-text job,
  // used by job-enrichment-batch-worker's 'forms' chain. Takes priority
  // over the global batch-by-alphabet mode below when provided.
  lexemeIds?: string[];
};

type Lexeme = {
  id: string;
  lemma: string;
  display_form?: string | null;
  pos: string;
};

type RawForm = {
  form_key: string;
  form_label: string;
  value: string;
  tags: string[];
  grammar: Record<string, unknown>;
  variant_rank: number;
  variant_type: VariantType;
  is_irregular: boolean;
  source_article_id: string | null;
  source_dictionary: string;
};

type AuthoritativeForm = RawForm & {
  is_main: boolean;
  is_alternative: boolean;
  needs_review: boolean;
  verification_status: 'source_verified' | 'needs_review' | 'candidate';
  source: string;
};

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      500,
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const body = await safeJson<RequestBody>(req);

  const runId = body.runId ?? CURRENT_RUN_ID;
  const batchSize = body.batchSize ?? DEFAULT_BATCH_SIZE;
  const dryRun = body.dryRun ?? false;
  const debugRaw = body.debugRaw ?? false;

  let lexemes: Lexeme[] = [];

  if (body.lookupWord) {
    lexemes = [
      {
        id: 'manual-lookup',
        lemma: body.lookupWord,
        display_form: body.lookupWord,
        pos: body.lookupPos ?? body.pos ?? 'noun',
      },
    ];
  } else if (Array.isArray(body.lexemeIds) && body.lexemeIds.length > 0) {
    // Job-scoped режим: конкретные лексемы из текущего analyze-text job'а.
    // Вызывается из job-enrichment-batch-worker (цепочка 'forms'), которая
    // передаёт lexeme_id'ы items'ов текущего job'а, отфильтрованные по
    // pos in (verb, noun, adjective). Приоритет выше глобального batch'а
    // ниже — если lexemeIds передан, глобальная выборка по алфавиту не
    // выполняется.
    const { data, error } = await supabase
      .from('lexemes')
      .select('id, lemma, display_form, pos')
      .in('id', body.lexemeIds)
      .in('pos', ['verb', 'noun', 'adjective']);

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    lexemes = (data ?? []) as Lexeme[];
  } else {
    let query = supabase
      .from('lexemes')
      .select('id, lemma, display_form, pos')
      .in('pos', ['verb', 'noun', 'adjective'])
      .order('lemma', { ascending: true })
      .limit(batchSize);

    if (body.pos) query = query.eq('pos', body.pos);

    const { data, error } = await query;

    if (error) {
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    lexemes = (data ?? []) as Lexeme[];
  }

  let processed = 0;
  let upserted = 0;
  let sourceVerified = 0;
  let needsReview = 0;
  let failed = 0;

  const results: any[] = [];

  for (const lexeme of lexemes) {
    processed++;

    try {
      const formsResult = await getAuthoritativeForms(lexeme, debugRaw);
      const forms = formsResult.forms;

      if (forms.length === 0) {
        needsReview++;

        const reviewPayload = buildNeedsReviewPayload(
          lexeme,
          runId,
          formsResult.debug,
        );

        if (!dryRun && lexeme.id !== 'manual-lookup') {
          // ФИКС (27.07.2026, найдено на живых данных: burst-запуск 37
          // job'ов вызвал массовые "duplicate key value violates unique
          // constraint lexeme_form_variants_lexeme_id_form_type_
          // normalized_value_key" — 23505). Реальный unique constraint в
          // БД — (lexeme_id, form_type, normalized_value), БЕЗ form_key и
          // БЕЗ source_dictionary. onConflict здесь указывал несуществующую
          // комбинацию колонок ('lexeme_id,form_key,normalized_value,
          // source_dictionary') — Postgres не мог сматчить её ни с одним
          // реальным constraint'ом, ON CONFLICT молча не срабатывал, и
          // upsert превращался в обычный INSERT, падающий на настоящем
          // ограничении при повторной записи той же формы.
          const { error: reviewError } = await supabase
            .from('lexeme_form_variants')
            .upsert([reviewPayload], {
              onConflict: 'lexeme_id,form_type,normalized_value',
            });

          if (reviewError) throw reviewError;
        }

        results.push({
          lexeme_id: lexeme.id,
          lemma: lexeme.lemma,
          pos: lexeme.pos,
          action: dryRun || lexeme.id === 'manual-lookup'
            ? 'dry_run_needs_review'
            : 'needs_review',
          reason: 'No authoritative paradigm forms extracted',
          debug: debugRaw ? formsResult.debug : undefined,
        });

        continue;
      }

      const payload = forms.map((form) => buildFormPayload(lexeme, form, runId));

      if (!dryRun && lexeme.id !== 'manual-lookup') {
        // См. комментарий выше — тот же фикс onConflict, тот же реальный
        // constraint (lexeme_id, form_type, normalized_value).
        const { error: upsertError } = await supabase
          .from('lexeme_form_variants')
          .upsert(payload, {
            onConflict: 'lexeme_id,form_type,normalized_value',
          });

        if (upsertError) throw upsertError;
      }

      if (!dryRun && lexeme.id !== 'manual-lookup') {
        upserted += payload.length;
      }
      sourceVerified++;

      results.push({
        lexeme_id: lexeme.id,
        lemma: lexeme.lemma,
        pos: lexeme.pos,
        action: dryRun || lexeme.id === 'manual-lookup' ? 'dry_run' : 'upserted',
        forms: payload.length,
        main: payload.filter((x) => x.variant_rank === 0).length,
        alternatives: payload.filter((x) => x.variant_rank === 1).length,
        secondary: payload.filter((x) => x.variant_rank === 2).length,
        irregular: payload.some((x) => x.is_irregular),
        debug: debugRaw ? formsResult.debug : undefined,
      });
    } catch (e) {
      failed++;

      results.push({
        lexeme_id: lexeme.id,
        lemma: lexeme.lemma,
        pos: lexeme.pos,
        action: 'failed',
        error: safeErrorStringify(e),
      });
    }
  }

  return jsonResponse({
    ok: true,
    worker: WORKER_NAME,
    runId,
    dryRun,
    debugRaw,
    processed,
    upserted,
    sourceVerified,
    needsReview,
    failed,
    results,
  });
});

function buildFormPayload(lexeme: Lexeme, form: AuthoritativeForm, runId: string) {
  const confidence = form.verification_status === 'source_verified' ? 1 : 0.3;

  return {
    lexeme_id: lexeme.id,
    pos: lexeme.pos,

    value: form.value,
    normalized_value: normalizeNorwegian(form.value),

    form_type: form.form_key,
    form_key: form.form_key,
    form_label: form.form_label,

    is_primary: form.variant_rank === 0,
    is_main: form.variant_rank === 0,
    is_accepted: form.verification_status === 'source_verified',
    is_alternative: form.variant_rank > 0,
    variant_type: form.variant_type,
    variant_rank: form.variant_rank,

    confidence,
    source_verified: form.source,
    source: form.source,
    source_article_id: form.source_article_id,
    source_dictionary: form.source_dictionary,

    grammar: form.grammar,
    evidence: {
      source: form.source,
      source_article_id: form.source_article_id,
      source_dictionary: form.source_dictionary,
      grammar: form.grammar,
      is_irregular: form.is_irregular,
      needs_review: form.needs_review,
      variant_rank: form.variant_rank,
      variant_type: form.variant_type,
      worker: WORKER_NAME,
      method_version: CURRENT_METHOD_VERSION,
    },

    verification_status: form.verification_status,
    is_irregular: form.is_irregular,
    needs_review: form.needs_review,

    run_id: runId,
    last_verification_run: runId,
    method_version: CURRENT_METHOD_VERSION,
    created_by: WORKER_NAME,
    updated_at: new Date().toISOString(),
  };
}

function buildNeedsReviewPayload(
  lexeme: Lexeme,
  runId: string,
  debug?: Record<string, unknown>,
) {
  const value = lexeme.display_form ?? lexeme.lemma;

  return {
    lexeme_id: lexeme.id,
    pos: lexeme.pos,

    value,
    normalized_value: normalizeNorwegian(value),

    form_type: 'needs_review',
    form_key: 'needs_review',
    form_label: 'Needs review',

    is_primary: false,
    is_main: false,
    is_accepted: false,
    is_alternative: false,
    variant_type: 'review',
    variant_rank: 99,

    confidence: 0,
    source_verified: 'ordbokene_rest',
    source: 'ordbokene_rest',
    source_article_id: null,
    source_dictionary: 'Bokmålsordboka',

    grammar: {
      pos: lexeme.pos,
      reason: 'No authoritative paradigm forms extracted',
    },

    evidence: {
      source: 'ordbokene_rest',
      reason: 'No authoritative paradigm forms extracted',
      debug: debug ?? null,
      worker: WORKER_NAME,
      method_version: CURRENT_METHOD_VERSION,
    },

    verification_status: 'needs_review',
    is_irregular: false,
    needs_review: true,

    run_id: runId,
    last_verification_run: runId,
    method_version: CURRENT_METHOD_VERSION,
    created_by: WORKER_NAME,
    updated_at: new Date().toISOString(),
  };
}

async function getAuthoritativeForms(
  lexeme: Lexeme,
  debugRaw: boolean,
): Promise<{ forms: AuthoritativeForm[]; debug?: Record<string, unknown> }> {
  const word = cleanLookupWord(lexeme.display_form ?? lexeme.lemma);
  const articles = await fetchOrdbokeneArticles(word);

  // ---------------------------------------------------------------------------
  // GRAMMAR-PARSER HOOK (будущее):
  // POS-неоднозначная лемма ("møte" = сущ. 'встреча' И глаг. 'встречать')
  // существует как ДВЕ отдельные лексемы (pos='noun' и pos='verb') с разными
  // lexeme_id. Каждая парадигма живёт на СВОЕЙ pos-лексеме: noun-лексема
  // получает ТОЛЬКО NOUN-статью Ordbokene, verb-лексема — ТОЛЬКО VERB-статью.
  // Обе парадигмы под одну лексему НЕ сливаем — это давало неверную "основную"
  // форму (сущ. møte показывало определённую 'møtte', что есть претеритум
  // глагола). Когда появится грамматический парсер, он разрешит часть речи по
  // контексту предложения и выберет нужную лексему через
  // lexemes.homonym_group_id. Это ВЫБОР между двумя уже-корректными лексемами,
  // он никогда не должен требовать перечистки слитой парадигмы.
  // ---------------------------------------------------------------------------

  const relevantArticles = articles.filter((article: any) => {
    const sourcePos = getArticlePos(article);
    // FIX (20.07): fail-CLOSED. Раньше было `if (!sourcePos) return true` —
    // если POS не удавалось определить, бралась ЛЮБАЯ статья, и лексема-
    // существительное впитывала парадигму глагола-омонима (møtet ← møtte).
    // Теперь: не смогли определить POS статьи → статью НЕ берём. Хуже пустой
    // результат (→ needs_review), чем неверная форма в карточке учащегося.
    if (!sourcePos) return false;
    return matchesPos(sourcePos, lexeme.pos);
  });

  const rawForms: RawForm[] = [];

  for (let articleIndex = 0; articleIndex < relevantArticles.length; articleIndex++) {
    rawForms.push(
      ...extractParadigmForms({
        article: relevantArticles[articleIndex],
        articleIndex,
        requestedPos: lexeme.pos as Pos,
      }),
    );
  }

  const withDerived =
    lexeme.pos === 'verb'
      ? addDerivedVerbCompoundTenses(rawForms)
      : rawForms;

  const normalizedForms = normalizeFormsByPos(lexeme.pos, withDerived);

  const forms = uniqueForms(normalizedForms.map(makeFormFromRaw));

  return {
    forms,
    debug: debugRaw
      ? {
          lookup_word: word,
          article_count: articles.length,
          relevant_article_count: relevantArticles.length,
          raw_forms_count: rawForms.length,
          normalized_forms_count: normalizedForms.length,
          derived_forms_count: withDerived.length - rawForms.length,
          first_article_keys: Object.keys(relevantArticles[0] ?? {}),
          first_article_sample: safePreview(relevantArticles[0]),
          raw_forms_preview: normalizedForms.slice(0, 40),
        }
      : undefined,
  };
}

async function fetchOrdbokeneArticles(word: string): Promise<any[]> {
  const listUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(
    word,
  )}&dict=bm&scope=e`;

  const listRes = await fetchWithTimeout(listUrl, 8000);

  if (!listRes.ok) {
    throw new Error(
      `Ordbokene articles list failed: ${listRes.status} ${await listRes.text()}`,
    );
  }

  const listJson = await listRes.json();
  const articleIds = extractArticleIds(listJson);
  const articles: any[] = [];

  for (const articleId of articleIds.slice(0, 5)) {
    const articleUrl = `https://ord.uib.no/bm/article/${articleId}.json`;
    const articleRes = await fetchWithTimeout(articleUrl, 8000);

    if (!articleRes.ok) continue;

    const articleJson = await articleRes.json();

    articles.push({
      ...articleJson,
      id: String(articleId),
      dictionary: 'Bokmålsordboka',
      article_url: articleUrl,
    });
  }

  return articles;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractArticleIds(payload: any): string[] {
  const ids = new Set<string>();
  const bm = payload?.articles?.bm;

  if (Array.isArray(bm)) {
    for (const id of bm) ids.add(String(id));
  }

  return [...ids];
}

function extractParadigmForms(args: {
  article: any;
  articleIndex: number;
  requestedPos: Pos;
}): RawForm[] {
  const { article, articleIndex, requestedPos } = args;

  const articleId = getArticleId(article);
  const dictionary = getArticleDictionary(article);
  const lemmas = Array.isArray(article?.lemmas) ? article.lemmas : [];
  const rawForms: RawForm[] = [];

  for (let lemmaIndex = 0; lemmaIndex < lemmas.length; lemmaIndex++) {
    const lemma = lemmas[lemmaIndex];
    const paradigmInfo = Array.isArray(lemma?.paradigm_info)
      ? lemma.paradigm_info
      : [];

    for (let paradigmIndex = 0; paradigmIndex < paradigmInfo.length; paradigmIndex++) {
      const paradigm = paradigmInfo[paradigmIndex];

      const paradigmTags = Array.isArray(paradigm?.tags)
        ? paradigm.tags.map(String)
        : [];

      const inflectionGroup = String(paradigm?.inflection_group ?? '');
      const standardisation = String(paradigm?.standardisation ?? '');
      const paradigmId = paradigm?.paradigm_id ?? null;

      const inflection = Array.isArray(paradigm?.inflection)
        ? paradigm.inflection
        : [];

      const isIrregular = detectIrregularFromParadigm(
        requestedPos,
        inflectionGroup,
        inflection,
      );

      for (const item of inflection) {
        const wordForm = item?.word_form;

        if (typeof wordForm !== 'string' || wordForm.trim().length === 0) {
          continue;
        }

        const tags = Array.isArray(item?.tags) ? item.tags.map(String) : [];

        const classified = classifyForm({
          requestedPos,
          tags,
          articleIndex,
          lemmaIndex,
          paradigmIndex,
        });

        if (!classified) continue;

        rawForms.push({
          form_key: classified.form_key,
          form_label: classified.form_label,
          value: wordForm,
          tags,
          variant_rank: classified.variant_rank,
          variant_type: classified.variant_type,
          is_irregular: isIrregular,
          source_article_id: articleId,
          source_dictionary: dictionary,
          grammar: {
            pos: requestedPos,
            tags,
            paradigm_tags: paradigmTags,
            inflection_group: inflectionGroup,
            standardisation,
            paradigm_id: paradigmId,
            article_index: articleIndex,
            lemma_index: lemmaIndex,
            paradigm_index: paradigmIndex,
            classification_reason: classified.reason,
            final_lexeme: lemma?.final_lexeme ?? lemma?.lemma ?? null,
          },
        });
      }
    }
  }

  return uniqueRawForms(rawForms);
}

function classifyForm(args: {
  requestedPos: Pos;
  tags: string[];
  articleIndex: number;
  lemmaIndex: number;
  paradigmIndex: number;
}): null | {
  form_key: string;
  form_label: string;
  variant_rank: number;
  variant_type: 'main' | 'alternative' | 'secondary';
  reason: string;
} {
  const { requestedPos, tags, articleIndex, lemmaIndex, paradigmIndex } = args;
  const normalizedTags = tags.map((x) => x.toLowerCase());
  const text = normalizedTags.join(' ');

  const isPrimaryParadigm =
    articleIndex === 0 && lemmaIndex === 0 && paradigmIndex === 0;

  const baseRank = isPrimaryParadigm ? 0 : 1;
  const baseType = isPrimaryParadigm ? 'main' : 'alternative';

  if (requestedPos === 'verb') {
    const isPassive = normalizedTags.includes('pass');
    const isAdj = normalizedTags.includes('adj');
    const isPerfPart = normalizedTags.includes('<perfpart>');
    const isPresPart = normalizedTags.includes('<prespart>');

    if (normalizedTags.includes('inf') && !isPassive) {
      return {
        form_key: 'infinitive',
        form_label: 'Infinitiv',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'verb_infinitive',
      };
    }

    if (normalizedTags.includes('pres') && !isPassive) {
      return {
        form_key: 'present',
        form_label: 'Presens',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'verb_present',
      };
    }

    if (normalizedTags.includes('past')) {
      return {
        form_key: 'past',
        form_label: 'Preteritum',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'verb_past',
      };
    }

    if (isPerfPart && !isAdj) {
      return {
        form_key: 'past_participle',
        form_label: 'Perfektum partisipp',
        variant_rank: 2,
        variant_type: 'secondary',
        reason: 'verb_past_participle_secondary_derived_source',
      };
    }

    if (normalizedTags.includes('imp')) {
      return {
        form_key: 'imperative',
        form_label: 'Imperativ',
        variant_rank: 2,
        variant_type: 'secondary',
        reason: 'verb_imperative_secondary',
      };
    }

    if (isPassive) {
      return {
        form_key: normalizedTags.includes('pres')
          ? 'present_passive'
          : 'infinitive_passive',
        form_label: normalizedTags.includes('pres')
          ? 'Presens passiv'
          : 'Infinitiv passiv',
        variant_rank: 2,
        variant_type: 'secondary',
        reason: 'verb_passive_secondary',
      };
    }

    if (isPresPart) {
      return {
        form_key: 'present_participle',
        form_label: 'Presens partisipp',
        variant_rank: 2,
        variant_type: 'secondary',
        reason: 'verb_present_participle_secondary',
      };
    }

    if (isAdj && isPerfPart) {
      return {
        form_key: makeAdjectivalParticipleKey(normalizedTags),
        form_label: 'Adjektivisk perfektum partisipp',
        variant_rank: 2,
        variant_type: 'secondary',
        reason: 'verb_adjectival_participle_secondary',
      };
    }

    return null;
  }

  if (requestedPos === 'noun') {
    const isIndefinite = normalizedTags.includes('ind');
    const isDefinite = normalizedTags.includes('def');
    const isSingular = normalizedTags.includes('sing');
    const isPlural = normalizedTags.includes('plur');

    if ((isIndefinite && isSingular) || hasTags(text, ['ubestemt', 'entall'])) {
      return {
        form_key: 'singular_indefinite',
        form_label: 'Entall ubestemt',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'noun_singular_indefinite',
      };
    }

    if ((isDefinite && isSingular) || hasTags(text, ['bestemt', 'entall'])) {
      return {
        form_key: 'singular_definite',
        form_label: 'Entall bestemt',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'noun_singular_definite',
      };
    }

    if ((isIndefinite && isPlural) || hasTags(text, ['ubestemt', 'flertall'])) {
      return {
        form_key: 'plural_indefinite',
        form_label: 'Flertall ubestemt',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'noun_plural_indefinite',
      };
    }

    if ((isDefinite && isPlural) || hasTags(text, ['bestemt', 'flertall'])) {
      return {
        form_key: 'plural_definite',
        form_label: 'Flertall bestemt',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'noun_plural_definite',
      };
    }

    return null;
  }

  if (requestedPos === 'adjective') {
    const isPositive =
      normalizedTags.includes('pos') ||
      normalizedTags.includes('positive');

    const isIndefinite =
      normalizedTags.includes('ind') ||
      normalizedTags.includes('ubestemt');

    const isDefinite =
      normalizedTags.includes('def') ||
      normalizedTags.includes('bestemt');

    const isSingular =
      normalizedTags.includes('sing') ||
      normalizedTags.includes('singular') ||
      normalizedTags.includes('entall');

    const isComparative =
      normalizedTags.includes('cmp') ||
      normalizedTags.includes('comp') ||
      normalizedTags.includes('comparative') ||
      normalizedTags.includes('komparativ');

    const isSuperlative =
      normalizedTags.includes('sup') ||
      normalizedTags.includes('superlative') ||
      normalizedTags.includes('superlativ');

    const isNeuter =
      normalizedTags.includes('neuter') ||
      normalizedTags.includes('nøytrum') ||
      normalizedTags.includes('intetkjønn');

    const isPlural =
      normalizedTags.includes('plur') ||
      normalizedTags.includes('plural') ||
      normalizedTags.includes('flertall');

    const isCommon =
      normalizedTags.includes('masc/fem') ||
      normalizedTags.includes('common') ||
      normalizedTags.includes('felleskjønn');

    const isFeminineOnly =
      normalizedTags.includes('fem') && !normalizedTags.includes('masc/fem');

    if (isComparative) {
      return {
        form_key: text.includes('mer')
          ? 'comparative_alternative_mer'
          : 'comparative',
        form_label: text.includes('mer')
          ? 'Komparativ alternativ med mer'
          : 'Komparativ',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: text.includes('mer')
          ? 'adjective_comparative_alternative_mer'
          : 'adjective_comparative',
      };
    }

    if (isSuperlative && isDefinite) {
      return {
        form_key: text.includes('mest')
          ? 'superlative_definite_alternative_mest'
          : 'superlative_definite',
        form_label: text.includes('mest')
          ? 'Superlativ bestemt alternativ med mest'
          : 'Superlativ bestemt',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: text.includes('mest')
          ? 'adjective_superlative_definite_alternative_mest'
          : 'adjective_superlative_definite',
      };
    }

    if (isSuperlative) {
      return {
        form_key: text.includes('mest')
          ? 'superlative_alternative_mest'
          : 'superlative',
        form_label: text.includes('mest')
          ? 'Superlativ alternativ med mest'
          : 'Superlativ ubestemt',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: text.includes('mest')
          ? 'adjective_superlative_alternative_mest'
          : 'adjective_superlative_indefinite',
      };
    }

    if (isPositive && isFeminineOnly && isIndefinite && isSingular) {
      return {
        form_key: 'positive_feminine',
        form_label: 'Positiv hunkjønn',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'adjective_positive_feminine',
      };
    }

    if (isPositive && isNeuter && isIndefinite && isSingular) {
      return {
        form_key: 'positive_neuter',
        form_label: 'Positiv intetkjønn',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'adjective_positive_neuter',
      };
    }

    if (isPositive && isPlural) {
      return {
        form_key: 'positive_plural',
        form_label: 'Positiv flertall',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'adjective_positive_plural',
      };
    }

    if (isPositive && isDefinite && isSingular) {
      return {
        form_key: 'positive_definite',
        form_label: 'Positiv bestemt form',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'adjective_positive_definite',
      };
    }

    if (isPositive && isCommon && isIndefinite && isSingular) {
      return {
        form_key: 'positive_common',
        form_label: 'Positiv felleskjønn',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'adjective_positive_common',
      };
    }

    if (isPositive || isCommon) {
      return {
        form_key: 'positive_common',
        form_label: 'Positiv felleskjønн',
        variant_rank: baseRank,
        variant_type: baseType,
        reason: 'adjective_positive_common_fallback',
      };
    }

    return null;
  }
  return null;
}

function normalizeFormsByPos(pos: string, forms: RawForm[]): RawForm[] {
  if (pos === 'adjective') return normalizeAdjectiveRawForms(forms);
  if (pos === 'noun') return normalizeNounRawForms(forms);
  if (pos === 'verb') return normalizeVerbRawForms(forms);
  return forms;
}

function normalizeVerbRawForms(rawForms: RawForm[]): RawForm[] {
  const bestByKey = new Map<string, RawForm>();

  for (const form of rawForms) {
    const key = [form.form_key, normalizeNorwegian(form.value)].join(':');
    const existing = bestByKey.get(key);

    if (!existing || compareRawFormPriority(form, existing) < 0) {
      bestByKey.set(key, form);
    }
  }

  const grouped = new Map<string, RawForm[]>();

  for (const form of bestByKey.values()) {
    const group = grouped.get(form.form_key) ?? [];
    group.push(form);
    grouped.set(form.form_key, group);
  }

  const result: RawForm[] = [];

  for (const [formKey, group] of grouped.entries()) {
    // ФИКС (27.07.2026 — Norsk referansegrammatikk 7.1.4.1.1.1, подтверждено
    // на живых данных: håpe → håpa/rank0 вместо håpte-håpet, klare →
    // klara/rank0 вместо klarte/klaret): для слабых дієслів 1 класу
    // офіційна граматика прямо каже, що -a-форма в preteritum/perfektum
    // partisipp — рідкісний, розмовний/нюношк-орієнтований варіант,
    // "langt sjeldnere brukt i skrift enn et-formene". Наш код раніше
    // сліпо довіряв ПОРЯДКУ статей у відповіді Ordbokene
    // (isPrimaryParadigm = перша стаття = rank 0) — а Ordbokene для
    // деяких дієслів повертає -a-парадигму першою, що НЕ відповідає
    // реальному письмовому пріоритету bokmål. Явно застосовуємо
    // граматичне правило ТІЛЬКИ якщо в одній групі (past/present_perfect/
    // past_perfect) одночасно присутні і -et, і -a варіанти — інакше
    // нічого не чіпаємо. 'past_participle' НЕ входить у цей список — див.
    // коментар всередині applyBokmalEtOverAPreference.
    const orderedGroup = applyBokmalEtOverAPreference(formKey, group);
    const sorted = orderedGroup.sort(compareRawFormPriority);
    const hasMain = sorted.some((form) => form.variant_rank === 0);

    sorted.forEach((form, index) => {
      const rank = getNormalizedVerbVariantRank({ form, hasMain, index });

      result.push({
        ...form,
        variant_rank: rank,
        variant_type: rank === 0 ? 'main' : rank === 1 ? 'alternative' : 'secondary',
        grammar: {
          ...form.grammar,
          original_variant_rank: form.variant_rank,
          normalized_variant_rank: rank,
          variant_normalization_reason: 'deduplicated_verb_form_key_value',
          form_key_group: formKey,
        },
      });
    });
  }

  return result.sort(compareRawFormPriority);
}

// См. комментарий выше (normalizeVerbRawForms) — реализация правила
// "-et приоритетнее -a" для past/present_perfect/past_perfect слабых
// глаголов 1 класса. Работает ТОЛЬКО как перестановка variant_rank между
// УЖЕ существующими формами этой же группы — ничего не выдумывает и не
// удаляет, -a-форма остаётся в базе, просто с более низким rank
// (альтернативный вариант).
function applyBokmalEtOverAPreference(formKey: string, group: RawForm[]): RawForm[] {
  // ФІКС (27.07.2026, уточнення): 'past_participle' навмисно НЕ входить
  // сюди. Його variant_rank ЗАВЖДИ жорстко = 2/secondary у classifyForm
  // (reason: 'verb_past_participle_secondary_derived_source'), незалежно
  // від isPrimaryParadigm/порядку статей Ordbokene — на відміну від
  // 'past', 'present_perfect', 'past_perfect', які обчислюють rank саме
  // з isPrimaryParadigm і тому дійсно потребують цього фіксу. Якщо
  // залишити 'past_participle' тут, гілка `variant_rank !== 0` нижче
  // безумовно піднімає -et-партицип із 2 на 0 (2 !== 0), ламаючи
  // навмисний інваріант "партицип як окрема форма завжди secondary".
  const relevantFormKeys = new Set([
    'past', 'present_perfect', 'past_perfect',
  ]);
  if (!relevantFormKeys.has(formKey)) return group;

  // Похідні часи мають префікс допоміжного дієслова ("har "/"hadde ") —
  // прибираємо його перед перевіркою закінчення самого дієприкметника.
  const stripAuxiliary = (v: string) =>
    v.replace(/^(har|hadde)\s+/i, '');

  const endsWithEt = (v: string) => normalizeNorwegian(stripAuxiliary(v)).endsWith('et');
  const endsWithBareA = (v: string) => {
    const normalized = normalizeNorwegian(stripAuxiliary(v));
    // "bareA" — закінчення саме на -a як окрема морфема (kasta, håpa),
    // не випадковий збіг (напр. форми з допоміжними словами тут не
    // зустрічаються, past/past_participle — завжди одне слово).
    return normalized.endsWith('a') && normalized.length > 1;
  };

  const hasEtForm = group.some((f) => endsWithEt(f.value));
  const hasAForm = group.some((f) => endsWithBareA(f.value));

  // Правило застосовується лише коли обидва варіанти реально присутні —
  // якщо дієслово має ТІЛЬКИ -a форму (рідкісний випадок для деяких
  // дієслів) або тільки -et — нічого не змінюємо, група вже однозначна.
  if (!hasEtForm || !hasAForm) return group;

  return group.map((form) => {
    if (endsWithBareA(form.value) && form.variant_rank === 0) {
      // Знижуємо -a-варіант з rank 0 до rank 1 (звичайний альтернативний
      // варіант) — звільняючи rank 0 для -et-форми нижче.
      return { ...form, variant_rank: 1 };
    }
    if (endsWithEt(form.value) && form.variant_rank !== 0) {
      // Присвоюємо -et-варіанту rank 0, якщо він ще не мав його.
      return { ...form, variant_rank: 0 };
    }
    return form;
  });
}

function getNormalizedVerbVariantRank(args: {
  form: RawForm;
  hasMain: boolean;
  index: number;
}): 0 | 1 | 2 {
  const { form, hasMain, index } = args;

  if (form.variant_rank === 2) return 2;
  if (form.variant_rank === 0) return 0;
  if (hasMain) return 1;
  return index === 0 ? 0 : 1;
}

function normalizeNounRawForms(rawForms: RawForm[]): RawForm[] {
  const bestByKey = new Map<string, RawForm>();

  for (const form of rawForms) {
    const key = [form.form_key, normalizeNorwegian(form.value)].join(':');
    const existing = bestByKey.get(key);

    if (!existing || compareRawFormPriority(form, existing) < 0) {
      bestByKey.set(key, form);
    }
  }

  const grouped = new Map<string, RawForm[]>();

  for (const form of bestByKey.values()) {
    const group = grouped.get(form.form_key) ?? [];
    group.push(form);
    grouped.set(form.form_key, group);
  }

  const result: RawForm[] = [];

  for (const [formKey, group] of grouped.entries()) {
    const sorted = group.sort(compareRawFormPriority);
    const hasMain = sorted.some((form) => form.variant_rank === 0);

    sorted.forEach((form, index) => {
      const rank = getNormalizedNounVariantRank({ form, hasMain, index });

      result.push({
        ...form,
        variant_rank: rank,
        variant_type: rank === 0 ? 'main' : 'alternative',
        grammar: {
          ...form.grammar,
          original_variant_rank: form.variant_rank,
          normalized_variant_rank: rank,
          variant_normalization_reason: 'deduplicated_noun_form_key_value',
          form_key_group: formKey,
        },
      });
    });
  }

  return result.sort(compareRawFormPriority);
}

function getNormalizedNounVariantRank(args: {
  form: RawForm;
  hasMain: boolean;
  index: number;
}): 0 | 1 {
  const { form, hasMain, index } = args;

  if (form.variant_rank === 0) return 0;
  if (hasMain) return 1;
  return index === 0 ? 0 : 1;
}

function normalizeAdjectiveRawForms(rawForms: RawForm[]): RawForm[] {
  const bestByKey = new Map<string, RawForm>();

  for (const form of rawForms) {
    const key = [form.form_key, normalizeNorwegian(form.value)].join(':');
    const existing = bestByKey.get(key);

    if (!existing || compareRawFormPriority(form, existing) < 0) {
      bestByKey.set(key, form);
    }
  }

  removeDuplicateFeminineEqualToCommon(bestByKey);

  const grouped = new Map<string, RawForm[]>();

  for (const form of bestByKey.values()) {
    const group = grouped.get(form.form_key) ?? [];
    group.push(form);
    grouped.set(form.form_key, group);
  }

  const hasPositiveCommon = Array.from(bestByKey.values()).some(
    (form) => form.form_key === 'positive_common',
  );

  const result: RawForm[] = [];

  for (const [formKey, group] of grouped.entries()) {
    const sorted = group.sort(compareRawFormPriority);
    const hasMain = sorted.some((form) => form.variant_rank === 0);

    sorted.forEach((form, index) => {
      const rank = getNormalizedAdjectiveVariantRank({
        form,
        formKey,
        hasMain,
        hasPositiveCommon,
        index,
      });

      result.push({
        ...form,
        variant_rank: rank,
        variant_type: rank === 0 ? 'main' : 'alternative',
        grammar: {
          ...form.grammar,
          original_variant_rank: form.variant_rank,
          normalized_variant_rank: rank,
          variant_normalization_reason: 'deduplicated_adjective_form_key_value',
          form_key_group: formKey,
        },
      });
    });
  }

  return result.sort(compareRawFormPriority);
}

function getNormalizedAdjectiveVariantRank(args: {
  form: RawForm;
  formKey: string;
  hasMain: boolean;
  hasPositiveCommon: boolean;
  index: number;
}): 0 | 1 {
  const { form, formKey, hasMain, hasPositiveCommon, index } = args;

  // UI model: positive_common already represents the shared masculine/feminine form.
  // If a separate feminine form remains after deduplication, it is an accepted
  // alternative spelling/form, not another main positive form.
  if (formKey === 'positive_feminine' && hasPositiveCommon) {
    return 1;
  }

  if (form.variant_rank === 0) return 0;
  if (hasMain) return 1;
  return index === 0 ? 0 : 1;
}

function removeDuplicateFeminineEqualToCommon(bestByKey: Map<string, RawForm>) {
  const commonValues = new Set<string>();

  for (const form of bestByKey.values()) {
    if (form.form_key === 'positive_common') {
      commonValues.add(normalizeNorwegian(form.value));
    }
  }

  if (commonValues.size === 0) return;

  for (const [key, form] of [...bestByKey.entries()]) {
    if (form.form_key !== 'positive_feminine') continue;

    if (commonValues.has(normalizeNorwegian(form.value))) {
      bestByKey.delete(key);
    }
  }
}

function compareRawFormPriority(a: RawForm, b: RawForm): number {
  if (a.variant_rank !== b.variant_rank) return a.variant_rank - b.variant_rank;

  const articleDiff = Number(a.grammar?.article_index ?? 0) - Number(b.grammar?.article_index ?? 0);
  if (articleDiff !== 0) return articleDiff;

  const lemmaDiff = Number(a.grammar?.lemma_index ?? 0) - Number(b.grammar?.lemma_index ?? 0);
  if (lemmaDiff !== 0) return lemmaDiff;

  const paradigmDiff = Number(a.grammar?.paradigm_index ?? 0) - Number(b.grammar?.paradigm_index ?? 0);
  if (paradigmDiff !== 0) return paradigmDiff;

  return normalizeNorwegian(a.value).localeCompare(normalizeNorwegian(b.value), 'nb');
}

function addDerivedVerbCompoundTenses(rawForms: RawForm[]): RawForm[] {
  const result = [...rawForms];
  const participles = rawForms.filter((form) => form.form_key === 'past_participle');

  for (const participle of participles) {
    const derivedRank = getDerivedMainRank(participle);
    const derivedType: VariantType = derivedRank === 0 ? 'main' : 'alternative';

    result.push({
      ...participle,
      form_key: 'present_perfect',
      form_label: 'Presens perfektum',
      value: `har ${participle.value}`,
      tags: [],
      variant_rank: derivedRank,
      variant_type: derivedType,
      grammar: {
        pos: 'verb',
        tense: 'present_perfect',
        auxiliary: 'har',
        derived_from: 'past_participle',
        source_participle: participle.value,
        inflection_group: participle.grammar.inflection_group,
        paradigm_id: participle.grammar.paradigm_id,
        article_index: participle.grammar.article_index,
        lemma_index: participle.grammar.lemma_index,
        paradigm_index: participle.grammar.paradigm_index,
        final_lexeme: participle.grammar.final_lexeme,
        classification_reason: 'derived_present_perfect_from_past_participle',
      },
    });

    result.push({
      ...participle,
      form_key: 'past_perfect',
      form_label: 'Preteritum perfektum',
      value: `hadde ${participle.value}`,
      tags: [],
      variant_rank: derivedRank,
      variant_type: derivedType,
      grammar: {
        pos: 'verb',
        tense: 'past_perfect',
        auxiliary: 'hadde',
        derived_from: 'past_participle',
        source_participle: participle.value,
        inflection_group: participle.grammar.inflection_group,
        paradigm_id: participle.grammar.paradigm_id,
        article_index: participle.grammar.article_index,
        lemma_index: participle.grammar.lemma_index,
        paradigm_index: participle.grammar.paradigm_index,
        final_lexeme: participle.grammar.final_lexeme,
        classification_reason: 'derived_past_perfect_from_past_participle',
      },
    });
  }

  return uniqueRawForms(result);
}

function getDerivedMainRank(form: RawForm): 0 | 1 {
  const articleIndex = Number(form.grammar?.article_index ?? 0);
  const lemmaIndex = Number(form.grammar?.lemma_index ?? 0);
  const paradigmIndex = Number(form.grammar?.paradigm_index ?? 0);

  return articleIndex === 0 && lemmaIndex === 0 && paradigmIndex === 0 ? 0 : 1;
}

function makeAdjectivalParticipleKey(tags: string[]): string {
  if (tags.includes('neuter')) return 'adjectival_past_participle_neuter';
  if (tags.includes('masc/fem')) return 'adjectival_past_participle_common';
  if (tags.includes('def')) return 'adjectival_past_participle_definite';
  if (tags.includes('plur')) return 'adjectival_past_participle_plural';
  return 'adjectival_past_participle';
}

function detectIrregularFromParadigm(
  requestedPos: Pos,
  inflectionGroup: string,
  inflection: any[],
): boolean {
  const group = inflectionGroup.toLowerCase();

  if (requestedPos === 'adjective') {
    if (group === 'adj_regular' || group.includes('regular')) return false;
    if (group.startsWith('adj_')) return true;

    const values = inflection
      .map((x) => String(x?.word_form ?? '').toLowerCase().trim())
      .filter(Boolean);

    return values.includes('små') ||
      values.includes('mindre') ||
      values.includes('minst') ||
      values.includes('lille') ||
      values.includes('vesle');
  }

  if (requestedPos !== 'verb') return false;

  if (group.includes('irregular') || group.includes('strong')) return true;

  const getFormByTag = (tag: string) =>
    inflection.find((x) =>
      Array.isArray(x?.tags) && x.tags.map(String).includes(tag),
    )?.word_form;

  const infinitive = getFormByTag('Inf');
  const present = getFormByTag('Pres');
  const past = getFormByTag('Past');

  const pastParticiple = inflection.find((x) =>
    Array.isArray(x?.tags) && x.tags.map(String).includes('<PerfPart>'),
  )?.word_form;

  if (!infinitive || !past) return false;

  const infinitiveNorm = normalizeNorwegian(String(infinitive));
  const stem = infinitiveNorm.replace(/e$/, '');
  const presentNorm = present ? normalizeNorwegian(String(present)) : '';
  const pastNorm = normalizeNorwegian(String(past));
  const participleNorm = pastParticiple
    ? normalizeNorwegian(String(pastParticiple))
    : '';

  // ФИКС (27.07.2026 — той самий Norsk referansegrammatikk 7.1.4.1.1.1, що
  // й вище): "-a" в preteritum/perfektum partisipp — це ЛЕГІТИМНА regular-
  // форма слабких дієслів 1 класу (просто рідша в письмі), А НЕ ознака
  // неправильного/сильного дієслова. getFormByTag('Past') бере ПЕРШУ форму
  // з тегом Past у масиві Ordbokene — для håpe/klare це виявлялась саме
  // -a-форма (håpa/klara), яка без цього фіксу не потрапляла в список
  // "regular"-закінчень нижче, і слово помилково позначалось як irregular.
  const looksRegularPast =
    pastNorm.startsWith(stem) &&
    (pastNorm.endsWith('et') ||
      pastNorm.endsWith('te') ||
      pastNorm.endsWith('de') ||
      pastNorm.endsWith('dde') ||
      pastNorm.endsWith('a'));

  const looksRegularParticiple =
    !participleNorm ||
    (participleNorm.startsWith(stem) &&
      (participleNorm.endsWith('et') ||
        participleNorm.endsWith('t') ||
        participleNorm.endsWith('d') ||
        participleNorm.endsWith('dd') ||
        participleNorm.endsWith('a')));

  const looksRegularPresent =
    !presentNorm || presentNorm === `${stem}r` || presentNorm === `${infinitiveNorm}r`;

  return !(looksRegularPast && looksRegularParticiple && looksRegularPresent);
}

function makeFormFromRaw(raw: RawForm): AuthoritativeForm {
  return {
    ...raw,
    is_main: raw.variant_rank === 0,
    is_alternative: raw.variant_rank > 0,
    needs_review: false,
    verification_status: 'source_verified',
    source: 'ordbokene_rest_bokmalsordboka',
  };
}

// FIX (20.07): Ordbokene хранит часть речи ВНУТРИ
// lemmas[].paradigm_info[].tags как 'VERB' / 'NOUN' / 'ADJ'
// (проверено на ord.uib.no/bm/article/{id}.json:
//   møte  → art 39910 tags=['VERB'] + art 39909 tags=['NOUN','Neuter']
//   ape   → art 2326  tags=['VERB'] + art 2325  tags=['NOUN','Masc'/'Fem']
//   adresse → art 226 tags=['NOUN','Fem'/'Masc']).
// Прежняя версия читала ВЕРХНЕуровневые ключи (wordClass/word_class/ordklasse/
// pos/...), которых в этом JSON-payload НЕТ вообще, поэтому всегда возвращала
// null. В связке со старым `if (!sourcePos) return true` (fail-open) это
// пропускало статью ЛЮБОЙ части речи → лексема-существительное впитывала
// парадигму глагола-омонима (сущ. møte получало определённую 'møtte', что
// есть претеритум глагола møte). Теперь POS достаётся из paradigm_info.tags,
// а фильтр в getAuthoritativeForms — fail-CLOSED.
function getArticlePos(article: any): string | null {
  const lemmas = Array.isArray(article?.lemmas) ? article.lemmas : [];

  for (const lemma of lemmas) {
    const paradigms = Array.isArray(lemma?.paradigm_info)
      ? lemma.paradigm_info
      : [];

    for (const paradigm of paradigms) {
      const tags = Array.isArray(paradigm?.tags)
        ? paradigm.tags.map((t: unknown) => String(t).toUpperCase())
        : [];

      if (tags.includes('VERB')) return 'verb';
      if (tags.includes('NOUN') || tags.includes('SUBST')) return 'noun';
      if (tags.includes('ADJ')) return 'adjective';
    }
  }

  return null;
}

function getArticleDictionary(article: any): string {
  return getString(article, ['dictionary', 'dict', 'ordbok', 'source']) ?? 'Bokmålsordboka';
}

function getArticleId(article: any): string | null {
  const value = article?.id ?? article?.article_id ?? article?.articleId ?? article?.a_id ?? null;
  return value === null || value === undefined ? null : String(value);
}

function matchesPos(sourcePos: string, lexemePos: string): boolean {
  const s = String(sourcePos ?? '').toLowerCase();

  if (lexemePos === 'verb') return s.includes('verb');
  if (lexemePos === 'noun') return s.includes('substantiv') || s.includes('noun') || s === 'subst';
  if (lexemePos === 'adjective') return s.includes('adjektiv') || s.includes('adjective') || s === 'adj';

  return false;
}

function hasTags(text: string, required: string[]): boolean {
  return required.every((tag) => text.includes(tag));
}

function cleanLookupWord(value: string): string {
  return cleanLemma(value)
    .replace(/^å\s+/i, '')
    .replace(/^(en|ei|et)\s+/i, '')
    .trim();
}

function cleanLemma(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeNorwegian(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function getString(obj: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj?.[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function uniqueForms(forms: AuthoritativeForm[]): AuthoritativeForm[] {
  const seen = new Set<string>();

  return forms.filter((form) => {
    const key = [
      form.form_key,
      normalizeNorwegian(form.value),
      form.source_dictionary ?? '',
      form.source_article_id ?? '',
      form.variant_rank,
    ].join(':');

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function uniqueRawForms(forms: RawForm[]): RawForm[] {
  const seen = new Set<string>();

  return forms.filter((form) => {
    const key = [
      form.form_key,
      normalizeNorwegian(form.value),
      form.source_dictionary,
      form.source_article_id,
      form.variant_rank,
    ].join(':');

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function safePreview(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

// ФИКС: String(e) на объекте ошибки Supabase/Postgrest (у которого нет
// осмысленного toString()) даёт "[object Object]" — та же проблема, что
// была в getParentLexemeIdByLemma (ordbokene-lexeme-pipeline-worker,
// см. хронологию багов сегодняшней сессии, баг №12), только здесь она
// не была исправлена вместе с тем фиксом. Достаём message/details/hint/code
// явно, с фолбэком на JSON.stringify всего объекта, если это не похоже
// на Postgrest-ошибку.
function safeErrorStringify(e: unknown): string {
  if (e instanceof Error) return e.message;

  if (e && typeof e === 'object') {
    const err = e as Record<string, unknown>;
    const parts = [
      err.message,
      err.details,
      err.hint,
      err.code ? `(code: ${err.code})` : null,
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(' — ');

    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  return String(e);
}

async function safeJson<T>(req: Request): Promise<T> {
  try {
    return await req.json();
  } catch {
    return {} as T;
  }
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}