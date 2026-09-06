/**
 * Norsk Trainer
 *
 * V1.46 A4.3a3
 *
 * SET_ROLE TARGET BINDING ENTITY COMPATIBILITY COMPOSITION
 *
 * Composition:
 *
 *   exact rooted A4.2 set_role target
 *       +
 *   exact A4.3a1 family-neutral manifest binding authority
 *       +
 *   exact A4.3a2 family-neutral entity compatibility
 *       ->
 *   set_role target canonical node-TYPE compatibility candidate
 *
 * IMPORTANT CROSS-PRODUCER IDENTITY RULE
 *
 * A4.2 was closed before A4.3a1 and therefore preserves the
 * historical A3.0 binding-definition authority id.
 *
 * A4.3a1 has its own family-neutral authority identity.
 *
 * Those producer-specific ids MUST NOT be equated.
 *
 * The same Runtime manifest-local binding is bridged only when:
 *
 * - manifest id is exact;
 * - manifest code is exact;
 * - binding name is exact;
 * - the complete opaque binding-definition snapshots are equal.
 *
 * A4.3a2 must then point to that exact A4.3a1 authority id.
 *
 * This layer does NOT reread the Runtime manifest.
 * It does NOT reinterpret entity labels.
 *
 * It intentionally does NOT:
 *
 * - resolve set_role semantics;
 * - infer grammatical subject;
 * - infer subject_of;
 * - traverse an opaque dotted suffix;
 * - enumerate graph occurrences;
 * - resolve sentence membership;
 * - execute scope;
 * - execute WHERE;
 * - enforce cardinality;
 * - bind an occurrence;
 * - select a winner;
 * - mutate the graph;
 * - classify learner error.
 */

import {
  CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_V1,
  CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeSetRoleTargetReferenceRootAuthorityResultV1,
  type CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1,
} from "./canonical-runtime-set-role-target-reference-root-authority-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingEntityCompatibilityResultV1,
  type CanonicalRuntimeManifestBindingEntityCompatibilityV1,
} from "./canonical-runtime-manifest-binding-entity-compatibility-v1.ts";

type JsonRecord = Record<string, unknown>;

export const CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1 =
  "canonical_runtime_set_role_target_binding_entity_compatibility_v1";

export const CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1 =
  "1";

export type CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1 = {
  id: string;

  status: "candidate";

  setRoleTargetReferenceRootAuthorityId: string;

  setRoleActionAuthorityId: string;

  manifestId: string;

  manifestCode: string;

  actionIndex: number;

  actionTargetLabel: string;

  rootMatch:
    | "exact_binding"
    | "binding_prefix_with_opaque_suffix";

  rootBindingName: string;

  a42RootBindingDefinitionAuthorityId: string;

  manifestBindingDefinitionAuthorityId: string;

  entityCompatibilityId: string;

  runtimeEntityLabel: string;

  canonicalNodeType: CanonicalRuntimeManifestBindingEntityCompatibilityV1[
    "canonicalNodeType"
  ];

  canonicalNodeTypeAuthorityId: string;

  opaqueSuffix: string | null;

  governance: {
    exactA42ResultRequired: true;

    exactA43a1ResultRequired: true;

    exactA43a2ResultRequired: true;

    rootedTargetRequired: true;

    exactManifestIdentityRequired: true;

    exactBindingNameIdentityRequired: true;

    exactBindingDefinitionSnapshotRequired: true;

    producerSpecificBindingAuthorityIdsRemainDistinct: true;

    crossProducerBindingIdentityResolved: true;

    exactEntityCompatibilityIdentityRequired: true;

    a30BindingDefinitionReread: false;

    runtimeManifestReread: false;

    runtimeEntityLabelConsumedNotReconstructed: true;

    canonicalNodeTypeConsumedNotInferred: true;

    targetCanonicalNodeTypeCompatibilityResolved: true;

    bindingDefinitionSemanticsResolved: false;

    opaqueSuffixPreservedWithoutTraversal: true;

    dottedReferenceTraversalPerformed: false;

    roleSemanticsResolved: false;

    subjectRoleSemanticsResolved: false;

    grammaticalFunctionResolved: false;

    subjectOfRelationInferred: false;

    occurrenceDomainResolved: false;

    occurrenceEnumerationPerformed: false;

    occurrenceBindingPerformed: false;

    sentenceMembershipResolved: false;

    scopeSemanticsResolved: false;

    scopeExecuted: false;

    whereSemanticsResolved: false;

    whereExecuted: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforced: false;

    winnerSelected: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    compatibilityOnly: true;

    candidateOnly: true;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1;

  status:
    | "ready"
    | "blocked";

  candidates: CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1[];

  unrootedTargetAuthorityIds: string[];

  unmappedRootedTargetAuthorityIds: string[];

  blockingReasons: string[];
};

function asRecord(
  value: unknown,
): JsonRecord | null {
  return (
      value !== null &&
      typeof value ===
        "object" &&
      !Array.isArray(
        value,
      )
    )
    ? value as JsonRecord
    : null;
}

function stringValue(
  value: unknown,
): string | null {
  return (
      typeof value ===
        "string" &&
      value.trim().length >
        0
    )
    ? value
    : null;
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
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

function canonicalValue(
  value: unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      canonicalValue,
    );
  }

  const record = asRecord(
    value,
  );

  if (record) {
    const out: JsonRecord = {};

    for (
      const key of Object.keys(
        record,
      ).sort()
    ) {
      out[key] = canonicalValue(
        record[
          key
        ],
      );
    }

    return out;
  }

  return value;
}

