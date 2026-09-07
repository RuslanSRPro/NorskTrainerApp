import {
  type CanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  buildCanonicalSurfaceDocumentV1,
  type CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1,
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_HASH_ALGORITHM_V1,
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_SERIALIZATION_V1,
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

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

function replaceDocumentNode(
  source: CanonicalLanguageGraphV1,
  transform: (
    node: CanonicalLanguageGraphV1["nodes"][number],
  ) => CanonicalLanguageGraphV1["nodes"][number],
): CanonicalLanguageGraphV1 {
  return {
    ...source,

    nodes: source.nodes.map(
      (node) =>
        node.type ===
            "document" &&
          node.id ===
            source.documentId
          ? transform(
            node,
          )
          : node,
    ),
  };
}

function exactJson(
  value: unknown,
): string {
  return JSON.stringify(
    value,
  );
}

Deno.test(
  "snapshot-id.1 authority identity hash format and provenance contract are exact",
  async () => {
    const s = surface(
      "Jeg går hjem.",
    );

    const g = graph(
      s,
    );

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      g,
    );

    const authority = result.authority;

    assert(
      result.producer ===
          CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1 &&
        result.producerVersion ===
          CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1 &&
        result.status ===
          "ready" &&
        authority?.status ===
          "resolved",
      "authority result identity/status mismatch",
    );

    assert(
      authority.hashAlgorithm ===
          CANONICAL_GRAPH_SNAPSHOT_IDENTITY_HASH_ALGORITHM_V1 &&
        authority.canonicalSerialization ===
          CANONICAL_GRAPH_SNAPSHOT_IDENTITY_SERIALIZATION_V1,
      "hash/serialization contract mismatch",
    );

    assert(
      /^[0-9a-f]{64}$/.test(
        authority.snapshotSha256,
      ) &&
        /^[0-9a-f]{64}$/.test(
          authority.surfaceSnapshotSha256,
        ) &&
        /^[0-9a-f]{64}$/.test(
          authority.graphStateSha256,
        ),
      "SHA-256 digests are not lowercase 64-character hex",
    );

    assert(
      authority.snapshotIdentityId ===
        `canonical-graph-snapshot:sha256:${authority.snapshotSha256}`,
      "snapshot identity ID does not bind exact digest",
    );

    assert(
      authority.graphDocumentId ===
          g.documentId &&
        authority.graphVersion ===
          g.version &&
        authority.surfaceVersion ===
          s.version &&
        authority.surfaceTextLengthUtf16 ===
          s.textLengthUtf16,
      "canonical input provenance was not preserved",
    );
  },
);

Deno.test(
  "snapshot-id.2 independently constructed identical canonical inputs reproduce identity",
  async () => {
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

    const a = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s1,
      g1,
    );

    const b = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s2,
      g2,
    );

    assert(
      a.status ===
          "ready" &&
        b.status ===
          "ready" &&
        a.authority?.snapshotIdentityId ===
          b.authority?.snapshotIdentityId &&
        a.authority?.surfaceSnapshotSha256 ===
          b.authority?.surfaceSnapshotSha256 &&
        a.authority?.graphStateSha256 ===
          b.authority?.graphStateSha256,
      "identical canonical snapshots did not reproduce identity",
    );
  },
);

Deno.test(
  "snapshot-id.3 same-length different source content separates despite complete structural ID collision",
  async () => {
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

    const nodeIdsA = gA.nodes
      .map(
        (node) => node.id,
      )
      .sort();

    const nodeIdsB = gB.nodes
      .map(
        (node) => node.id,
      )
      .sort();

    const edgeIdsA = gA.edges
      .map(
        (edge) => edge.id,
      )
      .sort();

    const edgeIdsB = gB.edges
      .map(
        (edge) => edge.id,
      )
      .sort();

    assert(
      sA.textLengthUtf16 ===
          sB.textLengthUtf16 &&
        gA.documentId ===
          gB.documentId &&
        exactJson(
            nodeIdsA,
          ) ===
          exactJson(
            nodeIdsB,
          ) &&
        exactJson(
            edgeIdsA,
          ) ===
          exactJson(
            edgeIdsB,
          ),
      "fixture no longer proves structural identity collision",
    );

    const a = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      sA,
      gA,
    );

    const b = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      sB,
      gB,
    );

    assert(
      a.authority?.snapshotIdentityId !==
          b.authority?.snapshotIdentityId &&
        a.authority?.surfaceSnapshotSha256 !==
          b.authority?.surfaceSnapshotSha256 &&
        a.authority?.graphStateSha256 !==
          b.authority?.graphStateSha256,
      "content-addressed snapshot identity collided",
    );
  },
);

