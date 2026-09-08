import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2,
  type CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2,
} from "./canonical-token-pos-normalized-label-comparison-evidence-v2.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1,
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1,
  type CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-snapshot-binding-v1.ts";

import {
  deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";

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

type Site = {
  tokenPosSuffixPropertyCompatibilityId: string;
  leafRightOperandSiteAuthorityId: string;
  referencedBindingDefinitionAuthorityId: string;
  manifestId: string;
  manifestCode: string;
  referencedBindingName: string;
  runtimeSuffix: string;
  canonicalNodeType: string;
};

type OccurrenceSpec = {
  tokenNodeId: string;
  containmentEdgeId?: string;
  sentenceTokenIndex?: number;
  graphStatus?: string;
  snapshotTokenOccurrenceIdentityId?: string;
};

type DomainSpec = {
  snapshotBoundDomainId?: string;
  sourceDomainCandidateId?: string;
  sentenceNodeId?: string;
  sentenceIndex?: number;
  canonicalTokenDomainId?: string;
  site?: Partial<Site>;
  occurrences?: OccurrenceSpec[];
};

const BASE_SITE: Site = {
  tokenPosSuffixPropertyCompatibilityId: "fixture:token-pos-compatibility",

  leafRightOperandSiteAuthorityId: "fixture:leaf-site",

  referencedBindingDefinitionAuthorityId: "fixture:binding-definition",

  manifestId: "fixture:manifest-id",

  manifestCode: "fixture_manifest",

  referencedBindingName: "tokenRef",

  runtimeSuffix: ".pos",

  canonicalNodeType: "token",
};

function c2Governance() {
  return {
    exactGraphBoundActualProjectionRequired: true,

    exactExpectedNormalizedLabelAuthorityRequired: true,

    exactSemanticCapabilityRequired: true,

    actualGraphBoundProjectionObjectPreservedWithoutReconstruction: true,

    expectedAuthorityObjectPreservedWithoutReconstruction: true,

    normalizedActualLabelsConsumedNotReconstructed: true,

    normalizedExpectedLabelConsumedNotReconstructed: true,

    exactStringEqualityExecutedPerMember: true,

    comparisonExecuted: true,

    comparisonEvidenceStateProduced: true,

    comparisonEvidenceStateIsBooleanTruth: false,

    actualMemberIdentityPreserved: true,

    actualMemberStatusPreserved: true,

    actualMemberMultiplicityPreserved: true,

    actualMemberOrderPreserved: true,

    pairingSuppliedByCaller: true,

    runtimeSiteApplicabilityResolved: false,

    runtimeBindingPerformed: false,

    sentenceDomainConsumed: false,

    occurrenceFilteringPerformed: false,

    occurrenceBindingPerformed: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforcementPerformed: false,

    booleanTruthProduced: false,

    comparisonTruthResolved: false,

    runtimeConditionTruthResolved: false,

    posWinnerSelected: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    frozenGrammarReadOnly: true,
  } as const;
}

function domainCandidateGovernance() {
  return {
    exactReferencedTokenSentenceDomainResultRequired: true,

    exactReferencedTokenSentenceDomainCandidateRequired: true,

    exactCapturedSurfaceRequired: true,

    exactCapturedGraphRequired: true,

    exactSurfaceGraphProvenanceBindingRequired: true,

    exactSnapshotAuthorityRequired: true,

    exactCanonicalDirectTokenDomainsRecomputedFromCapturedGraph: true,

    exactCanonicalTokenDomainIdentityRequired: true,

    exactSentenceOccurrenceIdentityPreserved: true,

    exactDirectTokenOccurrenceContentRequired: true,

    exactContainmentEdgeIdentityPreserved: true,

    exactSentenceTokenIndexPreserved: true,

    exactTokenGraphStatusPreserved: true,

    occurrenceOrderPreserved: true,

    occurrenceMultiplicityPreserved: true,

    sourceCandidateObjectPreservedWithoutReconstruction: true,

    snapshotSentenceOccurrenceIdentityProduced: true,

    snapshotTokenOccurrenceIdentityProduced: true,

    snapshotIdentityAndSentenceNodeIdFormDomainOccurrenceIdentity: true,

    snapshotIdentityAndTokenNodeIdFormTokenOccurrenceIdentity: true,

    graphDocumentIdUsedAsSnapshotIdentity: false,

    sentenceIndexIsOccurrenceIdentity: false,

    tokenNodeIdAloneUsedAsGlobalOccurrenceIdentity: false,

    runtimeBindingOccurrenceDomainResolved: false,

    currentRuntimeSentenceContextSelected: false,

    occurrenceFilteringPerformed: false,

    occurrenceWinnerSelected: false,

    occurrenceBindingPerformed: false,

    posComparisonPerformed: false,

    comparisonTruthResolved: false,

    booleanTruthProduced: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforcementPerformed: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    frozenGrammarReadOnly: true,
  } as const;
}

function domainResultGovernance() {
  return {
    exactReferencedTokenSentenceDomainResultRequired: true,

    sourceDomainResultObjectPreservedWithoutReconstruction: true,

    exactCapturedSurfaceRequired: true,

    exactCapturedGraphRequired: true,

    exactSurfaceGraphProvenanceBindingRequired: true,

    provenanceBindingDerivedFromCapturedSurfaceAndGraph: true,

    provenanceBindingCheckedBeforeDomainProjection: true,

    provenanceBindingRecheckedAfterDomainProjection: true,

    provenanceBindingStableAcrossProjection: true,

    exactSnapshotAuthorityRequired: true,

    snapshotIdentityCheckedBeforeDomainProjection: true,

    snapshotIdentityRecheckedAfterDomainProjection: true,

    snapshotIdentityStableAcrossProjection: true,

    exactCanonicalDirectTokenDomainsRecomputedFromCapturedGraph: true,

    allReferencedDomainCandidatesValidatedAgainstRecomputedDomains: true,

    graphDocumentIdPreservedAsProvenance: true,

    graphDocumentIdUsedAsSnapshotIdentity: false,

    sentenceNodeIdPreservedAsGraphLocalOccurrenceIdentity: true,

    sentenceIndexIsOccurrenceIdentity: false,

    tokenNodeIdAloneUsedAsGlobalOccurrenceIdentity: false,

    snapshotSentenceOccurrenceIdentityProduced: true,

    snapshotTokenOccurrenceIdentityProduced: true,

    runtimeSiteApplicabilityResolved: false,

    runtimeBindingOccurrenceDomainResolved: false,

    currentRuntimeSentenceContextSelected: false,

    occurrenceFilteringPerformed: false,

    occurrenceWinnerSelected: false,

    occurrenceBindingPerformed: false,

    posComparisonPerformed: false,

    comparisonTruthResolved: false,

    booleanTruthProduced: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforcementPerformed: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    frozenGrammarReadOnly: true,
  } as const;
}

function makeC2(
  options: {
    snapshotIdentityId?: string;
    snapshotSha256?: string;
    surfaceSnapshotSha256?: string;
    graphStateSha256?: string;
    graphDocumentId?: string;
    tokenNodeId?: string;
    graphOccurrenceId?: string;
    site?: Partial<Site>;
    producer?: string;
  } = {},
): CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2 {
  const snapshotIdentityId = options.snapshotIdentityId ??
    "canonical-graph-snapshot:sha256:fixture-snapshot";

  const snapshotSha256 = options.snapshotSha256 ??
    "fixture-snapshot";

  const surfaceSnapshotSha256 = options.surfaceSnapshotSha256 ??
    "fixture-surface";

  const graphStateSha256 = options.graphStateSha256 ??
    "fixture-graph";

  const graphDocumentId = options.graphDocumentId ??
    "document:0:0:5";

  const tokenNodeId = options.tokenNodeId ??
    "tok:0:0:2";

  const site = {
    ...BASE_SITE,
    ...options.site,
  };

  const expected = {
    id: "fixture:expected-authority",

    status: "candidate",

    tokenPosSuffixPropertyCompatibilityId:
      site.tokenPosSuffixPropertyCompatibilityId,

    leafRightOperandSiteAuthorityId: site.leafRightOperandSiteAuthorityId,

    referencedBindingDefinitionAuthorityId:
      site.referencedBindingDefinitionAuthorityId,

    manifestId: site.manifestId,

    manifestCode: site.manifestCode,

    referencedBindingName: site.referencedBindingName,

    runtimeSuffix: site.runtimeSuffix,

    canonicalNodeType: site.canonicalNodeType,
  };

  const actual = {
    snapshotIdentityId,
    snapshotSha256,
    surfaceSnapshotSha256,
    graphStateSha256,
    graphDocumentId,
    tokenNodeId,

    graphTokenOccurrenceIdentityId: options.graphOccurrenceId ??
      `fixture:g2-occurrence:${snapshotSha256}:${tokenNodeId}`,
  };

  return {
    producer: (
      options.producer ??
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2
    ) as typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2,

    producerVersion:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2,

    status: "ready",

    evidence: {
      comparisonEvidenceId: "fixture:c2-comparison",

      status: "candidate",

      actualSnapshotIdentityId: snapshotIdentityId,

      actualSnapshotSha256: snapshotSha256,

      actualGraphDocumentId: graphDocumentId,

      actualTokenNodeId: tokenNodeId,

      actualGraphTokenOccurrenceIdentityId:
        actual.graphTokenOccurrenceIdentityId,

      expectedAuthorityId: expected.id,

      actualGraphBoundProjection: actual,

      expectedAuthority: expected,

      governance: c2Governance(),
    },

    blockingReasons: [],
  } as unknown as CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2;
}

function makeDomain(
  options: {
    snapshotIdentityId?: string;
    snapshotSha256?: string;
    surfaceSnapshotSha256?: string;
    graphStateSha256?: string;
    graphDocumentId?: string;
    domains?: DomainSpec[];
    producer?: string;
  } = {},
): CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1 {
  const snapshotIdentityId = options.snapshotIdentityId ??
    "canonical-graph-snapshot:sha256:fixture-snapshot";

  const snapshotSha256 = options.snapshotSha256 ??
    "fixture-snapshot";

  const surfaceSnapshotSha256 = options.surfaceSnapshotSha256 ??
    "fixture-surface";

  const graphStateSha256 = options.graphStateSha256 ??
    "fixture-graph";

  const graphDocumentId = options.graphDocumentId ??
    "document:0:0:5";

  const specs = options.domains ??
    [
      {
        snapshotBoundDomainId: "fixture:snapshot-domain:1",

        sourceDomainCandidateId: "fixture:source-domain:1",

        sentenceNodeId: "sentence:0:0:5",

        sentenceIndex: 0,

        canonicalTokenDomainId: "fixture:canonical-domain:1",

        occurrences: [
          {
            tokenNodeId: "tok:0:0:2",

            containmentEdgeId: "edge:sentence-token:1",

            sentenceTokenIndex: 0,

            graphStatus: "resolved",

            snapshotTokenOccurrenceIdentityId:
              "fixture:domain-occurrence:tok-1",
          },
        ],
      },
    ];

  const sourceCandidates: Record<string, unknown>[] = [];

  const candidates = specs.map(
    (
      spec,
      index,
    ) => {
      const site = {
        ...BASE_SITE,
        ...(spec.site ?? {}),
      };

      const sourceDomainCandidateId = spec.sourceDomainCandidateId ??
        `fixture:source-domain:${index}`;

      const snapshotBoundDomainId = spec.snapshotBoundDomainId ??
        `fixture:snapshot-domain:${index}`;

      const sentenceNodeId = spec.sentenceNodeId ??
        `sentence:${index}`;

      const sentenceIndex = spec.sentenceIndex ??
        index;

      const canonicalTokenDomainId = spec.canonicalTokenDomainId ??
        `fixture:canonical-domain:${index}`;

      const sourceCandidate = {
        id: sourceDomainCandidateId,

        graphDocumentId,

        canonicalTokenDomainId,

        sentenceNodeId,

        sentenceIndex,

        tokenPosSuffixPropertyCompatibilityId:
          site.tokenPosSuffixPropertyCompatibilityId,

        leafRightOperandSiteAuthorityId: site.leafRightOperandSiteAuthorityId,

        referencedBindingDefinitionAuthorityId:
          site.referencedBindingDefinitionAuthorityId,

        manifestId: site.manifestId,

        manifestCode: site.manifestCode,

        referencedBindingName: site.referencedBindingName,

        runtimeSuffix: site.runtimeSuffix,

        canonicalNodeType: site.canonicalNodeType,
      };

      sourceCandidates.push(
        sourceCandidate,
      );

      const occurrenceSpecs = spec.occurrences ??
        [];

      const occurrences = occurrenceSpecs.map(
        (
          occurrence,
          occurrenceIndex,
        ) => ({
          tokenNodeId: occurrence.tokenNodeId,

          containmentEdgeId: occurrence.containmentEdgeId ??
            `fixture:edge:${index}:${occurrenceIndex}`,

          sentenceTokenIndex: occurrence.sentenceTokenIndex ??
            occurrenceIndex,

          graphStatus: occurrence.graphStatus ??
            "resolved",

          snapshotTokenOccurrenceIdentityId:
            occurrence.snapshotTokenOccurrenceIdentityId ??
              `fixture:snapshot-occurrence:${index}:${occurrenceIndex}`,
        }),
      );

      return {
        snapshotBoundDomainId,

        status: "candidate",

        sourceDomainCandidateId,

        snapshotAuthorityId: "fixture:snapshot-authority-instance",

        snapshotIdentityId,

        snapshotSha256,

        surfaceSnapshotSha256,

        graphStateSha256,

        graphVersion: "canonical-language-graph-v1",

        graphDocumentId,

        canonicalTokenDomainId,

        sentenceNodeId,

        sentenceIndex,

        snapshotSentenceOccurrenceIdentityId:
          `fixture:snapshot-sentence:${index}`,

        occurrenceCount: occurrences.length,

        occurrences,

        sourceCandidate,

        governance: domainCandidateGovernance(),
      };
    },
  );

  const result = {
    producer: (
      options.producer ??
        CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1
    ) as typeof CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1,

    status: "ready",

    provenanceBindingAuthorityId: "fixture:provenance-binding",

    snapshotAuthorityId: "fixture:snapshot-authority-instance",

    snapshotIdentityId,

    snapshotSha256,

    surfaceSnapshotSha256,

    graphStateSha256,

    graphDocumentId,

    sourceDomainResult: {
      candidates: sourceCandidates,
    },

    candidates,

    candidateCount: candidates.length,

    blockingReasons: [],

    governance: domainResultGovernance(),
  };

  return result as unknown as CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1;
}

function readyEvidence(
  c2: CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2,
  domain:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1,
) {
  const result =
    deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
      c2,
      domain,
    );

  assert(
    result.status ===
        "ready" &&
      result.evidence,
    `expected ready D2a result: ${JSON.stringify(result)}`,
  );

  return result.evidence;
}

