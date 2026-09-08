import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  type CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestCompoundTruthDispositionV1,
} from "./canonical-runtime-manifest-binding-where-compound-truth-semantic-capability-v1.ts";

import {
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1,
  composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1,
} from "./canonical-runtime-manifest-binding-where-recursive-compound-truth-composer-v1.ts";

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

function leaf(
  path: string,
): CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 {
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
  };
}

function compound(
  operatorKey:
    | "all"
    | "any"
    | "not",
  path: string,
  children: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1[],
): CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 {
  return {
    shape: "compound_operator",

    path,

    operatorKey,

    encoding: operatorKey ===
        "not"
      ? "unary_object"
      : "array",

    childCount: children.length,

    children,

    rawSnapshot: {
      [operatorKey]: children.map(
        (child) =>
          child.shape ===
              "absent"
            ? null
            : child.rawSnapshot,
      ),
    },

    sourceNode: null as unknown as Extract<
      CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
      {
        shape: "compound_operator";
      }
    >["sourceNode"],

    sourceKind: operatorKey ===
        "not"
      ? "a4_6a1_unclassified_unary_not"
      : "a4_6a1_compound_array_group",

    syntheticStructuralUpgrade: operatorKey ===
      "not",
  };
}

function unsupported(
  path = "$",
): CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 {
  return {
    shape: "unsupported",

    path,

    reason: "unclassified_shape_not_supported",

    rawSnapshot: {
      unknown: true,
    },

    sourceNode: {} as never,
  };
}

function absent(
  path = "$",
): CanonicalRuntimeManifestCompoundOperatorShapeNodeV1 {
  return {
    shape: "absent",

    path,

    sourceNode: {} as never,

    sourceKind: "a4_6a1_absent_passthrough",
  };
}

function authority(
  id: string,
  root: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
): CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1 {
  return {
    id,

    status: "candidate",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    authorityKind: "runtime_language_structural_specification",

    decisionStatus: "normative",

    sourceWhereShapeAuthorityId: `a4_6a1:${id}`,

    sourceWhereShapeAuthority: {
      id: `a4_6a1:${id}`,
    } as never,

    bindingDefinitionAuthorityId: `binding:${id}`,

    manifestId: `manifest:${id}`,

    manifestCode: `fixture.${id}`,

    bindingName: "subject",

    root,

    unsupportedPaths: root.shape ===
        "unsupported"
      ? [
        root.path,
      ]
      : [],

    provenance: {
      exactSourceAuthorityObjectPreserved: true,
    } as never,

    governance: {} as never,
  } as unknown as CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1;
}

