import {
  applyGraphPatchV1,
  type CanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  buildCanonicalSurfaceDocumentV1,
  type CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1,
  type CanonicalSentenceDirectTokenOccurrenceDomainV1,
  deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1,
} from "./canonical-sentence-direct-token-occurrence-domain-capability-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1,
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_VERSION_V1,
  type CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1,
  type CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-composition-v1.ts";

import {
  bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-snapshot-binding-v1.ts";

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
  return JSON.stringify(left) === JSON.stringify(right);
}

type Fixture = {
  surface: CanonicalSurfaceDocumentV1;
  graph: CanonicalLanguageGraphV1;
};

function fixture(
  text = "aa bb",
): Fixture {
  const surface = buildCanonicalSurfaceDocumentV1(text);

  return {
    surface,
    graph: createCanonicalLanguageGraphV1(surface),
  };
}

function exactGovernance() {
  return {
    exactA46b2ResultRequired: true,
    exactA46b2AuthorityRequired: true,
    exactManifestScopeCompatibilityResultRequired: true,
    exactManifestScopeCompatibilityAuthorityRequired: true,
    exactReferencedBindingIdentityRequired: true,
    ownerBindingExcludedFromScopeJoin: true,
    exactCanonicalSentenceBoundaryRequired: true,
    exactCanonicalTokenDomainResultRequired: true,
    exactCanonicalTokenDomainRequired: true,

    exactGraphDocumentIdentityPreserved: true,
    exactSentenceOccurrenceIdentityPreserved: true,
    sentenceIndexIsOccurrenceIdentity: false,
    sentenceIndexIsLocalityMetadataOnly: true,
    exactDirectTokenOccurrenceIdentityPreserved: true,
    exactContainmentEdgeIdentityPreserved: true,
    exactSentenceTokenIndexPreserved: true,
    exactTokenGraphStatusPreserved: true,

    rightOperandSnapshotPreserved: true,
    rightOperandSnapshotDetached: true,

    sentenceDomainCandidateProjected: true,
    oneCandidatePerSentenceOccurrence: true,
    zeroTokenOccurrencesPreserved: true,
    multipleTokenOccurrencesPreserved: true,

    currentRuntimeSentenceContextSelected: false,
    runtimeBindingOccurrenceDomainResolved: false,
    occurrenceWinnerSelected: false,
    occurrenceBindingPerformed: false,

    posHypothesesRead: false,
    posHypothesisSelected: false,

    rightOperandRead: false,
    rightOperandCompared: false,
    operatorSemanticsResolved: false,
    whereEvaluationPerformed: false,
    cardinalityEnforcementPerformed: false,

    containmentInferredFromSentenceIndex: false,

    graphMutationPerformed: false,
    learnerErrorClassified: false,

    candidateOnly: true,
    frozenGrammarReadOnly: true,
  } as const;
}

function candidateFromDomain(
  domain: CanonicalSentenceDirectTokenOccurrenceDomainV1,
  suffix = "0",
): CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1 {
  return {
    id: `fixture:referenced-domain:${suffix}:${domain.domainId}`,

    status: "candidate",

    tokenPosSuffixPropertyCompatibilityId: `fixture:token-pos:${suffix}`,

    leafRightOperandSiteAuthorityId: `fixture:leaf-site:${suffix}`,

    referencedBindingDefinitionAuthorityId: "fixture:binding-definition",

    manifestId: "fixture:manifest-id",

    manifestCode: "fixture_manifest",

    referencedBindingName: "token",

    runtimeSuffix: ".pos",

    canonicalNodeType: "token",

    manifestScopeCompatibilityId: "fixture:scope",

    runtimeScopeLabel: "sentence",

    canonicalBoundaryLabel: "sentence",

    canonicalBoundaryAuthorityId: `fixture:boundary:${domain.sentenceNodeId}`,

    canonicalTokenDomainId: domain.domainId,

    graphVersion: domain.graphVersion,

    graphDocumentId: domain.graphDocumentId,

    sentenceAuthorityId: domain.sentenceAuthorityId,

    sentenceNodeId: domain.sentenceNodeId,

    sentenceIndex: domain.sentenceIndex,

    boundaryCandidateId: domain.boundaryCandidateId,

    membershipModel: domain.membershipModel,

    occurrences: structuredClone(domain.occurrences),

    occurrenceCount: domain.occurrenceCount,

    rightOperandSnapshot: "NOUN",

    governance: exactGovernance(),
  };
}

