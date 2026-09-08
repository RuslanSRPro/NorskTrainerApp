import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2,
  type CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2,
  type CanonicalTokenPosNormalizedLabelComparisonEvidenceV2,
} from "./canonical-token-pos-normalized-label-comparison-evidence-v2.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1,
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1,
  type CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingReadyV1,
  type CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1,
  type CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1,
  type CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-snapshot-binding-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2 =
  "canonical_runtime_token_pos_site_occurrence_applicability_evidence_v2" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2 =
  "2" as const;

export type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceStateV2 =
  | "no_matching_site_domain"
  | "matching_site_domain_no_token_occurrence"
  | "unique_site_snapshot_token_occurrence_match"
  | "multiple_site_snapshot_token_occurrence_matches";

export type CanonicalRuntimeTokenPosExactSiteTupleFieldMatchesV2 = {
  tokenPosSuffixPropertyCompatibilityId: boolean;

  leafRightOperandSiteAuthorityId: boolean;

  referencedBindingDefinitionAuthorityId: boolean;

  manifestId: boolean;

  manifestCode: boolean;

  referencedBindingName: boolean;

  runtimeSuffix: boolean;

  canonicalNodeType: boolean;
};

export type CanonicalRuntimeTokenPosMatchingOccurrenceEvidenceV2 = {
  occurrenceMatchEvidenceId: string;

  tokenNodeId: string;

  containmentEdgeId: string;

  sentenceTokenIndex: number;

  graphStatus:
    CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1["graphStatus"];

  snapshotTokenOccurrenceIdentityId: string;

  occurrence: CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1;
};

export type CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2 = {
  pairEvidenceId: string;

  pairIndex: number;

  snapshotBoundDomainId: string;

  sourceDomainCandidateId: string;

  sentenceNodeId: string;

  snapshotSentenceOccurrenceIdentityId: string;

  siteIdentityFieldMatches:
    CanonicalRuntimeTokenPosExactSiteTupleFieldMatchesV2;

  siteIdentityMatches: boolean;

  snapshotIdentityMatches: boolean;

  matchingTokenOccurrences:
    CanonicalRuntimeTokenPosMatchingOccurrenceEvidenceV2[];

  matchingTokenOccurrenceCount: number;

  exactSiteSnapshotTokenOccurrenceMatch: boolean;

  snapshotDomainCandidate:
    CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1;
};

export type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2 = {
  applicabilityEvidenceId: string;

  status: "candidate";

  applicabilityState:
    CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceStateV2;

  c2ComparisonEvidenceId: string;

  actualSnapshotIdentityId: string;

  actualSnapshotSha256: string;

  actualGraphDocumentId: string;

  actualTokenNodeId: string;

  actualGraphTokenOccurrenceIdentityId: string;

  expectedAuthorityId: string;

  snapshotDomainSnapshotIdentityId: string;

  snapshotDomainSnapshotSha256: string;

  snapshotDomainGraphDocumentId: string;

  pairEvidence: CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[];

  siteMatchingDomainCount: number;

  exactSiteSnapshotTokenOccurrenceMatchCount: number;

  matchingPairEvidenceIds: string[];

  matchingOccurrenceEvidenceIds: string[];

  c2ComparisonEvidence: CanonicalTokenPosNormalizedLabelComparisonEvidenceV2;

  snapshotDomainResult:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingReadyV1;

  governance: {
    exactC2ComparisonEvidenceRequired: true;

    exactSnapshotBoundDomainResultRequired: true;

    exactSharedSiteTupleRequired: true;

    exactLeafSiteAnchorRequired: true;

    allSharedSiteProvenanceFieldsCompared: true;

    exactSnapshotIdentityEqualityRequired: true;

    exactSnapshotShaEqualityRequired: true;

    exactGraphStateShaEqualityRequired: true;

    exactSurfaceSnapshotShaEqualityRequired: true;

    graphDocumentIdConsistencyRequired: true;

    graphDocumentIdUsedAsSnapshotIdentity: false;

    exactTokenNodeIdentityJoinRequired: true;

    opaqueOccurrenceIdsPreservedNotCompared: true;

    siteDomainCandidateOrderPreserved: true;

    siteDomainCandidateMultiplicityPreserved: true;

    matchingOccurrenceOrderPreserved: true;

    matchingOccurrenceMultiplicityPreserved: true;

    applicabilityEvidenceStateProduced: true;

    applicabilityEvidenceStateIsBooleanTruth: false;

    snapshotMismatchProducesBlockedComposition: true;

    snapshotMismatchProducesNegativeApplicabilityEvidence: false;

    runtimeSiteApplicabilityResolved: false;

    currentRuntimeSentenceContextSelected: false;

    occurrenceFilteringPerformed: false;

    occurrenceWinnerSelected: false;

    finalRuntimeOccurrenceBindingPerformed: false;

    posComparisonExecuted: false;

    comparisonTruthResolved: false;

    booleanTruthProduced: false;

    runtimeConditionTruthResolved: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforcementPerformed: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2;

    status:
      | "ready"
      | "blocked";

    evidence?: CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2;

    blockingReasons: string[];
  };

type C2ReadyV2 = CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2 & {
  status: "ready";

  evidence: CanonicalTokenPosNormalizedLabelComparisonEvidenceV2;
};

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

function blockedResult(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,

    status: "blocked",

    blockingReasons: uniqueSorted(
      reasons,
    ),
  };
}

