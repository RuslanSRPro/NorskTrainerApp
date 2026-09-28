import {
  CANONICAL_RUNTIME_DEPENDENCY_ACTION_BINDING_ASSOCIATION_BOUNDARY_V1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";

Deno.test(
  "dependency action binding association boundary: contract preserves unresolved association without endpoint invention",
  () => {
    if (
      CANONICAL_RUNTIME_DEPENDENCY_ACTION_BINDING_ASSOCIATION_BOUNDARY_V1 !==
        "late-v1.40:dependency-action-binding-association-boundary-v1"
    ) {
      throw new Error(
        "unexpected producer contract",
      );
    }
  },
);

Deno.test(
  "dependency action binding association boundary: source forbids semantic promotion shortcuts",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts",
        import.meta.url,
      ),
    );

    const required = [
      '"unresolved_no_exact_action_binding_provenance"',
      "selectedDependencyActionAuthorityId: null",
      "dependencyEndpointRole: null",
      "supportingDependencyAuthorityIdsNotUsedAsBindingSpecificProof: true",
      "singletonCandidateNotPromotedToAuthority: true",
      "exactActionBindingAssociationResolved: boolean",
      "endpointReferenceIdentityResolved: boolean",
      "selectedDependencyActionAuthorityId: null",
      "dependencyEndpointRole: null",
      "endpointDirectionResolved: false",
      "endpointBindingPerformed: false",
      "dependencySemanticsResolved: false",
      "canonicalEdgeGenerated: false",
      "activationReadinessResolved: false",
      "productionActivationAssumed: false",
      "runtimeBindingExecuted: false",
      "runtimeConditionTruthResolved: false",
      "bindingTruthResolved: false",
      "learnerErrorClassified: false",
      "graphMutationPerformed: false",
      "candidateOnly: true",
      "frozenGrammarReadOnly: true",
    ];

    for (const needle of required) {
      if (!source.includes(needle)) {
        throw new Error(
          `missing required contract marker: ${needle}`,
        );
      }
    }

    const forbidden = [
      "as unknown as",
      "as any",
      ": any",
      "<any>",
    ];

    for (const needle of forbidden) {
      if (source.includes(needle)) {
        throw new Error(
          `forbidden production shortcut: ${needle}`,
        );
      }
    }
  },
);

import { assertEquals, assertStrictEquals } from "jsr:@std/assert";

