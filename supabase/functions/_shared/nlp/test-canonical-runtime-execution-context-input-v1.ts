import {
  CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_V1,
  CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_VERSION_V1,
  type CanonicalRuntimeExecutionContextInputReadyResultV1,
  deriveCanonicalRuntimeExecutionContextInputV1,
} from "./canonical-runtime-execution-context-input-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function validInput() {
  return {
    executionInvocationId: "runtime-invocation:golden:1",

    declaredCurrentSnapshotIdentityId:
      "canonical-graph-snapshot-v1:sha256:ABC123",

    declaredCurrentSnapshotSentenceOccurrenceIdentityId:
      "canonical-snapshot-sentence-occurrence-v1:ABC123:sentence-node-7",
  };
}

function ready(): CanonicalRuntimeExecutionContextInputReadyResultV1 {
  const result = deriveCanonicalRuntimeExecutionContextInputV1(
    validInput(),
  );

  assert(
    result.status === "ready",
    `expected READY, got ${JSON.stringify(result)}`,
  );

  return result;
}

Deno.test(
  "execution-context-input.1 producer and version are frozen",
  () => {
    assert(
      CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_V1 ===
        "canonical_runtime_execution_context_input_v1",
      "producer changed",
    );

    assert(
      CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_VERSION_V1 ===
        "1",
      "version changed",
    );
  },
);

Deno.test(
  "execution-context-input.2 public derivation arity is exactly one",
  () => {
    assert(
      deriveCanonicalRuntimeExecutionContextInputV1.length ===
        1,
      "public API arity changed",
    );
  },
);

Deno.test(
  "execution-context-input.3 exact three-field declaration reaches READY",
  () => {
    const result = ready();

    assert(
      Object.keys(result.input)
        .sort()
        .join("|") ===
        [
          "declaredCurrentSnapshotIdentityId",
          "declaredCurrentSnapshotSentenceOccurrenceIdentityId",
          "executionInvocationId",
        ].join("|"),
      "input surface changed",
    );
  },
);

Deno.test(
  "execution-context-input.4 exact identity strings are preserved without normalization",
  () => {
    const raw = {
      executionInvocationId: "Invocation:Case-Sensitive/01",

      declaredCurrentSnapshotIdentityId: "Snapshot:SHA256:AbC-DeF_123",

      declaredCurrentSnapshotSentenceOccurrenceIdentityId:
        "Occurrence:Snapshot:Sentence_Node:XYZ",
    };

    const result = deriveCanonicalRuntimeExecutionContextInputV1(raw);

    assert(
      result.status === "ready",
      `expected READY, got ${JSON.stringify(result)}`,
    );

    assert(
      result.input.executionInvocationId ===
        raw.executionInvocationId,
      "invocation identity normalized",
    );

    assert(
      result.input.declaredCurrentSnapshotIdentityId ===
        raw.declaredCurrentSnapshotIdentityId,
      "snapshot identity normalized",
    );

    assert(
      result.input
        .declaredCurrentSnapshotSentenceOccurrenceIdentityId ===
        raw.declaredCurrentSnapshotSentenceOccurrenceIdentityId,
      "snapshot sentence occurrence identity normalized",
    );
  },
);

Deno.test(
  "execution-context-input.5 malformed objects fail closed",
  () => {
    for (
      const value of [
        null,
        undefined,
        "",
        [],
        1,
        true,
        {},
      ]
    ) {
      const result = deriveCanonicalRuntimeExecutionContextInputV1(
        value,
      );

      assert(
        result.status === "blocked",
        `malformed value reached READY: ${JSON.stringify(value)}`,
      );
    }
  },
);

Deno.test(
  "execution-context-input.6 missing or malformed exact identity fields block",
  () => {
    const cases = [
      {
        ...validInput(),
        executionInvocationId: "",
      },
      {
        ...validInput(),
        declaredCurrentSnapshotIdentityId: 7,
      },
      {
        ...validInput(),
        declaredCurrentSnapshotSentenceOccurrenceIdentityId: null,
      },
      {
        ...validInput(),
        executionInvocationId: " runtime-invocation:1",
      },
      {
        ...validInput(),
        declaredCurrentSnapshotIdentityId: "snapshot:1 ",
      },
      {
        ...validInput(),
        declaredCurrentSnapshotSentenceOccurrenceIdentityId:
          "snapshot-sentence:\u0000bad",
      },
    ];

    for (const value of cases) {
      const result = deriveCanonicalRuntimeExecutionContextInputV1(
        value,
      );

      assert(
        result.status === "blocked",
        `invalid identity reached READY: ${JSON.stringify(value)}`,
      );
    }
  },
);

