import {
  collectFormVariantGroups,
  getFormTierValues,
  hasFormVariants,
  isIrregularMorphology,
} from '../services/formPresentation';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertArrayEqual(
  actual: readonly unknown[],
  expected: readonly unknown[],
  message: string,
): void {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

const hope = {
  form_primary: { preteritum: ['håpet', 'håpte'] },
  form_alternatives: { preteritum: ['håpa', 'håpet'] },
  regularity_marker: 'regular',
  forms_read_model: 'v2',
};

const tiers = getFormTierValues(hope, 'preteritum');
assertArrayEqual(tiers.primaryValues, ['håpet', 'håpte'], 'Both primary forms survive');
assertArrayEqual(tiers.alternativeValues, ['håpa'], 'Primary cannot be duplicated as alternative');
assertEqual(hasFormVariants(hope), true, 'Multiple primary values expose the variants icon');

const groups = collectFormVariantGroups(hope);
assertEqual(groups.length, 1, 'One form group is shown');
assertEqual(groups[0].formKey, 'preteritum', 'The group keeps its canonical key');

assertEqual(
  hasFormVariants({ form_primary: { presens: ['håper'] } }),
  false,
  'A single primary form does not add visual noise',
);
assertEqual(
  isIrregularMorphology({ regularity_marker: 'irregular' }),
  false,
  'Legacy data cannot trigger authoritative styling',
);
assertEqual(
  isIrregularMorphology({
    regularity_marker: 'irregular',
    forms_read_model: 'v2',
  }),
  true,
  'Irregular words are highlighted',
);
assertEqual(
  isIrregularMorphology({
    regularity_marker: 'suppletive',
    forms_read_model: 'v2',
  }),
  true,
  'Suppletive words are highlighted',
);
assertEqual(
  isIrregularMorphology({
    regularity_marker: 'regular',
    forms_read_model: 'v2',
  }),
  false,
  'Regular words keep the normal color',
);
assertArrayEqual(
  getFormTierValues({}, 'preteritum', 'testet').primaryValues,
  ['testet'],
  'Legacy fallback remains available during cutover',
);

assert(groups[0].alternativeValues.includes('håpa'), 'Official alternative remains accessible');

console.log('D10 form presentation: 12 passed / 0 failed');