Deno.test(
  "snapshot-id.4 graph-state change changes snapshot while same surface digest remains stable",
  async () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const changed: CanonicalLanguageGraphV1 = {
      ...base,

      producerState: {
        ...base.producerState,

        pos: {
          version: "golden-state-change",

          status: "ran",

          factsAdded: 0,

          factsRejected: 0,
        },
      },
    };

    const a = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      base,
    );

    const b = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      changed,
    );

    assert(
      a.status ===
          "ready" &&
        b.status ===
          "ready",
      "valid graph-state fixtures blocked",
    );

    assert(
      a.authority?.surfaceSnapshotSha256 ===
          b.authority?.surfaceSnapshotSha256 &&
        a.authority?.graphStateSha256 !==
          b.authority?.graphStateSha256 &&
        a.authority?.snapshotIdentityId !==
          b.authority?.snapshotIdentityId,
      "graph-state mutation was not represented in snapshot identity",
    );
  },
);

Deno.test(
  "snapshot-id.5 object key insertion order does not affect canonical identity",
  async () => {
    const originalSurface = surface(
      "aa bb",
    );

    const originalGraph = graph(
      originalSurface,
    );

    const reorderedSurface: CanonicalSurfaceDocumentV1 = {
      tokens: originalSurface.tokens,

      version: originalSurface.version,

      sentences: originalSurface.sentences,

      textLengthUtf16: originalSurface.textLengthUtf16,

      text: originalSurface.text,

      invariants: originalSurface.invariants,

      boundaryCandidates: originalSurface.boundaryCandidates,
    };

    const reorderedGraph: CanonicalLanguageGraphV1 = {
      producerState: originalGraph.producerState,

      nodes: originalGraph.nodes,

      version: originalGraph.version,

      surfaceVersion: originalGraph.surfaceVersion,

      documentId: originalGraph.documentId,

      evidence: originalGraph.evidence,

      edges: originalGraph.edges,

      provenance: originalGraph.provenance,

      alternativeSets: originalGraph.alternativeSets,

      constraintTrace: originalGraph.constraintTrace,

      invariants: originalGraph.invariants,
    };

    const a = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      originalSurface,
      originalGraph,
    );

    const b = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      reorderedSurface,
      reorderedGraph,
    );

    assert(
      a.authority?.snapshotIdentityId ===
          b.authority?.snapshotIdentityId &&
        a.authority?.surfaceSnapshotSha256 ===
          b.authority?.surfaceSnapshotSha256 &&
        a.authority?.graphStateSha256 ===
          b.authority?.graphStateSha256,
      "object insertion order leaked into canonical serialization",
    );
  },
);

Deno.test(
  "snapshot-id.6 array order is preserved as part of exact graph state",
  async () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    assert(
      base.nodes.length >
        1,
      "fixture requires multiple graph nodes",
    );

    const reordered: CanonicalLanguageGraphV1 = {
      ...base,

      nodes: [
        ...base.nodes,
      ].reverse(),
    };

    const a = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      base,
    );

    const b = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      reordered,
    );

    assert(
      a.status ===
          "ready" &&
        b.status ===
          "ready" &&
        a.authority?.surfaceSnapshotSha256 ===
          b.authority?.surfaceSnapshotSha256 &&
        a.authority?.graphStateSha256 !==
          b.authority?.graphStateSha256 &&
        a.authority?.snapshotIdentityId !==
          b.authority?.snapshotIdentityId,
      "array order was incorrectly normalized away",
    );
  },
);

