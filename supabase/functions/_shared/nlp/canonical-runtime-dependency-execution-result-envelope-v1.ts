import type {
  CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1,
  CanonicalRuntimeDependencyExecutionGraphTransitionV1,
} from "./canonical-runtime-dependency-execution-graph-transition-boundary-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_V1 =
  "d7.18:canonical-runtime-dependency-execution-result-envelope-v1" as const;

export const CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeDependencyExecutionResultEnvelopeStateV1 =
  | "resolved_dependency_execution_result"
  | "unresolved_dependency_execution_result";

export type CanonicalRuntimeDependencyExecutionResultEnvelopeBlockingReasonV1 =
  | "source_transition_not_resolved"
  | "source_transition_missing"
  | "source_transition_has_blocking_reasons";

export type CanonicalRuntimeDependencyExecutionResultV1 = {
  readonly resultId: string;
  readonly status: "executed";

  readonly manifestId: string;
  readonly manifestCode: string;
  readonly structuralAuthorityId: string;

  readonly dependencyActionAuthorityId: string;

  readonly actionOrdinal: number;
  readonly actionIndex: number;

  readonly sourceSnapshotIdentityId: string;
  readonly resultingSnapshotIdentityId: string;

  readonly snapshotSentenceOccurrenceIdentityId: string;

  readonly sourceGraphDocumentId: string;
  readonly resultingGraphDocumentId: string;

  readonly resultingGraph:
    CanonicalRuntimeDependencyExecutionGraphTransitionV1["resultingGraph"];

  readonly resultingSnapshotIdentityAuthority:
    CanonicalRuntimeDependencyExecutionGraphTransitionV1[
      "resultingSnapshotIdentityAuthority"
    ];

  readonly sourceExecutionTransition:
    CanonicalRuntimeDependencyExecutionGraphTransitionV1;

  readonly governance: {
    readonly exactResolvedD715TransitionRequired: true;
    readonly executionMaterializationAlreadyPerformedUpstream: true;

    readonly resultingGraphPreservedExactly: true;
    readonly resultingSnapshotAuthorityPreservedExactly: true;
    readonly sourceExecutionTransitionPreservedExactly: true;

    readonly graphPatchAppliedHere: false;
    readonly graphMutatedHere: false;
    readonly snapshotIdentityDerivedHere: false;

    readonly whereTruthRecomputed: false;
    readonly bindingRecomputed: false;
    readonly endpointDirectionRecomputed: false;
    readonly activationPermissionRecomputed: false;
    readonly executionAdmissionRecomputed: false;
    readonly executionPlanRecomputed: false;
    readonly graphPatchRecomputed: false;

    readonly sentenceIndexUsedForIdentity: false;
    readonly legacyMappingUsed: false;

    readonly schedulerInvoked: false;
    readonly learnerFacingInterpretationPerformed: false;
  };
};

export type CanonicalRuntimeDependencyExecutionResultEnvelopeV1 = {
  readonly producer:
    typeof CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_V1;

  readonly producerVersion:
    typeof CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_VERSION_V1;

  readonly status: "candidate";

  readonly state: CanonicalRuntimeDependencyExecutionResultEnvelopeStateV1;

  readonly executionResult: CanonicalRuntimeDependencyExecutionResultV1 | null;

  readonly sourceTransitionResult:
    CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1;

  readonly blockingReasons:
    readonly CanonicalRuntimeDependencyExecutionResultEnvelopeBlockingReasonV1[];
};

function stableReasons(
  reasons:
    readonly CanonicalRuntimeDependencyExecutionResultEnvelopeBlockingReasonV1[],
): CanonicalRuntimeDependencyExecutionResultEnvelopeBlockingReasonV1[] {
  return [
    ...new Set(reasons),
  ].sort();
}

function unresolved(
  sourceTransitionResult:
    CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1,
  blockingReasons:
    readonly CanonicalRuntimeDependencyExecutionResultEnvelopeBlockingReasonV1[],
): CanonicalRuntimeDependencyExecutionResultEnvelopeV1 {
  return {
    producer: CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_V1,

    producerVersion:
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_VERSION_V1,

    status: "candidate",

    state: "unresolved_dependency_execution_result",

    executionResult: null,

    sourceTransitionResult,

    blockingReasons: stableReasons(blockingReasons),
  };
}

export function deriveCanonicalRuntimeDependencyExecutionResultEnvelopeV1(
  sourceTransitionResult:
    CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1,
): CanonicalRuntimeDependencyExecutionResultEnvelopeV1 {
  const blockingReasons:
    CanonicalRuntimeDependencyExecutionResultEnvelopeBlockingReasonV1[] = [];

  if (
    sourceTransitionResult.state !==
      "resolved_dependency_execution_graph_transition"
  ) {
    blockingReasons.push(
      "source_transition_not_resolved",
    );
  }

  if (
    sourceTransitionResult.transition === null
  ) {
    blockingReasons.push(
      "source_transition_missing",
    );
  }

  if (
    sourceTransitionResult.blockingReasons.length !== 0
  ) {
    blockingReasons.push(
      "source_transition_has_blocking_reasons",
    );
  }

  if (
    blockingReasons.length !== 0 ||
    sourceTransitionResult.transition === null
  ) {
    return unresolved(
      sourceTransitionResult,
      blockingReasons,
    );
  }

  const transition = sourceTransitionResult.transition;

  const resultId = [
    "runtime-dependency-execution-result-v1",
    transition.transitionId,
    transition.resultingSnapshotIdentityId,
  ].join(":");

  return {
    producer: CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_V1,

    producerVersion:
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_VERSION_V1,

    status: "candidate",

    state: "resolved_dependency_execution_result",

    executionResult: {
      resultId,

      status: "executed",

      manifestId: transition.manifestId,

      manifestCode: transition.manifestCode,

      structuralAuthorityId: transition.structuralAuthorityId,

      dependencyActionAuthorityId: transition.dependencyActionAuthorityId,

      actionOrdinal: transition.actionOrdinal,

      actionIndex: transition.actionIndex,

      sourceSnapshotIdentityId: transition.sourceSnapshotIdentityId,

      resultingSnapshotIdentityId: transition.resultingSnapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        transition.snapshotSentenceOccurrenceIdentityId,

      sourceGraphDocumentId: transition.sourceGraphDocumentId,

      resultingGraphDocumentId: transition.resultingGraphDocumentId,

      resultingGraph: transition.resultingGraph,

      resultingSnapshotIdentityAuthority:
        transition.resultingSnapshotIdentityAuthority,

      sourceExecutionTransition: transition,

      governance: {
        exactResolvedD715TransitionRequired: true,
        executionMaterializationAlreadyPerformedUpstream: true,

        resultingGraphPreservedExactly: true,
        resultingSnapshotAuthorityPreservedExactly: true,
        sourceExecutionTransitionPreservedExactly: true,

        graphPatchAppliedHere: false,
        graphMutatedHere: false,
        snapshotIdentityDerivedHere: false,

        whereTruthRecomputed: false,
        bindingRecomputed: false,
        endpointDirectionRecomputed: false,
        activationPermissionRecomputed: false,
        executionAdmissionRecomputed: false,
        executionPlanRecomputed: false,
        graphPatchRecomputed: false,

        sentenceIndexUsedForIdentity: false,
        legacyMappingUsed: false,

        schedulerInvoked: false,
        learnerFacingInterpretationPerformed: false,
      },
    },

    sourceTransitionResult,

    blockingReasons: [],
  };
}
