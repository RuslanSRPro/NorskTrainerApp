import {
  CANONICAL_RUNTIME_EXECUTION_READINESS_EVIDENCE_BOUNDARY_V1,
  deriveCanonicalRuntimeExecutionReadinessEvidenceBoundaryV1,
  deriveCanonicalRuntimeExecutionReadinessEvidenceDomainV1,
} from "./canonical-runtime-execution-readiness-evidence-boundary-v1.ts";

Deno.test(
  "execution readiness evidence boundary exposes only evidence authority",
  async () => {
    if (
      CANONICAL_RUNTIME_EXECUTION_READINESS_EVIDENCE_BOUNDARY_V1 !==
        "late-v1.40:execution-readiness-evidence-boundary-v1"
    ) {
      throw new Error("unexpected producer identity");
    }

    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-execution-readiness-evidence-boundary-v1.ts",
        import.meta.url,
      ),
    );

    const required = [
      "coherent_execution_readiness_evidence",
      "unresolved_execution_readiness_evidence",
      "finalWhereTruthRecomputed: false",
      "postOwnerEvidenceRecomputed: false",
      "associationDomainsPreservedWithoutSelection: true",
      "actionSelected: false",
      "singletonPromotedToWinner: false",
      "activationPermissionDerived: false",
      "executableStateDerived: false",
      "schedulableStateDerived: false",
      "endpointDirectionResolved: false",
      "runtimeActionExecuted: false",
      "schedulerInvoked: false",
      "canonicalEdgeGenerated: false",
      "graphMutationPerformed: false",
    ];

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(`missing governance marker: ${marker}`);
      }
    }
  },
);

Deno.test(
  "execution readiness boundary maps association domains without winner selection",
  () => {
    const source = deriveCanonicalRuntimeExecutionReadinessEvidenceBoundaryV1
      .toString();

    if (!source.includes(".domains.map")) {
      throw new Error(
        "association domains are not preserved by mapping",
      );
    }

    const forbidden = [
      ".domains[0]",
      ".domains.at(0)",
      ".find(",
      ".findLast(",
      ".filter(",
      ".sort(",
    ];

    for (const marker of forbidden) {
      if (source.includes(marker)) {
        throw new Error(
          `possible implicit association-domain selection: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "domain evidence requires exact coherence and exact association provenance",
  () => {
    const source = deriveCanonicalRuntimeExecutionReadinessEvidenceDomainV1
      .toString();

    const required = [
      "manifestCoherent",
      "ownerBindingCoherent",
      "postOwnerEvidenceIdentityCoherent",
      "exactAssociationResolved",
      "resolved_exact_action_binding_provenance",
    ];

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing exact coherence prerequisite: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "execution readiness evidence boundary contains no positive downstream authority",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-execution-readiness-evidence-boundary-v1.ts",
        import.meta.url,
      ),
    );

    const forbidden = [
      "activationPermissionDerived: true",
      "executableStateDerived: true",
      "schedulableStateDerived: true",
      "actionSelected: true",
      "singletonPromotedToWinner: true",
      "endpointDirectionResolved: true",
      "endpointBindingPerformed: true",
      "dependencySemanticsResolved: true",
      "runtimeActionExecuted: true",
      "schedulerInvoked: true",
      "canonicalEdgeGenerated: true",
      "graphMutationPerformed: true",
    ];

    for (const marker of forbidden) {
      if (source.includes(marker)) {
        throw new Error(
          `forbidden downstream authority: ${marker}`,
        );
      }
    }
  },
);
