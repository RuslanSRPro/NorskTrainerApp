import {
  applyGraphPatchV1,
  type CanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
  type GraphPatchV1,
  type LanguageGraphEdgeV1,
  type LanguageGraphNodeV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  buildCanonicalSurfaceDocumentV1,
  type CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  type CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV2,
  deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2,
} from "./canonical-token-pos-graph-bound-normalized-label-projection-v2.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
  type CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1,
} from "./canonical-runtime-manifest-token-pos-expected-normalized-label-eq-authority-v1.ts";

import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1,
  type CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

import {
  compareCanonicalTokenPosNormalizedLabelEvidenceV2,
} from "./canonical-token-pos-normalized-label-comparison-evidence-v2.ts";

type AlternativeStatus =
  | "open"
  | "resolved"
  | "blocked";

type FixtureOptions = {
  text?: string;

  labels?: string[];

  statuses?: LanguageGraphNodeV1["status"][];

  alternativeStatus?: AlternativeStatus;

  resolvedIndices?: number[];
};

type Fixture = {
  surface: CanonicalSurfaceDocumentV1;

  graph: CanonicalLanguageGraphV1;

  tokenId: string;
};

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

function same(
  left: unknown,
  right: unknown,
): boolean {
  return JSON.stringify(
    left,
  ) ===
    JSON.stringify(
      right,
    );
}

function firstToken(
  graph: CanonicalLanguageGraphV1,
): LanguageGraphNodeV1 {
  const token = graph.nodes.find(
    (node) =>
      node.type ===
        "token",
  );

  assert(
    token !==
      undefined,
    "fixture token missing",
  );

  return token;
}

function baseFixture(
  text = "x",
): Fixture {
  const surface = buildCanonicalSurfaceDocumentV1(
    text,
  );

  const graph = createCanonicalLanguageGraphV1(
    surface,
  );

  return {
    surface,

    graph,

    tokenId: firstToken(
      graph,
    ).id,
  };
}

