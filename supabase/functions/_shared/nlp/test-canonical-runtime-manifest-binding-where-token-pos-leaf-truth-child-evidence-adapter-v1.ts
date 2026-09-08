import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V2,
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V2,
} from "./canonical-runtime-token-pos-condition-truth-composition-v2.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3,
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3,
  type CanonicalRuntimeTokenPosConditionTruthCompositionResultV3,
} from "./canonical-runtime-token-pos-condition-truth-composition-v3.ts";

import {
  adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1,
} from "./canonical-runtime-manifest-binding-where-token-pos-leaf-truth-child-evidence-adapter-v1.ts";

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

function leafTruth(
  disposition:
    | "resolved_true"
    | "resolved_false"
    | "unresolved" = "resolved_true",
  overrides: Record<string, unknown> = {},
): CanonicalRuntimeTokenPosConditionTruthCompositionResultV3 {
  const expected = {
    id: "expected:token-pos:eq:1",

    whereShapeAuthorityId: "where-shape:1",

    leafPath: "$.any[1]",

    manifestId: "manifest:1",

    ownerBindingDefinitionAuthorityId: "binding:def:1",

    ownerBindingName: "subject",

    sourceOperatorLabelRaw: "eq",

    leftReferenceExpression: "subject.pos",

    rightOperandSnapshot: "pronoun",
  };

  const c2 = {
    expectedAuthorityId: expected.id,

    expectedAuthority: expected,
  };

  const d2a = {
    expectedAuthorityId: expected.id,

    c2ComparisonEvidence: c2,
  };

  const evidence = {
    conditionTruthCompositionId: "leaf-truth:1",

    truthDisposition: disposition,

    expectedAuthorityId: expected.id,

    d2aApplicabilityEvidence: d2a,

    governance: {
      exactD2aApplicabilityEvidenceRequired: true,

      exactD2b0TruthSemanticCapabilitySingletonRequired: true,

      preservedC2ComparisonEvidenceConsumedThroughD2aOnly: true,

      leafConditionTruthDispositionProduced: true,

      comparisonRecomputed: false,

      runtimeSentenceContextSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      compoundWhereTruthResolved: false,

      manifestConditionTruthResolved: false,

      cardinalitySemanticsResolved: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,

      frozenGrammarReadOnly: true,
    },
  };

  const v2 = {
    producer: CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V2,

    status: "ready",

    evidence,

    blockingReasons: [],
  };

  return {
    producer: CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3,

    status: "ready",

    evidence,

    sourceV2Result: v2,

    blockingReasons: [],

    governance: {
      exactD2b0ComparisonStateDomainConsumed: true,

      comparisonStateMembershipValidatedBeforeV2Delegation: true,

      missingComparisonStateBlocksFailClosed: true,

      unknownComparisonStateBlocksFailClosed: true,

      validComparisonStateDelegatesToImmutableV2: true,

      v2TruthSemanticsReimplemented: false,

      v2ContractMutated: false,

      compoundWhereTruthResolved: false,

      compoundBooleanCompositionExecuted: false,

      manifestConditionTruthResolved: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      learnerErrorClassified: false,

      graphMutationPerformed: false,

      frozenGrammarReadOnly: true,
    },

    ...overrides,
  } as unknown as CanonicalRuntimeTokenPosConditionTruthCompositionResultV3;
}

function leafNode(
  path = "$.any[1]",
  overrides: Record<string, unknown> = {},
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

    ...overrides,
  };
}

