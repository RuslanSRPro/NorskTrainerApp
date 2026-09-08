import {
  type CanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  type CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1,
} from "./canonical-surface-graph-provenance-binding-authority-v1.ts";

import {
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import {
  CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1,
  deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1,
} from "./canonical-sentence-direct-token-occurrence-domain-capability-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1,
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_VERSION_V1,
  type CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1,
  type CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-composition-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1 =
  "canonical_runtime_manifest_referenced_token_sentence_domain_snapshot_binding_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1 =
  "1" as const;

type ProvenanceBindingResultV1 = ReturnType<
  typeof deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1
>;

type ProvenanceBindingAuthorityV1 = NonNullable<
  ProvenanceBindingResultV1["authority"]
>;

type SnapshotResultV1 = Awaited<
  ReturnType<
    typeof deriveCanonicalGraphSnapshotIdentityAuthorityV1
  >
>;

type SnapshotAuthorityV1 = NonNullable<
  SnapshotResultV1["authority"]
>;

type DirectDomainResultV1 = ReturnType<
  typeof deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1
>;

type DirectDomainV1 = DirectDomainResultV1["domains"][number];

type DirectDomainOccurrenceV1 = DirectDomainV1["occurrences"][number];

export type CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1 =
  & DirectDomainOccurrenceV1
  & {
    snapshotTokenOccurrenceIdentityId: string;
  };

export type CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1 =
  {
    snapshotBoundDomainId: string;

    status: "candidate";

    sourceDomainCandidateId: string;

    snapshotAuthorityId: string;

    snapshotIdentityId: string;

    snapshotSha256: string;

    surfaceSnapshotSha256: string;

    graphStateSha256: string;

    graphVersion: "canonical-language-graph-v1";

    graphDocumentId: string;

    canonicalTokenDomainId: string;

    sentenceNodeId: string;

    sentenceIndex: number;

    snapshotSentenceOccurrenceIdentityId: string;

    occurrenceCount: number;

    occurrences: CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1[];

    sourceCandidate:
      CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1;

    governance: {
      exactReferencedTokenSentenceDomainResultRequired: true;

      exactReferencedTokenSentenceDomainCandidateRequired: true;

      exactCapturedSurfaceRequired: true;

      exactCapturedGraphRequired: true;

      exactSurfaceGraphProvenanceBindingRequired: true;

      provenanceBindingDerivedFromCapturedSurfaceAndGraph: true;

      provenanceBindingCheckedBeforeDomainProjection: true;

      provenanceBindingRecheckedAfterDomainProjection: true;

      provenanceBindingStableAcrossProjection: true;

      exactSnapshotAuthorityRequired: true;

      snapshotIdentityCheckedBeforeDomainProjection: true;

      snapshotIdentityRecheckedAfterDomainProjection: true;

      snapshotIdentityStableAcrossProjection: true;

      exactCanonicalDirectTokenDomainsRecomputedFromCapturedGraph: true;

      exactGraphDocumentProvenanceRequired: true;

      exactCanonicalTokenDomainIdentityRequired: true;

      exactSentenceOccurrenceIdentityPreserved: true;

      exactDirectTokenOccurrenceContentRequired: true;

      exactContainmentEdgeIdentityPreserved: true;

      exactSentenceTokenIndexPreserved: true;

      exactTokenGraphStatusPreserved: true;

      occurrenceOrderPreserved: true;

      occurrenceMultiplicityPreserved: true;

      sourceCandidateObjectPreservedWithoutReconstruction: true;

      snapshotSentenceOccurrenceIdentityProduced: true;

      snapshotTokenOccurrenceIdentityProduced: true;

      snapshotIdentityAndSentenceNodeIdFormDomainOccurrenceIdentity: true;

      snapshotIdentityAndTokenNodeIdFormTokenOccurrenceIdentity: true;

      graphDocumentIdUsedAsSnapshotIdentity: false;

      sentenceIndexIsOccurrenceIdentity: false;

      tokenNodeIdAloneUsedAsGlobalOccurrenceIdentity: false;

      manifestReread: false;

      runtimeScopeReinterpreted: false;

      runtimeBindingOccurrenceDomainResolved: false;

      currentRuntimeSentenceContextSelected: false;

      occurrenceFilteringPerformed: false;

      occurrenceWinnerSelected: false;

      occurrenceBindingPerformed: false;

      posHypothesesRead: false;

      posComparisonPerformed: false;

      comparisonTruthResolved: false;

      booleanTruthProduced: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingReadyV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1;

    status: "ready";

    provenanceBindingAuthorityId: string;

    snapshotAuthorityId: string;

    snapshotIdentityId: string;

    snapshotSha256: string;

    surfaceSnapshotSha256: string;

    graphStateSha256: string;

    graphDocumentId: string;

    provenanceBinding: ProvenanceBindingAuthorityV1;

    snapshotAuthority: SnapshotAuthorityV1;

    sourceDomainResult:
      CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1;

    candidates:
      CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1[];

    candidateCount: number;

    blockingReasons: [];

    governance: {
      exactReferencedTokenSentenceDomainResultRequired: true;

      sourceDomainResultObjectPreservedWithoutReconstruction: true;

      exactCapturedSurfaceRequired: true;

      exactCapturedGraphRequired: true;

      exactSurfaceGraphProvenanceBindingRequired: true;

      provenanceBindingDerivedFromCapturedSurfaceAndGraph: true;

      provenanceBindingCheckedBeforeDomainProjection: true;

      provenanceBindingRecheckedAfterDomainProjection: true;

      provenanceBindingStableAcrossProjection: true;

      exactSnapshotAuthorityRequired: true;

      snapshotIdentityCheckedBeforeDomainProjection: true;

      snapshotIdentityRecheckedAfterDomainProjection: true;

      snapshotIdentityStableAcrossProjection: true;

      exactCanonicalDirectTokenDomainsRecomputedFromCapturedGraph: true;

      allReferencedDomainCandidatesValidatedAgainstRecomputedDomains: true;

      graphDocumentIdPreservedAsProvenance: true;

      graphDocumentIdUsedAsSnapshotIdentity: false;

      sentenceNodeIdPreservedAsGraphLocalOccurrenceIdentity: true;

      sentenceIndexIsOccurrenceIdentity: false;

      tokenNodeIdAloneUsedAsGlobalOccurrenceIdentity: false;

      snapshotSentenceOccurrenceIdentityProduced: true;

      snapshotTokenOccurrenceIdentityProduced: true;

      runtimeSiteApplicabilityResolved: false;

      runtimeBindingOccurrenceDomainResolved: false;

      currentRuntimeSentenceContextSelected: false;

      occurrenceFilteringPerformed: false;

      occurrenceWinnerSelected: false;

      occurrenceBindingPerformed: false;

      posHypothesesRead: false;

      posComparisonPerformed: false;

      comparisonTruthResolved: false;

      booleanTruthProduced: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingBlockedV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1;

    status: "blocked";

    candidates: [];

    candidateCount: 0;

    blockingReasons: string[];
  };

export type CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1 =
  | CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingReadyV1
  | CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingBlockedV1;

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
): CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingBlockedV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1,

    status: "blocked",

    candidates: [],

    candidateCount: 0,

    blockingReasons: uniqueSorted(
      reasons,
    ),
  };
}

