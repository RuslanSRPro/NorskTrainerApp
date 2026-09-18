import {
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-semantics-v1.ts";

import {
  classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-enforcement-v1.ts";

function assert(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function semanticDomain(
  survivingOccurrenceCount: number,
  minimum: number,
  maximum: number | "unbounded",
  uncertainSurvivorCount = 0,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1 {
  return {
    cardinalitySemanticDomainId: "semantic-domain:1",
    status: "proven_post_where_owner_cardinality_semantics",

    structuralAuthorityId: "structural-authority:1",
    ownerBindingDefinitionAuthorityId: "binding-authority:1",

    manifestId: "manifest-id:1",
    manifestCode: "manifest-code:1",
    ownerBindingName: "OWNER",

    snapshotIdentityId: "snapshot:1",
    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence:1",
    graphDocumentId: "graph-document:1",
    sentenceNodeId: "sentence:1",

    sourceOccurrenceCount: survivingOccurrenceCount,
    survivingOccurrenceCount,
    rejectedOccurrenceCount: 0,
    uncertainSurvivorCount,

    cardinalityLabel: maximum === 1
      ? "one"
      : minimum === 1
      ? "one_or_more"
      : "zero_or_more",

    minimum,
    maximum,

    sourceSurvivorDomain:
      {} as unknown as CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1[
        "sourceSurvivorDomain"
      ],

    sourceBindingDefinitionAuthority:
      {} as unknown as CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1[
        "sourceBindingDefinitionAuthority"
      ],

    governance: {
      exactOwnerBindingDefinitionAuthorityJoinRequired: true,
      exactOwnerManifestLineageRequired: true,
      cardinalityLabelConsumedFromExactOwnerBindingDefinitionAuthority: true,
      cardinalityLabelNormalizedOrRewritten: false,
      unsupportedCardinalityLabelRejected: true,
      cardinalitySemanticsResolved: true,
      survivorCountUsedAsCardinalitySemanticAuthority: false,
      singletonSurvivorTreatedAsWinner: false,
      cardinalityEnforcementPerformed: false,
      domainCandidateWinnerSelected: false,
      occurrenceWinnerSelected: false,
      occurrenceBindingPerformed: false,
      finalRuntimeOccurrenceBindingPerformed: false,
      whereEvaluationPerformed: false,
      whereTruthRecomputed: false,
      learnerErrorClassified: false,
      graphMutationPerformed: false,
      frozenGrammarReadOnly: true,
    },
  };
}

Deno.test(
  "post-WHERE OWNER cardinality enforcement: one underflows at zero survivors",
  () => {
    const state =
      classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1(
        semanticDomain(0, 1, 1),
      );

    assert(state === "underflow", `unexpected state: ${state}`);
  },
);

Deno.test(
  "post-WHERE OWNER cardinality enforcement: one is satisfied at one survivor",
  () => {
    const state =
      classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1(
        semanticDomain(1, 1, 1),
      );

    assert(state === "satisfied", `unexpected state: ${state}`);
  },
);

Deno.test(
  "post-WHERE OWNER cardinality enforcement: one overflows above one survivor",
  () => {
    const state =
      classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1(
        semanticDomain(2, 1, 1),
      );

    assert(state === "overflow", `unexpected state: ${state}`);
  },
);

Deno.test(
  "post-WHERE OWNER cardinality enforcement: one_or_more accepts multiple survivors",
  () => {
    const state =
      classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1(
        semanticDomain(7, 1, "unbounded"),
      );

    assert(state === "satisfied", `unexpected state: ${state}`);
  },
);

Deno.test(
  "post-WHERE OWNER cardinality enforcement: zero_or_more accepts zero survivors",
  () => {
    const state =
      classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1(
        semanticDomain(0, 0, "unbounded"),
      );

    assert(state === "satisfied", `unexpected state: ${state}`);
  },
);

Deno.test(
  "post-WHERE OWNER cardinality enforcement: uncertain survivor count does not independently alter cardinality comparison",
  () => {
    const withoutUncertainty =
      classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1(
        semanticDomain(1, 1, 1, 0),
      );

    const withUncertainty =
      classifyCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityEnforcementStateV1(
        semanticDomain(1, 1, 1, 1),
      );

    assert(
      withoutUncertainty === "satisfied" &&
        withUncertainty === "satisfied",
      "uncertainSurvivorCount became independent enforcement authority",
    );
  },
);

Deno.test(
  "post-WHERE OWNER cardinality enforcement production source preserves architectural ceiling",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-enforcement-v1.ts",
        import.meta.url,
      ),
    );

    const requiredMarkers = [
      "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1(",
      "domain.survivingOccurrenceCount < domain.minimum",
      'domain.maximum !== "unbounded"',
      "domain.survivingOccurrenceCount > domain.maximum",
      "uncertainSurvivorCount: domain.uncertainSurvivorCount",
      "uncertainSurvivorCountUsedAsIndependentEnforcementAuthority: false",
      "uncertaintyReadinessResolved: false",
      "cardinalityViolationIsBlockingFailure: false",
      "singletonSurvivorTreatedAsWinner: false",
      "occurrenceWinnerSelected: false",
      "finalRuntimeOccurrenceBindingPerformed: false",
      "whereTruthRecomputed: false",
      "learnerErrorClassified: false",
      "graphMutationPerformed: false",
    ];

    for (const marker of requiredMarkers) {
      assert(
        source.includes(marker),
        `missing production marker: ${marker}`,
      );
    }

    const forbiddenMarkers = [
      "referencedBindingDefinitionAuthorityId",
      "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1",
      "uncertainSurvivorCount <",
      "uncertainSurvivorCount >",
      "uncertainSurvivorCount ===",
      "cardinalityViolationIsBlockingFailure: true",
      "singletonSurvivorTreatedAsWinner: true",
      "occurrenceWinnerSelected: true",
      "finalRuntimeOccurrenceBindingPerformed: true",
      "whereEvaluationPerformed: true",
      "whereTruthRecomputed: true",
      "learnerErrorClassified: true",
      "graphMutationPerformed: true",
      "as unknown as",
      "as any",
      ": any",
      "<any>",
    ];

    for (const marker of forbiddenMarkers) {
      assert(
        !source.includes(marker),
        `forbidden production marker present: ${marker}`,
      );
    }
  },
);
