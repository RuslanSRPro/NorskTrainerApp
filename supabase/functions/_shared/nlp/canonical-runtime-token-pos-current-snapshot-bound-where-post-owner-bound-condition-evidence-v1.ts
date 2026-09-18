import {
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingDomainV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-final-runtime-binding-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-bound-condition-evidence-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainStateV1 =
  | "binding_consumed"
  | "binding_not_consumed_unresolved"
  | "binding_not_consumed_cardinality_violation";

type FinalBindingDomain =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingDomainV1;

type FinalBindingValue = NonNullable<FinalBindingDomain["finalRuntimeBindingValue"]>;

type SourceProjectionDomain = FinalBindingDomain["sourceProjectionDomain"];
type SourceReadinessDomain = SourceProjectionDomain["sourceReadinessDomain"];
type SourceCardinalityEnforcementDomain =
  SourceReadinessDomain["sourceCardinalityEnforcementDomain"];
type SourceCardinalitySemanticDomain =
  SourceCardinalityEnforcementDomain["sourceCardinalitySemanticDomain"];
type SourceSurvivorDomain =
  SourceCardinalitySemanticDomain["sourceSurvivorDomain"];
type SourceFinalWhereDecision = SourceSurvivorDomain["sourceFinalWhereDecision"];
type SourceRootCandidate = SourceFinalWhereDecision["sourceRootCandidate"];

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionCollectionV1 = {
  boundConditionCollectionId: string;
  status: "proven_post_where_owner_bound_condition_collection";
  valueKind: "ordered_snapshot_token_occurrence_collection";
  members: FinalBindingValue["members"];
  memberCount: number;
  sourceFinalRuntimeBindingValue: FinalBindingValue;
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1 = {
  boundConditionDomainEvidenceId: string;
  status: "proven_post_where_owner_bound_condition_domain_evidence";

  structuralAuthorityId: string;
  ownerBindingDefinitionAuthorityId: string;
  manifestId: string;
  manifestCode: string;
  ownerBindingName: string;

  snapshotIdentityId: string;
  snapshotSentenceOccurrenceIdentityId: string;
  graphDocumentId: string;
  sentenceNodeId: string;

  sourceBindingState: FinalBindingDomain["bindingState"];
  boundConditionDomainState:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainStateV1;

  runtimeBindingConsumed: boolean;
  conditionEvidenceProjected: boolean;

  boundConditionCollection:
    | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionCollectionV1
    | null;

  sourceFinalRuntimeBindingDomain: FinalBindingDomain;
  sourceFinalWhereDecision: SourceFinalWhereDecision;
  sourceRootCandidate: SourceRootCandidate;

  governance: {
    exactPostWhereOwnerFinalRuntimeBindingRequired: true;
    exactFinalWhereDecisionPreservedTransitively: true;
    exactA46a1fRootCandidatePreservedTransitively: true;
    rawComparisonV2Rejoined: false;
    referencedBindingIdentityUsedAsOwnerIdentity: false;
    occurrenceWinnerSelected: false;
    emptyFinalBindingProducesEmptyConditionCollection: true;
    emptyFinalBindingSynthesizesOccurrenceEvidence: false;
    bindingConsumptionPerformed: true;
    runtimeBindingConsumed: boolean;
    runtimeBindingExecuted: false;
    runtimeConditionTruthResolved: false;
    bindingTruthResolved: false;
    whereEvaluationPerformed: false;
    whereRecomputed: false;
    learnerErrorClassified: false;
    constraintPropagationInvoked: false;
    graphMutationPerformed: false;
    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceReadyResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_V1;
  producerVersion:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_VERSION_V1;
  specificationId: "late-v1.40:post-where-owner-bound-condition-evidence-v1";
  status: "ready";
  domainBoundConditionEvidence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1[];
  domainCount: number;
  consumedBindingDomainCount: number;
  unconsumedUnresolvedDomainCount: number;
  unconsumedCardinalityViolationDomainCount: number;
  projectedConditionMemberCount: number;
  sourceFinalRuntimeBindingResult: ReturnType<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1
  >;
  blockingReasons: readonly [];
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceBlockedResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_V1;
  producerVersion:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_VERSION_V1;
  specificationId: "late-v1.40:post-where-owner-bound-condition-evidence-v1";
  status: "blocked";
  domainBoundConditionEvidence: [];
  domainCount: 0;
  consumedBindingDomainCount: 0;
  unconsumedUnresolvedDomainCount: 0;
  unconsumedCardinalityViolationDomainCount: 0;
  projectedConditionMemberCount: 0;
  sourceFinalRuntimeBindingResult: ReturnType<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1
  >;
  blockingReasons: readonly string[];
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceBlockedResultV1;

function sourceFinalWhereDecision(
  domain: FinalBindingDomain,
): SourceFinalWhereDecision {
  return domain
    .sourceProjectionDomain
    .sourceReadinessDomain
    .sourceCardinalityEnforcementDomain
    .sourceCardinalitySemanticDomain
    .sourceSurvivorDomain
    .sourceFinalWhereDecision;
}

function projectDomain(
  domain: FinalBindingDomain,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1 | null {
  const finalWhereDecision = sourceFinalWhereDecision(domain);
  const rootCandidate = finalWhereDecision.sourceRootCandidate;

  const common = {
    boundConditionDomainEvidenceId:
      `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_V1}:${domain.id}`,
    status: "proven_post_where_owner_bound_condition_domain_evidence" as const,
    structuralAuthorityId: domain.structuralAuthorityId,
    ownerBindingDefinitionAuthorityId: domain.ownerBindingDefinitionAuthorityId,
    manifestId: domain.manifestId,
    manifestCode: domain.manifestCode,
    ownerBindingName: domain.ownerBindingName,
    snapshotIdentityId: domain.snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId: domain.snapshotSentenceOccurrenceIdentityId,
    graphDocumentId: domain.graphDocumentId,
    sentenceNodeId: domain.sentenceNodeId,
    sourceBindingState: domain.bindingState,
    sourceFinalRuntimeBindingDomain: domain,
    sourceFinalWhereDecision: finalWhereDecision,
    sourceRootCandidate: rootCandidate,
  };

  if (domain.bindingState === "bound") {
    const value = domain.finalRuntimeBindingValue;

    if (domain.finalRuntimeBindingResolved !== true || value === null) return null;

    const collection:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionCollectionV1 = {
        boundConditionCollectionId:
          `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_V1}:${domain.id}:collection`,
        status: "proven_post_where_owner_bound_condition_collection",
        valueKind: "ordered_snapshot_token_occurrence_collection",
        members: value.members,
        memberCount: value.memberCount,
        sourceFinalRuntimeBindingValue: value,
      };

    return {
      ...common,
      boundConditionDomainState: "binding_consumed",
      runtimeBindingConsumed: true,
      conditionEvidenceProjected: true,
      boundConditionCollection: collection,
      governance: {
        exactPostWhereOwnerFinalRuntimeBindingRequired: true,
        exactFinalWhereDecisionPreservedTransitively: true,
        exactA46a1fRootCandidatePreservedTransitively: true,
        rawComparisonV2Rejoined: false,
        referencedBindingIdentityUsedAsOwnerIdentity: false,
        occurrenceWinnerSelected: false,
        emptyFinalBindingProducesEmptyConditionCollection: true,
        emptyFinalBindingSynthesizesOccurrenceEvidence: false,
        bindingConsumptionPerformed: true,
        runtimeBindingConsumed: true,
        runtimeBindingExecuted: false,
        runtimeConditionTruthResolved: false,
        bindingTruthResolved: false,
        whereEvaluationPerformed: false,
        whereRecomputed: false,
        learnerErrorClassified: false,
        constraintPropagationInvoked: false,
        graphMutationPerformed: false,
        frozenGrammarReadOnly: true,
      },
    };
  }

  if (
    domain.bindingState === "not_bound_unresolved" &&
    domain.finalRuntimeBindingResolved === false &&
    domain.finalRuntimeBindingValue === null
  ) {
    return {
      ...common,
      boundConditionDomainState: "binding_not_consumed_unresolved",
      runtimeBindingConsumed: false,
      conditionEvidenceProjected: false,
      boundConditionCollection: null,
      governance: {
        exactPostWhereOwnerFinalRuntimeBindingRequired: true,
        exactFinalWhereDecisionPreservedTransitively: true,
        exactA46a1fRootCandidatePreservedTransitively: true,
        rawComparisonV2Rejoined: false,
        referencedBindingIdentityUsedAsOwnerIdentity: false,
        occurrenceWinnerSelected: false,
        emptyFinalBindingProducesEmptyConditionCollection: true,
        emptyFinalBindingSynthesizesOccurrenceEvidence: false,
        bindingConsumptionPerformed: true,
        runtimeBindingConsumed: false,
        runtimeBindingExecuted: false,
        runtimeConditionTruthResolved: false,
        bindingTruthResolved: false,
        whereEvaluationPerformed: false,
        whereRecomputed: false,
        learnerErrorClassified: false,
        constraintPropagationInvoked: false,
        graphMutationPerformed: false,
        frozenGrammarReadOnly: true,
      },
    };
  }

  if (
    domain.bindingState === "not_bound_cardinality_violation" &&
    domain.finalRuntimeBindingResolved === false &&
    domain.finalRuntimeBindingValue === null
  ) {
    return {
      ...common,
      boundConditionDomainState: "binding_not_consumed_cardinality_violation",
      runtimeBindingConsumed: false,
      conditionEvidenceProjected: false,
      boundConditionCollection: null,
      governance: {
        exactPostWhereOwnerFinalRuntimeBindingRequired: true,
        exactFinalWhereDecisionPreservedTransitively: true,
        exactA46a1fRootCandidatePreservedTransitively: true,
        rawComparisonV2Rejoined: false,
        referencedBindingIdentityUsedAsOwnerIdentity: false,
        occurrenceWinnerSelected: false,
        emptyFinalBindingProducesEmptyConditionCollection: true,
        emptyFinalBindingSynthesizesOccurrenceEvidence: false,
        bindingConsumptionPerformed: true,
        runtimeBindingConsumed: false,
        runtimeBindingExecuted: false,
        runtimeConditionTruthResolved: false,
        bindingTruthResolved: false,
        whereEvaluationPerformed: false,
        whereRecomputed: false,
        learnerErrorClassified: false,
        constraintPropagationInvoked: false,
        graphMutationPerformed: false,
        frozenGrammarReadOnly: true,
      },
    };
  }

  return null;
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceV1(
  sourceSurvivorResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1
  >[0],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1
  >[1],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1
  >[2],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceResultV1 {
  const sourceFinalRuntimeBindingResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1(
      sourceSurvivorResult,
      dependencyAuthorities,
      manifestRows,
    );

  const blocked = (reasons: readonly string[]):
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceBlockedResultV1 => ({
      producer:
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_V1,
      producerVersion:
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_VERSION_V1,
      specificationId: "late-v1.40:post-where-owner-bound-condition-evidence-v1",
      status: "blocked",
      domainBoundConditionEvidence: [],
      domainCount: 0,
      consumedBindingDomainCount: 0,
      unconsumedUnresolvedDomainCount: 0,
      unconsumedCardinalityViolationDomainCount: 0,
      projectedConditionMemberCount: 0,
      sourceFinalRuntimeBindingResult,
      blockingReasons: [...new Set(reasons)].sort(),
    });

  if (sourceFinalRuntimeBindingResult.status !== "ready") {
    return blocked([
      "post_where_owner_final_runtime_binding_blocked",
      ...sourceFinalRuntimeBindingResult.blockingReasons.map(
        (reason) => `post_where_owner_final_runtime_binding:${reason}`,
      ),
    ]);
  }

  const domainBoundConditionEvidence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1[] = [];

  for (const domain of sourceFinalRuntimeBindingResult.domainFinalRuntimeBindings) {
    const evidence = projectDomain(domain);

    if (evidence === null) {
      return blocked([
        `post_where_owner_final_runtime_binding_contract_mismatch:${domain.id}`,
      ]);
    }

    domainBoundConditionEvidence.push(evidence);
  }

  const consumedBindingDomainCount = domainBoundConditionEvidence.filter(
    (domain) => domain.boundConditionDomainState === "binding_consumed",
  ).length;
  const unconsumedUnresolvedDomainCount = domainBoundConditionEvidence.filter(
    (domain) => domain.boundConditionDomainState === "binding_not_consumed_unresolved",
  ).length;
  const unconsumedCardinalityViolationDomainCount =
    domainBoundConditionEvidence.filter(
      (domain) =>
        domain.boundConditionDomainState ===
        "binding_not_consumed_cardinality_violation",
    ).length;
  const projectedConditionMemberCount = domainBoundConditionEvidence.reduce(
    (sum, domain) =>
      sum + (domain.boundConditionCollection?.memberCount ?? 0),
    0,
  );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_V1,
    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_BOUND_CONDITION_EVIDENCE_VERSION_V1,
    specificationId: "late-v1.40:post-where-owner-bound-condition-evidence-v1",
    status: "ready",
    domainBoundConditionEvidence,
    domainCount: domainBoundConditionEvidence.length,
    consumedBindingDomainCount,
    unconsumedUnresolvedDomainCount,
    unconsumedCardinalityViolationDomainCount,
    projectedConditionMemberCount,
    sourceFinalRuntimeBindingResult,
    blockingReasons: [],
  };
}
