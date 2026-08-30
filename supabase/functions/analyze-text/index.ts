// supabase/functions/analyze-text/index.ts

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withSupabase } from '@supabase/server';
import {
  normalize,
  normalizeExpression,
  tokenize,
} from '../_shared/nlp/normalize.ts';
import {
  planItems,
  type ExpressionRow,
  type PlannedItem,
  type SurfaceFormContext,
  type SurfaceResolution,
  type VerbMaps,
} from './grammar-parser.ts';
import { generateExpressionCandidates } from './candidate-generator.ts';
import { resolveExpressions } from './expression-resolver.ts';
import { resolveCandidatesAgainstCatalog } from './candidate-catalog-bridge.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SOURCES = ['NAOB', 'Ordbokene', 'Lexin', 'Språkrådet', 'Wiktionary'];

const INGESTION_VERSION =
  'ts_expression_aware_ingestion_v17_paginated_loads';

const MAX_360_CANDIDATES_PER_ROOT = 70;

// ФИКС (22.08.2026, найдено на живых данных: job'ы 365ff40a/af0928d9/
// 4990d144, слова avtalt tid/bestemme seg for noe/si i fra om noe получили
// expression_id, которого НЕТ в expression_catalog):
//
// loadExpressions() строит словарь из 3 источников по порядку (trusted_
// expressions_v1 → expression_catalog → legacy lexemes(pos='expression')),
// с правилом "первый найденный ключ побеждает" (if !dict.has(key)).
// Источники 2 и 3 читались через голый .select() БЕЗ .range()/пагинации —
// PostgREST молча обрезает такой ответ до дефолтного лимита (обычно 1000
// строк). На момент находки expression_catalog(lexeme_id NOT NULL) = 1743
// строки, legacy lexemes(pos='expression') = 1783 строки — ОБЕ таблицы
// превышали лимит одновременно. Для лемм, не попавших в обрезанную тысячу
// источника 2 (implicit sort order, непредсказуемо какие именно), ключ
// либо оставался полностью свободным (если совпадающей legacy-записи тоже
// не было в своей обрезанной тысяче), либо заполнялся УСТАРЕВШИМ id из
// источника 3 — оба исхода дают "осиротевший"/неверный expression_id,
// который потом проваливает exists-проверку в
// promote_verification_results_for_job() и item навсегда виснет на
// current_stage='source_checks', несмотря на успешную верификацию.
//
// Также проверен и запатчен loadVerbMaps() (verb_forms, 404 строк на
// момент фикса — пока безопасно, но растёт с каждой сессией обогащения
// словаря и рано или поздно пересечёт тот же лимит тем же самым молчаливым
// образом — "тикающая бомба", патчится превентивно, не дожидаясь, пока
// реально проявится) и trusted_expressions_v1 (12 строк, тоже пагинирован
// для консистентности, хотя риск там минимальный).
//
// fetchAllRows() — универсальный хелпер: гоняет .range()-цикл страницами
// по PAGE_SIZE, пока очередная страница не вернёт меньше строк, чем сам
// размер страницы (это и есть сигнал "это была последняя страница").
// Работает независимо от того, насколько вырастет любая из этих таблиц
// в будущем — в отличие от простого поднятия лимита PostgREST, которое
// лишь отодвигает тот же порог на новое (тоже конечное) число.
const PAGINATION_PAGE_SIZE = 1000;

async function fetchAllRows<T = any>(
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = PAGINATION_PAGE_SIZE,
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await queryFactory(from, to);

    if (error) throw error;

    const rows = data ?? [];
    results.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return results;
}

// ДОБАВЛЕНО (02.08.2026): фикс дублирования source_checks для уже
// верифицированных слов/выражений. См. verification-architecture doc
// (02.08.2026) и promote_verification_results_for_job() для контекста
// значений tier/status на lexemes/expression_catalog.
const TARGET_VERIFICATION_VERSION = 5;

// ФИКС (15.08.2026): skip_source_checks раньше был безусловным для любого
// verified_dictionary+version>=5 слова — навсегда закрывал единственный
// путь, которым Step Б (expand_multi_pos_occurrences_for_job) узнаёт о
// втором потенциальном POS: source_checks для этого слова просто больше
// никогда не создавались, сколько бы раз оно ни встречалось в новых
// текстах. Подтверждённый пример слепой зоны: "lett" (adjective,
// verified) потенциально омонимичен с "lete" (verb, past_participle=lett)
// — это никогда не всплывёт через свежий NAOB-evidence, потому что
// source_checks для "lett" не создаются с момента первой верификации.
//
// Полный отказ от skip убивает весь смысл оптимизации (снова 5 запросов
// к источникам на каждое слово при каждой встрече). Вместо этого — малый
// шанс полной переверификации при каждой встрече уже известного слова:
// не гарантия обнаружить омонимию быстро, но при повторных встречах
// слова в разных текстах со временем даёт Step Б реальный шанс сработать,
// сохраняя ~95% экономии на span'ах, где переверификация не выпала.
const HOMONYM_RECHECK_PROBABILITY = 0.05;

function shouldForceHomonymRecheck(): boolean {
  return Math.random() < HOMONYM_RECHECK_PROBABILITY;
}

