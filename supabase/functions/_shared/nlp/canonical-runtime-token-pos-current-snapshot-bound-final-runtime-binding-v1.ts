import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingCollectionValueV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-binding-value-projection-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-final-runtime-binding-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingStateV1 =
  | "bound"
  | "not_bound_unresolved"
  | "not_bound_cardinality_violation";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingValueV1 =
  {
    finalRuntimeBindingValueId: string;
    status: "proven_snapshot_bound_final_runtime_binding_value";

    valueKind: "ordered_snapshot_token_occurrence_collection";

    sourceBindingValueId: string;

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
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingCollectionValueV1[
        "cardinalityLabel"
      ];

    members:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingCollectionValueV1[
        "members"
      ];

    memberCount: number;

    isEmptyCollection: boolean;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1 =
  {
    finalRuntimeBindingDomainId: string;
    status: "proven_snapshot_bound_final_runtime_binding";

    sourceBindingValueProjectionDomainId: string;

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
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1[
        "cardinalityLabel"
      ];

    sourceProjectionState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1[
        "projectionState"
      ];

    sourceBindingValueProjected: boolean;

    bindingState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingStateV1;

    finalRuntimeBindingResolved: boolean;

    finalRuntimeBindingValue:
      | CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingValueV1
      | null;

    boundOccurrenceCount: number;

    occurrenceBindingPerformed: boolean;
    finalRuntimeOccurrenceBindingPerformed: boolean;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingAuthorityV1 =
  {
    authorityId: string;
    status: "proven_current_snapshot_bound_final_runtime_binding";

    sourceBindingValueProjectionAuthorityId: string;

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

    domainFinalRuntimeBinding:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1[];

    domainFinalRuntimeBindingCount: number;

    boundDomainCount: number;
    emptyCollectionBoundDomainCount: number;
    nonEmptyCollectionBoundDomainCount: number;

    unresolvedNotBoundDomainCount: number;
    cardinalityViolationNotBoundDomainCount: number;

    boundOccurrenceCount: number;

    governance: {
      closedBindingValueProjectionPublicDerivationReexecuted: true;
      suppliedBindingValueProjectionAcceptedAsProof: false;

      exactBindingValueProjectionAuthorityConsumed: true;
      exactBindingValueProjectionDomainLineagePreserved: true;
      exactBindingValueMemberLineagePreserved: true;

      onlyProjectedBindingValuesBound: true;
      unresolvedBindingValuesNotBound: true;
      cardinalityViolationBindingValuesNotBound: true;

      canonicalCollectionValuePreserved: true;
      emptyCollectionFinalBindingAllowed: true;

      singletonCollectionCollapsedToScalar: false;
      singletonCollectionTreatedAsWinner: false;

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
      canonicalDependencyEdgeGenerated: false;
      clauseNodeGenerated: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_VERSION_V1;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_VERSION_V1;

    status: "blocked";
    authority: null;

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingBlockedResultV1;

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
): CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_VERSION_V1,

    status: "blocked",

    authority: null,

    blockingReasons: stableReasons(
      reasons,
    ),
  };
}

function exactProjectionResult(
  result: Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1
    >
  >,
): result is Extract<
  Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1
    >
  >,
  { status: "ready" }
> {
  return (
    result.producer ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_V1 &&
    result.producerVersion ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_VALUE_PROJECTION_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.authority.status ===
      "proven_current_snapshot_bound_binding_value_projection"
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

function exactProjectedDomain(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1,
): boolean {
  if (
    domain.projectionState !==
      "projected" ||
    domain.bindingValueProjected !==
      true ||
    domain.bindingValue ===
      null ||
    domain.sourceMaterializationState !==
      "materialized" ||
    domain.sourceBindingOccurrenceSetMaterialized !==
      true
  ) {
    return false;
  }

  const value = domain.bindingValue;

  if (
    value.status !==
      "proven_snapshot_bound_binding_collection_value" ||
    value.valueKind !==
      "ordered_snapshot_token_occurrence_collection" ||
    value.memberCount !==
      value.members.length ||
    value.memberCount !==
      domain.sourceOccurrenceSetCount ||
    value.manifestId !==
      domain.manifestId ||
    value.manifestCode !==
      domain.manifestCode ||
    value.referencedBindingName !==
      domain.referencedBindingName ||
    value.bindingDefinitionAuthorityId !==
      domain.bindingDefinitionAuthorityId ||
    value.expectedSiteAuthorityId !==
      domain.expectedSiteAuthorityId ||
    value.snapshotIdentityId !==
      domain.snapshotIdentityId ||
    value.snapshotSentenceOccurrenceIdentityId !==
      domain.snapshotSentenceOccurrenceIdentityId ||
    value.graphDocumentId !==
      domain.graphDocumentId ||
    value.sentenceNodeId !==
      domain.sentenceNodeId ||
    value.sentenceIndex !==
      domain.sentenceIndex ||
    value.cardinalityLabel !==
      domain.cardinalityLabel
  ) {
    return false;
  }

  return value.members.every(
    (
      member,
    ) =>
      member.status ===
        "proven_snapshot_bound_binding_value_member" &&
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
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1,
): boolean {
  return (
    domain.projectionState ===
      "not_projected_unresolved" &&
    domain.bindingValueProjected ===
      false &&
    domain.bindingValue ===
      null
  );
}

function exactCardinalityViolationDomain(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1,
): boolean {
  return (
    domain.projectionState ===
      "not_projected_cardinality_violation" &&
    domain.bindingValueProjected ===
      false &&
    domain.bindingValue ===
      null
  );
}

function finalBindingValue(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionDomainV1,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingValueV1 {
  const source = domain.bindingValue;

  if (
    source ===
      null
  ) {
    throw new Error(
      "binding_value_projection_missing",
    );
  }

  return {
    finalRuntimeBindingValueId:
      `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1}:${source.bindingValueId}`,

    status: "proven_snapshot_bound_final_runtime_binding_value",

    valueKind: "ordered_snapshot_token_occurrence_collection",

    sourceBindingValueId: source.bindingValueId,

    manifestId: source.manifestId,

    manifestCode: source.manifestCode,

    referencedBindingName: source.referencedBindingName,

    bindingDefinitionAuthorityId: source.bindingDefinitionAuthorityId,

    expectedSiteAuthorityId: source.expectedSiteAuthorityId,

    snapshotIdentityId: source.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId:
      source.snapshotSentenceOccurrenceIdentityId,

    graphDocumentId: source.graphDocumentId,

    sentenceNodeId: source.sentenceNodeId,

    sentenceIndex: source.sentenceIndex,

    cardinalityLabel: source.cardinalityLabel,

    members: source.members,

    memberCount: source.memberCount,

    isEmptyCollection: source.memberCount ===
      0,
  };
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1
  >[3],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1
  >[4],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1
  >[5],
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingResultV1
> {
  const projectionResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingValueProjectionV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    !exactProjectionResult(
      projectionResult,
    )
  ) {
    return blockedResult([
      "current_snapshot_bound_binding_value_projection:not_exact_ready",

      ...projectionResult.blockingReasons.map(
        (reason) => `current_snapshot_bound_binding_value_projection:${reason}`,
      ),
    ]);
  }

  const projectionAuthority = projectionResult.authority;

  if (
    !uniqueById(
      projectionAuthority.domainBindingValueProjection,
      (
        domain,
      ) => domain.bindingValueProjectionDomainId,
    )
  ) {
    return blockedResult([
      "binding_value_projection_domain_id:duplicate",
    ]);
  }

  const domainFinalRuntimeBinding:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1[] =
      [];

  for (
    const domain of projectionAuthority.domainBindingValueProjection
  ) {
    let bindingState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingStateV1;

    let finalRuntimeBindingResolved: boolean;

    let value:
      | CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingValueV1
      | null;

    let boundOccurrenceCount: number;

    let occurrenceBindingPerformed: boolean;

    let finalRuntimeOccurrenceBindingPerformed: boolean;

    if (
      domain.projectionState ===
        "projected"
    ) {
      if (
        !exactProjectedDomain(
          domain,
        )
      ) {
        return blockedResult([
          `projected_binding_value_domain:not_exact:${domain.bindingValueProjectionDomainId}`,
        ]);
      }

      value = finalBindingValue(
        domain,
      );

      bindingState = "bound";

      finalRuntimeBindingResolved = true;

      boundOccurrenceCount = value.memberCount;

      occurrenceBindingPerformed = value.memberCount >
        0;

      finalRuntimeOccurrenceBindingPerformed = value.memberCount >
        0;
    } else if (
      domain.projectionState ===
        "not_projected_unresolved"
    ) {
      if (
        !exactUnresolvedDomain(
          domain,
        )
      ) {
        return blockedResult([
          `unresolved_binding_value_projection:not_exact:${domain.bindingValueProjectionDomainId}`,
        ]);
      }

      bindingState = "not_bound_unresolved";

      finalRuntimeBindingResolved = false;

      value = null;

      boundOccurrenceCount = 0;

      occurrenceBindingPerformed = false;

      finalRuntimeOccurrenceBindingPerformed = false;
    } else if (
      domain.projectionState ===
        "not_projected_cardinality_violation"
    ) {
      if (
        !exactCardinalityViolationDomain(
          domain,
        )
      ) {
        return blockedResult([
          `cardinality_violation_binding_value_projection:not_exact:${domain.bindingValueProjectionDomainId}`,
        ]);
      }

      bindingState = "not_bound_cardinality_violation";

      finalRuntimeBindingResolved = false;

      value = null;

      boundOccurrenceCount = 0;

      occurrenceBindingPerformed = false;

      finalRuntimeOccurrenceBindingPerformed = false;
    } else {
      return blockedResult([
        `binding_value_projection_state:unsupported:${domain.bindingValueProjectionDomainId}`,
      ]);
    }

    domainFinalRuntimeBinding.push({
      finalRuntimeBindingDomainId:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1}:${domain.bindingValueProjectionDomainId}`,

      status: "proven_snapshot_bound_final_runtime_binding",

      sourceBindingValueProjectionDomainId:
        domain.bindingValueProjectionDomainId,

      sourceBindingOccurrenceSetDomainId:
        domain.sourceBindingOccurrenceSetDomainId,

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

      sourceProjectionState: domain.projectionState,

      sourceBindingValueProjected: domain.bindingValueProjected,

      bindingState,

      finalRuntimeBindingResolved,

      finalRuntimeBindingValue: value,

      boundOccurrenceCount,

      occurrenceBindingPerformed,

      finalRuntimeOccurrenceBindingPerformed,
    });
  }

  const boundDomains = domainFinalRuntimeBinding.filter(
    (
      domain,
    ) =>
      domain.bindingState ===
        "bound" &&
      domain.finalRuntimeBindingResolved ===
        true &&
      domain.finalRuntimeBindingValue !==
        null,
  );

  const boundDomainCount = boundDomains.length;

  const emptyCollectionBoundDomainCount = boundDomains.filter(
    (
      domain,
    ) =>
      domain.finalRuntimeBindingValue !==
        null &&
      domain.finalRuntimeBindingValue.memberCount ===
        0,
  ).length;

  const nonEmptyCollectionBoundDomainCount = boundDomains.filter(
    (
      domain,
    ) =>
      domain.finalRuntimeBindingValue !==
        null &&
      domain.finalRuntimeBindingValue.memberCount >
        0,
  ).length;

  const unresolvedNotBoundDomainCount = domainFinalRuntimeBinding.filter(
    (
      domain,
    ) =>
      domain.bindingState ===
        "not_bound_unresolved",
  ).length;

  const cardinalityViolationNotBoundDomainCount =
    domainFinalRuntimeBinding.filter(
      (
        domain,
      ) =>
        domain.bindingState ===
          "not_bound_cardinality_violation",
    ).length;

  const boundOccurrenceCount = domainFinalRuntimeBinding.reduce(
    (
      total,
      domain,
    ) =>
      total +
      domain.boundOccurrenceCount,
    0,
  );

  const occurrenceBindingPerformed = boundOccurrenceCount >
    0;

  const finalRuntimeOccurrenceBindingPerformed = boundOccurrenceCount >
    0;

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_VERSION_V1,

    status: "ready",

    authority: {
      authorityId:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1}:${projectionAuthority.authorityId}`,

      status: "proven_current_snapshot_bound_final_runtime_binding",

      sourceBindingValueProjectionAuthorityId: projectionAuthority.authorityId,

      sourceBindingOccurrenceSetAuthorityId:
        projectionAuthority.sourceBindingOccurrenceSetAuthorityId,

      sourceBindingEligibilityAuthorityId:
        projectionAuthority.sourceBindingEligibilityAuthorityId,

      sourceFilteringAuthorityId:
        projectionAuthority.sourceFilteringAuthorityId,

      sourceCardinalityEnforcementAuthorityId:
        projectionAuthority.sourceCardinalityEnforcementAuthorityId,

      sourceCardinalitySemanticsAuthorityId:
        projectionAuthority.sourceCardinalitySemanticsAuthorityId,

      sourceDispositionAuthorityId:
        projectionAuthority.sourceDispositionAuthorityId,

      sourceComparisonAuthorityId:
        projectionAuthority.sourceComparisonAuthorityId,

      snapshotIdentityId: projectionAuthority.snapshotIdentityId,

      graphDocumentId: projectionAuthority.graphDocumentId,

      sentenceNodeId: projectionAuthority.sentenceNodeId,

      sentenceIndex: projectionAuthority.sentenceIndex,

      domainFinalRuntimeBinding,

      domainFinalRuntimeBindingCount: domainFinalRuntimeBinding.length,

      boundDomainCount,

      emptyCollectionBoundDomainCount,

      nonEmptyCollectionBoundDomainCount,

      unresolvedNotBoundDomainCount,

      cardinalityViolationNotBoundDomainCount,

      boundOccurrenceCount,

      governance: {
        closedBindingValueProjectionPublicDerivationReexecuted: true,

        suppliedBindingValueProjectionAcceptedAsProof: false,

        exactBindingValueProjectionAuthorityConsumed: true,

        exactBindingValueProjectionDomainLineagePreserved: true,

        exactBindingValueMemberLineagePreserved: true,

        onlyProjectedBindingValuesBound: true,

        unresolvedBindingValuesNotBound: true,

        cardinalityViolationBindingValuesNotBound: true,

        canonicalCollectionValuePreserved: true,

        emptyCollectionFinalBindingAllowed: true,

        singletonCollectionCollapsedToScalar: false,

        singletonCollectionTreatedAsWinner: false,

        finalRuntimeBindingResolutionPerformed: true,

        finalRuntimeBindingResolved: boundDomainCount >
          0,

        occurrenceBindingPerformed,

        finalRuntimeOccurrenceBindingPerformed,

        emptyCollectionTreatedAsOccurrenceBinding: false,

        runtimeBindingExecuted: false,

        bindingTruthResolved: false,

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
