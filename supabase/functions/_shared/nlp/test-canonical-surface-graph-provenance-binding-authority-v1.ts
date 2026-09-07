import {
  applyGraphPatchV1,
  type CanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
  type LanguageGraphEdgeV1,
  type LanguageGraphNodeV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  buildCanonicalSurfaceDocumentV1,
  type CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1,
  CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_VERSION_V1,
  CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
  CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_PROVENANCE_ID_V1,
  deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1,
} from "./canonical-surface-graph-provenance-binding-authority-v1.ts";

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

function surface(
  text: string,
): CanonicalSurfaceDocumentV1 {
  return buildCanonicalSurfaceDocumentV1(
    text,
  );
}

function graph(
  source: CanonicalSurfaceDocumentV1,
): CanonicalLanguageGraphV1 {
  return createCanonicalLanguageGraphV1(
    source,
  );
}

function replaceNode(
  source: CanonicalLanguageGraphV1,
  nodeId: string,
  transform: (
    node: LanguageGraphNodeV1,
  ) => LanguageGraphNodeV1,
): CanonicalLanguageGraphV1 {
  return {
    ...source,

    nodes: source.nodes.map(
      (node) =>
        node.id ===
            nodeId
          ? transform(
            node,
          )
          : node,
    ),
  };
}

function replaceEdge(
  source: CanonicalLanguageGraphV1,
  edgeId: string,
  transform: (
    edge: LanguageGraphEdgeV1,
  ) => LanguageGraphEdgeV1,
): CanonicalLanguageGraphV1 {
  return {
    ...source,

    edges: source.edges.map(
      (edge) =>
        edge.id ===
            edgeId
          ? transform(
            edge,
          )
          : edge,
    ),
  };
}

function firstSurfaceToken(
  source: CanonicalLanguageGraphV1,
): LanguageGraphNodeV1 {
  const node = source.nodes.find(
    (candidate) =>
      candidate.type ===
        "token" &&
      candidate.producer ===
        CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
  );

  assert(
    node !== undefined,
    "surface token fixture missing",
  );

  return node;
}

function firstSurfaceSentence(
  source: CanonicalLanguageGraphV1,
): LanguageGraphNodeV1 {
  const node = source.nodes.find(
    (candidate) =>
      candidate.type ===
        "sentence" &&
      candidate.producer ===
        CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
  );

  assert(
    node !== undefined,
    "surface sentence fixture missing",
  );

  return node;
}

function firstSurfaceContainsEdge(
  source: CanonicalLanguageGraphV1,
): LanguageGraphEdgeV1 {
  const edge = source.edges.find(
    (candidate) =>
      candidate.relation ===
        "contains" &&
      candidate.producer ===
        CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
  );

  assert(
    edge !== undefined,
    "surface contains-edge fixture missing",
  );

  return edge;
}

Deno.test(
  "binding.1 exact authority identity status provenance and counts are exposed",
  () => {
    const s = surface(
      "Aa bb. Cc!",
    );

    const g = graph(
      s,
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      g,
    );

    const authority = result.authority;

    assert(
      result.producer ===
          CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1 &&
        result.producerVersion ===
          CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_VERSION_V1 &&
        result.status ===
          "ready" &&
        result.blockingReasons.length ===
          0 &&
        authority?.status ===
          "resolved",
      "binding authority result contract mismatch",
    );

    assert(
      authority.authorityId ===
          CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1 &&
        authority.graphDocumentId ===
          g.documentId &&
        authority.surfaceVersion ===
          s.version &&
        authority.graphVersion ===
          g.version &&
        authority.surfaceTextLengthUtf16 ===
          s.textLengthUtf16,
      "binding provenance metadata mismatch",
    );

    assert(
      authority.sourceAdapterCounts.documentNodes ===
          1 &&
        authority.sourceAdapterCounts.sentenceNodes ===
          s.sentences.length &&
        authority.sourceAdapterCounts.tokenNodes ===
          s.tokens.length &&
        authority.sourceAdapterCounts.containsEdges ===
          s.sentences.length +
            s.tokens.filter(
              (token) =>
                token.sentenceIndex !==
                  null,
            ).length,
      "surface-adapter counts mismatch",
    );
  },
);

