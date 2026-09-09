import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1,
  deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1,
} from "./canonical-runtime-token-pos-current-binding-occurrence-domain-authority-v1.ts";

import {
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,
  type CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1,
} from "./canonical-current-runtime-sentence-context-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1,
  deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1,
} from "./canonical-runtime-token-pos-current-context-site-occurrence-applicability-evidence-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,
  type CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2,
  type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";

import type {
  CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1,
  CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-snapshot-binding-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function occurrence(
  id: string,
  tokenNodeId = `token:${id}`,
): CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1 {
  return {
    tokenNodeId,
    containmentEdgeId: `edge:${id}`,
    sentenceTokenIndex: Number(
      id.replace(/\D/g, ""),
    ) || 0,
    graphStatus: "asserted",
    snapshotTokenOccurrenceIdentityId: `snapshot-token:${id}`,
  } as unknown as CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1;
}

function domain(
  id: string,
  occurrences: CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1[],
): CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1 {
  return {
    snapshotBoundDomainId: `snapshot-domain:${id}`,

    status: "candidate",

    sourceDomainCandidateId: `source-domain:${id}`,

    snapshotAuthorityId: "snapshot-authority:1",

    snapshotIdentityId: "snapshot:1",

    snapshotSha256: "snapshot-sha:1",

    surfaceSnapshotSha256: "surface-sha:1",

    graphStateSha256: "graph-sha:1",

    graphVersion: "canonical-language-graph-v1",

    graphDocumentId: "graph-document:1",

    canonicalTokenDomainId: `canonical-token-domain:${id}`,

    sentenceNodeId: "sentence:1",

    sentenceIndex: 0,

    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence:1",

    occurrenceCount: occurrences.length,

    occurrences,

    sourceCandidate: {
      id: `referenced-domain:${id}`,

      status: "candidate",

      tokenPosSuffixPropertyCompatibilityId: "suffix-property:1",

      leafRightOperandSiteAuthorityId: "leaf-site:1",

      referencedBindingDefinitionAuthorityId: "binding-definition:tokenRef",

      manifestId: "manifest:1",

      manifestCode: "manifest-code-1",

      referencedBindingName: "tokenRef",

      runtimeSuffix: "pos",

      canonicalNodeType: "token",

      manifestScopeCompatibilityId: "scope-compatibility:sentence",

      graphVersion: "canonical-language-graph-v1",

      graphDocumentId: "graph-document:1",

      canonicalTokenDomainId: `canonical-token-domain:${id}`,

      sentenceNodeId: "sentence:1",

      sentenceIndex: 0,

      occurrenceCount: occurrences.length,

      occurrences,
    },

    governance: {},
  } as unknown as CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1;
}

function pair(
  id: string,
  domainCandidate:
    CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1,
  options: {
    siteMatch?: boolean;
    matchedTokenNodeId?: string | null;
  } = {},
): CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2 {
  const siteMatch = options.siteMatch ??
    true;

  const matched = options.matchedTokenNodeId ===
      null
    ? []
    : domainCandidate.occurrences
      .filter(
        (item) =>
          item.tokenNodeId ===
            (
              options.matchedTokenNodeId ??
                "token:1"
            ),
      )
      .map(
        (item) => ({
          occurrenceMatchEvidenceId:
            `occurrence-match:${id}:${item.snapshotTokenOccurrenceIdentityId}`,

          tokenNodeId: item.tokenNodeId,

          containmentEdgeId: item.containmentEdgeId,

          sentenceTokenIndex: item.sentenceTokenIndex,

          graphStatus: item.graphStatus,

          snapshotTokenOccurrenceIdentityId:
            item.snapshotTokenOccurrenceIdentityId,

          occurrence: item,
        }),
      );

  return {
    pairEvidenceId: `pair:${id}`,

    pairIndex: Number(
      id.replace(/\D/g, ""),
    ) || 0,

    snapshotBoundDomainId: domainCandidate.snapshotBoundDomainId,

    sourceDomainCandidateId: domainCandidate.sourceDomainCandidateId,

    sentenceNodeId: "sentence:1",

    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence:1",

    siteIdentityFieldMatches: {
      tokenPosSuffixPropertyCompatibilityId: siteMatch,

      leafRightOperandSiteAuthorityId: siteMatch,

      referencedBindingDefinitionAuthorityId: siteMatch,

      manifestId: siteMatch,

      manifestCode: siteMatch,

      referencedBindingName: siteMatch,

      runtimeSuffix: siteMatch,

      canonicalNodeType: siteMatch,
    },

    siteIdentityMatches: siteMatch,

    snapshotIdentityMatches: true,

    matchingTokenOccurrences: siteMatch ? matched : [],

    matchingTokenOccurrenceCount: siteMatch ? matched.length : 0,

    exactSiteSnapshotTokenOccurrenceMatch: siteMatch &&
      matched.length >
        0,

    snapshotDomainCandidate: domainCandidate,
  };
}

function currentResult(): CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1 {
  const authority = {
    authorityId: "current-authority:1",

    status: "proven_current",

    executionInvocationId: "execution:1",

    snapshotIdentityId: "snapshot:1",

    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence:1",

    snapshotAuthorityId: "snapshot-authority:1",

    snapshotSentenceOccurrenceAuthorityId: "snapshot-sentence-authority:1",

    graphDocumentId: "graph-document:1",

    sentenceNodeId: "sentence:1",

    sentenceIndex: 0,

    sourceSnapshotSentenceOccurrenceAuthority: {},

    governance: {
      currentRuntimeSentenceContextSelected: true,

      currentContextProvenByIndependentAuthority: true,

      callerDeclarationAcceptedAsProof: false,

      executionInvocationIdUsedAsSentenceSelector: false,

      sentenceIndexUsedAsContextIdentity: false,

      sentenceIndexUsedAsSelector: false,

      sentenceIndexIsLocalityMetadataOnly: true,

      graphDocumentIdUsedAsSelector: false,

      sentenceNodeIdAcceptedFromCallerAsSelector: false,

      singletonSentenceInferenceAllowed: false,

      singletonCandidateInferenceAllowed: false,

      firstSentenceInferenceAllowed: false,

      rootCandidatesAcceptedAsSelector: false,

      runtimeSiteApplicabilityResolved: false,

      occurrenceWinnerSelected: false,

      bindingTruthResolved: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      runtimeWhereTruthResolved: false,

      ruleExecutionPerformed: false,

      learnerErrorClassified: false,
    },
  };

  return {
    producer: CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,

    producerVersion:
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,

    status: "ready",

    sourceExecutionContextInputResult: {} as never,

    sourceSnapshotIdentityResult: {} as never,

    sourceSnapshotSentenceOccurrenceIdentityResult: {} as never,

    authority,
    blockingReasons: [],
  } as unknown as CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1;
}

function d2aResult(
  pairs: CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[],
): CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2 {
  const sitePairs = pairs.filter(
    (item) => item.siteIdentityMatches,
  );

  const exactPairs = pairs.filter(
    (item) => item.exactSiteSnapshotTokenOccurrenceMatch,
  );

  const occurrences = exactPairs.flatMap(
    (item) => item.matchingTokenOccurrences,
  );

  const state = sitePairs.length ===
      0
    ? "no_matching_site_domain"
    : occurrences.length ===
        0
    ? "matching_site_domain_no_token_occurrence"
    : occurrences.length ===
        1
    ? "unique_site_snapshot_token_occurrence_match"
    : "multiple_site_snapshot_token_occurrence_matches";

  const evidence = {
    applicabilityEvidenceId: "d2a:1",

    status: "candidate",

    applicabilityState: state,

    actualSnapshotIdentityId: "snapshot:1",

    snapshotDomainSnapshotIdentityId: "snapshot:1",

    pairEvidence: pairs,

    siteMatchingDomainCount: sitePairs.length,

    exactSiteSnapshotTokenOccurrenceMatchCount: occurrences.length,

    matchingPairEvidenceIds: exactPairs.map(
      (item) => item.pairEvidenceId,
    ),

    matchingOccurrenceEvidenceIds: occurrences.map(
      (item) => item.occurrenceMatchEvidenceId,
    ),

    c2ComparisonEvidenceId: "c2:1",

    actualSnapshotSha256: "snapshot-sha:1",

    actualGraphDocumentId: "graph-document:1",

    actualTokenNodeId: "token:1",

    actualGraphTokenOccurrenceIdentityId: "graph-token-occurrence:1",

    expectedAuthorityId: "expected:1",

    snapshotDomainSnapshotSha256: "snapshot-sha:1",

    snapshotDomainGraphDocumentId: "graph-document:1",

    c2ComparisonEvidence: {},

    snapshotDomainResult: {
      status: "ready",

      candidates: pairs.map(
        (item) => item.snapshotDomainCandidate,
      ),
    },

    governance: {
      exactC2ComparisonEvidenceRequired: true,

      exactSnapshotBoundDomainResultRequired: true,

      exactSnapshotIdentityEqualityRequired: true,

      graphDocumentIdConsistencyRequired: true,

      graphDocumentIdUsedAsSnapshotIdentity: false,

      siteDomainCandidateOrderPreserved: true,

      siteDomainCandidateMultiplicityPreserved: true,

      matchingOccurrenceOrderPreserved: true,

      matchingOccurrenceMultiplicityPreserved: true,

      applicabilityEvidenceStateProduced: true,

      applicabilityEvidenceStateIsBooleanTruth: false,

      snapshotMismatchProducesBlockedComposition: true,

      snapshotMismatchProducesNegativeApplicabilityEvidence: false,

      runtimeSiteApplicabilityResolved: false,

      currentRuntimeSentenceContextSelected: false,

      occurrenceFilteringPerformed: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,
    },
  };

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,

    status: "ready",

    evidence,

    blockingReasons: [],
  } as unknown as CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2;
}

