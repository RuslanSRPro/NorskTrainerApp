// D10 step B: part of speech of every source answer. Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-pos-scope/pos_scope_test.mts
// Source answers are shaped like the real ones (NAOB text from the live
// evidence of tid / huske / være). No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('https://') || specifier.startsWith('npm:') || specifier.startsWith('jsr:')) {
    return { url: 'data:text/javascript,export const createClient=()=>{throw new Error("stub")};export default {}', shortCircuit: true };
  }
  return next(specifier, context);
}`));
(globalThis as any).Deno ??= { env: { get: () => undefined }, serve: () => undefined };

const { basePos, posScope } = await import('../../verification/adapters/pos-scope.ts');
const { checkLexinLive } = await import('../../verification/adapters/lexin.ts');
const { checkWiktionaryLive, bokmalSection } = await import('../../verification/adapters/wiktionary.ts');
const { checkNAOBLive, naobPartsOfSpeech } = await import('../../verification/adapters/naob.ts');
const { lookupSource } = await import('../../lexical-worker/adapters.ts');

type Routes = Array<[RegExp, number, string]>;
function useFetch(routes: Routes) {
  const calls: string[] = [];
  (globalThis as any).fetch = async (input: any) => {
    const url = String(input?.url ?? input);
    calls.push(url);
    for (const [re, status, body] of routes) if (re.test(url)) return new Response(body, { status });
    return new Response('not found', { status: 404 });
  };
  return calls;
}

// ---------------------------------------------------------------- Lexin
const lexin = (entries: Array<[number, string, string]>) => JSON.stringify({ result: [entries.flatMap(([id, lemma, kat]) => [
  { id, sub_id: 0, type: 'E-lem', text: lemma, index: 0 },
  { id, sub_id: 0, type: 'E-kat', text: kat, index: 0 },
])] });

test('basePos: card and source spellings', () => {
  assert.equal(basePos('noun_masculine'), 'noun');
  assert.equal(basePos('Substantiv'), 'noun');
  assert.equal(basePos('subst.'), 'noun');
  assert.equal(basePos('Proper noun'), 'proper_noun');
  assert.equal(basePos('adjektiv'), 'adjective');
  assert.equal(basePos(''), null);
  assert.equal(posScope('expression', ['verb'], 'x').pos_match, 'not_applicable');
  assert.equal(posScope(null, ['verb'], 'x').pos_match, 'not_applicable');
  assert.equal(posScope('noun', [], null).pos_match, 'unknown');
});

test('Lexin brenne: verb entry; noun card -> mismatch, verb card -> match; old fields unchanged', async () => {
  const calls = useFetch([[/editorportal/, 200, lexin([[1, 'brenne', 'verb']])]]);
  const noun = await checkLexinLive('brenne', 'brenne', 'noun');
  assert.equal(noun.found, true);
  assert.equal(noun.quality, 'learner_dictionary');
  assert.equal(noun.registered_entry, true);
  assert.deepEqual(noun.pos_scope, { requested_pos: 'noun', found_pos: ['verb'], pos_match: 'mismatch', pos_basis: 'lexin_nob-ukr_category' });
  assert.equal(calls.length, 2, 'mismatch -> the second Lexin dictionary is asked too');
  const calls2 = useFetch([[/editorportal/, 200, lexin([[1, 'brenne', 'verb']])]]);
  const verb = await checkLexinLive('brenne', 'brenne', 'verb');
  assert.equal(verb.pos_scope?.pos_match, 'match');
  assert.equal(calls2.length, 1, 'match -> one request, as before');
  useFetch([[/editorportal/, 200, lexin([[1, 'brenne', 'verb']])]]);
  const noPos = await checkLexinLive('brenne', 'brenne');
  assert.equal(noPos.pos_scope?.pos_match, 'not_applicable');
  assert.equal(noPos.found, true);
});

test('Lexin drikke: verb and noun entries -> noun card match; like: adjective', async () => {
  useFetch([[/editorportal/, 200, lexin([[1, 'drikke', 'verb'], [2, 'drikke', 'substantiv']])]]);
  const drikke = await checkLexinLive('drikke', 'drikke', 'noun');
  assert.equal(drikke.pos_scope?.pos_match, 'match');
  assert.deepEqual(drikke.pos_scope?.found_pos.sort(), ['noun', 'verb']);
  useFetch([[/editorportal/, 200, lexin([[1, 'like', 'verb'], [2, 'like', 'adjektiv'], [3, 'likevel', 'adverb']])]]);
  const like = await checkLexinLive('like', 'like', 'adjective');
  assert.equal(like.pos_scope?.pos_match, 'match');
  assert.ok(!like.pos_scope?.found_pos.includes('adverb'), 'likevel is another lemma');
});

test('Lexin: nob-ukr mismatch, nob-nob noun -> nob-nob answer with match', async () => {
  useFetch([
    [/bokm%C3%A5l-ukrainsk/, 200, lexin([[1, 'brenne', 'verb']])],
    [/bokm%C3%A5l-bokm%C3%A5l/, 200, lexin([[1, 'brenne', 'verb'], [7, 'brenne', 'substantiv']])],
  ]);
  const r = await checkLexinLive('brenne', 'brenne', 'noun');
  assert.equal(r.pos_scope?.pos_match, 'match');
  assert.match(String(r.evidence_label), /nob-nob/);
});

// ---------------------------------------------------------------- Wiktionary
const noBrenne = '<div class="mw-heading mw-heading2"><h2 id="Norsk">Norsk</h2></div><div class="mw-heading mw-heading3"><h3 id="Verb">Verb</h3></div><p><b>brenne</b> (bokmål/riksmål/nynorsk)</p><ol><li>være i brann</li></ol>';
const enBrenne = '<h2><span class="mw-headline" id="Norwegian_Bokmål">Norwegian Bokmål</span><span class="mw-editsection"><span class="mw-editsection-bracket">[</span><a>edit</a><span class="mw-editsection-bracket">]</span></span></h2><h3>Etymology</h3><h3>Verb</h3><p>brenne (to burn)</p><h2>Norwegian Nynorsk</h2><h3>Noun</h3><p>brenne</p>';
const noNynorskOnly = '<h2 id="Nynorsk">Nynorsk</h2><h3>Substantiv</h3><p>kvelv substantiv nynorsk</p>';

test('Wiktionary brenne: Bokmål verb section; the Nynorsk noun does not count', async () => {
  assert.deepEqual(bokmalSection(enBrenne, false).pos, ['verb']);
  useFetch([[/no\.wiktionary/, 200, noBrenne], [/en\.wiktionary/, 200, enBrenne]]);
  const noun = await checkWiktionaryLive('brenne', 'brenne', 'noun');
  assert.equal(noun.found, true);
  assert.equal(noun.quality, 'registered_entry');
  assert.deepEqual(noun.pos_scope, { requested_pos: 'noun', found_pos: ['verb'], pos_match: 'mismatch', pos_basis: 'wiktionary_bokmal_section' });
  useFetch([[/no\.wiktionary/, 200, noBrenne], [/en\.wiktionary/, 200, enBrenne]]);
  const verb = await checkWiktionaryLive('brenne', 'brenne', 'verb');
  assert.equal(verb.pos_scope?.pos_match, 'match');
});

test('Wiktionary: Nynorsk-only page is not a Bokmål find', async () => {
  useFetch([[/no\.wiktionary/, 200, noNynorskOnly]]);
  const r = await checkWiktionaryLive('kvelv', 'kvelv', 'noun');
  assert.equal(r.found, false);
  assert.equal(r.quality, 'not_found');
});

// ---------------------------------------------------------------- NAOB
const naobArticle = (lemma: string, pos: string) =>
  `<html><title>${lemma} - Det Norske Akademis ordbok</title><a>Fritekst-søk</a><h1>${lemma}</h1><span>${lemma}</span>&#160;<span>${pos}</span><p>Uttale</p><p>Etymologi</p><h2>Betydning og bruk</h2><p>${lemma} er ...</p></html>`;
