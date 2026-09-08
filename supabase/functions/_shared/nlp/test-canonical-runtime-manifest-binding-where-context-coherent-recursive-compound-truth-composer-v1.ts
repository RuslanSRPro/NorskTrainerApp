import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1,
  composeCanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthV1,
} from "./canonical-runtime-manifest-binding-where-context-coherent-recursive-compound-truth-composer-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-context-bound-child-truth-evidence-interface-v1.ts";

type Truth =
  | "resolved_true"
  | "resolved_false"
  | "unresolved";

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

function leafNode(
  path: string,
) {
  return {
    shape: "leaf_operator",
    path,
    operatorLabel: "eq",
  };
}

function compoundNode(
  path: string,
  operatorKey: "all" | "any" | "not",
  children: unknown[],
) {
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
  };
}

function authority(
  id: string,
  root: unknown,
) {
  return {
    id,

    status: "candidate",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    authorityKind: "runtime_language_structural_specification",

    sourceWhereShapeAuthority: {},

    bindingDefinitionAuthorityId: `binding-authority-${id}`,

    manifestId: `manifest-${id}`,

    manifestCode: `manifest-code-${id}`,

    bindingName: `binding-${id}`,

    root,

    unsupportedPaths: [],

    governance: {},
  };
}

function shapeResult(
  authorities: unknown[],
): CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,

    status: "ready",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    authorities,

    blockingReasons: [],
  } as unknown as CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1;
}

function leafEvidence(
  structuralAuthorityId: string,
  nodePath: string,
  snapshotIdentityId: string,
  snapshotSentenceOccurrenceIdentityId: string,
  truthDisposition: Truth,
  graphDocumentId = "document-1",
  sentenceNodeId = "sentence-1",
): CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1 {
  const childTruthEvidence:
    CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1[
      "authorityBoundChildTruthEvidence"
    ]["childTruthEvidence"] = {
      childTruthEvidenceId: [
        "leaf",
        structuralAuthorityId,
        nodePath,
        snapshotIdentityId,
        snapshotSentenceOccurrenceIdentityId,
      ].join(
        ":",
      ),

      nodePath,

      sourceKind: "leaf_condition_truth",

      truthDisposition,

      sourceProducer: "fixture_leaf_authority",

      sourceProducerVersion: "1",

      sourceEvidenceId: [
        "source",
        structuralAuthorityId,
        nodePath,
        snapshotIdentityId,
        snapshotSentenceOccurrenceIdentityId,
      ].join(
        ":",
      ),

      sourceEvidenceObject: {
        fixture: true,
      },

      provenance: {
        exactStructuralNodePathClaimed: true,

        truthDispositionSuppliedBySourceAuthority: true,

        sourceProducerIdentityPreserved: true,

        sourceEvidenceIdentityPreserved: true,

        sourceEvidenceObjectPreservedWithoutReconstruction: true,

        truthRecomputedByInterface: false,

        booleanTruthInferredByInterface: false,
      },
    };

  const authorityBound:
    CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1[
      "authorityBoundChildTruthEvidence"
    ] = {
      authorityBoundChildTruthEvidenceId: [
        "authority-bound",
        structuralAuthorityId,
        nodePath,
        snapshotIdentityId,
        snapshotSentenceOccurrenceIdentityId,
      ].join(
        ":",
      ),

      structuralAuthorityId,

      nodePath,

      childTruthEvidence,

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

  return {
    contextBoundChildTruthEvidenceId: [
      "context-bound",
      structuralAuthorityId,
      nodePath,
      snapshotIdentityId,
      snapshotSentenceOccurrenceIdentityId,
    ].join(
      ":",
    ),

    structuralAuthorityId,

    nodePath,

    snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId,

    graphDocumentId,

    sentenceNodeId,

    authorityBoundChildTruthEvidence: authorityBound,

    provenance: {
      exactAuthorityBoundChildTruthEvidenceRequired: true,

      authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction:
        true,

      structuralAuthorityIdMatchesWrappedEvidence: true,

      nodePathMatchesWrappedEvidence: true,

      canonicalSnapshotSentenceOccurrenceIdentityRequired: true,

      snapshotIdentityRequired: true,

      snapshotSentenceOccurrenceIdentityRequired: true,

      snapshotIdentityAndSentenceOccurrenceIdentityFormContextCompositeIdentity:
        true,

      graphDocumentIdPreservedAsContextConsistencyMetadata: true,

      sentenceNodeIdPreservedAsContextConsistencyMetadata: true,

      sentenceIndexUsedAsContextIdentity: false,

      tokenNodeIdUsedAsSentenceContextIdentity: false,

      snapshotTokenOccurrenceIdentityUsedAsSentenceContextIdentity: false,

      authorityContextPairProvenBySourceAdapter: true,

      contextInferredByInterface: false,

      callerSuppliedContextAcceptedAsProof: false,

      truthDispositionDuplicatedAtContextBindingLayer: false,

      truthRecomputedByInterface: false,
    },
  };
}

function execute(
  source:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  evidence: CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1[],
) {
  return composeCanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthV1(
    source,
    evidence,
  );
}

function assertReady(
  result: ReturnType<typeof execute>,
) {
  assert(
    result.status ===
      "ready",
    `expected ready; got ${result.status}: ${result.blockingReasons.join(",")}`,
  );

  return result;
}

function assertBlocked(
  result: ReturnType<typeof execute>,
) {
  assert(
    result.status ===
      "blocked",
    "expected blocked result",
  );

  return result;
}

function rootTruth(
  result: ReturnType<typeof execute>,
  authorityIndex = 0,
  candidateIndex = 0,
): Truth {
  const ready = assertReady(
    result,
  );

  return ready.authorityResults[
    authorityIndex
  ].rootCandidates[
    candidateIndex
  ].rootTruth
    .authorityBoundChildTruthEvidence
    .childTruthEvidence
    .truthDisposition;
}

Deno.test("A4.6a1f.1 coherent all true produces resolved_true", () => {
  const a = authority(
    "A",
    compoundNode(
      "$",
      "all",
      [
        leafNode("$.all[0]"),
        leafNode("$.all[1]"),
      ],
    ),
  );

  const result = execute(
    shapeResult([a]),
    [
      leafEvidence("A", "$.all[0]", "S1", "SS1", "resolved_true"),
      leafEvidence("A", "$.all[1]", "S1", "SS1", "resolved_true"),
    ],
  );

  assert(
    rootTruth(result) ===
      "resolved_true",
    "all true must be true",
  );
});

Deno.test("A4.6a1f.2 all with false produces resolved_false", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  const result = execute(
    shapeResult([a]),
    [
      leafEvidence("A", "$.all[0]", "S1", "SS1", "resolved_true"),
      leafEvidence("A", "$.all[1]", "S1", "SS1", "resolved_false"),
    ],
  );

  assert(
    rootTruth(result) ===
      "resolved_false",
    "all false must be false",
  );
});