import {
  deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";
import type {
  CanonicalRuntimeDependencyActionBindingAssociationOwnerEvidenceV1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";

import type {
  CanonicalDependencyRuntimeActionAuthorityV1,
} from "./canonical-dependency-runtime-authority-v1.ts";

import type {
  CanonicalRuntimeBindingDefinitionAuthorityV1,
} from "./canonical-runtime-binding-definition-authority-v1.ts";

function behavioralDependencyAuthority(
  id: string,
  manifestId = "manifest-id-1",
  manifestCode = "manifest-code-1",
): CanonicalDependencyRuntimeActionAuthorityV1 {
  return {
    id,
    status: "candidate",
    manifestId,
    manifestCode,
    runtimeFamily: "token_pos",
    executionPhase: "runtime",
    constraintStrength: null,
    actionIndex: id.endsWith("-2") ? 1 : 0,
    relation: "opaque",
    actionTarget: "opaque",
    actionValue: null,
    reasonCode: null,
    sourceCandidateCodes: [],
    governance: {
      validatedManifestRequired: true,
      createDependencyActionRequired: true,
      relationPreservedOpaque: true,
      actionTargetPreservedOpaque: true,
      actionValuePreservedOpaque: true,
      executionPhasePreservedOpaque: true,
      runtimeFamilyPreservedOpaque: true,
      endpointDirectionResolved: false,
      endpointBindingPerformed: false,
      dependencySemanticsResolved: false,
      canonicalEdgeGenerated: false,
      alternativeSetGenerated: false,
      productionActivationAssumed: false,
      manifestMutationPerformed: false,
      candidateOnly: true,
      frozenGrammarReadOnly: true,
    },
  };
}

function behavioralBindingAuthority(
  id = "runtime-binding-definition-authority-v1:manifest-code-1:owner",
  bindingName = "owner",
  manifestId = "manifest-id-1",
  manifestCode = "manifest-code-1",
): CanonicalRuntimeBindingDefinitionAuthorityV1 {
  return {
    id,
    status: "candidate",
    manifestId,
    manifestCode,
    runtimeFamily: "token_pos",
    executionPhase: "runtime",
    bindingName,
    bindingDefinition: {
      entity: "token",
      scope: "sentence",
      cardinality: "one",
    },
    entityLabel: "token",
    scopeLabel: "sentence",
    cardinalityLabel: "one",
    whereClause: null,
    topLevelWhereOperator: null,
    supportingDependencyAuthorityIds: [
      "dependency-authority-1",
    ],
    governance: {
      exactValidatedManifestRequired: true,
      exactA0DependencyAuthorityRequired: true,
      bindingNamePreservedOpaque: true,
      bindingDefinitionPreservedOpaque: true,
      entityLabelPreservedOpaque: true,
      scopeLabelPreservedOpaque: true,
      cardinalityLabelPreservedOpaque: true,
      whereClausePreservedOpaque: true,
      whereOperatorPreservedOpaque: true,
      entitySemanticsResolved: false,
      scopeSemanticsResolved: false,
      cardinalitySemanticsResolved: false,
      whereSemanticsResolved: false,
      referenceSemanticsResolved: false,
      occurrenceEnumerationPerformed: false,
      occurrenceBindingPerformed: false,
      endpointRoleResolved: false,
      dependencyDirectionResolved: false,
      dependencySemanticsResolved: false,
      canonicalEdgeGenerated: false,
      grammaticalFunctionResolved: false,
      complementArgumentAttachmentResolved: false,
      realizesSlotGenerated: false,
      productionActivationAssumed: false,
      candidateOnly: true,
      frozenGrammarReadOnly: true,
    },
  };
}

function behavioralPostFinalEvidence(
  ownerBindingDefinitionAuthorityId =
    "runtime-binding-definition-authority-v1:manifest-code-1:owner",
  ownerBindingName = "owner",
): CanonicalRuntimeDependencyActionBindingAssociationOwnerEvidenceV1 {
  return {
    boundConditionDomainEvidenceId: "bound-condition-domain-evidence-1",
    manifestId: "manifest-id-1",
    manifestCode: "manifest-code-1",
    ownerBindingDefinitionAuthorityId,
    ownerBindingName,
  };
}
Deno.test("dependency action binding association boundary: singleton action remains unresolved without authority promotion", () => {
  const dependency = behavioralDependencyAuthority(
    "dependency-authority-1",
  );
  const binding = behavioralBindingAuthority();
  const evidence = behavioralPostFinalEvidence();

  const result =
    deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
      [dependency],
      [binding],
      [evidence],
    );

  assertEquals(result.status, "ready");
  assertEquals(result.blockingReasons, []);
  assertEquals(result.domains.length, 1);

  const domain = result.domains[0];

  assertEquals(
    domain.associationState,
    "unresolved_no_exact_action_binding_provenance",
  );
  assertEquals(domain.dependencyActionCandidates.length, 1);
  assertStrictEquals(domain.dependencyActionCandidates[0], dependency);
  assertEquals(domain.bindingDefinitionCandidates.length, 1);
  assertStrictEquals(domain.bindingDefinitionCandidates[0], binding);
  assertEquals(domain.selectedDependencyActionAuthorityId, null);
  assertEquals(domain.dependencyEndpointRole, null);
  assertStrictEquals(
    domain.sourcePostFinalOwnerBoundConditionEvidence,
    evidence,
  );
  assertEquals(
    domain.governance.singletonCandidateNotPromotedToAuthority,
    true,
  );
  assertEquals(
    domain.governance.exactActionBindingAssociationResolved,
    false,
  );
  assertEquals(domain.governance.endpointDirectionResolved, false);
  assertEquals(domain.governance.endpointBindingPerformed, false);
  assertEquals(domain.governance.productionActivationAssumed, false);
  assertEquals(domain.governance.runtimeBindingExecuted, false);
});

Deno.test("dependency action binding association boundary: multiple actions remain ordered candidates without winner selection", () => {
  const dependencyB = behavioralDependencyAuthority(
    "dependency-authority-2",
  );
  const dependencyA = behavioralDependencyAuthority(
    "dependency-authority-1",
  );

  const result =
    deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
      [dependencyB, dependencyA],
      [behavioralBindingAuthority()],
      [behavioralPostFinalEvidence()],
    );

  assertEquals(result.status, "ready");
  assertEquals(result.domains.length, 1);

  const domain = result.domains[0];

  assertEquals(
    domain.dependencyActionCandidates.map((candidate) => candidate.id),
    [
      "dependency-authority-1",
      "dependency-authority-2",
    ],
  );
  assertEquals(
    domain.associationState,
    "unresolved_no_exact_action_binding_provenance",
  );
  assertEquals(domain.selectedDependencyActionAuthorityId, null);
  assertEquals(domain.dependencyEndpointRole, null);
});

