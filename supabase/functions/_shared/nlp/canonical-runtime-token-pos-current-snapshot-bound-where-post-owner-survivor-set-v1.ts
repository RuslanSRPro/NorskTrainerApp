import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionResultV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-owner-binding-occurrence-provenance-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-survivor-set-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_VERSION_V1 =
  "1.0.0" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_SPECIFICATION_ID_V1 =
  "late-v1.40:post-where-owner-survivor-set-v1" as const;

type FinalWhereResult =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionResultV1;

type FinalWhereReadyResult = Extract<
  FinalWhereResult,
  { status: "ready" }
>;

type FinalWhereDecision =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1;

type OwnerOccurrence =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceV1;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerOccurrenceStateV1 =
  | "proven_survivor"
  | "rejected"
  | "uncertain_survivor";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerOccurrenceDecisionV1 =
  {
    occurrenceDecisionId: string;

    status: "proven_post_where_owner_occurrence_decision";

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;
    snapshotTokenOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;

    tokenNodeId: string;

    occurrenceState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerOccurrenceStateV1;

    survivesWhere: boolean;
    whereTruthResolved: boolean;

    sourceOccurrence: OwnerOccurrence;
    sourceFinalWhereDecision: FinalWhereDecision;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorDomainV1 =
  {
    survivorDomainId: string;

    status: "proven_post_where_owner_survivor_domain";

    structuralAuthorityId: string;
    ownerBindingDefinitionAuthorityId: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;
    sentenceNodeId: string;

    sourceOccurrenceCount: number;
    survivingOccurrenceCount: number;
    rejectedOccurrenceCount: number;
    uncertainSurvivorCount: number;

    occurrenceDecisions:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerOccurrenceDecisionV1[];

    survivingOccurrences: OwnerOccurrence[];

    sourceFinalWhereDecision: FinalWhereDecision;

    governance: {
      exactFinalWhereDecisionRequired: true;
      exactOwnerOccurrenceDomainPreserved: true;

      whereTruthRecomputed: false;
      leafDispositionReexecuted: false;

      rejectedOnlyElimination: true;
      satisfiedOccurrencesPreservedAsProvenSurvivors: true;
      uncertainOccurrencesPreservedAsUncertainSurvivors: true;
      uncertainCollapsedToRejected: false;
      uncertainCollapsedToSatisfied: false;

      occurrenceOrderPreserved: true;
      zeroOccurrencesPreserved: true;
      occurrenceMultiplicityPreserved: true;

      occurrenceFilteringPerformed: true;
      occurrenceWinnerSelected: false;

      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;

      finalRuntimeBindingPerformed: false;
      bindingTruthResolved: false;

      learnerErrorClassified: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_SPECIFICATION_ID_V1;

    status: "ready";

    sourceFinalWhereResult: FinalWhereReadyResult;

    survivorDomains:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorDomainV1[];

    domainCount: number;

    blockingReasons: readonly [];

    governance: {
      finalWhereResultConsumedWithoutReexecution: true;
      ownerOccurrenceEnumerationReused: true;
      duplicateOccurrenceEnumerationImplemented: false;

      zeroDecisionDomainsAllowed: true;
      zeroDecisionDomainsProduceZeroSurvivorDomains: true;
      domainMultiplicityPreserved: true;

      rejectedOnlyElimination: true;
      uncertainPreservedAsSurvivor: true;

      occurrenceWinnerSelected: false;

      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;

      finalRuntimeBindingPerformed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_SPECIFICATION_ID_V1;

    status: "blocked";

    sourceFinalWhereResult: FinalWhereResult;

    survivorDomains: readonly [];
    domainCount: 0;

    blockingReasons: readonly string[];

    governance: {
      finalWhereResultConsumedWithoutReexecution: true;
      ownerOccurrenceEnumerationReused: true;
      duplicateOccurrenceEnumerationImplemented: false;

      zeroDecisionDomainsAllowed: true;
      zeroDecisionDomainsProduceZeroSurvivorDomains: true;
      domainMultiplicityPreserved: true;

      rejectedOnlyElimination: true;
      uncertainPreservedAsSurvivor: true;

      occurrenceWinnerSelected: false;

      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;

      finalRuntimeBindingPerformed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetBlockedResultV1;

const RESULT_GOVERNANCE = {
  finalWhereResultConsumedWithoutReexecution: true,
  ownerOccurrenceEnumerationReused: true,
  duplicateOccurrenceEnumerationImplemented: false,

  zeroDecisionDomainsAllowed: true,
  zeroDecisionDomainsProduceZeroSurvivorDomains: true,
  domainMultiplicityPreserved: true,

  rejectedOnlyElimination: true,
  uncertainPreservedAsSurvivor: true,

  occurrenceWinnerSelected: false,

  cardinalitySemanticsResolved: false,
  cardinalityEnforcementPerformed: false,

  finalRuntimeBindingPerformed: false,
  learnerErrorClassified: false,
  graphMutationPerformed: false,

  frozenGrammarReadOnly: true,
} as const;

const DOMAIN_GOVERNANCE = {
  exactFinalWhereDecisionRequired: true,
  exactOwnerOccurrenceDomainPreserved: true,

  whereTruthRecomputed: false,
  leafDispositionReexecuted: false,

  rejectedOnlyElimination: true,
  satisfiedOccurrencesPreservedAsProvenSurvivors: true,
  uncertainOccurrencesPreservedAsUncertainSurvivors: true,
  uncertainCollapsedToRejected: false,
  uncertainCollapsedToSatisfied: false,

  occurrenceOrderPreserved: true,
  zeroOccurrencesPreserved: true,
  occurrenceMultiplicityPreserved: true,

  occurrenceFilteringPerformed: true,
  occurrenceWinnerSelected: false,

  cardinalitySemanticsResolved: false,
  cardinalityEnforcementPerformed: false,

  finalRuntimeBindingPerformed: false,
  bindingTruthResolved: false,

  learnerErrorClassified: false,
  graphMutationPerformed: false,

  frozenGrammarReadOnly: true,
} as const;

function uniqueSorted(
  values: readonly string[],
): readonly string[] {
  return [...new Set(values)].sort();
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(value).replaceAll(
    "%",
    "_",
  );
}

function blocked(
  sourceFinalWhereResult: FinalWhereResult,
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_SPECIFICATION_ID_V1,

    status: "blocked",

    sourceFinalWhereResult,

    survivorDomains: [],
    domainCount: 0,

    blockingReasons: uniqueSorted(
      reasons,
    ),

    governance: RESULT_GOVERNANCE,
  };
}

function occurrenceStateFor(
  decision: FinalWhereDecision,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerOccurrenceStateV1 {
  switch (decision.decisionDisposition) {
    case "satisfied":
      return "proven_survivor";

    case "rejected":
      return "rejected";

    case "uncertain":
      return "uncertain_survivor";
  }
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
  finalWhereResult: FinalWhereResult,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1 {
  if (
    finalWhereResult.status !== "ready" ||
    finalWhereResult.blockingReasons.length !== 0
  ) {
    return blocked(
      finalWhereResult,
      [
        "final_where_root_truth_decision:not_exact_ready",
        ...finalWhereResult.blockingReasons.map(
          (reason) =>
            "final_where_root_truth_decision:" +
            reason,
        ),
      ],
    );
  }

  const survivorDomains = finalWhereResult.decisions.map(
    (decision) => {
      const sourceDomain = decision.sourceOwnerBindingOccurrenceDomain;

      const occurrenceState = occurrenceStateFor(
        decision,
      );

      const occurrenceDecisions = sourceDomain.occurrences.map(
        (occurrence) => ({
          occurrenceDecisionId: [
            CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_V1,
            idPart(decision.decisionId),
            idPart(
              occurrence.snapshotTokenOccurrenceIdentityId,
            ),
          ].join(":"),

          status: "proven_post_where_owner_occurrence_decision" as const,

          snapshotIdentityId: sourceDomain.snapshotIdentityId,

          snapshotSentenceOccurrenceIdentityId:
            sourceDomain.snapshotSentenceOccurrenceIdentityId,

          snapshotTokenOccurrenceIdentityId:
            occurrence.snapshotTokenOccurrenceIdentityId,

          graphDocumentId: sourceDomain.graphDocumentId,

          sentenceNodeId: sourceDomain.sentenceNodeId,

          tokenNodeId: occurrence.tokenNodeId,

          occurrenceState,

          survivesWhere: occurrenceState !== "rejected",

          whereTruthResolved: occurrenceState !== "uncertain_survivor",

          sourceOccurrence: occurrence,

          sourceFinalWhereDecision: decision,
        }),
      );

      const survivingOccurrences = occurrenceDecisions
        .filter(
          (occurrenceDecision) => occurrenceDecision.survivesWhere,
        )
        .map(
          (occurrenceDecision) => occurrenceDecision.sourceOccurrence,
        );

      const rejectedOccurrenceCount = occurrenceDecisions.filter(
        (occurrenceDecision) =>
          occurrenceDecision.occurrenceState ===
            "rejected",
      ).length;

      const uncertainSurvivorCount = occurrenceDecisions.filter(
        (occurrenceDecision) =>
          occurrenceDecision.occurrenceState ===
            "uncertain_survivor",
      ).length;

      return {
        survivorDomainId: [
          CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_V1,
          idPart(decision.decisionId),
        ].join(":"),

        status: "proven_post_where_owner_survivor_domain" as const,

        structuralAuthorityId: decision.structuralAuthorityId,

        ownerBindingDefinitionAuthorityId:
          decision.ownerBindingDefinitionAuthorityId,

        snapshotIdentityId: decision.snapshotIdentityId,

        snapshotSentenceOccurrenceIdentityId:
          decision.snapshotSentenceOccurrenceIdentityId,

        graphDocumentId: decision.graphDocumentId,

        sentenceNodeId: decision.sentenceNodeId,

        sourceOccurrenceCount: sourceDomain.occurrences.length,

        survivingOccurrenceCount: survivingOccurrences.length,

        rejectedOccurrenceCount,

        uncertainSurvivorCount,

        occurrenceDecisions,

        survivingOccurrences,

        sourceFinalWhereDecision: decision,

        governance: DOMAIN_GOVERNANCE,
      };
    },
  );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_SURVIVOR_SET_SPECIFICATION_ID_V1,

    status: "ready",

    sourceFinalWhereResult: finalWhereResult,

    survivorDomains,

    domainCount: survivorDomains.length,

    blockingReasons: [],

    governance: RESULT_GOVERNANCE,
  };
}
