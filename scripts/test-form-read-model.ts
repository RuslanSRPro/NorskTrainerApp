import {
  buildV2Bundles,
  chunkValues,
  collectPagedRows,
  type V2FormRow,
} from '../services/formReadModelCore';

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

async function run(): Promise<void> {
  const v2Rows: V2FormRow[] = [
    {
      lexeme_id: 'hope',
      form_key: 'preterite',
      primary_values: ['håpet', 'håpte', 'håpet'],
      alternative_values: ['håpa'],
      regularity_marker: 'regular',
    },
    {
      lexeme_id: 'hope',
      form_key: 'past_participle',
      primary_values: ['håpet', 'håpt'],
      alternative_values: ['håpa'],
      regularity_marker: 'regular',
    },
    {
      lexeme_id: 'house',
      form_key: 'noun_singular_definite',
      primary_values: ['huset'],
      alternative_values: [],
      regularity_marker: 'regular',
    },
    {
      lexeme_id: 'milk',
      form_key: 'noun_singular_definite',
      primary_values: ['melken'],
      alternative_values: ['melka', 'mjølken', 'mjølka'],
      regularity_marker: 'regular',
      display_order: 1,
    },
    {
      lexeme_id: 'good',
      form_key: 'comparative',
      primary_values: ['bedre'],
      alternative_values: [],
      regularity_marker: 'irregular',
    },
  ];

  const v2 = buildV2Bundles(v2Rows);
  const hope = v2.get('hope');
  assert(hope, 'V2 verb bundle must exist');
  assertArrayEqual(
    hope.form_primary.preteritum,
    ['håpet', 'håpte'],
    'V2 must preserve every ordered primary form',
  );
  assertArrayEqual(
    hope.form_alternatives.preteritum,
    ['håpa'],
    'V2 must keep official alternatives separate',
  );
  assertEqual(
    hope.verb_forms.preteritum,
    'håpet',
    'Current compact UI compatibility value must use primary[0]',
  );
  assertEqual(hope.has_form_alternatives, true, 'Alternative marker must survive');
  assertEqual(hope.forms_read_model, 'v2', 'Bundle must identify V2 source');
  assertEqual(
    v2.get('house')?.noun_forms.best_entall,
    'huset',
    'Noun form key must map to the app contract',
  );
  assertArrayEqual(
    v2.get('milk')?.form_primary.best_entall ?? [],
    ['melken'],
    'Compact noun default must contain only the selected primary form',
  );
  assertArrayEqual(
    v2.get('milk')?.form_alternatives.best_entall ?? [],
    ['melka', 'mjølken', 'mjølka'],
    'Every other official noun variant must survive in alternatives',
  );
  assertEqual(
    v2.get('milk')?.noun_forms.best_entall,
    'melken',
    'Compact compatibility value must follow projection display order',
  );
  assertEqual(
    v2.get('good')?.adjective_forms.komparativ,
    'bedre',
    'Adjective form key must map to the app contract',
  );
  assertEqual(
    v2.get('good')?.regularity_marker,
    'irregular',
    'Irregular marker must survive the reader',
  );

  const chunks = chunkValues(
    Array.from({ length: 205 }, (_, index) => index),
    100,
  );
  assertArrayEqual(
    chunks.map((chunk) => chunk.length),
    [100, 100, 5],
    'Large UUID lists must be split into bounded requests',
  );

  const source = Array.from({ length: 2005 }, (_, index) => index);
  const ranges: [number, number][] = [];
  const paged = await collectPagedRows(async (from, to) => {
    ranges.push([from, to]);
    return source.slice(from, to + 1);
  }, 1000);
  assertEqual(paged.length, 2005, 'Pagination must not truncate rows');
  assertArrayEqual(
    ranges,
    [[0, 999], [1000, 1999], [2000, 2999]],
    'Pagination ranges must be consecutive and inclusive',
  );

  console.log('D10 canonical form read model: passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