Deno.test("A4.6a1f.3 all with unresolved and no false remains unresolved", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  const result = execute(
    shapeResult([a]),
    [
      leafEvidence("A", "$.all[0]", "S1", "SS1", "resolved_true"),
      leafEvidence("A", "$.all[1]", "S1", "SS1", "unresolved"),
    ],
  );

  assert(
    rootTruth(result) ===
      "unresolved",
    "all unresolved must remain unresolved",
  );
});

Deno.test("A4.6a1f.4 any with true produces resolved_true", () => {
  const a = authority(
    "A",
    compoundNode("$", "any", [
      leafNode("$.any[0]"),
      leafNode("$.any[1]"),
    ]),
  );

  const result = execute(
    shapeResult([a]),
    [
      leafEvidence("A", "$.any[0]", "S1", "SS1", "resolved_false"),
      leafEvidence("A", "$.any[1]", "S1", "SS1", "resolved_true"),
    ],
  );

  assert(
    rootTruth(result) ===
      "resolved_true",
    "any true must be true",
  );
});

Deno.test("A4.6a1f.5 any all false produces resolved_false", () => {
  const a = authority(
    "A",
    compoundNode("$", "any", [
      leafNode("$.any[0]"),
      leafNode("$.any[1]"),
    ]),
  );

  const result = execute(
    shapeResult([a]),
    [
      leafEvidence("A", "$.any[0]", "S1", "SS1", "resolved_false"),
      leafEvidence("A", "$.any[1]", "S1", "SS1", "resolved_false"),
    ],
  );

  assert(
    rootTruth(result) ===
      "resolved_false",
    "any all false must be false",
  );
});

Deno.test("A4.6a1f.6 any unresolved with no true remains unresolved", () => {
  const a = authority(
    "A",
    compoundNode("$", "any", [
      leafNode("$.any[0]"),
      leafNode("$.any[1]"),
    ]),
  );

  const result = execute(
    shapeResult([a]),
    [
      leafEvidence("A", "$.any[0]", "S1", "SS1", "resolved_false"),
      leafEvidence("A", "$.any[1]", "S1", "SS1", "unresolved"),
    ],
  );

  assert(
    rootTruth(result) ===
      "unresolved",
    "any unresolved must remain unresolved",
  );
});

