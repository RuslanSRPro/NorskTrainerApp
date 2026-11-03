// D10 25.10.2026 (point 4): the one list of "for review" reasons.
// Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-review-decisions/review_decisions_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
const rd = await import('../../_shared/d10-review-decisions.ts');

test('enrichment pattern: the five codes of 15.10/17.10 match as before, plus the two new ones', () => {
  const old = /AI_POS_SENSE_REVIEW_REJECTED|AI_SINGLE_TRANSLATION_REQUIRED|AI_REQUESTED_EXAMPLE_MISSING|AI_SOURCE_PERIOD_CHANGED_TO_NEW_MOON|pos_mismatch_filtered/;
  const samples = ['{"error":"AI_POS_SENSE_REVIEW_REJECTED"}', 'AI_SINGLE_TRANSLATION_REQUIRED: translation_ua',
    'AI_REQUESTED_EXAMPLE_MISSING', 'AI_SOURCE_PERIOD_CHANGED_TO_NEW_MOON', 'pos_mismatch_filtered: fields',
    'Ordbokene returned HTTP 502', 'statement timeout', 'write_errors present'];
  for (const s of samples) if (old.test(s)) assert.equal(rd.ENRICHMENT_REVIEW_PATTERN.test(s), true, s);
  assert.equal(rd.ENRICHMENT_REVIEW_PATTERN.test('SELECTED_BM_ARTICLE_REQUIRED: no unique POS-scoped article'), true);
  assert.equal(rd.ENRICHMENT_REVIEW_PATTERN.test('{"error":"SELECTED_ARTICLE_DEFINITION_MISSING"}'), true);
  for (const s of ['Ordbokene returned HTTP 502', 'statement timeout', 'write_errors present'])
    assert.equal(rd.ENRICHMENT_REVIEW_PATTERN.test(s), false, s);
});

test('AI context codes: only at the start of the message', () => {
  assert.equal(rd.aiContextReviewCode('SELECTED_BM_ARTICLE_REQUIRED: no unique POS-scoped article; NAOB-bound path: X'), 'SELECTED_BM_ARTICLE_REQUIRED');
  assert.equal(rd.aiContextReviewCode('SELECTED_ARTICLE_DEFINITION_MISSING'), 'SELECTED_ARTICLE_DEFINITION_MISSING');
  assert.equal(rd.aiContextReviewCode('TRANSLATION_READ_FAILED: SELECTED_BM_ARTICLE_REQUIRED'), null);
});

const gate = (reason: string, extra: Record<string, unknown> = {}) => ({ status: 'done', current_stage: 'admission_gate',
  promotion_status: 'not_promoted', admission_status: 'pos_unverified', admission_reason: reason, ...extra });

test('gate: the review reasons of 174/175 are review, anything else is not', () => {
  for (const r of ['AMBIGUOUS_POS_WITHOUT_ARTICLE', 'CONFIRMED_ORDBOKENE_POS_CONFLICT', 'CONFIRMED_ARTICLE_POS_CONFLICT',
    'NO_CONFIRMED_WHOLE_UNIT_REGISTRATION', 'unknown_pos_requires_review']) assert.equal(rd.isGateReviewItem(gate(r)), true, r);
  assert.equal(rd.isGateReviewItem(gate('SOMETHING_NEW')), false);
  assert.equal(rd.isGateReviewItem(gate('AMBIGUOUS_POS_WITHOUT_ARTICLE', { status: 'processing' })), false);
  assert.equal(rd.isGateReviewItem(gate('AMBIGUOUS_POS_WITHOUT_ARTICLE', { promotion_status: 'promoted' })), false);
  assert.equal(rd.isGateReviewItem({}), false);
});

test('function words: rejected by design, neither review nor blocker', () => {
  const fw = gate('function_word_pronoun', { admission_status: 'rejected' });
  assert.equal(rd.isFunctionWordItem(fw), true);
  assert.equal(rd.isGateReviewItem(fw), false);
  assert.equal(rd.isFunctionWordItem(gate('function_word_pronoun')), false, 'only when rejected');
});
