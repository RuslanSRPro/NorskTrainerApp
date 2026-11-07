// D10_analysis_skip_since_v1: pure part of the skip (which items are dropped).
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSkipIds, splitSkipped, skippedWords, skipKeyOf } from '../../_shared/d10-analysis-skip.ts';

const PROBE = 'surface_lemma_probe';
const items = [
  { match_type: 'token', resolved: { lexeme_id: 'L1' }, normalized_lemma: 'snakke' },
  { match_type: 'token', resolved: { lexeme_id: 'L2' }, normalized_lemma: 'bok' },
  { match_type: 'token', resolved: null, normalized_lemma: 'nyord' },
  { match_type: 'expression', expression_id: 'E1', normalized_lemma: 'ta av' },
  { match_type: 'token', match_strategy: PROBE, resolved: { lexeme_id: 'L1' }, normalized_lemma: 'snakke' },
  { match_type: 'token', resolved: { lexeme_id: 'L1' }, normalized_lemma: 'snakker' },
];

test('ids: resolved cards and expressions, no probes, no duplicates', () => {
  assert.deepEqual(collectSkipIds(items, PROBE), { lexemeIds: ['L1', 'L2'], expressionIds: ['E1'] });
});
test('unresolved token and probe are never skipped', () => {
  assert.equal(skipKeyOf(items[2], PROBE), null);
  assert.equal(skipKeyOf(items[4], PROBE), null);
});
test('split keeps everything not returned by SQL', () => {
  const { keep, skipped } = splitSkipped(items, new Set(['L1']), new Set(['E1']), PROBE);
  assert.deepEqual(skipped.map((i) => i.normalized_lemma), ['snakke', 'ta av', 'snakker']);
  assert.deepEqual(keep.map((i) => i.normalized_lemma), ['bok', 'nyord', 'snakke']);
});
test('nothing returned -> nothing skipped', () => {
  const { keep, skipped } = splitSkipped(items, new Set(), new Set(), PROBE);
  assert.equal(skipped.length, 0); assert.equal(keep.length, items.length);
});
test('summary words: unique, limited', () => {
  assert.deepEqual(skippedWords(items, 2), ['snakke', 'bok']);
});
