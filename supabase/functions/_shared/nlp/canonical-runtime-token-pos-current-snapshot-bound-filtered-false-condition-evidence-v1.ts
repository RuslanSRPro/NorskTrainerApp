import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-binding-eligibility-v1.ts";

// CURRENT Snapshot-Bound Filtered FALSE Condition Evidence V1
//
// Ownership boundary:
//
// exact source inputs
//   -> independently reexecute canonical binding eligibility
//   -> preserve only occurrences already proven by that authority as
//      rejected + resolved FALSE + filtered_out + not binding-eligible
//   -> materialize independent FALSE condition evidence.
//
// This layer does NOT:
// - infer FALSE from an empty binding collection;
// - reinterpret a surviving occurrence;
// - recompute comparison truth;
// - materialize a binding occurrence set;
// - perform final Runtime binding;
// - execute WHERE;
// - classify learner error;
// - mutate the graph.

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-filtered-false-condition-evidence-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceV1 = {
  filteredFalseConditionEvidenceId: string;

  status:
    "proven_current_snapshot_bound_filtered_false_condition_evidence";

  sourceBindingEligibilityOccurrenceId: string;
  sourceFilteringId: string;
  sourceDispositionId: string;

  expectedSiteAuthorityId: string;
  bindingDefinitionAuthorityId: string;

  manifestId: string;
  manifestCode: string;
  referencedBindingName: string;

  snapshotIdentityId: string;
  snapshotSentenceOccurrenceIdentityId: string;
  snapshotTokenOccurrenceIdentityId: string;

  graphDocumentId: string;
  sentenceNodeId: string;
  sentenceIndex: number;

  tokenNodeId: string;
  containmentEdgeId: string;
  sentenceTokenIndex: number;

  disposition: "rejected";
  booleanTruth: false;
  booleanTruthResolved: true;

  filteringState: "filtered_out";
  survivesFiltering: false;

  eligibilityState: "filtered_out";
  bindingEligible: false;

  sourceBindingEligibilityOccurrence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1;
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceAuthorityV1 = {
  authorityId: string;

  status:
    "proven_current_snapshot_bound_filtered_false_condition_evidence";

  sourceBindingEligibilityAuthorityId: string;

  evidence:
    readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceV1[];

  evidenceCount: number;

  governance: {
    closedBindingEligibilityPublicDerivationReexecuted: true;
    suppliedBindingEligibilityWrapperAcceptedAsProof: false;

    exactFilteredOutEligibilityRequired: true;
    exactRejectedDispositionRequired: true;
    exactResolvedFalseTruthRequired: true;
    exactNonSurvivorRequired: true;
    exactNonBindingEligibleRequired: true;

    sourceFilteringTruthConsumedNotRecomputed: true;
    emptyBindingCollectionTruthInferred: false;
    absenceOfEvidenceTreatedAsFalse: false;

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

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceReadyResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_VERSION_V1;

  status: "ready";

  authority:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceAuthorityV1;

  blockingReasons: readonly [];
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceBlockedResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_VERSION_V1;

  status: "blocked";

  authority: null;

  blockingReasons: readonly string[];
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceBlockedResultV1;

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

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_VERSION_V1,

    status: "blocked",

    authority: null,

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

export function isExactFilteredFalse(
  occurrence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1,
): occurrence is
  CanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityOccurrenceV1 & {
    disposition: "rejected";
    booleanTruth: false;
    booleanTruthResolved: true;
    filteringState: "filtered_out";
    survivesFiltering: false;
    eligibilityState: "filtered_out";
    bindingEligible: false;
  } {
  return (
    occurrence.disposition ===
      "rejected" &&
    occurrence.booleanTruthResolved ===
      true &&
    occurrence.booleanTruth ===
      false &&
    occurrence.filteringState ===
      "filtered_out" &&
    occurrence.survivesFiltering ===
      false &&
    occurrence.eligibilityState ===
      "filtered_out" &&
    occurrence.bindingEligible ===
      false
  );
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceV1(
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
  CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceResultV1
> {
  const eligibility =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    eligibility.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_V1 ||
    eligibility.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BINDING_ELIGIBILITY_VERSION_V1 ||
    eligibility.status !==
      "ready"
  ) {
    return blocked([
      "binding_eligibility:not_exact_ready",
      ...eligibility.blockingReasons.map(
        (reason) => `binding_eligibility:${reason}`,
      ),
    ]);
  }

  const authority = eligibility.authority;

  const evidence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundFilteredFalseConditionEvidenceV1[] =
      [];

  const seenEvidenceIds = new Set<string>();

  for (
    const domain of authority.domainBindingEligibility
  ) {
    for (
      const occurrence of domain.occurrenceEligibility
    ) {
      if (
        occurrence.eligibilityState !==
          "filtered_out"
      ) {
        continue;
      }

      if (
        !isExactFilteredFalse(
          occurrence,
        )
      ) {
        return blocked([
          `binding_eligibility_occurrence:${occurrence.bindingEligibilityOccurrenceId}:filtered_out_false_contract_mismatch`,
        ]);
      }

      const filteredFalseConditionEvidenceId = [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_V1,
        "evidence",
        idPart(
          domain.bindingEligibilityDomainId,
        ),
        idPart(
          occurrence.bindingEligibilityOccurrenceId,
        ),
      ].join(
        ":",
      );

      if (
        seenEvidenceIds.has(
          filteredFalseConditionEvidenceId,
        )
      ) {
        return blocked([
          `filtered_false_condition_evidence:${filteredFalseConditionEvidenceId}:duplicate`,
        ]);
      }

      seenEvidenceIds.add(
        filteredFalseConditionEvidenceId,
      );

      evidence.push({
        filteredFalseConditionEvidenceId,

        status:
          "proven_current_snapshot_bound_filtered_false_condition_evidence",

        sourceBindingEligibilityOccurrenceId:
          occurrence.bindingEligibilityOccurrenceId,

        sourceFilteringId:
          occurrence.sourceFilteringId,

        sourceDispositionId:
          occurrence.sourceDispositionId,

        expectedSiteAuthorityId:
          domain.expectedSiteAuthorityId,

        bindingDefinitionAuthorityId:
          domain.bindingDefinitionAuthorityId,

        manifestId:
          domain.manifestId,

        manifestCode:
          domain.manifestCode,

        referencedBindingName:
          domain.referencedBindingName,

        snapshotIdentityId:
          occurrence.snapshotIdentityId,

        snapshotSentenceOccurrenceIdentityId:
          occurrence.snapshotSentenceOccurrenceIdentityId,

        snapshotTokenOccurrenceIdentityId:
          occurrence.snapshotTokenOccurrenceIdentityId,

        graphDocumentId:
          occurrence.graphDocumentId,

        sentenceNodeId:
          occurrence.sentenceNodeId,

        sentenceIndex:
          occurrence.sentenceIndex,

        tokenNodeId:
          occurrence.tokenNodeId,

        containmentEdgeId:
          occurrence.containmentEdgeId,

        sentenceTokenIndex:
          occurrence.sentenceTokenIndex,

        disposition:
          occurrence.disposition,

        booleanTruth:
          occurrence.booleanTruth,

        booleanTruthResolved:
          occurrence.booleanTruthResolved,

        filteringState:
          occurrence.filteringState,

        survivesFiltering:
          occurrence.survivesFiltering,

        eligibilityState:
          occurrence.eligibilityState,

        bindingEligible:
          occurrence.bindingEligible,

        sourceBindingEligibilityOccurrence:
          occurrence,
      });
    }
  }

  evidence.sort(
    (left, right) =>
      left.filteredFalseConditionEvidenceId.localeCompare(
        right.filteredFalseConditionEvidenceId,
      ),
  );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_VERSION_V1,

    status: "ready",

    authority: {
      authorityId: [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_FILTERED_FALSE_CONDITION_EVIDENCE_V1,
        idPart(
          authority.authorityId,
        ),
      ].join(
        ":",
      ),

      status:
        "proven_current_snapshot_bound_filtered_false_condition_evidence",

      sourceBindingEligibilityAuthorityId:
        authority.authorityId,

      evidence,

      evidenceCount:
        evidence.length,

      governance: {
        closedBindingEligibilityPublicDerivationReexecuted: true,
        suppliedBindingEligibilityWrapperAcceptedAsProof: false,

        exactFilteredOutEligibilityRequired: true,
        exactRejectedDispositionRequired: true,
        exactResolvedFalseTruthRequired: true,
        exactNonSurvivorRequired: true,
        exactNonBindingEligibleRequired: true,

        sourceFilteringTruthConsumedNotRecomputed: true,
        emptyBindingCollectionTruthInferred: false,
        absenceOfEvidenceTreatedAsFalse: false,

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