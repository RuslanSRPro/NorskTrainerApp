// D10 27.10.2026: an Ordbøkene article WITHOUT an explanation (bare, 4507).
// The cascade translation counts while the card has exactly the recorded articles.
//   node --experimental-strip-types --test supabase/functions/tests/d10-article-without-explanation/article_without_explanation_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
const g = await import('../../ai-enrichment-worker/pos-sense-guard.ts');
const b = await import('../../_shared/ai-review-binding.ts');

function reviewFor(context: string, missing: string[], answer: any) {
  return { version: g.QUALITY_VERSION, status: 'accepted', provider: 'gemini', model: 'm', policy_version: 'p',
    reason: 'ok', reviewed_at: new Date().toISOString(),
    approved_proposal: { context: JSON.parse(context), missing: [...missing], answer } };
}
const entity = { entity_id: 'V1', lemma: 'bare', pos: 'verb' };
const naob = { NAOB: 'bare_3: dy seg (for)' };
function evidenceWith(opts: any) {
  const ctx = g.noArticleContext('bare', 'verb', naob, { allowEmpty: true, step: 'naob_r8', note: g.ARTICLE_WITHOUT_EXPLANATION, ...opts });
  const review = reviewFor(ctx, ['translation_ua'], { translation_ua: ['утримуватися'] });
  return g.buildEnrichmentEvidence(ctx, review, { lexemeId: 'V1', languageCode: 'uk', value: 'утримуватися' });
}
const tr = (ev: any, ids: string[]) => ({ locale: 'uk', value: 'утримуватися', original_value: 'утримуватися', lexeme_id: 'V1',
  expression_id: null, provider: 'ai_fallback', canonical: true, source_pos: 'verb', translation_rank: 1,
  translation_type: 'primary', current_article_ids: ids, enrichment_evidence: ev });

const ev = evidenceWith({ articleIds: ['4507'] });

test('evidence records the article without an explanation', () => {
  assert.equal(ev.status, 'ai_reviewed_no_article');
  assert.deepEqual((ev as any).source.article_without_explanation_ids, ['4507']);
  assert.equal((ev as any).source.basis_note, 'ordbokene_article_without_explanation');
});
test('bare: card has only article 4507 -> counts', () => assert.equal(b.boundAiReviewReason(entity, tr(ev, ['4507'])), null));
test('bare: card still has no article -> counts (as R12)', () => assert.equal(b.boundAiReviewReason(entity, tr(ev, [])), null));
test('a NEW article appeared -> does not count', () => assert.equal(
  b.boundAiReviewReason(entity, tr(ev, ['4507', '9999'])), 'AI_NO_ARTICLE_ARTICLE_NOW_EXISTS'));
test('other article instead of 4507 -> does not count', () => assert.equal(
  b.boundAiReviewReason(entity, tr(ev, ['9999'])), 'AI_NO_ARTICLE_ARTICLE_NOW_EXISTS'));
test('old record without the list (before this package) -> does not count, as before', () => assert.equal(
  b.boundAiReviewReason(entity, tr(evidenceWith({}), ['4507'])), 'AI_NO_ARTICLE_ARTICLE_NOW_EXISTS'));
test('plain R12 (no note) with an article -> does not count, as before', () => {
  const ctx = g.noArticleContext('bare', 'verb', naob, { articleIds: ['4507'] });
  const plain = g.buildEnrichmentEvidence(ctx, reviewFor(ctx, ['translation_ua'], { translation_ua: ['утримуватися'] }),
    { lexemeId: 'V1', languageCode: 'uk', value: 'утримуватися' });
  assert.equal(b.boundAiReviewReason(entity, tr(plain, ['4507'])), 'AI_NO_ARTICLE_ARTICLE_NOW_EXISTS');
});
test('list changed after the review -> does not count', () => {
  const forged = JSON.parse(JSON.stringify(ev));
  forged.source.article_without_explanation_ids = ['4507', '9999'];
  assert.equal(b.boundAiReviewReason(entity, tr(forged, ['4507', '9999'])), 'AI_NO_ARTICLE_ARTICLE_NOW_EXISTS');
});
test('context without articleIds is unchanged', () => {
  const ctx = JSON.parse(g.noArticleContext('bare', 'verb', naob, { note: g.ARTICLE_WITHOUT_EXPLANATION }));
  assert.equal('article_without_explanation_ids' in ctx, false);
});
