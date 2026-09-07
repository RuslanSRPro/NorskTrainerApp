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
  CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1,
} from "./canonical-surface-graph-provenance-binding-authority-v1.ts";

import {
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import {
  deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2,
} from "./canonical-token-pos-graph-bound-normalized-label-projection-v2.ts";

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
    throw new Error(message);
  }
}

function same(
  left: unknown,
  right: unknown,
): boolean {
  return JSON.stringify(left) ===
    JSON.stringify(right);
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
    token !== undefined,
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
    tokenId: firstToken(graph).id,
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
    "fixture labels/status count mismatch",
  );

  const nodes: LanguageGraphNodeV1[] = [];

  const edges: LanguageGraphEdgeV1[] = [];

  const evidence: NonNullable<GraphPatchV1["evidence"]> = [];

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
          "prov:g2-golden",
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
          "prov:g2-golden",
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
          "prov:g2-golden",
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
          "prov:g2-golden",
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
          "prov:g2-golden",
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
            "prov:g2-golden",
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
            "prov:g2-golden",
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
        id: "prov:g2-golden",

        sourceType: "system",

        sourceId: "g2-golden",
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

          reason: "g2_golden_fixture",
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

async function resultFor(
  fixture: Fixture,
  tokenId = fixture.tokenId,
) {
  return await deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2(
    fixture.surface,
    fixture.graph,
    tokenId,
  );
}

async function ready(
  fixture: Fixture,
) {
  const result = await resultFor(
    fixture,
  );

  assert(
    result.status ===
        "ready" &&
      result.graphBoundProjection !==
        undefined,
    `expected ready G2: ${JSON.stringify(result)}`,
  );

  return result.graphBoundProjection;
}