Deno.test(
  "binding.2 independently built matched surface graph pairs are accepted",
  () => {
    const s1 = surface(
      "aa bb",
    );

    const s2 = surface(
      "aa bb",
    );

    const g1 = graph(
      s1,
    );

    const g2 = graph(
      s2,
    );

    assert(
      g1 !==
        g2,
      "fixture graphs unexpectedly share object identity",
    );

    const a = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s1,
      g1,
    );

    const b = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s2,
      g2,
    );

    assert(
      a.status ===
          "ready" &&
        b.status ===
          "ready",
      "matched independently constructed pairs blocked",
    );
  },
);

Deno.test(
  "binding.3 valid later graph enrichment does not break surface ancestry",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const enriched = applyGraphPatchV1(
      base,
      {
        producer: "binding-golden-enrichment",

        producerVersion: "1",

        nodes: [
          {
            id: "semantic:binding-golden",

            type: "semantic_unit",

            status: "candidate",

            features: {
              golden: true,
            },

            producer: "binding-golden-enrichment",

            evidenceIds: [],

            provenanceIds: [],
          },
        ],
      },
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      enriched,
    );

    assert(
      result.status ===
        "ready",
      "later non-surface enrichment incorrectly broke ancestry",
    );
  },
);

Deno.test(
  "binding.4 same-length cross-surface graph pairs block despite structural ID collision",
  () => {
    const sA = surface(
      "aa bb",
    );

    const sB = surface(
      "cc dd",
    );

    const gA = graph(
      sA,
    );

    const gB = graph(
      sB,
    );

    assert(
      gA.documentId ===
          gB.documentId &&
        sA.tokens[0]
            ?.id ===
          sB.tokens[0]
            ?.id,
      "fixture no longer preserves structural ID collision",
    );

    const ab = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      sA,
      gB,
    );

    const ba = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      sB,
      gA,
    );

    assert(
      ab.status ===
          "blocked" &&
        ba.status ===
          "blocked" &&
        ab.authority ===
          undefined &&
        ba.authority ===
          undefined,
      "cross-surface graph mismatch accepted",
    );
  },
);

Deno.test(
  "binding.5 changed canonical token surface blocks",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const token = firstSurfaceToken(
      base,
    );

    const damaged = replaceNode(
      base,
      token.id,
      (node) => ({
        ...node,

        features: {
          ...node.features,

          surface: "zz",
        },
      }),
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          `surface_adapter_node:${token.id}:missing_duplicated_or_changed`,
        ),
      "changed canonical token surface accepted",
    );
  },
);

Deno.test(
  "binding.6 changed canonical token normalizedSurface blocks",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const token = firstSurfaceToken(
      base,
    );

    const damaged = replaceNode(
      base,
      token.id,
      (node) => ({
        ...node,

        features: {
          ...node.features,

          normalizedSurface: "zz",
        },
      }),
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          `surface_adapter_node:${token.id}:missing_duplicated_or_changed`,
        ),
      "changed token normalizedSurface accepted",
    );
  },
);

Deno.test(
  "binding.7 changed canonical token index metadata blocks",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const token = firstSurfaceToken(
      base,
    );

    const damaged = replaceNode(
      base,
      token.id,
      (node) => ({
        ...node,

        features: {
          ...node.features,

          documentTokenIndex: 999,
        },
      }),
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
        "blocked",
      "changed token index accepted",
    );
  },
);

Deno.test(
  "binding.8 changed canonical token span blocks",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const token = firstSurfaceToken(
      base,
    );

    assert(
      token.span !==
        undefined,
      "token span fixture missing",
    );

    const damaged = replaceNode(
      base,
      token.id,
      (node) => ({
        ...node,

        span: node.span
          ? {
            ...node.span,

            endUtf16: node.span
              .endUtf16! +
              1,
          }
          : node.span,
      }),
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
        "blocked",
      "changed token span accepted",
    );
  },
);

Deno.test(
  "binding.9 changed canonical sentence index blocks",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const sentence = firstSurfaceSentence(
      base,
    );

    const damaged = replaceNode(
      base,
      sentence.id,
      (node) => ({
        ...node,

        features: {
          ...node.features,

          sentenceIndex: 999,
        },
      }),
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
        "blocked",
      "changed sentence index accepted",
    );
  },
);

Deno.test(
  "binding.10 changed canonical sentence boundary provenance blocks",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const sentence = firstSurfaceSentence(
      base,
    );

    const damaged = replaceNode(
      base,
      sentence.id,
      (node) => ({
        ...node,

        features: {
          ...node.features,

          boundaryCandidateId: "boundary:wrong",
        },
      }),
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
        "blocked",
      "changed sentence boundary accepted",
    );
  },
);

