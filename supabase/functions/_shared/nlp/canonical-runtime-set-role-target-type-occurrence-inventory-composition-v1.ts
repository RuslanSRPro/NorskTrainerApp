/**
 * Norsk Trainer
 *
 * V1.46 A4.4
 *
 * SET_ROLE NEUTRAL TARGET TYPE-OCCURRENCE INVENTORY COMPOSITION
 *
 * Composition:
 *
 *   exact A4.3 set_role target node-TYPE compatibility
 *       +
 *   exact family-neutral canonical node-type occurrence inventory
 *       ->
 *   graph-snapshot-bound target TYPE occurrence inventory.
 *
 * IMPORTANT ENDPOINT SAFETY:
 *
 * Only an A4.3 target rooted as exact_binding may enter this layer.
 *
 * A target such as:
 *
 *   subject.head
 *
 * has:
 *
 *   root binding = subject
 *   opaque suffix = head
 *
 * The canonical node type of the root binding does NOT establish the
 * canonical node type of the opaque suffix endpoint.
 *
 * Therefore binding_prefix_with_opaque_suffix candidates are explicitly
 * preserved as NOT ENUMERATED here.
 *
 * This layer DOES NOT:
 *
 * - traverse dotted references;
 * - interpret Runtime entity again;
 * - filter by sentence;
 * - inspect sentenceIndex;
 * - execute scope;
 * - execute WHERE;
 * - enforce cardinality;
 * - bind a Runtime occurrence;
 * - prefer resolved graph nodes;
 * - discard candidate/rejected/blocked/ambiguous nodes;
 * - infer grammatical subject;
 * - infer subject_of;
 * - select a winner;
 * - mutate the graph.
 *
 * A singleton inventory is still NOT a resolved Runtime binding.
 */

import {
  CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityResultV1,
  type CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1,
} from "./canonical-runtime-set-role-target-binding-entity-compatibility-v1.ts";

import {
  CANONICAL_NODE_TYPE_OCCURRENCE_INVENTORY_CAPABILITY_V1,
  type CanonicalNodeTypeOccurrenceInventoryMemberV1,
  type CanonicalNodeTypeOccurrenceInventoryResultV1,
  type CanonicalNodeTypeOccurrenceInventoryV1,
} from "./canonical-node-type-occurrence-inventory-capability-v1.ts";

export const CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_V1 =
  "canonical_runtime_set_role_target_type_occurrence_inventory_composition_v1";

export const CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_VERSION_V1 =
  "1";

export type CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1 =
  {
    id: string;

    status: "candidate";

    targetBindingEntityCompatibilityId: string;

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
      CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1[
        "canonicalNodeType"
      ];

    canonicalNodeTypeAuthorityId: string;

    opaqueSuffix: null;

    occurrenceInventoryId: string;

    graphVersion: "canonical-language-graph-v1";

    graphDocumentId: string;

    occurrences: CanonicalNodeTypeOccurrenceInventoryMemberV1[];

    occurrenceCount: number;

    governance: {
      exactA43ResultRequired: true;

      exactA43CandidateRequired: true;

      exactBindingTargetRequired: true;

      opaqueSuffixTargetExcludedFromEnumeration: true;

      opaqueSuffixEndpointTypeResolved: false;

      exactOccurrenceInventoryRequired: true;

      exactCanonicalNodeTypeMatchRequired: true;

      exactGraphSnapshotRequired: true;

      graphVersionPreserved: true;

      graphDocumentIdPreserved: true;

      occurrenceInventoryConsumedNotReconstructed: true;

      canonicalNodeTypeConsumedNotInferred: true;

      occurrenceIdentityPreserved: true;

      occurrenceGraphStatusPreserved: true;

      allGraphStatusesPreserved: true;

      zeroOccurrencesPreserved: true;

      multipleOccurrencesPreserved: true;

      singletonPromotedToResolved: false;

      resolvedOccurrencePreferred: false;

      typeOccurrenceDomainResolved: true;

      typeOccurrenceEnumerationAvailable: true;

      runtimeBindingOccurrenceDomainResolved: false;

      occurrenceBindingPerformed: false;

      sentenceMembershipResolved: false;

      sentenceFilteringPerformed: false;

      sentenceIndexInspected: false;

      scopeSemanticsResolved: false;

      scopeExecuted: false;

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

      candidateOnly: true;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_VERSION_V1;

    status:
      | "ready"
      | "blocked";

    compositions:
      CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1[];

    graphDocumentId: string | null;

    consideredTargetCompatibilityCount: number;

    enumeratedExactBindingTargetCount: number;

    opaqueSuffixTargetCompatibilityIds: string[];

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
): CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_V1,

    producerVersion:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_VERSION_V1,

    status: "blocked",

    compositions: [],

    graphDocumentId: null,

    consideredTargetCompatibilityCount: 0,

    enumeratedExactBindingTargetCount: 0,

    opaqueSuffixTargetCompatibilityIds: [],

    blockingReasons: uniqueSorted(
      reasons,
    ),
  };
}

