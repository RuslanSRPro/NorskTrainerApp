import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compilePronounParadigmV1, recognizePronounFormV1, generatePronounFormV1 } from './pronoun-paradigm-contract-v1.mjs';

const fixture = JSON.parse(readFileSync(new URL('../artifacts/R084-pronoun-paradigm-source-fixture.json', import.meta.url), 'utf8'));
const paradigm = compilePronounParadigmV1(fixture);
const generated = [
  ['jeg', 'Nom', 'jeg'], ['jeg', 'Acc', 'meg'],
  ['du', 'Acc', 'deg'], ['hun', 'Acc', 'henne'],
  ['vi', 'Acc', 'oss'], ['de', 'Acc', 'dem'],
  ['han', 'Acc', 'ham'], ['den', 'Nom', 'den'], ['den', 'Acc', 'den'],
  ['det', 'Nom', 'det'], ['det', 'Acc', 'det'],
];
for (const [lemma, grammaticalCase, surface] of generated) {
  const result = generatePronounFormV1(paradigm, lemma, grammaticalCase);
  assert.equal(result?.surface, surface);
  assert.equal(result?.source_candidate_id, fixture.candidate_id);
  assert.ok(recognizePronounFormV1(paradigm, surface).some(
    (reading) => reading.lemma === lemma && reading.case === grammaticalCase
  ));
}
assert.deepEqual(recognizePronounFormV1(paradigm, 'meg').map(({ lemma, case: c }) => [lemma, c]), [['jeg', 'Acc']]);
assert.deepEqual(recognizePronounFormV1(paradigm, 'Jeg').map(({ lemma, case: c }) => [lemma, c]), [['jeg', 'Nom']]);
assert.deepEqual(recognizePronounFormV1(paradigm, 'den').map(({ lemma, case: c }) => [lemma, c]), [['den', 'Nom'], ['den', 'Acc']]);
assert.deepEqual(recognizePronounFormV1(paradigm, 'det').map(({ lemma, case: c }) => [lemma, c]), [['det', 'Nom'], ['det', 'Acc']]);
assert.equal(recognizePronounFormV1(paradigm, 'fisken').length, 0);
assert.equal(generatePronounFormV1(paradigm, 'jeg', 'Dat'), null);
assert.throws(() => compilePronounParadigmV1({ ...fixture, status: 'unverified' }), /PARADIGM_SOURCE_NOT_ADMISSIBLE/);
assert.throws(() => compilePronounParadigmV1({ ...fixture, execution_role: 'reference' }), /PARADIGM_SOURCE_NOT_ADMISSIBLE/);
assert.throws(() => compilePronounParadigmV1({ ...fixture, statement: 'no forms' }), /PARADIGM_PAIRS_MISSING/);
console.log(JSON.stringify({
  status: 'PASS',
  source_candidate_id: fixture.candidate_id,
  entries: paradigm.entries.length,
  generation_recognition_pairs: generated.length,
  checks: generated.length * 3 + 9,
  note: 'Isolated source-backed operator contract; no runtime manifest, Production wiring, or rule activation.',
}));
