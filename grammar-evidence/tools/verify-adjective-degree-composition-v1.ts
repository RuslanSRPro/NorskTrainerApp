import { produceAdjectiveEndingStressV1 } from "../../supabase/functions/_shared/nlp/adjective-stress-evidence-v1.ts";
import { composeElEnErComparativeV1, postDeletionConsonantRuleV1 } from "../../supabase/functions/_shared/nlp/adjective-degree-composition-v1.ts";

let checks = 0;
function check(value: boolean, name: string) { checks++; if (!value) throw new Error(name); }
const stressFixture = JSON.parse(await Deno.readTextFile("grammar-evidence/artifacts/R103-naob-adjective-stress-fixture.json"));
const sourceFixture = JSON.parse(await Deno.readTextFile("grammar-evidence/artifacts/R102-adjective-el-en-er-source-fixture.json"));
for (const item of stressFixture.items) {
  const source = sourceFixture.items.find((candidate: { lexemeId: string }) => candidate.lexemeId === item.lexemeId);
  check(Boolean(source), `${item.lemma}: positive source fixture exists`);
  const endingStress = produceAdjectiveEndingStressV1(item.stressSource);
  check(Boolean(endingStress), `${item.lemma}: independent stress evidence exists`);
  const { observedComparative: _withheldTarget, ...sourceInput } = source;
  const result = composeElEnErComparativeV1({ ...sourceInput, endingStress });
  check(result.status === "derived_candidate", `${item.lemma}: derivation completed`);
  check(result.exceptionCheckRequired, `${item.lemma}: lexical exceptions remain open`);
  check(result.evidenceIds.includes(endingStress!.evidenceId), `${item.lemma}: stress provenance preserved`);
  check(result.candidate === source.observedComparative, `${item.lemma}: independent post-derivation comparison`);
  check(result.appliedRuleCodes.length === (item.lemma === "sikker" ? 2 : 1),
    `${item.lemma}: correct number of rule steps`);
  if (item.lemma === "sikker") {
    check(result.intermediate === "sikkrere", "sikker: intermediate preserved");
    check(result.sourceCandidateIds.includes(postDeletionConsonantRuleV1.sourceCandidateId),
      "sikker: second source rule recorded");
  }
  const wrongTarget = composeElEnErComparativeV1({ ...sourceInput, endingStress, observedComparative: "WRONG" });
  check(JSON.stringify(wrongTarget) === JSON.stringify(result), `${item.lemma}: observed target cannot affect derivation`);
  const missingStress = composeElEnErComparativeV1(sourceInput);
  check(missingStress.status === "pending" && missingStress.candidate === undefined,
    `${item.lemma}: missing stress fails closed`);
}
const unrelatedDouble = composeElEnErComparativeV1({
  lexemeId: "negative:unrelated-double", pos: "adjective", positiveCommon: "akkarel",
  positiveSourceId: "synthetic:positive", articleIds: ["synthetic"],
  endingStress: { value: "unstressed", evidenceId: "synthetic:stress" },
});
check(unrelatedDouble.appliedRuleCodes.length === 1,
  "doubled consonant outside deletion boundary must not trigger adjustment");
check(unrelatedDouble.candidate === "akkarlere", "unrelated doubled consonant retained");
console.log(JSON.stringify({ status: "PASS", checks, scope: "isolated_two_rule_composition" }));