function captureCanonicalSnapshot<T>(
  value: T,
): T | null {
  try {
    return structuredClone(
      value,
    );
  } catch {
    return null;
  }
}

function exactGovernanceSubset(
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

function exactOccurrence(
  left: DirectDomainOccurrenceV1,
  right: DirectDomainOccurrenceV1,
): boolean {
  return (
    left.tokenNodeId ===
      right.tokenNodeId &&
    left.graphStatus ===
      right.graphStatus &&
    left.containmentEdgeId ===
      right.containmentEdgeId &&
    left.sentenceTokenIndex ===
      right.sentenceTokenIndex
  );
}

function exactOccurrenceArray(
  left: readonly DirectDomainOccurrenceV1[],
  right: readonly DirectDomainOccurrenceV1[],
): boolean {
  if (
    left.length !==
      right.length
  ) {
    return false;
  }

  return left.every(
    (
      occurrence,
      index,
    ) =>
      exactOccurrence(
        occurrence,
        right[index],
      ),
  );
}

function exactReferencedCandidateGovernance(
  candidate: CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1,
): boolean {
  return exactGovernanceSubset(
    candidate.governance,
    {
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
    },
  );
}

function safeReferencedCandidate(
  candidate: CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1,
): boolean {
  if (
    !present(
      candidate.id,
    ) ||
    candidate.status !==
      "candidate" ||
    !present(
      candidate.tokenPosSuffixPropertyCompatibilityId,
    ) ||
    !present(
      candidate.leafRightOperandSiteAuthorityId,
    ) ||
    !present(
      candidate.referencedBindingDefinitionAuthorityId,
    ) ||
    !present(
      candidate.manifestId,
    ) ||
    !present(
      candidate.manifestCode,
    ) ||
    !present(
      candidate.referencedBindingName,
    ) ||
    candidate.runtimeSuffix !==
      ".pos" ||
    candidate.canonicalNodeType !==
      "token" ||
    !present(
      candidate.manifestScopeCompatibilityId,
    ) ||
    !present(
      candidate.runtimeScopeLabel,
    ) ||
    candidate.canonicalBoundaryLabel !==
      "sentence" ||
    !present(
      candidate.canonicalBoundaryAuthorityId,
    ) ||
    !present(
      candidate.canonicalTokenDomainId,
    ) ||
    candidate.graphVersion !==
      "canonical-language-graph-v1" ||
    !present(
      candidate.graphDocumentId,
    ) ||
    !present(
      candidate.sentenceAuthorityId,
    ) ||
    !present(
      candidate.sentenceNodeId,
    ) ||
    !Number.isInteger(
      candidate.sentenceIndex,
    ) ||
    candidate.sentenceIndex <
      0 ||
    candidate.membershipModel !==
      "resolved_surface_contains_edge" ||
    !Array.isArray(
      candidate.occurrences,
    ) ||
    candidate.occurrenceCount !==
      candidate.occurrences.length ||
    !exactReferencedCandidateGovernance(
      candidate,
    )
  ) {
    return false;
  }

  return candidate.occurrences.every(
    (
      occurrence,
      index,
    ) =>
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
      occurrence.sentenceTokenIndex ===
        index,
  );
}

function exactReferencedDomainResult(
  result:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1,
  graph: CanonicalLanguageGraphV1,
): boolean {
  if (
    result.producer !==
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1 ||
    result.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_VERSION_V1 ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    result.graphDocumentId !==
      graph.documentId ||
    !Number.isInteger(
      result.consideredCompatibilityCount,
    ) ||
    result.consideredCompatibilityCount <
      0 ||
    !Number.isInteger(
      result.sentenceScopeCompatibleCount,
    ) ||
    result.sentenceScopeCompatibleCount <
      0
  ) {
    return false;
  }

  const seenIds = new Set<
    string
  >();

  for (
    const candidate of result.candidates
  ) {
    if (
      !safeReferencedCandidate(
        candidate,
      ) ||
      candidate.graphDocumentId !==
        result.graphDocumentId ||
      seenIds.has(
        candidate.id,
      )
    ) {
      return false;
    }

    seenIds.add(
      candidate.id,
    );
  }

  return true;
}

function exactDirectDomainResult(
  result: DirectDomainResultV1,
  graph: CanonicalLanguageGraphV1,
): boolean {
  if (
    result.producer !==
      CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1 ||
    result.producerVersion !==
      "1" ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    result.graphDocumentId !==
      graph.documentId
  ) {
    return false;
  }

  const seenDomainIds = new Set<
    string
  >();

  const seenSentenceIds = new Set<
    string
  >();

  for (
    const domain of result.domains
  ) {
    if (
      !present(
        domain.domainId,
      ) ||
      domain.status !==
        "proven" ||
      domain.graphVersion !==
        "canonical-language-graph-v1" ||
      domain.graphDocumentId !==
        graph.documentId ||
      !present(
        domain.sentenceAuthorityId,
      ) ||
      !present(
        domain.sentenceNodeId,
      ) ||
      !Number.isInteger(
        domain.sentenceIndex,
      ) ||
      domain.sentenceIndex <
        0 ||
      domain.boundaryLabel !==
        "sentence" ||
      domain.membershipModel !==
        "resolved_surface_contains_edge" ||
      domain.occurrenceCount !==
        domain.occurrences.length ||
      seenDomainIds.has(
        domain.domainId,
      ) ||
      seenSentenceIds.has(
        domain.sentenceNodeId,
      )
    ) {
      return false;
    }

    if (
      !exactGovernanceSubset(
        domain.governance,
        {
          exactSameCanonicalGraphInputRequired: true,

          exactSentenceOccurrenceAuthorityRequired: true,

          exactNeutralTokenInventoryRequired: true,

          sentenceNodeIdIsOccurrenceIdentity: true,

          directSurfaceTokenContainmentResolved: true,

          exactTokenNodeIdentityJoinRequired: true,

          exactContainmentEdgeIdentityPreserved: true,

          exactSentenceTokenIndexPreserved: true,

          exactTokenGraphStatusPreserved: true,

          membershipAuthorityDefinesDomain: true,

          zeroDirectTokensAllowed: true,

          multipleDirectTokensAllowed: true,

          deterministicSentenceTokenOrdering: true,

          sentenceIndexIsOccurrenceIdentity: false,

          sentenceIndexIsLocalityMetadataOnly: true,

          containmentInferredFromSentenceIndex: false,

          containmentInferredFromSpan: false,

          genericOccurrenceContainmentResolved: false,

          phraseContainmentResolved: false,

          predicateContainmentResolved: false,

          clauseContainmentResolved: false,

          runtimeBindingConsumed: false,

          runtimeScopeCompatibilityConsumed: false,

          runtimeBindingOccurrenceDomainResolved: false,

          runtimeScopeExecutionPerformed: false,

          whereEvaluationPerformed: false,

          cardinalityEnforcementPerformed: false,

          occurrenceBindingPerformed: false,

          occurrenceWinnerSelected: false,

          graphMutationPerformed: false,

          frozenGrammarReadOnly: true,
        },
      )
    ) {
      return false;
    }

    for (
      let index = 0;
      index <
        domain.occurrences.length;
      index++
    ) {
      const occurrence = domain.occurrences[index];

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
        occurrence.sentenceTokenIndex !==
          index
      ) {
        return false;
      }
    }

    seenDomainIds.add(
      domain.domainId,
    );

    seenSentenceIds.add(
      domain.sentenceNodeId,
    );
  }

  return true;
}

