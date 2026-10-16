// D10 Read mode preview. Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-read-preview/read_preview_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const pv = await import('../../read-word-preview/preview.ts');

const bok = JSON.parse(readFileSync(new URL('./ordbokene_6790.json', import.meta.url), 'utf8'));
const bokII = JSON.parse(readFileSync(new URL('../d10-stage-d/fixtures/ordbokene_106786.json', import.meta.url), 'utf8'));
const lexinBok = { result: [[
  { id: 1, sub_id: 0, type: 'E-lem', text: 'bok', index: 0 },
  { id: 1, sub_id: 0, type: 'E-kat', text: 'substantiv', index: 0 },
  { id: 1, sub_id: 0, type: 'Ukr-lem', text: 'книга; книжка', index: 0 },
  { id: 1, sub_id: 0, type: 'B-lem', text: 'book', index: 0 },
  { id: 2, sub_id: 0, type: 'E-lem', text: 'bokhylle', index: 0 },
  { id: 2, sub_id: 0, type: 'Ukr-lem', text: 'книжкова полиця', index: 0 },
]] };

function fakeFetch(opts: { search?: Record<string, any>; status?: number; lexin?: any; lexinStatus?: number }) {
  const calls: string[] = [];
  const f = async (input: any) => {
    const url = new URL(String(input));
    calls.push(url.hostname + url.pathname + url.search);
    if (url.hostname === 'ord.uib.no' && url.pathname === '/api/articles') {
      if (opts.status) return new Response('x', { status: opts.status });
      const key = `${url.searchParams.get('w')}|${url.searchParams.get('scope')}`;
      return new Response(JSON.stringify({ articles: { bm: opts.search?.[key] ?? [] } }), { status: 200 });
    }
    if (url.hostname === 'ord.uib.no') {
      const id = url.pathname.match(/article\/(\d+)\.json/)?.[1];
      return new Response(JSON.stringify(id === '6790' ? bok : bokII), { status: 200 });
    }
    if (url.hostname === 'editorportal.oslomet.no') {
      if (opts.lexinStatus) return new Response('x', { status: opts.lexinStatus });
      return new Response(JSON.stringify(opts.lexin ?? []), { status: 200 });
    }
    throw new Error('unexpected ' + url);
  };
  return { f, calls };
}

test('cleanWord: articles, å, junk', () => {
  assert.equal(pv.cleanWord('en Bok'), 'bok');
  assert.equal(pv.cleanWord('å lese'), 'lese');
  assert.equal(pv.cleanWord('<script>'), null);
  assert.equal(pv.cleanWord(''), null);
});

test('bok: two articles, main first, forms and articles of gender, Lexin uk/en', async () => {
  const { f } = fakeFetch({ search: { 'bok|e': [106786, 6790] }, lexin: lexinBok });
  const r = await pv.buildPreview('bok', f as any);
  assert.equal(r.ordbokene.status, 'found');
  assert.equal(r.ordbokene.scope, 'e');
  const [first, second] = r.ordbokene.articles;
  assert.equal(first.article_id, 6790);
  assert.equal(second.article_id, 106786);
  assert.equal(first.pos, 'noun');
  assert.deepEqual(first.accepted_articles, ['en', 'ei']);
  const sd = first.forms.find((x: any) => x.form_key === 'noun_singular_definite')!;
  assert.deepEqual([sd.primary_values, sd.alternative_values], [['boken'], ['boka']]);
  assert.ok(first.definitions[0].startsWith('sammenheftede eller innbunde ark'));
  assert.equal(r.lexin.status, 'found');
  assert.deepEqual(r.lexin.entries, [{ pos: 'noun', uk: ['книга', 'книжка'], en: ['book'] }]);
});

test('word form: bøkene -> found through inflection search', async () => {
  const { f, calls } = fakeFetch({ search: { 'bøkene|i': [6790] }, lexin: lexinBok });
  const r = await pv.buildPreview('bøkene', f as any);
  assert.equal(r.ordbokene.scope, 'i');
  assert.equal(r.ordbokene.articles[0].lemma, 'bok');
  assert.ok(calls.some((c) => c.includes('searchWord=bok')), 'Lexin asked with the lemma');
});

test('not in Ordbøkene and not in Lexin', async () => {
  const { f } = fakeFetch({ search: {}, lexin: [] });
  const r = await pv.buildPreview('vinterjakke', f as any);
  assert.equal(r.ordbokene.status, 'not_found');
  assert.equal(r.lexin.status, 'not_found');
});

test('Ordbøkene 502 and Lexin 500 -> error statuses, no exception', async () => {
  const { f } = fakeFetch({ status: 502, lexinStatus: 500 });
  const r = await pv.buildPreview('bok', f as any);
  assert.equal(r.ordbokene.status, 'error');
  assert.match(r.ordbokene.error!, /HTTP 502/);
  assert.equal(r.lexin.status, 'error');
});