function fixture(
  pairs: CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[],
): CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1 {
  for (
    let index = 0;
    index <
      pairs.length;
    index++
  ) {
    pairs[index].pairIndex = index;
  }

  const current = currentResult();

  const d2a = d2aResult(
    pairs,
  );

  const result =
    deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
      current,
      d2a,
    );

  assert(
    result.status ===
      "ready",
    `closed CURRENT-applicability fixture failed: ${
      JSON.stringify(
        result,
      )
    }`,
  );

  return result;
}
Deno.test(
  "current-domain.1 producer and version are frozen",
  () => {
    assert(
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1 ===
          "canonical_runtime_token_pos_current_binding_occurrence_domain_authority_v1" &&
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1 ===
          "1",
      "producer/version drift",
    );
  },
);

Deno.test(
  "current-domain.2 public API arity is exactly one",
  () => {
    assert(
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1
        .length ===
        1,
      "public API arity changed",
    );
  },
);

Deno.test(
  "current-domain.3 binding domain preserves full domain occurrences rather than applicability occurrence only",
  () => {
    const domainA = domain(
      "1",
      [
        occurrence(
          "1",
          "token:1",
        ),
        occurrence(
          "2",
          "token:2",
        ),
        occurrence(
          "3",
          "token:3",
        ),
      ],
    );

    const pairA = pair(
      "1",
      domainA,
      {
        matchedTokenNodeId: "token:1",
      },
    );

    const source = fixture([
      pairA,
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
          "ready" &&
        result.authority.bindingOccurrenceDomainCandidateCount ===
          1 &&
        result.authority.bindingOccurrenceDomains[0].occurrenceCount ===
          3 &&
        result.authority.bindingOccurrenceDomains[0].occurrences ===
          domainA.occurrences &&
        source.evidence.currentContextMatchingOccurrenceEvidence.length ===
          1,
      "binding domain collapsed to applicability-matching token occurrence",
    );
  },
);

Deno.test(
  "current-domain.4 no matching site domain resolves a proven empty domain-candidate set",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
        {
          siteMatch: false,
        },
      ),
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
          "ready" &&
        result.authority.applicabilityState ===
          "no_matching_site_domain" &&
        result.authority.bindingOccurrenceDomainCandidateCount ===
          0 &&
        result.authority.bindingOccurrenceDomains.length ===
          0 &&
        result.authority.governance.runtimeBindingOccurrenceDomainResolved ===
          true,
      "proven empty binding-domain set not preserved",
    );
  },
);