function sourceResult(
  graph: CanonicalLanguageGraphV1,
  copiesPerDomain = 1,
): CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1 {
  const direct = deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
    graph,
  );

  assert(
    direct.producer ===
        CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1 &&
      direct.status === "ready" &&
      direct.blockingReasons.length === 0 &&
      direct.graphDocumentId === graph.documentId,
    "direct domain fixture is not ready",
  );

  const candidates = direct.domains.flatMap(
    (domain) =>
      Array.from(
        {
          length: copiesPerDomain,
        },
        (_, index) =>
          candidateFromDomain(
            domain,
            `${domain.sentenceIndex}:${index}`,
          ),
      ),
  );

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_VERSION_V1,

    status: "ready",

    graphDocumentId: graph.documentId,

    candidates,

    consideredCompatibilityCount: candidates.length,

    sentenceScopeCompatibleCount: candidates.length,

    unmappedReferencedScopeCompatibilityKeys: [],

    nonSentenceReferencedScopeCompatibilityKeys: [],

    blockingReasons: [],
  };
}

async function ready(
  f: Fixture,
  source = sourceResult(f.graph),
) {
  const result =
    await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
      f.surface,
      f.graph,
      source,
    );

  assert(
    result.status === "ready",
    `expected ready wrapper: ${JSON.stringify(result)}`,
  );

  return result;
}

function cloneSource(
  value:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1,
) {
  return structuredClone(
    value,
  ) as CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1;
}