function sameOpaqueJson(
  left: unknown,
  right: unknown,
): boolean {
  return JSON.stringify(
    canonicalValue(
      left,
    ),
  ) ===
    JSON.stringify(
      canonicalValue(
        right,
      ),
    );
}

function bindingIdentityKey(
  manifestId: string,
  manifestCode: string,
  bindingName: string,
): string {
  return [
    manifestId,
    manifestCode,
    bindingName,
  ].join(
    "\u0000",
  );
}

function safeA42Result(
  result: CanonicalRuntimeSetRoleTargetReferenceRootAuthorityResultV1,
): boolean {
  return (
    result.authority ===
      CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_V1 &&
    result.authorityVersion ===
      CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.blockingReasons.length ===
      0
  );
}

function safeA42Authority(
  authority: CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1,
): boolean {
  const g = authority.governance;

  if (
    authority.status !==
      "candidate" ||
    !stringValue(
      authority.id,
    ) ||
    !stringValue(
      authority.setRoleActionAuthorityId,
    ) ||
    !stringValue(
      authority.manifestId,
    ) ||
    !stringValue(
      authority.manifestCode,
    ) ||
    !Number.isInteger(
      authority.actionIndex,
    ) ||
    authority.actionIndex <
      0 ||
    !stringValue(
      authority.actionTargetLabel,
    )
  ) {
    return false;
  }

  if (
    g.setRoleActionAuthorityRequired !==
      true ||
    g.exactValidatedManifestRequired !==
      true ||
    g.exactActionSnapshotRequired !==
      true ||
    g.exactBindingDefinitionSetRequired !==
      true ||
    g.manifestLocalBindingRootsOnly !==
      true ||
    g.longestExactBindingPrefixWins !==
      true ||
    g.lexicalDelimiterOnly !==
      true ||
    g.referenceExpressionPreserved !==
      true ||
    g.opaqueSuffixPreserved !==
      true ||
    g.targetReferenceRootResolved !==
      true ||
    g.referenceExpressionGrammarResolved !==
      false ||
    g.dottedPathSemanticsResolved !==
      false ||
    g.suffixSemanticsResolved !==
      false ||
    g.bindingSemanticsResolved !==
      false ||
    g.roleSemanticsResolved !==
      false ||
    g.subjectRoleSemanticsResolved !==
      false ||
    g.targetOccurrenceBound !==
      false ||
    g.whereExecuted !==
      false ||
    g.scopeExecuted !==
      false ||
    g.cardinalityEnforced !==
      false ||
    g.subjectOfRelationInferred !==
      false ||
    g.graphMutationPerformed !==
      false ||
    g.winnerSelected !==
      false ||
    g.learnerErrorClassified !==
      false ||
    g.candidateOnly !==
      true ||
    g.frozenGrammarReadOnly !==
      true
  ) {
    return false;
  }

  if (
    authority.rooted
  ) {
    return (
      (
        authority.rootMatch ===
          "exact_binding" ||
        authority.rootMatch ===
          "binding_prefix_with_opaque_suffix"
      ) &&
      Boolean(
        stringValue(
          authority.rootBindingName,
        ),
      ) &&
      Boolean(
        stringValue(
          authority.rootBindingDefinitionAuthorityId,
        ),
      ) &&
      Boolean(
        asRecord(
          authority.rootBindingDefinition,
        ),
      )
    );
  }

  return (
    authority.rootMatch ===
      "unrooted" &&
    authority.rootBindingName ===
      null &&
    authority.rootBindingDefinitionAuthorityId ===
      null &&
    authority.rootBindingDefinition ===
      null
  );
}

