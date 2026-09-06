// Norsk Trainer — Set-Role Target Scope Compatibility Composition V1
//
// v1.46 A4.5a2
//
// Purpose:
//
//   exact A4.4 set_role target TYPE-occurrence inventory
//       +
//   exact A4.5a1 family-neutral scope compatibility
//       +
//   exact shared A4.3a1 binding authority identity
//       ->
//   set_role target + scope-COMPATIBILITY composition
//
// IMPORTANT:
//
// This attaches scope-label compatibility to the target provenance.
// It DOES NOT execute that scope.
//
// The A4.4 occurrence inventory is preserved UNFILTERED.
//
// Therefore this layer does NOT prove:
// - phrase -> sentence containment;
// - sentence membership;
// - current sentence;
// - sentence-filtered occurrence domain;
// - Runtime occurrence binding;
// - WHERE;
// - cardinality;
// - grammatical subject;
// - set_role semantics;
// - subject_of;
// - winner;
// - graph mutation.

import {
  CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_V1,
  CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_VERSION_V1,
  type CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionResultV1,
  type CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1,
} from "./canonical-runtime-set-role-target-type-occurrence-inventory-composition-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1,
  type CanonicalRuntimeManifestBindingScopeCompatibilityResultV1,
  type CanonicalRuntimeManifestBindingScopeCompatibilityV1,
} from "./canonical-runtime-manifest-binding-scope-compatibility-v1.ts";

export const CANONICAL_RUNTIME_SET_ROLE_TARGET_SCOPE_COMPATIBILITY_COMPOSITION_V1 =
  "canonical_runtime_set_role_target_scope_compatibility_composition_v1";

export const CANONICAL_RUNTIME_SET_ROLE_TARGET_SCOPE_COMPATIBILITY_COMPOSITION_VERSION_V1 =
  "1";

export type CanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionV1 = {
  id: string;

  status: "candidate";

  targetTypeOccurrenceInventoryCompositionId: string;

  targetBindingEntityCompatibilityId: string;

  scopeCompatibilityId: string;

  setRoleTargetReferenceRootAuthorityId: string;

  setRoleActionAuthorityId: string;

  manifestId: string;

  manifestCode: string;

  actionIndex: number;

  actionTargetLabel: string;

  rootMatch: "exact_binding";

  rootBindingName: string;

  a42RootBindingDefinitionAuthorityId: string;

  manifestBindingDefinitionAuthorityId: string;

  entityCompatibilityId: string;

  runtimeEntityLabel: string;

  canonicalNodeType:
    CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1[
      "canonicalNodeType"
    ];

  canonicalNodeTypeAuthorityId: string;

  opaqueSuffix: null;

  runtimeScopeLabel: string;

  canonicalBoundaryLabel: string;

  canonicalBoundaryAuthorityId: string;

  canonicalBoundaryAuthoritySource: string;

  occurrenceInventoryId: string;

  graphVersion: "canonical-language-graph-v1";

  graphDocumentId: string;

  occurrences:
    CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1[
      "occurrences"
    ];

  occurrenceCount: number;

  governance: {
    exactA44ResultRequired: true;

    exactA44CompositionRequired: true;

    exactA45a1ResultRequired: true;

    exactA45a1CompatibilityRequired: true;

    sharedA43a1BindingAuthorityIdentityRequired: true;

    crossProducerBindingBridgeRequired: false;

    exactManifestIdentityRequired: true;

    exactBindingNameIdentityRequired: true;

    scopeCompatibilityAttached: true;

    scopeCompatibilityConsumedNotReconstructed: true;

    runtimeScopeLabelConsumedNotReread: true;

    canonicalBoundaryAuthorityConsumedNotInferred: true;

    targetTypeOccurrenceInventoryConsumedNotReconstructed: true;

    graphSnapshotPreserved: true;

    occurrenceInventoryPreservedUnfiltered: true;

    occurrenceCountPreserved: true;

    occurrenceOrderPreserved: true;

    occurrenceGraphStatusPreserved: true;

    typeOccurrenceDomainResolved: true;

    typeOccurrenceEnumerationAvailable: true;

    scopeSemanticsResolved: false;

    scopeExecutionPerformed: false;

    containmentResolved: false;

    phraseContainmentResolved: false;

    sentenceIdentityResolved: false;

    sentenceMembershipResolved: false;

    sentenceFilteringPerformed: false;

    sentenceIndexInspected: false;

    runtimeBindingOccurrenceDomainResolved: false;

    occurrenceBindingPerformed: false;

    whereSemanticsResolved: false;

    whereExecuted: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforced: false;

    roleSemanticsResolved: false;

    subjectRoleSemanticsResolved: false;

    grammaticalFunctionResolved: false;

    subjectOfRelationInferred: false;

    winnerSelected: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    compatibilityCompositionOnly: true;

    candidateOnly: true;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_SET_ROLE_TARGET_SCOPE_COMPATIBILITY_COMPOSITION_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_SET_ROLE_TARGET_SCOPE_COMPATIBILITY_COMPOSITION_VERSION_V1;

    status:
      | "ready"
      | "blocked";

    compositions:
      CanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionV1[];

    graphDocumentId: string | null;

    unmatchedTargetCompositionIds: string[];

    unusedScopeCompatibilityIds: string[];

    blockingReasons: string[];
  };

function stringPresent(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.trim().length >
      0
  );
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  );
}

