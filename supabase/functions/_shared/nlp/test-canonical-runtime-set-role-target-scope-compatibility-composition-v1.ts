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

import {
  deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1,
} from "./canonical-runtime-set-role-target-scope-compatibility-composition-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

function a44Governance(): CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1[
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

function scopeGovernance(): CanonicalRuntimeManifestBindingScopeCompatibilityV1[
  "governance"
] {
  return {
    exactA43a1ResultRequired: true,

    exactManifestBindingDefinitionAuthorityRequired: true,

    exactCanonicalBoundaryAuthorityRequired: true,

    exactOpaqueLabelMatch: true,

    runtimeScopeVocabularyHardcoded: false,

    runtimeScopeLabelNormalized: false,

    caseFoldingPerformed: false,

    canonicalBoundaryInferredFromName: false,

    canonicalBoundaryAuthorityIdentityPreserved: true,

    canonicalBoundaryAuthoritySourcePreservedOpaque: true,

    scopeSemanticsResolved: false,

    containmentResolved: false,

    sentenceIdentityResolved: false,

    phraseContainmentResolved: false,

    clauseContainmentResolved: false,

    selfSemanticsResolved: false,

    occurrenceDomainResolved: false,

    occurrenceEnumerationPerformed: false,

    occurrenceBindingPerformed: false,

    whereSemanticsResolved: false,

    cardinalitySemanticsResolved: false,

    actionFamilySemanticsResolved: false,

    roleSemanticsResolved: false,

    grammaticalFunctionResolved: false,

    subjectOfRelationInferred: false,

    winnerSelected: false,

    graphMutationPerformed: false,

    compatibilityOnly: true,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

function target(
  options: {
    id?: string;
    manifestId?: string;
    manifestCode?: string;
    bindingName?: string;
    bindingAuthorityId?: string;
    graphDocumentId?: string;
    occurrences?:
      CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1[
        "occurrences"
      ];
  } = {},
): CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1 {
  const bindingName = options.bindingName ??
    "subject";

  const bindingAuthorityId = options.bindingAuthorityId ??
    "runtime-manifest-binding-definition-v1:manifest-a:ir.structural.clause.subject_finite_predicate:subject";

  const occurrences = options.occurrences ??
    [];

  return {
    id: options.id ??
      "a4.4:subject",

    status: "candidate",

    targetBindingEntityCompatibilityId: "a4.3:subject",

    setRoleTargetReferenceRootAuthorityId: "a4.2:subject",

    setRoleActionAuthorityId: "a4.1:subject",

    manifestId: options.manifestId ??
      "manifest-a",

    manifestCode: options.manifestCode ??
      "ir.structural.clause.subject_finite_predicate",

    actionIndex: 1,

    actionTargetLabel: "subject",

    rootMatch: "exact_binding",

    rootBindingName: bindingName,

    a42RootBindingDefinitionAuthorityId: "historical-a3.0:subject",

    manifestBindingDefinitionAuthorityId: bindingAuthorityId,

    entityCompatibilityId: "a4.3a2:subject",

    runtimeEntityLabel: "phrase",

    canonicalNodeType: "phrase",

    canonicalNodeTypeAuthorityId: "canonical-node-type:phrase",

    opaqueSuffix: null,

    occurrenceInventoryId: "inventory:phrase:document-a",

    graphVersion: "canonical-language-graph-v1",

    graphDocumentId: options.graphDocumentId ??
      "document:a",

    occurrences,

    occurrenceCount: occurrences.length,

    governance: a44Governance(),
  };
}

function targetResult(
  targets: CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1[],
): CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_V1,

    producerVersion:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_TYPE_OCCURRENCE_INVENTORY_COMPOSITION_VERSION_V1,

    status: "ready",

    compositions: targets,

    graphDocumentId: targets.length >
        0
      ? targets[0]!
        .graphDocumentId
      : null,

    consideredTargetCompatibilityCount: targets.length,

    enumeratedExactBindingTargetCount: targets.length,

    opaqueSuffixTargetCompatibilityIds: [],

    blockingReasons: [],
  };
}

function scope(
  options: {
    id?: string;
    bindingAuthorityId?: string;
    manifestId?: string;
    manifestCode?: string;
    bindingName?: string;
    runtimeScopeLabel?: string;
    canonicalBoundaryLabel?: string;
  } = {},
): CanonicalRuntimeManifestBindingScopeCompatibilityV1 {
  return {
    id: options.id ??
      "a4.5a1:subject",

    status: "candidate",

    bindingDefinitionAuthorityId: options.bindingAuthorityId ??
      "runtime-manifest-binding-definition-v1:manifest-a:ir.structural.clause.subject_finite_predicate:subject",

    manifestId: options.manifestId ??
      "manifest-a",

    manifestCode: options.manifestCode ??
      "ir.structural.clause.subject_finite_predicate",

    bindingName: options.bindingName ??
      "subject",

    runtimeScopeLabel: options.runtimeScopeLabel ??
      "sentence",

    canonicalBoundaryLabel: options.canonicalBoundaryLabel ??
      "sentence",

    canonicalBoundaryAuthorityId:
      "canonical-scope-boundary-authority:sentence:model-c:v1",

    canonicalBoundaryAuthoritySource:
      "canonical_sentence_scope_boundary_capability_v1",

    governance: scopeGovernance(),
  };
}

function scopeResult(
  scopes: CanonicalRuntimeManifestBindingScopeCompatibilityV1[],
): CanonicalRuntimeManifestBindingScopeCompatibilityResultV1 {
  return {
    producer: CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1,

    producerVersion: "1",

    status: "ready",

    candidates: scopes,

    unmappedBindingDefinitionAuthorityIds: [],

    blockingReasons: [],
  };
}

Deno.test(
  "A4.5a2.1 exact shared A4.3a1 authority identity attaches scope compatibility to set_role target",
  () => {
    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          target(),
        ]),
        scopeResult([
          scope(),
        ]),
      );

    assert(
      result.status ===
          "ready" &&
        result.compositions.length ===
          1,
      JSON.stringify(
        result,
      ),
    );

    const composition = result.compositions[0]!;

    assert(
      composition.manifestBindingDefinitionAuthorityId ===
          scope()
            .bindingDefinitionAuthorityId &&
        composition.runtimeScopeLabel ===
          "sentence" &&
        composition.canonicalBoundaryLabel ===
          "sentence",
      JSON.stringify(
        composition,
      ),
    );
  },
);

