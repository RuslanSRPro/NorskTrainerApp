import { produceAdjectiveEndingStressV1 } from "../../supabase/functions/_shared/nlp/adjective-stress-evidence-v1.ts";
import { produceElEnErComparativeEligibilityV1 } from "../../supabase/functions/_shared/nlp/adjective-degree-eligibility-v1.ts";

let checks = 0;
function check(value: boolean, label: string) { checks++; if (!value) throw new Error(label); }
const fixture = JSON.parse(await Deno.readTextFile("grammar-evidence/artifacts/R103-naob-adjective-stress-fixture.json"));
for (const item of fixture.items) {
  const endingStress = produceAdjectiveEndingStressV1(item.stressSource);
  check(endingStress?.value === "unstressed", `${item.lemma}: source proves unstressed ending`);
  const result = produceElEnErComparativeEligibilityV1({
    lexemeId: item.lexemeId, pos: "adjective", positiveCommon: item.lemma,
    positiveSourceId: "ordbokene:official-form", articleIds: item.ordbokeneArticleIds,
    endingStress,
  });
  check(result.status === item.expectedStatus, `${item.lemma}: rule-first eligibility`);
  check(result.evidenceIds.includes(endingStress!.evidenceId), `${item.lemma}: source provenance retained`);
  check(produceAdjectiveEndingStressV1({ ...item.stressSource, pronunciation: "[fake]" }) === undefined,
    `${item.lemma}: altered notation rejected`);
  check(produceAdjectiveEndingStressV1({ ...item.stressSource, lexemeId: "wrong" }) === undefined,
    `${item.lemma}: wrong lexeme rejected`);
  check(produceAdjectiveEndingStressV1({ ...item.stressSource, pos: "noun" }) === undefined,
    `${item.lemma}: wrong POS rejected`);
}
check(produceAdjectiveEndingStressV1({ lexemeId: "c43135c2-3b8c-49a7-b2d3-194a5e28666e",
  lemma: "enkel", pos: "adjective", sourceUrl: "https://naob.no/ordbok/enkel_1",
  pronunciation: "[e´ŋk(ə)l]" }) === undefined, "ambiguous NAOB homograph not admitted");
console.log(JSON.stringify({ status: "PASS", checks, scope: "curated_offline_source_attestations" }));