Deno.test("dependency action binding association boundary: manifest coherence excludes foreign action and binding candidates", () => {
  const localDependency = behavioralDependencyAuthority(
    "dependency-authority-1",
  );
  const foreignDependency = behavioralDependencyAuthority(
    "dependency-authority-foreign",
    "manifest-id-foreign",
    "manifest-code-foreign",
  );

  const localBinding = behavioralBindingAuthority();
  const foreignBinding = behavioralBindingAuthority(
    "runtime-binding-definition-authority-v1:manifest-code-foreign:foreign",
    "foreign",
    "manifest-id-foreign",
    "manifest-code-foreign",
  );

  const result =
    deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
      [foreignDependency, localDependency],
      [foreignBinding, localBinding],
      [behavioralPostFinalEvidence()],
    );

  assertEquals(result.status, "ready");
  assertEquals(result.domains.length, 1);

  const domain = result.domains[0];

  assertEquals(
    domain.dependencyActionCandidates.map((candidate) => candidate.id),
    ["dependency-authority-1"],
  );
  assertEquals(
    domain.bindingDefinitionCandidates.map((candidate) => candidate.id),
    [
      "runtime-binding-definition-authority-v1:manifest-code-1:owner",
    ],
  );
  assertEquals(domain.selectedDependencyActionAuthorityId, null);
});

Deno.test("dependency action binding association boundary: missing exact OWNER binding blocks without partial domain", () => {
  const result =
    deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
      [behavioralDependencyAuthority("dependency-authority-1")],
      [
        behavioralBindingAuthority(
          "runtime-binding-definition-authority-v1:manifest-code-1:other",
          "other",
        ),
      ],
      [behavioralPostFinalEvidence()],
    );

  assertEquals(result.status, "blocked");
  assertEquals(result.domains, []);
  assertEquals(
    result.blockingReasons,
    [
      "post_final_owner_domain:bound-condition-domain-evidence-1:exact_owner_binding_definition_missing_or_ambiguous",
    ],
  );
});