Deno.test("A4.6a1f.7 not true becomes false", () => {
  const a = authority(
    "A",
    compoundNode("$", "not", [
      leafNode("$.not"),
    ]),
  );

  const result = execute(
    shapeResult([a]),
    [
      leafEvidence("A", "$.not", "S1", "SS1", "resolved_true"),
    ],
  );

  assert(
    rootTruth(result) ===
      "resolved_false",
    "not true must be false",
  );
});

Deno.test("A4.6a1f.8 not unresolved remains unresolved", () => {
  const a = authority(
    "A",
    compoundNode("$", "not", [
      leafNode("$.not"),
    ]),
  );

  const result = execute(
    shapeResult([a]),
    [
      leafEvidence("A", "$.not", "S1", "SS1", "unresolved"),
    ],
  );

  assert(
    rootTruth(result) ===
      "unresolved",
    "not unresolved must remain unresolved",
  );
});

Deno.test("A4.6a1f.9 mixed S1 and S2 children never compose", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$.all[0]", "S1", "SS1", "resolved_true"),
        leafEvidence("A", "$.all[1]", "S2", "SS2", "resolved_false"),
      ],
    ),
  );

  assert(
    result.authorityResults[0].rootCandidates.length ===
      0,
    "incoherent contexts must produce zero candidates",
  );
});

Deno.test("A4.6a1f.10 two complete coherent contexts remain two candidates", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$.all[0]", "S1", "SS1", "resolved_true"),
        leafEvidence("A", "$.all[1]", "S1", "SS1", "resolved_true"),
        leafEvidence(
          "A",
          "$.all[0]",
          "S2",
          "SS2",
          "resolved_false",
          "document-2",
          "sentence-2",
        ),
        leafEvidence(
          "A",
          "$.all[1]",
          "S2",
          "SS2",
          "resolved_true",
          "document-2",
          "sentence-2",
        ),
      ],
    ),
  );

  assert(
    result.authorityResults[0].rootCandidates.length ===
      2,
    "both complete contexts must survive",
  );
});

Deno.test("A4.6a1f.11 independent authorities may use different contexts", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  const b = authority(
    "B",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  const result = assertReady(
    execute(
      shapeResult([a, b]),
      [
        leafEvidence("A", "$.all[0]", "S1", "SS1", "resolved_true"),
        leafEvidence("A", "$.all[1]", "S1", "SS1", "resolved_true"),
        leafEvidence(
          "B",
          "$.all[0]",
          "S2",
          "SS2",
          "resolved_true",
          "document-2",
          "sentence-2",
        ),
        leafEvidence(
          "B",
          "$.all[1]",
          "S2",
          "SS2",
          "resolved_true",
          "document-2",
          "sentence-2",
        ),
      ],
    ),
  );

  assert(
    result.authorityResults.length ===
        2 &&
      result.authorityResults[0].rootCandidates.length ===
        1 &&
      result.authorityResults[1].rootCandidates.length ===
        1,
    "independent authorities must remain independently coherent",
  );
});

Deno.test("A4.6a1f.12 duplicate authority path context evidence blocks", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const evidence = leafEvidence(
    "A",
    "$",
    "S1",
    "SS1",
    "resolved_true",
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [
        evidence,
        evidence,
      ],
    ),
  );
});

Deno.test("A4.6a1f.13 same leaf path in different contexts is valid", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$", "S1", "SS1", "resolved_true"),
        leafEvidence(
          "A",
          "$",
          "S2",
          "SS2",
          "resolved_false",
          "document-2",
          "sentence-2",
        ),
      ],
    ),
  );

  assert(
    result.authorityResults[0].rootCandidates.length ===
      2,
    "same path under different context identities is not duplicate",
  );
});

Deno.test("A4.6a1f.14 graphDocumentId conflict inside same context blocks", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [
        leafEvidence(
          "A",
          "$.all[0]",
          "S1",
          "SS1",
          "resolved_true",
          "document-1",
        ),
        leafEvidence(
          "A",
          "$.all[1]",
          "S1",
          "SS1",
          "resolved_true",
          "document-other",
        ),
      ],
    ),
  );
});

Deno.test("A4.6a1f.15 sentenceNodeId conflict inside same context blocks", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [
        leafEvidence(
          "A",
          "$.all[0]",
          "S1",
          "SS1",
          "resolved_true",
          "document-1",
          "sentence-1",
        ),
        leafEvidence(
          "A",
          "$.all[1]",
          "S1",
          "SS1",
          "resolved_true",
          "document-1",
          "sentence-other",
        ),
      ],
    ),
  );
});

