// D10 Ordbøkene resilience: fallback to known articles when the search fails.
// Run from the project root (needs tests/d10-stage-d fixtures):
//   node --experimental-strip-types --test supabase/functions/tests/d10-ordbokene-resilience/resilience_test.mts
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
(globalThis as any).Deno = { env: { get: () => undefined } };
const art = JSON.parse(readFileSync(new URL('../d10-stage-d/fixtures/ordbokene_106786.json', import.meta.url), 'utf8').replace(/^﻿/, ''));
const c = await import('../../_shared/authoritative-morphology-v2/client.ts');
const o = await import('../../verification/adapters/ordbokene.ts');
let calls: string[] = [];
function stub(searchStatus: number) {
  calls = [];
  (globalThis as any).fetch = async (url: string) => {
    calls.push(String(url));
    if (String(url).includes('/api/')) return new Response('bad gateway', { status: searchStatus });
    if (String(url).endsWith('/bm/article/106786.json')) return new Response(JSON.stringify(art), { status: 200 });
    return new Response('nope', { status: 404 });
  };
}
test('server error classifier', () => {
  assert.equal(c.isOrdbokeneServerError(new Error('Ordbokene returned HTTP 502')), true);
  assert.equal(c.isOrdbokeneServerError(new Error('Ordbokene returned HTTP 404')), false);
  const abort = new Error('x'); abort.name = 'AbortError';
  assert.equal(c.isOrdbokeneServerError(abort), true);
});
test('search 502 + known article -> bok II verified by its own article', async () => {
  stub(502);
  const r: any = await o.checkOrdbokeneLive('bok', 'bok', 'noun', null, ['106786']);
  assert.equal(r.registered_entry, true);
  assert.deepEqual(r.raw_preview.article_ids.map(String), ['106786']);
  assert.equal(r.raw_preview.lookup_fallback, 'known_article_ids');
  assert.equal(r.raw_preview.lookup_scope, 'e');
  assert.ok(calls.some(u => u.includes('/api/articles')));
});
test('search 502 + no known article -> error (retried later, never "not found")', async () => {
  stub(502);
  await assert.rejects(() => o.checkOrdbokeneLive('bok', 'bok', 'noun', null, null), /HTTP 502/);
});
test('search 502 + inflected form -> error, no fallback', async () => {
  stub(502);
  await assert.rejects(() => o.checkOrdbokeneLive('boker', 'boker', 'noun', null, ['106786']), /HTTP 502/);
});
test('search 502 + known article of another POS -> error, not "not found"', async () => {
  stub(502);
  await assert.rejects(() => o.checkOrdbokeneLive('bok', 'bok', 'verb', null, ['106786']), /HTTP 502/);
});
test('search 404 (not a server failure) -> no fallback', async () => {
  stub(404);
  await assert.rejects(() => o.checkOrdbokeneLive('bok', 'bok', 'noun', null, ['106786']), /HTTP 404/);
});
test('known-article lookup shape', async () => {
  stub(502);
  const l = await new c.OrdbokeneClient().lookupKnownArticles('bok', ['106786']);
  assert.equal(l.scopeUsed, 'e'); assert.equal(l.articles.length, 1); assert.equal(l.errors.length, 0);
  assert.deepEqual(l.articleReferences, [{ dictionaryCode: 'bm', articleId: '106786' }]);
});
test('search works -> normal path, no fallback mark', async () => {
  calls = [];
  (globalThis as any).fetch = async (url: string) => {
    calls.push(String(url));
    if (String(url).includes('/api/articles')) return new Response(JSON.stringify({ articles: { bm: [106786] } }), { status: 200 });
    if (String(url).endsWith('/bm/article/106786.json')) return new Response(JSON.stringify(art), { status: 200 });
    return new Response('nope', { status: 404 });
  };
  const r: any = await o.checkOrdbokeneLive('bok', 'bok', 'noun', null, ['106786']);
  assert.equal(r.registered_entry, true);
  assert.equal(r.raw_preview.lookup_fallback, undefined);
});
test('forms path: resolver over known articles resolves the exact lemma', async () => {
  stub(502);
  const r = await import('../../_shared/authoritative-morphology-v2/resolver.ts');
  const direct = new c.OrdbokeneClient();
  const res = await r.resolveAuthoritativeMorphology({ request: { query: 'bok', pos: 'noun', dictionaries: ['bm'] },
    client: { lookup: (q: string, d: any) => direct.lookupKnownArticles(q, ['106786'], d ?? ['bm']) } as any });
  assert.equal(res.status, 'resolved');
  const forms = res.paradigms.flatMap((p: any) => p.forms.map((f: any) => f.value));
  assert.ok(forms.includes('boker') && forms.includes('bokene'));
});
