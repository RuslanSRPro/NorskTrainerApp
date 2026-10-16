// D10 audit rewrite of old AI rows: checkCandidateMissing with a fake client.
// The worker imports remote modules, so this test runs on a copy with stubs
// (see README); it documents the expected behaviour.
import test from 'node:test'; import assert from 'node:assert/strict';
(globalThis as any).Deno = { env: { get: () => undefined } };
const m = await import('./ai-enrichment-worker/index.ts');
const g = await import('./ai-enrichment-worker/pos-sense-guard.ts');
function fake(tr: any[], ex: any[]) {
  const q = (data: any[]) => { const o: any = { select: () => o, or: () => o, in: () => o, eq: () => o, order: () => o, range: () => o,
    then: (r: any) => r({ data, error: null }) }; return o; };
  return { from: (t: string) => q(t === 'entity_translations' ? tr : ex) };
}
const cand = { kind: 'lexeme', id: 'L', lexemeId: 'L', lemma: 'vinterjakke', displayForm: null, pos: 'noun', notes: 'n',
  verificationStatus: 'x', naobContext: null, lexinContext: null };
const cur = { version: g.QUALITY_VERSION, status: 'ai_reviewed_no_article', review: { status: 'accepted' } };
test('old AI rows (no evidence) count as missing', async () => {
  const r = await m.checkCandidateMissing(fake([
    { language_code: 'uk', translation: 'зимова куртка', translation_type: 'primary', source: 'ai_fallback', enrichment_evidence: null },
    { language_code: 'en', translation: 'winter jacket', translation_type: 'primary', source: 'ai_fallback', enrichment_evidence: null }],
    [{ source: 'ai_fallback', language_code: 'nb', example_text: 'Jeg har en ny vinterjakke.', enrichment_evidence: null }]) as any, cand as any);
  assert.deepEqual(r.missing, ['translation_ua', 'translation_en', 'example']);
});
test('current AI rows are kept', async () => {
  const r = await m.checkCandidateMissing(fake([
    { language_code: 'uk', translation: 'зимова куртка', translation_type: 'primary', source: 'ai_fallback', enrichment_evidence: cur },
    { language_code: 'en', translation: 'winter jacket', translation_type: 'primary', source: 'ai_fallback', enrichment_evidence: cur }],
    [{ source: 'lexin', language_code: 'nb', example_text: 'Jeg har en ny vinterjakke.' }]) as any, cand as any);
  assert.deepEqual(r.missing, []);
});
test('Lexin rows are never stale', async () => {
  const r = await m.checkCandidateMissing(fake([
    { language_code: 'uk', translation: 'книга', translation_type: 'primary', source: 'lexin', enrichment_evidence: null },
    { language_code: 'en', translation: 'book', translation_type: 'primary', source: 'lexin', enrichment_evidence: null }],
    [{ source: 'lexin', language_code: 'nb', example_text: 'Boka er god.' }]) as any, cand as any);
  assert.deepEqual(r.missing, []);
});
test('expressions unaffected', async () => {
  const r = await m.checkCandidateMissing(fake([
    { language_code: 'uk', translation: 'вчасно', translation_type: 'expression_primary', source: 'ai_fallback', enrichment_evidence: null },
    { language_code: 'en', translation: 'in time', translation_type: 'expression_primary', source: 'ai_fallback', enrichment_evidence: null }],
    [{ source: 'ai_fallback', language_code: 'nb', example_text: 'Vi kom i tide.' }]) as any, { ...cand, kind: 'expression' } as any);
  assert.deepEqual(r.missing, []);
});
