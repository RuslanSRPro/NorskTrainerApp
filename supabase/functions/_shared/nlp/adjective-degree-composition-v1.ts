import {
  produceElEnErComparativeEligibilityV1,
  type AdjectiveDegreeInputV1,
} from "./adjective-degree-eligibility-v1.ts";

export const postDeletionConsonantRuleV1 = {
  ruleCode: "nrg_rt_v1.adjective.degree.suffix.post_deletion_consonant_simplification",
  sourceCandidateId: "80715a38-b21e-44a8-a68c-a5514da57c04",
  sourceSection: "5.1.2.1.1",
} as const;

export type AdjectiveComparativeCompositionV1 = {
  status: "derived_candidate" | "pending" | "not_applicable";
  reason: string;
  lexemeId: string;
  candidate?: string;
  intermediate?: string;
  appliedRuleCodes: string[];
  sourceCandidateIds: string[];
  evidenceIds: string[];
  exceptionCheckRequired: boolean;
};

// Ordered rule composition. Neither this function nor its input contains the
// observed comparative form; exceptions remain open after derivation.
export function composeElEnErComparativeV1(input: AdjectiveDegreeInputV1): AdjectiveComparativeCompositionV1 {
  const first = produceElEnErComparativeEligibilityV1(input);
  const base = {
    lexemeId: first.lexemeId,
    evidenceIds: first.evidenceIds,
    exceptionCheckRequired: first.exceptionCheckRequired,
    appliedRuleCodes: [] as string[],
    sourceCandidateIds: [] as string[],
  };
  if (first.status === "not_applicable") {
    return { ...base, status: "not_applicable", reason: first.reason };
  }
  if (first.status === "missing_stress_evidence") {
    return { ...base, status: "pending", reason: first.reason };
  }
  const oneRule = {
    ...base,
    appliedRuleCodes: [first.ruleCode],
    sourceCandidateIds: [first.ruleSourceCandidateId],
  };
  if (first.status === "candidate" && first.expectedComparativeCandidate) {
    return { ...oneRule, status: "derived_candidate", reason: "one_rule_derived_exception_open",
      candidate: first.expectedComparativeCandidate };
  }
  const intermediate = first.intermediateComparativeCandidate;
  if (first.status !== "needs_post_transform" || !intermediate ||
      first.requiredAdjustmentRuleCode !== postDeletionConsonantRuleV1.ruleCode) {
    return { ...oneRule, status: "pending", reason: "unrecognized_post_transform" };
  }
  // This exact structural condition was identified by the first rule: a
  // doubled consonant immediately before the consonant exposed by e-deletion.
  const doubledBeforeConsonant = /([bcdfghjklmnpqrstvwxz])\1(?=[lnr]ere$)/u;
  if (!doubledBeforeConsonant.test(intermediate)) {
    return { ...oneRule, status: "pending", reason: "post_transform_pattern_not_found", intermediate };
  }
  return {
    ...oneRule,
    status: "derived_candidate",
    reason: "two_rules_derived_exception_open",
    intermediate,
    candidate: intermediate.replace(doubledBeforeConsonant, "$1"),
    appliedRuleCodes: [...oneRule.appliedRuleCodes, postDeletionConsonantRuleV1.ruleCode],
    sourceCandidateIds: [...oneRule.sourceCandidateIds, postDeletionConsonantRuleV1.sourceCandidateId],
  };
}
