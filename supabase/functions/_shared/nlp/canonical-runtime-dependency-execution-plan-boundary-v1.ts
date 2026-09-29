import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-action-candidate-bridge-v1.ts";

import type {
  CanonicalRuntimeDependencyEndpointResolutionEvidenceV1,
} from "./canonical-runtime-dependency-endpoint-resolution-evidence-boundary-v1.ts";

import type {
  CanonicalRuntimeActionExecutionAdmissionDecisionV1,
} from "./canonical-runtime-action-execution-admission-boundary-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_PLAN_BOUNDARY_V1 =
  "d7.10:dependency-execution-plan-boundary-v1" as const;

export type CanonicalRuntimeDependencyExecutionPlanActionCandidateV1 = Extract<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateV1,
  { family: "create_dependency" }
>;

export type CanonicalRuntimeDependencyExecutionPlanStateV1 =
  | "resolved_deterministic_dependency_execution_plan"
  | "unresolved_dependency_execution_plan";

export type CanonicalRuntimeDependencyExecutionPlanBlockingReasonV1 =
  | "admission_not_admitted"
  | "admission_unresolved"
  | "action_authority_identity_mismatch"
  | "manifest_identity_mismatch"
  | "dependency_action_authority_identity_mismatch"
  | "snapshot_identity_mismatch"
  | "sentence_occurrence_identity_mismatch"
  | "endpoint_evidence_missing"
  | "endpoint_evidence_ambiguous"
  | "endpoint_evidence_unresolved"
  | "endpoint_multiplicity_mismatch"
  | "endpoint_reference_identity_mismatch";

type AdmissionPrecondition = CanonicalRuntimeActionExecutionAdmissionDecisionV1[
  "sourcePreconditionEvidence"
];

type ExpectedEndpointReference = AdmissionPrecondition[
  "sourceExpectedEndpointReferences"
][number];

export type CanonicalRuntimeDependencyExecutionPlanV1 = {
  readonly planId: string;

  readonly status: "candidate";

  readonly manifestId: string;
  readonly manifestCode: string;

  readonly structuralAuthorityId: string;

  readonly snapshotIdentityId: string;
  readonly snapshotSentenceOccurrenceIdentityId: string;

  readonly dependencyActionAuthorityId: string;

  readonly actionOrdinal: number;
  readonly actionIndex: number;

  readonly relation: CanonicalRuntimeDependencyExecutionPlanActionCandidateV1[
    "sourceAuthority"
  ]["relation"];

  readonly actionTarget:
    CanonicalRuntimeDependencyExecutionPlanActionCandidateV1[
      "sourceAuthority"
    ]["actionTarget"];

  readonly actionValue:
    CanonicalRuntimeDependencyExecutionPlanActionCandidateV1[
      "sourceAuthority"
    ]["actionValue"];

  readonly reasonCode: CanonicalRuntimeDependencyExecutionPlanActionCandidateV1[
    "sourceAuthority"
  ]["reasonCode"];

  readonly sourceCandidateCodes:
    CanonicalRuntimeDependencyExecutionPlanActionCandidateV1[
      "sourceAuthority"
    ]["sourceCandidateCodes"];

  readonly sourceAdmissionDecision:
    CanonicalRuntimeActionExecutionAdmissionDecisionV1;

  readonly sourceActionCandidate:
    CanonicalRuntimeDependencyExecutionPlanActionCandidateV1;

  readonly sourceActionAuthority:
    CanonicalRuntimeDependencyExecutionPlanActionCandidateV1[
      "sourceAuthority"
    ];

  readonly sourceEndpointResolutionEvidence:
    readonly CanonicalRuntimeDependencyEndpointResolutionEvidenceV1[];

  readonly governance: {
    readonly exactAdmissionDecisionRequired: true;
    readonly exactCreateDependencyCandidateRequired: true;

    readonly exactManifestIdentityRequired: true;
    readonly exactDependencyActionAuthorityIdentityRequired: true;
    readonly exactCurrentSnapshotIdentityRequired: true;
    readonly exactCurrentSentenceOccurrenceIdentityRequired: true;

    readonly exactActionAuthorityReferencePreserved: true;
    readonly actionAuthorityReconstructedFromIdentity: false;

    readonly exactAuthoredEndpointReferencesRequired: true;
    readonly exactResolvedEndpointEvidenceRequired: true;
    readonly endpointMultiplicityPreserved: true;

    readonly actionMultiplicityCollapsed: false;
    readonly actionSelected: false;
    readonly singletonActionPromotedToWinner: false;

    readonly truthRecomputed: false;
    readonly activationPermissionRecomputed: false;
    readonly executionAdmissionRecomputed: false;

    readonly endpointDirectionInferred: false;
    readonly endpointBindingRecomputed: false;
    readonly dependencySemanticsRecomputed: false;

    readonly runtimeActionExecuted: false;
    readonly schedulerInvoked: false;
    readonly canonicalEdgeGenerated: false;
    readonly graphMutationPerformed: false;
  };
};

