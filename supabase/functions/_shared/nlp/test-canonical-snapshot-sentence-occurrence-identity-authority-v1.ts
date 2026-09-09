import {
  CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
} from "./canonical-surface-graph-provenance-binding-authority-v1.ts";
import {
  createCanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  buildCanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";
import type {
  CanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import type {
  CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import type {
  CanonicalGraphSnapshotIdentityAuthorityResultV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import {
  CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,
  CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_VERSION_V1,
  deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1,
} from "./canonical-snapshot-sentence-occurrence-identity-authority-v1.ts";

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

function assertEquals(
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  if (
    actual !==
      expected
  ) {
    throw new Error(
      `${message}: expected=${String(expected)} actual=${String(actual)}`,
    );
  }
}

const productionSource = await Deno.readTextFile(
  new URL(
    "./canonical-snapshot-sentence-occurrence-identity-authority-v1.ts",
    import.meta.url,
  ),
);

function sourceHasBooleanAssignment(
  property: string,
  value: boolean,
): boolean {
  const escapedProperty = property.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  return new RegExp(
    `${escapedProperty}\\s*:\\s*${String(value)}\\b`,
  ).test(
    productionSource,
  );
}

function sourceHasIdentifierAssignment(
  property: string,
  identifier: string,
): boolean {
  const escapedProperty = property.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const escapedIdentifier = identifier.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  return new RegExp(
    `${escapedProperty}\\s*:\\s*${escapedIdentifier}\\b`,
  ).test(
    productionSource,
  );
}

function malformedInputs() {
  const surface = {} as CanonicalSurfaceDocumentV1;

  const graph = {} as CanonicalLanguageGraphV1;

  const snapshot = {
    producer: "invalid-snapshot-producer",

    producerVersion: "1",

    status: "blocked",

    blockingReasons: [
      "fixture:blocked",
    ],
  } as unknown as CanonicalGraphSnapshotIdentityAuthorityResultV1;

  return {
    surface,
    graph,
    snapshot,
  };
}

Deno.test(
  "snapshot-sentence.1 exact producer and version are frozen",
  () => {
    assertEquals(
      CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,
      "canonical-snapshot-sentence-occurrence-identity-authority-v1",
      "producer",
    );

    assertEquals(
      CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_VERSION_V1,
      "1",
      "version",
    );
  },
);

Deno.test(
  "snapshot-sentence.2 public derivation arity is exactly three",
  () => {
    assertEquals(
      deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1
        .length,
      3,
      "public arity",
    );
  },
);

Deno.test(
  "snapshot-sentence.3 malformed canonical inputs fail closed",
  async () => {
    const {
      surface,
      graph,
      snapshot,
    } = malformedInputs();

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        surface,
        graph,
        snapshot,
      );

    assertEquals(
      result.status,
      "blocked",
      "malformed result status",
    );

    assertEquals(
      result.authorityCount,
      0,
      "malformed authority count",
    );

    assertEquals(
      result.authorities.length,
      0,
      "malformed authorities",
    );

    assert(
      result.blockingReasons.length >
        0,
      "blocked result must expose reason",
    );
  },
);

Deno.test(
  "snapshot-sentence.4 blocked derivation is deterministic",
  async () => {
    const leftFixture = malformedInputs();

    const rightFixture = malformedInputs();

    const left =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        leftFixture.surface,
        leftFixture.graph,
        leftFixture.snapshot,
      );

    const right =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        rightFixture.surface,
        rightFixture.graph,
        rightFixture.snapshot,
      );

    assertEquals(
      left.status,
      right.status,
      "status determinism",
    );

    assertEquals(
      JSON.stringify(
        left.blockingReasons,
      ),
      JSON.stringify(
        right.blockingReasons,
      ),
      "blocking-reason determinism",
    );
  },
);

Deno.test(
  "snapshot-sentence.5 malformed input objects are not mutated",
  async () => {
    const fixture = malformedInputs();

    const surfaceBefore = JSON.stringify(
      fixture.surface,
    );

    const graphBefore = JSON.stringify(
      fixture.graph,
    );

    const snapshotBefore = JSON.stringify(
      fixture.snapshot,
    );

    await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
      fixture.surface,
      fixture.graph,
      fixture.snapshot,
    );

    assertEquals(
      JSON.stringify(
        fixture.surface,
      ),
      surfaceBefore,
      "surface mutation",
    );

    assertEquals(
      JSON.stringify(
        fixture.graph,
      ),
      graphBefore,
      "graph mutation",
    );

    assertEquals(
      JSON.stringify(
        fixture.snapshot,
      ),
      snapshotBefore,
      "snapshot mutation",
    );
  },
);

