// supabase/functions/analyze-text/grammar-parser.ts
// Norsk Trainer — Grammar Parser v1.4 (+ isolatedMode, 06.08.2026)
//
// Responsibility:
//   1. Detect already-known multi-word expressions before single-word tokens.
//   2. Normalize common Norwegian expression forms:
//      - presens -> infinitiv at expression start: tar med -> ta med
//      - auxiliary + perfektum: har hatt det travelt -> ha det travelt
//      - reflexive pronouns: gleder meg til -> glede seg til
//   3. Return planned items with covered token ranges.
//
// Important:
//   Parser does not discover new expressions.
//   It only recognizes expressions already present in expressionDict.
//
// v1.2 CHANGES:
//   - "å" (infinitive marker) is now skipped entirely instead of becoming
//     its own lexeme_processing_item. It carries no independent lexical
//     meaning for a learner ("å ta" = "to take" — "å" is a pure
//     grammatical marker, same role as English "to" before an infinitive).
//     Previously "å ta" produced TWO separate items ("å" and "ta"), even
//     though "ta" already resolves to the same lexeme regardless of form
//     (tar/tok/tatt/å ta all map to one lexeme_id via resolve_surface_form).
//   - resolveSurfaceForm now receives context (previous/next raw token,
//     and whether the current token was directly preceded by "å") so that
//     genuinely POS-ambiguous words (e.g. "få" = verb "to get" vs
//     adjective "few") can be disambiguated by resolve_surface_form
//     instead of always defaulting to whichever source table happens to
//     be checked first. See resolve_surface_form SQL migration
//     (05_resolve_surface_form_context_disambiguation.sql) for the actual
//     disambiguation rules. Passing context here is backward compatible:
//     resolve_surface_form's new parameters all have defaults, so this
//     also works fine against the old RPC signature (context args are
//     simply ignored server-side until the RPC is updated).
//
// v1.4 CHANGES (06.08.2026):
//   - Added `options?.isolatedMode` to planItems(). When true, prevToken/
//     nextToken are forced to null for EVERY token, regardless of what
//     actually sits next to it in the raw text. Reason: comma-separated
//     word-list testing ("stor, liten, god, ...") was giving each word a
//     "context" consisting of an unrelated adjacent list entry — this is
//     not real grammar, but resolve_surface_form_contextual couldn't tell
//     the difference, so it never hit its own "no context → return ALL
//     POS candidates" branch and instead fell through to a low-confidence
//     single-guess fallback. Found on live data: "varm" (adjective "warm")
//     silently resolved to the verb "varme" ("to heat") because its list
//     neighbor "treg" looked like context. isolatedMode restores the
//     already-existing "return all candidates" behavior for this testing
//     style, without any SQL changes. The "å X" infinitive-marker check
//     stays active even in isolatedMode — writing "å ta" is a deliberate
//     signal from whoever built the word list, not accidental adjacency.

import {
  normalize,
  normalizeExpression,
  tokenize,
} from '../_shared/nlp/normalize.ts';
import { normalizeCompoundTokens } from '../_shared/nlp/morphology.ts';

const MAX_PHRASE_TOKENS = 8;

export type ExpressionRow = {
  id: string;
  lemma: string;
  display_form: string;
  normalized_key: string;
  pos: string;
  expression_subtype: string | null;
  token_len: number;
};

export type VerbMaps = {
  presensToInfinitiv: Map<string, string>;
  perfektumToInfinitiv: Map<string, string>;
};

export type SurfaceResolution = {
  lexeme_id: string;
  lemma: string;
  pos: string;
  form_type: string;
  grammatical_features: Record<string, unknown>;
  confidence: string;
  source: string;
};

export type PlannedItem = {
  raw_input: string;
  normalized_input: string;
  normalized_lemma: string;
  surface_form: string;
  pos: string | null;
  match_type: 'expression' | 'token';
  expression_id: string | null;
  token_start: number;
  token_end: number;
  expression_subtype?: string | null;
  resolved?: SurfaceResolution | null;
  match_strategy?:
    | 'exact_expression'
    | 'compound_normalized'
    | 'token'
    | 'lexeme360_network_candidate';
  compound_normalized?: string | null;
  network_root_lemma?: string | null;
};

// Контекст, передаваемый в resolveSurfaceForm вместе с самим словом —
// нужен только для дизамбигуации POS-омонимов (см. шапку файла). Все поля
// опциональны: вызывающий код (analyze-text/index.ts) сам решает, что
// делать с ними при вызове RPC.
export type SurfaceFormContext = {
  prevToken?: string | null;
  nextToken?: string | null;
  precededByInfinitiveMarker?: boolean;
};

