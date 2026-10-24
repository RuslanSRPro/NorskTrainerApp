// D10 division of a noun without an Ordbøkene article by its NAOB articles.
// Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-naob-homographs/naob_homographs_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://esm.sh/')) {
    return { url: 'data:text/javascript,export const createClient=()=>{throw new Error("stub")}', shortCircuit: true };
  }
  return next(specifier, context);
}`));

const naob = await import('../../_shared/d10-naob-forms.ts');
const worker = await import('../../naob-forms-worker/index.ts');

const fixture = (name: string) => readFileSync(new URL(`../d10-naob-forms/${name}`, import.meta.url), 'utf8');
const BRENNE_2 = readFileSync(new URL('./naob_brenne_2_full.html', import.meta.url), 'utf8');
const SEARCH_BRENNE = fixture('naob_search_brenne.html');
const VINTERJAKKE = fixture('naob_vinterjakke.html');

// brenne_3 ("ved til brensel", neuter) and brenne_4 built from brenne_2:
// only the article, the forms and the explanation differ.
const BRENNE_3 = BRENNE_2
  .replace(/<span class="genus">en<\/span>/g, '<span class="genus">et</span>')
  .replace(/brennen</g, 'brennet<').replace(/brenner</g, 'brenna<')
  .replace(/maskulinum/g, 'nøytrum')
  .replace('&#160;avsvidd skoggrunn', '&#160;ved til brensel')
  .replace('; rydningsplass etter skogbrann', '');
const BRENNE_4_SAME_FORMS = BRENNE_2
  .replace('&#160;avsvidd skoggrunn', '&#160;brennende følelse')
  .replace('; rydningsplass etter skogbrann', '');
const BRENNE_NO_MEANING = BRENNE_3.replace(/<div class="betydning">[\s\S]*?<\/ul>\s*<\/div>/, '<div class="betydning"></div>')
  .replace('&#160;ved til brensel', '');

const parse = (html: string) => naob.parseNaobArticle(html);

// ---------------------------------------------------------------- parser
test('explanation of brenne_2 (quotes left out)', () => {
  assert.deepEqual(parse(BRENNE_2).definitions, ['avsvidd skoggrunn; rydningsplass etter skogbrann']);
});

test('forms with the article: en and et are different paradigms', () => {
  const a = naob.naobFormList('brenne', parse(BRENNE_2));
  const b = naob.naobFormList('brenne', parse(BRENNE_3));
  assert.ok(a.includes('#art:en') && b.includes('#art:et'));
  assert.equal(naob.naobSameForms(a, b), false);
  // NAOB lists only some forms: one list inside the other with the same article = same
  assert.equal(naob.naobSameForms(['#art:en', 'brenne', 'brennen'], ['#art:en', 'brenne', 'brennen', 'brenner']), true);
});

// ---------------------------------------------------------------- the rule (same function as Ordbøkene)
test('brenne_2 + brenne_3: lowest -> main card, other gender + own meaning -> own card', () => {
  const plan = naob.planNaobHomographs('brenne', [
    { slug: 'brenne_3', article: parse(BRENNE_3) },
    { slug: 'brenne_2', article: parse(BRENNE_2) },
  ]);
  assert.deepEqual(plan.map((p: any) => [p.slug, p.decision]), [['brenne_2', 'main_article'], ['brenne_3', 'r9_card']]);
});

test('same forms, other meaning -> one card (R8)', () => {
  const plan = naob.planNaobHomographs('brenne', [
    { slug: 'brenne_2', article: parse(BRENNE_2) },
    { slug: 'brenne_4', article: parse(BRENNE_4_SAME_FORMS) },
  ]);
  assert.deepEqual(plan.map((p: any) => [p.slug, p.decision]), [['brenne_2', 'main_article'], ['brenne_4', 'r8_same_forms']]);
});

test('no own forms (only gender) -> no card, review', () => {
  const plan = naob.planNaobHomographs('brenne', [
    { slug: 'brenne_2', article: parse(BRENNE_2) },
    { slug: 'brenne_5', article: parse(VINTERJAKKE.replace(/vinterjakke/g, 'brenne')) },
  ]);
  const p5 = plan.find((p: any) => p.slug === 'brenne_5');
  assert.equal(p5.decision, 'skipped'); assert.equal(p5.reason, 'r9_guard_no_own_forms'); assert.equal(p5.review, true);
});

test('own forms but no own explanation -> no card, review', () => {
  assert.deepEqual(parse(BRENNE_NO_MEANING).definitions, []);
  const plan = naob.planNaobHomographs('brenne', [
    { slug: 'brenne_2', article: parse(BRENNE_2) },
    { slug: 'brenne_3', article: parse(BRENNE_NO_MEANING) },
  ]);
  assert.equal(plan[1].decision, 'skipped'); assert.equal(plan[1].reason, 'r9_guard_no_own_meaning');
});

// ---------------------------------------------------------------- worker
type Row = Record<string, any>;
function fakeDb(tables: Record<string, Row[]>, rpcImpl: (name: string, args: any) => any) {
  const calls: Array<{ name: string; args: any }> = [];
  function from(table: string) {
    let rows = [...(tables[table] ?? [])];
    let head = false;
    const q: any = {
      select(_c: string, o?: { head?: boolean }) { head = !!o?.head; return q; },
      eq(c: string, v: any) { rows = rows.filter((r) => r[c] === v); return q; },
      in(c: string, vs: any[]) { rows = rows.filter((r) => vs.includes(r[c])); return q; },
      then(res: any, rej: any) { return Promise.resolve(head ? { data: null, count: rows.length, error: null } : { data: rows, error: null }).then(res, rej); },
    };
    return q;
  }
  return { calls, client: { from, rpc: async (name: string, args: any) => { calls.push({ name, args }); return rpcImpl(name, args); } } as any };
}
function site(pages: Record<string, string | number>) {
  return async (url: string) => {
    const u = new URL(url);
    const page = pages[decodeURIComponent(u.pathname) + u.search] ?? pages[u.pathname];
    if (typeof page === 'number') return new Response('x', { status: page });
    if (page === undefined) return new Response('nf', { status: 404 });
    return new Response(page, { status: 200 });
  };
}
const TWO_NOUNS = SEARCH_BRENNE.replace('href="/ordbok/brenne_4"', 'href="/ordbok/brenne_9"');
const PAGES = { '/søk?q=brenne': TWO_NOUNS, '/ordbok/brenne_2': BRENNE_2, '/ordbok/brenne_3': BRENNE_3, '/ordbok/brenne_9': 404 };

test('split: main card bound to brenne_2, card II created for brenne_3, forms published, added to the job', async () => {
  const pages = { ...PAGES, '/søk?q=brenne': SEARCH_BRENNE.replace(/<li class="page_listItem[^"]*"><h3[^>]*><a[^>]*href="\/ordbok\/brenne_4"[\s\S]*?<\/li>/, '') };
  const db = fakeDb({ lexeme_form_display_v2: [], lexeme_compound_head_forms_v1: [] }, (name, args) => {
    if (name === 'd10_record_naob_homograph_v1') return { data: args.p_decision === 'main_article' ? 'MAIN' : args.p_decision === 'r9_card' ? 'CARD_II' : null, error: null };
    if (name === 'd10_publish_naob_forms_v1') return { data: 3, error: null };
    if (name === 'd10_inject_homograph_item_v1') return { data: 'ITEM', error: null };
    return { data: null, error: null };
  });
  const r = await worker.processSplit(db.client, { id: 'MAIN', lemma: 'brenne', pos: 'noun' }, 'JOB', site(pages));
  assert.equal(r.status, 'naob_divided');
  assert.equal(r.added, 1);
  const rec = db.calls.filter((c) => c.name === 'd10_record_naob_homograph_v1').map((c) => [c.args.p_slug, c.args.p_decision]);
  assert.deepEqual(rec, [['brenne_2', 'main_article'], ['brenne_3', 'r9_card']]);
  assert.equal(db.calls.find((c) => c.name === 'd10_record_naob_homograph_v1' && c.args.p_slug === 'brenne_3').args.p_definition, 'ved til brensel');
  const pub = db.calls.filter((c) => c.name === 'd10_publish_naob_forms_v1');
  assert.deepEqual(pub.map((c) => [c.args.p_lexeme_id, c.args.p_evidence.naob_slugs[0]]), [['MAIN', 'brenne_2'], ['CARD_II', 'brenne_3']]);
  assert.deepEqual(pub[1].args.p_forms[1].primary_values, ['brennet']);
  assert.deepEqual(pub[1].args.p_forms[0].accepted_articles, ['et']);
  const inj = db.calls.find((c) => c.name === 'd10_inject_homograph_item_v1');
  assert.deepEqual([inj.args.p_job_id, inj.args.p_card_lexeme_id, inj.args.p_main_lexeme_id], ['JOB', 'CARD_II', 'MAIN']);
});

test('split: a word with Ordbøkene forms is not touched', async () => {
  const db = fakeDb({ lexeme_form_display_v2: [{ lexeme_id: 'X', form_key: 'k' }] }, () => ({ data: null, error: null }));
  const r = await worker.processSplit(db.client, { id: 'X', lemma: 'brenne', pos: 'noun' }, 'JOB', site({}));
  assert.equal(r.status, 'own_forms'); assert.equal(db.calls.length, 0);
});

test('split job: two words per call, marked done, has_more when more are waiting', async () => {
  const db = fakeDb({}, (name) => name === 'd10_naob_split_candidates_for_job_v1'
    ? { data: [{ lexeme_id: 'A', lemma: 'a', pos: 'verb' }, { lexeme_id: 'B', lemma: 'b', pos: 'verb' }, { lexeme_id: 'C', lemma: 'c', pos: 'verb' }], error: null }
    : { data: null, error: null });
  const out = await worker.processSplitJob(db.client, 'JOB', site({}));
  assert.equal(out.results.length, 2);
  assert.equal(out.has_more, true);
  assert.deepEqual(db.calls.filter((c) => c.name === 'd10_mark_naob_split_done_v1').map((c) => c.args.p_lexeme_id), ['A', 'B']);
});

test('forms chain: a card bound to brenne_3 takes only that article (no search, no review)', async () => {
  const seen: string[] = [];
  const db = fakeDb({ lexeme_form_display_v2: [], lexeme_compound_head_forms_v1: [] }, (name) => {
    if (name === 'd10_naob_card_binding_v1') return { data: [{ slug: 'brenne_3', definition: 'ved til brensel' }], error: null };
    if (name === 'd10_publish_naob_forms_v1') return { data: 3, error: null };
    return { data: null, error: null };
  });
  const fetchImpl = async (url: string, init?: RequestInit) => { seen.push(url); return site(PAGES)(url); };
  const r = await worker.processLexeme(db.client, { id: 'CARD_II', lemma: 'brenne', pos: 'noun' }, fetchImpl as any);
  assert.equal(r.status, 'naob_forms');
  assert.deepEqual(seen.map((u) => new URL(u).pathname), ['/ordbok/brenne_3']);
  assert.ok(!db.calls.some((c) => c.name === 'd10_record_naob_forms_review_v1'));
});
