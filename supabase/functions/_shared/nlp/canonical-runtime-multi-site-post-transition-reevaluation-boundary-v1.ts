import {
  type CanonicalRuntimePostTransitionReevaluationCompositionInputV1,
  deriveCanonicalRuntimePostTransitionReevaluationCompositionBoundaryV1,
} from "./canonical-runtime-post-transition-reevaluation-composition-boundary-v1.ts";

export const CANONICAL_RUNTIME_MULTI_SITE_POST_TRANSITION_REEVALUATION_BOUNDARY_V1 =
  "canonical_runtime_multi_site_post_transition_reevaluation_boundary_v1" as const;
export const CANONICAL_RUNTIME_MULTI_SITE_POST_TRANSITION_REEVALUATION_BOUNDARY_VERSION_V1 =
  "A3.8C.v1" as const;

type SiteSeed = Omit<
  CanonicalRuntimePostTransitionReevaluationCompositionInputV1,
  "tokenNodeId"
>;

export type CanonicalRuntimeMultiSitePostTransitionReevaluationInputV1 =
  Readonly<{
    seed: SiteSeed;
    tokenNodeIds: readonly string[];
  }>;

function blocked(stage: string, reasons: readonly string[]) {
  return {
    producer:
      CANONICAL_RUNTIME_MULTI_SITE_POST_TRANSITION_REEVALUATION_BOUNDARY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MULTI_SITE_POST_TRANSITION_REEVALUATION_BOUNDARY_VERSION_V1,
    status: "blocked" as const,
    state: "blocked_multi_site_post_transition_reevaluation" as const,
    stage,
    blockingReasons: [...new Set(reasons)].sort(),
    governance: {
      tokenWinnerSelected: false as const,
      firstTokenUsedAsAuthority: false as const,
      tokenCardinalityUsedAsAuthority: false as const,
      siteResultsDerivedBeforeAggregation: true as const,
      crossSnapshotEvidenceAggregated: false as const,
      crossSentenceOccurrenceEvidenceAggregated: false as const,
      actionEvidenceDeduplicatedByMeaning: false as const,
      staleSnapshotBoundEvidenceReused: false as const,
      newLinguisticSemanticsCreated: false as const,
      graphMutationPerformed: false as const,
      runtimeActionExecuted: false as const,
      schedulerInvoked: false as const,
      activationPermissionResolved: false as const,
      learnerFacingInterpretationPerformed: false as const,
    },
  };
}

export async function deriveCanonicalRuntimeMultiSitePostTransitionReevaluationBoundaryV1(
  input: CanonicalRuntimeMultiSitePostTransitionReevaluationInputV1,
) {
  if (input.tokenNodeIds.length === 0) {
    return blocked("site_domain", ["token_node_ids:empty"]);
  }

  const seenTokenNodeIds = new Set<string>();
  for (const tokenNodeId of input.tokenNodeIds) {
    if (typeof tokenNodeId !== "string" || tokenNodeId.length === 0) {
      return blocked("site_domain", ["token_node_id:invalid"]);
    }
    if (seenTokenNodeIds.has(tokenNodeId)) {
      return blocked("site_domain", [`token_node_id:duplicate:${tokenNodeId}`]);
    }
    seenTokenNodeIds.add(tokenNodeId);
  }

  const siteResults = [];
  for (const tokenNodeId of input.tokenNodeIds) {
    const siteResult =
      await deriveCanonicalRuntimePostTransitionReevaluationCompositionBoundaryV1(
        {
          ...input.seed,
          tokenNodeId,
        },
      );
    if (siteResult.status !== "ready") {
      return blocked(
        "site_reevaluation",
        siteResult.blockingReasons.map((reason) =>
          `${tokenNodeId}:${siteResult.stage}:${reason}`
        ),
      );
    }
    siteResults.push(siteResult);
  }

  const first = siteResults[0];
  if (first === undefined) {
    return blocked("site_reevaluation", ["site_results:empty"]);
  }

  for (const siteResult of siteResults) {
    if (siteResult.snapshotIdentityId !== first.snapshotIdentityId) {
      return blocked("identity_coherence", ["snapshot_identity:mismatch"]);
    }
    if (
      siteResult.snapshotSentenceOccurrenceIdentityId !==
        first.snapshotSentenceOccurrenceIdentityId
    ) {
      return blocked(
        "identity_coherence",
        ["snapshot_sentence_occurrence_identity:mismatch"],
      );
    }
    if (siteResult.sentenceNodeId !== first.sentenceNodeId) {
      return blocked("identity_coherence", ["sentence_node_id:mismatch"]);
    }
    if (
      siteResult.sourceEpochTransitionResult !==
        first.sourceEpochTransitionResult
    ) {
      return blocked("identity_coherence", [
        "source_epoch_transition_reference:mismatch",
      ]);
    }
  }

  const actionCandidateBridges = siteResults.flatMap(
    (siteResult) => siteResult.actionCandidateBridges,
  );
  const endpointEvidence = siteResults.flatMap(
    (siteResult) => siteResult.endpointResolutionEvidenceResult.evidence,
  );
  const d4Evidence = siteResults.flatMap(
    (siteResult) => siteResult.d4PreconditionEvidenceResult.evidence,
  );

  return {
    producer:
      CANONICAL_RUNTIME_MULTI_SITE_POST_TRANSITION_REEVALUATION_BOUNDARY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MULTI_SITE_POST_TRANSITION_REEVALUATION_BOUNDARY_VERSION_V1,
    status: "ready" as const,
    state: "resolved_multi_site_post_transition_reevaluation" as const,
    snapshotIdentityId: first.snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId:
      first.snapshotSentenceOccurrenceIdentityId,
    sentenceNodeId: first.sentenceNodeId,
    tokenNodeIds: [...input.tokenNodeIds],
    sourceEpochTransitionResult: first.sourceEpochTransitionResult,
    siteResults,
    actionCandidateBridges,
    endpointResolutionEvidenceResult: {
      ...first.endpointResolutionEvidenceResult,
      evidence: endpointEvidence,
    },
    d4PreconditionEvidenceResult: {
      ...first.d4PreconditionEvidenceResult,
      evidence: d4Evidence,
    },
    blockingReasons: [] as const,
    governance: {
      tokenWinnerSelected: false as const,
      firstTokenUsedAsAuthority: false as const,
      tokenCardinalityUsedAsAuthority: false as const,
      firstReadySiteUsedOnlyAsCoherentEnvelopeTemplate: true as const,
      siteResultsDerivedBeforeAggregation: true as const,
      exactSnapshotIdentityCoherenceRequired: true as const,
      exactSentenceOccurrenceIdentityCoherenceRequired: true as const,
      exactSentenceNodeCoherenceRequired: true as const,
      exactEpochTransitionReferenceCoherenceRequired: true as const,
      actionEvidenceDeduplicatedByMeaning: false as const,
      staleSnapshotBoundEvidenceReused: false as const,
      newLinguisticSemanticsCreated: false as const,
      graphMutationPerformed: false as const,
      runtimeActionExecuted: false as const,
      schedulerInvoked: false as const,
      activationPermissionResolved: false as const,
      learnerFacingInterpretationPerformed: false as const,
    },
  };
}
