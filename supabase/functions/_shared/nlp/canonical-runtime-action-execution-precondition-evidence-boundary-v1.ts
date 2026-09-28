import type {
  CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1,
  CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";

import type {
  CanonicalRuntimeDependencyEndpointResolutionEvidenceV1,
} from "./canonical-runtime-dependency-endpoint-resolution-evidence-boundary-v1.ts";

import type {
  CanonicalRuntimeExecutionReadinessEvidenceBoundaryV1,
} from "./canonical-runtime-execution-readiness-evidence-boundary-v1.ts";

export const CANONICAL_RUNTIME_ACTION_EXECUTION_PRECONDITION_EVIDENCE_BOUNDARY_V1 =
  "late-v1.40:action-execution-precondition-evidence-boundary-v1" as const;

type FullReadiness =
  CanonicalRuntimeExecutionReadinessEvidenceBoundaryV1;

type FullBridge =
  FullReadiness["sourceActionCandidateBridge"];

type FullTerminal =
  FullBridge["sourceTerminalEnvelope"];

type RootTruthDisposition =
  FullTerminal["rootTruthDisposition"];

type FinalDecisionDisposition =
  FullTerminal["finalDecisionDisposition"];

type TerminalTruthView =
  Pick<
    FullTerminal,
    | "envelopeId"
    | "structuralAuthorityId"
    | "snapshotIdentityId"
    | "snapshotSentenceOccurrenceIdentityId"
    | "rootTruthDisposition"
    | "finalDecisionDisposition"
  >;

type ActionBridgeTruthView =
  Pick<
    FullBridge,
    | "bridgeId"
    | "manifestId"
    | "manifestCode"
    | "structuralAuthorityId"
  > & {
    sourceTerminalEnvelope: TerminalTruthView;
  };

type AssociationView =
  Pick<
    CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1,
    | "id"
    | "manifestId"
    | "manifestCode"
    | "associationState"
    | "associatedDependencyActionAuthorityIds"
    | "associatedDependencyEndpointReferences"
    | "selectedDependencyActionAuthorityId"
    | "dependencyEndpointRole"
  >;

export type CanonicalRuntimeActionExecutionPreconditionReadinessInputV1 =
  Pick<
    FullReadiness,
    | "id"
    | "state"
    | "manifestId"
    | "manifestCode"
    | "structuralAuthorityId"
    | "snapshotIdentityId"
    | "snapshotSentenceOccurrenceIdentityId"
    | "associatedDependencyActionAuthorityIds"
  > & {
    sourceActionCandidateBridge: ActionBridgeTruthView;
    sourceDependencyActionBindingAssociation: AssociationView;
  };

export type CanonicalRuntimeActionExecutionPreconditionEndpointInputV1 =
  Pick<
    CanonicalRuntimeDependencyEndpointResolutionEvidenceV1,
    | "id"
    | "state"
    | "manifestId"
    | "manifestCode"
    | "snapshotIdentityId"
    | "snapshotSentenceOccurrenceIdentityId"
    | "dependencyActionAuthorityId"
    | "authoredEndpointRole"
    | "referencedBindingName"
    | "sourceExecutionReadinessEvidence"
    | "sourceEndpointReference"
  >;

export type CanonicalRuntimeActionExecutionPreconditionEvidenceStateV1 =
  | "complete_action_execution_precondition_evidence"
  | "incomplete_action_execution_precondition_evidence";

export type CanonicalRuntimeActionExecutionPreconditionEvidenceV1 = {
  id: string;

  status: "candidate";

  state:
    CanonicalRuntimeActionExecutionPreconditionEvidenceStateV1;

  manifestId: string;
  manifestCode: string;

  structuralAuthorityId: string;

  snapshotIdentityId: string;
  snapshotSentenceOccurrenceIdentityId: string;

  dependencyActionAuthorityId: string;
  actionOrdinal: number;

  rootTruthDisposition: RootTruthDisposition;
  finalDecisionDisposition: FinalDecisionDisposition;

  sourceExecutionReadinessEvidence:
    CanonicalRuntimeActionExecutionPreconditionReadinessInputV1;

  sourceExpectedEndpointReferences:
    readonly CanonicalRuntimeDependencyActionBindingEndpointReferenceV1[];

  sourceEndpointResolutionEvidence:
    readonly CanonicalRuntimeActionExecutionPreconditionEndpointInputV1[];

  blockingReasons: readonly string[];

  governance: {
    exactExecutionReadinessEvidenceRequired: true;
    exactActionAuthorityIdentityRequired: true;

    exactManifestCoherenceRequired: true;
    exactStructuralAuthorityCoherenceRequired: true;
    exactCurrentSnapshotIdentityRequired: true;
    exactCurrentSentenceOccurrenceIdentityRequired: true;

    finalWhereTruthPreservedWithoutRecomputation: true;
    finalDecisionPreservedWithoutRecomputation: true;

    exactAuthoredEndpointReferencesRequired: true;
    exactResolvedEndpointEvidenceRequired: true;

    evidenceCompletenessDerived: true;

    actionSelected: false;
    singletonActionPromotedToWinner: false;

    endpointDirectionResolved: false;
    endpointBindingPerformed: false;

    executionAdmissionDerived: false;
    activationPermissionDerived: false;

    executableStateDerived: false;
    schedulableStateDerived: false;

    dependencySemanticsResolved: false;

    runtimeActionExecuted: false;
    schedulerInvoked: false;

    canonicalEdgeGenerated: false;
    graphMutationPerformed: false;

    candidateOnly: true;
    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryResultV1 =
  {
    status: "ready";

    evidence:
      CanonicalRuntimeActionExecutionPreconditionEvidenceV1[];

    blockingReasons: [];
  };

function evidenceId(
  readiness:
    CanonicalRuntimeActionExecutionPreconditionReadinessInputV1,
  dependencyActionAuthorityId: string,
  actionOrdinal: number,
): string {
  return [
    CANONICAL_RUNTIME_ACTION_EXECUTION_PRECONDITION_EVIDENCE_BOUNDARY_V1,
    readiness.id,
    dependencyActionAuthorityId,
    actionOrdinal,
  ].join(":");
}

function exactEndpointEvidenceMatches(
  readiness:
    CanonicalRuntimeActionExecutionPreconditionReadinessInputV1,
  endpoint:
    CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
  evidence:
    readonly CanonicalRuntimeActionExecutionPreconditionEndpointInputV1[],
): CanonicalRuntimeActionExecutionPreconditionEndpointInputV1[] {
  return evidence.filter(
    (item) =>
      item.dependencyActionAuthorityId ===
        endpoint.dependencyActionAuthorityId &&
      item.authoredEndpointRole === endpoint.endpointRole &&
      item.referencedBindingName === endpoint.bindingName &&
      item.sourceEndpointReference.dependencyActionAuthorityId ===
        endpoint.dependencyActionAuthorityId &&
      item.sourceEndpointReference.endpointRole ===
        endpoint.endpointRole &&
      item.sourceEndpointReference.bindingName ===
        endpoint.bindingName &&
      item.manifestId === readiness.manifestId &&
      item.manifestCode === readiness.manifestCode &&
      item.snapshotIdentityId === readiness.snapshotIdentityId &&
      item.snapshotSentenceOccurrenceIdentityId ===
        readiness.snapshotSentenceOccurrenceIdentityId &&
      item.sourceExecutionReadinessEvidence.id === readiness.id,
  );
}

export function deriveCanonicalRuntimeActionExecutionPreconditionEvidenceV1(
  readiness:
    CanonicalRuntimeActionExecutionPreconditionReadinessInputV1,
  dependencyActionAuthorityId: string,
  actionOrdinal: number,
  endpointEvidence:
    readonly CanonicalRuntimeActionExecutionPreconditionEndpointInputV1[],
): CanonicalRuntimeActionExecutionPreconditionEvidenceV1 {
  const terminalEnvelope =
    readiness.sourceActionCandidateBridge.sourceTerminalEnvelope;

  const association =
    readiness.sourceDependencyActionBindingAssociation;

  const expectedEndpointReferences =
    association.associatedDependencyEndpointReferences.filter(
      (endpoint) =>
        endpoint.dependencyActionAuthorityId ===
          dependencyActionAuthorityId,
    );

  const actionEndpointEvidence =
    endpointEvidence.filter(
      (item) =>
        item.dependencyActionAuthorityId ===
          dependencyActionAuthorityId,
    );

  const blockingReasons: string[] = [];

  if (
    readiness.state !==
      "coherent_execution_readiness_evidence"
  ) {
    blockingReasons.push(
      "execution_readiness_evidence_not_coherent",
    );
  }

  if (
    readiness.manifestId !==
      readiness.sourceActionCandidateBridge.manifestId ||
    readiness.manifestCode !==
      readiness.sourceActionCandidateBridge.manifestCode ||
    readiness.structuralAuthorityId !==
      readiness.sourceActionCandidateBridge.structuralAuthorityId
  ) {
    blockingReasons.push(
      "action_candidate_bridge_identity_mismatch",
    );
  }

  if (
    terminalEnvelope.structuralAuthorityId !==
      readiness.structuralAuthorityId
  ) {
    blockingReasons.push(
      "terminal_structural_authority_identity_mismatch",
    );
  }

  if (
    terminalEnvelope.snapshotIdentityId !==
      readiness.snapshotIdentityId ||
    terminalEnvelope.snapshotSentenceOccurrenceIdentityId !==
      readiness.snapshotSentenceOccurrenceIdentityId
  ) {
    blockingReasons.push(
      "terminal_current_occurrence_identity_mismatch",
    );
  }

  if (
    association.manifestId !== readiness.manifestId ||
    association.manifestCode !== readiness.manifestCode
  ) {
    blockingReasons.push(
      "dependency_action_binding_association_manifest_mismatch",
    );
  }

  if (
    association.associationState !==
      "resolved_exact_action_binding_provenance"
  ) {
    blockingReasons.push(
      "dependency_action_binding_association_not_resolved",
    );
  }

  if (
    association.selectedDependencyActionAuthorityId !== null ||
    association.dependencyEndpointRole !== null
  ) {
    blockingReasons.push(
      "dependency_action_binding_association_contains_selection",
    );
  }

  if (expectedEndpointReferences.length === 0) {
    blockingReasons.push(
      "authored_endpoint_reference_missing",
    );
  }

  for (const endpoint of expectedEndpointReferences) {
    const matches = exactEndpointEvidenceMatches(
      readiness,
      endpoint,
      actionEndpointEvidence,
    );

    if (matches.length === 0) {
      blockingReasons.push(
        [
          "exact_endpoint_resolution_evidence_missing",
          endpoint.endpointRole,
          endpoint.bindingName,
        ].join(":"),
      );

      continue;
    }

    if (matches.length > 1) {
      blockingReasons.push(
        [
          "exact_endpoint_resolution_evidence_ambiguous",
          endpoint.endpointRole,
          endpoint.bindingName,
        ].join(":"),
      );

      continue;
    }

    if (
      matches[0].state !==
        "resolved_exact_endpoint_binding_evidence"
    ) {
      blockingReasons.push(
        [
          "exact_endpoint_resolution_evidence_unresolved",
          endpoint.endpointRole,
          endpoint.bindingName,
        ].join(":"),
      );
    }
  }

  for (const item of actionEndpointEvidence) {
    const authoredMatches =
      expectedEndpointReferences.filter(
        (endpoint) =>
          endpoint.dependencyActionAuthorityId ===
            item.dependencyActionAuthorityId &&
          endpoint.endpointRole === item.authoredEndpointRole &&
          endpoint.bindingName === item.referencedBindingName,
      );

    if (authoredMatches.length === 0) {
      blockingReasons.push(
        [
          "unexpected_endpoint_resolution_evidence",
          item.authoredEndpointRole,
          item.referencedBindingName,
        ].join(":"),
      );
    }
  }

  const exactBlockingReasons = [
    ...new Set(blockingReasons),
  ].sort();

  return {
    id: evidenceId(
      readiness,
      dependencyActionAuthorityId,
      actionOrdinal,
    ),

    status: "candidate",

    state: exactBlockingReasons.length === 0
      ? "complete_action_execution_precondition_evidence"
      : "incomplete_action_execution_precondition_evidence",

    manifestId: readiness.manifestId,
    manifestCode: readiness.manifestCode,

    structuralAuthorityId:
      readiness.structuralAuthorityId,

    snapshotIdentityId:
      readiness.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId:
      readiness.snapshotSentenceOccurrenceIdentityId,

    dependencyActionAuthorityId,
    actionOrdinal,

    rootTruthDisposition:
      terminalEnvelope.rootTruthDisposition,

    finalDecisionDisposition:
      terminalEnvelope.finalDecisionDisposition,

    sourceExecutionReadinessEvidence: readiness,

    sourceExpectedEndpointReferences:
      expectedEndpointReferences,

    sourceEndpointResolutionEvidence:
      actionEndpointEvidence,

    blockingReasons: exactBlockingReasons,

    governance: {
      exactExecutionReadinessEvidenceRequired: true,
      exactActionAuthorityIdentityRequired: true,

      exactManifestCoherenceRequired: true,
      exactStructuralAuthorityCoherenceRequired: true,
      exactCurrentSnapshotIdentityRequired: true,
      exactCurrentSentenceOccurrenceIdentityRequired: true,

      finalWhereTruthPreservedWithoutRecomputation: true,
      finalDecisionPreservedWithoutRecomputation: true,

      exactAuthoredEndpointReferencesRequired: true,
      exactResolvedEndpointEvidenceRequired: true,

      evidenceCompletenessDerived: true,

      actionSelected: false,
      singletonActionPromotedToWinner: false,

      endpointDirectionResolved: false,
      endpointBindingPerformed: false,

      executionAdmissionDerived: false,
      activationPermissionDerived: false,

      executableStateDerived: false,
      schedulableStateDerived: false,

      dependencySemanticsResolved: false,

      runtimeActionExecuted: false,
      schedulerInvoked: false,

      canonicalEdgeGenerated: false,
      graphMutationPerformed: false,

      candidateOnly: true,
      frozenGrammarReadOnly: true,
    },
  };
}

export function deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1(
  input: {
    executionReadinessEvidence:
      readonly CanonicalRuntimeActionExecutionPreconditionReadinessInputV1[];

    endpointResolutionEvidence:
      readonly CanonicalRuntimeActionExecutionPreconditionEndpointInputV1[];
  },
): CanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryResultV1 {
  const evidence:
    CanonicalRuntimeActionExecutionPreconditionEvidenceV1[] = [];

  for (const readiness of input.executionReadinessEvidence) {
    readiness.associatedDependencyActionAuthorityIds.forEach(
      (
        dependencyActionAuthorityId,
        actionOrdinal,
      ) => {
        evidence.push(
          deriveCanonicalRuntimeActionExecutionPreconditionEvidenceV1(
            readiness,
            dependencyActionAuthorityId,
            actionOrdinal,
            input.endpointResolutionEvidence,
          ),
        );
      },
    );
  }

  return {
    status: "ready",
    evidence,
    blockingReasons: [],
  };
}