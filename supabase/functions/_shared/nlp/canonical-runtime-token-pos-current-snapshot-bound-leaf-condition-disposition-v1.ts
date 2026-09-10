import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonResultV2,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonStateV2,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceComparisonV2,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2,
} from "./canonical-runtime-token-pos-current-snapshot-bound-normalized-comparison-v2.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-leaf-condition-disposition-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionV1 =
  | "satisfied"
  | "rejected"
  | "uncertain"
  | "unavailable"
  | "blocked";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionOccurrenceDispositionV1 =
  {
    dispositionId: string;
    status: "proven_snapshot_bound_leaf_condition_disposition";

    sourceComparisonId: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;
    snapshotTokenOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;
    tokenNodeId: string;
    containmentEdgeId: string;
    sentenceTokenIndex: number;

    comparisonState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonStateV2;

    booleanTruth: boolean | null;
    booleanTruthResolved: boolean;

    disposition:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionV1;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDomainDispositionV1 =
  {
    dispositionDomainId: string;
    status: "candidate_disposition_domain";

    sourceDomainComparisonId: string;

    expectedSiteAuthorityId: string;
    domainEvidenceId: string;
    snapshotBoundDomainId: string;
    sourceDomainCandidateId: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    occurrenceDispositions:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionOccurrenceDispositionV1[];

    occurrenceCount: number;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionAuthorityV1 =
  {
    authorityId: string;
    status: "proven_current_snapshot_bound_leaf_condition_disposition";

    sourceComparisonAuthorityId: string;

    snapshotIdentityId: string;
    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    domainDispositions:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDomainDispositionV1[];

    domainDispositionCount: number;

    governance: {
      closedCurrentSnapshotBoundComparisonPublicDerivationReexecuted: true;
      suppliedCurrentSnapshotBoundComparisonAcceptedAsProof: false;
      snapshotIdentityPreserved: true;
      snapshotSentenceOccurrenceIdentityPreserved: true;
      snapshotTokenOccurrenceIdentityPreserved: true;

      comparisonTruthConsumedNotRecomputed: true;
      comparisonTruthConsistencyValidated: true;

      leafConditionDispositionProduced: true;

      noFactCollapsedToFalse: false;
      blockedCollapsedToFalse: false;
      openNoSurvivingMatchCollapsedToFalse: false;
      openMatchPossibleCollapsedToTrue: false;
      mixedResolvedLabelsCollapsedToBoolean: false;

      occurrenceFilteringPerformed: false;
      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;
      domainCandidateWinnerSelected: false;
      occurrenceWinnerSelected: false;
      occurrenceBindingPerformed: false;
      finalRuntimeOccurrenceBindingPerformed: false;
      whereEvaluationPerformed: false;
      learnerErrorClassified: false;
      constraintPropagationInvoked: false;
      canonicalDependencyEdgeGenerated: false;
      clauseNodeGenerated: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_VERSION_V1;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_VERSION_V1;

    status: "blocked";
    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionBlockedResultV1;

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

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}

function blockedResult(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_VERSION_V1,

    status: "blocked",

    blockingReasons: uniqueSorted(
      reasons,
    ),
  };
}

function expectedTruthForState(
  comparisonState:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonStateV2,
): {
  booleanTruth: boolean | null;
  booleanTruthResolved: boolean;
} {
  switch (
    comparisonState
  ) {
    case "explicit_resolved_match":
      return {
        booleanTruth: true,
        booleanTruthResolved: true,
      };

    case "explicit_resolved_non_match":
      return {
        booleanTruth: false,
        booleanTruthResolved: true,
      };

    case "no_fact":
    case "blocked":
    case "open_match_possible":
    case "open_no_surviving_match":
    case "explicit_resolved_mixed":
      return {
        booleanTruth: null,
        booleanTruthResolved: false,
      };
  }
}

function dispositionFor(
  comparisonState:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonStateV2,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionV1 {
  switch (
    comparisonState
  ) {
    case "explicit_resolved_match":
      return "satisfied";

    case "explicit_resolved_non_match":
      return "rejected";

    case "open_match_possible":
    case "open_no_surviving_match":
    case "explicit_resolved_mixed":
      return "uncertain";

    case "no_fact":
      return "unavailable";

    case "blocked":
      return "blocked";
  }
}

function exactOccurrenceTruth(
  occurrence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceComparisonV2,
): boolean {
  const expected = expectedTruthForState(
    occurrence.comparisonState,
  );

  return (
    occurrence.status ===
      "proven_snapshot_bound_comparison" &&
    occurrence.booleanTruth ===
      expected.booleanTruth &&
    occurrence.booleanTruthResolved ===
      expected.booleanTruthResolved
  );
}

function exactSourceResult(
  source:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonResultV2,
): source is Extract<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonResultV2,
  { status: "ready" }
> {
  if (
    source.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2 ||
    source.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2 ||
    source.status !==
      "ready"
  ) {
    return false;
  }

  const authority = source.authority;

  if (
    authority.status !==
      "proven_current_snapshot_bound_pos_comparison" ||
    authority.domainComparisonCount !==
      authority.domainComparisons.length ||
    authority.governance
        .exactSnapshotAuthorityIndependentlyRederived !==
      true ||
    authority.governance
        .exactSnapshotIdentityMustMatchCurrentDomain !==
      true ||
    authority.governance
        .closedCurrentBindingDomainPublicDerivationReexecuted !==
      true ||
    authority.governance
        .suppliedCurrentBindingDomainMustMatchRederivedAuthority !==
      true ||
    authority.governance
        .snapshotTokenOccurrenceIdentityPreserved !==
      true ||
    authority.governance
        .comparisonStateResolved !==
      true ||
    authority.governance
        .posComparisonExecuted !==
      true ||
    authority.governance
        .runtimeConditionTruthResolved !==
      false ||
    authority.governance
        .occurrenceFilteringPerformed !==
      false ||
    authority.governance
        .cardinalitySemanticsResolved !==
      false ||
    authority.governance
        .cardinalityEnforcementPerformed !==
      false ||
    authority.governance
        .domainCandidateWinnerSelected !==
      false ||
    authority.governance
        .occurrenceWinnerSelected !==
      false ||
    authority.governance
        .finalRuntimeOccurrenceBindingPerformed !==
      false ||
    authority.governance
        .whereEvaluationPerformed !==
      false
  ) {
    return false;
  }

  for (
    const domain of authority.domainComparisons
  ) {
    if (
      domain.status !==
        "candidate_comparison_domain" ||
      domain.snapshotIdentityId !==
        authority.snapshotIdentityId ||
      domain.graphDocumentId !==
        authority.graphDocumentId ||
      domain.sentenceNodeId !==
        authority.sentenceNodeId ||
      domain.sentenceIndex !==
        authority.sentenceIndex ||
      domain.occurrenceCount !==
        domain.occurrenceComparisons.length
    ) {
      return false;
    }

    for (
      const occurrence of domain.occurrenceComparisons
    ) {
      if (
        occurrence.snapshotIdentityId !==
          authority.snapshotIdentityId ||
        occurrence.snapshotSentenceOccurrenceIdentityId !==
          domain.snapshotSentenceOccurrenceIdentityId ||
        occurrence.graphDocumentId !==
          authority.graphDocumentId ||
        occurrence.sentenceNodeId !==
          authority.sentenceNodeId ||
        occurrence.sentenceIndex !==
          authority.sentenceIndex ||
        !exactOccurrenceTruth(
          occurrence,
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionsV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2
  >[3],
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionResultV1
> {
  const source =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
    );

  if (
    !exactSourceResult(
      source,
    )
  ) {
    return blockedResult([
      "current_snapshot_bound_comparison:not_exact_ready",
    ]);
  }

  const sourceAuthority = source.authority;

  const domainDispositions = sourceAuthority.domainComparisons.map(
    (domain) => {
      const occurrenceDispositions = domain.occurrenceComparisons.map(
        (occurrence) => ({
          dispositionId: [
            CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1,
            idPart(
              occurrence.comparisonId,
            ),
          ].join(
            ":",
          ),

          status: "proven_snapshot_bound_leaf_condition_disposition" as const,

          sourceComparisonId: occurrence.comparisonId,

          snapshotIdentityId: occurrence.snapshotIdentityId,

          snapshotSentenceOccurrenceIdentityId:
            occurrence.snapshotSentenceOccurrenceIdentityId,

          snapshotTokenOccurrenceIdentityId:
            occurrence.snapshotTokenOccurrenceIdentityId,

          graphDocumentId: occurrence.graphDocumentId,

          sentenceNodeId: occurrence.sentenceNodeId,

          sentenceIndex: occurrence.sentenceIndex,

          tokenNodeId: occurrence.tokenNodeId,

          containmentEdgeId: occurrence.containmentEdgeId,

          sentenceTokenIndex: occurrence.sentenceTokenIndex,

          comparisonState: occurrence.comparisonState,

          booleanTruth: occurrence.booleanTruth,

          booleanTruthResolved: occurrence.booleanTruthResolved,

          disposition: dispositionFor(
            occurrence.comparisonState,
          ),
        }),
      );

      return {
        dispositionDomainId: [
          CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1,
          idPart(
            domain.comparisonId,
          ),
        ].join(
          ":",
        ),

        status: "candidate_disposition_domain" as const,

        sourceDomainComparisonId: domain.comparisonId,

        expectedSiteAuthorityId: domain.expectedSiteAuthorityId,

        domainEvidenceId: domain.domainEvidenceId,

        snapshotBoundDomainId: domain.snapshotBoundDomainId,

        sourceDomainCandidateId: domain.sourceDomainCandidateId,

        snapshotIdentityId: domain.snapshotIdentityId,

        snapshotSentenceOccurrenceIdentityId:
          domain.snapshotSentenceOccurrenceIdentityId,

        graphDocumentId: domain.graphDocumentId,

        sentenceNodeId: domain.sentenceNodeId,

        sentenceIndex: domain.sentenceIndex,

        occurrenceDispositions,

        occurrenceCount: occurrenceDispositions.length,
      };
    },
  );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_VERSION_V1,

    status: "ready",

    authority: {
      authorityId: [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1,
        idPart(
          sourceAuthority.authorityId,
        ),
      ].join(
        ":",
      ),

      status: "proven_current_snapshot_bound_leaf_condition_disposition",

      sourceComparisonAuthorityId: sourceAuthority.authorityId,

      snapshotIdentityId: sourceAuthority.snapshotIdentityId,

      graphDocumentId: sourceAuthority.graphDocumentId,

      sentenceNodeId: sourceAuthority.sentenceNodeId,

      sentenceIndex: sourceAuthority.sentenceIndex,

      domainDispositions,

      domainDispositionCount: domainDispositions.length,

      governance: {
        closedCurrentSnapshotBoundComparisonPublicDerivationReexecuted: true,
        suppliedCurrentSnapshotBoundComparisonAcceptedAsProof: false,
        snapshotIdentityPreserved: true,
        snapshotSentenceOccurrenceIdentityPreserved: true,
        snapshotTokenOccurrenceIdentityPreserved: true,

        comparisonTruthConsumedNotRecomputed: true,
        comparisonTruthConsistencyValidated: true,

        leafConditionDispositionProduced: true,

        noFactCollapsedToFalse: false,
        blockedCollapsedToFalse: false,
        openNoSurvivingMatchCollapsedToFalse: false,
        openMatchPossibleCollapsedToTrue: false,
        mixedResolvedLabelsCollapsedToBoolean: false,

        occurrenceFilteringPerformed: false,
        cardinalitySemanticsResolved: false,
        cardinalityEnforcementPerformed: false,
        domainCandidateWinnerSelected: false,
        occurrenceWinnerSelected: false,
        occurrenceBindingPerformed: false,
        finalRuntimeOccurrenceBindingPerformed: false,
        whereEvaluationPerformed: false,
        learnerErrorClassified: false,
        constraintPropagationInvoked: false,
        canonicalDependencyEdgeGenerated: false,
        clauseNodeGenerated: false,
        graphMutationPerformed: false,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
