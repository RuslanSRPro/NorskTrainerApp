import { assertEquals, assertStrictEquals } from "jsr:@std/assert";

import {
  deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1,
} from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";

import type {
  CanonicalDependencyRuntimeActionAuthorityV1,
} from "./canonical-dependency-runtime-authority-v1.ts";

import type {
  CanonicalRuntimeBindingDefinitionAuthorityV1,
} from "./canonical-runtime-binding-definition-authority-v1.ts";

function dependencyAction(
  id: string,
  actionIndex: number,
  sourceRef: string,
  targetRef: string,
): CanonicalDependencyRuntimeActionAuthorityV1 {
  return {
    id,
    status: "candidate",
    manifestId: "manifest:1",
    manifestCode: "fixture",
    runtimeFamily: "token_pos",
    executionPhase: "runtime",
    constraintStrength: null,
    actionIndex,
    relation: "fixture_relation",
    actionTarget: "tokenRef",
    actionValue: {
      source_ref: sourceRef,
      target_ref: targetRef,
      relation: "fixture_relation",
    },
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

function bindingAuthority(
  id: string,
  bindingName: string,
): CanonicalRuntimeBindingDefinitionAuthorityV1 {
  return {
    id,
    status: "candidate",
    manifestId: "manifest:1",
    manifestCode: "fixture",
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
    supportingDependencyAuthorityIds: [],
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

Deno.test(
  "preserves all authored dependency endpoint reference tuples without changing owner-filtered association semantics",
  () => {
    const ownerBinding = bindingAuthority(
      "binding:owner",
      "ownerRef",
    );

    const targetBinding = bindingAuthority(
      "binding:target",
      "targetRef",
    );

    const action = dependencyAction(
      "dependency-action:0",
      0,
      "ownerRef",
      "targetRef",
    );

    const ownerEvidence = {
      boundConditionDomainEvidenceId: "owner-evidence:1",
      manifestId: "manifest:1",
      manifestCode: "fixture",
      ownerBindingDefinitionAuthorityId: ownerBinding.id,
      ownerBindingName: ownerBinding.bindingName,
      sourceBindingDefinitionAuthority: ownerBinding,
    };

    const result =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        [action],
        [ownerBinding, targetBinding],
        [ownerEvidence],
      );

    assertEquals(result.status, "ready");
    assertEquals(result.blockingReasons, []);
    assertEquals(result.domains.length, 1);

    const domain = result.domains[0];

    assertEquals(
      domain.associatedDependencyEndpointReferences,
      [
        {
          dependencyActionAuthorityId: action.id,
          endpointRole: "source",
          bindingName: "ownerRef",
        },
        {
          dependencyActionAuthorityId: action.id,
          endpointRole: "target",
          bindingName: "targetRef",
        },
      ],
    );

    assertEquals(
      domain.associatedDependencyActionAuthorityIds,
      [action.id],
    );

    assertEquals(
      domain.associatedDependencyEndpointRoles,
      ["source"],
    );

    assertEquals(
      domain.associationState,
      "resolved_exact_action_binding_provenance",
    );

    assertStrictEquals(
      domain.selectedDependencyActionAuthorityId,
      null,
    );

    assertStrictEquals(
      domain.dependencyEndpointRole,
      null,
    );

    assertEquals(
      domain.governance
        .authoredEndpointReferencesPreservedWithoutResolution,
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
  "preserves multiple action endpoint tuples independently without winner selection",
  () => {
    const ownerBinding = bindingAuthority(
      "binding:owner",
      "ownerRef",
    );

    const targetBinding = bindingAuthority(
      "binding:target",
      "targetRef",
    );

    const otherBinding = bindingAuthority(
      "binding:other",
      "otherRef",
    );

    const action0 = dependencyAction(
      "dependency-action:0",
      0,
      "ownerRef",
      "targetRef",
    );

    const action1 = dependencyAction(
      "dependency-action:1",
      1,
      "otherRef",
      "ownerRef",
    );

    const ownerEvidence = {
      boundConditionDomainEvidenceId: "owner-evidence:1",
      manifestId: "manifest:1",
      manifestCode: "fixture",
      ownerBindingDefinitionAuthorityId: ownerBinding.id,
      ownerBindingName: ownerBinding.bindingName,
      sourceBindingDefinitionAuthority: ownerBinding,
    };

    const result =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        [action1, action0],
        [otherBinding, targetBinding, ownerBinding],
        [ownerEvidence],
      );

    assertEquals(result.status, "ready");

    const domain = result.domains[0];

    assertEquals(
      domain.associatedDependencyEndpointReferences,
      [
        {
          dependencyActionAuthorityId: action0.id,
          endpointRole: "source",
          bindingName: "ownerRef",
        },
        {
          dependencyActionAuthorityId: action0.id,
          endpointRole: "target",
          bindingName: "targetRef",
        },
        {
          dependencyActionAuthorityId: action1.id,
          endpointRole: "source",
          bindingName: "otherRef",
        },
        {
          dependencyActionAuthorityId: action1.id,
          endpointRole: "target",
          bindingName: "ownerRef",
        },
      ],
    );

    assertEquals(
      domain.associatedDependencyActionAuthorityIds,
      [
        action0.id,
        action1.id,
      ],
    );

    assertEquals(
      domain.associatedDependencyEndpointRoles,
      [
        "source",
        "target",
      ],
    );

    assertStrictEquals(
      domain.selectedDependencyActionAuthorityId,
      null,
    );

    assertStrictEquals(
      domain.dependencyEndpointRole,
      null,
    );
  },
);
