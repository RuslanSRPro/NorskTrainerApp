// components/Lexeme360.tsx
// Norsk Trainer App — Lexeme 360° v2
//
// Purpose:
//   Lexeme360 is NOT a generic related-words view.
//   It shows meaning extensions: stable expressions/constructions where
//   the base lemma changes or extends its meaning.
//
// Data model:
//   - lexemes: core lemma, POS, CEFR, frequency, morphology joins
//   - entity_translations: Lexin/Wiktionary translations and definitions
//   - entity_examples: examples
//   - expression_catalog: primary source for meaning extensions
//   - authoritative_semantic_relations: secondary source ONLY for allowed
//     meaning-extension relation types
//
// Excluded from 360 core:
//   - plain collocation
//   - synonym
//   - related/topic/semantic_related
//
// Those may become separate UI blocks later, but they are not meaning change.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '@/services/supabase';
import { t, AppLanguage } from '@/services/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { addLexemeToLearningFromSupabase } from '@/services/api';
import {
  Lexeme360Carousel,
  type Lexeme360CarouselItem,
} from '@/components/Lexeme360Carousel';

// ── Constants ────────────────────────────────────────────────────────────────

const LEXEME360_ALLOWED_TYPES = [
  // legacy / internal semantic types
  'particle_variant',
  'expression_family',
  'idiom_extension',
  'grammar_pattern',
  'prepositional_verb',
  'reflexive_expression',
  'collocation_with_shift',

  // expression_catalog subtypes used by the current enrichment pipeline
  'particle_verb',
  'reflexive_particle_verb',
  'reflexive_construction',
  'verb_expression',
  'idiom',

  // Most verb-particle/prepositional/reflexive expressions sourced from
  // Ordbokene sub-articles carry this subtype (e.g. "ta opp", "ta imot",
  // "ta seg av"). NOTE: this subtype alone does NOT distinguish verb-based
  // meaning-shift expressions from noun-rooted proverbs/fixed phrases
  // ("barn av sin tid", "brent barn skyr ilden") — both used the same
  // subtype historically.
  //
  // Primary filtering happens during analyze-text root collection
  // (isLexicalRootCandidate / LEXEME360_ROOT_ALLOWED_POS restricts which
  // words are even eligible to become a Lexeme360 root — verb/expression
  // only, no noun). This allowlist here is the second line of defense,
  // against a DIFFERENT category of noise (plain collocations, synonyms,
  // topic-relations — see LEXEME360_EXCLUDED_TYPES below), not against
  // noun-rooted proverbs — that problem is already solved upstream.
  'ordbokene_sub_article',

  // authoritative_semantic_relations relation type
  'has_expression',

  // FUTURE — nouns: we're not currently aware of a verified case where the
  // same NOUN's meaning genuinely SHIFTS the way "ta" + particle does
  // (ta → ta opp, ta seg av, ...). What we've seen under noun roots so far
  // (e.g. "barn") has been proverbs/fixed sayings with a stable meaning,
  // not a shifting one — a different category, intentionally out of scope.
  // If a genuine noun-based meaning-extension family is identified later,
  // add its specific expression_subtype here explicitly, rather than
  // reopening root collection to all nouns.
] as const;

const LEXEME360_ALLOWED_TYPE_SET = new Set<string>(LEXEME360_ALLOWED_TYPES);

const LEXEME360_EXCLUDED_TYPES = new Set<string>([
  'collocation',
  'synonym',
  'antonym',
  'related',
  'related_candidate',
  'semantic_related',
  'topic',
  'usage_context',
]);

const CEFR_COLORS: Record<string, string> = {
  A1: '#16A34A',
  A2: '#22C55E',
  B1: '#2563EB',
  B2: '#3B82F6',
  C1: '#9333EA',
  C2: '#A855F7',
};

// ── Types ────────────────────────────────────────────────────────────────────

type RelatedItem = Lexeme360CarouselItem & {
  expression_subtype?: string;
  source_system?: 'expression_catalog' | 'authoritative_semantic_relations';
};

type GrammarForms = {
  infinitiv?: string;
  presens?: string;
  preteritum?: string;
  perfektum?: string;
  gruppe?: string;

  ubest_entall?: string;
  best_entall?: string;
  ubest_flertall?: string;
  best_flertall?: string;
  official_gender?: string;

  positiv?: string;
  intetkjonn?: string;
  flertall?: string;
  komparativ?: string;
  superlativ?: string;
};

type SenseRow = {
  sense_rank: number;
  uk: string;
  en: string;
};

type DefinitionRow = {
  text: string;
  source: string;
};

type ExampleRow = {
  text: string;
  translation_uk?: string | null;
  cefr_level?: string | null;
  source?: string | null;
};

type Lexeme360Data = {
  id: string;
  lemma: string;
  pos: string;
  translation_ua?: string;
  translation_en?: string;
  translation_no?: string;
  cefr_level?: string | null;
  frequency_rank?: number | null;
  frequency_ipm?: number | null;
  all_senses?: SenseRow[];
  definitions: DefinitionRow[];
  examples: ExampleRow[];
  grammar: GrammarForms;
  relations: RelatedItem[];
  // ФИКС: исходный lexemeId, с которым открыли Lexeme360 — может
  // отличаться от `id`, если открытая лексема сама оказалась выражением
  // и данные шапки были подгружены для её корня. Используется только для
  // подсветки нужной карточки в карусели, на отображение шапки не влияет.
  requestedId?: string;
};

