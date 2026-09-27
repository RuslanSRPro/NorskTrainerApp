import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionResultV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceResultV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-bound-condition-evidence-v1.ts";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-terminal-governed-result-envelope-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_AGGREGATION_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-terminal-aggregation-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_AGGREGATION_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationV1 = {
  aggregationId: string;

  status: "terminal_governed_result_collection";

  terminalEnvelopes:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1[];

  envelopeCount: number;

  sourceFinalWhereDecisionResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionResultV1;

  sourcePostOwnerBoundConditionEvidenceResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceResultV1;

  governance: {
    exactFinalDecisionObjectIdentityRequired: true;
    evidenceMultiplicityPreserved: true;
    decisionMultiplicityPreserved: true;
    indexBasedJoinUsed: false;
    stringIdentityFallbackUsed: false;
    unmatchedDecisionAllowed: false;
    duplicateEvidenceForDecisionAllowed: false;

    rootTruthRecomputed: false;
    finalDecisionRecomputed: false;
    postOwnerEvidenceRecomputed: false;

    genericEligibilityDerived: false;
    executableStateDerived: false;
    schedulableStateDerived: false;

    runtimeActionExecuted: false;
    schedulerInvoked: false;
    graphMutationPerformed: false;
  };
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationResultV1 =
  | {
      status: "ready";

      aggregation:
        CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationV1;

      blockingReasons: [];
    }
  | {
      status: "blocked";

      blockingReasons: string[];

      governance: {
        semanticFallbackUsed: false;
        indexBasedJoinUsed: false;
        stringIdentityFallbackUsed: false;
        runtimeActionExecuted: false;
        schedulerInvoked: false;
        graphMutationPerformed: false;
      };
    };

function blocked(
  ...blockingReasons: string[]
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationResultV1 {
  return {
    status: "blocked",

    blockingReasons: [
      ...new Set(blockingReasons),
    ].sort(),

    governance: {
      semanticFallbackUsed: false,
      indexBasedJoinUsed: false,
      stringIdentityFallbackUsed: false,
      runtimeActionExecuted: false,
      schedulerInvoked: false,
      graphMutationPerformed: false,
    },
  };
}

function exactEvidenceForDecision(
  decision:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1,
  evidence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1[],
):
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1[] {
  return evidence.filter(
    (domain) =>
      domain.sourceFinalWhereDecision === decision,
  );
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationV1(
  input: {
    finalWhereDecisionResult:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionResultV1;

    postOwnerBoundConditionEvidenceResult:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceResultV1;
  },
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationResultV1 {
  const {
    finalWhereDecisionResult,
    postOwnerBoundConditionEvidenceResult,
  } = input;

  if (finalWhereDecisionResult.status !== "ready") {
    return blocked(
      "final_where_decision_result_blocked",
      ...finalWhereDecisionResult.blockingReasons.map(
        (reason) => `final_where_decision:${reason}`,
      ),
    );
  }

  if (postOwnerBoundConditionEvidenceResult.status !== "ready") {
    return blocked(
      "post_owner_bound_condition_evidence_result_blocked",
      ...postOwnerBoundConditionEvidenceResult.blockingReasons.map(
        (reason) => `post_owner_bound_condition_evidence:${reason}`,
      ),
    );
  }

  const decisions =
    finalWhereDecisionResult.decisions;

  const evidence =
    postOwnerBoundConditionEvidenceResult
      .domainBoundConditionEvidence;

  if (decisions.length !== evidence.length) {
    return blocked(
      "terminal_decision_evidence_cardinality_mismatch",
    );
  }

  const terminalEnvelopes:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1[] = [];

  const consumedEvidence =
    new Set<
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionDomainEvidenceV1
    >();

  for (const decision of decisions) {
    const exactMatches =
      exactEvidenceForDecision(
        decision,
        evidence,
      );

    if (exactMatches.length === 0) {
      return blocked(
        `terminal_evidence_missing_for_exact_decision:${decision.decisionId}`,
      );
    }

    if (exactMatches.length > 1) {
      return blocked(
        `terminal_evidence_ambiguous_for_exact_decision:${decision.decisionId}`,
      );
    }

    const exactEvidence =
      exactMatches[0];

    if (consumedEvidence.has(exactEvidence)) {
      return blocked(
        `terminal_evidence_reused_across_decisions:${decision.decisionId}`,
      );
    }

    const envelopeResult =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1(
        {
          finalWhereDecision: decision,
          postOwnerBoundConditionEvidence:
            exactEvidence,
        },
      );

    if (envelopeResult.status !== "ready") {
      return blocked(
        ...envelopeResult.blockingReasons.map(
          (reason) =>
            `terminal_envelope:${decision.decisionId}:${reason}`,
        ),
      );
    }

    consumedEvidence.add(exactEvidence);

    terminalEnvelopes.push(
      envelopeResult.envelope,
    );
  }

  if (consumedEvidence.size !== evidence.length) {
    return blocked(
      "terminal_unmatched_post_owner_evidence",
    );
  }

  const aggregationId = [
    CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_AGGREGATION_V1,
    ...terminalEnvelopes.map(
      (envelope) => envelope.envelopeId,
    ),
  ].join(":");

  return {
    status: "ready",

    aggregation: {
      aggregationId,

      status:
        "terminal_governed_result_collection",

      terminalEnvelopes,

      envelopeCount:
        terminalEnvelopes.length,

      sourceFinalWhereDecisionResult:
        finalWhereDecisionResult,

      sourcePostOwnerBoundConditionEvidenceResult:
        postOwnerBoundConditionEvidenceResult,

      governance: {
        exactFinalDecisionObjectIdentityRequired: true,
        evidenceMultiplicityPreserved: true,
        decisionMultiplicityPreserved: true,
        indexBasedJoinUsed: false,
        stringIdentityFallbackUsed: false,
        unmatchedDecisionAllowed: false,
        duplicateEvidenceForDecisionAllowed: false,

        rootTruthRecomputed: false,
        finalDecisionRecomputed: false,
        postOwnerEvidenceRecomputed: false,

        genericEligibilityDerived: false,
        executableStateDerived: false,
        schedulableStateDerived: false,

        runtimeActionExecuted: false,
        schedulerInvoked: false,
        graphMutationPerformed: false,
      },
    },

    blockingReasons: [],
  };
}