function candidateMatchesDomain(
  candidate: CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1,
  domain: DirectDomainV1,
): boolean {
  return (
    candidate.canonicalTokenDomainId ===
      domain.domainId &&
    candidate.graphVersion ===
      domain.graphVersion &&
    candidate.graphDocumentId ===
      domain.graphDocumentId &&
    candidate.sentenceAuthorityId ===
      domain.sentenceAuthorityId &&
    candidate.sentenceNodeId ===
      domain.sentenceNodeId &&
    candidate.sentenceIndex ===
      domain.sentenceIndex &&
    candidate.canonicalBoundaryLabel ===
      domain.boundaryLabel &&
    candidate.boundaryCandidateId ===
      domain.boundaryCandidateId &&
    candidate.membershipModel ===
      domain.membershipModel &&
    candidate.occurrenceCount ===
      domain.occurrenceCount &&
    exactOccurrenceArray(
      candidate.occurrences,
      domain.occurrences,
    )
  );
}

function readyProvenanceBinding(
  result: ProvenanceBindingResultV1,
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
): result is ProvenanceBindingResultV1 & {
  authority: ProvenanceBindingAuthorityV1;
} {
  if (
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    !result.authority
  ) {
    return false;
  }

  const authority = result.authority;

  return (
    authority.status ===
      "resolved" &&
    authority.surfaceVersion ===
      surface.version &&
    authority.graphVersion ===
      graph.version &&
    authority.graphDocumentId ===
      graph.documentId &&
    authority.surfaceTextLengthUtf16 ===
      surface.textLengthUtf16 &&
    authority.governance
        .expectedBaseGraphRebuiltFromExactSurface ===
      true &&
    authority.governance
        .exactSurfaceAdapterSentencesPreserved ===
      true &&
    authority.governance
        .exactSurfaceAdapterTokensPreserved ===
      true &&
    authority.governance
        .exactSurfaceAdapterContainmentEdgesPreserved ===
      true &&
    authority.governance
        .laterNonSurfaceGraphEnrichmentAllowed ===
      true &&
    authority.governance
        .graphDocumentIdUsedAsSnapshotIdentity ===
      false &&
    authority.governance
        .snapshotIdentityDerived ===
      false &&
    authority.governance
        .graphMutationPerformed ===
      false &&
    authority.governance
        .frozenGrammarReadOnly ===
      true
  );
}

