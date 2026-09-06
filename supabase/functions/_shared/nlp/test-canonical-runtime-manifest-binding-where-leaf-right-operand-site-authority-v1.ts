import {
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";
import {
  type CanonicalRuntimeManifestWhereShapeNodeV1,
  deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";
import {
  deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-reference-expression-shape-authority-v1.ts";
import {
  deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-reference-root-authority-v1.ts";
import {
  deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-leaf-right-operand-site-authority-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function pipeline(
  referenceExpression: string,
  hasRightOperand = true,
  rightOperand: unknown = "opaque",
  extraBindings: Record<string, Record<string, unknown>> = {},
) {
  const where = {
    op: "eq",
    left: { ref: referenceExpression },
    ...(hasRightOperand ? { right: rightOperand } : {}),
  };

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
              where,
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

  const roots =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      references,
      bindings,
    );

  return { bindings, shapes, references, roots };
}

function firstLeaf(
  node: CanonicalRuntimeManifestWhereShapeNodeV1,
):
  | Extract<
    CanonicalRuntimeManifestWhereShapeNodeV1,
    { shape: "leaf_operator" }
  >
  | null {
  if (node.shape === "leaf_operator") return node;

  if (node.shape === "compound_array_group") {
    for (const child of node.children) {
      const leaf = firstLeaf(child);
      if (leaf) return leaf;
    }
  }

  return null;
}

Deno.test("A4.6a2b.1 exact rooted leaf with explicit right operand composes", () => {
  const s = pipeline("subject");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      s.roots,
    );

  assert(
    r.status === "ready" &&
      r.authorities.length === 1 &&
      r.rootedReferenceSiteCount === 1 &&
      r.explicitRightOperandSiteCount === 1 &&
      r.composedSiteCount === 1 &&
      r.unrootedReferenceSites.length === 0 &&
      r.rootedSitesWithoutRightOperand.length === 0,
    JSON.stringify(r),
  );

  const a = r.authorities[0]!;

  assert(
    a.leftRootMatch === "exact_binding" &&
      a.ownerBindingName === "subject" &&
      a.referencedBindingName === "subject" &&
      a.opaqueLeftSuffix === null &&
      a.hasRightOperand === true &&
      a.rightOperandSnapshot === "opaque",
    JSON.stringify(a),
  );
});

Deno.test("A4.6a2b.2 prefix-rooted left keeps opaque suffix and right snapshot", () => {
  const s = pipeline("subject.pos", true, "NOUN");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      s.roots,
    );

  const a = r.authorities[0]!;

  assert(
    r.status === "ready" &&
      r.authorities.length === 1 &&
      a.leftRootMatch === "binding_prefix_with_opaque_suffix" &&
      a.referencedBindingName === "subject" &&
      a.opaqueLeftSuffix === ".pos" &&
      a.rightOperandSnapshot === "NOUN",
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.3 owner binding and referenced binding remain separate identities", () => {
  const s = pipeline("predicate", true, "opaque");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      s.roots,
    );

  const a = r.authorities[0]!;

  assert(
    r.status === "ready" &&
      r.authorities.length === 1 &&
      a.ownerBindingName === "subject" &&
      a.referencedBindingName === "predicate" &&
      a.ownerBindingDefinitionAuthorityId !==
        a.referencedBindingDefinitionAuthorityId,
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.4 unrooted left remains diagnostic and never becomes candidate", () => {
  const s = pipeline("unknown.attribute", true, "opaque");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      s.roots,
    );

  assert(
    r.status === "ready" &&
      r.authorities.length === 0 &&
      r.rootedReferenceSiteCount === 0 &&
      r.explicitRightOperandSiteCount === 1 &&
      r.composedSiteCount === 0 &&
      r.unrootedReferenceSites.length === 1 &&
      r.rootedSitesWithoutRightOperand.length === 0 &&
      r.blockingReasons.length === 0,
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.5 rooted left without right operand remains diagnostic", () => {
  const s = pipeline("subject.pos", false);
  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      s.roots,
    );

  assert(
    r.status === "ready" &&
      r.authorities.length === 0 &&
      r.rootedReferenceSiteCount === 1 &&
      r.explicitRightOperandSiteCount === 0 &&
      r.composedSiteCount === 0 &&
      r.unrootedReferenceSites.length === 0 &&
      r.rootedSitesWithoutRightOperand.length === 1 &&
      r.blockingReasons.length === 0,
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.6 right operand snapshot is detached from immediate shape authority", () => {
  const s = pipeline("subject.pos", true, { labels: ["NOUN"] });
  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      s.roots,
    );

  const output = r.authorities[0]!.rightOperandSnapshot as {
    labels: string[];
  };

  const root = s.roots.authorities[0]!;
  const shape = s.shapes.authorities.find((x) =>
    x.id === root.whereShapeAuthorityId
  );

  assert(shape !== undefined, JSON.stringify(s.shapes));

  const leaf = firstLeaf(shape.root);

  assert(leaf !== null, JSON.stringify(shape));

  const upstream = leaf.rightOperandSnapshot as {
    labels: string[];
  };

  upstream.labels.push("VERB");

  assert(
    output.labels.length === 1 &&
      output.labels[0] === "NOUN",
    JSON.stringify(output),
  );
});

Deno.test("A4.6a2b.7 stale A4.6a1 individual authority governance blocks", () => {
  const s = pipeline("subject.pos");
  const staleShapes = {
    ...s.shapes,
    authorities: [{
      ...s.shapes.authorities[0]!,
      governance: {
        ...s.shapes.authorities[0]!.governance,
        candidateOnly: false,
      },
    }],
  } as unknown as typeof s.shapes;

  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      staleShapes,
      s.roots,
    );

  assert(
    r.status === "blocked" &&
      r.authorities.length === 0 &&
      r.blockingReasons.some((reason) =>
        reason.includes("shape:") &&
        reason.includes("unsafe_contract")
      ),
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.8 stale A4.6a2a individual authority governance blocks", () => {
  const s = pipeline("subject.pos");
  const staleRoots = {
    ...s.roots,
    authorities: [{
      ...s.roots.authorities[0]!,
      governance: {
        ...s.roots.authorities[0]!.governance,
        graphMutationPerformed: true,
      },
    }],
  } as unknown as typeof s.roots;

  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      staleRoots,
    );

  assert(
    r.status === "blocked" &&
      r.authorities.length === 0 &&
      r.blockingReasons.some((reason) =>
        reason.includes("root:") &&
        reason.includes("unsafe_contract")
      ),
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.9 duplicate shape authority id blocks", () => {
  const s = pipeline("subject.pos");
  const a = s.shapes.authorities[0]!;
  const duplicateShapes = {
    ...s.shapes,
    authorities: [a, { ...a }],
  };

  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      duplicateShapes,
      s.roots,
    );

  assert(
    r.status === "blocked" &&
      r.blockingReasons.some((reason) => reason.includes("duplicate_id")),
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.10 duplicate exact shape owner identity blocks even with different id", () => {
  const s = pipeline("subject.pos");
  const a = s.shapes.authorities[0]!;
  const duplicateOwnerShapes = {
    ...s.shapes,
    authorities: [a, {
      ...a,
      id: `${a.id}:copy`,
    }],
  };

  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      duplicateOwnerShapes,
      s.roots,
    );

  assert(
    r.status === "blocked" &&
      r.blockingReasons.some((reason) =>
        reason.includes("duplicate_owner_identity")
      ),
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.11 duplicate root authority id blocks", () => {
  const s = pipeline("subject.pos");
  const a = s.roots.authorities[0]!;
  const duplicateRoots = {
    ...s.roots,
    authorities: [a, { ...a }],
  };

  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      duplicateRoots,
    );

  assert(
    r.status === "blocked" &&
      r.blockingReasons.some((reason) => reason.includes("duplicate_id")),
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.12 unknown shape authority and owner mismatch fail closed", () => {
  const s = pipeline("subject.pos");

  const unknownShapeRoots = {
    ...s.roots,
    authorities: [{
      ...s.roots.authorities[0]!,
      whereShapeAuthorityId: "missing-shape",
    }],
  };

  const unknown =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      unknownShapeRoots,
    );

  assert(
    unknown.status === "blocked" &&
      unknown.blockingReasons.some((reason) =>
        reason.includes("unknown_where_shape_authority")
      ),
    JSON.stringify(unknown),
  );

  const ownerMismatchRoots = {
    ...s.roots,
    authorities: [{
      ...s.roots.authorities[0]!,
      ownerBindingName: "predicate",
    }],
  };

  const mismatch =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      ownerMismatchRoots,
    );

  assert(
    mismatch.status === "blocked" &&
      mismatch.blockingReasons.some((reason) =>
        reason.includes("shape_owner_identity_mismatch")
      ),
    JSON.stringify(mismatch),
  );
});

