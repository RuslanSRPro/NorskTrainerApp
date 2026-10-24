import { deriveComparativeFromPositiveDisplayRowV1 } from "../../supabase/functions/_shared/nlp/adjective-degree-display-row-adapter-v1.ts";

let checks = 0;
function check(value: boolean, name: string) { checks++; if (!value) throw new Error(name); }
const fixture = JSON.parse(await Deno.readTextFile("grammar-evidence/artifacts/R105-adjective-positive-display-rows.json"));
const expected = new Map([["åpen", "åpnere"], ["sikker", "sikrere"]]);
for (const row of fixture.rows) {
  const result = deriveComparativeFromPositiveDisplayRowV1(row);
  check(result.status === "derived_candidate", `${row.lemma}: positive source row accepted`);
  check(result.composition?.candidate === expected.get(row.lemma), `${row.lemma}: rule-first derivation`);
  check(result.composition?.exceptionCheckRequired === true, `${row.lemma}: exceptions remain open`);
  check(result.sourceSnapshotId === row.snapshot_id && result.sourceArticleId === String(row.article_id),
    `${row.lemma}: source identity preserved`);
  check(deriveComparativeFromPositiveDisplayRowV1({ ...row, form_key: "comparative" }).status === "not_applicable",
    `${row.lemma}: comparative row cannot be an input`);
  check(deriveComparativeFromPositiveDisplayRowV1({ ...row, article_id: 999 }).status === "not_applicable",
    `${row.lemma}: wrong article blocked`);
  check(deriveComparativeFromPositiveDisplayRowV1({ ...row, article_ids: [row.article_id] }).status === "derived_candidate",
    `${row.lemma}: PostgREST numeric article ID accepted when identity matches`);
  check(deriveComparativeFromPositiveDisplayRowV1({ ...row, primary_values: [row.lemma, "alternative"] }).status === "not_applicable",
    `${row.lemma}: multiple positive forms require separate handling`);
  check(deriveComparativeFromPositiveDisplayRowV1({ ...row, evidence_ids: [] }).status === "not_applicable",
    `${row.lemma}: missing source evidence blocked`);
}
console.log(JSON.stringify({ status: "PASS", checks, scope: "positive_display_row_to_rule_first_candidate" }));
