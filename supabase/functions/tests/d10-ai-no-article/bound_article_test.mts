// D10: AI context through the article the card is bound to. Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-ai-no-article/bound_article_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://')) {
    return { url: 'data:text/javascript,export const serve=()=>{};export const createClient=()=>{throw new Error("stub")}', shortCircuit: true };
  }
  return next(specifier, context);
}`));
(globalThis as any).Deno ??= { env: { get: () => undefined }, serve: () => {} };
const w = await import('../../ai-enrichment-worker/index.ts');
const g = await import('../../ai-enrichment-worker/pos-sense-guard.ts');

// styr (main card): the check saw two articles, the card is bound to 57977
const styr = { Ordbokene: { status: 'partial', found: false, quality: 'not_found',
  evidence: { raw_preview: { dictionary_code: 'bm', pos: 'noun', candidate_article_ids: [57976, 57977] } } } };

test('two articles + binding to one of them -> that article is selected', () => {
  const e = w.evidenceWithBoundArticle(styr, 'noun', [57977]);
  assert.equal(g.selectedArticle(e, 'noun'), '57977');
  assert.equal(e.Ordbokene.evidence.raw_preview.article_selection, 'bound_card_article');
  assert.throws(() => g.selectedArticle(styr, 'noun'), /SELECTED_BM_ARTICLE_REQUIRED/); // original unchanged
});
test('binding to an article the check did not see -> not used', () => {
  assert.equal(w.evidenceWithBoundArticle(styr, 'noun', [99999]), null);
});
test('two bindings or none -> not used', () => {
  assert.equal(w.evidenceWithBoundArticle(styr, 'noun', [57976, 57977]), null);
  assert.equal(w.evidenceWithBoundArticle(styr, 'noun', []), null);
});
test('Ordbøkene not answered (502) -> not used', () => {
  const failed = { Ordbokene: { status: 'failed', evidence: {} } };
  assert.equal(w.evidenceWithBoundArticle(failed, 'noun', [57977]), null);
});
