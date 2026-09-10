import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionResultV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionsV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-leaf-condition-disposition-v1.ts";

// v1.46
//
// CURRENT snapshot-bound occurrence filtering.
//
// Authority boundary:
//
// exact surface
// + exact graph
// + exact A3.3.4a expected authority
// + exact CURRENT binding occurrence domain
//   -> independently reexecute CLOSED snapshot-bound leaf disposition
//   -> eliminate only PROVEN FALSE / rejected occurrences
//   -> preserve every unresolved / unavailable / blocked occurrence as a survivor.
//
// This layer does NOT:
// - resolve cardinality;
// - enforce cardinality;
// - select a domain or occurrence winner;
// - perform final occurrence binding;
// - execute WHERE;
// - classify learner error;
// - invoke constraint propagation;
// - mutate the graph.
//
// A singleton survivor is still only a singleton survivor.
// Candidate count is never authority.

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-occurrence-filtering-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringStateV1 =
  | "survives"
  | "filtered_out";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringOccurrenceV1 =
  {
    filteringId: string;
    status: "proven_snapshot_bound_occurrence_filtering";

    sourceDispositionId: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;
    snapshotTokenOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    tokenNodeId: string;
    containmentEdgeId: string;
    sentenceTokenIndex: number;

    disposition:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionV1;

    booleanTruth: boolean | null;
    booleanTruthResolved: boolean;

    filteringState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringStateV1;

    survivesFiltering: boolean;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringDomainV1 =
  {
    filteringDomainId: string;
    status: "candidate_filtering_domain";

    sourceDomainDispositionId: string;
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

    occurrenceFiltering:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringOccurrenceV1[];

    sourceOccurrenceCount: number;
    survivingOccurrenceCount: number;
    filteredOutOccurrenceCount: number;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringAuthorityV1 =
  {
    authorityId: string;
    status: "proven_current_snapshot_bound_occurrence_filtering";

    sourceDispositionAuthorityId: string;
    sourceComparisonAuthorityId: string;

    snapshotIdentityId: string;
    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    domainFiltering:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringDomainV1[];

    domainFilteringCount: number;

    governance: {
      closedCurrentSnapshotBoundLeafDispositionPublicDerivationReexecuted: true;
      suppliedCurrentSnapshotBoundLeafDispositionAcceptedAsProof: false;

      snapshotIdentityPreserved: true;
      snapshotSentenceOccurrenceIdentityPreserved: true;
      snapshotTokenOccurrenceIdentityPreserved: true;

      leafDispositionConsumedNotRecomputed: true;
      leafDispositionTruthConsistencyValidated: true;

      provenFalseOnlyElimination: true;
      unresolvedDispositionPreservedAsSurvivor: true;
      unavailableDispositionPreservedAsSurvivor: true;
      blockedDispositionPreservedAsSurvivor: true;

      singletonSurvivorTreatedAsWinner: false;

      occurrenceFilteringPerformed: true;

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

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_VERSION_V1;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_VERSION_V1;

    status: "blocked";

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringBlockedResultV1;

function stableReasons(
  reasons: readonly string[],
): string[] {
  return [
    ...new Set(
      reasons.filter(
        (reason) =>
          typeof reason === "string" &&
          reason.length > 0,
      ),
    ),
  ].sort();
}

function blockedResult(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_VERSION_V1,

    status: "blocked",

    blockingReasons:
      stableReasons(
        reasons,
      ),
  };
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  );
}

function exactDispositionTruth(
  disposition:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionV1,
  booleanTruth: boolean | null,
  booleanTruthResolved: boolean,
): boolean {
  switch (
    disposition
  ) {
    case "satisfied":
      return (
        booleanTruthResolved ===
          true &&
        booleanTruth ===
          true
      );

    case "rejected":
      return (
        booleanTruthResolved ===
          true &&
        booleanTruth ===
          false
      );

    case "uncertain":
    case "unavailable":
    case "blocked":
      return (
        booleanTruthResolved ===
          false &&
        booleanTruth ===
          null
      );
  }
}

function exactSourceResult(
  source:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionResultV1,
): source is Extract<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionResultV1,
  { status: "ready" }
> {
  if (
    source.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_V1 ||
    source.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_LEAF_CONDITION_DISPOSITION_VERSION_V1 ||
    source.status !==
      "ready"
  ) {
    return false;
  }

  const authority =
    source.authority;

  const g =
    authority.governance;

  if (
    authority.status !==
      "proven_current_snapshot_bound_leaf_condition_disposition" ||

    g.closedCurrentSnapshotBoundComparisonPublicDerivationReexecuted !==
      true ||
    g.suppliedCurrentSnapshotBoundComparisonAcceptedAsProof !==
      false ||

    g.snapshotIdentityPreserved !==
      true ||
    g.snapshotSentenceOccurrenceIdentityPreserved !==
      true ||
    g.snapshotTokenOccurrenceIdentityPreserved !==
      true ||

    g.comparisonTruthConsumedNotRecomputed !==
      true ||
    g.comparisonTruthConsistencyValidated !==
      true ||
    g.leafConditionDispositionProduced !==
      true ||

    g.noFactCollapsedToFalse !==
      false ||
    g.blockedCollapsedToFalse !==
      false ||
    g.openNoSurvivingMatchCollapsedToFalse !==
      false ||
    g.openMatchPossibleCollapsedToTrue !==
      false ||
    g.mixedResolvedLabelsCollapsedToBoolean !==
      false ||

    g.occurrenceFilteringPerformed !==
      false ||
    g.cardinalitySemanticsResolved !==
      false ||
    g.cardinalityEnforcementPerformed !==
      false ||
    g.domainCandidateWinnerSelected !==
      false ||
    g.occurrenceWinnerSelected !==
      false ||
    g.occurrenceBindingPerformed !==
      false ||
    g.finalRuntimeOccurrenceBindingPerformed !==
      false ||
    g.whereEvaluationPerformed !==
      false ||
    g.learnerErrorClassified !==
      false ||
    g.constraintPropagationInvoked !==
      false ||
    g.canonicalDependencyEdgeGenerated !==
      false ||
    g.clauseNodeGenerated !==
      false ||
    g.graphMutationPerformed !==
      false ||
    g.frozenGrammarReadOnly !==
      true
  ) {
    return false;
  }

  if (
    authority.domainDispositionCount !==
      authority.domainDispositions.length
  ) {
    return false;
  }

  for (
    const domain of
      authority.domainDispositions
  ) {
    if (
      domain.status !==
        "candidate_disposition_domain" ||
      domain.snapshotIdentityId !==
        authority.snapshotIdentityId ||
      domain.graphDocumentId !==
        authority.graphDocumentId ||
      domain.sentenceNodeId !==
        authority.sentenceNodeId ||
      domain.sentenceIndex !==
        authority.sentenceIndex ||
      domain.occurrenceCount !==
        domain.occurrenceDispositions.length
    ) {
      return false;
    }

    for (
      const occurrence of
        domain.occurrenceDispositions
    ) {
      if (
        occurrence.status !==
          "proven_snapshot_bound_leaf_condition_disposition" ||
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
        !exactDispositionTruth(
          occurrence.disposition,
          occurrence.booleanTruth,
          occurrence.booleanTruthResolved,
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

function filteringStateFor(
  disposition:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionV1,
  booleanTruth: boolean | null,
  booleanTruthResolved: boolean,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringStateV1 {
  if (
    disposition ===
      "rejected" &&
    booleanTruthResolved ===
      true &&
    booleanTruth ===
      false
  ) {
    return "filtered_out";
  }

  return "survives";
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionsV1
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionsV1
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionsV1
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionsV1
  >[3],
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringResultV1
> {
  const source =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundLeafConditionDispositionsV1(
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
      "current_snapshot_bound_leaf_condition_disposition:not_exact_ready",
    ]);
  }

  const sourceAuthority =
    source.authority;

  const domainFiltering =
    sourceAuthority.domainDispositions.map(
      (domain) => {
        const occurrenceFiltering =
          domain.occurrenceDispositions.map(
            (occurrence) => {
              const filteringState =
                filteringStateFor(
                  occurrence.disposition,
                  occurrence.booleanTruth,
                  occurrence.booleanTruthResolved,
                );

              return {
                filteringId: [
                  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1,
                  idPart(
                    occurrence.dispositionId,
                  ),
                ].join(
                  ":",
                ),

                status:
                  "proven_snapshot_bound_occurrence_filtering" as const,

                sourceDispositionId:
                  occurrence.dispositionId,

                snapshotIdentityId:
                  occurrence.snapshotIdentityId,

                snapshotSentenceOccurrenceIdentityId:
                  occurrence.snapshotSentenceOccurrenceIdentityId,

                snapshotTokenOccurrenceIdentityId:
                  occurrence.snapshotTokenOccurrenceIdentityId,

                graphDocumentId:
                  occurrence.graphDocumentId,

                sentenceNodeId:
                  occurrence.sentenceNodeId,

                sentenceIndex:
                  occurrence.sentenceIndex,

                tokenNodeId:
                  occurrence.tokenNodeId,

                containmentEdgeId:
                  occurrence.containmentEdgeId,

                sentenceTokenIndex:
                  occurrence.sentenceTokenIndex,

                disposition:
                  occurrence.disposition,

                booleanTruth:
                  occurrence.booleanTruth,

                booleanTruthResolved:
                  occurrence.booleanTruthResolved,

                filteringState,

                survivesFiltering:
                  filteringState ===
                  "survives",
              };
            },
          );

        const survivingOccurrenceCount =
          occurrenceFiltering.filter(
            (occurrence) =>
              occurrence.survivesFiltering,
          ).length;

        const filteredOutOccurrenceCount =
          occurrenceFiltering.length -
          survivingOccurrenceCount;

        return {
          filteringDomainId: [
            CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1,
            idPart(
              domain.dispositionDomainId,
            ),
          ].join(
            ":",
          ),

          status:
            "candidate_filtering_domain" as const,

          sourceDomainDispositionId:
            domain.dispositionDomainId,

          sourceDomainComparisonId:
            domain.sourceDomainComparisonId,

          expectedSiteAuthorityId:
            domain.expectedSiteAuthorityId,

          domainEvidenceId:
            domain.domainEvidenceId,

          snapshotBoundDomainId:
            domain.snapshotBoundDomainId,

          sourceDomainCandidateId:
            domain.sourceDomainCandidateId,

          snapshotIdentityId:
            domain.snapshotIdentityId,

          snapshotSentenceOccurrenceIdentityId:
            domain.snapshotSentenceOccurrenceIdentityId,

          graphDocumentId:
            domain.graphDocumentId,

          sentenceNodeId:
            domain.sentenceNodeId,

          sentenceIndex:
            domain.sentenceIndex,

          occurrenceFiltering,

          sourceOccurrenceCount:
            occurrenceFiltering.length,

          survivingOccurrenceCount,

          filteredOutOccurrenceCount,
        };
      },
    );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_VERSION_V1,

    status:
      "ready",

    authority: {
      authorityId: [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1,
        idPart(
          sourceAuthority.authorityId,
        ),
      ].join(
        ":",
      ),

      status:
        "proven_current_snapshot_bound_occurrence_filtering",

      sourceDispositionAuthorityId:
        sourceAuthority.authorityId,

      sourceComparisonAuthorityId:
        sourceAuthority.sourceComparisonAuthorityId,

      snapshotIdentityId:
        sourceAuthority.snapshotIdentityId,

      graphDocumentId:
        sourceAuthority.graphDocumentId,

      sentenceNodeId:
        sourceAuthority.sentenceNodeId,

      sentenceIndex:
        sourceAuthority.sentenceIndex,

      domainFiltering,

      domainFilteringCount:
        domainFiltering.length,

      governance: {
        closedCurrentSnapshotBoundLeafDispositionPublicDerivationReexecuted:
          true,

        suppliedCurrentSnapshotBoundLeafDispositionAcceptedAsProof:
          false,

        snapshotIdentityPreserved:
          true,

        snapshotSentenceOccurrenceIdentityPreserved:
          true,

        snapshotTokenOccurrenceIdentityPreserved:
          true,

        leafDispositionConsumedNotRecomputed:
          true,

        leafDispositionTruthConsistencyValidated:
          true,

        provenFalseOnlyElimination:
          true,

        unresolvedDispositionPreservedAsSurvivor:
          true,

        unavailableDispositionPreservedAsSurvivor:
          true,

        blockedDispositionPreservedAsSurvivor:
          true,

        singletonSurvivorTreatedAsWinner:
          false,

        occurrenceFilteringPerformed:
          true,

        cardinalitySemanticsResolved:
          false,

        cardinalityEnforcementPerformed:
          false,

        domainCandidateWinnerSelected:
          false,

        occurrenceWinnerSelected:
          false,

        occurrenceBindingPerformed:
          false,

        finalRuntimeOccurrenceBindingPerformed:
          false,

        whereEvaluationPerformed:
          false,

        learnerErrorClassified:
          false,

        constraintPropagationInvoked:
          false,

        canonicalDependencyEdgeGenerated:
          false,

        clauseNodeGenerated:
          false,

        graphMutationPerformed:
          false,

        frozenGrammarReadOnly:
          true,
      },
    },

    blockingReasons:
      [],
  };
}