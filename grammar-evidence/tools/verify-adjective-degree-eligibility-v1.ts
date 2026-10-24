import { produceElEnErComparativeEligibilityV1 } from "../../supabase/functions/_shared/nlp/adjective-degree-eligibility-v1.ts";

let checks = 0;
function check(value: boolean, name: string) {
  checks++;
  if (!value) throw new Error(name);
}
const source = { lexemeId: "lexeme:enkel", pos: "adjective", positiveCommon: "enkel",
  positiveSourceId: "ordbokene:article:1:positive", articleIds: ["1"], canonicalTokenId: "tok:0:0:1" };
const pending = produceElEnErComparativeEligibilityV1(source);
check(pending.status === "missing_stress_evidence", "missing stress must fail closed");
check(pending.expectedComparativeCandidate === undefined, "no derivation before stress evidence");
check(pending.matchedEnding === "el", "orthographic ending identified");

const eligible = produceElEnErComparativeEligibilityV1({ ...source,
  endingStress: { value: "unstressed", evidenceId: "prosody:verified:1" } });
check(eligible.status === "candidate", "independently supplied stress creates candidate only");
check(eligible.expectedComparativeCandidate === "enklere", "rule derives from positive form");
check(eligible.exceptionCheckRequired, "default rule retains exception gate");
check(eligible.lexemeId === source.lexemeId && eligible.canonicalTokenId === source.canonicalTokenId, "identity preserved");
check(eligible.evidenceIds.includes("prosody:verified:1"), "stress provenance preserved");

for (const [positiveCommon, expectedComparativeCandidate] of [["åpen", "åpnere"], ["enkel", "enklere"]]) {
  const result = produceElEnErComparativeEligibilityV1({ ...source, positiveCommon,
    endingStress: { value: "unstressed", evidenceId: "prosody:verified:1" } });
  check(result.expectedComparativeCandidate === expectedComparativeCandidate, `derive ${positiveCommon}`);
}
const composed = produceElEnErComparativeEligibilityV1({ ...source, positiveCommon: "sikker",
  endingStress: { value: "unstressed", evidenceId: "prosody:verified:1" } });
check(composed.status === "needs_post_transform", "double consonant requires a second rule");
check(composed.intermediateComparativeCandidate === "sikkrere", "intermediate form recorded");
check(composed.expectedComparativeCandidate === undefined, "intermediate is not final answer");
check(produceElEnErComparativeEligibilityV1({ ...source, pos: "noun",
  endingStress: { value: "unstressed", evidenceId: "prosody:verified:1" } }).status === "not_applicable", "wrong POS");
check(produceElEnErComparativeEligibilityV1({ ...source, positiveCommon: "bra",
  endingStress: { value: "unstressed", evidenceId: "prosody:verified:1" } }).status === "not_applicable", "wrong ending");
check(produceElEnErComparativeEligibilityV1({ ...source,
  endingStress: { value: "stressed", evidenceId: "prosody:verified:1" } }).status === "not_applicable", "stressed ending");
check(produceElEnErComparativeEligibilityV1({ ...source, articleIds: [],
  endingStress: { value: "unstressed", evidenceId: "prosody:verified:1" } }).status === "not_applicable", "missing article provenance");

const withWrongTarget = { ...source, comparativeSourceTarget: "wrong",
  endingStress: { value: "unstressed" as const, evidenceId: "prosody:verified:1" } };
const withRightTarget = { ...withWrongTarget, comparativeSourceTarget: "enklere" };
check(JSON.stringify(produceElEnErComparativeEligibilityV1(withWrongTarget)) ===
  JSON.stringify(produceElEnErComparativeEligibilityV1(withRightTarget)), "stored target cannot select rule or derivation");

const fixture = JSON.parse(await Deno.readTextFile("grammar-evidence/artifacts/R102-adjective-el-en-er-source-fixture.json"));
for (const item of fixture.items) {
  const { observedComparative: _withheldTarget, ...producerInput } = item;
  const result = produceElEnErComparativeEligibilityV1(producerInput);
  check(result.status === "missing_stress_evidence", `actual source lacks stress evidence: ${item.positiveCommon}`);
  check(result.expectedComparativeCandidate === undefined, `actual source cannot resolve rule: ${item.positiveCommon}`);
}

console.log(JSON.stringify({ status: "PASS", checks, scope: "isolated_candidate_producer", productionStressEvidence: "not_proved" }));
