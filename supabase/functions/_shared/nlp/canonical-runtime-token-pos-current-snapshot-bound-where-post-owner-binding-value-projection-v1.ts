import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessDomainV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessResultV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-binding-readiness-v1.ts";

import type {
  GraphStatus,
} from "./canonical-language-graph-core-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_V1 =
  "canonical_runtime_token_pos_current_snapshot_bound_where_post_owner_binding_value_projection_v1";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_SPEC_V1 =
  "late-v1.40:post-where-owner-binding-value-projection-v1" as const;

type ReadinessDomain =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessDomainV1;

type EligibilityOccurrence =
  ReadinessDomain["occurrenceEligibility"][number];

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueMemberV1 = {
  snapshotTokenOccurrenceIdentityId: string;
  tokenNodeId: string;
  graphStatus: GraphStatus;
  containmentEdgeId: string;
  sentenceTokenIndex: number;

  sourceEligibilityOccurrence: EligibilityOccurrence;
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingCollectionValueV1 = {
  valueKind: "ordered_snapshot_token_occurrence_collection";

  members:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueMemberV1[];

  memberCount: number;
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionStateV1 =
  | "projected"
  | "not_projected_unresolved"
  | "not_projected_cardinality_violation";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionDomainV1 = {
  id: string;
  projectionState:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionStateV1;

  structuralAuthorityId: string;
  ownerBindingDefinitionAuthorityId: string;

  manifestId: string;
  manifestCode: string;
  ownerBindingName: string;

  snapshotIdentityId: string;
  snapshotSentenceOccurrenceIdentityId: string;

  graphDocumentId: string;
  sentenceNodeId: string;

  readinessState:
    | "ready"
    | "unresolved_occurrences"
    | "cardinality_violation";

  bindingReady: boolean;

  projectedValue:
    | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingCollectionValueV1
    | null;

  sourceReadinessDomain: ReadinessDomain;

  governance: {
    exactPostWhereOwnerBindingReadinessRequired: true;

    onlyEligibleOccurrencesProjected: true;
    unresolvedOccurrencesNotProjected: true;
    filteredOutOccurrencesNotProjected: true;
    cardinalityViolationNotProjected: true;

    exactSnapshotTokenOccurrenceIdentityPreserved: true;
    exactTokenNodeIdentityPreserved: true;
    exactTokenGraphStatusPreserved: true;
    exactContainmentEdgeIdentityPreserved: true;
    exactSentenceTokenIndexPreserved: true;

    collectionOrderPreserved: true;
    collectionMultiplicityPreserved: true;

    singletonCollectionCollapsedToScalar: false;
    singletonCollectionTreatedAsWinner: false;

    zeroReadyOccurrencesProjectEmptyCollection: true;

    occurrenceWinnerSelected: false;
    finalRuntimeOccurrenceBindingPerformed: false;
    bindingTruthResolved: false;
    runtimeBindingExecuted: false;

    whereEvaluationPerformed: false;
    whereRecomputed: false;

    learnerErrorCreated: false;
    graphMutationPerformed: false;
  };
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionReadyResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_V1;

  producerVersion: "1.0.0";

  spec:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_SPEC_V1;

  status: "ready";

  projectionDomains:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionDomainV1[];

  sourceReadinessResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessResultV1;

  blockingReasons: [];
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionBlockedResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_V1;

  producerVersion: "1.0.0";

  spec:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_SPEC_V1;

  status: "blocked";

  projectionDomains: [];

  sourceReadinessResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessResultV1;

  blockingReasons: string[];
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionBlockedResultV1;

function idPart(
  value: string,
): string {
  return encodeURIComponent(value);
}

function blocked(
  sourceReadinessResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessResultV1,
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_V1,

    producerVersion: "1.0.0",

    spec:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_SPEC_V1,

    status: "blocked",

    projectionDomains: [],

    sourceReadinessResult,

    blockingReasons: [...new Set(reasons)].sort(),
  };
}

function projectMember(
  occurrence: EligibilityOccurrence,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueMemberV1 {
  const sourceOccurrence =
    occurrence.sourceOccurrenceDecision.sourceOccurrence;

  return {
    snapshotTokenOccurrenceIdentityId:
      sourceOccurrence.snapshotTokenOccurrenceIdentityId,

    tokenNodeId:
      sourceOccurrence.tokenNodeId,

    graphStatus:
      sourceOccurrence.graphStatus,

    containmentEdgeId:
      sourceOccurrence.containmentEdgeId,

    sentenceTokenIndex:
      sourceOccurrence.sentenceTokenIndex,

    sourceEligibilityOccurrence:
      occurrence,
  };
}

function projectDomain(
  domain: ReadinessDomain,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionDomainV1 | null {
  const id = [
    CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_V1,
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
    sourceReadinessDomain: domain,
    governance: {
      exactPostWhereOwnerBindingReadinessRequired: true as const,
      onlyEligibleOccurrencesProjected: true as const,
      unresolvedOccurrencesNotProjected: true as const,
      filteredOutOccurrencesNotProjected: true as const,
      cardinalityViolationNotProjected: true as const,
      exactSnapshotTokenOccurrenceIdentityPreserved: true as const,
      exactTokenNodeIdentityPreserved: true as const,
      exactTokenGraphStatusPreserved: true as const,
      exactContainmentEdgeIdentityPreserved: true as const,
      exactSentenceTokenIndexPreserved: true as const,
      collectionOrderPreserved: true as const,
      collectionMultiplicityPreserved: true as const,
      singletonCollectionCollapsedToScalar: false as const,
      singletonCollectionTreatedAsWinner: false as const,
      zeroReadyOccurrencesProjectEmptyCollection: true as const,
      occurrenceWinnerSelected: false as const,
      finalRuntimeOccurrenceBindingPerformed: false as const,
      bindingTruthResolved: false as const,
      runtimeBindingExecuted: false as const,
      whereEvaluationPerformed: false as const,
      whereRecomputed: false as const,
      learnerErrorCreated: false as const,
      graphMutationPerformed: false as const,
    },
  };

  if (
    domain.readinessState === "cardinality_violation" &&
    domain.bindingReady === false
  ) {
    return {
      ...base,
      projectionState: "not_projected_cardinality_violation",
      readinessState: "cardinality_violation",
      bindingReady: false,
      projectedValue: null,
    };
  }

  if (
    domain.readinessState === "unresolved_occurrences" &&
    domain.bindingReady === false
  ) {
    return {
      ...base,
      projectionState: "not_projected_unresolved",
      readinessState: "unresolved_occurrences",
      bindingReady: false,
      projectedValue: null,
    };
  }

  if (
    domain.readinessState !== "ready" ||
    domain.bindingReady !== true
  ) {
    return null;
  }

  const eligibleOccurrences =
    domain.occurrenceEligibility.filter(
      (occurrence) =>
        occurrence.eligibilityState === "eligible" &&
        occurrence.bindingEligible === true,
    );

  if (
    eligibleOccurrences.length !== domain.eligibleOccurrenceCount ||
    eligibleOccurrences.length !== domain.survivingOccurrenceCount
  ) {
    return null;
  }

  const members = eligibleOccurrences.map(projectMember);

  return {
    ...base,
    projectionState: "projected",
    readinessState: "ready",
    bindingReady: true,
    projectedValue: {
      valueKind: "ordered_snapshot_token_occurrence_collection",
      members,
      memberCount: members.length,
    },
  };
}
export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1(
  sourceSurvivorResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessV1
  >[0],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessV1
  >[1],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessV1
  >[2],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionResultV1 {
  const sourceReadinessResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessV1(
      sourceSurvivorResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (sourceReadinessResult.status !== "ready") {
    return blocked(
      sourceReadinessResult,
      [
        "post_where_owner_binding_readiness:not_ready",
        ...sourceReadinessResult.blockingReasons,
      ],
    );
  }

  const blockingReasons: string[] = [];
  const projectionDomains:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionDomainV1[] =
      [];

  for (
    const domain of
      sourceReadinessResult.domainBindingReadiness
  ) {
    const projected =
      projectDomain(domain);

    if (!projected) {
      blockingReasons.push(
        `readiness_domain:${domain.bindingReadinessDomainId}:projection_contract_mismatch`,
      );

      continue;
    }

    projectionDomains.push(projected);
  }

  if (blockingReasons.length > 0) {
    return blocked(
      sourceReadinessResult,
      blockingReasons,
    );
  }

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_V1,

    producerVersion: "1.0.0",

    spec:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_VALUE_PROJECTION_SPEC_V1,

    status: "ready",

    projectionDomains,

    sourceReadinessResult,

    blockingReasons: [],
  };
}