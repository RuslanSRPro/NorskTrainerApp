import {
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,
  type CanonicalCurrentRuntimeSentenceContextAuthorityResultV1,
  type CanonicalCurrentRuntimeSentenceContextAuthorityV1,
} from "./canonical-current-runtime-sentence-context-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,
  type CanonicalRuntimeTokenPosMatchingOccurrenceEvidenceV2,
  type CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2,
  type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
  type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceStateV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1,
  deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1,
} from "./canonical-runtime-token-pos-current-context-site-occurrence-applicability-evidence-v1.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

type PairSpec = {
  sentenceNodeId?: string;

  sentenceIndex?: number;

  snapshotSentenceOccurrenceIdentityId?: string;

  siteIdentityMatches?: boolean;

  matchingOccurrenceCount?: number;

  graphDocumentId?: string;

  snapshotIdentityId?: string;
};

const SNAPSHOT = "fixture:snapshot:1";

const GRAPH_DOCUMENT = "fixture:graph-document:1";

function currentGovernance() {
  return {
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
  };
}

function makeCurrent(
  options: {
    snapshotIdentityId?: string;

    snapshotSentenceOccurrenceIdentityId?: string;

    graphDocumentId?: string;

    sentenceNodeId?: string;

    sentenceIndex?: number;

    producer?: string;

    status?: "ready" | "blocked";
  } = {},
): CanonicalCurrentRuntimeSentenceContextAuthorityResultV1 {
  const authority = {
    authorityId: "fixture:current-authority",

    status: "proven_current",

    executionInvocationId: "fixture:invocation",

    snapshotIdentityId: options.snapshotIdentityId ??
      SNAPSHOT,

    snapshotSentenceOccurrenceIdentityId:
      options.snapshotSentenceOccurrenceIdentityId ??
        "fixture:snapshot-sentence:0",

    snapshotAuthorityId: "fixture:snapshot-authority",

    snapshotSentenceOccurrenceAuthorityId:
      "fixture:snapshot-sentence-authority",

    graphDocumentId: options.graphDocumentId ??
      GRAPH_DOCUMENT,

    sentenceNodeId: options.sentenceNodeId ??
      "sentence:0",

    sentenceIndex: options.sentenceIndex ??
      0,

    sourceSnapshotSentenceOccurrenceAuthority: {} as never,

    governance: currentGovernance(),
  } as unknown as CanonicalCurrentRuntimeSentenceContextAuthorityV1;

  if (
    options.status ===
      "blocked"
  ) {
    return {
      producer: CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,

      producerVersion:
        CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,

      status: "blocked",

      blockingReasons: [
        "fixture:blocked",
      ],
    };
  }

  return {
    producer: (
      options.producer ??
        CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1
    ) as typeof CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,

    producerVersion:
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,

    status: "ready",

    authority,

    blockingReasons: [],

    capturedSurface: {} as never,

    capturedGraph: {} as never,

    executionContextInputResult: {} as never,

    snapshotIdentityResult: {} as never,

    snapshotIdentityAuthority: {} as never,

    snapshotSentenceOccurrenceIdentityResult: {} as never,
  };
}

function d2aGovernance() {
  return {
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
  };
}

function occurrence(
  pairIndex: number,
  occurrenceIndex: number,
): CanonicalRuntimeTokenPosMatchingOccurrenceEvidenceV2 {
  return {
    occurrenceMatchEvidenceId:
      `fixture:pair:${pairIndex}:occurrence:${occurrenceIndex}`,

    tokenNodeId: "token:target",

    containmentEdgeId: `edge:${pairIndex}:${occurrenceIndex}`,

    sentenceTokenIndex: occurrenceIndex,

    graphStatus: "resolved",

    snapshotTokenOccurrenceIdentityId:
      `fixture:snapshot-token:${pairIndex}:${occurrenceIndex}`,

    occurrence: {} as never,
  };
}

