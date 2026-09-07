import {
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1,
  deriveCanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionsV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-composition-v1.ts";
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const A46_GOVERNANCE = {
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

const SCOPE_GOVERNANCE = {
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

const DOMAIN_GOVERNANCE = {
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

function compatibility(
  overrides: Partial<
    CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1
  > = {},
): CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1 {
  return {
    id: "a46:tokenRef.pos",
    status: "candidate",
    leafRightOperandSiteAuthorityId: "site:subject:tokenRef.pos",
    referenceRootAuthorityId: "root:tokenRef",
    referenceExpressionAuthorityId: "reference:tokenRef.pos",
    whereShapeAuthorityId: "where:subject",
    ownerBindingDefinitionAuthorityId: "binding:subject",
    manifestId: "manifest:a",
    manifestCode: "ir.a",
    ownerBindingName: "subject",
    referencedBindingDefinitionAuthorityId: "binding:tokenRef",
    referencedBindingName: "tokenRef",
    leafPath: "$.bindings.subject.where",
    operatorLabelOpaque: "eq",
    leftReferenceExpression: "tokenRef.pos",
    runtimeSuffix: ".pos",
    entityCompatibilityId: "entity:tokenRef",
    runtimeEntityLabel: "token",
    canonicalNodeType: "token",
    canonicalNodeTypeAuthorityId: "canonical-node-type:token",
    canonicalPropertyCapabilityId: "canonical-token-pos-property",
    canonicalPropertyDomain: "canonical_token_occurrence",
    canonicalPropertyKind: "pos_hypothesis_set",
    canonicalFactNodeType: "lexical_reading",
    canonicalFactNodeSubtype: "pos_candidate",
    canonicalFactLabelFeature: "pos",
    rightOperandSnapshot: { expected: "NOUN" },
    governance: { ...A46_GOVERNANCE },
    ...overrides,
  };
}

function compatibilityResult(
  candidates: CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1[] =
    [
      compatibility(),
    ],
): CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1,
    status: "ready",
    candidates,
    consideredPosReferenceSiteCount: candidates.length,
    compatibleTokenEntitySiteCount: candidates.length,
    unmappedPosReferenceSiteKeys: [],
    ignoredNonPosSuffixSiteKeys: [],
    blockingReasons: [],
  };
}

function scopeCandidate(
  overrides: Partial<CanonicalRuntimeManifestBindingScopeCompatibilityV1> = {},
): CanonicalRuntimeManifestBindingScopeCompatibilityV1 {
  return {
    id: "scope:tokenRef:sentence",
    status: "candidate",
    bindingDefinitionAuthorityId: "binding:tokenRef",
    manifestId: "manifest:a",
    manifestCode: "ir.a",
    bindingName: "tokenRef",
    runtimeScopeLabel: "sentence",
    canonicalBoundaryLabel: "sentence",
    canonicalBoundaryAuthorityId: "canonical-boundary:sentence",
    canonicalBoundaryAuthoritySource: "canonical_language_graph_core_v1",
    governance: { ...SCOPE_GOVERNANCE },
    ...overrides,
  };
}

function scopeResult(
  candidates: CanonicalRuntimeManifestBindingScopeCompatibilityV1[] = [
    scopeCandidate(),
  ],
): CanonicalRuntimeManifestBindingScopeCompatibilityResultV1 {
  return {
    producer: CANONICAL_RUNTIME_MANIFEST_BINDING_SCOPE_COMPATIBILITY_V1,
    producerVersion: "1",
    status: "ready",
    candidates,
    unmappedBindingDefinitionAuthorityIds: [],
    blockingReasons: [],
  };
}

function occurrence(
  tokenNodeId = "token:1",
  sentenceTokenIndex = 0,
): CanonicalSentenceDirectTokenDomainOccurrenceV1 {
  return {
    tokenNodeId,
    graphStatus: "resolved",
    containmentEdgeId: `contains:${tokenNodeId}`,
    sentenceTokenIndex,
  };
}

function domain(
  overrides: Partial<CanonicalSentenceDirectTokenOccurrenceDomainV1> = {},
): CanonicalSentenceDirectTokenOccurrenceDomainV1 {
  const occurrences = overrides.occurrences ?? [occurrence()];

  return {
    domainId: "domain:sentence:1",
    status: "proven",
    graphVersion: "canonical-language-graph-v1",
    graphDocumentId: "document:1",
    sentenceAuthorityId: "sentence-authority:sentence:1",
    sentenceNodeId: "sentence:1",
    sentenceIndex: 0,
    boundaryLabel: "sentence",
    boundaryCandidateId: null,
    membershipModel: "resolved_surface_contains_edge",
    governance: { ...DOMAIN_GOVERNANCE },
    ...overrides,
    occurrences,
    occurrenceCount: overrides.occurrenceCount ?? occurrences.length,
  };
}

function domainResult(
  domains: CanonicalSentenceDirectTokenOccurrenceDomainV1[] = [domain()],
  graphDocumentId = "document:1",
): CanonicalSentenceDirectTokenOccurrenceDomainResultV1 {
  return {
    producer: CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1,
    producerVersion: "1",
    status: "ready",
    graphDocumentId,
    domains,
    blockingReasons: [],
  };
}

function derive(
  compatibilityInput = compatibilityResult(),
  scopeInput = scopeResult(),
  domainInput = domainResult(),
) {
  return deriveCanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionsV1(
    compatibilityInput,
    scopeInput,
    domainInput,
  );
}

Deno.test("A4.6b3a.1 exact referenced token + sentence scope projects one candidate per exact sentence occurrence", () => {
  const result = derive();
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 1, JSON.stringify(result));
  const candidate = result.candidates[0]!;
  assert(
    candidate.referencedBindingName === "tokenRef",
    JSON.stringify(candidate),
  );
  assert(candidate.canonicalNodeType === "token", JSON.stringify(candidate));
  assert(
    candidate.canonicalBoundaryLabel === "sentence",
    JSON.stringify(candidate),
  );
  assert(candidate.sentenceNodeId === "sentence:1", JSON.stringify(candidate));
});

Deno.test("A4.6b3a.2 multiple sentence occurrences remain independent candidates", () => {
  const first = domain();
  const second = domain({
    domainId: "domain:sentence:2",
    sentenceAuthorityId: "sentence-authority:sentence:2",
    sentenceNodeId: "sentence:2",
    sentenceIndex: 1,
    occurrences: [occurrence("token:2", 0)],
  });
  const result = derive(
    compatibilityResult(),
    scopeResult(),
    domainResult([first, second]),
  );
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 2, JSON.stringify(result));
  const ids = new Set(result.candidates.map((x) => x.sentenceNodeId));
  assert(
    ids.has("sentence:1") && ids.has("sentence:2"),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.3 zero sentence domains remains ready with zero candidates", () => {
  const result = derive(
    compatibilityResult(),
    scopeResult(),
    domainResult([]),
  );
  assert(
    result.status === "ready" &&
      result.candidates.length === 0 &&
      result.blockingReasons.length === 0,
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.4 zero token occurrences inside exact sentence domain are preserved", () => {
  const empty = domain({ occurrences: [], occurrenceCount: 0 });
  const result = derive(
    compatibilityResult(),
    scopeResult(),
    domainResult([empty]),
  );
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 1, JSON.stringify(result));
  assert(result.candidates[0]!.occurrenceCount === 0, JSON.stringify(result));
  assert(
    result.candidates[0]!.occurrences.length === 0,
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.5 multiple token occurrences inside domain are all preserved", () => {
  const source = domain({
    occurrences: [occurrence("token:1", 0), occurrence("token:2", 1)],
  });
  const input = domainResult([source]);
  const result = derive(compatibilityResult(), scopeResult(), input);
  assert(result.status === "ready", JSON.stringify(result));
  const candidate = result.candidates[0]!;
  assert(candidate.occurrenceCount === 2, JSON.stringify(candidate));
  assert(
    candidate.occurrences[0]!.tokenNodeId === "token:1",
    JSON.stringify(candidate),
  );
  assert(
    candidate.occurrences[1]!.tokenNodeId === "token:2",
    JSON.stringify(candidate),
  );
  source.occurrences[0]!.tokenNodeId = "mutated";
  assert(
    candidate.occurrences[0]!.tokenNodeId === "token:1",
    JSON.stringify(candidate),
  );
});

Deno.test("A4.6b3a.6 scope join uses REFERENCED binding identity not owner binding", () => {
  const c = compatibility({
    ownerBindingDefinitionAuthorityId: "binding:owner",
    ownerBindingName: "owner",
    referencedBindingDefinitionAuthorityId: "binding:tokenRef",
    referencedBindingName: "tokenRef",
  });
  const result = derive(compatibilityResult([c]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 1, JSON.stringify(result));
  assert(
    result.candidates[0]!.referencedBindingDefinitionAuthorityId ===
      "binding:tokenRef",
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.7 owner-only scope compatibility cannot satisfy referenced binding", () => {
  const ownerScope = scopeCandidate({
    id: "scope:owner",
    bindingDefinitionAuthorityId: "binding:subject",
    bindingName: "subject",
  });
  const result = derive(
    compatibilityResult(),
    scopeResult([ownerScope]),
  );
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unmappedReferencedScopeCompatibilityKeys.length === 1,
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.8 non-sentence canonical boundary produces no domain candidate", () => {
  const nonSentence = scopeCandidate({
    canonicalBoundaryLabel: "clause",
    canonicalBoundaryAuthorityId: "canonical-boundary:clause",
  });
  const result = derive(
    compatibilityResult(),
    scopeResult([nonSentence]),
  );
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.nonSentenceReferencedScopeCompatibilityKeys.length === 1,
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.9 missing referenced scope compatibility is non-blocking unmapped", () => {
  const result = derive(
    compatibilityResult(),
    scopeResult([]),
  );
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unmappedReferencedScopeCompatibilityKeys.length === 1,
    JSON.stringify(result),
  );
  assert(result.blockingReasons.length === 0, JSON.stringify(result));
});

Deno.test("A4.6b3a.10 phrase or clause scope candidate cannot bypass A4.6b2 token proof", () => {
  for (const boundary of ["phrase", "clause"]) {
    const s = scopeCandidate({
      canonicalBoundaryLabel: boundary,
      canonicalBoundaryAuthorityId: `canonical-boundary:${boundary}`,
    });
    const result = derive(
      compatibilityResult(),
      scopeResult([s]),
    );
    assert(result.status === "ready", JSON.stringify(result));
    assert(result.candidates.length === 0, JSON.stringify(result));
  }
});

Deno.test("A4.6b3a.11 sentenceNodeId identity preserved independently of sentenceIndex", () => {
  const d = domain({
    sentenceNodeId: "sentence:exact",
    sentenceAuthorityId: "sentence-authority:exact",
    sentenceIndex: 77,
  });
  const result = derive(
    compatibilityResult(),
    scopeResult(),
    domainResult([d]),
  );
  const candidate = result.candidates[0]!;
  assert(
    candidate.sentenceNodeId === "sentence:exact",
    JSON.stringify(candidate),
  );
  assert(candidate.sentenceIndex === 77, JSON.stringify(candidate));
  assert(
    candidate.governance.sentenceIndexIsOccurrenceIdentity === false,
    JSON.stringify(candidate),
  );
});

Deno.test("A4.6b3a.12 sentenceIndex change cannot become occurrence identity", () => {
  const first = domain({
    domainId: "domain:a",
    sentenceNodeId: "sentence:same",
    sentenceAuthorityId: "sentence-authority:same",
    sentenceIndex: 0,
  });
  const second = domain({
    domainId: "domain:b",
    sentenceNodeId: "sentence:same",
    sentenceAuthorityId: "sentence-authority:same",
    sentenceIndex: 999,
  });
  const result = derive(
    compatibilityResult(),
    scopeResult(),
    domainResult([first, second]),
  );
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("duplicate_token_domain")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.13 direct tokenNodeId identities preserved exactly", () => {
  const d = domain({
    occurrences: [
      occurrence("token:alpha", 0),
      occurrence("token:beta", 1),
      occurrence("token:gamma", 2),
    ],
  });
  const result = derive(
    compatibilityResult(),
    scopeResult(),
    domainResult([d]),
  );
  const ids = result.candidates[0]!.occurrences.map((x) => x.tokenNodeId);
  assert(
    JSON.stringify(ids) ===
      JSON.stringify(["token:alpha", "token:beta", "token:gamma"]),
    JSON.stringify(ids),
  );
});

Deno.test("A4.6b3a.14 right operand remains detached and unread", () => {
  const c = compatibility({
    rightOperandSnapshot: { expected: { labels: ["NOUN"] } },
  });
  const result = derive(compatibilityResult([c]));
  const snapshot = result.candidates[0]!.rightOperandSnapshot as {
    expected: { labels: string[] };
  };
  const original = c.rightOperandSnapshot as {
    expected: { labels: string[] };
  };
  original.expected.labels.push("VERB");
  assert(
    JSON.stringify(snapshot.expected.labels) === JSON.stringify(["NOUN"]),
    JSON.stringify(snapshot),
  );
  assert(
    result.candidates[0]!.governance.rightOperandRead === false,
    JSON.stringify(result),
  );
  assert(
    result.candidates[0]!.governance.rightOperandCompared === false,
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.15 stale A4.6b2 authority governance blocks", () => {
  const c = compatibility();
  const stale = {
    ...c,
    governance: {
      ...c.governance,
      occurrenceBindingPerformed: true,
    },
  } as unknown as CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1;
  const result = derive(compatibilityResult([stale]));
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("unsafe_contract")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.16 stale manifest scope authority governance blocks", () => {
  const s = scopeCandidate();
  const stale = {
    ...s,
    governance: {
      ...s.governance,
      sentenceIdentityResolved: true,
    },
  } as unknown as CanonicalRuntimeManifestBindingScopeCompatibilityV1;
  const result = derive(
    compatibilityResult(),
    scopeResult([stale]),
  );
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("unsafe_contract")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.17 stale direct-token domain governance blocks", () => {
  const d = domain();
  const stale = {
    ...d,
    governance: {
      ...d.governance,
      occurrenceBindingPerformed: true,
    },
  } as unknown as CanonicalSentenceDirectTokenOccurrenceDomainV1;
  const result = derive(
    compatibilityResult(),
    scopeResult(),
    domainResult([stale]),
  );
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("unsafe_contract")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.18 duplicate A4.6b2 authority id blocks", () => {
  const c = compatibility();
  const duplicate = { ...c };
  const result = derive(compatibilityResult([c, duplicate]));
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("duplicate_id")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.19 duplicate manifest scope authority id blocks", () => {
  const s = scopeCandidate();
  const duplicate = { ...s };
  const result = derive(
    compatibilityResult(),
    scopeResult([s, duplicate]),
  );
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("duplicate_id")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.20 duplicate exact referenced scope identity blocks", () => {
  const first = scopeCandidate();
  const second = scopeCandidate({ id: "scope:tokenRef:sentence:copy" });
  const result = derive(
    compatibilityResult(),
    scopeResult([first, second]),
  );
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) =>
      x.includes("duplicate_exact_binding_identity")
    ),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.21 referenced binding authority-id identity corruption blocks", () => {
  const corrupted = scopeCandidate({
    bindingDefinitionAuthorityId: "binding:tokenRef",
    manifestCode: "ir.changed",
  });
  const result = derive(
    compatibilityResult(),
    scopeResult([corrupted]),
  );
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("binding_identity_mismatch")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.22 referenced binding manifest/name identity corruption blocks", () => {
  const corrupted = scopeCandidate({
    bindingDefinitionAuthorityId: "binding:different",
  });
  const result = derive(
    compatibilityResult(),
    scopeResult([corrupted]),
  );
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) =>
      x.includes("binding_authority_id_mismatch")
    ),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.23 duplicate sentence-domain identity blocks", () => {
  const first = domain({ domainId: "domain:first" });
  const second = domain({
    domainId: "domain:second",
    sentenceIndex: 88,
  });
  const result = derive(
    compatibilityResult(),
    scopeResult(),
    domainResult([first, second]),
  );
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("duplicate_token_domain")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3a.24 non-exact upstream result contracts fail closed", () => {
  const badA46 = {
    ...compatibilityResult(),
    producer: "wrong-a46-producer",
  } as unknown as CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1;
  const a = derive(badA46);
  assert(
    a.status === "blocked" &&
      a.blockingReasons.includes("a4_6b2_result:not_exact_ready"),
    JSON.stringify(a),
  );

  const badScope = {
    ...scopeResult(),
    producer: "wrong-scope-producer",
  } as unknown as CanonicalRuntimeManifestBindingScopeCompatibilityResultV1;
  const b = derive(compatibilityResult(), badScope);
  assert(
    b.status === "blocked" &&
      b.blockingReasons.includes("manifest_scope_result:not_exact_ready"),
    JSON.stringify(b),
  );

  const badDomain = {
    ...domainResult(),
    producer: "wrong-domain-producer",
  } as unknown as CanonicalSentenceDirectTokenOccurrenceDomainResultV1;
  const c = derive(compatibilityResult(), scopeResult(), badDomain);
  assert(
    c.status === "blocked" &&
      c.blockingReasons.includes("token_domain_result:not_exact_ready"),
    JSON.stringify(c),
  );
});

