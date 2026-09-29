import {
  CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_V1,
  CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_VERSION_V1,
} from "./canonical-runtime-dependency-execution-graph-patch-boundary-v1.ts";

const sourcePath = new URL(
  "./canonical-runtime-dependency-execution-graph-patch-boundary-v1.ts",
  import.meta.url,
);

const source = await Deno.readTextFile(sourcePath);

Deno.test(
  "D7.14 dependency execution graph patch boundary exposes exact governed contract",
  () => {
    if (
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_V1 !==
        "d7.14:dependency-execution-graph-patch-boundary-v1"
    ) {
      throw new Error("unexpected D7.14 producer constant");
    }

    if (
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_PATCH_BOUNDARY_VERSION_V1 !==
        "1.0.0"
    ) {
      throw new Error("unexpected D7.14 producer version");
    }

    const required = [
      '"resolved_dependency_execution_graph_patch"',
      '"unresolved_dependency_execution_graph_patch"',
      '"runtime-dependency-execution-graph-patch-v1"',
      '"edge:runtime-dependency-execution-v1"',
      '"evidence:runtime-dependency-execution-v1"',
      '"prov:runtime-dependency-execution-v1"',
      "sourceExecutionPlan",
      "sourceSnapshotIdentityAuthority",
      "sourceEndpointEvidence",
      "targetEndpointEvidence",
      "canonicalTokenNodeIdentityConsumedDirectly: true",
      "exactSourceGraphSnapshotVerified: true",
      "graphPatchGenerated: true",
      "graphPatchApplied: false",
      "graphMutationPerformed: false",
      "nextSnapshotIdentityDerived: false",
      "sentenceIndexUsedForEndpointIdentity: false",
      "legacyMappingUsed: false",
      "endpointDirectionInferred: false",
      "endpointBindingRecomputed: false",
      "truthRecomputed: false",
      "activationPermissionRecomputed: false",
      "executionAdmissionRecomputed: false",
      "dependencyRelationRecomputed: false",
      "schedulerInvoked: false",
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing D7.14 contract marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.14 verifies exact source graph snapshot before materialization",
  () => {
    const required = [
      "deriveCanonicalGraphSnapshotIdentityAuthorityV1(",
      "sourceSnapshotIdentityAuthority.snapshotIdentityId",
      "plan.snapshotIdentityId",
      "derivedSnapshot.authority.snapshotIdentityId",
      '"source_graph_snapshot_identity_unresolved"',
      '"source_graph_snapshot_identity_mismatch"',
      '"graph_document_identity_mismatch"',
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing exact snapshot verification marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.14 consumes exact endpoint tokenNodeId and fails closed on multiplicity",
  () => {
    const required = [
      "evidence.authoredEndpointRole === role",
      "function exactEndpointEvidence(",
      '"source"',
      '"target"',
      "value.memberCount !== 1",
      "value.members.length !== 1",
      "member.snapshotIdentityId !==",
      "member.snapshotSentenceOccurrenceIdentityId !==",
      "member.graphDocumentId !==",
      "member.tokenNodeId",
      'node.type === "token"',
      '"endpoint_binding_member_multiplicity_mismatch"',
      '"endpoint_token_node_missing"',
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing endpoint identity marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.14 does not apply graph patch or reconstruct semantic authority",
  () => {
    const forbidden = [
      "applyGraphPatchV1(",
      "sentenceIndexUsedForEndpointIdentity: true",
      "legacyMappingUsed: true",
      "endpointDirectionInferred: true",
      "endpointBindingRecomputed: true",
      "truthRecomputed: true",
      "activationPermissionRecomputed: true",
      "executionAdmissionRecomputed: true",
      "dependencyRelationRecomputed: true",
      "graphMutationPerformed: true",
      "nextSnapshotIdentityDerived: true",
      "scheduleAction(",
      "invokeScheduler(",
      "Math.random(",
      "Date.now(",
      "new Date(",
      " as any",
      " as unknown as ",
    ] as const;

    for (const marker of forbidden) {
      if (source.includes(marker)) {
        throw new Error(
          `forbidden D7.14 marker: ${marker}`,
        );
      }
    }
  },
);