Deno.test(
  "binding.11 missing canonical surface token blocks count and identity",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const token = firstSurfaceToken(
      base,
    );

    const damaged: CanonicalLanguageGraphV1 = {
      ...base,

      nodes: base.nodes.filter(
        (node) =>
          node.id !==
            token.id,
      ),
    };

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "surface_adapter_nodes:count_mismatch",
        ) &&
        result.blockingReasons.includes(
          `surface_adapter_node:${token.id}:missing_duplicated_or_changed`,
        ),
      "missing canonical token not detected",
    );
  },
);

Deno.test(
  "binding.12 missing canonical containment edge blocks",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const edge = firstSurfaceContainsEdge(
      base,
    );

    const damaged: CanonicalLanguageGraphV1 = {
      ...base,

      edges: base.edges.filter(
        (candidate) =>
          candidate.id !==
            edge.id,
      ),
    };

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "surface_adapter_edges:count_mismatch",
        ) &&
        result.blockingReasons.includes(
          `surface_adapter_edge:${edge.id}:missing_duplicated_or_changed`,
        ),
      "missing canonical contains edge not detected",
    );
  },
);

Deno.test(
  "binding.13 changed canonical surface provenance record blocks",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const damaged: CanonicalLanguageGraphV1 = {
      ...base,

      provenance: base.provenance.map(
        (entry) =>
          entry.id ===
              CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_PROVENANCE_ID_V1
            ? {
              ...entry,

              payload: {
                ...entry.payload,

                surfaceVersion: "wrong-surface-version",
              },
            }
            : entry,
      ),
    };

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          `surface_provenance:${CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_PROVENANCE_ID_V1}:missing_duplicated_or_changed`,
        ),
      "changed surface provenance accepted",
    );
  },
);

Deno.test(
  "binding.14 changed canonical surface adapter producer state blocks",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const state = base.producerState[
      CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1
    ];

    assert(
      state !==
        undefined,
      "surface adapter producer-state fixture missing",
    );

    const damaged: CanonicalLanguageGraphV1 = {
      ...base,

      producerState: {
        ...base.producerState,

        [CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1]: {
          ...state,

          factsAdded: state.factsAdded +
            1,
        },
      },
    };

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "surface_adapter_producer_state:mismatch",
        ),
      "changed adapter producer state accepted",
    );
  },
);

Deno.test(
  "binding.15 extra fake canonical surface adapter node blocks substrate count",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const damaged: CanonicalLanguageGraphV1 = {
      ...base,

      nodes: [
        ...base.nodes,

        {
          id: "token:fake-surface-adapter",

          type: "token",

          subtype: "word",

          status: "resolved",

          features: {
            documentTokenIndex: 999,

            sentenceIndex: null,

            sentenceTokenIndex: null,

            surface: "fake",

            normalizedSurface: "fake",

            kind: "word",
          },

          producer:
            CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,

          evidenceIds: [],

          provenanceIds: [
            CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_PROVENANCE_ID_V1,
          ],
        },
      ],
    };

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "surface_adapter_nodes:count_mismatch",
        ),
      "extra canonical surface-adapter node accepted",
    );
  },
);

Deno.test(
  "binding.16 graph node and edge collection reordering remains allowed",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const reordered: CanonicalLanguageGraphV1 = {
      ...base,

      nodes: [
        ...base.nodes,
      ].reverse(),

      edges: [
        ...base.edges,
      ].reverse(),
    };

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      reordered,
    );

    assert(
      result.status ===
        "ready",
      "graph collection order was incorrectly made provenance-significant",
    );
  },
);

Deno.test(
  "binding.17 object property insertion order is not provenance-significant",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const token = firstSurfaceToken(
      base,
    );

    const reordered = replaceNode(
      base,
      token.id,
      (node) => ({
        provenanceIds: node.provenanceIds,

        evidenceIds: node.evidenceIds,

        producer: node.producer,

        features: {
          kind: node.features
            .kind,

          normalizedSurface: node.features
            .normalizedSurface,

          surface: node.features
            .surface,

          sentenceTokenIndex: node.features
            .sentenceTokenIndex,

          sentenceIndex: node.features
            .sentenceIndex,

          documentTokenIndex: node.features
            .documentTokenIndex,
        },

        span: node.span,

        status: node.status,

        subtype: node.subtype,

        type: node.type,

        id: node.id,
      }),
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      reordered,
    );

    assert(
      result.status ===
        "ready",
      "object key insertion order leaked into provenance equality",
    );
  },
);

