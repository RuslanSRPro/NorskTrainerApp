import {
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3,
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3,
  deriveCanonicalRuntimeTokenPosConditionTruthCompositionV3,
} from "./canonical-runtime-token-pos-condition-truth-composition-v3.ts";
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
  "D2b1-v3.1 valid explicit_resolved_match delegates and preserves resolved_true",
  () => {
    const result = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV3(
      makeD2a({
        comparisonState: "explicit_resolved_match",
      }),
      CAP,
    );

    assert(
      result.producer ===
          CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3 &&
        result.producerVersion ===
          CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3 &&
        result.status ===
          "ready" &&
        result.evidence?.truthDisposition ===
          "resolved_true" &&
        result.evidence.booleanTruth ===
          true &&
        result.evidence.booleanTruthResolved ===
          true &&
        result.sourceV2Result?.status ===
          "ready",
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2b1-v3.2 valid explicit_resolved_non_match delegates and preserves resolved_false",
  () => {
    const result = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV3(
      makeD2a({
        comparisonState: "explicit_resolved_non_match",
      }),
      CAP,
    );

    assert(
      result.status ===
          "ready" &&
        result.evidence?.truthDisposition ===
          "resolved_false" &&
        result.evidence.booleanTruth ===
          false &&
        result.evidence.booleanTruthResolved ===
          true,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2b1-v3.3 missing comparisonState blocks before V2 projection",
  () => {
    const malformed = structuredClone(
      makeD2a({
        comparisonState: "explicit_resolved_match",
      }),
    ) as unknown as {
      evidence: {
        c2ComparisonEvidence: {
          comparisonState?: unknown;
        };
      };
    };

    delete malformed
      .evidence
      .c2ComparisonEvidence
      .comparisonState;

    const result = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV3(
      malformed as unknown as ReturnType<
        typeof makeD2a
      >,
      CAP,
    );

    assert(
      result.status ===
          "blocked" &&
        result.evidence === undefined &&
        result.sourceV2Result ===
          null &&
        result.blockingReasons.includes(
          "c2_comparison_state:missing",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2b1-v3.4 unknown comparisonState blocks fail closed instead of TypeError",
  () => {
    const malformed = structuredClone(
      makeD2a({
        comparisonState: "explicit_resolved_match",
      }),
    ) as unknown as {
      evidence: {
        c2ComparisonEvidence: {
          comparisonState: unknown;
        };
      };
    };

    malformed
      .evidence
      .c2ComparisonEvidence
      .comparisonState = "fixture_invalid_comparison_state";

    const result = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV3(
      malformed as unknown as ReturnType<
        typeof makeD2a
      >,
      CAP,
    );

    assert(
      result.status ===
          "blocked" &&
        result.evidence === undefined &&
        result.sourceV2Result ===
          null &&
        result.blockingReasons.includes(
          "c2_comparison_state:not_in_exact_d2b0_domain",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2b1-v3.5 stale D2a with valid comparisonState still delegates to V2 fail-closed validation",
  () => {
    const result = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV3(
      makeD2a({
        comparisonState: "explicit_resolved_match",

        staleProducer: true,
      }),
      CAP,
    );

    assert(
      result.status ===
          "blocked" &&
        result.sourceV2Result?.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "d2a_applicability_evidence:not_exact_ready",
        ),
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "D2b1-v3.6 wrapper adds no compound manifest or cardinality truth semantics",
  () => {
    const result = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV3(
      makeD2a(),
      CAP,
    );

    assert(
      result.governance
            .v2TruthSemanticsReimplemented ===
          false &&
        result.governance
            .v2ContractMutated ===
          false &&
        result.governance
            .compoundWhereTruthResolved ===
          false &&
        result.governance
            .compoundBooleanCompositionExecuted ===
          false &&
        result.governance
            .manifestConditionTruthResolved ===
          false &&
        result.governance
            .cardinalitySemanticsResolved ===
          false,
      JSON.stringify(result),
    );
  },
);
