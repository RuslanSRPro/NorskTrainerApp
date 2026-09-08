import {
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,
  type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
  type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceStateV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2,
  type CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2,
} from "./canonical-runtime-token-pos-eq-condition-truth-semantic-capability-v2.ts";

import {
  deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2,
} from "./canonical-runtime-token-pos-condition-truth-composition-v2.ts";

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

type ComparisonState =
  | "no_pos_fact"
  | "blocked_hypothesis_set"
  | "open_match_possible"
  | "open_no_surviving_match"
  | "explicit_resolved_match"
  | "explicit_resolved_non_match"
  | "explicit_resolved_mixed";

const CAP =
  CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2;

function d2aGovernance() {
  return {
    exactC2ComparisonEvidenceRequired: true,

    exactSnapshotBoundDomainResultRequired: true,

    exactSharedSiteTupleRequired: true,

    exactSnapshotIdentityEqualityRequired: true,

    exactTokenNodeIdentityJoinRequired: true,

    applicabilityEvidenceStateProduced: true,

    applicabilityEvidenceStateIsBooleanTruth: false,

    runtimeSiteApplicabilityResolved: false,

    currentRuntimeSentenceContextSelected: false,

    occurrenceFilteringPerformed: false,

    occurrenceWinnerSelected: false,

    finalRuntimeOccurrenceBindingPerformed: false,

    posComparisonExecuted: false,

    comparisonTruthResolved: false,

    booleanTruthProduced: false,

    runtimeConditionTruthResolved: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforcementPerformed: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    frozenGrammarReadOnly: true,
  } as const;
}

function makeD2a(
  options: {
    applicabilityState?:
      CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceStateV2;

    comparisonState?: ComparisonState;

    exactMatchCount?: number;

    staleProducer?: boolean;

    snapshotIdentityId?: string;

    tokenNodeId?: string;
  } = {},
): CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2 {
  const applicabilityState = options.applicabilityState ??
    "unique_site_snapshot_token_occurrence_match";

  const comparisonState = options.comparisonState ??
    "explicit_resolved_match";

  const exactMatchCount = options.exactMatchCount ??
    (
      applicabilityState ===
          "unique_site_snapshot_token_occurrence_match"
        ? 1
        : applicabilityState ===
            "multiple_site_snapshot_token_occurrence_matches"
        ? 2
        : 0
    );

  const snapshotIdentityId = options.snapshotIdentityId ??
    "canonical-graph-snapshot:sha256:d2b1-fixture";

  const snapshotSha256 = "d2b1-fixture-sha";

  const graphDocumentId = "document:0:0:5";

  const tokenNodeId = options.tokenNodeId ??
    "tok:0:0:2";

  const graphOccurrenceId = "g2:fixture:opaque-occurrence";

  const expectedAuthorityId = "fixture:expected-authority";

  const comparisonEvidenceId = "fixture:c2-comparison";

  const applicabilityEvidenceId = "fixture:d2a-applicability";

  const c2 = {
    comparisonEvidenceId,

    comparisonState,

    actualSnapshotIdentityId: snapshotIdentityId,

    actualSnapshotSha256: snapshotSha256,

    actualGraphDocumentId: graphDocumentId,

    actualTokenNodeId: tokenNodeId,

    actualGraphTokenOccurrenceIdentityId: graphOccurrenceId,

    expectedAuthorityId,
  };

  let pairEvidence: Record<string, unknown>[] = [];

  if (
    applicabilityState ===
      "matching_site_domain_no_token_occurrence" ||
    (
      applicabilityState ===
        "unique_site_snapshot_token_occurrence_match" &&
      exactMatchCount ===
        0
    )
  ) {
    pairEvidence = [
      {
        pairEvidenceId: "fixture:pair:1",

        siteIdentityMatches: true,

        exactSiteSnapshotTokenOccurrenceMatch: false,

        matchingTokenOccurrences: [],
      },
    ];
  } else if (
    exactMatchCount >
      0
  ) {
    const occurrences = Array.from(
      {
        length: exactMatchCount,
      },
      (
        _,
        index,
      ) => ({
        occurrenceMatchEvidenceId: `fixture:occurrence:${index + 1}`,
      }),
    );

    pairEvidence = [
      {
        pairEvidenceId: "fixture:pair:1",

        siteIdentityMatches: true,

        exactSiteSnapshotTokenOccurrenceMatch: true,

        matchingTokenOccurrences: occurrences,
      },
    ];
  }

  const exactMatchingPairs = pairEvidence.filter(
    (pair) =>
      pair.exactSiteSnapshotTokenOccurrenceMatch ===
        true,
  );

  const exactMatchingOccurrences = exactMatchingPairs.flatMap(
    (pair) => pair.matchingTokenOccurrences as Record<string, unknown>[],
  );

  const siteMatchingDomainCount = pairEvidence.filter(
    (pair) =>
      pair.siteIdentityMatches ===
        true,
  ).length;

  const evidence = {
    applicabilityEvidenceId,

    status: "candidate",

    applicabilityState,

    c2ComparisonEvidenceId: comparisonEvidenceId,

    actualSnapshotIdentityId: snapshotIdentityId,

    actualSnapshotSha256: snapshotSha256,

    actualGraphDocumentId: graphDocumentId,

    actualTokenNodeId: tokenNodeId,

    actualGraphTokenOccurrenceIdentityId: graphOccurrenceId,

    expectedAuthorityId,

    snapshotDomainSnapshotIdentityId: snapshotIdentityId,

    snapshotDomainSnapshotSha256: snapshotSha256,

    snapshotDomainGraphDocumentId: graphDocumentId,

    pairEvidence,

    siteMatchingDomainCount,

    exactSiteSnapshotTokenOccurrenceMatchCount: exactMatchingOccurrences.length,

    matchingPairEvidenceIds: exactMatchingPairs.map(
      (pair) => pair.pairEvidenceId as string,
    ),

    matchingOccurrenceEvidenceIds: exactMatchingOccurrences.map(
      (occurrence) => occurrence.occurrenceMatchEvidenceId as string,
    ),

    c2ComparisonEvidence: c2,

    snapshotDomainResult: {
      status: "ready",
    },

    governance: d2aGovernance(),
  };

  if (
    exactMatchCount !==
      exactMatchingOccurrences.length
  ) {
    evidence.exactSiteSnapshotTokenOccurrenceMatchCount = exactMatchCount;
  }

  return {
    producer: (
      options.staleProducer
        ? "fixture:stale-d2a-producer"
        : CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2
    ) as typeof CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,

    status: "ready",

    evidence: evidence as never,

    blockingReasons: [],
  };
}

