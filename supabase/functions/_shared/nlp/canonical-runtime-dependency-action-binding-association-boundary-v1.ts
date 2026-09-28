import type {
  CanonicalDependencyRuntimeActionAuthorityV1,
} from "./canonical-dependency-runtime-authority-v1.ts";

import type {
  CanonicalRuntimeBindingDefinitionAuthorityV1,
} from "./canonical-runtime-binding-definition-authority-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_ACTION_BINDING_ASSOCIATION_BOUNDARY_V1 =
  "late-v1.40:dependency-action-binding-association-boundary-v1" as const;

export type CanonicalRuntimeDependencyActionBindingAssociationStateV1 =
  | "resolved_exact_action_binding_provenance"
  | "unresolved_no_exact_action_binding_provenance";
export type CanonicalRuntimeDependencyActionBindingAssociationOwnerEvidenceV1 =
  {
    boundConditionDomainEvidenceId: string;
    manifestId: string;
    manifestCode: string;
    ownerBindingDefinitionAuthorityId: string;
    ownerBindingName: string;

    sourceBindingDefinitionAuthority?:
      CanonicalRuntimeBindingDefinitionAuthorityV1;
  };

export type CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1 =
  {
    id: string;
    status: "candidate";

    manifestId: string;
    manifestCode: string;

    ownerBindingDefinitionAuthorityId: string;
    ownerBindingName: string;

    associationState: CanonicalRuntimeDependencyActionBindingAssociationStateV1;

    dependencyActionCandidates:
      readonly CanonicalDependencyRuntimeActionAuthorityV1[];

    bindingDefinitionCandidates:
      readonly CanonicalRuntimeBindingDefinitionAuthorityV1[];

    associatedDependencyActionAuthorityIds: readonly string[];

    associatedDependencyEndpointRoles: readonly (
      | "source"
      | "target"
    )[];

    selectedDependencyActionAuthorityId: null;
    dependencyEndpointRole: null;

    sourcePostFinalOwnerBoundConditionEvidence:
      CanonicalRuntimeDependencyActionBindingAssociationOwnerEvidenceV1;

    governance: {
      exactPostFinalOwnerEvidenceRequired: true;
      manifestCoherenceRequired: true;
      dependencyActionCandidatesPreservedWithoutSelection: true;
      bindingDefinitionCandidatesPreservedWithoutSelection: true;
      supportingDependencyAuthorityIdsNotUsedAsBindingSpecificProof: true;
      singletonCandidateNotPromotedToAuthority: true;
      actionTargetPreservedOpaque: true;
      actionValuePreservedOpaque: true;
      relationPreservedOpaque: true;
      exactActionBindingAssociationResolved: boolean;
      endpointReferenceIdentityResolved: boolean;
      endpointDirectionResolved: false;
      endpointBindingPerformed: false;
      dependencySemanticsResolved: false;
      canonicalEdgeGenerated: false;
      activationReadinessResolved: false;
      productionActivationAssumed: false;
      runtimeBindingExecuted: false;
      runtimeConditionTruthResolved: false;
      bindingTruthResolved: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;
      candidateOnly: true;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeDependencyActionBindingAssociationBoundaryResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_DEPENDENCY_ACTION_BINDING_ASSOCIATION_BOUNDARY_V1;
    producerVersion: "1";
    status: "ready" | "blocked";
    domains:
      CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1[];
    blockingReasons: string[];
  };

function unique(
  values: readonly string[],
): string[] {
  return [...new Set(values)].sort();
}

function uniqueEndpointRoles(
  values: readonly (
    | "source"
    | "target"
  )[],
): (
  | "source"
  | "target"
)[] {
  return [...new Set(values)].sort();
}

function stringValue(
  value: unknown,
): string | undefined {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  const trimmed = value.trim();

  return (
    trimmed ||
    undefined
  );
}

type DependencyEndpointReferenceV1 = {
  dependencyActionAuthorityId: string;
  endpointRole:
    | "source"
    | "target";
  bindingName: string;
};

function dependencyEndpointReferences(
  authority: CanonicalDependencyRuntimeActionAuthorityV1,
): DependencyEndpointReferenceV1[] {
  const value = authority.actionValue;

  if (!value) {
    return [];
  }

  const references: DependencyEndpointReferenceV1[] = [];

  const sourceRef = stringValue(
    value.source_ref,
  );

  if (sourceRef) {
    references.push({
      dependencyActionAuthorityId: authority.id,
      endpointRole: "source",
      bindingName: sourceRef,
    });
  }

  const targetRef = stringValue(
    value.target_ref,
  );

  if (targetRef) {
    references.push({
      dependencyActionAuthorityId: authority.id,
      endpointRole: "target",
      bindingName: targetRef,
    });
  }

  return references;
}

export function deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
  dependencyAuthorities: readonly CanonicalDependencyRuntimeActionAuthorityV1[],
  bindingAuthorities: readonly CanonicalRuntimeBindingDefinitionAuthorityV1[],
  postFinalOwnerEvidence:
    readonly CanonicalRuntimeDependencyActionBindingAssociationOwnerEvidenceV1[],
): CanonicalRuntimeDependencyActionBindingAssociationBoundaryResultV1 {
  const blockingReasons: string[] = [];
  const domains:
    CanonicalRuntimeDependencyActionBindingAssociationBoundaryDomainV1[] = [];

  const dependencyIds = new Set<string>();
  for (const authority of dependencyAuthorities) {
    if (dependencyIds.has(authority.id)) {
      blockingReasons.push(
        `dependency_authority:${authority.id}:duplicate`,
      );
    }
    dependencyIds.add(authority.id);
  }

  const bindingIds = new Set<string>();
  for (const authority of bindingAuthorities) {
    if (bindingIds.has(authority.id)) {
      blockingReasons.push(
        `binding_authority:${authority.id}:duplicate`,
      );
    }
    bindingIds.add(authority.id);
  }

  const ownerDomainIds = new Set<string>();

  for (const source of postFinalOwnerEvidence) {
    if (ownerDomainIds.has(source.boundConditionDomainEvidenceId)) {
      blockingReasons.push(
        `post_final_owner_domain:${source.boundConditionDomainEvidenceId}:duplicate`,
      );
      continue;
    }

    ownerDomainIds.add(source.boundConditionDomainEvidenceId);

    const dependencyActionCandidates = dependencyAuthorities
      .filter(
        (authority) =>
          authority.manifestId === source.manifestId &&
          authority.manifestCode === source.manifestCode,
      )
      .sort(
        (a, b) => a.id.localeCompare(b.id),
      );

    const bindingDefinitionCandidates = bindingAuthorities
      .filter(
        (authority) =>
          authority.manifestId === source.manifestId &&
          authority.manifestCode === source.manifestCode,
      )
      .sort(
        (a, b) => a.id.localeCompare(b.id),
      );

    const provenSourceBindingDefinitionAuthority =
      source.sourceBindingDefinitionAuthority;

    const exactOwnerBinding = provenSourceBindingDefinitionAuthority
      ? bindingDefinitionCandidates.filter(
        (authority) =>
          authority === provenSourceBindingDefinitionAuthority &&
          authority.manifestId === source.manifestId &&
          authority.manifestCode === source.manifestCode &&
          authority.bindingName === source.ownerBindingName,
      )
      : bindingDefinitionCandidates.filter(
        (authority) =>
          authority.id ===
            source.ownerBindingDefinitionAuthorityId &&
          authority.bindingName ===
            source.ownerBindingName,
      );

    if (exactOwnerBinding.length !== 1) {
      blockingReasons.push(
        `post_final_owner_domain:${source.boundConditionDomainEvidenceId}:exact_owner_binding_definition_missing_or_ambiguous`,
      );
      continue;
    }

    const exactEndpointReferences = dependencyActionCandidates
      .flatMap(
        dependencyEndpointReferences,
      )
      .filter(
        (reference) =>
          reference.bindingName ===
            source.ownerBindingName,
      )
      .sort(
        (a, b) =>
          a.dependencyActionAuthorityId.localeCompare(
            b.dependencyActionAuthorityId,
          ) ||
          a.endpointRole.localeCompare(
            b.endpointRole,
          ),
      );

    const associatedDependencyActionAuthorityIds = unique(
      exactEndpointReferences.map(
        (reference) => reference.dependencyActionAuthorityId,
      ),
    );

    const associatedDependencyEndpointRoles = uniqueEndpointRoles(
      exactEndpointReferences.map(
        (reference) => reference.endpointRole,
      ),
    );

    const exactActionBindingAssociationResolved =
      exactEndpointReferences.length > 0;

    domains.push({
      id: [
        "runtime-dependency-action-binding-association-boundary-v1",
        source.boundConditionDomainEvidenceId,
      ].join(":"),

      status: "candidate",

      manifestId: source.manifestId,

      manifestCode: source.manifestCode,

      ownerBindingDefinitionAuthorityId:
        source.ownerBindingDefinitionAuthorityId,

      ownerBindingName: source.ownerBindingName,

      associationState: exactActionBindingAssociationResolved
        ? "resolved_exact_action_binding_provenance"
        : "unresolved_no_exact_action_binding_provenance",

      dependencyActionCandidates,
      bindingDefinitionCandidates,

      associatedDependencyActionAuthorityIds,

      associatedDependencyEndpointRoles,

      selectedDependencyActionAuthorityId: null,

      dependencyEndpointRole: null,

      sourcePostFinalOwnerBoundConditionEvidence: source,

      governance: {
        exactPostFinalOwnerEvidenceRequired: true,
        manifestCoherenceRequired: true,
        dependencyActionCandidatesPreservedWithoutSelection: true,
        bindingDefinitionCandidatesPreservedWithoutSelection: true,
        supportingDependencyAuthorityIdsNotUsedAsBindingSpecificProof: true,
        singletonCandidateNotPromotedToAuthority: true,
        actionTargetPreservedOpaque: true,
        actionValuePreservedOpaque: true,
        relationPreservedOpaque: true,
        exactActionBindingAssociationResolved:
          exactActionBindingAssociationResolved,
        endpointReferenceIdentityResolved:
          exactActionBindingAssociationResolved,
        endpointDirectionResolved: false,
        endpointBindingPerformed: false,
        dependencySemanticsResolved: false,
        canonicalEdgeGenerated: false,
        activationReadinessResolved: false,
        productionActivationAssumed: false,
        runtimeBindingExecuted: false,
        runtimeConditionTruthResolved: false,
        bindingTruthResolved: false,
        learnerErrorClassified: false,
        graphMutationPerformed: false,
        candidateOnly: true,
        frozenGrammarReadOnly: true,
      },
    });
  }

  const reasons = unique(blockingReasons);

  if (reasons.length > 0) {
    return {
      producer:
        CANONICAL_RUNTIME_DEPENDENCY_ACTION_BINDING_ASSOCIATION_BOUNDARY_V1,
      producerVersion: "1",
      status: "blocked",
      domains: [],
      blockingReasons: reasons,
    };
  }

  return {
    producer:
      CANONICAL_RUNTIME_DEPENDENCY_ACTION_BINDING_ASSOCIATION_BOUNDARY_V1,
    producerVersion: "1",
    status: "ready",
    domains: domains.sort(
      (a, b) => a.id.localeCompare(b.id),
    ),
    blockingReasons: [],
  };
}