// ФИКС (02.08.2026, вторая итерация): читаем сырые verification_tier/
// verification_status, а НЕ score-based enum `verification` — на
// expression_catalog нет триггера, который бы пересчитывал этот enum
// автоматически (recompute_expression_score() ни на одном триггере не
// висит, проверено через information_schema.triggers), в отличие от
// lexemes, где verification гарантированно свежий (lexemes_sync_verification).
//
// ФИКС (02.08.2026, третья итерация): читать один только verification_status
// тоже было ошибкой — в promote_verification_results_for_job() ветка
// 'multi_source' проверяется РАНЬШЕ best_rank>=4, поэтому best_rank=3
// (tier='usage_evidence', самое слабое совпадение) при нескольких
// согласных источниках тоже даёт status='multi_source'. Status-only
// пропустил бы повторную проверку для выражений, подтверждённых только
// по примеру употребления, а не по словарной статье — это заметно мягче
// порога, согласованного для lexemes. Функция ниже — точное зеркало уже
// задокументированного правила триггера trg_recompute_lexeme_verification()
// на lexemes, а не новый порог.
function isSufficientlyVerifiedExpression(
  tier: string | null,
  status: string | null,
): boolean {
  if (status === 'usage_verified') return true;

  if (
    (tier === 'dictionary_entry' || tier === 'dictionary_match') &&
    (status === 'multi_source' || status === 'authoritative')
  ) {
    return true;
  }

  return false;
}


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Lexeme360CandidateRow = {
  id: string;
  lemma: string;
  root_lemma: string;
  lexeme_id: string | null;
  expression_subtype: string | null;
  verification_status: string | null;
  verification: string | null; // ДОБАВЛЕНО
};

function normalizeRootLemma(value: unknown): string {
  return normalizeExpression(String(value ?? ''))
    .replace(/^å\s+/i, '')
    .trim();
}

// ФИКС: root-кандидатом для Lexeme360 может быть ТОЛЬКО verb или expression.
// Lexeme360 по дизайну — про семейства "глагол + частица/предлог/возвратное
// местоимение меняет значение" (ta → ta opp, ta seg av, ...), а не про
// произвольные части речи.
//
// Раньше здесь были разрешены noun/adjective/adverb через .includes(),
// что дало два самостоятельных бага:
//   1) "pronoun".includes("noun") === true — местоимения (jeg, meg)
//      проходили фильтр, хотя pronoun не было в списке разрешённых вообще.
//   2) "adverb".includes("verb") === true — то же самое для adverb.
// Оба — следствие substring-проверки вместо точного сравнения.
//
// Кроме того, разрешение noun как root тянуло в карусель пословицы/устойчивые
// словосочетания типа "brent barn skyr ilden", "Israels barn" — это не
// meaning-shift конструкции глагольного типа, а отдельная категория
// (proverbs/fixed noun phrases), которую Lexeme360 не должен показывать.
// Ограничение до verb+expression устраняет это как побочный эффект, без
// необходимости отдельно фильтровать по expression_subtype здесь.
const LEXEME360_ROOT_ALLOWED_POS = new Set(['verb', 'expression']);

function isLexicalRootCandidate(pos: string | null | undefined): boolean {
  const safePos = String(pos ?? '').toLowerCase().trim();
  return LEXEME360_ROOT_ALLOWED_POS.has(safePos);
}

function getExpressionRootFor360(item: PlannedItem): string {
  const anyItem = item as any;

  const explicitRoot = normalizeRootLemma(
    anyItem.root_lemma ||
      anyItem.rootLemma ||
      anyItem.base_lemma ||
      item.network_root_lemma,
  );

  if (explicitRoot) return explicitRoot;

  const lemma = normalizeRootLemma(
    item.resolved?.lemma || item.normalized_lemma || item.normalized_input,
  );

  if (!lemma) return '';

  if (item.match_type === 'expression' && lemma.includes(' ')) {
    return normalizeRootLemma(lemma.split(/\s+/)[0]);
  }

  return lemma;
}

function collectRootLemmasFor360(items: PlannedItem[]): string[] {
  const roots = new Set<string>();

  for (const item of items) {
    const root = getExpressionRootFor360(item);

    console.log('[LEXEME360 INPUT]', {
      surface: item.surface_form,
      normalized: item.normalized_input,
      lemma: item.normalized_lemma,
      resolved_lemma: item.resolved?.lemma ?? null,
      root_lemma_for_360: root,
      lexeme_id: item.resolved?.lexeme_id ?? null,
      expression_id: item.expression_id ?? null,
      pos: item.resolved?.pos ?? item.pos,
      match_type: item.match_type,
      expression_subtype: item.expression_subtype ?? null,
      verification_status: (item as any).verification_status ?? null,
      match_strategy: item.match_strategy ?? null,
    });

    if (!root) continue;
    if (!isLexicalRootCandidate(item.resolved?.pos ?? item.pos)) continue;

    roots.add(root);
  }

  console.log('[LEXEME360 ROOTS]', [...roots]);

  return [...roots];
}

