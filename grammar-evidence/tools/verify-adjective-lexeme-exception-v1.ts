import { evaluateLexemeExceptionV1, type LexemeExceptionAttestationV1 } from "../../supabase/functions/_shared/nlp/adjective-degree-lexeme-exception-v1.ts";

const record = JSON.parse(await Deno.readTextFile(new URL("../artifacts/R109-apen-exception-class-evidence.json", import.meta.url)));
const fields = ["lexeme_id", "lemma", "pos", "dictionary_code", "article_id", "snapshot_id", "rule_source_candidate_id"] as const;
const identity = Object.fromEntries(fields.map((key) => [key, record[key]])) as Pick<LexemeExceptionAttestationV1, typeof fields[number]>;
const attestation: LexemeExceptionAttestationV1 = {
  ...identity, decision_id: record.decision_id, decision: record.decision,
  source_revision: record.source_revision, source_evidence_ids: record.source_evidence_ids,
};
let checks = 0;
function check(ok: boolean, label: string) {
  if (!ok) throw new Error(label);
  checks++;
}
const decide = (items: LexemeExceptionAttestationV1[], input = identity, revision = record.source_revision) =>
  evaluateLexemeExceptionV1(input, items, revision);

check(record.classifier_input_excludes.includes("stored target"), "target exclusion documented");
check(!Object.keys(attestation).some((key) => /comparative|superlative|^candidate$|observed_candidate/i.test(key)), "no target field passed");
check(record.source_checks.grammar_class.section.includes("-er, -el og -en"), "source class section pinned");
check(record.source_checks.article_identity.url.endsWith("/bm/1033"), "official article pinned");
check(decide([attestation]).class === "regular_confirmed", "exact source class confirmed");
check(decide([attestation]).exceptionCheckRequired === false, "exception check cleared for this rule only");
check(decide([attestation], { ...identity, article_id: 1034 }).class === "unknown", "wrong article rejected");
check(decide([attestation], { ...identity, lexeme_id: "another-lexeme" }).class === "unknown", "wrong lexeme rejected");
check(decide([attestation], { ...identity, snapshot_id: "old-snapshot" }).class === "unknown", "snapshot mismatch rejected");
check(decide([attestation], identity, "other-source-revision").class === "unknown", "source drift rejected");
check(decide([{ ...attestation, source_evidence_ids: attestation.source_evidence_ids.filter((id) => !id.startsWith("ndla:")) }]).class === "unknown", "missing class source rejected");
check(decide([{ ...attestation, observedComparative: "åpnere" } as LexemeExceptionAttestationV1]).class === "unknown", "target field rejected");
check(decide([]).class === "unknown", "missing decision stays unknown");
const irregular = { ...attestation, decision_id: "synthetic-irregular", decision: "irregular_confirmed" as const,
  source_evidence_ids: [...attestation.source_evidence_ids.filter((id) => !id.startsWith("ndla:")), "independent:irregular-degree:synthetic"] };
check(decide([irregular]).class === "irregular_confirmed", "independent irregular decision blocks default");
check(decide([irregular]).exceptionCheckRequired, "irregular does not clear default");
check(decide([attestation, irregular]).class === "conflict", "incompatible class sources conflict");
check(decide([{ ...attestation, decision: "conflict" }]).class === "conflict", "explicit conflict held");
console.log(JSON.stringify({ status: "PASS", checks, scope: "exact_lexeme_exception_decision", activationAuthority: false }));