function shapeAuthority(
  overrides: Record<string, unknown> = {},
) {
  const sourceWhereShapeAuthority = {
    id: "where-shape:1",
  };

  return {
    id: "a4-6a1a:1",

    status: "candidate",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    authorityKind: "runtime_language_structural_specification",

    decisionStatus: "normative",

    sourceWhereShapeAuthorityId: "where-shape:1",

    sourceWhereShapeAuthority,

    bindingDefinitionAuthorityId: "binding:def:1",

    manifestId: "manifest:1",

    manifestCode: "manifest-code-1",

    bindingName: "subject",

    root: {
      shape: "compound_operator",

      path: "$",

      operatorKey: "any",

      encoding: "array",

      childCount: 2,

      children: [
        leafNode(
          "$.any[0]",
          {
            leftOperandSnapshot: {
              ref: "subject.type",
            },

            rightOperandSnapshot: "NP",
          },
        ),

        leafNode(),
      ],

      rawSnapshot: {},

      sourceNode: {} as never,

      sourceKind: "a4_6a1_compound_array_group",

      syntheticStructuralUpgrade: false,
    },

    unsupportedPaths: [],

    governance: {
      exactA46a1ResultRequired: true,

      exactA46a1AuthorityRequired: true,

      sourceA46a1AuthorityObjectPreservedWithoutReconstruction: true,

      sourceStructuralPathIdentityPreserved: true,

      sourceRawSnapshotMutated: false,

      operatorTruthSemanticsResolved: false,

      compoundTruthComposed: false,

      compoundBooleanCompositionExecuted: false,

      leafTruthResolved: false,

      cardinalitySemanticsResolved: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,

      frozenGrammarReadOnly: true,
    },

    ...overrides,
  };
}

function shapeResult(
  authorities = [
    shapeAuthority(),
  ],
): CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,

    status: "ready",

    authorities,

    blockingReasons: [],
  } as unknown as CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1;
}