Deno.test(
  "D2a.1 exact site snapshot and token produces unique match evidence",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain(),
    );

    assert(
      evidence.applicabilityState ===
          "unique_site_snapshot_token_occurrence_match" &&
        evidence.siteMatchingDomainCount ===
          1 &&
        evidence.exactSiteSnapshotTokenOccurrenceMatchCount ===
          1,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.2 same snapshot with no exact site tuple remains no_matching_site_domain",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain({
        domains: [
          {
            site: {
              leafRightOperandSiteAuthorityId: "fixture:different-leaf-site",
            },

            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",
              },
            ],
          },
        ],
      }),
    );

    assert(
      evidence.applicabilityState ===
          "no_matching_site_domain" &&
        evidence.siteMatchingDomainCount ===
          0 &&
        evidence.exactSiteSnapshotTokenOccurrenceMatchCount ===
          0,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.3 exact site without target token remains matching_site_domain_no_token_occurrence",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain({
        domains: [
          {
            occurrences: [
              {
                tokenNodeId: "tok:1:3:5",
              },
            ],
          },
        ],
      }),
    );

    assert(
      evidence.applicabilityState ===
          "matching_site_domain_no_token_occurrence" &&
        evidence.siteMatchingDomainCount ===
          1 &&
        evidence.exactSiteSnapshotTokenOccurrenceMatchCount ===
          0,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.4 multiple exact site snapshot token pairs remain multiple matches with no winner",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain({
        domains: [
          {
            snapshotBoundDomainId: "fixture:snapshot-domain:a",

            sourceDomainCandidateId: "fixture:source-domain:a",

            sentenceNodeId: "sentence:a",

            canonicalTokenDomainId: "fixture:canonical-domain:a",

            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",
              },
            ],
          },

          {
            snapshotBoundDomainId: "fixture:snapshot-domain:b",

            sourceDomainCandidateId: "fixture:source-domain:b",

            sentenceNodeId: "sentence:b",

            sentenceIndex: 1,

            canonicalTokenDomainId: "fixture:canonical-domain:b",

            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",
              },
            ],
          },
        ],
      }),
    );

    assert(
      evidence.applicabilityState ===
          "multiple_site_snapshot_token_occurrence_matches" &&
        evidence.siteMatchingDomainCount ===
          2 &&
        evidence.exactSiteSnapshotTokenOccurrenceMatchCount ===
          2 &&
        evidence.matchingPairEvidenceIds.length ===
          2,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.5 snapshot mismatch blocks rather than creating negative applicability evidence",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        makeC2({
          snapshotIdentityId: "canonical-graph-snapshot:sha256:snapshot-a",

          snapshotSha256: "snapshot-a",
        }),
        makeDomain({
          snapshotIdentityId: "canonical-graph-snapshot:sha256:snapshot-b",

          snapshotSha256: "snapshot-b",
        }),
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "snapshot_composition:not_exact_same_snapshot",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2a.6 same graphDocumentId across different snapshots cannot join",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        makeC2({
          graphDocumentId: "document:0:0:5",

          snapshotIdentityId: "canonical-graph-snapshot:sha256:surface-aa",

          snapshotSha256: "surface-aa",
        }),
        makeDomain({
          graphDocumentId: "document:0:0:5",

          snapshotIdentityId: "canonical-graph-snapshot:sha256:surface-cc",

          snapshotSha256: "surface-cc",
        }),
      );

    assert(
      result.status ===
        "blocked",
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2a.7 same tokenNodeId across different snapshots cannot join",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        makeC2({
          tokenNodeId: "tok:0:0:2",

          snapshotIdentityId: "canonical-graph-snapshot:sha256:a",

          snapshotSha256: "a",
        }),
        makeDomain({
          snapshotIdentityId: "canonical-graph-snapshot:sha256:b",

          snapshotSha256: "b",

          domains: [
            {
              occurrences: [
                {
                  tokenNodeId: "tok:0:0:2",
                },
              ],
            },
          ],
        }),
      );

    assert(
      result.status ===
        "blocked",
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2a.8 leaf site match cannot bypass tokenPos compatibility mismatch",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain({
        domains: [
          {
            site: {
              tokenPosSuffixPropertyCompatibilityId:
                "fixture:different-token-pos-compatibility",
            },

            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",
              },
            ],
          },
        ],
      }),
    );

    assert(
      evidence.applicabilityState ===
          "no_matching_site_domain" &&
        evidence.pairEvidence[0]
            .siteIdentityFieldMatches
            .leafRightOperandSiteAuthorityId ===
          true &&
        evidence.pairEvidence[0]
            .siteIdentityFieldMatches
            .tokenPosSuffixPropertyCompatibilityId ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.9 referenced binding authority mismatch prevents site match",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain({
        domains: [
          {
            site: {
              referencedBindingDefinitionAuthorityId:
                "fixture:different-binding",
            },

            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",
              },
            ],
          },
        ],
      }),
    );

    assert(
      evidence.applicabilityState ===
        "no_matching_site_domain",
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.10 manifestId mismatch prevents site match",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain({
        domains: [
          {
            site: {
              manifestId: "fixture:different-manifest-id",
            },

            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",
              },
            ],
          },
        ],
      }),
    );

    assert(
      evidence.applicabilityState ===
        "no_matching_site_domain",
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.11 manifestCode mismatch prevents site match",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain({
        domains: [
          {
            site: {
              manifestCode: "fixture_other_manifest",
            },

            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",
              },
            ],
          },
        ],
      }),
    );

    assert(
      evidence.applicabilityState ===
        "no_matching_site_domain",
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.12 referenced binding name mismatch prevents site match",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain({
        domains: [
          {
            site: {
              referencedBindingName: "otherRef",
            },

            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",
              },
            ],
          },
        ],
      }),
    );

    assert(
      evidence.applicabilityState ===
        "no_matching_site_domain",
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.13 invalid runtime suffix contract blocks fail closed",
  () => {
    const domain = makeDomain({
      domains: [
        {
          site: {
            runtimeSuffix: ".morph",
          },

          occurrences: [
            {
              tokenNodeId: "tok:0:0:2",
            },
          ],
        },
      ],
    });

    const result =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        makeC2(),
        domain,
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "snapshot_bound_domain:not_exact_ready",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2a.14 site-domain candidate order is preserved",
  () => {
    const domain = makeDomain({
      domains: [
        {
          snapshotBoundDomainId: "fixture:domain:first",

          sourceDomainCandidateId: "fixture:source:first",

          sentenceNodeId: "sentence:first",

          canonicalTokenDomainId: "fixture:canonical:first",

          occurrences: [
            {
              tokenNodeId: "tok:9",
            },
          ],
        },

        {
          snapshotBoundDomainId: "fixture:domain:second",

          sourceDomainCandidateId: "fixture:source:second",

          sentenceNodeId: "sentence:second",

          sentenceIndex: 1,

          canonicalTokenDomainId: "fixture:canonical:second",

          occurrences: [
            {
              tokenNodeId: "tok:0:0:2",
            },
          ],
        },
      ],
    });

    const evidence = readyEvidence(
      makeC2(),
      domain,
    );

    const input = domain.status ===
        "ready"
      ? domain.candidates
      : [];

    assert(
      same(
        evidence.pairEvidence.map(
          (pair) => pair.snapshotBoundDomainId,
        ),
        input.map(
          (candidate) => candidate.snapshotBoundDomainId,
        ),
      ),
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.15 matching occurrence order and multiplicity are preserved",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain({
        domains: [
          {
            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",

                containmentEdgeId: "edge:first",

                sentenceTokenIndex: 0,

                snapshotTokenOccurrenceIdentityId: "snapshot-occurrence:first",
              },

              {
                tokenNodeId: "tok:other",

                containmentEdgeId: "edge:middle",

                sentenceTokenIndex: 1,
              },

              {
                tokenNodeId: "tok:0:0:2",

                containmentEdgeId: "edge:last",

                sentenceTokenIndex: 2,

                snapshotTokenOccurrenceIdentityId: "snapshot-occurrence:last",
              },
            ],
          },
        ],
      }),
    );

    const matches = evidence.pairEvidence[0]
      .matchingTokenOccurrences;

    assert(
      evidence.applicabilityState ===
          "multiple_site_snapshot_token_occurrence_matches" &&
        matches.length ===
          2 &&
        matches[0]
            .containmentEdgeId ===
          "edge:first" &&
        matches[1]
            .containmentEdgeId ===
          "edge:last",
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.16 opaque C2 and domain occurrence ids need not be string equal",
  () => {
    const evidence = readyEvidence(
      makeC2({
        graphOccurrenceId: "g2:opaque:namespace:a",
      }),
      makeDomain({
        domains: [
          {
            occurrences: [
              {
                tokenNodeId: "tok:0:0:2",

                snapshotTokenOccurrenceIdentityId:
                  "snapshot-domain:opaque:namespace:b",
              },
            ],
          },
        ],
      }),
    );

    assert(
      evidence.applicabilityState ===
          "unique_site_snapshot_token_occurrence_match" &&
        evidence.actualGraphTokenOccurrenceIdentityId !==
          evidence.pairEvidence[0]
            .matchingTokenOccurrences[0]
            .snapshotTokenOccurrenceIdentityId,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2a.17 stale non-exact C2 result blocks",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        makeC2({
          producer: "fixture:stale-c2-producer",
        }),
        makeDomain(),
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "c2_comparison_evidence:not_exact_ready",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2a.18 stale non-exact snapshot-domain result blocks",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        makeC2(),
        makeDomain({
          producer: "fixture:stale-domain-producer",
        }),
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "snapshot_bound_domain:not_exact_ready",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2a.19 derivation is deterministic and read only",
  () => {
    const c2 = makeC2();

    const domain = makeDomain();

    const c2Before = JSON.stringify(c2);

    const domainBefore = JSON.stringify(domain);

    const first =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        c2,
        domain,
      );

    const second =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        c2,
        domain,
      );

    assert(
      same(
        first,
        second,
      ) &&
        JSON.stringify(c2) ===
          c2Before &&
        JSON.stringify(domain) ===
          domainBefore,
      JSON.stringify(first),
    );
  },
);