const tests: Array<{
  name: string;
  run: () => Promise<void>;
}> = [
  {
    name: "SB.1 exact graph-local domain binds to snapshot",

    run: async () => {
      const f = fixture();

      const result = await ready(f);

      assert(
        result.candidateCount > 0 &&
          result.candidates.length ===
            result.candidateCount &&
          result.snapshotIdentityId.startsWith(
            "canonical-graph-snapshot:sha256:",
          ),
        "exact domain did not bind to snapshot",
      );
    },
  },

  {
    name: "SB.2 source candidate identity and object are preserved",

    run: async () => {
      const f = fixture();

      const source = sourceResult(f.graph);

      const result = await ready(
        f,
        source,
      );

      assert(
        result.sourceDomainResult ===
            source &&
          result.candidates[0]
              .sourceCandidate ===
            source.candidates[0] &&
          result.candidates[0]
              .sourceDomainCandidateId ===
            source.candidates[0].id,
        "source candidate provenance reconstructed",
      );
    },
  },

  {
    name:
      "SB.3 sentence occurrence identity is snapshot plus exact sentenceNodeId",

    run: async () => {
      const result = await ready(
        fixture(),
      );

      const candidate = result.candidates[0];

      assert(
        candidate
          .snapshotSentenceOccurrenceIdentityId
          .includes(
            encodeURIComponent(
              candidate.snapshotIdentityId,
            ).replaceAll("%", "_"),
          ) &&
          candidate
            .snapshotSentenceOccurrenceIdentityId
            .includes(
              encodeURIComponent(
                candidate.sentenceNodeId,
              ).replaceAll("%", "_"),
            ) &&
          candidate.governance
              .sentenceIndexIsOccurrenceIdentity ===
            false,
        "sentence snapshot identity contract failed",
      );
    },
  },

  {
    name: "SB.4 token occurrence identity is snapshot plus exact tokenNodeId",

    run: async () => {
      const result = await ready(
        fixture(),
      );

      const candidate = result.candidates[0];

      assert(
        candidate.occurrences.length >
          0,
        "fixture has no direct token occurrences",
      );

      for (
        const occurrence of candidate.occurrences
      ) {
        assert(
          occurrence
            .snapshotTokenOccurrenceIdentityId
            .includes(
              encodeURIComponent(
                candidate.snapshotIdentityId,
              ).replaceAll("%", "_"),
            ) &&
            occurrence
              .snapshotTokenOccurrenceIdentityId
              .includes(
                encodeURIComponent(
                  occurrence.tokenNodeId,
                ).replaceAll("%", "_"),
              ),
          "token snapshot occurrence identity failed",
        );
      }
    },
  },

  {
    name:
      "SB.5 independently rebuilt identical exact snapshot reproduces identities",

    run: async () => {
      const a = fixture("aa bb");

      const b = fixture("aa bb");

      assert(
        a.graph !== b.graph,
        "fixtures unexpectedly reuse graph object",
      );

      const ra = await ready(a);

      const rb = await ready(b);

      assert(
        ra.snapshotIdentityId ===
            rb.snapshotIdentityId &&
          same(
            ra.candidates.map(
              (candidate) => candidate.snapshotBoundDomainId,
            ),
            rb.candidates.map(
              (candidate) => candidate.snapshotBoundDomainId,
            ),
          ) &&
          same(
            ra.candidates.map(
              (candidate) =>
                candidate.occurrences.map(
                  (occurrence) =>
                    occurrence
                      .snapshotTokenOccurrenceIdentityId,
                ),
            ),
            rb.candidates.map(
              (candidate) =>
                candidate.occurrences.map(
                  (occurrence) =>
                    occurrence
                      .snapshotTokenOccurrenceIdentityId,
                ),
            ),
          ),
        "identical snapshot identities are not reproducible",
      );
    },
  },

  {
    name: "SB.6 same structural ids in different snapshots remain separated",

    run: async () => {
      const a = fixture("aa bb");

      const b = fixture("cc dd");

      assert(
        a.graph.documentId ===
          b.graph.documentId,
        "fixture lost intended document-id collision",
      );

      const sourceA = sourceResult(a.graph);

      const sourceB = sourceResult(b.graph);

      assert(
        sourceA.candidates[0]
              .sentenceNodeId ===
            sourceB.candidates[0]
              .sentenceNodeId &&
          sourceA.candidates[0]
              .occurrences[0]
              .tokenNodeId ===
            sourceB.candidates[0]
              .occurrences[0]
              .tokenNodeId,
        "fixture lost intended structural-id collision",
      );

      const ra = await ready(
        a,
        sourceA,
      );

      const rb = await ready(
        b,
        sourceB,
      );

      assert(
        ra.snapshotIdentityId !==
            rb.snapshotIdentityId &&
          ra.candidates[0]
              .snapshotSentenceOccurrenceIdentityId !==
            rb.candidates[0]
              .snapshotSentenceOccurrenceIdentityId &&
          ra.candidates[0]
              .occurrences[0]
              .snapshotTokenOccurrenceIdentityId !==
            rb.candidates[0]
              .occurrences[0]
              .snapshotTokenOccurrenceIdentityId,
        "cross-snapshot structural collision was not separated",
      );
    },
  },

  {
    name: "SB.7 cross surface and graph pair blocks before domain rebinding",

    run: async () => {
      const a = fixture("aa bb");

      const b = fixture("cc dd");

      const result =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          a.surface,
          b.graph,
          sourceResult(b.graph),
        );

      assert(
        result.status ===
            "blocked" &&
          result.blockingReasons.some(
            (reason) =>
              reason.startsWith(
                "surface_graph_provenance_binding_before:",
              ),
          ),
        "cross surface/graph pair escaped ancestry gate",
      );
    },
  },

  {
    name:
      "SB.8 non-surface enrichment preserves ancestry but creates new snapshot identity",

    run: async () => {
      const base = fixture();

      const baseResult = await ready(base);

      const enrichedGraph = applyGraphPatchV1(
        base.graph,
        {
          producer: "snapshot-binding-golden-enrichment",

          producerVersion: "1",

          nodes: [
            {
              id: "semantic:snapshot-binding-golden",

              type: "semantic_unit",

              status: "candidate",

              features: {
                golden: true,
              },

              producer: "snapshot-binding-golden-enrichment",

              evidenceIds: [],

              provenanceIds: [],
            },
          ],
        },
      );

      const enriched = {
        surface: base.surface,

        graph: enrichedGraph,
      };

      const enrichedResult = await ready(
        enriched,
        sourceResult(
          enrichedGraph,
        ),
      );

      assert(
        baseResult.snapshotIdentityId !==
            enrichedResult.snapshotIdentityId &&
          baseResult.graphDocumentId ===
            enrichedResult.graphDocumentId &&
          enrichedResult.provenanceBinding
              .governance
              .laterNonSurfaceGraphEnrichmentAllowed ===
            true,
        "enrichment snapshot separation failed",
      );
    },
  },

  {
    name: "SB.9 canonical domain id mismatch blocks fail closed",

    run: async () => {
      const f = fixture();

      const source = cloneSource(
        sourceResult(
          f.graph,
        ),
      );

      source.candidates[0]
        .canonicalTokenDomainId += ":stale";

      const result =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      assert(
        result.status ===
            "blocked" &&
          result.blockingReasons.some(
            (reason) =>
              reason.includes(
                "canonical_domain_missing",
              ),
          ),
        "stale canonical domain id accepted",
      );
    },
  },

  {
    name: "SB.10 sentenceNodeId content mismatch blocks fail closed",

    run: async () => {
      const f = fixture();

      const source = cloneSource(
        sourceResult(
          f.graph,
        ),
      );

      source.candidates[0]
        .sentenceNodeId += ":stale";

      const result =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      assert(
        result.status ===
            "blocked" &&
          result.blockingReasons.some(
            (reason) =>
              reason.includes(
                "canonical_domain_content_mismatch",
              ),
          ),
        "sentence mismatch accepted",
      );
    },
  },

  {
    name: "SB.11 tokenNodeId occurrence mismatch blocks fail closed",

    run: async () => {
      const f = fixture();

      const source = cloneSource(
        sourceResult(
          f.graph,
        ),
      );

      assert(
        source.candidates[0]
          .occurrences.length >
          0,
        "fixture occurrence missing",
      );

      source.candidates[0]
        .occurrences[0]
        .tokenNodeId += ":stale";

      const result =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      assert(
        result.status ===
            "blocked" &&
          result.blockingReasons.some(
            (reason) =>
              reason.includes(
                "canonical_domain_content_mismatch",
              ),
          ),
        "token occurrence mismatch accepted",
      );
    },
  },

  {
    name: "SB.12 containment edge mismatch blocks fail closed",

    run: async () => {
      const f = fixture();

      const source = cloneSource(
        sourceResult(
          f.graph,
        ),
      );

      source.candidates[0]
        .occurrences[0]
        .containmentEdgeId += ":stale";

      const result =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      assert(
        result.status ===
            "blocked" &&
          result.blockingReasons.some(
            (reason) =>
              reason.includes(
                "canonical_domain_content_mismatch",
              ),
          ),
        "containment identity mismatch accepted",
      );
    },
  },

  {
    name: "SB.13 sentenceTokenIndex mismatch blocks fail closed",

    run: async () => {
      const f = fixture();

      const source = cloneSource(
        sourceResult(
          f.graph,
        ),
      );

      source.candidates[0]
        .occurrences[0]
        .sentenceTokenIndex += 1;

      const result =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      assert(
        result.status ===
          "blocked",
        "sentence token index mismatch accepted",
      );
    },
  },

  {
    name: "SB.14 stale source producer blocks fail closed",

    run: async () => {
      const f = fixture();

      const source = {
        ...sourceResult(
          f.graph,
        ),

        producer: "stale-producer" as never,
      };

      const result =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      assert(
        result.status ===
            "blocked" &&
          result.blockingReasons.includes(
            "referenced_token_sentence_domain_result:not_exact_ready",
          ),
        "stale source producer accepted",
      );
    },
  },

  {
    name: "SB.15 blocked source result blocks fail closed",

    run: async () => {
      const f = fixture();

      const source = {
        ...sourceResult(
          f.graph,
        ),

        status: "blocked" as const,

        blockingReasons: [
          "fixture:block",
        ],
      };

      const result =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      assert(
        result.status ===
          "blocked",
        "blocked source result accepted",
      );
    },
  },

  {
    name: "SB.16 duplicate source candidate id blocks fail closed",

    run: async () => {
      const f = fixture();

      const source = sourceResult(
        f.graph,
        2,
      );

      assert(
        source.candidates.length >=
          2,
        "duplicate-id fixture unavailable",
      );

      source.candidates[1] = {
        ...source.candidates[1],

        id: source.candidates[0].id,
      };

      const result =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      assert(
        result.status ===
            "blocked" &&
          result.blockingReasons.includes(
            "referenced_token_sentence_domain_result:not_exact_ready",
          ),
        "duplicate candidate identity accepted",
      );
    },
  },

  {
    name: "SB.17 zero referenced candidates remain ready zero candidates",

    run: async () => {
      const f = fixture();

      const source = sourceResult(
        f.graph,
      );

      source.candidates = [];

      source.consideredCompatibilityCount = 0;

      source.sentenceScopeCompatibleCount = 0;

      const result = await ready(
        f,
        source,
      );

      assert(
        result.candidateCount ===
            0 &&
          result.candidates.length ===
            0,
        "zero candidate set changed semantics",
      );
    },
  },

  {
    name: "SB.18 candidate order and multiplicity are preserved",

    run: async () => {
      const f = fixture();

      const source = sourceResult(
        f.graph,
        2,
      );

      const result = await ready(
        f,
        source,
      );

      assert(
        result.candidates.length ===
            source.candidates.length &&
          same(
            result.candidates.map(
              (candidate) => candidate.sourceDomainCandidateId,
            ),
            source.candidates.map(
              (candidate) => candidate.id,
            ),
          ),
        "candidate order/multiplicity changed",
      );
    },
  },

  {
    name: "SB.19 derivation is deterministic and read only",

    run: async () => {
      const f = fixture();

      const source = sourceResult(
        f.graph,
      );

      const surfaceBefore = JSON.stringify(
        f.surface,
      );

      const graphBefore = JSON.stringify(
        f.graph,
      );

      const sourceBefore = JSON.stringify(
        source,
      );

      const first =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      const second =
        await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
          f.surface,
          f.graph,
          source,
        );

      assert(
        same(
          first,
          second,
        ) &&
          JSON.stringify(
              f.surface,
            ) ===
            surfaceBefore &&
          JSON.stringify(
              f.graph,
            ) ===
            graphBefore &&
          JSON.stringify(
              source,
            ) ===
            sourceBefore,
        "wrapper is not deterministic/read-only",
      );
    },
  },

  {
    name:
      "SB.20 authority ceiling excludes applicability comparison truth cardinality and binding",

    run: async () => {
      const result = await ready(
        fixture(),
      );

      const g = result.governance;

      assert(
        g.exactSurfaceGraphProvenanceBindingRequired ===
            true &&
          g.provenanceBindingCheckedBeforeDomainProjection ===
            true &&
          g.provenanceBindingRecheckedAfterDomainProjection ===
            true &&
          g.provenanceBindingStableAcrossProjection ===
            true &&
          g.exactSnapshotAuthorityRequired ===
            true &&
          g.snapshotIdentityCheckedBeforeDomainProjection ===
            true &&
          g.snapshotIdentityRecheckedAfterDomainProjection ===
            true &&
          g.snapshotIdentityStableAcrossProjection ===
            true &&
          g.exactCanonicalDirectTokenDomainsRecomputedFromCapturedGraph ===
            true &&
          g.allReferencedDomainCandidatesValidatedAgainstRecomputedDomains ===
            true &&
          g.graphDocumentIdUsedAsSnapshotIdentity ===
            false &&
          g.sentenceIndexIsOccurrenceIdentity ===
            false &&
          g.tokenNodeIdAloneUsedAsGlobalOccurrenceIdentity ===
            false &&
          g.runtimeSiteApplicabilityResolved ===
            false &&
          g.runtimeBindingOccurrenceDomainResolved ===
            false &&
          g.currentRuntimeSentenceContextSelected ===
            false &&
          g.occurrenceFilteringPerformed ===
            false &&
          g.occurrenceWinnerSelected ===
            false &&
          g.occurrenceBindingPerformed ===
            false &&
          g.posHypothesesRead ===
            false &&
          g.posComparisonPerformed ===
            false &&
          g.comparisonTruthResolved ===
            false &&
          g.booleanTruthProduced ===
            false &&
          g.cardinalitySemanticsResolved ===
            false &&
          g.cardinalityEnforcementPerformed ===
            false &&
          g.graphMutationPerformed ===
            false &&
          g.learnerErrorClassified ===
            false &&
          g.frozenGrammarReadOnly ===
            true,
        "wrapper crossed authority ceiling",
      );
    },
  },
];

assert(
  tests.length ===
    20,
  "snapshot-binding Golden must contain exactly 20 cases",
);

for (
  const test of tests
) {
  Deno.test(
    test.name,
    test.run,
  );
}
