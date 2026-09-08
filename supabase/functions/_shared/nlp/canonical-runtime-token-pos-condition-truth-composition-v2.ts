import {
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,
  type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
  type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2,
  type CanonicalRuntimeTokenPosEqConditionTruthDispositionV2,
  type CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2,
} from "./canonical-runtime-token-pos-eq-condition-truth-semantic-capability-v2.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V2 =
  "canonical_runtime_token_pos_condition_truth_composition_v2" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V2 =
  "2" as const;

export type CanonicalRuntimeTokenPosConditionTruthCompositionEvidenceV2 = {
  conditionTruthCompositionId: string;

  status: "candidate";

  truthDisposition: CanonicalRuntimeTokenPosEqConditionTruthDispositionV2;

  booleanTruth: boolean | null;

  booleanTruthResolved: boolean;

  applicabilityEvidenceId: string;

  applicabilityState:
    CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2[
      "applicabilityState"
    ];

  exactSiteSnapshotTokenOccurrenceMatchCount: number;

  comparisonEvidenceId: string;

  comparisonState:
    CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2[
      "c2ComparisonEvidence"
    ]["comparisonState"];

  snapshotIdentityId: string;

  snapshotSha256: string;

  graphDocumentId: string;

  tokenNodeId: string;

  graphTokenOccurrenceIdentityId: string;

  expectedAuthorityId: string;

  d2aApplicabilityEvidence:
    CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2;

  truthSemanticCapability:
    CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2;

  governance: {
    exactD2aApplicabilityEvidenceRequired: true;

    exactD2b0TruthSemanticCapabilitySingletonRequired: true;

    preservedC2ComparisonEvidenceConsumedThroughD2aOnly: true;

    uniqueApplicabilityRequiredForResolvedBoolean: true;

    exactSingleOccurrenceMatchRequiredForResolvedBoolean: true;

    explicitResolvedMatchProjectsBooleanTrue: true;

    explicitResolvedNonMatchProjectsBooleanFalse: true;

    uncertaintyPreservedAsUnresolved: true;

    nonUniqueApplicabilityPreservedAsUnresolved: true;

    unresolvedBooleanRepresentedAsNull: true;

    leafConditionTruthDispositionProduced: true;

    leafConditionBooleanProjectionProduced: true;

    deterministic: true;

    frozenGrammarReadOnly: true;

    c2DirectDependency: false;

    comparisonRecomputed: false;

    posNormalizationPerformed: false;

    posWinnerSelected: false;

    runtimeSentenceContextSelected: false;

    occurrenceFilteringPerformed: false;

    occurrenceWinnerSelected: false;

    finalRuntimeOccurrenceBindingPerformed: false;

    compoundWhereTruthResolved: false;

    manifestConditionTruthResolved: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforcementPerformed: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;
  };
};

export type CanonicalRuntimeTokenPosConditionTruthCompositionResultV2 = {
  producer: typeof CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V2;

  producerVersion:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V2;

  status:
    | "ready"
    | "blocked";

  evidence?: CanonicalRuntimeTokenPosConditionTruthCompositionEvidenceV2;

  blockingReasons: string[];
};

type D2aReadyV2 =
  & CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2
  & {
    status: "ready";

    evidence: CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2;
  };

function present(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length >
      0
  );
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
      ),
  );
}

