import { assertEquals, assertStrictEquals } from "jsr:@std/assert";

import {
  CANONICAL_RUNTIME_ACTION_EXECUTION_PRECONDITION_EVIDENCE_BOUNDARY_V1,
  deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1,
} from "./canonical-runtime-action-execution-precondition-evidence-boundary-v1.ts";

import type {
  CanonicalRuntimeActionExecutionPreconditionEndpointInputV1,
  CanonicalRuntimeActionExecutionPreconditionReadinessInputV1,
} from "./canonical-runtime-action-execution-precondition-evidence-boundary-v1.ts";

import type {
  CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";

type RootTruth =
  CanonicalRuntimeActionExecutionPreconditionReadinessInputV1[
    "sourceActionCandidateBridge"
  ]["sourceTerminalEnvelope"]["rootTruthDisposition"];

type FinalDecision =
  CanonicalRuntimeActionExecutionPreconditionReadinessInputV1[
    "sourceActionCandidateBridge"
  ]["sourceTerminalEnvelope"]["finalDecisionDisposition"];

function endpointReference(
  actionId: string,
  role: "source" | "target",
  bindingName: string,
): CanonicalRuntimeDependencyActionBindingEndpointReferenceV1 {
  return {
    dependencyActionAuthorityId: actionId,
    endpointRole: role,
    bindingName,
  };
}

function readiness(
  references:
    readonly CanonicalRuntimeDependencyActionBindingEndpointReferenceV1[],
  actionIds: readonly string[],
  rootTruthDisposition: RootTruth = "resolved_true",
  finalDecisionDisposition: FinalDecision = "satisfied",
  state:
    CanonicalRuntimeActionExecutionPreconditionReadinessInputV1["state"] =
      "coherent_execution_readiness_evidence",
): CanonicalRuntimeActionExecutionPreconditionReadinessInputV1 {
  return {
    id: "readiness:1",

    state,

    manifestId: "manifest:1",
    manifestCode: "fixture",

    structuralAuthorityId: "structural:1",

    snapshotIdentityId: "snapshot:1",
    snapshotSentenceOccurrenceIdentityId:
      "sentence-occurrence:1",

    associatedDependencyActionAuthorityIds:
      actionIds,

    sourceActionCandidateBridge: {
      bridgeId: "bridge:1",

      manifestId: "manifest:1",
      manifestCode: "fixture",

      structuralAuthorityId: "structural:1",

      sourceTerminalEnvelope: {
        envelopeId: "terminal:1",

        structuralAuthorityId: "structural:1",

        snapshotIdentityId: "snapshot:1",
        snapshotSentenceOccurrenceIdentityId:
          "sentence-occurrence:1",

        rootTruthDisposition,
        finalDecisionDisposition,
      },
    },

    sourceDependencyActionBindingAssociation: {
      id: "association:1",

      manifestId: "manifest:1",
      manifestCode: "fixture",

      associationState:
        "resolved_exact_action_binding_provenance",

      associatedDependencyActionAuthorityIds:
        actionIds,

      associatedDependencyEndpointReferences:
        references,

      selectedDependencyActionAuthorityId: null,
      dependencyEndpointRole: null,
    },
  };
}

function endpointEvidence(
  readinessEvidence:
    CanonicalRuntimeActionExecutionPreconditionReadinessInputV1,
  reference:
    CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
  state:
    CanonicalRuntimeActionExecutionPreconditionEndpointInputV1["state"] =
      "resolved_exact_endpoint_binding_evidence",
): CanonicalRuntimeActionExecutionPreconditionEndpointInputV1 {
  return {
    id: [
      "endpoint-evidence",
      reference.dependencyActionAuthorityId,
      reference.endpointRole,
      reference.bindingName,
    ].join(":"),

    state,

    manifestId: readinessEvidence.manifestId,
    manifestCode: readinessEvidence.manifestCode,

    snapshotIdentityId:
      readinessEvidence.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId:
      readinessEvidence.snapshotSentenceOccurrenceIdentityId,

    dependencyActionAuthorityId:
      reference.dependencyActionAuthorityId,

    authoredEndpointRole:
      reference.endpointRole,

    referencedBindingName:
      reference.bindingName,

    sourceExecutionReadinessEvidence: {
      id: readinessEvidence.id,
      state: readinessEvidence.state,

      manifestId: readinessEvidence.manifestId,
      manifestCode: readinessEvidence.manifestCode,

      snapshotIdentityId:
        readinessEvidence.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        readinessEvidence.snapshotSentenceOccurrenceIdentityId,

      sourceDependencyActionBindingAssociation: {
        id:
          readinessEvidence
            .sourceDependencyActionBindingAssociation.id,

        manifestId:
          readinessEvidence
            .sourceDependencyActionBindingAssociation.manifestId,

        manifestCode:
          readinessEvidence
            .sourceDependencyActionBindingAssociation.manifestCode,

        associationState:
          readinessEvidence
            .sourceDependencyActionBindingAssociation.associationState,

        associatedDependencyEndpointReferences:
          readinessEvidence
            .sourceDependencyActionBindingAssociation
            .associatedDependencyEndpointReferences,

        selectedDependencyActionAuthorityId: null,
        dependencyEndpointRole: null,
      },
    },

    sourceEndpointReference: reference,
  };
}

Deno.test(
  "action execution precondition boundary exposes evidence only",
  async () => {
    assertEquals(
      CANONICAL_RUNTIME_ACTION_EXECUTION_PRECONDITION_EVIDENCE_BOUNDARY_V1,
      "late-v1.40:action-execution-precondition-evidence-boundary-v1",
    );

    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-action-execution-precondition-evidence-boundary-v1.ts",
        import.meta.url,
      ),
    );

    const required = [
      "finalWhereTruthPreservedWithoutRecomputation: true",
      "finalDecisionPreservedWithoutRecomputation: true",
      "evidenceCompletenessDerived: true",
      "actionSelected: false",
      "singletonActionPromotedToWinner: false",
      "endpointDirectionResolved: false",
      "endpointBindingPerformed: false",
      "executionAdmissionDerived: false",
      "activationPermissionDerived: false",
      "executableStateDerived: false",
      "schedulableStateDerived: false",
      "dependencySemanticsResolved: false",
      "runtimeActionExecuted: false",
      "schedulerInvoked: false",
      "canonicalEdgeGenerated: false",
      "graphMutationPerformed: false",
    ];

    for (const marker of required) {
      if (!source.includes(marker)) {
        throw new Error(
          `missing governance marker: ${marker}`,
        );
      }
    }

    const forbidden = [
      "executionAdmissionDerived: true",
      "activationPermissionDerived: true",
      "executableStateDerived: true",
      "schedulableStateDerived: true",
      "actionSelected: true",
      "singletonActionPromotedToWinner: true",
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
          `forbidden positive authority: ${marker}`,
        );
      }
    }
  },
);