function posFixture(
  options: FixtureOptions = {},
): Fixture {
  const base = baseFixture(
    options.text ??
      "x",
  );

  const token = firstToken(
    base.graph,
  );

  const labels = options.labels ??
    [
      "noun",
      "adjective",
    ];

  const statuses = options.statuses ??
    labels.map(
      () => "candidate" as const,
    );

  const alternativeStatus = options.alternativeStatus ??
    "open";

  const resolvedIndices = options.resolvedIndices ??
    [];

  assert(
    labels.length ===
      statuses.length,
    "labels/statuses length mismatch",
  );

  const nodes: LanguageGraphNodeV1[] = [];

  const edges: LanguageGraphEdgeV1[] = [];

  const evidence: NonNullable<
    GraphPatchV1["evidence"]
  > = [];

  const memberIds: string[] = [];

  labels.forEach(
    (
      label,
      index,
    ) => {
      const lexicalId = `lex:${index}`;

      const posId = `pos:${index}`;

      const lexicalEvidenceId = `e:lex:${index}`;

      const posEvidenceId = `e:pos:${index}`;

      const graphStatus = statuses[index];

      nodes.push({
        id: lexicalId,

        type: "lexical_reading",

        subtype: "lexical_candidate",

        status: "candidate",

        span: {
          ...token.span,
        },

        features: {
          sourcePos: label,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          lexicalEvidenceId,
        ],

        provenanceIds: [
          "prov:c2-golden",
        ],
      });

      nodes.push({
        id: posId,

        type: "lexical_reading",

        subtype: "pos_candidate",

        status: graphStatus,

        span: {
          ...token.span,
        },

        features: {
          pos: label,

          contributingLexicalReadingIds: [
            lexicalId,
          ],

          sourcePosIsEvidenceNotAuthority: true,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          posEvidenceId,
        ],

        provenanceIds: [
          "prov:c2-golden",
        ],
      });

      edges.push({
        id: `edge:lexical:${index}`,

        relation: "lexical_reading_of",

        sourceId: lexicalId,

        targetId: token.id,

        status: "candidate",

        features: {},

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          lexicalEvidenceId,
        ],

        provenanceIds: [
          "prov:c2-golden",
        ],
      });

      edges.push({
        id: `edge:pos:${index}`,

        relation: "pos_of",

        sourceId: posId,

        targetId: token.id,

        status: graphStatus,

        features: {
          pos: label,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          posEvidenceId,
        ],

        provenanceIds: [
          "prov:c2-golden",
        ],
      });

      edges.push({
        id: `edge:support:${index}`,

        relation: "lexical_supports_pos",

        sourceId: lexicalId,

        targetId: posId,

        status: "candidate",

        features: {
          pos: label,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          posEvidenceId,
        ],

        provenanceIds: [
          "prov:c2-golden",
        ],
      });

      evidence.push(
        {
          id: lexicalEvidenceId,

          kind: "lexical",

          status: "supports",

          targetIds: [
            lexicalId,
            token.id,
          ],

          payload: {},

          producer: "canonical_candidate_lattice_v1",

          provenanceIds: [
            "prov:c2-golden",
          ],
        },
        {
          id: posEvidenceId,

          kind: "lexical",

          status: "supports",

          targetIds: [
            posId,
            lexicalId,
            token.id,
          ],

          payload: {
            pos: label,
          },

          producer: "canonical_candidate_lattice_v1",

          provenanceIds: [
            "prov:c2-golden",
          ],
        },
      );

      memberIds.push(
        posId,
      );
    },
  );

  const resolvedMemberIds = resolvedIndices.map(
    (index) => {
      const id = memberIds[index];

      assert(
        id !==
          undefined,
        `resolved index missing: ${index}`,
      );

      return id;
    },
  );

  const patch: GraphPatchV1 = {
    producer: "canonical_candidate_lattice_v1",

    producerVersion: "1",

    nodes,

    edges,

    evidence,

    provenance: [
      {
        id: "prov:c2-golden",

        sourceType: "system",

        sourceId: "c2-golden",
      },
    ],

    alternativeSets: labels.length ===
        0
      ? []
      : [
        {
          id: `alt:pos:${token.id}`,

          memberIds,

          resolvedMemberIds,

          status: alternativeStatus,

          reason: "c2_golden_fixture",
        },
      ],
  };

  return {
    surface: base.surface,

    graph: applyGraphPatchV1(
      base.graph,
      patch,
    ),

    tokenId: token.id,
  };
}

async function actualResult(
  fixture: Fixture,
): Promise<
  CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV2
> {
  return await deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2(
    fixture.surface,
    fixture.graph,
    fixture.tokenId,
  );
}

