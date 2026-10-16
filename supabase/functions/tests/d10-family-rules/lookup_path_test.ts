// D10 14.10.2026: Ordbøkene lookup path by the real number of words.
// Pure rule only, no network. Run: deno test supabase/functions/tests/d10-family-rules/
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ordbokeneLookupPath } from '../../verification/adapters/ordbokene.ts';

const cases: Array<[string, string | null, string]> = [
  // fixed: a one-letter word no longer turns an expression into a single word
  ['i tide', null, 'expression'],
  ['sette i', null, 'expression'],
  ['ta i', null, 'expression'],
  // unchanged
  ['på tide', null, 'expression'],
  ['ta opp', null, 'expression'],
  ['bare tiden og veien', null, 'expression'],
  ['huske', 'verb', 'token'],
  ['tid', 'noun', 'token'],
  ['huske', null, 'token'],
  ['jeg', 'pronoun', 'legacy'],
  ['i', null, 'legacy'],
  ['å gå', null, 'token'],
  ['å bry seg om', null, 'expression'],
];

for (const [query, pos, expected] of cases) {
  Deno.test(`lookup path: ${query} / ${pos ?? '-'}`, () => {
    assertEquals(ordbokeneLookupPath(query, pos), expected);
  });
}
