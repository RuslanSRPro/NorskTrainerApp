import {
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";
import {
  deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";
import {
  type CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityResultV1,
  deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-reference-expression-shape-authority-v1.ts";
import {
  deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-reference-root-authority-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pipeline(
  referenceExpression: string,
  extraBindings: Record<string, Record<string, unknown>> = {},
) {
  const bindings = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
    [
      {
        id: "manifest:a",
        code: "ir.a",
        authoring_status: "validated",
        runtime_family: "clause",
        execution_phase: "clause_build",
        ir_spec: {
          bindings: {
            subject: {
              entity: "phrase",
              scope: "sentence",
              cardinality: "one",
              where: {
                op: "eq",
                left: { ref: referenceExpression },
                right: "opaque",
              },
            },
            predicate: {
              entity: "phrase",
              scope: "sentence",
              cardinality: "one",
            },
            ...extraBindings,
          },
        },
      },
    ],
  );

  const shapes = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
    bindings,
  );
  const references =
    deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
      shapes,
    );

  return { bindings, references };
}

Deno.test("A4.6a2a.1 exact binding", () => {
  const s = pipeline("subject");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      s.references,
      s.bindings,
    );
  const a = r.authorities[0]!;
  assert(
    r.status === "ready" &&
      a.rootMatch === "exact_binding" &&
      a.rootBindingName === "subject" &&
      a.opaqueSuffix === null,
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2a.2 prefix keeps opaque suffix", () => {
  const s = pipeline("subject.pos");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      s.references,
      s.bindings,
    );
  const a = r.authorities[0]!;
  assert(
    a.rootMatch === "binding_prefix_with_opaque_suffix" &&
      a.rootBindingName === "subject" &&
      a.opaqueSuffix === ".pos",
    JSON.stringify(a),
  );
});

Deno.test("A4.6a2a.3 longest manifest-local prefix wins", () => {
  const s = pipeline("subject.head.pos", {
    "subject.head": {
      entity: "phrase",
      scope: "sentence",
      cardinality: "one",
    },
  });
  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      s.references,
      s.bindings,
    );
  const a = r.authorities[0]!;
  assert(
    a.rootBindingName === "subject.head" &&
      a.opaqueSuffix === ".pos",
    JSON.stringify(a),
  );
});

Deno.test("A4.6a2a.4 exact beats shorter prefix", () => {
  const s = pipeline("subject.head", {
    "subject.head": {
      entity: "phrase",
      scope: "sentence",
      cardinality: "one",
    },
  });
  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      s.references,
      s.bindings,
    );
  const a = r.authorities[0]!;
  assert(
    a.rootMatch === "exact_binding" &&
      a.rootBindingName === "subject.head" &&
      a.opaqueSuffix === null,
    JSON.stringify(a),
  );
});

Deno.test("A4.6a2a.5 unknown remains unrooted", () => {
  const s = pipeline("unknown.attribute");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      s.references,
      s.bindings,
    );
  const a = r.authorities[0]!;
  assert(
    a.rootMatch === "unrooted" &&
      a.rooted === false &&
      a.rootBindingName === null &&
      a.rootBindingDefinitionAuthorityId === null,
    JSON.stringify(a),
  );
});

Deno.test("A4.6a2a.6 deep suffix remains one opaque substring", () => {
  const s = pipeline("subject.head.morph.VerbForm");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      s.references,
      s.bindings,
    );
  const a = r.authorities[0]!;
  assert(
    a.opaqueSuffix === ".head.morph.VerbForm" &&
      a.governance.dottedReferenceSplitPerformed === false &&
      a.governance.dottedReferenceTraversalPerformed === false &&
      a.governance.suffixSemanticsResolved === false,
    JSON.stringify(a),
  );
});

Deno.test("A4.6a2a.7 other manifest cannot root", () => {
  const bindings = deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
    [
      {
        id: "manifest:a",
        code: "ir.a",
        authoring_status: "validated",
        runtime_family: "clause",
        execution_phase: "clause_build",
        ir_spec: {
          bindings: {
            owner: {
              entity: "phrase",
              scope: "sentence",
              cardinality: "one",
              where: {
                op: "eq",
                left: { ref: "shared.pos" },
              },
            },
          },
        },
      },
      {
        id: "manifest:b",
        code: "ir.b",
        authoring_status: "validated",
        runtime_family: "clause",
        execution_phase: "clause_build",
        ir_spec: {
          bindings: {
            shared: {
              entity: "phrase",
              scope: "sentence",
              cardinality: "one",
            },
          },
        },
      },
    ],
  );
  const shapes = deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
    bindings,
  );
  const refs =
    deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
      shapes,
    );
  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      refs,
      bindings,
    );
  const a = r.authorities.find((x) => x.manifestId === "manifest:a")!;
  assert(a.rootMatch === "unrooted", JSON.stringify(r));
});