export type ResolveSurfaceFormFn = (
  surfaceForm: string,
  context?: SurfaceFormContext,
) => Promise<SurfaceResolution[]>;

// ДОБАВЛЕНО (06.08.2026): опции planItems(). Сейчас единственная опция —
// isolatedMode (см. шапку файла).
export type PlanItemsOptions = {
  isolatedMode?: boolean;
};

function markCovered(covered: Set<number>, start: number, end: number) {
  for (let i = start; i <= end; i++) {
    covered.add(i);
  }
}

export function findKnownExpression(
  tokensRaw: string[],
  tokensNorm: string[],
  start: number,
  expressionDict: Map<string, ExpressionRow>,
  verbMaps: VerbMaps,
): {
  expr: ExpressionRow;
  rawSurface: string;
  normalizedKey: string;
  end: number;
  matchStrategy: 'exact_expression' | 'compound_normalized';
  compoundNormalized: string | null;
} | null {
  const maxLen = Math.min(
    MAX_PHRASE_TOKENS,
    tokensRaw.length - start,
  );

  for (let len = maxLen; len >= 2; len--) {
    const rawSlice = tokensRaw.slice(start, start + len);
    const normSlice = tokensNorm.slice(start, start + len);

    const rawSurface = rawSlice.join(' ');
    const normKey = normalizeExpression(rawSurface);

    const exact = expressionDict.get(normKey);

    if (exact?.pos === 'expression') {
      console.log('[PARSER EXPRESSION EXACT]', {
        rawSurface,
        normKey,
        lemma: exact.lemma,
        id: exact.id,
      });

      return {
        expr: exact,
        rawSurface,
        normalizedKey: exact.normalized_key || normKey,
        end: start + len - 1,
        matchStrategy: 'exact_expression',
        compoundNormalized: null,
      };
    }

    const normalizedTokens = normalizeCompoundTokens(
      normSlice,
      verbMaps.presensToInfinitiv,
      verbMaps.perfektumToInfinitiv,
    );

    const compoundKey = normalizeExpression(normalizedTokens.join(' '));
    const compound = expressionDict.get(compoundKey);

    if (compound?.pos === 'expression') {
      console.log('[PARSER EXPRESSION COMPOUND]', {
        rawSurface,
        normKey,
        compoundKey,
        lemma: compound.lemma,
        id: compound.id,
      });

      return {
        expr: compound,
        rawSurface,
        normalizedKey: compound.normalized_key || compoundKey,
        end: start + len - 1,
        matchStrategy: 'compound_normalized',
        compoundNormalized: compoundKey,
      };
    }
  }

  return null;
}


// ============================================================================
// FINAL CONTEXTUAL DISAMBIGUATION (v1.4)
//
// RPC остаётся главным resolver'ом. Этот слой только выбирает среди уже
// найденных реальных лексем и исправляет три подтверждённых класса ошибок:
//
//   nå   : adverb "сейчас" vs verb "достигать"
//   sitt : possessive pronoun (lemma sin) vs imperative verb sitte
//   han/hun/... : старые lexemes с pos='unknown' нормализуются в pronoun
//
// Если нужного варианта нет в массиве, функция не создаёт его сама.
// ============================================================================

const PERSONAL_PRONOUN_SURFACES = new Set([
  'jeg', 'du', 'han', 'hun', 'hen', 'vi', 'dere', 'de',
  'meg', 'deg', 'ham', 'henne', 'oss', 'dem',
  'den', 'det', 'seg',
]);

const MODAL_OR_AUXILIARY_TOKENS = new Set([
  'vil', 'ville', 'skal', 'skulle', 'kan', 'kunne',
  'må', 'måtte', 'bør', 'burde',
]);

const SITT_VERB_FOLLOWERS = new Set([
  'ned', 'stille', 'rolig', 'fast',
]);

function normalizedToken(value: string | null | undefined): string {
  return normalizeExpression(value ?? '');
}

