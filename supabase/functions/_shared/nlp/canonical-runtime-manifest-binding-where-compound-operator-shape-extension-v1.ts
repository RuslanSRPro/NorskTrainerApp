import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1,
  type CanonicalRuntimeManifestBindingWhereShapeAuthorityV1,
  type CanonicalRuntimeManifestWhereShapeNodeV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";

// v1.46 A4.6a1a
//
// Compound Operator Shape Extension.
//
// Structural language specification only.
//
// Consumes the immutable A4.6a1 recursive WHERE-shape authority.
//
// It does NOT:
// - assign boolean meaning to all / any / not;
// - compose child truth;
// - short-circuit;
// - infer empty-group truth;
// - resolve manifest truth;
// - resolve cardinality;
// - mutate graph state;
// - classify learner error.
//
// A4.6a1a recognizes only source-conservative validated Runtime forms:
// - all: array with at least 2 children;
// - any: array with at least 2 children;
// - not: unary object form containing one leaf-operator child.
//
// Unknown keys and unsupported arities/encodings remain explicitly
// unsupported structural evidence, never false.
//
// A4.6a1 is immutable. Unary-object NOT is upgraded only from the
// rawSnapshot that A4.6a1 already preserves for an unclassified node.

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1 =
  "canonical_runtime_manifest_binding_where_compound_operator_shape_extension_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1 =
  "runtime_where_compound_operator_shape_a4_6a1a_v1" as const;

export type CanonicalRuntimeManifestCompoundOperatorKeyV1 =
  | "all"
  | "any"
  | "not";

type SourceLeafNodeV1 = Extract<
  CanonicalRuntimeManifestWhereShapeNodeV1,
  {
    shape: "leaf_operator";
  }
>;

type SourceAbsentNodeV1 = Extract<
  CanonicalRuntimeManifestWhereShapeNodeV1,
  {
    shape: "absent";
  }
>;

type SourceCompoundArrayNodeV1 = Extract<
  CanonicalRuntimeManifestWhereShapeNodeV1,
  {
    shape: "compound_array_group";
  }
>;

type SourceUnclassifiedNodeV1 = Extract<
  CanonicalRuntimeManifestWhereShapeNodeV1,
  {
    shape: "unclassified";
  }
>;

export type CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 =
  | {
    shape: "leaf_operator";

    path: string;

    operatorLabel: string;

    leftOperandSnapshot: unknown;

    hasRightOperand: boolean;

    rightOperandSnapshot: unknown;

    rawSnapshot: unknown;

    sourceNode: SourceLeafNodeV1 | null;

    sourceKind:
      | "a4_6a1_leaf_passthrough"
      | "a4_6a1_unclassified_unary_not_raw_child";

    syntheticStructuralUpgrade: boolean;
  }
  | {
    shape: "absent";

    path: string;

    sourceNode: SourceAbsentNodeV1;

    sourceKind: "a4_6a1_absent_passthrough";
  }
  | {
    shape: "compound_operator";

    path: string;

    operatorKey: CanonicalRuntimeManifestCompoundOperatorKeyV1;

    encoding:
      | "array"
      | "unary_object";

    childCount: number;

    children: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1[];

    rawSnapshot: unknown;

    sourceNode:
      | SourceCompoundArrayNodeV1
      | SourceUnclassifiedNodeV1;

    sourceKind:
      | "a4_6a1_compound_array_group"
      | "a4_6a1_unclassified_unary_not";

    syntheticStructuralUpgrade: boolean;
  }
  | {
    shape: "unsupported";

    path: string;

    reason:
      | "compound_key_not_in_a4_6a1a_vocabulary"
      | "all_requires_array_minimum_arity_2"
      | "any_requires_array_minimum_arity_2"
      | "not_requires_unary_object_encoding"
      | "not_requires_leaf_operator_child"
      | "unclassified_shape_not_supported";

    rawSnapshot: unknown;

    sourceNode: CanonicalRuntimeManifestWhereShapeNodeV1;
  };

