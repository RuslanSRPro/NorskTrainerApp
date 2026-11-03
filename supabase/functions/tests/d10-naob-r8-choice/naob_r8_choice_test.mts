// D10 27.10.2026 (agreed): R8 -> one stable NAOB article (variant B); two-gender
// convention in AI examples; sub-articles of an article without an explanation.
// Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-naob-r8-choice/naob_r8_choice_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
const sc = await import('../../ai-enrichment-worker/source-cascade.ts');
const guard = await import('../../ai-enrichment-worker/pos-sense-guard.ts');
const g = await import('../../_shared/d10-example-gender.ts');

const art = (slug: string, definitions: string[]) => ({ slug, article: { status: 'ok', headword: 'bare', pos: 'verb',
  definitions, forms: [], hgno: null } as any });
const bare2 = art('bare_2', ['dekke med granbar']);
const bare3 = art('bare_3', ['dy seg (for)', '(kunne) la være', '(kunne) avholde seg (fra)']);

test('R8 choice: the sub-article word picks bare_3 ("bare seg" -> "dy seg")', () => {
  const r = sc.chooseR8Article('bare', [bare2, bare3], ['bare seg']);
  assert.equal(r.chosen.slug, 'bare_3');
  assert.equal(r.reason, 'sub_article_word');
});

test('R8 choice: no sub-article, or a word in several articles -> lowest number', () => {
  assert.equal(sc.chooseR8Article('bare', [bare3, bare2], []).chosen.slug, 'bare_2');
  const both = sc.chooseR8Article('bare', [bare3, art('bare_2', ['holde seg unna'])], ['bare seg']);
  assert.equal(both.chosen.slug, 'bare_2');
  assert.equal(both.reason, 'lowest_number');
});

test('R8 choice is stable: the same input gives the same article every time', () => {
  const runs = new Set(Array.from({ length: 5 }, () => sc.chooseR8Article('bare', [bare2, bare3], ['bare seg']).chosen.slug));
  assert.deepEqual([...runs], ['bare_3']);
});

test('chooseR8Article never matches a part of another word ("seg" in "segl")', () => {
  const r = sc.chooseR8Article('bare', [art('bare_2', ['sette segl på']), art('bare_3', ['noe annet'])], ['bare seg']);
  assert.equal(r.reason, 'lowest_number');
});

test('articleContext: no explanation -> the code first, sub-article names appended', () => {
  const article = { article_id: 4507, dict_id: 'bm', word_class: 'VERB',
    lemmas: [{ lemma: 'bare', paradigm_info: [{ tags: ['VERB'] }] }],
    body: { definitions: [{ type_: 'definition', elements: [
      { type_: 'sub_article', article_id: 4508, lemmas: ['bare seg'], article: { body: {} } }] }] } };
  assert.throws(() => guard.articleContext(article, '4507', 'bare', 'verb', 'bm'), (e: any) =>
    e.message.startsWith('SELECTED_ARTICLE_DEFINITION_MISSING') && e.message.includes('sub_articles=["bare seg"]'));
  const plain = { ...article, body: { definitions: [] } };
  assert.throws(() => guard.articleContext(plain, '4507', 'bare', 'verb', 'bm'),
    (e: any) => e.message === 'SELECTED_ARTICLE_DEFINITION_MISSING');
});

test('noArticleContext keeps the chosen article in the context, buildEnrichmentEvidence in source', () => {
  const ctx = guard.noArticleContext('bare', 'verb', { NAOB: 'NAOB bare_3 (bare, verb): dy seg (for)' },
    { allowEmpty: true, step: 'naob_r8', note: guard.ARTICLE_WITHOUT_EXPLANATION,
      naobChoice: { slug: 'bare_3', reason: 'sub_article_word', all_slugs: ['bare_2', 'bare_3'] } });
  assert.equal(JSON.parse(ctx).naob_choice.slug, 'bare_3');
  const ev: any = guard.buildEnrichmentEvidence(ctx, { status: 'accepted', version: guard.QUALITY_VERSION });
  assert.equal(ev.source.naob_choice.slug, 'bare_3');
  assert.equal(ev.source.basis_step, 'naob_r8');
});

const bok = g.genderRuleFromForms([
  { form_key: 'noun_singular_indefinite', primary_values: ['bok'], alternative_values: [], accepted_articles: ['en', 'ei'] },
  { form_key: 'noun_singular_definite', primary_values: ['boken'], alternative_values: ['boka'], accepted_articles: ['en', 'ei'] },
  { form_key: 'noun_plural_indefinite', primary_values: ['bøker'], alternative_values: [], accepted_articles: ['en', 'ei'] },
]);

test('gender: definite singular -> "boken (boka)", from either form, capital kept', () => {
  assert.equal(g.applyGenderAlternatives('Jeg leste boken i går.', bok), 'Jeg leste boken (boka) i går.');
  assert.equal(g.applyGenderAlternatives('Jeg leste boka i går.', bok), 'Jeg leste boken (boka) i går.');
  assert.equal(g.applyGenderAlternatives('Boka ligger på bordet.', bok), 'Boken (boka) ligger på bordet.');
});

test('gender: indefinite singular -> "en bok (ei bok)"; already done -> unchanged', () => {
  assert.equal(g.applyGenderAlternatives('Jeg kjøpte ei bok.', bok), 'Jeg kjøpte en bok (ei bok).');
  assert.equal(g.applyGenderAlternatives('Jeg kjøpte en bok (ei bok).', bok), 'Jeg kjøpte en bok (ei bok).');
  assert.equal(g.applyGenderAlternatives('Boken (boka) er god.', bok), 'Boken (boka) er god.');
});

test('gender: plural and one-gender nouns are not touched', () => {
  assert.equal(g.applyGenderAlternatives('Jeg har mange bøker.', bok), 'Jeg har mange bøker.');
  const bil = g.genderRuleFromForms([{ form_key: 'noun_singular_definite', primary_values: ['bilen'],
    alternative_values: [], accepted_articles: ['en'] }]);
  assert.equal(bil, null);
  assert.equal(g.applyGenderAlternatives('Bilen er ny.', bil), 'Bilen er ny.');
});

test('gender: labels for the review', () => {
  assert.deepEqual(g.genderAlternativeLabels(bok), ['boken (boka)', 'en bok (ei bok)']);
});
