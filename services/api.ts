import { supabase } from './supabase';
import { getCurrentUserId } from '@/store/authStore';

// ============================================================
// LEXEME SELECT
// ============================================================

// ФИКС: добавлено relations_count. Колонка уже существует в lexemes и
// реально заполняется (подтверждено: "ta" → 15), но не запрашивалась
// здесь — из-за этого trainingEngine.hasRelations(w) всегда получала
// w.relations_count === undefined и иконка режима 360° никогда не
// показывалась в тренировке, независимо от того, сколько реальных связей
// было в expression_catalog/lexeme_relations.
// FIX: verb_forms(...) / noun_forms(...) / adjective_forms(...) as embedded
// relations were removed - those tables do not exist in the current schema.
// Forms now come from a direct, separate read of lexeme_form_variants
// (see fetchFormVariantsMap below) instead of a sync bridge, per the
// production decision to avoid a second, potentially-stale data layer.
const LEXEME_SELECT = `
  id, lemma, pos, display_form,
  dictionary_status, dictionary_exclusion_reason, is_learning_lexeme,
  translation_ua, translation_en, example, notes, cefr, status,
  frequency_rank, frequency_level, frequency_source, frequency_note,
  relations_count, synonyms,
  verification, verification_tier, verification_status, source_verified,
  verification_evidence, source, enrichment_status, enrichment_error,
  expression_data (
    expression_subtype
  )
`;

// ============================================================
// Direct read from lexeme_form_variants - no bridge table.
// Different sources wrote form_key under different naming
// conventions (norwegian vs english terms); this normalizes them
// into one canonical set consumed by mapLexemeRow / getAllForms().
// past_perfect ("hadde X") is deliberately NOT aliased to perfektum
// ("har X") - different tense, would silently give a wrong form.
// ============================================================

const FORM_KEY_ALIASES: Record<string, string> = {
  infinitiv: 'infinitiv',
  infinitive: 'infinitiv',
  presens: 'presens',
  present: 'presens',
  preteritum: 'preteritum',
  past: 'preteritum',
  perfektum: 'perfektum',
  present_perfect: 'perfektum',
  imperative: 'imperative',
  positiv: 'positiv',
  intetkjonn: 'intetkjonn',
  flertall: 'flertall',
  komparativ: 'komparativ',
  superlativ: 'superlativ',
  best_superlativ: 'best_superlativ',
  ubest_entall: 'ubest_entall',
  best_entall: 'best_entall',
  ubest_flertall: 'ubest_flertall',
  best_flertall: 'best_flertall',
};

const VERB_FORM_KEYS = new Set(['infinitiv', 'presens', 'preteritum', 'perfektum', 'imperative']);
const ADJECTIVE_FORM_KEYS = new Set(['positiv', 'intetkjonn', 'flertall', 'komparativ', 'superlativ', 'best_superlativ']);
const NOUN_FORM_KEYS = new Set(['ubest_entall', 'best_entall', 'ubest_flertall', 'best_flertall']);

type FormsBundle = {
  verb_forms: Record<string, string>;
  noun_forms: Record<string, string>;
  adjective_forms: Record<string, string>;
};

async function fetchFormVariantsMap(
  lexemeIds: string[],
): Promise<Map<string, FormsBundle>> {
  const result = new Map<string, FormsBundle>();
  if (lexemeIds.length === 0) return result;

  const { data, error } = await supabase
    .from('lexeme_form_variants')
    .select('lexeme_id, form_key, value, is_primary, verification_status')
    .in('lexeme_id', lexemeIds);

  if (error) {
    console.error('fetchFormVariantsMap failed:', error.message);
    return result;
  }

  // Group rows by lexeme_id, then pick one value per canonical form_key -
  // prefer is_primary=true, fall back to the first row encountered.
  const grouped = new Map<string, any[]>();
  for (const row of data || []) {
    if (!row.lexeme_id || !row.form_key) continue;
    const list = grouped.get(row.lexeme_id) || [];
    list.push(row);
    grouped.set(row.lexeme_id, list);
  }

  for (const [lexemeId, rows] of grouped.entries()) {
    const chosen: Record<string, { value: string; isPrimary: boolean }> = {};

    for (const row of rows) {
      const canonical = FORM_KEY_ALIASES[row.form_key];
      if (!canonical) continue;

      const existing = chosen[canonical];
      // Prefer primary; if neither/both are primary, keep the first seen.
      if (!existing || (row.is_primary && !existing.isPrimary)) {
        chosen[canonical] = { value: row.value, isPrimary: !!row.is_primary };
      }
    }

    const verb_forms: Record<string, string> = {};
    const noun_forms: Record<string, string> = {};
    const adjective_forms: Record<string, string> = {};

    for (const [key, { value }] of Object.entries(chosen)) {
      if (VERB_FORM_KEYS.has(key)) verb_forms[key] = value;
      else if (ADJECTIVE_FORM_KEYS.has(key)) adjective_forms[key] = value;
      else if (NOUN_FORM_KEYS.has(key)) noun_forms[key] = value;
    }

    result.set(lexemeId, { verb_forms, noun_forms, adjective_forms });
  }

  return result;
}

// ============================================================
// Types
// ============================================================

type StudySet = 'all' | 'new' | 'weak' | 'due';

type LearningSettings = {
  preferred_user?:  string;
  category_filter?: string;
  study_set?:       string;
  daily_limit?:     number;
};

type SrsPrevious = {
  interval_days?:        number | null;
  repetitions?:          number | null;
  lapses?:               number | null;
  stability?:            number | null;
  difficulty_val?:       number | null;
  queue_score?:          number | null;
  memory_status?:        string | null;
  memory_score?:         number | null;
  priority_score?:       number | null;
  weak_score?:           number | null;
  recognition_score?:    number | null;
  production_score?:     number | null;
  personal_hits?:        number | null;
  review_interval_days?: number | null;
  next_due_at?:          string | null;
  last_reviewed_at?:     string | null;
};

