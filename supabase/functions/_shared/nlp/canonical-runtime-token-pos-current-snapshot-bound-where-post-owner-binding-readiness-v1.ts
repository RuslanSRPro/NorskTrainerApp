import {
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementDomainV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementResultV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-enforcement-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-binding-readiness-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_VERSION_V1 =
  "1.0.0" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_SPECIFICATION_ID_V1 =
  "late-v1.40:post-where-owner-binding-readiness-v1" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingEligibilityOccurrenceStateV1 =
  | "eligible"
  | "unresolved"
  | "filtered_out";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessStateV1 =
  | "ready"
  | "unresolved_occurrences"
  | "cardinality_violation";

type SourceSurvivorDomainV1 =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementDomainV1[
    "sourceCardinalitySemanticDomain"
  ]["sourceSurvivorDomain"];

type SourceSurvivorOccurrenceV1 =
  SourceSurvivorDomainV1["occurrenceDecisions"][number];

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingEligibilityOccurrenceV1 =
  {
    bindingEligibilityOccurrenceId: string;
    status: "proven_post_where_owner_binding_eligibility";

    ownerBindingDefinitionAuthorityId: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;
    graphDocumentId: string;
    sentenceNodeId: string;

    sourceOccurrenceDecision: SourceSurvivorOccurrenceV1;

    occurrenceState: SourceSurvivorOccurrenceV1["occurrenceState"];

    eligibilityState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingEligibilityOccurrenceStateV1;

    bindingEligible: boolean;

    governance: {
      exactPostWhereOwnerSurvivorOccurrenceRequired: true;
      survivorStateConsumedWithoutRecomputation: true;
      rejectedOccurrenceTreatedAsEligible: false;
      uncertainSurvivorTreatedAsEligible: false;
      provenSurvivorTreatedAsEligible: true;
      whereEvaluationPerformed: false;
      whereTruthRecomputed: false;
      occurrenceWinnerSelected: false;
      finalRuntimeOccurrenceBindingPerformed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessDomainV1 =
  {
    bindingReadinessDomainId: string;
    status: "proven_post_where_owner_binding_readiness";

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
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementDomainV1[
        "cardinalityLabel"
      ];

    minimum: number;

    maximum:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementDomainV1[
        "maximum"
      ];

    cardinalityEnforcementState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementDomainV1[
        "enforcementState"
      ];

    cardinalitySatisfied: boolean;

    occurrenceEligibility:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingEligibilityOccurrenceV1[];

    eligibleOccurrenceCount: number;
    unresolvedOccurrenceCount: number;
    filteredOutOccurrenceCount: number;

    readinessState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessStateV1;

    bindingReady: boolean;

    sourceCardinalityEnforcementDomain:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementDomainV1;

    governance: {
      exactPostWhereOwnerCardinalityEnforcementDomainRequired: true;
      cardinalityEnforcementConsumedWithoutRecomputation: true;
      exactPostWhereOwnerSurvivorDomainRequired: true;
      survivorOccurrenceStatesConsumedWithoutRecomputation: true;
      uncertaintyReadinessResolvedHere: true;
      cardinalityViolationTakesReadinessPrecedence: true;
      unresolvedSurvivorBlocksBindingReadiness: true;
      readyRequiresAllSurvivingOccurrencesEligible: true;
      bindingOccurrenceSetMaterialized: false;
      occurrenceWinnerSelected: false;
      finalRuntimeOccurrenceBindingPerformed: false;
      whereEvaluationPerformed: false;
      whereTruthRecomputed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_V1;

    version:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_SPECIFICATION_ID_V1;

    status: "ready";

    sourceCardinalityEnforcementResult:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementResultV1;

    domainBindingReadiness:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessDomainV1[];

    domainCount: number;
    readyDomainCount: number;
    unresolvedDomainCount: number;
    cardinalityViolationDomainCount: number;

    governance: {
      postWhereOwnerCardinalityEnforcementPublicDerivationReexecuted: true;
      suppliedCardinalityEnforcementAcceptedAsProof: false;
      exactSourceCardinalityEnforcementResultPreserved: true;
      uncertaintyReadinessResolved: true;
      bindingOccurrenceSetMaterialized: false;
      occurrenceWinnerSelected: false;
      finalRuntimeOccurrenceBindingPerformed: false;
      whereEvaluationPerformed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_V1;

    version:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_SPECIFICATION_ID_V1;

    status: "blocked";

    sourceCardinalityEnforcementResult:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementResultV1;

    domainBindingReadiness: readonly [];
    domainCount: 0;
    readyDomainCount: 0;
    unresolvedDomainCount: 0;
    cardinalityViolationDomainCount: 0;

    blockingReasons: readonly string[];

    governance: {
      postWhereOwnerCardinalityEnforcementPublicDerivationReexecuted: true;
      suppliedCardinalityEnforcementAcceptedAsProof: false;
      uncertaintyReadinessResolved: false;
      bindingOccurrenceSetMaterialized: false;
      occurrenceWinnerSelected: false;
      finalRuntimeOccurrenceBindingPerformed: false;
      whereEvaluationPerformed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessBlockedResultV1;

function idPart(
  value: string,
): string {
  return encodeURIComponent(value);
}

function classifyOccurrence(
  occurrence: SourceSurvivorOccurrenceV1,
): {
  state:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingEligibilityOccurrenceStateV1;
  eligible: boolean;
} {
  if (occurrence.occurrenceState === "rejected") {
    return {
      state: "filtered_out",
      eligible: false,
    };
  }

  if (occurrence.occurrenceState === "uncertain_survivor") {
    return {
      state: "unresolved",
      eligible: false,
    };
  }

  return {
    state: "eligible",
    eligible: true,
  };
}

function blocked(
  sourceCardinalityEnforcementResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementResultV1,
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_V1,
    version:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_VERSION_V1,
    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_SPECIFICATION_ID_V1,

    status: "blocked",

    sourceCardinalityEnforcementResult,

    domainBindingReadiness: [],
    domainCount: 0,
    readyDomainCount: 0,
    unresolvedDomainCount: 0,
    cardinalityViolationDomainCount: 0,

    blockingReasons: reasons,

    governance: {
      postWhereOwnerCardinalityEnforcementPublicDerivationReexecuted: true,
      suppliedCardinalityEnforcementAcceptedAsProof: false,
      uncertaintyReadinessResolved: false,
      bindingOccurrenceSetMaterialized: false,
      occurrenceWinnerSelected: false,
      finalRuntimeOccurrenceBindingPerformed: false,
      whereEvaluationPerformed: false,
      learnerErrorClassified: false,
      graphMutationPerformed: false,
      frozenGrammarReadOnly: true,
    },
  };
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessV1(
  sourceSurvivorResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementV1
  >[0],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementV1
  >[1],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementV1
  >[2],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessResultV1 {
  const enforcementResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementV1(
      sourceSurvivorResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (enforcementResult.status !== "ready") {
    return blocked(
      enforcementResult,
      [
        "post_where_owner_cardinality_enforcement:not_ready",
        ...enforcementResult.blockingReasons.map(
          (reason) => `post_where_owner_cardinality_enforcement:${reason}`,
        ),
      ],
    );
  }

  const reasons: string[] = [];

  const domainBindingReadiness:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessDomainV1[] = [];

  for (const enforcementDomain of enforcementResult.enforcementDomains) {
    const survivorDomain =
      enforcementDomain.sourceCardinalitySemanticDomain.sourceSurvivorDomain;

    if (
      survivorDomain.ownerBindingDefinitionAuthorityId !==
        enforcementDomain.ownerBindingDefinitionAuthorityId ||
      survivorDomain.snapshotIdentityId !==
        enforcementDomain.snapshotIdentityId ||
      survivorDomain.snapshotSentenceOccurrenceIdentityId !==
        enforcementDomain.snapshotSentenceOccurrenceIdentityId ||
      survivorDomain.graphDocumentId !== enforcementDomain.graphDocumentId ||
      survivorDomain.sentenceNodeId !== enforcementDomain.sentenceNodeId
    ) {
      reasons.push(
        `enforcement_domain:${enforcementDomain.cardinalityEnforcementDomainId}:survivor_domain_lineage_mismatch`,
      );

      continue;
    }

    const occurrenceEligibility:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingEligibilityOccurrenceV1[] =
        survivorDomain.occurrenceDecisions.map(
          (occurrence) => {
            const classification = classifyOccurrence(occurrence);

            return {
              bindingEligibilityOccurrenceId:
                `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_V1}:occurrence:${
                  idPart(occurrence.occurrenceDecisionId)
                }`,

              status: "proven_post_where_owner_binding_eligibility",

              ownerBindingDefinitionAuthorityId:
                enforcementDomain.ownerBindingDefinitionAuthorityId,

              snapshotIdentityId: enforcementDomain.snapshotIdentityId,
              snapshotSentenceOccurrenceIdentityId:
                enforcementDomain.snapshotSentenceOccurrenceIdentityId,
              graphDocumentId: enforcementDomain.graphDocumentId,
              sentenceNodeId: enforcementDomain.sentenceNodeId,

              sourceOccurrenceDecision: occurrence,

              occurrenceState: occurrence.occurrenceState,

              eligibilityState: classification.state,
              bindingEligible: classification.eligible,

              governance: {
                exactPostWhereOwnerSurvivorOccurrenceRequired: true,
                survivorStateConsumedWithoutRecomputation: true,
                rejectedOccurrenceTreatedAsEligible: false,
                uncertainSurvivorTreatedAsEligible: false,
                provenSurvivorTreatedAsEligible: true,
                whereEvaluationPerformed: false,
                whereTruthRecomputed: false,
                occurrenceWinnerSelected: false,
                finalRuntimeOccurrenceBindingPerformed: false,
                learnerErrorClassified: false,
                graphMutationPerformed: false,
                frozenGrammarReadOnly: true,
              },
            };
          },
        );

    const survivingFromOccurrences = occurrenceEligibility.filter(
      (occurrence) => occurrence.occurrenceState !== "rejected",
    ).length;

    const rejectedFromOccurrences = occurrenceEligibility.filter(
      (occurrence) => occurrence.occurrenceState === "rejected",
    ).length;

    const unresolvedOccurrenceCount = occurrenceEligibility.filter(
      (occurrence) => occurrence.eligibilityState === "unresolved",
    ).length;

    const eligibleOccurrenceCount = occurrenceEligibility.filter(
      (occurrence) => occurrence.eligibilityState === "eligible",
    ).length;

    const filteredOutOccurrenceCount = occurrenceEligibility.filter(
      (occurrence) => occurrence.eligibilityState === "filtered_out",
    ).length;

    if (
      occurrenceEligibility.length !== enforcementDomain.sourceOccurrenceCount ||
      survivingFromOccurrences !== enforcementDomain.survivingOccurrenceCount ||
      rejectedFromOccurrences !== enforcementDomain.rejectedOccurrenceCount ||
      unresolvedOccurrenceCount !== enforcementDomain.uncertainSurvivorCount
    ) {
      reasons.push(
        `enforcement_domain:${enforcementDomain.cardinalityEnforcementDomainId}:occurrence_count_lineage_mismatch`,
      );

      continue;
    }

    let readinessState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessStateV1;

    if (
      enforcementDomain.cardinalitySatisfied !== true ||
      enforcementDomain.enforcementState !== "satisfied"
    ) {
      readinessState = "cardinality_violation";
    } else if (unresolvedOccurrenceCount > 0) {
      readinessState = "unresolved_occurrences";
    } else {
      readinessState = "ready";
    }

    const bindingReady = readinessState === "ready";

    if (
      bindingReady &&
      eligibleOccurrenceCount !== enforcementDomain.survivingOccurrenceCount
    ) {
      reasons.push(
        `enforcement_domain:${enforcementDomain.cardinalityEnforcementDomainId}:ready_domain_contains_non_eligible_survivor`,
      );

      continue;
    }

    domainBindingReadiness.push({
      bindingReadinessDomainId:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_V1}:domain:${
          idPart(enforcementDomain.cardinalityEnforcementDomainId)
        }`,

      status: "proven_post_where_owner_binding_readiness",

      structuralAuthorityId: enforcementDomain.structuralAuthorityId,
      ownerBindingDefinitionAuthorityId:
        enforcementDomain.ownerBindingDefinitionAuthorityId,

      manifestId: enforcementDomain.manifestId,
      manifestCode: enforcementDomain.manifestCode,
      ownerBindingName: enforcementDomain.ownerBindingName,

      snapshotIdentityId: enforcementDomain.snapshotIdentityId,
      snapshotSentenceOccurrenceIdentityId:
        enforcementDomain.snapshotSentenceOccurrenceIdentityId,
      graphDocumentId: enforcementDomain.graphDocumentId,
      sentenceNodeId: enforcementDomain.sentenceNodeId,

      sourceOccurrenceCount: enforcementDomain.sourceOccurrenceCount,
      survivingOccurrenceCount: enforcementDomain.survivingOccurrenceCount,
      rejectedOccurrenceCount: enforcementDomain.rejectedOccurrenceCount,
      uncertainSurvivorCount: enforcementDomain.uncertainSurvivorCount,

      cardinalityLabel: enforcementDomain.cardinalityLabel,
      minimum: enforcementDomain.minimum,
      maximum: enforcementDomain.maximum,

      cardinalityEnforcementState: enforcementDomain.enforcementState,
      cardinalitySatisfied: enforcementDomain.cardinalitySatisfied,

      occurrenceEligibility,

      eligibleOccurrenceCount,
      unresolvedOccurrenceCount,
      filteredOutOccurrenceCount,

      readinessState,
      bindingReady,

      sourceCardinalityEnforcementDomain: enforcementDomain,

      governance: {
        exactPostWhereOwnerCardinalityEnforcementDomainRequired: true,
        cardinalityEnforcementConsumedWithoutRecomputation: true,
        exactPostWhereOwnerSurvivorDomainRequired: true,
        survivorOccurrenceStatesConsumedWithoutRecomputation: true,
        uncertaintyReadinessResolvedHere: true,
        cardinalityViolationTakesReadinessPrecedence: true,
        unresolvedSurvivorBlocksBindingReadiness: true,
        readyRequiresAllSurvivingOccurrencesEligible: true,
        bindingOccurrenceSetMaterialized: false,
        occurrenceWinnerSelected: false,
        finalRuntimeOccurrenceBindingPerformed: false,
        whereEvaluationPerformed: false,
        whereTruthRecomputed: false,
        learnerErrorClassified: false,
        graphMutationPerformed: false,
        frozenGrammarReadOnly: true,
      },
    });
  }

  if (
    reasons.length > 0 ||
    domainBindingReadiness.length !== enforcementResult.domainCount
  ) {
    return blocked(
      enforcementResult,
      reasons.length > 0
        ? reasons
        : ["post_where_owner_binding_readiness:domain_count_mismatch"],
    );
  }

  const readyDomainCount = domainBindingReadiness.filter(
    (domain) => domain.readinessState === "ready",
  ).length;

  const unresolvedDomainCount = domainBindingReadiness.filter(
    (domain) => domain.readinessState === "unresolved_occurrences",
  ).length;

  const cardinalityViolationDomainCount = domainBindingReadiness.filter(
    (domain) => domain.readinessState === "cardinality_violation",
  ).length;

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_V1,
    version:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_VERSION_V1,
    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BINDING_READINESS_SPECIFICATION_ID_V1,

    status: "ready",

    sourceCardinalityEnforcementResult: enforcementResult,

    domainBindingReadiness,

    domainCount: domainBindingReadiness.length,
    readyDomainCount,
    unresolvedDomainCount,
    cardinalityViolationDomainCount,

    governance: {
      postWhereOwnerCardinalityEnforcementPublicDerivationReexecuted: true,
      suppliedCardinalityEnforcementAcceptedAsProof: false,
      exactSourceCardinalityEnforcementResultPreserved: true,
      uncertaintyReadinessResolved: true,
      bindingOccurrenceSetMaterialized: false,
      occurrenceWinnerSelected: false,
      finalRuntimeOccurrenceBindingPerformed: false,
      whereEvaluationPerformed: false,
      learnerErrorClassified: false,
      graphMutationPerformed: false,
      frozenGrammarReadOnly: true,
    },
  };
}