Deno.test(
  "current-domain.5 applicable site with no current token occurrence still preserves full binding domain",
  () => {
    const domainA = domain(
      "1",
      [
        occurrence(
          "2",
          "token:2",
        ),
        occurrence(
          "3",
          "token:3",
        ),
      ],
    );

    const source = fixture([
      pair(
        "1",
        domainA,
        {
          matchedTokenNodeId: null,
        },
      ),
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
          "ready" &&
        result.authority.applicabilityState ===
          "matching_site_domain_no_token_occurrence" &&
        result.authority.bindingOccurrenceDomainCandidateCount ===
          1 &&
        result.authority.bindingOccurrenceDomains[0].occurrenceCount ===
          2 &&
        result.authority.bindingOccurrenceDomains[0].occurrences ===
          domainA.occurrences,
      "site applicability absence incorrectly erased binding occurrence domain",
    );
  },
);

Deno.test(
  "current-domain.6 multiple exact site domain candidates remain multiple with no winner",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
      pair(
        "2",
        domain(
          "2",
          [
            occurrence(
              "1b",
              "token:1",
            ),
          ],
        ),
      ),
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
          "ready" &&
        result.authority.bindingOccurrenceDomainCandidateCount ===
          2 &&
        result.authority.bindingOccurrenceDomains.length ===
          2 &&
        result.authority.governance.domainCandidateWinnerSelected ===
          false &&
        result.authority.governance.occurrenceWinnerSelected ===
          false,
      "multiple domain candidates collapsed or winner selected",
    );
  },
);

