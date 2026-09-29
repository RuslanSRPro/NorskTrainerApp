import { assertEquals, assertStrictEquals } from "jsr:@std/assert";

import {
  CANONICAL_RUNTIME_ACTION_EXECUTION_ADMISSION_BOUNDARY_V1,
  deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1,
} from "./canonical-runtime-action-execution-admission-boundary-v1.ts";

import {
  type CanonicalRuntimeActionExecutionPreconditionEndpointInputV1,
  type CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
  type CanonicalRuntimeActionExecutionPreconditionReadinessInputV1,
  deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1,
} from "./canonical-runtime-action-execution-precondition-evidence-boundary-v1.ts";

import {
  type CanonicalRuntimeDependencyActionActivationAuthorityV1,
  resolveCanonicalRuntimeDependencyActionActivationAuthorityV1,
} from "./canonical-runtime-dependency-action-activation-authority-resolution-v1.ts";

import type {
  CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";

type RootTruth = CanonicalRuntimeActionExecutionPreconditionReadinessInputV1[
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
  state: CanonicalRuntimeActionExecutionPreconditionReadinessInputV1["state"] =
    "coherent_execution_readiness_evidence",
): CanonicalRuntimeActionExecutionPreconditionReadinessInputV1 {
  return {
    id: "readiness:1",

    state,

    manifestId: "manifest:1",

    manifestCode: "fixture",

    structuralAuthorityId: "structural:1",

    snapshotIdentityId: "snapshot:1",

    snapshotSentenceOccurrenceIdentityId: "sentence-occurrence:1",

    associatedDependencyActionAuthorityIds: actionIds,

    sourceActionCandidateBridge: {
      bridgeId: "bridge:1",

      manifestId: "manifest:1",

      manifestCode: "fixture",

      structuralAuthorityId: "structural:1",

      sourceTerminalEnvelope: {
        envelopeId: "terminal:1",

        structuralAuthorityId: "structural:1",

        snapshotIdentityId: "snapshot:1",

        snapshotSentenceOccurrenceIdentityId: "sentence-occurrence:1",

        rootTruthDisposition,

        finalDecisionDisposition,
      },
    },

    sourceDependencyActionBindingAssociation: {
      id: "association:1",

      manifestId: "manifest:1",

      manifestCode: "fixture",

      associationState: "resolved_exact_action_binding_provenance",

      associatedDependencyActionAuthorityIds: actionIds,

      associatedDependencyEndpointReferences: references,

      selectedDependencyActionAuthorityId: null,

      dependencyEndpointRole: null,
    },
  };
}

function endpointEvidence(
  readinessEvidence:
    CanonicalRuntimeActionExecutionPreconditionReadinessInputV1,
  reference: CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
  state: CanonicalRuntimeActionExecutionPreconditionEndpointInputV1["state"] =
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

    snapshotIdentityId: readinessEvidence.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId: readinessEvidence
      .snapshotSentenceOccurrenceIdentityId,

    dependencyActionAuthorityId: reference.dependencyActionAuthorityId,

    authoredEndpointRole: reference.endpointRole,

    referencedBindingName: reference.bindingName,

    sourceExecutionReadinessEvidence: {
      id: readinessEvidence.id,

      state: readinessEvidence.state,

      manifestId: readinessEvidence.manifestId,

      manifestCode: readinessEvidence.manifestCode,

      snapshotIdentityId: readinessEvidence.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId: readinessEvidence
        .snapshotSentenceOccurrenceIdentityId,

      sourceDependencyActionBindingAssociation: {
        id: readinessEvidence
          .sourceDependencyActionBindingAssociation.id,

        manifestId: readinessEvidence
          .sourceDependencyActionBindingAssociation.manifestId,

        manifestCode: readinessEvidence
          .sourceDependencyActionBindingAssociation.manifestCode,

        associationState: readinessEvidence
          .sourceDependencyActionBindingAssociation.associationState,

        associatedDependencyEndpointReferences: readinessEvidence
          .sourceDependencyActionBindingAssociation
          .associatedDependencyEndpointReferences,

        selectedDependencyActionAuthorityId: null,

        dependencyEndpointRole: null,
      },
    },

    sourceEndpointReference: reference,
  };
}