async function loadExpressions(): Promise<Map<string, ExpressionRow>> {
  const dict = new Map<string, ExpressionRow>();

  function addExpression(row: {
    id?: string | null;
    lemma?: string | null;
    display_form?: string | null;
    normalized_key?: string | null;
    pos?: string | null;
    expression_subtype?: string | null;
  }) {
    const rawKey =
      row.normalized_key ||
      row.lemma ||
      row.display_form ||
      '';

    const key = normalizeExpression(rawKey);

    if (!key) return;
    if (key.includes('/')) return;
    if (/[гґ]/i.test(key)) return;

    const tokenLen = tokenize(key).length;
    if (tokenLen < 2) return;

    const item: ExpressionRow = {
      id: String(row.id ?? ''),
      lemma: row.lemma || key,
      display_form: row.display_form || row.lemma || key,
      normalized_key: key,
      pos: 'expression',
      expression_subtype: row.expression_subtype ?? null,
      token_len: tokenLen,
    };

    if (!item.id) return;

    if (!dict.has(key)) {
      dict.set(key, item);
    }

    // Reflexive variants:
    // glede seg til -> glede meg til / glede deg til / glede oss til / glede dere til
    if (key.includes('seg')) {
      for (const pron of ['meg', 'deg', 'oss', 'dere']) {
        const variant = key.replace(/\bseg\b/g, pron);

        if (variant !== key && !dict.has(variant)) {
          dict.set(variant, {
            ...item,
            normalized_key: variant,
          });
        }
      }
    }
  }

  // 1. Trusted expressions.
  // ФИКС (22.08.2026): пагинировано через fetchAllRows() — риск здесь
  // минимальный (12 строк на момент фикса), но так все три источника
  // одинаково защищены от будущего роста, без исключений на "эта
  // маленькая, ладно так". См. заголовочный комментарий файла.
  const trustedData = await fetchAllRows(async (from, to) => {
    return await supabase
      .from('trusted_expressions_v1')
      .select(`
        id,
        lemma,
        display_form,
        normalized_key,
        pos,
        expression_subtype
      `)
      .not('normalized_key', 'is', null)
      .order('id', { ascending: true })
      .range(from, to);
  });

  for (const row of trustedData) {
    addExpression(row);
  }

  // 2. Expression catalog entries already linked to lexemes.
  // ФИКС (22.08.2026): ГЛАВНОЕ место сегодняшнего бага — было 1743 строки
  // без пагинации, PostgREST обрезал до ~1000. См. заголовочный комментарий
  // файла для полного разбора последствий (осиротевшие expression_id).
  const catalogData = await fetchAllRows(async (from, to) => {
    return await supabase
      .from('expression_catalog')
      .select(`
        id,
        lemma,
        normalized_key,
        lexeme_id,
        expression_subtype,
        verification_status
      `)
      .not('lexeme_id', 'is', null)
      .order('id', { ascending: true })
      .range(from, to);
  });

  for (const row of catalogData) {
    addExpression({
      id: row.id,
      lemma: row.lemma,
      display_form: row.lemma,
      normalized_key: row.normalized_key || row.lemma,
      pos: 'expression',
      expression_subtype: row.expression_subtype,
    });
  }

  // 3. Legacy expressions from lexemes.
  // This is required to restore v6 behavior:
  // old analyzer used lexemes where pos = expression.
  //
  // ФИКС (22.08.2026): тоже было 1783 строки без пагинации — этот
  // источник и подставлял устаревшие id вместо "дыр" источника 2, когда
  // тот был обрезан. Пагинирован по той же причине.
  const lexemeExpressionData = await fetchAllRows(async (from, to) => {
    return await supabase
      .from('lexemes')
      .select(`
        id,
        lemma,
        display_form,
        pos,
        expression_data (
          expression_subtype
        )
      `)
      .eq('pos', 'expression')
      .order('id', { ascending: true })
      .range(from, to);
  });

  for (const row of lexemeExpressionData) {
    const expressionData = Array.isArray(row.expression_data)
      ? row.expression_data[0]
      : null;

    addExpression({
      id: row.id,
      lemma: row.lemma,
      display_form: row.display_form || row.lemma,
      normalized_key: row.lemma,
      pos: 'expression',
      expression_subtype: expressionData?.expression_subtype ?? null,
    });
  }

  console.log('[LOAD EXPRESSIONS]', {
    total: dict.size,
    trusted_rows: trustedData.length,
    catalog_rows: catalogData.length,
    legacy_rows: lexemeExpressionData.length,
    has_ta_med: dict.has('ta med'),
    has_ta_imot: dict.has('ta imot'),
    has_ta_opp: dict.has('ta opp'),
    has_ta_seg_av: dict.has('ta seg av'),
    has_finne_ut: dict.has('finne ut'),
    has_gå_fra_hverandre: dict.has('gå fra hverandre'),
    sample: [...dict.keys()].slice(0, 30),
  });

  return dict;
}

async function loadVerbMaps(): Promise<VerbMaps> {
  // ФИКС (22.08.2026): пагинировано превентивно через fetchAllRows() —
  // 404 строки на момент фикса, безопасно СЕЙЧАС, но растёт с каждой
  // сессией обогащения словаря и рано или поздно пересечёт тот же лимит
  // PostgREST тем же самым молчаливым образом, как это уже случилось с
  // expression_catalog/legacy lexemes. См. заголовочный комментарий файла.
  const data = await fetchAllRows(async (from, to) => {
    return await supabase
      .from('verb_forms')
      .select('infinitiv, presens, perfektum')
      .order('lexeme_id', { ascending: true })
      .range(from, to);
  });

  const presensToInfinitiv = new Map<string, string>();
  const perfektumToInfinitiv = new Map<string, string>();

  for (const row of data) {
    const infinitiv = normalize(row.infinitiv ?? '');
    const presens = normalize(row.presens ?? '');
    const perfektum = normalize(row.perfektum ?? '');

    if (infinitiv && presens) {
      presensToInfinitiv.set(presens, infinitiv);
    }

    if (infinitiv && perfektum) {
      perfektumToInfinitiv.set(perfektum, infinitiv);
    }
  }

  console.log('[LOAD VERB MAPS]', {
    total_rows: data.length,
    presens_map_size: presensToInfinitiv.size,
    perfektum_map_size: perfektumToInfinitiv.size,
  });

  return {
    presensToInfinitiv,
    perfektumToInfinitiv,
  };
}


