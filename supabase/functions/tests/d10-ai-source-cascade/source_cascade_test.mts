// D10 26.10.2026: source cascade for an Ordbøkene article without an explanation.
// Pure functions, real data: NAOB pages of 26.10.2026 (tests/d10-naob-verb-adjective),
// the stored Lexin and Wiktionary excerpts of the card "bare" (verb), query 187.
// Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-ai-source-cascade/source_cascade_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const c = await import('../../ai-enrichment-worker/source-cascade.ts');
const g = await import('../../ai-enrichment-worker/pos-sense-guard.ts');
const naob = await import('../../_shared/d10-naob-forms.ts');

const page = (name: string) => gunzipSync(readFileSync(
  new URL(`../d10-naob-verb-adjective/naob_${name}.html.gz`, import.meta.url))).toString('utf8');
const parsed = (slugs: string[]) => slugs.map((slug) => ({ slug, article: naob.parseNaobArticle(page(`article_${slug}`)) }));

const LEXIN_BARE = "{\"result\":[[{\"id\":310,\"sub_id\":2,\"type\":\"E-lem\",\"text\":\"bare\",\"index\":null,\"pri_id\":310,\"pri_text\":\"bare\"},{\"id\":35453,\"sub_id\":2,\"type\":\"E-lem\",\"text\":\"bare\",\"index\":null,\"pri_id\":35453,\"pri_text\":\"bare\"},{\"id\":307,\"sub_id\":32,\"type\":\"E-kat\",\"text\":\"adjektiv\",\"index\":null,\"pri_id\":null,\"pri_text\":\"\"},{\"id\":307,\"sub_id\":60,\"type\":\"E-def\",\"text\":\"ikke dekket, naken, \\u00e5pen\",\"index\":null,\"pri_id\":null,\"pri_text\":\"\"},{\"id\":307,\"sub_id\":92,\"type\":\"N-eks\",\"text\":\"med bar overkropp\",\"index\":null,\"p";
const WIKTIONARY_BARE = "bare – wiktionary hopp til innhold hovedmeny hovedmeny flytt til sidefeltet skjul navigasjon forside prosjektportal siste endringer tilfeldig side hjelp tinget søk søk utseende gi din støtte opprett konto logg inn personlige verktøy gi din støtte opprett konto logg inn innhold flytt til sidefeltet skjul begynnelsen 1 norsk vis/skjul underseksjonen norsk 1.1 adverb 1.1.1 andre former 1.1.2 synonymer 1.1.3 avledete termer 1.1.4 oversettelser 1.2 adjektiv 1.3 referanser 2 dansk vis/skjul underseksjonen dansk 2.1 adverb 2.2 referanser 3 engelsk vis/skjul underseksjonen engelsk 3.1 adjektiv 3.2 adverb 3.2.1 synonymer vis/skjul innholdsfortegnelsen bare 64 språk afrikaans ænglisc العربية asturianu";

// ------------------------------------------------------------------ NAOB
test('NAOB: bare (verb) -> two verb articles with the same forms (R8), both meanings, adverb left out', () => {
  const r = c.selectNaobSenses('bare', 'verb', parsed(['bare_1', 'bare_2', 'bare_3']));
  assert.equal(r.status, 'r8');
  assert.deepEqual((r as any).slugs, ['bare_2', 'bare_3']);
  assert.match((r as any).text, /dy seg/);
  assert.match((r as any).text, /granbar/);
  assert.doesNotMatch((r as any).text, /utelukkende/);   // the adverb meaning "only"
});

test('NAOB: one article of the part of speech -> its explanation', () => {
  const r = c.selectNaobSenses('bare', 'verb', parsed(['bare_1', 'bare_2']));
  assert.equal(r.status, 'one');
  assert.match((r as any).text, /^NAOB bare_2 \(bare, verb\): .*dy seg/);
});

test('NAOB: same part of speech, different forms -> several meanings (for review)', () => {
  const p = parsed(['bare_2', 'bare_3']);
  p[1] = { slug: 'bare_3', article: naob.parseNaobArticle(page('article_bare_3').replace(/>baret</g, '>barte<')) };
  const r = c.selectNaobSenses('bare', 'verb', p);
  assert.equal(r.status, 'several');
});

