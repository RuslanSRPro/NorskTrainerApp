import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSensePrompt, parseSenseAnswer, senseSchema } from '../../synonym-verifier/sense-labels.ts';

const rows = [
  { key: 'k0', lemma: 'slå ut', sense: 'sette ut av spill; beseire' },
  { key: 'k1', lemma: 'beseire', sense: 'overvinne, seire over' },
];

test('prompt lists every item with its ref', () => {
  const p = buildSensePrompt(rows);
  assert.match(p, /"ref":0,"word":"slå ut","sense":"sette ut av spill; beseire"/);
  assert.match(p, /"ref":1,"word":"beseire"/);
});

test('schema requires ref, uk, en', () => {
  assert.deepEqual(senseSchema().items.required, ['ref', 'uk', 'en']);
});

test('answer maps refs to keys', () => {
  const got = parseSenseAnswer('[{"ref":1,"uk":"перемогти","en":"defeat"},{"ref":0,"uk":" перемогти ","en":"knock out"}]', rows);
  assert.deepEqual(got.sort((a, b) => a.key.localeCompare(b.key)), [
    { key: 'k0', uk: 'перемогти', en: 'knock out' },
    { key: 'k1', uk: 'перемогти', en: 'defeat' },
  ]);
});

test('bad refs, duplicates, empty and long answers are dropped', () => {
  const got = parseSenseAnswer(JSON.stringify([
    { ref: 5, uk: 'x', en: 'x' }, { ref: 0, uk: '', en: 'x' }, { ref: 1, uk: 'a b c d e f g', en: 'x' },
    { ref: 0, uk: 'ok', en: 'ok' }, { ref: 0, uk: 'second', en: 'second' },
  ]), rows);
  assert.deepEqual(got, [{ key: 'k0', uk: 'ok', en: 'ok' }]);
});

test('not json -> nothing', () => {
  assert.deepEqual(parseSenseAnswer('oops', rows), []);
});