const naobSearch = (lemma: string, lines: Array<[string, string]>) =>
  `<html><title>${lemma} - Det Norske Akademis ordbok</title><h1>Søkeresultater</h1><a>Fritekst-søk</a><span>${lemma}</span><p>${lines.length} treff</p>` +
  lines.map(([pos, gloss]) => `<a><b>${lemma}</b> <i>${pos}</i></a><p>${gloss} ...</p>`).join('') +
  `<p>Viser treff 1 til ${lines.length} av ${lines.length} totalt</p></html>`;

test('NAOB huske (real shape): search lists verb, verb, substantiv -> noun card match by listing', () => {
  const text = 'huske - det norske akademis ordbok søkeresultater fritekst-søk huske 3 treff huske verb ha erindring (om), ta i betraktning ... huske verb bevege rytmisk, i en huske ... huske substantiv innretning til &aring; huske, gynge i, jf. dumphuske ... viser treff 1 til 3 av 3 totalt';
  const found = naobPartsOfSpeech([{ url: 'https://naob.no/s%C3%B8k?q=huske', text }], 'huske');
  assert.deepEqual(found, { article: [], listing: ['verb', 'substantiv'] });
});

test('NAOB tid (real shape): article heading "tid &#160; substantiv"', () => {
  const text = 'tid - det norske akademis ordbok fritekst-søk tid tid &#160; substantiv moderat bokmål en ; tiden , tider genus maskulinum';
  assert.deepEqual(naobPartsOfSpeech([{ url: 'https://naob.no/ordbok/tid', text }], 'tid'), { article: ['substantiv'], listing: [] });
});