function safeA43a1Result(
  result: CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
): boolean {
  return (
    result.producer ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1 &&
    result.producerVersion ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.blockingReasons.length ===
      0
  );
}

function safeA43a1Authority(
  authority: CanonicalRuntimeManifestBindingDefinitionAuthorityV1,
): boolean {
  const g = authority.governance;

  return (
    authority.status ===
      "candidate" &&
    Boolean(
      stringValue(
        authority.id,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.manifestId,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.manifestCode,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.bindingName,
      ),
    ) &&
    Boolean(
      asRecord(
        authority.bindingDefinition,
      ),
    ) &&
    g.exactValidatedManifestRequired ===
      true &&
    g.exactManifestIdentityRequired ===
      true &&
    g.manifestLocalBindingsOnly ===
      true &&
    g.actionAuthorityRequired ===
      false &&
    g.actionFamilySemanticsResolved ===
      false &&
    g.bindingNamePreservedOpaque ===
      true &&
    g.bindingDefinitionPreservedOpaque ===
      true &&
    g.entityLabelPreservedOpaque ===
      true &&
    g.scopeLabelPreservedOpaque ===
      true &&
    g.cardinalityLabelPreservedOpaque ===
      true &&
    g.whereClausePreservedOpaque ===
      true &&
    g.entitySemanticsResolved ===
      false &&
    g.scopeSemanticsResolved ===
      false &&
    g.cardinalitySemanticsResolved ===
      false &&
    g.whereSemanticsResolved ===
      false &&
    g.referenceSemanticsResolved ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.winnerSelected ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.productionActivationAssumed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function safeA43a2Result(
  result: CanonicalRuntimeManifestBindingEntityCompatibilityResultV1,
): boolean {
  return (
    result.producer ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_V1 &&
    result.producerVersion ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.blockingReasons.length ===
      0
  );
}

function safeA43a2Candidate(
  candidate: CanonicalRuntimeManifestBindingEntityCompatibilityV1,
): boolean {
  const g = candidate.governance;

  return (
    candidate.status ===
      "candidate" &&
    Boolean(
      stringValue(
        candidate.id,
      ),
    ) &&
    Boolean(
      stringValue(
        candidate.bindingDefinitionAuthorityId,
      ),
    ) &&
    Boolean(
      stringValue(
        candidate.manifestId,
      ),
    ) &&
    Boolean(
      stringValue(
        candidate.manifestCode,
      ),
    ) &&
    Boolean(
      stringValue(
        candidate.bindingName,
      ),
    ) &&
    Boolean(
      stringValue(
        candidate.runtimeEntityLabel,
      ),
    ) &&
    Boolean(
      stringValue(
        candidate.canonicalNodeType,
      ),
    ) &&
    Boolean(
      stringValue(
        candidate.canonicalNodeTypeAuthorityId,
      ),
    ) &&
    g.exactA43a1ResultRequired ===
      true &&
    g.exactManifestBindingDefinitionAuthorityRequired ===
      true &&
    g.exactCanonicalNodeTypeAuthorityRequired ===
      true &&
    g.exactOpaqueLabelMatch ===
      true &&
    g.runtimeEntityVocabularyHardcoded ===
      false &&
    g.runtimeEntityLabelNormalized ===
      false &&
    g.caseFoldingPerformed ===
      false &&
    g.canonicalNodeTypeInferredFromBindingName ===
      false &&
    g.canonicalNodeTypeAuthorityIdentityPreserved ===
      true &&
    g.entitySemanticsResolved ===
      false &&
    g.occurrenceDomainResolved ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.scopeSemanticsResolved ===
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

function governance(): CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1[
  "governance"
] {
  return {
    exactA42ResultRequired: true,

    exactA43a1ResultRequired: true,

    exactA43a2ResultRequired: true,

    rootedTargetRequired: true,

    exactManifestIdentityRequired: true,

    exactBindingNameIdentityRequired: true,

    exactBindingDefinitionSnapshotRequired: true,

    producerSpecificBindingAuthorityIdsRemainDistinct: true,

    crossProducerBindingIdentityResolved: true,

    exactEntityCompatibilityIdentityRequired: true,

    a30BindingDefinitionReread: false,

    runtimeManifestReread: false,

    runtimeEntityLabelConsumedNotReconstructed: true,

    canonicalNodeTypeConsumedNotInferred: true,

    targetCanonicalNodeTypeCompatibilityResolved: true,

    bindingDefinitionSemanticsResolved: false,

    opaqueSuffixPreservedWithoutTraversal: true,

    dottedReferenceTraversalPerformed: false,

    roleSemanticsResolved: false,

    subjectRoleSemanticsResolved: false,

    grammaticalFunctionResolved: false,

    subjectOfRelationInferred: false,

    occurrenceDomainResolved: false,

    occurrenceEnumerationPerformed: false,

    occurrenceBindingPerformed: false,

    sentenceMembershipResolved: false,

    scopeSemanticsResolved: false,

    scopeExecuted: false,

    whereSemanticsResolved: false,

    whereExecuted: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforced: false,

    winnerSelected: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    compatibilityOnly: true,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeSetRoleTargetBindingEntityCompatibilitiesV1(
  rootResult: CanonicalRuntimeSetRoleTargetReferenceRootAuthorityResultV1,
  bindingResult: CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  entityCompatibilityResult:
    CanonicalRuntimeManifestBindingEntityCompatibilityResultV1,
): CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityResultV1 {
  if (
    !safeA42Result(
      rootResult,
    )
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

      status: "blocked",

      candidates: [],

      unrootedTargetAuthorityIds: [],

      unmappedRootedTargetAuthorityIds: [],

      blockingReasons: [
        "unsafe_a4_2_result",
      ],
    };
  }

  if (
    !safeA43a1Result(
      bindingResult,
    )
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

      status: "blocked",

      candidates: [],

      unrootedTargetAuthorityIds: [],

      unmappedRootedTargetAuthorityIds: [],

      blockingReasons: [
        "unsafe_a4_3a1_result",
      ],
    };
  }

  if (
    !safeA43a2Result(
      entityCompatibilityResult,
    )
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

      status: "blocked",

      candidates: [],

      unrootedTargetAuthorityIds: [],

      unmappedRootedTargetAuthorityIds: [],

      blockingReasons: [
        "unsafe_a4_3a2_result",
      ],
    };
  }

  const blockingReasons: string[] = [];

  const unrooted: string[] = [];

  const unmappedRooted: string[] = [];

  const out: CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1[] = [];

  const seenRootIds = new Set<string>();

  for (
    const root of rootResult.authorities
  ) {
    if (
      seenRootIds.has(
        root.id,
      )
    ) {
      blockingReasons.push(
        `a4_2_root:${root.id}:duplicate_id`,
      );

      continue;
    }

    seenRootIds.add(
      root.id,
    );

    if (
      !safeA42Authority(
        root,
      )
    ) {
      blockingReasons.push(
        `a4_2_root:${root.id}:unsafe_contract`,
      );
    }
  }

  const bindingsByIdentity = new Map<
    string,
    CanonicalRuntimeManifestBindingDefinitionAuthorityV1
  >();

  const seenBindingIds = new Set<string>();

  for (
    const binding of bindingResult.authorities
  ) {
    if (
      seenBindingIds.has(
        binding.id,
      )
    ) {
      blockingReasons.push(
        `a4_3a1_binding:${binding.id}:duplicate_id`,
      );

      continue;
    }

    seenBindingIds.add(
      binding.id,
    );

    if (
      !safeA43a1Authority(
        binding,
      )
    ) {
      blockingReasons.push(
        `a4_3a1_binding:${binding.id}:unsafe_contract`,
      );

      continue;
    }

    const key = bindingIdentityKey(
      binding.manifestId,
      binding.manifestCode,
      binding.bindingName,
    );

    if (
      bindingsByIdentity.has(
        key,
      )
    ) {
      blockingReasons.push(
        `a4_3a1_binding:${key}:duplicate_manifest_binding_identity`,
      );

      continue;
    }

    bindingsByIdentity.set(
      key,
      binding,
    );
  }

  const compatibilityByBindingId = new Map<
    string,
    CanonicalRuntimeManifestBindingEntityCompatibilityV1
  >();

  const seenCompatibilityIds = new Set<string>();

  for (
    const compatibility of entityCompatibilityResult.candidates
  ) {
    if (
      seenCompatibilityIds.has(
        compatibility.id,
      )
    ) {
      blockingReasons.push(
        `a4_3a2_compatibility:${compatibility.id}:duplicate_id`,
      );

      continue;
    }

    seenCompatibilityIds.add(
      compatibility.id,
    );

    if (
      !safeA43a2Candidate(
        compatibility,
      )
    ) {
      blockingReasons.push(
        `a4_3a2_compatibility:${compatibility.id}:unsafe_contract`,
      );

      continue;
    }

    if (
      compatibilityByBindingId.has(
        compatibility.bindingDefinitionAuthorityId,
      )
    ) {
      blockingReasons.push(
        `a4_3a2_binding:${compatibility.bindingDefinitionAuthorityId}:duplicate_compatibility`,
      );

      continue;
    }

    compatibilityByBindingId.set(
      compatibility.bindingDefinitionAuthorityId,
      compatibility,
    );
  }

  let reasons = uniqueSorted(
    blockingReasons,
  );

  if (
    reasons.length >
      0
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

      status: "blocked",

      candidates: [],

      unrootedTargetAuthorityIds: [],

      unmappedRootedTargetAuthorityIds: [],

      blockingReasons: reasons,
    };
  }

  for (
    const root of rootResult.authorities
  ) {
    if (
      !root.rooted
    ) {
      unrooted.push(
        root.id,
      );

      continue;
    }

    const rootBindingName = stringValue(
      root.rootBindingName,
    );

    const a42BindingAuthorityId = stringValue(
      root.rootBindingDefinitionAuthorityId,
    );

    const rootDefinition = asRecord(
      root.rootBindingDefinition,
    );

    if (
      !rootBindingName ||
      !a42BindingAuthorityId ||
      !rootDefinition
    ) {
      blockingReasons.push(
        `a4_2_root:${root.id}:root_binding_contract_missing`,
      );

      continue;
    }

    const key = bindingIdentityKey(
      root.manifestId,
      root.manifestCode,
      rootBindingName,
    );

    const neutralBinding = bindingsByIdentity.get(
      key,
    );

    if (!neutralBinding) {
      unmappedRooted.push(
        root.id,
      );

      continue;
    }

    if (
      !sameOpaqueJson(
        rootDefinition,
        neutralBinding.bindingDefinition,
      )
    ) {
      blockingReasons.push(
        `a4_2_root:${root.id}:cross_producer_binding_snapshot_mismatch`,
      );

      continue;
    }

    const compatibility = compatibilityByBindingId.get(
      neutralBinding.id,
    );

    if (!compatibility) {
      unmappedRooted.push(
        root.id,
      );

      continue;
    }

    if (
      compatibility.manifestId !==
        root.manifestId ||
      compatibility.manifestCode !==
        root.manifestCode ||
      compatibility.bindingName !==
        rootBindingName ||
      compatibility.bindingDefinitionAuthorityId !==
        neutralBinding.id
    ) {
      blockingReasons.push(
        `a4_2_root:${root.id}:entity_compatibility_identity_mismatch`,
      );

      continue;
    }

    out.push({
      id: [
        "set-role-target-binding-entity-compatibility-v1",
        idPart(
          root.id,
        ),
        idPart(
          neutralBinding.id,
        ),
        idPart(
          compatibility.id,
        ),
      ].join(":"),

      status: "candidate",

      setRoleTargetReferenceRootAuthorityId: root.id,

      setRoleActionAuthorityId: root.setRoleActionAuthorityId,

      manifestId: root.manifestId,

      manifestCode: root.manifestCode,

      actionIndex: root.actionIndex,

      actionTargetLabel: root.actionTargetLabel,

      rootMatch: root.rootMatch as
        | "exact_binding"
        | "binding_prefix_with_opaque_suffix",

      rootBindingName,

      a42RootBindingDefinitionAuthorityId: a42BindingAuthorityId,

      manifestBindingDefinitionAuthorityId: neutralBinding.id,

      entityCompatibilityId: compatibility.id,

      runtimeEntityLabel: compatibility.runtimeEntityLabel,

      canonicalNodeType: compatibility.canonicalNodeType,

      canonicalNodeTypeAuthorityId: compatibility.canonicalNodeTypeAuthorityId,

      opaqueSuffix: root.opaqueSuffix,

      governance: governance(),
    });
  }

  reasons = uniqueSorted(
    blockingReasons,
  );

  if (
    reasons.length >
      0
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

      status: "blocked",

      candidates: [],

      unrootedTargetAuthorityIds: [],

      unmappedRootedTargetAuthorityIds: [],

      blockingReasons: reasons,
    };
  }

  return {
    producer: CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

    status: "ready",

    candidates: out.sort(
      (a, b) =>
        a.id.localeCompare(
          b.id,
        ),
    ),

    unrootedTargetAuthorityIds: uniqueSorted(
      unrooted,
    ),

    unmappedRootedTargetAuthorityIds: uniqueSorted(
      unmappedRooted,
    ),

    blockingReasons: [],
  };
}
