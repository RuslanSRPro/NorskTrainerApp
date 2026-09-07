import type {
  CanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import type {
  CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

export const CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1 =
  "canonical_graph_snapshot_identity_authority_v1";

export const CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1 = "1";

export const CANONICAL_GRAPH_SNAPSHOT_IDENTITY_HASH_ALGORITHM_V1 = "SHA-256";

export const CANONICAL_GRAPH_SNAPSHOT_IDENTITY_SERIALIZATION_V1 =
  "sorted_object_keys_preserve_array_order_json_v1";

export type CanonicalGraphSnapshotIdentityAuthorityV1 = {
  authorityId: string;

  status: "resolved";

  snapshotIdentityId: string;

  snapshotSha256: string;

  surfaceSnapshotSha256: string;

  graphStateSha256: string;

  hashAlgorithm: typeof CANONICAL_GRAPH_SNAPSHOT_IDENTITY_HASH_ALGORITHM_V1;

  canonicalSerialization:
    typeof CANONICAL_GRAPH_SNAPSHOT_IDENTITY_SERIALIZATION_V1;

  surfaceVersion: "canonical-surface-boundary-v1";

  graphVersion: "canonical-language-graph-v1";

  graphDocumentId: string;

  surfaceTextLengthUtf16: number;

  governance: {
    exactSurfaceSnapshotInputRequired: true;

    exactGraphSnapshotInputRequired: true;

    fullCanonicalSurfaceSnapshotHashed: true;

    rawSurfaceTextParticipatesInIdentity: true;

    fullCanonicalGraphStateHashed: true;

    graphProducerStateParticipatesInIdentity: true;

    graphEvidenceParticipatesInIdentity: true;

    graphAlternativesParticipateInIdentity: true;

    deterministicCanonicalSerialization: true;

    objectKeysSorted: true;

    arrayOrderPreserved: true;

    cryptographicSha256Used: true;

    sameExactInputReproducesIdentity: true;

    graphDocumentIdPreservedAsProvenance: true;

    graphDocumentIdReinterpretedAsSnapshotIdentity: false;

    structuralNodeIdsUsedAsSnapshotIdentity: false;

    structuralEdgeIdsUsedAsSnapshotIdentity: false;

    textLengthUsedAsSnapshotIdentity: false;

    randomIdentityUsed: false;

    wallClockUsed: false;

    runtimeConsumed: false;

    manifestConsumed: false;

    posSemanticsConsumed: false;

    whereSemanticsConsumed: false;

    comparisonPerformed: false;

    comparisonTruthResolved: false;

    occurrenceBindingPerformed: false;

    cardinalityEnforcementPerformed: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalGraphSnapshotIdentityAuthorityResultV1 = {
  producer: typeof CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1;

  producerVersion:
    typeof CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1;

  status:
    | "ready"
    | "blocked";

  authority?: CanonicalGraphSnapshotIdentityAuthorityV1;

  blockingReasons: string[];
};

type CanonicalJsonPrimitive =
  | null
  | boolean
  | number
  | string;

function blockedResult(
  reasons: readonly string[],
): CanonicalGraphSnapshotIdentityAuthorityResultV1 {
  return {
    producer: CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,

    producerVersion: CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1,

    status: "blocked",

    blockingReasons: [
      ...reasons,
    ].sort(),
  };
}

function canonicalJsonV1(
  value: unknown,
): string | undefined {
  const visiting = new Set<object>();

  function encode(
    current: unknown,
  ): string | undefined {
    if (
      current ===
        null
    ) {
      return "null";
    }

    if (
      typeof current ===
        "string"
    ) {
      return JSON.stringify(
        current,
      );
    }

    if (
      typeof current ===
        "boolean"
    ) {
      return current ? "true" : "false";
    }

    if (
      typeof current ===
        "number"
    ) {
      if (
        !Number.isFinite(
          current,
        )
      ) {
        return undefined;
      }

      const normalized = Object.is(
          current,
          -0,
        )
        ? 0
        : current;

      return JSON.stringify(
        normalized,
      );
    }

    if (
      typeof current !==
        "object"
    ) {
      return undefined;
    }

    const object = current as object;

    if (
      visiting.has(
        object,
      )
    ) {
      return undefined;
    }

    visiting.add(
      object,
    );

    try {
      if (
        Array.isArray(
          current,
        )
      ) {
        const encodedItems: string[] = [];

        for (
          const item of current
        ) {
          const encoded = encode(
            item,
          );

          if (
            encoded ===
              undefined
          ) {
            return undefined;
          }

          encodedItems.push(
            encoded,
          );
        }

        return `[${encodedItems.join(",")}]`;
      }

      const prototype = Object.getPrototypeOf(
        current,
      );

      if (
        prototype !==
          Object.prototype &&
        prototype !==
          null
      ) {
        return undefined;
      }

      const record = current as Record<
        string,
        unknown
      >;

      const keys = Object.keys(
        record,
      ).sort();

      const encodedEntries: string[] = [];

      for (
        const key of keys
      ) {
        const encodedValue = encode(
          record[key],
        );

        if (
          encodedValue ===
            undefined
        ) {
          return undefined;
        }

        encodedEntries.push(
          `${JSON.stringify(key)}:${encodedValue}`,
        );
      }

      return `{${encodedEntries.join(",")}}`;
    } finally {
      visiting.delete(
        object,
      );
    }
  }

  return encode(
    value,
  );
}

async function sha256HexV1(
  value: string,
): Promise<string> {
  const encoded = new TextEncoder()
    .encode(
      value,
    );

  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded,
  );

  return Array.from(
    new Uint8Array(
      digest,
    ),
  )
    .map(
      (byte) =>
        byte
          .toString(
            16,
          )
          .padStart(
            2,
            "0",
          ),
    )
    .join("");
}

function exactInputContract(
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
): string[] {
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
    typeof surface.text !==
      "string"
  ) {
    reasons.push(
      "surface:text_missing",
    );
  }

  if (
    !Number.isSafeInteger(
      surface.textLengthUtf16,
    ) ||
    surface.textLengthUtf16 <
      0
  ) {
    reasons.push(
      "surface:text_length_invalid",
    );
  } else if (
    surface.text.length !==
      surface.textLengthUtf16
  ) {
    reasons.push(
      "surface:text_length_mismatch",
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
    typeof graph.documentId !==
      "string" ||
    graph.documentId.length ===
      0
  ) {
    reasons.push(
      "graph:document_id_missing",
    );
  }

  const documentMatches = graph.nodes
    .filter(
      (node) =>
        node.type ===
          "document" &&
        node.id ===
          graph.documentId,
    );

  if (
    documentMatches.length !==
      1
  ) {
    reasons.push(
      "graph:exact_document_node_missing_or_duplicated",
    );
  } else {
    const documentNode = documentMatches[0];

    if (
      !documentNode.span
    ) {
      reasons.push(
        "graph:document_span_missing",
      );
    } else if (
      documentNode.span.startUtf16 !==
        0 ||
      documentNode.span.endUtf16 !==
        surface.textLengthUtf16
    ) {
      reasons.push(
        "graph:document_span_surface_length_mismatch",
      );
    }

    if (
      documentNode.features
        .textLengthUtf16 !==
        surface.textLengthUtf16
    ) {
      reasons.push(
        "graph:document_feature_surface_length_mismatch",
      );
    }
  }

  return reasons;
}

export async function deriveCanonicalGraphSnapshotIdentityAuthorityV1(
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
): Promise<CanonicalGraphSnapshotIdentityAuthorityResultV1> {
  const inputReasons = exactInputContract(
    surface,
    graph,
  );

  if (
    inputReasons.length >
      0
  ) {
    return blockedResult(
      inputReasons,
    );
  }

  const canonicalSurface = canonicalJsonV1(
    surface,
  );

  if (
    canonicalSurface ===
      undefined
  ) {
    return blockedResult([
      "surface:canonical_serialization_failed",
    ]);
  }

  const canonicalGraph = canonicalJsonV1(
    graph,
  );

  if (
    canonicalGraph ===
      undefined
  ) {
    return blockedResult([
      "graph:canonical_serialization_failed",
    ]);
  }

  const surfaceSnapshotSha256 = await sha256HexV1(
    [
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,
      "surface",
      surface.version,
      canonicalSurface,
    ].join(
      "\u0000",
    ),
  );

  const graphStateSha256 = await sha256HexV1(
    [
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,
      "graph",
      graph.version,
      canonicalGraph,
    ].join(
      "\u0000",
    ),
  );

  const snapshotSha256 = await sha256HexV1(
    [
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1,
      surfaceSnapshotSha256,
      graphStateSha256,
    ].join(
      "\u0000",
    ),
  );

  const snapshotIdentityId =
    `canonical-graph-snapshot:sha256:${snapshotSha256}`;

  return {
    producer: CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,

    producerVersion: CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1,

    status: "ready",

    authority: {
      authorityId:
        `${CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1}:${snapshotSha256}`,

      status: "resolved",

      snapshotIdentityId,

      snapshotSha256,

      surfaceSnapshotSha256,

      graphStateSha256,

      hashAlgorithm: CANONICAL_GRAPH_SNAPSHOT_IDENTITY_HASH_ALGORITHM_V1,

      canonicalSerialization:
        CANONICAL_GRAPH_SNAPSHOT_IDENTITY_SERIALIZATION_V1,

      surfaceVersion: surface.version,

      graphVersion: graph.version,

      graphDocumentId: graph.documentId,

      surfaceTextLengthUtf16: surface.textLengthUtf16,

      governance: {
        exactSurfaceSnapshotInputRequired: true,

        exactGraphSnapshotInputRequired: true,

        fullCanonicalSurfaceSnapshotHashed: true,

        rawSurfaceTextParticipatesInIdentity: true,

        fullCanonicalGraphStateHashed: true,

        graphProducerStateParticipatesInIdentity: true,

        graphEvidenceParticipatesInIdentity: true,

        graphAlternativesParticipateInIdentity: true,

        deterministicCanonicalSerialization: true,

        objectKeysSorted: true,

        arrayOrderPreserved: true,

        cryptographicSha256Used: true,

        sameExactInputReproducesIdentity: true,

        graphDocumentIdPreservedAsProvenance: true,

        graphDocumentIdReinterpretedAsSnapshotIdentity: false,

        structuralNodeIdsUsedAsSnapshotIdentity: false,

        structuralEdgeIdsUsedAsSnapshotIdentity: false,

        textLengthUsedAsSnapshotIdentity: false,

        randomIdentityUsed: false,

        wallClockUsed: false,

        runtimeConsumed: false,

        manifestConsumed: false,

        posSemanticsConsumed: false,

        whereSemanticsConsumed: false,

        comparisonPerformed: false,

        comparisonTruthResolved: false,

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