function blockedResult(
  reasons: readonly string[],
): CanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_SCOPE_COMPATIBILITY_COMPOSITION_V1,

    producerVersion:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_SCOPE_COMPATIBILITY_COMPOSITION_VERSION_V1,

    status: "blocked",

    compositions: [],

    graphDocumentId: null,

    unmatchedTargetCompositionIds: [],

    unusedScopeCompatibilityIds: [],

    blockingReasons: uniqueSorted(
      reasons,
    ),
  };
}

function safeA44Composition(
  target: CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1,
): boolean {
  const g = target.governance;

  return (
    target.status ===
      "candidate" &&
    stringPresent(
      target.id,
    ) &&
    stringPresent(
      target.targetBindingEntityCompatibilityId,
    ) &&
    stringPresent(
      target.setRoleTargetReferenceRootAuthorityId,
    ) &&
    stringPresent(
      target.setRoleActionAuthorityId,
    ) &&
    stringPresent(
      target.manifestId,
    ) &&
    stringPresent(
      target.manifestCode,
    ) &&
    Number.isInteger(
      target.actionIndex,
    ) &&
    target.actionIndex >=
      0 &&
    stringPresent(
      target.actionTargetLabel,
    ) &&
    target.rootMatch ===
      "exact_binding" &&
    stringPresent(
      target.rootBindingName,
    ) &&
    stringPresent(
      target.a42RootBindingDefinitionAuthorityId,
    ) &&
    stringPresent(
      target.manifestBindingDefinitionAuthorityId,
    ) &&
    stringPresent(
      target.entityCompatibilityId,
    ) &&
    stringPresent(
      target.runtimeEntityLabel,
    ) &&
    stringPresent(
      target.canonicalNodeType,
    ) &&
    stringPresent(
      target.canonicalNodeTypeAuthorityId,
    ) &&
    target.opaqueSuffix ===
      null &&
    stringPresent(
      target.occurrenceInventoryId,
    ) &&
    target.graphVersion ===
      "canonical-language-graph-v1" &&
    stringPresent(
      target.graphDocumentId,
    ) &&
    Array.isArray(
      target.occurrences,
    ) &&
    target.occurrenceCount ===
      target.occurrences.length &&
    g.exactA43ResultRequired ===
      true &&
    g.exactA43CandidateRequired ===
      true &&
    g.exactBindingTargetRequired ===
      true &&
    g.opaqueSuffixTargetExcludedFromEnumeration ===
      true &&
    g.opaqueSuffixEndpointTypeResolved ===
      false &&
    g.exactOccurrenceInventoryRequired ===
      true &&
    g.exactCanonicalNodeTypeMatchRequired ===
      true &&
    g.exactGraphSnapshotRequired ===
      true &&
    g.graphVersionPreserved ===
      true &&
    g.graphDocumentIdPreserved ===
      true &&
    g.occurrenceInventoryConsumedNotReconstructed ===
      true &&
    g.canonicalNodeTypeConsumedNotInferred ===
      true &&
    g.occurrenceIdentityPreserved ===
      true &&
    g.occurrenceGraphStatusPreserved ===
      true &&
    g.allGraphStatusesPreserved ===
      true &&
    g.zeroOccurrencesPreserved ===
      true &&
    g.multipleOccurrencesPreserved ===
      true &&
    g.singletonPromotedToResolved ===
      false &&
    g.resolvedOccurrencePreferred ===
      false &&
    g.typeOccurrenceDomainResolved ===
      true &&
    g.typeOccurrenceEnumerationAvailable ===
      true &&
    g.runtimeBindingOccurrenceDomainResolved ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.sentenceMembershipResolved ===
      false &&
    g.sentenceFilteringPerformed ===
      false &&
    g.sentenceIndexInspected ===
      false &&
    g.scopeSemanticsResolved ===
      false &&
    g.scopeExecuted ===
      false &&
    g.whereSemanticsResolved ===
      false &&
    g.whereExecuted ===
      false &&
    g.cardinalitySemanticsResolved ===
      false &&
    g.cardinalityEnforced ===
      false &&
    g.roleSemanticsResolved ===
      false &&
    g.subjectRoleSemanticsResolved ===
      false &&
    g.grammaticalFunctionResolved ===
      false &&
    g.subjectOfRelationInferred ===
      false &&
    g.winnerSelected ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function safeScopeCompatibility(
  compatibility: CanonicalRuntimeManifestBindingScopeCompatibilityV1,
): boolean {
  const g = compatibility.governance;

  return (
    compatibility.status ===
      "candidate" &&
    stringPresent(
      compatibility.id,
    ) &&
    stringPresent(
      compatibility.bindingDefinitionAuthorityId,
    ) &&
    stringPresent(
      compatibility.manifestId,
    ) &&
    stringPresent(
      compatibility.manifestCode,
    ) &&
    stringPresent(
      compatibility.bindingName,
    ) &&
    stringPresent(
      compatibility.runtimeScopeLabel,
    ) &&
    stringPresent(
      compatibility.canonicalBoundaryLabel,
    ) &&
    stringPresent(
      compatibility.canonicalBoundaryAuthorityId,
    ) &&
    stringPresent(
      compatibility.canonicalBoundaryAuthoritySource,
    ) &&
    g.exactA43a1ResultRequired ===
      true &&
    g.exactManifestBindingDefinitionAuthorityRequired ===
      true &&
    g.exactCanonicalBoundaryAuthorityRequired ===
      true &&
    g.exactOpaqueLabelMatch ===
      true &&
    g.runtimeScopeVocabularyHardcoded ===
      false &&
    g.runtimeScopeLabelNormalized ===
      false &&
    g.caseFoldingPerformed ===
      false &&
    g.canonicalBoundaryInferredFromName ===
      false &&
    g.canonicalBoundaryAuthorityIdentityPreserved ===
      true &&
    g.canonicalBoundaryAuthoritySourcePreservedOpaque ===
      true &&
    g.scopeSemanticsResolved ===
      false &&
    g.containmentResolved ===
      false &&
    g.sentenceIdentityResolved ===
      false &&
    g.phraseContainmentResolved ===
      false &&
    g.clauseContainmentResolved ===
      false &&
    g.selfSemanticsResolved ===
      false &&
    g.occurrenceDomainResolved ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.whereSemanticsResolved ===
      false &&
    g.cardinalitySemanticsResolved ===
      false &&
    g.actionFamilySemanticsResolved ===
      false &&
    g.roleSemanticsResolved ===
      false &&
    g.grammaticalFunctionResolved ===
      false &&
    g.subjectOfRelationInferred ===
      false &&
    g.winnerSelected ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.compatibilityOnly ===
      true &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function governance(): CanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionV1[
  "governance"
] {
  return {
    exactA44ResultRequired: true,

    exactA44CompositionRequired: true,

    exactA45a1ResultRequired: true,

    exactA45a1CompatibilityRequired: true,

    sharedA43a1BindingAuthorityIdentityRequired: true,

    crossProducerBindingBridgeRequired: false,

    exactManifestIdentityRequired: true,

    exactBindingNameIdentityRequired: true,

    scopeCompatibilityAttached: true,

    scopeCompatibilityConsumedNotReconstructed: true,

    runtimeScopeLabelConsumedNotReread: true,

    canonicalBoundaryAuthorityConsumedNotInferred: true,

    targetTypeOccurrenceInventoryConsumedNotReconstructed: true,

    graphSnapshotPreserved: true,

    occurrenceInventoryPreservedUnfiltered: true,

    occurrenceCountPreserved: true,

    occurrenceOrderPreserved: true,

    occurrenceGraphStatusPreserved: true,

    typeOccurrenceDomainResolved: true,

    typeOccurrenceEnumerationAvailable: true,

    scopeSemanticsResolved: false,

    scopeExecutionPerformed: false,

    containmentResolved: false,

    phraseContainmentResolved: false,

    sentenceIdentityResolved: false,

    sentenceMembershipResolved: false,

    sentenceFilteringPerformed: false,

    sentenceIndexInspected: false,

    runtimeBindingOccurrenceDomainResolved: false,

    occurrenceBindingPerformed: false,

    whereSemanticsResolved: false,

    whereExecuted: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforced: false,

    roleSemanticsResolved: false,

    subjectRoleSemanticsResolved: false,

    grammaticalFunctionResolved: false,

    subjectOfRelationInferred: false,

    winnerSelected: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    compatibilityCompositionOnly: true,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
  targetResult:
    CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionResultV1,
  scopeResult: CanonicalRuntimeManifestBindingScopeCompatibilityResultV1,
): CanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionResultV1 {
  const blockingReasons: string[] = [];

  if (
    targetResult.producer !==
      CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_V1 ||
    targetResult.producerVersion !==
      CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_VERSION_V1 ||
    targetResult.status !==
      "ready" ||
    targetResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      "a4_4_result:not_exact_ready",
    );
  }

  if (
    scopeResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1 ||
    scopeResult.producerVersion !==
      "1" ||
    scopeResult.status !==
      "ready" ||
    scopeResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      "a4_5a1_result:not_exact_ready",
    );
  }

  const seenTargetIds = new Set<string>();

  for (
    const target of targetResult.compositions
  ) {
    if (
      seenTargetIds.has(
        target.id,
      )
    ) {
      blockingReasons.push(
        `a4_4_target:${target.id}:duplicate_id`,
      );

      continue;
    }

    seenTargetIds.add(
      target.id,
    );

    if (
      !safeA44Composition(
        target,
      )
    ) {
      blockingReasons.push(
        `a4_4_target:${target.id}:unsafe_contract`,
      );
    }
  }

  if (
    targetResult.compositions.length ===
      0
  ) {
    if (
      targetResult.graphDocumentId !==
        null
    ) {
      blockingReasons.push(
        "a4_4_result:unexpected_graph_document_without_compositions",
      );
    }
  } else {
    if (
      !stringPresent(
        targetResult.graphDocumentId,
      )
    ) {
      blockingReasons.push(
        "a4_4_result:graph_document_identity_missing",
      );
    } else {
      for (
        const target of targetResult.compositions
      ) {
        if (
          target.graphDocumentId !==
            targetResult.graphDocumentId
        ) {
          blockingReasons.push(
            `a4_4_target:${target.id}:graph_document_identity_mismatch`,
          );
        }
      }
    }
  }

  const scopeByBindingAuthorityId = new Map<
    string,
    CanonicalRuntimeManifestBindingScopeCompatibilityV1
  >();

  const seenScopeIds = new Set<string>();

  for (
    const compatibility of scopeResult.candidates
  ) {
    if (
      seenScopeIds.has(
        compatibility.id,
      )
    ) {
      blockingReasons.push(
        `a4_5a1_scope:${compatibility.id}:duplicate_id`,
      );

      continue;
    }

    seenScopeIds.add(
      compatibility.id,
    );

    if (
      !safeScopeCompatibility(
        compatibility,
      )
    ) {
      blockingReasons.push(
        `a4_5a1_scope:${compatibility.id}:unsafe_contract`,
      );

      continue;
    }

    if (
      scopeByBindingAuthorityId.has(
        compatibility.bindingDefinitionAuthorityId,
      )
    ) {
      blockingReasons.push(
        `a4_5a1_binding:${compatibility.bindingDefinitionAuthorityId}:duplicate_scope_compatibility`,
      );

      continue;
    }

    scopeByBindingAuthorityId.set(
      compatibility.bindingDefinitionAuthorityId,
      compatibility,
    );
  }

  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }

  const compositions:
    CanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionV1[] = [];

  const unmatchedTargetCompositionIds: string[] = [];

  const usedScopeCompatibilityIds = new Set<string>();

  for (
    const target of [...targetResult.compositions].sort(
      (
        a,
        b,
      ) =>
        a.id.localeCompare(
          b.id,
        ),
    )
  ) {
    const scopeCompatibility = scopeByBindingAuthorityId.get(
      target.manifestBindingDefinitionAuthorityId,
    );

    if (
      !scopeCompatibility
    ) {
      unmatchedTargetCompositionIds.push(
        target.id,
      );

      continue;
    }

    if (
      scopeCompatibility.bindingDefinitionAuthorityId !==
        target.manifestBindingDefinitionAuthorityId ||
      scopeCompatibility.manifestId !==
        target.manifestId ||
      scopeCompatibility.manifestCode !==
        target.manifestCode ||
      scopeCompatibility.bindingName !==
        target.rootBindingName
    ) {
      blockingReasons.push(
        `a4_4_target:${target.id}:scope_compatibility_identity_mismatch`,
      );

      continue;
    }

    const occurrences = target.occurrences.map(
      (occurrence) => ({
        ...occurrence,
      }),
    );

    if (
      occurrences.length !==
        target.occurrenceCount
    ) {
      blockingReasons.push(
        `a4_4_target:${target.id}:occurrence_count_changed_during_composition`,
      );

      continue;
    }

    usedScopeCompatibilityIds.add(
      scopeCompatibility.id,
    );

    compositions.push({
      id: [
        "set-role-target-scope-compatibility-v1",
        idPart(
          target.id,
        ),
        idPart(
          scopeCompatibility.id,
        ),
      ].join(":"),

      status: "candidate",

      targetTypeOccurrenceInventoryCompositionId: target.id,

      targetBindingEntityCompatibilityId:
        target.targetBindingEntityCompatibilityId,

      scopeCompatibilityId: scopeCompatibility.id,

      setRoleTargetReferenceRootAuthorityId:
        target.setRoleTargetReferenceRootAuthorityId,

      setRoleActionAuthorityId: target.setRoleActionAuthorityId,

      manifestId: target.manifestId,

      manifestCode: target.manifestCode,

      actionIndex: target.actionIndex,

      actionTargetLabel: target.actionTargetLabel,

      rootMatch: "exact_binding",

      rootBindingName: target.rootBindingName,

      a42RootBindingDefinitionAuthorityId:
        target.a42RootBindingDefinitionAuthorityId,

      manifestBindingDefinitionAuthorityId:
        target.manifestBindingDefinitionAuthorityId,

      entityCompatibilityId: target.entityCompatibilityId,

      runtimeEntityLabel: target.runtimeEntityLabel,

      canonicalNodeType: target.canonicalNodeType,

      canonicalNodeTypeAuthorityId: target.canonicalNodeTypeAuthorityId,

      opaqueSuffix: null,

      runtimeScopeLabel: scopeCompatibility.runtimeScopeLabel,

      canonicalBoundaryLabel: scopeCompatibility.canonicalBoundaryLabel,

      canonicalBoundaryAuthorityId:
        scopeCompatibility.canonicalBoundaryAuthorityId,

      canonicalBoundaryAuthoritySource:
        scopeCompatibility.canonicalBoundaryAuthoritySource,

      occurrenceInventoryId: target.occurrenceInventoryId,

      graphVersion: target.graphVersion,

      graphDocumentId: target.graphDocumentId,

      occurrences,

      occurrenceCount: target.occurrenceCount,

      governance: governance(),
    });
  }

  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }

  const unusedScopeCompatibilityIds = scopeResult.candidates
    .map(
      (compatibility) => compatibility.id,
    )
    .filter(
      (id) =>
        !usedScopeCompatibilityIds.has(
          id,
        ),
    )
    .sort();

  return {
    producer:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_SCOPE_COMPATIBILITY_COMPOSITION_V1,

    producerVersion:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_SCOPE_COMPATIBILITY_COMPOSITION_VERSION_V1,

    status: "ready",

    compositions: compositions.sort(
      (
        a,
        b,
      ) =>
        a.id.localeCompare(
          b.id,
        ),
    ),

    graphDocumentId: targetResult.graphDocumentId,

    unmatchedTargetCompositionIds: uniqueSorted(
      unmatchedTargetCompositionIds,
    ),

    unusedScopeCompatibilityIds,

    blockingReasons: [],
  };
}