Deno.test(
  "snapshot-sentence.6 generic production imports no Runtime manifest module",
  () => {
    assert(
      !productionSource.includes(
        'from "./canonical-runtime-manifest-',
      ),
      "Runtime manifest import forbidden",
    );
  },
);

Deno.test(
  "snapshot-sentence.7 generic production imports no token.pos source-specific module",
  () => {
    assert(
      !productionSource.includes(
        'from "./canonical-token-pos-',
      ),
      "token.pos import forbidden",
    );

    assert(
      !productionSource.includes(
        'from "./canonical-runtime-token-pos-',
      ),
      "Runtime token.pos import forbidden",
    );
  },
);

Deno.test(
  "snapshot-sentence.8 generic production imports no A4.6 compound truth composer",
  () => {
    assert(
      !productionSource.includes(
        "recursive-compound-truth-composer",
      ),
      "A4.6 composer import forbidden",
    );
  },
);

Deno.test(
  "snapshot-sentence.9 exact generic source modules are consumed",
  () => {
    assert(
      productionSource.includes(
        "./canonical-surface-graph-provenance-binding-authority-v1.ts",
      ),
      "provenance authority missing",
    );

    assert(
      productionSource.includes(
        "./canonical-graph-snapshot-identity-authority-v1.ts",
      ),
      "snapshot authority missing",
    );

    assert(
      productionSource.includes(
        "./canonical-sentence-occurrence-identity-authority-v1.ts",
      ),
      "sentence occurrence authority missing",
    );
  },
);

Deno.test(
  "snapshot-sentence.10 sentence result is derived internally from captured graph",
  () => {
    assert(
      productionSource.includes(
        "deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(",
      ),
      "sentence derivation missing",
    );

    assert(
      productionSource.includes(
        "capturedGraph",
      ),
      "captured graph missing",
    );

    assert(
      productionSource.includes(
        "callerSentenceResultAccepted:",
      ),
      "caller sentence-result governance missing",
    );

    assert(
      sourceHasBooleanAssignment("callerSentenceResultAccepted", false),
      "caller sentence-result must remain forbidden",
    );
  },
);

Deno.test(
  "snapshot-sentence.11 exact source snapshot result is preserved by reference contract",
  () => {
    assert(
      productionSource.includes(
        "sourceSnapshotIdentityResultObjectPreservedByReference:",
      ),
      "source snapshot result preservation marker missing",
    );

    assert(
      productionSource.includes(
        "sourceSnapshotIdentityAuthorityObjectPreservedByReference:",
      ),
      "source snapshot authority preservation marker missing",
    );
  },
);

Deno.test(
  "snapshot-sentence.12 snapshot authority is rederived through closed authority",
  () => {
    assert(
      productionSource.includes(
        "await deriveCanonicalGraphSnapshotIdentityAuthorityV1(",
      ),
      "closed snapshot rederivation missing",
    );

    assert(
      sourceHasBooleanAssignment(
        "privateSnapshotHashSemanticsDuplicated",
        false,
      ),
      "private hash duplication must remain false",
    );
  },
);

Deno.test(
  "snapshot-sentence.13 graphDocumentId remains provenance not snapshot identity",
  () => {
    assert(
      sourceHasBooleanAssignment("graphDocumentIdPreservedAsProvenance", true),
      "graphDocumentId provenance marker missing",
    );

    assert(
      sourceHasBooleanAssignment(
        "graphDocumentIdUsedAsSnapshotIdentity",
        false,
      ),
      "graphDocumentId must not become snapshot identity",
    );
  },
);