Deno.test(
  "A4.5a2.2 A4.4 occurrence inventory is preserved unfiltered with every GraphStatus",
  () => {
    const occurrences = [
      {
        nodeId: "phrase:candidate",
        nodeType: "phrase",
        graphStatus: "candidate",
      },
      {
        nodeId: "phrase:resolved",
        nodeType: "phrase",
        graphStatus: "resolved",
      },
      {
        nodeId: "phrase:rejected",
        nodeType: "phrase",
        graphStatus: "rejected",
      },
      {
        nodeId: "phrase:blocked",
        nodeType: "phrase",
        graphStatus: "blocked",
      },
      {
        nodeId: "phrase:ambiguous",
        nodeType: "phrase",
        graphStatus: "ambiguous",
      },
    ] as unknown as CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1[
      "occurrences"
    ];

    const source = target({
      occurrences,
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          source,
        ]),
        scopeResult([
          scope(),
        ]),
      );

    assert(
      result.status ===
          "ready" &&
        result.compositions.length ===
          1 &&
        result.compositions[0]!
            .occurrenceCount ===
          occurrences.length &&
        JSON.stringify(
            result.compositions[0]!
              .occurrences,
          ) ===
          JSON.stringify(
            occurrences,
          ),
      "A4.4 occurrence inventory was filtered or changed",
    );
  },
);

