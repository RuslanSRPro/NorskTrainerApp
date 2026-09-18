import {
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsResultV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-semantics-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-enforcement-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_VERSION_V1 =
  "1.0.0" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_SPECIFICATION_ID_V1 =
  "late-v1.40:post-where-owner-cardinality-enforcement-v1" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1 =
  | "satisfied"
  | "underflow"
  | "overflow";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementDomainV1 =
  {
    cardinalityEnforcementDomainId: string;
    status: "proven_post_where_owner_cardinality_enforcement";

    structuralAuthorityId: string;
    ownerBindingDefinitionAuthorityId: string;

    manifestId: string;
    manifestCode: string;
    ownerBindingName: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;
    graphDocumentId: string;
    sentenceNodeId: string;

    sourceOccurrenceCount: number;
    survivingOccurrenceCount: number;
    rejectedOccurrenceCount: number;
    uncertainSurvivorCount: number;

    cardinalityLabel:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1[
        "cardinalityLabel"
      ];

    minimum: number;

    maximum:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1[
        "maximum"
      ];

    enforcementState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1;

    cardinalitySatisfied: boolean;

    sourceCardinalitySemanticDomain:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1;

    governance: {
      exactPostWhereOwnerCardinalitySemanticDomainRequired: true;
      cardinalitySemanticsConsumedWithoutRecomputation: true;
      survivorCountComparedOnlyAgainstProvenCardinalityBounds: true;
      uncertainSurvivorCountPreservedAsProvenance: true;
      uncertainSurvivorCountUsedAsIndependentEnforcementAuthority: false;
      uncertaintyReadinessResolved: false;
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
      whereTruthRecomputed: false;
      learnerErrorClassified: false;
      constraintPropagationInvoked: false;
      canonicalDependencyEdgeGenerated: false;
      clauseNodeGenerated: false;
      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_SPECIFICATION_ID_V1;

    status: "ready";

    sourceCardinalitySemanticsResult:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsResultV1;

    enforcementDomains:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementDomainV1[];

    domainCount: number;
    satisfiedDomainCount: number;
    underflowDomainCount: number;
    overflowDomainCount: number;

    blockingReasons: readonly [];

    governance: {
      postWhereOwnerCardinalitySemanticsPublicDerivationReexecuted: true;
      suppliedCardinalitySemanticsAcceptedAsProof: false;
      exactSourceCardinalitySemanticsResultPreserved: true;
      cardinalitySemanticsResolved: true;
      survivorCountComparedOnlyAgainstProvenCardinalityBounds: true;
      uncertainSurvivorReadinessResolved: false;
      cardinalityEnforcementPerformed: true;
      cardinalityViolationIsBlockingFailure: false;
      occurrenceWinnerSelected: false;
      finalRuntimeOccurrenceBindingPerformed: false;
      whereEvaluationPerformed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_SPECIFICATION_ID_V1;

    status: "blocked";

    sourceCardinalitySemanticsResult:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsResultV1;

    enforcementDomains: readonly [];
    domainCount: 0;
    satisfiedDomainCount: 0;
    underflowDomainCount: 0;
    overflowDomainCount: 0;

    blockingReasons: readonly string[];

    governance: {
      postWhereOwnerCardinalitySemanticsPublicDerivationReexecuted: true;
      suppliedCardinalitySemanticsAcceptedAsProof: false;
      cardinalityEnforcementPerformed: false;
      occurrenceWinnerSelected: false;
      finalRuntimeOccurrenceBindingPerformed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementBlockedResultV1;

function idPart(
  value: string,
): string {
  return encodeURIComponent(value);
}

function unique(
  values: readonly string[],
): string[] {
  return [...new Set(values)];
}

function blocked(
  sourceCardinalitySemanticsResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsResultV1,
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_SPECIFICATION_ID_V1,

    status: "blocked",

    sourceCardinalitySemanticsResult,

    enforcementDomains: [],
    domainCount: 0,
    satisfiedDomainCount: 0,
    underflowDomainCount: 0,
    overflowDomainCount: 0,

    blockingReasons: unique(reasons),

    governance: {
      postWhereOwnerCardinalitySemanticsPublicDerivationReexecuted: true,
      suppliedCardinalitySemanticsAcceptedAsProof: false,
      cardinalityEnforcementPerformed: false,
      occurrenceWinnerSelected: false,
      finalRuntimeOccurrenceBindingPerformed: false,
      learnerErrorClassified: false,
      graphMutationPerformed: false,
      frozenGrammarReadOnly: true,
    },
  };
}

export function classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1 {
  if (domain.survivingOccurrenceCount < domain.minimum) {
    return "underflow";
  }

  if (
    domain.maximum !== "unbounded" &&
    domain.survivingOccurrenceCount > domain.maximum
  ) {
    return "overflow";
  }

  return "satisfied";
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementV1(
  sourceSurvivorResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1
  >[0],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1
  >[1],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1
  >[2],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementResultV1 {
  const semanticsResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1(
      sourceSurvivorResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (semanticsResult.status !== "ready") {
    return blocked(
      semanticsResult,
      [
        "post_where_owner_cardinality_semantics:not_ready",
        ...semanticsResult.blockingReasons.map(
          (reason) => `post_where_owner_cardinality_semantics:${reason}`,
        ),
      ],
    );
  }

  const enforcementDomains: readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementDomainV1[] = semanticsResult.domainCardinalitySemantics.map(
    (domain) => {
      const state =
        classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1(
          domain,
        );

      return {
        cardinalityEnforcementDomainId:
          `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_V1}:domain:${
            idPart(domain.cardinalitySemanticDomainId)
          }`,

        status: "proven_post_where_owner_cardinality_enforcement" as const,

        structuralAuthorityId: domain.structuralAuthorityId,
        ownerBindingDefinitionAuthorityId:
          domain.ownerBindingDefinitionAuthorityId,

        manifestId: domain.manifestId,
        manifestCode: domain.manifestCode,
        ownerBindingName: domain.ownerBindingName,

        snapshotIdentityId: domain.snapshotIdentityId,
        snapshotSentenceOccurrenceIdentityId:
          domain.snapshotSentenceOccurrenceIdentityId,
        graphDocumentId: domain.graphDocumentId,
        sentenceNodeId: domain.sentenceNodeId,

        sourceOccurrenceCount: domain.sourceOccurrenceCount,
        survivingOccurrenceCount: domain.survivingOccurrenceCount,
        rejectedOccurrenceCount: domain.rejectedOccurrenceCount,
        uncertainSurvivorCount: domain.uncertainSurvivorCount,

        cardinalityLabel: domain.cardinalityLabel,
        minimum: domain.minimum,
        maximum: domain.maximum,

        enforcementState: state,
        cardinalitySatisfied: state === "satisfied",

        sourceCardinalitySemanticDomain: domain,

        governance: {
          exactPostWhereOwnerCardinalitySemanticDomainRequired: true,
          cardinalitySemanticsConsumedWithoutRecomputation: true,
          survivorCountComparedOnlyAgainstProvenCardinalityBounds: true,
          uncertainSurvivorCountPreservedAsProvenance: true,
          uncertainSurvivorCountUsedAsIndependentEnforcementAuthority: false,
          uncertaintyReadinessResolved: false,
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
          whereTruthRecomputed: false,
          learnerErrorClassified: false,
          constraintPropagationInvoked: false,
          canonicalDependencyEdgeGenerated: false,
          clauseNodeGenerated: false,
          graphMutationPerformed: false,
          frozenGrammarReadOnly: true,
        },
      };
    },
  );

  const satisfiedDomainCount = enforcementDomains.filter(
    (domain) => domain.enforcementState === "satisfied",
  ).length;

  const underflowDomainCount = enforcementDomains.filter(
    (domain) => domain.enforcementState === "underflow",
  ).length;

  const overflowDomainCount = enforcementDomains.filter(
    (domain) => domain.enforcementState === "overflow",
  ).length;

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_ENFORCEMENT_SPECIFICATION_ID_V1,

    status: "ready",

    sourceCardinalitySemanticsResult: semanticsResult,

    enforcementDomains,
    domainCount: enforcementDomains.length,
    satisfiedDomainCount,
    underflowDomainCount,
    overflowDomainCount,

    blockingReasons: [],

    governance: {
      postWhereOwnerCardinalitySemanticsPublicDerivationReexecuted: true,
      suppliedCardinalitySemanticsAcceptedAsProof: false,
      exactSourceCardinalitySemanticsResultPreserved: true,
      cardinalitySemanticsResolved: true,
      survivorCountComparedOnlyAgainstProvenCardinalityBounds: true,
      uncertainSurvivorReadinessResolved: false,
      cardinalityEnforcementPerformed: true,
      cardinalityViolationIsBlockingFailure: false,
      occurrenceWinnerSelected: false,
      finalRuntimeOccurrenceBindingPerformed: false,
      whereEvaluationPerformed: false,
      learnerErrorClassified: false,
      graphMutationPerformed: false,
      frozenGrammarReadOnly: true,
    },
  };
}
