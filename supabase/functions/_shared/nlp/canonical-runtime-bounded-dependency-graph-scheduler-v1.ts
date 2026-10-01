import {
  type CanonicalRuntimeDependencyActionActivationAuthorityV1,
  resolveCanonicalRuntimeDependencyActionActivationAuthorityV1,
} from "./canonical-runtime-dependency-action-activation-authority-resolution-v1.ts";
import { deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1 } from "./canonical-runtime-action-execution-admission-boundary-v1.ts";
import { deriveCanonicalRuntimeDependencyExecutionPlanBoundaryV1 } from "./canonical-runtime-dependency-execution-plan-boundary-v1.ts";
import { deriveCanonicalRuntimeDependencyExecutionGraphPatchBoundaryV1 } from "./canonical-runtime-dependency-execution-graph-patch-boundary-v1.ts";
import { deriveCanonicalRuntimeDependencyExecutionGraphTransitionBoundaryV1 } from "./canonical-runtime-dependency-execution-graph-transition-boundary-v1.ts";
import { deriveCanonicalRuntimeDependencyExecutionResultEnvelopeV1 } from "./canonical-runtime-dependency-execution-result-envelope-v1.ts";
import { deriveCanonicalRuntimeEpochCurrentContextTransitionBoundaryV1 } from "./canonical-runtime-epoch-current-context-transition-boundary-v1.ts";
import {
  type CanonicalRuntimeMultiSitePostTransitionReevaluationInputV1,
  deriveCanonicalRuntimeMultiSitePostTransitionReevaluationBoundaryV1,
} from "./canonical-runtime-multi-site-post-transition-reevaluation-boundary-v1.ts";
import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeResultV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-action-candidate-bridge-v1.ts";
import type {
  CanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryResultV1,
  CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
} from "./canonical-runtime-action-execution-precondition-evidence-boundary-v1.ts";
import type {
  CanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryResultV1,
} from "./canonical-runtime-dependency-endpoint-resolution-evidence-boundary-v1.ts";

export const CANONICAL_RUNTIME_BOUNDED_DEPENDENCY_GRAPH_SCHEDULER_V1 =
  "a3.4:canonical-runtime-bounded-dependency-graph-scheduler-v1" as const;
export const CANONICAL_RUNTIME_BOUNDED_DEPENDENCY_GRAPH_SCHEDULER_VERSION_V1 =
  "1.0.0" as const;

type Graph = Parameters<
  typeof deriveCanonicalRuntimeDependencyExecutionGraphPatchBoundaryV1
>[2];
type Surface = Parameters<
  typeof deriveCanonicalRuntimeDependencyExecutionGraphPatchBoundaryV1
>[1];
type SnapshotAuthority = Parameters<
  typeof deriveCanonicalRuntimeDependencyExecutionGraphPatchBoundaryV1
>[3];
type CurrentContextResult = Parameters<
  typeof deriveCanonicalRuntimeEpochCurrentContextTransitionBoundaryV1
>[1];
type ReevaluationSeed = Omit<
  CanonicalRuntimeMultiSitePostTransitionReevaluationInputV1["seed"],
  "epochTransitionResult"
>;
type DependencyCandidate = Extract<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateV1,
  { family: "create_dependency" }
>;

export type CanonicalRuntimeBoundedDependencyGraphSchedulerInitialEpochV1 =
  Readonly<{
    graph: Graph;
    currentContextResult: CurrentContextResult;
    snapshotIdentityAuthority: SnapshotAuthority;
    actionCandidateBridges:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeResultV1[];
    endpointResolutionEvidenceResult:
      CanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryResultV1;
    d4PreconditionEvidenceResult:
      CanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryResultV1;
  }>;

export type CanonicalRuntimeBoundedDependencyGraphSchedulerInputV1 = Readonly<{
  surface: Surface;
  executionInvocationId: string;
  maxTransitions: number;
  activationAuthorities:
    readonly CanonicalRuntimeDependencyActionActivationAuthorityV1[];
  initialEpoch: CanonicalRuntimeBoundedDependencyGraphSchedulerInitialEpochV1;
  reevaluationSeed: ReevaluationSeed;
  tokenNodeIds: readonly string[];
}>;