function blockedResult(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosConditionTruthCompositionResultV2 {
  return {
    producer: CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V2,

    status: "blocked",

    blockingReasons: uniqueSorted(
      reasons,
    ),
  };
}

function governanceSubset(
  governance: unknown,
  expected: Readonly<
    Record<
      string,
      unknown
    >
  >,
): boolean {
  if (
    governance ===
      null ||
    typeof governance !==
      "object" ||
    Array.isArray(
      governance,
    )
  ) {
    return false;
  }

  const actual = governance as Record<
    string,
    unknown
  >;

  return Object.entries(
    expected,
  ).every(
    (
      [key, value],
    ) =>
      actual[key] ===
        value,
  );
}

function exactD2aResult(
  result: CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
): result is D2aReadyV2 {
  if (
    result.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2 ||
    result.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2 ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    !result.evidence
  ) {
    return false;
  }

  const evidence = result.evidence;

  const c2 = evidence.c2ComparisonEvidence;

  if (
    evidence.status !==
      "candidate" ||
    !present(
      evidence.applicabilityEvidenceId,
    ) ||
    !present(
      evidence.c2ComparisonEvidenceId,
    ) ||
    !present(
      evidence.actualSnapshotIdentityId,
    ) ||
    !present(
      evidence.actualSnapshotSha256,
    ) ||
    !present(
      evidence.actualGraphDocumentId,
    ) ||
    !present(
      evidence.actualTokenNodeId,
    ) ||
    !present(
      evidence.actualGraphTokenOccurrenceIdentityId,
    ) ||
    !present(
      evidence.expectedAuthorityId,
    ) ||
    !Number.isInteger(
      evidence.siteMatchingDomainCount,
    ) ||
    evidence.siteMatchingDomainCount <
      0 ||
    !Number.isInteger(
      evidence.exactSiteSnapshotTokenOccurrenceMatchCount,
    ) ||
    evidence.exactSiteSnapshotTokenOccurrenceMatchCount <
      0 ||
    evidence.c2ComparisonEvidenceId !==
      c2.comparisonEvidenceId ||
    evidence.actualSnapshotIdentityId !==
      c2.actualSnapshotIdentityId ||
    evidence.actualSnapshotSha256 !==
      c2.actualSnapshotSha256 ||
    evidence.actualGraphDocumentId !==
      c2.actualGraphDocumentId ||
    evidence.actualTokenNodeId !==
      c2.actualTokenNodeId ||
    evidence.actualGraphTokenOccurrenceIdentityId !==
      c2.actualGraphTokenOccurrenceIdentityId ||
    evidence.expectedAuthorityId !==
      c2.expectedAuthorityId
  ) {
    return false;
  }

  const siteMatchingDomainCount = evidence.pairEvidence.filter(
    (pair) => pair.siteIdentityMatches,
  ).length;

  const exactMatchingPairs = evidence.pairEvidence.filter(
    (pair) => pair.exactSiteSnapshotTokenOccurrenceMatch,
  );

  const exactMatchingOccurrences = exactMatchingPairs.flatMap(
    (pair) => pair.matchingTokenOccurrences,
  );

  if (
    evidence.siteMatchingDomainCount !==
      siteMatchingDomainCount ||
    evidence.exactSiteSnapshotTokenOccurrenceMatchCount !==
      exactMatchingOccurrences.length ||
    evidence.matchingPairEvidenceIds.length !==
      exactMatchingPairs.length ||
    evidence.matchingOccurrenceEvidenceIds.length !==
      exactMatchingOccurrences.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index <
      exactMatchingPairs.length;
    index++
  ) {
    if (
      evidence.matchingPairEvidenceIds[index] !==
        exactMatchingPairs[index].pairEvidenceId
    ) {
      return false;
    }
  }

  for (
    let index = 0;
    index <
      exactMatchingOccurrences.length;
    index++
  ) {
    if (
      evidence.matchingOccurrenceEvidenceIds[index] !==
        exactMatchingOccurrences[index].occurrenceMatchEvidenceId
    ) {
      return false;
    }
  }

  return governanceSubset(
    evidence.governance,
    {
      exactC2ComparisonEvidenceRequired: true,

      exactSnapshotBoundDomainResultRequired: true,

      exactSharedSiteTupleRequired: true,

      exactSnapshotIdentityEqualityRequired: true,

      exactTokenNodeIdentityJoinRequired: true,

      applicabilityEvidenceStateProduced: true,

      applicabilityEvidenceStateIsBooleanTruth: false,

      runtimeSiteApplicabilityResolved: false,

      currentRuntimeSentenceContextSelected: false,

      occurrenceFilteringPerformed: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      posComparisonExecuted: false,

      comparisonTruthResolved: false,

      booleanTruthProduced: false,

      runtimeConditionTruthResolved: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,

      frozenGrammarReadOnly: true,
    },
  );
}

function exactTruthSemanticCapability(
  capability: CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2,
): boolean {
  if (
    capability !==
      CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2 ||
    capability.status !==
      "proven" ||
    capability.semanticDomain !==
      "canonical_runtime_token_pos_normalized_eq_leaf_condition_truth" ||
    capability.applicabilityEligibility.requiredApplicabilityState !==
      "unique_site_snapshot_token_occurrence_match" ||
    capability.applicabilityEligibility
        .requiredExactSiteSnapshotTokenOccurrenceMatchCount !==
      1 ||
    capability.comparisonEvidenceDispositionMapping.explicit_resolved_match !==
      "resolved_true" ||
    capability.comparisonEvidenceDispositionMapping
        .explicit_resolved_non_match !==
      "resolved_false" ||
    capability.comparisonEvidenceDispositionMapping.no_pos_fact !==
      "unresolved" ||
    capability.comparisonEvidenceDispositionMapping.blocked_hypothesis_set !==
      "unresolved" ||
    capability.comparisonEvidenceDispositionMapping.open_match_possible !==
      "unresolved" ||
    capability.comparisonEvidenceDispositionMapping.open_no_surviving_match !==
      "unresolved" ||
    capability.comparisonEvidenceDispositionMapping.explicit_resolved_mixed !==
      "unresolved" ||
    capability.booleanEligibilityByDisposition.resolved_true !==
      true ||
    capability.booleanEligibilityByDisposition.resolved_false !==
      true ||
    capability.booleanEligibilityByDisposition.unresolved !==
      false ||
    capability.futureBooleanProjectionAuthorization
        .resolvedTrueMayProjectToBooleanTrue !==
      true ||
    capability.futureBooleanProjectionAuthorization
        .resolvedFalseMayProjectToBooleanFalse !==
      true ||
    capability.futureBooleanProjectionAuthorization
        .unresolvedMayProjectToBoolean !==
      false ||
    capability.futureBooleanProjectionAuthorization
        .executionMustOccurInSeparateComposer !==
      true
  ) {
    return false;
  }

  return governanceSubset(
    capability.governance,
    {
      exactTokenPosNormalizedEqSemanticDomainRequired: true,

      sourceNormalizedEqSemanticCapabilityExactSingletonRequired: true,

      uniqueApplicabilityRequiredForBooleanEligibility: true,

      exactSingleOccurrenceMatchRequiredForBooleanEligibility: true,

      explicitResolvedMatchMapsToResolvedTrue: true,

      explicitResolvedNonMatchMapsToResolvedFalse: true,

      allOtherComparisonStatesRemainUnresolved: true,

      nonUniqueApplicabilityAlwaysRemainsUnresolved: true,

      unresolvedNeverCollapsedToFalse: true,

      futureBooleanProjectionAuthorizationSpecified: true,

      semanticSpecificationOnly: true,

      frozenGrammarReadOnly: true,

      d2aResultConsumed: false,

      comparisonEvidenceConsumed: false,

      booleanTruthExecuted: false,

      runtimeConditionEvaluated: false,

      runtimeSentenceContextSelected: false,

      occurrenceFilteringPerformed: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      posNormalizationPerformed: false,

      posComparisonPerformed: false,

      comparisonTruthResolved: false,

      compoundTruthComposed: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,
    },
  );
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    "%",
    "_",
  );
}

