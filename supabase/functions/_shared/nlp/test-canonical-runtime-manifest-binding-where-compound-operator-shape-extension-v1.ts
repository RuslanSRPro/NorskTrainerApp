import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
  deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";
import {
  type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";

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

function bindingResult(
  whereClause: Record<string, unknown> | null,
): CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1 {
  const bindingDefinition: Record<string, unknown> = {
    entity: "phrase",

    scope: "sentence",

    cardinality: "one",
  };

  if (
    whereClause !==
      null
  ) {
    bindingDefinition.where = whereClause;
  }

  return deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1([
    {
      id: "manifest:a",

      code: "ir.structural.clause.subject_finite_predicate",

      authoring_status: "validated",

      runtime_family: "clause_pattern",

      execution_phase: "structural",

      ir_spec: {
        bindings: {
          subject: bindingDefinition,
        },
      },
    },
  ]);
}

function compoundResult(
  whereClause: Record<string, unknown> | null,
) {
  const source = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
    bindingResult(
      whereClause,
    ),
  );

  assert(
    source.status ===
        "ready" &&
      source.authorities.length ===
        1,
    `invalid A4.6a1 fixture: ${JSON.stringify(source)}`,
  );

  return deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1(
    source,
  );
}

Deno.test(
  "A4.6a1a.1 exact authority identity and structural Runtime specification provenance",
  () => {
    const result = compoundResult({
      all: [
        {
          op: "eq",
          left: "x",
          right: "x",
        },
        {
          op: "eq",
          left: "y",
          right: "y",
        },
      ],
    });

    const authority = result.authorities[0];

    assert(
      result.producer ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1 &&
        result.producerVersion ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1 &&
        result.status ===
          "ready" &&
        result.blockingReasons.length ===
          0 &&
        authority?.status ===
          "candidate" &&
        authority.specificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1 &&
        authority.authorityKind ===
          "runtime_language_structural_specification" &&
        authority.decisionStatus ===
          "normative",
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1a.2 all array with two children is recognized structurally",
  () => {
    const result = compoundResult({
      all: [
        {
          op: "exists",
          left: {
            ref: "clause.predicate",
          },
        },
        {
          op: "eq",
          left: {
            ref: "subject.pos",
          },
          right: "pronoun",
        },
      ],
    });

    const root = result.authorities[0]!
      .root;

    assert(
      root.shape ===
          "compound_operator" &&
        root.operatorKey ===
          "all" &&
        root.encoding ===
          "array" &&
        root.childCount ===
          2 &&
        root.children.length ===
          2 &&
        root.syntheticStructuralUpgrade ===
          false &&
        root.path ===
          "$",
      JSON.stringify(root),
    );
  },
);

Deno.test(
  "A4.6a1a.3 any array preserves three child paths and source order",
  () => {
    const result = compoundResult({
      any: [
        {
          op: "eq",
          left: "a",
          right: "a",
        },
        {
          op: "eq",
          left: "b",
          right: "b",
        },
        {
          op: "eq",
          left: "c",
          right: "c",
        },
      ],
    });

    const root = result.authorities[0]!
      .root;

    assert(
      root.shape ===
          "compound_operator" &&
        root.operatorKey ===
          "any" &&
        root.childCount ===
          3 &&
        root.children[0]?.path ===
          "$.any[0]" &&
        root.children[1]?.path ===
          "$.any[1]" &&
        root.children[2]?.path ===
          "$.any[2]",
      JSON.stringify(root),
    );
  },
);

Deno.test(
  "A4.6a1a.4 singleton all is unsupported and never receives implicit identity semantics",
  () => {
    const result = compoundResult({
      all: [
        {
          op: "eq",
          left: "x",
          right: "x",
        },
      ],
    });

    const authority = result.authorities[0]!;

    assert(
      authority.root.shape ===
          "unsupported" &&
        authority.root.reason ===
          "all_requires_array_minimum_arity_2" &&
        authority.unsupportedPaths.length ===
          1 &&
        authority.unsupportedPaths[0] ===
          "$" &&
        authority.governance.singletonGroupTruthInferred ===
          false,
      JSON.stringify(authority),
    );
  },
);

Deno.test(
  "A4.6a1a.5 empty any is unsupported and never mapped to boolean false",
  () => {
    const result = compoundResult({
      any: [],
    });

    const authority = result.authorities[0]!;

    assert(
      authority.root.shape ===
          "unsupported" &&
        authority.root.reason ===
          "any_requires_array_minimum_arity_2" &&
        authority.governance.emptyGroupTruthInferred ===
          false &&
        authority.governance.unsupportedShapeIsBooleanFalse ===
          false,
      JSON.stringify(authority),
    );
  },
);

Deno.test(
  "A4.6a1a.6 unknown array compound key stays unsupported rather than inheriting all or any meaning",
  () => {
    const result = compoundResult({
      future_group: [
        {
          op: "eq",
          left: "x",
          right: "x",
        },
        {
          op: "eq",
          left: "y",
          right: "y",
        },
      ],
    });

    const root = result.authorities[0]!
      .root;

    assert(
      root.shape ===
          "unsupported" &&
        root.reason ===
          "compound_key_not_in_a4_6a1a_vocabulary",
      JSON.stringify(root),
    );
  },
);

Deno.test(
  "A4.6a1a.7 unary object not upgrades preserved A4.6a1 raw snapshot into one structural leaf child",
  () => {
    const sourceWhere = {
      not: {
        op: "has_relation",
        left: {
          ref: "clause.id",
        },
        right: "connector_field",
      },
    };

    const source = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult(
        sourceWhere,
      ),
    );

    assert(
      source.status ===
          "ready" &&
        source.authorities[0]!
            .root.shape ===
          "unclassified" &&
        source.authorities[0]!
            .unclassifiedPaths[0] ===
          "$",
      JSON.stringify(source),
    );

    const result =
      deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1(
        source,
      );

    const root = result.authorities[0]!
      .root;

    assert(
      root.shape ===
          "compound_operator" &&
        root.operatorKey ===
          "not" &&
        root.encoding ===
          "unary_object" &&
        root.childCount ===
          1 &&
        root.syntheticStructuralUpgrade ===
          true &&
        root.children[0]?.shape ===
          "leaf_operator" &&
        root.children[0]?.path ===
          "$.not" &&
        root.children[0]?.operatorLabel ===
          "has_relation" &&
        root.children[0]?.syntheticStructuralUpgrade ===
          true,
      JSON.stringify(root),
    );
  },
);

Deno.test(
  "A4.6a1a.8 nested all containing unary object not preserves deterministic nested paths",
  () => {
    const result = compoundResult({
      all: [
        {
          op: "exists",
          left: {
            ref: "clause.predicate",
          },
        },
        {
          not: {
            op: "has_relation",
            left: {
              ref: "clause.id",
            },
            right: "connector_field",
          },
        },
      ],
    });

    const root = result.authorities[0]!
      .root;

    assert(
      root.shape ===
          "compound_operator" &&
        root.operatorKey ===
          "all" &&
        root.children[1]?.shape ===
          "compound_operator" &&
        root.children[1]?.operatorKey ===
          "not" &&
        root.children[1]?.path ===
          "$.all[1]" &&
        root.children[1]?.children[0]?.path ===
          "$.all[1].not",
      JSON.stringify(root),
    );
  },
);

Deno.test(
  "A4.6a1a.9 array-form not is explicitly unsupported",
  () => {
    const result = compoundResult({
      not: [
        {
          op: "eq",
          left: "x",
          right: "x",
        },
      ],
    });

    const root = result.authorities[0]!
      .root;

    assert(
      root.shape ===
          "unsupported" &&
        root.reason ===
          "not_requires_unary_object_encoding",
      JSON.stringify(root),
    );
  },
);

Deno.test(
  "A4.6a1a.10 unary not without leaf operator child stays unsupported",
  () => {
    const result = compoundResult({
      not: {
        future_group: [
          {
            op: "eq",
            left: "x",
            right: "x",
          },
        ],
      },
    });

    const root = result.authorities[0]!
      .root;

    assert(
      root.shape ===
          "unsupported" &&
        root.reason ===
          "not_requires_leaf_operator_child",
      JSON.stringify(root),
    );
  },
);

Deno.test(
  "A4.6a1a.11 exact A4.6a1 authority object is preserved and never reconstructed",
  () => {
    const source = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult({
        any: [
          {
            op: "eq",
            left: "x",
            right: "x",
          },
          {
            op: "eq",
            left: "y",
            right: "y",
          },
        ],
      }),
    );

    const result =
      deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1(
        source,
      );

    const authority = result.authorities[0]!;

    assert(
      authority.sourceWhereShapeAuthority ===
          source.authorities[0] &&
        authority.sourceWhereShapeAuthorityId ===
          source.authorities[0]!.id &&
        authority.governance
            .sourceA46a1AuthorityObjectPreservedWithoutReconstruction ===
          true &&
        authority.governance
            .sourceRawSnapshotMutated ===
          false,
      JSON.stringify(authority),
    );
  },
);