Deno.test(
  "snapshot-id.7 missing canonical document span blocks fail closed",
  async () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const invalid = replaceDocumentNode(
      base,
      (node) => ({
        ...node,
        span: undefined,
      }),
    );

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      invalid,
    );

    assert(
      result.status ===
          "blocked" &&
        result.authority ===
          undefined &&
        result.blockingReasons.includes(
          "graph:document_span_missing",
        ),
      "missing document span did not block",
    );
  },
);

Deno.test(
  "snapshot-id.8 document span and surface length mismatch blocks distinctly",
  async () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const invalid = replaceDocumentNode(
      base,
      (node) => ({
        ...node,

        span: {
          startUtf16: 0,

          endUtf16: s.textLengthUtf16 +
            1,
        },
      }),
    );

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      invalid,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "graph:document_span_surface_length_mismatch",
        ),
      "document span mismatch did not block distinctly",
    );
  },
);

Deno.test(
  "snapshot-id.9 document length feature mismatch blocks before hashing",
  async () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const invalid = replaceDocumentNode(
      base,
      (node) => ({
        ...node,

        features: {
          ...node.features,

          textLengthUtf16: s.textLengthUtf16 +
            1,
        },
      }),
    );

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      invalid,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "graph:document_feature_surface_length_mismatch",
        ),
      "document feature mismatch was not blocked",
    );
  },
);

Deno.test(
  "snapshot-id.10 missing exact document node blocks rather than trusting documentId string",
  async () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const invalid: CanonicalLanguageGraphV1 = {
      ...base,

      nodes: base.nodes.filter(
        (node) =>
          !(
            node.type ===
              "document" &&
            node.id ===
              base.documentId
          ),
      ),
    };

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      invalid,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "graph:exact_document_node_missing_or_duplicated",
        ),
      "documentId string was trusted without exact document node",
    );
  },
);

Deno.test(
  "snapshot-id.11 duplicate exact document node blocks ambiguous structural ownership",
  async () => {
    const s = surface(
      "aa bb",
    );

    const base = graph(
      s,
    );

    const documentNode = base.nodes.find(
      (node) =>
        node.type ===
          "document" &&
        node.id ===
          base.documentId,
    );

    assert(
      documentNode !==
        undefined,
      "document node fixture missing",
    );

    const invalid: CanonicalLanguageGraphV1 = {
      ...base,

      nodes: [
        ...base.nodes,
        {
          ...documentNode,
        },
      ],
    };

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      invalid,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "graph:exact_document_node_missing_or_duplicated",
        ),
      "duplicate document identity was accepted",
    );
  },
);

Deno.test(
  "snapshot-id.12 surface text length mismatch blocks input before serialization",
  async () => {
    const valid = surface(
      "aa bb",
    );

    const invalid = {
      ...valid,

      textLengthUtf16: valid.textLengthUtf16 +
        1,
    } as CanonicalSurfaceDocumentV1;

    const g = graph(
      valid,
    );

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      invalid,
      g,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "surface:text_length_mismatch",
        ),
      "surface length mismatch was accepted",
    );
  },
);

Deno.test(
  "snapshot-id.13 graph and surface version provenance must agree exactly",
  async () => {
    const s = surface(
      "aa bb",
    );

    const g = graph(
      s,
    );

    const invalid = {
      ...g,

      surfaceVersion: "stale-surface-version",
    } as unknown as CanonicalLanguageGraphV1;

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      invalid,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "graph:surface_version_mismatch",
        ),
      "graph/surface version mismatch was accepted",
    );
  },
);

Deno.test(
  "snapshot-id.14 unexpected graph version blocks snapshot authority",
  async () => {
    const s = surface(
      "aa bb",
    );

    const g = graph(
      s,
    );

    const invalid = {
      ...g,

      version: "canonical-language-graph-v2",
    } as unknown as CanonicalLanguageGraphV1;

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      invalid,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "graph:unexpected_version",
        ),
      "unexpected graph version was accepted",
    );
  },
);