function pair(
  index: number,
  spec: PairSpec,
): CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2 {
  const sentenceNodeId = spec.sentenceNodeId ??
    `sentence:${index}`;

  const sentenceIndex = spec.sentenceIndex ??
    index;

  const snapshotSentenceOccurrenceIdentityId =
    spec.snapshotSentenceOccurrenceIdentityId ??
      `fixture:snapshot-sentence:${index}`;

  const graphDocumentId = spec.graphDocumentId ??
    GRAPH_DOCUMENT;

  const snapshotIdentityId = spec.snapshotIdentityId ??
    SNAPSHOT;

  const siteIdentityMatches = spec.siteIdentityMatches ??
    true;

  const matchingOccurrenceCount = spec.matchingOccurrenceCount ??
    1;

  const matchingTokenOccurrences = Array.from(
    {
      length: matchingOccurrenceCount,
    },
    (
      _,
      occurrenceIndex,
    ) =>
      occurrence(
        index,
        occurrenceIndex,
      ),
  );

  const snapshotDomainCandidate = {
    snapshotBoundDomainId: `fixture:snapshot-domain:${index}`,

    sourceDomainCandidateId: `fixture:source-domain:${index}`,

    snapshotIdentityId,

    graphDocumentId,

    sentenceNodeId,

    sentenceIndex,

    snapshotSentenceOccurrenceIdentityId,
  };

  return {
    pairEvidenceId: `fixture:pair:${index}`,

    pairIndex: index,

    snapshotBoundDomainId: snapshotDomainCandidate
      .snapshotBoundDomainId,

    sourceDomainCandidateId: snapshotDomainCandidate
      .sourceDomainCandidateId,

    sentenceNodeId,

    snapshotSentenceOccurrenceIdentityId,

    siteIdentityFieldMatches: {} as never,

    siteIdentityMatches,

    snapshotIdentityMatches: true,

    matchingTokenOccurrences,

    matchingTokenOccurrenceCount: matchingTokenOccurrences.length,

    exactSiteSnapshotTokenOccurrenceMatch: siteIdentityMatches &&
      matchingTokenOccurrences.length >
        0,

    snapshotDomainCandidate: snapshotDomainCandidate as never,
  };
}

function globalState(
  pairs:
    readonly CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[],
): CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceStateV2 {
  const siteMatches = pairs.filter(
    (candidate) => candidate.siteIdentityMatches,
  );

  const occurrences = pairs
    .filter(
      (candidate) => candidate.exactSiteSnapshotTokenOccurrenceMatch,
    )
    .flatMap(
      (candidate) => candidate.matchingTokenOccurrences,
    );

  if (
    siteMatches.length ===
      0
  ) {
    return "no_matching_site_domain";
  }

  if (
    occurrences.length ===
      0
  ) {
    return "matching_site_domain_no_token_occurrence";
  }

  if (
    occurrences.length ===
      1
  ) {
    return "unique_site_snapshot_token_occurrence_match";
  }

  return "multiple_site_snapshot_token_occurrence_matches";
}

function makeD2a(
  specs: readonly PairSpec[] = [
    {
      sentenceNodeId: "sentence:0",

      sentenceIndex: 0,

      snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:0",
    },
  ],
  options: {
    snapshotIdentityId?: string;

    graphDocumentId?: string;

    producer?: string;

    status?: "ready" | "blocked";
  } = {},
): CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2 {
  if (
    options.status ===
      "blocked"
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,

      producerVersion:
        CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,

      status: "blocked",

      blockingReasons: [
        "fixture:blocked",
      ],
    };
  }

  const snapshotIdentityId = options.snapshotIdentityId ??
    SNAPSHOT;

  const graphDocumentId = options.graphDocumentId ??
    GRAPH_DOCUMENT;

  const pairs = specs.map(
    (
      spec,
      index,
    ) =>
      pair(
        index,
        {
          ...spec,

          snapshotIdentityId: spec.snapshotIdentityId ??
            snapshotIdentityId,

          graphDocumentId: spec.graphDocumentId ??
            graphDocumentId,
        },
      ),
  );

  const sourceCandidates = pairs.map(
    (candidate) => candidate.snapshotDomainCandidate,
  );

  const siteMatchingPairs = pairs.filter(
    (candidate) => candidate.siteIdentityMatches,
  );

  const exactPairs = pairs.filter(
    (candidate) => candidate.exactSiteSnapshotTokenOccurrenceMatch,
  );

  const exactOccurrences = exactPairs.flatMap(
    (candidate) => candidate.matchingTokenOccurrences,
  );

  const evidence = {
    applicabilityEvidenceId: "fixture:d2a",

    status: "candidate",

    applicabilityState: globalState(
      pairs,
    ),

    actualSnapshotIdentityId: snapshotIdentityId,

    actualGraphDocumentId: graphDocumentId,

    snapshotDomainSnapshotIdentityId: snapshotIdentityId,

    snapshotDomainGraphDocumentId: graphDocumentId,

    pairEvidence: pairs,

    siteMatchingDomainCount: siteMatchingPairs.length,

    exactSiteSnapshotTokenOccurrenceMatchCount: exactOccurrences.length,

    matchingPairEvidenceIds: exactPairs.map(
      (candidate) => candidate.pairEvidenceId,
    ),

    matchingOccurrenceEvidenceIds: exactOccurrences.map(
      (candidate) => candidate.occurrenceMatchEvidenceId,
    ),

    snapshotDomainResult: {
      status: "ready",

      candidates: sourceCandidates,
    },

    governance: d2aGovernance(),
  };

  return {
    producer: (
      options.producer ??
        CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2
    ) as typeof CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,

    status: "ready",

    evidence: evidence as never,

    blockingReasons: [],
  };
}