function normalizeKnownPronounResolution(
  surface: string,
  resolution: SurfaceResolution,
): SurfaceResolution {
  if (
    PERSONAL_PRONOUN_SURFACES.has(surface) &&
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

function selectContextualResolutions(
  rawSurface: string,
  resolutions: SurfaceResolution[],
  context: SurfaceFormContext,
): SurfaceResolution[] {
  const surface = normalizedToken(rawSurface);
  const prev = normalizedToken(context.prevToken);
  const next = normalizedToken(context.nextToken);

  const normalizedResolutions = resolutions.map((resolution) =>
    normalizeKnownPronounResolution(surface, resolution)
  );

  if (surface === 'nå') {
    const verbCandidates = normalizedResolutions.filter(
      (row) => String(row.pos ?? '').toLowerCase() === 'verb',
    );
    const adverbCandidates = normalizedResolutions.filter(
      (row) => String(row.pos ?? '').toLowerCase() === 'adverb',
    );

    const explicitInfinitive =
      context.precededByInfinitiveMarker === true;

    // Типичный глагольный контекст: "å nå målet", "kan nå målet".
    // Для modal + nå требуем следующий токен: без объекта/продолжения
    // не делаем жёсткий выбор в пользу глагола.
    const likelyVerb =
      explicitInfinitive ||
      (MODAL_OR_AUXILIARY_TOKENS.has(prev) && Boolean(next));

    if (likelyVerb && verbCandidates.length > 0) {
      return verbCandidates;
    }

    // Во всех остальных контекстах, включая конец предложения
    // "... virker bra nå", предпочитаем наречие.
    if (adverbCandidates.length > 0) {
      return adverbCandidates;
    }

    return verbCandidates.length > 0
      ? verbCandidates
      : normalizedResolutions;
  }

  if (['sin', 'sitt', 'sine'].includes(surface)) {
    const pronounCandidates = normalizedResolutions.filter(
      (row) =>
        String(row.pos ?? '').toLowerCase() === 'pronoun' ||
        normalizeExpression(row.lemma) === 'sin',
    );

    const verbCandidates = normalizedResolutions.filter(
      (row) =>
        String(row.pos ?? '').toLowerCase() === 'verb' &&
        normalizeExpression(row.lemma) === 'sitte',
    );

    // "sitt ned", "sitt stille" — imperative sitte.
    const likelyImperativeVerb =
      surface === 'sitt' &&
      (
        SITT_VERB_FOLLOWERS.has(next) ||
        (!prev && Boolean(next))
      );

    if (likelyImperativeVerb && verbCandidates.length > 0) {
      return verbCandidates;
    }

    // В остальных случаях sin/sitt/sine — притяжательное местоимение.
    // Это покрывает "målet sitt", "boken sin", "barna sine".
    if (pronounCandidates.length > 0) {
      return pronounCandidates;
    }

    // Если pronoun-лексемы в БД пока нет, лучше не записывать заведомо
    // неверную sitte-лексему в притяжательном контексте.
    if (verbCandidates.length > 0 && !likelyImperativeVerb) {
      return [];
    }
  }

  return normalizedResolutions;
}

export async function planItems(
  text: string,
  expressionDict: Map<string, ExpressionRow>,
  verbMaps: VerbMaps,
  resolveSurfaceForm: ResolveSurfaceFormFn,
  options?: PlanItemsOptions,
): Promise<PlannedItem[]> {
  const isolatedMode = options?.isolatedMode === true;

  const tokensRaw = tokenize(text);
  const tokensNorm = tokensRaw.map((t) => normalizeExpression(t));

  const covered = new Set<number>();
  const items: PlannedItem[] = [];

  for (let index = 0; index < tokensRaw.length; index++) {
    if (covered.has(index)) continue;

    const expressionMatch = findKnownExpression(
      tokensRaw,
      tokensNorm,
      index,
      expressionDict,
      verbMaps,
    );

    if (expressionMatch) {
      const expr = expressionMatch.expr;

      items.push({
        raw_input: expressionMatch.rawSurface,
        normalized_input: expressionMatch.normalizedKey,
        normalized_lemma: expressionMatch.normalizedKey,
        surface_form: expressionMatch.rawSurface,
        pos: 'expression',
        match_type: 'expression',
        expression_id: expr.id,
        token_start: index,
        token_end: expressionMatch.end,
        expression_subtype: expr.expression_subtype,
        resolved: null,
        match_strategy: expressionMatch.matchStrategy,
        compound_normalized: expressionMatch.compoundNormalized,
        network_root_lemma: null,
      });

      markCovered(covered, index, expressionMatch.end);
      continue;
    }

    const rawSurface = tokensRaw[index];
    const normalized = normalize(rawSurface);

    if (!normalized || normalized.length < 2) {
      covered.add(index);
      continue;
    }

    // ФИКС (v1.2): "å" — инфинитивная частица (аналог англ. "to" перед
    // глаголом: "to take" = "å ta"). У неё нет самостоятельного словарного
    // значения для изучающего язык — это чисто грамматический маркер.
    // Раньше "å" проходила через resolveSurfaceForm и создавала
    // собственный lexeme_processing_item наравне с полноценными словами —
    // например, "å ta" разбивался на ДВЕ отдельные карточки ("å" и "ta"),
    // хотя "ta" и так уже полноценная лексема сама по себе (формы
    // tar/tok/tatt резолвятся в ту же lexeme_id через resolve_surface_form
    // / lexeme_form_variants).
    //
    // Намеренно НЕ пытаемся здесь склеивать "å" + следующий глагол в один
    // item — это не нужно: инфинитивная форма и так резолвится в общую
    // lexeme_id вместе с другими формами того же глагола. Пропуск "å"
    // сам по себе достаточен.
    if (normalizeExpression(rawSurface) === 'å') {
      covered.add(index);
      continue;
    }

    // ФИКС (v1.3): передаём контекст (соседние сырые токены + признак
    // "перед этим словом стояла å") в resolveSurfaceForm. RPC использует
    // контекст ТОЛЬКО когда для слова находится больше одного варианта
    // части речи одновременно. Если контекста нет вообще (единственное
    // слово — token_start/token_end единственное во всём тексте, соседей
    // не существует) — RPC вернёт ВСЕ найденные варианты сразу, не
    // угадывая между ними; если контекст есть — вернёт один вариант,
    // выбранный по правилам (см. resolve_surface_form SQL).
    //
    // ФИКС (v1.4, isolatedMode): в режиме "список слов" соседи по списку —
    // не настоящий грамматический контекст, обнуляем оба явно. "å X"
    // остаётся живым сигналом даже здесь — это не соседство, а то, что
    // сам список явно написал перед словом инфинитивную частицу.
    const prevTokenRaw = isolatedMode
      ? null
      : (index > 0 ? tokensRaw[index - 1] : null);
    const nextTokenRaw = isolatedMode
      ? null
      : (index < tokensRaw.length - 1 ? tokensRaw[index + 1] : null);
    const precededByInfinitiveMarker =
      index > 0 && normalizeExpression(tokensRaw[index - 1]) === 'å';

    const resolutionContext: SurfaceFormContext = {
      prevToken: prevTokenRaw,
      nextToken: nextTokenRaw,
      precededByInfinitiveMarker,
    };

    const rawResolutions = await resolveSurfaceForm(
      rawSurface,
      resolutionContext,
    );

    const resolutions = selectContextualResolutions(
      rawSurface,
      rawResolutions,
      resolutionContext,
    );

    // ФИКС (v1.3): resolveSurfaceForm теперь возвращает МАССИВ вариантов,
    // а не один. Для слова внутри текста (есть соседние токены) RPC уже
    // дизамбигуирует через контекстные правила и обычно вернёт ровно один
    // вариант. Но если контекста нет вообще (анализ отдельного слова, а не
    // предложения — прежде всего актуально для функции "разбор одного
    // слова", если она вызывает planItems на тексте из одного токена, или
    // теперь — для isolatedMode) — RPC намеренно возвращает ВСЕ найденные
    // варианты части речи разом (например, для "få" — и глагол, и
    // прилагательное), не угадывая между ними. В этом случае создаём
    // отдельный lexeme_processing_item на каждый вариант, а не один
    // произвольно выбранный.
    if (resolutions.length === 0) {
      items.push({
        raw_input: rawSurface,
        normalized_input: normalized,
        normalized_lemma: normalized,
        surface_form: rawSurface,
        pos: null,
        match_type: 'token',
        expression_id: null,
        token_start: index,
        token_end: index,
        resolved: null,
        match_strategy: 'token',
        compound_normalized: null,
        network_root_lemma: null,
      });
    } else {
      for (const resolved of resolutions) {
        items.push({
          raw_input: rawSurface,
          normalized_input: normalized,
          normalized_lemma: resolved.lemma,
          surface_form: rawSurface,
          pos: resolved.pos,
          match_type: 'token',
          expression_id: null,
          token_start: index,
          token_end: index,
          resolved,
          match_strategy: 'token',
          compound_normalized: null,
          network_root_lemma: null,
        });
      }
    }

    covered.add(index);
  }

  return items.sort((a, b) => a.token_start - b.token_start);
}