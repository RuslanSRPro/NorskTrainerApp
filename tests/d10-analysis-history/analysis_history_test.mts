// D10 28.10.2026: recent analyses (pure rules).
//   node --experimental-strip-types --test tests/d10-analysis-history/analysis_history_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ENTRIES, addChild, addEntry, makeEntry, parseHistory } from '../../services/analysisHistoryCore.ts';

const entry = (n: number) => makeEntry({ id: `a${n}`, jobId: null, kind: 'text', mode: 'read', preview: `text ${n}` });

test('newest first; the 21st analysis pushes out the oldest', () => {
  let list: any[] = [];
  for (let n = 1; n <= 21; n++) list = addEntry(list, entry(n));
  assert.equal(list.length, MAX_ENTRIES);
  assert.equal(list[0].id, 'a21');
  assert.equal(list.at(-1).id, 'a2');
  assert.ok(!list.some((e) => e.id === 'a1'));
});
test('a child job goes to its analysis', () => {
  let list = addEntry(addEntry([], entry(1)), entry(2));
  list = addChild(list, 'a1', { jobId: 'J1', kind: 'save_selected', words: ['bar', 'bar', ' bok '] });
  assert.deepEqual(list.find((e) => e.id === 'a1')!.children.map((c) => c.words), [['bar', 'bok']]);
  assert.equal(list.find((e) => e.id === 'a2')!.children.length, 0);
});
test('unknown parent -> the newest analysis; same job twice -> once', () => {
  let list = addEntry(addEntry([], entry(1)), entry(2));
  list = addChild(list, 'gone', { jobId: 'J1', kind: 'rerun_problems', words: ['x'] });
  list = addChild(list, null, { jobId: 'J1', kind: 'rerun_problems', words: ['x'] });
  assert.equal(list[0].id, 'a2'); assert.equal(list[0].children.length, 1);
});
test('no analyses at all -> the child job becomes an entry of its own', () => {
  const list = addChild([], null, { jobId: 'J9', kind: 'save_preview', words: ['bære'], mode: 'read' });
  assert.equal(list.length, 1); assert.equal(list[0].jobId, 'J9'); assert.equal(list[0].preview, 'bære');
});
test('preview trimmed to 160 chars, spaces collapsed; unknown words deduplicated', () => {
  const e = makeEntry({ kind: 'text', mode: 'audit', preview: 'a  b\n' + 'x'.repeat(300), unknownWords: ['bar', 'bar', ''] });
  assert.equal(e.preview.length, 160); assert.ok(e.preview.startsWith('a b x'));
  assert.deepEqual(e.unknownWords, ['bar']);
});
test('broken storage -> empty list, never throws', () => {
  assert.deepEqual(parseHistory(null), []);
  assert.deepEqual(parseHistory('{oops'), []);
  assert.deepEqual(parseHistory('{"a":1}'), []);
  assert.equal(parseHistory(JSON.stringify([entry(1), { bad: true }])).length, 1);
});