function readyEvidence(
  d2a: CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
  capability: CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2 =
    CAP,
) {
  const result = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2(
    d2a,
    capability,
  );

  assert(
    result.status ===
        "ready" &&
      result.evidence,
    `expected ready D2b1 result: ${JSON.stringify(result)}`,
  );

  return result.evidence;
}

Deno.test(
  "D2b1.1 exact D2a and exact D2b0 singleton produce ready composition",
  () => {
    const evidence = readyEvidence(
      makeD2a(),
    );

    assert(
      evidence.status ===
          "candidate" &&
        evidence.d2aApplicabilityEvidence
            .applicabilityEvidenceId ===
          "fixture:d2a-applicability" &&
        evidence.truthSemanticCapability ===
          CAP,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.2 stale non-exact D2a blocks fail closed",
  () => {
    const result = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2(
      makeD2a({
        staleProducer: true,
      }),
      CAP,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "d2a_applicability_evidence:not_exact_ready",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2b1.3 non-singleton D2b0 capability clone blocks fail closed",
  () => {
    const clone = {
      ...CAP,
    } as CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2;

    const result = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2(
      makeD2a(),
      clone,
    );

    assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "truth_semantic_capability:not_exact_singleton",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2b1.4 no_matching_site_domain remains unresolved null even with explicit non-match",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        applicabilityState: "no_matching_site_domain",

        comparisonState: "explicit_resolved_non_match",
      }),
    );

    assert(
      evidence.truthDisposition ===
          "unresolved" &&
        evidence.booleanTruth ===
          null &&
        evidence.booleanTruthResolved ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.5 matching site domain without token occurrence remains unresolved null",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        applicabilityState: "matching_site_domain_no_token_occurrence",

        comparisonState: "explicit_resolved_match",
      }),
    );

    assert(
      evidence.truthDisposition ===
          "unresolved" &&
        evidence.booleanTruth ===
          null &&
        evidence.booleanTruthResolved ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.6 multiple applicability matches remain unresolved null",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        applicabilityState: "multiple_site_snapshot_token_occurrence_matches",

        comparisonState: "explicit_resolved_non_match",
      }),
    );

    assert(
      evidence.exactSiteSnapshotTokenOccurrenceMatchCount ===
          2 &&
        evidence.truthDisposition ===
          "unresolved" &&
        evidence.booleanTruth ===
          null &&
        evidence.booleanTruthResolved ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.7 unique applicability without exact one occurrence remains unresolved null",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        applicabilityState: "unique_site_snapshot_token_occurrence_match",

        comparisonState: "explicit_resolved_match",

        exactMatchCount: 0,
      }),
    );

    assert(
      evidence.exactSiteSnapshotTokenOccurrenceMatchCount ===
          0 &&
        evidence.truthDisposition ===
          "unresolved" &&
        evidence.booleanTruth ===
          null &&
        evidence.booleanTruthResolved ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.8 unique plus no_pos_fact remains unresolved null",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        comparisonState: "no_pos_fact",
      }),
    );

    assert(
      evidence.truthDisposition ===
          "unresolved" &&
        evidence.booleanTruth ===
          null &&
        evidence.booleanTruthResolved ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.9 unique plus blocked_hypothesis_set remains unresolved null",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        comparisonState: "blocked_hypothesis_set",
      }),
    );

    assert(
      evidence.truthDisposition ===
          "unresolved" &&
        evidence.booleanTruth ===
          null &&
        evidence.booleanTruthResolved ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.10 unique plus open_match_possible remains unresolved null and never true",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        comparisonState: "open_match_possible",
      }),
    );

    assert(
      evidence.truthDisposition ===
          "unresolved" &&
        evidence.booleanTruth ===
          null &&
        evidence.booleanTruthResolved ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.11 unique plus open_no_surviving_match remains unresolved null and never false",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        comparisonState: "open_no_surviving_match",
      }),
    );

    assert(
      evidence.truthDisposition ===
          "unresolved" &&
        evidence.booleanTruth ===
          null &&
        evidence.booleanTruthResolved ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.12 unique plus explicit_resolved_mixed remains unresolved null",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        comparisonState: "explicit_resolved_mixed",
      }),
    );

    assert(
      evidence.truthDisposition ===
          "unresolved" &&
        evidence.booleanTruth ===
          null &&
        evidence.booleanTruthResolved ===
          false,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.13 unique exact occurrence plus explicit_resolved_match resolves true",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        comparisonState: "explicit_resolved_match",
      }),
    );

    assert(
      evidence.truthDisposition ===
          "resolved_true" &&
        evidence.booleanTruth ===
          true &&
        evidence.booleanTruthResolved ===
          true,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.14 unique exact occurrence plus explicit_resolved_non_match resolves false",
  () => {
    const evidence = readyEvidence(
      makeD2a({
        comparisonState: "explicit_resolved_non_match",
      }),
    );

    assert(
      evidence.truthDisposition ===
          "resolved_false" &&
        evidence.booleanTruth ===
          false &&
        evidence.booleanTruthResolved ===
          true,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.15 false arises only from explicit resolved non-match under unique eligibility",
  () => {
    const states: ComparisonState[] = [
      "no_pos_fact",
      "blocked_hypothesis_set",
      "open_match_possible",
      "open_no_surviving_match",
      "explicit_resolved_match",
      "explicit_resolved_non_match",
      "explicit_resolved_mixed",
    ];

    const outputs = states.map(
      (comparisonState) =>
        readyEvidence(
          makeD2a({
            comparisonState,
          }),
        ),
    );

    const falseOutputs = outputs.filter(
      (output) =>
        output.booleanTruth ===
          false,
    );

    assert(
      falseOutputs.length ===
          1 &&
        falseOutputs[0]
            .comparisonState ===
          "explicit_resolved_non_match" &&
        falseOutputs[0]
            .truthDisposition ===
          "resolved_false",
      JSON.stringify(outputs),
    );
  },
);

Deno.test(
  "D2b1.16 preserved C2 evidence is consumed only through exact D2a object",
  () => {
    const d2a = makeD2a({
      comparisonState: "explicit_resolved_match",
    });

    assert(
      d2a.status ===
          "ready" &&
        d2a.evidence,
      "fixture not ready",
    );

    const inputEvidence = d2a.evidence;

    const evidence = readyEvidence(
      d2a,
    );

    assert(
      evidence.d2aApplicabilityEvidence ===
          inputEvidence &&
        evidence.comparisonEvidenceId ===
          inputEvidence.c2ComparisonEvidenceId &&
        evidence.comparisonState ===
          inputEvidence.c2ComparisonEvidence.comparisonState,
      JSON.stringify(evidence),
    );
  },
);

Deno.test(
  "D2b1.17 snapshot token and comparison provenance are preserved exactly",
  () => {
    const d2a = makeD2a({
      snapshotIdentityId: "canonical-graph-snapshot:sha256:provenance-fixture",

      tokenNodeId: "tok:7:10:14",
    });

    assert(
      d2a.status ===
          "ready" &&
        d2a.evidence,
      "fixture not ready",
    );

    const input = d2a.evidence;

    const output = readyEvidence(
      d2a,
    );

    assert(
      output.snapshotIdentityId ===
          input.actualSnapshotIdentityId &&
        output.snapshotSha256 ===
          input.actualSnapshotSha256 &&
        output.graphDocumentId ===
          input.actualGraphDocumentId &&
        output.tokenNodeId ===
          input.actualTokenNodeId &&
        output.graphTokenOccurrenceIdentityId ===
          input.actualGraphTokenOccurrenceIdentityId &&
        output.expectedAuthorityId ===
          input.expectedAuthorityId &&
        output.comparisonEvidenceId ===
          input.c2ComparisonEvidenceId,
      JSON.stringify(output),
    );
  },
);

Deno.test(
  "D2b1.18 composition is deterministic and input read-only",
  () => {
    const d2a = makeD2a({
      comparisonState: "explicit_resolved_non_match",
    });

    const before = JSON.stringify(
      d2a,
    );

    const first = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2(
      d2a,
      CAP,
    );

    const second = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2(
      d2a,
      CAP,
    );

    assert(
      same(
        first,
        second,
      ) &&
        JSON.stringify(
            d2a,
          ) ===
          before,
      JSON.stringify(first),
    );
  },
);

Deno.test(
  "D2b1.19 authority ceiling excludes direct C2 recomputation context winner binding compound truth and cardinality",
  () => {
    const g = readyEvidence(
      makeD2a(),
    ).governance;

    assert(
      g.exactD2aApplicabilityEvidenceRequired ===
          true &&
        g.exactD2b0TruthSemanticCapabilitySingletonRequired ===
          true &&
        g.preservedC2ComparisonEvidenceConsumedThroughD2aOnly ===
          true &&
        g.uniqueApplicabilityRequiredForResolvedBoolean ===
          true &&
        g.exactSingleOccurrenceMatchRequiredForResolvedBoolean ===
          true &&
        g.explicitResolvedMatchProjectsBooleanTrue ===
          true &&
        g.explicitResolvedNonMatchProjectsBooleanFalse ===
          true &&
        g.uncertaintyPreservedAsUnresolved ===
          true &&
        g.nonUniqueApplicabilityPreservedAsUnresolved ===
          true &&
        g.unresolvedBooleanRepresentedAsNull ===
          true &&
        g.leafConditionTruthDispositionProduced ===
          true &&
        g.leafConditionBooleanProjectionProduced ===
          true &&
        g.c2DirectDependency ===
          false &&
        g.comparisonRecomputed ===
          false &&
        g.posNormalizationPerformed ===
          false &&
        g.posWinnerSelected ===
          false &&
        g.runtimeSentenceContextSelected ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.compoundWhereTruthResolved ===
          false &&
        g.manifestConditionTruthResolved ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false,
      JSON.stringify(g),
    );
  },
);

Deno.test(
  "D2b1.20 composition never mutates graph or classifies learner error",
  () => {
    const evidence = readyEvidence(
      makeD2a(),
    );

    assert(
      evidence.governance.deterministic ===
          true &&
        evidence.governance.frozenGrammarReadOnly ===
          true &&
        evidence.governance.graphMutationPerformed ===
          false &&
        evidence.governance.learnerErrorClassified ===
          false,
      JSON.stringify(evidence.governance),
    );
  },
);
