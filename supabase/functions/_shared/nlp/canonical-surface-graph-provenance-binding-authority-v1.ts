import {
  type CanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import type {
  CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

export const CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1 =
  "canonical_surface_graph_provenance_binding_authority_v1";

export const CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_VERSION_V1 =
  "1";

export const CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1 =
  "canonical_surface_adapter_v1";

export const CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_PROVENANCE_ID_V1 =
  "prov:surface:canonical-v1";

export type CanonicalSurfaceGraphProvenanceBindingAuthorityV1 = {
  authorityId: typeof CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1;

  status: "resolved";

  surfaceVersion: "canonical-surface-boundary-v1";

  graphVersion: "canonical-language-graph-v1";

  graphDocumentId: string;

  surfaceTextLengthUtf16: number;

  surfaceTokenIds: string[];

  surfaceSentenceIds: string[];

  sourceAdapterNodeIds: string[];

  sourceAdapterEdgeIds: string[];

  sourceAdapterProvenanceIds: string[];

  sourceAdapterCounts: {
    documentNodes: number;

    sentenceNodes: number;

    tokenNodes: number;

    containsEdges: number;
  };

  governance: {
    expectedBaseGraphRebuiltFromExactSurface: true;

    canonicalCoreBuilderUsedForExpectedSubstrate: true;

    exactSurfaceAdapterDocumentPreserved: true;

    exactSurfaceAdapterSentencesPreserved: true;

    exactSurfaceAdapterTokensPreserved: true;

    exactSurfaceAdapterContainmentEdgesPreserved: true;

    exactSurfaceProvenanceRecordPreserved: true;

    exactSurfaceAdapterProducerStatePreserved: true;

    exactSurfaceDerivedObjectShapesPreserved: true;

    exactSurfaceDerivedArrayOrderInsideObjectsPreserved: true;

    sourceAdapterObjectCollectionOrderRequired: false;

    laterNonSurfaceGraphEnrichmentAllowed: true;

    wholeGraphEqualityWithBaseGraphRequired: false;

    graphDocumentIdPreservedAsProvenance: true;

    graphDocumentIdUsedAsSnapshotIdentity: false;

    snapshotIdentityDerived: false;

    snapshotAuthorityConsumed: false;

    posSemanticsConsumed: false;

    morphologySemanticsConsumed: false;

    phraseSemanticsConsumed: false;

    predicateSemanticsConsumed: false;

    clauseSemanticsConsumed: false;

    runtimeConsumed: false;

    manifestConsumed: false;

    whereSemanticsResolved: false;

    comparisonPerformed: false;

    comparisonTruthResolved: false;

    occurrenceFilteringPerformed: false;

    occurrenceBindingPerformed: false;

    cardinalityEnforcementPerformed: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalSurfaceGraphProvenanceBindingAuthorityResultV1 = {
  producer: typeof CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1;

  producerVersion:
    typeof CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_VERSION_V1;

  status:
    | "ready"
    | "blocked";

  authority?: CanonicalSurfaceGraphProvenanceBindingAuthorityV1;

  blockingReasons: string[];
};

function blockedResult(
  reasons: readonly string[],
): CanonicalSurfaceGraphProvenanceBindingAuthorityResultV1 {
  return {
    producer: CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1,

    producerVersion:
      CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_VERSION_V1,

    status: "blocked",

    blockingReasons: [
      ...new Set(
        reasons,
      ),
    ].sort(),
  };
}

function plainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (
    typeof value !==
      "object" ||
    value ===
      null ||
    Array.isArray(
      value,
    )
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(
    value,
  );

  return (
    prototype ===
      Object.prototype ||
    prototype ===
      null
  );
}

function deepExactEqualV1(
  left: unknown,
  right: unknown,
  seen: WeakMap<object, WeakSet<object>> = new WeakMap(),
): boolean {
  if (
    Object.is(
      left,
      right,
    )
  ) {
    return true;
  }

  if (
    typeof left !==
      typeof right
  ) {
    return false;
  }

  if (
    left ===
      null ||
    right ===
      null
  ) {
    return false;
  }

  if (
    typeof left !==
      "object" ||
    typeof right !==
      "object"
  ) {
    return false;
  }

  if (
    Array.isArray(
      left,
    ) ||
    Array.isArray(
      right,
    )
  ) {
    if (
      !Array.isArray(
        left,
      ) ||
      !Array.isArray(
        right,
      ) ||
      left.length !==
        right.length
    ) {
      return false;
    }

    for (
      let index = 0;
      index <
        left.length;
      index++
    ) {
      if (
        !deepExactEqualV1(
          left[index],
          right[index],
          seen,
        )
      ) {
        return false;
      }
    }

    return true;
  }

  if (
    !plainObject(
      left,
    ) ||
    !plainObject(
      right,
    )
  ) {
    return false;
  }

  let seenRight = seen.get(
    left,
  );

  if (
    seenRight?.has(
      right,
    )
  ) {
    return true;
  }

  if (
    !seenRight
  ) {
    seenRight = new WeakSet<object>();

    seen.set(
      left,
      seenRight,
    );
  }

  seenRight.add(
    right,
  );

  const leftKeys = Object.keys(
    left,
  ).sort();

  const rightKeys = Object.keys(
    right,
  ).sort();

  if (
    leftKeys.length !==
      rightKeys.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index <
      leftKeys.length;
    index++
  ) {
    if (
      leftKeys[index] !==
        rightKeys[index]
    ) {
      return false;
    }
  }

  for (
    const key of leftKeys
  ) {
    if (
      !deepExactEqualV1(
        left[key],
        right[key],
        seen,
      )
    ) {
      return false;
    }
  }

  return true;
}

function exactExpectedNodeById(
  graph: CanonicalLanguageGraphV1,
  expectedNode: CanonicalLanguageGraphV1["nodes"][number],
): boolean {
  const matches = graph.nodes.filter(
    (node) =>
      node.id ===
        expectedNode.id,
  );

  return (
    matches.length ===
      1 &&
    deepExactEqualV1(
      matches[0],
      expectedNode,
    )
  );
}

function exactExpectedEdgeById(
  graph: CanonicalLanguageGraphV1,
  expectedEdge: CanonicalLanguageGraphV1["edges"][number],
): boolean {
  const matches = graph.edges.filter(
    (edge) =>
      edge.id ===
        expectedEdge.id,
  );

  return (
    matches.length ===
      1 &&
    deepExactEqualV1(
      matches[0],
      expectedEdge,
    )
  );
}

function exactExpectedProvenanceById(
  graph: CanonicalLanguageGraphV1,
  expected: CanonicalLanguageGraphV1["provenance"][number],
): boolean {
  const matches = graph.provenance.filter(
    (entry) =>
      entry.id ===
        expected.id,
  );

  return (
    matches.length ===
      1 &&
    deepExactEqualV1(
      matches[0],
      expected,
    )
  );
}

export function deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
): CanonicalSurfaceGraphProvenanceBindingAuthorityResultV1 {
  const reasons: string[] = [];

  if (
    surface.version !==
      "canonical-surface-boundary-v1"
  ) {
    reasons.push(
      "surface:unexpected_version",
    );
  }

  if (
    graph.version !==
      "canonical-language-graph-v1"
  ) {
    reasons.push(
      "graph:unexpected_version",
    );
  }

  if (
    graph.surfaceVersion !==
      surface.version
  ) {
    reasons.push(
      "graph:surface_version_mismatch",
    );
  }

  if (
    reasons.length >
      0
  ) {
    return blockedResult(
      reasons,
    );
  }

  const expectedGraph = createCanonicalLanguageGraphV1(
    surface,
  );

  if (
    graph.documentId !==
      expectedGraph.documentId
  ) {
    reasons.push(
      "graph:document_id_not_derived_from_surface",
    );
  }

  const expectedAdapterNodes = expectedGraph.nodes.filter(
    (node) =>
      node.producer ===
        CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
  );

  const actualAdapterNodes = graph.nodes.filter(
    (node) =>
      node.producer ===
        CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
  );

  if (
    actualAdapterNodes.length !==
      expectedAdapterNodes.length
  ) {
    reasons.push(
      "surface_adapter_nodes:count_mismatch",
    );
  }

  for (
    const expectedNode of expectedAdapterNodes
  ) {
    if (
      !exactExpectedNodeById(
        graph,
        expectedNode,
      )
    ) {
      reasons.push(
        `surface_adapter_node:${expectedNode.id}:missing_duplicated_or_changed`,
      );
    }
  }

  const expectedAdapterEdges = expectedGraph.edges.filter(
    (edge) =>
      edge.producer ===
        CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
  );

  const actualAdapterEdges = graph.edges.filter(
    (edge) =>
      edge.producer ===
        CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
  );

  if (
    actualAdapterEdges.length !==
      expectedAdapterEdges.length
  ) {
    reasons.push(
      "surface_adapter_edges:count_mismatch",
    );
  }

  for (
    const expectedEdge of expectedAdapterEdges
  ) {
    if (
      !exactExpectedEdgeById(
        graph,
        expectedEdge,
      )
    ) {
      reasons.push(
        `surface_adapter_edge:${expectedEdge.id}:missing_duplicated_or_changed`,
      );
    }
  }

  for (
    const expectedProvenance of expectedGraph.provenance
  ) {
    if (
      !exactExpectedProvenanceById(
        graph,
        expectedProvenance,
      )
    ) {
      reasons.push(
        `surface_provenance:${expectedProvenance.id}:missing_duplicated_or_changed`,
      );
    }
  }

  const expectedProducerState = expectedGraph.producerState[
    CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1
  ];

  const actualProducerState = graph.producerState[
    CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1
  ];

  if (
    !deepExactEqualV1(
      actualProducerState,
      expectedProducerState,
    )
  ) {
    reasons.push(
      "surface_adapter_producer_state:mismatch",
    );
  }

  if (
    reasons.length >
      0
  ) {
    return blockedResult(
      reasons,
    );
  }

  const documentNodes = expectedAdapterNodes.filter(
    (node) =>
      node.type ===
        "document",
  );

  const sentenceNodes = expectedAdapterNodes.filter(
    (node) =>
      node.type ===
        "sentence",
  );

  const tokenNodes = expectedAdapterNodes.filter(
    (node) =>
      node.type ===
        "token",
  );

  const containsEdges = expectedAdapterEdges.filter(
    (edge) =>
      edge.relation ===
        "contains",
  );

  return {
    producer: CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1,

    producerVersion:
      CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_VERSION_V1,

    status: "ready",

    authority: {
      authorityId: CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1,

      status: "resolved",

      surfaceVersion: surface.version,

      graphVersion: graph.version,

      graphDocumentId: graph.documentId,

      surfaceTextLengthUtf16: surface.textLengthUtf16,

      surfaceTokenIds: surface.tokens.map(
        (token) => token.id,
      ),

      surfaceSentenceIds: surface.sentences.map(
        (sentence) => sentence.id,
      ),

      sourceAdapterNodeIds: expectedAdapterNodes.map(
        (node) => node.id,
      ),

      sourceAdapterEdgeIds: expectedAdapterEdges.map(
        (edge) => edge.id,
      ),

      sourceAdapterProvenanceIds: expectedGraph.provenance.map(
        (entry) => entry.id,
      ),

      sourceAdapterCounts: {
        documentNodes: documentNodes.length,

        sentenceNodes: sentenceNodes.length,

        tokenNodes: tokenNodes.length,

        containsEdges: containsEdges.length,
      },

      governance: {
        expectedBaseGraphRebuiltFromExactSurface: true,

        canonicalCoreBuilderUsedForExpectedSubstrate: true,

        exactSurfaceAdapterDocumentPreserved: true,

        exactSurfaceAdapterSentencesPreserved: true,

        exactSurfaceAdapterTokensPreserved: true,

        exactSurfaceAdapterContainmentEdgesPreserved: true,

        exactSurfaceProvenanceRecordPreserved: true,

        exactSurfaceAdapterProducerStatePreserved: true,

        exactSurfaceDerivedObjectShapesPreserved: true,

        exactSurfaceDerivedArrayOrderInsideObjectsPreserved: true,

        sourceAdapterObjectCollectionOrderRequired: false,

        laterNonSurfaceGraphEnrichmentAllowed: true,

        wholeGraphEqualityWithBaseGraphRequired: false,

        graphDocumentIdPreservedAsProvenance: true,

        graphDocumentIdUsedAsSnapshotIdentity: false,

        snapshotIdentityDerived: false,

        snapshotAuthorityConsumed: false,

        posSemanticsConsumed: false,

        morphologySemanticsConsumed: false,

        phraseSemanticsConsumed: false,

        predicateSemanticsConsumed: false,

        clauseSemanticsConsumed: false,

        runtimeConsumed: false,

        manifestConsumed: false,

        whereSemanticsResolved: false,

        comparisonPerformed: false,

        comparisonTruthResolved: false,

        occurrenceFilteringPerformed: false,

        occurrenceBindingPerformed: false,

        cardinalityEnforcementPerformed: false,

        graphMutationPerformed: false,

        learnerErrorClassified: false,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