Deno.test(
  "current-domain.7 singleton domain candidate is not binding authority winner",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
          "ready" &&
        result.authority.bindingOccurrenceDomainCandidateCount ===
          1 &&
        result.authority.governance.oneDomainCandidateDoesNotBecomeWinner ===
          true &&
        result.authority.governance.domainCandidateWinnerSelected ===
          false &&
        result.authority.governance.occurrenceBindingPerformed ===
          false &&
        result.authority.governance.finalRuntimeOccurrenceBindingPerformed ===
          false,
      "singleton candidate became winner or final binding",
    );
  },
);

Deno.test(
  "current-domain.8 source applicability pair and snapshot domain objects are preserved by reference",
  () => {
    const domainA = domain(
      "1",
      [
        occurrence(
          "1",
        ),
      ],
    );

    const pairA = pair(
      "1",
      domainA,
    );

    const source = fixture([
      pairA,
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
          "ready" &&
        result.authority.sourceCurrentContextApplicabilityEvidence ===
          source.evidence &&
        result.authority.bindingOccurrenceDomains[0].sourcePairEvidence ===
          pairA &&
        result.authority.bindingOccurrenceDomains[0]
            .sourceSnapshotDomainCandidate ===
          domainA &&
        result.authority.bindingOccurrenceDomains[0].occurrences ===
          domainA.occurrences,
      "source evidence was reconstructed",
    );
  },
);

Deno.test(
  "current-domain.9 exact binding manifest scope lineage is projected from source domain",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
          "ready" &&
        result.authority.bindingOccurrenceDomains[0]
            .referencedBindingDefinitionAuthorityId ===
          "binding-definition:tokenRef" &&
        result.authority.bindingOccurrenceDomains[0].manifestId ===
          "manifest:1" &&
        result.authority.bindingOccurrenceDomains[0].manifestCode ===
          "manifest-code-1" &&
        result.authority.bindingOccurrenceDomains[0].referencedBindingName ===
          "tokenRef" &&
        result.authority.bindingOccurrenceDomains[0].runtimeSuffix ===
          "pos" &&
        result.authority.bindingOccurrenceDomains[0].canonicalNodeType ===
          "token" &&
        result.authority.bindingOccurrenceDomains[0]
            .manifestScopeCompatibilityId ===
          "scope-compatibility:sentence",
      "exact binding lineage was lost",
    );
  },
);

Deno.test(
  "current-domain.10 stale sentence occurrence context blocks",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    source.evidence.currentContextPairEvidence[0]
      .snapshotSentenceOccurrenceIdentityId = "snapshot-sentence:stale";

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "stale sentence occurrence context accepted",
    );
  },
);

