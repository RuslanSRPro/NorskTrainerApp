// supabase/functions/analyze-text/candidate-generator.ts
// Norsk Trainer — Candidate Generator v1
//
// Responsibility:
//   Generate possible expression candidates from already parsed token items.
//   This module does NOT verify candidates.
//   This module does NOT write to database.
//   This module does NOT replace Parser.
//
// It only creates possible_expression_candidate items for later Resolver/Verification.

import { normalizeExpression } from '../_shared/nlp/normalize.ts';
import type { PlannedItem } from './grammar-parser.ts';

const PARTICLES = new Set([
  'av',
  'opp',
  'ut',
  'inn',
  'over',
  'på',
  'med',
  'imot',
  'igjen',
  'til',
  'fram',
  'frem',
]);

const PREPOSITIONS = new Set([
  'av',
  'på',
  'i',
  'til',
  'for',
  'fra',
  'med',
  'om',
  'over',
  'under',
  'etter',
]);

const REFLEXIVE_PRONOUNS = new Set([
  'meg',
  'deg',
  'seg',
  'oss',
  'dere',
]);

function isVerb(item: PlannedItem): boolean {
  const pos = String(item.resolved?.pos ?? item.pos ?? '').toLowerCase();
  return pos === 'verb' || pos.includes('verb');
}

function getLemma(item: PlannedItem): string {
  return normalizeExpression(
    item.resolved?.lemma ||
      item.normalized_lemma ||
      item.normalized_input ||
      item.raw_input,
  );
}

function getSurface(item: PlannedItem): string {
  return String(item.surface_form || item.raw_input || '').trim();
}

function isToken(item: PlannedItem): boolean {
  return item.match_type === 'token';
}

function isParticle(value: string): boolean {
  return PARTICLES.has(normalizeExpression(value));
}

function isPreposition(value: string): boolean {
  return PREPOSITIONS.has(normalizeExpression(value));
}

function isReflexive(value: string): boolean {
  return REFLEXIVE_PRONOUNS.has(normalizeExpression(value));
}

function makeCandidate(params: {
  surface: string;
  lemma: string;
  start: number;
  end: number;
  subtype: string;
  strategy: string;
}): PlannedItem {
  return {
    raw_input: params.surface,
    normalized_input: params.lemma,
    normalized_lemma: params.lemma,
    surface_form: params.surface,
    pos: 'expression',
    match_type: 'expression',
    expression_id: null,
    token_start: params.start,
    token_end: params.end,
    expression_subtype: params.subtype,
    resolved: null,
    match_strategy: 'candidate_generator' as any,
    compound_normalized: params.lemma,
    network_root_lemma: params.lemma.split(/\s+/)[0],
    candidate_strategy: params.strategy,
  } as PlannedItem & { candidate_strategy: string };
}

export function generateExpressionCandidates(
  items: PlannedItem[],
): PlannedItem[] {
  const candidates: PlannedItem[] = [];

  const existingRanges = new Set(
    items
      .filter((item) => item.match_type === 'expression')
      .map((item) => `${item.token_start}:${item.token_end}`),
  );

  const existingKeys = new Set(
    items
      .filter((item) => item.match_type === 'expression')
      .map((item) => normalizeExpression(item.normalized_lemma || item.normalized_input))
      .filter(Boolean),
  );

  for (let i = 0; i < items.length; i++) {
    const first = items[i];

    if (!first || !isToken(first) || !isVerb(first)) continue;

    const verbLemma = getLemma(first);
    const verbSurface = getSurface(first);

    if (!verbLemma) continue;

    const second = items[i + 1];
    const third = items[i + 2];

    // Pattern 1:
    // verb + particle
    // tar opp -> ta opp
    if (second && isToken(second)) {
      const secondLemma = getLemma(second);
      const secondSurface = getSurface(second);

      if (isParticle(secondLemma)) {
        const lemma = normalizeExpression(`${verbLemma} ${secondLemma}`);
        const surface = `${verbSurface} ${secondSurface}`.trim();
        const range = `${first.token_start}:${second.token_end}`;

        if (!existingRanges.has(range) && !existingKeys.has(lemma)) {
          candidates.push(
            makeCandidate({
              surface,
              lemma,
              start: first.token_start,
              end: second.token_end,
              subtype: 'particle_verb_candidate',
              strategy: 'verb_particle',
            }),
          );

          existingKeys.add(lemma);
        }
      }
    }

    // Pattern 2:
    // verb + preposition
    // ser på -> se på
    if (second && isToken(second)) {
      const secondLemma = getLemma(second);
      const secondSurface = getSurface(second);

      if (isPreposition(secondLemma)) {
        const lemma = normalizeExpression(`${verbLemma} ${secondLemma}`);
        const surface = `${verbSurface} ${secondSurface}`.trim();
        const range = `${first.token_start}:${second.token_end}`;

        if (!existingRanges.has(range) && !existingKeys.has(lemma)) {
          candidates.push(
            makeCandidate({
              surface,
              lemma,
              start: first.token_start,
              end: second.token_end,
              subtype: 'prepositional_verb_candidate',
              strategy: 'verb_preposition',
            }),
          );

          existingKeys.add(lemma);
        }
      }
    }

    // Pattern 3:
    // verb + reflexive + preposition/particle
    // tar seg av -> ta seg av
    if (second && third && isToken(second) && isToken(third)) {
      const secondLemma = getLemma(second);
      const thirdLemma = getLemma(third);

      const secondSurface = getSurface(second);
      const thirdSurface = getSurface(third);

      if (isReflexive(secondLemma) && (isPreposition(thirdLemma) || isParticle(thirdLemma))) {
        const lemma = normalizeExpression(`${verbLemma} seg ${thirdLemma}`);
        const surface = `${verbSurface} ${secondSurface} ${thirdSurface}`.trim();
        const range = `${first.token_start}:${third.token_end}`;

        if (!existingRanges.has(range) && !existingKeys.has(lemma)) {
          candidates.push(
            makeCandidate({
              surface,
              lemma,
              start: first.token_start,
              end: third.token_end,
              subtype: 'reflexive_expression_candidate',
              strategy: 'verb_reflexive_particle_or_preposition',
            }),
          );

          existingKeys.add(lemma);
        }
      }
    }
  }

  console.log('[CANDIDATE GENERATOR]', {
    input_items: items.length,
    candidates_found: candidates.length,
    candidates: candidates.map((candidate) => ({
      surface: candidate.surface_form,
      lemma: candidate.normalized_lemma,
      subtype: candidate.expression_subtype,
      strategy: (candidate as any).candidate_strategy,
    })),
  });

  return candidates;
}