function governanceSubset(
  governance: unknown,
  expected: Readonly<
    Record<
      string,
      unknown
    >
  >,
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

  const actual = governance as Record<
    string,
    unknown
  >;

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

function exactC2Result(
  result: CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2,
): result is C2ReadyV2 {
  if (
    result.producer !==
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2 ||
    result.producerVersion !==
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2 ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    !result.evidence
  ) {
    return false;
  }

  const evidence = result.evidence;

  const actual = evidence.actualGraphBoundProjection;

  const expected = evidence.expectedAuthority;

  if (
    evidence.status !==
      "candidate" ||
    !present(
      evidence.comparisonEvidenceId,
    ) ||
    !present(
      evidence.actualSnapshotIdentityId,
    ) ||
    !present(
      evidence.actualSnapshotSha256,
    ) ||
    !present(
      evidence.actualGraphDocumentId,
    ) ||
    !present(
      evidence.actualTokenNodeId,
    ) ||
    !present(
      evidence.actualGraphTokenOccurrenceIdentityId,
    ) ||
    !present(
      evidence.expectedAuthorityId,
    ) ||
    evidence.expectedAuthorityId !==
      expected.id ||
    evidence.actualSnapshotIdentityId !==
      actual.snapshotIdentityId ||
    evidence.actualSnapshotSha256 !==
      actual.snapshotSha256 ||
    evidence.actualGraphDocumentId !==
      actual.graphDocumentId ||
    evidence.actualTokenNodeId !==
      actual.tokenNodeId ||
    evidence.actualGraphTokenOccurrenceIdentityId !==
      actual.graphTokenOccurrenceIdentityId ||
    !present(
      actual.surfaceSnapshotSha256,
    ) ||
    !present(
      actual.graphStateSha256,
    ) ||
    !present(
      expected.tokenPosSuffixPropertyCompatibilityId,
    ) ||
    !present(
      expected.leafRightOperandSiteAuthorityId,
    ) ||
    !present(
      expected.referencedBindingDefinitionAuthorityId,
    ) ||
    !present(
      expected.manifestId,
    ) ||
    !present(
      expected.manifestCode,
    ) ||
    !present(
      expected.referencedBindingName,
    ) ||
    expected.runtimeSuffix !==
      ".pos" ||
    expected.canonicalNodeType !==
      "token"
  ) {
    return false;
  }

  return governanceSubset(
    evidence.governance,
    {
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
    },
  );
}

function exactSnapshotDomainCandidate(
  candidate:
    CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1,
  result:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingReadyV1,
  index: number,
): boolean {
  if (
    candidate.status !==
      "candidate" ||
    !present(
      candidate.snapshotBoundDomainId,
    ) ||
    !present(
      candidate.sourceDomainCandidateId,
    ) ||
    !present(
      candidate.snapshotAuthorityId,
    ) ||
    !present(
      candidate.snapshotIdentityId,
    ) ||
    !present(
      candidate.snapshotSha256,
    ) ||
    !present(
      candidate.surfaceSnapshotSha256,
    ) ||
    !present(
      candidate.graphStateSha256,
    ) ||
    candidate.graphVersion !==
      "canonical-language-graph-v1" ||
    !present(
      candidate.graphDocumentId,
    ) ||
    !present(
      candidate.canonicalTokenDomainId,
    ) ||
    !present(
      candidate.sentenceNodeId,
    ) ||
    !Number.isInteger(
      candidate.sentenceIndex,
    ) ||
    candidate.sentenceIndex <
      0 ||
    !present(
      candidate.snapshotSentenceOccurrenceIdentityId,
    ) ||
    candidate.occurrenceCount !==
      candidate.occurrences.length ||
    candidate.sourceDomainCandidateId !==
      candidate.sourceCandidate.id ||
    candidate.snapshotAuthorityId !==
      result.snapshotAuthorityId ||
    candidate.snapshotIdentityId !==
      result.snapshotIdentityId ||
    candidate.snapshotSha256 !==
      result.snapshotSha256 ||
    candidate.surfaceSnapshotSha256 !==
      result.surfaceSnapshotSha256 ||
    candidate.graphStateSha256 !==
      result.graphStateSha256 ||
    candidate.graphDocumentId !==
      result.graphDocumentId ||
    candidate.sourceCandidate.graphDocumentId !==
      candidate.graphDocumentId ||
    candidate.sourceCandidate.canonicalTokenDomainId !==
      candidate.canonicalTokenDomainId ||
    candidate.sourceCandidate.sentenceNodeId !==
      candidate.sentenceNodeId ||
    candidate.sourceCandidate.sentenceIndex !==
      candidate.sentenceIndex ||
    candidate.sourceCandidate.runtimeSuffix !==
      ".pos" ||
    candidate.sourceCandidate.canonicalNodeType !==
      "token" ||
    !present(
      candidate.sourceCandidate.tokenPosSuffixPropertyCompatibilityId,
    ) ||
    !present(
      candidate.sourceCandidate.leafRightOperandSiteAuthorityId,
    ) ||
    !present(
      candidate.sourceCandidate.referencedBindingDefinitionAuthorityId,
    ) ||
    !present(
      candidate.sourceCandidate.manifestId,
    ) ||
    !present(
      candidate.sourceCandidate.manifestCode,
    ) ||
    !present(
      candidate.sourceCandidate.referencedBindingName,
    ) ||
    result.sourceDomainResult.candidates[index] !==
      candidate.sourceCandidate
  ) {
    return false;
  }

  for (
    const occurrence of candidate.occurrences
  ) {
    if (
      !present(
        occurrence.tokenNodeId,
      ) ||
      !present(
        occurrence.containmentEdgeId,
      ) ||
      !Number.isInteger(
        occurrence.sentenceTokenIndex,
      ) ||
      occurrence.sentenceTokenIndex <
        0 ||
      !present(
        occurrence.snapshotTokenOccurrenceIdentityId,
      )
    ) {
      return false;
    }
  }

  return governanceSubset(
    candidate.governance,
    {
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
    },
  );
}

function exactSnapshotDomainResult(
  result:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1,
): result is CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingReadyV1 {
  if (
    result.producer !==
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1 ||
    result.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1 ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    result.candidateCount !==
      result.candidates.length ||
    result.sourceDomainResult.candidates.length !==
      result.candidates.length ||
    !present(
      result.provenanceBindingAuthorityId,
    ) ||
    !present(
      result.snapshotAuthorityId,
    ) ||
    !present(
      result.snapshotIdentityId,
    ) ||
    !present(
      result.snapshotSha256,
    ) ||
    !present(
      result.surfaceSnapshotSha256,
    ) ||
    !present(
      result.graphStateSha256,
    ) ||
    !present(
      result.graphDocumentId,
    )
  ) {
    return false;
  }

  if (
    !governanceSubset(
      result.governance,
      {
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
      },
    )
  ) {
    return false;
  }

  const seenDomainIds = new Set<
    string
  >();

  for (
    let index = 0;
    index <
      result.candidates.length;
    index++
  ) {
    const candidate = result.candidates[index];

    if (
      seenDomainIds.has(
        candidate.snapshotBoundDomainId,
      ) ||
      !exactSnapshotDomainCandidate(
        candidate,
        result,
        index,
      )
    ) {
      return false;
    }

    seenDomainIds.add(
      candidate.snapshotBoundDomainId,
    );
  }

  return true;
}

function exactSiteFieldMatches(
  c2: CanonicalTokenPosNormalizedLabelComparisonEvidenceV2,
  domain:
    CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1,
): CanonicalRuntimeTokenPosExactSiteTupleFieldMatchesV2 {
  const expected = c2.expectedAuthority;

  const source = domain.sourceCandidate;

  return {
    tokenPosSuffixPropertyCompatibilityId:
      expected.tokenPosSuffixPropertyCompatibilityId ===
        source.tokenPosSuffixPropertyCompatibilityId,

    leafRightOperandSiteAuthorityId:
      expected.leafRightOperandSiteAuthorityId ===
        source.leafRightOperandSiteAuthorityId,

    referencedBindingDefinitionAuthorityId:
      expected.referencedBindingDefinitionAuthorityId ===
        source.referencedBindingDefinitionAuthorityId,

    manifestId: expected.manifestId ===
      source.manifestId,

    manifestCode: expected.manifestCode ===
      source.manifestCode,

    referencedBindingName: expected.referencedBindingName ===
      source.referencedBindingName,

    runtimeSuffix: expected.runtimeSuffix ===
      source.runtimeSuffix,

    canonicalNodeType: expected.canonicalNodeType ===
      source.canonicalNodeType,
  };
}

function exactSiteTupleMatches(
  fields: CanonicalRuntimeTokenPosExactSiteTupleFieldMatchesV2,
): boolean {
  return (
    fields.tokenPosSuffixPropertyCompatibilityId &&
    fields.leafRightOperandSiteAuthorityId &&
    fields.referencedBindingDefinitionAuthorityId &&
    fields.manifestId &&
    fields.manifestCode &&
    fields.referencedBindingName &&
    fields.runtimeSuffix &&
    fields.canonicalNodeType
  );
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    "%",
    "_",
  );
}