Deno.test(
  "resolved true and satisfied remain truth evidence rather than execution admission",
  () => {
    const sourceRef = endpointReference(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const targetRef = endpointReference(
      "dependency-action:0",
      "target",
      "targetRef",
    );

    const ready = readiness(
      [sourceRef, targetRef],
      ["dependency-action:0"],
      "resolved_true",
      "satisfied",
    );

    const result =
      deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [ready],

          endpointResolutionEvidence: [
            endpointEvidence(ready, targetRef),
            endpointEvidence(ready, sourceRef),
          ],
        },
      );

    assertEquals(result.status, "ready");
    assertEquals(result.evidence.length, 1);

    const evidence = result.evidence[0];

    assertEquals(
      evidence.state,
      "complete_action_execution_precondition_evidence",
    );

    assertEquals(
      evidence.rootTruthDisposition,
      "resolved_true",
    );

    assertEquals(
      evidence.finalDecisionDisposition,
      "satisfied",
    );

    assertEquals(evidence.blockingReasons, []);

    assertEquals(
      evidence.governance.executionAdmissionDerived,
      false,
    );

    assertEquals(
      evidence.governance.activationPermissionDerived,
      false,
    );

    assertEquals(
      evidence.governance.runtimeActionExecuted,
      false,
    );
  },
);

Deno.test(
  "real false semantics can retain complete input evidence without promotion",
  () => {
    const sourceRef = endpointReference(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const targetRef = endpointReference(
      "dependency-action:0",
      "target",
      "targetRef",
    );

    const ready = readiness(
      [sourceRef, targetRef],
      ["dependency-action:0"],
      "resolved_false",
      "rejected",
    );

    const result =
      deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [ready],

          endpointResolutionEvidence: [
            endpointEvidence(ready, sourceRef),
            endpointEvidence(ready, targetRef),
          ],
        },
      );

    const evidence = result.evidence[0];

    assertEquals(
      evidence.state,
      "complete_action_execution_precondition_evidence",
    );

    assertEquals(
      evidence.rootTruthDisposition,
      "resolved_false",
    );

    assertEquals(
      evidence.finalDecisionDisposition,
      "rejected",
    );

    assertEquals(
      evidence.governance.executionAdmissionDerived,
      false,
    );

    assertEquals(
      evidence.governance.executableStateDerived,
      false,
    );

    assertEquals(
      evidence.governance.graphMutationPerformed,
      false,
    );
  },
);

