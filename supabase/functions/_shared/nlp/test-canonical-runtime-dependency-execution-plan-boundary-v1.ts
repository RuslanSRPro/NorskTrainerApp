import {
  CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_PLAN_BOUNDARY_V1,
} from "./canonical-runtime-dependency-execution-plan-boundary-v1.ts";

const sourcePath = new URL(
  "./canonical-runtime-dependency-execution-plan-boundary-v1.ts",
  import.meta.url,
);

const source = await Deno.readTextFile(sourcePath);

Deno.test(
  "D7.10 dependency execution plan boundary exposes deterministic governed contract",
  () => {
    if (
      CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_PLAN_BOUNDARY_V1 !==
        "d7.10:dependency-execution-plan-boundary-v1"
    ) {
      throw new Error("unexpected producer constant");
    }

    const required = [
      '"resolved_deterministic_dependency_execution_plan"',
      '"unresolved_dependency_execution_plan"',
      '"runtime-dependency-execution-plan-v1"',
      'family: "create_dependency"',
      "sourceAdmissionDecision",
      "sourceActionCandidate",
      "sourceActionAuthority",
      "sourceEndpointResolutionEvidence",
      "exactActionAuthorityReferencePreserved: true",
      "actionAuthorityReconstructedFromIdentity: false",
      "actionMultiplicityCollapsed: false",
      "actionSelected: false",
      "singletonActionPromotedToWinner: false",
      "truthRecomputed: false",
      "activationPermissionRecomputed: false",
      "executionAdmissionRecomputed: false",
      "endpointDirectionInferred: false",
      "endpointBindingRecomputed: false",
      "dependencySemanticsRecomputed: false",
      "runtimeActionExecuted: false",
      "schedulerInvoked: false",
      "canonicalEdgeGenerated: false",
      "graphMutationPerformed: false",
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing D7.10 contract marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.10 plan derivation requires admitted state and exact endpoint evidence",
  () => {
    const required = [
      'admission.state === "unresolved"',
      'admission.state !== "admitted"',
      "authority.id !==",
      "admission.dependencyActionAuthorityId",
      '"resolved_exact_endpoint_binding_evidence"',
      "sourceFinalRuntimeBindingDomain ===",
      "sourceFinalRuntimeBindingValue ===",
      "endpoint_reference_identity_mismatch",
      "endpoint_multiplicity_mismatch",
      "endpoint_evidence_ambiguous",
    ] as const;

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing fail-closed marker: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "D7.10 plan boundary contains no execution scheduler or graph mutation call",
  () => {
    const forbidden = [
      "executeAction(",
      "executeDependency(",
      "scheduleAction(",
      "invokeScheduler(",
      "createCanonicalEdge(",
      "mutateGraph(",
      "graph.addEdge(",
    ] as const;

    for (const marker of forbidden) {
      if (source.includes(marker)) {
        throw new Error(
          `forbidden runtime side effect marker: ${marker}`,
        );
      }
    }
  },
);