Deno.test(
  "snapshot-sentence.14 historical snapshot sentence occurrence identity prefix is exact",
  () => {
    assert(
      productionSource.includes(
        '"canonical-snapshot-sentence-occurrence-v1"',
      ),
      "historical identity prefix missing",
    );

    assert(
      productionSource.includes(
        "snapshotIdentityId,\n    ),\n    idPart(\n      sentenceNodeId,",
      ),
      "identity inputs/order changed",
    );
  },
);

Deno.test(
  "snapshot-sentence.15 sentenceIndex is excluded from occurrence identity",
  () => {
    const start = productionSource.indexOf(
      "function snapshotSentenceOccurrenceIdentityId(",
    );

    const end = productionSource.indexOf(
      "function snapshotSentenceAuthorityId(",
    );

    assert(
      start >=
          0 &&
        end >
          start,
      "identity helper boundaries missing",
    );

    const helper = productionSource.slice(
      start,
      end,
    );

    assert(
      !helper.includes(
        "sentenceIndex",
      ),
      "sentenceIndex must not participate in identity helper",
    );
  },
);

Deno.test(
  "snapshot-sentence.16 source sentence authority object is preserved without reconstruction",
  () => {
    assert(
      sourceHasIdentifierAssignment(
        "sourceSentenceOccurrenceIdentityAuthority",
        "sourceSentenceAuthority",
      ),
      "source sentence authority reference preservation missing",
    );

    assert(
      productionSource.includes(
        "sourceSentenceOccurrenceIdentityAuthorityObjectPreservedWithoutReconstruction:",
      ),
      "authority preservation governance missing",
    );
  },
);

Deno.test(
  "snapshot-sentence.17 every sentence occurrence remains projected independently",
  () => {
    assert(
      productionSource.includes(
        "for (\n    const sourceSentenceAuthority of",
      ),
      "sentence authority iteration missing",
    );

    assert(
      productionSource.includes(
        "authorities.push({",
      ),
      "per-sentence authority projection missing",
    );

    assert(
      productionSource.includes(
        "everySentenceOccurrencePreserved:",
      ),
      "all-occurrence preservation governance missing",
    );
  },
);

Deno.test(
  "snapshot-sentence.18 duplicate snapshot-bound sentence identities block fail closed",
  () => {
    assert(
      productionSource.includes(
        "snapshot_sentence_occurrence_identity:duplicate_identity:",
      ),
      "duplicate occurrence fail-closed reason missing",
    );

    assert(
      productionSource.includes(
        "sentence_occurrence_identity:duplicate_sentence_node_id:",
      ),
      "duplicate sentence-node fail-closed reason missing",
    );
  },
);

Deno.test(
  "snapshot-sentence.19 CURRENT sentence selection remains outside semantic ceiling",
  () => {
    assert(
      sourceHasBooleanAssignment(
        "currentRuntimeSentenceContextSelected",
        false,
      ),
      "CURRENT context selection must remain false",
    );

    assert(
      sourceHasBooleanAssignment("contextCandidateSelected", false),
      "context candidate selection must remain false",
    );
  },
);

Deno.test(
  "snapshot-sentence.20 winner final binding and cardinality remain outside semantic ceiling",
  () => {
    assert(
      sourceHasBooleanAssignment("occurrenceWinnerSelected", false),
      "winner selection must remain false",
    );

    assert(
      sourceHasBooleanAssignment(
        "finalRuntimeOccurrenceBindingPerformed",
        false,
      ),
      "final Runtime binding must remain false",
    );

    assert(
      sourceHasBooleanAssignment("cardinalitySemanticsResolved", false),
      "cardinality semantics must remain false",
    );
  },
);

Deno.test(
  "snapshot-sentence.21 Runtime WHERE and token.pos semantics remain outside layer",
  () => {
    assert(
      sourceHasBooleanAssignment("runtimeManifestConsumed", false),
      "Runtime manifest consumption must remain false",
    );

    assert(
      sourceHasBooleanAssignment("whereTruthComposed", false),
      "WHERE truth composition must remain false",
    );

    assert(
      sourceHasBooleanAssignment("tokenPosConsumed", false),
      "token.pos consumption must remain false",
    );
  },
);