Deno.test(
  "execution-context-input.7 forbidden selectors cannot be smuggled into input",
  () => {
    const forbidden = [
      ["sentenceIndex", 0],
      ["sentenceNodeId", "sentence:0"],
      ["graphDocumentId", "document:1"],
      ["tokenNodeId", "token:1"],
      [
        "snapshotTokenOccurrenceIdentityId",
        "token-occurrence:1",
      ],
      ["candidateId", "candidate:1"],
      ["rootCandidates", []],
      [
        "applicabilityEvidenceId",
        "applicability:1",
      ],
    ] as const;

    for (const [field, value] of forbidden) {
      const raw: Record<string, unknown> = {
        ...validInput(),
      };

      raw[field] = value;

      const result = deriveCanonicalRuntimeExecutionContextInputV1(
        raw,
      );

      assert(
        result.status === "blocked",
        `forbidden selector ${field} reached READY`,
      );

      assert(
        result.blockingReasons.some(
          (reason) =>
            reason ===
              `execution_context_input:unexpected_field:${field}`,
        ),
        `missing unexpected-field reason for ${field}`,
      );
    }
  },
);

Deno.test(
  "execution-context-input.8 declaration is explicitly not CURRENT proof",
  () => {
    const g = ready().governance;

    assert(
      g.declarationIsContextClaimOnly === true,
      "declaration stopped being claim-only",
    );

    assert(
      g.callerSuppliedContextAcceptedAsProof === false,
      "caller declaration became proof",
    );

    assert(
      g.currentRuntimeSentenceContextSelected === false,
      "input layer selected CURRENT",
    );

    assert(
      g.contextCandidateSelected === false,
      "input layer selected context candidate",
    );

    assert(
      g.occurrenceWinnerSelected === false,
      "input layer selected occurrence winner",
    );
  },
);

Deno.test(
  "execution-context-input.9 sentence ordinal document token candidate and applicability semantics remain forbidden",
  () => {
    const g = ready().governance;

    assert(
      g.executionInvocationIdUsedAsContextSelector ===
        false,
      "invocation id became context selector",
    );

    assert(
      g.sentenceIndexAcceptedAsSelector === false,
      "sentenceIndex became selector",
    );

    assert(
      g.sentenceNodeIdAcceptedAsSelector === false,
      "sentenceNodeId became selector",
    );

    assert(
      g.graphDocumentIdAcceptedAsSelector === false,
      "graphDocumentId became selector",
    );

    assert(
      g.tokenOccurrenceAcceptedAsSelector === false,
      "token occurrence became selector",
    );

    assert(
      g.candidateIdentityAcceptedAsSelector === false,
      "candidate identity became selector",
    );

    assert(
      g.applicabilityAcceptedAsSelector === false,
      "applicability became selector",
    );
  },
);

Deno.test(
  "execution-context-input.10 singleton first-sentence and A4.6a1f root-candidate inference remain forbidden",
  () => {
    const g = ready().governance;

    assert(
      g.singletonCandidateInferenceAllowed === false,
      "singleton candidate inference became allowed",
    );

    assert(
      g.firstSentenceInferenceAllowed === false,
      "first-sentence inference became allowed",
    );

    assert(
      g.rootCandidatesAcceptedAsSelector === false,
      "rootCandidates became CURRENT selector",
    );
  },
);

Deno.test(
  "execution-context-input.11 applicability binding cardinality WHERE execution and learner error stay downstream",
  () => {
    const g = ready().governance;

    assert(
      g.runtimeSiteApplicabilityResolved === false,
      "applicability leaked into input layer",
    );

    assert(
      g.bindingTruthResolved === false,
      "binding truth leaked into input layer",
    );

    assert(
      g.cardinalitySemanticsResolved === false &&
        g.cardinalityEnforcementPerformed === false,
      "cardinality leaked into input layer",
    );

    assert(
      g.runtimeWhereTruthResolved === false,
      "WHERE truth leaked into input layer",
    );

    assert(
      g.ruleExecutionPerformed === false,
      "rule execution leaked into input layer",
    );

    assert(
      g.learnerErrorClassified === false,
      "learner error leaked into input layer",
    );
  },
);

Deno.test(
  "execution-context-input.12 derivation is deterministic and does not mutate caller input",
  () => {
    const raw = validInput();

    const before = JSON.stringify(raw);

    const first = deriveCanonicalRuntimeExecutionContextInputV1(
      raw,
    );

    const second = deriveCanonicalRuntimeExecutionContextInputV1(
      raw,
    );

    assert(
      JSON.stringify(first) === JSON.stringify(second),
      "same declaration produced non-deterministic result",
    );

    assert(
      JSON.stringify(raw) === before,
      "caller input was mutated",
    );
  },
);

Deno.test(
  "execution-context-input.13 input foundation imports no downstream grammar truth source",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-execution-context-input-v1.ts",
        import.meta.url,
      ),
    );

    const forbiddenImports = [
      "canonical-runtime-token-pos-site-occurrence-applicability",
      "canonical-runtime-manifest-binding-where-context-coherent",
      "canonical-runtime-manifest-binding-where-token-pos-context-bound",
      "canonical-constraint-propagation",
      "canonical-snapshot-sentence-occurrence-identity-authority",
      "authoritative-morphology",
    ];

    for (const forbidden of forbiddenImports) {
      assert(
        !source.includes(`from "./${forbidden}`) &&
          !source.includes(`from './${forbidden}`),
        `forbidden downstream/source import detected: ${forbidden}`,
      );
    }
  },
);