// ============================================================================
// CONTEXTUAL POS FALLBACKS (v1.4)
//
// PostgreSQL RPC уже получает контекст, но для части омонимов в БД может не
// быть полной form-variant связи. Поэтому перед передачей кандидатов в
// grammar-parser мы:
//   1) нормализуем POS для общеизвестных местоимений, если старая строка
//      lexemes всё ещё имеет pos='unknown';
//   2) при необходимости догружаем альтернативную лексему по lemma+pos:
//        nå  -> adverb
//        sin/sitt/sine -> pronoun, lemma=sin
//
// Это не подменяет RPC и не создаёт искусственные UUID: дополнительный
// кандидат добавляется только если соответствующая реальная лексема уже
// существует в public.lexemes.
// ============================================================================

const KNOWN_PRONOUN_SURFACES = new Set([
  'jeg', 'du', 'han', 'hun', 'hen', 'vi', 'dere', 'de',
  'meg', 'deg', 'ham', 'henne', 'oss', 'dem',
  'den', 'det', 'seg',
]);

const POS_FALLBACK_CACHE = new Map<string, SurfaceResolution | null>();

function normalizeKnownResolutionPos(
  surfaceForm: string,
  resolution: SurfaceResolution,
): SurfaceResolution {
  const surface = normalizeExpression(surfaceForm);

  if (
    KNOWN_PRONOUN_SURFACES.has(surface) &&
    String(resolution.pos ?? '').toLowerCase() === 'unknown'
  ) {
    return {
      ...resolution,
      pos: 'pronoun',
      grammatical_features: {
        ...(resolution.grammatical_features ?? {}),
        pos_override: 'known_pronoun_surface',
      },
      confidence:
        resolution.confidence === 'low' ? 'high' : resolution.confidence,
    };
  }

  return resolution;
}

async function loadLexemeFallbackResolution(
  lemma: string,
  pos: string,
  surfaceForm: string,
  formType: string,
  featureReason: string,
): Promise<SurfaceResolution | null> {
  const cacheKey = `${lemma}::${pos}::${formType}`;

  if (POS_FALLBACK_CACHE.has(cacheKey)) {
    return POS_FALLBACK_CACHE.get(cacheKey) ?? null;
  }

  const { data, error } = await supabase
    .from('lexemes')
    .select('id, lemma, pos')
    .eq('lemma', lemma)
    .eq('pos', pos)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[SURFACE FALLBACK LOOKUP FAILED]', {
      lemma,
      pos,
      surfaceForm,
      error: error.message,
    });
    POS_FALLBACK_CACHE.set(cacheKey, null);
    return null;
  }

  if (!data?.id) {
    POS_FALLBACK_CACHE.set(cacheKey, null);
    return null;
  }

  const resolution: SurfaceResolution = {
    lexeme_id: data.id,
    lemma: data.lemma,
    pos: data.pos,
    form_type: formType,
    grammatical_features: {
      surface: surfaceForm,
      resolver: 'contextual_lexeme_fallback',
      reason: featureReason,
    },
    confidence: 'high',
    source: 'lexemes',
  };

  POS_FALLBACK_CACHE.set(cacheKey, resolution);
  return resolution;
}

function hasResolution(
  resolutions: SurfaceResolution[],
  lemma: string,
  pos: string,
): boolean {
  return resolutions.some(
    (row) =>
      normalizeExpression(row.lemma) === normalizeExpression(lemma) &&
      String(row.pos ?? '').toLowerCase() === pos,
  );
}

// ФИКС (v1.3): resolveSurfaceForm теперь возвращает МАССИВ вариантов, а не
// один. Раньше брался только data[0] — первая строка ответа RPC, даже если
// RPC вернула несколько (что теперь происходит намеренно для слов без
// контекста — см. shared параметр context ниже и комментарий в
// resolve_surface_form SQL). Обратная совместимость: если RPC вернула ровно
// одну строку (как раньше для однозначных слов), массив будет содержать
// один элемент — вызывающий код (grammar-parser.ts) обрабатывает оба
// случая одинаково через цикл.
async function resolveSurfaceForm(
  surfaceForm: string,
  context?: SurfaceFormContext,
): Promise<SurfaceResolution[]> {
  const { data, error } = await supabase.rpc('resolve_surface_form', {
    p_surface_form: surfaceForm,
    p_prev_token: context?.prevToken ?? null,
    p_next_token: context?.nextToken ?? null,
    p_preceded_by_infinitive_marker:
      context?.precededByInfinitiveMarker ?? false,
  });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];

  const resolutions: SurfaceResolution[] = rows
    .filter((row: any) => row?.lexeme_id && row?.lemma)
    .map((row: any) =>
      normalizeKnownResolutionPos(surfaceForm, {
        lexeme_id: row.lexeme_id,
        lemma: row.lemma,
        pos: row.pos,
        form_type: row.form_type,
        grammatical_features: row.grammatical_features ?? {},
        confidence: row.confidence,
        source: row.source,
      })
    );

  const surface = normalizeExpression(surfaceForm);

  // "nå" может быть глаголом "достигать" и наречием "сейчас".
  // Если RPC вернула только глагол, добавляем существующую adverb-лексему
  // как альтернативу. Окончательный выбор делает grammar-parser по контексту.
  if (surface === 'nå' && !hasResolution(resolutions, 'nå', 'adverb')) {
    const adverbFallback = await loadLexemeFallbackResolution(
      'nå',
      'adverb',
      surfaceForm,
      'base',
      'nå_adverb_candidate',
    );

    if (adverbFallback) {
      resolutions.push(adverbFallback);
    }
  }

  // Притяжательное местоимение sin имеет формы sin/sitt/sine.
  // Если RPC увидела в "sitt" только imperative глагола sitte, догружаем
  // реальную pronoun-лексему sin и передаём оба варианта parser'у.
  if (
    ['sin', 'sitt', 'sine'].includes(surface) &&
    !hasResolution(resolutions, 'sin', 'pronoun')
  ) {
    const pronounFallback = await loadLexemeFallbackResolution(
      'sin',
      'pronoun',
      surfaceForm,
      surface === 'sitt'
        ? 'possessive_neuter'
        : surface === 'sine'
        ? 'possessive_plural'
        : 'possessive_common',
      'possessive_pronoun_candidate',
    );

    if (pronounFallback) {
      resolutions.push(pronounFallback);
    }
  }

  return resolutions;
}

