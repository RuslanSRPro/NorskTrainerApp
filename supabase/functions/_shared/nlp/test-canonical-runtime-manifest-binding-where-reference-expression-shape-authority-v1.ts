import {
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  type CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1,
  deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-reference-expression-shape-authority-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (
    !condition
  ) {
    throw new Error(
      message,
    );
  }
}

function shapeResult(
  whereClause: Record<string, unknown> | null,
): CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1 {
  const definition: Record<string, unknown> = {
    entity: "phrase",

    scope: "sentence",

    cardinality: "one",
  };

  if (
    whereClause !==
      null
  ) {
    definition.where = whereClause;
  }

  const bindings = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
    [
      {
        id: "manifest:a",

        code: "ir.structural.clause.subject_finite_predicate",

        authoring_status: "validated",

        runtime_family: "clause",

        execution_phase: "clause_build",

        ir_spec: {
          bindings: {
            subject: definition,
          },
        },
      },
    ],
  );

  return deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
    bindings,
  );
}

Deno.test(
  "A4.6a2a0c.1 exact {ref:string} left wrapper becomes opaque reference-expression candidate",
  () => {
    const result =
      deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
        shapeResult({
          op: "eq",

          left: {
            ref: "subject.pos",
          },

          right: "pronoun",
        }),
      );

    assert(
      result.status ===
          "ready" &&
        result.examinedLeafCount ===
          1 &&
        result.recognizedReferenceLeafCount ===
          1 &&
        result.authorities.length ===
          1,
      JSON.stringify(
        result,
      ),
    );

    const authority = result.authorities[0]!;

    assert(
      authority.referenceEncoding ===
          "explicit_ref_wrapper_v1" &&
        authority.referenceExpression ===
          "subject.pos" &&
        authority.leafPath ===
          "$" &&
        authority.operatorLabelOpaque ===
          "eq",
      JSON.stringify(
        authority,
      ),
    );
  },
);

Deno.test(
  "A4.6a2a0c.2 compound leaves are discovered structurally without compound truth",
  () => {
    const result =
      deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
        shapeResult({
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
        }),
      );

    assert(
      result.status ===
          "ready" &&
        result.examinedLeafCount ===
          2 &&
        result.authorities.length ===
          2 &&
        result.authorities.some(
          (x) =>
            x.leafPath ===
              "$.any[0]" &&
            x.referenceExpression ===
              "subject.type",
        ) &&
        result.authorities.some(
          (x) =>
            x.leafPath ===
              "$.any[1]" &&
            x.referenceExpression ===
              "subject.pos",
        ),
      JSON.stringify(
        result,
      ),
    );

    assert(
      result.authorities.every(
        (x) =>
          x.governance
              .compoundSemanticsResolved ===
            false &&
          x.governance
              .compoundBooleanCompositionExecuted ===
            false,
      ),
      "compound semantics leaked",
    );
  },
);

Deno.test(
  "A4.6a2a0c.3 direct-string left operand is explicitly not recognized as a reference",
  () => {
    const result =
      deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
        shapeResult({
          op: "eq",

          left: "subject.pos",

          right: "pronoun",
        }),
      );

    assert(
      result.status ===
          "ready" &&
        result.examinedLeafCount ===
          1 &&
        result.authorities.length ===
          0 &&
        result.unsupportedEncodingSiteKeys.length ===
          1,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.6a2a0c.4 object without ref is not guessed as a reference",
  () => {
    const result =
      deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
        shapeResult({
          op: "eq",

          left: {
            path: "subject.pos",
          },
        }),
      );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          0 &&
        result.unsupportedEncodingSiteKeys.length ===
          1,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.6a2a0c.5 ref must be an exact non-empty string",
  () => {
    for (
      const ref of [
        null,
        42,
        "",
      ]
    ) {
      const result =
        deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
          shapeResult({
            op: "eq",

            left: {
              ref,
            },
          }),
        );

      assert(
        result.status ===
            "ready" &&
          result.authorities.length ===
            0 &&
          result.unsupportedEncodingSiteKeys.length ===
            1,
        JSON.stringify(
          result,
        ),
      );
    }
  },
);

Deno.test(
  "A4.6a2a0c.6 extra wrapper keys are not silently accepted",
  () => {
    const result =
      deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
        shapeResult({
          op: "eq",

          left: {
            ref: "subject.pos",

            future_metadata: true,
          },
        }),
      );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          0 &&
        result.unsupportedEncodingSiteKeys.length ===
          1,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.6a2a0c.7 absent WHERE yields zero examined leaves without inventing false",
  () => {
    const result =
      deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
        shapeResult(
          null,
        ),
      );

    assert(
      result.status ===
          "ready" &&
        result.examinedLeafCount ===
          0 &&
        result.recognizedReferenceLeafCount ===
          0 &&
        result.authorities.length ===
          0 &&
        result.unsupportedEncodingSiteKeys.length ===
          0,
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "A4.6a2a0c.8 duplicate A4.6a1 authority identity blocks",
  () => {
    const source = shapeResult({
      op: "eq",

      left: {
        ref: "subject.pos",
      },
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

    const result =
      deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
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
  "A4.6a2a0c.9 semanticized or occurrence-bound A4.6a1 input is rejected as stale",
  () => {
    const source = shapeResult({
      op: "eq",

      left: {
        ref: "subject.pos",
      },
    });

    const original = source.authorities[0]!;

    const stale = {
      ...source,

      authorities: [
        {
          ...original,

          governance: {
            ...original.governance,

            referenceSemanticsResolved: true,

            occurrenceBindingPerformed: true,
          },
        },
      ],
    } as unknown as CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1;

    const result =
      deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
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
  "A4.6a2a0c.10 governance confirms encoding authority only with no root traversal truth scope cardinality role or graph execution",
  () => {
    const result =
      deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
        shapeResult({
          op: "eq",

          left: {
            ref: "subject.pos",
          },

          right: "pronoun",
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
      g.exactA46a1ResultRequired ===
          true &&
        g.exactA46a1AuthorityRequired ===
          true &&
        g.exactLeafOperatorRequired ===
          true &&
        g.exactExplicitRefWrapperRequired ===
          true &&
        g.exactSingleOwnRefKeyRequired ===
          true &&
        g.ownRefStringRequired ===
          true &&
        g.sourceEncodingPreserved ===
          true &&
        g.directStringLeftRecognizedAsReference ===
          false &&
        g.arbitraryObjectRecognizedAsReference ===
          false &&
        g.extraWrapperKeysAccepted ===
          false &&
        g.referenceExpressionNormalized ===
          false &&
        g.caseFoldingPerformed ===
          false &&
        g.dottedReferenceSplitPerformed ===
          false &&
        g.dottedReferenceTraversalPerformed ===
          false &&
        g.referenceRootResolved ===
          false &&
        g.bindingRootMatched ===
          false &&
        g.suffixSemanticsResolved ===
          false &&
        g.operatorSemanticsResolved ===
          false &&
        g.compoundSemanticsResolved ===
          false &&
        g.compoundBooleanCompositionExecuted ===
          false &&
        g.referenceValueResolved ===
          false &&
        g.canonicalFactOwnershipResolved ===
          false &&
        g.comparisonPerformed ===
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
