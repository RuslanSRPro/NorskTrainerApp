import { deriveComparativeFromPositiveDisplayRowV1 } from "../../supabase/functions/_shared/nlp/adjective-degree-display-row-adapter-v1.ts";
import { evaluateCuratedAdjectiveClassV1 } from "../../supabase/functions/_shared/nlp/adjective-degree-curated-class-v1.ts";
import { assessAdjectiveDegreeShadowManifestV1, adjectiveDegreeRuleFirstShadowManifestV1 } from "../../supabase/functions/_shared/nlp/adjective-degree-rule-first-shadow-manifest-v1.ts";

const fixture = JSON.parse(await Deno.readTextFile("grammar-evidence/artifacts/R105-adjective-positive-display-rows.json"));
const row = fixture.rows.find((item: { lemma: string }) => item.lemma === "åpen");
if (!row) throw new Error("missing åpen positive row");
const derivation = deriveComparativeFromPositiveDisplayRowV1(row);
const composition = derivation.composition;
if (!composition) throw new Error("missing composition");
const decision = evaluateCuratedAdjectiveClassV1({
  lexeme_id: row.lexeme_id, lemma: row.lemma, pos: row.pos,
  dictionary_code: row.dictionary_code, article_id: row.article_id,
  snapshot_id: row.snapshot_id, rule_source_candidate_id: composition.sourceCandidateIds[0],
});
let checks = 0;
function check(value: boolean, label: string) { if (!value) throw new Error(label); checks++; }
const assess = (testRow = row, testComposition = composition, testDecision = decision) =>
  assessAdjectiveDegreeShadowManifestV1(testRow, testComposition, testDecision);

check(adjectiveDegreeRuleFirstShadowManifestV1.executionMode === "shadow_only", "closed scope");
check(adjectiveDegreeRuleFirstShadowManifestV1.activationAuthority === false, "no activation authority");
check(adjectiveDegreeRuleFirstShadowManifestV1.targetFormInput === false, "no stored target input");
check(assess().status === "admitted", "exact rule-first evidence admitted to shadow");
check(assess({ ...row, article_id: 1034 }).status === "withheld", "wrong article withheld");
check(assess({ ...row, snapshot_id: "other" }).status === "withheld", "changed snapshot withheld");
check(assess({ ...row, lexeme_id: "other" }).status === "withheld", "other lexeme withheld");
check(assess(row, { ...composition, appliedRuleCodes: ["other"] }).status === "withheld", "other rule withheld");
check(assess(row, { ...composition, sourceCandidateIds: ["other"] }).status === "withheld", "other source candidate withheld");
check(assess(row, { ...composition, evidenceIds: [] }).status === "withheld", "missing producer evidence withheld");
check(assess(row, composition, { ...decision, class: "unknown", exceptionCheckRequired: true }).status === "withheld", "unresolved class withheld");
check(assess(row, composition, { ...decision, sourceEvidenceIds: [] }).status === "withheld", "missing class source withheld");
check(assess(row, composition, { ...decision, decisionIds: ["other"] }).status === "withheld", "wrong decision withheld");
check(assess(null, composition, decision).status === "withheld", "missing row withheld");
console.log(JSON.stringify({ status: "PASS", checks, scope: "one_rule_first_shadow_manifest", activationAuthority: false }));