function applicabilityEvidenceId(
  c2ComparisonEvidenceId: string,
  snapshotIdentityId: string,
): string {
  return [
    "canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2",
    idPart(
      c2ComparisonEvidenceId,
    ),
    idPart(
      snapshotIdentityId,
    ),
  ].join(
    ":",
  );
}

function pairEvidenceId(
  applicabilityId: string,
  snapshotBoundDomainId: string,
): string {
  return [
    applicabilityId,
    "domain",
    idPart(
      snapshotBoundDomainId,
    ),
  ].join(
    ":",
  );
}

function occurrenceMatchEvidenceId(
  pairId: string,
  snapshotTokenOccurrenceIdentityId: string,
): string {
  return [
    pairId,
    "occurrence",
    idPart(
      snapshotTokenOccurrenceIdentityId,
    ),
  ].join(
    ":",
  );
}

function snapshotCompositionMatches(
  c2: CanonicalTokenPosNormalizedLabelComparisonEvidenceV2,
  domain:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingReadyV1,
): boolean {
  const actual = c2.actualGraphBoundProjection;

  return (
    c2.actualSnapshotIdentityId ===
      domain.snapshotIdentityId &&
    c2.actualSnapshotSha256 ===
      domain.snapshotSha256 &&
    actual.surfaceSnapshotSha256 ===
      domain.surfaceSnapshotSha256 &&
    actual.graphStateSha256 ===
      domain.graphStateSha256 &&
    c2.actualGraphDocumentId ===
      domain.graphDocumentId
  );
}