function precondition(
  rootTruthDisposition: RootTruth = "resolved_true",
  finalDecisionDisposition: FinalDecision = "satisfied",
  readinessState:
    CanonicalRuntimeActionExecutionPreconditionReadinessInputV1["state"] =
      "coherent_execution_readiness_evidence",
): CanonicalRuntimeActionExecutionPreconditionEvidenceV1 {
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
    [
      sourceRef,
      targetRef,
    ],
    [
      "dependency-action:0",
    ],
    rootTruthDisposition,
    finalDecisionDisposition,
    readinessState,
  );

  const result =
    deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1(
      {
        executionReadinessEvidence: [
          ready,
        ],

        endpointResolutionEvidence: [
          endpointEvidence(
            ready,
            sourceRef,
          ),
          endpointEvidence(
            ready,
            targetRef,
          ),
        ],
      },
    );

  assertEquals(
    result.evidence.length,
    1,
  );

  return result.evidence[0];
}

function authority(
  evidence: CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
  overrides: Partial<
    CanonicalRuntimeDependencyActionActivationAuthorityV1
  > = {},
): CanonicalRuntimeDependencyActionActivationAuthorityV1 {
  return {
    authorityId: "activation-authority:1",

    version: "v1",

    manifestId: evidence.manifestId,

    dependencyActionAuthorityId: evidence.dependencyActionAuthorityId,

    decision: "granted",

    provenance: {
      source: "d7.3-focused-test",
    },

    supersedesAuthorityId: null,

    ...overrides,
  };
}

Deno.test(
  "D7.3 exposes deterministic admission only and no execution mutation authority",
  async () => {
    assertEquals(
      CANONICAL_RUNTIME_ACTION_EXECUTION_ADMISSION_BOUNDARY_V1,
      "d7.3:action-execution-admission-boundary-v1",
    );

    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-action-execution-admission-boundary-v1.ts",
        import.meta.url,
      ),
    );

    const required = [
      "preconditionCompletenessConsumedWithoutRecomputation: true",
      "activationResolutionConsumedWithoutInference: true",
      "finalWhereTruthPreservedWithoutRecomputation: true",
      "finalDecisionPreservedWithoutRecomputation: true",
      "rejectedFalseSemanticsPreserved: true",
      "deniedDistinctFromAbsentAmbiguousInvalid: true",
      "authoredAdmissionAuthorityCreated: false",
      "independentAdmissionVersioningDerived: false",
      "implicitAdmissionPermissionDerived: false",
      "actionSelected: false",
      "singletonActionPromotedToWinner: false",
      "endpointDirectionResolved: false",
      "endpointBindingPerformed: false",
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
      "authoredAdmissionAuthorityCreated: true",
      "independentAdmissionVersioningDerived: true",
      "implicitAdmissionPermissionDerived: true",
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
  "D7.3 complete satisfied exact grant is admitted without execution",
  () => {
    const evidence = precondition();

    assertEquals(
      evidence.state,
      "complete_action_execution_precondition_evidence",
    );

    assertEquals(
      evidence.finalDecisionDisposition,
      "satisfied",
    );

    const activation =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        evidence,
        [
          authority(evidence),
        ],
      );

    assertEquals(
      activation.state,
      "resolved_granted",
    );

    const result = deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
      evidence,
      activation,
    );

    assertEquals(
      result.state,
      "admitted",
    );

    assertEquals(
      result.blockingReasons,
      [],
    );

    assertStrictEquals(
      result.sourcePreconditionEvidence,
      evidence,
    );

    assertStrictEquals(
      result.sourceActivationResolution,
      activation,
    );

    assertEquals(
      result.governance.runtimeActionExecuted,
      false,
    );

    assertEquals(
      result.governance.schedulerInvoked,
      false,
    );

    assertEquals(
      result.governance.graphMutationPerformed,
      false,
    );
  },
);