test('NAOB: no article of the part of speech -> none (a noun card gets nothing from verb articles)', () => {
  assert.equal(c.selectNaobSenses('bare', 'noun', parsed(['bare_1', 'bare_2', 'bare_3'])).status, 'none');
  assert.equal(c.selectNaobSenses('bare', 'adverb', parsed(['bare_1'])).status, 'one');
});

// ------------------------------------------------------------------ Lexin
test('Lexin: bare -> only the adjective entry; nothing for the verb', () => {
  assert.equal(c.lexinPosExcerpt(LEXIN_BARE, 'verb'), null);
  const adj = c.lexinPosExcerpt(LEXIN_BARE, 'adjective');
  assert.match(adj!, /^Lexin \(adjektiv\): .*ikke dekket, naken, åpen/);
});

test('Lexin: a cut (truncated) excerpt is read without failing', () => {
  assert.equal(c.lexinPosExcerpt(LEXIN_BARE.slice(0, 120), 'adjective'), null);
  assert.equal(c.lexinPosExcerpt(null, 'verb'), null);
});

// ------------------------------------------------------------- Wiktionary
test('Wiktionary: Norwegian "bare" has adverb and adjective -> nothing for the verb, nothing for the adverb', () => {
  assert.equal(c.wiktionaryPosExcerpt(WIKTIONARY_BARE, 'verb'), null);
  assert.equal(c.wiktionaryPosExcerpt(WIKTIONARY_BARE, 'adverb'), null);   // two parts of speech: not safe
});

test('Wiktionary: a Norwegian section with only this part of speech -> used', () => {
  const one = WIKTIONARY_BARE.replace(' 1.2 adjektiv', '');
  assert.match(c.wiktionaryPosExcerpt(one, 'adverb')!, /^Wiktionary \(norsk, adverb\)/);
});

// ---------------------------------------------------------------- context
test('context: no source at all is allowed only with allowEmpty (AI from lemma + POS)', () => {
  assert.throws(() => g.noArticleContext('bare', 'verb', {}), /NO_ARTICLE_SOURCE_CONTEXT_MISSING/);
  const ctx = JSON.parse(g.noArticleContext('bare', 'verb', {}, { allowEmpty: true, step: 'none', note: g.ARTICLE_WITHOUT_EXPLANATION }));
  assert.equal(ctx.basis, 'no_article');
  assert.equal(ctx.basis_step, 'none');
  assert.equal(ctx.basis_note, 'ordbokene_article_without_explanation');
  assert.deepEqual(ctx.sources, {});
  assert.ok(g.isNoArticleContext(JSON.stringify(ctx)));
});

test('context: without opts exactly as before (R12)', () => {
  const ctx = g.noArticleContext('kjæreste', 'noun', { NAOB: 'x', Lexin: null });
  assert.equal(ctx, JSON.stringify({ dictionary: null, article_id: null, basis: 'no_article', lemma: 'kjæreste', pos: 'noun',
    definitions: [], examples: [], translation_constraints: [], sources: { NAOB: 'x' } }));
});

test('evidence: the cascade step is kept in the evidence (≈, low reliability)', () => {
  const context = g.noArticleContext('bare', 'verb', { NAOB: 'NAOB bare_2 (bare, verb): dy seg (for)' },
    { allowEmpty: true, step: 'naob_r8', note: g.ARTICLE_WITHOUT_EXPLANATION });
  const review = { version: g.QUALITY_VERSION, status: 'accepted', provider: 'gemini', model: 'm', policy_version: 'p',
    reason: 'ok', reviewed_at: new Date().toISOString(),
    approved_proposal: { context: JSON.parse(context), missing: ['translation_ua'], answer: { translation_ua: ['утримуватися'] } } };
  const ev: any = g.buildEnrichmentEvidence(context, review);
  assert.equal(ev.status, 'ai_reviewed_no_article');
  assert.equal(ev.source.basis_step, 'naob_r8');
  assert.equal(ev.source.basis_note, 'ordbokene_article_without_explanation');
});
