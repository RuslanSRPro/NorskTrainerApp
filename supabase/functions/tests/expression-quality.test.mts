import test from 'node:test';
import assert from 'node:assert/strict';
import { expressionContext, expressionEvidence, currentExpressionEvidence } from '../ai-enrichment-worker/expression-quality.ts';
import { QUALITY_VERSION, sourceSenseError, reviewDecisions, reviewGenerated } from '../ai-enrichment-worker/pos-sense-guard.ts';
const row = { id: 'expression-1', lemma: 'gripe seg i det', pos: 'expression',
  raw_sources: { source: 'NAOB', source_type: 'uttrykk', glosses: [
    { type: 'direct', naob_form: 'gripe seg i det', slug: 'gripe', gloss: 'stanse seg i noe man er i ferd med å gjøre' }] },
  verification_evidence: { NAOB: { status: 'done', whole_unit_match: true } } };
const context = expressionContext(row);
const answer = { translation_ua: ['стриматися'], translation_en: ['stop oneself'],
  example_nb: 'Han ville lyve, men grep seg i det.', example_translation_ua: 'Він хотів збрехати, але стримався.',
  example_highlights_nb: ['grep seg i det'], example_highlights_uk: ['стримався'] };
const input = { ref: 0, lemma: row.lemma, pos: row.pos, context, missing: ['translation_ua', 'translation_en', 'example'], answer };
const review = { version: QUALITY_VERSION, status: 'accepted', approved_proposal: { context: JSON.parse(context), missing: input.missing, answer } };
test('own NAOB definition only, not parent or cross-reference', () => {
  assert.equal(JSON.parse(context).definitions.length, 1);
  const bad = structuredClone(row); bad.raw_sources.glosses[0].naob_form = 'gripe';
  assert.throws(() => expressionContext(bad), /OWN_DEFINITION_REQUIRED/);
  bad.raw_sources.glosses[0].naob_form = row.lemma; bad.raw_sources.glosses[0].type = 'reference';
  assert.throws(() => expressionContext(bad), /OWN_DEFINITION_REQUIRED/);
});
test('Ordbokene requires exact verified subarticle ID', () => {
  const ob = { ...row, raw_sources: { source: 'Ordbokene', source_type: 'sub_article', article_id: 123,
    dictionary_code: 'BM', definition_preview: 'gå imellom', examples: ['hun grep inn'] },
    verification_evidence: { Ordbokene: { status: 'done', whole_unit_match: true, article_id: '123' } } };
  assert.equal(JSON.parse(expressionContext(ob)).sources[0].article_id, '123');
  ob.verification_evidence.Ordbokene.article_id = '999';
  assert.throws(() => expressionContext(ob), /OWN_DEFINITION_REQUIRED/);
});
test('missing verdict and rejected review cannot approve data', () => {
  assert.equal(reviewDecisions([input], []).get(0), 'AI_POS_SENSE_REVIEW_REJECTED');
  assert.throws(() => expressionEvidence(context, { ...review, status: 'rejected' }, row.id,
    { language_code: 'uk', translation: 'стриматися' }), /REVIEW_REQUIRED/);
});
test('example must include Ukrainian translation', () => {
  assert.equal(sourceSenseError({ ...input, answer: { ...answer, example_translation_ua: '' } }), 'AI_REQUESTED_EXAMPLE_MISSING');
});
test('approval bound to owner and exact content', () => {
  assert.throws(() => expressionEvidence(context, review, 'other', { language_code: 'uk', translation: 'стриматися' }), /REVIEW_REQUIRED/);
  assert.throws(() => expressionEvidence(context, review, row.id, { language_code: 'uk', translation: 'схопитися за це' }), /NOT_REVIEWED/);
  assert.throws(() => expressionEvidence(context, review, row.id,
    { example_text: answer.example_nb, translation_uk: 'Інший переклад' }), /NOT_REVIEWED/);
});
test('unchecked or changed rows stale; approved rows retained', () => {
  const value = { language_code: 'uk' as const, translation: 'стриматися' };
  assert.equal(currentExpressionEvidence(value, row.id), false);
  const saved = { ...value, enrichment_evidence: expressionEvidence(context, review, row.id, value) };
  assert.equal(currentExpressionEvidence(saved, row.id), true);
  assert.equal(currentExpressionEvidence({ ...saved, translation: 'схопитися за це' }, row.id), false);
});
test('shared reviewer separates accepted and rejected expressions in one batch', async () => {
  const originalFetch = globalThis.fetch;
  const originalDeno = (globalThis as any).Deno;
  (globalThis as any).Deno = { env: { get: () => 'test-only' } };
  globalThis.fetch = async (_url, request) => {
    const body = JSON.parse(String(request?.body));
    assert.match(body.contents[0].parts[0].text, /whole expressions/);
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify([
      { ref: 0, lemma: row.lemma, pos: row.pos, supported: true, reason: 'Matches definition' },
      { ref: 1, lemma: row.lemma, pos: row.pos, supported: false, reason: 'Literal translation changes meaning' }
    ]) }] } }] }), { status: 200 });
  };
  try {
    const accepted: number[] = [], rejected: number[] = [];
    const decisions = await reviewGenerated([input, { ...input, ref: 1 }],
      (ref) => accepted.push(ref), (ref) => rejected.push(ref));
    assert.equal(decisions.get(0), null);
    assert.equal(decisions.get(1), 'AI_POS_SENSE_REVIEW_REJECTED');
    assert.deepEqual(accepted, [0]); assert.deepEqual(rejected, [1]);
  } finally { globalThis.fetch = originalFetch; (globalThis as any).Deno = originalDeno; }
});