Deno.test(
  "snapshot-sentence.22 graph mutation and learner error remain outside layer",
  () => {
    assert(
      sourceHasBooleanAssignment("graphMutationPerformed", false),
      "graph mutation must remain false",
    );

    assert(
      sourceHasBooleanAssignment("learnerErrorClassified", false),
      "learner error classification must remain false",
    );
  },
);

Deno.test(
  "snapshot-sentence.23 defensive input capture precedes async snapshot rederivation",
  () => {
    const surfaceCapture = productionSource.indexOf(
      "const capturedSurface =",
    );

    const graphCapture = productionSource.indexOf(
      "const capturedGraph =",
    );

    const snapshotRederivation = productionSource.indexOf(
      "await deriveCanonicalGraphSnapshotIdentityAuthorityV1(",
    );

    assert(
      surfaceCapture >=
          0 &&
        graphCapture >
          surfaceCapture &&
        snapshotRederivation >
          graphCapture,
      "capture/rederivation order invalid",
    );
  },
);

Deno.test(
  "snapshot-sentence.24 structural equality does not duplicate snapshot hashing",
  () => {
    const start = productionSource.indexOf(
      "function exactStructuralEqual(",
    );

    const end = productionSource.indexOf(
      "function readyProvenanceBindingResult(",
    );

    assert(
      start >=
          0 &&
        end >
          start,
      "structural equality helper missing",
    );

    const helper = productionSource.slice(
      start,
      end,
    );

    assert(
      !helper.includes(
        "crypto.subtle",
      ),
      "structural equality must not hash",
    );

    assert(
      !helper.includes(
        "SHA-256",
      ),
      "structural equality must not duplicate SHA semantics",
    );

    assert(
      !helper.includes(
        "canonicalSerialization",
      ),
      "structural equality must not derive canonical serialization",
    );
  },
);

async function executableReadyFixture(
  text = "aa bb",
) {
  const surface = buildCanonicalSurfaceDocumentV1(
    text,
  );

  const graph = createCanonicalLanguageGraphV1(
    surface,
  );

  const snapshot = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    surface,
    graph,
  );

  assert(
    snapshot.status ===
        "ready" &&
      snapshot.authority !==
        undefined,
    `fixture snapshot did not reach READY: ${JSON.stringify(snapshot)}`,
  );

  return {
    surface,
    graph,
    snapshot,
  };
}

function fixtureIdPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    "%",
    "_",
  );
}

function expectedSnapshotSentenceOccurrenceId(
  snapshotIdentityId: string,
  sentenceNodeId: string,
): string {
  return [
    "canonical-snapshot-sentence-occurrence-v1",
    fixtureIdPart(
      snapshotIdentityId,
    ),
    fixtureIdPart(
      sentenceNodeId,
    ),
  ].join(
    ":",
  );
}

function nonSurfaceProducerStateEntry(
  graph: CanonicalLanguageGraphV1,
): [
  string,
  CanonicalLanguageGraphV1["producerState"][string],
] {
  const entry = Object.entries(
    graph.producerState,
  ).find(
    ([producer]) =>
      producer !==
        CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_SOURCE_ADAPTER_V1,
  );

  assert(
    entry !==
      undefined,
    "READY fixture requires a non-surface producer-state entry",
  );

  return entry;
}

function graphWithChangedRejectedFactCount(
  graph: CanonicalLanguageGraphV1,
): CanonicalLanguageGraphV1 {
  const [
    producer,
    state,
  ] = nonSurfaceProducerStateEntry(
    graph,
  );

  return {
    ...graph,

    producerState: {
      ...graph.producerState,

      [producer]: {
        ...state,

        factsRejected: state.factsRejected +
          1,
      },
    },
  };
}

function graphWithLaterFactEnrichment(
  graph: CanonicalLanguageGraphV1,
): CanonicalLanguageGraphV1 {
  const [
    producer,
    state,
  ] = nonSurfaceProducerStateEntry(
    graph,
  );

  return {
    ...graph,

    producerState: {
      ...graph.producerState,

      [producer]: {
        ...state,

        factsAdded: state.factsAdded +
          1,
      },
    },
  };
}

