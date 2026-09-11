import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-final-runtime-binding-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundDomainComparisonV2,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceComparisonV2,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2,
} from "./canonical-runtime-token-pos-current-snapshot-bound-normalized-comparison-v2.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-bound-condition-evidence-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionDomainStateV1 =
  | "binding_consumed"
  | "binding_not_consumed_unresolved"
  | "binding_not_consumed_cardinality_violation";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionMemberEvidenceV1 =
  {
    boundConditionMemberEvidenceId: string;

    status: "proven_snapshot_bound_bound_condition_member_evidence";

    sourceFinalRuntimeBindingValueId: string;
    sourceBindingValueMemberId: string;

    sourceComparisonId: string;

    expectedSiteAuthorityId: string;
    bindingDefinitionAuthorityId: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;
    snapshotTokenOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    tokenNodeId: string;
    containmentEdgeId: string;
    sentenceTokenIndex: number;

    comparisonState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceComparisonV2[
        "comparisonState"
      ];

    booleanTruthResolved: boolean;
    booleanTruth: boolean | null;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionCollectionV1 =
  {
    boundConditionCollectionId: string;

    status: "proven_snapshot_bound_bound_condition_collection";

    valueKind: "ordered_bound_condition_evidence_collection";

    sourceFinalRuntimeBindingValueId: string;
    sourceComparisonDomainId: string;

    expectedSiteAuthorityId: string;
    bindingDefinitionAuthorityId: string;
    referencedBindingName: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    members:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionMemberEvidenceV1[];

    memberCount: number;

    isEmptyCollection: boolean;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionDomainEvidenceV1 =
  {
    boundConditionDomainEvidenceId: string;

    status: "proven_current_snapshot_bound_bound_condition_domain_evidence";

    sourceFinalRuntimeBindingDomainId: string;

    sourceComparisonDomainId: string | null;

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

    sourceBindingState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1[
        "bindingState"
      ];

    boundConditionDomainState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionDomainStateV1;

    runtimeBindingConsumed: boolean;

    conditionEvidenceProjected: boolean;

    boundConditionCollection:
      | CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionCollectionV1
      | null;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceAuthorityV1 =
  {
    authorityId: string;

    status: "proven_current_snapshot_bound_bound_condition_evidence";

    sourceFinalRuntimeBindingAuthorityId: string;
    sourceComparisonAuthorityId: string;

    snapshotIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;
    sentenceIndex: number;

    domainBoundConditionEvidence:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionDomainEvidenceV1[];

    domainBoundConditionEvidenceCount: number;

    consumedBindingDomainCount: number;
    unconsumedUnresolvedDomainCount: number;
    unconsumedCardinalityViolationDomainCount: number;

    projectedConditionMemberCount: number;

    governance: {
      closedFinalRuntimeBindingPublicDerivationReexecuted: true;
      suppliedFinalRuntimeBindingAcceptedAsProof: false;

      closedCurrentSnapshotBoundComparisonPublicDerivationReexecuted: true;
      suppliedComparisonAcceptedAsProof: false;

      exactFinalBindingAuthorityConsumed: true;
      exactComparisonAuthorityConsumed: true;

      exactExpectedSiteAuthorityJoinRequired: true;
      exactBindingDefinitionAuthorityJoinRequired: true;
      exactReferencedBindingNameJoinRequired: true;

      exactSnapshotIdentityJoinRequired: true;
      exactSnapshotSentenceOccurrenceIdentityJoinRequired: true;
      exactSnapshotTokenOccurrenceIdentityJoinRequired: true;

      tokenNodeIdUsedAsCrossLayerOccurrenceIdentity: false;

      comparisonEvidenceConsumedNotRecomputed: true;

      boundMembersOnlyReceiveConditionEvidence: true;
      unboundDomainsDoNotConsumeRuntimeBinding: true;

      emptyFinalBindingProducesEmptyConditionCollection: true;
      emptyFinalBindingSynthesizesOccurrenceEvidence: false;

      bindingConsumptionPerformed: true;
      runtimeBindingConsumed: boolean;

      runtimeBindingExecuted: false;

      runtimeConditionTruthResolved: false;
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

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_VERSION_V1;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_VERSION_V1;

    status: "blocked";
    authority: null;

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceBlockedResultV1;

function stableReasons(
  reasons: readonly string[],
): string[] {
  return [
    ...new Set(
      reasons.filter(
        (reason) =>
          typeof reason ===
            "string" &&
          reason.length >
            0,
      ),
    ),
  ].sort();
}

function blockedResult(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_VERSION_V1,

    status: "blocked",

    authority: null,

    blockingReasons: stableReasons(
      reasons,
    ),
  };
}

function exactFinalBindingResult(
  result: Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1
    >
  >,
): result is Extract<
  Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1
    >
  >,
  { status: "ready" }
> {
  return (
    result.producer ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_V1 &&
    result.producerVersion ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FINAL_RUNTIME_BINDING_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.authority.status ===
      "proven_current_snapshot_bound_final_runtime_binding"
  );
}

function exactComparisonResult(
  result: Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2
    >
  >,
): result is Extract<
  Awaited<
    ReturnType<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2
    >
  >,
  { status: "ready" }
> {
  return (
    result.producer ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2 &&
    result.producerVersion ===
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2 &&
    result.status ===
      "ready" &&
    result.authority.status ===
      "proven_current_snapshot_bound_pos_comparison"
  );
}

function comparisonDomainMatchesFinalDomain(
  comparison: CanonicalRuntimeTokenPosCurrentSnapshotBoundDomainComparisonV2,
  finalDomain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1,
): boolean {
  return (
    comparison.expectedSiteAuthorityId ===
      finalDomain.expectedSiteAuthorityId &&
    comparison.referencedBindingDefinitionAuthorityId ===
      finalDomain.bindingDefinitionAuthorityId &&
    comparison.referencedBindingName ===
      finalDomain.referencedBindingName &&
    comparison.manifestId ===
      finalDomain.manifestId &&
    comparison.manifestCode ===
      finalDomain.manifestCode &&
    comparison.snapshotIdentityId ===
      finalDomain.snapshotIdentityId &&
    comparison.snapshotSentenceOccurrenceIdentityId ===
      finalDomain.snapshotSentenceOccurrenceIdentityId &&
    comparison.graphDocumentId ===
      finalDomain.graphDocumentId &&
    comparison.sentenceNodeId ===
      finalDomain.sentenceNodeId &&
    comparison.sentenceIndex ===
      finalDomain.sentenceIndex
  );
}

function occurrenceComparisonMatchesBoundMember(
  comparison:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceComparisonV2,
  member: NonNullable<
    CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1[
      "finalRuntimeBindingValue"
    ]
  >[
    "members"
  ][number],
  domain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1,
): boolean {
  return (
    comparison.snapshotIdentityId ===
      domain.snapshotIdentityId &&
    comparison.snapshotSentenceOccurrenceIdentityId ===
      domain.snapshotSentenceOccurrenceIdentityId &&
    comparison.snapshotTokenOccurrenceIdentityId ===
      member.snapshotTokenOccurrenceIdentityId &&
    comparison.graphDocumentId ===
      member.graphDocumentId &&
    comparison.sentenceNodeId ===
      member.sentenceNodeId &&
    comparison.sentenceIndex ===
      member.sentenceIndex &&
    comparison.tokenNodeId ===
      member.tokenNodeId &&
    comparison.containmentEdgeId ===
      member.containmentEdgeId &&
    comparison.sentenceTokenIndex ===
      member.sentenceTokenIndex
  );
}

function projectMember(
  finalDomain:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1,
  comparison:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceComparisonV2,
  member: NonNullable<
    CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1[
      "finalRuntimeBindingValue"
    ]
  >[
    "members"
  ][number],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionMemberEvidenceV1 {
  const value = finalDomain.finalRuntimeBindingValue;

  if (
    value ===
      null
  ) {
    throw new Error(
      "final_runtime_binding_value_missing",
    );
  }

  return {
    boundConditionMemberEvidenceId:
      `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1}:${value.finalRuntimeBindingValueId}:${member.bindingValueMemberId}:${comparison.comparisonId}`,

    status: "proven_snapshot_bound_bound_condition_member_evidence",

    sourceFinalRuntimeBindingValueId: value.finalRuntimeBindingValueId,

    sourceBindingValueMemberId: member.bindingValueMemberId,

    sourceComparisonId: comparison.comparisonId,

    expectedSiteAuthorityId: finalDomain.expectedSiteAuthorityId,

    bindingDefinitionAuthorityId: finalDomain.bindingDefinitionAuthorityId,

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

    comparisonState: comparison.comparisonState,

    booleanTruthResolved: comparison.booleanTruthResolved,

    booleanTruth: comparison.booleanTruth,
  };
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1
  >[3],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1
  >[4],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1
  >[5],
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceResultV1
> {
  const finalBindingResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    !exactFinalBindingResult(
      finalBindingResult,
    )
  ) {
    return blockedResult([
      "final_runtime_binding:not_exact_ready",

      ...finalBindingResult.blockingReasons.map(
        (reason) => `final_runtime_binding:${reason}`,
      ),
    ]);
  }

  const comparisonResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
    );

  if (
    !exactComparisonResult(
      comparisonResult,
    )
  ) {
    return blockedResult([
      "current_snapshot_bound_comparison:not_exact_ready",

      ...comparisonResult.blockingReasons.map(
        (reason) => `current_snapshot_bound_comparison:${reason}`,
      ),
    ]);
  }

  const finalAuthority = finalBindingResult.authority;

  const comparisonAuthority = comparisonResult.authority;

  if (
    finalAuthority.snapshotIdentityId !==
      comparisonAuthority.snapshotIdentityId ||
    finalAuthority.graphDocumentId !==
      comparisonAuthority.graphDocumentId ||
    finalAuthority.sentenceNodeId !==
      comparisonAuthority.sentenceNodeId ||
    finalAuthority.sentenceIndex !==
      comparisonAuthority.sentenceIndex
  ) {
    return blockedResult([
      "final_binding_comparison_authority_context:mismatch",
    ]);
  }

  const domainBoundConditionEvidence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionDomainEvidenceV1[] =
      [];

  for (
    const finalDomain of finalAuthority.domainFinalRuntimeBinding
  ) {
    if (
      finalDomain.bindingState ===
        "bound"
    ) {
      const value = finalDomain.finalRuntimeBindingValue;

      if (
        finalDomain.finalRuntimeBindingResolved !==
          true ||
        value ===
          null
      ) {
        return blockedResult([
          `bound_final_domain:not_exact:${finalDomain.finalRuntimeBindingDomainId}`,
        ]);
      }

      const matchingComparisonDomains = comparisonAuthority.domainComparisons
        .filter(
          (comparison) =>
            comparisonDomainMatchesFinalDomain(
              comparison,
              finalDomain,
            ),
        );

      if (
        matchingComparisonDomains.length !==
          1
      ) {
        return blockedResult([
          `comparison_domain_join:not_exactly_one:${finalDomain.finalRuntimeBindingDomainId}:${matchingComparisonDomains.length}`,
        ]);
      }

      const comparisonDomain = matchingComparisonDomains[0]!;

      const projectedMembers:
        CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionMemberEvidenceV1[] =
          [];

      for (
        const member of value.members
      ) {
        const matchingOccurrenceComparisons = comparisonDomain
          .occurrenceComparisons.filter(
            (comparison) =>
              occurrenceComparisonMatchesBoundMember(
                comparison,
                member,
                finalDomain,
              ),
          );

        if (
          matchingOccurrenceComparisons.length !==
            1
        ) {
          return blockedResult([
            `comparison_occurrence_join:not_exactly_one:${member.snapshotTokenOccurrenceIdentityId}:${matchingOccurrenceComparisons.length}`,
          ]);
        }

        projectedMembers.push(
          projectMember(
            finalDomain,
            matchingOccurrenceComparisons[0]!,
            member,
          ),
        );
      }

      const collection:
        CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionCollectionV1 =
          {
            boundConditionCollectionId:
              `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1}:${finalDomain.finalRuntimeBindingDomainId}:${comparisonDomain.comparisonId}`,

            status: "proven_snapshot_bound_bound_condition_collection",

            valueKind: "ordered_bound_condition_evidence_collection",

            sourceFinalRuntimeBindingValueId: value.finalRuntimeBindingValueId,

            sourceComparisonDomainId: comparisonDomain.comparisonId,

            expectedSiteAuthorityId: finalDomain.expectedSiteAuthorityId,

            bindingDefinitionAuthorityId:
              finalDomain.bindingDefinitionAuthorityId,

            referencedBindingName: finalDomain.referencedBindingName,

            snapshotIdentityId: finalDomain.snapshotIdentityId,

            snapshotSentenceOccurrenceIdentityId:
              finalDomain.snapshotSentenceOccurrenceIdentityId,

            graphDocumentId: finalDomain.graphDocumentId,

            sentenceNodeId: finalDomain.sentenceNodeId,

            sentenceIndex: finalDomain.sentenceIndex,

            members: projectedMembers,

            memberCount: projectedMembers.length,

            isEmptyCollection: projectedMembers.length ===
              0,
          };

      if (
        collection.memberCount !==
          value.memberCount
      ) {
        return blockedResult([
          `bound_condition_member_count:mismatch:${finalDomain.finalRuntimeBindingDomainId}`,
        ]);
      }

      domainBoundConditionEvidence.push({
        boundConditionDomainEvidenceId:
          `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1}:${finalDomain.finalRuntimeBindingDomainId}`,

        status: "proven_current_snapshot_bound_bound_condition_domain_evidence",

        sourceFinalRuntimeBindingDomainId:
          finalDomain.finalRuntimeBindingDomainId,

        sourceComparisonDomainId: comparisonDomain.comparisonId,

        expectedSiteAuthorityId: finalDomain.expectedSiteAuthorityId,

        bindingDefinitionAuthorityId: finalDomain.bindingDefinitionAuthorityId,

        manifestId: finalDomain.manifestId,

        manifestCode: finalDomain.manifestCode,

        referencedBindingName: finalDomain.referencedBindingName,

        snapshotIdentityId: finalDomain.snapshotIdentityId,

        snapshotSentenceOccurrenceIdentityId:
          finalDomain.snapshotSentenceOccurrenceIdentityId,

        graphDocumentId: finalDomain.graphDocumentId,

        sentenceNodeId: finalDomain.sentenceNodeId,

        sentenceIndex: finalDomain.sentenceIndex,

        sourceBindingState: finalDomain.bindingState,

        boundConditionDomainState: "binding_consumed",

        runtimeBindingConsumed: true,

        conditionEvidenceProjected: true,

        boundConditionCollection: collection,
      });

      continue;
    }

    if (
      finalDomain.bindingState ===
        "not_bound_unresolved"
    ) {
      if (
        finalDomain.finalRuntimeBindingResolved !==
          false ||
        finalDomain.finalRuntimeBindingValue !==
          null
      ) {
        return blockedResult([
          `unresolved_final_domain:not_exact:${finalDomain.finalRuntimeBindingDomainId}`,
        ]);
      }

      domainBoundConditionEvidence.push({
        boundConditionDomainEvidenceId:
          `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1}:${finalDomain.finalRuntimeBindingDomainId}`,

        status: "proven_current_snapshot_bound_bound_condition_domain_evidence",

        sourceFinalRuntimeBindingDomainId:
          finalDomain.finalRuntimeBindingDomainId,

        sourceComparisonDomainId: null,

        expectedSiteAuthorityId: finalDomain.expectedSiteAuthorityId,

        bindingDefinitionAuthorityId: finalDomain.bindingDefinitionAuthorityId,

        manifestId: finalDomain.manifestId,

        manifestCode: finalDomain.manifestCode,

        referencedBindingName: finalDomain.referencedBindingName,

        snapshotIdentityId: finalDomain.snapshotIdentityId,

        snapshotSentenceOccurrenceIdentityId:
          finalDomain.snapshotSentenceOccurrenceIdentityId,

        graphDocumentId: finalDomain.graphDocumentId,

        sentenceNodeId: finalDomain.sentenceNodeId,

        sentenceIndex: finalDomain.sentenceIndex,

        sourceBindingState: finalDomain.bindingState,

        boundConditionDomainState: "binding_not_consumed_unresolved",

        runtimeBindingConsumed: false,

        conditionEvidenceProjected: false,

        boundConditionCollection: null,
      });

      continue;
    }

    if (
      finalDomain.bindingState ===
        "not_bound_cardinality_violation"
    ) {
      if (
        finalDomain.finalRuntimeBindingResolved !==
          false ||
        finalDomain.finalRuntimeBindingValue !==
          null
      ) {
        return blockedResult([
          `cardinality_violation_final_domain:not_exact:${finalDomain.finalRuntimeBindingDomainId}`,
        ]);
      }

      domainBoundConditionEvidence.push({
        boundConditionDomainEvidenceId:
          `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1}:${finalDomain.finalRuntimeBindingDomainId}`,

        status: "proven_current_snapshot_bound_bound_condition_domain_evidence",

        sourceFinalRuntimeBindingDomainId:
          finalDomain.finalRuntimeBindingDomainId,

        sourceComparisonDomainId: null,

        expectedSiteAuthorityId: finalDomain.expectedSiteAuthorityId,

        bindingDefinitionAuthorityId: finalDomain.bindingDefinitionAuthorityId,

        manifestId: finalDomain.manifestId,

        manifestCode: finalDomain.manifestCode,

        referencedBindingName: finalDomain.referencedBindingName,

        snapshotIdentityId: finalDomain.snapshotIdentityId,

        snapshotSentenceOccurrenceIdentityId:
          finalDomain.snapshotSentenceOccurrenceIdentityId,

        graphDocumentId: finalDomain.graphDocumentId,

        sentenceNodeId: finalDomain.sentenceNodeId,

        sentenceIndex: finalDomain.sentenceIndex,

        sourceBindingState: finalDomain.bindingState,

        boundConditionDomainState: "binding_not_consumed_cardinality_violation",

        runtimeBindingConsumed: false,

        conditionEvidenceProjected: false,

        boundConditionCollection: null,
      });

      continue;
    }

    return blockedResult([
      `final_binding_state:unsupported:${finalDomain.finalRuntimeBindingDomainId}`,
    ]);
  }

  const consumedBindingDomainCount = domainBoundConditionEvidence.filter(
    (domain) =>
      domain.runtimeBindingConsumed ===
        true,
  ).length;

  const unconsumedUnresolvedDomainCount = domainBoundConditionEvidence.filter(
    (domain) =>
      domain.boundConditionDomainState ===
        "binding_not_consumed_unresolved",
  ).length;

  const unconsumedCardinalityViolationDomainCount =
    domainBoundConditionEvidence.filter(
      (domain) =>
        domain.boundConditionDomainState ===
          "binding_not_consumed_cardinality_violation",
    ).length;

  const projectedConditionMemberCount = domainBoundConditionEvidence.reduce(
    (
      total,
      domain,
    ) =>
      total +
      (
        domain.boundConditionCollection
          ?.memberCount ??
          0
      ),
    0,
  );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_VERSION_V1,

    status: "ready",

    authority: {
      authorityId:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1}:${finalAuthority.authorityId}:${comparisonAuthority.authorityId}`,

      status: "proven_current_snapshot_bound_bound_condition_evidence",

      sourceFinalRuntimeBindingAuthorityId: finalAuthority.authorityId,

      sourceComparisonAuthorityId: comparisonAuthority.authorityId,

      snapshotIdentityId: finalAuthority.snapshotIdentityId,

      graphDocumentId: finalAuthority.graphDocumentId,

      sentenceNodeId: finalAuthority.sentenceNodeId,

      sentenceIndex: finalAuthority.sentenceIndex,

      domainBoundConditionEvidence,

      domainBoundConditionEvidenceCount: domainBoundConditionEvidence.length,

      consumedBindingDomainCount,

      unconsumedUnresolvedDomainCount,

      unconsumedCardinalityViolationDomainCount,

      projectedConditionMemberCount,

      governance: {
        closedFinalRuntimeBindingPublicDerivationReexecuted: true,

        suppliedFinalRuntimeBindingAcceptedAsProof: false,

        closedCurrentSnapshotBoundComparisonPublicDerivationReexecuted: true,

        suppliedComparisonAcceptedAsProof: false,

        exactFinalBindingAuthorityConsumed: true,

        exactComparisonAuthorityConsumed: true,

        exactExpectedSiteAuthorityJoinRequired: true,

        exactBindingDefinitionAuthorityJoinRequired: true,

        exactReferencedBindingNameJoinRequired: true,

        exactSnapshotIdentityJoinRequired: true,

        exactSnapshotSentenceOccurrenceIdentityJoinRequired: true,

        exactSnapshotTokenOccurrenceIdentityJoinRequired: true,

        tokenNodeIdUsedAsCrossLayerOccurrenceIdentity: false,

        comparisonEvidenceConsumedNotRecomputed: true,

        boundMembersOnlyReceiveConditionEvidence: true,

        unboundDomainsDoNotConsumeRuntimeBinding: true,

        emptyFinalBindingProducesEmptyConditionCollection: true,

        emptyFinalBindingSynthesizesOccurrenceEvidence: false,

        bindingConsumptionPerformed: true,

        runtimeBindingConsumed: consumedBindingDomainCount >
          0,

        runtimeBindingExecuted: false,

        runtimeConditionTruthResolved: false,

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
