// D10 no-article AI translation: pure rules, no network. Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-ai-no-article/no_article_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
const g = await import('../../ai-enrichment-worker/pos-sense-guard.ts');
const b = await import('../../_shared/ai-review-binding.ts');

const notFound = { Ordbokene: { status: 'partial', quality: 'not_found', found: false, registered_entry: false,
  evidence: { original_quality: 'not_found', raw_preview: { dictionary_code: 'bm', pos: 'noun', candidate_article_ids: [] } } } };

test('blocker: real no-article -> allowed', () => assert.equal(g.noArticleBlocker(notFound, 'noun', '', false), null));
test('blocker: Ordbøkene 502 -> not answered', () => assert.equal(g.noArticleBlocker(
  { Ordbokene: { status: 'failed', quality: 'error', found: false, evidence: { error: 'Ordbokene returned HTTP 502' } } }, 'noun', '', false),
  'NO_ARTICLE_ORDBOKENE_NOT_ANSWERED'));
test('blocker: no Ordbøkene check -> not answered', () => assert.equal(g.noArticleBlocker({}, 'noun', '', false), 'NO_ARTICLE_ORDBOKENE_NOT_ANSWERED'));
test('blocker: ambiguous articles', () => assert.equal(g.noArticleBlocker({ Ordbokene: { ...notFound.Ordbokene,
  evidence: { raw_preview: { candidate_article_ids: [1, 2] } } } }, 'noun', '', false), 'NO_ARTICLE_AMBIGUOUS_ARTICLES'));
test('blocker: article exists', () => assert.equal(g.noArticleBlocker({ Ordbokene: { status: 'done', quality: 'strong',
  found: true, registered_entry: true, evidence: { raw_preview: { article_ids: [6790] } } } }, 'noun', '', false), 'NO_ARTICLE_ARTICLE_EXISTS'));
test('blocker: second card (bok II)', () => assert.equal(g.noArticleBlocker(notFound, 'noun', 'II', false), 'NO_ARTICLE_NOT_FOR_SECOND_CARD'));
test('blocker: main card with second card', () => assert.equal(g.noArticleBlocker(notFound, 'noun', '', true), 'NO_ARTICLE_NOT_FOR_HOMOGRAPH_GROUP'));
test('blocker: no POS', () => assert.equal(g.noArticleBlocker(notFound, null, '', false), 'NO_ARTICLE_POS_REQUIRED'));
test('context: no sources -> refused', () => assert.throws(() => g.noArticleContext('ord', 'noun', { NAOB: null, Lexin: ' ' }), /NO_ARTICLE_SOURCE_CONTEXT_MISSING/));

function reviewFor(context: string, missing: string[], answer: any) {
  return { version: g.QUALITY_VERSION, status: 'accepted', provider: 'gemini', model: 'm', policy_version: 'p',
    reason: 'ok', reviewed_at: new Date().toISOString(),
    approved_proposal: { context: JSON.parse(context), missing: [...missing], answer } };
}
const ctx = g.noArticleContext('kjæreste', 'noun', { NAOB: 'kjæreste: person man er forelsket i', Lexin: null, Wiktionary: '{"x":1}' });
const answer = { translation_ua: ['кохана людина'], translation_en: ['sweetheart'] };
const review = reviewFor(ctx, ['translation_ua', 'translation_en'], answer);
const ev = g.buildEnrichmentEvidence(ctx, review, { lexemeId: 'L1', languageCode: 'uk', value: 'кохана людина' });
const entity = { entity_id: 'L1', lemma: 'kjæreste', pos: 'noun' };
const tr = (over: any = {}) => ({ locale: 'uk', value: 'кохана людина', original_value: 'кохана людина', lexeme_id: 'L1',
  expression_id: null, provider: 'ai_fallback', canonical: true, source_pos: 'noun', translation_rank: 1,
  translation_type: 'primary', current_article_ids: [], enrichment_evidence: ev, ...over });

test('evidence: marked no-article, low reliability', () => {
  assert.equal(ev.status, 'ai_reviewed_no_article'); assert.equal(ev.reliability, 'low');
  assert.equal((ev as any).source.article_id, null); assert.equal((ev as any).content_binding.basis, 'no_article');
});
test('completion: ready while the word has no article', () => assert.equal(b.boundAiReviewReason(entity, tr()), null));
test('completion: article appeared later -> not ready', () => assert.equal(
  b.boundAiReviewReason(entity, tr({ current_article_ids: ['123'] })), 'AI_NO_ARTICLE_ARTICLE_NOW_EXISTS'));
test('completion: text changed', () => assert.equal(b.boundAiReviewReason(entity, tr({ value: 'інше', original_value: 'інше' })), 'AI_REVIEW_TEXT_CHANGED'));
test('completion: other lexeme', () => assert.equal(b.boundAiReviewReason({ ...entity, entity_id: 'L2' }, tr({ lexeme_id: 'L2' })), 'AI_REVIEW_IDENTITY_CHANGED'));
test('binding: value not in approved proposal -> refused', () => assert.throws(() =>
  g.buildEnrichmentEvidence(ctx, review, { lexemeId: 'L1', languageCode: 'uk', value: 'щось інше' }), /AI_REVIEWED_CONTENT_MISMATCH/));

// regression: article path unchanged
const article = { article_id: 6790, lemmas: [{ lemma: 'bok', paradigm_info: [{ tags: ['NOUN'], inflection: [] }] }],
  body: { definitions: [{ type_: 'definition', elements: [{ type_: 'explanation', content: 'trykt verk', items: [] }] }] } };
const actx = g.articleContext(article, '6790', 'bok', 'noun', 'bm');
const areview = reviewFor(actx, ['translation_ua'], { translation_ua: ['книга'] });
const aev = g.buildEnrichmentEvidence(actx, areview, { lexemeId: 'B1', languageCode: 'uk', value: 'книга' });
test('article path: evidence unchanged shape', () => { assert.equal(aev.status, 'ai_reviewed'); assert.equal((aev as any).source.article_id, '6790'); });
test('article path: completion ready with its article', () => assert.equal(b.boundAiReviewReason({ entity_id: 'B1', lemma: 'bok', pos: 'noun' },
  { locale: 'uk', value: 'книга', original_value: 'книга', lexeme_id: 'B1', expression_id: null, provider: 'ai_fallback', canonical: true,
    source_pos: 'noun', translation_rank: 1, translation_type: 'primary', current_article_ids: ['6790'], enrichment_evidence: aev }), null));

// reviewer prompt: unchanged for article-only batches, note added for no-article
async function capturePrompt(mod: any, inputs: any[]) {
  let prompt = '';
  (globalThis as any).Deno = { env: { get: (k: string) => k === 'GEMINI_API_KEY' ? 'x' : undefined } };
  (globalThis as any).fetch = async (_u: string, init: any) => { prompt = JSON.parse(init.body).contents[0].parts[0].text;
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '[]' }] } }] }) }; };
  await mod.reviewGenerated(inputs);
  return prompt;
}
test('review prompt: article-only batch has no extra rule', async () => {
  const inputs = [{ ref: 0, lemma: 'bok', pos: 'noun', context: actx, missing: ['translation_ua'], answer: { translation_ua: ['книга'] } }];
  assert.doesNotMatch(await capturePrompt(g, inputs), /no_article/);
});
test('review prompt: no-article batch gets the source rule', async () => {
  const p = await capturePrompt(g, [{ ref: 0, lemma: 'kjæreste', pos: 'noun', context: ctx, missing: ['translation_ua'], answer }]);
  assert.match(p, /context\.basis "no_article"/);
});
