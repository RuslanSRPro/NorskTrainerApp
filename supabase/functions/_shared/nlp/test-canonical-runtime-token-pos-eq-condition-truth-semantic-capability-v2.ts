import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2,
  CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_V2,
  CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_VERSION_V2,
} from "./canonical-runtime-token-pos-eq-condition-truth-semantic-capability-v2.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function same(
  left: unknown,
  right: unknown,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const CAP =
  CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2;

Deno.test(
  "D2b0.1 exact capability identity version and proven status",
  () => {
    assert(
      CAP.capabilityId ===
          CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_V2 &&
        CAP.version ===
          CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_VERSION_V2 &&
        CAP.status ===
          "proven",
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "D2b0.2 semantic domain is restricted to normalized token pos EQ leaf-condition truth",
  () => {
    assert(
      CAP.semanticDomain ===
        "canonical_runtime_token_pos_normalized_eq_leaf_condition_truth",
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "D2b0.3 exact closed normalized-EQ semantic singleton is preserved",
  () => {
    assert(
      CAP.sourceNormalizedEqSemanticCapability ===
          CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1 &&
        CAP.sourceNormalizedEqSemanticCapabilityId ===
          CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1
            .capabilityId &&
        CAP.sourceNormalizedEqSemanticCapabilityVersion ===
          CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1
            .version,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "D2b0.4 applicability vocabulary is exact and closed",
  () => {
    const actual = [
      CAP.applicabilityEligibility.requiredApplicabilityState,
      ...CAP.applicabilityEligibility.nonEligibleApplicabilityStates,
    ];

    const expected = [
      "unique_site_snapshot_token_occurrence_match",
      "no_matching_site_domain",
      "matching_site_domain_no_token_occurrence",
      "multiple_site_snapshot_token_occurrence_matches",
    ];

    assert(
      same(
        actual,
        expected,
      ),
      JSON.stringify(actual),
    );
  },
);

Deno.test(
  "D2b0.5 unique applicability is required for boolean eligibility",
  () => {
    assert(
      CAP.applicabilityEligibility.requiredApplicabilityState ===
        "unique_site_snapshot_token_occurrence_match",
      JSON.stringify(CAP.applicabilityEligibility),
    );
  },
);

Deno.test(
  "D2b0.6 exact one site-snapshot-token occurrence match is required",
  () => {
    assert(
      CAP.applicabilityEligibility
            .requiredExactSiteSnapshotTokenOccurrenceMatchCount ===
          1 &&
        CAP.applicabilityEligibility
            .nonEligibleApplicabilityStatesForceUnresolved ===
          true,
      JSON.stringify(CAP.applicabilityEligibility),
    );
  },
);

Deno.test(
  "D2b0.7 C2 comparison-state vocabulary is exact",
  () => {
    assert(
      same(
        CAP.comparisonEvidenceStateDomain,
        [
          "no_pos_fact",
          "blocked_hypothesis_set",
          "open_match_possible",
          "open_no_surviving_match",
          "explicit_resolved_match",
          "explicit_resolved_non_match",
          "explicit_resolved_mixed",
        ],
      ),
      JSON.stringify(CAP.comparisonEvidenceStateDomain),
    );
  },
);

Deno.test(
  "D2b0.8 truth-disposition vocabulary is exact",
  () => {
    assert(
      same(
        CAP.truthDispositionDomain,
        [
          "resolved_true",
          "resolved_false",
          "unresolved",
        ],
      ),
      JSON.stringify(CAP.truthDispositionDomain),
    );
  },
);

Deno.test(
  "D2b0.9 no_pos_fact remains unresolved",
  () => {
    assert(
      CAP.comparisonEvidenceDispositionMapping.no_pos_fact ===
        "unresolved",
      JSON.stringify(CAP.comparisonEvidenceDispositionMapping),
    );
  },
);

Deno.test(
  "D2b0.10 blocked_hypothesis_set remains unresolved",
  () => {
    assert(
      CAP.comparisonEvidenceDispositionMapping.blocked_hypothesis_set ===
        "unresolved",
      JSON.stringify(CAP.comparisonEvidenceDispositionMapping),
    );
  },
);

Deno.test(
  "D2b0.11 open_match_possible remains unresolved and is not true",
  () => {
    assert(
      CAP.comparisonEvidenceDispositionMapping.open_match_possible ===
          "unresolved" &&
        CAP.unresolvedSemantics.openMatchPossibleIsTrue ===
          false,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "D2b0.12 open_no_surviving_match remains unresolved and is not false",
  () => {
    assert(
      CAP.comparisonEvidenceDispositionMapping.open_no_surviving_match ===
          "unresolved" &&
        CAP.unresolvedSemantics.openNoSurvivingMatchIsFalse ===
          false,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "D2b0.13 explicit_resolved_match maps semantically to resolved_true",
  () => {
    assert(
      CAP.comparisonEvidenceDispositionMapping.explicit_resolved_match ===
          "resolved_true" &&
        CAP.booleanEligibilityByDisposition.resolved_true ===
          true,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "D2b0.14 explicit_resolved_non_match maps semantically to resolved_false",
  () => {
    assert(
      CAP.comparisonEvidenceDispositionMapping.explicit_resolved_non_match ===
          "resolved_false" &&
        CAP.booleanEligibilityByDisposition.resolved_false ===
          true,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "D2b0.15 explicit_resolved_mixed remains unresolved and is not false",
  () => {
    assert(
      CAP.comparisonEvidenceDispositionMapping.explicit_resolved_mixed ===
          "unresolved" &&
        CAP.unresolvedSemantics.explicitResolvedMixedIsFalse ===
          false,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "D2b0.16 unresolved disposition is never boolean eligible",
  () => {
    assert(
      CAP.booleanEligibilityByDisposition.unresolved ===
          false &&
        CAP.unresolvedSemantics.unresolvedMayBeCollapsedToFalse ===
          false &&
        CAP.unresolvedSemantics.nonUniqueApplicabilityIsFalse ===
          false,
      JSON.stringify(CAP),
    );
  },
);

Deno.test(
  "D2b0.17 future boolean projection is authorization only and requires separate composer",
  () => {
    const future = CAP.futureBooleanProjectionAuthorization;

    assert(
      future.resolvedTrueMayProjectToBooleanTrue ===
          true &&
        future.resolvedFalseMayProjectToBooleanFalse ===
          true &&
        future.unresolvedMayProjectToBoolean ===
          false &&
        future.executionMustOccurInSeparateComposer ===
          true,
      JSON.stringify(future),
    );
  },
);

Deno.test(
  "D2b0.18 all critical negative uncertainty semantics stay explicit",
  () => {
    const unresolved = CAP.unresolvedSemantics;

    assert(
      unresolved.noPosFactIsFalse ===
          false &&
        unresolved.blockedHypothesisSetIsFalse ===
          false &&
        unresolved.openMatchPossibleIsTrue ===
          false &&
        unresolved.openNoSurvivingMatchIsFalse ===
          false &&
        unresolved.explicitResolvedMixedIsFalse ===
          false &&
        unresolved.nonUniqueApplicabilityIsFalse ===
          false &&
        unresolved.unresolvedMayBeCollapsedToFalse ===
          false,
      JSON.stringify(unresolved),
    );
  },
);

Deno.test(
  "D2b0.19 capability is specification-only and consumes no execution evidence",
  () => {
    const g = CAP.governance;

    assert(
      g.exactTokenPosNormalizedEqSemanticDomainRequired ===
          true &&
        g.sourceNormalizedEqSemanticCapabilityExactSingletonRequired ===
          true &&
        g.uniqueApplicabilityRequiredForBooleanEligibility ===
          true &&
        g.exactSingleOccurrenceMatchRequiredForBooleanEligibility ===
          true &&
        g.explicitResolvedMatchMapsToResolvedTrue ===
          true &&
        g.explicitResolvedNonMatchMapsToResolvedFalse ===
          true &&
        g.allOtherComparisonStatesRemainUnresolved ===
          true &&
        g.nonUniqueApplicabilityAlwaysRemainsUnresolved ===
          true &&
        g.unresolvedNeverCollapsedToFalse ===
          true &&
        g.semanticSpecificationOnly ===
          true &&
        g.familyNeutral ===
          true &&
        g.d2aResultConsumed ===
          false &&
        g.comparisonEvidenceConsumed ===
          false &&
        g.surfaceConsumed ===
          false &&
        g.graphConsumed ===
          false &&
        g.runtimeManifestConsumed ===
          false &&
        g.runtimeDomainConsumed ===
          false &&
        g.booleanTruthExecuted ===
          false &&
        g.runtimeConditionEvaluated ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "D2b0.20 authority ceiling excludes context selection occurrence execution truth cardinality mutation and learner error",
  () => {
    const g = CAP.governance;

    assert(
      g.historicalLeafRootDispositionConsumed ===
          false &&
        g.historicalDomainComparisonConsumed ===
          false &&
        g.historicalRuntimeEqAuthorityConsumed ===
          false &&
        g.applicabilitySelectionPerformed ===
          false &&
        g.runtimeSentenceContextSelected ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.expectedOperandReadPerformed ===
          false &&
        g.actualPosLabelReadPerformed ===
          false &&
        g.posNormalizationPerformed ===
          false &&
        g.posComparisonPerformed ===
          false &&
        g.comparisonTruthResolved ===
          false &&
        g.compoundTruthComposed ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.learnerErrorClassified ===
          false &&
        g.frozenGrammarReadOnly ===
          true,
      JSON.stringify(g),
    );
  },
);