Deno.test(
  "existing proven canonical OWNER binding authority is reused by exact object identity without ID reconstruction",
  () => {
    const dependency = behavioralDependencyAuthority(
      "dependency-authority-existing-proven-owner-reuse",
    );

    dependency.actionValue = {
      source_ref: "owner",
      target_ref: "other",
    };

    const binding = behavioralBindingAuthority();

    const evidence:
      CanonicalRuntimeDependencyActionBindingAssociationOwnerEvidenceV1 = {
        ...behavioralPostFinalEvidence(
          "runtime-manifest-binding-definition-v1:manifest-code-1:owner",
          "owner",
        ),
        sourceBindingDefinitionAuthority: binding,
      };

    const result =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        [dependency],
        [binding],
        [evidence],
      );

    assertEquals(result.status, "ready");
    assertEquals(result.blockingReasons, []);
    assertEquals(result.domains.length, 1);

    const domain = result.domains[0];

    assertEquals(
      domain.associationState,
      "resolved_exact_action_binding_provenance",
    );

    assertEquals(
      domain.ownerBindingDefinitionAuthorityId,
      "runtime-manifest-binding-definition-v1:manifest-code-1:owner",
    );

    assertEquals(
      domain.associatedDependencyActionAuthorityIds,
      [dependency.id],
    );

    assertEquals(
      domain.associatedDependencyEndpointRoles,
      ["source"],
    );

    assertStrictEquals(
      domain.bindingDefinitionCandidates[0],
      binding,
    );

    assertStrictEquals(
      domain.sourcePostFinalOwnerBoundConditionEvidence,
      evidence,
    );

    assertStrictEquals(
      evidence.sourceBindingDefinitionAuthority,
      binding,
    );

    assertEquals(
      domain.selectedDependencyActionAuthorityId,
      null,
    );

    assertEquals(
      domain.dependencyEndpointRole,
      null,
    );

    assertEquals(
      domain.governance.endpointDirectionResolved,
      false,
    );

    assertEquals(
      domain.governance.endpointBindingPerformed,
      false,
    );

    assertEquals(
      domain.governance.dependencySemanticsResolved,
      false,
    );

    assertEquals(
      domain.governance.activationReadinessResolved,
      false,
    );

    assertEquals(
      domain.governance.runtimeBindingExecuted,
      false,
    );

    assertEquals(
      domain.governance.graphMutationPerformed,
      false,
    );
  },
);

Deno.test(
  "proven OWNER authority reference fails closed when it is not an exact member of canonical binding candidates",
  () => {
    const dependency = behavioralDependencyAuthority(
      "dependency-authority-foreign-proven-owner-reference",
    );

    dependency.actionValue = {
      source_ref: "owner",
      target_ref: "other",
    };

    const binding = behavioralBindingAuthority();

    const foreignBindingObject = behavioralBindingAuthority();

    const evidence:
      CanonicalRuntimeDependencyActionBindingAssociationOwnerEvidenceV1 = {
        ...behavioralPostFinalEvidence(
          "runtime-manifest-binding-definition-v1:manifest-code-1:owner",
          "owner",
        ),
        sourceBindingDefinitionAuthority: foreignBindingObject,
      };

    const result =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        [dependency],
        [binding],
        [evidence],
      );

    assertEquals(result.status, "blocked");
    assertEquals(result.domains, []);

    assertEquals(
      result.blockingReasons,
      [
        "post_final_owner_domain:bound-condition-domain-evidence-1:exact_owner_binding_definition_missing_or_ambiguous",
      ],
    );
  },
);
Deno.test(
  "A2.12.7 exact source endpoint association is resolved without action selection or endpoint execution",
  () => {
    const dependency = behavioralDependencyAuthority(
      "dependency-authority-a2127-source",
    );

    dependency.actionTarget = "opaque-action-target";

    dependency.actionValue = {
      source_ref: "owner",
      target_ref: "other",
    };

    const binding = behavioralBindingAuthority();

    const evidence = behavioralPostFinalEvidence();

    const result =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        [dependency],
        [binding],
        [evidence],
      );

    assertEquals(result.status, "ready");
    assertEquals(result.blockingReasons, []);
    assertEquals(result.domains.length, 1);

    const domain = result.domains[0];

    assertEquals(
      domain.associationState,
      "resolved_exact_action_binding_provenance",
    );

    assertEquals(
      domain.associatedDependencyActionAuthorityIds,
      [dependency.id],
    );

    assertEquals(
      domain.associatedDependencyEndpointRoles,
      ["source"],
    );

    assertEquals(
      domain.selectedDependencyActionAuthorityId,
      null,
    );

    assertEquals(
      domain.dependencyEndpointRole,
      null,
    );

    assertEquals(
      domain.governance.exactActionBindingAssociationResolved,
      true,
    );

    assertEquals(
      domain.governance.endpointReferenceIdentityResolved,
      true,
    );

    assertEquals(
      domain.governance.endpointDirectionResolved,
      false,
    );

    assertEquals(
      domain.governance.endpointBindingPerformed,
      false,
    );

    assertEquals(
      domain.governance.dependencySemanticsResolved,
      false,
    );

    assertEquals(
      domain.governance.canonicalEdgeGenerated,
      false,
    );

    assertEquals(
      domain.governance.graphMutationPerformed,
      false,
    );

    assertStrictEquals(
      domain.dependencyActionCandidates[0],
      dependency,
    );

    assertStrictEquals(
      domain.bindingDefinitionCandidates[0],
      binding,
    );

    assertStrictEquals(
      domain.sourcePostFinalOwnerBoundConditionEvidence,
      evidence,
    );
  },
);