function conditionTruthCompositionId(
  applicabilityEvidenceId: string,
  capabilityId: string,
): string {
  return [
    "canonical-runtime-token-pos-condition-truth-composition-v2",
    idPart(
      applicabilityEvidenceId,
    ),
    idPart(
      capabilityId,
    ),
  ].join(
    ":",
  );
}

function truthProjection(
  disposition: CanonicalRuntimeTokenPosEqConditionTruthDispositionV2,
): {
  booleanTruth: boolean | null;

  booleanTruthResolved: boolean;
} {
  switch (
    disposition
  ) {
    case "resolved_true":
      return {
        booleanTruth: true,

        booleanTruthResolved: true,
      };

    case "resolved_false":
      return {
        booleanTruth: false,

        booleanTruthResolved: true,
      };

    case "unresolved":
      return {
        booleanTruth: null,

        booleanTruthResolved: false,
      };
  }
}

export function deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2(
  d2aResult:
    CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
  truthSemanticCapability:
    CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2,
): CanonicalRuntimeTokenPosConditionTruthCompositionResultV2 {
  if (
    !exactD2aResult(
      d2aResult,
    )
  ) {
    return blockedResult([
      "d2a_applicability_evidence:not_exact_ready",
    ]);
  }

  if (
    !exactTruthSemanticCapability(
      truthSemanticCapability,
    )
  ) {
    return blockedResult([
      "truth_semantic_capability:not_exact_singleton",
    ]);
  }

  const d2a = d2aResult.evidence;

  const c2 = d2a.c2ComparisonEvidence;

  const eligibility = truthSemanticCapability.applicabilityEligibility;

  const applicabilityEligible = d2a.applicabilityState ===
      eligibility.requiredApplicabilityState &&
    d2a.exactSiteSnapshotTokenOccurrenceMatchCount ===
      eligibility.requiredExactSiteSnapshotTokenOccurrenceMatchCount;

  const truthDisposition:
    CanonicalRuntimeTokenPosEqConditionTruthDispositionV2 =
      applicabilityEligible
        ? truthSemanticCapability
          .comparisonEvidenceDispositionMapping[
            c2.comparisonState
          ]
        : "unresolved";

  const projection = truthProjection(
    truthDisposition,
  );

  const compositionId = conditionTruthCompositionId(
    d2a.applicabilityEvidenceId,
    truthSemanticCapability.capabilityId,
  );

  return {
    producer: CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V2,

    status: "ready",

    evidence: {
      conditionTruthCompositionId: compositionId,

      status: "candidate",

      truthDisposition,

      booleanTruth: projection.booleanTruth,

      booleanTruthResolved: projection.booleanTruthResolved,

      applicabilityEvidenceId: d2a.applicabilityEvidenceId,

      applicabilityState: d2a.applicabilityState,

      exactSiteSnapshotTokenOccurrenceMatchCount:
        d2a.exactSiteSnapshotTokenOccurrenceMatchCount,

      comparisonEvidenceId: c2.comparisonEvidenceId,

      comparisonState: c2.comparisonState,

      snapshotIdentityId: d2a.actualSnapshotIdentityId,

      snapshotSha256: d2a.actualSnapshotSha256,

      graphDocumentId: d2a.actualGraphDocumentId,

      tokenNodeId: d2a.actualTokenNodeId,

      graphTokenOccurrenceIdentityId: d2a.actualGraphTokenOccurrenceIdentityId,

      expectedAuthorityId: d2a.expectedAuthorityId,

      d2aApplicabilityEvidence: d2a,

      truthSemanticCapability,

      governance: {
        exactD2aApplicabilityEvidenceRequired: true,

        exactD2b0TruthSemanticCapabilitySingletonRequired: true,

        preservedC2ComparisonEvidenceConsumedThroughD2aOnly: true,

        uniqueApplicabilityRequiredForResolvedBoolean: true,

        exactSingleOccurrenceMatchRequiredForResolvedBoolean: true,

        explicitResolvedMatchProjectsBooleanTrue: true,

        explicitResolvedNonMatchProjectsBooleanFalse: true,

        uncertaintyPreservedAsUnresolved: true,

        nonUniqueApplicabilityPreservedAsUnresolved: true,

        unresolvedBooleanRepresentedAsNull: true,

        leafConditionTruthDispositionProduced: true,

        leafConditionBooleanProjectionProduced: true,

        deterministic: true,

        frozenGrammarReadOnly: true,

        c2DirectDependency: false,

        comparisonRecomputed: false,

        posNormalizationPerformed: false,

        posWinnerSelected: false,

        runtimeSentenceContextSelected: false,

        occurrenceFilteringPerformed: false,

        occurrenceWinnerSelected: false,

        finalRuntimeOccurrenceBindingPerformed: false,

        compoundWhereTruthResolved: false,

        manifestConditionTruthResolved: false,

        cardinalitySemanticsResolved: false,

        cardinalityEnforcementPerformed: false,

        graphMutationPerformed: false,

        learnerErrorClassified: false,
      },
    },

    blockingReasons: [],
  };
}