Deno.test(
  "snapshot-id.15 non-finite graph state blocks canonical serialization",
  async () => {
    const s = surface(
      "aa bb",
    );

    const g = graph(
      s,
    );

    const invalid: CanonicalLanguageGraphV1 = {
      ...g,

      producerState: {
        ...g.producerState,

        pos: {
          ...g.producerState.pos,

          factsAdded: Number.NaN,
        },
      },
    };

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      invalid,
    );

    assert(
      result.status ===
          "blocked" &&
        exactJson(
            result.blockingReasons,
          ) ===
          exactJson([
            "graph:canonical_serialization_failed",
          ]),
      "non-finite graph value did not fail canonical serialization",
    );
  },
);

Deno.test(
  "snapshot-id.16 unsupported surface serialization value blocks fail closed",
  async () => {
    const valid = surface(
      "aa bb",
    );

    const invalid = {
      ...valid,

      unsupportedSnapshotValue: undefined,
    } as unknown as CanonicalSurfaceDocumentV1;

    const g = graph(
      valid,
    );

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      invalid,
      g,
    );

    assert(
      result.status ===
          "blocked" &&
        exactJson(
            result.blockingReasons,
          ) ===
          exactJson([
            "surface:canonical_serialization_failed",
          ]),
      "unsupported surface value was silently omitted",
    );
  },
);

Deno.test(
  "snapshot-id.17 derivation is deterministic and does not mutate surface or graph",
  async () => {
    const s = surface(
      "Jeg går hjem.",
    );

    const g = graph(
      s,
    );

    const beforeSurface = exactJson(
      s,
    );

    const beforeGraph = exactJson(
      g,
    );

    const first = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      g,
    );

    const second = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      g,
    );

    assert(
      first.status ===
          "ready" &&
        second.status ===
          "ready" &&
        first.authority?.snapshotIdentityId ===
          second.authority?.snapshotIdentityId,
      "repeated derivation was not deterministic",
    );

    assert(
      exactJson(
            s,
          ) ===
          beforeSurface &&
        exactJson(
            g,
          ) ===
          beforeGraph,
      "snapshot authority mutated canonical input",
    );
  },
);

Deno.test(
  "snapshot-id.18 governance owns snapshot identity only and no linguistic Runtime authority",
  async () => {
    const s = surface(
      "aa bb",
    );

    const g = graph(
      s,
    );

    const result = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      s,
      g,
    );

    const governance = result.authority
      ?.governance;

    assert(
      governance !==
          undefined &&
        governance.exactSurfaceSnapshotInputRequired ===
          true &&
        governance.exactGraphSnapshotInputRequired ===
          true &&
        governance.fullCanonicalSurfaceSnapshotHashed ===
          true &&
        governance.rawSurfaceTextParticipatesInIdentity ===
          true &&
        governance.fullCanonicalGraphStateHashed ===
          true &&
        governance.graphProducerStateParticipatesInIdentity ===
          true &&
        governance.graphEvidenceParticipatesInIdentity ===
          true &&
        governance.graphAlternativesParticipateInIdentity ===
          true &&
        governance.deterministicCanonicalSerialization ===
          true &&
        governance.objectKeysSorted ===
          true &&
        governance.arrayOrderPreserved ===
          true &&
        governance.cryptographicSha256Used ===
          true &&
        governance.sameExactInputReproducesIdentity ===
          true &&
        governance.graphDocumentIdPreservedAsProvenance ===
          true &&
        governance.graphDocumentIdReinterpretedAsSnapshotIdentity ===
          false &&
        governance.structuralNodeIdsUsedAsSnapshotIdentity ===
          false &&
        governance.structuralEdgeIdsUsedAsSnapshotIdentity ===
          false &&
        governance.textLengthUsedAsSnapshotIdentity ===
          false &&
        governance.randomIdentityUsed ===
          false &&
        governance.wallClockUsed ===
          false &&
        governance.runtimeConsumed ===
          false &&
        governance.manifestConsumed ===
          false &&
        governance.posSemanticsConsumed ===
          false &&
        governance.whereSemanticsConsumed ===
          false &&
        governance.comparisonPerformed ===
          false &&
        governance.comparisonTruthResolved ===
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
      "snapshot authority crossed its semantic boundary",
    );
  },
);