function readyEvidence(
  current: CanonicalCurrentRuntimeSentenceContextAuthorityResultV1,
  d2a: CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
) {
  const result =
    deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
      current,
      d2a,
    );

  assert(
    result.status ===
      "ready",
    `expected READY: ${JSON.stringify(result)}`,
  );

  return result.evidence;
}

Deno.test(
  "current-applicability.1 producer and version are frozen",
  () => {
    assert(
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1 ===
        "canonical_runtime_token_pos_current_context_site_occurrence_applicability_evidence_v1",
      "producer changed",
    );

    assert(
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1 ===
        "1",
      "version changed",
    );
  },
);

Deno.test(
  "current-applicability.2 public API arity is exactly two",
  () => {
    assert(
      deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1
        .length ===
        2,
      "public API arity changed",
    );
  },
);

Deno.test(
  "current-applicability.3 unique D2a evidence in proven CURRENT context resolves unique applicability",
  () => {
    const evidence = readyEvidence(
      makeCurrent(),
      makeD2a(),
    );

    assert(
      evidence.applicabilityState ===
          "unique_site_snapshot_token_occurrence_match" &&
        evidence.currentContextPairCount ===
          1 &&
        evidence.currentContextExactSiteSnapshotTokenOccurrenceMatchCount ===
          1,
      JSON.stringify(
        evidence,
      ),
    );
  },
);

Deno.test(
  "current-applicability.4 global D2a multiple across two sentence contexts scopes to exact CURRENT context",
  () => {
    const d2a = makeD2a([
      {
        sentenceNodeId: "sentence:0",

        sentenceIndex: 0,

        snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:0",
      },

      {
        sentenceNodeId: "sentence:1",

        sentenceIndex: 1,

        snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:1",
      },
    ]);

    assert(
      d2a.status ===
          "ready" &&
        d2a.evidence?.applicabilityState ===
          "multiple_site_snapshot_token_occurrence_matches",
      "fixture must be globally multiple",
    );

    const evidence = readyEvidence(
      makeCurrent(),
      d2a,
    );

    assert(
      evidence.applicabilityState ===
          "unique_site_snapshot_token_occurrence_match" &&
        evidence.currentContextPairCount ===
          1 &&
        evidence.currentContextPairEvidence[0]
            .snapshotSentenceOccurrenceIdentityId ===
          "fixture:snapshot-sentence:0",
      JSON.stringify(
        evidence,
      ),
    );
  },
);

Deno.test(
  "current-applicability.5 exact second CURRENT sentence scopes without first-sentence inference",
  () => {
    const d2a = makeD2a([
      {
        sentenceNodeId: "sentence:0",

        sentenceIndex: 0,

        snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:0",
      },

      {
        sentenceNodeId: "sentence:1",

        sentenceIndex: 1,

        snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:1",
      },
    ]);

    const evidence = readyEvidence(
      makeCurrent({
        snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:1",

        sentenceNodeId: "sentence:1",

        sentenceIndex: 1,
      }),
      d2a,
    );

    assert(
      evidence.snapshotSentenceOccurrenceIdentityId ===
          "fixture:snapshot-sentence:1" &&
        evidence.currentContextPairCount ===
          1 &&
        evidence.currentContextPairEvidence[0]
            .sentenceNodeId ===
          "sentence:1",
      JSON.stringify(
        evidence,
      ),
    );
  },
);

Deno.test(
  "current-applicability.6 no matching site domain in CURRENT context remains categorical no-match evidence",
  () => {
    const evidence = readyEvidence(
      makeCurrent(),
      makeD2a([
        {
          sentenceNodeId: "sentence:0",

          sentenceIndex: 0,

          snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:0",

          siteIdentityMatches: false,

          matchingOccurrenceCount: 0,
        },
      ]),
    );

    assert(
      evidence.applicabilityState ===
          "no_matching_site_domain" &&
        evidence.currentContextSiteMatchingDomainCount ===
          0,
      JSON.stringify(
        evidence,
      ),
    );
  },
);

