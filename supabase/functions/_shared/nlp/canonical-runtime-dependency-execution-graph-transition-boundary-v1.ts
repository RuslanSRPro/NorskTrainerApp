import type {
  CanonicalRuntimeDependencyExecutionGraphPatchV1,
} from "./canonical-runtime-dependency-execution-graph-patch-boundary-v1.ts";

import {
  applyGraphPatchV1,
  type CanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  type CanonicalGraphSnapshotIdentityAuthorityV1,
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import type {
  CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_V1 =
  "d7.15:dependency-execution-graph-transition-boundary-v1" as const;

export const CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeDependencyExecutionGraphTransitionStateV1 =
  | "resolved_dependency_execution_graph_transition"
  | "unresolved_dependency_execution_graph_transition";

export type CanonicalRuntimeDependencyExecutionGraphTransitionBlockingReasonV1 =
  | "source_snapshot_identity_authority_mismatch"
  | "source_graph_snapshot_identity_unresolved"
  | "source_graph_snapshot_identity_mismatch"
  | "source_graph_document_identity_mismatch"
  | "resulting_graph_snapshot_identity_unresolved"
  | "resulting_graph_document_identity_mismatch";

export type CanonicalRuntimeDependencyExecutionGraphTransitionV1 = {
  readonly transitionId: string;
  readonly status: "candidate";

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

  readonly sourceGraph: CanonicalLanguageGraphV1;
  readonly resultingGraph: CanonicalLanguageGraphV1;

  readonly sourceSnapshotIdentityAuthority:
    CanonicalGraphSnapshotIdentityAuthorityV1;

  readonly resultingSnapshotIdentityAuthority:
    CanonicalGraphSnapshotIdentityAuthorityV1;

  readonly sourceExecutionGraphPatch:
    CanonicalRuntimeDependencyExecutionGraphPatchV1;

  readonly governance: {
    readonly exactD714GraphPatchRequired: true;

    readonly sourceGraphSnapshotVerifiedBeforeApplication: true;

    readonly exactD714GraphPatchApplied: true;
    readonly graphPatchApplicationCount: 1;

    readonly existingCanonicalGraphPatchPrimitiveUsed: true;

    readonly relationRecomputed: false;
    readonly endpointDirectionRecomputed: false;
    readonly bindingRecomputed: false;
    readonly whereTruthRecomputed: false;
    readonly activationPermissionRecomputed: false;
    readonly executionAdmissionRecomputed: false;

    readonly sentenceIndexUsedForTransitionIdentity: false;
    readonly legacyMappingUsed: false;

    readonly resultingSnapshotDerivedFromResultingGraph: true;
    readonly snapshotVersionIncremented: false;
    readonly snapshotIdentityInvented: false;

    readonly schedulerInvoked: false;
  };
};

export type CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1 =
  {
    readonly producer:
      typeof CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_V1;

    readonly producerVersion:
      typeof CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_VERSION_V1;

    readonly status: "candidate";

    readonly state: CanonicalRuntimeDependencyExecutionGraphTransitionStateV1;

    readonly transition:
      | CanonicalRuntimeDependencyExecutionGraphTransitionV1
      | null;

    readonly sourceExecutionGraphPatch:
      CanonicalRuntimeDependencyExecutionGraphPatchV1;

    readonly blockingReasons:
      readonly CanonicalRuntimeDependencyExecutionGraphTransitionBlockingReasonV1[];
  };

function unresolved(
  sourceExecutionGraphPatch: CanonicalRuntimeDependencyExecutionGraphPatchV1,
  blockingReasons:
    readonly CanonicalRuntimeDependencyExecutionGraphTransitionBlockingReasonV1[],
): CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_V1,

    producerVersion:
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_VERSION_V1,

    status: "candidate",

    state: "unresolved_dependency_execution_graph_transition",

    transition: null,

    sourceExecutionGraphPatch,

    blockingReasons: [
      ...new Set(blockingReasons),
    ].sort(),
  };
}

export async function deriveCanonicalRuntimeDependencyExecutionGraphTransitionBoundaryV1(
  sourceExecutionGraphPatch: CanonicalRuntimeDependencyExecutionGraphPatchV1,
  surface: CanonicalSurfaceDocumentV1,
  sourceGraph: CanonicalLanguageGraphV1,
  sourceSnapshotIdentityAuthority: CanonicalGraphSnapshotIdentityAuthorityV1,
): Promise<
  CanonicalRuntimeDependencyExecutionGraphTransitionBoundaryResultV1
