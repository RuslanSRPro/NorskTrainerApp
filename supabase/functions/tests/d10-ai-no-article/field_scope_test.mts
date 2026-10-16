// D10 no-article word: example/notes are not "missing". Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-ai-no-article/field_scope_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// The worker is a Deno function: Node gets stubs for its URL imports and Deno.
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://')) {
    return { url: 'data:text/javascript,export const serve=()=>{};export const createClient=()=>{throw new Error("stub")}', shortCircuit: true };
  }
  return next(specifier, context);
}`));
(globalThis as any).Deno ??= { env: { get: () => undefined }, serve: () => {} };
const w = await import('../../ai-enrichment-worker/index.ts');

const notFound = { Ordbokene: { status: 'partial', quality: 'not_found', found: false, registered_entry: false,
  evidence: { original_quality: 'not_found', raw_preview: { dictionary_code: 'bm', pos: 'noun', candidate_article_ids: [] } } } };
const withArticle = { Ordbokene: { status: 'done', quality: 'strong', found: true, registered_entry: true,
  evidence: { raw_preview: { dictionary_code: 'bm', pos: 'noun', article_ids: [30455] } } } };
const all = ['translation_ua', 'translation_en', 'example', 'notes'];

test('no-article word (vinterjakke): only translations can be missing', () => {
  assert.deepEqual(w.noArticleFieldScope(all, notFound, 'noun', null, false), ['translation_ua', 'translation_en']);
  assert.deepEqual(w.noArticleFieldScope(['example', 'notes'], notFound, 'noun', null, false), []);
});
test('word with its own article: unchanged', () => {
  assert.deepEqual(w.noArticleFieldScope(all, withArticle, 'noun', null, false), all);
});
test('Ordbøkene not answered (502): unchanged', () => {
  const failed = { Ordbokene: { status: 'failed', quality: 'error', found: false, evidence: {} } };
  assert.deepEqual(w.noArticleFieldScope(['example'], failed, 'noun', null, false), ['example']);
});
test('second card / homograph group: unchanged', () => {
  assert.deepEqual(w.noArticleFieldScope(['example'], notFound, 'noun', 'II', false), ['example']);
  assert.deepEqual(w.noArticleFieldScope(['example'], notFound, 'noun', null, true), ['example']);
});
