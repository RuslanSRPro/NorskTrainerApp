import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereTokenPosLeafTruthChildEvidenceAdapterResultV1,
} from "./canonical-runtime-manifest-binding-where-token-pos-leaf-truth-child-evidence-adapter-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
} from "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts";

import {
  adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,
} from "./canonical-runtime-manifest-binding-where-token-pos-authority-bound-child-truth-adapter-v1.ts";

type SourceResultV1 =
  CanonicalRuntimeManifestBindingWhereTokenPosLeafTruthChildEvidenceAdapterResultV1;

type ReadySourceV1 = Extract<
  SourceResultV1,
  {
    status: "ready";
  }
>;

function assert(
  condition: unknown,
  message = "assertion failed",
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

const SOURCE_GOVERNANCE = {
  exactD2b1V3ResultRequired: true,

  exactPreservedD2b1V2ResultRequired: true,

  exactPreservedV2EvidenceIdentityRequired: true,

  preservedD2aC2ExpectedAuthorityLineageConsumed: true,

  exactA46a1aResultRequired: true,

  exactA46a1aAuthorityContractRequired: true,

  whereShapeAuthorityIdJoinRequired: true,

  whereShapeAuthorityJoinMustBeUnique: true,

  exactManifestIdentityConsistencyRequired: true,

  exactOwnerBindingIdentityConsistencyRequired: true,

  leafPathJoinRequired: true,

  leafPathJoinMustBeUnique: true,

  matchedNodeMustBeLeafOperator: true,

  exactLeafOperatorLabelConsistencyRequired: true,

  exactLeafReferenceWrapperConsistencyRequired: true,

  exactLeafRightOperandConsistencyRequired: true,

  callerNodePathAccepted: false,

  sourceTruthRecomputed: false,

  sourceComparisonRecomputed: false,

  structuralPathInferredWithoutAuthority: false,

  childTruthEvidenceAdapted: true,

  syntheticUnaryNotLeafTruthCreated: false,

  compoundTruthComposed: false,

  compoundBooleanCompositionExecuted: false,

  shortCircuitExecuted: false,

  manifestConditionTruthResolved: false,

  runtimeSentenceContextSelected: false,

  occurrenceFilteringPerformed: false,

  occurrenceWinnerSelected: false,

  finalRuntimeOccurrenceBindingPerformed: false,

  cardinalitySemanticsResolved: false,

  cardinalityEnforcementPerformed: false,

  graphMutationPerformed: false,

  learnerErrorClassified: false,

  frozenGrammarReadOnly: true,
} as const;

function leaf(
  path = "$.any[1]",
) {
  return {
    shape: "leaf_operator",

    path,

    operatorLabel: "eq",

    leftOperandSnapshot: {
      ref: "subject.pos",
    },

    hasRightOperand: true,

    rightOperandSnapshot: "pronoun",

    rawSnapshot: {
      op: "eq",

      left: {
        ref: "subject.pos",
      },

      right: "pronoun",
    },

    sourceNode: null,

    sourceKind: "a4_6a1_leaf_passthrough",

    syntheticStructuralUpgrade: false,
  } as const;
}

function siblingLeaf() {
  return {
    ...leaf(
      "$.any[0]",
    ),

    leftOperandSnapshot: {
      ref: "subject.type",
    },

    rightOperandSnapshot: "NP",
  } as const;
}

function childTruthEvidence(
  path = "$.any[1]",
) {
  const sourceObject = {
    truth: "fixture",
  };

  return {
    childTruthEvidenceId: "child-truth:token-pos:fixture",

    nodePath: path,

    sourceKind: "leaf_condition_truth",

    truthDisposition: "resolved_true",

    sourceProducer: "fixture_source_truth",

    sourceProducerVersion: "1",

    sourceEvidenceId: "fixture_source_evidence",

    sourceEvidenceObject: sourceObject,

    provenance: {
      exactStructuralNodePathClaimed: true,

      truthDispositionSuppliedBySourceAuthority: true,

      sourceProducerIdentityPreserved: true,

      sourceEvidenceIdentityPreserved: true,

      sourceEvidenceObjectPreservedWithoutReconstruction: true,

      truthRecomputedByInterface: false,

      booleanTruthInferredByInterface: false,
    },
  } as const;
}

function makeReadySource(): ReadySourceV1 {
  const target = leaf();

  const sibling = siblingLeaf();

  const root = {
    shape: "compound_operator",

    path: "$",

    operatorKey: "any",

    encoding: "array",

    childCount: 2,

    children: [
      sibling,
      target,
    ],

    rawSnapshot: {
      any: [
        sibling.rawSnapshot,
        target.rawSnapshot,
      ],
    },

    sourceNode: null,

    sourceKind: "a4_6a1_compound_array_group",

    syntheticStructuralUpgrade: false,
  } as const;

  const authority = {
    id: "a4-6a1a:fixture:subject",

    status: "candidate",

    specificationId: "runtime_where_compound_operator_shape_a4_6a1a_v1",

    authorityKind: "runtime_language_structural_specification",

    decisionStatus: "normative",

    sourceWhereShapeAuthorityId: "a4-6a1:fixture:subject",

    sourceWhereShapeAuthority: {
      id: "a4-6a1:fixture:subject",
    },

    bindingDefinitionAuthorityId: "binding-definition:fixture:subject",

    manifestId: "manifest:fixture",

    manifestCode: "fixture.manifest",

    bindingName: "subject",

    root,

    unsupportedPaths: [],

    governance: {},
  } as const;

  const evidence = childTruthEvidence();

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1,

    status: "ready",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1,

    interfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1
        .childTruthEvidenceInterfaceSpecificationId,

    sourceLeafTruthResult: {
      fixture: true,
    },

    sourceShapeResult: {
      producer: "fixture",

      producerVersion: "1",

      status: "ready",

      authorities: [
        authority,
      ],

      blockingReasons: [],

      governance: {},
    },

    matchedShapeAuthority: authority,

    matchedLeafNode: target,

    childTruth: {
      status: "ready",

      evidence,

      blockingReasons: [],
    },

    blockingReasons: [],

    governance: SOURCE_GOVERNANCE,
  } as unknown as ReadySourceV1;
}

