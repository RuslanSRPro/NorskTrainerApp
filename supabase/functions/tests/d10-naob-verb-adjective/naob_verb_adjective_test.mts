// D10 26.10.2026: NAOB forms of verbs and adjectives. The pages are real
// naob.no pages saved 26.10.2026 (probe_naob_forms.ps1), gzipped.
// Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-naob-verb-adjective/naob_verb_adjective_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://esm.sh/')) {
    return { url: 'data:text/javascript,export const createClient=()=>{throw new Error("stub")}', shortCircuit: true };
  }
  return next(specifier, context);
}`));

const naob = await import('../../_shared/d10-naob-forms.ts');
const worker = await import('../../naob-forms-worker/index.ts');

const page = (name: string) =>
  gunzipSync(readFileSync(new URL(`./naob_${name}.html.gz`, import.meta.url))).toString('utf8');
const BARE_1 = page('article_bare_1');   // adverb
const BARE_2 = page('article_bare_2');   // verb: dy seg (for)
const BARE_3 = page('article_bare_3');   // verb: dekke med granbar
const KASTE_1 = page('article_kaste_1'); // verb: støpe
const BAR_3 = page('article_bar_3');     // adjective without degrees
const STOR = page('article_stor');       // adjective with degrees
const SEARCH_BARE = page('search_bare');

const show = (forms: any[]) => forms.map((f) =>
  `${f.form_key}=${f.primary_values.join('/')}${f.derived_rule ? ' [' + f.derived_rule + ']' : ''}`);

// ------------------------------------------------------------------ parser
test('verb bare_2: preteritum and perfektum partisipp, verbalsubstantiv left out', () => {
  const a = naob.parseNaobArticle(BARE_2);
  assert.equal(a.status, 'ok');
  assert.equal(a.pos, 'verb');
  assert.deepEqual(a.unknown_labels, []);
  assert.deepEqual(show(a.forms), ['infinitive=bare', 'past=baret', 'past_participle=baret']);
  assert.match(a.definitions[0], /dy seg/);
});

test('verb bare_3 has the same forms as bare_2 (R8) and its own meaning', () => {
  const a2 = naob.parseNaobArticle(BARE_2);
  const a3 = naob.parseNaobArticle(BARE_3);
  assert.equal(naob.formsSignature(a2), naob.formsSignature(a3));
  assert.match(a3.definitions[0], /granbar/);
});

test('adjective stor: nøytrum, flertall, komparativ, superlativ', () => {
  const a = naob.parseNaobArticle(STOR);
  assert.equal(a.pos, 'adjektiv');
  assert.deepEqual(a.unknown_labels, []);
  assert.deepEqual(show(a.forms), [
    'positive_singular_indefinite_common=stor', 'positive_singular_indefinite_neuter=stort',
    'positive_plural_indefinite=store', 'comparative=større', 'superlative=størst']);
});

test('adjective bar_3: only nøytrum and flertall, no degrees invented', () => {
  const a = naob.parseNaobArticle(BAR_3);
  assert.deepEqual(show(a.forms), [
    'positive_singular_indefinite_common=bar', 'positive_singular_indefinite_neuter=bart',
    'positive_plural_indefinite=bare']);
});

test('adverb bare_1: no forms (not a noun, verb or adjective)', () => {
  const a = naob.parseNaobArticle(BARE_1);
  assert.equal(a.forms.length, 0);
});

// ----------------------------------------------------------- built forms
test('built forms: verb presens = infinitive + r, marked', () => {
  const a = naob.parseNaobArticle(BARE_2);
  assert.deepEqual(show(naob.withDerivedNaobForms('bare', 'verb', a.forms)), [
    'infinitive=bare', 'present=barer [present_infinitive_plus_r]', 'past=baret', 'past_participle=baret']);
});

test('built forms: no presens for verbs whose presens is not "+ r"', () => {
  const forms = [{ form_key: 'infinitive', primary_values: ['vite'], alternative_values: [] },
    { form_key: 'past', primary_values: ['visste'], alternative_values: [] }] as any[];
  assert.equal(naob.withDerivedNaobForms('vite', 'verb', forms).length, 2);
  assert.equal(naob.withDerivedNaobForms('kunne', 'verb', forms).length, 2);
});

test('built forms: a presens listed by NAOB is kept, nothing built', () => {
  const forms = [{ form_key: 'infinitive', primary_values: ['bare'], alternative_values: [] },
    { form_key: 'present', primary_values: ['barer'], alternative_values: [] },
    { form_key: 'past', primary_values: ['baret'], alternative_values: [] }] as any[];
  assert.ok(naob.withDerivedNaobForms('bare', 'verb', forms).every((f: any) => !f.derived_rule));
});

test('built forms: adjective bestemt = flertall, bestemt superlativ = superlativ + e', () => {
  const a = naob.parseNaobArticle(STOR);
  assert.deepEqual(show(naob.withDerivedNaobForms('stor', 'adjektiv', a.forms)), [
    'positive_singular_indefinite_common=stor', 'positive_singular_indefinite_neuter=stort',
    'positive_definite=store [definite_equals_plural]', 'positive_plural_indefinite=store',
    'comparative=større', 'superlative=størst', 'superlative_definite=største [superlative_plus_e]']);
});

test('built forms: adjective without degrees gets only bestemt form', () => {
  const a = naob.parseNaobArticle(BAR_3);
  const built = naob.withDerivedNaobForms('bar', 'adjektiv', a.forms).filter((f: any) => f.derived_rule);
  assert.deepEqual(show(built), ['positive_definite=bare [definite_equals_plural]']);
});

test('built forms: liten keeps no built bestemt form (lille, not små)', () => {
  const forms = [{ form_key: 'positive_singular_indefinite_common', primary_values: ['liten'], alternative_values: [] },
    { form_key: 'positive_plural_indefinite', primary_values: ['små'], alternative_values: [] }] as any[];
  assert.equal(naob.withDerivedNaobForms('liten', 'adjektiv', forms).length, 2);
});

test('built forms: nouns are unchanged', () => {
  const forms = [{ form_key: 'noun_singular_indefinite', primary_values: ['brenne'], alternative_values: [] }] as any[];
  assert.equal(naob.withDerivedNaobForms('brenne', 'substantiv', forms), forms);
});

// -------------------------------------------------------- decision (R8)
test('decision: two verb articles bare with the same forms -> one set of forms (R8)', () => {
  const parsed = [
    { slug: 'bare_1', article: naob.parseNaobArticle(BARE_1) },
    { slug: 'bare_2', article: naob.parseNaobArticle(BARE_2) },
    { slug: 'bare_3', article: naob.parseNaobArticle(BARE_3) },
  ];
  const d = naob.decideNaobForms('bare', parsed, 'verb');
  assert.equal(d.status, 'forms');
  assert.deepEqual((d as any).used, ['bare_2', 'bare_3']);
  assert.deepEqual((d as any).ignored, ['bare_1']);
});

test('decision: verb articles with different forms -> review', () => {
  const other = naob.parseNaobArticle(BARE_3.replace(/>baret</g, '>barte<'));
  const d = naob.decideNaobForms('bare', [
    { slug: 'bare_2', article: naob.parseNaobArticle(BARE_2) },
    { slug: 'bare_3', article: other },
  ], 'verb');
  assert.equal(d.status, 'review');
});

test('decision: the noun default is unchanged (verb articles are not used for a noun)', () => {
  const d = naob.decideNaobForms('bare', [{ slug: 'bare_2', article: naob.parseNaobArticle(BARE_2) }]);
  assert.equal(d.status, 'no_forms');
});

// ------------------------------------------------------------------ worker
function fakeDb(rpcCalls: Array<{ name: string; args: any }>) {
  const from = (_table: string) => {
    const q: any = {
      select() { return q; }, eq() { return q; }, in() { return q; },
      then(res: any, rej: any) { return Promise.resolve({ data: [], count: 0, error: null }).then(res, rej); },
    };
    return q;
  };
  return {
    from,
    rpc: async (name: string, args: any) => {
      if (name !== 'd10_naob_card_binding_v1') rpcCalls.push({ name, args });
      return name === 'd10_publish_naob_forms_v1' ? { data: 4, error: null } : { data: null, error: null };
    },
  } as any;
}
function site(pages: Record<string, string>, seen: string[] = []) {
  return async (url: string) => {
    seen.push(url);
    const path = decodeURIComponent(new URL(url).pathname) + new URL(url).search;
    const body = pages[path] ?? pages[new URL(url).pathname];
    return body === undefined ? new Response('not found', { status: 404 }) : new Response(body, { status: 200 });
  };
}

test('worker: verb bare without own forms -> NAOB forms published, presens marked', async () => {
  const calls: Array<{ name: string; args: any }> = [];
  const seen: string[] = [];
  const r = await worker.processLexeme(fakeDb(calls), { id: 'v1', lemma: 'bare', pos: 'verb' }, site({
    '/søk?q=bare': SEARCH_BARE, '/ordbok/bare_2': BARE_2, '/ordbok/bare_3': BARE_3, '/ordbok/bare_1': BARE_1,
  }, seen));
  assert.equal(r.status, 'naob_forms');
  assert.ok(!seen.some((u) => u.endsWith('/ordbok/bare_1')), 'the adverb article is not read');
  const p = calls.find((c) => c.name === 'd10_publish_naob_forms_v1')!;
  assert.deepEqual(p.args.p_forms.map((f: any) => [f.form_key, f.primary_values.join('/'), f.derived_rule ?? null]), [
    ['infinitive', 'bare', null], ['present', 'barer', 'present_infinitive_plus_r'],
    ['past', 'baret', null], ['past_participle', 'baret', null]]);
  assert.deepEqual(p.args.p_evidence.naob_slugs, ['bare_2', 'bare_3']);
});

test('worker: division (split) stays for nouns only', async () => {
  const calls: Array<{ name: string; args: any }> = [];
  const r = await worker.processSplit(fakeDb(calls), { id: 'v1', lemma: 'bare', pos: 'verb' }, null, site({}));
  assert.equal(r.status, 'pos_not_supported');
  assert.equal(calls.length, 0);
});

test('verb kaste_1 parsed the same way (control)', () => {
  const a = naob.parseNaobArticle(KASTE_1);
  assert.deepEqual(show(a.forms), ['infinitive=kaste', 'past=kastet', 'past_participle=kastet']);
});
