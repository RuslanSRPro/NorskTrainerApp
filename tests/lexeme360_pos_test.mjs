// D10: 360 only for verbs. Run from the project root:
//   node --test tests/lexeme360_pos_test.mjs
// Reads the rule straight from components/Lexeme360.tsx (no React needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../components/Lexeme360.tsx', import.meta.url), 'utf8');
const body = src.match(/export function isLexeme360RootPos\(pos\?: string \| null\): boolean \{([\s\S]*?)\n\}/)[1];
const isRoot = new Function('pos', body);
test('verbs and expressions keep 360', () => {
  for (const p of ['verb', 'Verb', 'expression', 'verb_phrase']) assert.equal(isRoot(p), true, p);
});
test('nouns, adjectives, adverbs: no 360', () => {
  for (const p of ['noun', 'noun_masculine', 'adjective', 'adverb', 'determiner']) assert.equal(isRoot(p), false, p);
});
test('unknown part of speech keeps the previous behaviour', () => {
  assert.equal(isRoot(undefined), true);
  assert.equal(isRoot(''), true);
});
