import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceDomainV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceResultV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-owner-binding-occurrence-provenance-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_VERSION_V1 =
  "1.0.0" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_SPECIFICATION_ID_V1 =
  "late-v1.40:final-runtime-where-root-truth-decision-v1" as const;

type OwnerResult =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceResultV1;

type OwnerReadyResult = Extract<
  OwnerResult,
  { status: "ready" }
>;

type OwnerDomain =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceDomainV1;

type RootCandidate = OwnerDomain["sourceRootCandidate"];

type RootTruthDisposition =
  RootCandidate["rootTruth"]["authorityBoundChildTruthEvidence"][
    "childTruthEvidence"
  ][
    "truthDisposition"
  ];

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalDecisionDispositionV1 =
  | "satisfied"
  | "rejected"
  | "uncertain";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1 =
  {
    decisionId: string;

    status: "proven_final_where_root_truth_decision";

    structuralAuthorityId: string;
    ownerBindingDefinitionAuthorityId: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;

    rootTruthDisposition: RootTruthDisposition;

    decisionDisposition:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalDecisionDispositionV1;

    sourceOwnerBindingOccurrenceDomain: OwnerDomain;
    sourceRootCandidate: RootCandidate;

    governance: {
      exactOwnerOccurrenceDomainRequired: true;
      exactA46a1fRootCandidatePreserved: true;

      rootTruthConsumedWithoutRecomputation: true;
      rootTruthDispositionDuplicatedAtDecisionLayer: false;

      resolvedTrueMapsToSatisfied: true;
      resolvedFalseMapsToRejected: true;
      unresolvedMapsToUncertain: true;

      missingRootCandidateCollapsedToFalse: false;
      missingRootCandidateCollapsedToUnresolved: false;

      ownerOccurrenceFilteringPerformed: false;
      occurrenceWinnerSelected: false;

      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;

      finalRuntimeBindingPerformed: false;
      bindingTruthResolved: false;

      learnerErrorClassified: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_SPECIFICATION_ID_V1;

    status: "ready";

    sourceOwnerResult: OwnerReadyResult;

    decisions:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1[];

    decisionCount: number;

    blockingReasons: readonly [];

    governance: {
      ownerResultConsumedWithoutReexecution: true;
      rootTruthConsumedWithoutRecomputation: true;

      zeroOwnerDomainsAllowed: true;
      zeroOwnerDomainsProduceZeroDecisions: true;

      ownerDomainMultiplicityPreserved: true;
      ownerOccurrenceFilteringPerformed: false;
      occurrenceWinnerSelected: false;

      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;

      finalRuntimeBindingPerformed: false;
      bindingTruthResolved: false;

      learnerErrorClassified: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_SPECIFICATION_ID_V1;

    status: "blocked";

    sourceOwnerResult: OwnerResult;

    decisions: readonly [];
    decisionCount: 0;

    blockingReasons: readonly string[];

    governance: {
      ownerResultConsumedWithoutReexecution: true;
      rootTruthConsumedWithoutRecomputation: true;

      zeroOwnerDomainsAllowed: true;
      zeroOwnerDomainsProduceZeroDecisions: true;

      ownerDomainMultiplicityPreserved: true;
      ownerOccurrenceFilteringPerformed: false;
      occurrenceWinnerSelected: false;

      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;

      finalRuntimeBindingPerformed: false;
      bindingTruthResolved: false;

      learnerErrorClassified: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionBlockedResultV1;

const RESULT_GOVERNANCE = {
  ownerResultConsumedWithoutReexecution: true,
  rootTruthConsumedWithoutRecomputation: true,

  zeroOwnerDomainsAllowed: true,
  zeroOwnerDomainsProduceZeroDecisions: true,

  ownerDomainMultiplicityPreserved: true,
  ownerOccurrenceFilteringPerformed: false,
  occurrenceWinnerSelected: false,

  cardinalitySemanticsResolved: false,
  cardinalityEnforcementPerformed: false,

  finalRuntimeBindingPerformed: false,
  bindingTruthResolved: false,

  learnerErrorClassified: false,
  graphMutationPerformed: false,

  frozenGrammarReadOnly: true,
} as const;

const DECISION_GOVERNANCE = {
  exactOwnerOccurrenceDomainRequired: true,
  exactA46a1fRootCandidatePreserved: true,

  rootTruthConsumedWithoutRecomputation: true,
  rootTruthDispositionDuplicatedAtDecisionLayer: false,

  resolvedTrueMapsToSatisfied: true,
  resolvedFalseMapsToRejected: true,
  unresolvedMapsToUncertain: true,

  missingRootCandidateCollapsedToFalse: false,
  missingRootCandidateCollapsedToUnresolved: false,

  ownerOccurrenceFilteringPerformed: false,
  occurrenceWinnerSelected: false,

  cardinalitySemanticsResolved: false,
  cardinalityEnforcementPerformed: false,

  finalRuntimeBindingPerformed: false,
  bindingTruthResolved: false,

  learnerErrorClassified: false,
  graphMutationPerformed: false,

  frozenGrammarReadOnly: true,
} as const;

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
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

function decisionDispositionFor(
  truth: RootTruthDisposition,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalDecisionDispositionV1 {
  switch (
    truth
  ) {
    case "resolved_true":
      return "satisfied";

    case "resolved_false":
      return "rejected";

    case "unresolved":
      return "uncertain";
  }
}

function blocked(
  sourceOwnerResult: OwnerResult,
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_SPECIFICATION_ID_V1,

    status: "blocked",

    sourceOwnerResult,

    decisions: [],
    decisionCount: 0,

    blockingReasons: uniqueSorted(
      reasons,
    ),

    governance: RESULT_GOVERNANCE,
  };
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1(
  ownerResult: OwnerResult,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionResultV1 {
  if (
    ownerResult.status !==
      "ready" ||
    ownerResult.blockingReasons.length !==
      0
  ) {
    return blocked(
      ownerResult,
      [
        "owner_binding_occurrence_provenance:not_exact_ready",
        ...ownerResult.blockingReasons.map(
          (reason) =>
            "owner_binding_occurrence_provenance:" +
            reason,
        ),
      ],
    );
  }

  const decisions:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1[] =
      ownerResult.ownerBindingOccurrenceDomains.map(
        (domain) => {
          const rootCandidate = domain.sourceRootCandidate;

          const rootTruthDisposition = rootCandidate.rootTruth
            .authorityBoundChildTruthEvidence
            .childTruthEvidence
            .truthDisposition;

          return {
            decisionId: [
              CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_V1,
              idPart(
                domain.id,
              ),
              idPart(
                rootCandidate.contextCandidateId,
              ),
            ].join(
              ":",
            ),

            status: "proven_final_where_root_truth_decision" as const,

            structuralAuthorityId: domain.structuralAuthorityId,

            ownerBindingDefinitionAuthorityId:
              domain.ownerBindingDefinitionAuthorityId,

            snapshotIdentityId: domain.snapshotIdentityId,

            snapshotSentenceOccurrenceIdentityId:
              domain.snapshotSentenceOccurrenceIdentityId,

            graphDocumentId: domain.graphDocumentId,

            sentenceNodeId: domain.sentenceNodeId,

            rootTruthDisposition,

            decisionDisposition: decisionDispositionFor(
              rootTruthDisposition,
            ),

            sourceOwnerBindingOccurrenceDomain: domain,

            sourceRootCandidate: rootCandidate,

            governance: DECISION_GOVERNANCE,
          };
        },
      );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_FINAL_ROOT_TRUTH_DECISION_SPECIFICATION_ID_V1,

    status: "ready",

    sourceOwnerResult: ownerResult,

    decisions,

    decisionCount: decisions.length,

    blockingReasons: [],

    governance: RESULT_GOVERNANCE,
  };
}
