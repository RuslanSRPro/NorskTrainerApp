import type {
  CanonicalRuntimeBoundedDependencyGraphSchedulerInitialEpochV1,
} from "./canonical-runtime-bounded-dependency-graph-scheduler-v1.ts";
import type {
  CanonicalRuntimeS0InitialEpochCompositionInputV1,
} from "./canonical-runtime-s0-initial-epoch-composition-boundary-v1.ts";
import {
  deriveCanonicalRuntimeS0InitialEpochCompositionBoundaryV1,
} from "./canonical-runtime-s0-initial-epoch-composition-boundary-v1.ts";

export const CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_V1 =
  "a3.6q:canonical-runtime-multi-site-s0-initial-epoch-aggregation-boundary-v1" as const;
export const CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_VERSION_V1 =
  "1.0.0" as const;

type SiteSeed = Omit<
  CanonicalRuntimeS0InitialEpochCompositionInputV1,
  "tokenNodeId"
>;

export type CanonicalRuntimeMultiSiteS0InitialEpochAggregationInputV1 =
  Readonly<{
    seed: SiteSeed;
    tokenNodeIds: readonly string[];
  }>;

function blocked(stage: string, reasons: readonly string[]) {
  return {
    producer:
      CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_VERSION_V1,
    status: "blocked" as const,
    state: "blocked_multi_site_s0_initial_epoch_aggregation" as const,
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
      newLinguisticSemanticsCreated: false as const,
      graphMutationPerformed: false as const,
      runtimeActionExecuted: false as const,
      schedulerInvoked: false as const,
      activationPermissionResolved: false as const,
      learnerFacingInterpretationPerformed: false as const,
    },
  };
}

export async function deriveCanonicalRuntimeMultiSiteS0InitialEpochAggregationBoundaryV1(
  input: CanonicalRuntimeMultiSiteS0InitialEpochAggregationInputV1,
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
      await deriveCanonicalRuntimeS0InitialEpochCompositionBoundaryV1({
        ...input.seed,
        tokenNodeId,
      });
    if (siteResult.status !== "ready") {
      return blocked(
        "site_evaluation",
        siteResult.blockingReasons.map((reason) =>
          `${tokenNodeId}:${siteResult.stage}:${reason}`
        ),
      );
    }
    siteResults.push(siteResult);
  }

  const first = siteResults[0];
  if (first === undefined) {
    return blocked("site_evaluation", ["site_results:empty"]);
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
      siteResult.currentContextResult.authority.authorityId !==
        first.currentContextResult.authority.authorityId
    ) {
      return blocked("identity_coherence", [
        "current_context_authority:mismatch",
      ]);
    }

    if (siteResult.graph.documentId !== first.graph.documentId) {
      return blocked("identity_coherence", ["graph_document_id:mismatch"]);
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

  const initialEpoch:
    CanonicalRuntimeBoundedDependencyGraphSchedulerInitialEpochV1 = {
      graph: first.graph,
      currentContextResult: first.currentContextResult,
      snapshotIdentityAuthority: first.snapshotIdentityAuthority,
      actionCandidateBridges,
      endpointResolutionEvidenceResult: {
        ...first.endpointResolutionEvidenceResult,
        evidence: endpointEvidence,
      },
      d4PreconditionEvidenceResult: {
        ...first.d4PreconditionEvidenceResult,
        evidence: d4Evidence,
      },
    };

  return {
    producer:
      CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_VERSION_V1,
    status: "ready" as const,
    state: "resolved_multi_site_s0_initial_epoch_aggregation" as const,
    snapshotIdentityId: first.snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId:
      first.snapshotSentenceOccurrenceIdentityId,
    sentenceNodeId: first.sentenceNodeId,
    tokenNodeIds: [...input.tokenNodeIds],
    siteResults,
    initialEpoch,
    blockingReasons: [] as const,
    governance: {
      tokenWinnerSelected: false as const,
      firstTokenUsedAsAuthority: false as const,
      tokenCardinalityUsedAsAuthority: false as const,
      firstReadySiteUsedOnlyAsCoherentEnvelopeCarrier: true as const,
      allSitesEvaluatedAgainstSameImmutableSeed: true as const,
      exactSnapshotIdentityRequiredAcrossSites: true as const,
      exactSentenceOccurrenceIdentityRequiredAcrossSites: true as const,
      exactCurrentContextAuthorityRequiredAcrossSites: true as const,
      actionEvidenceDeduplicatedByMeaning: false as const,
      schedulerDuplicateDetectionPreserved: true as const,
      newLinguisticSemanticsCreated: false as const,
      graphMutationPerformed: false as const,
      runtimeActionExecuted: false as const,
      schedulerInvoked: false as const,
      activationPermissionResolved: false as const,
      learnerFacingInterpretationPerformed: false as const,
    },
  };
}
