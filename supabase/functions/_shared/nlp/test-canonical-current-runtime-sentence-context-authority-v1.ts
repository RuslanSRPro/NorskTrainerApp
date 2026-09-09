import {
  type CanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  buildCanonicalSurfaceDocumentV1,
  type CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import {
  type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityReadyResultV1,
  deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1,
} from "./canonical-snapshot-sentence-occurrence-identity-authority-v1.ts";

import {
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,
  type CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1,
  deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1,
} from "./canonical-current-runtime-sentence-context-authority-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type Fixture = {
  surface: CanonicalSurfaceDocumentV1;

  graph: CanonicalLanguageGraphV1;

  snapshotSentence:
    CanonicalSnapshotSentenceOccurrenceIdentityAuthorityReadyResultV1;
};

async function fixture(
  text = "Han kommer.",
): Promise<Fixture> {
  const surface = buildCanonicalSurfaceDocumentV1(
    text,
    [],
  );

  const graph = createCanonicalLanguageGraphV1(
    surface,
  );

  const snapshot = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    surface,
    graph,
  );

  assert(
    snapshot.status === "ready" &&
      snapshot.authority !== undefined,
    `snapshot fixture blocked: ${JSON.stringify(snapshot)}`,
  );

  const snapshotSentence =
    await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
      surface,
      graph,
      snapshot,
    );

  assert(
    snapshotSentence.status ===
      "ready",
    `snapshot-sentence fixture blocked: ${JSON.stringify(snapshotSentence)}`,
  );

  assert(
    snapshotSentence.authorities.length >
      0,
    "fixture produced no sentence occurrences",
  );

  return {
    surface,
    graph,
    snapshotSentence,
  };
}

function rawInput(
  f: Fixture,
  occurrenceIndex = 0,
  invocationId = "runtime-invocation:golden:1",
) {
  const occurrence = f.snapshotSentence
    .authorities[
      occurrenceIndex
    ];

  assert(
    occurrence !== undefined,
    `fixture occurrence ${occurrenceIndex} missing`,
  );

  return {
    executionInvocationId: invocationId,

    declaredCurrentSnapshotIdentityId: occurrence
      .snapshotIdentityId,

    declaredCurrentSnapshotSentenceOccurrenceIdentityId: occurrence
      .snapshotSentenceOccurrenceIdentityId,
  };
}

async function ready(
  f?: Fixture,
  occurrenceIndex = 0,
): Promise<
  CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1
> {
  const actualFixture = f ??
    await fixture();

  const result = await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
    actualFixture.surface,
    actualFixture.graph,
    rawInput(
      actualFixture,
      occurrenceIndex,
    ),
  );

  assert(
    result.status ===
      "ready",
    `expected READY, got ${JSON.stringify(result)}`,
  );

  return result;
}

Deno.test(
  "current-context.1 producer and version are frozen",
  () => {
    assert(
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1 ===
        "canonical_current_runtime_sentence_context_authority_v1",
      "producer changed",
    );

    assert(
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1 ===
        "1",
      "version changed",
    );
  },
);

Deno.test(
  "current-context.2 public API arity is exactly three",
  () => {
    assert(
      deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1
        .length ===
        3,
      "CURRENT authority public API arity changed",
    );
  },
);

Deno.test(
  "current-context.3 exact independently proven declaration reaches CURRENT",
  async () => {
    const f = await fixture();

    const result = await ready(f);

    const source = f.snapshotSentence
      .authorities[0];

    assert(
      result.authority.status ===
        "proven_current",
      "CURRENT authority status is not proven_current",
    );

    assert(
      result.authority
        .snapshotIdentityId ===
        source.snapshotIdentityId,
      "snapshot identity changed",
    );

    assert(
      result.authority
        .snapshotSentenceOccurrenceIdentityId ===
        source.snapshotSentenceOccurrenceIdentityId,
      "snapshot-sentence occurrence identity changed",
    );
  },
);

Deno.test(
  "current-context.4 caller declaration remains claim not proof",
  async () => {
    const result = await ready();

    assert(
      result.authority
        .governance
        .callerDeclarationAcceptedAsProof ===
        false,
      "caller declaration became proof",
    );

    assert(
      result.authority
        .governance
        .currentContextProvenByIndependentAuthority ===
        true,
      "CURRENT was not backed by independent authority",
    );

    assert(
      result.authority
            .governance
            .snapshotIdentityDerivedInternally ===
          true &&
        result.authority
            .governance
            .snapshotSentenceOccurrencesDerivedInternally ===
          true,
      "CURRENT relies on caller-produced source authorities",
    );
  },
);