function makeBlockedSource(): SourceResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1,

    status: "blocked",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1,

    interfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1
        .childTruthEvidenceInterfaceSpecificationId,

    sourceLeafTruthResult: {
      fixture: true,
    },

    sourceShapeResult: {
      producer: "fixture",

      producerVersion: "1",

      status: "blocked",

      authorities: [],

      blockingReasons: [
        "fixture_shape_blocked",
      ],

      governance: {},
    },

    matchedShapeAuthority: null,

    matchedLeafNode: null,

    childTruth: {
      status: "blocked",

      blockingReasons: [
        "fixture_child_truth_blocked",
      ],
    },

    blockingReasons: [
      "fixture_source_blocked",
    ],

    governance: SOURCE_GOVERNANCE,
  } as unknown as SourceResultV1;
}

Deno.test(
  "A4.6a1c2a.1 exact READY A4.6a1c1 becomes READY authority-bound child truth",
  () => {
    const source = makeReadySource();

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.producer ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1 &&
        result.producerVersion ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1 &&
        result.specificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1 &&
        result.authorityBoundInterfaceSpecificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1 &&
        result.status ===
          "ready" &&
        result.authorityBoundChildTruth.status ===
          "ready",
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.2 structuralAuthorityId is exact matchedShapeAuthority identity",
  () => {
    const source = makeReadySource();

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.status ===
        "ready",
      JSON.stringify(result),
    );

    assert(
      result.authorityBoundChildTruth
        .evidence
        .structuralAuthorityId ===
        source.matchedShapeAuthority.id,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.3 nodePath is exact across matched leaf preserved child truth and bound evidence",
  () => {
    const source = makeReadySource();

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.status ===
        "ready",
      JSON.stringify(result),
    );

    const path = source.childTruth.evidence.nodePath;

    assert(
      source.matchedLeafNode.path ===
          path &&
        result.authorityBoundChildTruth
            .evidence
            .nodePath ===
          path,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.4 exact A4.6a1c childTruth evidence object is preserved by reference",
  () => {
    const source = makeReadySource();

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.status ===
        "ready",
      JSON.stringify(result),
    );

    assert(
      result.sourceResult ===
          source &&
        result.authorityBoundChildTruth
            .evidence
            .childTruthEvidence ===
          source.childTruth.evidence &&
        result.authorityBoundChildTruth
            .evidence
            .childTruthEvidence
            .sourceEvidenceObject ===
          source.childTruth.evidence
            .sourceEvidenceObject,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.5 blocked A4.6a1c1 stays blocked with no invented authority path evidence",
  () => {
    const source = makeBlockedSource();

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.status ===
          "blocked" &&
        result.sourceResult ===
          source &&
        result.authorityBoundChildTruth.status ===
          "blocked" &&
        !(
          "evidence" in
            result.authorityBoundChildTruth
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.6 stale producer version specification or interface blocks fail closed",
  () => {
    const base = makeReadySource();

    const variants = [
      {
        ...base,
        producer: "stale_producer",
      },
      {
        ...base,
        producerVersion: "stale_version",
      },
      {
        ...base,
        specificationId: "stale_specification",
      },
      {
        ...base,
        interfaceSpecificationId: "stale_interface",
      },
    ] as unknown as SourceResultV1[];

    for (
      const source of variants
    ) {
      const result =
        adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
          source,
        );

      assert(
        result.status ===
            "blocked" &&
          result.authorityBoundChildTruth.status ===
            "blocked",
        JSON.stringify(result),
      );
    }
  },
);

Deno.test(
  "A4.6a1c2a.7 childTruth nodePath mismatch blocks",
  () => {
    const base = makeReadySource();

    const source = {
      ...base,

      childTruth: {
        ...base.childTruth,

        evidence: {
          ...base.childTruth.evidence,

          nodePath: "$.any[0]",
        },
      },
    } as unknown as SourceResultV1;

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "matched_leaf_path:does_not_equal_child_truth_node_path",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.8 matched leaf absent from authority tree blocks",
  () => {
    const base = makeReadySource();

    const authority = {
      ...base.matchedShapeAuthority,

      root: {
        ...base.matchedShapeAuthority.root,

        children: [
          base.matchedShapeAuthority
              .root.shape ===
              "compound_operator"
            ? base.matchedShapeAuthority
              .root.children[0]!
            : base.matchedLeafNode,
        ],
      },
    };

    const source = {
      ...base,

      sourceShapeResult: {
        ...base.sourceShapeResult,

        authorities: [
          authority,
        ],
      },

      matchedShapeAuthority: authority,
    } as unknown as SourceResultV1;

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "matched_leaf_path:not_found_in_matched_authority",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.9 reconstructed same-path matched leaf object blocks",
  () => {
    const base = makeReadySource();

    const reconstructedLeaf = {
      ...base.matchedLeafNode,
    };

    const source = {
      ...base,

      matchedLeafNode: reconstructedLeaf,
    } as unknown as SourceResultV1;

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "matched_leaf_object:not_exact_authority_tree_object",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.10 duplicate same-path node occurrence blocks",
  () => {
    const base = makeReadySource();

    assert(
      base.matchedShapeAuthority
        .root.shape ===
        "compound_operator",
    );

    const duplicate = {
      ...base.matchedLeafNode,
    };

    const authority = {
      ...base.matchedShapeAuthority,

      root: {
        ...base.matchedShapeAuthority.root,

        children: [
          ...base.matchedShapeAuthority
            .root.children,

          duplicate,
        ],

        childCount: base.matchedShapeAuthority
          .root.children.length +
          1,
      },
    };

    const source = {
      ...base,

      sourceShapeResult: {
        ...base.sourceShapeResult,

        authorities: [
          authority,
        ],
      },

      matchedShapeAuthority: authority,
    } as unknown as SourceResultV1;

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "matched_leaf_path:not_unique_in_matched_authority",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.11 adapter API arity is exactly one",
  () => {
    assert(
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1
        .length ===
        1,
      String(
        adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1
          .length,
      ),
    );
  },
);

Deno.test(
  "A4.6a1c2a.12 caller authority and node path are not accepted by the adapter contract",
  () => {
    const source = makeReadySource();

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.governance
            .callerStructuralAuthorityIdAccepted ===
          false &&
        result.governance
            .callerNodePathAccepted ===
          false &&
        result.governance
            .callerMatchedAuthorityAccepted ===
          false &&
        result.governance
            .callerMatchedLeafAccepted ===
          false &&
        result.governance
            .callerChildTruthEvidenceAccepted ===
          false &&
        result.governance
            .secondExternalAuthoritySearchPerformed ===
          false,
      JSON.stringify(result.governance),
    );
  },
);

Deno.test(
  "A4.6a1c2a.13 adapter does not duplicate or recompute truth",
  () => {
    const source = makeReadySource();

    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        source,
      );

    assert(
      result.status ===
        "ready",
      JSON.stringify(result),
    );

    assert(
      result.governance
            .sourceTruthRecomputed ===
          false &&
        result.governance
            .truthDispositionDuplicatedAtBindingLayer ===
          false &&
        !(
          "truthDisposition" in
            result.authorityBoundChildTruth
              .evidence
        ) &&
        result.authorityBoundChildTruth
            .evidence
            .childTruthEvidence
            .truthDisposition ===
          source.childTruth.evidence
            .truthDisposition,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c2a.14 adapter performs no compound truth composition",
  () => {
    const result =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        makeReadySource(),
      );

    assert(
      result.governance
            .compoundTruthComposed ===
          false &&
        result.governance
            .compoundBooleanCompositionExecuted ===
          false &&
        result.governance
            .shortCircuitExecuted ===
          false,
      JSON.stringify(result.governance),
    );
  },
);

Deno.test(
  "A4.6a1c2a.15 adapter ceiling excludes manifest context occurrence cardinality mutation and learner error",
  () => {
    const g =
      adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
        makeReadySource(),
      ).governance;

    assert(
      g.manifestConditionTruthResolved ===
          false &&
        g.runtimeSentenceContextSelected ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.learnerErrorClassified ===
          false &&
        g.frozenGrammarReadOnly ===
          true,
      JSON.stringify(g),
    );
  },
);