function blocked(
  stage: string,
  reasons: readonly string[],
  transitionCount: number,
) {
  return {
    producer: CANONICAL_RUNTIME_BOUNDED_DEPENDENCY_GRAPH_SCHEDULER_V1,
    producerVersion:
      CANONICAL_RUNTIME_BOUNDED_DEPENDENCY_GRAPH_SCHEDULER_VERSION_V1,
    status: "blocked" as const,
    state: "blocked_bounded_dependency_graph_scheduler" as const,
    stage,
    transitionCount,
    blockingReasons: [...new Set(reasons)].sort(),
    governance: {
      operationalBoundRequired: true as const,
      actionIndexUsedOnlyWithinExactManifest: true as const,
      crossManifestPriorityInvented: false as const,
      unsupportedSetRoleExecuted: false as const,
      activationResolvedByCanonicalD6: true as const,
      admissionResolvedByCanonicalD73: true as const,
      executionPlanDerivedByCanonicalD710: true as const,
      graphPatchDerivedByCanonicalD714: true as const,
      graphTransitionDerivedByCanonicalD715: true as const,
      executionResultDerivedByCanonicalD718: true as const,
      postTransitionEvidenceRederivedByCanonicalA38C: true as const,
      staleSnapshotBoundEvidenceReusedAfterTransition: false as const,
      newLinguisticSemanticsCreated: false as const,
      learnerFacingInterpretationPerformed: false as const,
    },
  };
}

