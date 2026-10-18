// D10 Lexin rows for R9 cards (addition to stage D3). Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-lexin-r9/lexin_r9_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';

const d3 = await import('../../_shared/d10-lexin-homograph-forms.ts');
const r9 = await import('../../_shared/d10-lexin-r9.ts');

const forms = (...v: string[]) => d3.cardFormWords(v);
const BRANT = { id: 1001, forms: d3.parseLexinMorphology('brenner brant har brent') };
const BRENTE = { id: 1002, forms: d3.parseLexinMorphology('brenner brente har brent') };
const CARD_BOTH = forms('brenne', 'brenner', 'brente', 'brant', 'har brent');   // article lists both
const CARD_BRANT = forms('brenne', 'brenner', 'brant', 'har brent');

test('card whose article lists both forms: only the entry the sibling does not have', () => {
  const s = r9.selectR9Entries([BRANT, BRENTE], CARD_BOTH, [CARD_BRANT]);
  assert.equal(s.status, 'exclusive');
  assert.deepEqual(s.allowed, [1002]);
  assert.equal(s.review, null);
});

test('sibling card: one entry fits -> D3 unchanged, no mark', () => {
  const s = r9.selectR9Entries([BRANT, BRENTE], CARD_BRANT, [CARD_BOTH]);
  assert.equal(s.status, 'one_fits');
  assert.equal(s.allowed, null);
  assert.equal(s.review, null);
});

test('both cards have the same forms -> D3 unchanged + review', () => {
  const s = r9.selectR9Entries([BRANT, BRENTE], CARD_BOTH, [CARD_BOTH]);
  assert.equal(s.status, 'several_shared');
  assert.equal(s.allowed, null);
  assert.equal(s.review, 'lexin_r9_several_entries_fit');
});

test('no entry fits (or no inflection) -> D3 unchanged (AI) + review', () => {
  const s = r9.selectR9Entries([{ id: 7, forms: [] }], CARD_BRANT, [CARD_BOTH]);
  assert.equal(s.status, 'none_fits');
  assert.equal(s.allowed, null);
  assert.equal(s.review, 'lexin_r9_no_entry_fits');
});

test('D3 functions themselves unchanged: brackets and "har" handled as before', () => {
  assert.deepEqual(d3.parseLexinMorphology('ei (en) bok boka (boken) bøker bøkene'), ['bok', 'boka', 'boken', 'bøkene', 'bøker']);
  assert.equal(d3.lexinEntryFitsCard(BRANT.forms, CARD_BRANT), true);
  assert.equal(d3.lexinEntryFitsCard(BRENTE.forms, CARD_BRANT), false);
});