Deno.test(
  "unresolved truth remains unresolved even when endpoint evidence is complete",
  () => {
    const sourceRef = endpointReference(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const targetRef = endpointReference(
      "dependency-action:0",
      "target",
      "targetRef",
    );

    const ready = readiness(
      [sourceRef, targetRef],
      ["dependency-action:0"],
      "unresolved",
      "uncertain",
    );

    const result =
      deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [ready],

          endpointResolutionEvidence: [
            endpointEvidence(ready, sourceRef),
            endpointEvidence(ready, targetRef),
          ],
        },
      );

    const evidence = result.evidence[0];

    assertEquals(
      evidence.state,
      "complete_action_execution_precondition_evidence",
    );

    assertEquals(
      evidence.rootTruthDisposition,
      "unresolved",
    );

    assertEquals(
      evidence.finalDecisionDisposition,
      "uncertain",
    );

    assertEquals(
      evidence.governance.executionAdmissionDerived,
      false,
    );
  },
);

Deno.test(
  "missing endpoint evidence produces incomplete evidence without changing truth",
  () => {
    const sourceRef = endpointReference(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const targetRef = endpointReference(
      "dependency-action:0",
      "target",
      "targetRef",
    );

    const ready = readiness(
      [sourceRef, targetRef],
      ["dependency-action:0"],
      "resolved_true",
      "satisfied",
    );

    const result =
      deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [ready],

          endpointResolutionEvidence: [
            endpointEvidence(ready, sourceRef),
          ],
        },
      );

    const evidence = result.evidence[0];

    assertEquals(
      evidence.state,
      "incomplete_action_execution_precondition_evidence",
    );

    assertEquals(
      evidence.rootTruthDisposition,
      "resolved_true",
    );

    assertEquals(
      evidence.finalDecisionDisposition,
      "satisfied",
    );

    assertEquals(
      evidence.blockingReasons,
      [
        "exact_endpoint_resolution_evidence_missing:target:targetRef",
      ],
    );
  },
);

Deno.test(
  "multiple dependency actions remain independent evidence candidates",
  () => {
    const action0Source = endpointReference(
      "dependency-action:0",
      "source",
      "sharedRef",
    );

    const action1Target = endpointReference(
      "dependency-action:1",
      "target",
      "sharedRef",
    );

    const ready = readiness(
      [
        action1Target,
        action0Source,
      ],
      [
        "dependency-action:0",
        "dependency-action:1",
      ],
    );

    const result =
      deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [ready],

          endpointResolutionEvidence: [
            endpointEvidence(ready, action1Target),
            endpointEvidence(ready, action0Source),
          ],
        },
      );

    assertEquals(result.evidence.length, 2);

    assertEquals(
      result.evidence.map(
        (item) => item.dependencyActionAuthorityId,
      ),
      [
        "dependency-action:0",
        "dependency-action:1",
      ],
    );

    assertEquals(
      result.evidence.map(
        (item) => item.actionOrdinal,
      ),
      [0, 1],
    );

    for (const evidence of result.evidence) {
      assertEquals(
        evidence.state,
        "complete_action_execution_precondition_evidence",
      );

      assertEquals(
        evidence.governance.actionSelected,
        false,
      );

      assertEquals(
        evidence.governance.singletonActionPromotedToWinner,
        false,
      );
    }

    assertStrictEquals(
      result.evidence[0].sourceExecutionReadinessEvidence,
      ready,
    );

    assertStrictEquals(
      result.evidence[1].sourceExecutionReadinessEvidence,
      ready,
    );
  },
);

Deno.test(
  "unresolved readiness cannot become complete precondition evidence",
  () => {
    const sourceRef = endpointReference(
      "dependency-action:0",
      "source",
      "sourceRef",
    );

    const ready = readiness(
      [sourceRef],
      ["dependency-action:0"],
      "resolved_true",
      "satisfied",
      "unresolved_execution_readiness_evidence",
    );

    const result =
      deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1(
        {
          executionReadinessEvidence: [ready],

          endpointResolutionEvidence: [
            endpointEvidence(ready, sourceRef),
          ],
        },
      );

    assertEquals(
      result.evidence[0].state,
      "incomplete_action_execution_precondition_evidence",
    );

    assertEquals(
      result.evidence[0].blockingReasons,
      ["execution_readiness_evidence_not_coherent"],
    );

    assertEquals(
      result.evidence[0].rootTruthDisposition,
      "resolved_true",
    );
  },
);