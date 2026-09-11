import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-binding-eligibility-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-binding-occurrence-set-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetMaterializationStateV1 =
  | "materialized"
  | "not_materialized_unresolved"
  | "not_materialized_cardinality_violation";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetMemberV1 =
  {
    bindingOccurrenceSetMemberId: string;
    status: "proven_snapshot_bound_binding_occurrence_set_member";

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

    eligibilityState: "eligible";
    bindingEligible: true;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1 =
  {
    bindingOccurrenceSetDomainId: string;
    status: "proven_snapshot_bound_binding_occurrence_set";

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

    sourceOccurrenceCount: number;
    survivingOccurrenceCount: number;
    filteredOutOccurrenceCount: number;
    eligibleOccurrenceCount: number;
    unresolvedSurvivingOccurrenceCount: number;

    cardinalityLabel:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1[
        "cardinalityLabel"
      ];

    minimum: number;

    maximum:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1[
        "maximum"
      ];

    enforcementState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1[
        "enforcementState"
      ];

    cardinalitySatisfied: boolean;

    sourceReadinessState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1[
        "readinessState"
      ];

    sourceBindingReady: boolean;

    materializationState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetMaterializationStateV1;

    bindingOccurrenceSetMaterialized: boolean;

    occurrenceSet:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetMemberV1[];

    occurrenceSetCount: number;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetAuthorityV1 =
  {
    authorityId: string;
    status: "proven_current_snapshot_bound_binding_occurrence_set";

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

    domainBindingOccurrenceSet:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1[];

    domainBindingOccurrenceSetCount: number;

    materializedDomainCount: number;
    unresolvedNotMaterializedDomainCount: number;
    cardinalityViolationNotMaterializedDomainCount: number;

    materializedOccurrenceSetMemberCount: number;

    governance: {
      closedBindingEligibilityPublicDerivationReexecuted: true;
      suppliedBindingEligibilityAcceptedAsProof: false;

      exactEligibilityAuthorityConsumed: true;
      exactEligibilityDomainLineagePreserved: true;
      exactEligibilityOccurrenceLineagePreserved: true;

      onlyBindingReadyDomainsMaterialized: true;
      unresolvedDomainsNotMaterialized: true;
      cardinalityViolationDomainsNotMaterialized: true;

      zeroEligibleReadyDomainMaterializesEmptySet: true;

      occurrenceOrderPreserved: true;
      occurrenceMultiplicityPreserved: true;

      bindingOccurrenceSetMaterializationPerformed: true;
      bindingOccurrenceSetMaterialized: boolean;

      singletonOccurrenceSetTreatedAsWinner: false;
      domainCandidateWinnerSelected: false;
      occurrenceWinnerSelected: false;

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

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_VERSION_V1;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_VERSION_V1;

    status: "blocked";
    authority: null;

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetBlockedResultV1;

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
): CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_VERSION_V1,

    status: "blocked",
    authority: null,

    blockingReasons: stableReasons(
      reasons,
    ),
  };
}

function exactEligibilityResult(
  result: Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1
    >
  >,
): result is Extract<
  Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1
    >
  >,
  { status: "ready" }
> {
  return (
    result.producer ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1 &&
    result.producerVersion ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_VERSION_V1 &&
    result.status === "ready" &&
    result.authority.status ===
      "proven_current_snapshot_bound_binding_eligibility"
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

function exactReadyDomain(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1,
): boolean {
  if (
    domain.readinessState !==
      "ready" ||
    domain.bindingReady !==
      true ||
    domain.cardinalitySatisfied !==
      true ||
    domain.enforcementState !==
      "satisfied" ||
    domain.unresolvedSurvivingOccurrenceCount !==
      0 ||
    domain.eligibleOccurrenceCount !==
      domain.survivingOccurrenceCount
  ) {
    return false;
  }

  const eligibleOccurrences = domain.occurrenceEligibility.filter(
    (
      occurrence,
    ) =>
      occurrence.eligibilityState ===
        "eligible" &&
      occurrence.bindingEligible ===
        true &&
      occurrence.survivesFiltering ===
        true &&
      occurrence.filteringState ===
        "survives" &&
      occurrence.disposition ===
        "satisfied" &&
      occurrence.booleanTruthResolved ===
        true &&
      occurrence.booleanTruth ===
        true,
  );

  return (
    eligibleOccurrences.length ===
      domain.eligibleOccurrenceCount
  );
}

function exactUnresolvedDomain(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1,
): boolean {
  return (
    domain.readinessState ===
      "unresolved_occurrences" &&
    domain.bindingReady ===
      false &&
    domain.cardinalitySatisfied ===
      true &&
    domain.enforcementState ===
      "satisfied" &&
    domain.unresolvedSurvivingOccurrenceCount >
      0
  );
}

function exactCardinalityViolationDomain(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1,
): boolean {
  return (
    domain.readinessState ===
      "cardinality_violation" &&
    domain.bindingReady ===
      false &&
    domain.cardinalitySatisfied ===
      false &&
    (
      domain.enforcementState ===
        "underflow" ||
      domain.enforcementState ===
        "overflow"
    )
  );
}

function materializeOccurrence(
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1,
  occurrence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetMemberV1 {
  return {
    bindingOccurrenceSetMemberId:
      `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1}:${domain.bindingEligibilityDomainId}:${occurrence.bindingEligibilityOccurrenceId}`,

    status: "proven_snapshot_bound_binding_occurrence_set_member",

    sourceBindingEligibilityOccurrenceId:
      occurrence.bindingEligibilityOccurrenceId,

    sourceFilteringId: occurrence.sourceFilteringId,

    sourceDispositionId: occurrence.sourceDispositionId,

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

    eligibilityState: "eligible",

    bindingEligible: true,
  };
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1
  >[3],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1
  >[4],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1
  >[5],
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetResultV1
> {
  const eligibilityResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    !exactEligibilityResult(
      eligibilityResult,
    )
  ) {
    return blockedResult([
      "current_snapshot_bound_binding_eligibility:not_exact_ready",

      ...eligibilityResult.blockingReasons.map(
        (reason) => `current_snapshot_bound_binding_eligibility:${reason}`,
      ),
    ]);
  }

  const eligibilityAuthority = eligibilityResult.authority;

  if (
    !uniqueById(
      eligibilityAuthority.domainBindingEligibility,
      (domain) => domain.bindingEligibilityDomainId,
    )
  ) {
    return blockedResult([
      "binding_eligibility_domain_id:duplicate",
    ]);
  }

  const domainBindingOccurrenceSet:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetDomainV1[] =
      [];

  for (
    const domain of eligibilityAuthority.domainBindingEligibility
  ) {
    if (
      !uniqueById(
        domain.occurrenceEligibility,
        (occurrence) => occurrence.bindingEligibilityOccurrenceId,
      )
    ) {
      return blockedResult([
        `binding_eligibility_occurrence_id:duplicate:${domain.bindingEligibilityDomainId}`,
      ]);
    }

    if (
      !uniqueById(
        domain.occurrenceEligibility,
        (occurrence) => occurrence.snapshotTokenOccurrenceIdentityId,
      )
    ) {
      return blockedResult([
        `snapshot_token_occurrence_identity_id:duplicate:${domain.bindingEligibilityDomainId}`,
      ]);
    }

    let materializationState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetMaterializationStateV1;

    let bindingOccurrenceSetMaterialized: boolean;

    let occurrenceSet:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingOccurrenceSetMemberV1[];

    if (
      domain.readinessState ===
        "ready"
    ) {
      if (
        !exactReadyDomain(
          domain,
        )
      ) {
        return blockedResult([
          `binding_ready_domain:not_exact:${domain.bindingEligibilityDomainId}`,
        ]);
      }

      occurrenceSet = domain.occurrenceEligibility
        .filter(
          (occurrence) =>
            occurrence.eligibilityState ===
              "eligible" &&
            occurrence.bindingEligible ===
              true,
        )
        .map(
          (occurrence) =>
            materializeOccurrence(
              domain,
              occurrence,
            ),
        );

      if (
        occurrenceSet.length !==
          domain.eligibleOccurrenceCount
      ) {
        return blockedResult([
          `materialized_occurrence_count:not_exact:${domain.bindingEligibilityDomainId}`,
        ]);
      }

      materializationState = "materialized";

      bindingOccurrenceSetMaterialized = true;
    } else if (
      domain.readinessState ===
        "unresolved_occurrences"
    ) {
      if (
        !exactUnresolvedDomain(
          domain,
        )
      ) {
        return blockedResult([
          `unresolved_domain:not_exact:${domain.bindingEligibilityDomainId}`,
        ]);
      }

      materializationState = "not_materialized_unresolved";

      bindingOccurrenceSetMaterialized = false;

      occurrenceSet = [];
    } else if (
      domain.readinessState ===
        "cardinality_violation"
    ) {
      if (
        !exactCardinalityViolationDomain(
          domain,
        )
      ) {
        return blockedResult([
          `cardinality_violation_domain:not_exact:${domain.bindingEligibilityDomainId}`,
        ]);
      }

      materializationState = "not_materialized_cardinality_violation";

      bindingOccurrenceSetMaterialized = false;

      occurrenceSet = [];
    } else {
      return blockedResult([
        `binding_readiness_state:unsupported:${domain.bindingEligibilityDomainId}`,
      ]);
    }

    domainBindingOccurrenceSet.push({
      bindingOccurrenceSetDomainId:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1}:${domain.bindingEligibilityDomainId}`,

      status: "proven_snapshot_bound_binding_occurrence_set",

      sourceBindingEligibilityDomainId: domain.bindingEligibilityDomainId,

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

      sourceOccurrenceCount: domain.sourceOccurrenceCount,

      survivingOccurrenceCount: domain.survivingOccurrenceCount,

      filteredOutOccurrenceCount: domain.filteredOutOccurrenceCount,

      eligibleOccurrenceCount: domain.eligibleOccurrenceCount,

      unresolvedSurvivingOccurrenceCount:
        domain.unresolvedSurvivingOccurrenceCount,

      cardinalityLabel: domain.cardinalityLabel,

      minimum: domain.minimum,

      maximum: domain.maximum,

      enforcementState: domain.enforcementState,

      cardinalitySatisfied: domain.cardinalitySatisfied,

      sourceReadinessState: domain.readinessState,

      sourceBindingReady: domain.bindingReady,

      materializationState,

      bindingOccurrenceSetMaterialized,

      occurrenceSet,

      occurrenceSetCount: occurrenceSet.length,
    });
  }

  const materializedDomainCount = domainBindingOccurrenceSet.filter(
    (domain) =>
      domain.materializationState ===
        "materialized",
  ).length;

  const unresolvedNotMaterializedDomainCount =
    domainBindingOccurrenceSet.filter(
      (domain) =>
        domain.materializationState ===
          "not_materialized_unresolved",
    ).length;

  const cardinalityViolationNotMaterializedDomainCount =
    domainBindingOccurrenceSet.filter(
      (domain) =>
        domain.materializationState ===
          "not_materialized_cardinality_violation",
    ).length;

  const materializedOccurrenceSetMemberCount = domainBindingOccurrenceSet
    .reduce(
      (
        total,
        domain,
      ) =>
        total +
        domain.occurrenceSetCount,
      0,
    );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_VERSION_V1,

    status: "ready",

    authority: {
      authorityId:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_OCCURRENCE_SET_V1}:${eligibilityAuthority.authorityId}`,

      status: "proven_current_snapshot_bound_binding_occurrence_set",

      sourceBindingEligibilityAuthorityId: eligibilityAuthority.authorityId,

      sourceFilteringAuthorityId:
        eligibilityAuthority.sourceFilteringAuthorityId,

      sourceCardinalityEnforcementAuthorityId:
        eligibilityAuthority.sourceCardinalityEnforcementAuthorityId,

      sourceCardinalitySemanticsAuthorityId:
        eligibilityAuthority.sourceCardinalitySemanticsAuthorityId,

      sourceDispositionAuthorityId:
        eligibilityAuthority.sourceDispositionAuthorityId,

      sourceComparisonAuthorityId:
        eligibilityAuthority.sourceComparisonAuthorityId,

      snapshotIdentityId: eligibilityAuthority.snapshotIdentityId,

      graphDocumentId: eligibilityAuthority.graphDocumentId,

      sentenceNodeId: eligibilityAuthority.sentenceNodeId,

      sentenceIndex: eligibilityAuthority.sentenceIndex,

      domainBindingOccurrenceSet,

      domainBindingOccurrenceSetCount: domainBindingOccurrenceSet.length,

      materializedDomainCount,

      unresolvedNotMaterializedDomainCount,

      cardinalityViolationNotMaterializedDomainCount,

      materializedOccurrenceSetMemberCount,

      governance: {
        closedBindingEligibilityPublicDerivationReexecuted: true,

        suppliedBindingEligibilityAcceptedAsProof: false,

        exactEligibilityAuthorityConsumed: true,

        exactEligibilityDomainLineagePreserved: true,

        exactEligibilityOccurrenceLineagePreserved: true,

        onlyBindingReadyDomainsMaterialized: true,

        unresolvedDomainsNotMaterialized: true,

        cardinalityViolationDomainsNotMaterialized: true,

        zeroEligibleReadyDomainMaterializesEmptySet: true,

        occurrenceOrderPreserved: true,

        occurrenceMultiplicityPreserved: true,

        bindingOccurrenceSetMaterializationPerformed: true,

        bindingOccurrenceSetMaterialized: materializedDomainCount >
          0,

        singletonOccurrenceSetTreatedAsWinner: false,

        domainCandidateWinnerSelected: false,

        occurrenceWinnerSelected: false,

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
