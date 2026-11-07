// D10_lexin_ru_fallback_v1: real Lexin bokmål-russisk responses (07.11.2026: adresse, ta av, snakke).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { englishFallback, russianHint, lexinNodes, headwordEntries, lexinPos, cardPosForLexin, lexinUrl }
  from '../../_shared/d10-lexin-ru.ts';

const load = (name: string) => lexinNodes(JSON.parse(readFileSync(new URL(`./fixtures/ru_${name}.json`, import.meta.url), 'utf8')));
const adresse = load('adresse');
const taAv = load('ta_av');
const snakke = load('snakke');

test('only the headword entry of the card POS (no postnummer, adressere, nett~adresse)', () => {
  const entries = headwordEntries(adresse, 'adresse', 'noun');
  assert.deepEqual(entries.map((e) => e.id), [17]);
  assert.equal(headwordEntries(adresse, 'adresse', 'verb').length, 0);
});
test('adresse noun: English from B-lem', () => {
  assert.deepEqual(englishFallback(adresse, 'adresse', 'noun').map((r) => r.translation), ['address']);
});
test('adresse noun: hint has ru and en', () => {
  const hint = russianHint(adresse, 'adresse', 'noun')!;
  assert.match(hint, /ru: адрес/);
  assert.match(hint, /en: address/);
  assert.match(hint, /^Lexin bokmål-russisk \(adresse, noun\)/);
});
test('ta av expression (no POS filter): verb entry "take off"', () => {
  const en = englishFallback(taAv, 'ta av', cardPosForLexin('expression')).map((r) => r.translation);
  assert.ok(en.includes('take off'), en.join(', '));
  assert.ok(!en.includes('hat'));
});
test('snakke verb: English and Russian present', () => {
  const en = englishFallback(snakke, 'snakke', 'verb');
  assert.ok(en.length > 0);
  assert.ok(en.every((r) => r.via === 'lem' || r.via === 'idi'));
  assert.match(russianHint(snakke, 'snakke', 'verb')!, /ru: /);
});
test('word not in the response -> nothing', () => {
  assert.deepEqual(englishFallback(adresse, 'nyordxyz', 'noun'), []);
  assert.equal(russianHint(adresse, 'nyordxyz', 'noun'), null);
});
test('POS names and URL', () => {
  assert.equal(lexinPos('substantiv'), 'noun');
  assert.equal(lexinPos('сущ.'), null);
  assert.equal(cardPosForLexin('unknown'), null);
  assert.equal(lexinUrl('https://x/findwords', 'ta av', 'bokmål-russisk', false),
    'https://x/findwords?searchWord=ta%20av&lang=bokm%C3%A5l-russisk&page=1&selectLang=bokm%C3%A5l-russisk');
});