Deno.test("A4.6a2a.8 stale owner identity blocks", () => {
  const s = pipeline("subject.pos");
  const stale = {
    ...s.references,
    authorities: [{
      ...s.references.authorities[0]!,
      bindingDefinitionAuthorityId: "wrong",
    }],
  } as CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityResultV1;

  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      stale,
      s.bindings,
    );
  assert(
    r.status === "blocked" &&
      r.authorities.length === 0 &&
      r.blockingReasons.some((x) =>
        x.includes("owner_binding_authority_missing")
      ),
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2a.9 duplicate reference identity blocks", () => {
  const s = pipeline("subject.pos");
  const a = s.references.authorities[0]!;
  const duplicate = {
    ...s.references,
    authorities: [a, { ...a }],
  };
  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      duplicate,
      s.bindings,
    );
  assert(
    r.status === "blocked" &&
      r.authorities.length === 0 &&
      r.blockingReasons.some((x) => x.includes(":duplicate")),
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2a.10 governance stays structural only", () => {
  const s = pipeline("subject.pos");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      s.references,
      s.bindings,
    );
  const g = r.authorities[0]!.governance;

  assert(
    g.exactA46a2a0cResultRequired === true &&
      g.exactA46a2a0cAuthorityRequired === true &&
      g.exactA43a1ResultRequired === true &&
      g.exactManifestBindingDefinitionAuthorityRequired === true &&
      g.ownerBindingAuthorityIdentityRequired === true &&
      g.exactManifestIdentityRequired === true &&
      g.manifestLocalBindingRootsOnly === true &&
      g.exactReferenceExpressionComparison === true &&
      g.exactBindingNameComparison === true &&
      g.bindingPrefixDelimiter === "." &&
      g.longestExactBindingPrefixWins === true &&
      g.rootClassificationPerformed === true &&
      g.rootBindingDefinitionIdentityPreserved === true &&
      g.referenceExpressionNormalized === false &&
      g.bindingNameNormalized === false &&
      g.caseFoldingPerformed === false &&
      g.dottedReferenceSplitPerformed === false &&
      g.dottedReferenceTraversalPerformed === false &&
      g.graphTraversalPerformed === false &&
      g.suffixPreservedOpaque === true &&
      g.suffixSemanticsResolved === false &&
      g.referenceValueResolved === false &&
      g.canonicalFactOwnershipResolved === false &&
      g.operatorSemanticsResolved === false &&
      g.compoundSemanticsResolved === false &&
      g.compoundBooleanCompositionExecuted === false &&
      g.comparisonPerformed === false &&
      g.occurrenceDomainResolved === false &&
      g.occurrenceEnumerationPerformed === false &&
      g.occurrenceFilteringPerformed === false &&
      g.occurrenceBindingPerformed === false &&
      g.occurrenceWinnerSelected === false &&
      g.sentenceMembershipResolved === false &&
      g.runtimeScopeExecutionPerformed === false &&
      g.cardinalitySemanticsResolved === false &&
      g.cardinalityEnforcementPerformed === false &&
      g.actionFamilySemanticsResolved === false &&
      g.roleSemanticsResolved === false &&
      g.grammaticalFunctionResolved === false &&
      g.subjectOfRelationInferred === false &&
      g.graphMutationPerformed === false &&
      g.learnerErrorClassified === false &&
      g.candidateOnly === true &&
      g.frozenGrammarReadOnly === true,
    JSON.stringify(g),
  );
});

Deno.test("A4.6a2a.11 stale upstream individual authority governance fails closed", () => {
  const staleSource = pipeline("subject.pos");

  const staleReference = {
    ...staleSource.references,
    authorities: [{
      ...staleSource.references.authorities[0]!,
      governance: {
        ...staleSource.references.authorities[0]!.governance,
        candidateOnly: false,
      },
    }],
  } as unknown as typeof staleSource.references;

  const staleReferenceResult =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      staleReference,
      staleSource.bindings,
    );

  assert(
    staleReferenceResult.status === "blocked" &&
      staleReferenceResult.authorities.length === 0 &&
      staleReferenceResult.blockingReasons.some((reason) =>
        reason.includes("unsafe_contract")
      ),
    JSON.stringify(staleReferenceResult),
  );

  const staleBindings = {
    ...staleSource.bindings,
    authorities: staleSource.bindings.authorities.map((authority, index) =>
      index === 0
        ? {
          ...authority,
          governance: {
            ...authority.governance,
            frozenGrammarReadOnly: false,
          },
        }
        : authority
    ),
  } as unknown as typeof staleSource.bindings;

  const staleBindingResult =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      staleSource.references,
      staleBindings,
    );

  assert(
    staleBindingResult.status === "blocked" &&
      staleBindingResult.authorities.length === 0 &&
      staleBindingResult.blockingReasons.some((reason) =>
        reason.includes("unsafe_contract")
      ),
    JSON.stringify(staleBindingResult),
  );
});