Deno.test(
  "current-domain.11 source-domain identity mismatch blocks",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    source.evidence.currentContextPairEvidence[0]
      .snapshotBoundDomainId = "snapshot-domain:wrong";

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "mismatched source domain accepted",
    );
  },
);

Deno.test(
  "current-domain.12 occurrence count mismatch blocks",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
            occurrence(
              "2",
            ),
          ],
        ),
      ),
    ]);

    source.evidence.currentContextPairEvidence[0]
      .snapshotDomainCandidate.occurrenceCount = 1;

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "inconsistent occurrence domain accepted",
    );
  },
);

Deno.test(
  "current-domain.13 site-matching pair projection must remain exact by object identity",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    source.evidence.currentContextSiteMatchingPairEvidence = [
      {
        ...source.evidence.currentContextSiteMatchingPairEvidence[0],
      },
    ];

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "reconstructed site pair evidence accepted",
    );
  },
);

Deno.test(
  "current-domain.14 applicability matching occurrence projection must remain exact",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    source.evidence.currentContextMatchingOccurrenceEvidence = [
      {
        ...source.evidence.currentContextMatchingOccurrenceEvidence[0],
      },
    ];

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "reconstructed occurrence applicability evidence accepted",
    );
  },
);

Deno.test(
  "current-domain.15 inconsistent applicability state blocks",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    source.evidence.applicabilityState =
      "multiple_site_snapshot_token_occurrence_matches";

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "inconsistent upstream applicability state accepted",
    );
  },
);

Deno.test(
  "current-domain.16 non-exact upstream producer blocks",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    (
      source as unknown as {
        producer: string;
      }
    ).producer = "wrong-producer";

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "wrong upstream producer accepted",
    );
  },
);

Deno.test(
  "current-domain.17 blocked upstream remains blocked",
  () => {
    const source = {
      producer:
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1,

      producerVersion:
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1,

      status: "blocked",

      blockingReasons: [
        "fixture-blocked",
      ],
    } as unknown as CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1;

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "blocked upstream became ready",
    );
  },
);

Deno.test(
  "current-domain.18 derivation is deterministic and does not mutate source",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
            occurrence(
              "2",
            ),
          ],
        ),
      ),
    ]);

    const before = JSON.stringify(
      source,
    );

    const first =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    const second =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      first.status ===
          "ready" &&
        second.status ===
          "ready" &&
        first.authority.authorityId ===
          second.authority.authorityId &&
        JSON.stringify(
            source,
          ) ===
          before,
      "derivation is nondeterministic or mutated source",
    );
  },
);

Deno.test(
  "current-domain.19 semantic ceiling stops before winner binding truth cardinality and WHERE",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "ready",
      "fixture not ready",
    );

    const g = result.authority.governance;

    assert(
      g.runtimeBindingOccurrenceDomainResolved ===
          true &&
        g.currentRuntimeSentenceContextSelected ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.domainCandidateWinnerSelected ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.occurrenceBindingPerformed ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.bindingTruthResolved ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false &&
        g.runtimeWhereTruthResolved ===
          false &&
        g.ruleExecutionPerformed ===
          false &&
        g.learnerErrorClassified ===
          false,
      "occurrence-domain layer crossed semantic ceiling",
    );
  },
);

Deno.test(
  "current-domain.20 production imports no truth cardinality WHERE execution or constraint layer",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-token-pos-current-binding-occurrence-domain-authority-v1.ts",
        import.meta.url,
      ),
    );

    const forbidden = [
      "condition-truth-composition",
      "child-truth",
      "recursive-compound-truth",
      "cardinality",
      "constraint",
    ];

    for (
      const token of forbidden
    ) {
      assert(
        !source.includes(
          `from "./canonical-runtime-${token}`,
        ) &&
          !source.includes(
            `from "./${token}`,
          ),
        `forbidden downstream import detected: ${token}`,
      );
    }
  },
);