function shapeResult(
  authorities:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1[],
): CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1 {
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

function evidence(
  structuralAuthorityId: string,
  nodePath: string,
  truth: CanonicalRuntimeManifestCompoundTruthDispositionV1,
): CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1 {
  const sourceEvidenceObject = {
    structuralAuthorityId,
    nodePath,
    truth,
  };

  return {
    authorityBoundChildTruthEvidenceId:
      `bound:${structuralAuthorityId}:${nodePath}:${truth}`,

    structuralAuthorityId,

    nodePath,

    childTruthEvidence: {
      childTruthEvidenceId:
        `child:${structuralAuthorityId}:${nodePath}:${truth}`,

      nodePath,

      sourceKind: "leaf_condition_truth",

      truthDisposition: truth,

      sourceProducer: "fixture_leaf_source",

      sourceProducerVersion: "1",

      sourceEvidenceId: `source:${structuralAuthorityId}:${nodePath}:${truth}`,

      sourceEvidenceObject,

      provenance: {
        exactStructuralNodePathClaimed: true,

        truthDispositionSuppliedBySourceAuthority: true,

        sourceProducerIdentityPreserved: true,

        sourceEvidenceIdentityPreserved: true,

        sourceEvidenceObjectPreservedWithoutReconstruction: true,

        truthRecomputedByInterface: false,

        booleanTruthInferredByInterface: false,
      },
    },

    provenance: {
      exactStructuralAuthorityIdentityClaimed: true,

      exactStructuralNodePathClaimed: true,

      structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity: true,

      childTruthEvidenceObjectPreservedWithoutReconstruction: true,

      childTruthNodePathMatchesBoundNodePath: true,

      authorityNodePairProvenBySourceAdapter: true,

      structuralAuthorityInferredByInterface: false,

      nodePathInferredByInterface: false,

      callerSuppliedAuthorityNodePairAcceptedAsProof: false,

      truthDispositionDuplicatedAtBindingLayer: false,

      truthRecomputedByInterface: false,
    },
  };
}

function binaryCase(
  operator:
    | "all"
    | "any",
  left: CanonicalRuntimeManifestCompoundTruthDispositionV1,
  right: CanonicalRuntimeManifestCompoundTruthDispositionV1,
) {
  const authorityId = `authority:${operator}:${left}:${right}`;

  const leftPath = `$.${operator}[0]`;

  const rightPath = `$.${operator}[1]`;

  const sourceAuthority = authority(
    authorityId,
    compound(
      operator,
      "$",
      [
        leaf(
          leftPath,
        ),
        leaf(
          rightPath,
        ),
      ],
    ),
  );

  const leaves = [
    evidence(
      authorityId,
      leftPath,
      left,
    ),
    evidence(
      authorityId,
      rightPath,
      right,
    ),
  ];

  return {
    authority: sourceAuthority,

    shape: shapeResult(
      [
        sourceAuthority,
      ],
    ),

    leaves,
  };
}

function unaryCase(
  truth: CanonicalRuntimeManifestCompoundTruthDispositionV1,
) {
  const authorityId = `authority:not:${truth}`;

  const childPath = "$.not";

  const sourceAuthority = authority(
    authorityId,
    compound(
      "not",
      "$",
      [
        leaf(
          childPath,
        ),
      ],
    ),
  );

  const leaves = [
    evidence(
      authorityId,
      childPath,
      truth,
    ),
  ];

  return {
    authority: sourceAuthority,

    shape: shapeResult(
      [
        sourceAuthority,
      ],
    ),

    leaves,
  };
}

function rootTruth(
  result: ReturnType<
    typeof composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1
  >,
): CanonicalRuntimeManifestCompoundTruthDispositionV1 {
  assert(
    result.status ===
      "ready",
    JSON.stringify(result),
  );

  return result.authorityResults[0]!
    .rootTruth
    .evidence
    .childTruthEvidence
    .truthDisposition;
}

Deno.test(
  "A4.6a1d.1 all true true resolves true",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      rootTruth(
        result,
      ) ===
        "resolved_true",
    );
  },
);

Deno.test(
  "A4.6a1d.2 all true unresolved remains unresolved",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "unresolved",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      rootTruth(
        result,
      ) ===
        "unresolved",
    );
  },
);

Deno.test(
  "A4.6a1d.3 all false unresolved resolves false",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_false",
      "unresolved",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      rootTruth(
        result,
      ) ===
        "resolved_false",
    );
  },
);

Deno.test(
  "A4.6a1d.4 any false false resolves false",
  () => {
    const fixture = binaryCase(
      "any",
      "resolved_false",
      "resolved_false",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      rootTruth(
        result,
      ) ===
        "resolved_false",
    );
  },
);

Deno.test(
  "A4.6a1d.5 any false unresolved remains unresolved",
  () => {
    const fixture = binaryCase(
      "any",
      "resolved_false",
      "unresolved",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      rootTruth(
        result,
      ) ===
        "unresolved",
    );
  },
);

Deno.test(
  "A4.6a1d.6 any true unresolved resolves true",
  () => {
    const fixture = binaryCase(
      "any",
      "resolved_true",
      "unresolved",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      rootTruth(
        result,
      ) ===
        "resolved_true",
    );
  },
);

Deno.test(
  "A4.6a1d.7 not true resolves false",
  () => {
    const fixture = unaryCase(
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      rootTruth(
        result,
      ) ===
        "resolved_false",
    );
  },
);

Deno.test(
  "A4.6a1d.8 not false resolves true",
  () => {
    const fixture = unaryCase(
      "resolved_false",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      rootTruth(
        result,
      ) ===
        "resolved_true",
    );
  },
);

Deno.test(
  "A4.6a1d.9 not unresolved preserves unresolved",
  () => {
    const fixture = unaryCase(
      "unresolved",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      rootTruth(
        result,
      ) ===
        "unresolved",
    );
  },
);