function expectedAuthority(
  normalizedExpectedPosLabel: string,
  rawOperand = normalizedExpectedPosLabel.toLocaleUpperCase(
    "nb-NO",
  ),
): CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1 {
  const semantic =
    CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1;

  return {
    id:
      `${CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1}:fixture:${
        encodeURIComponent(normalizedExpectedPosLabel)
      }`,

    status: "candidate",

    exactEqOperatorSourceCompatibilityId: "fixture:eq-source",

    stringOperandCompatibilityId: "fixture:string-operand",

    tokenPosSuffixPropertyCompatibilityId: "fixture:token-pos-suffix",

    leafRightOperandSiteAuthorityId: "fixture:leaf-right-operand-site",

    referenceRootAuthorityId: "fixture:reference-root",

    referenceExpressionAuthorityId: "fixture:reference-expression",

    whereShapeAuthorityId: "fixture:where-shape",

    ownerBindingDefinitionAuthorityId: "fixture:owner-binding",

    manifestId: "fixture:manifest",

    manifestCode: "fixture_manifest",

    ownerBindingName: "token",

    referencedBindingDefinitionAuthorityId: "fixture:referenced-binding",

    referencedBindingName: "token",

    leafPath: "where.fixture.right",

    leftReferenceExpression: "$token.pos",

    runtimeSuffix: ".pos",

    canonicalNodeType: "token",

    canonicalPropertyDomain: "canonical_token_occurrence",

    canonicalPropertyKind: "pos_hypothesis_set",

    sourceOperatorLabelRaw: "eq",

    canonicalOperatorLabel: "eq",

    rightOperandStructuralKind: "string",

    rightOperandSnapshot: rawOperand,

    posLabelInputOpaque: rawOperand,

    normalizedExpectedPosLabel,

    semanticCapabilityId:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,

    semanticCapabilityVersion:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1,

    semanticDomain: "canonical_token_pos_normalized_label_equality",

    expectedNormalizationContract: {
      ...semantic
        .expectedLabelNormalization,
    },

    equalitySemantics: {
      ...semantic
        .equalitySemantics,
    },

    governance: {
      exactSourceEqResultRequired: true,

      exactSourceEqAuthorityRequired: true,

      exactSourceEqIdentityPreserved: true,

      exactSemanticCapabilityRequired: true,

      exactSemanticCapabilityIdentityPreserved: true,

      semanticCapabilityContractValidatedBeforeExecution: true,

      exactManifestIdentityPreserved: true,

      exactOwnerBindingIdentityPreserved: true,

      exactReferencedBindingIdentityPreserved: true,

      exactLeafSiteIdentityPreserved: true,

      exactRuntimePosSuffixPreserved: true,

      exactRawSourceEqConsumed: true,

      sourceOperatorParsingPerformed: false,

      operatorAliasNormalizationAuthorized: false,

      operatorSemanticsReconstructed: false,

      expectedOperandReadPerformed: true,

      expectedLabelNormalizationPerformed: true,

      expectedLabelTrimPerformed: true,

      expectedLabelEmptyAfterTrimUnsupported: true,

      expectedLabelUnicodeNfcPerformed: true,

      expectedLabelNbNoLowercasePerformed: true,

      normalizedExpectedLabelProduced: true,

      posVocabularyValidated: false,

      operandKnownCanonicalPosLabel: false,

      canonicalPosHypothesisRead: false,

      canonicalPosHypothesisSelected: false,

      actualPosLabelReadPerformed: false,

      actualPosLabelNormalizationPerformed: false,

      comparisonExecuted: false,

      comparisonTruthResolved: false,

      runtimeConditionTruthResolved: false,

      candidateSentenceDomainConsumed: false,

      tokenNodeIdInspected: false,

      occurrenceEnumerationPerformed: false,

      occurrenceFilteringPerformed: false,

      occurrenceBindingPerformed: false,

      cardinalityEnforcementPerformed: false,

      genericRuntimeEqAuthority: false,

      genericJsonEqualityAuthority: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,

      candidateOnly: true,

      frozenGrammarReadOnly: true,
    },
  };
}

async function compareFixture(
  fixture: Fixture,
  normalizedExpectedPosLabel: string,
) {
  const actual = await actualResult(
    fixture,
  );

  return {
    actual,

    expected: expectedAuthority(
      normalizedExpectedPosLabel,
    ),

    result: compareCanonicalTokenPosNormalizedLabelEvidenceV2(
      actual,
      expectedAuthority(
        normalizedExpectedPosLabel,
      ),
    ),
  };
}

function evidenceFrom(
  result: ReturnType<
    typeof compareCanonicalTokenPosNormalizedLabelEvidenceV2
  >,
) {
  assert(
    result.status ===
        "ready" &&
      result.evidence !==
        undefined,
    `expected ready C2: ${JSON.stringify(result)}`,
  );

  return result.evidence;
}

