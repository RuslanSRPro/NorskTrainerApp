// D10 NAOB noun forms. Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-naob-forms/naob_forms_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

// The worker imports supabase-js from esm.sh (Deno). Node gets a stub; the
// tests pass their own fake client.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://esm.sh/')) {
    return { url: 'data:text/javascript,export const createClient=()=>{throw new Error("stub")}', shortCircuit: true };
  }
  return next(specifier, context);
}`));

const naob = await import('../../_shared/d10-naob-forms.ts');
const worker = await import('../../naob-forms-worker/index.ts');

const fixture = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const BRENNE_2 = fixture('naob_brenne_2.html');
const VINTERJAKKE = fixture('naob_vinterjakke.html');
const SEARCH_BRENNE = fixture('naob_search_brenne.html');

// ---------------------------------------------------------------- fake db
type Row = Record<string, any>;
function fakeDb(tables: Record<string, Row[]>, rpcImpl: (name: string, args: any) => any = okRpc) {
  const calls: Array<{ name: string; args: any }> = [];
  function from(table: string) {
    let rows = [...(tables[table] ?? [])];
    let headCount = false;
    const q: any = {
      select(_cols: string, opts?: { count?: string; head?: boolean }) { headCount = !!opts?.head; return q; },
      eq(col: string, v: any) { rows = rows.filter((r) => r[col] === v); return q; },
      in(col: string, vs: any[]) { rows = rows.filter((r) => vs.includes(r[col])); return q; },
      then(res: any, rej: any) {
        return Promise.resolve(headCount ? { data: null, count: rows.length, error: null } : { data: rows, count: rows.length, error: null }).then(res, rej);
      },
    };
    return q;
  }
  return {
    calls,
    client: {
      from,
      // D10 24.10.2026: the NAOB-binding lookup (no binding here) is not counted
      rpc: async (name: string, args: any) => {
        if (name !== 'd10_naob_card_binding_v1') calls.push({ name, args });
        return rpcImpl(name, args);
      },
    } as any,
  };
}
function okRpc(name: string) {
  return name === 'd10_publish_naob_forms_v1' ? { data: 3, error: null } : { data: null, error: null };
}
const BRENNE = { id: 'b1', lemma: 'brenne', pos: 'noun' };
const tables = () => ({
  lexemes: [BRENNE],
  lexeme_form_display_v2: [] as Row[],
  lexeme_compound_head_forms_v1: [] as Row[],
});
// NAOB pages by path; anything else 404. Records the requested URLs.
function site(pages: Record<string, string | number>, seen: string[] = []) {
  return async (url: string) => {
    seen.push(url);
    const path = decodeURIComponent(new URL(url).pathname) + new URL(url).search;
    const page = pages[path] ?? pages[new URL(url).pathname];
    if (typeof page === 'number') return new Response('fail', { status: page });
    if (page === undefined) return new Response('not found', { status: 404 });
    return new Response(page, { status: 200 });
  };
}
const SEARCH = '/søk?q=brenne';
const differentForms = BRENNE_2.replace(/brennen</g, 'brenna<');

// ---------------------------------------------------------------- parser
test('search page: articles with headword and part of speech', () => {
  const l = naob.parseNaobSearch(SEARCH_BRENNE);
  assert.deepEqual(l.entries.map((e: any) => `${e.slug}:${e.pos}`),
    ['brenne_1:verb', 'brenne_2:substantiv', 'brenne_3:substantiv', 'brenne_4:substantiv']);
  assert.equal(l.shown, 4);
  assert.equal(l.total, 4);
});

test('article brenne_2: en; brennen, brenner (no definite plural invented)', () => {
  const a = naob.parseNaobArticle(BRENNE_2);
  assert.equal(a.status, 'ok');
  assert.equal(a.headword, 'brenne');
  assert.equal(a.pos, 'substantiv');
  assert.equal(a.genus, 'maskulinum');
  assert.deepEqual(a.articles, ['en']);
  assert.deepEqual(a.forms.map((f: any) => `${f.form_key}=${f.primary_values.join(',')}`), [
    'noun_singular_indefinite=brenne', 'noun_singular_definite=brennen', 'noun_plural_indefinite=brenner']);
});

test('article vinterjakke: genus and article only -> no forms', () => {
  const a = naob.parseNaobArticle(VINTERJAKKE);
  assert.equal(a.headword, 'vinterjakke');
  assert.deepEqual(a.articles, ['en']);
  assert.equal(a.forms.length, 0);
});

test('article delivered only inside the page script is read the same way', () => {
  const escaped = '<html><script>self.__next_f.push([1,"' + BRENNE_2
    .replace(/"/g, '\\"').replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\n/g, '\\n') + '"])</script></html>';
  const a = naob.parseNaobArticle(escaped);
  assert.deepEqual(a.forms.map((f: any) => f.primary_values[0]), ['brenne', 'brennen', 'brenner']);
});

test('values: commas and "eller" are primary, brackets alternative; a phrase is invalid', () => {
  const page = BRENNE_2.replace('td">brennen</div>', 'td">brennen eller brenna (brennja)</div>');
  const a = naob.parseNaobArticle(page);
  const def = a.forms.find((f: any) => f.form_key === 'noun_singular_definite');
  assert.deepEqual(def.primary_values, ['brennen', 'brenna']);
  assert.deepEqual(def.alternative_values, ['brennja']);
  const bad = naob.parseNaobArticle(BRENNE_2.replace('td">brenner</div>', 'td">to brenner</div>'));
  assert.equal(bad.status, 'invalid_value');
});

// ---------------------------------------------------------------- worker
test('worker: brenne (noun) -> forms of the NAOB noun articles published', async () => {
  const db = fakeDb(tables());
  const seen: string[] = [];
  const r = await worker.processLexeme(db.client, BRENNE, site({
    [SEARCH]: SEARCH_BRENNE, '/ordbok/brenne_2': BRENNE_2, '/ordbok/brenne_3': BRENNE_2, '/ordbok/brenne_4': VINTERJAKKE,
  }, seen));
  assert.equal(r.status, 'naob_forms');
  assert.ok(!seen.some((u) => u.endsWith('/ordbok/brenne_1')), 'the verb article is not read');
  const p = db.calls.find((c) => c.name === 'd10_publish_naob_forms_v1')!;
  assert.equal(p.args.p_lexeme_id, 'b1');
  assert.deepEqual(p.args.p_forms.map((f: any) => f.form_key),
    ['noun_singular_indefinite', 'noun_singular_definite', 'noun_plural_indefinite']);
  assert.deepEqual(p.args.p_forms[1].accepted_articles, ['en']);
  assert.deepEqual(p.args.p_evidence.naob_slugs, ['brenne_2', 'brenne_3']);
  assert.deepEqual(p.args.p_evidence.ignored_slugs, ['brenne_4']);
});

test('worker: noun articles with different forms -> review, nothing published', async () => {
  const db = fakeDb(tables());
  const r = await worker.processLexeme(db.client, BRENNE, site({
    [SEARCH]: SEARCH_BRENNE, '/ordbok/brenne_2': BRENNE_2, '/ordbok/brenne_3': differentForms, '/ordbok/brenne_4': BRENNE_2,
  }));
  assert.equal(r.status, 'review');
  assert.ok(!db.calls.some((c) => c.name === 'd10_publish_naob_forms_v1'));
  const rv = db.calls.find((c) => c.name === 'd10_record_naob_forms_review_v1')!;
  assert.equal(rv.args.p_reason, 'naob_articles_forms_diverge');
});

test('worker: own Ordbøkene forms or compound forms -> left alone, no request', async () => {
  for (const table of ['lexeme_form_display_v2', 'lexeme_compound_head_forms_v1']) {
    const t: any = tables();
    t[table].push({ lexeme_id: 'b1', form_key: 'noun_singular_definite' });
    const db = fakeDb(t);
    const seen: string[] = [];
    const r = await worker.processLexeme(db.client, BRENNE, site({}, seen));
    assert.equal(r.status, table === 'lexeme_form_display_v2' ? 'own_forms' : 'compound_forms');
    assert.equal(seen.length, 0);
    assert.equal(db.calls.length, 0);
  }
});

test('worker: verbs and adjectives are not handled yet', async () => {
  const db = fakeDb(tables());
  const r = await worker.processLexeme(db.client, { id: 'v', lemma: 'brenne', pos: 'verb' }, site({}));
  assert.equal(r.status, 'pos_not_supported');
});

test('worker: only genus in NAOB (vinterjakke-like) -> no forms, nothing written', async () => {
  const db = fakeDb(tables());
  const search = SEARCH_BRENNE.replace(/brenne_[234]/g, (m) => m).replace(/brenne_3|brenne_4/g, 'brenne_2');
  const r = await worker.processLexeme(db.client, BRENNE, site({ [SEARCH]: search, '/ordbok/brenne_2': VINTERJAKKE.replace(/vinterjakke/g, 'brenne') }));
  assert.equal(r.status, 'naob_no_forms');
  assert.equal(db.calls.length, 0);
});

test('worker: no noun article in NAOB -> nothing', async () => {
  const db = fakeDb(tables());
  const onlyVerb = SEARCH_BRENNE.replace(/substantiv/g, 'verb');
  const r = await worker.processLexeme(db.client, BRENNE, site({ [SEARCH]: onlyVerb }));
  assert.equal(r.status, 'no_naob_article_of_pos');
  assert.equal(db.calls.length, 0);
});

test('worker: listing with more pages -> review (not all articles seen)', async () => {
  const db = fakeDb(tables());
  const partial = SEARCH_BRENNE.replace('av <!-- -->4', 'av <!-- -->40');
  const r = await worker.processLexeme(db.client, BRENNE, site({ [SEARCH]: partial }));
  assert.equal(r.status, 'review');
  assert.equal(db.calls[0].args.p_reason, 'naob_listing_incomplete');
});

test('worker: NAOB outage -> error for that word, nothing written; next word still processed', async () => {
  const db = fakeDb({ ...tables(), lexemes: [BRENNE, { id: 'v', lemma: 'brenne', pos: 'verb' }] });
  const results = await worker.processAll(db.client, [BRENNE, { id: 'v', lemma: 'brenne', pos: 'verb' }],
    site({ [SEARCH]: SEARCH_BRENNE, '/ordbok/brenne_2': 503 }));
  assert.equal(results[0].status, 'error');
  assert.match(String(results[0].detail), /HTTP 503/);
  assert.equal(results[1].status, 'pos_not_supported');
  assert.equal(db.calls.length, 0);
});

test('worker: server refuses the forms -> reported, not thrown', async () => {
  const db = fakeDb(tables(), (name) => name === 'd10_publish_naob_forms_v1'
    ? { data: null, error: { message: 'OWN_FORMS_EXIST' } } : { data: null, error: null });
  const r = await worker.processLexeme(db.client, BRENNE, site({
    [SEARCH]: SEARCH_BRENNE, '/ordbok/brenne_2': BRENNE_2, '/ordbok/brenne_3': BRENNE_2, '/ordbok/brenne_4': BRENNE_2,
  }));
  assert.equal(r.status, 'publish_refused');
});

test('worker: time budget -> remaining words deferred', async () => {
  const db = fakeDb(tables());
  let t = 0;
  const results = await worker.processAll(db.client,
    [{ id: 'v1', lemma: 'a', pos: 'verb' }, { id: 'v2', lemma: 'b', pos: 'verb' }],
    site({}), () => { t += 30_000; return t; });
  assert.deepEqual(results.map((r: any) => r.status), ['pos_not_supported', 'deferred']);
});