async function loadLexeme360NetworkCandidates(
  rootLemmas: string[],
  existingExpressionIds: Set<string>,
): Promise<Lexeme360CandidateRow[]> {
  if (!rootLemmas.length) return [];

  const { data, error } = await supabase
    .from('expression_catalog')
    .select(`
      id,
      lemma,
      root_lemma,
      lexeme_id,
      expression_subtype,
      verification_status,
      verification
    `)
    .in('root_lemma', rootLemmas)
    .not('lemma', 'is', null)
    .order('root_lemma')
    .order('lemma');

  if (error) throw error;

  const byRootCount = new Map<string, number>();
  const result: Lexeme360CandidateRow[] = [];

  for (const row of data ?? []) {
    const id = String(row.id ?? '');
    const lemma = normalizeExpression(row.lemma ?? '');
    const root = normalizeRootLemma(row.root_lemma ?? '');

    if (!id || !lemma || !root) continue;
    if (existingExpressionIds.has(id)) continue;
    if (lemma.includes('/')) continue;
    if (/[гґ]/i.test(lemma)) continue;

    const count = byRootCount.get(root) ?? 0;
    if (count >= MAX_360_CANDIDATES_PER_ROOT) continue;

    byRootCount.set(root, count + 1);

    result.push({
      ...row,
    } as Lexeme360CandidateRow);
  }

  console.log('[LEXEME360 FAMILY]', {
    roots: rootLemmas,
    found: result.length,
    items: result.map((r) => ({
      lemma: r.lemma,
      root_lemma: r.root_lemma,
      lexeme_id: r.lexeme_id,
      subtype: r.expression_subtype,
      verification_status: r.verification_status,
      card_type: r.lexeme_id ? 'ready' : 'candidate',
    })),
  });

  return result;
}

async function addLexeme360NetworkCandidates(
  items: PlannedItem[],
): Promise<{
  roots: string[];
  added: number;
  candidates: Lexeme360CandidateRow[];
}> {
  const roots = collectRootLemmasFor360(items);

  const existingExpressionIds = new Set(
    items
      .map((item) => item.expression_id)
      .filter((id): id is string => Boolean(id)),
  );

  const candidates = await loadLexeme360NetworkCandidates(
    roots,
    existingExpressionIds,
  );

  if (!candidates.length) {
    return {
      roots,
      added: 0,
      candidates: [],
    };
  }

  const existingNormalizedExpressions = new Set(
    items
      .filter((item) => item.match_type === 'expression')
      .map((item) =>
        normalizeExpression(item.normalized_lemma || item.normalized_input)
      )
      .filter(Boolean),
  );

  let tokenPosition = items.length;
  let added = 0;

  for (const candidate of candidates) {
    const normalizedExpression = normalizeExpression(candidate.lemma);
    const root = normalizeRootLemma(candidate.root_lemma);

    if (!normalizedExpression || existingNormalizedExpressions.has(normalizedExpression)) {
      continue;
    }

    items.push({
      raw_input: candidate.lemma,
      normalized_input: normalizedExpression,
      normalized_lemma: normalizedExpression,
      surface_form: candidate.lemma,
      pos: 'expression',
      match_type: 'expression',
      expression_id: candidate.id,
      token_start: tokenPosition,
      token_end: tokenPosition,
      expression_subtype: candidate.expression_subtype ?? null,
      resolved: candidate.lexeme_id
        ? {
            lexeme_id: candidate.lexeme_id,
            lemma: normalizedExpression,
            pos: 'expression',
            form_type: 'expression',
            grammatical_features: {
              resolver: 'lexeme360_network',
              expression_id: candidate.id,
              root_lemma: root,
              verification_status: candidate.verification_status ?? null,
              verification: candidate.verification ?? null, // ДОБАВЛЕНО
              expression_subtype: candidate.expression_subtype ?? null,
            },
            confidence: 'high',
            source: 'lexeme360_network',
          }
        : null,
      match_strategy: 'lexeme360_network_candidate',
      compound_normalized: null,
      network_root_lemma: root,
    });

    tokenPosition++;
    added++;
    existingNormalizedExpressions.add(normalizedExpression);
  }

  return {
    roots,
    added,
    candidates,
  };
}