export type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1 =
  {
    id: string;

    status: "candidate";

    specificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1;

    authorityKind: "runtime_language_structural_specification";

    decisionStatus: "normative";

    sourceWhereShapeAuthorityId: string;

    sourceWhereShapeAuthority:
      CanonicalRuntimeManifestBindingWhereShapeAuthorityV1;

    bindingDefinitionAuthorityId: string;

    manifestId: string;

    manifestCode: string;

    bindingName: string;

    root: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1;

    unsupportedPaths: string[];

    governance: {
      exactA46a1ResultRequired: true;

      exactA46a1AuthorityRequired: true;

      sourceA46a1AuthorityObjectPreservedWithoutReconstruction: true;

      sourceStructuralPathIdentityPreserved: true;

      sourceRawSnapshotConsumedReadOnly: true;

      sourceRawSnapshotMutated: false;

      allArrayEncodingRecognized: true;

      anyArrayEncodingRecognized: true;

      allMinimumArity: 2;

      anyMinimumArity: 2;

      unaryObjectNotEncodingRecognized: true;

      unaryNotLeafChildStructuralUpgradeExplicit: true;

      unknownCompoundKeysRemainUnsupported: true;

      unsupportedShapeIsBooleanFalse: false;

      emptyGroupTruthInferred: false;

      singletonGroupTruthInferred: false;

      operatorTruthSemanticsResolved: false;

      compoundTruthComposed: false;

      compoundBooleanCompositionExecuted: false;

      shortCircuitExecuted: false;

      leafTruthResolved: false;

      manifestConditionTruthResolved: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      occurrenceSelectionPerformed: false;

      winnerSelected: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1;

    status:
      | "ready"
      | "blocked";

    authorities:
      CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1[];

    blockingReasons: string[];
  };

function present(
  value: unknown,
): value is string {
  return typeof value ===
      "string" &&
    value.trim().length >
      0;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    );
}

function hasOwn(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  );
}

function governanceSubset(
  actual: unknown,
): boolean {
  if (
    !isRecord(
      actual,
    )
  ) {
    return false;
  }

  return (
    actual.whereShapeOnly ===
      true &&
    actual.rawSnapshotPreserved ===
      true &&
    actual.structuralPathIdentityPreserved ===
      true &&
    actual.runtimeOperatorVocabularyHardcoded ===
      false &&
    actual.compoundKeyVocabularyHardcoded ===
      false &&
    actual.operatorSemanticsResolved ===
      false &&
    actual.compoundSemanticsResolved ===
      false &&
    actual.compoundBooleanCompositionExecuted ===
      false &&
    actual.comparisonPerformed ===
      false &&
    actual.cardinalitySemanticsResolved ===
      false &&
    actual.graphMutationPerformed ===
      false &&
    actual.learnerErrorClassified ===
      false &&
    actual.frozenGrammarReadOnly ===
      true
  );
}

function exactA46a1Authority(
  authority: CanonicalRuntimeManifestBindingWhereShapeAuthorityV1,
): boolean {
  return authority.status ===
      "candidate" &&
    present(
      authority.id,
    ) &&
    present(
      authority.bindingDefinitionAuthorityId,
    ) &&
    present(
      authority.manifestId,
    ) &&
    present(
      authority.manifestCode,
    ) &&
    present(
      authority.bindingName,
    ) &&
    governanceSubset(
      authority.governance,
    );
}

function blockedResult(
  reasons: string[],
): CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,

    status: "blocked",

    authorities: [],

    blockingReasons: Array.from(
      new Set(
        reasons,
      ),
    ).sort(),
  };
}

function leafFromSource(
  node: SourceLeafNodeV1,
): CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 {
  return {
    shape: "leaf_operator",

    path: node.path,

    operatorLabel: node.operatorLabel,

    leftOperandSnapshot: node.leftOperandSnapshot,

    hasRightOperand: node.hasRightOperand,

    rightOperandSnapshot: node.rightOperandSnapshot,

    rawSnapshot: node.rawSnapshot,

    sourceNode: node,

    sourceKind: "a4_6a1_leaf_passthrough",

    syntheticStructuralUpgrade: false,
  };
}