Deno.test("A4.6a1f.16 unknown structural authority evidence blocks", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [
        leafEvidence("UNKNOWN", "$", "S1", "SS1", "resolved_true"),
      ],
    ),
  );
});

Deno.test("A4.6a1f.17 unknown structural path evidence blocks", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$.missing", "S1", "SS1", "resolved_true"),
      ],
    ),
  );
});

Deno.test("A4.6a1f.18 external evidence for compound path blocks", () => {
  const a = authority(
    "A",
    compoundNode("$", "not", [
      leafNode("$.not"),
    ]),
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$", "S1", "SS1", "resolved_true"),
      ],
    ),
  );
});

Deno.test("A4.6a1f.19 external compound child truth is forbidden", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const evidence = leafEvidence(
    "A",
    "$",
    "S1",
    "SS1",
    "resolved_true",
  );

  const mutable = evidence
    .authorityBoundChildTruthEvidence
    .childTruthEvidence as unknown as {
      sourceKind: string;
    };

  mutable.sourceKind = "compound_condition_truth";

  assertBlocked(
    execute(
      shapeResult([a]),
      [
        evidence,
      ],
    ),
  );
});

Deno.test("A4.6a1f.20 missing leaf in candidate context yields zero root candidates", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$.all[0]", "S1", "SS1", "resolved_false"),
      ],
    ),
  );

  assert(
    result.authorityResults[0].rootCandidates.length ===
      0,
    "missing proof must not collapse to false",
  );
});

Deno.test("A4.6a1f.21 nested coherent recursion emits compound evidence at every compound node", () => {
  const inner = compoundNode(
    "$.all[0]",
    "any",
    [
      leafNode("$.all[0].any[0]"),
      leafNode("$.all[0].any[1]"),
    ],
  );

  const root = compoundNode(
    "$",
    "all",
    [
      inner,
      leafNode("$.all[1]"),
    ],
  );

  const a = authority(
    "A",
    root,
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$.all[0].any[0]", "S1", "SS1", "resolved_false"),
        leafEvidence("A", "$.all[0].any[1]", "S1", "SS1", "resolved_true"),
        leafEvidence("A", "$.all[1]", "S1", "SS1", "resolved_true"),
      ],
    ),
  );

  const candidate = result.authorityResults[0]
    .rootCandidates[0];

  assert(
    candidate.composedCompoundTruthEvidence.length ===
      2,
    "inner and root compound evidence must both be preserved",
  );
});

Deno.test("A4.6a1f.22 generated compound evidence remains in exact same context", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$.all[0]", "S1", "SS1", "resolved_true"),
        leafEvidence("A", "$.all[1]", "S1", "SS1", "resolved_true"),
      ],
    ),
  );

  const candidate = result.authorityResults[0]
    .rootCandidates[0];

  assert(
    candidate.rootTruth.snapshotIdentityId ===
        "S1" &&
      candidate.rootTruth.snapshotSentenceOccurrenceIdentityId ===
        "SS1",
    "compound context changed during recursion",
  );
});

Deno.test("A4.6a1f.23 authority with zero external evidence remains ready with zero candidates", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [],
    ),
  );

  assert(
    result.authorityResults[0].rootCandidates.length ===
      0,
    "zero proof must remain zero candidates",
  );
});

Deno.test("A4.6a1f.24 one authority may have zero candidates while another is ready", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const b = authority(
    "B",
    leafNode("$"),
  );

  const result = assertReady(
    execute(
      shapeResult([a, b]),
      [
        leafEvidence(
          "B",
          "$",
          "S2",
          "SS2",
          "resolved_true",
          "document-2",
          "sentence-2",
        ),
      ],
    ),
  );

  assert(
    result.authorityResults[0].rootCandidates.length ===
        0 &&
      result.authorityResults[1].rootCandidates.length ===
        1,
    "zero-candidate authority must not block independent authority",
  );
});

Deno.test("A4.6a1f.25 absent root is outside composable structural domain", () => {
  const a = authority(
    "A",
    {
      shape: "absent",
      path: "$",
    },
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [],
    ),
  );
});

Deno.test("A4.6a1f.26 unsupported root is outside composable structural domain", () => {
  const a = authority(
    "A",
    {
      shape: "unsupported",
      path: "$",
    },
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [],
    ),
  );
});

Deno.test("A4.6a1f.27 malformed all arity blocks structurally", () => {
  const a = authority(
    "A",
    compoundNode(
      "$",
      "all",
      [
        leafNode("$.all[0]"),
      ],
    ),
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [],
    ),
  );
});