Deno.test(
  "A4.6a1c1.1 exact adapter identity and resolved_true leaf truth becomes ready generic evidence",
  () => {
    const sourceTruth = leafTruth(
      "resolved_true",
    );

    const sourceShape = shapeResult();

    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      sourceTruth,
      sourceShape,
    );

    assert(
      result.producer ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1 &&
        result.producerVersion ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1 &&
        result.specificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1 &&
        result.status ===
          "ready" &&
        result.childTruth.status ===
          "ready" &&
        result.childTruth.evidence.truthDisposition ===
          "resolved_true" &&
        result.childTruth.evidence.nodePath ===
          "$.any[1]",
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.2 resolved_false is preserved without recomputation",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(
        "resolved_false",
      ),
      shapeResult(),
    );

    assert(
      result.status ===
          "ready" &&
        result.childTruth.status ===
          "ready" &&
        result.childTruth.evidence.truthDisposition ===
          "resolved_false" &&
        result.governance.sourceTruthRecomputed ===
          false,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.3 unresolved remains unresolved and is still ready truth evidence",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(
        "unresolved",
      ),
      shapeResult(),
    );

    assert(
      result.status ===
          "ready" &&
        result.childTruth.status ===
          "ready" &&
        result.childTruth.evidence.truthDisposition ===
          "unresolved",
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.4 exact source evidence object and source result objects are preserved",
  () => {
    const sourceTruth = leafTruth();

    const sourceShape = shapeResult();

    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      sourceTruth,
      sourceShape,
    );

    assert(
      result.status ===
          "ready" &&
        result.sourceLeafTruthResult ===
          sourceTruth &&
        result.sourceShapeResult ===
          sourceShape &&
        result.childTruth.evidence.sourceEvidenceObject ===
          sourceTruth.evidence &&
        result.childTruth.evidence.sourceEvidenceId ===
          sourceTruth.evidence?.conditionTruthCompositionId,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.5 blocked D2b1-v3 remains blocked and never becomes unresolved",
  () => {
    const blockedTruth = leafTruth(
      "resolved_true",
      {
        status: "blocked",

        evidence: undefined,

        sourceV2Result: null,

        blockingReasons: [
          "fixture_blocked",
        ],
      },
    );

    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      blockedTruth,
      shapeResult(),
    );

    assert(
      result.status ===
          "blocked" &&
        result.childTruth.status ===
          "blocked" &&
        !("evidence" in result.childTruth) &&
        result.blockingReasons.includes(
          "d2b1_v3:blocked",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.6 zero where-shape authority match blocks fail closed",
  () => {
    const sourceShape = shapeResult([
      shapeAuthority({
        sourceWhereShapeAuthorityId: "where-shape:other",

        sourceWhereShapeAuthority: {
          id: "where-shape:other",
        },
      }),
    ]);

    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      sourceShape,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "where_shape_authority_join:no_match",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.7 multiple matching where-shape authorities block",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult([
        shapeAuthority({
          id: "a4-6a1a:1",
        }),

        shapeAuthority({
          id: "a4-6a1a:2",
        }),
      ]),
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "where_shape_authority_join:multiple_matches",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.8 zero leafPath match blocks",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult([
        shapeAuthority({
          root: leafNode(
            "$.different",
          ),
        }),
      ]),
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "leaf_path_join:no_match",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.9 duplicate leafPath occurrences inside one authority block",
  () => {
    const duplicate = leafNode();

    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult([
        shapeAuthority({
          root: {
            shape: "compound_operator",

            path: "$",

            operatorKey: "any",

            encoding: "array",

            childCount: 2,

            children: [
              duplicate,
              {
                ...duplicate,
              },
            ],

            rawSnapshot: {},

            sourceNode: {} as never,

            sourceKind: "a4_6a1_compound_array_group",

            syntheticStructuralUpgrade: false,
          },
        }),
      ]),
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "leaf_path_join:multiple_matches",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.10 matching path that is not a leaf_operator blocks",
  () => {
    const sourceTruth = leafTruth();

    const expected = sourceTruth.evidence!
      .d2aApplicabilityEvidence
      .c2ComparisonEvidence
      .expectedAuthority as unknown as {
        leafPath: string;
      };

    expected.leafPath = "$";

    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      sourceTruth,
      shapeResult(),
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "leaf_path_join:not_leaf_operator",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.11 manifest identity mismatch blocks even after where-shape id match",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult([
        shapeAuthority({
          manifestId: "manifest:wrong",
        }),
      ]),
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "manifest_identity:mismatch",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.12 owner binding identity mismatch blocks",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult([
        shapeAuthority({
          bindingName: "wrong_binding",
        }),
      ]),
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "owner_binding_identity:mismatch",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.13 operator structural mismatch blocks",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult([
        shapeAuthority({
          root: leafNode(
            "$.any[1]",
            {
              operatorLabel: "future_op",
            },
          ),
        }),
      ]),
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "leaf_structure:operator_mismatch",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.14 left explicit-ref structural mismatch blocks",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult([
        shapeAuthority({
          root: leafNode(
            "$.any[1]",
            {
              leftOperandSnapshot: {
                ref: "other.pos",
              },
            },
          ),
        }),
      ]),
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "leaf_structure:left_reference_mismatch",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.15 right operand structural mismatch blocks",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult([
        shapeAuthority({
          root: leafNode(
            "$.any[1]",
            {
              rightOperandSnapshot: "verb",
            },
          ),
        }),
      ]),
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "leaf_structure:right_operand_mismatch",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1c1.16 adapter API accepts exactly source truth plus source shape and never caller nodePath",
  () => {
    assert(
      adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1.length ===
        2,
      String(
        adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1.length,
      ),
    );

    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult(),
    );

    assert(
      result.governance.callerNodePathAccepted ===
          false &&
        result.governance.whereShapeAuthorityIdJoinRequired ===
          true &&
        result.governance.leafPathJoinRequired ===
          true,
      JSON.stringify(result.governance),
    );
  },
);

Deno.test(
  "A4.6a1c1.17 adapter does not create synthetic unary-not leaf truth",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult(),
    );

    assert(
      result.governance.syntheticUnaryNotLeafTruthCreated ===
        false,
      JSON.stringify(result.governance),
    );
  },
);

Deno.test(
  "A4.6a1c1.18 adapter ceiling excludes compound manifest occurrence cardinality mutation and learner error",
  () => {
    const result = adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
      leafTruth(),
      shapeResult(),
    );

    const g = result.governance;

    assert(
      g.sourceTruthRecomputed ===
          false &&
        g.sourceComparisonRecomputed ===
          false &&
        g.compoundTruthComposed ===
          false &&
        g.compoundBooleanCompositionExecuted ===
          false &&
        g.shortCircuitExecuted ===
          false &&
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