function unsupported(
  node: CanonicalRuntimeManifestWhereShapeNodeV1,
  reason: Extract<
    CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
    {
      shape: "unsupported";
    }
  >["reason"],
): CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 {
  const rawSnapshot = node.shape ===
      "absent"
    ? undefined
    : node.rawSnapshot;

  return {
    shape: "unsupported",

    path: node.path,

    reason,

    rawSnapshot,

    sourceNode: node,
  };
}

function unaryNotFromUnclassified(
  node: SourceUnclassifiedNodeV1,
): CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 | null {
  if (
    !isRecord(
      node.rawSnapshot,
    )
  ) {
    return null;
  }

  const keys = Object.keys(
    node.rawSnapshot,
  );

  if (
    keys.length !==
      1 ||
    keys[0] !==
      "not"
  ) {
    return null;
  }

  const childRaw = node.rawSnapshot.not;

  if (
    !isRecord(
      childRaw,
    )
  ) {
    return unsupported(
      node,
      "not_requires_unary_object_encoding",
    );
  }

  if (
    !present(
      childRaw.op,
    )
  ) {
    return unsupported(
      node,
      "not_requires_leaf_operator_child",
    );
  }

  const hasRightOperand = hasOwn(
    childRaw,
    "right",
  );

  const child: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 = {
    shape: "leaf_operator",

    path: `${node.path}.not`,

    operatorLabel: childRaw.op,

    leftOperandSnapshot: childRaw.left,

    hasRightOperand,

    rightOperandSnapshot: hasRightOperand ? childRaw.right : undefined,

    rawSnapshot: childRaw,

    sourceNode: null,

    sourceKind: "a4_6a1_unclassified_unary_not_raw_child",

    syntheticStructuralUpgrade: true,
  };

  return {
    shape: "compound_operator",

    path: node.path,

    operatorKey: "not",

    encoding: "unary_object",

    childCount: 1,

    children: [
      child,
    ],

    rawSnapshot: node.rawSnapshot,

    sourceNode: node,

    sourceKind: "a4_6a1_unclassified_unary_not",

    syntheticStructuralUpgrade: true,
  };
}

function extendNode(
  node: CanonicalRuntimeManifestWhereShapeNodeV1,
): CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 {
  switch (
    node.shape
  ) {
    case "absent":
      return {
        shape: "absent",

        path: node.path,

        sourceNode: node,

        sourceKind: "a4_6a1_absent_passthrough",
      };

    case "leaf_operator":
      return leafFromSource(
        node,
      );

    case "compound_array_group": {
      if (
        node.compoundKey ===
          "not"
      ) {
        return unsupported(
          node,
          "not_requires_unary_object_encoding",
        );
      }

      if (
        node.compoundKey !==
          "all" &&
        node.compoundKey !==
          "any"
      ) {
        return unsupported(
          node,
          "compound_key_not_in_a4_6a1a_vocabulary",
        );
      }

      if (
        node.children.length <
          2
      ) {
        return unsupported(
          node,
          node.compoundKey ===
              "all"
            ? "all_requires_array_minimum_arity_2"
            : "any_requires_array_minimum_arity_2",
        );
      }

      return {
        shape: "compound_operator",

        path: node.path,

        operatorKey: node.compoundKey,

        encoding: "array",

        childCount: node.children.length,

        children: node.children.map(
          extendNode,
        ),

        rawSnapshot: node.rawSnapshot,

        sourceNode: node,

        sourceKind: "a4_6a1_compound_array_group",

        syntheticStructuralUpgrade: false,
      };
    }

    case "unclassified": {
      const unaryNot = unaryNotFromUnclassified(
        node,
      );

      if (
        unaryNot !==
          null
      ) {
        return unaryNot;
      }

      return unsupported(
        node,
        "unclassified_shape_not_supported",
      );
    }
  }
}

