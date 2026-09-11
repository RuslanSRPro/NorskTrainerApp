import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringDomainV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringOccurrenceV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringResultV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-occurrence-filtering-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementDomainV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementResultV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-cardinality-enforcement-v1.ts";

// CURRENT Snapshot-Bound Binding Eligibility V1
//
// Ownership boundary:
//
// exact source inputs
//   -> independently reexecute CLOSED occurrence filtering
//   -> independently reexecute CLOSED cardinality enforcement
//   -> exact enforcement-domain -> filtering-domain join
//   -> classify each exact snapshot-bound occurrence for binding eligibility
//   -> derive domain binding readiness
//
// This layer does NOT:
// - choose a winner;
// - materialize a binding occurrence set;
// - perform final Runtime binding;
// - execute WHERE;
// - classify learner error;
// - mutate the graph.
//
// Critical distinction:
//
// cardinality satisfied
//   != all surviving occurrences truth-resolved
//   != binding set materialized
//   != final Runtime binding.

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-binding-eligibility-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceStateV1 =
  | "eligible"
  | "unresolved"
  | "filtered_out";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingReadinessStateV1 =
  | "ready"
  | "unresolved_occurrences"
  | "cardinality_violation";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1 =
  {
    bindingEligibilityOccurrenceId: string;
    status: "proven_snapshot_bound_binding_eligibility";

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

    disposition:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringOccurrenceV1[
        "disposition"
      ];

    booleanTruth: boolean | null;
    booleanTruthResolved: boolean;

    filteringState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringOccurrenceV1[
        "filteringState"
      ];

    survivesFiltering: boolean;

    eligibilityState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceStateV1;

    bindingEligible: boolean;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1 =
  {
    bindingEligibilityDomainId: string;
    status: "proven_snapshot_bound_binding_eligibility";

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

    occurrenceEligibility:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1[];

    sourceOccurrenceCount: number;
    survivingOccurrenceCount: number;
    filteredOutOccurrenceCount: number;

    eligibleOccurrenceCount: number;
    unresolvedSurvivingOccurrenceCount: number;

    cardinalityLabel:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementDomainV1[
        "cardinalityLabel"
      ];

    minimum: number;

    maximum:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementDomainV1[
        "maximum"
      ];

    enforcementState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementDomainV1[
        "enforcementState"
      ];

    cardinalitySatisfied: boolean;

    readinessState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingReadinessStateV1;

    bindingReady: boolean;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityAuthorityV1 =
  {
    authorityId: string;
    status: "proven_current_snapshot_bound_binding_eligibility";

    sourceFilteringAuthorityId: string;
    sourceCardinalityEnforcementAuthorityId: string;
    sourceCardinalitySemanticsAuthorityId: string;

    sourceDispositionAuthorityId: string;
    sourceComparisonAuthorityId: string;

    snapshotIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    domainBindingEligibility:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1[];

    domainBindingEligibilityCount: number;

    readyDomainCount: number;
    unresolvedDomainCount: number;
    cardinalityViolationDomainCount: number;

    governance: {
      closedOccurrenceFilteringPublicDerivationReexecuted: true;
      closedCardinalityEnforcementPublicDerivationReexecuted: true;

      suppliedOccurrenceFilteringAcceptedAsProof: false;
      suppliedCardinalityEnforcementAcceptedAsProof: false;

      exactFilteringAuthorityJoinRequired: true;
      exactFilteringDomainJoinRequired: true;

      snapshotIdentityPreserved: true;
      snapshotSentenceOccurrenceIdentityPreserved: true;
      snapshotTokenOccurrenceIdentityPreserved: true;

      filteringTruthConsumedNotRecomputed: true;

      provenSatisfiedOnlyBindingEligible: true;
      unresolvedSurvivorBlocksBindingReadiness: true;
      cardinalitySatisfiedRequiredForBindingReadiness: true;

      cardinalityViolationIsBlockingFailure: false;

      bindingEligibilityResolved: true;
      bindingReadinessResolved: true;

      singletonSurvivorTreatedAsWinner: false;
      domainCandidateWinnerSelected: false;
      occurrenceWinnerSelected: false;

      bindingOccurrenceSetMaterialized: false;
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

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_VERSION_V1;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_VERSION_V1;

    status: "blocked";

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityBlockedResultV1;

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
): CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_VERSION_V1,

    status: "blocked",

    blockingReasons: stableReasons(
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

function occurrenceEligibilityState(
  occurrence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringOccurrenceV1,
):
  | {
    state:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceStateV1;
    eligible: boolean;
  }
  | null {
  if (
    occurrence.filteringState ===
      "filtered_out" &&
    occurrence.survivesFiltering ===
      false &&
    occurrence.disposition ===
      "rejected" &&
    occurrence.booleanTruthResolved ===
      true &&
    occurrence.booleanTruth ===
      false
  ) {
    return {
      state: "filtered_out",
      eligible: false,
    };
  }

  if (
    occurrence.filteringState ===
      "survives" &&
    occurrence.survivesFiltering ===
      true &&
    occurrence.disposition ===
      "satisfied" &&
    occurrence.booleanTruthResolved ===
      true &&
    occurrence.booleanTruth ===
      true
  ) {
    return {
      state: "eligible",
      eligible: true,
    };
  }

  if (
    occurrence.filteringState ===
      "survives" &&
    occurrence.survivesFiltering ===
      true &&
    (
      occurrence.disposition ===
        "uncertain" ||
      occurrence.disposition ===
        "unavailable" ||
      occurrence.disposition ===
        "blocked"
    ) &&
    occurrence.booleanTruthResolved ===
      false &&
    occurrence.booleanTruth ===
      null
  ) {
    return {
      state: "unresolved",
      eligible: false,
    };
  }

  return null;
}

function exactFilteringResult(
  source:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringResultV1,
): source is Extract<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringResultV1,
  { status: "ready" }
> {
  return (
    source.producer ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_V1 &&
    source.producerVersion ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_OCCURRENCE_FILTERING_VERSION_V1 &&
    source.status ===
      "ready"
  );
}

function exactEnforcementResult(
  source:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementResultV1,
): source is Extract<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementResultV1,
  { status: "ready" }
> {
  return (
    source.producer ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_V1 &&
    source.producerVersion ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_ENFORCEMENT_VERSION_V1 &&
    source.status ===
      "ready"
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
    const current = id(
      value,
    );

    if (
      seen.has(
        current,
      )
    ) {
      return false;
    }

    seen.add(
      current,
    );
  }

  return true;
}

function exactDomainJoin(
  enforcementDomain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementDomainV1,
  filteringDomain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringDomainV1,
): boolean {
  return (
    enforcementDomain.sourceFilteringDomainId ===
      filteringDomain.filteringDomainId &&
    enforcementDomain.expectedSiteAuthorityId ===
      filteringDomain.expectedSiteAuthorityId &&
    enforcementDomain.snapshotIdentityId ===
      filteringDomain.snapshotIdentityId &&
    enforcementDomain.snapshotSentenceOccurrenceIdentityId ===
      filteringDomain.snapshotSentenceOccurrenceIdentityId &&
    enforcementDomain.graphDocumentId ===
      filteringDomain.graphDocumentId &&
    enforcementDomain.sentenceNodeId ===
      filteringDomain.sentenceNodeId &&
    enforcementDomain.sentenceIndex ===
      filteringDomain.sentenceIndex &&
    enforcementDomain.sourceOccurrenceCount ===
      filteringDomain.sourceOccurrenceCount &&
    enforcementDomain.survivingOccurrenceCount ===
      filteringDomain.survivingOccurrenceCount &&
    enforcementDomain.filteredOutOccurrenceCount ===
      filteringDomain.filteredOutOccurrenceCount
  );
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementV1
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementV1
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementV1
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementV1
  >[3],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementV1
  >[4],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementV1
  >[5],
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityResultV1
> {
  const filteringResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
    );

  if (
    !exactFilteringResult(
      filteringResult,
    )
  ) {
    return blockedResult([
      "current_snapshot_bound_occurrence_filtering:not_exact_ready",
      ...filteringResult.blockingReasons.map(
        (reason) => `current_snapshot_bound_occurrence_filtering:${reason}`,
      ),
    ]);
  }

  const enforcementResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityEnforcementV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    !exactEnforcementResult(
      enforcementResult,
    )
  ) {
    return blockedResult([
      "current_snapshot_bound_cardinality_enforcement:not_exact_ready",
      ...enforcementResult.blockingReasons.map(
        (reason) => `current_snapshot_bound_cardinality_enforcement:${reason}`,
      ),
    ]);
  }

  const filteringAuthority = filteringResult.authority;

  const enforcementAuthority = enforcementResult.authority;

  if (
    enforcementAuthority.sourceFilteringAuthorityId !==
      filteringAuthority.authorityId ||
    enforcementAuthority.snapshotIdentityId !==
      filteringAuthority.snapshotIdentityId ||
    enforcementAuthority.graphDocumentId !==
      filteringAuthority.graphDocumentId ||
    enforcementAuthority.sentenceNodeId !==
      filteringAuthority.sentenceNodeId ||
    enforcementAuthority.sentenceIndex !==
      filteringAuthority.sentenceIndex
  ) {
    return blockedResult([
      "filtering_enforcement_authority_lineage:not_exact_match",
    ]);
  }

  if (
    !uniqueById(
      filteringAuthority.domainFiltering,
      (domain) => domain.filteringDomainId,
    )
  ) {
    return blockedResult([
      "filtering_domain_id:duplicate",
    ]);
  }

  if (
    !uniqueById(
      enforcementAuthority.domainCardinalityEnforcement,
      (domain) => domain.cardinalityEnforcementDomainId,
    )
  ) {
    return blockedResult([
      "cardinality_enforcement_domain_id:duplicate",
    ]);
  }

  const filteringDomainsById = new Map<
    string,
    CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringDomainV1
  >();

  for (
    const domain of filteringAuthority.domainFiltering
  ) {
    filteringDomainsById.set(
      domain.filteringDomainId,
      domain,
    );
  }

  const reasons: string[] = [];

  const domainBindingEligibility:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityDomainV1[] =
      [];

  for (
    const enforcementDomain of enforcementAuthority.domainCardinalityEnforcement
  ) {
    const filteringDomain = filteringDomainsById.get(
      enforcementDomain.sourceFilteringDomainId,
    );

    if (
      !filteringDomain
    ) {
      reasons.push(
        `filtering_domain:${enforcementDomain.sourceFilteringDomainId}:missing`,
      );

      continue;
    }

    if (
      !exactDomainJoin(
        enforcementDomain,
        filteringDomain,
      )
    ) {
      reasons.push(
        `filtering_domain:${enforcementDomain.sourceFilteringDomainId}:lineage_mismatch`,
      );

      continue;
    }

    if (
      !uniqueById(
        filteringDomain.occurrenceFiltering,
        (occurrence) => occurrence.snapshotTokenOccurrenceIdentityId,
      )
    ) {
      reasons.push(
        `filtering_domain:${filteringDomain.filteringDomainId}:duplicate_snapshot_token_occurrence_identity`,
      );

      continue;
    }

    const occurrenceEligibility:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1[] =
        [];

    let occurrenceStateInvalid = false;

    for (
      const occurrence of filteringDomain.occurrenceFiltering
    ) {
      const classification = occurrenceEligibilityState(
        occurrence,
      );

      if (
        classification ===
          null
      ) {
        reasons.push(
          `filtering_occurrence:${occurrence.filteringId}:truth_filtering_state_inconsistent`,
        );

        occurrenceStateInvalid = true;

        continue;
      }

      occurrenceEligibility.push({
        bindingEligibilityOccurrenceId: [
          CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1,
          "occurrence",
          idPart(
            occurrence.filteringId,
          ),
        ].join(
          ":",
        ),

        status: "proven_snapshot_bound_binding_eligibility",

        sourceFilteringId: occurrence.filteringId,

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

        disposition: occurrence.disposition,

        booleanTruth: occurrence.booleanTruth,

        booleanTruthResolved: occurrence.booleanTruthResolved,

        filteringState: occurrence.filteringState,

        survivesFiltering: occurrence.survivesFiltering,

        eligibilityState: classification.state,

        bindingEligible: classification.eligible,
      });
    }

    if (
      occurrenceStateInvalid
    ) {
      continue;
    }

    const survivingFromOccurrences = occurrenceEligibility.filter(
      (occurrence) => occurrence.survivesFiltering,
    ).length;

    const filteredOutFromOccurrences = occurrenceEligibility.filter(
      (occurrence) =>
        occurrence.eligibilityState ===
          "filtered_out",
    ).length;

    if (
      occurrenceEligibility.length !==
        filteringDomain.sourceOccurrenceCount ||
      survivingFromOccurrences !==
        filteringDomain.survivingOccurrenceCount ||
      filteredOutFromOccurrences !==
        filteringDomain.filteredOutOccurrenceCount
    ) {
      reasons.push(
        `filtering_domain:${filteringDomain.filteringDomainId}:occurrence_count_mismatch`,
      );

      continue;
    }

    const eligibleOccurrenceCount = occurrenceEligibility.filter(
      (occurrence) =>
        occurrence.eligibilityState ===
          "eligible",
    ).length;

    const unresolvedSurvivingOccurrenceCount = occurrenceEligibility.filter(
      (occurrence) =>
        occurrence.eligibilityState ===
          "unresolved",
    ).length;

    let readinessState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingReadinessStateV1;

    if (
      enforcementDomain.cardinalitySatisfied !==
        true ||
      enforcementDomain.enforcementState !==
        "satisfied"
    ) {
      readinessState = "cardinality_violation";
    } else if (
      unresolvedSurvivingOccurrenceCount >
        0
    ) {
      readinessState = "unresolved_occurrences";
    } else {
      readinessState = "ready";
    }

    const bindingReady = readinessState ===
      "ready";

    if (
      bindingReady &&
      eligibleOccurrenceCount !==
        filteringDomain.survivingOccurrenceCount
    ) {
      reasons.push(
        `filtering_domain:${filteringDomain.filteringDomainId}:ready_domain_contains_non_eligible_survivor`,
      );

      continue;
    }

    domainBindingEligibility.push({
      bindingEligibilityDomainId: [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1,
        "domain",
        idPart(
          enforcementDomain.cardinalityEnforcementDomainId,
        ),
      ].join(
        ":",
      ),

      status: "proven_snapshot_bound_binding_eligibility",

      sourceCardinalityEnforcementDomainId:
        enforcementDomain.cardinalityEnforcementDomainId,

      sourceCardinalitySemanticDomainId:
        enforcementDomain.sourceCardinalitySemanticDomainId,

      sourceFilteringDomainId: enforcementDomain.sourceFilteringDomainId,

      expectedSiteAuthorityId: enforcementDomain.expectedSiteAuthorityId,

      bindingDefinitionAuthorityId:
        enforcementDomain.bindingDefinitionAuthorityId,

      manifestId: enforcementDomain.manifestId,

      manifestCode: enforcementDomain.manifestCode,

      referencedBindingName: enforcementDomain.referencedBindingName,

      snapshotIdentityId: enforcementDomain.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        enforcementDomain.snapshotSentenceOccurrenceIdentityId,

      graphDocumentId: enforcementDomain.graphDocumentId,

      sentenceNodeId: enforcementDomain.sentenceNodeId,

      sentenceIndex: enforcementDomain.sentenceIndex,

      occurrenceEligibility,

      sourceOccurrenceCount: enforcementDomain.sourceOccurrenceCount,

      survivingOccurrenceCount: enforcementDomain.survivingOccurrenceCount,

      filteredOutOccurrenceCount: enforcementDomain.filteredOutOccurrenceCount,

      eligibleOccurrenceCount,

      unresolvedSurvivingOccurrenceCount,

      cardinalityLabel: enforcementDomain.cardinalityLabel,

      minimum: enforcementDomain.minimum,

      maximum: enforcementDomain.maximum,

      enforcementState: enforcementDomain.enforcementState,

      cardinalitySatisfied: enforcementDomain.cardinalitySatisfied,

      readinessState,

      bindingReady,
    });
  }

  if (
    reasons.length >
      0
  ) {
    return blockedResult(
      reasons,
    );
  }

  if (
    domainBindingEligibility.length !==
      enforcementAuthority.domainCardinalityEnforcementCount
  ) {
    return blockedResult([
      "binding_eligibility_domain_count:not_exact_enforcement_domain_count",
    ]);
  }

  const readyDomainCount = domainBindingEligibility.filter(
    (domain) =>
      domain.readinessState ===
        "ready",
  ).length;

  const unresolvedDomainCount = domainBindingEligibility.filter(
    (domain) =>
      domain.readinessState ===
        "unresolved_occurrences",
  ).length;

  const cardinalityViolationDomainCount = domainBindingEligibility.filter(
    (domain) =>
      domain.readinessState ===
        "cardinality_violation",
  ).length;

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_VERSION_V1,

    status: "ready",

    authority: {
      authorityId: [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1,
        idPart(
          enforcementAuthority.authorityId,
        ),
        idPart(
          filteringAuthority.authorityId,
        ),
      ].join(
        ":",
      ),

      status: "proven_current_snapshot_bound_binding_eligibility",

      sourceFilteringAuthorityId: filteringAuthority.authorityId,

      sourceCardinalityEnforcementAuthorityId: enforcementAuthority.authorityId,

      sourceCardinalitySemanticsAuthorityId:
        enforcementAuthority.sourceCardinalitySemanticsAuthorityId,

      sourceDispositionAuthorityId:
        enforcementAuthority.sourceDispositionAuthorityId,

      sourceComparisonAuthorityId:
        enforcementAuthority.sourceComparisonAuthorityId,

      snapshotIdentityId: enforcementAuthority.snapshotIdentityId,

      graphDocumentId: enforcementAuthority.graphDocumentId,

      sentenceNodeId: enforcementAuthority.sentenceNodeId,

      sentenceIndex: enforcementAuthority.sentenceIndex,

      domainBindingEligibility,

      domainBindingEligibilityCount: domainBindingEligibility.length,

      readyDomainCount,

      unresolvedDomainCount,

      cardinalityViolationDomainCount,

      governance: {
        closedOccurrenceFilteringPublicDerivationReexecuted: true,

        closedCardinalityEnforcementPublicDerivationReexecuted: true,

        suppliedOccurrenceFilteringAcceptedAsProof: false,

        suppliedCardinalityEnforcementAcceptedAsProof: false,

        exactFilteringAuthorityJoinRequired: true,

        exactFilteringDomainJoinRequired: true,

        snapshotIdentityPreserved: true,

        snapshotSentenceOccurrenceIdentityPreserved: true,

        snapshotTokenOccurrenceIdentityPreserved: true,

        filteringTruthConsumedNotRecomputed: true,

        provenSatisfiedOnlyBindingEligible: true,

        unresolvedSurvivorBlocksBindingReadiness: true,

        cardinalitySatisfiedRequiredForBindingReadiness: true,

        cardinalityViolationIsBlockingFailure: false,

        bindingEligibilityResolved: true,

        bindingReadinessResolved: true,

        singletonSurvivorTreatedAsWinner: false,

        domainCandidateWinnerSelected: false,

        occurrenceWinnerSelected: false,

        bindingOccurrenceSetMaterialized: false,

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
