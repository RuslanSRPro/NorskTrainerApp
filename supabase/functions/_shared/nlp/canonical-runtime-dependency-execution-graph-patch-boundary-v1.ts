import type {
  CanonicalRuntimeDependencyExecutionPlanV1,
} from "./canonical-runtime-dependency-execution-plan-boundary-v1.ts";

import type {
  CanonicalRuntimeDependencyEndpointResolutionEvidenceV1,
} from "./canonical-runtime-dependency-endpoint-resolution-evidence-boundary-v1.ts";

import type {
  CanonicalLanguageGraphV1,
  GraphPatchV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  type CanonicalGraphSnapshotIdentityAuthorityV1,
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import type {
  CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_V1 =
  "d7.14:dependency-execution-graph-patch-boundary-v1" as const;

export const CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeDependencyExecutionGraphPatchStateV1 =
  | "resolved_dependency_execution_graph_patch"
  | "unresolved_dependency_execution_graph_patch";

export type CanonicalRuntimeDependencyExecutionGraphPatchBlockingReasonV1 =
  | "source_snapshot_identity_authority_mismatch"
  | "source_graph_snapshot_identity_unresolved"
  | "source_graph_snapshot_identity_mismatch"
  | "graph_document_identity_mismatch"
  | "plan_relation_missing"
  | "endpoint_evidence_multiplicity_mismatch"
  | "source_endpoint_evidence_missing_or_ambiguous"
  | "target_endpoint_evidence_missing_or_ambiguous"
  | "endpoint_evidence_unresolved"
  | "endpoint_action_authority_identity_mismatch"
  | "endpoint_snapshot_identity_mismatch"
  | "endpoint_sentence_occurrence_identity_mismatch"
  | "endpoint_binding_value_missing"
  | "endpoint_binding_member_multiplicity_mismatch"
  | "endpoint_binding_member_identity_mismatch"
  | "endpoint_graph_document_identity_mismatch"
  | "endpoint_token_node_missing";

export type CanonicalRuntimeDependencyExecutionGraphPatchV1 = {
  readonly patchId: string;

  readonly status: "candidate";

  readonly manifestId: string;
  readonly manifestCode: string;

  readonly structuralAuthorityId: string;

  readonly sourceSnapshotIdentityId: string;
  readonly snapshotSentenceOccurrenceIdentityId: string;

  readonly dependencyActionAuthorityId: string;

  readonly actionOrdinal: number;
  readonly actionIndex: number;

  readonly relation: string;

  readonly sourceTokenNodeId: string;
  readonly targetTokenNodeId: string;

  readonly edgeId: string;
  readonly evidenceId: string;
  readonly provenanceId: string;

  readonly graphPatch: GraphPatchV1;

  readonly sourceExecutionPlan: CanonicalRuntimeDependencyExecutionPlanV1;

  readonly sourceSnapshotIdentityAuthority:
    CanonicalGraphSnapshotIdentityAuthorityV1;

  readonly sourceEndpointEvidence:
    CanonicalRuntimeDependencyEndpointResolutionEvidenceV1;

  readonly targetEndpointEvidence:
    CanonicalRuntimeDependencyEndpointResolutionEvidenceV1;

  readonly governance: {
    readonly exactExecutionPlanRequired: true;

    readonly exactSourceSnapshotIdentityRequired: true;
    readonly exactSourceGraphSnapshotVerified: true;
    readonly exactCurrentSentenceOccurrenceIdentityRequired: true;

    readonly exactResolvedEndpointEvidenceRequired: true;
    readonly exactEndpointBindingMembersRequired: true;

    readonly canonicalTokenNodeIdentityConsumedDirectly: true;

    readonly sentenceIndexUsedForEndpointIdentity: false;
    readonly legacyMappingUsed: false;
    readonly endpointDirectionInferred: false;
    readonly endpointBindingRecomputed: false;

    readonly truthRecomputed: false;
    readonly activationPermissionRecomputed: false;
    readonly executionAdmissionRecomputed: false;

    readonly dependencyRelationRecomputed: false;

    readonly deterministicEdgeIdentityDerivedFromPlanIdentity: true;
    readonly deterministicEvidenceIdentityDerivedFromPlanIdentity: true;
    readonly deterministicProvenanceIdentityDerivedFromPlanIdentity: true;

    readonly graphPatchGenerated: true;
    readonly graphPatchApplied: false;
    readonly graphMutationPerformed: false;

    readonly nextSnapshotIdentityDerived: false;

    readonly schedulerInvoked: false;
  };
};

export type CanonicalRuntimeDependencyExecutionGraphPatchBoundaryResultV1 = {
  readonly producer:
    typeof CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_V1;

  readonly producerVersion:
    typeof CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_VERSION_V1;

  readonly status: "candidate";

  readonly state: CanonicalRuntimeDependencyExecutionGraphPatchStateV1;

  readonly materialization:
    | CanonicalRuntimeDependencyExecutionGraphPatchV1
    | null;

  readonly sourceExecutionPlan: CanonicalRuntimeDependencyExecutionPlanV1;

  readonly blockingReasons:
    readonly CanonicalRuntimeDependencyExecutionGraphPatchBlockingReasonV1[];
};

function unresolved(
  plan: CanonicalRuntimeDependencyExecutionPlanV1,
  blockingReasons:
    readonly CanonicalRuntimeDependencyExecutionGraphPatchBlockingReasonV1[],
): CanonicalRuntimeDependencyExecutionGraphPatchBoundaryResultV1 {
  return {
    producer: CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_V1,

    producerVersion:
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_VERSION_V1,

    status: "candidate",

    state: "unresolved_dependency_execution_graph_patch",

    materialization: null,

    sourceExecutionPlan: plan,

    blockingReasons: [
      ...new Set(blockingReasons),
    ].sort(),
  };
}

function exactEndpointEvidence(
  plan: CanonicalRuntimeDependencyExecutionPlanV1,
  role: "source" | "target",
): CanonicalRuntimeDependencyEndpointResolutionEvidenceV1[] {
  return plan.sourceEndpointResolutionEvidence.filter(
    (evidence) => evidence.authoredEndpointRole === role,
  );
}

function tokenNodeExists(
  graph: CanonicalLanguageGraphV1,
  tokenNodeId: string,
): boolean {
  return graph.nodes.some(
    (node) =>
      node.id === tokenNodeId &&
      node.type === "token",
  );
}

function governance(): CanonicalRuntimeDependencyExecutionGraphPatchV1[
  "governance"
] {
  return {
    exactExecutionPlanRequired: true,

    exactSourceSnapshotIdentityRequired: true,
    exactSourceGraphSnapshotVerified: true,
    exactCurrentSentenceOccurrenceIdentityRequired: true,

    exactResolvedEndpointEvidenceRequired: true,
    exactEndpointBindingMembersRequired: true,

    canonicalTokenNodeIdentityConsumedDirectly: true,

    sentenceIndexUsedForEndpointIdentity: false,
    legacyMappingUsed: false,
    endpointDirectionInferred: false,
    endpointBindingRecomputed: false,

    truthRecomputed: false,
    activationPermissionRecomputed: false,
    executionAdmissionRecomputed: false,

    dependencyRelationRecomputed: false,

    deterministicEdgeIdentityDerivedFromPlanIdentity: true,
    deterministicEvidenceIdentityDerivedFromPlanIdentity: true,
    deterministicProvenanceIdentityDerivedFromPlanIdentity: true,

    graphPatchGenerated: true,
    graphPatchApplied: false,
    graphMutationPerformed: false,

    nextSnapshotIdentityDerived: false,

    schedulerInvoked: false,
  };
}

export async function deriveCanonicalRuntimeDependencyExecutionGraphPatchBoundaryV1(
  plan: CanonicalRuntimeDependencyExecutionPlanV1,
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
  sourceSnapshotIdentityAuthority: CanonicalGraphSnapshotIdentityAuthorityV1,
): Promise<
  CanonicalRuntimeDependencyExecutionGraphPatchBoundaryResultV1
> {
  if (
    sourceSnapshotIdentityAuthority.snapshotIdentityId !==
      plan.snapshotIdentityId
  ) {
    return unresolved(
      plan,
      ["source_snapshot_identity_authority_mismatch"],
    );
  }

  if (
    sourceSnapshotIdentityAuthority.graphDocumentId !==
      graph.documentId
  ) {
    return unresolved(
      plan,
      ["graph_document_identity_mismatch"],
    );
  }

  const derivedSnapshot = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    surface,
    graph,
  );

  if (
    derivedSnapshot.status !== "ready" ||
    derivedSnapshot.authority === undefined
  ) {
    return unresolved(
      plan,
      ["source_graph_snapshot_identity_unresolved"],
    );
  }

  if (
    derivedSnapshot.authority.snapshotIdentityId !==
      sourceSnapshotIdentityAuthority.snapshotIdentityId ||
    derivedSnapshot.authority.snapshotIdentityId !==
      plan.snapshotIdentityId
  ) {
    return unresolved(
      plan,
      ["source_graph_snapshot_identity_mismatch"],
    );
  }

  if (
    derivedSnapshot.authority.graphDocumentId !==
      graph.documentId
  ) {
    return unresolved(
      plan,
      ["graph_document_identity_mismatch"],
    );
  }

  if (
    typeof plan.relation !== "string" ||
    plan.relation.length === 0
  ) {
    return unresolved(
      plan,
      ["plan_relation_missing"],
    );
  }

  if (
    plan.sourceEndpointResolutionEvidence.length !== 2
  ) {
    return unresolved(
      plan,
      ["endpoint_evidence_multiplicity_mismatch"],
    );
  }

  const sourceEvidence = exactEndpointEvidence(
    plan,
    "source",
  );

  const targetEvidence = exactEndpointEvidence(
    plan,
    "target",
  );

  if (sourceEvidence.length !== 1) {
    return unresolved(
      plan,
      ["source_endpoint_evidence_missing_or_ambiguous"],
    );
  }

  if (targetEvidence.length !== 1) {
    return unresolved(
      plan,
      ["target_endpoint_evidence_missing_or_ambiguous"],
    );
  }

  const source = sourceEvidence[0];
  const target = targetEvidence[0];

  for (const evidence of [source, target]) {
    if (
      evidence.state !==
        "resolved_exact_endpoint_binding_evidence"
    ) {
      return unresolved(
        plan,
        ["endpoint_evidence_unresolved"],
      );
    }

    if (
      evidence.dependencyActionAuthorityId !==
        plan.dependencyActionAuthorityId
    ) {
      return unresolved(
        plan,
        ["endpoint_action_authority_identity_mismatch"],
      );
    }

    if (
      evidence.snapshotIdentityId !==
        plan.snapshotIdentityId
    ) {
      return unresolved(
        plan,
        ["endpoint_snapshot_identity_mismatch"],
      );
    }

    if (
      evidence.snapshotSentenceOccurrenceIdentityId !==
        plan.snapshotSentenceOccurrenceIdentityId
    ) {
      return unresolved(
        plan,
        ["endpoint_sentence_occurrence_identity_mismatch"],
      );
    }

    const value = evidence.sourceFinalRuntimeBindingValue;

    if (value === null) {
      return unresolved(
        plan,
        ["endpoint_binding_value_missing"],
      );
    }

    if (
      value.memberCount !== 1 ||
      value.members.length !== 1
    ) {
      return unresolved(
        plan,
        ["endpoint_binding_member_multiplicity_mismatch"],
      );
    }

    if (
      value.snapshotIdentityId !==
        plan.snapshotIdentityId ||
      value.snapshotSentenceOccurrenceIdentityId !==
        plan.snapshotSentenceOccurrenceIdentityId
    ) {
      return unresolved(
        plan,
        ["endpoint_binding_member_identity_mismatch"],
      );
    }

    if (
      value.graphDocumentId !==
        graph.documentId
    ) {
      return unresolved(
        plan,
        ["endpoint_graph_document_identity_mismatch"],
      );
    }

    const member = value.members[0];

    if (
      member.snapshotIdentityId !==
        plan.snapshotIdentityId ||
      member.snapshotSentenceOccurrenceIdentityId !==
        plan.snapshotSentenceOccurrenceIdentityId
    ) {
      return unresolved(
        plan,
        ["endpoint_binding_member_identity_mismatch"],
      );
    }

    if (
      member.graphDocumentId !==
        graph.documentId
    ) {
      return unresolved(
        plan,
        ["endpoint_graph_document_identity_mismatch"],
      );
    }

    if (
      !tokenNodeExists(
        graph,
        member.tokenNodeId,
      )
    ) {
      return unresolved(
        plan,
        ["endpoint_token_node_missing"],
      );
    }
  }

  const sourceMember = source.sourceFinalRuntimeBindingValue!.members[0];

  const targetMember = target.sourceFinalRuntimeBindingValue!.members[0];

  const patchId = [
    "runtime-dependency-execution-graph-patch-v1",
    plan.planId,
  ].join(":");

  const edgeId = [
    "edge:runtime-dependency-execution-v1",
    plan.planId,
  ].join(":");

  const evidenceId = [
    "evidence:runtime-dependency-execution-v1",
    plan.planId,
  ].join(":");

  const provenanceId = [
    "prov:runtime-dependency-execution-v1",
    plan.planId,
  ].join(":");

  const producer =
    CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_V1;

  const graphPatch: GraphPatchV1 = {
    producer,

    producerVersion:
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_VERSION_V1,

    edges: [
      {
        id: edgeId,

        relation: plan.relation,

        sourceId: sourceMember.tokenNodeId,
        targetId: targetMember.tokenNodeId,

        status: "resolved",

        features: {
          manifestId: plan.manifestId,
          manifestCode: plan.manifestCode,
          structuralAuthorityId: plan.structuralAuthorityId,
          dependencyActionAuthorityId: plan.dependencyActionAuthorityId,
          actionOrdinal: plan.actionOrdinal,
          actionIndex: plan.actionIndex,
          actionTarget: plan.actionTarget,
          actionValue: plan.actionValue,
          reasonCode: plan.reasonCode,
          sourceCandidateCodes: plan.sourceCandidateCodes,
          sourceSnapshotIdentityId: plan.snapshotIdentityId,
          snapshotSentenceOccurrenceIdentityId:
            plan.snapshotSentenceOccurrenceIdentityId,
          executionPlanId: plan.planId,
        },

        producer,

        evidenceIds: [evidenceId],
        provenanceIds: [provenanceId],
      },
    ],

    evidence: [
      {
        id: evidenceId,

        kind: "source_rule",

        status: "supports",

        targetIds: [edgeId],

        payload: {
          manifestId: plan.manifestId,
          manifestCode: plan.manifestCode,
          dependencyActionAuthorityId: plan.dependencyActionAuthorityId,
          executionPlanId: plan.planId,
          sourceEndpointEvidenceId: source.id,
          targetEndpointEvidenceId: target.id,
          sourceTokenNodeId: sourceMember.tokenNodeId,
          targetTokenNodeId: targetMember.tokenNodeId,
          relation: plan.relation,
        },

        producer,

        provenanceIds: [provenanceId],
      },
    ],

    provenance: [
      {
        id: provenanceId,

        sourceType: "runtime_fact",

        sourceId: plan.planId,

        payload: {
          manifestId: plan.manifestId,
          manifestCode: plan.manifestCode,
          structuralAuthorityId: plan.structuralAuthorityId,
          dependencyActionAuthorityId: plan.dependencyActionAuthorityId,
          sourceSnapshotIdentityId: plan.snapshotIdentityId,
          snapshotSentenceOccurrenceIdentityId:
            plan.snapshotSentenceOccurrenceIdentityId,
          sourceEndpointEvidenceId: source.id,
          targetEndpointEvidenceId: target.id,
        },
      },
    ],
  };

  return {
    producer,

    producerVersion:
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_VERSION_V1,

    status: "candidate",

    state: "resolved_dependency_execution_graph_patch",

    materialization: {
      patchId,

      status: "candidate",

      manifestId: plan.manifestId,
      manifestCode: plan.manifestCode,

      structuralAuthorityId: plan.structuralAuthorityId,

      sourceSnapshotIdentityId: plan.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        plan.snapshotSentenceOccurrenceIdentityId,

      dependencyActionAuthorityId: plan.dependencyActionAuthorityId,

      actionOrdinal: plan.actionOrdinal,
      actionIndex: plan.actionIndex,

      relation: plan.relation,

      sourceTokenNodeId: sourceMember.tokenNodeId,

      targetTokenNodeId: targetMember.tokenNodeId,

      edgeId,
      evidenceId,
      provenanceId,

      graphPatch,

      sourceExecutionPlan: plan,

      sourceSnapshotIdentityAuthority,

      sourceEndpointEvidence: source,

      targetEndpointEvidence: target,

      governance: governance(),
    },

    sourceExecutionPlan: plan,

    blockingReasons: [],
  };
}