Deno.test("A4.6a2b.13 missing leaf and operator mismatch fail closed", () => {
  const s = pipeline("subject.pos");

  const missingLeafRoots = {
    ...s.roots,
    authorities: [{
      ...s.roots.authorities[0]!,
      leafPath: "$.missing",
    }],
  };

  const missing =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      missingLeafRoots,
    );

  assert(
    missing.status === "blocked" &&
      missing.blockingReasons.some((reason) =>
        reason.includes("leaf_path_missing")
      ),
    JSON.stringify(missing),
  );

  const operatorMismatchRoots = {
    ...s.roots,
    authorities: [{
      ...s.roots.authorities[0]!,
      operatorLabelOpaque: "different-op",
    }],
  };

  const mismatch =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      operatorMismatchRoots,
    );

  assert(
    mismatch.status === "blocked" &&
      mismatch.blockingReasons.some((reason) =>
        reason.includes("operator_label_mismatch")
      ),
    JSON.stringify(mismatch),
  );
});

Deno.test("A4.6a2b.14 rooted reference missing referenced binding identity blocks", () => {
  const s = pipeline("subject.pos");

  const staleRoots = {
    ...s.roots,
    authorities: [{
      ...s.roots.authorities[0]!,
      rootBindingDefinitionAuthorityId: null,
    }],
  } as unknown as typeof s.roots;

  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      staleRoots,
    );

  assert(
    r.status === "blocked" &&
      r.authorities.length === 0,
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.15 duplicate matched leaf path inside exact shape blocks", () => {
  const s = pipeline("subject.pos");
  const root = s.roots.authorities[0]!;
  const shape = s.shapes.authorities.find((x) =>
    x.id === root.whereShapeAuthorityId
  );

  assert(shape !== undefined, JSON.stringify(s.shapes));

  const leaf = firstLeaf(shape.root);

  assert(leaf !== null, JSON.stringify(shape));

  const duplicateLeafShape = {
    ...shape,
    root: {
      shape: "compound_array_group",
      path: "$",
      compoundKey: "opaque-group",
      children: [leaf, { ...leaf }],
      rawSnapshot: {},
    },
  } as unknown as typeof shape;

  const duplicateShapes = {
    ...s.shapes,
    authorities: s.shapes.authorities.map((candidate) =>
      candidate.id === shape.id ? duplicateLeafShape : candidate
    ),
  };

  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      duplicateShapes,
      s.roots,
    );

  assert(
    r.status === "blocked" &&
      r.blockingReasons.some((reason) =>
        reason.includes("duplicate_leaf_path")
      ),
    JSON.stringify(r),
  );
});

