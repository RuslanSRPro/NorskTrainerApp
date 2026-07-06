// supabase/functions/analyze-text/index.ts

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  normalize,
  normalizeExpression,
  tokenize,
} from '../_shared/nlp/normalize.ts';
import {
  planItems,
  type ExpressionRow,
  type PlannedItem,
  type SurfaceResolution,
  type VerbMaps,
} from './grammar-parser.ts';
import { generateExpressionCandidates } from './candidate-generator.ts';
import { resolveExpressions } from './expression-resolver.ts';
import { resolveCandidatesAgainstCatalog } from './candidate-catalog-bridge.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SOURCES = ['NAOB', 'Ordbokene', 'Lexin', 'Språkrådet', 'Wiktionary'];

const INGESTION_VERSION =
  'ts_expression_aware_ingestion_v14_lexeme360_full_family';

const MAX_360_CANDIDATES_PER_ROOT = 30;


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
  const { data: trustedData, error: trustedError } = await supabase
    .from('trusted_expressions_v1')
    .select(`
      id,
      lemma,
      display_form,
      normalized_key,
      pos,
      expression_subtype
    `)
    .not('normalized_key', 'is', null);

  if (trustedError) throw trustedError;

  for (const row of trustedData ?? []) {
    addExpression(row);
  }

  // 2. Expression catalog entries already linked to lexemes.
  const { data: catalogData, error: catalogError } = await supabase
    .from('expression_catalog')
    .select(`
      id,
      lemma,
      lexeme_id,
      expression_subtype,
      verification_status
    `)
    .not('lexeme_id', 'is', null);

  if (catalogError) throw catalogError;

  for (const row of catalogData ?? []) {
    addExpression({
      id: row.id,
      lemma: row.lemma,
      display_form: row.lemma,
      normalized_key: row.lemma,
      pos: 'expression',
      expression_subtype: row.expression_subtype,
    });
  }

  // 3. Legacy expressions from lexemes.
  // This is required to restore v6 behavior:
  // old analyzer used lexemes where pos = expression.
  const { data: lexemeExpressionData, error: lexemeExpressionError } =
    await supabase
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
      .eq('pos', 'expression');

  if (lexemeExpressionError) throw lexemeExpressionError;

  for (const row of lexemeExpressionData ?? []) {
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
  const { data, error } = await supabase
    .from('verb_forms')
    .select('infinitiv, presens, perfektum');

  if (error) throw error;

  const presensToInfinitiv = new Map<string, string>();
  const perfektumToInfinitiv = new Map<string, string>();

  for (const row of data ?? []) {
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

  return {
    presensToInfinitiv,
    perfektumToInfinitiv,
  };
}

async function resolveSurfaceForm(
  surfaceForm: string,
): Promise<SurfaceResolution | null> {
  const { data, error } = await supabase.rpc('resolve_surface_form', {
    p_surface_form: surfaceForm,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;

  if (!row?.lexeme_id || !row?.lemma) {
    return null;
  }

  return {
    lexeme_id: row.lexeme_id,
    lemma: row.lemma,
    pos: row.pos,
    form_type: row.form_type,
    grammatical_features: row.grammatical_features ?? {},
    confidence: row.confidence,
    source: row.source,
  };
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
      verification_status
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
// plannedItems перед вставкой в БД. Убирает дубликаты, которые могут
// возникнуть из-за нескольких независимых путей добавления items
// (parser, candidate_generator, candidate_catalog_bridge,
// addLexeme360NetworkCandidates) — если два пути привели к ОДНОЙ И ТОЙ ЖЕ
// реальной встрече выражения в тексте (совпадают и expression_id, и
// границы токенов), остаётся только первое вхождение.
//
// Важно: token_start/token_end включены в ключ ВСЕГДА, даже когда
// expression_id уже известен. Иначе одно и то же выражение, реально
// встретившееся в тексте несколько раз (например "tok seg av barna... og
// senere tok seg av hunden"), схлопнулось бы в одно вхождение — теряя
// вторую реальную встречу вместо устранения дубликата одной и той же
// встречи, найденной разными путями резолюции.
function dedupePlannedItems(items: PlannedItem[]): PlannedItem[] {
  const seen = new Set<string>();
  const result: PlannedItem[] = [];
  let removed = 0;

  for (const item of items) {
    const key = item.expression_id
      ? `expr:${item.expression_id}:${item.token_start}:${item.token_end}`
      : `${item.match_type}:${normalizeExpression(item.normalized_lemma || item.normalized_input)}:${item.token_start}:${item.token_end}`;

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

async function insertItems(jobId: string, items: PlannedItem[]) {
  let expressionItems = 0;
  let tokenItems = 0;
  let lexeme360NetworkItems = 0;
  let generatedExpressionCandidates = 0;

  const sourceCheckRows: Array<{
    itemId: string;
    lexemeId: string | null;
    query: string;
    surfaceForm: string;
    queryType: 'expression' | 'token';
  }> = [];

  for (const item of items) {
    const { data, error } = await supabase
      .from('lexeme_processing_items')
      .insert({
        job_id: jobId,
        expression_id: item.expression_id,
        lexeme_id: null,
        raw_input: item.raw_input,
        normalized_input: item.normalized_input,
        normalized_lemma: item.normalized_lemma,
        surface_form: item.surface_form,
        pos: item.pos,
        match_type: item.match_type,
        status: 'pending',
        current_stage: 'source_checks',
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

  return {
    expressionItems,
    tokenItems,
    lexeme360NetworkItems,
    generatedExpressionCandidates,
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const text = String(body.text || '').trim();

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
        p_user_id: body.user_id ?? null,
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
    );

    const generatedCandidates = generateExpressionCandidates(plannedItems);
    plannedItems.push(...generatedCandidates);

    // ФИКС: bridge-шаг между candidate_generator и остальным пайплайном.
    // candidate_generator создаёt items с expression_id: null, полагая,
    // что кто-то потом найдёт совпадение в expression_catalog по
    // normalized_lemma — но ни resolveExpressions (работает только с уже
    // готовым expression_id), ни addLexeme360NetworkCandidates (работает
    // по root_lemma, не по точной лемме) этого не делали. Без этого шага
    // такие "осиротевшие" кандидаты доходили до промоушена как НОВЫЕ
    // записи, даже если выражение уже существовало в каталоге (см. кейс
    // "tok meg av" → normalized_lemma "ta seg av", хотя "ta seg av" уже
    // есть в expression_catalog).
    //
    // Запускается ДО addLexeme360NetworkCandidates, чтобы её
    // existingExpressionIds уже содержал найденные здесь expression_id —
    // это предотвращает повторное добавление того же выражения через
    // сетевой (root_lemma) путь.
    const candidateBridgeResult = await resolveCandidatesAgainstCatalog(
      supabase,
      plannedItems,
    );

    const expressionResolution = await resolveExpressions(
      supabase,
      plannedItems,
    );

    const lexeme360Network = await addLexeme360NetworkCandidates(plannedItems);

    // ФИКС: финальный дедуп после того, как все источники (parser,
    // candidate_generator + bridge, lexeme360 network) дописали в массив.
    // Защита от повторной вставки одного и того же expression_id (или
    // одной и той же normalized_lemma в тех же границах токенов) в БД.
    const dedupedPlannedItems = dedupePlannedItems(plannedItems);
    plannedItems.length = 0;
    plannedItems.push(...dedupedPlannedItems);

    const resolvedLexemeIds = plannedItems
      .map((i) => i.resolved?.lexeme_id)
      .filter((id): id is string => Boolean(id));

    if (resolvedLexemeIds.length > 0) {
      const { data: lexemeData } = await supabase
        .from('lexemes')
        .select('id, cefr_level, frequency_rank, frequency_ipm')
        .in('id', resolvedLexemeIds);

      if (lexemeData?.length) {
        const lexemeMap = new Map(
          lexemeData.map((l) => [
            l.id,
            {
              cefr_level: l.cefr_level ?? null,
              frequency_rank: l.frequency_rank ?? null,
              frequency_ipm: l.frequency_ipm ?? null,
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
          }
        }
      }
    }

    const {
      expressionItems,
      tokenItems,
      lexeme360NetworkItems,
      generatedExpressionCandidates,
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
});