export async function runCanonicalRuntimeBoundedDependencyGraphSchedulerV1(
  input: CanonicalRuntimeBoundedDependencyGraphSchedulerInputV1,
) {
  if (
    !Number.isInteger(input.maxTransitions) ||
    input.maxTransitions <= 0
  ) {
    return blocked("scheduler_input", ["max_transitions:invalid"], 0);
  }
  if (input.executionInvocationId.trim().length === 0) {
    return blocked("scheduler_input", ["execution_invocation_id:missing"], 0);
  }
  if (input.initialEpoch.currentContextResult.status !== "ready") {
    return blocked("initial_epoch", ["current_context:not_ready"], 0);
  }
  if (input.initialEpoch.endpointResolutionEvidenceResult.status !== "ready") {
    return blocked("initial_epoch", ["endpoint_evidence:not_ready"], 0);
  }
  if (input.initialEpoch.d4PreconditionEvidenceResult.status !== "ready") {
    return blocked("initial_epoch", ["d4_precondition:not_ready"], 0);
  }

  let graph = input.initialEpoch.graph;
  let currentContextResult = input.initialEpoch.currentContextResult;
  let snapshotIdentityAuthority = input.initialEpoch.snapshotIdentityAuthority;
  let actionCandidateBridges = [
    ...input.initialEpoch.actionCandidateBridges,
  ];
  let endpointResolutionEvidenceResult =
    input.initialEpoch.endpointResolutionEvidenceResult;
  let d4PreconditionEvidenceResult =
    input.initialEpoch.d4PreconditionEvidenceResult;

  const executionResults = [];
  const visitedSnapshotActionPairs = new Set<string>();

  for (
    let transitionCount = 0;
    transitionCount < input.maxTransitions;
    transitionCount += 1
  ) {
    const allCandidates:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateV1[] = [];

    for (const bridgeResult of actionCandidateBridges) {
      if (bridgeResult.status !== "ready") {
        return blocked(
          "action_candidates",
          bridgeResult.blockingReasons.map((x) => `bridge:${x}`),
          transitionCount,
        );
      }
      allCandidates.push(...bridgeResult.bridge.actionCandidates);
    }

    const dependencyCandidates = allCandidates.filter(
      (candidate): candidate is DependencyCandidate =>
        candidate.family === "create_dependency",
    );

    const admissions = d4PreconditionEvidenceResult.evidence.map(
      (precondition) => {
        const exactCandidates = dependencyCandidates.filter(
          (candidate) =>
            candidate.sourceAuthority.id ===
              precondition.dependencyActionAuthorityId &&
            candidate.sourceAuthority.manifestId ===
              precondition.manifestId,
        );

        if (exactCandidates.length !== 1) {
          return {
            precondition,
            candidate: null,
            activation: null,
            admission: null,
            blockingReason: exactCandidates.length === 0
              ? "exact_dependency_candidate:missing"
              : "exact_dependency_candidate:ambiguous",
          };
        }

        const activation =
          resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
            precondition,
            input.activationAuthorities,
          );
        const admission =
          deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
            precondition,
            activation,
          );

        return {
          precondition,
          candidate: exactCandidates[0],
          activation,
          admission,
          blockingReason: null,
        };
      },
    );

    const correlationFailures = admissions.filter(
      (item) => item.blockingReason !== null,
    );
    if (correlationFailures.length !== 0) {
      return blocked(
        "candidate_correlation",
        correlationFailures.map((item) =>
          `${item.precondition.manifestId}:${item.precondition.dependencyActionAuthorityId}:${item.blockingReason}`
        ),
        transitionCount,
      );
    }

    const unresolvedAdmissions = admissions.filter(
      (item) => item.admission?.state === "unresolved",
    );
    if (unresolvedAdmissions.length !== 0) {
      return blocked(
        "execution_admission",
        unresolvedAdmissions.map((item) =>
          `${item.precondition.manifestId}:${item.precondition.dependencyActionAuthorityId}:unresolved`
        ),
        transitionCount,
      );
    }

    const admitted = admissions.filter(
      (item): item is typeof item & {
        candidate: DependencyCandidate;
        admission: NonNullable<typeof item.admission>;
      } =>
        item.candidate !== null &&
        item.admission !== null &&
        item.admission.state === "admitted",
    );

    if (admitted.length === 0) {
      return {
        producer: CANONICAL_RUNTIME_BOUNDED_DEPENDENCY_GRAPH_SCHEDULER_V1,
        producerVersion:
          CANONICAL_RUNTIME_BOUNDED_DEPENDENCY_GRAPH_SCHEDULER_VERSION_V1,
        status: "ready" as const,
        state: "quiescent_bounded_dependency_graph_scheduler" as const,
        transitionCount,
        resultingGraph: graph,
        resultingSnapshotIdentityAuthority: snapshotIdentityAuthority,
        resultingCurrentContextResult: currentContextResult,
        executionResults,
        blockingReasons: [] as const,
        governance: {
          operationalBoundRequired: true as const,
          noAdmittedDependencyActionStopsScheduler: true as const,
          actionIndexUsedOnlyWithinExactManifest: true as const,
          crossManifestPriorityInvented: false as const,
          unsupportedSetRoleExecuted: false as const,
          staleSnapshotBoundEvidenceReusedAfterTransition: false as const,
          postTransitionEvidenceRederivedByCanonicalA38C: true as const,
          newLinguisticSemanticsCreated: false as const,
          learnerFacingInterpretationPerformed: false as const,
        },
      };
    }

    const admittedManifestIds = [
      ...new Set(admitted.map((item) => item.precondition.manifestId)),
    ];
    if (admittedManifestIds.length !== 1) {
      return blocked(
        "scheduler_order",
        ["cross_manifest_admitted_action_priority:not_source_backed"],
        transitionCount,
      );
    }

    const manifestId = admittedManifestIds[0];
    const unsupportedSetRole = allCandidates.filter(
      (candidate) =>
        candidate.family === "set_role" &&
        candidate.sourceAuthority.manifestId === manifestId,
    );
    if (unsupportedSetRole.length !== 0) {
      return blocked(
        "unsupported_action_family",
        unsupportedSetRole.map((candidate) =>
          `${manifestId}:set_role:${candidate.actionIndex}`
        ),
        transitionCount,
      );
    }

    admitted.sort(
      (left, right) =>
        left.candidate.actionIndex - right.candidate.actionIndex ||
        left.candidate.sourceAuthority.id.localeCompare(
          right.candidate.sourceAuthority.id,
        ) ||
        left.precondition.actionOrdinal - right.precondition.actionOrdinal,
    );

    const selected = admitted[0];
    const sameOrder = admitted.filter(
      (item) =>
        item.candidate.actionIndex === selected.candidate.actionIndex &&
        item.candidate.sourceAuthority.id ===
          selected.candidate.sourceAuthority.id,
    );
    if (sameOrder.length !== 1) {
      return blocked(
        "scheduler_order",
        ["same_action_order:ambiguous_precondition"],
        transitionCount,
      );
    }

    const pairKey = [
      snapshotIdentityAuthority.snapshotIdentityId,
      selected.candidate.sourceAuthority.id,
    ].join(":");
    if (visitedSnapshotActionPairs.has(pairKey)) {
      return blocked(
        "scheduler_progress",
        ["snapshot_action_pair:repeated"],
        transitionCount,
      );
    }
    visitedSnapshotActionPairs.add(pairKey);

    const endpointEvidence = endpointResolutionEvidenceResult.evidence.filter(
      (evidence) =>
        evidence.dependencyActionAuthorityId ===
          selected.precondition.dependencyActionAuthorityId &&
        evidence.manifestId === selected.precondition.manifestId &&
        evidence.snapshotIdentityId ===
          selected.precondition.snapshotIdentityId &&
        evidence.snapshotSentenceOccurrenceIdentityId ===
          selected.precondition.snapshotSentenceOccurrenceIdentityId,
    );

    const planResult = deriveCanonicalRuntimeDependencyExecutionPlanBoundaryV1(
      selected.admission,
      selected.candidate,
      endpointEvidence,
    );
    if (
      planResult.state !==
        "resolved_deterministic_dependency_execution_plan" ||
      planResult.plan === null
    ) {
      return blocked(
        "execution_plan",
        planResult.blockingReasons.map((x) => `plan:${x}`),
        transitionCount,
      );
    }

    const patchResult =
      await deriveCanonicalRuntimeDependencyExecutionGraphPatchBoundaryV1(
        planResult.plan,
        input.surface,
        graph,
        snapshotIdentityAuthority,
      );
    if (
      patchResult.state !== "resolved_dependency_execution_graph_patch" ||
      patchResult.materialization === null
    ) {
      return blocked(
        "graph_patch",
        patchResult.blockingReasons.map((x) => `patch:${x}`),
        transitionCount,
      );
    }

    const transitionResult =
      await deriveCanonicalRuntimeDependencyExecutionGraphTransitionBoundaryV1(
        patchResult.materialization,
        input.surface,
        graph,
        snapshotIdentityAuthority,
      );
    if (
      transitionResult.state !==
        "resolved_dependency_execution_graph_transition" ||
      transitionResult.transition === null
    ) {
      return blocked(
        "graph_transition",
        transitionResult.blockingReasons.map((x) => `transition:${x}`),
        transitionCount,
      );
    }

    if (
      transitionResult.transition.resultingSnapshotIdentityId ===
        transitionResult.transition.sourceSnapshotIdentityId
    ) {
      return blocked(
        "scheduler_progress",
        ["snapshot_identity:unchanged_after_transition"],
        transitionCount,
      );
    }

    const executionResult =
      deriveCanonicalRuntimeDependencyExecutionResultEnvelopeV1(
        transitionResult,
      );
    if (
      executionResult.state !== "resolved_dependency_execution_result" ||
      executionResult.executionResult === null
    ) {
      return blocked(
        "execution_result",
        executionResult.blockingReasons.map((x) => `result:${x}`),
        transitionCount,
      );
    }
    executionResults.push(executionResult.executionResult);

    const epochTransitionResult =
      await deriveCanonicalRuntimeEpochCurrentContextTransitionBoundaryV1(
        input.surface,
        currentContextResult,
        transitionResult,
        input.executionInvocationId,
      );
    if (
      epochTransitionResult.state !==
        "resolved_epoch_current_context_transition" ||
      epochTransitionResult.transition === null
    ) {
      return blocked(
        "epoch_current_context",
        epochTransitionResult.blockingReasons.map((x) => `epoch:${x}`),
        transitionCount + 1,
      );
    }

    const reevaluation =
      await deriveCanonicalRuntimeMultiSitePostTransitionReevaluationBoundaryV1(
        {
          seed: {
            ...input.reevaluationSeed,
            epochTransitionResult,
          },
          tokenNodeIds: input.tokenNodeIds,
        },
      );
    if (reevaluation.status !== "ready") {
      return blocked(
        "post_transition_reevaluation",
        reevaluation.blockingReasons.map((x) =>
          `reevaluation:${reevaluation.stage}:${x}`
        ),
        transitionCount + 1,
      );
    }

    graph = transitionResult.transition.resultingGraph;
    currentContextResult =
      epochTransitionResult.transition.resultingCurrentContext;
    snapshotIdentityAuthority =
      transitionResult.transition.resultingSnapshotIdentityAuthority;
    actionCandidateBridges = [...reevaluation.actionCandidateBridges];
    endpointResolutionEvidenceResult =
      reevaluation.endpointResolutionEvidenceResult;
    d4PreconditionEvidenceResult = reevaluation.d4PreconditionEvidenceResult;
  }

  return blocked(
    "scheduler_bound",
    ["max_transitions:reached_before_quiescence"],
    input.maxTransitions,
  );
}
