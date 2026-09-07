import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1,
  type CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1,
} from "./canonical-runtime-manifest-token-pos-suffix-property-compatibility-v1.ts";
import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1,
  type CanonicalRuntimeManifestBindingScopeCompatibilityResultV1,
  type CanonicalRuntimeManifestBindingScopeCompatibilityV1,
} from "./canonical-runtime-manifest-binding-scope-compatibility-v1.ts";
import {
  CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1,
  type CanonicalSentenceDirectTokenDomainOccurrenceV1,
  type CanonicalSentenceDirectTokenOccurrenceDomainResultV1,
  type CanonicalSentenceDirectTokenOccurrenceDomainV1,
} from "./canonical-sentence-direct-token-occurrence-domain-capability-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1 =
  "canonical_runtime_manifest_referenced_token_sentence_domain_composition_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_VERSION_V1 =
  "1" as const;

export type CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1 = {
  id: string;
  status: "candidate";

  tokenPosSuffixPropertyCompatibilityId: string;
  leafRightOperandSiteAuthorityId: string;

  referencedBindingDefinitionAuthorityId: string;
  manifestId: string;
  manifestCode: string;
  referencedBindingName: string;

  runtimeSuffix: ".pos";
  canonicalNodeType: "token";

  manifestScopeCompatibilityId: string;
  runtimeScopeLabel: string;
  canonicalBoundaryLabel: "sentence";
  canonicalBoundaryAuthorityId: string;

  canonicalTokenDomainId: string;
  graphVersion: "canonical-language-graph-v1";
  graphDocumentId: string;
  sentenceAuthorityId: string;
  sentenceNodeId: string;
  sentenceIndex: number;
  boundaryCandidateId: string | null;
  membershipModel: "resolved_surface_contains_edge";

  occurrences: CanonicalSentenceDirectTokenDomainOccurrenceV1[];
  occurrenceCount: number;

  rightOperandSnapshot: unknown;

  governance: {
    exactA46b2ResultRequired: true;
    exactA46b2AuthorityRequired: true;
    exactManifestScopeCompatibilityResultRequired: true;
    exactManifestScopeCompatibilityAuthorityRequired: true;
    exactReferencedBindingIdentityRequired: true;
    ownerBindingExcludedFromScopeJoin: true;
    exactCanonicalSentenceBoundaryRequired: true;
    exactCanonicalTokenDomainResultRequired: true;
    exactCanonicalTokenDomainRequired: true;

    exactGraphDocumentIdentityPreserved: true;
    exactSentenceOccurrenceIdentityPreserved: true;
    sentenceIndexIsOccurrenceIdentity: false;
    sentenceIndexIsLocalityMetadataOnly: true;
    exactDirectTokenOccurrenceIdentityPreserved: true;
    exactContainmentEdgeIdentityPreserved: true;
    exactSentenceTokenIndexPreserved: true;
    exactTokenGraphStatusPreserved: true;

    rightOperandSnapshotPreserved: true;
    rightOperandSnapshotDetached: true;

    sentenceDomainCandidateProjected: true;
    oneCandidatePerSentenceOccurrence: true;
    zeroTokenOccurrencesPreserved: true;
    multipleTokenOccurrencesPreserved: true;

    currentRuntimeSentenceContextSelected: false;
    runtimeBindingOccurrenceDomainResolved: false;
    occurrenceWinnerSelected: false;
    occurrenceBindingPerformed: false;

    posHypothesesRead: false;
    posHypothesisSelected: false;

    rightOperandRead: false;
    rightOperandCompared: false;
    operatorSemanticsResolved: false;
    whereEvaluationPerformed: false;
    cardinalityEnforcementPerformed: false;

    containmentInferredFromSentenceIndex: false;

    graphMutationPerformed: false;
    learnerErrorClassified: false;

    candidateOnly: true;
    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_VERSION_V1;
    status: "ready" | "blocked";

    graphDocumentId: string | null;
    candidates:
      CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1[];

    consideredCompatibilityCount: number;
    sentenceScopeCompatibleCount: number;

    unmappedReferencedScopeCompatibilityKeys: string[];
    nonSentenceReferencedScopeCompatibilityKeys: string[];

    blockingReasons: string[];
  };

function present(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function cloneSnapshot<T>(value: T): T {
  return structuredClone(value);
}

function exactGovernance(
  governance: unknown,
  expected: Readonly<Record<string, unknown>>,
): boolean {
  if (
    governance === null ||
    typeof governance !== "object" ||
    Array.isArray(governance)
  ) {
    return false;
  }

  const actual = governance as Record<string, unknown>;

  return Object.entries(expected).every(([key, value]) =>
    actual[key] === value
  );
}

const EXPECTED_A46B2_GOVERNANCE = {
  exactA46a2bResultRequired: true,
  exactA46a2bAuthorityRequired: true,
  exactEntityCompatibilityResultRequired: true,
  exactEntityCompatibilityAuthorityRequired: true,
  exactTokenPosPropertyCapabilityResultRequired: true,
  exactTokenPosPropertyCapabilityRequired: true,
  referencedBindingIdentityMatchRequired: true,
  ownerBindingExcludedFromEntityJoin: true,
  exactOpaqueSuffixMatch: true,
  exactCanonicalTokenCompatibilityRequired: true,
  rootedBindingIdentityPreserved: true,
  entityCompatibilityConsumedNotReconstructed: true,
  tokenPosCapabilityConsumedNotReconstructed: true,
  compatibilityOnly: true,
  candidateOnly: true,
  rightOperandSnapshotPreserved: true,
  rightOperandSnapshotDetached: true,
  runtimeCandidatePosMapped: false,
  runtimePhrasePosMapped: false,
  propertyValueIsScalar: false,
  propertyValueIsHypothesisSet: true,
  posHypothesisSelected: false,
  rightOperandRead: false,
  rightOperandCompared: false,
  operatorSemanticsResolved: false,
  whereEqExecuted: false,
  referenceValueResolved: false,
  dottedReferenceTraversalPerformed: false,
  canonicalFactOwnershipResolved: false,
  occurrenceEnumerationPerformed: false,
  occurrenceBindingPerformed: false,
  runtimeScopeExecutionPerformed: false,
  sentenceMembershipResolved: false,
  clauseContainmentResolved: false,
  cardinalityEnforcementPerformed: false,
  canonicalDependencyEdgeGenerated: false,
  grammaticalFunctionResolved: false,
  complementArgumentAttachmentResolved: false,
  realizesSlotGenerated: false,
  graphMutationPerformed: false,
  learnerErrorClassified: false,
  frozenGrammarReadOnly: true,
} as const;

const EXPECTED_SCOPE_GOVERNANCE = {
  exactA43a1ResultRequired: true,
  exactManifestBindingDefinitionAuthorityRequired: true,
  exactCanonicalBoundaryAuthorityRequired: true,
  exactOpaqueLabelMatch: true,
  runtimeScopeVocabularyHardcoded: false,
  runtimeScopeLabelNormalized: false,
  caseFoldingPerformed: false,
  canonicalBoundaryInferredFromName: false,
  canonicalBoundaryAuthorityIdentityPreserved: true,
  canonicalBoundaryAuthoritySourcePreservedOpaque: true,
  scopeSemanticsResolved: false,
  containmentResolved: false,
  sentenceIdentityResolved: false,
  phraseContainmentResolved: false,
  clauseContainmentResolved: false,
  selfSemanticsResolved: false,
  occurrenceDomainResolved: false,
  occurrenceEnumerationPerformed: false,
  occurrenceBindingPerformed: false,
  whereSemanticsResolved: false,
  cardinalitySemanticsResolved: false,
  actionFamilySemanticsResolved: false,
  roleSemanticsResolved: false,
  grammaticalFunctionResolved: false,
  subjectOfRelationInferred: false,
  winnerSelected: false,
  graphMutationPerformed: false,
  compatibilityOnly: true,
  candidateOnly: true,
  frozenGrammarReadOnly: true,
} as const;

const EXPECTED_DOMAIN_GOVERNANCE = {
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
} as const;

function compatibilityKey(
  candidate: CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1,
): string {
  return JSON.stringify([
    candidate.id,
    candidate.referencedBindingDefinitionAuthorityId,
    candidate.manifestId,
    candidate.manifestCode,
    candidate.referencedBindingName,
  ]);
}

function scopeIdentity(
  candidate: CanonicalRuntimeManifestBindingScopeCompatibilityV1,
): string {
  return JSON.stringify([
    candidate.bindingDefinitionAuthorityId,
    candidate.manifestId,
    candidate.manifestCode,
    candidate.bindingName,
  ]);
}

function safeA46b2(
  candidate: CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1,
): boolean {
  return (
    candidate.status === "candidate" &&
    present(candidate.id) &&
    present(candidate.leafRightOperandSiteAuthorityId) &&
    present(candidate.referencedBindingDefinitionAuthorityId) &&
    present(candidate.manifestId) &&
    present(candidate.manifestCode) &&
    present(candidate.referencedBindingName) &&
    candidate.runtimeSuffix === ".pos" &&
    candidate.canonicalNodeType === "token" &&
    exactGovernance(candidate.governance, EXPECTED_A46B2_GOVERNANCE)
  );
}

function safeScope(
  candidate: CanonicalRuntimeManifestBindingScopeCompatibilityV1,
): boolean {
  return (
    candidate.status === "candidate" &&
    present(candidate.id) &&
    present(candidate.bindingDefinitionAuthorityId) &&
    present(candidate.manifestId) &&
    present(candidate.manifestCode) &&
    present(candidate.bindingName) &&
    present(candidate.runtimeScopeLabel) &&
    present(candidate.canonicalBoundaryLabel) &&
    present(candidate.canonicalBoundaryAuthorityId) &&
    present(candidate.canonicalBoundaryAuthoritySource) &&
    exactGovernance(candidate.governance, EXPECTED_SCOPE_GOVERNANCE)
  );
}

function safeDomain(
  domain: CanonicalSentenceDirectTokenOccurrenceDomainV1,
): boolean {
  return (
    domain.status === "proven" &&
    present(domain.domainId) &&
    domain.graphVersion === "canonical-language-graph-v1" &&
    present(domain.graphDocumentId) &&
    present(domain.sentenceAuthorityId) &&
    present(domain.sentenceNodeId) &&
    Number.isInteger(domain.sentenceIndex) &&
    domain.boundaryLabel === "sentence" &&
    (
      domain.boundaryCandidateId === null ||
      present(domain.boundaryCandidateId)
    ) &&
    domain.membershipModel === "resolved_surface_contains_edge" &&
    Array.isArray(domain.occurrences) &&
    domain.occurrenceCount === domain.occurrences.length &&
    domain.occurrences.every((occurrence) =>
      present(occurrence.tokenNodeId) &&
      present(occurrence.containmentEdgeId) &&
      Number.isInteger(occurrence.sentenceTokenIndex) &&
      typeof occurrence.graphStatus === "string"
    ) &&
    exactGovernance(domain.governance, EXPECTED_DOMAIN_GOVERNANCE)
  );
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_VERSION_V1,
    status: "blocked",
    graphDocumentId: null,
    candidates: [],
    consideredCompatibilityCount: 0,
    sentenceScopeCompatibleCount: 0,
    unmappedReferencedScopeCompatibilityKeys: [],
    nonSentenceReferencedScopeCompatibilityKeys: [],
    blockingReasons: uniqueSorted(reasons),
  };
}

export function deriveCanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionsV1(
  compatibilityResult:
    CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1,
  scopeResult: CanonicalRuntimeManifestBindingScopeCompatibilityResultV1,
  tokenDomainResult: CanonicalSentenceDirectTokenOccurrenceDomainResultV1,
): CanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionResultV1 {
  const blockingReasons: string[] = [];

  if (
    compatibilityResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1 ||
    compatibilityResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1 ||
    compatibilityResult.status !== "ready" ||
    compatibilityResult.blockingReasons.length !== 0 ||
    compatibilityResult.compatibleTokenEntitySiteCount !==
      compatibilityResult.candidates.length
  ) {
    blockingReasons.push("a4_6b2_result:not_exact_ready");
  }

  if (
    scopeResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1 ||
    scopeResult.producerVersion !== "1" ||
    scopeResult.status !== "ready" ||
    scopeResult.blockingReasons.length !== 0
  ) {
    blockingReasons.push("manifest_scope_result:not_exact_ready");
  }

  if (
    tokenDomainResult.producer !==
      CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1 ||
    tokenDomainResult.producerVersion !== "1" ||
    tokenDomainResult.status !== "ready" ||
    tokenDomainResult.blockingReasons.length !== 0
  ) {
    blockingReasons.push("token_domain_result:not_exact_ready");
  }

  const seenCompatibilityIds = new Set<string>();

  for (const candidate of compatibilityResult.candidates) {
    if (!safeA46b2(candidate)) {
      blockingReasons.push(`a4_6b2:${candidate.id}:unsafe_contract`);
    }

    if (seenCompatibilityIds.has(candidate.id)) {
      blockingReasons.push(`a4_6b2:${candidate.id}:duplicate_id`);
    }

    seenCompatibilityIds.add(candidate.id);
  }

  const seenScopeIds = new Set<string>();
  const seenScopeIdentities = new Set<string>();

  for (const candidate of scopeResult.candidates) {
    if (!safeScope(candidate)) {
      blockingReasons.push(`manifest_scope:${candidate.id}:unsafe_contract`);
    }

    if (seenScopeIds.has(candidate.id)) {
      blockingReasons.push(`manifest_scope:${candidate.id}:duplicate_id`);
    }

    seenScopeIds.add(candidate.id);

    const identity = scopeIdentity(candidate);

    if (seenScopeIdentities.has(identity)) {
      blockingReasons.push(
        `manifest_scope:${identity}:duplicate_exact_binding_identity`,
      );
    }

    seenScopeIdentities.add(identity);
  }

  const seenDomainIds = new Set<string>();
  const seenSentenceNodeIds = new Set<string>();

  for (const domain of tokenDomainResult.domains) {
    if (!safeDomain(domain)) {
      blockingReasons.push(`token_domain:${domain.domainId}:unsafe_contract`);
    }

    if (seenDomainIds.has(domain.domainId)) {
      blockingReasons.push(`token_domain:${domain.domainId}:duplicate_id`);
    }

    seenDomainIds.add(domain.domainId);

    if (seenSentenceNodeIds.has(domain.sentenceNodeId)) {
      blockingReasons.push(
        `sentence:${domain.sentenceNodeId}:duplicate_token_domain`,
      );
    }

    seenSentenceNodeIds.add(domain.sentenceNodeId);

    if (
      tokenDomainResult.graphDocumentId === null ||
      domain.graphDocumentId !== tokenDomainResult.graphDocumentId
    ) {
      blockingReasons.push(
        `token_domain:${domain.domainId}:graph_document_identity_mismatch`,
      );
    }
  }

  if (blockingReasons.length !== 0) {
    return blocked(blockingReasons);
  }

  const candidates:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainCandidateV1[] = [];

  const unmappedReferencedScopeCompatibilityKeys: string[] = [];
  const nonSentenceReferencedScopeCompatibilityKeys: string[] = [];

  let consideredCompatibilityCount = 0;
  let sentenceScopeCompatibleCount = 0;

  for (const compatibility of compatibilityResult.candidates) {
    consideredCompatibilityCount += 1;

    for (const scope of scopeResult.candidates) {
      const sameAuthority = scope.bindingDefinitionAuthorityId ===
        compatibility.referencedBindingDefinitionAuthorityId;

      const sameManifestAndName =
        scope.manifestId === compatibility.manifestId &&
        scope.manifestCode === compatibility.manifestCode &&
        scope.bindingName === compatibility.referencedBindingName;

      if (sameAuthority && !sameManifestAndName) {
        blockingReasons.push(
          `referenced_scope:${compatibility.id}:binding_identity_mismatch`,
        );
      }

      if (!sameAuthority && sameManifestAndName) {
        blockingReasons.push(
          `referenced_scope:${compatibility.id}:binding_authority_id_mismatch`,
        );
      }
    }

    const exactScopes = scopeResult.candidates.filter((scope) =>
      scope.bindingDefinitionAuthorityId ===
        compatibility.referencedBindingDefinitionAuthorityId &&
      scope.manifestId === compatibility.manifestId &&
      scope.manifestCode === compatibility.manifestCode &&
      scope.bindingName === compatibility.referencedBindingName
    );

    if (exactScopes.length === 0) {
      unmappedReferencedScopeCompatibilityKeys.push(
        compatibilityKey(compatibility),
      );
      continue;
    }

    if (exactScopes.length !== 1) {
      blockingReasons.push(
        `referenced_scope:${compatibility.id}:duplicate_exact_scope_identity`,
      );
      continue;
    }

    const scope = exactScopes[0]!;

    if (scope.canonicalBoundaryLabel !== "sentence") {
      nonSentenceReferencedScopeCompatibilityKeys.push(
        compatibilityKey(compatibility),
      );
      continue;
    }

    sentenceScopeCompatibleCount += 1;

    for (const domain of tokenDomainResult.domains) {
      candidates.push({
        id: [
          CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1,
          compatibility.id,
          scope.id,
          domain.domainId,
        ].join(":"),

        status: "candidate",

        tokenPosSuffixPropertyCompatibilityId: compatibility.id,
        leafRightOperandSiteAuthorityId:
          compatibility.leafRightOperandSiteAuthorityId,

        referencedBindingDefinitionAuthorityId:
          compatibility.referencedBindingDefinitionAuthorityId,
        manifestId: compatibility.manifestId,
        manifestCode: compatibility.manifestCode,
        referencedBindingName: compatibility.referencedBindingName,

        runtimeSuffix: ".pos",
        canonicalNodeType: "token",

        manifestScopeCompatibilityId: scope.id,
        runtimeScopeLabel: scope.runtimeScopeLabel,
        canonicalBoundaryLabel: "sentence",
        canonicalBoundaryAuthorityId: scope.canonicalBoundaryAuthorityId,

        canonicalTokenDomainId: domain.domainId,
        graphVersion: domain.graphVersion,
        graphDocumentId: domain.graphDocumentId,
        sentenceAuthorityId: domain.sentenceAuthorityId,
        sentenceNodeId: domain.sentenceNodeId,
        sentenceIndex: domain.sentenceIndex,
        boundaryCandidateId: domain.boundaryCandidateId,
        membershipModel: domain.membershipModel,

        occurrences: cloneSnapshot(domain.occurrences),
        occurrenceCount: domain.occurrenceCount,

        rightOperandSnapshot: cloneSnapshot(
          compatibility.rightOperandSnapshot,
        ),

        governance: {
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
      });
    }
  }

  if (blockingReasons.length !== 0) {
    return blocked(blockingReasons);
  }

  candidates.sort((a, b) => a.id.localeCompare(b.id));

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_VERSION_V1,
    status: "ready",
    graphDocumentId: tokenDomainResult.graphDocumentId,
    candidates,
    consideredCompatibilityCount,
    sentenceScopeCompatibleCount,
    unmappedReferencedScopeCompatibilityKeys: uniqueSorted(
      unmappedReferencedScopeCompatibilityKeys,
    ),
    nonSentenceReferencedScopeCompatibilityKeys: uniqueSorted(
      nonSentenceReferencedScopeCompatibilityKeys,
    ),
    blockingReasons: [],
  };
}