function nestedFixture() {
  const authorityId = "authority:nested";

  const nestedAny = compound(
    "any",
    "$.all[0]",
    [
      leaf(
        "$.all[0].any[0]",
      ),
      leaf(
        "$.all[0].any[1]",
      ),
    ],
  );

  const sourceAuthority = authority(
    authorityId,
    compound(
      "all",
      "$",
      [
        nestedAny,
        leaf(
          "$.all[1]",
        ),
      ],
    ),
  );

  const leaves = [
    evidence(
      authorityId,
      "$.all[0].any[0]",
      "resolved_false",
    ),
    evidence(
      authorityId,
      "$.all[0].any[1]",
      "resolved_true",
    ),
    evidence(
      authorityId,
      "$.all[1]",
      "resolved_true",
    ),
  ];

  return {
    authority: sourceAuthority,

    shape: shapeResult(
      [
        sourceAuthority,
      ],
    ),

    leaves,
  };
}

Deno.test(
  "A4.6a1d.10 nested all any composes recursively",
  () => {
    const fixture = nestedFixture();

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      result.status ===
        "ready",
      JSON.stringify(result),
    );

    assert(
      result.authorityResults[0]!
        .rootTruth
        .evidence
        .childTruthEvidence
        .truthDisposition ===
        "resolved_true",
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.11 nested compound evidence is produced at every compound path",
  () => {
    const fixture = nestedFixture();

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      result.status ===
        "ready",
      JSON.stringify(result),
    );

    const composed = result.authorityResults[0]!
      .composedCompoundTruthEvidence;

    assert(
      composed.length ===
          2 &&
        composed[0]!.evidence.nodePath ===
          "$.all[0]" &&
        composed[1]!.evidence.nodePath ===
          "$" &&
        composed.every(
          (entry) =>
            entry.evidence
              .childTruthEvidence
              .sourceKind ===
              "compound_condition_truth",
        ),
      JSON.stringify(composed),
    );
  },
);

