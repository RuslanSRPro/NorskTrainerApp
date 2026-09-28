import type {
  CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1,
  CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";

import type {
  CanonicalRuntimeExecutionReadinessEvidenceBoundaryV1,
} from "./canonical-runtime-execution-readiness-evidence-boundary-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingValueV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-final-runtime-binding-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_ENDPOINT_RESOLUTION_EVIDENCE_BOUNDARY_V1 =
  "late-v1.40:dependency-endpoint-resolution-evidence-boundary-v1" as const;

export type CanonicalRuntimeDependencyEndpointResolutionAssociationInputV1 =
  Pick<
    CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1,
    | "id"
    | "manifestId"
    | "manifestCode"
    | "associationState"
    | "associatedDependencyEndpointReferences"
    | "selectedDependencyActionAuthorityId"
    | "dependencyEndpointRole"
  >;

export type CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1 =
  & Pick<
    CanonicalRuntimeExecutionReadinessEvidenceBoundaryV1,
    | "id"
    | "state"
    | "manifestId"
    | "manifestCode"
    | "snapshotIdentityId"
    | "snapshotSentenceOccurrenceIdentityId"
  >
  & {
    sourceDependencyActionBindingAssociation:
      CanonicalRuntimeDependencyEndpointResolutionAssociationInputV1;
  };

export type CanonicalRuntimeDependencyEndpointResolutionFinalBindingInputV1 =
  Pick<
    CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingDomainV1,
    | "finalRuntimeBindingDomainId"
    | "manifestId"
    | "manifestCode"
    | "referencedBindingName"
    | "bindingDefinitionAuthorityId"
    | "snapshotIdentityId"
    | "snapshotSentenceOccurrenceIdentityId"
    | "bindingState"
    | "finalRuntimeBindingResolved"
    | "finalRuntimeBindingValue"
  >;

export type CanonicalRuntimeDependencyEndpointResolutionEvidenceStateV1 =
  | "resolved_exact_endpoint_binding_evidence"
  | "unresolved_endpoint_binding_evidence";

export type CanonicalRuntimeDependencyEndpointResolutionEvidenceV1 = {
  id: string;

  status: "candidate";

  state: CanonicalRuntimeDependencyEndpointResolutionEvidenceStateV1;

  manifestId: string;
  manifestCode: string;

  snapshotIdentityId: string;
  snapshotSentenceOccurrenceIdentityId: string;

  dependencyActionAuthorityId: string;

  authoredEndpointRole:
    CanonicalRuntimeDependencyActionBindingEndpointReferenceV1["endpointRole"];

  referencedBindingName: string;

  bindingDefinitionAuthorityId: string | null;

  sourceExecutionReadinessEvidence:
    CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1;

  sourceDependencyActionBindingAssociation: Pick<
    CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1,
    | "id"
    | "manifestId"
    | "manifestCode"
    | "associationState"
    | "associatedDependencyEndpointReferences"
    | "selectedDependencyActionAuthorityId"
    | "dependencyEndpointRole"
  >;

  sourceEndpointReference:
    CanonicalRuntimeDependencyActionBindingEndpointReferenceV1;

  sourceFinalRuntimeBindingDomain:
    | CanonicalRuntimeDependencyEndpointResolutionFinalBindingInputV1
    | null;

  sourceFinalRuntimeBindingValue:
    | CanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingValueV1
    | null;

  blockingReasons: readonly string[];

  governance: {
    coherentExecutionReadinessEvidenceRequired: true;

    exactManifestCoherenceRequired: true;
    exactCurrentSnapshotIdentityRequired: true;
    exactCurrentSentenceOccurrenceIdentityRequired: true;

    exactAuthoredEndpointReferencePreserved: true;
    exactReferencedBindingNameRequired: true;

    exactSingleFinalRuntimeBindingDomainRequired: true;
    boundFinalRuntimeBindingRequired: true;
    finalRuntimeBindingValueRequired: true;

    finalRuntimeBindingPreservedWithoutRecomputation: true;
    endpointReferencePreservedWithoutReinterpretation: true;

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

export type CanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryResultV1 =
  {
    status: "ready";

    evidence: CanonicalRuntimeDependencyEndpointResolutionEvidenceV1[];

    blockingReasons: [];
  };

function evidenceId(
  readiness: CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1,
  endpoint: CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
): string {
  return [
    "runtime-dependency-endpoint-resolution-evidence-boundary-v1",
    readiness.id,
    endpoint.dependencyActionAuthorityId,
    endpoint.endpointRole,
    endpoint.bindingName,
  ].join(":");
}

function exactFinalBindingMatches(
  readiness: CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1,
  endpoint: CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
  finalBindings:
    readonly CanonicalRuntimeDependencyEndpointResolutionFinalBindingInputV1[],
): CanonicalRuntimeDependencyEndpointResolutionFinalBindingInputV1[] {
  return finalBindings.filter(
    (binding) =>
      binding.manifestId === readiness.manifestId &&
      binding.manifestCode === readiness.manifestCode &&
      binding.snapshotIdentityId === readiness.snapshotIdentityId &&
      binding.snapshotSentenceOccurrenceIdentityId ===
        readiness.snapshotSentenceOccurrenceIdentityId &&
      binding.referencedBindingName === endpoint.bindingName,
  );
}

function unresolvedEvidence(
  readiness: CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1,
  endpoint: CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
  blockingReasons: readonly string[],
): CanonicalRuntimeDependencyEndpointResolutionEvidenceV1 {
  return {
    id: evidenceId(
      readiness,
      endpoint,
    ),

    status: "candidate",

    state: "unresolved_endpoint_binding_evidence",

    manifestId: readiness.manifestId,
    manifestCode: readiness.manifestCode,

    snapshotIdentityId: readiness.snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId:
      readiness.snapshotSentenceOccurrenceIdentityId,

    dependencyActionAuthorityId: endpoint.dependencyActionAuthorityId,

    authoredEndpointRole: endpoint.endpointRole,

    referencedBindingName: endpoint.bindingName,

    bindingDefinitionAuthorityId: null,

    sourceExecutionReadinessEvidence: readiness,

    sourceDependencyActionBindingAssociation:
      readiness.sourceDependencyActionBindingAssociation,

    sourceEndpointReference: endpoint,

    sourceFinalRuntimeBindingDomain: null,

    sourceFinalRuntimeBindingValue: null,

    blockingReasons,

    governance: governance(),
  };
}

function governance(): CanonicalRuntimeDependencyEndpointResolutionEvidenceV1[
  "governance"
] {
  return {
    coherentExecutionReadinessEvidenceRequired: true,

    exactManifestCoherenceRequired: true,
    exactCurrentSnapshotIdentityRequired: true,
    exactCurrentSentenceOccurrenceIdentityRequired: true,

    exactAuthoredEndpointReferencePreserved: true,
    exactReferencedBindingNameRequired: true,

    exactSingleFinalRuntimeBindingDomainRequired: true,
    boundFinalRuntimeBindingRequired: true,
    finalRuntimeBindingValueRequired: true,

    finalRuntimeBindingPreservedWithoutRecomputation: true,
    endpointReferencePreservedWithoutReinterpretation: true,

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
  };
}

function resolveEndpoint(
  readiness: CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1,
  endpoint: CanonicalRuntimeDependencyActionBindingEndpointReferenceV1,
  finalBindings:
    readonly CanonicalRuntimeDependencyEndpointResolutionFinalBindingInputV1[],
): CanonicalRuntimeDependencyEndpointResolutionEvidenceV1 {
  if (
    readiness.state !==
      "coherent_execution_readiness_evidence"
  ) {
    return unresolvedEvidence(
      readiness,
      endpoint,
      [
        "execution_readiness_evidence_not_coherent",
      ],
    );
  }

  const association = readiness.sourceDependencyActionBindingAssociation;

  if (
    association.manifestId !== readiness.manifestId ||
    association.manifestCode !== readiness.manifestCode
  ) {
    return unresolvedEvidence(
      readiness,
      endpoint,
      [
        "dependency_action_binding_association_manifest_mismatch",
      ],
    );
  }

  const matches = exactFinalBindingMatches(
    readiness,
    endpoint,
    finalBindings,
  );

  if (matches.length === 0) {
    return unresolvedEvidence(
      readiness,
      endpoint,
      [
        "exact_final_runtime_binding_missing",
      ],
    );
  }

  if (matches.length > 1) {
    return unresolvedEvidence(
      readiness,
      endpoint,
      [
        "exact_final_runtime_binding_ambiguous",
      ],
    );
  }

  const binding = matches[0];

  if (
    binding.bindingState !== "bound" ||
    binding.finalRuntimeBindingResolved !== true ||
    binding.finalRuntimeBindingValue === null
  ) {
    return unresolvedEvidence(
      readiness,
      endpoint,
      [
        "exact_final_runtime_binding_not_bound",
      ],
    );
  }

  const value = binding.finalRuntimeBindingValue;

  const valueCoherent = value.manifestId === binding.manifestId &&
    value.manifestCode === binding.manifestCode &&
    value.referencedBindingName ===
      binding.referencedBindingName &&
    value.bindingDefinitionAuthorityId ===
      binding.bindingDefinitionAuthorityId &&
    value.snapshotIdentityId ===
      binding.snapshotIdentityId &&
    value.snapshotSentenceOccurrenceIdentityId ===
      binding.snapshotSentenceOccurrenceIdentityId;

  if (!valueCoherent) {
    return unresolvedEvidence(
      readiness,
      endpoint,
      [
        "final_runtime_binding_value_identity_mismatch",
      ],
    );
  }

  return {
    id: evidenceId(
      readiness,
      endpoint,
    ),

    status: "candidate",

    state: "resolved_exact_endpoint_binding_evidence",

    manifestId: readiness.manifestId,
    manifestCode: readiness.manifestCode,

    snapshotIdentityId: readiness.snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId:
      readiness.snapshotSentenceOccurrenceIdentityId,

    dependencyActionAuthorityId: endpoint.dependencyActionAuthorityId,

    authoredEndpointRole: endpoint.endpointRole,

    referencedBindingName: endpoint.bindingName,

    bindingDefinitionAuthorityId: binding.bindingDefinitionAuthorityId,

    sourceExecutionReadinessEvidence: readiness,

    sourceDependencyActionBindingAssociation: association,

    sourceEndpointReference: endpoint,

    sourceFinalRuntimeBindingDomain: binding,

    sourceFinalRuntimeBindingValue: value,

    blockingReasons: [],

    governance: governance(),
  };
}

export function deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1(
  input: {
    executionReadinessEvidence:
      readonly CanonicalRuntimeDependencyEndpointResolutionReadinessInputV1[];

    finalRuntimeBindings:
      readonly CanonicalRuntimeDependencyEndpointResolutionFinalBindingInputV1[];
  },
): CanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryResultV1 {
  const evidence: CanonicalRuntimeDependencyEndpointResolutionEvidenceV1[] = [];

  for (const readiness of input.executionReadinessEvidence) {
    const association = readiness.sourceDependencyActionBindingAssociation;

    for (
      const endpoint of association.associatedDependencyEndpointReferences
    ) {
      evidence.push(
        resolveEndpoint(
          readiness,
          endpoint,
          input.finalRuntimeBindings,
        ),
      );
    }
  }

  evidence.sort(
    (a, b) =>
      a.manifestId.localeCompare(b.manifestId) ||
      a.snapshotIdentityId.localeCompare(
        b.snapshotIdentityId,
      ) ||
      a.snapshotSentenceOccurrenceIdentityId.localeCompare(
        b.snapshotSentenceOccurrenceIdentityId,
      ) ||
      a.dependencyActionAuthorityId.localeCompare(
        b.dependencyActionAuthorityId,
      ) ||
      a.authoredEndpointRole.localeCompare(
        b.authoredEndpointRole,
      ) ||
      a.referencedBindingName.localeCompare(
        b.referencedBindingName,
      ),
  );

  return {
    status: "ready",
    evidence,
    blockingReasons: [],
  };
}
