// D10 27.10.2026: Lexin Ukr-def definitions are one row; translations are split as before.
// node --experimental-strip-types --test supabase/functions/tests/d10-lexin-definition/lexin_definition_test.mts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanLexinDefinitionText } from '../../_shared/lexin-definition-text.ts';
import { cleanTranslationSenseGroups } from '../../_shared/lexin-translation-text.ts';

test('bok: definition with a comma stays one text', () => {
  const t = 'написаний від руки або друкований твір у твердій палітурці та зі сторінками, скріпленими з одного боку';
  assert.equal(cleanLexinDefinitionText(t), t);
});

test('advokat: two commas, one text', () => {
  const t = 'людина з юридичною освітою, професія якої полягає в тому, щоб допомагати іншим у правових питаннях';
  assert.equal(cleanLexinDefinitionText(t), t);
});

test('åpne: Lexin reference ^word^ -> «word»', () => {
  assert.equal(cleanLexinDefinitionText('протилежне до ^stenge^'), 'протилежне до «stenge»');
});

test('gammel: two references and parentheses', () => {
  assert.equal(cleanLexinDefinitionText('протилежне до ^ung^ (щодо осіб) і ^ny^ (щодо предметів)'),
    'протилежне до «ung» (щодо осіб) і «ny» (щодо предметів)');
});

test('fin: reference list after comma stays together', () => {
  assert.equal(cleanLexinDefinitionText('протилежне до ^grov^, ^kraftig^'), 'протилежне до «grov», «kraftig»');
});

test('spaces, nbsp and empty input', () => {
  assert.equal(cleanLexinDefinitionText('  давати згоду ,  затверджувати '), 'давати згоду, затверджувати');
  assert.equal(cleanLexinDefinitionText(''), null);
  assert.equal(cleanLexinDefinitionText('^ ^'), null);
  assert.equal(cleanLexinDefinitionText(null), null);
});

test('translations (Ukr-lem) are still split by the old splitter', () => {
  assert.deepEqual(cleanTranslationSenseGroups('книга, книжка'), [['книга', 'книжка']]);
  assert.deepEqual(cleanTranslationSenseGroups('будувати; ґрунтуватися').length, 2);
});