Deno.test(
  "A4.5a2.3 target without scope compatibility remains explicitly unmatched without guessing",
  () => {
    const source = target();

    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          source,
        ]),
        scopeResult(
          [],
        ),
      );

    assert(
      result.status ===
          "ready" &&
        result.compositions.length ===
          0 &&
        result.unmatchedTargetCompositionIds.length ===
          1 &&
        result.unmatchedTargetCompositionIds[0] ===
          source.id,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a2.4 duplicate scope compatibility for exact A4.3a1 binding authority blocks",
  () => {
    const a = scope({
      id: "scope:a",
    });

    const b = scope({
      id: "scope:b",
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          target(),
        ]),
        scopeResult([
          a,
          b,
        ]),
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "duplicate_scope_compatibility",
            ),
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a2.5 same binding authority id with mismatched manifest identity fails closed",
  () => {
    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          target(),
        ]),
        scopeResult([
          scope({
            manifestId: "manifest-other",
          }),
        ]),
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "scope_compatibility_identity_mismatch",
            ),
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a2.6 same binding authority id with mismatched binding name fails closed",
  () => {
    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          target(),
        ]),
        scopeResult([
          scope({
            bindingName: "predicate",
          }),
        ]),
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a2.7 sentence-filtered stale A4.4 input is rejected",
  () => {
    const source = target();

    const stale = {
      ...source,

      governance: {
        ...source.governance,

        sentenceFilteringPerformed: true,
      },
    } as unknown as CanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionV1;

    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          stale,
        ]),
        scopeResult([
          scope(),
        ]),
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "unsafe_contract",
            ),
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a2.8 phrase-containment semanticized A4.5a1 input is rejected",
  () => {
    const source = scope();

    const stale = {
      ...source,

      governance: {
        ...source.governance,

        phraseContainmentResolved: true,
      },
    } as unknown as CanonicalRuntimeManifestBindingScopeCompatibilityV1;

    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          target(),
        ]),
        scopeResult([
          stale,
        ]),
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a2.9 graph snapshot and occurrence inventory identity survive attachment unchanged",
  () => {
    const source = target({
      graphDocumentId: "document:exact-snapshot",
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          source,
        ]),
        scopeResult([
          scope(),
        ]),
      );

    const out = result.compositions[0];

    assert(
      result.status ===
          "ready" &&
        out !==
          undefined &&
        out.graphVersion ===
          source.graphVersion &&
        out.graphDocumentId ===
          source.graphDocumentId &&
        out.occurrenceInventoryId ===
          source.occurrenceInventoryId &&
        out.occurrenceCount ===
          source.occurrenceCount,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.5a2.10 composition attaches compatibility only and performs no sentence narrowing scope WHERE cardinality role winner or graph execution",
  () => {
    const result =
      deriveCanonicalRuntimeSetRoleTargetScopeCompatibilityCompositionsV1(
        targetResult([
          target(),
        ]),
        scopeResult([
          scope(),
        ]),
      );

    assert(
      result.status ===
          "ready" &&
        result.compositions.length ===
          1,
      JSON.stringify(
        result,
      ),
    );

    const g = result.compositions[0]!
      .governance;

    assert(
      g.exactA44ResultRequired ===
          true &&
        g.exactA44CompositionRequired ===
          true &&
        g.exactA45a1ResultRequired ===
          true &&
        g.exactA45a1CompatibilityRequired ===
          true &&
        g.sharedA43a1BindingAuthorityIdentityRequired ===
          true &&
        g.crossProducerBindingBridgeRequired ===
          false &&
        g.exactManifestIdentityRequired ===
          true &&
        g.exactBindingNameIdentityRequired ===
          true &&
        g.scopeCompatibilityAttached ===
          true &&
        g.scopeCompatibilityConsumedNotReconstructed ===
          true &&
        g.runtimeScopeLabelConsumedNotReread ===
          true &&
        g.canonicalBoundaryAuthorityConsumedNotInferred ===
          true &&
        g.targetTypeOccurrenceInventoryConsumedNotReconstructed ===
          true &&
        g.graphSnapshotPreserved ===
          true &&
        g.occurrenceInventoryPreservedUnfiltered ===
          true &&
        g.occurrenceCountPreserved ===
          true &&
        g.occurrenceOrderPreserved ===
          true &&
        g.occurrenceGraphStatusPreserved ===
          true &&
        g.typeOccurrenceDomainResolved ===
          true &&
        g.typeOccurrenceEnumerationAvailable ===
          true &&
        g.scopeSemanticsResolved ===
          false &&
        g.scopeExecutionPerformed ===
          false &&
        g.containmentResolved ===
          false &&
        g.phraseContainmentResolved ===
          false &&
        g.sentenceIdentityResolved ===
          false &&
        g.sentenceMembershipResolved ===
          false &&
        g.sentenceFilteringPerformed ===
          false &&
        g.sentenceIndexInspected ===
          false &&
        g.runtimeBindingOccurrenceDomainResolved ===
          false &&
        g.occurrenceBindingPerformed ===
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
        g.compatibilityCompositionOnly ===
          true &&
        g.candidateOnly ===
          true &&
        g.frozenGrammarReadOnly ===
          true,
      JSON.stringify(
        g,
      ),
    );
  },
);
