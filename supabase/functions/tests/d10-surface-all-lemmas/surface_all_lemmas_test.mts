// D10 25.10.2026: a single word keeps every lemma of a part of speech.
// Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-surface-all-lemmas/surface_all_lemmas_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
const sr = await import('../../analyze-text/surface-resolver-v2.ts');

function row(id: string, lemma: string, pos: string, formType = 'base', source = 'lexeme_form_display_v2') {
  return { lexeme_id: id, lemma, pos, form_types: [formType], sources: [source],
    evidence: [{ source, form_type: formType, confidence: 'high', grammatical_features: {} }],
    base_confidence: 'high', base_priority: 95 };
}
const noCtx = { prevToken: null, nextToken: null, precededByInfinitiveMarker: false };
const none = sr.neighbourPos(null, null);

test('bar alone: bære AND bare (both verbs) are returned', () => {
  const out = sr.selectByContext([row('b1', 'bære', 'verb', 'past'), row('b2', 'bare', 'verb', 'imperative')], noCtx, none);
  assert.deepEqual(out.map((r: any) => r.lemma), ['bære', 'bare']);
  assert.equal(out[0].grammatical_features.disambiguation_rule, 'no_context_all_lemmas_returned');
});

test('bar alone with other POS too: every lemma + POS once, verbs first', () => {
  const out = sr.selectByContext([row('n', 'bar', 'noun'), row('b1', 'bære', 'verb', 'past'),
    row('a', 'bar', 'adjective'), row('b2', 'bare', 'verb', 'imperative')], noCtx, none);
  assert.deepEqual(out.map((r: any) => `${r.lemma}/${r.pos}`), ['bære/verb', 'bare/verb', 'bar/noun', 'bar/adjective']);
});

test('the same lemma twice (homograph cards brenne I/II): one candidate, as before', () => {
  const out = sr.selectByContext([row('v1', 'brenne', 'verb', 'present'), row('v2', 'brenne', 'verb', 'present')], noCtx, none);
  assert.deepEqual(out.map((r: any) => r.lexeme_id), ['v1']);
  assert.equal(out[0].confidence, 'high', 'unchanged single-POS path');
});

test('different POS, one lemma each: unchanged (huske verb + noun)', () => {
  const out = sr.selectByContext([row('v', 'huske', 'verb'), row('n', 'huske', 'noun')], noCtx, none);
  assert.deepEqual(out.map((r: any) => r.pos), ['verb', 'noun']);
  assert.equal(out[0].grammatical_features.disambiguation_rule, 'no_context_all_candidates_returned');
});

test('in a sentence (neighbours): unchanged, one lemma per POS', () => {
  const out = sr.selectByContext([row('b1', 'bære', 'verb', 'past'), row('b2', 'bare', 'verb', 'imperative')],
    { prevToken: 'han', nextToken: 'sekken', precededByInfinitiveMarker: false }, none);
  assert.deepEqual(out.map((r: any) => r.lemma), ['bære']);
});
