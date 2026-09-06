import type {
  CanonicalLanguageGraphV1,
  GraphNodeType,
  GraphStatus,
  LanguageGraphNodeV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityResultV1,
  type CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1,
} from "./canonical-runtime-set-role-target-binding-entity-compatibility-v1.ts";

import {
  type CanonicalNodeTypeOccurrenceInventoryResultV1,
  readCanonicalNodeTypeOccurrenceInventoryV1,
} from "./canonical-node-type-occurrence-inventory-capability-v1.ts";

import {
  deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1,
} from "./canonical-runtime-set-role-target-type-occurrence-inventory-composition-v1.ts";

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

function node(
  id: string,
  type: GraphNodeType,
  status: GraphStatus,
): LanguageGraphNodeV1 {
  return {
    id,
    type,
    status,

    features: {},

    producer: "fixture",

    evidenceIds: [],

    provenanceIds: [],
  };
}

function graph(
  documentId: string,
  nodes: LanguageGraphNodeV1[],
): CanonicalLanguageGraphV1 {
  return {
    version: "canonical-language-graph-v1",

    documentId,

    surfaceVersion: "canonical-surface-boundary-v1",

    nodes,

    edges: [],

    evidence: [],

    provenance: [],

    alternativeSets: [],

    constraintTrace: [],

    producerState: {},

    invariants: {
      oneCanonicalGraph: true,

      stableSurfaceTokenIds: true,

      appendEvidenceDoNotReparseText: true,

      candidatesMayCoexist: true,

      resolvedFactsRequireEvidence: true,

      learnerErrorSeparateFromParserUncertainty: true,
    },
  };
}

function inventory(
  documentId: string,
  nodeType: GraphNodeType,
  nodes: LanguageGraphNodeV1[],
): CanonicalNodeTypeOccurrenceInventoryResultV1 {
  return readCanonicalNodeTypeOccurrenceInventoryV1(
    graph(
      documentId,
      nodes,
    ),
    nodeType,
  );
}

function target(
  options: {
    id?: string;
    rootMatch?:
      | "exact_binding"
      | "binding_prefix_with_opaque_suffix";
    actionTargetLabel?: string;
    canonicalNodeType?:
      CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1[
        "canonicalNodeType"
      ];
    opaqueSuffix?: string | null;
  } = {},
): CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1 {
  const rootMatch = options.rootMatch ??
    "exact_binding";

  return {
    id: options.id ??
      "a4.3:subject",

    status: "candidate",

    setRoleTargetReferenceRootAuthorityId: "a4.2:subject",

    setRoleActionAuthorityId: "a4.1:subject",

    manifestId: "manifest-a",

    manifestCode: "ir.structural.clause.subject_finite_predicate",

    actionIndex: 1,

    actionTargetLabel: options.actionTargetLabel ??
      (
        rootMatch ===
            "exact_binding"
          ? "subject"
          : "subject.head"
      ),

    rootMatch,

    rootBindingName: "subject",

    a42RootBindingDefinitionAuthorityId: "historical-a3.0:subject",

    manifestBindingDefinitionAuthorityId: "a4.3a1:subject",

    entityCompatibilityId: "a4.3a2:subject",

    runtimeEntityLabel: "phrase",

    canonicalNodeType: options.canonicalNodeType ??
      "phrase",

    canonicalNodeTypeAuthorityId: `canonical-node-type:${
      options.canonicalNodeType ??
        "phrase"
    }`,

    opaqueSuffix: rootMatch ===
        "exact_binding"
      ? null
      : (
        options.opaqueSuffix ??
          "head"
      ),

    governance: {
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
    },
  };
}

function targetResult(
  candidates: CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1[],
): CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityResultV1 {
  return {
    producer: CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,

    status: "ready",

    candidates,

    unrootedTargetAuthorityIds: [],

    unmappedRootedTargetAuthorityIds: [],

    blockingReasons: [],
  };
}

Deno.test(
  "A4.4.1 exact binding target consumes neutral type inventory and preserves all GraphStatus values",
  () => {
    const statuses: GraphStatus[] = [
      "candidate",
      "resolved",
      "rejected",
      "blocked",
      "ambiguous",
    ];

    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          target(),
        ]),
        [
          inventory(
            "document:a",
            "phrase",
            statuses.map(
              (
                status,
                index,
              ) =>
                node(
                  `phrase:${index}`,
                  "phrase",
                  status,
                ),
            ),
          ),
        ],
      );

    assert(
      result.status ===
          "ready" &&
        result.compositions.length ===
          1,
      result.blockingReasons.join(","),
    );

    assert(
      JSON.stringify(
        result.compositions[0]
          .occurrences
          .map(
            (occurrence) => occurrence.graphStatus,
          ),
      ) ===
        JSON.stringify(
          statuses,
        ),
      "GraphStatus values changed or disappeared",
    );
  },
);

Deno.test(
  "A4.4.2 zero occurrences are preserved without inventing a target",
  () => {
    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          target(),
        ]),
        [
          inventory(
            "document:a",
            "phrase",
            [],
          ),
        ],
      );

    assert(
      result.status ===
          "ready" &&
        result.compositions.length ===
          1 &&
        result.compositions[0]
            .occurrenceCount ===
          0,
      "zero occurrence inventory was not preserved",
    );
  },
);

