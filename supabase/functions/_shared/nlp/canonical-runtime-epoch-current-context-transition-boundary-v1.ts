import type {
  CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1,
  CanonicalCurrentRuntimeSentenceContextAuthorityResultV1,
  CanonicalCurrentRuntimeSentenceContextAuthorityV1,
} from "./canonical-current-runtime-sentence-context-authority-v1.ts";
import {
  deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1,
} from "./canonical-current-runtime-sentence-context-authority-v1.ts";

import {
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import {
  deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1,
} from "./canonical-snapshot-sentence-occurrence-identity-authority-v1.ts";

import type {
  CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1,
  CanonicalRuntimeDependencyExecutionGraphTransitionV1,
} from "./canonical-runtime-dependency-execution-graph-transition-boundary-v1.ts";

import type {
  CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

export const CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_V1 =
  "a3.2.2:canonical-runtime-epoch-current-context-transition-boundary-v1" as const;

export const CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeEpochCurrentContextTransitionBlockingReasonV1 =
  | "source_current_context_not_ready"
  | "source_transition_not_resolved"
  | "source_transition_missing"
  | "source_transition_has_blocking_reasons"
  | "source_snapshot_identity_mismatch"
  | "source_sentence_occurrence_consistency_mismatch"
  | "source_sentence_node_missing_in_resulting_graph"
  | "source_sentence_node_not_sentence_in_resulting_graph"
  | "resulting_snapshot_identity_unresolved"
  | "resulting_snapshot_identity_mismatch"
  | "resulting_sentence_occurrence_identity_unresolved"
  | "resulting_sentence_occurrence_missing"
  | "resulting_sentence_occurrence_ambiguous"
  | "resulting_current_context_not_ready"
  | "resulting_current_context_identity_mismatch";

export type CanonicalRuntimeEpochCurrentContextTransitionV1 = Readonly<{
  transitionId: string;

  executionInvocationId: string;

  sourceSnapshotIdentityId: string;
  resultingSnapshotIdentityId: string;

  sourceSnapshotSentenceOccurrenceIdentityId: string;
  resultingSnapshotSentenceOccurrenceIdentityId: string;

  sentenceNodeId: string;

  sourceCurrentContext: CanonicalCurrentRuntimeSentenceContextAuthorityV1;

  sourceExecutionTransition:
    CanonicalRuntimeDependencyExecutionGraphTransitionV1;

  resultingCurrentContext:
    CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1;

  governance: Readonly<{
    sameSentenceNodePreservedAcrossEpoch: true;

    canonicalSnapshotIdentityDeriverUsed: true;
    canonicalOccurrenceIdentityDeriverUsed: true;
    canonicalCurrentContextProducerUsed: true;

    sentenceSelectedHere: false;
    sentenceIndexUsedForIdentity: false;
    sentenceIndexUsedAsSelector: false;
    legacyMappingUsed: false;

    snapshotIdentityInventedHere: false;
    sentenceOccurrenceIdentityInventedHere: false;

    whereTruthRecomputed: false;
    bindingRecomputed: false;
    endpointDirectionRecomputed: false;
    activationPermissionRecomputed: false;
    executionAdmissionRecomputed: false;
    executionPlanRecomputed: false;

    graphMutatedHere: false;
    schedulerInvoked: false;
    learnerFacingInterpretationPerformed: false;
  }>;
}>;

export type CanonicalRuntimeEpochCurrentContextTransitionBoundaryResultV1 =
  Readonly<{
    producer:
      typeof CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_VERSION_V1;

    status: "candidate";

    state:
      | "resolved_epoch_current_context_transition"
      | "unresolved_epoch_current_context_transition";

    transition:
      | CanonicalRuntimeEpochCurrentContextTransitionV1
      | null;

    blockingReasons:
      readonly CanonicalRuntimeEpochCurrentContextTransitionBlockingReasonV1[];

    sourceCurrentContextResult:
      CanonicalCurrentRuntimeSentenceContextAuthorityResultV1;

    sourceExecutionTransitionResult:
      CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1;
  }>;

function unresolved(
  sourceCurrentContextResult:
    CanonicalCurrentRuntimeSentenceContextAuthorityResultV1,
  sourceExecutionTransitionResult:
    CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1,
  blockingReasons:
    readonly CanonicalRuntimeEpochCurrentContextTransitionBlockingReasonV1[],
): CanonicalRuntimeEpochCurrentContextTransitionBoundaryResultV1 {
  return {
    producer: CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_V1,

    producerVersion:
      CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_VERSION_V1,

    status: "candidate",

    state: "unresolved_epoch_current_context_transition",

    transition: null,

    blockingReasons: [
      ...new Set(blockingReasons),
    ].sort(),

    sourceCurrentContextResult,

    sourceExecutionTransitionResult,
  };
}

export async function deriveCanonicalRuntimeEpochCurrentContextTransitionBoundaryV1(
  surface: CanonicalSurfaceDocumentV1,
  sourceCurrentContextResult:
    CanonicalCurrentRuntimeSentenceContextAuthorityResultV1,
  sourceExecutionTransitionResult:
    CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1,
  executionInvocationId: string,
): Promise<
  CanonicalRuntimeEpochCurrentContextTransitionBoundaryResultV1
> {
  if (
    sourceCurrentContextResult.status !== "ready"
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["source_current_context_not_ready"],
    );
  }

  if (
    sourceExecutionTransitionResult.state !==
      "resolved_dependency_execution_graph_transition"
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["source_transition_not_resolved"],
    );
  }

  if (
    sourceExecutionTransitionResult.transition === null
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["source_transition_missing"],
    );
  }

  if (
    sourceExecutionTransitionResult.blockingReasons.length !== 0
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["source_transition_has_blocking_reasons"],
    );
  }

  const sourceCurrent = sourceCurrentContextResult.authority;

  const executionTransition = sourceExecutionTransitionResult.transition;

  if (
    sourceCurrent.snapshotIdentityId !==
      executionTransition.sourceSnapshotIdentityId
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["source_snapshot_identity_mismatch"],
    );
  }

  if (
    sourceCurrent.sourceSnapshotSentenceOccurrenceAuthority
        .snapshotSentenceOccurrenceIdentityId !==
      sourceCurrent.snapshotSentenceOccurrenceIdentityId ||
    sourceCurrent.sourceSnapshotSentenceOccurrenceAuthority
        .sentenceNodeId !==
      sourceCurrent.sentenceNodeId ||
    sourceCurrent.sourceSnapshotSentenceOccurrenceAuthority
        .snapshotIdentityId !==
      sourceCurrent.snapshotIdentityId
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["source_sentence_occurrence_consistency_mismatch"],
    );
  }

  const resultingSentenceNode = executionTransition.resultingGraph.nodes.find(
    (node) => node.id === sourceCurrent.sentenceNodeId,
  );

  if (
    resultingSentenceNode === undefined
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["source_sentence_node_missing_in_resulting_graph"],
    );
  }

  if (
    resultingSentenceNode.type !== "sentence"
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["source_sentence_node_not_sentence_in_resulting_graph"],
    );
  }

  const resultingSnapshotIdentityResult =
    await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      surface,
      executionTransition.resultingGraph,
    );

  if (
    resultingSnapshotIdentityResult.status !== "ready" ||
    resultingSnapshotIdentityResult.authority === undefined
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["resulting_snapshot_identity_unresolved"],
    );
  }

  if (
    resultingSnapshotIdentityResult.authority.snapshotIdentityId !==
      executionTransition.resultingSnapshotIdentityId ||
    resultingSnapshotIdentityResult.authority.authorityId !==
      executionTransition.resultingSnapshotIdentityAuthority.authorityId
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["resulting_snapshot_identity_mismatch"],
    );
  }

  const resultingOccurrenceResult =
    await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
      surface,
      executionTransition.resultingGraph,
      resultingSnapshotIdentityResult,
    );

  if (
    resultingOccurrenceResult.status !== "ready"
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["resulting_sentence_occurrence_identity_unresolved"],
    );
  }

  const matchingOccurrences = resultingOccurrenceResult.authorities.filter(
    (candidate) =>
      candidate.status === "proven" &&
      candidate.snapshotIdentityId ===
        executionTransition.resultingSnapshotIdentityId &&
      candidate.sentenceNodeId ===
        sourceCurrent.sentenceNodeId,
  );

  if (
    matchingOccurrences.length === 0
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["resulting_sentence_occurrence_missing"],
    );
  }

  if (
    matchingOccurrences.length !== 1
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["resulting_sentence_occurrence_ambiguous"],
    );
  }

  const resultingOccurrence = matchingOccurrences[0];

  const resultingCurrentContext =
    await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
      surface,
      executionTransition.resultingGraph,
      {
        executionInvocationId,

        declaredCurrentSnapshotIdentityId:
          executionTransition.resultingSnapshotIdentityId,

        declaredCurrentSnapshotSentenceOccurrenceIdentityId: resultingOccurrence
          .snapshotSentenceOccurrenceIdentityId,
      },
    );

  if (
    resultingCurrentContext.status !== "ready"
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["resulting_current_context_not_ready"],
    );
  }

  if (
    resultingCurrentContext.authority.snapshotIdentityId !==
      executionTransition.resultingSnapshotIdentityId ||
    resultingCurrentContext.authority.sentenceNodeId !==
      sourceCurrent.sentenceNodeId ||
    resultingCurrentContext.authority
        .snapshotSentenceOccurrenceIdentityId !==
      resultingOccurrence
        .snapshotSentenceOccurrenceIdentityId
  ) {
    return unresolved(
      sourceCurrentContextResult,
      sourceExecutionTransitionResult,
      ["resulting_current_context_identity_mismatch"],
    );
  }

  const transitionId = [
    "runtime-epoch-current-context-transition-v1",
    executionTransition.transitionId,
    sourceCurrent.sentenceNodeId,
    resultingOccurrence.snapshotSentenceOccurrenceIdentityId,
  ].join(":");

  return {
    producer: CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_V1,

    producerVersion:
      CANONICAL_RUNTIME_EPOCH_CURRENT_CONTEXT_TRANSITION_BOUNDARY_VERSION_V1,

    status: "candidate",

    state: "resolved_epoch_current_context_transition",

    transition: {
      transitionId,

      executionInvocationId,

      sourceSnapshotIdentityId: sourceCurrent.snapshotIdentityId,

      resultingSnapshotIdentityId:
        executionTransition.resultingSnapshotIdentityId,

      sourceSnapshotSentenceOccurrenceIdentityId:
        sourceCurrent.snapshotSentenceOccurrenceIdentityId,

      resultingSnapshotSentenceOccurrenceIdentityId:
        resultingOccurrence.snapshotSentenceOccurrenceIdentityId,

      sentenceNodeId: sourceCurrent.sentenceNodeId,

      sourceCurrentContext: sourceCurrent,

      sourceExecutionTransition: executionTransition,

      resultingCurrentContext,

      governance: {
        sameSentenceNodePreservedAcrossEpoch: true,

        canonicalSnapshotIdentityDeriverUsed: true,
        canonicalOccurrenceIdentityDeriverUsed: true,
        canonicalCurrentContextProducerUsed: true,

        sentenceSelectedHere: false,
        sentenceIndexUsedForIdentity: false,
        sentenceIndexUsedAsSelector: false,
        legacyMappingUsed: false,

        snapshotIdentityInventedHere: false,
        sentenceOccurrenceIdentityInventedHere: false,

        whereTruthRecomputed: false,
        bindingRecomputed: false,
        endpointDirectionRecomputed: false,
        activationPermissionRecomputed: false,
        executionAdmissionRecomputed: false,
        executionPlanRecomputed: false,

        graphMutatedHere: false,
        schedulerInvoked: false,
        learnerFacingInterpretationPerformed: false,
      },
    },

    blockingReasons: [],

    sourceCurrentContextResult,

    sourceExecutionTransitionResult,
  };
}
