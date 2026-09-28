import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeResultV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-action-candidate-bridge-v1.ts";

import type {
  CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1,
  CanonicalRuntimeDependencyActionBindingAssociationBoundaryResultV1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";

export const CANONICAL_RUNTIME_EXECUTION_READINESS_EVIDENCE_BOUNDARY_V1 =
  "late-v1.40:execution-readiness-evidence-boundary-v1" as const;

export type CanonicalRuntimeExecutionReadinessEvidenceStateV1 =
  | "coherent_execution_readiness_evidence"
  | "unresolved_execution_readiness_evidence";

export type CanonicalRuntimeExecutionReadinessEvidenceBoundaryV1 = {
  id: string;

  status: "candidate";

  state: CanonicalRuntimeExecutionReadinessEvidenceStateV1;

  manifestId: string;
  manifestCode: string;

  structuralAuthorityId: string;

  ownerBindingDefinitionAuthorityId: string;
  ownerBindingName: string;

  snapshotIdentityId: string;
  snapshotSentenceOccurrenceIdentityId: string;

  boundConditionDomainEvidenceId: string;

  associatedDependencyActionAuthorityIds: readonly string[];
  associatedDependencyEndpointRoles: readonly ("source" | "target")[];

  sourceActionCandidateBridge:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1;

  sourceDependencyActionBindingAssociation:
    CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1;

  governance: {
    exactActionCandidateBridgeRequired: true;
    exactDependencyActionBindingAssociationDomainRequired: true;

    exactManifestCoherenceRequired: true;
    exactOwnerBindingCoherenceRequired: true;
    exactPostOwnerEvidenceIdentityRequired: true;

    currentSnapshotIdentityPreserved: true;
    currentSentenceOccurrenceIdentityPreserved: true;

    finalWhereAuthorityPreservedTransitively: true;
    finalWhereTruthRecomputed: false;
    postOwnerEvidenceRecomputed: false;

    dependencyActionBindingProvenancePreserved: true;

    associationDomainsPreservedWithoutSelection: true;
    actionMultiplicityPreserved: true;
    actionSelected: false;
    singletonPromotedToWinner: false;

    executionReadinessEvidenceDerived: true;
    activationPermissionDerived: false;
    executableStateDerived: false;
    schedulableStateDerived: false;

    endpointDirectionResolved: false;
    endpointBindingPerformed: false;
    dependencySemanticsResolved: false;

    runtimeActionExecuted: false;
    schedulerInvoked: false;
    canonicalEdgeGenerated: false;
    graphMutationPerformed: false;

    candidateOnly: true;
    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeExecutionReadinessEvidenceBoundaryResultV1 =
  | {
    status: "ready";
    evidence: CanonicalRuntimeExecutionReadinessEvidenceBoundaryV1[];
    blockingReasons: [];
  }
  | {
    status: "blocked";
    evidence: [];
    blockingReasons: string[];
    governance: {
      semanticFallbackUsed: false;
      associationDomainSelected: false;
      actionSelected: false;
      activationPermissionDerived: false;
      runtimeActionExecuted: false;
      graphMutationPerformed: false;
    };
  };

function evidenceId(
  bridge:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1,
  domain: CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1,
): string {
  return [
    CANONICAL_RUNTIME_EXECUTION_READINESS_EVIDENCE_BOUNDARY_V1,
    bridge.bridgeId,
    domain.id,
  ].join(":");
}

export function deriveCanonicalRuntimeExecutionReadinessEvidenceDomainV1(
  bridge:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1,
  domain: CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1,
): CanonicalRuntimeExecutionReadinessEvidenceBoundaryV1 {
  const terminalEnvelope = bridge.sourceTerminalEnvelope;
  const postOwnerEvidence =
    terminalEnvelope.sourcePostOwnerBoundConditionEvidence;

  const ownerEvidence = domain.sourcePostFinalOwnerBoundConditionEvidence;

  const manifestCoherent = bridge.manifestId === domain.manifestId &&
    bridge.manifestCode === domain.manifestCode &&
    postOwnerEvidence.manifestId === domain.manifestId &&
    postOwnerEvidence.manifestCode === domain.manifestCode &&
    ownerEvidence.manifestId === domain.manifestId &&
    ownerEvidence.manifestCode === domain.manifestCode;

  const ownerBindingCoherent =
    terminalEnvelope.ownerBindingDefinitionAuthorityId ===
      domain.ownerBindingDefinitionAuthorityId &&
    postOwnerEvidence.ownerBindingDefinitionAuthorityId ===
      domain.ownerBindingDefinitionAuthorityId &&
    postOwnerEvidence.ownerBindingName === domain.ownerBindingName &&
    ownerEvidence.ownerBindingDefinitionAuthorityId ===
      domain.ownerBindingDefinitionAuthorityId &&
    ownerEvidence.ownerBindingName === domain.ownerBindingName;

  const postOwnerEvidenceIdentityCoherent =
    ownerEvidence.boundConditionDomainEvidenceId ===
      postOwnerEvidence.boundConditionDomainEvidenceId;

  const exactAssociationResolved = domain.associationState ===
    "resolved_exact_action_binding_provenance";

  const state: CanonicalRuntimeExecutionReadinessEvidenceStateV1 =
    manifestCoherent &&
      ownerBindingCoherent &&
      postOwnerEvidenceIdentityCoherent &&
      exactAssociationResolved
      ? "coherent_execution_readiness_evidence"
      : "unresolved_execution_readiness_evidence";

  return {
    id: evidenceId(bridge, domain),

    status: "candidate",

    state,

    manifestId: bridge.manifestId,
    manifestCode: bridge.manifestCode,

    structuralAuthorityId: bridge.structuralAuthorityId,

    ownerBindingDefinitionAuthorityId: domain.ownerBindingDefinitionAuthorityId,

    ownerBindingName: domain.ownerBindingName,

    snapshotIdentityId: terminalEnvelope.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId:
      terminalEnvelope.snapshotSentenceOccurrenceIdentityId,

    boundConditionDomainEvidenceId:
      postOwnerEvidence.boundConditionDomainEvidenceId,

    associatedDependencyActionAuthorityIds:
      domain.associatedDependencyActionAuthorityIds,

    associatedDependencyEndpointRoles: domain.associatedDependencyEndpointRoles,

    sourceActionCandidateBridge: bridge,

    sourceDependencyActionBindingAssociation: domain,

    governance: {
      exactActionCandidateBridgeRequired: true,
      exactDependencyActionBindingAssociationDomainRequired: true,

      exactManifestCoherenceRequired: true,
      exactOwnerBindingCoherenceRequired: true,
      exactPostOwnerEvidenceIdentityRequired: true,

      currentSnapshotIdentityPreserved: true,
      currentSentenceOccurrenceIdentityPreserved: true,

      finalWhereAuthorityPreservedTransitively: true,
      finalWhereTruthRecomputed: false,
      postOwnerEvidenceRecomputed: false,

      dependencyActionBindingProvenancePreserved: true,

      associationDomainsPreservedWithoutSelection: true,
      actionMultiplicityPreserved: true,
      actionSelected: false,
      singletonPromotedToWinner: false,

      executionReadinessEvidenceDerived: true,
      activationPermissionDerived: false,
      executableStateDerived: false,
      schedulableStateDerived: false,

      endpointDirectionResolved: false,
      endpointBindingPerformed: false,
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

function blocked(
  ...blockingReasons: string[]
): CanonicalRuntimeExecutionReadinessEvidenceBoundaryResultV1 {
  return {
    status: "blocked",
    evidence: [],
    blockingReasons: [...new Set(blockingReasons)].sort(),
    governance: {
      semanticFallbackUsed: false,
      associationDomainSelected: false,
      actionSelected: false,
      activationPermissionDerived: false,
      runtimeActionExecuted: false,
      graphMutationPerformed: false,
    },
  };
}

export function deriveCanonicalRuntimeExecutionReadinessEvidenceBoundaryV1(
  input: {
    actionCandidateBridge:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeResultV1;

    dependencyActionBindingAssociation:
      CanonicalRuntimeDependencyActionBindingAssociationBoundaryResultV1;
  },
): CanonicalRuntimeExecutionReadinessEvidenceBoundaryResultV1 {
  if (input.actionCandidateBridge.status !== "ready") {
    return blocked(
      "action_candidate_bridge_not_ready",
    );
  }

  if (input.dependencyActionBindingAssociation.status !== "ready") {
    return blocked(
      "dependency_action_binding_association_not_ready",
    );
  }

  const bridge = input.actionCandidateBridge.bridge;

  const evidence = input.dependencyActionBindingAssociation.domains.map(
    (domain) =>
      deriveCanonicalRuntimeExecutionReadinessEvidenceDomainV1(
        bridge,
        domain,
      ),
  );

  return {
    status: "ready",
    evidence,
    blockingReasons: [],
  };
}