Deno.test(
  "A4.6a1a.12 authority ceiling excludes all truth execution cardinality mutation and learner error",
  () => {
    const result = compoundResult({
      all: [
        {
          op: "eq",
          left: "x",
          right: "x",
        },
        {
          op: "eq",
          left: "y",
          right: "y",
        },
      ],
    });

    const g = result.authorities[0]!
      .governance;

    assert(
      g.operatorTruthSemanticsResolved ===
          false &&
        g.compoundTruthComposed ===
          false &&
        g.compoundBooleanCompositionExecuted ===
          false &&
        g.shortCircuitExecuted ===
          false &&
        g.leafTruthResolved ===
          false &&
        g.manifestConditionTruthResolved ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false &&
        g.occurrenceSelectionPerformed ===
          false &&
        g.winnerSelected ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.learnerErrorClassified ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "A4.6a1a.13 stale non-exact A4.6a1 result blocks fail closed",
  () => {
    const source = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult({
        all: [
          {
            op: "eq",
            left: "x",
            right: "x",
          },
          {
            op: "eq",
            left: "y",
            right: "y",
          },
        ],
      }),
    );

    const stale = {
      ...source,

      producer: "fixture_stale_a4_6a1",
    } as unknown as typeof source;

    const result =
      deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1(
        stale,
      );

    assert(
      result.status ===
          "blocked" &&
        result.authorities.length ===
          0 &&
        result.blockingReasons.includes(
          "a4_6a1_result:not_exact_ready",
        ),
      JSON.stringify(result),
    );
  },
);