Deno.test(
  "snapshot-sentence.R1 valid one-sentence canonical snapshot reaches READY",
  async () => {
    const fixture = await executableReadyFixture(
      "aa bb",
    );

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
        "ready",
      `new foundation did not reach READY: ${JSON.stringify(result)}`,
    );

    assertEquals(
      result.blockingReasons.length,
      0,
      "READY result blocking reasons",
    );
  },
);

Deno.test(
  "snapshot-sentence.R2 exact source snapshot result object is preserved by reference",
  async () => {
    const fixture = await executableReadyFixture();

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        result.sourceSnapshotIdentityResult ===
          fixture.snapshot,
      "sourceSnapshotIdentityResult reference was reconstructed or replaced",
    );
  },
);

Deno.test(
  "snapshot-sentence.R3 exact source snapshot authority object is preserved by reference",
  async () => {
    const fixture = await executableReadyFixture();

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        fixture.snapshot.authority !==
          undefined &&
        result.sourceSnapshotIdentityAuthority ===
          fixture.snapshot.authority,
      "source snapshot authority reference was reconstructed or replaced",
    );
  },
);

Deno.test(
  "snapshot-sentence.R4 rederived snapshot proves same identity but remains separately derived evidence",
  async () => {
    const fixture = await executableReadyFixture();

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        fixture.snapshot.authority !==
          undefined &&
        result.rederivedSnapshotIdentityResult !==
          fixture.snapshot &&
        result.rederivedSnapshotIdentityAuthority !==
          fixture.snapshot.authority &&
        result.rederivedSnapshotIdentityAuthority
            .snapshotIdentityId ===
          fixture.snapshot.authority
            .snapshotIdentityId &&
        result.rederivedSnapshotIdentityAuthority
            .snapshotSha256 ===
          fixture.snapshot.authority
            .snapshotSha256 &&
        result.rederivedSnapshotIdentityAuthority
            .surfaceSnapshotSha256 ===
          fixture.snapshot.authority
            .surfaceSnapshotSha256 &&
        result.rederivedSnapshotIdentityAuthority
            .graphStateSha256 ===
          fixture.snapshot.authority
            .graphStateSha256,
      "rederived snapshot evidence did not independently prove exact source snapshot",
    );
  },
);

Deno.test(
  "snapshot-sentence.R5 sentence occurrence result is internally derived and READY",
  async () => {
    const fixture = await executableReadyFixture();

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        result.sourceSentenceOccurrenceIdentityResult
            .status ===
          "ready" &&
        result.sourceSentenceOccurrenceIdentityResult
            .blockingReasons.length ===
          0,
      "internal canonical sentence occurrence result not READY",
    );
  },
);

Deno.test(
  "snapshot-sentence.R6 exact internal source sentence authority object is preserved",
  async () => {
    const fixture = await executableReadyFixture();

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          1 &&
        result.sourceSentenceOccurrenceIdentityResult
            .authorities.length ===
          1 &&
        result.authorities[0]
            ?.sourceSentenceOccurrenceIdentityAuthority ===
          result.sourceSentenceOccurrenceIdentityResult
            .authorities[0],
      "projected authority did not preserve exact internal source sentence authority object",
    );
  },
);

Deno.test(
  "snapshot-sentence.R7 one canonical sentence projects exactly one snapshot-bound occurrence",
  async () => {
    const fixture = await executableReadyFixture(
      "aa bb",
    );

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        result.authorityCount ===
          1 &&
        result.authorities.length ===
          1,
      `one-sentence cardinality changed: ${JSON.stringify(result)}`,
    );
  },
);

Deno.test(
  "snapshot-sentence.R8 occurrence identity exactly follows historical snapshotIdentityId plus sentenceNodeId encoding",
  async () => {
    const fixture = await executableReadyFixture();

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          1,
      "READY one-sentence projection missing",
    );

    const authority = result.authorities[0];

    assert(
      authority !==
        undefined,
      "projected authority missing",
    );

    const expected = expectedSnapshotSentenceOccurrenceId(
      authority.snapshotIdentityId,
      authority.sentenceNodeId,
    );

    assertEquals(
      authority.snapshotSentenceOccurrenceIdentityId,
      expected,
      "historical snapshot-sentence occurrence identity encoding",
    );
  },
);

