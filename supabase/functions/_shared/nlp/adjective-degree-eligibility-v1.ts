// Candidate-only eligibility for NRG section 5.1.2.1.1.
// The observed comparative form is intentionally absent from this input.
export const elEnErComparativeRuleV1 = {
  ruleCode: "nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.comparative",
  sourceCandidateId: "8cd6ed7e-c27d-4283-bcf1-58af141f387c",
  sourceSection: "5.1.2.1.1",
  endings: ["el", "en", "er"] as const,
  constraintStrength: "default_with_lexical_exceptions",
} as const;

export type AdjectiveDegreeInputV1 = {
  lexemeId: string;
  pos: string;
  positiveCommon: string;
  positiveSourceId: string;
  articleIds: readonly string[];
  canonicalTokenId?: string;
  endingStress?: {
    value: "unstressed" | "stressed";
    evidenceId: string;
  };
};

export type AdjectiveDegreeEligibilityV1 = {
  status: "not_applicable" | "missing_stress_evidence" | "needs_post_transform" | "candidate";
  reason: string;
  ruleCode: string;
  ruleSourceCandidateId: string;
  lexemeId: string;
  canonicalTokenId?: string;
  matchedEnding?: "el" | "en" | "er";
  expectedComparativeCandidate?: string;
  intermediateComparativeCandidate?: string;
  requiredAdjustmentRuleCode?: string;
  exceptionCheckRequired: boolean;
  evidenceIds: string[];
};

export function produceElEnErComparativeEligibilityV1(input: AdjectiveDegreeInputV1): AdjectiveDegreeEligibilityV1 {
  const base = {
    ruleCode: elEnErComparativeRuleV1.ruleCode,
    ruleSourceCandidateId: elEnErComparativeRuleV1.sourceCandidateId,
    lexemeId: input.lexemeId,
    canonicalTokenId: input.canonicalTokenId,
    exceptionCheckRequired: true,
    evidenceIds: [input.positiveSourceId],
  };
  if (!input.lexemeId || !input.positiveSourceId || !input.articleIds.length || input.pos !== "adjective") {
    return { ...base, status: "not_applicable", reason: "adjective_identity_or_source_missing" };
  }
  const source = input.positiveCommon.toLocaleLowerCase("nb-NO");
  const ending = elEnErComparativeRuleV1.endings.find((candidate) => source.endsWith(candidate));
  if (!ending) return { ...base, status: "not_applicable", reason: "source_ending_not_el_en_er" };
  if (!input.endingStress?.evidenceId) {
    return { ...base, status: "missing_stress_evidence", reason: "unstressed_ending_not_proved", matchedEnding: ending };
  }
  if (input.endingStress.value !== "unstressed") {
    return { ...base, status: "not_applicable", reason: "ending_is_stressed", matchedEnding: ending,
      evidenceIds: [...base.evidenceIds, input.endingStress.evidenceId] };
  }
  // Derive from the positive form and rule. No comparative source form is read.
  const expected = source.slice(0, -2) + ending.slice(-1) + "ere";
  // Only a doubled consonant directly at the deletion boundary qualifies.
  // An unrelated doubled consonant elsewhere in the adjective does not.
  if (/([bcdfghjklmnpqrstvwxz])\1(?=[lnr]ere$)/u.test(expected)) {
    return { ...base, status: "needs_post_transform", reason: "double_consonant_before_new_consonant",
      matchedEnding: ending, intermediateComparativeCandidate: expected,
      requiredAdjustmentRuleCode: "nrg_rt_v1.adjective.degree.suffix.post_deletion_consonant_simplification",
      evidenceIds: [...base.evidenceIds, input.endingStress.evidenceId] };
  }
  return { ...base, status: "candidate", reason: "orthographic_and_stress_conditions_met_exception_open",
    matchedEnding: ending, expectedComparativeCandidate: expected,
    evidenceIds: [...base.evidenceIds, input.endingStress.evidenceId] };
}