Deno.test(
  "current-context.5 declared snapshot identity mismatch blocks",
  async () => {
    const f = await fixture();

    const input = rawInput(f);

    input.declaredCurrentSnapshotIdentityId = "forged-snapshot";

    const result =
      await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
        f.surface,
        f.graph,
        input,
      );

    assert(
      result.status ===
        "blocked",
      "forged snapshot identity reached CURRENT",
    );

    assert(
      result.blockingReasons.includes(
        "current_runtime_sentence_context:declared_snapshot_identity_mismatch",
      ),
      `wrong blocking reason: ${JSON.stringify(result)}`,
    );
  },
);

Deno.test(
  "current-context.6 unproven snapshot-sentence occurrence blocks",
  async () => {
    const f = await fixture();

    const input = rawInput(f);

    input.declaredCurrentSnapshotSentenceOccurrenceIdentityId =
      "forged-snapshot-sentence-occurrence";

    const result =
      await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
        f.surface,
        f.graph,
        input,
      );

    assert(
      result.status ===
        "blocked",
      "forged occurrence reached CURRENT",
    );

    assert(
      result.blockingReasons.includes(
        "current_runtime_sentence_context:declared_snapshot_sentence_occurrence_not_proven",
      ),
      `wrong blocking reason: ${JSON.stringify(result)}`,
    );
  },
);

Deno.test(
  "current-context.7 stale declaration from another exact snapshot blocks",
  async () => {
    const oldFixture = await fixture(
      "Han kommer.",
    );

    const currentFixture = await fixture(
      "Hun går.",
    );

    const staleInput = rawInput(
      oldFixture,
    );

    const result =
      await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
        currentFixture.surface,
        currentFixture.graph,
        staleInput,
      );

    assert(
      result.status ===
        "blocked",
      "stale snapshot declaration reached CURRENT",
    );

    assert(
      result.blockingReasons.includes(
        "current_runtime_sentence_context:declared_snapshot_identity_mismatch",
      ),
      `unexpected stale-snapshot reason: ${JSON.stringify(result)}`,
    );
  },
);

Deno.test(
  "current-context.8 malformed execution declaration fails closed before CURRENT",
  async () => {
    const f = await fixture();

    for (
      const input of [
        null,
        {},
        {
          executionInvocationId: "",
        },
        {
          ...rawInput(f),
          sentenceIndex: 0,
        },
        {
          ...rawInput(f),
          rootCandidates: [],
        },
      ]
    ) {
      const result =
        await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
          f.surface,
          f.graph,
          input,
        );

      assert(
        result.status ===
          "blocked",
        `malformed declaration reached CURRENT: ${JSON.stringify(input)}`,
      );
    }
  },
);

Deno.test(
  "current-context.9 exact second sentence can be CURRENT without first-sentence inference",
  async () => {
    const f = await fixture(
      "Han kommer. Hun går.",
    );

    assert(
      f.snapshotSentence.authorities.length >=
        2,
      "multi-sentence fixture did not produce at least two occurrences",
    );

    const result = await ready(
      f,
      1,
    );

    const second = f.snapshotSentence
      .authorities[1];

    assert(
      result.authority
        .snapshotSentenceOccurrenceIdentityId ===
        second.snapshotSentenceOccurrenceIdentityId,
      "declared second occurrence was not preserved as CURRENT",
    );

    assert(
      result.authority
        .governance
        .firstSentenceInferenceAllowed ===
        false,
      "first-sentence inference became allowed",
    );
  },
);

Deno.test(
  "current-context.10 sentenceIndex is metadata only and never caller selector",
  async () => {
    const result = await ready();

    const g = result.authority
      .governance;

    assert(
      g.sentenceIndexUsedAsContextIdentity ===
        false,
      "sentenceIndex became context identity",
    );

    assert(
      g.sentenceIndexUsedAsSelector ===
        false,
      "sentenceIndex became selector",
    );

    assert(
      g.sentenceIndexIsLocalityMetadataOnly ===
        true,
      "sentenceIndex stopped being locality metadata",
    );

    assert(
      g.sentenceNodeIdAcceptedFromCallerAsSelector ===
        false,
      "sentenceNodeId became caller selector",
    );

    assert(
      g.graphDocumentIdUsedAsSelector ===
        false,
      "graphDocumentId became selector",
    );
  },
);

Deno.test(
  "current-context.11 singleton and A4.6a1f candidate inference remain forbidden",
  async () => {
    const g = (await ready())
      .authority
      .governance;

    assert(
      g.singletonSentenceInferenceAllowed ===
        false,
      "singleton sentence became CURRENT proof",
    );

    assert(
      g.singletonCandidateInferenceAllowed ===
        false,
      "singleton candidate became CURRENT proof",
    );

    assert(
      g.rootCandidatesAcceptedAsSelector ===
        false,
      "A4.6a1f rootCandidates became CURRENT selector",
    );

    assert(
      g.contextCandidateSelected ===
        false,
      "CURRENT authority selected a grammar context candidate",
    );
  },
);

