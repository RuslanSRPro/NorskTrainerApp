// D10 29.10.2026: expression resolver (variant A), pure logic with fake Ordbøkene / database.
//   node --experimental-strip-types --test supabase/functions/tests/d10-expression-resolver/expression_resolver_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { articlePos, bmArticleIds, headWords, orderHeadWords, resolveOne } from '../../synonym-verifier/expression-resolver.ts';

const exprArticle = (id: number, lemma: string, referers: unknown[] = []) => ({
  article_id: id, lemmas: [{ lemma, paradigm_info: [{ standardisation: 'REGISTERED', tags: ['EXPR'] }] }], referers,
});
// holde øye med as Ordbøkene returned it on 28.10.2026
const holde = exprArticle(106460, 'holde øye med', [{ article_id: 42942, hgno: 1, lemma: 'øye' }]);
const row = (norm: string, rounds = 0) => ({ norm_text: norm, lease_token: 't', rounds, attempts: 1 });

function deps(o: { ids?: number[]; articles?: Record<number, unknown>; states?: any[]; pipeline?: { ok: boolean };
  searchThrows?: boolean }) {
  const calls = { pipeline: 0, state: 0 };
  const states = [...(o.states ?? [{ expression_id: null, parent: null }])];
  return { calls, deps: {
    searchArticleIds: async () => { if (o.searchThrows) throw new Error('HTTP 503'); return o.ids ?? []; },
    fetchArticle: async (id: number) => o.articles?.[id] ?? { article_id: id, lemmas: [] },
    state: async () => { calls.state++; return states.length > 1 ? states.shift() : states[0]; },
    runHeadWordPipeline: async () => { calls.pipeline++; return o.pipeline ?? { ok: true }; },
  } };
}

test('search answer -> bm ids only', () => {
  assert.deepEqual(bmArticleIds({ meta: { bm: { total: 1 } }, articles: { bm: [106460] } }), [106460]);
  assert.deepEqual(bmArticleIds({ articles: { nn: [5] } }), []);
});
test('referers -> head words, order kept, duplicates dropped', () => {
  assert.deepEqual(headWords({ referers: [{ article_id: 42942, lemma: 'øye' }, { article_id: 42942, lemma: 'øye' }, { article_id: 'x' }] }),
    [{ article_id: 42942, lemma: 'øye' }]);
});
test('no own expression article -> NAOB explanation', async () => {
  const { deps: d } = deps({ ids: [500], articles: { 500: exprArticle(500, 'vare') } });
  const r = await resolveOne(row('vare lenge'), d);
  assert.equal(r.outcome, 'explanation');
  assert.deepEqual((r.data as any).searched_article_ids, [500]);
});
test('nothing found at all -> explanation', async () => {
  assert.equal((await resolveOne(row('være langvarig'), deps({ ids: [] }).deps)).outcome, 'explanation');
});
test('already in the catalog -> resolved without the pipeline', async () => {
  const { deps: d, calls } = deps({ ids: [106460], articles: { 106460: holde }, states: [{ expression_id: 'E1', parent: null }] });
  const r = await resolveOne(row('holde øye med'), d);
  assert.equal(r.outcome, 'resolved'); assert.equal((r.data as any).expression_id, 'E1'); assert.equal(calls.pipeline, 0);
});
test('head word card bound -> pipeline -> resolved', async () => {
  const parent = { lexeme_id: 'L1', lemma: 'øye', pos: 'noun', article_id: 42942 };
  const { deps: d, calls } = deps({ ids: [106460], articles: { 106460: holde },
    states: [{ expression_id: null, parent }, { expression_id: 'E2', parent }] });
  const r = await resolveOne(row('holde øye med'), d);
  assert.equal(r.outcome, 'resolved'); assert.equal((r.data as any).via, 'head_word_pipeline'); assert.equal(calls.pipeline, 1);
});
test('pipeline ran but the expression is not extracted -> failed (problem words)', async () => {
  const parent = { lexeme_id: 'L1', lemma: 'øye', pos: 'noun', article_id: 42942 };
  const r = await resolveOne(row('holde øye med'), deps({ ids: [106460], articles: { 106460: holde },
    states: [{ expression_id: null, parent }] }).deps);
  assert.equal(r.outcome, 'failed'); assert.equal((r.data as any).reason, 'not_extracted_from_head_word');
});
test('pipeline error -> retry', async () => {
  const parent = { lexeme_id: 'L1', lemma: 'øye', pos: 'noun', article_id: 42942 };
  const r = await resolveOne(row('holde øye med'), deps({ ids: [106460], articles: { 106460: holde },
    states: [{ expression_id: null, parent }], pipeline: { ok: false } }).deps);
  assert.equal(r.outcome, 'retry');
});
test('no head word card -> parent_needed (first round), failed after it', async () => {
  const d = deps({ ids: [106460], articles: { 106460: holde } }).deps;
  const first = await resolveOne(row('holde øye med', 0), d);
  assert.equal(first.outcome, 'parent_needed');
  assert.equal((first.data as any).parent_lemma, 'øye'); assert.equal((first.data as any).parent_article_id, 42942);
  const second = await resolveOne(row('holde øye med', 1), d);
  assert.equal(second.outcome, 'failed'); assert.equal((second.data as any).reason, 'head_word_card_not_bound');
});
test('own article without referers -> failed no_head_word_article', async () => {
  const r = await resolveOne(row('holde øye med'), deps({ ids: [106460], articles: { 106460: exprArticle(106460, 'holde øye med') } }).deps);
  assert.equal(r.outcome, 'failed'); assert.equal((r.data as any).reason, 'no_head_word_article');
});
test('the exact article is the 2nd search hit; a 4th hit is not fetched', async () => {
  const r = await resolveOne(row('holde øye med'), deps({ ids: [1, 106460, 3, 4], articles: { 106460: holde },
    states: [{ expression_id: 'E3', parent: null }] }).deps);
  assert.equal(r.outcome, 'resolved');
});
test('search failure -> retry', async () => {
  assert.equal((await resolveOne(row('holde øye med'), deps({ searchThrows: true }).deps)).outcome, 'retry');
});