export type CanonicalRuntimeDependencyExecutionPlanBoundaryResultV1 = {
  readonly producer:
    typeof CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_PLAN_BOUNDARY_V1;

  readonly status: "candidate";

  readonly state: CanonicalRuntimeDependencyExecutionPlanStateV1;

  readonly plan: CanonicalRuntimeDependencyExecutionPlanV1 | null;

  readonly sourceAdmissionDecision:
    CanonicalRuntimeActionExecutionAdmissionDecisionV1;

  readonly sourceActionCandidate:
    CanonicalRuntimeDependencyExecutionPlanActionCandidateV1;

  readonly sourceEndpointResolutionEvidence:
    readonly CanonicalRuntimeDependencyEndpointResolutionEvidenceV1[];

  readonly blockingReasons:
    readonly CanonicalRuntimeDependencyExecutionPlanBlockingReasonV1[];
};

function governance(): CanonicalRuntimeDependencyExecutionPlanV1[
  "governance"
] {
  return {
    exactAdmissionDecisionRequired: true,
    exactCreateDependencyCandidateRequired: true,

    exactManifestIdentityRequired: true,
    exactDependencyActionAuthorityIdentityRequired: true,
    exactCurrentSnapshotIdentityRequired: true,
    exactCurrentSentenceOccurrenceIdentityRequired: true,

    exactActionAuthorityReferencePreserved: true,
    actionAuthorityReconstructedFromIdentity: false,

    exactAuthoredEndpointReferencesRequired: true,
    exactResolvedEndpointEvidenceRequired: true,
    endpointMultiplicityPreserved: true,

    actionMultiplicityCollapsed: false,
    actionSelected: false,
    singletonActionPromotedToWinner: false,

    truthRecomputed: false,
    activationPermissionRecomputed: false,
    executionAdmissionRecomputed: false,

    endpointDirectionInferred: false,
    endpointBindingRecomputed: false,
    dependencySemanticsRecomputed: false,

    runtimeActionExecuted: false,
    schedulerInvoked: false,
    canonicalEdgeGenerated: false,
    graphMutationPerformed: false,
  };
}

function unresolved(
  admission: CanonicalRuntimeActionExecutionAdmissionDecisionV1,
  actionCandidate: CanonicalRuntimeDependencyExecutionPlanActionCandidateV1,
  endpointEvidence:
    readonly CanonicalRuntimeDependencyEndpointResolutionEvidenceV1[],
  blockingReasons:
    readonly CanonicalRuntimeDependencyExecutionPlanBlockingReasonV1[],
): CanonicalRuntimeDependencyExecutionPlanBoundaryResultV1 {
  return {
    producer: CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_PLAN_BOUNDARY_V1,

    status: "candidate",

    state: "unresolved_dependency_execution_plan",

    plan: null,

    sourceAdmissionDecision: admission,
    sourceActionCandidate: actionCandidate,
    sourceEndpointResolutionEvidence: endpointEvidence,

    blockingReasons: [
      ...new Set(blockingReasons),
    ].sort(),
  };
}