Deno.test(
  "binding.18 array order inside exact surface-derived object remains significant",
  () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const sentence = firstSurfaceSentence(
      base,
    );

    assert(
      sentence.span?.tokenIds !==
          undefined &&
        sentence.span.tokenIds.length >
          1,
      "sentence fixture requires multiple token ids",
    );

    const damaged = replaceNode(
      base,
      sentence.id,
      (node) => ({
        ...node,

        span: node.span
          ? {
            ...node.span,

            tokenIds: node.span.tokenIds
              ? [
                ...node.span.tokenIds,
              ].reverse()
              : node.span.tokenIds,
          }
          : node.span,
      }),
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      damaged,
    );

    assert(
      result.status ===
        "blocked",
      "array order inside exact surface-derived span was normalized away",
    );
  },
);

Deno.test(
  "binding.19 derivation is deterministic and read only",
  () => {
    const s = surface(
      "Aa bb. Cc!",
    );

    const g = graph(
      s,
    );

    const beforeSurface = JSON.stringify(
      s,
    );

    const beforeGraph = JSON.stringify(
      g,
    );

    const first = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      g,
    );

    const second = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      g,
    );

    assert(
      first.status ===
          "ready" &&
        second.status ===
          "ready" &&
        JSON.stringify(
            first,
          ) ===
          JSON.stringify(
            second,
          ),
      "binding authority is not deterministic",
    );

    assert(
      JSON.stringify(
            s,
          ) ===
          beforeSurface &&
        JSON.stringify(
            g,
          ) ===
          beforeGraph,
      "binding authority mutated canonical inputs",
    );
  },
);

Deno.test(
  "binding.20 governance owns same-source ancestry only and no downstream semantics",
  () => {
    const s = surface(
      "aa bb",
    );

    const g = graph(
      s,
    );

    const result = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      s,
      g,
    );

    const governance = result.authority
      ?.governance;

    assert(
      governance !==
          undefined &&
        governance.expectedBaseGraphRebuiltFromExactSurface ===
          true &&
        governance.canonicalCoreBuilderUsedForExpectedSubstrate ===
          true &&
        governance.exactSurfaceAdapterDocumentPreserved ===
          true &&
        governance.exactSurfaceAdapterSentencesPreserved ===
          true &&
        governance.exactSurfaceAdapterTokensPreserved ===
          true &&
        governance.exactSurfaceAdapterContainmentEdgesPreserved ===
          true &&
        governance.exactSurfaceProvenanceRecordPreserved ===
          true &&
        governance.exactSurfaceAdapterProducerStatePreserved ===
          true &&
        governance.exactSurfaceDerivedObjectShapesPreserved ===
          true &&
        governance.exactSurfaceDerivedArrayOrderInsideObjectsPreserved ===
          true &&
        governance.sourceAdapterObjectCollectionOrderRequired ===
          false &&
        governance.laterNonSurfaceGraphEnrichmentAllowed ===
          true &&
        governance.wholeGraphEqualityWithBaseGraphRequired ===
          false &&
        governance.graphDocumentIdPreservedAsProvenance ===
          true &&
        governance.graphDocumentIdUsedAsSnapshotIdentity ===
          false &&
        governance.snapshotIdentityDerived ===
          false &&
        governance.snapshotAuthorityConsumed ===
          false &&
        governance.posSemanticsConsumed ===
          false &&
        governance.morphologySemanticsConsumed ===
          false &&
        governance.phraseSemanticsConsumed ===
          false &&
        governance.predicateSemanticsConsumed ===
          false &&
        governance.clauseSemanticsConsumed ===
          false &&
        governance.runtimeConsumed ===
          false &&
        governance.manifestConsumed ===
          false &&
        governance.whereSemanticsResolved ===
          false &&
        governance.comparisonPerformed ===
          false &&
        governance.comparisonTruthResolved ===
          false &&
        governance.occurrenceFilteringPerformed ===
          false &&
        governance.occurrenceBindingPerformed ===
          false &&
        governance.cardinalityEnforcementPerformed ===
          false &&
        governance.graphMutationPerformed ===
          false &&
        governance.learnerErrorClassified ===
          false &&
        governance.frozenGrammarReadOnly ===
          true,
      "binding authority crossed same-source provenance boundary",
    );
  },
);