Deno.test(
  "A4.4.3 singleton inventory remains neutral and is never promoted to resolved Runtime binding",
  () => {
    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          target(),
        ]),
        [
          inventory(
            "document:a",
            "phrase",
            [
              node(
                "phrase:only",
                "phrase",
                "candidate",
              ),
            ],
          ),
        ],
      );

    assert(
      result.status ===
          "ready" &&
        result.compositions.length ===
          1 &&
        result.compositions[0]
            .occurrenceCount ===
          1 &&
        result.compositions[0]
            .occurrences[0]
            .graphStatus ===
          "candidate" &&
        result.compositions[0]
            .governance
            .singletonPromotedToResolved ===
          false &&
        result.compositions[0]
            .governance
            .runtimeBindingOccurrenceDomainResolved ===
          false &&
        result.compositions[0]
            .governance
            .occurrenceBindingPerformed ===
          false,
      "singleton inventory became Runtime binding",
    );
  },
);

Deno.test(
  "A4.4.4 opaque dotted target is explicitly excluded from occurrence enumeration",
  () => {
    const dotted = target({
      id: "a4.3:subject.head",

      rootMatch: "binding_prefix_with_opaque_suffix",

      actionTargetLabel: "subject.head",

      opaqueSuffix: "head",
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          dotted,
        ]),
        [],
      );

    assert(
      result.status ===
          "ready" &&
        result.compositions.length ===
          0 &&
        result
            .opaqueSuffixTargetCompatibilityIds
            .length ===
          1 &&
        result
            .opaqueSuffixTargetCompatibilityIds[0] ===
          dotted.id,
      "opaque suffix target was treated as typed endpoint",
    );
  },
);

Deno.test(
  "A4.4.5 missing required neutral inventory for exact binding blocks",
  () => {
    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          target(),
        ]),
        [],
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "required_inventory_missing",
            ),
        ),
      "missing exact-type inventory was silently accepted",
    );
  },
);

Deno.test(
  "A4.4.6 duplicate neutral inventory for required node type blocks",
  () => {
    const a = inventory(
      "document:a",
      "phrase",
      [],
    );

    const b = inventory(
      "document:b",
      "phrase",
      [],
    );

    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          target(),
        ]),
        [
          a,
          b,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "duplicate_inventory",
            ),
        ),
      "duplicate inventory for same node type was accepted",
    );
  },
);

Deno.test(
  "A4.4.7 different required node types must come from same graph document snapshot",
  () => {
    const phraseTarget = target({
      id: "a4.3:phrase",

      canonicalNodeType: "phrase",
    });

    const tokenTarget = target({
      id: "a4.3:token",

      canonicalNodeType: "token",
    });

    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          phraseTarget,
          tokenTarget,
        ]),
        [
          inventory(
            "document:a",
            "phrase",
            [],
          ),

          inventory(
            "document:b",
            "token",
            [],
          ),
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0 &&
        result.blockingReasons.includes(
          "inventory_set:mixed_graph_document_identity",
        ),
      "cross-snapshot inventories were composed",
    );
  },
);

Deno.test(
  "A4.4.8 semanticized Runtime-binding inventory is rejected as stale upstream contract",
  () => {
    const source = inventory(
      "document:a",
      "phrase",
      [],
    );

    assert(
      source.inventory !==
        undefined,
      "fixture inventory missing",
    );

    const stale = {
      ...source,

      inventory: {
        ...source.inventory,

        governance: {
          ...source.inventory
            .governance,

          runtimeBindingOccurrenceDomainResolved: true,
        },
      },
    } as unknown as CanonicalNodeTypeOccurrenceInventoryResultV1;

    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          target(),
        ]),
        [
          stale,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0,
      "semanticized inventory was consumed",
    );
  },
);

Deno.test(
  "A4.4.9 occurrence-bound A4.3 target is rejected as stale upstream contract",
  () => {
    const source = target();

    const stale = {
      ...source,

      governance: {
        ...source.governance,

        occurrenceBindingPerformed: true,
      },
    } as unknown as CanonicalRuntimeSetRoleTargetBindingEntityCompatibilityV1;

    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          stale,
        ]),
        [
          inventory(
            "document:a",
            "phrase",
            [],
          ),
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.compositions.length ===
          0,
      "occurrence-bound A4.3 target was consumed",
    );
  },
);

Deno.test(
  "A4.4.10 composition resolves only graph TYPE occurrence domain and performs no sentence scope WHERE cardinality role winner or graph execution",
  () => {
    const result =
      deriveCanonicalRuntimeSetRoleTargetTypeOccurrenceInventoryCompositionsV1(
        targetResult([
          target(),
        ]),
        [
          inventory(
            "document:a",
            "phrase",
            [
              node(
                "phrase:a",
                "phrase",
                "candidate",
              ),

              node(
                "phrase:b",
                "phrase",
                "resolved",
              ),

              node(
                "phrase:c",
                "phrase",
                "rejected",
              ),
            ],
          ),
        ],
      );

    assert(
      result.status ===
          "ready" &&
        result.compositions.length ===
          1,
      result.blockingReasons.join(","),
    );

    const g = result.compositions[0]
      .governance;

    assert(
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
          true,
      "A4.4 crossed neutral type-occurrence boundary",
    );
  },
);