type TargetMeta = {
  id: string;
  relation_type: string;
  source_system: 'expression_catalog' | 'authoritative_semantic_relations';
  confidence: number;
  expression_subtype?: string;
  sort_score: number;
};

// ── Small helpers ────────────────────────────────────────────────────────────

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeRootLemma(value: unknown): string {
  return normalizeText(value)
    .replace(/^å\s+/i, '')
    .toLowerCase()
    .trim();
}

function resolveLang(
  lang?: AppLanguage | string | null,
  isUaLegacy?: boolean,
): AppLanguage {
  if (lang === 'ua' || lang === 'en' || lang === 'no') return lang;
  return isUaLegacy ? 'ua' : 'en';
}

function safeT(key: string, lang: AppLanguage, fallback: string) {
  try {
    const value = t(key as any, lang as any);
    if (value && value !== key) return value;
  } catch {
    // keep fallback
  }

  return fallback;
}

function pickLexemeTranslation(
  item: {
    translation_ua?: string;
    translation_en?: string;
    translation_no?: string;
  },
  lang: AppLanguage,
) {
  const ua = item.translation_ua || '';
  const en = item.translation_en || '';
  const no = item.translation_no || '';

  if (lang === 'ua') return ua || en || no;
  if (lang === 'no') return no || en || ua;
  return en || ua || no;
}

function displayLemmaWithInfinitiveMarker(lemma: string, pos?: string) {
  const value = normalizeText(lemma);
  const safePos = normalizeText(pos).toLowerCase();

  if (!value) return value;
  if (value.toLowerCase().startsWith('å ')) return value;

  if (
    safePos === 'verb' ||
    safePos.includes('verb') ||
    safePos === 'expression'
  ) {
    return `å ${value}`;
  }

  return value;
}

function relationConfidenceToNumber(value: unknown): number {
  if (typeof value === 'number') return value;

  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'high') return 1;
  if (normalized === 'medium') return 0.7;
  if (normalized === 'low') return 0.45;

  return 0.5;
}

function isAllowedMeaningExtensionType(value: unknown): boolean {
  const type = normalizeText(value);
  return Boolean(type) && LEXEME360_ALLOWED_TYPE_SET.has(type);
}

function isExplicitlyExcludedType(value: unknown): boolean {
  const type = normalizeText(value);
  return Boolean(type) && LEXEME360_EXCLUDED_TYPES.has(type);
}

// ФИКС: subtype-фильтр реально подключён (раньше isAllowedMeaningExtensionType
// и isExplicitlyExcludedType были объявлены, но никогда не вызывались — карусель
// показывала relations без какой-либо фильтрации по expression_subtype).
//
// Правило:
//   - subtype отсутствует (null/'') → пропускаем. Это legacy/network-resolved
//     записи без явной классификации (например старые "ta imot" с
//     expression_subtype: null) — не наказываем за отсутствие метаданных,
//     раз они уже прошли verification_status gate на уровне RPC.
//   - subtype явно в LEXEME360_EXCLUDED_TYPES → блокируем всегда, без лога
//     (это известная, осознанно исключённая категория — не новость).
//   - subtype не пустой, не excluded, но и не в allowlist → блокируем
//     И логируем предупреждение. Это единственный случай, где нужен лог:
//     кто-то новый субтайп начал приходить из воркеров обогащения, а
//     allowlist о нём не знает. Без такого лога это тихо исчезнет из UI,
//     и через несколько месяцев никто не вспомнит, что стоило бы туда
//     заглянуть и решить — расширять allowlist или явно исключить.
function shouldIncludeInLexeme360(subtype: unknown): boolean {
  const type = normalizeText(subtype);
  if (!type) return true;
  if (isExplicitlyExcludedType(type)) return false;

  if (!isAllowedMeaningExtensionType(type)) {
    console.warn(
      '[Lexeme360] Unknown expression_subtype (blocked, not in allowlist):',
      type,
    );
    return false;
  }

  return true;
}

// ФИКС: защита по row.status, дополнительно к subtype. Subtype говорит
// "какая это категория выражения", но не говорит "актуальна ли запись
// прямо сейчас" — если expression_catalog/RPC когда-нибудь получит
// статус вроде 'deleted'/'obsolete' (например, запись помечена устаревшей
// после ручной модерации), это должно блокировать показ независимо от
// того, насколько subtype выглядит легитимным. Сейчас текущие RPC
// (get_lexeme360_ready_expressions / get_lexeme360_candidate_expressions)
// такого поля не возвращают — проверка сейчас no-op, но готова к моменту,
// когда поле появится, без необходимости искать этот код заново.
function isDeletedOrObsoleteStatus(status: unknown): boolean {
  const value = normalizeText(status).toLowerCase();
  return value === 'deleted' || value === 'obsolete';
}