// D10 29.10.2026: head word order and part of speech (fyre av, folde ut as seen on 29.10.2026)
const fyreAv = exprArticle(114535, 'fyre av', [{ article_id: 3458, lemma: 'avfyre' }, { article_id: 110268, lemma: 'avfyring' },
  { article_id: 18551, lemma: 'fyre' }, { article_id: 128559, lemma: 'skuddløsning' }]);
const verbArticle = (id: number, lemma: string) => ({ article_id: id, lemmas: [{ lemma, paradigm_info: [{ tags: ['VERB'] }, { tags: ['VERB'] }] }] });

test('head words inside the expression come first, the others are dropped', () => {
  assert.deepEqual(orderHeadWords(headWords(fyreAv), 'fyre av').map((h) => h.lemma), ['fyre']);
  assert.deepEqual(orderHeadWords([{ article_id: 1, lemma: 'x' }], 'holde øye med').map((h) => h.lemma), ['x']);
});
test('article part of speech: one tag -> app name; several / unknown -> null', () => {
  assert.equal(articlePos(verbArticle(15763, 'folde')), 'verb');
  assert.equal(articlePos({ lemmas: [{ paradigm_info: [{ tags: ['NOUN', 'Masc'] }] }] }), 'noun');
  assert.equal(articlePos({ lemmas: [{ paradigm_info: [{ tags: ['NOUN'] }, { tags: ['VERB'] }] }] }), null);
  assert.equal(articlePos({ lemmas: [] }), null);
});
test('fyre av: avfyre has a card, fyre not -> the card of avfyre is NOT used; fyre goes as a verb', async () => {
  let asked: number[] = [];
  const r = await resolveOne(row('fyre av'), {
    searchArticleIds: async () => [114535],
    fetchArticle: async (id: number) => id === 114535 ? fyreAv : verbArticle(id, 'fyre'),
    state: async (_n: string, _o: number | null, parents: number[]) => { asked = parents; return { expression_id: null, parent: null }; },
    runHeadWordPipeline: async () => ({ ok: true }),
  });
  assert.deepEqual(asked, [18551]);
  assert.equal(r.outcome, 'parent_needed');
  assert.equal((r.data as any).parent_lemma, 'fyre');
  assert.equal((r.data as any).parent_pos, 'verb');
});
test('head article cannot be fetched -> retry', async () => {
  const r = await resolveOne(row('fyre av'), {
    searchArticleIds: async () => [114535],
    fetchArticle: async (id: number) => { if (id === 114535) return fyreAv; throw new Error('HTTP 503'); },
    state: async () => ({ expression_id: null, parent: null }),
    runHeadWordPipeline: async () => ({ ok: true }),
  });
  assert.equal(r.outcome, 'retry');
});

// D10 29.10.2026: synonym words without a card -> parts of speech from their articles
import { articleHasLemma, resolveWord } from '../../synonym-verifier/expression-resolver.ts';
const wordArticle = (id: number, lemma: string, tag: string) => ({ article_id: id, lemmas: [{ lemma, paradigm_info: [{ tags: [tag] }] }] });
const wordDeps = (articles: Record<number, unknown>, ids: number[]) => ({
  searchArticleIds: async () => ids, fetchArticle: async (id: number) => articles[id],
  state: async () => ({ expression_id: null, parent: null }), runHeadWordPipeline: async () => ({ ok: true }) });

test('word: two articles verb + noun -> both parts of speech', async () => {
  const r = await resolveOne({ norm_text: 'feste', lease_token: 't', rounds: 0, attempts: 1, kind: 'word' },
    wordDeps({ 1: wordArticle(1, 'feste', 'VERB'), 2: wordArticle(2, 'feste', 'NOUN'), 3: wordArticle(3, 'festet', 'ADJ') }, [1, 2, 3]));
  assert.equal(r.outcome, 'word_pos');
  assert.deepEqual((r.data as any).pos, ['noun', 'verb']);
  assert.deepEqual((r.data as any).article_ids, [1, 2]);
});
test('word: not in Ordbøkene / no part of speech -> failed with the reason', async () => {
  const none = await resolveWord({ norm_text: 'rangle', lease_token: 't', rounds: 0, attempts: 1, kind: 'word' }, wordDeps({}, []));
  assert.equal(none.outcome, 'failed'); assert.equal((none.data as any).reason, 'word_not_in_ordbokene');
  const nopos = await resolveWord({ norm_text: 'x', lease_token: 't', rounds: 0, attempts: 1, kind: 'word' },
    wordDeps({ 5: { article_id: 5, lemmas: [{ lemma: 'x', paradigm_info: [] }] } }, [5]));
  assert.equal((nopos.data as any).reason, 'word_pos_unknown');
});
test('word: lemma match ignores case; another lemma does not count', () => {
  assert.equal(articleHasLemma(wordArticle(1, 'Overstå', 'VERB'), 'overstå'), true);
  assert.equal(articleHasLemma(wordArticle(1, 'overstått', 'ADJ'), 'overstå'), false);
});
