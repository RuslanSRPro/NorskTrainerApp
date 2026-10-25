// D10 25.10.2026: Read mode preview cards with the pipeline's rule functions.
// Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-read-preview/read_preview_cards_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://esm.sh/')) {
    return { url: 'data:text/javascript,export const createClient=()=>{throw new Error("stub")}', shortCircuit: true };
  }
  return next(specifier, context);
}`));
const pv = await import('../../read-word-preview/preview.ts');

const json = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const BOK = json('./ordbokene_6790.json');
const BOK_II = json('../d10-stage-d/fixtures/ordbokene_106786.json');
const VAERE = json('../d10-stage-d/fixtures/ordbokene_69212.json');
const LEXIN_BOK = json('../d10-stage-d/fixtures/lexin_bok.json');
const html = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const NAOB_SEARCH = html('../d10-naob-forms/naob_search_brenne.html');
const NAOB_BRENNE_2 = html('../d10-naob-homographs/naob_brenne_2_full.html');
const NAOB_BRENNE_3 = NAOB_BRENNE_2
  .replace(/<span class="genus">en<\/span>/g, '<span class="genus">et</span>')
  .replace(/brennen</g, 'brennet<').replace(/brenner</g, 'brenna<')
  .replace(/maskulinum/g, 'nøytrum')
  .replace('&#160;avsvidd skoggrunn', '&#160;ved til brensel')
  .replace('; rydningsplass etter skogbrann', '');

// a copy of an article under another id / lemma / homograph number
function clone(payload: any, id: number, lemma: string, hgno: number) {
  const c = JSON.parse(JSON.stringify(payload).replaceAll(`"${payload.lemmas[0].lemma}"`, `"${lemma}"`));
  c.article_id = id;
  c.lemmas[0].hgno = hgno;
  return c;
}

function site(opts: { search: Record<string, number[]>; articles: Record<number, any>; lexin: Record<string, any>; naob?: Record<string, string> }) {
  const calls: string[] = [];
  const f = async (input: any) => {
    const url = new URL(String(input));
    calls.push(url.hostname + decodeURIComponent(url.pathname) + url.search);
    if (url.hostname === 'ord.uib.no' && url.pathname === '/api/articles') {
      const key = `${url.searchParams.get('w')}|${url.searchParams.get('scope')}`;
      return new Response(JSON.stringify({ articles: { bm: opts.search[key] ?? [] } }), { status: 200 });
    }
    if (url.hostname === 'ord.uib.no') {
      const id = Number(url.pathname.match(/article\/(\d+)\.json/)?.[1]);
      return opts.articles[id] ? new Response(JSON.stringify(opts.articles[id]), { status: 200 }) : new Response('nf', { status: 404 });
    }
    if (url.hostname === 'editorportal.oslomet.no') {
      return new Response(JSON.stringify(opts.lexin[url.searchParams.get('searchWord') ?? ''] ?? []), { status: 200 });
    }
    if (url.hostname === 'naob.no') {
      const page = opts.naob?.[decodeURIComponent(url.pathname) + url.search] ?? opts.naob?.[decodeURIComponent(url.pathname)];
      return page === undefined ? new Response('nf', { status: 404 }) : new Response(page, { status: 200 });
    }
    throw new Error('unexpected ' + url);
  };
  return { f, calls };
}

test('bok: main card + card II (R9); Lexin "книжка" only for the card whose forms fit', async () => {
  const { f } = site({ search: { 'bok|e': [6790, 106786] }, articles: { 6790: BOK, 106786: BOK_II }, lexin: { bok: LEXIN_BOK } });
  const r = await pv.buildPreview('bok', f as any);
  assert.deepEqual(r.cards.map((c: any) => [c.article_id, c.role, c.pos]), [[6790, 'main', 'noun'], [106786, 'second', 'noun']]);
  const [main, second] = r.cards;
  // one translation per Lexin entry (its first variant), as the card shows it
  assert.deepEqual(main.translation.uk, ['книжка']);
  assert.deepEqual(main.translation.en, ['book']);
  // Lexin has the beech under "bøk": no entry fits bok II -> no translation, the explanation shows
  assert.equal(second.translation.status, 'none');
  assert.equal(second.translation.review, 'lexin_r9_no_entry_fits');
  assert.ok(second.definitions.length > 0);
  assert.ok(second.forms.some((x: any) => x.primary_values.includes('boker') || x.alternative_values.includes('boker')));
  // old fields unchanged for older app builds
  assert.equal(r.ordbokene.articles[0].article_id, 6790);
  assert.equal('_parsed' in r.ordbokene.articles[0], false);
});

test('two parts of speech (tørke-like): one card per POS, each with its Lexin entries', async () => {
  const noun = clone(BOK, 501, 'tørke', 1);
  const verb = clone(VAERE, 502, 'tørke', 1);
  const lexin = { result: [[
    { id: 1, type: 'E-lem', text: 'tørke' }, { id: 1, type: 'E-kat', text: 'substantiv' }, { id: 1, type: 'Ukr-lem', text: 'посуха' }, { id: 1, type: 'B-lem', text: 'drought' },
    { id: 2, type: 'E-lem', text: 'tørke' }, { id: 2, type: 'E-kat', text: 'verb' },
    { id: 2, type: 'Ukr-lem', text: 'витерти висохнути висохти засохнути висушити засушувати засушити|сохнути, висихати, витирати' }, { id: 2, type: 'B-lem', text: 'dry' },
    { id: 3, type: 'E-lem', text: 'tørke' }, { id: 3, type: 'E-kat', text: 'verb' }, { id: 3, type: 'Ukr-lem', text: 'витирати (посуд)' }, { id: 3, type: 'B-lem', text: 'wipe' },
  ]], resArray: { 0: { id: 1 }, 1: { id: 3 }, 2: { id: 2 } } };
  const { f } = site({ search: { 'tørke|e': [501, 502] }, articles: { 501: noun, 502: verb }, lexin: { 'tørke': lexin } });
  const r = await pv.buildPreview('tørke', f as any);
  assert.deepEqual(r.cards.map((c: any) => [c.pos, c.role, c.translation.uk.join(',')]),
    [['noun', 'main', 'посуха'], ['verb', 'main', 'витирати (посуд),сохнути']]);
  // "|": the preferred variants on the right come first (Lexin worker parsing), entries in Lexin's order
  assert.equal(r.cards.every((c: any) => c.translation.review === null), true);
});

test('same forms, other meaning -> one card (R8), the other article is merged', async () => {
  const twin = clone(BOK, 7001, 'bok', 2);
  twin.body = { definitions: [{ type_: 'definition', elements: [{ type_: 'explanation', content: 'noe helt annet', items: [] }] }] };
  const { f } = site({ search: { 'bok|e': [6790, 7001] }, articles: { 6790: BOK, 7001: twin }, lexin: { bok: LEXIN_BOK } });
  const r = await pv.buildPreview('bok', f as any);
  assert.equal(r.cards.length, 1);
  assert.deepEqual(r.cards[0].merged_article_ids, [7001]);
  // a single card takes every Lexin entry of its POS (as the Lexin worker without a sibling)
  assert.deepEqual(r.cards[0].translation.uk, ['книжка']);
});

test('no Ordbøkene article: noun divided by NAOB (main + II), NAOB cards with a sibling get no Lexin entry', async () => {
  const search = NAOB_SEARCH.replace(/<li class="page_listItem[^"]*"><h3[^>]*><a[^>]*href="\/ordbok\/brenne_4"[\s\S]*?<\/li>/, '');
  const { f, calls } = site({ search: {}, articles: {}, lexin: { brenne: LEXIN_BOK },
    naob: { '/søk?q=brenne': search, '/ordbok/brenne_2': NAOB_BRENNE_2, '/ordbok/brenne_3': NAOB_BRENNE_3 } });
  const r = await pv.buildPreview('brenne', f as any);
  assert.equal(r.ordbokene.status, 'not_found');
  assert.equal(r.naob.status, 'found');
  assert.deepEqual(r.cards.map((c: any) => [c.naob_slug, c.role, c.source]), [['brenne_2', 'main', 'naob'], ['brenne_3', 'second', 'naob']]);
  assert.deepEqual(r.cards[1].accepted_articles, ['et']);
  assert.deepEqual(r.cards[1].definitions, ['ved til brensel']);
  assert.equal(r.cards.every((c: any) => c.translation.status === 'none'), true);
  assert.ok(calls.some((c) => c.startsWith('naob.no/ordbok/brenne_3')));
});

test('Ordbøkene found: NAOB is not asked', async () => {
  const { f, calls } = site({ search: { 'bok|e': [6790] }, articles: { 6790: BOK }, lexin: { bok: LEXIN_BOK } });
  const r = await pv.buildPreview('bok', f as any);
  assert.equal(r.naob.status, 'not_needed');
  assert.equal(calls.some((c) => c.startsWith('naob.no')), false);
  assert.equal(r.cards.length, 1);
});

test('NAOB unreachable: no exception, naob error, no cards', async () => {
  const { f } = site({ search: {}, articles: {}, lexin: {}, naob: {} });
  const r = await pv.buildPreview('vinterjakke', f as any);
  assert.equal(r.cards.length, 0);
  assert.ok(['not_found', 'error'].includes(r.naob.status));
});

test('Lexin text parsing moved unchanged: same results as the worker gave', async () => {
  const lt = await import('../../_shared/lexin-translation-text.ts');
  assert.deepEqual(lt.cleanTranslationSenseGroups('витерти висохнути висохти засохнути висушити засушувати засушити|сохнути, висихати, витирати'),
    [['сохнути', 'висихати', 'витирати', 'витерти', 'висохнути', 'висохти', 'засохнути', 'висушити', 'засушувати', 'засушити']]);
  assert.deepEqual(lt.cleanTranslationSenseGroups('будувати; ґрунтуватися'), [['будувати'], ['ґрунтуватися']]);
  assert.deepEqual(lt.cleanTranslationSenseGroups('ходити (пішки, з кимсь); йти'), [['ходити (пішки, з кимсь)'], ['йти']]);
  assert.equal(lt.cleanTranslationText('вдягти, одягти, вдягти'), 'вдягти, одягти');
  assert.deepEqual(lt.cleanTranslationVariants('зараз, тепер|нині'), ['зараз', 'тепер', 'нині']);
});
