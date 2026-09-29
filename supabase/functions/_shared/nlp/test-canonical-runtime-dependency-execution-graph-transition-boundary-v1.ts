import {
  CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_V1,
  CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_VERSION_V1,
} from "./canonical-runtime-dependency-execution-graph-transition-boundary-v1.ts";

const sourcePath = new URL(
  "./canonical-runtime-dependency-execution-graph-transition-boundary-v1.ts",
  import.meta.url,
);

const source = await Deno.readTextFile(sourcePath);

Deno.test(
  "D7.15 graph transition boundary exposes exact transition contract",
  () => {
    if (
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_V1 !==
        "d7.15:dependency-execution-graph-transition-boundary-v1"
    ) {
      throw new Error("unexpected D7.15 producer");
    }

    if (
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_GRAPH_TRANSITION_BOUNDARY_VERSION_V1 !==
        "1.0.0"
    ) {
      throw new Error("unexpected D7.15 producer version");
    }

    const required = [
      '"resolved_dependency_execution_graph_transition"',
      '"unresolved_dependency_execution_graph_transition"',
      '"runtime-dependency-execution-graph-transition-v1"',
      "sourceExecutionGraphPatch",
      "sourceGraph",
      "resultingGraph",
      "sourceSnapshotIdentityAuthority",
      "resultingSnapshotIdentityAuthority",
      "sourceSnapshotIdentityId",
      "resultingSnapshotIdentityId",
      "exactD714GraphPatchRequired: true",
      "sourceGraphSnapshotVerifiedBeforeApplication: true",
      "exactD714GraphPatchApplied: true",
      "graphPatchApplicationCount: 1",
      "existingCanonicalGraphPatchPrimitiveUsed: true",
      "resultingSnapshotDerivedFromResultingGraph: true",
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing D7.15 contract marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.15 verifies source snapshot before graph patch application",
  () => {
    const verificationMarker = "verifiedSourceSnapshot";

    const applicationMarker = "const resultingGraph = applyGraphPatchV1(";

    const verificationIndex = source.indexOf(verificationMarker);

    const applicationIndex = source.indexOf(applicationMarker);

    if (verificationIndex < 0) {
      throw new Error(
        "source snapshot verification is missing",
      );
    }

    if (applicationIndex < 0) {
      throw new Error(
        "graph patch application is missing",
      );
    }

    if (verificationIndex >= applicationIndex) {
      throw new Error(
        "graph patch application occurs before source snapshot verification",
      );
    }

    const required = [
      "sourceSnapshotIdentityAuthority.snapshotIdentityId",
      "sourceExecutionGraphPatch.sourceSnapshotIdentityId",
      "sourceSnapshotIdentityAuthority.graphDocumentId",
      "sourceGraph.documentId",
      '"source_snapshot_identity_authority_mismatch"',
      '"source_graph_snapshot_identity_unresolved"',
      '"source_graph_snapshot_identity_mismatch"',
      '"source_graph_document_identity_mismatch"',
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing source verification marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.15 applies exact D7.14 patch once and derives resulting snapshot",
  () => {
    const applyMatches = source.match(
      /applyGraphPatchV1\s*\(/g,
    );

    if (applyMatches === null) {
      throw new Error(
        "applyGraphPatchV1 invocation missing",
      );
    }

    if (applyMatches.length !== 1) {
      throw new Error(
        `expected exactly one applyGraphPatchV1 invocation, got ${applyMatches.length}`,
      );
    }

    const required = [
      "sourceExecutionGraphPatch.graphPatch",
      "deriveCanonicalGraphSnapshotIdentityAuthorityV1(",
      "surface",
      "resultingGraph",
      "resultingSnapshot.authority.snapshotIdentityId",
      "resultingSnapshot.authority.graphDocumentId",
      '"resulting_graph_snapshot_identity_unresolved"',
      '"resulting_graph_document_identity_mismatch"',
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing resulting snapshot marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.15 does not reconstruct upstream semantics or invent snapshot versions",
  () => {
    const required = [
      "relationRecomputed: false",
      "endpointDirectionRecomputed: false",
      "bindingRecomputed: false",
      "whereTruthRecomputed: false",
      "activationPermissionRecomputed: false",
      "executionAdmissionRecomputed: false",
      "sentenceIndexUsedForTransitionIdentity: false",
      "legacyMappingUsed: false",
      "snapshotVersionIncremented: false",
      "snapshotIdentityInvented: false",
      "schedulerInvoked: false",
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing D7.15 governance marker: ${marker}`,
        );
      }
    }

    const forbidden = [
      "relationRecomputed: true",
      "endpointDirectionRecomputed: true",
      "bindingRecomputed: true",
      "whereTruthRecomputed: true",
      "activationPermissionRecomputed: true",
      "executionAdmissionRecomputed: true",
      "sentenceIndexUsedForTransitionIdentity: true",
      "legacyMappingUsed: true",
      "snapshotVersionIncremented: true",
      "snapshotIdentityInvented: true",
      "schedulerInvoked: true",
      "Math.random(",
      "Date.now(",
      "new Date(",
      " as any",
      " as unknown as ",
    ] as const;

    for (const marker of forbidden) {
      if (source.includes(marker)) {
        throw new Error(
          `forbidden D7.15 marker: ${marker}`,
        );
      }
    }
  },
);
