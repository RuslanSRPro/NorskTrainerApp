import type { PositiveDisplayRowV1 } from "./adjective-degree-display-row-adapter-v1.ts";
import type { AdjectiveComparativeCompositionV1 } from "./adjective-degree-composition-v1.ts";

export const adjectiveDegreeRuleFirstShadowManifestV1 = {
  code: "shadow.adjective.degree.apen.en_deletion.v1",
  executionFamily: "rule_first_adjective_degree",
  executionMode: "shadow_only",
  lexemeId: "81a6cba3-26d1-4bf1-9cb3-41997911dd50",
  articleId: 1033,
  snapshotId: "965f0a1a-9f22-446a-b36c-f573c9a002d8",
  ruleCode: "nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.comparative",
  ruleSourceCandidateId: "8cd6ed7e-c27d-4283-bcf1-58af141f387c",
  exceptionDecisionId: "r109-apen-suffix-rule-article-1033",
  targetFormInput: false,
  activationAuthority: false,
} as const;

export type ShadowManifestAdmissionV1 = {
  status: "admitted" | "withheld";
  reason: string;
  manifestCode: string;
};

export function assessAdjectiveDegreeShadowManifestV1(
  row: PositiveDisplayRowV1 | null,
  composition: AdjectiveComparativeCompositionV1 | undefined,
  classDecision: { class: string; exceptionCheckRequired: boolean; decisionIds: string[]; sourceEvidenceIds: string[] } | null,
): ShadowManifestAdmissionV1 {
  const m = adjectiveDegreeRuleFirstShadowManifestV1;
  const withheld = (reason: string): ShadowManifestAdmissionV1 =>
    ({ status: "withheld", reason, manifestCode: m.code });
  if (!row || row.lexeme_id !== m.lexemeId || row.lemma !== "åpen" || row.pos !== "adjective" ||
      row.dictionary_code !== "bm" || row.article_id !== m.articleId ||
      row.snapshot_id !== m.snapshotId || row.form_key !== "positive_singular_indefinite_common") {
    return withheld("exact_source_identity_mismatch");
  }
  if (!composition || composition.status !== "derived_candidate" || !composition.candidate ||
      composition.appliedRuleCodes.length !== 1 || composition.appliedRuleCodes[0] !== m.ruleCode ||
      composition.sourceCandidateIds.length !== 1 || composition.sourceCandidateIds[0] !== m.ruleSourceCandidateId ||
      !composition.evidenceIds.includes(`ordbokene:official-form:${m.snapshotId}:${m.articleId}`) ||
      !composition.evidenceIds.some((id) => id.startsWith(`naob:pronunciation:${m.lexemeId}:`))) {
    return withheld("rule_or_producer_evidence_mismatch");
  }
  if (!classDecision || classDecision.class !== "regular_confirmed" ||
      classDecision.exceptionCheckRequired || classDecision.decisionIds.length !== 1 ||
      classDecision.decisionIds[0] !== m.exceptionDecisionId ||
      !classDecision.sourceEvidenceIds.includes("ndla:adjective-degree:section-3:apen-class-member:2026-04-23") ||
      !classDecision.sourceEvidenceIds.includes(`ordbokene:bm:article:${m.articleId}:lemma-pos-identity`)) {
    return withheld("lexeme_class_evidence_missing");
  }
  return { status: "admitted", reason: "exact_rule_first_shadow_manifest_satisfied", manifestCode: m.code };
}