// ФИКС: дедуп при слиянии ready + candidate веток. Их id живут в разных
// пространствах (ready.id = реальный lexeme_id; candidate.id = `candidate-${expression_catalog.id}`),
// поэтому дедуп по id их не поймает — если один и тот же lemma text
// когда-нибудь попадёт в оба RPC одновременно (например, "ta opp" уже
// готово, но по какой-то причине ещё раз всплыло как candidate), в UI
// показались бы два одинаковых элемента карусели. Дешёвая защита: дедуп
// по нормализованной лемме, первое вхождение побеждает — а поскольку
// relations (ready) всегда идут в массиве раньше candidateRelations,
// ready естественным образом получает приоритет над candidate.
function dedupeRelationsByLemma(items: RelatedItem[]): RelatedItem[] {
  const seen = new Set<string>();
  const result: RelatedItem[] = [];

  for (const item of items) {
    const key = normalizeText(item.lemma).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function getMeaningExtensionTitle(lang: AppLanguage) {
  if (lang === 'ua') return 'Зміна значення';
  if (lang === 'no') return 'Betydningsendringer';
  return 'Meaning extensions';
}

function getMeaningExtensionSubtitle(lang: AppLanguage) {
  if (lang === 'ua') {
    return 'Стійкі вирази, де базове слово набуває нового значення';
  }

  if (lang === 'no') {
    return 'Faste uttrykk der grunnordet får en ny betydning';
  }

  return 'Fixed expressions where the base word gets a new meaning';
}

// ── Data fetch ───────────────────────────────────────────────────────────────

async function fetchLexeme360(lexemeId: string): Promise<Lexeme360Data | null> {
  // 0. ФИКС v4: раньше шапка (лемма/POS/CEFR/переводы/формы) всегда
  // подгружалась ДЛЯ ТОГО lexemeId, что был передан в компонент — если
  // открывали "ta til" (саму expression), шапка показывала "å ta til".
  //
  // ВАЖНО: expression_catalog.lexeme_id указывает на САМУ expression (её
  // собственную карточку, когда та "стала словом"), а НЕ на корень — это
  // выяснилось только после того, как предыдущая версия фикса (через
  // root_lexeme_id из RPC) вернула тот же id, что и на входе, ничего не
  // меняя, и полностью сломала карусель (root_lemma снова стал "ta til").
  //
  // Поэтому здесь два независимых шага:
  //   1. resolvedRootLemma (текст) — источник истины для поиска семьи
  //      ниже, всегда берётся из RPC, не зависит от шага 2;
  //   2. effectiveId — best-effort поиск id САМОЙ корневой лексемы через
  //      обычный текстовый select по lexemes.lemma (эта таблица, в
  //      отличие от expression_catalog, не блокируется RLS для клиента —
  //      подтверждено остальным кодом этого файла, читающим её напрямую).
  //      Если корень с таким именем не найден как отдельная лексема —
  //      remains lexemeId, шапка покажет исходную expression, но карусель
  //      всё равно будет работать благодаря шагу 1.
  let effectiveId = lexemeId;
  let resolvedRootLemma = '';

  const { data: originalRow } = await supabase
    .from('lexemes')
    .select('lemma')
    .eq('id', lexemeId)
    .maybeSingle();

  const originalLemma = normalizeText(originalRow?.lemma);

  if (originalLemma) {
    const { data: rootInfo, error: rootLemmaError } = await supabase.rpc(
      'get_lexeme360_root_lemma',
      { p_lemma: originalLemma },
    );

    if (rootLemmaError) {
      console.log('Lexeme360 root lemma RPC error:', rootLemmaError);
    }

    const rootRow = Array.isArray(rootInfo) ? rootInfo[0] : rootInfo;
    resolvedRootLemma = normalizeText(rootRow?.root_lemma);

    if (
      resolvedRootLemma &&
      normalizeRootLemma(resolvedRootLemma) !== normalizeRootLemma(originalLemma)
    ) {
      const { data: rootLexemeRow } = await supabase
        .from('lexemes')
        .select('id')
        .eq('lemma', resolvedRootLemma)
        .limit(1)
        .maybeSingle();

      if (rootLexemeRow?.id) {
        effectiveId = rootLexemeRow.id;
      }
    }
  }

  // 1. Core lexeme + morphology.
  const { data, error } = await supabase
    .from('lexemes')
    .select(`
      id,
      lemma,
      pos,
      cefr_level,
      frequency_rank,
      frequency_ipm,
      verb_forms ( infinitiv, presens, preteritum, perfektum, gruppe ),
      noun_forms ( ubest_entall, best_entall, ubest_flertall, best_flertall, official_gender ),
      adjective_forms ( positiv, intetkjonn, flertall, komparativ, superlativ )
    `)
    .eq('id', effectiveId)
    .single();

  if (error || !data) return null;

  const lemma = normalizeText((data as any).lemma);

  // 2. Translations + definitions from the new enrichment layer.
  const { data: allTranslations } = await supabase
    .from('entity_translations')
    .select(
      'language_code, translation, sense_rank, translation_rank, source, translation_type',
    )
    .eq('lexeme_id', effectiveId)
    .in('translation_type', ['primary', 'expression_primary', 'definition'])
    .order('source')
    .order('sense_rank', { ascending: true, nullsFirst: false })
    .order('translation_rank', { ascending: true });

  const translations = allTranslations ?? [];

  const pickBest = (lang: string, type: 'primary' | 'expression_primary') => {
    const preferred = translations.filter(
      (row: any) =>
        row.language_code === lang &&
        row.translation_type === type &&
        row.source === 'lexin',
    );

    return (
      preferred.find(
        (row: any) => row.sense_rank === 1 && row.translation_rank === 1,
      )?.translation ??
      preferred.find((row: any) => row.translation_rank === 1)?.translation ??
      preferred[0]?.translation ??
      translations.find(
        (row: any) =>
          row.language_code === lang && row.translation_type === type,
      )?.translation ??
      ''
    );
  };

  const ukTranslation =
    pickBest('uk', 'primary') || pickBest('uk', 'expression_primary');

  const enTranslation =
    pickBest('en', 'primary') || pickBest('en', 'expression_primary');

  const senseMap = new Map<number, { uk: string; en: string }>();

  for (const row of translations.filter(
    (tr: any) =>
      tr.source === 'lexin' &&
      tr.translation_type === 'primary' &&
      tr.translation_rank === 1,
  ) as any[]) {
    const senseRank = row.sense_rank ?? 999;
    if (!senseMap.has(senseRank)) {
      senseMap.set(senseRank, { uk: '', en: '' });
    }

    const entry = senseMap.get(senseRank)!;
    if (row.language_code === 'uk' && !entry.uk) entry.uk = row.translation;
    if (row.language_code === 'en' && !entry.en) entry.en = row.translation;
  }

  const allSenses = [...senseMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([sense_rank, { uk, en }]) => ({ sense_rank, uk, en }))
    .filter((sense) => sense.uk || sense.en)
    .slice(0, 4);

  const definitions: DefinitionRow[] = (translations as any[])
    .filter(
      (row) =>
        row.translation_type === 'definition' && row.language_code === 'en',
    )
    .slice(0, 4)
    .map((row) => ({
      text: row.translation,
      source: row.source || 'wiktionary',
    }));

  // 3. Examples from entity_examples.
  const { data: examplesData } = await supabase
    .from('entity_examples')
    .select('example_text, translation_uk, cefr_level, source')
    .eq('lexeme_id', effectiveId)
    .eq('language_code', 'nb')
    .limit(3);

  const examples: ExampleRow[] = (examplesData ?? [])
    .map((row: any) => ({
      text: normalizeText(row.example_text),
      translation_uk: row.translation_uk ?? null,
      cefr_level: row.cefr_level ?? null,
      source: row.source ?? null,
    }))
    .filter((row) => row.text);

  // 4. Meaning extensions — Lexeme360 core.
  //
  // Source of truth for 360 carousel:
  //   expression_catalog = registry of all discovered expressions
  //   lexeme_id != null = expression has become a real dictionary lexeme/card
  //   verification_status = 'multi_source' = ready to show to learners
  //
  // We read through a SECURITY DEFINER RPC to avoid RLS issues on internal
  // relation/registry tables and to keep the client query simple.

  // ФИКС v4: используем resolvedRootLemma из шага "0." — он приходит
  // напрямую из RPC и не зависит от того, удалось ли найти отдельную
  // lexemes-запись для корня (шаг "б" в комментарии выше). Раньше здесь
  // бралась lemma из уже загруженных данных effectiveId — если поиск
  // корневой лексемы по тексту не находил совпадения, effectiveId
  // оставался равен исходному lexemeId, lemma оставалась "ta til", и
  // семья снова не находилась, несмотря на то, что RPC корень правильно
  // резолвила.
  const rootLemma = normalizeRootLemma(resolvedRootLemma || lemma);

  const { data: readyExpressions, error: readyExpressionsError } =
    await supabase.rpc('get_lexeme360_ready_expressions', {
      p_root_lemma: rootLemma,
    });

  if (readyExpressionsError) {
    console.log('Lexeme360 ready expressions RPC error:', readyExpressionsError);
  }

  const expressionRows = (readyExpressions ?? []) as any[];

  // ФИКС: раньше здесь собирался только lexeme_id, и переводы/примеры
  // искались по нему в entity_translations/entity_examples. Но per
  // constraint entity_translations_single_entity (строка может иметь
  // ТОЛЬКО lexeme_id ИЛИ ТОЛЬКО expression_id, не оба) — записи с
  // переводами expression'ов ВСЕГДА имеют lexeme_id: null. Поиск по
  // lexeme_id никогда не находил эти переводы, независимо от того,
  // насколько правильно они были записаны воркерами (Lexin/AI-fallback).
  //
  // lexeme_id остаётся нужен отдельно — как `id` самого RelatedItem (для
  // "Добавити до навчання" / addLexemeToLearningFromSupabase, который
  // требует именно lexeme_id, не expression_id), а вот искать перевод и
  // пример нужно по expression_id (см. миграцию
  // 20260705120000_add_expression_id_to_lexeme360_ready_expressions.sql,
  // которая добавила ec.id as expression_id в RPC — раньше RPC его не
  // возвращала вообще).
  const targetLexemeIds = expressionRows
    .map((row) => normalizeText(row.lexeme_id))
    .filter(Boolean);

  const targetExpressionIds = expressionRows
    .map((row) => normalizeText(row.expression_id))
    .filter(Boolean);

  let relations: RelatedItem[] = [];

  if (targetLexemeIds.length > 0) {
    const { data: targetTranslations } = await supabase
      .from('entity_translations')
      .select('expression_id, language_code, translation, sense_rank, translation_rank')
      .in('expression_id', targetExpressionIds)
      .in('translation_type', ['primary', 'expression_primary'])
      .eq('translation_rank', 1)
      .order('sense_rank', { ascending: true, nullsFirst: false });

    const { data: targetExamples } = await supabase
      .from('entity_examples')
      .select('expression_id, example_text')
      .in('expression_id', targetExpressionIds)
      .eq('language_code', 'nb')
      .order('created_at', { ascending: false });

    // Обе карты теперь ключуются по expression_id — именно так реально
    // хранятся эти данные в БД.
    const translationMap = new Map<string, { uk: string; en: string }>();
    const exampleMap = new Map<string, string>();

    for (const ex of targetExamples ?? []) {
      const key = normalizeText((ex as any).expression_id);
      const text = normalizeText((ex as any).example_text);
      if (key && text && !exampleMap.has(key)) {
        exampleMap.set(key, text);
      }
    }

    for (const tr of targetTranslations ?? []) {
      const key = normalizeText((tr as any).expression_id);
      if (!key) continue;

      if (!translationMap.has(key)) {
        translationMap.set(key, { uk: '', en: '' });
      }

      const entry = translationMap.get(key)!;
      if ((tr as any).language_code === 'uk' && !entry.uk) {
        entry.uk = (tr as any).translation;
      }
      if ((tr as any).language_code === 'en' && !entry.en) {
        entry.en = (tr as any).translation;
      }
    }

    relations = expressionRows
      .map((row, index) => {
        // id самого RelatedItem — это lexeme_id (используется для открытия
        // карточки слова и для "добавити до навчання"). Ключ для перевода/
        // примера — expression_id (см. комментарий выше).
        const id = normalizeText(row.lexeme_id);
        const expressionKey = normalizeText(row.expression_id);
        const expressionLemma = normalizeText(row.lemma);

        if (!id || !expressionLemma) return null;

        const subtype = normalizeText(row.expression_subtype);

        // ФИКС: реально применяем subtype-allowlist здесь, а не только
        // объявляем его. См. shouldIncludeInLexeme360 выше.
        if (!shouldIncludeInLexeme360(subtype)) return null;

        // ФИКС: отдельная проверка статуса записи, независимая от subtype —
        // см. isDeletedOrObsoleteStatus выше. No-op сейчас (RPC не отдаёт
        // status), но не даст записи с плохим статусом проскочить, если
        // поле появится в будущем без необходимости искать это место снова.
        if (isDeletedOrObsoleteStatus((row as any).status)) return null;

        const translation = translationMap.get(expressionKey) ?? { uk: '', en: '' };

        return {
          id,
          lemma: expressionLemma,
          translation_ua: translation.uk,
          translation_en: translation.en,
          pos: normalizeText(row.pos) || 'expression',
          example: exampleMap.get(expressionKey) || '',
          expression_subtype: subtype || 'has_expression',
          relation_type: subtype || 'has_expression',
          confidence: 1,
          importance_level: 'important',
          importance_score: 100 - index,
          frequency_score: 0,
          semantic_shift_score: 100 - index,
          learner_value_score: 100 - index,
          source_system: 'expression_catalog',
          status: 'ready',
          canOpen: true,
          canAdd: true,
          sourceLabel: 'multi_source',
        } as RelatedItem;
      })
      .filter((item): item is RelatedItem => Boolean(item));
  }

  const { data: candidateExpressions, error: candidateExpressionsError } =
  await supabase.rpc('get_lexeme360_candidate_expressions', {
    p_root_lemma: rootLemma,
  });

  if (candidateExpressionsError) {
    console.log('Lexeme360 candidate expressions error:', candidateExpressionsError);
  }

  const candidateRelations: RelatedItem[] = ((candidateExpressions ?? []) as any[])
    .map((row, index) => {
      const id = normalizeText(row.id);
      const expressionLemma = normalizeText(row.lemma);
      if (!id || !expressionLemma) return null;

      const subtype = normalizeText(row.expression_subtype) || 'ordbokene_sub_article';

      // ФИКС: тот же subtype-фильтр применяется и к candidate-веткам —
      // на случай если появятся явно excluded subtype (collocation,
      // synonym, ...) среди неподтверждённых кандидатов.
      if (!shouldIncludeInLexeme360(subtype)) return null;

      // ФИКС: та же защита по статусу, что и для ready-веток.
      if (isDeletedOrObsoleteStatus((row as any).status)) return null;

      return {
        id: `candidate-${id}`,
        lemma: expressionLemma,
        translation_ua: '',
        translation_en: '',
        pos: 'expression',
        example: '',
        expression_subtype: subtype,
        relation_type: subtype,
        confidence: 0.35,
        importance_level: 'candidate',
        importance_score: -index,
        frequency_score: 0,
        semantic_shift_score: 0,
        learner_value_score: 0,
        source_system: 'expression_catalog',
        status: 'candidate',
        canOpen: false,
        canAdd: false,
        sourceLabel: 'Ordbokene · venter på behandling',
      } as RelatedItem;
    })
    .filter((item): item is RelatedItem => Boolean(item));

  relations = dedupeRelationsByLemma([...relations, ...candidateRelations]);

  const vf = (data as any).verb_forms?.[0] ?? {};
  const nf = (data as any).noun_forms?.[0] ?? {};
  const af = (data as any).adjective_forms?.[0] ?? {};

  return {
    id: (data as any).id,
    lemma: (data as any).lemma,
    pos: (data as any).pos,
    translation_ua: ukTranslation,
    translation_en: enTranslation,
    translation_no: '',
    cefr_level: (data as any).cefr_level ?? null,
    frequency_rank: (data as any).frequency_rank ?? null,
    frequency_ipm: (data as any).frequency_ipm ?? null,
    all_senses: allSenses.length > 1 ? allSenses : undefined,
    definitions,
    examples,
    grammar: { ...vf, ...nf, ...af },
    relations,
    requestedId: lexemeId,
  };
}

// ── UI helpers ───────────────────────────────────────────────────────────────

function CefrBadge({ level }: { level: string }) {
  const color = CEFR_COLORS[level] ?? '#6B7280';

  return (
    <View
      style={[
        styles.cefrBadge,
        {
          backgroundColor: `${color}18`,
          borderColor: `${color}40`,
        },
      ]}
    >
      <Text style={[styles.cefrText, { color }]}>{level}</Text>
    </View>
  );
}

function getFrequencyLabel(
  rank: number,
  lang: AppLanguage,
): { label: string; color: string } {
  if (rank <= 500) {
    return {
      label:
        lang === 'ua'
          ? 'Дуже часто'
          : lang === 'no'
            ? 'Svært vanlig'
            : 'Very common',
      color: '#16A34A',
    };
  }

  if (rank <= 2000) {
    return {
      label:
        lang === 'ua' ? 'Часто' : lang === 'no' ? 'Vanlig' : 'Common',
      color: '#2563EB',
    };
  }

  if (rank <= 5000) {
    return {
      label:
        lang === 'ua' ? 'Знайоме' : lang === 'no' ? 'Kjent' : 'Familiar',
      color: '#D97706',
    };
  }

  return {
    label:
      lang === 'ua' ? 'Рідше' : lang === 'no' ? 'Sjeldnere' : 'Less common',
    color: '#9CA3AF',
  };
}

function FrequencyBadge({ rank, lang }: { rank: number; lang: AppLanguage }) {
  const { label, color } = getFrequencyLabel(rank, lang);

  return (
    <View
      style={[
        styles.freqBadge,
        {
          backgroundColor: `${color}15`,
          borderColor: `${color}35`,
        },
      ]}
    >
      <Text style={[styles.freqRank, { color }]}>#{rank}</Text>
      <Text style={[styles.freqLabel, { color }]}>{label}</Text>
    </View>
  );
}

function getGrammarRows(
  pos: string,
  g: GrammarForms,
  lang: AppLanguage,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const safePos = normalizeText(pos).toLowerCase();

  if (safePos === 'verb' || safePos.includes('verb')) {
    if (g.infinitiv) {
      rows.push({
        label: safeT('infinitive', lang, 'Infinitiv'),
        value: g.infinitiv,
      });
    }
    if (g.presens) {
      rows.push({
        label: safeT('present', lang, 'Presens'),
        value: g.presens,
      });
    }
    if (g.preteritum) {
      rows.push({
        label: safeT('past', lang, 'Preteritum'),
        value: g.preteritum,
      });
    }
    if (g.perfektum) {
      rows.push({
        label: safeT('perfect', lang, 'Perfektum'),
        value: `har ${g.perfektum}`,
      });
    }
    if (g.gruppe) {
      rows.push({
        label: safeT('group', lang, 'Gruppe'),
        value: g.gruppe,
      });
    }
  } else if (
    safePos === 'noun' ||
    safePos.includes('noun') ||
    safePos.includes('subst')
  ) {
    if (g.ubest_entall) {
      rows.push({
        label: safeT('indef_sg', lang, 'Ubestemt entall'),
        value: g.ubest_entall,
      });
    }
    if (g.best_entall) {
      rows.push({
        label: safeT('def_sg', lang, 'Bestemt entall'),
        value: g.best_entall,
      });
    }
    if (g.ubest_flertall) {
      rows.push({
        label: safeT('indef_pl', lang, 'Ubestemt flertall'),
        value: g.ubest_flertall,
      });
    }
    if (g.best_flertall) {
      rows.push({
        label: safeT('def_pl', lang, 'Bestemt flertall'),
        value: g.best_flertall,
      });
    }
    if (g.official_gender) {
      rows.push({
        label: safeT('gender', lang, 'Kjønn'),
        value: g.official_gender,
      });
    }
  } else if (safePos === 'adjective' || safePos.includes('adj')) {
    if (g.positiv) {
      rows.push({
        label: safeT('positive', lang, 'Positiv'),
        value: g.positiv,
      });
    }
    if (g.intetkjonn) {
      rows.push({
        label: safeT('neuter', lang, 'Intetkjønn'),
        value: g.intetkjonn,
      });
    }
    if (g.flertall) {
      rows.push({
        label: safeT('plural', lang, 'Flertall'),
        value: g.flertall,
      });
    }
    if (g.komparativ) {
      rows.push({
        label: safeT('comparative', lang, 'Komparativ'),
        value: g.komparativ,
      });
    }
    if (g.superlativ) {
      rows.push({
        label: safeT('superlative', lang, 'Superlativ'),
        value: g.superlativ,
      });
    }
  }

  return rows;
}

function getMeaningExtensions(
  data: Lexeme360Data | null,
  learnedRelationIds: Set<string>,
) {
  return (data?.relations ?? []).map((relation) => ({
    ...relation,
    lemma: displayLemmaWithInfinitiveMarker(relation.lemma, relation.pos),
    learned: (relation as any).learned || learnedRelationIds.has(relation.id),
  }));
}

function SectionHeader({
  icon,
  title,
  count,
  subtitle,
}: {
  icon: string;
  title: string;
  count?: number;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeaderWrap}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        {count != null ? <Text style={styles.sectionCount}>{count}</Text> : null}
      </View>

      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ── Content ──────────────────────────────────────────────────────────────────

function Lexeme360Content({
  data,
  lemma,
  pos,
  lang,
  loading,
  addingId,
  learnedRelationIds,
  onClose,
  onSelectWord,
  onAddToLearning,
}: {
  data: Lexeme360Data | null;
  lemma: string;
  pos?: string;
  lang: AppLanguage;
  loading: boolean;
  addingId?: string | null;
  learnedRelationIds: Set<string>;
  onClose?: () => void;
  onSelectWord?: (id: string, lemma: string) => void;
  onAddToLearning?: (id: string) => void;
}) {
  const meaningExtensions = useMemo(
    () => getMeaningExtensions(data, learnedRelationIds),
    [data, learnedRelationIds],
  );

  const hasContent = Boolean(data && meaningExtensions.length > 0);

  const posLabel = data?.pos || pos || '';
  // ФИКС: раньше здесь бралась только внешняя lemma (проп, переданный
  // при открытии — например, "ta til"), хотя pos/cefr/переводы уже
  // правильно приоритизировали data (реальные данные корня, если
  // effectiveId-редирект сработал). Теперь заголовок так же приоритизирует
  // data?.lemma — саму загруженную лексему ("ta"), с тем же fallback на
  // проп, что и у posLabel выше.
  const displayLemma = displayLemmaWithInfinitiveMarker(data?.lemma || lemma, posLabel);
  const coreTranslation = data ? pickLexemeTranslation(data, lang) : '';
  const headerExample = data?.examples?.[0]?.text || '';

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTop}>
            <Text style={styles.headerLemma}>{displayLemma}</Text>

            {posLabel ? (
              <View style={styles.posBadge}>
                <Text style={styles.posText}>{posLabel}</Text>
              </View>
            ) : null}

            {data?.cefr_level ? <CefrBadge level={data.cefr_level} /> : null}

            {data?.frequency_rank ? (
              <FrequencyBadge rank={data.frequency_rank} lang={lang} />
            ) : null}
          </View>

          {coreTranslation ? (
            <Text style={styles.headerTranslation} numberOfLines={2}>
              {coreTranslation}
            </Text>
          ) : (
            <Text style={styles.headerSub}>Lexeme 360°</Text>
          )}
        </View>

        {onClose ? (
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {headerExample ? (
        <View style={styles.headerExampleBox}>
          <Text style={styles.headerExampleText} numberOfLines={2}>
            {headerExample}
          </Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.loadingText}>
            {safeT('loading', lang, 'Loading...')}
          </Text>
        </View>
      ) : !hasContent ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>
            {lang === 'ua'
              ? 'Змін значення ще не знайдено'
              : lang === 'no'
                ? 'Ingen betydningsendringer ennå'
                : 'No meaning extensions yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            {lang === 'ua'
              ? 'Для цього слова ще немає підтверджених виразів, де значення змінюється.'
              : lang === 'no'
                ? 'Det finnes ennå ingen bekreftede uttrykk der betydningen endres.'
                : 'No confirmed expressions where the base meaning changes have been found yet.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces
          nestedScrollEnabled
          scrollEnabled
        >
          <View style={styles.section}>
            <SectionHeader
              icon="🔀"
              title={getMeaningExtensionTitle(lang)}
              subtitle={getMeaningExtensionSubtitle(lang)}
              count={meaningExtensions.length}
            />

            {addingId ? (
              <View style={styles.addingBox}>
                <ActivityIndicator size="small" color="#0EA5E9" />
                <Text style={styles.addingText}>
                  {lang === 'ua'
                    ? 'Додаю до навчання...'
                    : lang === 'no'
                      ? 'Legger til i læring...'
                      : 'Adding to learning...'}
                </Text>
              </View>
            ) : null}

            <Lexeme360Carousel
              items={meaningExtensions}
              lang={lang}
              highlightId={data?.requestedId ?? data?.id}
              onSelect={(id, nextLemma) => {
                onClose?.();
                onSelectWord?.(id, nextLemma);
              }}
              onAdd={onAddToLearning}
            />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ── Public components ────────────────────────────────────────────────────────

type Props = {
  lexemeId: string;
  lemma: string;
  pos?: string;
  lang?: AppLanguage | string | null;
  isUa?: boolean;
  onSelectWord?: (id: string, lemma: string) => void;
  externalVisible?: boolean;
  onOpenRequest?: () => void;
  onCloseRequest?: () => void;
};

export function Lexeme360({
  lexemeId,
  lemma,
  pos,
  lang = 'en',
  isUa: isUaLegacy,
  onSelectWord,
  externalVisible,
  onOpenRequest,
  onCloseRequest,
}: Props) {
  const { preferred_user } = useSettingsStore();
  const uiLang = resolveLang(lang, isUaLegacy);

  const [internalVisible, setInternalVisible] = useState(false);
  const [data, setData] = useState<Lexeme360Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [learnedRelationIds, setLearnedRelationIds] = useState<Set<string>>(
    new Set(),
  );

  const visible = externalVisible !== undefined ? externalVisible : internalVisible;

  const setVisible = (value: boolean) => {
    if (externalVisible !== undefined) {
      value ? onOpenRequest?.() : onCloseRequest?.();
    } else {
      setInternalVisible(value);
    }
  };

  async function open() {
    setVisible(true);
    if (data || loading) return;

    setLoading(true);
    try {
      const result = await fetchLexeme360(lexemeId);
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  async function addRelationToLearning(id: string) {
    try {
      if (!id || addingId || learnedRelationIds.has(id)) return;

      setAddingId(id);

      await addLexemeToLearningFromSupabase({
        preferred_user,
        lexemeId: id,
      });

      setLearnedRelationIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch (err) {
      console.error('Lexeme360 add relation error:', err);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={open} activeOpacity={0.7}>
        <Text style={styles.triggerText}>🧠 360°</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable
            style={styles.modalSheetWrapper}
            onPress={(event) => event.stopPropagation()}
          >
            <Lexeme360Content
              data={data}
              lemma={lemma}
              pos={pos}
              lang={uiLang}
              loading={loading}
              addingId={addingId}
              learnedRelationIds={learnedRelationIds}
              onClose={() => setVisible(false)}
              onSelectWord={onSelectWord}
              onAddToLearning={addRelationToLearning}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function Lexeme360Sheet({
  lexemeId,
  lemma,
  pos,
  lang = 'en',
  isUa: isUaLegacy,
  onSelectWord,
  onClose,
}: {
  lexemeId: string;
  lemma: string;
  pos?: string;
  lang?: AppLanguage | string | null;
  isUa?: boolean;
  onSelectWord?: (id: string, lemma: string) => void;
  onClose?: () => void;
}) {
  const { preferred_user } = useSettingsStore();
  const uiLang = resolveLang(lang, isUaLegacy);

  const [data, setData] = useState<Lexeme360Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [learnedRelationIds, setLearnedRelationIds] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!lexemeId) return;

    let mounted = true;

    setLoading(true);

    fetchLexeme360(lexemeId)
      .then((result) => {
        if (mounted) setData(result);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [lexemeId]);

  async function addRelationToLearning(id: string) {
    try {
      if (!id || addingId || learnedRelationIds.has(id)) return;

      setAddingId(id);

      await addLexemeToLearningFromSupabase({
        preferred_user,
        lexemeId: id,
      });

      setLearnedRelationIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    } catch (err) {
      console.error('Lexeme360Sheet add relation error:', err);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Lexeme360Content
      data={data}
      lemma={lemma}
      pos={pos}
      lang={uiLang}
      loading={loading}
      addingId={addingId}
      learnedRelationIds={learnedRelationIds}
      onClose={onClose}
      onSelectWord={onSelectWord}
      onAddToLearning={addRelationToLearning}
    />
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: '#EEF2FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3730A3',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheetWrapper: {
    height: '93%',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerLemma: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
  },
  posBadge: {
    backgroundColor: '#F1EFE8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  posText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888780',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cefrBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  cefrText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  freqBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  freqRank: {
    fontSize: 11,
    fontWeight: '800',
  },
  freqLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  headerTranslation: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0EA5E9',
    marginTop: 4,
  },
  headerSub: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  headerExampleBox: {
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  headerExampleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#374151',
    fontStyle: 'italic',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '700',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#E5E7EB',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  loadingText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeaderWrap: {
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionIcon: {
    fontSize: 15,
    width: 22,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  sectionSubtitle: {
    marginLeft: 28,
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  addingBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addingText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0369A1',
  },
  senseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  senseNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  senseNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3730A3',
  },
  senseContent: {
    flex: 1,
  },
  senseUk: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  senseEn: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  grammarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  grammarCell: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: '45%',
    flex: 1,
  },
  grammarLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  grammarValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  exampleBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  exampleTranslation: {
    marginTop: 6,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  defRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  defNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9CA3AF',
    width: 18,
    marginTop: 1,
  },
  defText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});