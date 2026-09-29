import type {
  CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
} from "./canonical-runtime-action-execution-precondition-evidence-boundary-v1.ts";

import type {
  CanonicalRuntimeDependencyActionActivationResolutionV1,
} from "./canonical-runtime-dependency-action-activation-authority-resolution-v1.ts";

export const CANONICAL_RUNTIME_ACTION_EXECUTION_ADMISSION_BOUNDARY_V1 =
  "d7.3:action-execution-admission-boundary-v1" as const;

export type CanonicalRuntimeActionExecutionAdmissionStateV1 =
  | "admitted"
  | "not_admitted"
  | "unresolved";

export type CanonicalRuntimeActionExecutionAdmissionBlockingReasonV1 =
  | "identity_mismatch"
  | "activation_resolution_not_for_exact_precondition"
  | "precondition_evidence_incomplete"
  | "final_decision_rejected"
  | "final_decision_uncertain"
  | "activation_denied"
  | "activation_absent"
  | "activation_ambiguous"
  | "activation_invalid";

export type CanonicalRuntimeActionExecutionAdmissionDecisionV1 = {
  readonly id: string;

  readonly producer:
    typeof CANONICAL_RUNTIME_ACTION_EXECUTION_ADMISSION_BOUNDARY_V1;

  readonly status: "candidate";

  readonly state: CanonicalRuntimeActionExecutionAdmissionStateV1;

  readonly manifestId: string;
  readonly dependencyActionAuthorityId: string;

  readonly rootTruthDisposition:
    CanonicalRuntimeActionExecutionPreconditionEvidenceV1[
      "rootTruthDisposition"
    ];

  readonly finalDecisionDisposition:
    CanonicalRuntimeActionExecutionPreconditionEvidenceV1[
      "finalDecisionDisposition"
    ];

  readonly sourcePreconditionEvidence:
    CanonicalRuntimeActionExecutionPreconditionEvidenceV1;

  readonly sourceActivationResolution:
    CanonicalRuntimeDependencyActionActivationResolutionV1;

  readonly blockingReasons:
    readonly CanonicalRuntimeActionExecutionAdmissionBlockingReasonV1[];

  readonly governance: {
    readonly exactManifestIdentityRequired: true;
    readonly exactDependencyActionAuthorityIdentityRequired: true;

    readonly exactPreconditionEvidenceReferenceRequired: true;

    readonly preconditionCompletenessConsumedWithoutRecomputation: true;
    readonly activationResolutionConsumedWithoutInference: true;

    readonly finalWhereTruthPreservedWithoutRecomputation: true;
    readonly finalDecisionPreservedWithoutRecomputation: true;

    readonly rejectedFalseSemanticsPreserved: true;
    readonly deniedDistinctFromAbsentAmbiguousInvalid: true;

    readonly authoredAdmissionAuthorityCreated: false;
    readonly independentAdmissionVersioningDerived: false;
    readonly implicitAdmissionPermissionDerived: false;

    readonly actionSelected: false;
    readonly singletonActionPromotedToWinner: false;

    readonly endpointDirectionResolved: false;
    readonly endpointBindingPerformed: false;
    readonly dependencySemanticsResolved: false;

    readonly runtimeActionExecuted: false;
    readonly schedulerInvoked: false;
    readonly canonicalEdgeGenerated: false;
    readonly graphMutationPerformed: false;
  };
};

function decisionId(
  precondition: CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
): string {
  return [
    "action-execution-admission",
    precondition.manifestId,
    precondition.dependencyActionAuthorityId,
    precondition.actionOrdinal,
  ].join(":");
}