Deno.test(
  "snapshot-sentence.R9 sentenceIndex is preserved as locality metadata and excluded from identity",
  async () => {
    const fixture = await executableReadyFixture();

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        result.authorities.length ===
          1 &&
        result.sourceSentenceOccurrenceIdentityResult
            .authorities.length ===
          1,
      "one-sentence READY fixture missing",
    );

    const projected = result.authorities[0];

    const source = result.sourceSentenceOccurrenceIdentityResult
      .authorities[0];

    assert(
      projected !==
          undefined &&
        source !==
          undefined &&
        projected.sentenceIndex ===
          source.sentenceIndex &&
        projected.governance
            .sentenceIndexIsOccurrenceIdentity ===
          false &&
        projected.governance
            .sentenceIndexIsLocalityMetadataOnly ===
          true &&
        projected.snapshotSentenceOccurrenceIdentityId ===
          expectedSnapshotSentenceOccurrenceId(
            projected.snapshotIdentityId,
            projected.sentenceNodeId,
          ),
      "sentenceIndex leaked into identity or was not preserved as metadata",
    );
  },
);

Deno.test(
  "snapshot-sentence.R10 two canonical sentences remain two authorities in canonical sentence order",
  async () => {
    const fixture = await executableReadyFixture(
      "Aa bb. Cc!",
    );

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        result.authorityCount ===
          2 &&
        result.authorities.length ===
          2 &&
        result.sourceSentenceOccurrenceIdentityResult
            .authorities.length ===
          2,
      `two-sentence fixture did not preserve two occurrences: ${
        JSON.stringify(result)
      }`,
    );

    const first = result.authorities[0];

    const second = result.authorities[1];

    const sourceFirst = result.sourceSentenceOccurrenceIdentityResult
      .authorities[0];

    const sourceSecond = result.sourceSentenceOccurrenceIdentityResult
      .authorities[1];

    assert(
      first !==
          undefined &&
        second !==
          undefined &&
        sourceFirst !==
          undefined &&
        sourceSecond !==
          undefined &&
        first.sourceSentenceOccurrenceIdentityAuthority ===
          sourceFirst &&
        second.sourceSentenceOccurrenceIdentityAuthority ===
          sourceSecond &&
        first.sentenceNodeId ===
          sourceFirst.sentenceNodeId &&
        second.sentenceNodeId ===
          sourceSecond.sentenceNodeId &&
        first.sentenceIndex ===
          sourceFirst.sentenceIndex &&
        second.sentenceIndex ===
          sourceSecond.sentenceIndex &&
        first.sentenceIndex <
          second.sentenceIndex,
      "canonical sentence order was not preserved",
    );
  },
);

Deno.test(
  "snapshot-sentence.R11 same graphDocumentId with changed graph state rejects stale snapshot result",
  async () => {
    const fixture = await executableReadyFixture();

    const changedGraph = graphWithChangedRejectedFactCount(
      fixture.graph,
    );

    assertEquals(
      changedGraph.documentId,
      fixture.graph.documentId,
      "R11 graphDocumentId must remain unchanged",
    );

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        changedGraph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "source_snapshot_identity:not_exact_rederived_snapshot_authority",
        ),
      `stale source snapshot accepted after graph-state change: ${
        JSON.stringify(result)
      }`,
    );
  },
);

Deno.test(
  "snapshot-sentence.R12 later non-surface fact enrichment rejects stale snapshot result",
  async () => {
    const fixture = await executableReadyFixture();

    const enrichedGraph = graphWithLaterFactEnrichment(
      fixture.graph,
    );

    assertEquals(
      enrichedGraph.documentId,
      fixture.graph.documentId,
      "R12 graphDocumentId must remain unchanged",
    );

    assert(
      JSON.stringify(
        enrichedGraph.producerState,
      ) !==
        JSON.stringify(
          fixture.graph.producerState,
        ),
      "R12 fixture did not change graph producer state",
    );

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        enrichedGraph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "source_snapshot_identity:not_exact_rederived_snapshot_authority",
        ),
      `stale snapshot accepted after later graph enrichment: ${
        JSON.stringify(result)
      }`,
    );
  },
);

