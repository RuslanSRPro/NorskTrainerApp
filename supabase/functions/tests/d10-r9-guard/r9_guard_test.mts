// D10 homograph cards + R9 guard. Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-r9-guard/r9_guard_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHomographArticle, decideHomographs, runHomographStep } from '../../_shared/d10-homograph-cards.ts';
const fx = (n: string) => JSON.parse(readFileSync(new URL('../d10-stage-d/fixtures/' + n, import.meta.url), 'utf8'));
const bokII = fx('ordbokene_106786.json');
const vaereIII = fx('ordbokene_69212.json');
// bok I 6790 reconstructed from the Ordbøkene screenshot (hgno 1, bøker/bøkene)
const bokI = { article_id: 6790, lemmas: [{ lemma: 'bok', hgno: 1, paradigm_info: [
  { tags: ['NOUN','Masc'], inflection: [{word_form:'bok'},{word_form:'boken'},{word_form:'bøker'},{word_form:'bøkene'}] },
  { tags: ['NOUN','Fem'], inflection: [{word_form:'bok'},{word_form:'boka'},{word_form:'bøker'},{word_form:'bøkene'}] } ] }] };
const bokIcopy = { ...bokI, article_id: 7000 };
test('parse bok II', () => {
  const p = parseHomographArticle(bokII, 106786, 'bok', 'noun')!;
  assert.equal(p.hgno, 2); assert.deepEqual(p.forms, ['bok','boka','boken','bokene','boker']);
});
test('parse være III', () => {
  const p = parseHomographArticle(vaereIII, 69212, 'være', 'verb')!;
  assert.equal(p.hgno, 3); assert.ok(p.forms.includes('værer') && p.forms.includes('væra'));
});
test('wrong POS -> null', () => assert.equal(parseHomographArticle(bokII, 106786, 'bok', 'verb'), null));
test('bok: different forms -> r9 card II', () => {
  const d = decideHomographs([parseHomographArticle(bokI, 6790, 'bok', 'noun')!],
    [{ articleId: 106786, parsed: parseHomographArticle(bokII, 106786, 'bok', 'noun') }]);
  assert.deepEqual(d.map(x => [x.articleId, x.decision, x.hgno]), [[106786, 'r9_card', 2]]);
});
test('identical forms -> r8 (no card)', () => {
  const d = decideHomographs([parseHomographArticle(bokI, 6790, 'bok', 'noun')!],
    [{ articleId: 7000, parsed: { ...parseHomographArticle(bokIcopy, 7000, 'bok', 'noun')!, hgno: 3 } }]);
  assert.equal(d[0].decision, 'r8_same_forms');
});
test('no headword (removed at source) -> skipped', () => {
  const d = decideHomographs([parseHomographArticle(bokI, 6790, 'bok', 'noun')!], [{ articleId: 1, parsed: null }]);
  assert.equal(d[0].decision, 'skipped');
});
test('main card without article: lowest number becomes main, other r9', () => {
  const d = decideHomographs([], [
    { articleId: 106786, parsed: parseHomographArticle(bokII, 106786, 'bok', 'noun') },
    { articleId: 6790, parsed: parseHomographArticle(bokI, 6790, 'bok', 'noun') }]);
  assert.deepEqual(d.map(x => [x.articleId, x.decision]), [[6790, 'main_article'], [106786, 'r9_card']]);
});
test('runHomographStep: creates and injects; not-enabled stops quietly', async () => {
  const calls: string[] = [];
  const rpc = async (name: string, args: any) => {
    calls.push(name);
    if (name === 'd10_homograph_candidates_for_job_v1') return { data: [{ main_lexeme_id: 'M', lemma: 'bok', pos: 'noun', main_article_ids: [6790], article_id: 106786 }], error: null };
    if (name === 'd10_record_homograph_decision_v1') return { data: 'CARD', error: null };
    if (name === 'd10_inject_homograph_item_v1') return { data: 'ITEM', error: null };
    if (name === 'd10_existing_homograph_cards_for_job_v1') return { data: [], error: null };
    throw new Error(name);
  };
  const fetchJson = async (url: string) => url.endsWith('/6790.json') ? bokI : url.endsWith('/106786.json') ? bokII : null;
  const r = await runHomographStep(rpc, fetchJson, 'J');
  assert.equal(r.added, 1); assert.equal(r.decided, 1); assert.deepEqual(r.errors, []);
  const rpc2 = async (name: string) => name === 'd10_record_homograph_decision_v1'
    ? { data: null, error: { message: 'HOMOGRAPH_CARDS_NOT_ENABLED' } }
    : rpc(name, {});
  const r2 = await runHomographStep(rpc2 as any, fetchJson, 'J');
  assert.equal(r2.notEnabled, true); assert.equal(r2.added, 0);
});
test('fetch failure is not recorded', async () => {
  const recorded: any[] = [];
  const rpc = async (name: string, args: any) => {
    if (name === 'd10_homograph_candidates_for_job_v1') return { data: [{ main_lexeme_id: 'M', lemma: 'bok', pos: 'noun', main_article_ids: [6790], article_id: 106786 }], error: null };
    if (name === 'd10_record_homograph_decision_v1') { recorded.push(args); return { data: null, error: null }; }
    return { data: [], error: null };
  };
  const r = await runHomographStep(rpc, async (u: string) => u.endsWith('/6790.json') ? bokI : Promise.reject(new Error('net')), 'J');
  assert.equal(recorded.length, 0); assert.equal(r.errors.length, 1);
});

// D10 R9 guard
test('R9 guard: real 6790 vs 106786 stays a second card', () => {
  const real6790 = JSON.parse(readFileSync(new URL('./ordbokene_6790.json', import.meta.url), 'utf8'));
  const main = parseHomographArticle(real6790, 6790, 'bok', 'noun')!;
  const cand = parseHomographArticle(bokII, 106786, 'bok', 'noun')!;
  assert.ok(main.definitions!.length > 0 && cand.definitions!.length > 0);
  const d = decideHomographs([main], [{ articleId: 106786, parsed: cand }]);
  assert.equal(d[0].decision, 'r9_card');
});
test('R9 guard: variant entry that only refers to the main article -> review', () => {
  const main = { articleId: 1, hgno: 1, forms: ['ord', 'ordet'], definitions: ['noe man sier'], refArticleIds: [] };
  const cand = { articleId: 2, hgno: 2, forms: ['ord', 'orda'], definitions: [], refArticleIds: [1] };
  const d = decideHomographs([main], [{ articleId: 2, parsed: cand }]);
  assert.equal(d[0].decision, 'skipped'); assert.equal(d[0].review, true); assert.equal(d[0].reason, 'r9_guard_same_meaning');
});
test('R9 guard: same explanations -> review', () => {
  const main = { articleId: 1, hgno: 1, forms: ['a', 'b'], definitions: ['x y', 'z'], refArticleIds: [] };
  const cand = { articleId: 2, hgno: 2, forms: ['a', 'c'], definitions: ['z'], refArticleIds: [] };
  assert.equal(decideHomographs([main], [{ articleId: 2, parsed: cand }])[0].review, true);
});
