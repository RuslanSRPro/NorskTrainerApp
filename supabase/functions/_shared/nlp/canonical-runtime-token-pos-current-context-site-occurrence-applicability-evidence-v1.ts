import {
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,
  type CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1,
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
  type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";

// Norsk Trainer — CURRENT-context site-occurrence applicability evidence V1
//
// Purpose
// -------
// Resolve site-occurrence applicability inside one independently PROVEN
// CURRENT Runtime sentence context.
//
// Inputs:
// 1. exact CanonicalCurrentRuntimeSentenceContextAuthorityResultV1;
// 2. exact D2a V2 site-occurrence applicability evidence.
//
// D2a V2 remains immutable.
//
// D2a V2 is document/snapshot-domain evidence and deliberately preserves
// multiple sentence-context matches. This layer does NOT reinterpret or
// rewrite D2a.
//
// Instead it:
// - consumes the proven CURRENT context;
// - preserves D2a pair / occurrence evidence;
// - scopes preserved pair evidence by the exact context identity:
//
//     snapshotIdentityId
//       + snapshotSentenceOccurrenceIdentityId
//
// - derives an applicability evidence state for THAT CURRENT context.
//
// Important semantic distinction
// ------------------------------
// CURRENT context selection happened upstream and is not repeated here.
//
// This layer may resolve:
//   Runtime site applicability for the already-proven CURRENT context.
//
// It does NOT:
// - infer CURRENT;
// - select CURRENT;
// - use sentenceIndex as identity;
// - use graphDocumentId / sentenceNodeId as selectors;
// - recompute site-tuple matching;
// - recompute token-occurrence matching;
// - select a token occurrence winner;
// - perform final Runtime occurrence binding;
// - resolve binding truth;
// - resolve/enforce cardinality;
// - evaluate WHERE;
// - produce boolean condition truth;
// - execute a rule;
// - mutate the graph;
// - classify learner error.
//
// Applicability state remains categorical evidence, not boolean truth.

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1 =
  "canonical_runtime_token_pos_current_context_site_occurrence_applicability_evidence_v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1 =
  "1" as const;

export type CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1 =
  {
    currentContextApplicabilityEvidenceId: string;

    status: "resolved_current_context_applicability";

    applicabilityState:
      CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceStateV2;

    sourceCurrentContextAuthorityId: string;

    sourceApplicabilityEvidenceId: string;

    executionInvocationId: string;

    snapshotIdentityId: string;

    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;

    sentenceNodeId: string;

    sentenceIndex: number;

    currentContextPairEvidence:
      readonly CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[];

    currentContextSiteMatchingPairEvidence:
      readonly CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[];

    currentContextExactMatchingPairEvidence:
      readonly CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[];

    currentContextMatchingOccurrenceEvidence:
      readonly CanonicalRuntimeTokenPosMatchingOccurrenceEvidenceV2[];

    currentContextPairCount: number;

    currentContextSiteMatchingDomainCount: number;

    currentContextExactSiteSnapshotTokenOccurrenceMatchCount: number;

    sourceCurrentRuntimeSentenceContextAuthority:
      CanonicalCurrentRuntimeSentenceContextAuthorityV1;

    sourceApplicabilityEvidence:
      CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2;

    governance: {
      exactProvenCurrentRuntimeSentenceContextRequired: true;

      exactD2aV2ApplicabilityEvidenceRequired: true;

      currentContextAuthorityObjectPreservedWithoutReconstruction: true;

      d2aEvidenceObjectPreservedWithoutReconstruction: true;

      currentContextIdentityIsSnapshotPlusSnapshotSentenceOccurrence: true;

      exactSnapshotIdentityJoinRequired: true;

      exactSnapshotSentenceOccurrenceIdentityJoinRequired: true;

      graphDocumentIdPreservedAsConsistencyMetadata: true;

      graphDocumentIdUsedAsContextIdentity: false;

      graphDocumentIdUsedAsSelector: false;

      sentenceNodeIdPreservedAsConsistencyMetadata: true;

      sentenceNodeIdUsedAsContextIdentity: false;

      sentenceNodeIdUsedAsSelector: false;

      sentenceIndexConsistencyChecked: true;

      sentenceIndexIsContextIdentity: false;

      sentenceIndexUsedAsSelector: false;

      sentenceIndexIsLocalityMetadataOnly: true;

      currentContextSelectionPerformed: false;

      currentContextInferredFromApplicabilityEvidence: false;

      d2aGlobalApplicabilityStateUsedAsCurrentContextTruth: false;

      pairEvidenceScopedByExactProvenCurrentContextIdentity: true;

      pairEvidenceOrderPreserved: true;

      pairEvidenceMultiplicityPreserved: true;

      siteTupleEvidenceConsumedNotRecomputed: true;

      tokenOccurrenceMatchEvidenceConsumedNotRecomputed: true;

      currentContextApplicabilityStateDerivedFromPreservedPairEvidence: true;

      applicabilityEvidenceStateIsBooleanTruth: false;

      runtimeSiteApplicabilityResolved: true;

      occurrenceWinnerSelected: false;

      finalRuntimeOccurrenceBindingPerformed: false;

      bindingTruthResolved: false;

      posComparisonExecuted: false;

      comparisonTruthResolved: false;

      booleanTruthProduced: false;

      runtimeConditionTruthResolved: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      runtimeWhereTruthResolved: false;

      ruleExecutionPerformed: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1;

    status: "ready";

    sourceCurrentContextResult:
      CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1;

    sourceApplicabilityResult:
      CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2;

    evidence:
      CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1;

    blockingReasons: [];
  };

export type CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1;

    status: "blocked";

    blockingReasons: string[];
  };

export type CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceResultV1 =
  | CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1
  | CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceBlockedResultV1;

function present(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length >
      0
  );
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
      ),
  );
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length ===
      right.length &&
    left.every(
      (
        value,
        index,
      ) =>
        value ===
          right[index],
    )
  );
}