Deno.test(
  "snapshot-sentence.R13 independently reconstructed identical canonical inputs reproduce occurrence identity",
  async () => {
    const leftFixture = await executableReadyFixture(
      "Aa bb.",
    );

    const rightFixture = await executableReadyFixture(
      "Aa bb.",
    );

    assert(
      leftFixture.surface !==
          rightFixture.surface &&
        leftFixture.graph !==
          rightFixture.graph &&
        leftFixture.snapshot !==
          rightFixture.snapshot,
      "R13 independently reconstructed fixtures unexpectedly share object identity",
    );

    const left =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        leftFixture.surface,
        leftFixture.graph,
        leftFixture.snapshot,
      );

    const right =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        rightFixture.surface,
        rightFixture.graph,
        rightFixture.snapshot,
      );

    assert(
      left.status ===
          "ready" &&
        right.status ===
          "ready" &&
        left.authorities.length ===
          1 &&
        right.authorities.length ===
          1 &&
        left.authorities[0]
            ?.snapshotSentenceOccurrenceIdentityId ===
          right.authorities[0]
            ?.snapshotSentenceOccurrenceIdentityId &&
        left.authorities[0]
            ?.snapshotIdentityId ===
          right.authorities[0]
            ?.snapshotIdentityId &&
        left.authorities[0]
            ?.sentenceNodeId ===
          right.authorities[0]
            ?.sentenceNodeId,
      "identical independently reconstructed canonical inputs did not reproduce occurrence identity",
    );
  },
);

Deno.test(
  "snapshot-sentence.R14 valid READY derivation does not mutate caller surface graph or snapshot result",
  async () => {
    const fixture = await executableReadyFixture(
      "Aa bb.",
    );

    const surfaceBefore = JSON.stringify(
      fixture.surface,
    );

    const graphBefore = JSON.stringify(
      fixture.graph,
    );

    const snapshotBefore = JSON.stringify(
      fixture.snapshot,
    );

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
        "ready",
      "R14 fixture did not reach READY",
    );

    assertEquals(
      JSON.stringify(
        fixture.surface,
      ),
      surfaceBefore,
      "READY derivation mutated caller surface",
    );

    assertEquals(
      JSON.stringify(
        fixture.graph,
      ),
      graphBefore,
      "READY derivation mutated caller graph",
    );

    assertEquals(
      JSON.stringify(
        fixture.snapshot,
      ),
      snapshotBefore,
      "READY derivation mutated caller snapshot result",
    );
  },
);

Deno.test(
  "snapshot-sentence.R15 READY result performs no CURRENT winner final binding or cardinality semantics",
  async () => {
    const fixture = await executableReadyFixture(
      "Aa bb. Cc!",
    );

    const result =
      await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
        fixture.surface,
        fixture.graph,
        fixture.snapshot,
      );

    assert(
      result.status ===
          "ready" &&
        result.governance
            .currentRuntimeSentenceContextSelected ===
          false &&
        result.governance
            .contextCandidateSelected ===
          false &&
        result.governance
            .occurrenceWinnerSelected ===
          false &&
        result.governance
            .finalRuntimeOccurrenceBindingPerformed ===
          false &&
        result.governance
            .cardinalitySemanticsResolved ===
          false &&
        result.governance
            .runtimeManifestConsumed ===
          false &&
        result.governance
            .whereTruthComposed ===
          false &&
        result.governance
            .tokenPosConsumed ===
          false &&
        result.governance
            .graphMutationPerformed ===
          false &&
        result.governance
            .learnerErrorClassified ===
          false,
      "READY result exceeded generic foundation semantic ceiling",
    );

    for (
      const authority of result.authorities
    ) {
      assert(
        authority.governance
              .currentRuntimeSentenceContextSelected ===
            false &&
          authority.governance
              .contextCandidateSelected ===
            false &&
          authority.governance
              .occurrenceWinnerSelected ===
            false &&
          authority.governance
              .finalRuntimeOccurrenceBindingPerformed ===
            false &&
          authority.governance
              .cardinalitySemanticsResolved ===
            false,
        "projected authority exceeded generic semantic ceiling",
      );
    }
  },
);