Deno.test(
  "A2.12.7 target endpoint association is independent of action target",
  () => {
    const dependency = behavioralDependencyAuthority(
      "dependency-authority-a2127-target",
    );

    dependency.actionTarget = "owner";

    dependency.actionValue = {
      source_ref: "other",
      target_ref: "owner",
    };

    const binding = behavioralBindingAuthority();

    const evidence = behavioralPostFinalEvidence();

    const result =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        [dependency],
        [binding],
        [evidence],
      );

    assertEquals(result.status, "ready");
    assertEquals(result.domains.length, 1);

    const domain = result.domains[0];

    assertEquals(
      domain.associationState,
      "resolved_exact_action_binding_provenance",
    );

    assertEquals(
      domain.associatedDependencyActionAuthorityIds,
      [dependency.id],
    );

    assertEquals(
      domain.associatedDependencyEndpointRoles,
      ["target"],
    );

    assertEquals(
      domain.selectedDependencyActionAuthorityId,
      null,
    );

    assertEquals(
      domain.dependencyEndpointRole,
      null,
    );

    assertEquals(
      domain.governance.actionTargetPreservedOpaque,
      true,
    );

    assertEquals(
      domain.governance.endpointReferenceIdentityResolved,
      true,
    );

    assertEquals(
      domain.governance.endpointDirectionResolved,
      false,
    );

    assertEquals(
      domain.governance.endpointBindingPerformed,
      false,
    );

    assertEquals(
      domain.governance.canonicalEdgeGenerated,
      false,
    );

    assertEquals(
      domain.governance.graphMutationPerformed,
      false,
    );
  },
);

Deno.test(
  "A2.12.7 invalid endpoint refs fail closed without fabricated provenance",
  () => {
    const dependency = behavioralDependencyAuthority(
      "dependency-authority-a2127-invalid",
    );

    dependency.actionTarget = "owner";

    dependency.actionValue = {
      source_ref: 7,
      target_ref: null,
    };

    const binding = behavioralBindingAuthority();

    const evidence = behavioralPostFinalEvidence();

    const result =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        [dependency],
        [binding],
        [evidence],
      );

    assertEquals(result.status, "ready");
    assertEquals(result.domains.length, 1);

    const domain = result.domains[0];

    assertEquals(
      domain.associationState,
      "unresolved_no_exact_action_binding_provenance",
    );

    assertEquals(
      domain.associatedDependencyActionAuthorityIds,
      [],
    );

    assertEquals(
      domain.associatedDependencyEndpointRoles,
      [],
    );

    assertEquals(
      domain.governance.exactActionBindingAssociationResolved,
      false,
    );

    assertEquals(
      domain.governance.endpointReferenceIdentityResolved,
      false,
    );

    assertEquals(
      domain.selectedDependencyActionAuthorityId,
      null,
    );

    assertEquals(
      domain.dependencyEndpointRole,
      null,
    );

    assertEquals(
      domain.governance.endpointDirectionResolved,
      false,
    );

    assertEquals(
      domain.governance.endpointBindingPerformed,
      false,
    );

    assertEquals(
      domain.governance.dependencySemanticsResolved,
      false,
    );

    assertEquals(
      domain.governance.canonicalEdgeGenerated,
      false,
    );

    assertEquals(
      domain.governance.graphMutationPerformed,
      false,
    );
  },
);