// ============================================================
// Map lexeme row → app format
// ============================================================

function mapLexemeRow(item: any, forms?: FormsBundle) {
  if (!item) return null;

  const vf = forms?.verb_forms      || {};
  const nf = forms?.noun_forms      || {};
  const af = forms?.adjective_forms || {};
  const ed = item.expression_data?.[0] || {};

  const pos = item.pos || '';
  let category = pos;
  if (pos === 'noun') {
    const gender = nf.official_gender || '';
    if (gender === 'feminine')       category = 'noun_feminine';
    else if (gender === 'neuter')    category = 'noun_neuter';
    else                             category = 'noun_masculine';
  }

  return {
    id:       item.id,
    word:     item.display_form || item.lemma,
    display_form: item.display_form || '',
    lemma:    item.lemma,
    pos,
    type:     category,
    category,
    ua:       item.translation_ua || '',
    en:       item.translation_en || '',
    example:  item.example        || '',
    notes:    item.notes          || '',
    cefr:     item.cefr           || '',
    frequency_rank:   item.frequency_rank   ?? null,
    frequency_level:  item.frequency_level  || '',
    frequency_source: item.frequency_source || '',
    frequency_note:   item.frequency_note   || '',
    // ФИКС: пробрасываем relations_count из БД в объект, который реально
    // видит trainingEngine.hasRelations(w) — само поле уже запрашивается
    // выше (LEXEME_SELECT), но терялось именно на этом шаге маппинга.
    relations_count: item.relations_count ?? 0,
    status:   item.status         || 'New',
    source:   item.source         || '',
    dictionary_status: item.dictionary_status || 'active',
    dictionary_exclusion_reason: item.dictionary_exclusion_reason || null,
    is_learning_lexeme: item.is_learning_lexeme !== false,
    // verification fields
    verification:          item.verification          || '',
    verification_tier:     item.verification_tier     || null,
    verification_status:   item.verification_status   || null,
    source_verified:       item.source_verified       || null,
    verification_evidence: item.verification_evidence || null,
    srs:           item.srs || null,
    memoryStatus:  item.srs?.memory_status  || null,
    memoryScore:   item.srs?.memory_score   || 0,
    priorityScore: item.srs?.priority_score || 0,
    weakScore:     item.srs?.weak_score     || 0,
    personalHits:  item.srs?.personal_hits  || 0,
    f1: vf.presens        || af.intetkjonn    || nf.best_entall    || '',
    f2: vf.preteritum     || af.flertall      || nf.ubest_flertall || '',
    f3: vf.perfektum      || af.komparativ    || nf.best_flertall  || '',
    f4: af.superlativ     || '',
    f5: af.best_superlativ || '',
    expression_subtype: vf.expression_subtype || ed.expression_subtype || '',
    base_verb:          vf.base_verb          || '',
    particle:           vf.particle           || '',
    // ФИКС: было захардкожено synonyms: [] — приложение никогда не могло
    // увидеть ни одной из связей, собранных naob-synonym-resolver в
    // authoritative_semantic_relations (мост sync_lexeme_synonym_column
    // теперь пишет их в lexemes.synonyms, запрошено выше в LEXEME_SELECT).
    // Каждый элемент: { text, resolved, target_entity_type, target_entity_id, confidence, source }.
    synonyms:           item.synonyms || [],
    // joined form objects for getFormLabels() - now sourced directly
    // from lexeme_form_variants via fetchFormVariantsMap, not a bridge table.
    verb_forms:       forms?.verb_forms      || null,
    noun_forms:       forms?.noun_forms      || null,
    adjective_forms:  forms?.adjective_forms || null,
  };
}

// FIX: now async - fetches lexeme_form_variants for the whole batch in one
// query (not per-row), then maps rows with their matching forms bundle.
async function mapLexemeRows(rows: any[]) {
  const validRows = (rows || []).filter(Boolean);
  const lexemeIds = validRows.map((r) => r.id).filter(Boolean);

  const formsMap = await fetchFormVariantsMap(lexemeIds);

  return validRows
    .map((row) => mapLexemeRow(row, formsMap.get(row.id)))
    .filter(Boolean);
}

