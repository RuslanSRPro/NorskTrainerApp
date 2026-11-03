// D10 27.10.2026: definition block of the help popup (pure rules).
//   node --experimental-strip-types --test tests/d10-definition-hint/definition_hint_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanDefinitionText, splitDefinitionParts, pickDefinitionHint } from '../../services/definitionText.ts';

test('reference ^word^ -> «word»', () =>
  assert.equal(cleanDefinitionText('протилежне до ^stenge^'), 'протилежне до «stenge»'));
test('Nynorsk twin and (BM) are dropped', () =>
  assert.equal(cleanDefinitionText('as opposed to ^stenge^ (BM), ^stengje^ (NN)'), 'as opposed to «stenge»'));
test('gammel en: spacing fixed', () =>
  assert.equal(cleanDefinitionText('as opposed to ^ung^  (of people:) ,  ^ny^ (of things:)'),
    'as opposed to «ung» (of people:), «ny» (of things:)'));
test('parts by ";" outside parentheses', () =>
  assert.deepEqual(splitDefinitionParts('som har en viss alder; som har høy alder; motsatt av «ung» (om personer; gammel)'),
    ['som har en viss alder', 'som har høy alder', 'motsatt av «ung» (om personer; gammel)']));

const gammel = [
  { lang: 'nb', text: 'som har en viss alder; som har høy alder; som har eksistert lenge; motsatt av  ^ung^ (om personer:), ^ny^ (om gjenstander:)' },
  { lang: 'en', text: 'of a certain age; aged; having existed for a long time; as opposed to ^ung^  (of people:) ,  ^ny^ (of things:)' },
  { lang: 'uk', text: 'який досяг певного віку; який прожив багато років; який довго існує; протилежне до ^ung^ (щодо осіб) і ^ny^ (щодо предметів)' },
];
test('ua -> Lexin uk, up to 4 items', () => {
  const h = pickDefinitionHint(gammel, 'ua')!;
  assert.equal(h.lang, 'uk'); assert.equal(h.isFallback, false);
  assert.deepEqual(h.items, ['який досяг певного віку', 'який прожив багато років', 'який довго існує',
    'протилежне до «ung» (щодо осіб) і «ny» (щодо предметів)']);
});
test('en -> English', () => assert.equal(pickDefinitionHint(gammel, 'en')!.items[0], 'of a certain age'));
test('no -> Norwegian, not marked as fallback', () => {
  const h = pickDefinitionHint(gammel, 'no')!; assert.equal(h.lang, 'nb'); assert.equal(h.isFallback, false);
});
test('no uk -> Norwegian, marked', () => {
  const h = pickDefinitionHint([{ lang: 'nb', text: 'gjøre åpen; motsatt av ^stenge^' }], 'ua')!;
  assert.equal(h.isFallback, true); assert.deepEqual(h.items, ['gjøre åpen', 'motsatt av «stenge»']);
});
test('old split rows (before the Lexin fix) are shown as items, duplicates removed', () => {
  const h = pickDefinitionHint([{ lang: 'uk', text: 'протилежне до ^stenge^' }, { lang: 'uk', text: 'робити відкритим' },
    { lang: 'uk', text: 'протилежне до ^stenge^' }], 'ua')!;
  assert.deepEqual(h.items, ['протилежне до «stenge»', 'робити відкритим']);
});
test('nothing -> null (no block)', () => {
  assert.equal(pickDefinitionHint([], 'ua'), null);
  assert.equal(pickDefinitionHint([{ lang: 'uk', text: ' ^ ^ ' }], 'ua'), null);
});