Deno.test(
  "A2.12.8 same action may preserve both endpoint reference roles without resolving executable direction",
  () => {
    const dependency = behavioralDependencyAuthority(
      "dependency-authority-a2128-both-roles",
    );

    dependency.actionTarget = "opaque-action-target";

    dependency.actionValue = {
      source_ref: "owner",
      target_ref: "owner",
    };

    const binding = behavioralBindingAuthority();

    const evidence = behavioralPostFinalEvidence();

    const result =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        [dependency],
        [binding],
        [evidence],
      );

    assertEquals(
      result.status,
      "ready",
    );

    assertEquals(
      result.blockingReasons,
      [],
    );

    assertEquals(
      result.domains.length,
      1,
    );

    const domain = result.domains[0];

    assertEquals(
      domain.associationState,
      "resolved_exact_action_binding_provenance",
    );

    assertEquals(
      domain.associatedDependencyActionAuthorityIds,
      [
        dependency.id,
      ],
    );

    assertEquals(
      domain.associatedDependencyEndpointRoles,
      [
        "source",
        "target",
      ],
    );

    assertEquals(
      domain.selectedDependencyActionAuthorityId,
      null,
    );

    assertEquals(
      domain.dependencyEndpointRole,
      null,
    );

    assertEquals(
      domain.governance.exactActionBindingAssociationResolved,
      true,
    );

    assertEquals(
      domain.governance.endpointReferenceIdentityResolved,
      true,
    );

    assertEquals(
      domain.governance.endpointDirectionResolved,
      false,
    );

    assertEquals(
      domain.governance.endpointBindingPerformed,
      false,
    );

    assertEquals(
      domain.governance.dependencySemanticsResolved,
      false,
    );

    assertEquals(
      domain.governance.canonicalEdgeGenerated,
      false,
    );

    assertEquals(
      domain.governance.activationReadinessResolved,
      false,
    );

    assertEquals(
      domain.governance.runtimeBindingExecuted,
      false,
    );

    assertEquals(
      domain.governance.graphMutationPerformed,
      false,
    );
  },
);

Deno.test(
  "A2.12.8 multiple exact actions preserve provenance without winner selection",
  () => {
    const dependencyB = behavioralDependencyAuthority(
      "dependency-authority-a2128-2",
    );

    dependencyB.actionValue = {
      source_ref: "owner",
      target_ref: "other",
    };

    const dependencyA = behavioralDependencyAuthority(
      "dependency-authority-a2128-1",
    );

    dependencyA.actionValue = {
      source_ref: "other",
      target_ref: "owner",
    };

    const binding = behavioralBindingAuthority();

    const evidence = behavioralPostFinalEvidence();

    const result =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        [
          dependencyB,
          dependencyA,
        ],
        [binding],
        [evidence],
      );

    assertEquals(
      result.status,
      "ready",
    );

    assertEquals(
      result.blockingReasons,
      [],
    );

    assertEquals(
      result.domains.length,
      1,
    );

    const domain = result.domains[0];

    assertEquals(
      domain.associationState,
      "resolved_exact_action_binding_provenance",
    );

    assertEquals(
      domain.associatedDependencyActionAuthorityIds,
      [
        dependencyA.id,
        dependencyB.id,
      ],
    );

    assertEquals(
      domain.associatedDependencyEndpointRoles,
      [
        "source",
        "target",
      ],
    );

    assertEquals(
      domain.dependencyActionCandidates.map(
        (candidate) => candidate.id,
      ),
      [
        dependencyA.id,
        dependencyB.id,
      ],
    );

    assertEquals(
      domain.selectedDependencyActionAuthorityId,
      null,
    );

    assertEquals(
      domain.dependencyEndpointRole,
      null,
    );

    assertEquals(
      domain.governance.singletonCandidateNotPromotedToAuthority,
      true,
    );

    assertEquals(
      domain.governance.exactActionBindingAssociationResolved,
      true,
    );

    assertEquals(
      domain.governance.endpointReferenceIdentityResolved,
      true,
    );

    assertEquals(
      domain.governance.endpointDirectionResolved,
      false,
    );

    assertEquals(
      domain.governance.endpointBindingPerformed,
      false,
    );

    assertEquals(
      domain.governance.dependencySemanticsResolved,
      false,
    );

    assertEquals(
      domain.governance.canonicalEdgeGenerated,
      false,
    );

    assertEquals(
      domain.governance.activationReadinessResolved,
      false,
    );

    assertEquals(
      domain.governance.runtimeBindingExecuted,
      false,
    );

    assertEquals(
      domain.governance.graphMutationPerformed,
      false,
    );
  },
);
