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

Deno.test(
  "A4.6a1.1 compound WHERE preserves opaque key and child structural shapes without truth semantics",
  () => {
    const sourceWhere = {
      any: [
        {
          op: "eq",

          left: {
            ref: "subject.type",
          },

          right: "NP",
        },

        {
          op: "eq",

          left: {
            ref: "subject.pos",
          },

          right: "pronoun",
        },
      ],
    };

    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult(
        sourceWhere,
      ),
    );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          1,
      JSON.stringify(
        result,
      ),
    );

    const root = result.authorities[0]!
      .root;

    assert(
      root.shape ===
          "compound_array_group" &&
        root.compoundKey ===
          "any" &&
        root.children.length ===
          2 &&
        root.children.every(
          (child) =>
            child.shape ===
              "leaf_operator",
        ),
      JSON.stringify(
        root,
      ),
    );

    const g = result.authorities[0]!
      .governance;

    assert(
      g.compoundSemanticsResolved ===
          false &&
        g.compoundBooleanCompositionExecuted ===
          false &&
        g.operatorSemanticsResolved ===
          false,
      JSON.stringify(
        g,
      ),
    );
  },
);

Deno.test(
  "A4.6a1.2 leaf WHERE preserves opaque operator and operand snapshots",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult({
        op: "future_operator",

        left: {
          ref: "subject.future",
        },

        right: {
          arbitrary: true,
        },
      }),
    );

    const root = result.authorities[0]!
      .root;

    assert(
      result.status ===
          "ready" &&
        root.shape ===
          "leaf_operator" &&
        root.operatorLabel ===
          "future_operator" &&
        root.hasRightOperand ===
          true &&
        JSON.stringify(
            root.leftOperandSnapshot,
          ) ===
          JSON.stringify({
            ref: "subject.future",
          }) &&
        JSON.stringify(
            root.rightOperandSnapshot,
          ) ===
          JSON.stringify({
            arbitrary: true,
          }),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.6a1.3 absent WHERE remains explicit absent rather than false",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult(
        null,
      ),
    );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          1 &&
        result.authorities[0]!
            .root.shape ===
          "absent" &&
        result.authorities[0]!
            .unclassifiedPaths.length ===
          0,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.6a1.4 unknown object WHERE remains unclassified without invented semantics",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult({
        future: "shape",
      }),
    );

    assert(
      result.status ===
          "ready" &&
        result.authorities[0]!
            .root.shape ===
          "unclassified" &&
        result.authorities[0]!
            .unclassifiedPaths.length ===
          1 &&
        result.authorities[0]!
            .unclassifiedPaths[0] ===
          "$",
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.6a1.5 compound key vocabulary is not hardcoded",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult({
        future_group: [
          {
            op: "opaque_op",

            left: "opaque",
          },
        ],
      }),
    );

    const root = result.authorities[0]!
      .root;

    assert(
      result.status ===
          "ready" &&
        root.shape ===
          "compound_array_group" &&
        root.compoundKey ===
          "future_group",
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.6a1.6 nested compound paths are deterministic structural identities only",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult({
        outer: [
          {
            inner: [
              {
                op: "opaque",

                left: "x",
              },
            ],
          },
        ],
      }),
    );

    const root = result.authorities[0]!
      .root;

    assert(
      root.shape ===
          "compound_array_group" &&
        root.children[0]
            ?.shape ===
          "compound_array_group",
      JSON.stringify(
        root,
      ),
    );

    const inner = root.children[0];

    assert(
      inner?.shape ===
          "compound_array_group" &&
        inner.path ===
          "$.outer[0]" &&
        inner.children[0]
            ?.path ===
          "$.outer[0].inner[0]",
      JSON.stringify(
        inner,
      ),
    );
  },
);

Deno.test(
  "A4.6a1.7 duplicate A4.3a1 binding authority identity blocks",
  () => {
    const source = bindingResult({
      op: "eq",

      left: "x",

      right: "y",
    });

    assert(
      source.authorities.length ===
        1,
      "invalid fixture",
    );

    const duplicate = {
      ...source,

      authorities: [
        source.authorities[0]!,
        {
          ...source.authorities[0]!,
        },
      ],
    };

    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      duplicate,
    );

    assert(
      result.status ===
          "blocked" &&
        result.authorities.length ===
          0 &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              ":duplicate",
            ),
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.6a1.8 semanticized or occurrence-bound A4.3a1 input is rejected as stale",
  () => {
    const source = bindingResult({
      op: "eq",

      left: "x",

      right: "y",
    });

    const original = source.authorities[0]!;

    const stale = {
      ...source,

      authorities: [
        {
          ...original,

          governance: {
            ...original.governance,

            whereSemanticsResolved: true,

            occurrenceBindingPerformed: true,
          },
        },
      ],
    } as unknown as CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1;

    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      stale,
    );

    assert(
      result.status ===
          "blocked" &&
        result.authorities.length ===
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
  "A4.6a1.9 returned WHERE snapshots are detached from upstream mutation",
  () => {
    const source = bindingResult({
      future_group: [
        {
          op: "opaque",

          left: {
            ref: "subject.x",
          },

          right: "value",
        },
      ],
    });

    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      source,
    );

    const before = JSON.stringify(
      result.authorities[0]!
        .root,
    );

    const where = source.authorities[0]!
      .whereClause;

    if (
      where &&
      Array.isArray(
        where.future_group,
      )
    ) {
      where.future_group.push({
        mutated: true,
      });
    }

    const after = JSON.stringify(
      result.authorities[0]!
        .root,
    );

    assert(
      before ===
        after,
      "A4.6a1 output changed after upstream mutation",
    );
  },
);

Deno.test(
  "A4.6a1.10 governance confirms structural shape only with no WHERE truth occurrence scope cardinality role or graph execution",
  () => {
    const result = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult({
        any: [
          {
            op: "eq",

            left: {
              ref: "subject.type",
            },

            right: "NP",
          },
        ],
      }),
    );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          1,
      JSON.stringify(
        result,
      ),
    );

    const g = result.authorities[0]!
      .governance;

    assert(
      g.exactA43a1ResultRequired ===
          true &&
        g.exactManifestBindingDefinitionAuthorityRequired ===
          true &&
        g.whereClauseConsumedFromA43a1 ===
          true &&
        g.whereClauseReadOnly ===
          true &&
        g.whereShapeOnly ===
          true &&
        g.rawSnapshotPreserved ===
          true &&
        g.structuralPathIdentityPreserved ===
          true &&
        g.runtimeOperatorVocabularyHardcoded ===
          false &&
        g.compoundKeyVocabularyHardcoded ===
          false &&
        g.operatorSemanticsResolved ===
          false &&
        g.compoundSemanticsResolved ===
          false &&
        g.compoundBooleanCompositionExecuted ===
          false &&
        g.referenceSemanticsResolved ===
          false &&
        g.dottedReferenceTraversalPerformed ===
          false &&
        g.leftOperandSemanticsResolved ===
          false &&
        g.rightOperandSemanticsResolved ===
          false &&
        g.canonicalFactOwnershipResolved ===
          false &&
        g.comparisonPerformed ===
          false &&
        g.valueCoercionPerformed ===
          false &&
        g.caseNormalizationPerformed ===
          false &&
        g.occurrenceDomainResolved ===
          false &&
        g.occurrenceEnumerationPerformed ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.occurrenceBindingPerformed ===
          false &&
        g.sentenceMembershipResolved ===
          false &&
        g.runtimeScopeExecutionPerformed ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
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