Deno.test(
  "current-context.12 applicability winner binding cardinality WHERE execution and learner error remain downstream",
  async () => {
    const g = (await ready())
      .authority
      .governance;

    assert(
      g.runtimeSiteApplicabilityResolved ===
        false,
      "site applicability leaked into CURRENT authority",
    );

    assert(
      g.occurrenceWinnerSelected ===
        false,
      "occurrence winner leaked into CURRENT authority",
    );

    assert(
      g.bindingTruthResolved ===
        false,
      "binding truth leaked into CURRENT authority",
    );

    assert(
      g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false,
      "cardinality leaked into CURRENT authority",
    );

    assert(
      g.runtimeWhereTruthResolved ===
        false,
      "WHERE truth leaked into CURRENT authority",
    );

    assert(
      g.ruleExecutionPerformed ===
        false,
      "rule execution leaked into CURRENT authority",
    );

    assert(
      g.learnerErrorClassified ===
        false,
      "learner error leaked into CURRENT authority",
    );
  },
);

Deno.test(
  "current-context.13 source snapshot-sentence authority object is preserved without reconstruction",
  async () => {
    const result = await ready();

    const match = result
      .snapshotSentenceOccurrenceIdentityResult
      .authorities
      .find(
        (candidate) =>
          candidate
            .snapshotSentenceOccurrenceIdentityId ===
            result.authority
              .snapshotSentenceOccurrenceIdentityId,
      );

    assert(
      match !== undefined,
      "matching source occurrence missing",
    );

    assert(
      result.authority
        .sourceSnapshotSentenceOccurrenceAuthority ===
        match,
      "source snapshot-sentence authority was reconstructed",
    );
  },
);

Deno.test(
  "current-context.14 CURRENT proof does not mutate graph",
  async () => {
    const f = await fixture();

    const before = JSON.stringify(
      f.graph,
    );

    await ready(f);

    assert(
      JSON.stringify(
        f.graph,
      ) ===
        before,
      "CURRENT authority mutated caller graph",
    );
  },
);

Deno.test(
  "current-context.15 same exact invocation and snapshot produce deterministic authority",
  async () => {
    const f = await fixture();

    const input = rawInput(f);

    const first = await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
      f.surface,
      f.graph,
      input,
    );

    const second =
      await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
        f.surface,
        f.graph,
        input,
      );

    assert(
      JSON.stringify(first) ===
        JSON.stringify(second),
      "CURRENT authority is non-deterministic",
    );
  },
);

Deno.test(
  "current-context.16 execution invocation identity participates in authority identity but not sentence selection",
  async () => {
    const f = await fixture();

    const first = await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
      f.surface,
      f.graph,
      rawInput(
        f,
        0,
        "invocation:a",
      ),
    );

    const second =
      await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
        f.surface,
        f.graph,
        rawInput(
          f,
          0,
          "invocation:b",
        ),
      );

    assert(
      first.status ===
          "ready" &&
        second.status ===
          "ready",
      "valid invocation variants did not reach READY",
    );

    assert(
      first.authority
        .snapshotSentenceOccurrenceIdentityId ===
        second.authority
          .snapshotSentenceOccurrenceIdentityId,
      "invocation id altered sentence proof",
    );

    assert(
      first.authority
        .authorityId !==
        second.authority
          .authorityId,
      "distinct invocations collapsed into one CURRENT authority identity",
    );

    assert(
      first.authority
        .governance
        .executionInvocationIdUsedAsSentenceSelector ===
        false,
      "execution invocation id became sentence selector",
    );
  },
);

Deno.test(
  "current-context.17 production source contains no downstream applicability binding or constraint imports",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-current-runtime-sentence-context-authority-v1.ts",
        import.meta.url,
      ),
    );

    const forbiddenImports = [
      "canonical-runtime-token-pos-site-occurrence-applicability",
      "canonical-runtime-manifest-binding-where",
      "canonical-constraint-propagation",
      "canonical-runtime-token-pos-condition-truth",
      "canonical-runtime-token-pos-leaf-root-candidate-disposition",
    ];

    for (const forbidden of forbiddenImports) {
      assert(
        !source.includes(
          `from "./${forbidden}`,
        ) &&
          !source.includes(
            `from './${forbidden}`,
          ),
        `forbidden downstream import detected: ${forbidden}`,
      );
    }
  },
);

Deno.test(
  "current-context.18 CURRENT authority does not reconstruct snapshot-sentence occurrence identity",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-current-runtime-sentence-context-authority-v1.ts",
        import.meta.url,
      ),
    );

    assert(
      !source.includes(
        "function snapshotSentenceOccurrenceIdentityId",
      ),
      "CURRENT authority duplicated snapshot-sentence identity constructor",
    );

    assert(
      !source.includes(
        "canonical-snapshot-sentence-occurrence-v1:",
      ),
      "CURRENT authority hard-coded snapshot-sentence identity format",
    );
  },
);