export function deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
  c2Result: CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2,
  snapshotDomainResult:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1,
): CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2 {
  if (
    !exactC2Result(
      c2Result,
    )
  ) {
    return blockedResult([
      "c2_comparison_evidence:not_exact_ready",
    ]);
  }

  if (
    !exactSnapshotDomainResult(
      snapshotDomainResult,
    )
  ) {
    return blockedResult([
      "snapshot_bound_domain:not_exact_ready",
    ]);
  }

  const c2 = c2Result.evidence;

  const domainResult = snapshotDomainResult;

  if (
    !snapshotCompositionMatches(
      c2,
      domainResult,
    )
  ) {
    return blockedResult([
      "snapshot_composition:not_exact_same_snapshot",
    ]);
  }

  const rootEvidenceId = applicabilityEvidenceId(
    c2.comparisonEvidenceId,
    domainResult.snapshotIdentityId,
  );

  const pairEvidence:
    CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[] =
      domainResult.candidates.map(
        (
          domain,
          pairIndex,
        ) => {
          const siteIdentityFieldMatches = exactSiteFieldMatches(
            c2,
            domain,
          );

          const siteIdentityMatches = exactSiteTupleMatches(
            siteIdentityFieldMatches,
          );

          const snapshotIdentityMatches = c2.actualSnapshotIdentityId ===
            domain.snapshotIdentityId;

          const pairId = pairEvidenceId(
            rootEvidenceId,
            domain.snapshotBoundDomainId,
          );

          const matchingTokenOccurrences:
            CanonicalRuntimeTokenPosMatchingOccurrenceEvidenceV2[] =
              siteIdentityMatches &&
                snapshotIdentityMatches
                ? domain.occurrences
                  .filter(
                    (occurrence) =>
                      occurrence.tokenNodeId ===
                        c2.actualTokenNodeId,
                  )
                  .map(
                    (occurrence) => ({
                      occurrenceMatchEvidenceId: occurrenceMatchEvidenceId(
                        pairId,
                        occurrence.snapshotTokenOccurrenceIdentityId,
                      ),

                      tokenNodeId: occurrence.tokenNodeId,

                      containmentEdgeId: occurrence.containmentEdgeId,

                      sentenceTokenIndex: occurrence.sentenceTokenIndex,

                      graphStatus: occurrence.graphStatus,

                      snapshotTokenOccurrenceIdentityId:
                        occurrence.snapshotTokenOccurrenceIdentityId,

                      occurrence,
                    }),
                  )
                : [];

          return {
            pairEvidenceId: pairId,

            pairIndex,

            snapshotBoundDomainId: domain.snapshotBoundDomainId,

            sourceDomainCandidateId: domain.sourceDomainCandidateId,

            sentenceNodeId: domain.sentenceNodeId,

            snapshotSentenceOccurrenceIdentityId:
              domain.snapshotSentenceOccurrenceIdentityId,

            siteIdentityFieldMatches,

            siteIdentityMatches,

            snapshotIdentityMatches,

            matchingTokenOccurrences,

            matchingTokenOccurrenceCount: matchingTokenOccurrences.length,

            exactSiteSnapshotTokenOccurrenceMatch: siteIdentityMatches &&
              snapshotIdentityMatches &&
              matchingTokenOccurrences.length >
                0,

            snapshotDomainCandidate: domain,
          };
        },
      );

  const siteMatchingPairs = pairEvidence.filter(
    (pair) => pair.siteIdentityMatches,
  );

  const matchingPairs = pairEvidence.filter(
    (pair) => pair.exactSiteSnapshotTokenOccurrenceMatch,
  );

  const matchingOccurrences = matchingPairs.flatMap(
    (pair) => pair.matchingTokenOccurrences,
  );

  const exactMatchCount = matchingOccurrences.length;

  let applicabilityState:
    CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceStateV2;

  if (
    siteMatchingPairs.length ===
      0
  ) {
    applicabilityState = "no_matching_site_domain";
  } else if (
    exactMatchCount ===
      0
  ) {
    applicabilityState = "matching_site_domain_no_token_occurrence";
  } else if (
    exactMatchCount ===
      1
  ) {
    applicabilityState = "unique_site_snapshot_token_occurrence_match";
  } else {
    applicabilityState = "multiple_site_snapshot_token_occurrence_matches";
  }

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,

    status: "ready",

    evidence: {
      applicabilityEvidenceId: rootEvidenceId,

      status: "candidate",

      applicabilityState,

      c2ComparisonEvidenceId: c2.comparisonEvidenceId,

      actualSnapshotIdentityId: c2.actualSnapshotIdentityId,

      actualSnapshotSha256: c2.actualSnapshotSha256,

      actualGraphDocumentId: c2.actualGraphDocumentId,

      actualTokenNodeId: c2.actualTokenNodeId,

      actualGraphTokenOccurrenceIdentityId:
        c2.actualGraphTokenOccurrenceIdentityId,

      expectedAuthorityId: c2.expectedAuthorityId,

      snapshotDomainSnapshotIdentityId: domainResult.snapshotIdentityId,

      snapshotDomainSnapshotSha256: domainResult.snapshotSha256,

      snapshotDomainGraphDocumentId: domainResult.graphDocumentId,

      pairEvidence,

      siteMatchingDomainCount: siteMatchingPairs.length,

      exactSiteSnapshotTokenOccurrenceMatchCount: exactMatchCount,

      matchingPairEvidenceIds: matchingPairs.map(
        (pair) => pair.pairEvidenceId,
      ),

      matchingOccurrenceEvidenceIds: matchingOccurrences.map(
        (occurrence) => occurrence.occurrenceMatchEvidenceId,
      ),

      c2ComparisonEvidence: c2,

      snapshotDomainResult: domainResult,

      governance: {
        exactC2ComparisonEvidenceRequired: true,

        exactSnapshotBoundDomainResultRequired: true,

        exactSharedSiteTupleRequired: true,

        exactLeafSiteAnchorRequired: true,

        allSharedSiteProvenanceFieldsCompared: true,

        exactSnapshotIdentityEqualityRequired: true,

        exactSnapshotShaEqualityRequired: true,

        exactGraphStateShaEqualityRequired: true,

        exactSurfaceSnapshotShaEqualityRequired: true,

        graphDocumentIdConsistencyRequired: true,

        graphDocumentIdUsedAsSnapshotIdentity: false,

        exactTokenNodeIdentityJoinRequired: true,

        opaqueOccurrenceIdsPreservedNotCompared: true,

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

        posComparisonExecuted: false,

        comparisonTruthResolved: false,

        booleanTruthProduced: false,

        runtimeConditionTruthResolved: false,

        cardinalitySemanticsResolved: false,

        cardinalityEnforcementPerformed: false,

        graphMutationPerformed: false,

        learnerErrorClassified: false,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