test('NAOB brenne: article verb + search lists only verbs -> noun card mismatch; old fields unchanged', async () => {
  useFetch([
    [/naob\.no\/ordbok\/brenne/, 200, naobArticle('brenne', 'verb')],
    [/naob\.no\/s%C3%B8k/, 200, naobSearch('brenne', [['verb', 'være i brann'], ['verb', 'la brenne'], ['verb', 'brenne inne'], ['verb', 'brenne av']])],
  ]);
  const noun = await checkNAOBLive('brenne', 'brenne', 'noun');
  assert.equal(noun.found, true);
  assert.equal(noun.quality, 'registered_entry');
  assert.equal(noun.pos_scope?.pos_match, 'mismatch');
  assert.deepEqual(noun.pos_scope?.found_pos, ['verb']);
  useFetch([
    [/naob\.no\/ordbok\/brenne/, 200, naobArticle('brenne', 'verb')],
    [/naob\.no\/s%C3%B8k/, 200, naobSearch('brenne', [['verb', 'være i brann']])],
  ]);
  const verb = await checkNAOBLive('brenne', 'brenne', 'verb');
  assert.equal(verb.pos_scope?.pos_match, 'match');
  assert.equal(verb.pos_scope?.pos_basis, 'naob_article_heading');
});

test('NAOB: word only mentioned on the search page -> found weak as before, POS unknown', async () => {
  useFetch([[/naob\.no\/s%C3%B8k/, 200, '<p>2 treff</p><a><b>bål</b> <i>substantiv</i></a><p>brenne ved ...</p><a><b>fyr</b> <i>substantiv</i></a><p>brenne i ovnen ...</p>']]);
  const r = await checkNAOBLive('brenne', 'brenne', 'noun');
  assert.equal(r.found, true);
  assert.equal(r.quality, 'search_page_match');
  assert.equal(r.pos_scope?.pos_match, 'unknown');
});

// ---------------------------------------------------------------- lexical-worker
test('lexical-worker: card POS goes to Lexin; evidence gets requested_pos / found_pos / pos_match', async () => {
  useFetch([[/editorportal/, 200, lexin([[1, 'brenne', 'verb']])]]);
  const r = await lookupSource({ id: 'c', job_id: 'j', item_id: 'i', lexeme_id: 'l', expression_id: null,
    source: 'Lexin', stage: 'lemma', query: 'brenne', query_type: 'token', pos: 'noun', attempt_count: 0, max_attempts: 3 } as any);
  assert.equal(r.found, true);
  assert.equal(r.quality, 'medium');
  assert.equal((r.evidence as any).requested_pos, 'noun');
  assert.deepEqual((r.evidence as any).found_pos, ['verb']);
  assert.equal((r.evidence as any).pos_match, 'mismatch');
});

test('lexical-worker: Språkrådet has no POS -> unknown; expression check -> not_applicable', async () => {
  useFetch([[/sprakradet/, 200, '<html>ingen treff</html>']]);
  const s = await lookupSource({ id: 'c', job_id: 'j', item_id: 'i', lexeme_id: 'l', expression_id: null,
    source: 'Språkrådet', stage: 'lemma', query: 'brenne', query_type: 'token', pos: 'noun', attempt_count: 0, max_attempts: 3 } as any);
  assert.equal((s.evidence as any).pos_match, 'unknown');
  useFetch([[/editorportal/, 200, lexin([[1, 'ta tid', 'uttrykk']])]]);
  const e = await lookupSource({ id: 'c', job_id: 'j', item_id: 'i', lexeme_id: null, expression_id: 'e',
    source: 'Lexin', stage: 'lemma', query: 'ta tid', query_type: 'expression', attempt_count: 0, max_attempts: 3 } as any);
  assert.equal((e.evidence as any).pos_match, 'not_applicable');
});
