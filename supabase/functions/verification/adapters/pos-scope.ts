// D10 15.10.2026 (agreed, step B): part of speech of a source hit.
// Every source answer gets an additive "pos_scope": which parts of speech the
// source shows for the word, and whether the card's part of speech is among
// them. Old fields (found, quality, registered_entry...) are unchanged; the
// server tier reads pos_scope.
//   match          the source shows the word with the card's part of speech
//   mismatch       the source shows the word, but only with other parts of speech
//   unknown        the source has the word but shows no part of speech
//   not_applicable no card part of speech (expression, or POS not passed)

import type { SourceLookupResult } from './shared.ts';

export type PosMatch = 'match' | 'mismatch' | 'unknown' | 'not_applicable';

export type PosScope = {
  requested_pos: string | null;
  found_pos: string[];
  pos_match: PosMatch;
  pos_basis: string | null;
};

export type PosScopedLookup = SourceLookupResult & { pos_scope?: PosScope };

const POS_WORDS: Record<string, string> = {
  noun: 'noun', substantiv: 'noun', subst: 'noun',
  verb: 'verb',
  adjective: 'adjective', adjektiv: 'adjective', adj: 'adjective',
  adverb: 'adverb', adv: 'adverb',
  preposition: 'preposition', preposisjon: 'preposition', prep: 'preposition',
  pronoun: 'pronoun', pronomen: 'pronoun', pron: 'pronoun',
  conjunction: 'conjunction', konjunksjon: 'conjunction', konj: 'conjunction',
  subjunction: 'subjunction', subjunksjon: 'subjunction', subj: 'subjunction',
  interjection: 'interjection', interjeksjon: 'interjection', interj: 'interjection',
  determiner: 'determiner', determinativ: 'determiner', det: 'determiner',
  numeral: 'numeral', tallord: 'numeral', number: 'numeral',
  'proper noun': 'proper_noun', proper_noun: 'proper_noun', egennavn: 'proper_noun',
  article: 'article', artikkel: 'article',
  particle: 'particle', partikkel: 'particle',
};

const NOT_APPLICABLE = new Set(['expression', 'phrase', 'idiom', 'uttrykk', 'fast uttrykk', 'phrasal_verb']);

// noun_masculine -> noun, "Substantiv" -> noun, "subst." -> noun; null if unknown.
export function basePos(value: unknown): string | null {
  const raw = String(value ?? '').normalize('NFC').toLowerCase().replace(/[.:;,]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  if (POS_WORDS[raw]) return POS_WORDS[raw];
  const head = raw.split(/[_\s-]/)[0];
  return POS_WORDS[head] ?? null;
}

export function isPosNotApplicable(value: unknown): boolean {
  const raw = String(value ?? '').toLowerCase().trim();
  return !raw || NOT_APPLICABLE.has(raw) || raw.startsWith('expression');
}

export function posScope(requested: unknown, found: Iterable<string>, basis: string | null): PosScope {
  const foundPos = [...new Set([...found].map(basePos).filter((p): p is string => Boolean(p)))];
  const requestedPos = isPosNotApplicable(requested) ? null : basePos(requested);
  const pos_match: PosMatch = !requestedPos
    ? 'not_applicable'
    : foundPos.length === 0
      ? 'unknown'
      : foundPos.includes(requestedPos) ? 'match' : 'mismatch';
  return { requested_pos: requestedPos, found_pos: foundPos, pos_match, pos_basis: foundPos.length ? basis : null };
}

export function withPosScope<T extends SourceLookupResult>(result: T, scope: PosScope | null): T & { pos_scope?: PosScope } {
  return scope ? { ...result, pos_scope: scope } : result;
}

// NAOB headings and search listings, Lexin categories: Norwegian POS words.
export const NORWEGIAN_POS_PATTERN =
  'substantiv|verb|adjektiv|adverb|preposisjon|pronomen|konjunksjon|subjunksjon|interjeksjon|determinativ|tallord|egennavn|artikkel';