Deno.test(
  "current-applicability.7 matching site with no token occurrence remains non-boolean no-occurrence evidence",
  () => {
    const evidence = readyEvidence(
      makeCurrent(),
      makeD2a([
        {
          sentenceNodeId: "sentence:0",

          sentenceIndex: 0,

          snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:0",

          siteIdentityMatches: true,

          matchingOccurrenceCount: 0,
        },
      ]),
    );

    assert(
      evidence.applicabilityState ===
          "matching_site_domain_no_token_occurrence" &&
        evidence.currentContextSiteMatchingDomainCount ===
          1 &&
        evidence.currentContextExactSiteSnapshotTokenOccurrenceMatchCount ===
          0,
      JSON.stringify(
        evidence,
      ),
    );
  },
);

Deno.test(
  "current-applicability.8 multiple token occurrences inside CURRENT context remain multiple with no winner",
  () => {
    const evidence = readyEvidence(
      makeCurrent(),
      makeD2a([
        {
          sentenceNodeId: "sentence:0",

          sentenceIndex: 0,

          snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:0",

          matchingOccurrenceCount: 2,
        },
      ]),
    );

    assert(
      evidence.applicabilityState ===
          "multiple_site_snapshot_token_occurrence_matches" &&
        evidence.currentContextMatchingOccurrenceEvidence.length ===
          2 &&
        evidence.governance.occurrenceWinnerSelected ===
          false,
      JSON.stringify(
        evidence,
      ),
    );
  },
);

Deno.test(
  "current-applicability.9 snapshot mismatch between CURRENT and D2a blocks",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
        makeCurrent(),
        makeD2a(
          undefined,
          {
            snapshotIdentityId: "fixture:other-snapshot",
          },
        ),
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "current_context_applicability:snapshot_identity_mismatch",
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "current-applicability.10 same snapshot but inconsistent sentence-node metadata blocks",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
        makeCurrent(),
        makeD2a([
          {
            sentenceNodeId: "sentence:wrong",

            sentenceIndex: 0,

            snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:0",
          },
        ]),
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "current_context_applicability:sentence_node_consistency_mismatch",
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "current-applicability.11 sentenceIndex is consistency metadata only, never context identity",
  () => {
    const evidence = readyEvidence(
      makeCurrent(),
      makeD2a(),
    );

    const g = evidence.governance;

    assert(
      g.sentenceIndexConsistencyChecked ===
          true &&
        g.sentenceIndexIsContextIdentity ===
          false &&
        g.sentenceIndexUsedAsSelector ===
          false &&
        g.sentenceIndexIsLocalityMetadataOnly ===
          true,
      JSON.stringify(
        g,
      ),
    );
  },
);

Deno.test(
  "current-applicability.12 non-exact CURRENT authority blocks fail closed",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
        makeCurrent({
          producer: "fixture:stale-current-producer",
        }),
        makeD2a(),
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "current_context_authority:not_exact_ready",
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "current-applicability.13 non-exact D2a evidence blocks fail closed",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
        makeCurrent(),
        makeD2a(
          undefined,
          {
            producer: "fixture:stale-d2a-producer",
          },
        ),
      );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "d2a_applicability_evidence:not_exact_ready",
        ),
      JSON.stringify(
        result,
      ),
    );
  },
);

Deno.test(
  "current-applicability.14 source CURRENT authority and D2a evidence objects are preserved without reconstruction",
  () => {
    const current = makeCurrent();

    const d2a = makeD2a();

    const result =
      deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
        current,
        d2a,
      );

    assert(
      result.status ===
        "ready",
      JSON.stringify(
        result,
      ),
    );

    assert(
      result.sourceCurrentContextResult ===
          current &&
        result.sourceApplicabilityResult ===
          d2a &&
        result.evidence.sourceCurrentRuntimeSentenceContextAuthority ===
          current.authority &&
        result.evidence.sourceApplicabilityEvidence ===
          d2a.evidence,
      "source objects were reconstructed",
    );
  },
);

Deno.test(
  "current-applicability.15 pair and occurrence evidence are scoped but source objects remain identical",
  () => {
    const d2a = makeD2a([
      {
        sentenceNodeId: "sentence:0",

        sentenceIndex: 0,

        snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:0",
      },

      {
        sentenceNodeId: "sentence:1",

        sentenceIndex: 1,

        snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:1",
      },
    ]);

    assert(
      d2a.status ===
          "ready" &&
        d2a.evidence !==
          undefined,
      "fixture D2a not ready",
    );

    const evidence = readyEvidence(
      makeCurrent(),
      d2a,
    );

    assert(
      evidence.currentContextPairEvidence[0] ===
          d2a.evidence.pairEvidence[0] &&
        evidence.currentContextMatchingOccurrenceEvidence[0] ===
          d2a.evidence.pairEvidence[0]
            .matchingTokenOccurrences[0],
      "scoped evidence was reconstructed",
    );
  },
);

