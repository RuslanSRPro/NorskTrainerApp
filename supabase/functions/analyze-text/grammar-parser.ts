// supabase/functions/analyze-text/grammar-parser.ts
// Norsk Trainer — Grammar Parser v1.1
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

export type ResolveSurfaceFormFn = (
  surfaceForm: string,
) => Promise<SurfaceResolution | null>;

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

export async function planItems(
  text: string,
  expressionDict: Map<string, ExpressionRow>,
  verbMaps: VerbMaps,
  resolveSurfaceForm: ResolveSurfaceFormFn,
): Promise<PlannedItem[]> {
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

    const resolved = await resolveSurfaceForm(rawSurface);

    items.push({
      raw_input: rawSurface,
      normalized_input: normalized,
      normalized_lemma: resolved?.lemma ?? normalized,
      surface_form: rawSurface,
      pos: resolved?.pos ?? null,
      match_type: 'token',
      expression_id: null,
      token_start: index,
      token_end: index,
      resolved,
      match_strategy: 'token',
      compound_normalized: null,
      network_root_lemma: null,
    });

    covered.add(index);
  }

  return items.sort((a, b) => a.token_start - b.token_start);
}