function safeTarget(
  target: CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1,
): boolean {
  const g = target.governance;

  if (
    target.status !==
      "candidate" ||
    !stringPresent(
      target.id,
    ) ||
    !stringPresent(
      target.setRoleTargetReferenceRootAuthorityId,
    ) ||
    !stringPresent(
      target.setRoleActionAuthorityId,
    ) ||
    !stringPresent(
      target.manifestId,
    ) ||
    !stringPresent(
      target.manifestCode,
    ) ||
    !Number.isInteger(
      target.actionIndex,
    ) ||
    target.actionIndex <
      0 ||
    !stringPresent(
      target.actionTargetLabel,
    ) ||
    !stringPresent(
      target.rootBindingName,
    ) ||
    !stringPresent(
      target.a42RootBindingDefinitionAuthorityId,
    ) ||
    !stringPresent(
      target.manifestBindingDefinitionAuthorityId,
    ) ||
    !stringPresent(
      target.entityCompatibilityId,
    ) ||
    !stringPresent(
      target.runtimeEntityLabel,
    ) ||
    !stringPresent(
      target.canonicalNodeType,
    ) ||
    !stringPresent(
      target.canonicalNodeTypeAuthorityId,
    )
  ) {
    return false;
  }

  if (
    target.rootMatch ===
      "exact_binding"
  ) {
    if (
      target.opaqueSuffix !==
        null
    ) {
      return false;
    }
  } else if (
    target.rootMatch ===
      "binding_prefix_with_opaque_suffix"
  ) {
    if (
      !stringPresent(
        target.opaqueSuffix,
      )
    ) {
      return false;
    }
  } else {
    return false;
  }

  return (
    g.exactA42ResultRequired ===
      true &&
    g.exactA43a1ResultRequired ===
      true &&
    g.exactA43a2ResultRequired ===
      true &&
    g.rootedTargetRequired ===
      true &&
    g.exactManifestIdentityRequired ===
      true &&
    g.exactBindingNameIdentityRequired ===
      true &&
    g.exactBindingDefinitionSnapshotRequired ===
      true &&
    g.producerSpecificBindingAuthorityIdsRemainDistinct ===
      true &&
    g.crossProducerBindingIdentityResolved ===
      true &&
    g.exactEntityCompatibilityIdentityRequired ===
      true &&
    g.a30BindingDefinitionReread ===
      false &&
    g.runtimeManifestReread ===
      false &&
    g.runtimeEntityLabelConsumedNotReconstructed ===
      true &&
    g.canonicalNodeTypeConsumedNotInferred ===
      true &&
    g.targetCanonicalNodeTypeCompatibilityResolved ===
      true &&
    g.bindingDefinitionSemanticsResolved ===
      false &&
    g.opaqueSuffixPreservedWithoutTraversal ===
      true &&
    g.dottedReferenceTraversalPerformed ===
      false &&
    g.roleSemanticsResolved ===
      false &&
    g.subjectRoleSemanticsResolved ===
      false &&
    g.grammaticalFunctionResolved ===
      false &&
    g.subjectOfRelationInferred ===
      false &&
    g.occurrenceDomainResolved ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.sentenceMembershipResolved ===
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
    g.winnerSelected ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.compatibilityOnly ===
      true &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function safeInventory(
  inventory: CanonicalNodeTypeOccurrenceInventoryV1,
): boolean {
  const g = inventory.governance;

  if (
    inventory.status !==
      "proven" ||
    inventory.graphVersion !==
      "canonical-language-graph-v1" ||
    !stringPresent(
      inventory.graphDocumentId,
    ) ||
    !stringPresent(
      inventory.canonicalNodeType,
    ) ||
    !stringPresent(
      inventory.inventoryId,
    ) ||
    !Array.isArray(
      inventory.occurrences,
    ) ||
    inventory.occurrenceCount !==
      inventory.occurrences.length
  ) {
    return false;
  }

  if (
    g.exactCanonicalGraphVersionRequired !==
      true ||
    g.exactGraphDocumentIdentityPreserved !==
      true ||
    g.canonicalNodeTypeUsedAsGraphTypeSelectorOnly !==
      true ||
    g.exactNodeIdPreserved !==
      true ||
    g.exactNodeTypePreserved !==
      true ||
    g.exactGraphStatusPreserved !==
      true ||
    g.zeroOccurrencesAllowed !==
      true ||
    g.multipleOccurrencesAllowed !==
      true ||
    g.allGraphStatusesPreserved !==
      true ||
    g.deterministicNodeIdOrdering !==
      true ||
    g.runtimeBindingConsumed !==
      false ||
    g.runtimeEntitySemanticsResolved !==
      false ||
    g.runtimeBindingOccurrenceDomainResolved !==
      false ||
    g.scopeSemanticsResolved !==
      false ||
    g.whereSemanticsResolved !==
      false ||
    g.cardinalitySemanticsResolved !==
      false ||
    g.occurrenceWinnerSelected !==
      false ||
    g.resolvedOccurrencePreferred !==
      false ||
    g.candidateOccurrenceDiscarded !==
      false ||
    g.rejectedOccurrenceDiscarded !==
      false ||
    g.blockedOccurrenceDiscarded !==
      false ||
    g.ambiguousOccurrenceDiscarded !==
      false ||
    g.alternativeSetReadPerformed !==
      false ||
    g.alternativeSetResolutionPerformed !==
      false ||
    g.occurrenceBindingPerformed !==
      false ||
    g.runtimeScopeExecutionPerformed !==
      false ||
    g.whereEvaluationPerformed !==
      false ||
    g.cardinalityEnforcementPerformed !==
      false ||
    g.predicateSemanticsResolved !==
      false ||
    g.clauseIdentityResolved !==
      false ||
    g.clauseNodeGenerated !==
      false ||
    g.graphMutationPerformed !==
      false ||
    g.frozenGrammarReadOnly !==
      true
  ) {
    return false;
  }

  const seenNodeIds = new Set<string>();

  for (
    const occurrence of inventory.occurrences
  ) {
    if (
      !stringPresent(
        occurrence.nodeId,
      ) ||
      occurrence.nodeType !==
        inventory.canonicalNodeType ||
      ![
        "candidate",
        "resolved",
        "rejected",
        "blocked",
        "ambiguous",
      ].includes(
        occurrence.graphStatus,
      ) ||
      seenNodeIds.has(
        occurrence.nodeId,
      )
    ) {
      return false;
    }

    seenNodeIds.add(
      occurrence.nodeId,
    );
  }

  return true;
}

function governance(): CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1[
  "governance"
] {
  return {
    exactA43ResultRequired: true,

    exactA43CandidateRequired: true,

    exactBindingTargetRequired: true,

    opaqueSuffixTargetExcludedFromEnumeration: true,

    opaqueSuffixEndpointTypeResolved: false,

    exactOccurrenceInventoryRequired: true,

    exactCanonicalNodeTypeMatchRequired: true,

    exactGraphSnapshotRequired: true,

    graphVersionPreserved: true,

    graphDocumentIdPreserved: true,

    occurrenceInventoryConsumedNotReconstructed: true,

    canonicalNodeTypeConsumedNotInferred: true,

    occurrenceIdentityPreserved: true,

    occurrenceGraphStatusPreserved: true,

    allGraphStatusesPreserved: true,

    zeroOccurrencesPreserved: true,

    multipleOccurrencesPreserved: true,

    singletonPromotedToResolved: false,

    resolvedOccurrencePreferred: false,

    typeOccurrenceDomainResolved: true,

    typeOccurrenceEnumerationAvailable: true,

    runtimeBindingOccurrenceDomainResolved: false,

    occurrenceBindingPerformed: false,

    sentenceMembershipResolved: false,

    sentenceFilteringPerformed: false,

    sentenceIndexInspected: false,

    scopeSemanticsResolved: false,

    scopeExecuted: false,

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

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
  targetResult: CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityResultV1,
  inventoryResults: readonly CanonicalNodeTypeOccurrenceInventoryResultV1[],
): CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionResultV1 {
  const blockingReasons: string[] = [];

  if (
    targetResult.producer !==
      CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1 ||
    targetResult.producerVersion !==
      CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1 ||
    targetResult.status !==
      "ready" ||
    targetResult.blockingReasons.length !==
      0
  ) {
    return blockedResult([
      "target_compatibility_result:not_exact_ready_a4_3",
    ]);
  }

  const seenTargetIds = new Set<string>();

  const exactTargets:
    CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1[] = [];

  const opaqueSuffixTargetCompatibilityIds: string[] = [];

  for (
    const target of targetResult.candidates
  ) {
    if (
      seenTargetIds.has(
        target.id,
      )
    ) {
      blockingReasons.push(
        `target_compatibility:${target.id}:duplicate_id`,
      );

      continue;
    }

    seenTargetIds.add(
      target.id,
    );

    if (
      !safeTarget(
        target,
      )
    ) {
      blockingReasons.push(
        `target_compatibility:${target.id}:unsafe_contract`,
      );

      continue;
    }

    if (
      target.rootMatch ===
        "binding_prefix_with_opaque_suffix"
    ) {
      opaqueSuffixTargetCompatibilityIds.push(
        target.id,
      );

      continue;
    }

    exactTargets.push(
      target,
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

  if (
    exactTargets.length ===
      0
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_V1,

      producerVersion:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_VERSION_V1,

      status: "ready",

      compositions: [],

      graphDocumentId: null,

      consideredTargetCompatibilityCount: targetResult.candidates.length,

      enumeratedExactBindingTargetCount: 0,

      opaqueSuffixTargetCompatibilityIds: uniqueSorted(
        opaqueSuffixTargetCompatibilityIds,
      ),

      blockingReasons: [],
    };
  }

  const inventories: CanonicalNodeTypeOccurrenceInventoryV1[] = [];

  const seenInventoryIds = new Set<string>();

  for (
    let index = 0;
    index < inventoryResults.length;
    index += 1
  ) {
    const result = inventoryResults[
      index
    ];

    if (
      result.producer !==
        CANONICAL_NODE_TYPE_OCCURRENCE_INVENTORY_CAPABILITY_V1 ||
      result.producerVersion !==
        "1" ||
      result.status !==
        "ready" ||
      result.blockingReasons.length !==
        0 ||
      result.inventory ===
        undefined
    ) {
      blockingReasons.push(
        `inventory_result:${index}:not_exact_ready_neutral_inventory`,
      );

      continue;
    }

    const inventory = result.inventory;

    if (
      !safeInventory(
        inventory,
      )
    ) {
      blockingReasons.push(
        `inventory:${inventory.inventoryId}:unsafe_contract`,
      );

      continue;
    }

    if (
      seenInventoryIds.has(
        inventory.inventoryId,
      )
    ) {
      blockingReasons.push(
        `inventory:${inventory.inventoryId}:duplicate_id`,
      );

      continue;
    }

    seenInventoryIds.add(
      inventory.inventoryId,
    );

    inventories.push(
      inventory,
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

  const requiredNodeTypes = uniqueSorted(
    exactTargets.map(
      (target) => target.canonicalNodeType,
    ),
  );

  const selectedInventories: CanonicalNodeTypeOccurrenceInventoryV1[] = [];

  for (
    const nodeType of requiredNodeTypes
  ) {
    const matches = inventories.filter(
      (inventory) =>
        inventory.canonicalNodeType ===
          nodeType,
    );

    if (
      matches.length ===
        0
    ) {
      blockingReasons.push(
        `canonical_node_type:${nodeType}:required_inventory_missing`,
      );

      continue;
    }

    if (
      matches.length >
        1
    ) {
      blockingReasons.push(
        `canonical_node_type:${nodeType}:duplicate_inventory`,
      );

      continue;
    }

    selectedInventories.push(
      matches[0],
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

  const graphDocumentIds = uniqueSorted(
    selectedInventories.map(
      (inventory) => inventory.graphDocumentId,
    ),
  );

  if (
    graphDocumentIds.length >
      1
  ) {
    return blockedResult([
      "inventory_set:mixed_graph_document_identity",
    ]);
  }

  const graphDocumentId = graphDocumentIds[0] ??
    null;

  const inventoryByType = new Map(
    selectedInventories.map(
      (inventory) =>
        [
          inventory.canonicalNodeType,
          inventory,
        ] as const,
    ),
  );

  const compositions:
    CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1[] = [];

  for (
    const target of [...exactTargets].sort(
      (a, b) =>
        a.id.localeCompare(
          b.id,
        ),
    )
  ) {
    const inventory = inventoryByType.get(
      target.canonicalNodeType,
    );

    if (!inventory) {
      return blockedResult([
        `target_compatibility:${target.id}:required_inventory_missing_after_validation`,
      ]);
    }

    const occurrences = inventory.occurrences.map(
      (occurrence) => ({
        ...occurrence,
      }),
    );

    compositions.push({
      id: [
        "set-role-target-type-occurrence-inventory-v1",
        idPart(
          target.id,
        ),
        idPart(
          inventory.inventoryId,
        ),
      ].join(":"),

      status: "candidate",

      targetBindingEntityCompatibilityId: target.id,

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

      occurrenceInventoryId: inventory.inventoryId,

      graphVersion: inventory.graphVersion,

      graphDocumentId: inventory.graphDocumentId,

      occurrences,

      occurrenceCount: occurrences.length,

      governance: governance(),
    });
  }

  return {
    producer:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_V1,

    producerVersion:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_VERSION_V1,

    status: "ready",

    compositions: compositions.sort(
      (a, b) =>
        a.id.localeCompare(
          b.id,
        ),
    ),

    graphDocumentId,

    consideredTargetCompatibilityCount: targetResult.candidates.length,

    enumeratedExactBindingTargetCount: exactTargets.length,

    opaqueSuffixTargetCompatibilityIds: uniqueSorted(
      opaqueSuffixTargetCompatibilityIds,
    ),

    blockingReasons: [],
  };
}
