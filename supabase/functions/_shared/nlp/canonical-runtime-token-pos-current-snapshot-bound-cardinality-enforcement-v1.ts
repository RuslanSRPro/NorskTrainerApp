import {
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticDomainV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-cardinality-semantics-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-cardinality-enforcement-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementStateV1 =
  | "satisfied"
  | "underflow"
  | "overflow";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementDomainV1 =
  {
    cardinalityEnforcementDomainId: string;

    status: "proven_snapshot_bound_cardinality_enforcement";

    sourceCardinalitySemanticDomainId: string;

    sourceFilteringDomainId: string;

    expectedSiteAuthorityId: string;

    bindingDefinitionAuthorityId: string;

    manifestId: string;

    manifestCode: string;

    referencedBindingName: string;

    snapshotIdentityId: string;

    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;

    sentenceNodeId: string;

    sentenceIndex: number;

    sourceOccurrenceCount: number;

    survivingOccurrenceCount: number;

    filteredOutOccurrenceCount: number;

    cardinalityLabel:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticDomainV1[
        "cardinalityLabel"
      ];

    minimum: number;

    maximum:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticDomainV1[
        "maximum"
      ];

    enforcementState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementStateV1;

    cardinalitySatisfied: boolean;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementAuthorityV1 =
  {
    authorityId: string;

    status: "proven_current_snapshot_bound_cardinality_enforcement";

    sourceCardinalitySemanticsAuthorityId: string;

    sourceFilteringAuthorityId: string;

    sourceDispositionAuthorityId: string;

    sourceComparisonAuthorityId: string;

    snapshotIdentityId: string;

    graphDocumentId: string;

    sentenceNodeId: string;

    sentenceIndex: number;

    domainCardinalityEnforcement:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementDomainV1[];

    domainCardinalityEnforcementCount: number;

    satisfiedDomainCount: number;

    underflowDomainCount: number;

    overflowDomainCount: number;

    governance: {
      closedCardinalitySemanticsPublicDerivationReexecuted: true;

      suppliedCardinalitySemanticsAcceptedAsProof: false;

      cardinalitySemanticsResolved: true;

      survivorCountComparedOnlyAgainstProvenCardinalityBounds: true;

      unboundedMaximumTreatedAsNumericMaximum: false;

      cardinalityEnforcementPerformed: true;

      cardinalityEnforcementResolved: true;

      cardinalityViolationIsBlockingFailure: false;

      singletonSurvivorTreatedAsWinner: false;

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

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_VERSION_V1;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_VERSION_V1;

    status: "blocked";

    authority: null;

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementBlockedResultV1;

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  );
}

function unique(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ];
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_VERSION_V1,

    status: "blocked",

    authority: null,

    blockingReasons: unique(
      reasons,
    ),
  };
}

function enforcementState(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticDomainV1,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementStateV1 {
  if (
    domain.survivingOccurrenceCount <
      domain.minimum
  ) {
    return "underflow";
  }

  if (
    domain.maximum !==
      "unbounded" &&
    domain.survivingOccurrenceCount >
      domain.maximum
  ) {
    return "overflow";
  }

  return "satisfied";
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1
  >[3],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1
  >[4],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1
  >[5],
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementResultV1
> {
  const semanticsResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    semanticsResult.status !==
      "ready"
  ) {
    return blocked(
      [
        "current_snapshot_bound_cardinality_semantics:not_ready",
        ...semanticsResult.blockingReasons.map(
          (reason) => `current_snapshot_bound_cardinality_semantics:${reason}`,
        ),
      ],
    );
  }

  const domains = semanticsResult.authority.domainCardinalitySemantics.map(
    (domain) => {
      const state = enforcementState(
        domain,
      );

      return {
        cardinalityEnforcementDomainId:
          `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_V1}:domain:${
            idPart(domain.cardinalitySemanticDomainId)
          }`,

        status: "proven_snapshot_bound_cardinality_enforcement" as const,

        sourceCardinalitySemanticDomainId: domain.cardinalitySemanticDomainId,

        sourceFilteringDomainId: domain.sourceFilteringDomainId,

        expectedSiteAuthorityId: domain.expectedSiteAuthorityId,

        bindingDefinitionAuthorityId: domain.bindingDefinitionAuthorityId,

        manifestId: domain.manifestId,

        manifestCode: domain.manifestCode,

        referencedBindingName: domain.referencedBindingName,

        snapshotIdentityId: domain.snapshotIdentityId,

        snapshotSentenceOccurrenceIdentityId:
          domain.snapshotSentenceOccurrenceIdentityId,

        graphDocumentId: domain.graphDocumentId,

        sentenceNodeId: domain.sentenceNodeId,

        sentenceIndex: domain.sentenceIndex,

        sourceOccurrenceCount: domain.sourceOccurrenceCount,

        survivingOccurrenceCount: domain.survivingOccurrenceCount,

        filteredOutOccurrenceCount: domain.filteredOutOccurrenceCount,

        cardinalityLabel: domain.cardinalityLabel,

        minimum: domain.minimum,

        maximum: domain.maximum,

        enforcementState: state,

        cardinalitySatisfied: state ===
          "satisfied",
      };
    },
  );

  const satisfiedDomainCount = domains.filter(
    (domain) =>
      domain.enforcementState ===
        "satisfied",
  ).length;

  const underflowDomainCount = domains.filter(
    (domain) =>
      domain.enforcementState ===
        "underflow",
  ).length;

  const overflowDomainCount = domains.filter(
    (domain) =>
      domain.enforcementState ===
        "overflow",
  ).length;

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_VERSION_V1,

    status: "ready",

    authority: {
      authorityId:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_V1}:authority:${
          idPart(semanticsResult.authority.authorityId)
        }`,

      status: "proven_current_snapshot_bound_cardinality_enforcement",

      sourceCardinalitySemanticsAuthorityId:
        semanticsResult.authority.authorityId,

      sourceFilteringAuthorityId:
        semanticsResult.authority.sourceFilteringAuthorityId,

      sourceDispositionAuthorityId:
        semanticsResult.authority.sourceDispositionAuthorityId,

      sourceComparisonAuthorityId:
        semanticsResult.authority.sourceComparisonAuthorityId,

      snapshotIdentityId: semanticsResult.authority.snapshotIdentityId,

      graphDocumentId: semanticsResult.authority.graphDocumentId,

      sentenceNodeId: semanticsResult.authority.sentenceNodeId,

      sentenceIndex: semanticsResult.authority.sentenceIndex,

      domainCardinalityEnforcement: domains,

      domainCardinalityEnforcementCount: domains.length,

      satisfiedDomainCount,

      underflowDomainCount,

      overflowDomainCount,

      governance: {
        closedCardinalitySemanticsPublicDerivationReexecuted: true,

        suppliedCardinalitySemanticsAcceptedAsProof: false,

        cardinalitySemanticsResolved: true,

        survivorCountComparedOnlyAgainstProvenCardinalityBounds: true,

        unboundedMaximumTreatedAsNumericMaximum: false,

        cardinalityEnforcementPerformed: true,

        cardinalityEnforcementResolved: true,

        cardinalityViolationIsBlockingFailure: false,

        singletonSurvivorTreatedAsWinner: false,

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
