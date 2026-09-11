import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetMemberV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-binding-occurrence-set-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-binding-value-projection-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionStateV1 =
  | "projected"
  | "not_projected_unresolved"
  | "not_projected_cardinality_violation";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueMemberV1 = {
  bindingValueMemberId: string;
  status: "proven_snapshot_bound_binding_value_member";

  sourceBindingOccurrenceSetMemberId: string;
  sourceBindingEligibilityOccurrenceId: string;
  sourceFilteringId: string;
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
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingCollectionValueV1 =
  {
    bindingValueId: string;
    status: "proven_snapshot_bound_binding_collection_value";

    valueKind: "ordered_snapshot_token_occurrence_collection";

    manifestId: string;
    manifestCode: string;
    referencedBindingName: string;

    bindingDefinitionAuthorityId: string;
    expectedSiteAuthorityId: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    cardinalityLabel:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1[
        "cardinalityLabel"
      ];

    members:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueMemberV1[];

    memberCount: number;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1 =
  {
    bindingValueProjectionDomainId: string;
    status: "proven_snapshot_bound_binding_value_projection";

    sourceBindingOccurrenceSetDomainId: string;

    sourceBindingEligibilityDomainId: string;
    sourceCardinalityEnforcementDomainId: string;
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

    cardinalityLabel:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1[
        "cardinalityLabel"
      ];

    sourceMaterializationState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1[
        "materializationState"
      ];

    sourceBindingOccurrenceSetMaterialized: boolean;
    sourceOccurrenceSetCount: number;

    projectionState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionStateV1;

    bindingValueProjected: boolean;

    bindingValue:
      | CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingCollectionValueV1
      | null;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionAuthorityV1 =
  {
    authorityId: string;
    status: "proven_current_snapshot_bound_binding_value_projection";

    sourceBindingOccurrenceSetAuthorityId: string;

    sourceBindingEligibilityAuthorityId: string;
    sourceFilteringAuthorityId: string;
    sourceCardinalityEnforcementAuthorityId: string;
    sourceCardinalitySemanticsAuthorityId: string;
    sourceDispositionAuthorityId: string;
    sourceComparisonAuthorityId: string;

    snapshotIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    domainBindingValueProjection:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1[];

    domainBindingValueProjectionCount: number;

    projectedDomainCount: number;
    unresolvedNotProjectedDomainCount: number;
    cardinalityViolationNotProjectedDomainCount: number;

    projectedBindingValueCount: number;
    projectedBindingValueMemberCount: number;

    governance: {
      closedBindingOccurrenceSetPublicDerivationReexecuted: true;
      suppliedBindingOccurrenceSetAcceptedAsProof: false;

      exactBindingOccurrenceSetAuthorityConsumed: true;
      exactBindingOccurrenceSetDomainLineagePreserved: true;
      exactBindingOccurrenceSetMemberLineagePreserved: true;

      onlyMaterializedOccurrenceSetsProjected: true;
      unresolvedOccurrenceSetsNotProjected: true;
      cardinalityViolationOccurrenceSetsNotProjected: true;

      zeroMemberMaterializedSetProjectsEmptyCollectionValue: true;

      collectionValueShapeCanonical: true;
      collectionOrderPreserved: true;
      collectionMultiplicityPreserved: true;

      singletonCollectionCollapsedToScalar: false;
      singletonCollectionTreatedAsWinner: false;

      bindingValueProjectionPerformed: true;
      bindingValueProjected: boolean;

      occurrenceBindingPerformed: false;
      finalRuntimeOccurrenceBindingPerformed: false;

      bindingTruthResolved: false;
      runtimeBindingExecuted: false;

      whereEvaluationPerformed: false;
      learnerErrorClassified: false;

      constraintPropagationInvoked: false;
      canonicalDependencyEdgeGenerated: false;
      clauseNodeGenerated: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_VERSION_V1;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_VERSION_V1;

    status: "blocked";
    authority: null;

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionBlockedResultV1;

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
): CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_VERSION_V1,

    status: "blocked",

    authority: null,

    blockingReasons: stableReasons(
      reasons,
    ),
  };
}

function exactSetResult(
  result: Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1
    >
  >,
): result is Extract<
  Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1
    >
  >,
  { status: "ready" }
> {
  return (
    result.producer ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1 &&
    result.producerVersion ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.authority.status ===
      "proven_current_snapshot_bound_binding_occurrence_set"
  );
}

function uniqueById<T>(
  values: readonly T[],
  id: (value: T) => string,
): boolean {
  const seen = new Set<string>();

  for (
    const value of values
  ) {
    const currentId = id(value);

    if (
      seen.has(
        currentId,
      )
    ) {
      return false;
    }

    seen.add(
      currentId,
    );
  }

  return true;
}

function exactMaterializedDomain(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1,
): boolean {
  if (
    domain.materializationState !==
      "materialized" ||
    domain.bindingOccurrenceSetMaterialized !==
      true ||
    domain.sourceReadinessState !==
      "ready" ||
    domain.sourceBindingReady !==
      true ||
    domain.cardinalitySatisfied !==
      true ||
    domain.enforcementState !==
      "satisfied" ||
    domain.occurrenceSetCount !==
      domain.occurrenceSet.length ||
    domain.occurrenceSetCount !==
      domain.eligibleOccurrenceCount ||
    domain.unresolvedSurvivingOccurrenceCount !==
      0
  ) {
    return false;
  }

  return domain.occurrenceSet.every(
    (
      member,
    ) =>
      member.status ===
        "proven_snapshot_bound_binding_occurrence_set_member" &&
      member.eligibilityState ===
        "eligible" &&
      member.bindingEligible ===
        true &&
      member.snapshotIdentityId ===
        domain.snapshotIdentityId &&
      member.snapshotSentenceOccurrenceIdentityId ===
        domain.snapshotSentenceOccurrenceIdentityId &&
      member.graphDocumentId ===
        domain.graphDocumentId &&
      member.sentenceNodeId ===
        domain.sentenceNodeId &&
      member.sentenceIndex ===
        domain.sentenceIndex,
  );
}

function exactUnresolvedDomain(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1,
): boolean {
  return (
    domain.materializationState ===
      "not_materialized_unresolved" &&
    domain.bindingOccurrenceSetMaterialized ===
      false &&
    domain.sourceReadinessState ===
      "unresolved_occurrences" &&
    domain.sourceBindingReady ===
      false &&
    domain.occurrenceSetCount ===
      0 &&
    domain.occurrenceSet.length ===
      0
  );
}

function exactCardinalityViolationDomain(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1,
): boolean {
  return (
    domain.materializationState ===
      "not_materialized_cardinality_violation" &&
    domain.bindingOccurrenceSetMaterialized ===
      false &&
    domain.sourceReadinessState ===
      "cardinality_violation" &&
    domain.sourceBindingReady ===
      false &&
    domain.cardinalitySatisfied ===
      false &&
    domain.occurrenceSetCount ===
      0 &&
    domain.occurrenceSet.length ===
      0
  );
}

function projectMember(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1,
  member:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetMemberV1,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueMemberV1 {
  return {
    bindingValueMemberId:
      `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1}:${domain.bindingOccurrenceSetDomainId}:${member.bindingOccurrenceSetMemberId}`,

    status: "proven_snapshot_bound_binding_value_member",

    sourceBindingOccurrenceSetMemberId: member.bindingOccurrenceSetMemberId,

    sourceBindingEligibilityOccurrenceId:
      member.sourceBindingEligibilityOccurrenceId,

    sourceFilteringId: member.sourceFilteringId,

    sourceDispositionId: member.sourceDispositionId,

    snapshotIdentityId: member.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId:
      member.snapshotSentenceOccurrenceIdentityId,

    snapshotTokenOccurrenceIdentityId: member.snapshotTokenOccurrenceIdentityId,

    graphDocumentId: member.graphDocumentId,

    sentenceNodeId: member.sentenceNodeId,

    sentenceIndex: member.sentenceIndex,

    tokenNodeId: member.tokenNodeId,

    containmentEdgeId: member.containmentEdgeId,

    sentenceTokenIndex: member.sentenceTokenIndex,
  };
}

function projectCollectionValue(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingCollectionValueV1 {
  const members = domain.occurrenceSet.map(
    (
      member,
    ) =>
      projectMember(
        domain,
        member,
      ),
  );

  return {
    bindingValueId:
      `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1}:${domain.bindingOccurrenceSetDomainId}`,

    status: "proven_snapshot_bound_binding_collection_value",

    valueKind: "ordered_snapshot_token_occurrence_collection",

    manifestId: domain.manifestId,

    manifestCode: domain.manifestCode,

    referencedBindingName: domain.referencedBindingName,

    bindingDefinitionAuthorityId: domain.bindingDefinitionAuthorityId,

    expectedSiteAuthorityId: domain.expectedSiteAuthorityId,

    snapshotIdentityId: domain.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId:
      domain.snapshotSentenceOccurrenceIdentityId,

    graphDocumentId: domain.graphDocumentId,

    sentenceNodeId: domain.sentenceNodeId,

    sentenceIndex: domain.sentenceIndex,

    cardinalityLabel: domain.cardinalityLabel,

    members,

    memberCount: members.length,
  };
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1
  >[3],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1
  >[4],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1
  >[5],
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionResultV1
> {
  const setResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    !exactSetResult(
      setResult,
    )
  ) {
    return blockedResult([
      "current_snapshot_bound_binding_occurrence_set:not_exact_ready",

      ...setResult.blockingReasons.map(
        (reason) => `current_snapshot_bound_binding_occurrence_set:${reason}`,
      ),
    ]);
  }

  const setAuthority = setResult.authority;

  if (
    !uniqueById(
      setAuthority.domainBindingOccurrenceSet,
      (
        domain,
      ) => domain.bindingOccurrenceSetDomainId,
    )
  ) {
    return blockedResult([
      "binding_occurrence_set_domain_id:duplicate",
    ]);
  }

  const domainBindingValueProjection:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1[] =
      [];

  for (
    const domain of setAuthority.domainBindingOccurrenceSet
  ) {
    if (
      !uniqueById(
        domain.occurrenceSet,
        (
          member,
        ) => member.bindingOccurrenceSetMemberId,
      )
    ) {
      return blockedResult([
        `binding_occurrence_set_member_id:duplicate:${domain.bindingOccurrenceSetDomainId}`,
      ]);
    }

    if (
      !uniqueById(
        domain.occurrenceSet,
        (
          member,
        ) => member.snapshotTokenOccurrenceIdentityId,
      )
    ) {
      return blockedResult([
        `snapshot_token_occurrence_identity_id:duplicate:${domain.bindingOccurrenceSetDomainId}`,
      ]);
    }

    let projectionState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionStateV1;

    let bindingValueProjected: boolean;

    let bindingValue:
      | CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingCollectionValueV1
      | null;

    if (
      domain.materializationState ===
        "materialized"
    ) {
      if (
        !exactMaterializedDomain(
          domain,
        )
      ) {
        return blockedResult([
          `materialized_occurrence_set_domain:not_exact:${domain.bindingOccurrenceSetDomainId}`,
        ]);
      }

      bindingValue = projectCollectionValue(
        domain,
      );

      if (
        bindingValue.memberCount !==
          domain.occurrenceSetCount
      ) {
        return blockedResult([
          `binding_value_member_count:not_exact:${domain.bindingOccurrenceSetDomainId}`,
        ]);
      }

      projectionState = "projected";

      bindingValueProjected = true;
    } else if (
      domain.materializationState ===
        "not_materialized_unresolved"
    ) {
      if (
        !exactUnresolvedDomain(
          domain,
        )
      ) {
        return blockedResult([
          `unresolved_occurrence_set_domain:not_exact:${domain.bindingOccurrenceSetDomainId}`,
        ]);
      }

      projectionState = "not_projected_unresolved";

      bindingValueProjected = false;

      bindingValue = null;
    } else if (
      domain.materializationState ===
        "not_materialized_cardinality_violation"
    ) {
      if (
        !exactCardinalityViolationDomain(
          domain,
        )
      ) {
        return blockedResult([
          `cardinality_violation_occurrence_set_domain:not_exact:${domain.bindingOccurrenceSetDomainId}`,
        ]);
      }

      projectionState = "not_projected_cardinality_violation";

      bindingValueProjected = false;

      bindingValue = null;
    } else {
      return blockedResult([
        `binding_occurrence_set_materialization_state:unsupported:${domain.bindingOccurrenceSetDomainId}`,
      ]);
    }

    domainBindingValueProjection.push({
      bindingValueProjectionDomainId:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1}:${domain.bindingOccurrenceSetDomainId}`,

      status: "proven_snapshot_bound_binding_value_projection",

      sourceBindingOccurrenceSetDomainId: domain.bindingOccurrenceSetDomainId,

      sourceBindingEligibilityDomainId: domain.sourceBindingEligibilityDomainId,

      sourceCardinalityEnforcementDomainId:
        domain.sourceCardinalityEnforcementDomainId,

      sourceCardinalitySemanticDomainId:
        domain.sourceCardinalitySemanticDomainId,

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

      cardinalityLabel: domain.cardinalityLabel,

      sourceMaterializationState: domain.materializationState,

      sourceBindingOccurrenceSetMaterialized:
        domain.bindingOccurrenceSetMaterialized,

      sourceOccurrenceSetCount: domain.occurrenceSetCount,

      projectionState,

      bindingValueProjected,

      bindingValue,
    });
  }

  const projectedDomainCount = domainBindingValueProjection.filter(
    (
      domain,
    ) =>
      domain.projectionState ===
        "projected",
  ).length;

  const unresolvedNotProjectedDomainCount = domainBindingValueProjection.filter(
    (
      domain,
    ) =>
      domain.projectionState ===
        "not_projected_unresolved",
  ).length;

  const cardinalityViolationNotProjectedDomainCount =
    domainBindingValueProjection.filter(
      (
        domain,
      ) =>
        domain.projectionState ===
          "not_projected_cardinality_violation",
    ).length;

  const projectedBindingValueCount = domainBindingValueProjection.filter(
    (
      domain,
    ) =>
      domain.bindingValueProjected ===
        true &&
      domain.bindingValue !==
        null,
  ).length;

  const projectedBindingValueMemberCount = domainBindingValueProjection.reduce(
    (
      total,
      domain,
    ) =>
      total +
      (
        domain.bindingValue?.memberCount ??
          0
      ),
    0,
  );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_VERSION_V1,

    status: "ready",

    authority: {
      authorityId:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1}:${setAuthority.authorityId}`,

      status: "proven_current_snapshot_bound_binding_value_projection",

      sourceBindingOccurrenceSetAuthorityId: setAuthority.authorityId,

      sourceBindingEligibilityAuthorityId:
        setAuthority.sourceBindingEligibilityAuthorityId,

      sourceFilteringAuthorityId: setAuthority.sourceFilteringAuthorityId,

      sourceCardinalityEnforcementAuthorityId:
        setAuthority.sourceCardinalityEnforcementAuthorityId,

      sourceCardinalitySemanticsAuthorityId:
        setAuthority.sourceCardinalitySemanticsAuthorityId,

      sourceDispositionAuthorityId: setAuthority.sourceDispositionAuthorityId,

      sourceComparisonAuthorityId: setAuthority.sourceComparisonAuthorityId,

      snapshotIdentityId: setAuthority.snapshotIdentityId,

      graphDocumentId: setAuthority.graphDocumentId,

      sentenceNodeId: setAuthority.sentenceNodeId,

      sentenceIndex: setAuthority.sentenceIndex,

      domainBindingValueProjection,

      domainBindingValueProjectionCount: domainBindingValueProjection.length,

      projectedDomainCount,

      unresolvedNotProjectedDomainCount,

      cardinalityViolationNotProjectedDomainCount,

      projectedBindingValueCount,

      projectedBindingValueMemberCount,

      governance: {
        closedBindingOccurrenceSetPublicDerivationReexecuted: true,

        suppliedBindingOccurrenceSetAcceptedAsProof: false,

        exactBindingOccurrenceSetAuthorityConsumed: true,

        exactBindingOccurrenceSetDomainLineagePreserved: true,

        exactBindingOccurrenceSetMemberLineagePreserved: true,

        onlyMaterializedOccurrenceSetsProjected: true,

        unresolvedOccurrenceSetsNotProjected: true,

        cardinalityViolationOccurrenceSetsNotProjected: true,

        zeroMemberMaterializedSetProjectsEmptyCollectionValue: true,

        collectionValueShapeCanonical: true,

        collectionOrderPreserved: true,

        collectionMultiplicityPreserved: true,

        singletonCollectionCollapsedToScalar: false,

        singletonCollectionTreatedAsWinner: false,

        bindingValueProjectionPerformed: true,

        bindingValueProjected: projectedBindingValueCount >
          0,

        occurrenceBindingPerformed: false,

        finalRuntimeOccurrenceBindingPerformed: false,

        bindingTruthResolved: false,

        runtimeBindingExecuted: false,

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
