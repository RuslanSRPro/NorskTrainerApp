import {
  generatePronounCaseFormV1,
  producePronounCaseCandidatesV1,
  pronounParadigmManifestV1,
} from "../../supabase/functions/_shared/nlp/pronoun-paradigm-operator-v1.ts";

const fixture = JSON.parse(await Deno.readTextFile("grammar-evidence/artifacts/R084-pronoun-paradigm-source-fixture.json"));
const migration = await Deno.readTextFile("supabase/migrations/20261023190000_grammar_pronoun_case_pilot_operator_v1.sql");
let checks = 0;
function check(condition: boolean, message: string) {
  checks++;
  if (!condition) throw new Error(message);
}

check(fixture.status === "source_verified", "source verification");
check(fixture.candidate_id === pronounParadigmManifestV1.sourceCandidateId, "source identity");
check(pronounParadigmManifestV1.status === "candidate_only", "producer status");
check(pronounParadigmManifestV1.exhaustive === false, "nonexhaustive forms");
check(pronounParadigmManifestV1.pairs.length === 9, "pair count");

const fixturePairs = [...fixture.statement.matchAll(/\b(jeg|du|han|hun|den|det|vi|dere|de)\/(meg|deg|ham|henne|den|det|oss|dere|dem)\b/g)]
  .map((match) => `${match[1]}/${match[2]}`);
const producerPairs = pronounParadigmManifestV1.pairs.map(([nom, acc]) => `${nom}/${acc}`);
check(JSON.stringify(fixturePairs) === JSON.stringify(producerPairs), "producer matches source statement");

const sqlPairs = [...migration.matchAll(/\('([^']+)','([^']+)','([^']+)'\)/g)]
  .filter((match) => match[1] === match[2])
  .map((match) => `${match[2]}/${match[3]}`)
  .slice(0, 9);
check(JSON.stringify(sqlPairs) === JSON.stringify(producerPairs), "SQL and TypeScript producer parity");

for (const [nom, acc] of pronounParadigmManifestV1.pairs) {
  check(generatePronounCaseFormV1(nom, "Nom") === nom, `generate Nom ${nom}`);
  check(generatePronounCaseFormV1(nom, "Acc") === acc, `generate Acc ${nom}`);
  for (const [surface, grammaticalCase] of [[nom, "Nom"], [acc, "Acc"]] as const) {
    check(producePronounCaseCandidatesV1(surface).some((r) => r.lemma === nom && r.Case === grammaticalCase &&
      r.source_candidate_id === fixture.candidate_id && r.status === "candidate" && !r.exhaustive),
      `recognize ${surface} as ${nom}/${grammaticalCase}`);
  }
}
for (const surface of ["den", "det", "dere"]) {
  check(producePronounCaseCandidatesV1(surface).length === 2, `retain case ambiguity for ${surface}`);
}
check(producePronounCaseCandidatesV1("fisken").length === 0, "unlisted form abstains");
check(generatePronounCaseFormV1("fisken", "Nom") === null, "unlisted lemma abstains");

console.log(JSON.stringify({ status: "PASS", scope: "candidate_producer_only", source_pairs: producerPairs.length,
  checked_case_surfaces: 18, ambiguous_surfaces: ["den", "det", "dere"], checks }));