> {
  if (
    sourceSnapshotIdentityAuthority.snapshotIdentityId !==
      sourceExecutionGraphPatch.sourceSnapshotIdentityId
  ) {
    return unresolved(
      sourceExecutionGraphPatch,
      ["source_snapshot_identity_authority_mismatch"],
    );
  }

  if (
    sourceSnapshotIdentityAuthority.graphDocumentId !==
      sourceGraph.documentId
  ) {
    return unresolved(
      sourceExecutionGraphPatch,
      ["source_graph_document_identity_mismatch"],
    );
  }

  const verifiedSourceSnapshot =
    await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      surface,
      sourceGraph,
    );

  if (
    verifiedSourceSnapshot.status !== "ready" ||
    verifiedSourceSnapshot.authority === undefined
  ) {
    return unresolved(
      sourceExecutionGraphPatch,
      ["source_graph_snapshot_identity_unresolved"],
    );
  }

  if (
    verifiedSourceSnapshot.authority.snapshotIdentityId !==
      sourceSnapshotIdentityAuthority.snapshotIdentityId ||
    verifiedSourceSnapshot.authority.snapshotIdentityId !==
      sourceExecutionGraphPatch.sourceSnapshotIdentityId
  ) {
    return unresolved(
      sourceExecutionGraphPatch,
      ["source_graph_snapshot_identity_mismatch"],
    );
  }

  if (
    verifiedSourceSnapshot.authority.graphDocumentId !==
      sourceGraph.documentId
  ) {
    return unresolved(
      sourceExecutionGraphPatch,
      ["source_graph_document_identity_mismatch"],
    );
  }

  const resultingGraph = applyGraphPatchV1(
    sourceGraph,
    sourceExecutionGraphPatch.graphPatch,
  );

  if (
    resultingGraph.documentId !==
      sourceGraph.documentId
  ) {
    return unresolved(
      sourceExecutionGraphPatch,
      ["resulting_graph_document_identity_mismatch"],
    );
  }

  const resultingSnapshot =
    await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      surface,
      resultingGraph,
    );

  if (
    resultingSnapshot.status !== "ready" ||
    resultingSnapshot.authority === undefined
  ) {
    return unresolved(
      sourceExecutionGraphPatch,
      ["resulting_graph_snapshot_identity_unresolved"],
    );
  }

  if (
    resultingSnapshot.authority.graphDocumentId !==
      resultingGraph.documentId
  ) {
    return unresolved(
      sourceExecutionGraphPatch,
      ["resulting_graph_document_identity_mismatch"],
    );
  }

  const transitionId = [
    "runtime-dependency-execution-graph-transition-v1",
    sourceExecutionGraphPatch.patchId,
    sourceExecutionGraphPatch.sourceSnapshotIdentityId,
    resultingSnapshot.authority.snapshotIdentityId,
  ].join(":");

  return {
    producer:
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_V1,

    producerVersion:
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_VERSION_V1,

    status: "candidate",

    state: "resolved_dependency_execution_graph_transition",

    transition: {
      transitionId,

      status: "candidate",

      manifestId: sourceExecutionGraphPatch.manifestId,

      manifestCode: sourceExecutionGraphPatch.manifestCode,

      structuralAuthorityId: sourceExecutionGraphPatch.structuralAuthorityId,

      dependencyActionAuthorityId:
        sourceExecutionGraphPatch.dependencyActionAuthorityId,

      actionOrdinal: sourceExecutionGraphPatch.actionOrdinal,

      actionIndex: sourceExecutionGraphPatch.actionIndex,

      sourceSnapshotIdentityId:
        sourceExecutionGraphPatch.sourceSnapshotIdentityId,

      resultingSnapshotIdentityId:
        resultingSnapshot.authority.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        sourceExecutionGraphPatch.snapshotSentenceOccurrenceIdentityId,

      sourceGraphDocumentId: sourceGraph.documentId,

      resultingGraphDocumentId: resultingGraph.documentId,

      sourceGraph,

      resultingGraph,

      sourceSnapshotIdentityAuthority,

      resultingSnapshotIdentityAuthority: resultingSnapshot.authority,

      sourceExecutionGraphPatch,

      governance: {
        exactD714GraphPatchRequired: true,

        sourceGraphSnapshotVerifiedBeforeApplication: true,

        exactD714GraphPatchApplied: true,
        graphPatchApplicationCount: 1,

        existingCanonicalGraphPatchPrimitiveUsed: true,

        relationRecomputed: false,
        endpointDirectionRecomputed: false,
        bindingRecomputed: false,
        whereTruthRecomputed: false,
        activationPermissionRecomputed: false,
        executionAdmissionRecomputed: false,

        sentenceIndexUsedForTransitionIdentity: false,
        legacyMappingUsed: false,

        resultingSnapshotDerivedFromResultingGraph: true,
        snapshotVersionIncremented: false,
        snapshotIdentityInvented: false,

        schedulerInvoked: false,
      },
    },

    sourceExecutionGraphPatch,

    blockingReasons: [],
  };
}