Deno.test(
  "current-domain.21 production contains no winner or final binding ownership",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-token-pos-current-binding-occurrence-domain-authority-v1.ts",
        import.meta.url,
      ),
    );

    assert(
      !/occurrenceWinnerSelected\s*:\s*true/.test(
        source,
      ) &&
        !/domainCandidateWinnerSelected\s*:\s*true/.test(
          source,
        ) &&
        !/occurrenceBindingPerformed\s*:\s*true/.test(
          source,
        ) &&
        !/finalRuntimeOccurrenceBindingPerformed\s*:\s*true/.test(
          source,
        ) &&
        !/bindingTruthResolved\s*:\s*true/.test(
          source,
        ) &&
        !/cardinalitySemanticsResolved\s*:\s*true/.test(
          source,
        ) &&
        !/cardinalityEnforcementPerformed\s*:\s*true/.test(
          source,
        ) &&
        !/runtimeWhereTruthResolved\s*:\s*true/.test(
          source,
        ),
      "downstream semantic ownership leaked into occurrence-domain authority",
    );
  },
);

Deno.test(
  "current-domain.22 singleton remains evidence shape only and never authority selector",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
          "ready" &&
        result.authority.bindingOccurrenceDomainCandidateCount ===
          1 &&
        result.authority.bindingOccurrenceDomains[0].occurrenceCount ===
          1 &&
        result.authority.governance.oneDomainCandidateDoesNotBecomeWinner ===
          true &&
        result.authority.governance
            .oneOccurrenceWithinDomainDoesNotBecomeWinner ===
          true &&
        result.authority.governance.domainCandidateWinnerSelected ===
          false &&
        result.authority.governance.occurrenceWinnerSelected ===
          false,
      "singleton became authority",
    );
  },
);
Deno.test(
  "current-domain.23 forged CURRENT status cannot pass through ready applicability wrapper",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    (
      source.sourceCurrentContextResult.authority as unknown as {
        status: string;
      }
    ).status = "candidate";

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "forged CURRENT status accepted",
    );
  },
);

Deno.test(
  "current-domain.24 forged CURRENT independent-proof governance blocks",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    (
      source.sourceCurrentContextResult.authority.governance as unknown as {
        currentContextProvenByIndependentAuthority: boolean;
      }
    ).currentContextProvenByIndependentAuthority = false;

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "forged CURRENT governance accepted",
    );
  },
);

Deno.test(
  "current-domain.25 forged D2a governance blocks",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    assert(
      source.sourceApplicabilityResult.status ===
        "ready",
      "fixture D2a not ready",
    );
    const d2aEvidence = source.sourceApplicabilityResult.evidence;

    assert(
      d2aEvidence !==
        undefined,
      "fixture D2a evidence missing",
    );

    (
      d2aEvidence.governance as unknown as {
        exactSnapshotBoundDomainResultRequired: boolean;
      }
    ).exactSnapshotBoundDomainResultRequired = false;

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "forged D2a governance accepted",
    );
  },
);

Deno.test(
  "current-domain.26 forged D2a snapshot-domain lineage blocks",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    assert(
      source.sourceApplicabilityResult.status ===
        "ready",
      "fixture D2a not ready",
    );
    const d2aEvidence = source.sourceApplicabilityResult.evidence;

    assert(
      d2aEvidence !==
        undefined,
      "fixture D2a evidence missing",
    );

    (
      d2aEvidence.snapshotDomainResult as unknown as {
        candidates: unknown[];
      }
    ).candidates = [];

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "blocked",
      "forged D2a snapshot-domain lineage accepted",
    );
  },
);

Deno.test(
  "current-domain.27 CLOSED public applicability derivation owns upstream proof revalidation",
  () => {
    const source = fixture([
      pair(
        "1",
        domain(
          "1",
          [
            occurrence(
              "1",
            ),
          ],
        ),
      ),
    ]);

    const result =
      deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
        source,
      );

    assert(
      result.status ===
        "ready",
      "fixture not ready",
    );

    const g = result.authority.governance;

    assert(
      g.closedCurrentContextApplicabilityPublicDerivationReexecuted ===
          true &&
        g.rederivedCurrentContextApplicabilityMustMatchSuppliedEvidence ===
          true &&
        g.privateCurrentContextAuthorityValidationSemanticsDuplicated ===
          false &&
        g.privateD2aValidationSemanticsDuplicated ===
          false &&
        g.forgedUpstreamReadyWrapperAcceptedAsProof ===
          false,
      "upstream proof ownership contract failed",
    );
  },
);
