// D10 27.10.2026: homograph cards of one lemma + POS must not share an AI translation (pure rules).
//   node --experimental-strip-types --test supabase/functions/tests/d10-homograph-translation/homograph_translation_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
import { homographConstraint, withHomographConstraint, mergeSiblings, sameAsSibling, normTranslation,
  translationBase, hasClarification, HOMOGRAPH_CONSTRAINT_MARK } from '../../ai-enrichment-worker/homograph-translation-guard.ts';

const iii = { id: 'B3', label: 'card III', uk: ['бар'], en: ['bar'] };
const main = { id: 'B1', label: 'main card', uk: ['бар (заклад)'], en: ['bar (pub)'] };

test('bar III: plain «бар» equals the main card -> clash in both languages', () => {
  const clash = sameAsSibling({ uk: ['Бар '], en: ['bar'] }, [{ ...main, uk: ['бар'], en: ['bar'] }]);
  assert.deepEqual(clash.map((c) => c.lang), ['uk', 'en']);
});
test('with a clarification -> no clash', () =>
  assert.deepEqual(sameAsSibling({ uk: ['бар (одиниця тиску)'], en: ['bar (unit of pressure)'] }, [main]), []));
test('only the languages asked are compared', () =>
  assert.deepEqual(sameAsSibling({ uk: [], en: ['bar (pub)'] }, [main]).map((c) => c.lang), ['en']));
test('no siblings -> no constraint, context unchanged', () => {
  assert.equal(homographConstraint('bar', 'noun', []), null);
  const ctx = JSON.stringify({ article_id: '4469', translation_constraints: [] });
  assert.equal(withHomographConstraint(ctx, null), ctx);
});
test('constraint lists the other cards and is added once (replaced, not duplicated)', () => {
  const ctx = JSON.stringify({ article_id: '4471', definitions: ['enhet for trykk'], translation_constraints: ['keep A'] });
  const c1 = homographConstraint('bar', 'noun', [main])!;
  assert.ok(c1.startsWith(HOMOGRAPH_CONSTRAINT_MARK) && c1.includes('«бар (заклад)»') && c1.includes('main card'));
  const once = withHomographConstraint(ctx, c1);
  const twice = withHomographConstraint(once, homographConstraint('bar', 'noun', [iii])!);
  const list = JSON.parse(twice).translation_constraints;
  assert.equal(list.length, 2); assert.equal(list[0], 'keep A'); assert.ok(list[1].includes('card III'));
  assert.deepEqual(JSON.parse(twice).definitions, ['enhet for trykk']);
});
test('context without translation_constraints gets the field', () => {
  const out = JSON.parse(withHomographConstraint(JSON.stringify({ basis: 'no_article' }), homographConstraint('bar', 'noun', [iii])));
  assert.equal(out.translation_constraints.length, 1);
});
test('non-JSON context is returned unchanged', () => assert.equal(withHomographConstraint('x', 'y'), 'x'));
test('values written earlier in the run replace the database values', () => {
  const merged = mergeSiblings([iii], new Map([['B3', { uk: ['бар (одиниця тиску)'] }]]));
  assert.deepEqual(merged[0].uk, ['бар (одиниця тиску)']); assert.deepEqual(merged[0].en, ['bar']);
  assert.deepEqual(sameAsSibling({ uk: ['бар (заклад)'], en: [] }, merged), []);
});

// D10 28.10.2026: stricter rule - the same base needs a clarification here too
test('main «бар» next to III «бар (одиниця тиску)» -> same base without clarification', () => {
  const clash = sameAsSibling({ uk: ['бар'], en: ['bar'] }, [{ id: 'B3', label: 'card III', uk: ['бар (одиниця тиску)'], en: ['bar (unit of pressure)'] }]);
  assert.deepEqual(clash.map((c) => `${c.lang}:${c.kind}`), ['uk:same_base_without_clarification', 'en:same_base_without_clarification']);
});
test('main «бар (заклад)» next to III «бар (одиниця тиску)» -> fine', () =>
  assert.deepEqual(sameAsSibling({ uk: ['бар (заклад)'], en: ['bar (pub)'] },
    [{ id: 'B3', label: 'card III', uk: ['бар (одиниця тиску)'], en: ['bar (unit of pressure)'] }]), []));
test('identical with clarification is still identical', () =>
  assert.equal(sameAsSibling({ uk: ['бар (заклад)'], en: [] }, [main])[0].kind, 'identical'));
test('different base words -> fine (хвоя next to бар)', () =>
  assert.deepEqual(sameAsSibling({ uk: ['хвоя'], en: ['needles'] }, [main, iii]), []));
test('base and clarification helpers', () => {
  assert.equal(translationBase('Бар (одиниця тиску)'), 'бар');
  assert.equal(translationBase('бар'), 'бар');
  assert.equal(hasClarification('бар (заклад)'), true);
  assert.equal(hasClarification('бар'), false);
  assert.equal(hasClarification('(заклад)'), false);
});
test('normalization: case, spaces', () => assert.equal(normTranslation('  Бар   (Заклад) '), 'бар (заклад)'));
