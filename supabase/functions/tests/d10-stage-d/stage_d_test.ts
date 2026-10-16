// D10 stage D: pure rules, no network. Run:
//   deno test --allow-read supabase/functions/tests/d10-stage-d/
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseHomographArticle, decideHomographs, runHomographStep } from '../../_shared/d10-homograph-cards.ts';
import { parseLexinMorphology, cardFormWords, lexinEntryFitsCard } from '../../_shared/d10-lexin-homograph-forms.ts';

const dir = new URL('./fixtures/', import.meta.url);
const fx = (n: string) => JSON.parse(Deno.readTextFileSync(new URL(n, dir)).replace(/^﻿/, ''));
const bokII = fx('ordbokene_106786.json');
const vaereIII = fx('ordbokene_69212.json');
const lexin = fx('lexin_bok.json');
// bok I (6790), hgno 1, bøker/bøkene - as shown by Ordbøkene
const bokI = { article_id: 6790, lemmas: [{ lemma: 'bok', hgno: 1, paradigm_info: [
  { tags: ['NOUN', 'Masc'], inflection: [{ word_form: 'bok' }, { word_form: 'boken' }, { word_form: 'bøker' }, { word_form: 'bøkene' }] },
  { tags: ['NOUN', 'Fem'], inflection: [{ word_form: 'bok' }, { word_form: 'boka' }, { word_form: 'bøker' }, { word_form: 'bøkene' }] }] }] };

Deno.test('parse bok II', () => {
  const p = parseHomographArticle(bokII, 106786, 'bok', 'noun')!;
  assertEquals(p.hgno, 2);
  assertEquals(p.forms, ['bok', 'boka', 'boken', 'bokene', 'boker']);
});
Deno.test('parse være III', () => {
  const p = parseHomographArticle(vaereIII, 69212, 'være', 'verb')!;
  assertEquals(p.hgno, 3);
  assert(p.forms.includes('værer') && p.forms.includes('væra'));
});
Deno.test('wrong POS -> null', () => assertEquals(parseHomographArticle(bokII, 106786, 'bok', 'verb'), null));
Deno.test('bok: different forms -> second card II', () => {
  const d = decideHomographs([parseHomographArticle(bokI, 6790, 'bok', 'noun')!],
    [{ articleId: 106786, parsed: parseHomographArticle(bokII, 106786, 'bok', 'noun') }]);
  assertEquals(d.map((x) => [x.articleId, x.decision, x.hgno]), [[106786, 'r9_card', 2]]);
});
Deno.test('identical forms -> one card (R8)', () => {
  const main = parseHomographArticle(bokI, 6790, 'bok', 'noun')!;
  const d = decideHomographs([main], [{ articleId: 7000, parsed: { ...main, articleId: 7000, hgno: 3 } }]);
  assertEquals(d[0].decision, 'r8_same_forms');
});
Deno.test('headword removed at source -> skipped', () => {
  const d = decideHomographs([parseHomographArticle(bokI, 6790, 'bok', 'noun')!], [{ articleId: 1, parsed: null }]);
  assertEquals(d[0].decision, 'skipped');
});
Deno.test('main card without article: lowest number is main', () => {
  const d = decideHomographs([], [
    { articleId: 106786, parsed: parseHomographArticle(bokII, 106786, 'bok', 'noun') },
    { articleId: 6790, parsed: parseHomographArticle(bokI, 6790, 'bok', 'noun') }]);
  assertEquals(d.map((x) => [x.articleId, x.decision]), [[6790, 'main_article'], [106786, 'r9_card']]);
});
Deno.test('step: card created and added; not enabled -> quiet stop', async () => {
  const rpc = async (name: string) => {
    if (name === 'd10_homograph_candidates_for_job_v1') return { data: [{ main_lexeme_id: 'M', lemma: 'bok', pos: 'noun', main_article_ids: [6790], article_id: 106786 }], error: null };
    if (name === 'd10_record_homograph_decision_v1') return { data: 'CARD', error: null };
    if (name === 'd10_inject_homograph_item_v1') return { data: 'ITEM', error: null };
    return { data: [], error: null };
  };
  const fetchJson = async (url: string) => url.endsWith('/6790.json') ? bokI : url.endsWith('/106786.json') ? bokII : null;
  const r = await runHomographStep(rpc, fetchJson, 'J');
  assertEquals([r.added, r.decided, r.errors.length], [1, 1, 0]);
  const off = async (name: string) => name === 'd10_record_homograph_decision_v1'
    ? { data: null, error: { message: 'HOMOGRAPH_CARDS_NOT_ENABLED' } } : rpc(name);
  const r2 = await runHomographStep(off, fetchJson, 'J');
  assertEquals([r2.notEnabled, r2.added], [true, 0]);
});
Deno.test('fetch failure is not recorded', async () => {
  let recorded = 0;
  const rpc = async (name: string) => {
    if (name === 'd10_homograph_candidates_for_job_v1') return { data: [{ main_lexeme_id: 'M', lemma: 'bok', pos: 'noun', main_article_ids: [6790], article_id: 106786 }], error: null };
    if (name === 'd10_record_homograph_decision_v1') { recorded++; return { data: null, error: null }; }
    return { data: [], error: null };
  };
  const r = await runHomographStep(rpc, async (u: string) => u.endsWith('/6790.json') ? bokI : Promise.reject(new Error('net')), 'J');
  assertEquals([recorded, r.errors.length], [0, 1]);
});
const mor = (id: number) => parseLexinMorphology(lexin.result[0].filter((e: any) => e.id === id && e.type === 'E-mor').map((e: any) => e.text).join(' '));
Deno.test('Lexin "book" (entry 506) belongs to bok I, not to bok II', () => {
  assertEquals(mor(506), ['bok', 'boka', 'boken', 'bøkene', 'bøker']);
  assertEquals(lexinEntryFitsCard(mor(506), cardFormWords(['bok', 'boken', 'boka', 'bøker', 'bøkene'])), true);
  assertEquals(lexinEntryFitsCard(mor(506), cardFormWords(['bok', 'boken', 'boka', 'boker', 'bokene'])), false);
});
Deno.test('Lexin entry without inflection or card without forms -> not taken', () => {
  assertEquals(lexinEntryFitsCard([], cardFormWords(['bok'])), false);
  assertEquals(lexinEntryFitsCard(['bok'], new Set()), false);
});