Deno.test("A4.6b3a.25 governance remains candidate-domain only with no binding comparison cardinality or mutation", () => {
  const result = derive();
  assert(result.status === "ready", JSON.stringify(result));
  const g = result.candidates[0]!.governance;
  assert(
    g.exactA46b2ResultRequired === true &&
      g.exactA46b2AuthorityRequired === true &&
      g.exactManifestScopeCompatibilityResultRequired === true &&
      g.exactManifestScopeCompatibilityAuthorityRequired === true &&
      g.exactReferencedBindingIdentityRequired === true &&
      g.ownerBindingExcludedFromScopeJoin === true &&
      g.exactCanonicalSentenceBoundaryRequired === true &&
      g.exactCanonicalTokenDomainResultRequired === true &&
      g.exactCanonicalTokenDomainRequired === true &&
      g.exactGraphDocumentIdentityPreserved === true &&
      g.exactSentenceOccurrenceIdentityPreserved === true &&
      g.sentenceIndexIsOccurrenceIdentity === false &&
      g.sentenceIndexIsLocalityMetadataOnly === true &&
      g.exactDirectTokenOccurrenceIdentityPreserved === true &&
      g.exactContainmentEdgeIdentityPreserved === true &&
      g.exactSentenceTokenIndexPreserved === true &&
      g.exactTokenGraphStatusPreserved === true &&
      g.rightOperandSnapshotPreserved === true &&
      g.rightOperandSnapshotDetached === true &&
      g.sentenceDomainCandidateProjected === true &&
      g.oneCandidatePerSentenceOccurrence === true &&
      g.zeroTokenOccurrencesPreserved === true &&
      g.multipleTokenOccurrencesPreserved === true &&
      g.currentRuntimeSentenceContextSelected === false &&
      g.runtimeBindingOccurrenceDomainResolved === false &&
      g.occurrenceWinnerSelected === false &&
      g.occurrenceBindingPerformed === false &&
      g.posHypothesesRead === false &&
      g.posHypothesisSelected === false &&
      g.rightOperandRead === false &&
      g.rightOperandCompared === false &&
      g.operatorSemanticsResolved === false &&
      g.whereEvaluationPerformed === false &&
      g.cardinalityEnforcementPerformed === false &&
      g.containmentInferredFromSentenceIndex === false &&
      g.graphMutationPerformed === false &&
      g.learnerErrorClassified === false &&
      g.candidateOnly === true &&
      g.frozenGrammarReadOnly === true,
    JSON.stringify(g),
  );
});

assert(
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_COMPOSITION_V1 ===
    "canonical_runtime_manifest_referenced_token_sentence_domain_composition_v1",
  "unexpected A4.6b3a producer identity",
);