const tests: Array<{
  name: string;
  run: () => Promise<void>;
}> = [
  {
    name: "G2.1 no_pos_fact survives complete ancestry snapshot R and P2 path",

    run: async () => {
      const p = await ready(
        baseFixture(),
      );

      assert(
        p.normalizedProjection
              .readState ===
            "no_pos_fact" &&
          p.normalizedProjection
              .members.length ===
            0,
        "no_pos_fact semantics changed",
      );
    },
  },

  {
    name:
      "G2.2 open multiple hypotheses preserve identity status trimmed raw label normalization and order",

    run: async () => {
      const p = (
        await ready(
          posFixture({
            labels: [
              " Noun ",
              "ADJECTIVE",
            ],

            statuses: [
              "candidate",
              "ambiguous",
            ],
          }),
        )
      ).normalizedProjection;

      assert(
        p.readState ===
            "open_hypothesis_set" &&
          p.alternativeSetStatus ===
            "open" &&
          p.members.length ===
            2 &&
          p.members[0]
              .posReadingNodeId ===
            "pos:0" &&
          p.members[0]
              .rawPosLabel ===
            "Noun" &&
          p.members[0]
              .normalizedPosLabel ===
            "noun" &&
          p.members[0]
              .graphStatus ===
            "candidate" &&
          p.members[0]
              .explicitlyResolved ===
            false &&
          p.members[1]
              .posReadingNodeId ===
            "pos:1" &&
          p.members[1]
              .rawPosLabel ===
            "ADJECTIVE" &&
          p.members[1]
              .normalizedPosLabel ===
            "adjective" &&
          p.members[1]
              .graphStatus ===
            "ambiguous" &&
          p.members[1]
              .explicitlyResolved ===
            false &&
          p.resolvedMemberIds.length ===
            0,
        "open POS alternatives changed",
      );
    },
  },

  {
    name: "G2.3 singleton open hypothesis remains open",

    run: async () => {
      const p = (
        await ready(
          posFixture({
            labels: [
              "noun",
            ],

            statuses: [
              "candidate",
            ],
          }),
        )
      ).normalizedProjection;

      assert(
        p.readState ===
            "open_hypothesis_set" &&
          p.alternativeSetStatus ===
            "open" &&
          p.members.length ===
            1 &&
          p.resolvedMemberIds.length ===
            0 &&
          p.normalizedResolvedPosLabels.length ===
            0,
        "singleton POS was auto-resolved",
      );
    },
  },

  {
    name:
      "G2.4 explicit resolved identity and trimmed raw resolved label are preserved",

    run: async () => {
      const p = (
        await ready(
          posFixture({
            labels: [
              " NOUN ",
              "adjective",
            ],

            statuses: [
              "resolved",
              "rejected",
            ],

            alternativeStatus: "resolved",

            resolvedIndices: [
              0,
            ],
          }),
        )
      ).normalizedProjection;

      assert(
        p.readState ===
            "explicit_resolved" &&
          p.alternativeSetStatus ===
            "resolved" &&
          same(
            p.resolvedMemberIds,
            [
              "pos:0",
            ],
          ) &&
          same(
            p.rawResolvedPosLabels,
            [
              "NOUN",
            ],
          ) &&
          same(
            p.normalizedResolvedPosLabels,
            [
              "noun",
            ],
          ) &&
          p.members[0]
              .rawPosLabel ===
            "NOUN" &&
          p.members[0]
              .normalizedPosLabel ===
            "noun" &&
          p.members[0]
              .graphStatus ===
            "resolved" &&
          p.members[0]
              .explicitlyResolved ===
            true &&
          p.members[1]
              .graphStatus ===
            "rejected",
        "explicit resolution changed",
      );
    },
  },

  {
    name: "G2.5 blocked POS set remains blocked semantics without comparison",

    run: async () => {
      const p = (
        await ready(
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
        )
      ).normalizedProjection;

      assert(
        p.readState ===
            "blocked_hypothesis_set" &&
          p.alternativeSetStatus ===
            "blocked" &&
          p.members.length ===
            2 &&
          p.governance
              .comparisonPerformed ===
            false &&
          p.governance
              .comparisonTruthResolved ===
            false,
        "blocked POS semantics changed",
      );
    },
  },

  {
    name: "G2.6 ambiguous graph member status remains member status",

    run: async () => {
      const p = (
        await ready(
          posFixture({
            labels: [
              "PREPOSITION",
              "noun",
            ],

            statuses: [
              "ambiguous",
              "candidate",
            ],
          }),
        )
      ).normalizedProjection;

      assert(
        p.readState ===
            "open_hypothesis_set" &&
          p.members[0]
              .graphStatus ===
            "ambiguous" &&
          p.governance
              .hypothesisSetStatePreserved ===
            true,
        "member ambiguity changed set semantics",
      );
    },
  },

  {
    name: "G2.7 normalization collision preserves distinct canonical POS facts",

    run: async () => {
      const p = (
        await ready(
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
        )
      ).normalizedProjection;

      assert(
        p.members.length ===
            2 &&
          p.members[0]
              .posReadingNodeId ===
            "pos:0" &&
          p.members[1]
              .posReadingNodeId ===
            "pos:1" &&
          p.members[0]
              .normalizedPosLabel ===
            "\u00E5" &&
          p.members[1]
              .normalizedPosLabel ===
            "\u00E5" &&
          p.governance
              .membersDeduplicated ===
            false &&
          p.governance
              .normalizationCollisionMultiplicityPreserved ===
            true,
        "normalization collision collapsed facts",
      );
    },
  },

  {
    name:
      "G2.8 resolved normalization collision preserves multiplicity and order",

    run: async () => {
      const p = (
        await ready(
          posFixture({
            labels: [
              " A\u030A ",
              "\u00C5",
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
        )
      ).normalizedProjection;

      assert(
        p.readState ===
            "explicit_resolved" &&
          same(
            p.resolvedMemberIds,
            [
              "pos:0",
              "pos:1",
            ],
          ) &&
          same(
            p.normalizedResolvedPosLabels,
            [
              "\u00E5",
              "\u00E5",
            ],
          ) &&
          p.normalizedResolvedPosLabels
              .length ===
            2,
        "resolved collision multiplicity/order lost",
      );
    },
  },

  {
    name: "G2.9 blank canonical POS label fails closed",

    run: async () => {
      const result = await resultFor(
        posFixture({
          labels: [
            "   ",
          ],

          statuses: [
            "candidate",
          ],
        }),
      );

      assert(
        result.status ===
            "blocked" &&
          result.graphBoundProjection ===
            undefined &&
          result.blockingReasons.length >
            0,
        "blank POS label accepted",
      );
    },
  },

  {
    name: "G2.10 invalid resolved canonical POS label fails closed",

    run: async () => {
      const result = await resultFor(
        posFixture({
          labels: [
            "   ",
          ],

          statuses: [
            "resolved",
          ],

          alternativeStatus: "resolved",

          resolvedIndices: [
            0,
          ],
        }),
      );

      assert(
        result.status ===
            "blocked" &&
          result.graphBoundProjection ===
            undefined &&
          result.blockingReasons.length >
            0,
        "invalid resolved POS label accepted",
      );
    },
  },

  {
    name:
      "G2.11 identical independently built snapshots reproduce occurrence identity",

    run: async () => {
      const a = posFixture({
        text: "aa bb",

        labels: [
          "noun",
          "adjective",
        ],
      });

      const b = posFixture({
        text: "aa bb",

        labels: [
          "noun",
          "adjective",
        ],
      });

      assert(
        a.graph !==
          b.graph,
        "fixture graph object identity reused",
      );

      const pa = await ready(a);

      const pb = await ready(b);

      assert(
        pa.snapshotIdentityId ===
            pb.snapshotIdentityId &&
          pa.graphStateSha256 ===
            pb.graphStateSha256 &&
          pa.graphTokenOccurrenceIdentityId ===
            pb.graphTokenOccurrenceIdentityId,
        "identical exact snapshots failed reproducibility",
      );
    },
  },

  {
    name:
      "G2.12 same-length structural ID collision separates by snapshot identity",

    run: async () => {
      const a = posFixture({
        text: "aa bb",

        labels: [
          "noun",
        ],
      });

      const b = posFixture({
        text: "cc dd",

        labels: [
          "noun",
        ],
      });

      assert(
        a.graph.documentId ===
            b.graph.documentId &&
          a.tokenId ===
            b.tokenId,
        "fixture lost intended structural collision",
      );

      const pa = await ready(a);

      const pb = await ready(b);

      assert(
        pa.graphDocumentId ===
            pb.graphDocumentId &&
          pa.tokenNodeId ===
            pb.tokenNodeId &&
          pa.snapshotIdentityId !==
            pb.snapshotIdentityId &&
          pa.graphTokenOccurrenceIdentityId !==
            pb.graphTokenOccurrenceIdentityId,
        "structural collision not snapshot-separated",
      );
    },
  },

  {
    name: "G2.13 cross surface graph pair blocks at provenance binding before",

    run: async () => {
      const a = posFixture({
        text: "aa bb",

        labels: [
          "noun",
        ],
      });

      const b = posFixture({
        text: "cc dd",

        labels: [
          "noun",
        ],
      });

      const result =
        await deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2(
          a.surface,
          b.graph,
          b.tokenId,
        );

      assert(
        result.status ===
            "blocked" &&
          result.graphBoundProjection ===
            undefined &&
          result.blockingReasons.some(
            (reason) =>
              reason.startsWith(
                "surface_graph_provenance_binding_before:",
              ),
          ),
        "cross-source graph escaped binding gate",
      );
    },
  },

  {
    name:
      "G2.14 later non-surface enrichment preserves ancestry and changes snapshot",

    run: async () => {
      const fixture = posFixture({
        labels: [
          "noun",
        ],
      });

      const before = await ready(
        fixture,
      );

      const enrichedGraph = applyGraphPatchV1(
        fixture.graph,
        {
          producer: "g2-golden-enrichment",

          producerVersion: "1",

          nodes: [
            {
              id: "semantic:g2-golden-enrichment",

              type: "semantic_unit",

              status: "candidate",

              features: {
                golden: true,
              },

              producer: "g2-golden-enrichment",

              evidenceIds: [],

              provenanceIds: [],
            },
          ],
        },
      );

      const after = await ready({
        ...fixture,

        graph: enrichedGraph,
      });

      assert(
        after.snapshotIdentityId !==
            before.snapshotIdentityId &&
          after.graphStateSha256 !==
            before.graphStateSha256 &&
          after.provenanceBinding
              .graphDocumentId ===
            before.provenanceBinding
              .graphDocumentId &&
          same(
            after.provenanceBinding
              .surfaceTokenIds,
            before.provenanceBinding
              .surfaceTokenIds,
          ),
        "enrichment ancestry/snapshot contract failed",
      );
    },
  },

  {
    name: "G2.15 missing exact token blocks",

    run: async () => {
      const result = await resultFor(
        baseFixture(),
        "tok:missing",
      );

      assert(
        result.status ===
            "blocked" &&
          result.graphBoundProjection ===
            undefined,
        "missing token accepted",
      );
    },
  },

  {
    name: "G2.16 provenance binding authority id and object are preserved",

    run: async () => {
      const fixture = posFixture({
        labels: [
          "noun",
        ],
      });

      const p = await ready(
        fixture,
      );

      assert(
        p.provenanceBindingAuthorityId ===
            CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1 &&
          p.provenanceBinding
              .authorityId ===
            CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1 &&
          p.provenanceBinding
              .graphDocumentId ===
            fixture.graph.documentId &&
          p.provenanceBinding
            .surfaceTokenIds.includes(
              fixture.tokenId,
            ),
        "binding provenance lost",
      );
    },
  },

  {
    name:
      "G2.17 snapshot authority instance id object and hashes are preserved",

    run: async () => {
      const p = await ready(
        posFixture({
          labels: [
            "noun",
          ],
        }),
      );

      assert(
        p.snapshotAuthorityId.startsWith(
          `${CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1}:`,
        ) &&
          p.snapshotAuthority
              .authorityId ===
            p.snapshotAuthorityId &&
          p.snapshotAuthority
              .snapshotIdentityId ===
            p.snapshotIdentityId &&
          p.snapshotAuthority
              .snapshotSha256 ===
            p.snapshotSha256 &&
          p.snapshotAuthority
              .surfaceSnapshotSha256 ===
            p.surfaceSnapshotSha256 &&
          p.snapshotAuthority
              .graphStateSha256 ===
            p.graphStateSha256 &&
          p.snapshotAuthorityId.endsWith(
            p.snapshotSha256,
          ),
        "snapshot authority instance provenance lost",
      );
    },
  },

  {
    name: "G2.18 sourceReadId and normalizedProjectionId are preserved",

    run: async () => {
      const p = await ready(
        posFixture(),
      );

      assert(
        p.sourceReadId ===
            p.normalizedProjection
              .sourceReadId &&
          p.normalizedProjectionId ===
            p.normalizedProjection
              .projectionId &&
          p.governance
              .sourceReadIdentityPreserved ===
            true &&
          p.governance
              .normalizedProjectionIdentityPreserved ===
            true,
        "R/P2 identity reconstructed by G2",
      );
    },
  },

  {
    name: "G2.19 derivation is deterministic and read only",

    run: async () => {
      const fixture = posFixture({
        text: "Aa bb",

        statuses: [
          "candidate",
          "ambiguous",
        ],
      });

      const surfaceBefore = JSON.stringify(
        fixture.surface,
      );

      const graphBefore = JSON.stringify(
        fixture.graph,
      );

      const first = await resultFor(
        fixture,
      );

      const second = await resultFor(
        fixture,
      );

      assert(
        first.status ===
            "ready" &&
          second.status ===
            "ready" &&
          same(
            first,
            second,
          ),
        "G2 is not deterministic",
      );

      assert(
        JSON.stringify(
              fixture.surface,
            ) ===
            surfaceBefore &&
          JSON.stringify(
              fixture.graph,
            ) ===
            graphBefore,
        "G2 mutated inputs",
      );
    },
  },

  {
    name: "G2.20 governance owns ancestry snapshot-bound actual POS only",

    run: async () => {
      const g = (
        await ready(
          posFixture({
            statuses: [
              "candidate",
              "ambiguous",
            ],
          }),
        )
      ).governance;

      assert(
        g.exactSurfaceGraphProvenanceBindingRequired ===
            true &&
          g.provenanceBindingDerivedFromCapturedSurfaceAndGraph ===
            true &&
          g.provenanceBindingCheckedBeforePosPipeline ===
            true &&
          g.provenanceBindingRecheckedAfterPosPipeline ===
            true &&
          g.provenanceBindingStableAcrossProjection ===
            true &&
          g.sameCapturedSurfaceUsedForBindingAndSnapshotIdentity ===
            true &&
          g.sameCapturedGraphUsedForBindingSnapshotAndPosRead ===
            true &&
          g.surfaceGraphAncestryProven ===
            true &&
          g.exactSnapshotAuthorityRequired ===
            true &&
          g.canonicalPosOwnershipDerivedFromCapturedGraph ===
            true &&
          g.tokenPosPropertyCapabilityDerivedFromExactOwnership ===
            true &&
          g.exactPosOwnershipAuthorityRequired ===
            true &&
          g.exactTokenPosPropertyCapabilityRequired ===
            true &&
          g.posOwnershipBypassPerformed ===
            false &&
          g.tokenPosPropertyBypassPerformed ===
            false &&
          g.runtimeConsumed ===
            false &&
          g.manifestConsumed ===
            false &&
          g.whereSemanticsResolved ===
            false &&
          g.comparisonPerformed ===
            false &&
          g.comparisonTruthResolved ===
            false &&
          g.occurrenceFilteringPerformed ===
            false &&
          g.occurrenceBindingPerformed ===
            false &&
          g.cardinalityEnforcementPerformed ===
            false &&
          g.posWinnerSelected ===
            false &&
          g.graphMutationPerformed ===
            false &&
          g.learnerErrorClassified ===
            false,
        "G2 crossed authority ceiling",
      );
    },
  },
];

assert(
  tests.length ===
    20,
  "Golden must contain exact 20 cases",
);

for (
  const test of tests
) {
  Deno.test(
    test.name,
    test.run,
  );
}