function governanceSubset(
  governance: unknown,
  expected: Readonly<Record<string, unknown>>,
): boolean {
  if (
    governance ===
      null ||
    typeof governance !==
      "object" ||
    Array.isArray(
      governance,
    )
  ) {
    return false;
  }

  const actual = governance as Record<string, unknown>;

  return Object.entries(
    expected,
  ).every(
    (
      [key, value],
    ) =>
      actual[key] ===
        value,
  );
}

function blockedResult(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1,

    status: "blocked",

    blockingReasons: uniqueSorted(
      reasons.length > 0 ? reasons : [
        "current_context_applicability:blocked_without_reason",
      ],
    ),
  };
}

function exactCurrentContextResult(
  result: CanonicalCurrentRuntimeSentenceContextAuthorityResultV1,
): result is CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1 {
  if (
    result.producer !==
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1 ||
    result.producerVersion !==
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1 ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0
  ) {
    return false;
  }

  const authority = result.authority;

  if (
    authority.status !==
      "proven_current" ||
    !present(
      authority.authorityId,
    ) ||
    !present(
      authority.executionInvocationId,
    ) ||
    !present(
      authority.snapshotIdentityId,
    ) ||
    !present(
      authority.snapshotSentenceOccurrenceIdentityId,
    ) ||
    !present(
      authority.snapshotAuthorityId,
    ) ||
    !present(
      authority.snapshotSentenceOccurrenceAuthorityId,
    ) ||
    !present(
      authority.graphDocumentId,
    ) ||
    !present(
      authority.sentenceNodeId,
    ) ||
    !Number.isInteger(
      authority.sentenceIndex,
    ) ||
    authority.sentenceIndex <
      0
  ) {
    return false;
  }

  return governanceSubset(
    authority.governance,
    {
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
  );
}

type ExactD2aReadyV2 =
  & CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2
  & {
    status: "ready";

    evidence: CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2;
  };

function exactD2aResult(
  result: CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
): result is ExactD2aReadyV2 {
  if (
    result.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2 ||
    result.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2 ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    result.evidence ===
      undefined
  ) {
    return false;
  }

  const evidence = result.evidence;

  if (
    evidence.status !==
      "candidate" ||
    !present(
      evidence.applicabilityEvidenceId,
    ) ||
    !present(
      evidence.actualSnapshotIdentityId,
    ) ||
    !present(
      evidence.actualGraphDocumentId,
    ) ||
    !present(
      evidence.snapshotDomainSnapshotIdentityId,
    ) ||
    !present(
      evidence.snapshotDomainGraphDocumentId,
    ) ||
    evidence.actualSnapshotIdentityId !==
      evidence.snapshotDomainSnapshotIdentityId ||
    evidence.actualGraphDocumentId !==
      evidence.snapshotDomainGraphDocumentId ||
    !Array.isArray(
      evidence.pairEvidence,
    ) ||
    evidence.siteMatchingDomainCount <
      0 ||
    evidence.exactSiteSnapshotTokenOccurrenceMatchCount <
      0
  ) {
    return false;
  }

  if (
    !governanceSubset(
      evidence.governance,
      {
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
    )
  ) {
    return false;
  }

  if (
    evidence.snapshotDomainResult.status !==
      "ready" ||
    evidence.snapshotDomainResult.candidates.length !==
      evidence.pairEvidence.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index <
      evidence.pairEvidence.length;
    index++
  ) {
    const pair = evidence.pairEvidence[index];

    const sourceDomain = evidence.snapshotDomainResult
      .candidates[index];

    if (
      pair.pairIndex !==
        index ||
      pair.snapshotDomainCandidate !==
        sourceDomain ||
      pair.snapshotBoundDomainId !==
        sourceDomain.snapshotBoundDomainId ||
      pair.sourceDomainCandidateId !==
        sourceDomain.sourceDomainCandidateId ||
      pair.sentenceNodeId !==
        sourceDomain.sentenceNodeId ||
      pair.snapshotSentenceOccurrenceIdentityId !==
        sourceDomain.snapshotSentenceOccurrenceIdentityId ||
      pair.matchingTokenOccurrenceCount !==
        pair.matchingTokenOccurrences.length ||
      pair.exactSiteSnapshotTokenOccurrenceMatch !==
        (
          pair.siteIdentityMatches &&
          pair.snapshotIdentityMatches &&
          pair.matchingTokenOccurrences.length >
            0
        )
    ) {
      return false;
    }
  }

  const sourceSiteMatchingPairs = evidence.pairEvidence.filter(
    (pair) => pair.siteIdentityMatches,
  );

  const sourceExactPairs = evidence.pairEvidence.filter(
    (pair) => pair.exactSiteSnapshotTokenOccurrenceMatch,
  );

  const sourceExactOccurrences = sourceExactPairs.flatMap(
    (pair) => pair.matchingTokenOccurrences,
  );

  if (
    evidence.siteMatchingDomainCount !==
      sourceSiteMatchingPairs.length ||
    evidence.exactSiteSnapshotTokenOccurrenceMatchCount !==
      sourceExactOccurrences.length ||
    !sameStringArray(
      evidence.matchingPairEvidenceIds,
      sourceExactPairs.map(
        (pair) => pair.pairEvidenceId,
      ),
    ) ||
    !sameStringArray(
      evidence.matchingOccurrenceEvidenceIds,
      sourceExactOccurrences.map(
        (occurrence) => occurrence.occurrenceMatchEvidenceId,
      ),
    )
  ) {
    return false;
  }

  return true;
}

function currentContextApplicabilityEvidenceId(
  currentAuthorityId: string,
  applicabilityEvidenceId: string,
): string {
  return [
    CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1,

    `${currentAuthorityId.length}:${currentAuthorityId}`,

    `${applicabilityEvidenceId.length}:${applicabilityEvidenceId}`,
  ].join(
    "|",
  );
}

function currentContextApplicabilityState(
  siteMatchingPairCount: number,
  exactOccurrenceMatchCount: number,
): CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceStateV2 {
  if (
    siteMatchingPairCount ===
      0
  ) {
    return "no_matching_site_domain";
  }

  if (
    exactOccurrenceMatchCount ===
      0
  ) {
    return "matching_site_domain_no_token_occurrence";
  }

  if (
    exactOccurrenceMatchCount ===
      1
  ) {
    return "unique_site_snapshot_token_occurrence_match";
  }

  return "multiple_site_snapshot_token_occurrence_matches";
}

/**
 * Resolve D2a applicability evidence inside one exact, already-proven CURRENT
 * sentence context.
 *
 * Public API intentionally has exactly two inputs:
 *
 *   provenCurrentContextResult
 *   d2aApplicabilityResult
 *
 * CURRENT is consumed, never selected.
 */
export function deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
  currentContextResult: CanonicalCurrentRuntimeSentenceContextAuthorityResultV1,
  applicabilityResult:
    CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
): CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceResultV1 {
  if (
    !exactCurrentContextResult(
      currentContextResult,
    )
  ) {
    return blockedResult([
      "current_context_authority:not_exact_ready",
    ]);
  }

  if (
    !exactD2aResult(
      applicabilityResult,
    )
  ) {
    return blockedResult([
      "d2a_applicability_evidence:not_exact_ready",
    ]);
  }

  const current = currentContextResult.authority;

  const d2a = applicabilityResult.evidence;

  if (
    d2a.actualSnapshotIdentityId !==
      current.snapshotIdentityId ||
    d2a.snapshotDomainSnapshotIdentityId !==
      current.snapshotIdentityId
  ) {
    return blockedResult([
      "current_context_applicability:snapshot_identity_mismatch",
    ]);
  }

  if (
    d2a.actualGraphDocumentId !==
      current.graphDocumentId ||
    d2a.snapshotDomainGraphDocumentId !==
      current.graphDocumentId
  ) {
    return blockedResult([
      "current_context_applicability:graph_document_consistency_mismatch",
    ]);
  }

  const currentContextPairEvidence = d2a.pairEvidence.filter(
    (pair) =>
      pair.snapshotSentenceOccurrenceIdentityId ===
        current.snapshotSentenceOccurrenceIdentityId,
  );

  for (
    const pair of currentContextPairEvidence
  ) {
    const domain = pair.snapshotDomainCandidate;

    if (
      domain.snapshotIdentityId !==
        current.snapshotIdentityId ||
      domain.snapshotSentenceOccurrenceIdentityId !==
        current.snapshotSentenceOccurrenceIdentityId
    ) {
      return blockedResult([
        "current_context_applicability:pair_context_identity_mismatch",
      ]);
    }

    if (
      pair.sentenceNodeId !==
        current.sentenceNodeId ||
      domain.sentenceNodeId !==
        current.sentenceNodeId
    ) {
      return blockedResult([
        "current_context_applicability:sentence_node_consistency_mismatch",
      ]);
    }

    if (
      domain.graphDocumentId !==
        current.graphDocumentId
    ) {
      return blockedResult([
        "current_context_applicability:domain_graph_document_consistency_mismatch",
      ]);
    }

    if (
      domain.sentenceIndex !==
        current.sentenceIndex
    ) {
      return blockedResult([
        "current_context_applicability:sentence_index_consistency_mismatch",
      ]);
    }

    if (
      pair.snapshotIdentityMatches !==
        true
    ) {
      return blockedResult([
        "current_context_applicability:pair_snapshot_match_inconsistent",
      ]);
    }
  }

  const currentContextSiteMatchingPairEvidence = currentContextPairEvidence
    .filter(
      (pair) =>
        pair.siteIdentityMatches &&
        pair.snapshotIdentityMatches,
    );

  const currentContextExactMatchingPairEvidence = currentContextPairEvidence
    .filter(
      (pair) => pair.exactSiteSnapshotTokenOccurrenceMatch,
    );

  const currentContextMatchingOccurrenceEvidence =
    currentContextExactMatchingPairEvidence.flatMap(
      (pair) => pair.matchingTokenOccurrences,
    );

  const applicabilityState = currentContextApplicabilityState(
    currentContextSiteMatchingPairEvidence.length,
    currentContextMatchingOccurrenceEvidence.length,
  );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1,

    status: "ready",

    sourceCurrentContextResult: currentContextResult,

    sourceApplicabilityResult: applicabilityResult,

    evidence: {
      currentContextApplicabilityEvidenceId:
        currentContextApplicabilityEvidenceId(
          current.authorityId,
          d2a.applicabilityEvidenceId,
        ),

      status: "resolved_current_context_applicability",

      applicabilityState,

      sourceCurrentContextAuthorityId: current.authorityId,

      sourceApplicabilityEvidenceId: d2a.applicabilityEvidenceId,

      executionInvocationId: current.executionInvocationId,

      snapshotIdentityId: current.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        current.snapshotSentenceOccurrenceIdentityId,

      graphDocumentId: current.graphDocumentId,

      sentenceNodeId: current.sentenceNodeId,

      sentenceIndex: current.sentenceIndex,

      currentContextPairEvidence,

      currentContextSiteMatchingPairEvidence,

      currentContextExactMatchingPairEvidence,

      currentContextMatchingOccurrenceEvidence,

      currentContextPairCount: currentContextPairEvidence.length,

      currentContextSiteMatchingDomainCount:
        currentContextSiteMatchingPairEvidence.length,

      currentContextExactSiteSnapshotTokenOccurrenceMatchCount:
        currentContextMatchingOccurrenceEvidence.length,

      sourceCurrentRuntimeSentenceContextAuthority: current,

      sourceApplicabilityEvidence: d2a,

      governance: {
        exactProvenCurrentRuntimeSentenceContextRequired: true,

        exactD2aV2ApplicabilityEvidenceRequired: true,

        currentContextAuthorityObjectPreservedWithoutReconstruction: true,

        d2aEvidenceObjectPreservedWithoutReconstruction: true,

        currentContextIdentityIsSnapshotPlusSnapshotSentenceOccurrence: true,

        exactSnapshotIdentityJoinRequired: true,

        exactSnapshotSentenceOccurrenceIdentityJoinRequired: true,

        graphDocumentIdPreservedAsConsistencyMetadata: true,

        graphDocumentIdUsedAsContextIdentity: false,

        graphDocumentIdUsedAsSelector: false,

        sentenceNodeIdPreservedAsConsistencyMetadata: true,

        sentenceNodeIdUsedAsContextIdentity: false,

        sentenceNodeIdUsedAsSelector: false,

        sentenceIndexConsistencyChecked: true,

        sentenceIndexIsContextIdentity: false,

        sentenceIndexUsedAsSelector: false,

        sentenceIndexIsLocalityMetadataOnly: true,

        currentContextSelectionPerformed: false,

        currentContextInferredFromApplicabilityEvidence: false,

        d2aGlobalApplicabilityStateUsedAsCurrentContextTruth: false,

        pairEvidenceScopedByExactProvenCurrentContextIdentity: true,

        pairEvidenceOrderPreserved: true,

        pairEvidenceMultiplicityPreserved: true,

        siteTupleEvidenceConsumedNotRecomputed: true,

        tokenOccurrenceMatchEvidenceConsumedNotRecomputed: true,

        currentContextApplicabilityStateDerivedFromPreservedPairEvidence: true,

        applicabilityEvidenceStateIsBooleanTruth: false,

        runtimeSiteApplicabilityResolved: true,

        occurrenceWinnerSelected: false,

        finalRuntimeOccurrenceBindingPerformed: false,

        bindingTruthResolved: false,

        posComparisonExecuted: false,

        comparisonTruthResolved: false,

        booleanTruthProduced: false,

        runtimeConditionTruthResolved: false,

        cardinalitySemanticsResolved: false,

        cardinalityEnforcementPerformed: false,

        runtimeWhereTruthResolved: false,

        ruleExecutionPerformed: false,

        graphMutationPerformed: false,

        learnerErrorClassified: false,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
