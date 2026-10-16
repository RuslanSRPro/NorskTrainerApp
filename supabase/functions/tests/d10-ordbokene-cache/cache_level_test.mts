// D10 Ordbøkene cache level. Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-ordbokene-cache/cache_level_test.mts
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
(globalThis as any).Deno = { env: { get: () => undefined } };
const art = JSON.parse(readFileSync(new URL('../d10-stage-d/fixtures/ordbokene_106786.json', import.meta.url), 'utf8').replace(/^﻿/, ''));
const o = await import('../../verification/adapters/ordbokene.ts');
const art6790 = { article_id: 6790, lemmas: [{ lemma: 'bok', hgno: 1, paradigm_info: [{ tags: ['NOUN', 'Masc'], to: null,
  inflection: [{ tags: ['Sing','Ind'], word_form: 'bok' }, { tags: ['Plur','Ind'], word_form: 'bøker' }] }] }], body: {} };
function stub() {
  (globalThis as any).fetch = async (url: string) => {
    const u = String(url);
    if (u.includes('/api/')) return new Response('bad gateway', { status: 502 });
    if (u.endsWith('/bm/article/106786.json')) return new Response(JSON.stringify(art), { status: 200 });
    if (u.endsWith('/bm/article/6790.json')) return new Response(JSON.stringify(art6790), { status: 200 });
    return new Response('nope', { status: 404 });
  };
}
test('cache level: one cached article -> verified, marked with date', async () => {
  stub();
  const r: any = await o.checkOrdbokeneLive('bok', 'bok', 'noun', null, null, { articleIds: ['106786'], checkedAt: '2026-10-10T08:00:00Z' });
  assert.equal(r.registered_entry, true);
  assert.equal(r.raw_preview.lookup_fallback, 'cached_search_article_ids');
  assert.equal(r.raw_preview.cached_search_checked_at, '2026-10-10T08:00:00Z');
  assert.match(r.evidence_label, /last search of 2026-10-10/);
});
test('cache level: two cached homonyms, no binding -> error (ambiguous is never answered from cache)', async () => {
  stub();
  await assert.rejects(() => o.checkOrdbokeneLive('bok', 'bok', 'noun', null, null, { articleIds: ['6790', '106786'], checkedAt: null }), /HTTP 502/);
});
test('known article wins over cache', async () => {
  stub();
  const r: any = await o.checkOrdbokeneLive('bok', 'bok', 'noun', null, ['106786'], { articleIds: ['6790', '106786'], checkedAt: null });
  assert.equal(r.raw_preview.lookup_fallback, 'known_article_ids');
  assert.deepEqual(r.raw_preview.article_ids.map(String), ['106786']);
});
test('no known, no cache -> error', async () => {
  stub();
  await assert.rejects(() => o.checkOrdbokeneLive('bok', 'bok', 'noun', null, null, null), /HTTP 502/);
});
