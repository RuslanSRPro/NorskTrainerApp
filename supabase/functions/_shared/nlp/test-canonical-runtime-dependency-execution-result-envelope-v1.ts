import {
  CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_V1,
  CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_VERSION_V1,
} from "./canonical-runtime-dependency-execution-result-envelope-v1.ts";

const source = await Deno.readTextFile(
  new URL(
    "./canonical-runtime-dependency-execution-result-envelope-v1.ts",
    import.meta.url,
  ),
);

Deno.test(
  "D7.18 exposes exact post-execution result envelope contract",
  () => {
    if (
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_V1 !==
        "d7.18:canonical-runtime-dependency-execution-result-envelope-v1"
    ) {
      throw new Error("unexpected D7.18 producer");
    }

    if (
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_RESULT_ENVELOPE_VERSION_V1 !==
        "1.0.0"
    ) {
      throw new Error("unexpected D7.18 producer version");
    }

    const required = [
      '"resolved_dependency_execution_result"',
      '"unresolved_dependency_execution_result"',
      '"runtime-dependency-execution-result-v1"',
      'status: "executed"',
      "sourceTransitionResult",
      "sourceExecutionTransition",
      "resultingGraph",
      "resultingSnapshotIdentityAuthority",
      "sourceSnapshotIdentityId",
      "resultingSnapshotIdentityId",
      "dependencyActionAuthorityId",
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing D7.18 contract marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.18 resolves only an exact resolved D7.15 transition",
  () => {
    const required = [
      '"resolved_dependency_execution_graph_transition"',
      "sourceTransitionResult.transition === null",
      "sourceTransitionResult.blockingReasons.length !== 0",
      '"source_transition_not_resolved"',
      '"source_transition_missing"',
      '"source_transition_has_blocking_reasons"',
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing D7.18 fail-closed marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.18 preserves exact resulting graph snapshot authority and transition",
  () => {
    const required = [
      "resultingGraph:",
      "transition.resultingGraph",
      "resultingSnapshotIdentityAuthority:",
      "transition.resultingSnapshotIdentityAuthority",
      "sourceExecutionTransition:",
      "transition",
      "resultingGraphPreservedExactly: true",
      "resultingSnapshotAuthorityPreservedExactly: true",
      "sourceExecutionTransitionPreservedExactly: true",
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing exact-preservation marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.18 performs no execution snapshot derivation semantic reconstruction scheduler or interpretation",
  () => {
    const required = [
      "executionMaterializationAlreadyPerformedUpstream: true",
      "graphPatchAppliedHere: false",
      "graphMutatedHere: false",
      "snapshotIdentityDerivedHere: false",
      "whereTruthRecomputed: false",
      "bindingRecomputed: false",
      "endpointDirectionRecomputed: false",
      "activationPermissionRecomputed: false",
      "executionAdmissionRecomputed: false",
      "executionPlanRecomputed: false",
      "graphPatchRecomputed: false",
      "sentenceIndexUsedForIdentity: false",
      "legacyMappingUsed: false",
      "schedulerInvoked: false",
      "learnerFacingInterpretationPerformed: false",
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing D7.18 governance marker: ${marker}`,
        );
      }
    }

    const forbidden = [
      "applyGraphPatchV1(",
      "deriveCanonicalGraphSnapshotIdentityAuthorityV1(",
      "deriveCanonicalRuntimeActionExecutionAdmission",
      "deriveCanonicalRuntimeDependencyExecutionPlan",
      "Math.random(",
      "Date.now(",
      "new Date(",
      " as any",
      " as unknown as ",
    ] as const;

    for (const marker of forbidden) {
      if (source.includes(marker)) {
        throw new Error(
          `forbidden D7.18 execution/reconstruction marker: ${marker}`,
        );
      }
    }
  },
);