Deno.test(
  "current-applicability.16 CURRENT-context applicability resolves no truth winner binding cardinality or WHERE",
  () => {
    const g = readyEvidence(
      makeCurrent(),
      makeD2a(),
    ).governance;

    assert(
      g.runtimeSiteApplicabilityResolved ===
          true &&
        g.applicabilityEvidenceStateIsBooleanTruth ===
          false &&
        g.currentContextSelectionPerformed ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.bindingTruthResolved ===
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
        g.runtimeWhereTruthResolved ===
          false &&
        g.ruleExecutionPerformed ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.learnerErrorClassified ===
          false,
      JSON.stringify(
        g,
      ),
    );
  },
);

Deno.test(
  "current-applicability.17 global D2a applicability state is not reused as CURRENT-context truth",
  () => {
    const d2a = makeD2a([
      {
        sentenceNodeId: "sentence:0",

        sentenceIndex: 0,

        snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:0",
      },

      {
        sentenceNodeId: "sentence:1",

        sentenceIndex: 1,

        snapshotSentenceOccurrenceIdentityId: "fixture:snapshot-sentence:1",
      },
    ]);

    assert(
      d2a.status ===
          "ready" &&
        d2a.evidence?.applicabilityState ===
          "multiple_site_snapshot_token_occurrence_matches",
      "source must be globally multiple",
    );

    const evidence = readyEvidence(
      makeCurrent(),
      d2a,
    );

    assert(
      evidence.applicabilityState ===
          "unique_site_snapshot_token_occurrence_match" &&
        evidence.governance
            .d2aGlobalApplicabilityStateUsedAsCurrentContextTruth ===
          false,
      JSON.stringify(
        evidence,
      ),
    );
  },
);

Deno.test(
  "current-applicability.18 derivation is deterministic and does not mutate sources",
  () => {
    const current = makeCurrent();

    const d2a = makeD2a();

    const currentBefore = JSON.stringify(
      current,
    );

    const d2aBefore = JSON.stringify(
      d2a,
    );

    const first =
      deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
        current,
        d2a,
      );

    const second =
      deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
        current,
        d2a,
      );

    assert(
      JSON.stringify(
            first,
          ) ===
          JSON.stringify(
            second,
          ) &&
        JSON.stringify(
            current,
          ) ===
          currentBefore &&
        JSON.stringify(
            d2a,
          ) ===
          d2aBefore,
      "non-deterministic result or source mutation",
    );
  },
);

Deno.test(
  "current-applicability.19 production imports no WHERE binding cardinality or constraint layer",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-token-pos-current-context-site-occurrence-applicability-evidence-v1.ts",
        import.meta.url,
      ),
    );

    const forbiddenImports = [
      "canonical-runtime-manifest-binding-where",
      "canonical-constraint-propagation",
      "canonical-runtime-token-pos-condition-truth",
      "canonical-runtime-token-pos-leaf-root-candidate-disposition",
    ];

    for (
      const forbidden of forbiddenImports
    ) {
      assert(
        !source.includes(
          `from "./${forbidden}`,
        ) &&
          !source.includes(
            `from './${forbidden}`,
          ),
        `forbidden downstream import: ${forbidden}`,
      );
    }
  },
);

Deno.test(
  "current-applicability.20 production does not claim CURRENT selection ownership",
  () => {
    const evidence = readyEvidence(
      makeCurrent(),
      makeD2a(),
    );

    const governance = evidence.governance as unknown as Record<
      string,
      unknown
    >;

    assert(
      !Object.prototype.hasOwnProperty.call(
        governance,
        "currentRuntimeSentenceContextSelected",
      ),
      "downstream applicability output duplicated CURRENT selection ownership",
    );

    assert(
      evidence.governance
        .currentContextSelectionPerformed ===
        false,
      "CURRENT selection was performed again downstream",
    );

    assert(
      evidence.governance
        .currentContextInferredFromApplicabilityEvidence ===
        false,
      "CURRENT context was inferred from applicability evidence",
    );

    assert(
      evidence.governance
        .exactProvenCurrentRuntimeSentenceContextRequired ===
        true,
      "applicability layer stopped requiring proven upstream CURRENT authority",
    );
  },
);