const tests: Array<{
  name: string;

  run: () => Promise<void>;
}> = [
  {
    name: "C2.1 open normalized match produces open_match_possible evidence",

    run: async () => {
      const actual = await actualResult(
        posFixture({
          labels: [
            " NOUN ",
            "verb",
          ],
        }),
      );

      const expected = expectedAuthority(
        "noun",
        " NOUN ",
      );

      const e = evidenceFrom(
        compareCanonicalTokenPosNormalizedLabelEvidenceV2(
          actual,
          expected,
        ),
      );

      assert(
        e.comparisonState ===
            "open_match_possible" &&
          e.memberComparisons.length ===
            2 &&
          e.memberComparisons[0]
              .normalizedPosLabel ===
            "noun" &&
          e.memberComparisons[0]
              .equalsExpectedNormalizedLabel ===
            true &&
          e.matchingSurvivingMemberIds.includes(
            "pos:0",
          ),
        "open normalized match classification failed",
      );
    },
  },

  {
    name:
      "C2.2 open candidates with no surviving match remain open_no_surviving_match not false",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "verb",
                "adjective",
              ],
            }),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "open_no_surviving_match" &&
          e.matchingSurvivingMemberIds.length ===
            0 &&
          e.governance
              .comparisonEvidenceStateIsBooleanTruth ===
            false &&
          e.governance
              .booleanTruthProduced ===
            false,
        "open absence collapsed into boolean false",
      );
    },
  },

  {
    name:
      "C2.3 singleton open matching hypothesis remains open_match_possible not truth",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "noun",
              ],
            }),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "open_match_possible" &&
          e.memberComparisons.length ===
            1 &&
          e.resolvedMemberIds.length ===
            0 &&
          e.governance
              .singletonOpenAutoResolved ===
            false &&
          e.governance
              .booleanTruthProduced ===
            false,
        "singleton open became truth",
      );
    },
  },

  {
    name: "C2.4 no_pos_fact remains no_pos_fact and not false",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            baseFixture(),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "no_pos_fact" &&
          e.memberComparisons.length ===
            0 &&
          e.governance
              .booleanTruthProduced ===
            false &&
          e.governance
              .comparisonTruthResolved ===
            false,
        "no_pos_fact collapsed into false",
      );
    },
  },

  {
    name:
      "C2.5 blocked hypothesis set remains blocked_hypothesis_set and not false",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "noun",
                "verb",
              ],

              statuses: [
                "rejected",
                "blocked",
              ],

              alternativeStatus: "blocked",
            }),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "blocked_hypothesis_set" &&
          e.governance
              .booleanTruthProduced ===
            false &&
          e.governance
              .runtimeConditionTruthResolved ===
            false,
        "blocked set collapsed into truth",
      );
    },
  },

  {
    name: "C2.6 ambiguous surviving member can match without resolving set",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "noun",
                "verb",
              ],

              statuses: [
                "ambiguous",
                "candidate",
              ],
            }),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "open_match_possible" &&
          e.memberComparisons[0]
              .graphStatus ===
            "ambiguous" &&
          e.memberComparisons[0]
              .survivingForOpenComparison ===
            true &&
          e.memberComparisons[0]
              .equalsExpectedNormalizedLabel ===
            true &&
          e.resolvedMemberIds.length ===
            0,
        "ambiguous matching member resolved set",
      );
    },
  },

  {
    name: "C2.7 rejected matching member does not create open_match_possible",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "noun",
                "verb",
              ],

              statuses: [
                "rejected",
                "candidate",
              ],
            }),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "open_no_surviving_match" &&
          e.memberComparisons[0]
              .equalsExpectedNormalizedLabel ===
            true &&
          e.memberComparisons[0]
              .survivingForOpenComparison ===
            false &&
          !e.matchingSurvivingMemberIds.includes(
            "pos:0",
          ),
        "rejected matching member counted as possible",
      );
    },
  },

  {
    name: "C2.8 blocked matching member does not create open_match_possible",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "noun",
                "verb",
              ],

              statuses: [
                "blocked",
                "candidate",
              ],
            }),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "open_no_surviving_match" &&
          e.memberComparisons[0]
              .equalsExpectedNormalizedLabel ===
            true &&
          e.memberComparisons[0]
              .survivingForOpenComparison ===
            false &&
          !e.matchingSurvivingMemberIds.includes(
            "pos:0",
          ),
        "blocked matching member counted as possible",
      );
    },
  },

  {
    name:
      "C2.9 explicit resolved all match produces explicit_resolved_match evidence only",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "NOUN",
                " noun ",
              ],

              statuses: [
                "resolved",
                "resolved",
              ],

              alternativeStatus: "resolved",

              resolvedIndices: [
                0,
                1,
              ],
            }),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "explicit_resolved_match" &&
          e.resolvedMemberIds.length ===
            2 &&
          e.matchingResolvedMemberIds.length ===
            2 &&
          e.governance
              .booleanTruthProduced ===
            false,
        "explicit resolved match became Runtime truth",
      );
    },
  },

  {
    name:
      "C2.10 explicit resolved none match produces explicit_resolved_non_match evidence only",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "verb",
                "adjective",
              ],

              statuses: [
                "resolved",
                "resolved",
              ],

              alternativeStatus: "resolved",

              resolvedIndices: [
                0,
                1,
              ],
            }),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "explicit_resolved_non_match" &&
          e.resolvedMemberIds.length ===
            2 &&
          e.matchingResolvedMemberIds.length ===
            0 &&
          e.governance
              .comparisonTruthResolved ===
            false,
        "explicit resolved non-match became false",
      );
    },
  },

  {
    name: "C2.11 explicit resolved mixed remains explicit_resolved_mixed",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "noun",
                "verb",
              ],

              statuses: [
                "resolved",
                "resolved",
              ],

              alternativeStatus: "resolved",

              resolvedIndices: [
                0,
                1,
              ],
            }),
            "noun",
          )
        ).result,
      );

      assert(
        e.comparisonState ===
            "explicit_resolved_mixed" &&
          e.resolvedMemberIds.length ===
            2 &&
          e.matchingResolvedMemberIds.length ===
            1 &&
          e.governance
              .booleanTruthProduced ===
            false,
        "mixed resolved evidence collapsed",
      );
    },
  },

  {
    name:
      "C2.12 normalization collision preserves distinct member comparisons and order",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "A\u030A",
                "\u00C5",
              ],

              statuses: [
                "candidate",
                "ambiguous",
              ],
            }),
            "\u00E5",
          )
        ).result,
      );

      assert(
        e.memberComparisons.length ===
            2 &&
          e.memberComparisons[0]
              .posReadingNodeId ===
            "pos:0" &&
          e.memberComparisons[1]
              .posReadingNodeId ===
            "pos:1" &&
          e.memberComparisons[0]
              .normalizedPosLabel ===
            "\u00E5" &&
          e.memberComparisons[1]
              .normalizedPosLabel ===
            "\u00E5" &&
          e.memberComparisons[0]
              .equalsExpectedNormalizedLabel ===
            true &&
          e.memberComparisons[1]
              .equalsExpectedNormalizedLabel ===
            true &&
          e.governance
              .normalizationCollisionMembersDeduplicated ===
            false,
        "normalization collision collapsed member evidence",
      );
    },
  },

  {
    name:
      "C2.13 exact expected authority provenance is preserved without reconstruction",

    run: async () => {
      const fixture = posFixture({
        labels: [
          "noun",
        ],
      });

      const actual = await actualResult(
        fixture,
      );

      const expected = expectedAuthority(
        "noun",
        " NOUN ",
      );

      const e = evidenceFrom(
        compareCanonicalTokenPosNormalizedLabelEvidenceV2(
          actual,
          expected,
        ),
      );

      assert(
        e.expectedAuthority ===
            expected &&
          e.expectedAuthorityId ===
            expected.id &&
          e.expectedNormalizedPosLabel ===
            expected.normalizedExpectedPosLabel &&
          e.expectedAuthority
              .manifestId ===
            expected.manifestId &&
          e.governance
              .expectedAuthorityObjectPreservedWithoutReconstruction ===
            true,
        "expected authority provenance reconstructed",
      );
    },
  },

  {
    name:
      "C2.14 exact actual snapshot and token occurrence identity are preserved",

    run: async () => {
      const actual = await actualResult(
        posFixture({
          labels: [
            "noun",
          ],
        }),
      );

      assert(
        actual.status ===
            "ready" &&
          actual.graphBoundProjection !==
            undefined,
        "actual G2 fixture not ready",
      );

      const expected = expectedAuthority(
        "noun",
      );

      const e = evidenceFrom(
        compareCanonicalTokenPosNormalizedLabelEvidenceV2(
          actual,
          expected,
        ),
      );

      const p = actual.graphBoundProjection;

      assert(
        e.actualGraphBoundProjection ===
            p &&
          e.actualGraphBoundProjectionId ===
            p.graphBoundProjectionId &&
          e.actualSnapshotIdentityId ===
            p.snapshotIdentityId &&
          e.actualSnapshotSha256 ===
            p.snapshotSha256 &&
          e.actualTokenNodeId ===
            p.tokenNodeId &&
          e.actualGraphTokenOccurrenceIdentityId ===
            p.graphTokenOccurrenceIdentityId &&
          e.governance
              .actualGraphBoundProjectionObjectPreservedWithoutReconstruction ===
            true,
        "actual occurrence provenance reconstructed",
      );
    },
  },

  {
    name: "C2.15 stale non-exact G2 result blocks fail closed",

    run: async () => {
      const actual = await actualResult(
        posFixture({
          labels: [
            "noun",
          ],
        }),
      );

      const staleActual = {
        ...actual,

        producer: "stale-g2-producer" as never,
      };

      const result = compareCanonicalTokenPosNormalizedLabelEvidenceV2(
        staleActual,
        expectedAuthority(
          "noun",
        ),
      );

      assert(
        result.status ===
            "blocked" &&
          result.evidence ===
            undefined &&
          result.blockingReasons.includes(
            "actual_graph_bound_projection:not_exact_ready",
          ),
        "stale actual result accepted",
      );
    },
  },

  {
    name: "C2.16 stale non-exact expected authority blocks fail closed",

    run: async () => {
      const actual = await actualResult(
        posFixture({
          labels: [
            "noun",
          ],
        }),
      );

      const expected = expectedAuthority(
        "noun",
      );

      const staleExpected = {
        ...expected,

        canonicalOperatorLabel: "neq" as never,
      };

      const result = compareCanonicalTokenPosNormalizedLabelEvidenceV2(
        actual,
        staleExpected,
      );

      assert(
        result.status ===
            "blocked" &&
          result.evidence ===
            undefined &&
          result.blockingReasons.includes(
            "expected_normalized_label_authority:not_exact_candidate",
          ),
        "stale expected authority accepted",
      );
    },
  },

  {
    name: "C2.17 stale semantic capability object blocks fail closed",

    run: async () => {
      const actual = await actualResult(
        posFixture({
          labels: [
            "noun",
          ],
        }),
      );

      const staleCapability = structuredClone(
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
      ) as CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1;

      const result = compareCanonicalTokenPosNormalizedLabelEvidenceV2(
        actual,
        expectedAuthority(
          "noun",
        ),
        staleCapability,
      );

      assert(
        result.status ===
            "blocked" &&
          result.evidence ===
            undefined &&
          result.blockingReasons.includes(
            "semantic_capability:not_exact_singleton",
          ),
        "stale semantic capability accepted",
      );
    },
  },

  {
    name: "C2.18 comparison derivation is deterministic and read only",

    run: async () => {
      const fixture = posFixture({
        labels: [
          "noun",
          "verb",
        ],

        statuses: [
          "candidate",
          "ambiguous",
        ],
      });

      const actual = await actualResult(
        fixture,
      );

      const expected = expectedAuthority(
        "noun",
        " NOUN ",
      );

      const actualBefore = JSON.stringify(
        actual,
      );

      const expectedBefore = JSON.stringify(
        expected,
      );

      const semanticBefore = JSON.stringify(
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
      );

      const first = compareCanonicalTokenPosNormalizedLabelEvidenceV2(
        actual,
        expected,
      );

      const second = compareCanonicalTokenPosNormalizedLabelEvidenceV2(
        actual,
        expected,
      );

      assert(
        same(
          first,
          second,
        ),
        "C2 output is not deterministic",
      );

      assert(
        JSON.stringify(
              actual,
            ) ===
            actualBefore &&
          JSON.stringify(
              expected,
            ) ===
            expectedBefore &&
          JSON.stringify(
              CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
            ) ===
            semanticBefore,
        "C2 mutated an authority input",
      );
    },
  },

  {
    name:
      "C2.19 comparison performs no Runtime domain binding filtering or cardinality execution",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "noun",
                "verb",
              ],
            }),
            "noun",
          )
        ).result,
      );

      const g = e.governance;

      assert(
        g.pairingSuppliedByCaller ===
            true &&
          g.runtimeSiteApplicabilityResolved ===
            false &&
          g.operatorSemanticsReconstructed ===
            false &&
          g.runtimeConsumed ===
            false &&
          g.manifestTraversalPerformed ===
            false &&
          g.runtimeWhereConsumed ===
            false &&
          g.runtimeBindingPerformed ===
            false &&
          g.sentenceDomainConsumed ===
            false &&
          g.occurrenceEnumerationPerformed ===
            false &&
          g.occurrenceFilteringPerformed ===
            false &&
          g.occurrenceBindingPerformed ===
            false &&
          g.cardinalitySemanticsResolved ===
            false &&
          g.cardinalityEnforcementPerformed ===
            false &&
          g.historicalComparisonAuthorityImported ===
            false &&
          g.historicalRuntimeDomainComparisonImported ===
            false,
        "C2 crossed Runtime/domain/cardinality authority ceiling",
      );
    },
  },

  {
    name:
      "C2.20 evidence classification never produces boolean truth winner mutation or learner error",

    run: async () => {
      const e = evidenceFrom(
        (
          await compareFixture(
            posFixture({
              labels: [
                "noun",
                "verb",
              ],

              statuses: [
                "resolved",
                "resolved",
              ],

              alternativeStatus: "resolved",

              resolvedIndices: [
                0,
                1,
              ],
            }),
            "noun",
          )
        ).result,
      );

      const g = e.governance;

      assert(
        e.comparisonState ===
            "explicit_resolved_mixed" &&
          g.exactStringEqualityExecutedPerMember ===
            true &&
          g.comparisonExecuted ===
            true &&
          g.comparisonEvidenceStateProduced ===
            true &&
          g.comparisonEvidenceStateIsBooleanTruth ===
            false &&
          g.booleanTruthProduced ===
            false &&
          g.comparisonTruthResolved ===
            false &&
          g.runtimeConditionTruthResolved ===
            false &&
          g.posWinnerSelected ===
            false &&
          g.graphMutationPerformed ===
            false &&
          g.learnerErrorClassified ===
            false &&
          g.frozenGrammarReadOnly ===
            true,
        "C2 evidence became downstream truth/action authority",
      );
    },
  },
];

assert(
  tests.length ===
    20,
  "C2 Golden matrix must contain exactly 20 cases",
);

for (
  const test of tests
) {
  Deno.test(
    test.name,
    test.run,
  );
}