Deno.test("A4.6a2b.16 non-exact upstream result contracts fail closed", () => {
  const s = pipeline("subject.pos");

  const badShapes = {
    ...s.shapes,
    producer: "wrong-shape-producer",
  } as unknown as typeof s.shapes;

  const shapeResult =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      badShapes,
      s.roots,
    );

  assert(
    shapeResult.status === "blocked" &&
      shapeResult.blockingReasons.includes("a4_6a1_result:not_exact_ready"),
    JSON.stringify(shapeResult),
  );

  const badRoots = {
    ...s.roots,
    producer: "wrong-root-producer",
  } as unknown as typeof s.roots;

  const rootResult =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      badRoots,
    );

  assert(
    rootResult.status === "blocked" &&
      rootResult.blockingReasons.includes("a4_6a2a_result:not_exact_ready"),
    JSON.stringify(rootResult),
  );
});

Deno.test("A4.6a2b.17 governance remains structural only", () => {
  const s = pipeline("subject.pos", true, "NOUN");
  const r =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      s.shapes,
      s.roots,
    );

  const g = r.authorities[0]!.governance;

  assert(
    g.exactA46a1ResultRequired === true &&
      g.exactA46a1AuthorityRequired === true &&
      g.exactA46a2aResultRequired === true &&
      g.exactA46a2aAuthorityRequired === true &&
      g.sameWhereShapeAuthorityRequired === true &&
      g.sameOwnerBindingDefinitionAuthorityRequired === true &&
      g.sameManifestIdentityRequired === true &&
      g.sameOwnerBindingNameRequired === true &&
      g.sameLeafPathRequired === true &&
      g.sameOperatorLabelRequired === true &&
      g.rootedReferenceRequired === true &&
      g.referencedBindingIdentityRequired === true &&
      g.ownerBindingAndReferencedBindingKeptSeparate === true &&
      g.rightOperandPresenceRequired === true &&
      g.rightOperandSnapshotPreserved === true &&
      g.rightOperandSnapshotDetached === true &&
      g.leftReferenceExpressionPreserved === true &&
      g.opaqueLeftSuffixPreserved === true &&
      g.operatorLabelPreservedOpaque === true &&
      g.structuralSiteOnly === true &&
      g.unrootedReferenceExcluded === true &&
      g.unrootedReferenceIsDiagnostic === true &&
      g.rootedWithoutRightOperandIsDiagnostic === true &&
      g.rightOperandSemanticsResolved === false &&
      g.stringOperandMappedToPos === false &&
      g.operatorSemanticsResolved === false &&
      g.compoundSemanticsResolved === false &&
      g.compoundBooleanCompositionExecuted === false &&
      g.referenceSuffixSemanticsResolved === false &&
      g.dottedReferenceTraversalPerformed === false &&
      g.referenceValueResolved === false &&
      g.canonicalFactOwnershipResolved === false &&
      g.comparisonPerformed === false &&
      g.valueCoercionPerformed === false &&
      g.caseNormalizationPerformed === false &&
      g.occurrenceDomainResolved === false &&
      g.occurrenceEnumerationPerformed === false &&
      g.occurrenceFilteringPerformed === false &&
      g.occurrenceBindingPerformed === false &&
      g.sentenceMembershipResolved === false &&
      g.runtimeScopeExecutionPerformed === false &&
      g.cardinalitySemanticsResolved === false &&
      g.cardinalityEnforcementPerformed === false &&
      g.actionFamilySemanticsResolved === false &&
      g.roleSemanticsResolved === false &&
      g.grammaticalFunctionResolved === false &&
      g.subjectOfRelationInferred === false &&
      g.graphTraversalPerformed === false &&
      g.graphMutationPerformed === false &&
      g.learnerErrorClassified === false &&
      g.candidateOnly === true &&
      g.frozenGrammarReadOnly === true,
    JSON.stringify(g),
  );
});