function endpointKey(
  endpoint: ExpectedEndpointReference,
): string {
  return [
    endpoint.dependencyActionAuthorityId,
    endpoint.endpointRole,
    endpoint.bindingName,
  ].join(":");
}

function evidenceEndpointKey(
  evidence: CanonicalRuntimeDependencyEndpointResolutionEvidenceV1,
): string {
  return [
    evidence.dependencyActionAuthorityId,
    evidence.authoredEndpointRole,
    evidence.referencedBindingName,
  ].join(":");
}

export function deriveCanonicalRuntimeDependencyExecutionPlanBoundaryV1(
  admission: CanonicalRuntimeActionExecutionAdmissionDecisionV1,
  actionCandidate: CanonicalRuntimeDependencyExecutionPlanActionCandidateV1,
  endpointEvidence:
    readonly CanonicalRuntimeDependencyEndpointResolutionEvidenceV1[],
): CanonicalRuntimeDependencyExecutionPlanBoundaryResultV1 {
  const precondition = admission.sourcePreconditionEvidence;

  const authority = actionCandidate.sourceAuthority;

  if (admission.state === "unresolved") {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      ["admission_unresolved"],
    );
  }

  if (admission.state !== "admitted") {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      ["admission_not_admitted"],
    );
  }

  if (
    authority.id !==
      admission.dependencyActionAuthorityId
  ) {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      ["action_authority_identity_mismatch"],
    );
  }

  if (
    authority.manifestId !== admission.manifestId ||
    authority.manifestId !== precondition.manifestId ||
    authority.manifestCode !== precondition.manifestCode
  ) {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      ["manifest_identity_mismatch"],
    );
  }

  if (
    precondition.dependencyActionAuthorityId !==
      admission.dependencyActionAuthorityId
  ) {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      [
        "dependency_action_authority_identity_mismatch",
      ],
    );
  }

  const expected = precondition.sourceExpectedEndpointReferences.filter(
    (endpoint) =>
      endpoint.dependencyActionAuthorityId ===
        admission.dependencyActionAuthorityId,
  );

  const foreignExpected = precondition.sourceExpectedEndpointReferences.filter(
    (endpoint) =>
      endpoint.dependencyActionAuthorityId !==
        admission.dependencyActionAuthorityId,
  );

  if (foreignExpected.length !== 0) {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      [
        "dependency_action_authority_identity_mismatch",
      ],
    );
  }

  if (expected.length === 0) {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      ["endpoint_evidence_missing"],
    );
  }

  const suppliedForAction = endpointEvidence.filter(
    (evidence) =>
      evidence.dependencyActionAuthorityId ===
        admission.dependencyActionAuthorityId,
  );

  if (
    suppliedForAction.length !==
      endpointEvidence.length
  ) {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      [
        "dependency_action_authority_identity_mismatch",
      ],
    );
  }

  for (const evidence of endpointEvidence) {
    if (
      evidence.manifestId !==
        precondition.manifestId ||
      evidence.manifestCode !==
        precondition.manifestCode
    ) {
      return unresolved(
        admission,
        actionCandidate,
        endpointEvidence,
        ["manifest_identity_mismatch"],
      );
    }

    if (
      evidence.snapshotIdentityId !==
        precondition.snapshotIdentityId
    ) {
      return unresolved(
        admission,
        actionCandidate,
        endpointEvidence,
        ["snapshot_identity_mismatch"],
      );
    }

    if (
      evidence.snapshotSentenceOccurrenceIdentityId !==
        precondition.snapshotSentenceOccurrenceIdentityId
    ) {
      return unresolved(
        admission,
        actionCandidate,
        endpointEvidence,
        ["sentence_occurrence_identity_mismatch"],
      );
    }

    if (
      evidence.state !==
        "resolved_exact_endpoint_binding_evidence"
    ) {
      return unresolved(
        admission,
        actionCandidate,
        endpointEvidence,
        ["endpoint_evidence_unresolved"],
      );
    }

    if (
      evidence.sourceFinalRuntimeBindingDomain ===
        null ||
      evidence.sourceFinalRuntimeBindingValue ===
        null
    ) {
      return unresolved(
        admission,
        actionCandidate,
        endpointEvidence,
        ["endpoint_evidence_unresolved"],
      );
    }

    if (
      evidence.sourceEndpointReference
          .dependencyActionAuthorityId !==
        evidence.dependencyActionAuthorityId ||
      evidence.sourceEndpointReference.endpointRole !==
        evidence.authoredEndpointRole ||
      evidence.sourceEndpointReference.bindingName !==
        evidence.referencedBindingName
    ) {
      return unresolved(
        admission,
        actionCandidate,
        endpointEvidence,
        ["endpoint_reference_identity_mismatch"],
      );
    }
  }

  const expectedKeys = expected.map(endpointKey).sort();

  const suppliedKeys = endpointEvidence.map(
    evidenceEndpointKey,
  ).sort();

  if (
    new Set(expectedKeys).size !==
      expectedKeys.length
  ) {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      ["endpoint_evidence_ambiguous"],
    );
  }

  if (
    new Set(suppliedKeys).size !==
      suppliedKeys.length
  ) {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      ["endpoint_evidence_ambiguous"],
    );
  }

  if (
    expectedKeys.length !==
      suppliedKeys.length
  ) {
    return unresolved(
      admission,
      actionCandidate,
      endpointEvidence,
      ["endpoint_multiplicity_mismatch"],
    );
  }

  for (
    let index = 0;
    index < expectedKeys.length;
    index += 1
  ) {
    if (
      expectedKeys[index] !==
        suppliedKeys[index]
    ) {
      return unresolved(
        admission,
        actionCandidate,
        endpointEvidence,
        ["endpoint_reference_identity_mismatch"],
      );
    }
  }

  const planId = [
    "runtime-dependency-execution-plan-v1",
    precondition.manifestId,
    admission.dependencyActionAuthorityId,
    precondition.snapshotIdentityId,
    precondition.snapshotSentenceOccurrenceIdentityId,
  ].join(":");

  const plan: CanonicalRuntimeDependencyExecutionPlanV1 = {
    planId,

    status: "candidate",

    manifestId: precondition.manifestId,
    manifestCode: precondition.manifestCode,

    structuralAuthorityId: precondition.structuralAuthorityId,

    snapshotIdentityId: precondition.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId: precondition
      .snapshotSentenceOccurrenceIdentityId,

    dependencyActionAuthorityId: admission.dependencyActionAuthorityId,

    actionOrdinal: precondition.actionOrdinal,

    actionIndex: actionCandidate.actionIndex,

    relation: authority.relation,
    actionTarget: authority.actionTarget,
    actionValue: authority.actionValue,
    reasonCode: authority.reasonCode,
    sourceCandidateCodes: authority.sourceCandidateCodes,

    sourceAdmissionDecision: admission,

    sourceActionCandidate: actionCandidate,

    sourceActionAuthority: authority,

    sourceEndpointResolutionEvidence: endpointEvidence,

    governance: governance(),
  };

  return {
    producer: CANONICAL_RUNTIME_DEPENDENCY_EXECUTION_PLAN_BOUNDARY_V1,

    status: "candidate",

    state: "resolved_deterministic_dependency_execution_plan",

    plan,

    sourceAdmissionDecision: admission,
    sourceActionCandidate: actionCandidate,
    sourceEndpointResolutionEvidence: endpointEvidence,

    blockingReasons: [],
  };
}