Deno.test(
  "D2a.20 authority ceiling excludes context filtering winner binding truth cardinality and learner error",
  () => {
    const evidence = readyEvidence(
      makeC2(),
      makeDomain(),
    );

    const g = evidence.governance;

    assert(
      g.exactC2ComparisonEvidenceRequired ===
          true &&
        g.exactSnapshotBoundDomainResultRequired ===
          true &&
        g.exactSharedSiteTupleRequired ===
          true &&
        g.exactLeafSiteAnchorRequired ===
          true &&
        g.allSharedSiteProvenanceFieldsCompared ===
          true &&
        g.exactSnapshotIdentityEqualityRequired ===
          true &&
        g.exactSnapshotShaEqualityRequired ===
          true &&
        g.exactGraphStateShaEqualityRequired ===
          true &&
        g.exactSurfaceSnapshotShaEqualityRequired ===
          true &&
        g.graphDocumentIdConsistencyRequired ===
          true &&
        g.graphDocumentIdUsedAsSnapshotIdentity ===
          false &&
        g.exactTokenNodeIdentityJoinRequired ===
          true &&
        g.opaqueOccurrenceIdsPreservedNotCompared ===
          true &&
        g.siteDomainCandidateOrderPreserved ===
          true &&
        g.siteDomainCandidateMultiplicityPreserved ===
          true &&
        g.matchingOccurrenceOrderPreserved ===
          true &&
        g.matchingOccurrenceMultiplicityPreserved ===
          true &&
        g.applicabilityEvidenceStateProduced ===
          true &&
        g.applicabilityEvidenceStateIsBooleanTruth ===
          false &&
        g.snapshotMismatchProducesBlockedComposition ===
          true &&
        g.snapshotMismatchProducesNegativeApplicabilityEvidence ===
          false &&
        g.runtimeSiteApplicabilityResolved ===
          false &&
        g.currentRuntimeSentenceContextSelected ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.posComparisonExecuted ===
          false &&
        g.comparisonTruthResolved ===
          false &&
        g.booleanTruthProduced ===
          false &&
        g.runtimeConditionTruthResolved ===
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
      JSON.stringify(g),
    );
  },
);