Deno.test("A4.6a1f.28 malformed not arity blocks structurally", () => {
  const a = authority(
    "A",
    compoundNode(
      "$",
      "not",
      [
        leafNode("$.not[0]"),
        leafNode("$.not[1]"),
      ],
    ),
  );

  assertBlocked(
    execute(
      shapeResult([a]),
      [],
    ),
  );
});

Deno.test("A4.6a1f.29 leaf root preserves exact external context evidence object", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const evidence = leafEvidence(
    "A",
    "$",
    "S1",
    "SS1",
    "unresolved",
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        evidence,
      ],
    ),
  );

  assert(
    result.authorityResults[0]
      .rootCandidates[0]
      .rootTruth ===
      evidence,
    "leaf evidence object must be preserved by reference",
  );
});

Deno.test("A4.6a1f.30 source authority object is preserved by reference", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const source = shapeResult(
    [
      a,
    ],
  );

  const result = assertReady(
    execute(
      source,
      [],
    ),
  );

  assert(
    result.authorityResults[0]
      .sourceAuthority ===
      source.authorities[0],
    "authority object must not be reconstructed",
  );
});

Deno.test("A4.6a1f.31 multiple contexts are preserved deterministically without winner selection", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        leafEvidence(
          "A",
          "$",
          "S2",
          "SS2",
          "resolved_true",
          "document-2",
          "sentence-2",
        ),
        leafEvidence("A", "$", "S1", "SS1", "resolved_true"),
      ],
    ),
  );

  const candidates = result.authorityResults[0]
    .rootCandidates;

  assert(
    candidates.length ===
        2 &&
      candidates[0].snapshotIdentityId ===
        "S1" &&
      candidates[1].snapshotIdentityId ===
        "S2",
    "candidate preservation/order incorrect",
  );

  assert(
    result.governance.contextCandidateWinnerSelected ===
      false,
    "composer must not select a candidate",
  );
});

Deno.test("A4.6a1f.32 sentenceIndex and token occurrence never appear in generated context identity", () => {
  const a = authority(
    "A",
    compoundNode("$", "not", [
      leafNode("$.not"),
    ]),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$.not", "S1", "SS1", "resolved_true"),
      ],
    ),
  );

  const root = result.authorityResults[0]
    .rootCandidates[0]
    .rootTruth as unknown as Record<
      string,
      unknown
    >;

  assert(
    !("sentenceIndex" in root) &&
      !("tokenNodeId" in root) &&
      !("snapshotTokenOccurrenceIdentityId" in root),
    "narrower occurrence identity leaked into sentence context",
  );
});

Deno.test("A4.6a1f.33 exact composer identity and specification are stable", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [],
    ),
  );

  assert(
    result.producer ===
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1 &&
      result.producerVersion ===
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1 &&
      result.specificationId ===
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1,
    "composer identity mismatch",
  );
});

Deno.test("A4.6a1f.34 zero candidates are neither false nor unresolved truth", () => {
  const a = authority(
    "A",
    compoundNode("$", "all", [
      leafNode("$.all[0]"),
      leafNode("$.all[1]"),
    ]),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [
        leafEvidence("A", "$.all[0]", "S1", "SS1", "resolved_false"),
      ],
    ),
  );

  assert(
    result.authorityResults[0].rootCandidates.length ===
      0,
    "zero candidate domain must remain empty",
  );
});

Deno.test("A4.6a1f.35 semantic ceiling forbids selection binding cardinality mutation and learner error", () => {
  const a = authority(
    "A",
    leafNode("$"),
  );

  const result = assertReady(
    execute(
      shapeResult([a]),
      [],
    ),
  );

  assert(
    result.governance.crossAuthorityContextEqualityRequired ===
        false &&
      result.governance.multipleCompleteContextsBlockAsNonunique ===
        false &&
      result.governance.contextCandidateWinnerSelected ===
        false &&
      result.governance.runtimeSentenceContextSelected ===
        false &&
      result.governance.occurrenceFilteringPerformed ===
        false &&
      result.governance.occurrenceWinnerSelected ===
        false &&
      result.governance.finalRuntimeOccurrenceBindingPerformed ===
        false &&
      result.governance.cardinalitySemanticsResolved ===
        false &&
      result.governance.cardinalityEnforcementPerformed ===
        false &&
      result.governance.graphMutationPerformed ===
        false &&
      result.governance.learnerErrorClassified ===
        false &&
      result.governance.frozenGrammarReadOnly ===
        true,
    "semantic ceiling violated",
  );
});