function governance(): CanonicalRuntimeActionExecutionAdmissionDecisionV1[
  "governance"
] {
  return {
    exactManifestIdentityRequired: true,
    exactDependencyActionAuthorityIdentityRequired: true,

    exactPreconditionEvidenceReferenceRequired: true,

    preconditionCompletenessConsumedWithoutRecomputation: true,
    activationResolutionConsumedWithoutInference: true,

    finalWhereTruthPreservedWithoutRecomputation: true,
    finalDecisionPreservedWithoutRecomputation: true,

    rejectedFalseSemanticsPreserved: true,
    deniedDistinctFromAbsentAmbiguousInvalid: true,

    authoredAdmissionAuthorityCreated: false,
    independentAdmissionVersioningDerived: false,
    implicitAdmissionPermissionDerived: false,

    actionSelected: false,
    singletonActionPromotedToWinner: false,

    endpointDirectionResolved: false,
    endpointBindingPerformed: false,
    dependencySemanticsResolved: false,

    runtimeActionExecuted: false,
    schedulerInvoked: false,
    canonicalEdgeGenerated: false,
    graphMutationPerformed: false,
  };
}

function buildDecision(
  precondition: CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
  activation: CanonicalRuntimeDependencyActionActivationResolutionV1,
  state: CanonicalRuntimeActionExecutionAdmissionStateV1,
  blockingReasons:
    readonly CanonicalRuntimeActionExecutionAdmissionBlockingReasonV1[],
): CanonicalRuntimeActionExecutionAdmissionDecisionV1 {
  return {
    id: decisionId(precondition),

    producer: CANONICAL_RUNTIME_ACTION_EXECUTION_ADMISSION_BOUNDARY_V1,

    status: "candidate",

    state,

    manifestId: precondition.manifestId,

    dependencyActionAuthorityId: precondition.dependencyActionAuthorityId,

    rootTruthDisposition: precondition.rootTruthDisposition,

    finalDecisionDisposition: precondition.finalDecisionDisposition,

    sourcePreconditionEvidence: precondition,

    sourceActivationResolution: activation,

    blockingReasons,

    governance: governance(),
  };
}

export function deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1(
  precondition: CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
  activation: CanonicalRuntimeDependencyActionActivationResolutionV1,
): CanonicalRuntimeActionExecutionAdmissionDecisionV1 {
  if (
    activation.manifestId !==
      precondition.manifestId ||
    activation.dependencyActionAuthorityId !==
      precondition.dependencyActionAuthorityId
  ) {
    return buildDecision(
      precondition,
      activation,
      "unresolved",
      ["identity_mismatch"],
    );
  }

  if (
    activation.sourcePreconditionEvidence !==
      precondition
  ) {
    return buildDecision(
      precondition,
      activation,
      "unresolved",
      [
        "activation_resolution_not_for_exact_precondition",
      ],
    );
  }

  if (
    precondition.state !==
      "complete_action_execution_precondition_evidence"
  ) {
    return buildDecision(
      precondition,
      activation,
      "unresolved",
      ["precondition_evidence_incomplete"],
    );
  }

  if (
    precondition.finalDecisionDisposition ===
      "rejected"
  ) {
    return buildDecision(
      precondition,
      activation,
      "not_admitted",
      ["final_decision_rejected"],
    );
  }

  if (
    precondition.finalDecisionDisposition ===
      "uncertain"
  ) {
    return buildDecision(
      precondition,
      activation,
      "unresolved",
      ["final_decision_uncertain"],
    );
  }

  switch (activation.state) {
    case "resolved_granted":
      return buildDecision(
        precondition,
        activation,
        "admitted",
        [],
      );

    case "resolved_denied":
      return buildDecision(
        precondition,
        activation,
        "not_admitted",
        ["activation_denied"],
      );

    case "unresolved_absent":
      return buildDecision(
        precondition,
        activation,
        "unresolved",
        ["activation_absent"],
      );

    case "unresolved_ambiguous":
      return buildDecision(
        precondition,
        activation,
        "unresolved",
        ["activation_ambiguous"],
      );

    case "unresolved_invalid":
      return buildDecision(
        precondition,
        activation,
        "unresolved",
        ["activation_invalid"],
      );
  }
}