Deno.test(
  "D7.3 real false rejected remains semantic false and is not admitted",
  () => {
    const evidence = precondition(
      "resolved_false",
      "rejected",
    );

    assertEquals(
      evidence.state,
      "complete_action_execution_precondition_evidence",
    );

    const activation =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        evidence,
        [
          authority(evidence),
        ],
      );

    const result = deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
      evidence,
      activation,
    );

    assertEquals(
      result.rootTruthDisposition,
      "resolved_false",
    );

    assertEquals(
      result.finalDecisionDisposition,
      "rejected",
    );

    assertEquals(
      result.state,
      "not_admitted",
    );

    assertEquals(
      result.blockingReasons,
      [
        "final_decision_rejected",
      ],
    );
  },
);

Deno.test(
  "D7.3 uncertain final decision remains unresolved despite activation grant",
  () => {
    const evidence = precondition(
      "unresolved",
      "uncertain",
    );

    const activation =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        evidence,
        [
          authority(evidence),
        ],
      );

    const result = deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
      evidence,
      activation,
    );

    assertEquals(
      result.state,
      "unresolved",
    );

    assertEquals(
      result.blockingReasons,
      [
        "final_decision_uncertain",
      ],
    );
  },
);

Deno.test(
  "D7.3 explicit activation denial is distinct from absence",
  () => {
    const evidence = precondition();

    const denied = resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
      evidence,
      [
        authority(
          evidence,
          {
            decision: "denied",
          },
        ),
      ],
    );

    const deniedResult =
      deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
        evidence,
        denied,
      );

    assertEquals(
      deniedResult.state,
      "not_admitted",
    );

    assertEquals(
      deniedResult.blockingReasons,
      [
        "activation_denied",
      ],
    );

    const absent = resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
      evidence,
      [],
    );

    const absentResult =
      deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
        evidence,
        absent,
      );

    assertEquals(
      absentResult.state,
      "unresolved",
    );

    assertEquals(
      absentResult.blockingReasons,
      [
        "activation_absent",
      ],
    );
  },
);

Deno.test(
  "D7.3 ambiguous and invalid activation fail closed without becoming denial",
  () => {
    const evidence = precondition();

    const first = authority(
      evidence,
      {
        authorityId: "activation-authority:1",
      },
    );

    const second = authority(
      evidence,
      {
        authorityId: "activation-authority:2",
      },
    );

    const ambiguous =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        evidence,
        [
          first,
          second,
        ],
      );

    const ambiguousResult =
      deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
        evidence,
        ambiguous,
      );

    assertEquals(
      ambiguousResult.state,
      "unresolved",
    );

    assertEquals(
      ambiguousResult.blockingReasons,
      [
        "activation_ambiguous",
      ],
    );

    const invalidAuthority = authority(
      evidence,
      {
        supersedesAuthorityId: "missing-authority",
      },
    );

    const invalid =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        evidence,
        [
          invalidAuthority,
        ],
      );

    const invalidResult =
      deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
        evidence,
        invalid,
      );

    assertEquals(
      invalidResult.state,
      "unresolved",
    );

    assertEquals(
      invalidResult.blockingReasons,
      [
        "activation_invalid",
      ],
    );
  },
);

Deno.test(
  "D7.3 incomplete D4 evidence cannot be admitted",
  () => {
    const evidence = precondition(
      "resolved_true",
      "satisfied",
      "unresolved_execution_readiness_evidence",
    );

    assertEquals(
      evidence.state,
      "incomplete_action_execution_precondition_evidence",
    );

    const activation =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        evidence,
        [
          authority(evidence),
        ],
      );

    const result = deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
      evidence,
      activation,
    );

    assertEquals(
      result.state,
      "unresolved",
    );

    assertEquals(
      result.blockingReasons,
      [
        "precondition_evidence_incomplete",
      ],
    );
  },
);

Deno.test(
  "D7.3 requires activation resolution for the exact same D4 evidence object",
  () => {
    const first = precondition();

    const second = precondition();

    const activation =
      resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
        first,
        [
          authority(first),
        ],
      );

    const result = deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
      second,
      activation,
    );

    assertEquals(
      result.state,
      "unresolved",
    );

    assertEquals(
      result.blockingReasons,
      [
        "activation_resolution_not_for_exact_precondition",
      ],
    );

    assertStrictEquals(
      result.sourcePreconditionEvidence,
      second,
    );

    assertStrictEquals(
      result.sourceActivationResolution,
      activation,
    );
  },
);