function collectUnsupportedPaths(
  node: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
): string[] {
  if (
    node.shape ===
      "unsupported"
  ) {
    return [
      node.path,
    ];
  }

  if (
    node.shape !==
      "compound_operator"
  ) {
    return [];
  }

  return node.children
    .flatMap(
      collectUnsupportedPaths,
    )
    .sort();
}

function authorityId(
  sourceAuthorityId: string,
): string {
  return [
    "runtime-manifest-binding-where-compound-operator-shape-a4-6a1a-v1",
    encodeURIComponent(
      sourceAuthorityId,
    ),
  ].join(
    ":",
  );
}

function governance(): CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1[
  "governance"
] {
  return {
    exactA46a1ResultRequired: true,

    exactA46a1AuthorityRequired: true,

    sourceA46a1AuthorityObjectPreservedWithoutReconstruction: true,

    sourceStructuralPathIdentityPreserved: true,

    sourceRawSnapshotConsumedReadOnly: true,

    sourceRawSnapshotMutated: false,

    allArrayEncodingRecognized: true,

    anyArrayEncodingRecognized: true,

    allMinimumArity: 2,

    anyMinimumArity: 2,

    unaryObjectNotEncodingRecognized: true,

    unaryNotLeafChildStructuralUpgradeExplicit: true,

    unknownCompoundKeysRemainUnsupported: true,

    unsupportedShapeIsBooleanFalse: false,

    emptyGroupTruthInferred: false,

    singletonGroupTruthInferred: false,

    operatorTruthSemanticsResolved: false,

    compoundTruthComposed: false,

    compoundBooleanCompositionExecuted: false,

    shortCircuitExecuted: false,

    leafTruthResolved: false,

    manifestConditionTruthResolved: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforcementPerformed: false,

    occurrenceSelectionPerformed: false,

    winnerSelected: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1(
  sourceResult: CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1,
): CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1 {
  if (
    sourceResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1 ||
    sourceResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1 ||
    sourceResult.status !==
      "ready" ||
    sourceResult.blockingReasons.length !==
      0
  ) {
    return blockedResult([
      "a4_6a1_result:not_exact_ready",
    ]);
  }

  const seenIds = new Set<string>();

  for (
    const authority of sourceResult.authorities
  ) {
    if (
      seenIds.has(
        authority.id,
      )
    ) {
      return blockedResult([
        `a4_6a1_authority:${authority.id}:duplicate`,
      ]);
    }

    seenIds.add(
      authority.id,
    );

    if (
      !exactA46a1Authority(
        authority,
      )
    ) {
      return blockedResult([
        `a4_6a1_authority:${authority.id}:unsafe_contract`,
      ]);
    }
  }

  const authorities = sourceResult.authorities
    .map(
      (
        sourceAuthority,
      ): CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1 => {
        const root = extendNode(
          sourceAuthority.root,
        );

        return {
          id: authorityId(
            sourceAuthority.id,
          ),

          status: "candidate",

          specificationId:
            CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

          authorityKind: "runtime_language_structural_specification",

          decisionStatus: "normative",

          sourceWhereShapeAuthorityId: sourceAuthority.id,

          sourceWhereShapeAuthority: sourceAuthority,

          bindingDefinitionAuthorityId:
            sourceAuthority.bindingDefinitionAuthorityId,

          manifestId: sourceAuthority.manifestId,

          manifestCode: sourceAuthority.manifestCode,

          bindingName: sourceAuthority.bindingName,

          root,

          unsupportedPaths: collectUnsupportedPaths(
            root,
          ),

          governance: governance(),
        };
      },
    )
    .sort(
      (
        a,
        b,
      ) =>
        a.id.localeCompare(
          b.id,
        ),
    );

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,

    status: "ready",

    authorities,

    blockingReasons: [],
  };
}
