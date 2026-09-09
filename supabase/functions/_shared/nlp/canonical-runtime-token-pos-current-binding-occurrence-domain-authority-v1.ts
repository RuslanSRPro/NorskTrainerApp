import {
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,
} from "./canonical-current-runtime-sentence-context-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1,
  type CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceResultV1,
  type CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1,
  deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1,
} from "./canonical-runtime-token-pos-current-context-site-occurrence-applicability-evidence-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,
  type CanonicalRuntimeTokenPosMatchingOccurrenceEvidenceV2,
  type CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";

import type {
  CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1,
  CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-snapshot-binding-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1 =
  "canonical_runtime_token_pos_current_binding_occurrence_domain_authority_v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1 =
  "1" as const;

export type CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainEvidenceV1 = {
  domainEvidenceId: string;

  status: "candidate_domain";

  pairEvidenceId: string;

  snapshotBoundDomainId: string;

  sourceDomainCandidateId: string;

  referencedBindingDefinitionAuthorityId: string;

  manifestId: string;

  manifestCode: string;

  referencedBindingName: string;

  runtimeSuffix: string;

  canonicalNodeType: string;

  manifestScopeCompatibilityId: string;

  snapshotIdentityId: string;

  snapshotSentenceOccurrenceIdentityId: string;

  graphDocumentId: string;

  sentenceNodeId: string;

  sentenceIndex: number;

  occurrenceCount: number;

  occurrences:
    readonly CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1[];

  sourcePairEvidence:
    CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2;

  sourceSnapshotDomainCandidate:
    CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1;
};

export type CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1 =
  {
    authorityId: string;

    status: "proven_current_binding_occurrence_domain";

    sourceCurrentContextApplicabilityEvidenceId: string;

    executionInvocationId: string;

    snapshotIdentityId: string;

    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;

    sentenceNodeId: string;

    sentenceIndex: number;

    applicabilityState:
      CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1[
        "applicabilityState"
      ];

    bindingOccurrenceDomains:
      readonly CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainEvidenceV1[];

    bindingOccurrenceDomainCandidateCount: number;

    sourceCurrentContextApplicabilityEvidence:
      CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1;

    governance: {
      exactCurrentContextApplicabilityResultRequired: true;

      exactCurrentContextApplicabilityProducerRequired: true;

      exactCurrentContextApplicabilityVersionRequired: true;

      exactUpstreamCurrentContextAuthorityLineageRequired: true;

      exactUpstreamD2aApplicabilityLineageRequired: true;

      closedCurrentContextApplicabilityPublicDerivationReexecuted: true;

      rederivedCurrentContextApplicabilityMustMatchSuppliedEvidence: true;

      privateCurrentContextAuthorityValidationSemanticsDuplicated: false;

      privateD2aValidationSemanticsDuplicated: false;

      forgedUpstreamReadyWrapperAcceptedAsProof: false;

      upstreamCurrentContextProofConsumedNotRecomputed: true;

      upstreamSiteApplicabilityConsumedNotRecomputed: true;

      currentContextApplicabilityObjectPreservedWithoutReconstruction: true;

      siteMatchingPairEvidenceConsumedNotRecomputed: true;

      siteMatchingPairEvidenceObjectIdentityPreserved: true;

      snapshotDomainCandidateObjectsPreservedWithoutReconstruction: true;

      fullSnapshotDomainOccurrenceArraysPreservedWithoutReconstruction: true;

      applicabilityMatchingOccurrenceEvidenceNotUsedAsBindingDomain: true;

      bindingIdentityReadOnlyFromPresentSourceDomains: true;

      bindingDefinitionAuthorityIdentityPreserved: true;

      manifestIdentityPreserved: true;

      referencedBindingNamePreserved: true;

      runtimeSuffixPreservedOpaque: true;

      canonicalNodeTypePreserved: true;

      manifestScopeCompatibilityIdentityPreserved: true;

      exactSnapshotIdentityRequired: true;

      exactSnapshotSentenceOccurrenceIdentityRequired: true;

      graphDocumentIdPreservedAsConsistencyMetadata: true;

      sentenceNodeIdPreservedAsConsistencyMetadata: true;

      sentenceIndexIsLocalityMetadataOnly: true;

      zeroDomainCandidatesAllowed: true;

      oneDomainCandidateDoesNotBecomeWinner: true;

      multipleDomainCandidatesPreserved: true;

      domainCandidateMultiplicityPreserved: true;

      occurrenceMultiplicityWithinEachDomainPreserved: true;

      zeroOccurrencesWithinDomainAllowed: true;

      oneOccurrenceWithinDomainDoesNotBecomeWinner: true;

      multipleOccurrencesWithinDomainPreserved: true;

      runtimeBindingOccurrenceDomainResolved: true;

      currentRuntimeSentenceContextSelected: false;

      occurrenceFilteringPerformed: false;

      domainCandidateWinnerSelected: false;

      occurrenceWinnerSelected: false;

      occurrenceBindingPerformed: false;

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

export type CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1;

    status: "ready";

    sourceCurrentContextApplicabilityResult:
      CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1;

    authority:
      CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1;

    status: "blocked";

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityResultV1 =
  | CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityReadyResultV1
  | CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityBlockedResultV1;

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

function sameReferences<T>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  if (
    left.length !==
      right.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index <
      left.length;
    index++
  ) {
    if (
      left[index] !==
        right[index]
    ) {
      return false;
    }
  }

  return true;
}

function sameBooleanRecord(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const leftKeys = Object.keys(
    left,
  ).sort();

  const rightKeys = Object.keys(
    right,
  ).sort();

  if (
    leftKeys.length !==
      rightKeys.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index <
      leftKeys.length;
    index++
  ) {
    const leftKey = leftKeys[index];

    const rightKey = rightKeys[index];

    if (
      leftKey !==
        rightKey ||
      typeof left[leftKey] !==
        "boolean" ||
      typeof right[rightKey] !==
        "boolean" ||
      left[leftKey] !==
        right[rightKey]
    ) {
      return false;
    }
  }

  return true;
}

function applicabilityState(
  siteMatchingPairCount: number,
  matchingOccurrenceCount: number,
): CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1[
  "applicabilityState"
] {
  if (
    siteMatchingPairCount ===
      0
  ) {
    return "no_matching_site_domain";
  }

  if (
    matchingOccurrenceCount ===
      0
  ) {
    return "matching_site_domain_no_token_occurrence";
  }

  if (
    matchingOccurrenceCount ===
      1
  ) {
    return "unique_site_snapshot_token_occurrence_match";
  }

  return "multiple_site_snapshot_token_occurrence_matches";
}

function exactOccurrence(
  occurrence: CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1,
): boolean {
  return (
    present(
      occurrence.tokenNodeId,
    ) &&
    present(
      occurrence.containmentEdgeId,
    ) &&
    Number.isInteger(
      occurrence.sentenceTokenIndex,
    ) &&
    occurrence.sentenceTokenIndex >=
      0 &&
    present(
      occurrence.snapshotTokenOccurrenceIdentityId,
    )
  );
}

function exactDomainCandidate(
  domain:
    CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1,
  evidence:
    CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1,
): boolean {
  if (
    !present(
      domain.snapshotBoundDomainId,
    ) ||
    domain.status !==
      "candidate" ||
    !present(
      domain.sourceDomainCandidateId,
    ) ||
    !present(
      domain.snapshotAuthorityId,
    ) ||
    domain.snapshotIdentityId !==
      evidence.snapshotIdentityId ||
    !present(
      domain.snapshotSha256,
    ) ||
    !present(
      domain.surfaceSnapshotSha256,
    ) ||
    !present(
      domain.graphStateSha256,
    ) ||
    domain.graphDocumentId !==
      evidence.graphDocumentId ||
    !present(
      domain.canonicalTokenDomainId,
    ) ||
    domain.sentenceNodeId !==
      evidence.sentenceNodeId ||
    domain.snapshotSentenceOccurrenceIdentityId !==
      evidence.snapshotSentenceOccurrenceIdentityId ||
    !Number.isInteger(
      domain.sentenceIndex,
    ) ||
    domain.sentenceIndex !==
      evidence.sentenceIndex ||
    !Number.isInteger(
      domain.occurrenceCount,
    ) ||
    domain.occurrenceCount <
      0 ||
    domain.occurrenceCount !==
      domain.occurrences.length ||
    !domain.occurrences.every(
      exactOccurrence,
    )
  ) {
    return false;
  }

  const source = domain.sourceCandidate;

  return (
    source.status ===
      "candidate" &&
    present(
      source.id,
    ) &&
    present(
      source.referencedBindingDefinitionAuthorityId,
    ) &&
    present(
      source.manifestId,
    ) &&
    present(
      source.manifestCode,
    ) &&
    present(
      source.referencedBindingName,
    ) &&
    present(
      source.runtimeSuffix,
    ) &&
    present(
      source.canonicalNodeType,
    ) &&
    present(
      source.manifestScopeCompatibilityId,
    )
  );
}

function exactPair(
  pair: CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2,
  evidence:
    CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1,
): boolean {
  if (
    !present(
      pair.pairEvidenceId,
    ) ||
    !Number.isInteger(
      pair.pairIndex,
    ) ||
    pair.pairIndex <
      0 ||
    !present(
      pair.snapshotBoundDomainId,
    ) ||
    !present(
      pair.sourceDomainCandidateId,
    ) ||
    pair.sentenceNodeId !==
      evidence.sentenceNodeId ||
    pair.snapshotSentenceOccurrenceIdentityId !==
      evidence.snapshotSentenceOccurrenceIdentityId ||
    typeof pair.siteIdentityMatches !==
      "boolean" ||
    typeof pair.snapshotIdentityMatches !==
      "boolean" ||
    typeof pair.exactSiteSnapshotTokenOccurrenceMatch !==
      "boolean" ||
    !Number.isInteger(
      pair.matchingTokenOccurrenceCount,
    ) ||
    pair.matchingTokenOccurrenceCount <
      0 ||
    pair.matchingTokenOccurrenceCount !==
      pair.matchingTokenOccurrences.length ||
    !pair.matchingTokenOccurrences.every(
      (occurrence) =>
        present(
          occurrence.occurrenceMatchEvidenceId,
        ) &&
        present(
          occurrence.tokenNodeId,
        ) &&
        present(
          occurrence.containmentEdgeId,
        ) &&
        Number.isInteger(
          occurrence.sentenceTokenIndex,
        ) &&
        occurrence.sentenceTokenIndex >=
          0 &&
        present(
          occurrence.snapshotTokenOccurrenceIdentityId,
        ) &&
        exactOccurrence(
          occurrence.occurrence,
        ),
    ) ||
    pair.snapshotBoundDomainId !==
      pair.snapshotDomainCandidate.snapshotBoundDomainId ||
    pair.sourceDomainCandidateId !==
      pair.snapshotDomainCandidate.sourceDomainCandidateId ||
    !exactDomainCandidate(
      pair.snapshotDomainCandidate,
      evidence,
    )
  ) {
    return false;
  }

  return (
    pair.exactSiteSnapshotTokenOccurrenceMatch ===
      (
        pair.siteIdentityMatches &&
        pair.snapshotIdentityMatches &&
        pair.matchingTokenOccurrences.length >
          0
      )
  );
}

function exactCurrentApplicability(
  result:
    CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceResultV1,
): result is CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1 {
  if (
    result.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1 ||
    result.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1 ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0
  ) {
    return false;
  }

  if (
    result.sourceCurrentContextResult.producer !==
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1 ||
    result.sourceCurrentContextResult.producerVersion !==
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1 ||
    result.sourceCurrentContextResult.status !==
      "ready" ||
    result.sourceCurrentContextResult.blockingReasons.length !==
      0
  ) {
    return false;
  }

  if (
    result.sourceApplicabilityResult.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2 ||
    result.sourceApplicabilityResult.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2 ||
    result.sourceApplicabilityResult.status !==
      "ready" ||
    result.sourceApplicabilityResult.blockingReasons.length !==
      0
  ) {
    return false;
  }

  const independentlyRederived =
    deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
      result.sourceCurrentContextResult,
      result.sourceApplicabilityResult,
    );

  if (
    independentlyRederived.status !==
      "ready"
  ) {
    return false;
  }

  const evidence = result.evidence;

  const rederivedEvidence = independentlyRederived.evidence;

  const current = result.sourceCurrentContextResult.authority;

  const d2a = result.sourceApplicabilityResult.evidence;

  const g = evidence.governance;

  if (
    independentlyRederived.sourceCurrentContextResult !==
      result.sourceCurrentContextResult ||
    independentlyRederived.sourceApplicabilityResult !==
      result.sourceApplicabilityResult ||
    evidence.currentContextApplicabilityEvidenceId !==
      rederivedEvidence.currentContextApplicabilityEvidenceId ||
    evidence.status !==
      rederivedEvidence.status ||
    evidence.applicabilityState !==
      rederivedEvidence.applicabilityState ||
    evidence.sourceCurrentContextAuthorityId !==
      rederivedEvidence.sourceCurrentContextAuthorityId ||
    evidence.sourceApplicabilityEvidenceId !==
      rederivedEvidence.sourceApplicabilityEvidenceId ||
    evidence.executionInvocationId !==
      rederivedEvidence.executionInvocationId ||
    evidence.snapshotIdentityId !==
      rederivedEvidence.snapshotIdentityId ||
    evidence.snapshotSentenceOccurrenceIdentityId !==
      rederivedEvidence.snapshotSentenceOccurrenceIdentityId ||
    evidence.graphDocumentId !==
      rederivedEvidence.graphDocumentId ||
    evidence.sentenceNodeId !==
      rederivedEvidence.sentenceNodeId ||
    evidence.sentenceIndex !==
      rederivedEvidence.sentenceIndex ||
    evidence.currentContextPairCount !==
      rederivedEvidence.currentContextPairCount ||
    evidence.currentContextSiteMatchingDomainCount !==
      rederivedEvidence.currentContextSiteMatchingDomainCount ||
    evidence.currentContextExactSiteSnapshotTokenOccurrenceMatchCount !==
      rederivedEvidence
        .currentContextExactSiteSnapshotTokenOccurrenceMatchCount ||
    evidence.sourceCurrentRuntimeSentenceContextAuthority !==
      rederivedEvidence.sourceCurrentRuntimeSentenceContextAuthority ||
    evidence.sourceApplicabilityEvidence !==
      rederivedEvidence.sourceApplicabilityEvidence ||
    !sameReferences(
      evidence.currentContextPairEvidence,
      rederivedEvidence.currentContextPairEvidence,
    ) ||
    !sameReferences(
      evidence.currentContextSiteMatchingPairEvidence,
      rederivedEvidence.currentContextSiteMatchingPairEvidence,
    ) ||
    !sameReferences(
      evidence.currentContextExactMatchingPairEvidence,
      rederivedEvidence.currentContextExactMatchingPairEvidence,
    ) ||
    !sameReferences(
      evidence.currentContextMatchingOccurrenceEvidence,
      rederivedEvidence.currentContextMatchingOccurrenceEvidence,
    ) ||
    !sameBooleanRecord(
      evidence.governance as unknown as Record<string, unknown>,
      rederivedEvidence.governance as unknown as Record<string, unknown>,
    )
  ) {
    return false;
  }

  if (
    evidence.status !==
      "resolved_current_context_applicability" ||
    evidence.sourceCurrentRuntimeSentenceContextAuthority !==
      current ||
    evidence.sourceApplicabilityEvidence !==
      d2a ||
    evidence.sourceCurrentContextAuthorityId !==
      current.authorityId ||
    evidence.sourceApplicabilityEvidenceId !==
      d2a.applicabilityEvidenceId ||
    evidence.executionInvocationId !==
      current.executionInvocationId ||
    evidence.snapshotIdentityId !==
      current.snapshotIdentityId ||
    evidence.snapshotSentenceOccurrenceIdentityId !==
      current.snapshotSentenceOccurrenceIdentityId ||
    evidence.graphDocumentId !==
      current.graphDocumentId ||
    evidence.sentenceNodeId !==
      current.sentenceNodeId ||
    evidence.sentenceIndex !==
      current.sentenceIndex ||
    evidence.currentContextPairCount !==
      evidence.currentContextPairEvidence.length ||
    evidence.currentContextSiteMatchingDomainCount !==
      evidence.currentContextSiteMatchingPairEvidence.length ||
    evidence.currentContextExactSiteSnapshotTokenOccurrenceMatchCount !==
      evidence.currentContextMatchingOccurrenceEvidence.length
  ) {
    return false;
  }

  if (
    !evidence.currentContextPairEvidence.every(
      (pair) =>
        exactPair(
          pair,
          evidence,
        ),
    )
  ) {
    return false;
  }

  const expectedSitePairs = evidence.currentContextPairEvidence.filter(
    (pair) =>
      pair.siteIdentityMatches &&
      pair.snapshotIdentityMatches,
  );

  const expectedExactPairs = evidence.currentContextPairEvidence.filter(
    (pair) => pair.exactSiteSnapshotTokenOccurrenceMatch,
  );

  const expectedMatchingOccurrences:
    CanonicalRuntimeTokenPosMatchingOccurrenceEvidenceV2[] = expectedExactPairs
      .flatMap(
        (pair) => pair.matchingTokenOccurrences,
      );

  if (
    !sameReferences(
      evidence.currentContextSiteMatchingPairEvidence,
      expectedSitePairs,
    ) ||
    !sameReferences(
      evidence.currentContextExactMatchingPairEvidence,
      expectedExactPairs,
    ) ||
    !sameReferences(
      evidence.currentContextMatchingOccurrenceEvidence,
      expectedMatchingOccurrences,
    ) ||
    evidence.applicabilityState !==
      applicabilityState(
        expectedSitePairs.length,
        expectedMatchingOccurrences.length,
      )
  ) {
    return false;
  }

  return (
    g.exactProvenCurrentRuntimeSentenceContextRequired ===
      true &&
    g.exactD2aV2ApplicabilityEvidenceRequired ===
      true &&
    g.currentContextAuthorityObjectPreservedWithoutReconstruction ===
      true &&
    g.d2aEvidenceObjectPreservedWithoutReconstruction ===
      true &&
    g.currentContextIdentityIsSnapshotPlusSnapshotSentenceOccurrence ===
      true &&
    g.exactSnapshotIdentityJoinRequired ===
      true &&
    g.exactSnapshotSentenceOccurrenceIdentityJoinRequired ===
      true &&
    g.graphDocumentIdUsedAsContextIdentity ===
      false &&
    g.graphDocumentIdUsedAsSelector ===
      false &&
    g.sentenceNodeIdUsedAsContextIdentity ===
      false &&
    g.sentenceNodeIdUsedAsSelector ===
      false &&
    g.sentenceIndexConsistencyChecked ===
      true &&
    g.sentenceIndexIsContextIdentity ===
      false &&
    g.sentenceIndexUsedAsSelector ===
      false &&
    g.pairEvidenceOrderPreserved ===
      true &&
    g.pairEvidenceMultiplicityPreserved ===
      true &&
    g.siteTupleEvidenceConsumedNotRecomputed ===
      true &&
    g.tokenOccurrenceMatchEvidenceConsumedNotRecomputed ===
      true &&
    g.currentContextApplicabilityStateDerivedFromPreservedPairEvidence ===
      true &&
    g.applicabilityEvidenceStateIsBooleanTruth ===
      false &&
    g.runtimeSiteApplicabilityResolved ===
      true &&
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
      false &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function idPart(
  value: string,
): string {
  return `${value.length}:${value}`;
}

function authorityId(
  applicabilityEvidenceId: string,
  pairEvidenceIds: readonly string[],
): string {
  return [
    CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1,
    idPart(
      applicabilityEvidenceId,
    ),
    ...pairEvidenceIds.map(
      (id) =>
        idPart(
          id,
        ),
    ),
  ].join(
    "|",
  );
}

function domainEvidenceId(
  rootAuthorityId: string,
  pairEvidenceId: string,
): string {
  return [
    rootAuthorityId,
    "domain",
    idPart(
      pairEvidenceId,
    ),
  ].join(
    "|",
  );
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1,

    status: "blocked",

    blockingReasons: [
      ...new Set(
        reasons,
      ),
    ].sort(),
  };
}

/**
 * Resolve the complete Runtime binding occurrence-domain candidate set for one
 * exact, already-proven CURRENT context and one exact applicable Runtime site.
 *
 * This layer deliberately does not:
 *
 * - select a domain candidate;
 * - select an occurrence;
 * - bind an occurrence;
 * - evaluate binding truth;
 * - enforce cardinality;
 * - evaluate WHERE.
 *
 * A one-element domain is still only a one-element domain.
 */
export function deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
  currentApplicabilityResult:
    CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceResultV1,
): CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityResultV1 {
  if (
    !exactCurrentApplicability(
      currentApplicabilityResult,
    )
  ) {
    return blocked([
      "current_context_applicability:not_exact_ready",
    ]);
  }

  const evidence = currentApplicabilityResult.evidence;

  const sitePairs = evidence.currentContextSiteMatchingPairEvidence;

  for (
    const pair of sitePairs
  ) {
    if (
      !pair.siteIdentityMatches ||
      !pair.snapshotIdentityMatches
    ) {
      return blocked([
        "binding_occurrence_domain:site_pair_not_exact",
      ]);
    }

    const domain = pair.snapshotDomainCandidate;

    if (
      domain.snapshotIdentityId !==
        evidence.snapshotIdentityId ||
      domain.snapshotSentenceOccurrenceIdentityId !==
        evidence.snapshotSentenceOccurrenceIdentityId ||
      domain.graphDocumentId !==
        evidence.graphDocumentId ||
      domain.sentenceNodeId !==
        evidence.sentenceNodeId ||
      domain.sentenceIndex !==
        evidence.sentenceIndex
    ) {
      return blocked([
        "binding_occurrence_domain:domain_current_context_mismatch",
      ]);
    }
  }

  const rootAuthorityId = authorityId(
    evidence.currentContextApplicabilityEvidenceId,
    sitePairs.map(
      (pair) => pair.pairEvidenceId,
    ),
  );

  const bindingOccurrenceDomains:
    CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainEvidenceV1[] =
      sitePairs.map(
        (pair) => {
          const domain = pair.snapshotDomainCandidate;

          const source = domain.sourceCandidate;

          return {
            domainEvidenceId: domainEvidenceId(
              rootAuthorityId,
              pair.pairEvidenceId,
            ),

            status: "candidate_domain",

            pairEvidenceId: pair.pairEvidenceId,

            snapshotBoundDomainId: domain.snapshotBoundDomainId,

            sourceDomainCandidateId: domain.sourceDomainCandidateId,

            referencedBindingDefinitionAuthorityId:
              source.referencedBindingDefinitionAuthorityId,

            manifestId: source.manifestId,

            manifestCode: source.manifestCode,

            referencedBindingName: source.referencedBindingName,

            runtimeSuffix: source.runtimeSuffix,

            canonicalNodeType: source.canonicalNodeType,

            manifestScopeCompatibilityId: source.manifestScopeCompatibilityId,

            snapshotIdentityId: domain.snapshotIdentityId,

            snapshotSentenceOccurrenceIdentityId:
              domain.snapshotSentenceOccurrenceIdentityId,

            graphDocumentId: domain.graphDocumentId,

            sentenceNodeId: domain.sentenceNodeId,

            sentenceIndex: domain.sentenceIndex,

            occurrenceCount: domain.occurrenceCount,

            occurrences: domain.occurrences,

            sourcePairEvidence: pair,

            sourceSnapshotDomainCandidate: domain,
          };
        },
      );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1,

    status: "ready",

    sourceCurrentContextApplicabilityResult: currentApplicabilityResult,

    authority: {
      authorityId: rootAuthorityId,

      status: "proven_current_binding_occurrence_domain",

      sourceCurrentContextApplicabilityEvidenceId:
        evidence.currentContextApplicabilityEvidenceId,

      executionInvocationId: evidence.executionInvocationId,

      snapshotIdentityId: evidence.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        evidence.snapshotSentenceOccurrenceIdentityId,

      graphDocumentId: evidence.graphDocumentId,

      sentenceNodeId: evidence.sentenceNodeId,

      sentenceIndex: evidence.sentenceIndex,

      applicabilityState: evidence.applicabilityState,

      bindingOccurrenceDomains,

      bindingOccurrenceDomainCandidateCount: bindingOccurrenceDomains.length,

      sourceCurrentContextApplicabilityEvidence: evidence,

      governance: {
        exactCurrentContextApplicabilityResultRequired: true,

        exactCurrentContextApplicabilityProducerRequired: true,

        exactCurrentContextApplicabilityVersionRequired: true,

        exactUpstreamCurrentContextAuthorityLineageRequired: true,

        exactUpstreamD2aApplicabilityLineageRequired: true,

        closedCurrentContextApplicabilityPublicDerivationReexecuted: true,

        rederivedCurrentContextApplicabilityMustMatchSuppliedEvidence: true,

        privateCurrentContextAuthorityValidationSemanticsDuplicated: false,

        privateD2aValidationSemanticsDuplicated: false,

        forgedUpstreamReadyWrapperAcceptedAsProof: false,

        upstreamCurrentContextProofConsumedNotRecomputed: true,

        upstreamSiteApplicabilityConsumedNotRecomputed: true,

        currentContextApplicabilityObjectPreservedWithoutReconstruction: true,

        siteMatchingPairEvidenceConsumedNotRecomputed: true,

        siteMatchingPairEvidenceObjectIdentityPreserved: true,

        snapshotDomainCandidateObjectsPreservedWithoutReconstruction: true,

        fullSnapshotDomainOccurrenceArraysPreservedWithoutReconstruction: true,

        applicabilityMatchingOccurrenceEvidenceNotUsedAsBindingDomain: true,

        bindingIdentityReadOnlyFromPresentSourceDomains: true,

        bindingDefinitionAuthorityIdentityPreserved: true,

        manifestIdentityPreserved: true,

        referencedBindingNamePreserved: true,

        runtimeSuffixPreservedOpaque: true,

        canonicalNodeTypePreserved: true,

        manifestScopeCompatibilityIdentityPreserved: true,

        exactSnapshotIdentityRequired: true,

        exactSnapshotSentenceOccurrenceIdentityRequired: true,

        graphDocumentIdPreservedAsConsistencyMetadata: true,

        sentenceNodeIdPreservedAsConsistencyMetadata: true,

        sentenceIndexIsLocalityMetadataOnly: true,

        zeroDomainCandidatesAllowed: true,

        oneDomainCandidateDoesNotBecomeWinner: true,

        multipleDomainCandidatesPreserved: true,

        domainCandidateMultiplicityPreserved: true,

        occurrenceMultiplicityWithinEachDomainPreserved: true,

        zeroOccurrencesWithinDomainAllowed: true,

        oneOccurrenceWithinDomainDoesNotBecomeWinner: true,

        multipleOccurrencesWithinDomainPreserved: true,

        runtimeBindingOccurrenceDomainResolved: true,

        currentRuntimeSentenceContextSelected: false,

        occurrenceFilteringPerformed: false,

        domainCandidateWinnerSelected: false,

        occurrenceWinnerSelected: false,

        occurrenceBindingPerformed: false,

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