// ФИКС: dedupePlannedItems — финальный защитный проход по всему массиву
// plannedItems перед вставкой в БД.
function dedupePlannedItems(items: PlannedItem[]): PlannedItem[] {
  const seen = new Set<string>();
  const result: PlannedItem[] = [];
  let removed = 0;

  for (const item of items) {
    const posKey = item.resolved?.pos ?? item.pos ?? 'unknown';
    const key = item.expression_id
      ? `expr:${item.expression_id}:${item.token_start}:${item.token_end}`
      : `${item.match_type}:${normalizeExpression(item.normalized_lemma || item.normalized_input)}:${item.token_start}:${item.token_end}:${posKey}`;

    if (seen.has(key)) {
      removed++;
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  if (removed > 0) {
    console.log('[DEDUPE PLANNED ITEMS]', {
      before: items.length,
      after: result.length,
      removed,
    });
  }

  return result;
}

async function insertSourceChecksBatch(
  jobId: string,
  rows: Array<{
    itemId: string;
    lexemeId: string | null;
    query: string;
    surfaceForm: string;
    queryType: 'expression' | 'token';
  }>,
) {
  const sourceRows = rows.flatMap((row) =>
    SOURCES.map((source) => ({
      job_id: jobId,
      item_id: row.itemId,
      lexeme_id: row.lexemeId,
      source,
      stage: 'lemma',
      query: row.query,
      surface_form: row.surfaceForm,
      query_type: row.queryType,
      status: 'pending',
      attempt_count: 0,
      max_attempts: 3,
      evidence: {},
      urls: [],
      verification_version: 1,
    }))
  );

  if (!sourceRows.length) return;

  const { error } = await supabase
    .from('lexeme_source_checks')
    .insert(sourceRows);

  if (error) throw error;
}

async function queueSkippedItemsForEnrichment(
  entries: Array<{ kind: 'lexeme' | 'expression'; id: string }>,
) {
  if (!entries.length) return;

  const uniqueLexemeIds = [
    ...new Set(
      entries.filter((e) => e.kind === 'lexeme').map((e) => e.id),
    ),
  ];
  const uniqueExpressionIds = [
    ...new Set(
      entries.filter((e) => e.kind === 'expression').map((e) => e.id),
    ),
  ];

  if (uniqueLexemeIds.length > 0) {
    const { error: lexemeEnrichmentError } = await supabase
      .from('lexeme_semantic_enrichment')
      .upsert(
        uniqueLexemeIds.map((lexeme_id) => ({
          lexeme_id,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'lexeme_id' },
      );

    if (lexemeEnrichmentError) {
      console.error(
        '[SKIP-VERIFIED ENRICHMENT QUEUE] lexeme upsert failed:',
        lexemeEnrichmentError,
      );
    }
  }

  if (uniqueExpressionIds.length > 0) {
    const { error: expressionEnrichmentError } = await supabase
      .from('expression_semantic_enrichment')
      .upsert(
        uniqueExpressionIds.map((expression_id) => ({
          expression_id,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'expression_id' },
      );

    if (expressionEnrichmentError) {
      console.error(
        '[SKIP-VERIFIED ENRICHMENT QUEUE] expression upsert failed:',
        expressionEnrichmentError,
      );
    }
  }
}

async function insertItems(jobId: string, items: PlannedItem[]) {
  let expressionItems = 0;
  let tokenItems = 0;
  let lexeme360NetworkItems = 0;
  let generatedExpressionCandidates = 0;
  let skippedAlreadyVerified = 0;
  let homonymRechecksForced = 0;

  const sourceCheckRows: Array<{
    itemId: string;
    lexemeId: string | null;
    query: string;
    surfaceForm: string;
    queryType: 'expression' | 'token';
  }> = [];

  const enrichmentQueue: Array<{ kind: 'lexeme' | 'expression'; id: string }> = [];

  for (const item of items) {
    const skip = Boolean((item as any).skip_source_checks);
    const isExpressionPath = item.match_type === 'expression';

    const { data, error } = await supabase
      .from('lexeme_processing_items')
      .insert({
        job_id: jobId,
        expression_id: item.expression_id,
        lexeme_id:
          skip && !isExpressionPath ? (item.resolved?.lexeme_id ?? null) : null,
        raw_input: item.raw_input,
        normalized_input: item.normalized_input,
        normalized_lemma: item.normalized_lemma,
        surface_form: item.surface_form,
        pos: item.pos,
        match_type: item.match_type,
        status: skip ? 'done' : 'pending',
        current_stage: skip ? 'semantic_audit' : 'source_checks',
        attempt_count: 0,
        max_attempts: 3,
        result_summary: {
          ingestion_version: INGESTION_VERSION,
          token_start: item.token_start,
          token_end: item.token_end,
          expression_subtype: item.expression_subtype ?? null,
          verification_status: (item as any).verification_status ?? null,
          match_strategy: item.match_strategy ?? null,
          compound_normalized: item.compound_normalized ?? null,
          network_root_lemma: item.network_root_lemma ?? null,
          resolved_lexeme_id: item.resolved?.lexeme_id ?? null,
          resolved_lemma: item.resolved?.lemma ?? null,
          resolved_pos: item.resolved?.pos ?? null,
          resolved_form_type: item.resolved?.form_type ?? null,
          resolved_confidence: item.resolved?.confidence ?? null,
          resolved_source: item.resolved?.source ?? null,
          resolved_features:
            item.resolved?.grammatical_features ?? null,
          ...(skip
            ? {
                promotion_status: 'already_verified_skip',
                promotion_version: 'ingestion_skip_already_verified_v1',
              }
            : {}),
          ...((item as any)._homonym_recheck_forced
            ? {
                homonym_recheck_forced: true,
                homonym_recheck_version: 'homonym_recheck_v1',
              }
            : {}),
        },
      })
      .select('id')
      .single();

    if (error) throw error;

    if (item.match_type === 'expression') {
      expressionItems++;
    } else {
      tokenItems++;
    }

    if (item.match_strategy === 'lexeme360_network_candidate') {
      lexeme360NetworkItems++;
    }

    if (item.match_strategy === 'candidate_generator') {
      generatedExpressionCandidates++;
    }

    if ((item as any)._homonym_recheck_forced) {
      homonymRechecksForced++;
    }

    if (skip) {
      skippedAlreadyVerified++;

      if (isExpressionPath && item.expression_id) {
        enrichmentQueue.push({ kind: 'expression', id: item.expression_id });
      } else if (!isExpressionPath && item.resolved?.lexeme_id) {
        enrichmentQueue.push({ kind: 'lexeme', id: item.resolved.lexeme_id });
      }

      continue;
    }

    const verificationQuery =
      item.match_type === 'expression'
        ? item.normalized_lemma
        : (item.normalized_lemma || item.normalized_input);

    sourceCheckRows.push({
      itemId: data.id,
      lexemeId: item.resolved?.lexeme_id ?? null,
      query: verificationQuery,
      surfaceForm: item.surface_form,
      queryType: item.match_type,
    });
  }

  await insertSourceChecksBatch(jobId, sourceCheckRows);
  await queueSkippedItemsForEnrichment(enrichmentQueue);

  return {
    expressionItems,
    tokenItems,
    lexeme360NetworkItems,
    generatedExpressionCandidates,
    skippedAlreadyVerified,
    homonymRechecksForced,
  };
}

async function triggerOrchestrator(jobId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/job-orchestrator`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: jobId,
      }),
    },
  );

  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      `job-orchestrator failed for job ${jobId}: ${response.status} ${response.statusText} ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

serve(withSupabase({ auth: 'user' }, async (req, context) => {
  try {
    const authenticatedUserId = context.userClaims?.id?.trim() ?? '';

    if (!authenticatedUserId) {
      return Response.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = String(body.text || '').trim();

    const isolatedMode = body.mode === 'word_list';

    console.log('[ENCODING DEBUG] raw text:', text);
    console.log(
      '[ENCODING DEBUG] char codes:',
      Array.from(text.slice(0, 20)).map((c) => c.charCodeAt(0)),
    );

    if (!text) {
      return Response.json(
        {
          ok: false,
          error: 'Text is required',
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    const { data: jobId, error: jobError } = await supabase.rpc(
      'create_empty_text_analysis_job',
      {
        p_text: text,
        // Ownership is derived only from the verified session JWT.
        // A caller-supplied user_id must never be trusted.
        p_user_id: authenticatedUserId,
        p_ingestion_version: INGESTION_VERSION,
      },
    );

    if (jobError) throw jobError;

    const expressionDict = await loadExpressions();

    console.log('[PARSER DICT]', {
      size: expressionDict.size,
      has_ta_med: expressionDict.has('ta med'),
      has_ta_imot: expressionDict.has('ta imot'),
      has_ta_opp: expressionDict.has('ta opp'),
      has_ta_seg_av: expressionDict.has('ta seg av'),
      has_finne_ut: expressionDict.has('finne ut'),
      has_gå_fra_hverandre: expressionDict.has('gå fra hverandre'),
      sample: [...expressionDict.keys()].slice(0, 30),
    });

    const verbMaps = await loadVerbMaps();

    const plannedItems = await planItems(
      text,
      expressionDict,
      verbMaps,
      resolveSurfaceForm,
      { isolatedMode },
    );

    const generatedCandidates = generateExpressionCandidates(plannedItems);
    plannedItems.push(...generatedCandidates);

    const candidateBridgeResult = await resolveCandidatesAgainstCatalog(
      supabase,
      plannedItems,
    );

    const expressionResolution = await resolveExpressions(
      supabase,
      plannedItems,
    );

    const lexeme360Network = await addLexeme360NetworkCandidates(plannedItems);

    const dedupedPlannedItems = dedupePlannedItems(plannedItems);
    plannedItems.length = 0;
    plannedItems.push(...dedupedPlannedItems);

    const resolvedLexemeIds = plannedItems
      .map((i) => i.resolved?.lexeme_id)
      .filter((id): id is string => Boolean(id));

    if (resolvedLexemeIds.length > 0) {
      const { data: lexemeData } = await supabase
        .from('lexemes')
        .select('id, cefr_level, frequency_rank, frequency_ipm, verification, verification_version')
        .in('id', resolvedLexemeIds);

      if (lexemeData?.length) {
        const lexemeMap = new Map(
          lexemeData.map((l) => [
            l.id,
            {
              cefr_level: l.cefr_level ?? null,
              frequency_rank: l.frequency_rank ?? null,
              frequency_ipm: l.frequency_ipm ?? null,
              verification: l.verification ?? null,
              verification_version: l.verification_version ?? null,
            },
          ])
        );

        for (const item of plannedItems) {
          const lid = item.resolved?.lexeme_id;

          if (lid && lexemeMap.has(lid)) {
            const meta = lexemeMap.get(lid)!;
            (item as any).cefr_level = meta.cefr_level;
            (item as any).frequency_rank = meta.frequency_rank;
            (item as any).frequency_ipm = meta.frequency_ipm;

            if (
              meta.verification === 'verified_dictionary' &&
              (meta.verification_version ?? 0) >= TARGET_VERIFICATION_VERSION
            ) {
              if (shouldForceHomonymRecheck()) {
                (item as any)._homonym_recheck_forced = true;
              } else {
                (item as any).skip_source_checks = true;
              }
            }
          }
        }
      }
    }

    const resolvedExpressionIds = plannedItems
      .map((i) => i.expression_id)
      .filter((id): id is string => Boolean(id));

    if (resolvedExpressionIds.length > 0) {
      const { data: expressionData } = await supabase
        .from('expression_catalog')
        .select('id, verification_status, verification_tier, verification_version')
        .in('id', resolvedExpressionIds);

      if (expressionData?.length) {
        const expressionMap = new Map(
          expressionData.map((e) => [
            e.id,
            {
              verification_status: e.verification_status ?? null,
              verification_tier: e.verification_tier ?? null,
              verification_version: e.verification_version ?? null,
            },
          ])
        );

        for (const item of plannedItems) {
          if (item.expression_id && expressionMap.has(item.expression_id)) {
            const meta = expressionMap.get(item.expression_id)!;

            if (
              isSufficientlyVerifiedExpression(meta.verification_tier, meta.verification_status) &&
              (meta.verification_version ?? 0) >= TARGET_VERIFICATION_VERSION
            ) {
              if (shouldForceHomonymRecheck()) {
                (item as any)._homonym_recheck_forced = true;
              } else {
                (item as any).skip_source_checks = true;
              }
            }
          }
        }
      }
    }

    const {
      expressionItems,
      tokenItems,
      lexeme360NetworkItems,
      generatedExpressionCandidates,
      skippedAlreadyVerified,
      homonymRechecksForced,
    } = await insertItems(jobId, plannedItems);

    const { error: jobUpdateError } = await supabase
      .from('lexeme_processing_jobs')
      .update({
        total_items: plannedItems.length,
        summary: {
          ingestion_version: INGESTION_VERSION,
          total_items: plannedItems.length,
          expression_items: expressionItems,
          parser_expression_items: expressionItems,
          token_items: tokenItems,
          generated_expression_candidates: generatedExpressionCandidates,
          candidate_catalog_bridge_matched: candidateBridgeResult.matched,
          candidate_catalog_bridge_unmatched: candidateBridgeResult.unmatched,
          lexeme360_network_items: lexeme360NetworkItems,
          lexeme360_roots: lexeme360Network.roots,
          lexeme360_candidates_found: lexeme360Network.candidates.length,
          lexeme360_candidates_added: lexeme360Network.added,
          source_checks_per_item: SOURCES.length,
          skipped_already_verified: skippedAlreadyVerified,
          homonym_rechecks_forced: homonymRechecksForced,
          homonym_recheck_probability: HOMONYM_RECHECK_PROBABILITY,
          isolated_mode: isolatedMode,
          surface_resolver: true,
          compound_normalization: true,
          legacy_aligned_expression_parser: true,
          legacy_expression_lexemes: true,
          candidate_generator: true,
          candidate_catalog_bridge: true,
          expression_resolver: true,
          resolved_expressions: expressionResolution.resolved,
          unresolved_expressions: expressionResolution.unresolved,
          strict_verified_expression_catalog: true,
          lexeme360_network_enrichment: true,
          lexeme360_root_fix: true,
          raw_token_preservation: true,
          batched_source_checks: true,
          skip_already_verified_fix: true,
          word_list_pos_dedup_fix: true,
          homonym_recheck_fix: true,
          paginated_loads_fix: true,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (jobUpdateError) throw jobUpdateError;

    EdgeRuntime.waitUntil(
      triggerOrchestrator(jobId).catch((error) => {
        console.error(
          'Background job-orchestrator failed:',
          error instanceof Error ? error.message : String(error),
        );
        console.error(
          'Background job-orchestrator stack:',
          error instanceof Error ? error.stack : null,
        );
      }),
    );

    const orchestratorResult = {
      queued: true,
      mode: 'background',
      job_id: jobId,
    };

    const {
      data: job,
      error: jobReadError,
    } = await supabase
      .from('lexeme_processing_jobs')
      .select(`
        id,
        status,
        total_items,
        done_items,
        partial_items,
        failed_items,
        skipped_items,
        summary,
        created_at
      `)
      .eq('id', jobId)
      .single();

    if (jobReadError) throw jobReadError;

    return Response.json(
      {
        ok: true,
        job,
        ingestion: {
          planned_items: plannedItems,
          expression_items: expressionItems,
          parser_expression_items: expressionItems,
          token_items: tokenItems,
          generated_expression_candidates: generatedExpressionCandidates,
          candidate_catalog_bridge_matched: candidateBridgeResult.matched,
          candidate_catalog_bridge_unmatched: candidateBridgeResult.unmatched,
          resolved_expressions: expressionResolution.resolved,
          unresolved_expressions: expressionResolution.unresolved,
          lexeme360_network_items: lexeme360NetworkItems,
          lexeme360_roots: lexeme360Network.roots,
          lexeme360_candidates_found: lexeme360Network.candidates.length,
          lexeme360_candidates_added: lexeme360Network.added,
          skipped_already_verified: skippedAlreadyVerified,
          homonym_rechecks_forced: homonymRechecksForced,
        },
        orchestrator: orchestratorResult,
      },
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('ANALYZE-TEXT ERROR:', error);
    console.error(
      'ANALYZE-TEXT STACK:',
      error instanceof Error ? error.stack : null,
    );

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      },
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
}));