function normalizeLexemeSearchKey(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[.,!?;:()"«»""''\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function expressionLemmaFromCandidate(candidate: any) {
  return String(
    candidate?.lemma ||
    candidate?.word  ||
    candidate?.text  ||
    ''
  ).trim();
}

function candidateFrequencyLevel(candidate: any) {
  const raw = String(candidate?.frequency_level || '').toLowerCase().trim();
  if (['high', 'medium', 'low', 'rare'].includes(raw)) return raw;
  return '';
}

// ============================================================
// Attach SRS meta
// ============================================================

function attachSrsMetaToLexemeRows(rows: any[]) {
  return (rows || [])
    .map((item: any) => {
      if (!item?.lexemes) return null;
      if (item.lexemes.is_learning_lexeme === false) return null;
      return {
        ...item.lexemes,
        srs: {
          next_due_at:          item.next_due_at    || null,
          queue_score:          item.queue_score    || 0,
          priority_score:       item.priority_score || 0,
          weak_score:           item.weak_score     || 0,
          memory_status:        item.memory_status  || 'active',
          memory_score:         item.memory_score   || 0,
          personal_hits:        item.personal_hits  || 0,
          repetitions:          item.repetitions    || 0,
          lapses:               item.lapses         || 0,
          difficulty:           item.difficulty_val || 5,
          last_seen_in_reading: item.last_seen_in_reading || null,
        },
      };
    })
    .filter(Boolean);
}

// ============================================================
// Category filter
// ============================================================

function applyCategoryFilterToQuery(query: any, categoryFilter: string) {
  if (categoryFilter === 'verbs')       return query.eq('pos', 'verb');
  if (categoryFilter === 'nouns')       return query.eq('pos', 'noun');
  if (categoryFilter === 'adjectives')  return query.eq('pos', 'adjective');
  if (categoryFilter === 'adverbs')     return query.eq('pos', 'adverb');
  if (categoryFilter === 'expressions') return query.eq('pos', 'expression');
  return query;
}

function matchesCategoryFilter(item: any, categoryFilter: string) {
  if (categoryFilter === 'all') return true;
  const pos = item?.pos || item?.type || item?.category || '';
  if (categoryFilter === 'verbs')       return pos === 'verb';
  if (categoryFilter === 'nouns')       return pos === 'noun';
  if (categoryFilter === 'adjectives')  return pos === 'adjective';
  if (categoryFilter === 'adverbs')     return pos === 'adverb';
  if (categoryFilter === 'expressions') return pos === 'expression';
  return true;
}

// ============================================================
// Scoring & sorting
// ============================================================

function uniqueById(items: any[]): any[] {
  const seen   = new Set<string>();
  const result: any[] = [];
  for (const item of items) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function scoreLearningCandidate(item: any) {
  const srs       = item?.srs || {};
  const frequency = typeof item?.frequency === 'number' ? item.frequency : 999999;
  const freqBoost = frequency > 0 ? Math.max(0, 60 - Math.log10(frequency + 1) * 12) : 0;

  let statusBoost = 0;
  if (srs.memory_status === 'weak')          statusBoost = 45;
  if (srs.memory_status === 'active')        statusBoost = 20;
  if (srs.memory_status === 'reinforcement') statusBoost = 8;
  if (srs.memory_status === 'passive_known') statusBoost = -80;

  return (
    (srs.priority_score || 0) +
    (srs.weak_score     || 0) * 1.3 +
    (srs.queue_score    || 0) * 0.8 +
    Math.min(srs.personal_hits || 0, 30) * 4 +
    freqBoost +
    statusBoost
  );
}

function sortByLearningPriority<T>(items: T[]) {
  return [...items].sort((a: any, b: any) =>
    scoreLearningCandidate(b) - scoreLearningCandidate(a)
  );
}

// ============================================================
// SRS calculations
// ============================================================

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function calculateAdaptiveIntervalDays(params: {
  difficulty:            'hard' | 'medium' | 'easy';
  previousInterval:      number;
  previousStability:     number;
  previousDifficulty:    number;
  previousWeakScore:     number;
  previousMemoryScore:   number;
  previousPersonalHits:  number;
  previousMemoryStatus?: string | null;
}): number {
  const weakPenalty =
    params.previousWeakScore >= 80 ? 0.35 :
    params.previousWeakScore >= 50 ? 0.55 :
    params.previousWeakScore >= 20 ? 0.75 : 1;

  const memoryBonus =
    params.previousMemoryScore >= 85 ? 1.35 :
    params.previousMemoryScore >= 60 ? 1.15 :
    params.previousMemoryScore >= 35 ? 1    : 0.85;

  const readingBonus =
    params.previousPersonalHits >= 10 ? 1.18 :
    params.previousPersonalHits >= 3  ? 1.08 : 1;

  if (params.difficulty === 'hard') return 0;

  if (params.difficulty === 'medium') {
    const base = params.previousInterval <= 0
      ? 1
      : Math.max(1, Math.round(params.previousInterval * 1.45));
    return clampNumber(
      Math.round(base * weakPenalty * memoryBonus * readingBonus), 1, 30
    );
  }

  const base = params.previousInterval <= 0
    ? 3
    : Math.max(3, Math.round(params.previousInterval * 2.35));
  const passiveBonus = params.previousMemoryStatus === 'passive_known' ? 1.4 : 1;
  return clampNumber(
    Math.round(base * weakPenalty * memoryBonus * readingBonus * passiveBonus), 3, 120
  );
}

function calculateAdaptiveNextDueAt(params: {
  difficulty:   'hard' | 'medium' | 'easy';
  intervalDays: number;
  weakScore:    number;
  memoryStatus: string;
}): string {
  const now = new Date();
  if (params.difficulty === 'hard') {
    if (params.weakScore >= 80) return addHours(now, 2).toISOString();
    if (params.weakScore >= 50) return addHours(now, 4).toISOString();
    return addHours(now, 6).toISOString();
  }
  if (params.intervalDays <= 0) return addHours(now, 6).toISOString();
  if (params.memoryStatus === 'weak') {
    return addDays(now, Math.min(params.intervalDays, 2)).toISOString();
  }
  if (params.memoryStatus === 'passive_known') {
    return addDays(now, Math.max(params.intervalDays, 45)).toISOString();
  }
  return addDays(now, params.intervalDays).toISOString();
}

function calculateMemoryStatus(params: {
  difficulty:   'hard' | 'medium' | 'easy';
  repetitions:  number;
  lapses:       number;
  intervalDays: number;
  weakScore:    number;
  memoryScore:  number;
}): string {
  if (params.difficulty === 'hard' || params.weakScore >= 70 || params.lapses >= 3) return 'weak';
  if (
    params.repetitions >= 12 && params.lapses === 0 &&
    params.intervalDays >= 45 && params.memoryScore >= 85
  ) return 'passive_known';
  if (params.repetitions >= 4 && params.intervalDays >= 7 && params.memoryScore >= 45) {
    return 'reinforcement';
  }
  return 'active';
}

function calculateMemoryScores(params: {
  difficulty:   'hard' | 'medium' | 'easy';
  previous?:    SrsPrevious | null;
  repetitions:  number;
  lapses:       number;
  intervalDays: number;
  queueScore:   number;
}) {
  const previous          = params.previous;
  const prevMemoryScore   = previous?.memory_score      ?? 0;
  const prevWeakScore     = previous?.weak_score        ?? 0;
  const prevRecognition   = previous?.recognition_score ?? 0;
  const prevProduction    = previous?.production_score  ?? 0;
  const prevPersonalHits  = previous?.personal_hits     ?? 0;

  let memoryDelta = 0, weakDelta = 0, recognitionDelta = 0, productionDelta = 0;

  if (params.difficulty === 'easy') {
    memoryDelta = 12; weakDelta = -10; recognitionDelta = 8;  productionDelta = 8;
  } else if (params.difficulty === 'medium') {
    memoryDelta = 5;  weakDelta = -3;  recognitionDelta = 4;  productionDelta = 3;
  } else {
    memoryDelta = -18; weakDelta = 25; recognitionDelta = -8; productionDelta = -10;
  }

  const memoryScore = clampNumber(
    prevMemoryScore + memoryDelta + Math.min(params.intervalDays, 30) * 0.4, 0, 100
  );
  const weakScore = clampNumber(
    prevWeakScore + weakDelta + params.lapses * 4, 0, 100
  );
  const recognitionScore = clampNumber(prevRecognition + recognitionDelta, 0, 100);
  const productionScore  = clampNumber(prevProduction  + productionDelta,  0, 100);
  const priorityScore    = Math.round(
    params.queueScore +
    weakScore * 1.4 +
    Math.max(0, 100 - memoryScore) * 0.5 +
    Math.min(prevPersonalHits, 20) * 4
  );

  const memoryStatus = calculateMemoryStatus({
    difficulty:   params.difficulty,
    repetitions:  params.repetitions,
    lapses:       params.lapses,
    intervalDays: params.intervalDays,
    weakScore,
    memoryScore,
  });

  return {
    memory_status:        memoryStatus,
    memory_score:         Math.round(memoryScore),
    priority_score:       Math.round(priorityScore),
    weak_score:           Math.round(weakScore),
    recognition_score:    Math.round(recognitionScore),
    production_score:     Math.round(productionScore),
    review_interval_days: params.intervalDays,
  };
}

function calculateSrsUpdate(params: {
  difficulty: 'hard' | 'medium' | 'easy';
  previous?:  SrsPrevious | null;
}) {
  const previous = params.previous;

  const previousInterval     = previous?.review_interval_days ?? previous?.interval_days ?? 0;
  const previousRepetitions  = previous?.repetitions    || 0;
  const previousLapses       = previous?.lapses         || 0;
  const previousStability    = previous?.stability      || 1;
  const previousDifficulty   = previous?.difficulty_val || 5;
  const previousWeakScore    = previous?.weak_score     || 0;
  const previousMemoryScore  = previous?.memory_score   || 0;
  const previousPersonalHits = previous?.personal_hits  || 0;
  const previousMemoryStatus = previous?.memory_status  || 'active';

  let stability       = previousStability;
  let difficultyValue = previousDifficulty;
  let lapses          = previousLapses;
  let queueScore      = 0;

  const intervalDays = calculateAdaptiveIntervalDays({
    difficulty:           params.difficulty,
    previousInterval,
    previousStability,
    previousDifficulty,
    previousWeakScore,
    previousMemoryScore,
    previousPersonalHits,
    previousMemoryStatus,
  });

  if (params.difficulty === 'easy') {
    stability       = clampNumber(stability + 1.35 + previousMemoryScore / 100, 0.5, 20);
    difficultyValue = clampNumber(difficultyValue - 0.45, 1, 10);
    queueScore      = Math.max(0,
      difficultyValue * 3.5 + lapses * 8 +
      previousWeakScore * 0.35 - previousMemoryScore * 0.25
    );
  } else if (params.difficulty === 'medium') {
    stability       = clampNumber(stability + 0.55, 0.5, 20);
    difficultyValue = clampNumber(difficultyValue + 0.05, 1, 10);
    queueScore      = Math.max(20,
      difficultyValue * 5 + lapses * 10 +
      previousWeakScore * 0.55 - previousMemoryScore * 0.15
    );
  } else {
    stability       = Math.max(0.5, stability - 0.8);
    difficultyValue = Math.min(10, difficultyValue + 0.9);
    lapses         += 1;
    queueScore      = Math.max(90, 100 + previousWeakScore * 0.45);
  }

  const repetitions = previousRepetitions + 1;
  const memory      = calculateMemoryScores({
    difficulty:   params.difficulty,
    previous,
    repetitions,
    lapses,
    intervalDays,
    queueScore,
  });

  const nextDueAt = calculateAdaptiveNextDueAt({
    difficulty:   params.difficulty,
    intervalDays,
    weakScore:    memory.weak_score,
    memoryStatus: memory.memory_status,
  });

  return {
    interval_days:    intervalDays,
    repetitions,
    lapses,
    stability,
    difficulty_val:   difficultyValue,
    retention:
      params.difficulty === 'easy'   ? 0.93 :
      params.difficulty === 'medium' ? 0.88 : 0.72,
    queue_score:      Math.round(queueScore),
    last_reviewed_at: new Date().toISOString(),
    next_due_at:      nextDueAt,
    ...memory,
  };
}

// ============================================================
// Learning progress helpers
// ============================================================

async function getLearningProgressIds(userId: string): Promise<string[]> {
  const { data: { session } } = await supabase.auth.getSession();
  console.log('=== AUTH DEBUG ===');
  console.log('userId:', userId);
  console.log('session uid:', session?.user?.id ?? 'NO SESSION');
  console.log('has token:', !!session?.access_token);

  const { data, error } = await supabase
    .from('learning_progress')
    .select('lexeme_id')
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return (data || []).map((item: any) => item.lexeme_id).filter(Boolean);
}

async function getPreviousSrs(userId: string, lexemeId: string): Promise<SrsPrevious | null> {
  const { data, error } = await supabase
    .from('learning_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('lexeme_id', lexemeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

// ============================================================
// Fetch word sets
// ============================================================

async function fetchNewWords(params: {
  userId:         string;
  categoryFilter: string;
  limit:          number;
}) {
  const reviewedIds = await getLearningProgressIds(params.userId);

  let query = supabase
    .from('lexemes')
    .select(LEXEME_SELECT)
    .eq('status', 'New')
    .eq('is_learning_lexeme', true);

  query = applyCategoryFilterToQuery(query, params.categoryFilter);

  if (reviewedIds.length > 0) {
    query = query.not('id', 'in', `(${reviewedIds.join(',')})`);
  }

  query = query.limit(params.limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return await mapLexemeRows(data || []);
}

async function fetchDueWords(params: {
  userId:         string;
  categoryFilter: string;
  limit:          number;
}) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('learning_progress')
    .select(`
      next_due_at, priority_score, weak_score, memory_status,
      lexemes (${LEXEME_SELECT})
    `)
    .eq('user_id', params.userId)
    .eq('lexemes.is_learning_lexeme', true)
    .lte('next_due_at', now)
    .order('next_due_at', { ascending: true })
    .limit(params.limit * 3);

  if (error) throw new Error(error.message);

  const mapped2 = await mapLexemeRows(attachSrsMetaToLexemeRows(data || []));
  return sortByLearningPriority(
    mapped2.filter((item) => matchesCategoryFilter(item, params.categoryFilter))
  ).slice(0, params.limit);
}

async function fetchWeakWords(params: {
  userId:         string;
  categoryFilter: string;
  limit:          number;
}) {
  const { data, error } = await supabase
    .from('learning_progress')
    .select(`
      queue_score, priority_score, weak_score, memory_status,
      difficulty_val, lapses, repetitions,
      lexemes (${LEXEME_SELECT})
    `)
    .eq('user_id', params.userId)
    .eq('lexemes.is_learning_lexeme', true)
    .or('weak_score.gte.20,priority_score.gte.75,queue_score.gte.60,lapses.gte.1,difficulty_val.gte.7')
    .order('priority_score', { ascending: false, nullsFirst: false })
    .limit(params.limit * 3);

  if (error) throw new Error(error.message);

  const mapped3 = await mapLexemeRows(attachSrsMetaToLexemeRows(data || []));
  return sortByLearningPriority(
    mapped3.filter((item) => matchesCategoryFilter(item, params.categoryFilter))
  ).slice(0, params.limit);
}

async function fetchPriorityWords(params: {
  userId:         string;
  categoryFilter: string;
  limit:          number;
}) {
  const { data, error } = await supabase
    .from('learning_progress')
    .select(`
      priority_score, weak_score, queue_score, memory_status,
      memory_score, personal_hits, repetitions, lapses,
      difficulty_val, last_seen_in_reading, next_due_at,
      lexemes (${LEXEME_SELECT})
    `)
    .eq('user_id', params.userId)
    .eq('lexemes.is_learning_lexeme', true)
    .or('personal_hits.gte.1,priority_score.gte.30,weak_score.gte.20')
    .order('priority_score', { ascending: false, nullsFirst: false })
    .limit(params.limit * 4);

  if (error) throw new Error(error.message);

  const mapped4 = await mapLexemeRows(attachSrsMetaToLexemeRows(data || []));
  return sortByLearningPriority(
    mapped4
      .filter((item) => matchesCategoryFilter(item, params.categoryFilter))
      .filter((item: any) => item?.srs?.memory_status !== 'passive_known')
  ).slice(0, params.limit);
}

async function fetchAllLearningWords(params: {
  userId:         string;
  categoryFilter: string;
  limit:          number;
}) {
  const dueLimit      = Math.ceil(params.limit * 0.4);
  const weakLimit     = Math.ceil(params.limit * 0.3);
  const priorityLimit = Math.ceil(params.limit * 0.25);
  const newLimit      = params.limit;

  const [dueWords, weakWords, priorityWords, newWords] = await Promise.all([
    fetchDueWords     ({ ...params, limit: dueLimit }),
    fetchWeakWords    ({ ...params, limit: weakLimit }),
    fetchPriorityWords({ ...params, limit: priorityLimit }),
    fetchNewWords     ({ ...params, limit: newLimit }),
  ]);

  return uniqueById([
    ...dueWords, ...weakWords, ...priorityWords, ...newWords,
  ]).slice(0, params.limit);
}

// ============================================================
// Public: getLearningWordsFromSupabase
// ============================================================

export async function getLearningWordsFromSupabase(settings?: LearningSettings) {
  const userId         = settings?.preferred_user  || getCurrentUserId();
  const categoryFilter = settings?.category_filter || 'all';
  const limit          = settings?.daily_limit      || 50;

  const studySet: StudySet =
    settings?.study_set === 'new'  ? 'new'  :
    settings?.study_set === 'weak' ? 'weak' :
    settings?.study_set === 'due'  ? 'due'  : 'all';

  if (studySet === 'new')  return fetchNewWords ({ userId, categoryFilter, limit });
  if (studySet === 'weak') return fetchWeakWords({ userId, categoryFilter, limit });
  if (studySet === 'due')  return fetchDueWords ({ userId, categoryFilter, limit });

  return fetchAllLearningWords({ userId, categoryFilter, limit });
}

// ============================================================
// Public: saveReviewToSupabase
// ============================================================

export async function saveReviewToSupabase(payload: {
  user:       string;
  mode:       string;
  word:       string;
  answer?:    string;
  correct:    boolean;
  difficulty: 'hard' | 'medium' | 'easy';
  lexemeId?:  string;
  wordId?:    string;
}) {
  const userId   = payload.user || getCurrentUserId();
  const lexemeId = payload.lexemeId || payload.wordId;
  if (!lexemeId) throw new Error('Missing lexemeId');

  const { error: reviewError } = await supabase.from('reviews').insert({
    user_id:     userId,
    lexeme_id:   lexemeId,
    mode:        payload.mode,
    answer:      payload.answer || '',
    correct:     payload.correct,
    difficulty:  payload.difficulty,
    reviewed_at: new Date().toISOString(),
  });

  if (reviewError) throw new Error(reviewError.message);

  const previousSrs = await getPreviousSrs(userId, lexemeId);
  const srsUpdate   = calculateSrsUpdate({
    difficulty: payload.difficulty,
    previous:   previousSrs,
  });

  const { error: srsError } = await supabase
    .from('learning_progress')
    .upsert({
      user_id:    userId,
      lexeme_id:  lexemeId,
      ...srsUpdate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lexeme_id' });

  if (srsError) throw new Error(srsError.message);

  return { ok: true, srs: srsUpdate };
}

// ============================================================
// Public: getDashboardStatsFromSupabase
// ============================================================

export async function getDashboardStatsFromSupabase(preferredUser?: string) {
  const userId = preferredUser || getCurrentUserId();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const nowIso   = new Date().toISOString();

  const [
    totalResult,
    learnedResult,
    weakResult,
    dueResult,
    reviewsTodayResult,
    accuracyTodayResult,
  ] = await Promise.all([
    supabase.from('lexemes').select('id', { count: 'exact', head: true }).eq('is_learning_lexeme', true),

    supabase.from('learning_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),

    supabase.from('learning_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .or('weak_score.gte.20,priority_score.gte.75,queue_score.gte.60,lapses.gte.1,difficulty_val.gte.7'),

    supabase.from('learning_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lte('next_due_at', nowIso),

    supabase.from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('reviewed_at', todayIso),

    supabase.from('reviews')
      .select('correct')
      .eq('user_id', userId)
      .gte('reviewed_at', todayIso),
  ]);

  const reviewsToday = reviewsTodayResult.count || 0;
  const accuracyRows = accuracyTodayResult.data  || [];
  const correctCount = accuracyRows.filter((item: any) => item.correct).length;
  const accuracy     = reviewsToday > 0
    ? Math.round((correctCount / reviewsToday) * 100) : 0;

  return {
    totalWords:    totalResult.count    || 0,
    learnedWords:  learnedResult.count  || 0,
    weakWords:     weakResult.count     || 0,
    dueToday:      dueResult.count      || 0,
    reviewsToday,
    accuracyToday: accuracy,
  };
}

// ============================================================
// Public: getReadingLexemesFromSupabase
// ============================================================

export async function getReadingLexemesFromSupabase(preferredUser?: string) {
  const userId    = preferredUser || getCurrentUserId();
  const PAGE_SIZE = 1000;
  let allLexemes: any[] = [];
  let from     = 0;
  let hasMore  = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('lexemes')
      .select(LEXEME_SELECT)
      .eq('is_learning_lexeme', true)
      .range(from, from + PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    if (error) throw new Error(error.message);
    const rows = data || [];
    allLexemes = [...allLexemes, ...rows];
    hasMore    = rows.length === PAGE_SIZE;
    from      += PAGE_SIZE;
  }

  const { data: learnedData, error: learnedError } = await supabase
    .from('learning_progress')
    .select('lexeme_id')
    .eq('user_id', userId);

  if (learnedError) throw new Error(learnedError.message);

  const learnedIds = new Set(
    (learnedData || []).map((item: any) => item.lexeme_id).filter(Boolean)
  );

  const mappedAll = await mapLexemeRows(allLexemes);
  return mappedAll.map((word: any) => ({
    ...word,
    learned: learnedIds.has(word.id),
  }));
}

// ============================================================
// Public: addLexemeToLearningFromSupabase
// ============================================================

export async function addLexemeToLearningFromSupabase(params: {
  preferred_user?: string;
  lexemeId:        string;
}) {
  const userId   = params.preferred_user || getCurrentUserId();
  const lexemeId = params.lexemeId;
  if (!lexemeId) throw new Error('Missing lexemeId');

  const { data: lexemeRow, error: lexemeError } = await supabase
    .from('lexemes')
    .select('id, is_learning_lexeme, dictionary_status, dictionary_exclusion_reason')
    .eq('id', lexemeId)
    .maybeSingle();

  if (lexemeError) throw new Error(lexemeError.message);
  if (!lexemeRow) throw new Error('Lexeme not found');
  if (lexemeRow.is_learning_lexeme === false) {
    throw new Error(`This lexeme is excluded from learning: ${lexemeRow.dictionary_exclusion_reason || lexemeRow.dictionary_status || 'not_learning_lexeme'}`);
  }

  const { data: existing } = await supabase
    .from('learning_progress')
    .select('id')
    .eq('user_id', userId)
    .eq('lexeme_id', lexemeId)
    .maybeSingle();

  if (existing?.id) return { ok: true, alreadyExists: true };

  const now = new Date().toISOString();

  const { error } = await supabase.from('learning_progress').insert({
    user_id:        userId,
    lexeme_id:      lexemeId,
    status:         'New',
    ease_factor:    2.5,
    interval_days:  0,
    repetitions:    0,
    lapses:         0,
    stability:      1,
    difficulty_val: 5,
    retention:      0.9,
    queue_score:    20,
    memory_status:  'active',
    memory_score:   0,
    priority_score: 35,
    weak_score:     0,
    next_due_at:    now,
    updated_at:     now,
  });

  if (error) throw new Error(error.message);
  return { ok: true, alreadyExists: false };
}

// ============================================================
// Public: boostReadingLexemeHitsInSupabase
// ============================================================

export async function boostReadingLexemeHitsInSupabase(params: {
  preferred_user?: string;
  lexemeIds:       string[];
}) {
  const userId    = params.preferred_user || getCurrentUserId();
  const uniqueIds = Array.from(new Set((params.lexemeIds || []).filter(Boolean)));
  if (!uniqueIds.length) return { ok: true, updated: 0 };

  const now = new Date().toISOString();

  const { data: existingRows } = await supabase
    .from('learning_progress')
    .select('lexeme_id, personal_hits, priority_score, memory_status')
    .eq('user_id', userId)
    .in('lexeme_id', uniqueIds);

  const existingMap = new Map(
    (existingRows || []).map((item: any) => [item.lexeme_id, item])
  );

  const rowsToUpsert = uniqueIds.map((lexemeId) => {
    const existing         = existingMap.get(lexemeId);
    const nextPersonalHits = (existing?.personal_hits || 0) + 1;
    const currentPriority  = existing?.priority_score || 0;

    return {
      user_id:              userId,
      lexeme_id:            lexemeId,
      status:               'New',
      ease_factor:          2.5,
      interval_days:        0,
      repetitions:          0,
      lapses:               0,
      stability:            1,
      difficulty_val:       5,
      retention:            0.9,
      queue_score:          existing ? undefined : 20,
      memory_status:        existing?.memory_status || 'active',
      personal_hits:        nextPersonalHits,
      priority_score:       Math.min(150, currentPriority + 5),
      last_seen_in_reading: now,
      updated_at:           now,
    };
  });

  const { error } = await supabase
    .from('learning_progress')
    .upsert(rowsToUpsert, { onConflict: 'user_id,lexeme_id' });

  if (error) throw new Error(error.message);
  return { ok: true, updated: rowsToUpsert.length };
}

// ============================================================
// Public: searchLexemeInSupabase
// ============================================================

export async function searchLexemeInSupabase(query: string): Promise<any> {
  const original       = String(query || '').trim();
  const normalized     = normalizeLexemeSearchKey(original);
  const withoutPrefix  = normalizeLexemeSearchKey(
    original
      .replace(/^å\s+/i, '')
      .replace(/^(en|ei|et)\s+/i, '')
  );

  const keys = Array.from(new Set([original, normalized, withoutPrefix].filter(Boolean)));
  if (!keys.length) return { found: false, item: null };

  for (const key of keys) {
    const { data, error } = await supabase
      .from('lexemes')
      .select(LEXEME_SELECT)
      .eq('is_learning_lexeme', true)
      .or(`lemma.eq.${key},display_form.eq.${key}`)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return { found: true, item: mapLexemeRow(data) };
  }

  for (const key of keys) {
    const { data, error } = await supabase
      .from('lexemes')
      .select(LEXEME_SELECT)
      .eq('is_learning_lexeme', true)
      .or(`lemma.ilike.${key},display_form.ilike.${key}`)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return { found: true, item: mapLexemeRow(data) };
  }

  return { found: false, item: null };
}

// ============================================================
// Public: addExpressionCandidateToSupabase
// ============================================================

export async function addExpressionCandidateToSupabase(params: {
  candidate:       any;
  preferred_user?: string;
}): Promise<any> {
  const candidate   = params.candidate || {};
  const lemma       = expressionLemmaFromCandidate(candidate);
  const displayForm = String(candidate.display_form || candidate.text || lemma).trim() || lemma;

  if (!lemma) return { ok: false, message: 'Missing expression lemma' };

  const existing = await searchLexemeInSupabase(lemma);
  if (existing?.found && existing?.item) {
    return { ok: true, alreadyExists: true, item: existing.item };
  }

  const payload = {
    lemma,
    pos:              'expression',
    display_form:     displayForm,
    translation_ua:   candidate.meaning_ua   || candidate.translation_ua || candidate.ua || null,
    translation_en:   candidate.meaning_en   || candidate.translation_en || candidate.en || null,
    example:          candidate.example      || null,
    notes:            candidate.notes_ua     || candidate.notes          || null,
    cefr:             candidate.cefr         || null,
    frequency_rank:   candidate.frequency_rank  ?? null,
    frequency_level:  candidateFrequencyLevel(candidate) || null,
    frequency_source: candidate.frequency_source || (candidate.frequency_level ? 'gemini_estimate' : null),
    frequency_note:   candidate.frequency_note  || null,
    status:           'New',
    dictionary_status: 'active',
    is_learning_lexeme: true,
    source:           candidate.source || 'AI analyzer',
    verification:        candidate.verification === 'known_dictionary' ? 'verified_dictionary' : 'ai_candidate',
    verification_tier:   candidate.verification_tier   || 'ai_candidate',
    verification_status: candidate.verification_status || 'ai_candidate',
    source_verified:     candidate.source_verified     || null,
    enrichment_status: 'ai_candidate',
    enrichment_error:  null,
  };

  const { data, error } = await supabase
    .from('lexemes')
    .upsert(payload, { onConflict: 'lemma,pos' })
    .select(LEXEME_SELECT)
    .single();

  if (error) return { ok: false, message: error.message };

  const subtype = candidate.expression_subtype || candidate.subtype || '';
  if (subtype && data?.id) {
    const { error: expressionError } = await supabase
      .from('expression_data')
      .upsert({ lexeme_id: data.id, expression_subtype: subtype }, { onConflict: 'lexeme_id' });

    if (expressionError) {
      console.warn('expression_data upsert error:', expressionError.message);
    }
  }

  return {
    ok:            true,
    alreadyExists: false,
    item: {
      ...mapLexemeRow(data),
      expression_subtype: subtype || mapLexemeRow(data)?.expression_subtype || '',
    },
  };
}

// ============================================================
// Public: addLexemeToGlobalBaseFromSupabase
// — enrich-word removed; only works for words already in lexemes
// ============================================================

export async function addLexemeToGlobalBaseFromSupabase(params: {
  preferred_user?: string;
  word:            string;
  category?:       string;
  ua?:             string;
  en?:             string;
}): Promise<any> {
  const userId = params.preferred_user || getCurrentUserId();
  const found  = await searchLexemeInSupabase(params.word);

  if (found?.item) {
    await addLexemeToLearningFromSupabase({ preferred_user: userId, lexemeId: found.item.id });
    return { ok: true, alreadyExists: true, word: { ...found.item, learned: true } };
  }

  // enrich-word edge function was deleted — new words can no longer be
  // created automatically from here. The backend B-pipeline
  // (ordbokene-lexeme-pipeline-worker, naob-pipeline-worker) enriches
  // words asynchronously after analyze-text runs. Words will appear in
  // the base once that pipeline processes them.
  return {
    ok:      false,
    message: 'Word not found in database. It will be available after the enrichment pipeline processes it.',
  };
}

// ============================================================
// Public: translateSentenceWithAI
// — translate-sentence edge function was deleted; stub until replaced
// ============================================================

export async function translateSentenceWithAI(params: {
  sentence:        string;
  profileKey?:     string;
  targetLanguage?: 'ua' | 'en';
}): Promise<any> {
  // translate-sentence edge function was deleted as part of the legacy
  // cleanup (2026-06-22). A replacement implementation is needed —
  // either a new edge function or direct Gemini call from the client.
  throw new Error('Sentence translation is temporarily unavailable. The translate-sentence service has been removed and needs to be replaced.');
}

// ============================================================
// Public: analyzeTextViaGemini
// ============================================================

export async function analyzeTextViaGemini(textInput: string): Promise<any> {
  const response = await supabase.functions.invoke('analyze-text', {
    body: { text: textInput },
  });

  if (response.error) throw new Error(response.error.message || 'analyze-text failed');
  if (!response.data?.ok) throw new Error(response.data?.message || 'analyze-text returned not ok');
  return response.data;
}

// ============================================================
// Apps Script — analyzeText через Gemini Edge Function
// ============================================================

export async function analyzeTextViaAppsScript(textInput: string) {
  return analyzeTextViaGemini(textInput);
}

// ============================================================
// Deprecated stubs — обратная совместимость
// ============================================================

export async function inspectWordViaAppsScript(query: string) {
  // enrich-word was deleted — fall back to database search only.
  // Unknown words will no longer get an auto-generated preview;
  // the backend pipeline enriches them asynchronously.
  return searchLexemeInSupabase(query);
}

export async function addPreviewWordViaAppsScript(_preview: any) {
  // enrich-word was deleted — preview-based word creation is no longer
  // available. Words are enriched via the B-pipeline (Ordbokene/NAOB)
  // after analyze-text runs.
  return { ok: false, message: 'Word preview creation is unavailable. Words are enriched automatically by the background pipeline.' };
}
// ============================================================
// Public: job progress polling (for the ⏳/✅ icon on the reading screen)
// ============================================================

interface JobStatusContractResponse {
  ok: boolean;
  status: 'processing' | 'completed' | 'needs_manual_review';
  ready: boolean;
  execution_state:
    | 'pending'
    | 'running'
    | 'completed'
    | 'failed'
    | 'needs_manual_review';
  quality_state:
    | 'ready'
    | 'provisional'
    | 'needs_review'
    | 'blocked'
    | null;
  learner_ready: boolean;
  summary: any;
  progress: any;
  chain_progress?: Array<{
    chain_index: number;
    chain_key: string;
    display_label: string;
    done_count: number;
    total_count: number;
    is_current: boolean;
    is_complete: boolean;
  }>;
  quality?: any;
  items?: any[];
}

async function invokeJobStatus(
  jobId: string,
  includeChainProgress = false,
): Promise<JobStatusContractResponse> {
  const { data, error } = await supabase.functions.invoke(
    'get-job-status',
    {
      body: {
        job_id: jobId,
        include_chain_progress: includeChainProgress,
      },
    },
  );
  if (error) {
    throw new Error(error.message || 'get-job-status failed');
  }
  if (!data?.ok) {
    throw new Error(data?.error || 'get-job-status returned not ok');
  }
  return data as JobStatusContractResponse;
}

// Progress is read through the owner-checked Edge Function. The mobile
// client no longer calls privileged/direct database RPCs.
export async function getJobProgress(jobId: string): Promise<any> {
  const response = await invokeJobStatus(jobId);
  return response.progress;
}

// Chain progress follows the same ownership boundary.
export async function getJobChainProgress(jobId: string): Promise<Array<{
  chain_index: number;
  chain_key: string;
  display_label: string;
  done_count: number;
  total_count: number;
  is_current: boolean;
  is_complete: boolean;
}>> {
  const response = await invokeJobStatus(jobId, true);
  return response.chain_progress || [];
}

// Execution and linguistic quality are separate. Compatibility field
// status becomes completed only when the completion contract says the
// result is learner-ready.
export async function getJobStatus(
  jobId: string,
): Promise<JobStatusContractResponse> {
  return invokeJobStatus(jobId);
}

export async function getLearningWords() {
  return getLearningWordsFromSupabase();
}

export async function saveReview(payload: any) {
  return saveReviewToSupabase(payload);
}