Deno.test(
  "A4.6a1d.12 missing leaf evidence blocks",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        [
          fixture.leaves[0]!,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "missing_external_ready_evidence",
            ),
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.13 duplicate composite evidence key blocks",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        [
          ...fixture.leaves,
          fixture.leaves[0]!,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "duplicate_composite_key",
            ),
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.14 unknown structural authority evidence blocks",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const foreign = evidence(
      "authority:unknown",
      "$.all[0]",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        [
          ...fixture.leaves,
          foreign,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "unknown_structural_authority",
            ),
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.15 unknown structural path evidence blocks",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const foreign = evidence(
      fixture.authority.id,
      "$.unknown[0]",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        [
          ...fixture.leaves,
          foreign,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "unknown_structural_path",
            ),
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.16 external evidence for compound path blocks",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const injected = evidence(
      fixture.authority.id,
      "$",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        [
          ...fixture.leaves,
          injected,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "external_evidence_for_non_leaf",
            ),
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.17 unsupported structural node blocks outside truth domain",
  () => {
    const sourceAuthority = authority(
      "authority:unsupported",
      unsupported(),
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        shapeResult(
          [
            sourceAuthority,
          ],
        ),
        [],
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "unsupported_outside_compound_truth_domain",
            ),
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.18 absent root blocks and is not implicit true",
  () => {
    const sourceAuthority = authority(
      "authority:absent",
      absent(),
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        shapeResult(
          [
            sourceAuthority,
          ],
        ),
        [],
      );

    assert(
      result.status ===
          "blocked" &&
        result.governance
            .absentRootAssignedImplicitTrue ===
          false,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.19 all false plus missing blocks instead of resolving false",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_false",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        [
          fixture.leaves[0]!,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.authorityResults.length ===
          0,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.20 any true plus missing blocks instead of resolving true",
  () => {
    const fixture = binaryCase(
      "any",
      "resolved_true",
      "resolved_false",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        [
          fixture.leaves[0]!,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.authorityResults.length ===
          0,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.21 same nodePath across authorities cannot cross-bind",
  () => {
    const authorityA = authority(
      "authority:A",
      leaf(
        "$",
      ),
    );

    const authorityB = authority(
      "authority:B",
      leaf(
        "$",
      ),
    );

    const evidenceA = evidence(
      authorityA.id,
      "$",
      "resolved_true",
    );

    const evidenceB = evidence(
      authorityB.id,
      "$",
      "resolved_false",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        shapeResult(
          [
            authorityA,
            authorityB,
          ],
        ),
        [
          evidenceA,
          evidenceB,
        ],
      );

    assert(
      result.status ===
        "ready",
      JSON.stringify(result),
    );

    const resultA = result.authorityResults.find(
      (entry) =>
        entry.structuralAuthorityId ===
          authorityA.id,
    );

    const resultB = result.authorityResults.find(
      (entry) =>
        entry.structuralAuthorityId ===
          authorityB.id,
    );

    assert(
      resultA?.rootTruth.evidence ===
          evidenceA &&
        resultB?.rootTruth.evidence ===
          evidenceB &&
        resultA.rootTruth.evidence
            .childTruthEvidence
            .truthDisposition ===
          "resolved_true" &&
        resultB.rootTruth.evidence
            .childTruthEvidence
            .truthDisposition ===
          "resolved_false",
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.22 source leaf evidence collection and objects are preserved by reference",
  () => {
    const sourceAuthority = authority(
      "authority:leaf-preservation",
      leaf(
        "$",
      ),
    );

    const sourceEvidence = evidence(
      sourceAuthority.id,
      "$",
      "resolved_true",
    );

    const sourceEvidenceCollection = [
      sourceEvidence,
    ];

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        shapeResult(
          [
            sourceAuthority,
          ],
        ),
        sourceEvidenceCollection,
      );

    assert(
      result.status ===
        "ready",
      JSON.stringify(result),
    );

    assert(
      result.sourceLeafEvidence ===
          sourceEvidenceCollection &&
        result.sourceLeafEvidence[0] ===
          sourceEvidence &&
        result.authorityResults[0]!
            .rootTruth
            .evidence ===
          sourceEvidence,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.23 source A4.6a1a authority objects are preserved by reference",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      result.status ===
          "ready" &&
        result.sourceShapeResult ===
          fixture.shape &&
        result.authorityResults[0]!
            .sourceAuthority ===
          fixture.authority,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.24 composer API arity is exactly two",
  () => {
    assert(
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1
        .length ===
        2,
      String(
        composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1
          .length,
      ),
    );
  },
);

Deno.test(
  "A4.6a1d.25 composer remains source-neutral with no token-pos adapter authority",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      result.governance
            .sourceSpecificLeafAdapterImported ===
          false &&
        result.governance
            .tokenPosAuthorityImported ===
          false,
      JSON.stringify(result.governance),
    );
  },
);

Deno.test(
  "A4.6a1d.26 caller truth capability is not accepted",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      result.truthSpecificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1 &&
        result.governance
            .callerTruthCapabilityAccepted ===
          false,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.27 all structurally required children are evaluated before parent truth and no short circuit is executed",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_false",
      "resolved_true",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        [
          fixture.leaves[0]!,
        ],
      );

    assert(
      result.status ===
          "blocked" &&
        result.governance
            .recursiveChildrenFullyEvaluatedBeforeParentTruth ===
          true &&
        result.governance
            .blockedChildParticipatesInTruthTable ===
          false &&
        result.governance
            .shortCircuitExecuted ===
          false,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "A4.6a1d.28 composer ceiling excludes manifest context occurrence and cardinality semantics",
  () => {
    const fixture = binaryCase(
      "all",
      "resolved_true",
      "resolved_true",
    );

    const g =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
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
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "A4.6a1d.29 composer performs no graph mutation",
  () => {
    const fixture = binaryCase(
      "any",
      "resolved_true",
      "resolved_false",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      result.governance
        .graphMutationPerformed ===
        false,
      JSON.stringify(result.governance),
    );
  },
);

Deno.test(
  "A4.6a1d.30 composer performs no learner error classification",
  () => {
    const fixture = binaryCase(
      "any",
      "resolved_true",
      "resolved_false",
    );

    const result =
      composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
        fixture.shape,
        fixture.leaves,
      );

    assert(
      result.specificationId ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1 &&
        result.producer ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1 &&
        result.producerVersion ===
          CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1 &&
        result.governance
            .learnerErrorClassified ===
          false &&
        result.governance
            .frozenGrammarReadOnly ===
          true,
      JSON.stringify(result),
    );
  },
);
