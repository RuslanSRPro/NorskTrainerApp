import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingCollectionValueV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionDomainV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-binding-value-projection-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_FINAL_RUNTIME_BINDING_V1 =
  "canonical_runtime_token_pos_current_snapshot_bound_where_post_owner_final_runtime_binding_v1";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingStateV1 =
  | "bound"
  | "not_bound_unresolved"
  | "not_bound_cardinality_violation";

type ProjectionDomain =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionDomainV1;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingDomainV1 = {
  id: string;
  bindingState:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingStateV1;

  structuralAuthorityId: string;
  ownerBindingDefinitionAuthorityId: string;
  manifestId: string;
  manifestCode: string;
  ownerBindingName: string;

  snapshotIdentityId: string;
  snapshotSentenceOccurrenceIdentityId: string;
  graphDocumentId: string;
  sentenceNodeId: string;

  finalRuntimeBindingResolved: boolean;
  finalRuntimeBindingValue:
    | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingCollectionValueV1
    | null;

  boundOccurrenceCount: number;
  occurrenceBindingPerformed: boolean;
  finalRuntimeOccurrenceBindingPerformed: boolean;

  sourceProjectionDomain: ProjectionDomain;

  governance: {
    exactPostWhereOwnerBindingValueProjectionRequired: true;
    projectedValueConsumedWithoutRecomputation: true;
    unresolvedProjectionNotBound: true;
    cardinalityViolationProjectionNotBound: true;
    canonicalCollectionValuePreserved: true;
    emptyCollectionFinalBindingAllowed: true;
    emptyCollectionTreatedAsOccurrenceBinding: false;
    singletonCollectionCollapsedToScalar: false;
    singletonCollectionTreatedAsWinner: false;
    occurrenceWinnerSelected: false;
    readinessRecomputed: false;
    cardinalityRecomputed: false;
    whereEvaluationPerformed: false;
    whereRecomputed: false;
    runtimeBindingExecuted: false;
    bindingTruthResolved: false;
    learnerErrorClassified: false;
    constraintPropagationInvoked: false;
    graphMutationPerformed: false;
  };
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingReadyResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_FINAL_RUNTIME_BINDING_V1;
  producerVersion: "1.0.0";
  specificationId: "late-v1.40:post-where-owner-final-runtime-binding-v1";
  status: "ready";
  sourceProjectionResult: Extract<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1
    >,
    { status: "ready" }
  >;
  domainFinalRuntimeBindings:
    readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingDomainV1[];
  domainCount: number;
  boundDomainCount: number;
  unresolvedDomainCount: number;
  cardinalityViolationDomainCount: number;
  boundOccurrenceCount: number;
  governance: {
    finalRuntimeBindingResolutionPerformed: true;
    finalRuntimeBindingResolved: boolean;
    occurrenceBindingPerformed: boolean;
    finalRuntimeOccurrenceBindingPerformed: boolean;
    emptyCollectionTreatedAsOccurrenceBinding: false;
    runtimeBindingExecuted: false;
    bindingTruthResolved: false;
    whereEvaluationPerformed: false;
    learnerErrorClassified: false;
    constraintPropagationInvoked: false;
    graphMutationPerformed: false;
  };
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingBlockedResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_FINAL_RUNTIME_BINDING_V1;
  producerVersion: "1.0.0";
  specificationId: "late-v1.40:post-where-owner-final-runtime-binding-v1";
  status: "blocked";
  sourceProjectionResult: ReturnType<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1
  >;
  domainFinalRuntimeBindings: readonly [];
  domainCount: 0;
  boundDomainCount: 0;
  unresolvedDomainCount: 0;
  cardinalityViolationDomainCount: 0;
  boundOccurrenceCount: 0;
  blockingReasons: readonly string[];
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingBlockedResultV1;

function idPart(value: string): string {
  return encodeURIComponent(value);
}

function bindDomain(
  domain: ProjectionDomain,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingDomainV1 | null {
  const id = [
    CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_FINAL_RUNTIME_BINDING_V1,
    idPart(domain.structuralAuthorityId),
    idPart(domain.ownerBindingDefinitionAuthorityId),
    idPart(domain.snapshotIdentityId),
    idPart(domain.snapshotSentenceOccurrenceIdentityId),
  ].join(":");

  const base = {
    id,
    structuralAuthorityId: domain.structuralAuthorityId,
    ownerBindingDefinitionAuthorityId: domain.ownerBindingDefinitionAuthorityId,
    manifestId: domain.manifestId,
    manifestCode: domain.manifestCode,
    ownerBindingName: domain.ownerBindingName,
    snapshotIdentityId: domain.snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId:
      domain.snapshotSentenceOccurrenceIdentityId,
    graphDocumentId: domain.graphDocumentId,
    sentenceNodeId: domain.sentenceNodeId,
    sourceProjectionDomain: domain,
    governance: {
      exactPostWhereOwnerBindingValueProjectionRequired: true as const,
      projectedValueConsumedWithoutRecomputation: true as const,
      unresolvedProjectionNotBound: true as const,
      cardinalityViolationProjectionNotBound: true as const,
      canonicalCollectionValuePreserved: true as const,
      emptyCollectionFinalBindingAllowed: true as const,
      emptyCollectionTreatedAsOccurrenceBinding: false as const,
      singletonCollectionCollapsedToScalar: false as const,
      singletonCollectionTreatedAsWinner: false as const,
      occurrenceWinnerSelected: false as const,
      readinessRecomputed: false as const,
      cardinalityRecomputed: false as const,
      whereEvaluationPerformed: false as const,
      whereRecomputed: false as const,
      runtimeBindingExecuted: false as const,
      bindingTruthResolved: false as const,
      learnerErrorClassified: false as const,
      constraintPropagationInvoked: false as const,
      graphMutationPerformed: false as const,
    },
  };

  if (
    domain.projectionState === "not_projected_unresolved" &&
    domain.projectedValue === null
  ) {
    return {
      ...base,
      bindingState: "not_bound_unresolved",
      finalRuntimeBindingResolved: false,
      finalRuntimeBindingValue: null,
      boundOccurrenceCount: 0,
      occurrenceBindingPerformed: false,
      finalRuntimeOccurrenceBindingPerformed: false,
    };
  }

  if (
    domain.projectionState === "not_projected_cardinality_violation" &&
    domain.projectedValue === null
  ) {
    return {
      ...base,
      bindingState: "not_bound_cardinality_violation",
      finalRuntimeBindingResolved: false,
      finalRuntimeBindingValue: null,
      boundOccurrenceCount: 0,
      occurrenceBindingPerformed: false,
      finalRuntimeOccurrenceBindingPerformed: false,
    };
  }

  if (
    domain.projectionState !== "projected" ||
    domain.projectedValue === null
  ) {
    return null;
  }

  const value = domain.projectedValue;
  const occurrenceBindingPerformed = value.memberCount > 0;

  return {
    ...base,
    bindingState: "bound",
    finalRuntimeBindingResolved: true,
    finalRuntimeBindingValue: value,
    boundOccurrenceCount: value.memberCount,
    occurrenceBindingPerformed,
    finalRuntimeOccurrenceBindingPerformed: occurrenceBindingPerformed,
  };
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1(
  sourceSurvivorResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1
  >[0],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1
  >[1],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1
  >[2],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingResultV1 {
  const sourceProjectionResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1(
      sourceSurvivorResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (sourceProjectionResult.status !== "ready") {
    return {
      producer:
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_FINAL_RUNTIME_BINDING_V1,
      producerVersion: "1.0.0",
      specificationId:
        "late-v1.40:post-where-owner-final-runtime-binding-v1",
      status: "blocked",
      sourceProjectionResult,
      domainFinalRuntimeBindings: [],
      domainCount: 0,
      boundDomainCount: 0,
      unresolvedDomainCount: 0,
      cardinalityViolationDomainCount: 0,
      boundOccurrenceCount: 0,
      blockingReasons: [
        "post_where_owner_binding_value_projection_blocked",
      ],
    };
  }

  const domainFinalRuntimeBindings:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingDomainV1[] = [];

  for (const domain of sourceProjectionResult.projectionDomains) {
    const binding = bindDomain(domain);

    if (binding === null) {
      return {
        producer:
          CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_FINAL_RUNTIME_BINDING_V1,
        producerVersion: "1.0.0",
        specificationId:
          "late-v1.40:post-where-owner-final-runtime-binding-v1",
        status: "blocked",
        sourceProjectionResult,
        domainFinalRuntimeBindings: [],
        domainCount: 0,
        boundDomainCount: 0,
        unresolvedDomainCount: 0,
        cardinalityViolationDomainCount: 0,
        boundOccurrenceCount: 0,
        blockingReasons: [
          "post_where_owner_binding_value_projection_contract_mismatch",
        ],
      };
    }

    domainFinalRuntimeBindings.push(binding);
  }

  const boundDomainCount = domainFinalRuntimeBindings.filter(
    (domain) => domain.bindingState === "bound",
  ).length;
  const unresolvedDomainCount = domainFinalRuntimeBindings.filter(
    (domain) => domain.bindingState === "not_bound_unresolved",
  ).length;
  const cardinalityViolationDomainCount = domainFinalRuntimeBindings.filter(
    (domain) => domain.bindingState === "not_bound_cardinality_violation",
  ).length;
  const boundOccurrenceCount = domainFinalRuntimeBindings.reduce(
    (sum, domain) => sum + domain.boundOccurrenceCount,
    0,
  );
  const occurrenceBindingPerformed = boundOccurrenceCount > 0;

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_FINAL_RUNTIME_BINDING_V1,
    producerVersion: "1.0.0",
    specificationId:
      "late-v1.40:post-where-owner-final-runtime-binding-v1",
    status: "ready",
    sourceProjectionResult,
    domainFinalRuntimeBindings,
    domainCount: domainFinalRuntimeBindings.length,
    boundDomainCount,
    unresolvedDomainCount,
    cardinalityViolationDomainCount,
    boundOccurrenceCount,
    governance: {
      finalRuntimeBindingResolutionPerformed: true,
      finalRuntimeBindingResolved: boundDomainCount > 0,
      occurrenceBindingPerformed,
      finalRuntimeOccurrenceBindingPerformed: occurrenceBindingPerformed,
      emptyCollectionTreatedAsOccurrenceBinding: false,
      runtimeBindingExecuted: false,
      bindingTruthResolved: false,
      whereEvaluationPerformed: false,
      learnerErrorClassified: false,
      constraintPropagationInvoked: false,
      graphMutationPerformed: false,
    },
  };
}