function readySnapshotAuthority(
  result: SnapshotResultV1,
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
): result is SnapshotResultV1 & {
  authority: SnapshotAuthorityV1;
} {
  if (
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    !result.authority
  ) {
    return false;
  }

  const authority = result.authority;

  return (
    authority.status ===
      "resolved" &&
    present(
      authority.authorityId,
    ) &&
    present(
      authority.snapshotIdentityId,
    ) &&
    present(
      authority.snapshotSha256,
    ) &&
    present(
      authority.surfaceSnapshotSha256,
    ) &&
    present(
      authority.graphStateSha256,
    ) &&
    authority.surfaceVersion ===
      surface.version &&
    authority.graphVersion ===
      graph.version &&
    authority.graphDocumentId ===
      graph.documentId &&
    authority.surfaceTextLengthUtf16 ===
      surface.textLengthUtf16 &&
    authority.governance
        .exactSurfaceSnapshotInputRequired ===
      true &&
    authority.governance
        .exactGraphSnapshotInputRequired ===
      true &&
    authority.governance
        .fullCanonicalSurfaceSnapshotHashed ===
      true &&
    authority.governance
        .fullCanonicalGraphStateHashed ===
      true &&
    authority.governance
        .sameExactInputReproducesIdentity ===
      true &&
    authority.governance
        .graphDocumentIdPreservedAsProvenance ===
      true &&
    authority.governance
        .graphDocumentIdReinterpretedAsSnapshotIdentity ===
      false &&
    authority.governance
        .structuralNodeIdsUsedAsSnapshotIdentity ===
      false &&
    authority.governance
        .occurrenceBindingPerformed ===
      false &&
    authority.governance
        .cardinalityEnforcementPerformed ===
      false &&
    authority.governance
        .graphMutationPerformed ===
      false &&
    authority.governance
        .learnerErrorClassified ===
      false
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

function sameProvenanceBinding(
  left: ProvenanceBindingAuthorityV1,
  right: ProvenanceBindingAuthorityV1,
): boolean {
  return (
    left.authorityId ===
      right.authorityId &&
    left.status ===
      right.status &&
    left.surfaceVersion ===
      right.surfaceVersion &&
    left.graphVersion ===
      right.graphVersion &&
    left.graphDocumentId ===
      right.graphDocumentId &&
    left.surfaceTextLengthUtf16 ===
      right.surfaceTextLengthUtf16 &&
    sameStringArray(
      left.surfaceTokenIds,
      right.surfaceTokenIds,
    ) &&
    sameStringArray(
      left.surfaceSentenceIds,
      right.surfaceSentenceIds,
    ) &&
    sameStringArray(
      left.sourceAdapterNodeIds,
      right.sourceAdapterNodeIds,
    ) &&
    sameStringArray(
      left.sourceAdapterEdgeIds,
      right.sourceAdapterEdgeIds,
    ) &&
    sameStringArray(
      left.sourceAdapterProvenanceIds,
      right.sourceAdapterProvenanceIds,
    )
  );
}

function sameSnapshotAuthority(
  left: SnapshotAuthorityV1,
  right: SnapshotAuthorityV1,
): boolean {
  return (
    left.authorityId ===
      right.authorityId &&
    left.snapshotIdentityId ===
      right.snapshotIdentityId &&
    left.snapshotSha256 ===
      right.snapshotSha256 &&
    left.surfaceSnapshotSha256 ===
      right.surfaceSnapshotSha256 &&
    left.graphStateSha256 ===
      right.graphStateSha256 &&
    left.surfaceVersion ===
      right.surfaceVersion &&
    left.graphVersion ===
      right.graphVersion &&
    left.graphDocumentId ===
      right.graphDocumentId &&
    left.surfaceTextLengthUtf16 ===
      right.surfaceTextLengthUtf16
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

function snapshotSentenceOccurrenceIdentityId(
  snapshotIdentityId: string,
  sentenceNodeId: string,
): string {
  return [
    "canonical-snapshot-sentence-occurrence-v1",
    idPart(
      snapshotIdentityId,
    ),
    idPart(
      sentenceNodeId,
    ),
  ].join(
    ":",
  );
}

function snapshotTokenOccurrenceIdentityId(
  snapshotIdentityId: string,
  tokenNodeId: string,
): string {
  return [
    "canonical-snapshot-token-occurrence-v1",
    idPart(
      snapshotIdentityId,
    ),
    idPart(
      tokenNodeId,
    ),
  ].join(
    ":",
  );
}

function snapshotBoundDomainId(
  snapshotIdentityId: string,
  sourceDomainCandidateId: string,
): string {
  return [
    CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1,
    idPart(
      snapshotIdentityId,
    ),
    idPart(
      sourceDomainCandidateId,
    ),
  ].join(
    ":",
  );
}

function prefixReasons(
  prefix: string,
  reasons: readonly string[],
): string[] {
  if (
    reasons.length ===
      0
  ) {
    return [
      `${prefix}:non_exact_result`,
    ];
  }

  return reasons.map(
    (reason) => `${prefix}:${reason}`,
  );
}

export async function bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
  sourceDomainResult:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1,
): Promise<
  CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1
> {
  const capturedSurface = captureCanonicalSnapshot(
    surface,
  );

  if (
    !capturedSurface
  ) {
    return blockedResult([
      "snapshot_capture:surface_clone_failed",
    ]);
  }

  const capturedGraph = captureCanonicalSnapshot(
    graph,
  );

  if (
    !capturedGraph
  ) {
    return blockedResult([
      "snapshot_capture:graph_clone_failed",
    ]);
  }

  const bindingBefore = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
    capturedSurface,
    capturedGraph,
  );

  if (
    !readyProvenanceBinding(
      bindingBefore,
      capturedSurface,
      capturedGraph,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "surface_graph_provenance_binding_before",
        bindingBefore.blockingReasons,
      ),
    );
  }

  const provenanceBinding = bindingBefore.authority;

  const snapshotBefore = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    capturedSurface,
    capturedGraph,
  );

  if (
    !readySnapshotAuthority(
      snapshotBefore,
      capturedSurface,
      capturedGraph,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "snapshot_before",
        snapshotBefore.blockingReasons,
      ),
    );
  }

  if (
    !exactReferencedDomainResult(
      sourceDomainResult,
      capturedGraph,
    )
  ) {
    return blockedResult([
      "referenced_token_sentence_domain_result:not_exact_ready",
    ]);
  }

  const directDomainResult =
    deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
      capturedGraph,
    );

  if (
    !exactDirectDomainResult(
      directDomainResult,
      capturedGraph,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "canonical_direct_token_domain",
        directDomainResult.blockingReasons,
      ),
    );
  }

  const domainById = new Map<
    string,
    DirectDomainV1
  >();

  for (
    const domain of directDomainResult.domains
  ) {
    if (
      domainById.has(
        domain.domainId,
      )
    ) {
      return blockedResult([
        `canonical_direct_token_domain:${domain.domainId}:duplicate_id`,
      ]);
    }

    domainById.set(
      domain.domainId,
      domain,
    );
  }

  const validationReasons: string[] = [];

  for (
    const candidate of sourceDomainResult.candidates
  ) {
    const domain = domainById.get(
      candidate.canonicalTokenDomainId,
    );

    if (
      !domain
    ) {
      validationReasons.push(
        `candidate:${candidate.id}:canonical_domain_missing`,
      );

      continue;
    }

    if (
      !candidateMatchesDomain(
        candidate,
        domain,
      )
    ) {
      validationReasons.push(
        `candidate:${candidate.id}:canonical_domain_content_mismatch`,
      );

      continue;
    }

    if (
      !provenanceBinding.surfaceSentenceIds.includes(
        candidate.sentenceNodeId,
      )
    ) {
      validationReasons.push(
        `candidate:${candidate.id}:sentence_not_in_surface_provenance_binding`,
      );
    }

    for (
      const occurrence of candidate.occurrences
    ) {
      if (
        !provenanceBinding.surfaceTokenIds.includes(
          occurrence.tokenNodeId,
        )
      ) {
        validationReasons.push(
          `candidate:${candidate.id}:token:${occurrence.tokenNodeId}:not_in_surface_provenance_binding`,
        );
      }
    }
  }

  if (
    validationReasons.length >
      0
  ) {
    return blockedResult(
      validationReasons,
    );
  }

  const bindingAfter = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
    capturedSurface,
    capturedGraph,
  );

  if (
    !readyProvenanceBinding(
      bindingAfter,
      capturedSurface,
      capturedGraph,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "surface_graph_provenance_binding_after",
        bindingAfter.blockingReasons,
      ),
    );
  }

  if (
    !sameProvenanceBinding(
      provenanceBinding,
      bindingAfter.authority,
    )
  ) {
    return blockedResult([
      "surface_graph_provenance_binding:changed_during_projection",
    ]);
  }

  const snapshotAfter = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    capturedSurface,
    capturedGraph,
  );

  if (
    !readySnapshotAuthority(
      snapshotAfter,
      capturedSurface,
      capturedGraph,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "snapshot_after",
        snapshotAfter.blockingReasons,
      ),
    );
  }

  if (
    !sameSnapshotAuthority(
      snapshotBefore.authority,
      snapshotAfter.authority,
    )
  ) {
    return blockedResult([
      "snapshot_identity:changed_during_projection",
    ]);
  }

  const snapshotAuthority = snapshotAfter.authority;

  const candidates:
    CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1[] =
      sourceDomainResult.candidates.map(
        (sourceCandidate) => ({
          snapshotBoundDomainId: snapshotBoundDomainId(
            snapshotAuthority.snapshotIdentityId,
            sourceCandidate.id,
          ),

          status: "candidate",

          sourceDomainCandidateId: sourceCandidate.id,

          snapshotAuthorityId: snapshotAuthority.authorityId,

          snapshotIdentityId: snapshotAuthority.snapshotIdentityId,

          snapshotSha256: snapshotAuthority.snapshotSha256,

          surfaceSnapshotSha256: snapshotAuthority.surfaceSnapshotSha256,

          graphStateSha256: snapshotAuthority.graphStateSha256,

          graphVersion: sourceCandidate.graphVersion,

          graphDocumentId: sourceCandidate.graphDocumentId,

          canonicalTokenDomainId: sourceCandidate.canonicalTokenDomainId,

          sentenceNodeId: sourceCandidate.sentenceNodeId,

          sentenceIndex: sourceCandidate.sentenceIndex,

          snapshotSentenceOccurrenceIdentityId:
            snapshotSentenceOccurrenceIdentityId(
              snapshotAuthority.snapshotIdentityId,
              sourceCandidate.sentenceNodeId,
            ),

          occurrenceCount: sourceCandidate.occurrenceCount,

          occurrences: sourceCandidate.occurrences.map(
            (occurrence) => ({
              ...occurrence,

              snapshotTokenOccurrenceIdentityId:
                snapshotTokenOccurrenceIdentityId(
                  snapshotAuthority.snapshotIdentityId,
                  occurrence.tokenNodeId,
                ),
            }),
          ),

          sourceCandidate,

          governance: {
            exactReferencedTokenSentenceDomainResultRequired: true,

            exactReferencedTokenSentenceDomainCandidateRequired: true,

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

            exactGraphDocumentProvenanceRequired: true,

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

            manifestReread: false,

            runtimeScopeReinterpreted: false,

            runtimeBindingOccurrenceDomainResolved: false,

            currentRuntimeSentenceContextSelected: false,

            occurrenceFilteringPerformed: false,

            occurrenceWinnerSelected: false,

            occurrenceBindingPerformed: false,

            posHypothesesRead: false,

            posComparisonPerformed: false,

            comparisonTruthResolved: false,

            booleanTruthProduced: false,

            cardinalitySemanticsResolved: false,

            cardinalityEnforcementPerformed: false,

            graphMutationPerformed: false,

            learnerErrorClassified: false,

            frozenGrammarReadOnly: true,
          },
        }),
      );

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1,

    status: "ready",

    provenanceBindingAuthorityId: provenanceBinding.authorityId,

    snapshotAuthorityId: snapshotAuthority.authorityId,

    snapshotIdentityId: snapshotAuthority.snapshotIdentityId,

    snapshotSha256: snapshotAuthority.snapshotSha256,

    surfaceSnapshotSha256: snapshotAuthority.surfaceSnapshotSha256,

    graphStateSha256: snapshotAuthority.graphStateSha256,

    graphDocumentId: capturedGraph.documentId,

    provenanceBinding,

    snapshotAuthority,

    sourceDomainResult,

    candidates,

    candidateCount: candidates.length,

    blockingReasons: [],

    governance: {
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

      posHypothesesRead: false,

      posComparisonPerformed: false,

      comparisonTruthResolved: false,

      booleanTruthProduced: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,

      frozenGrammarReadOnly: true,
    },
  };
}
