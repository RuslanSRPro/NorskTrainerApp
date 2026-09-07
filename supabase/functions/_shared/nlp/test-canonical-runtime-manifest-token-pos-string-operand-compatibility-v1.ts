import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1,
  deriveCanonicalRuntimeManifestTokenPosStringOperandCompatibilitiesV1,
} from "./canonical-runtime-manifest-token-pos-string-operand-compatibility-v1.ts";
import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1,
  type CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1,
} from "./canonical-runtime-manifest-token-pos-suffix-property-compatibility-v1.ts";

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

function compatibility(
  overrides: Partial<
    CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1
  > = {},
): CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1 {
  return {
    id: "a46:subject:tokenRef.pos",
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
    rightOperandSnapshot: "NOUN",
    governance: { ...A46_GOVERNANCE },
    ...overrides,
  };
}

function inputResult(
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

function derive(
  input = inputResult(),
) {
  return deriveCanonicalRuntimeManifestTokenPosStringOperandCompatibilitiesV1(
    input,
  );
}

Deno.test("A4.6b3b0a.1 exact string operand creates structural compatibility candidate", () => {
  const result = derive();

  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 1, JSON.stringify(result));
  assert(result.stringOperandCompatibleCount === 1, JSON.stringify(result));

  const candidate = result.candidates[0]!;

  assert(candidate.status === "candidate", JSON.stringify(candidate));
  assert(
    candidate.rightOperandStructuralKind === "string",
    JSON.stringify(candidate),
  );
  assert(candidate.rightOperandSnapshot === "NOUN", JSON.stringify(candidate));
  assert(candidate.posLabelInputOpaque === "NOUN", JSON.stringify(candidate));
});

Deno.test("A4.6b3b0a.2 opaque string is preserved byte-for-byte without trimming case-folding or normalization", () => {
  const input = compatibility({
    rightOperandSnapshot: "  NoUn  ",
  });

  const result = derive(inputResult([input]));
  const candidate = result.candidates[0]!;

  assert(result.status === "ready", JSON.stringify(result));
  assert(
    candidate.rightOperandSnapshot === "  NoUn  ",
    JSON.stringify(candidate),
  );
  assert(
    candidate.posLabelInputOpaque === "  NoUn  ",
    JSON.stringify(candidate),
  );
  assert(
    candidate.governance.operandNormalizationPerformed === false,
    JSON.stringify(candidate),
  );
  assert(
    candidate.governance.unicodeNormalizationPerformed === false,
    JSON.stringify(candidate),
  );
  assert(
    candidate.governance.caseFoldingPerformed === false,
    JSON.stringify(candidate),
  );
});

Deno.test("A4.6b3b0a.3 empty string is unsupported but does not block or become false", () => {
  const input = compatibility({ rightOperandSnapshot: "" });
  const result = derive(inputResult([input]));

  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(result.stringOperandCompatibleCount === 0, JSON.stringify(result));
  assert(
    JSON.stringify(result.unsupportedOperandCompatibilityIds) ===
      JSON.stringify([input.id]),
    JSON.stringify(result),
  );
  assert(result.blockingReasons.length === 0, JSON.stringify(result));
});

Deno.test("A4.6b3b0a.4 numeric right operand is unsupported non-blocking evidence", () => {
  const input = compatibility({ rightOperandSnapshot: 42 });
  const result = derive(inputResult([input]));

  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedOperandCompatibilityIds.includes(input.id),
    JSON.stringify(result),
  );
  assert(result.blockingReasons.length === 0, JSON.stringify(result));
});

Deno.test("A4.6b3b0a.5 null right operand is unsupported non-blocking evidence", () => {
  const input = compatibility({ rightOperandSnapshot: null });
  const result = derive(inputResult([input]));

  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedOperandCompatibilityIds.includes(input.id),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a.6 object right operand is unsupported and never interpreted as POS", () => {
  const input = compatibility({
    rightOperandSnapshot: { label: "NOUN" },
  });

  const result = derive(inputResult([input]));

  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedOperandCompatibilityIds.includes(input.id),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a.7 operator remains opaque and unsupported operator spelling does not affect structural string compatibility", () => {
  const input = compatibility({
    operatorLabelOpaque: "totally_opaque_operator",
    rightOperandSnapshot: "VERB",
  });

  const result = derive(inputResult([input]));
  const candidate = result.candidates[0]!;

  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 1, JSON.stringify(result));
  assert(
    candidate.operatorLabelOpaque === "totally_opaque_operator",
    JSON.stringify(candidate),
  );
  assert(
    candidate.governance.operatorSemanticsResolved === false,
    JSON.stringify(candidate),
  );
});

Deno.test("A4.6b3b0a.8 exact A4.6b2 owner referenced manifest and site identities are preserved", () => {
  const input = compatibility({
    id: "a46:custom",
    leafRightOperandSiteAuthorityId: "site:custom",
    referenceRootAuthorityId: "root:customRef",
    referenceExpressionAuthorityId: "reference:customRef.pos",
    whereShapeAuthorityId: "where:customOwner",
    ownerBindingDefinitionAuthorityId: "binding:customOwner",
    manifestId: "manifest:custom",
    manifestCode: "ir.custom",
    ownerBindingName: "customOwner",
    referencedBindingDefinitionAuthorityId: "binding:customRef",
    referencedBindingName: "customRef",
    leafPath: "$.bindings.customOwner.where",
    leftReferenceExpression: "customRef.pos",
  });

  const result = derive(inputResult([input]));
  const c = result.candidates[0]!;

  assert(
    c.tokenPosSuffixPropertyCompatibilityId === "a46:custom",
    JSON.stringify(c),
  );
  assert(
    c.leafRightOperandSiteAuthorityId === "site:custom",
    JSON.stringify(c),
  );
  assert(c.referenceRootAuthorityId === "root:customRef", JSON.stringify(c));
  assert(
    c.referenceExpressionAuthorityId === "reference:customRef.pos",
    JSON.stringify(c),
  );
  assert(c.whereShapeAuthorityId === "where:customOwner", JSON.stringify(c));
  assert(
    c.ownerBindingDefinitionAuthorityId === "binding:customOwner",
    JSON.stringify(c),
  );
  assert(c.manifestId === "manifest:custom", JSON.stringify(c));
  assert(c.manifestCode === "ir.custom", JSON.stringify(c));
  assert(c.ownerBindingName === "customOwner", JSON.stringify(c));
  assert(
    c.referencedBindingDefinitionAuthorityId === "binding:customRef",
    JSON.stringify(c),
  );
  assert(c.referencedBindingName === "customRef", JSON.stringify(c));
  assert(c.leafPath === "$.bindings.customOwner.where", JSON.stringify(c));
  assert(c.leftReferenceExpression === "customRef.pos", JSON.stringify(c));
});

Deno.test("A4.6b3b0a.9 structural compatibility does not claim canonical POS label meaning", () => {
  const input = compatibility({
    rightOperandSnapshot: "definitely-not-a-canonical-pos-label",
  });

  const result = derive(inputResult([input]));
  const c = result.candidates[0]!;

  assert(result.status === "ready", JSON.stringify(result));
  assert(
    c.posLabelInputOpaque === "definitely-not-a-canonical-pos-label",
    JSON.stringify(c),
  );
  assert(
    c.governance.operandKnownCanonicalPosLabel === false,
    JSON.stringify(c),
  );
  assert(
    c.governance.posLabelInputCompatibilityOnly === true,
    JSON.stringify(c),
  );
});

Deno.test("A4.6b3b0a.10 stale A4.6b2 governance blocks fail-closed", () => {
  const base = compatibility();

  const stale = {
    ...base,
    governance: {
      ...base.governance,
      rightOperandRead: true,
    },
  } as unknown as CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1;

  const result = derive(inputResult([stale]));

  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("unsafe_contract")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a.11 duplicate A4.6b2 candidate id blocks fail-closed", () => {
  const first = compatibility();

  const second = compatibility({
    referenceRootAuthorityId: "root:other",
    referenceExpressionAuthorityId: "reference:other.pos",
    referencedBindingDefinitionAuthorityId: "binding:other",
    referencedBindingName: "other",
    leftReferenceExpression: "other.pos",
  });

  const result = derive(inputResult([first, second]));

  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("duplicate_id")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a.12 duplicate exact site identity with different authority id blocks", () => {
  const first = compatibility({ id: "a46:first" });
  const second = compatibility({ id: "a46:second" });

  const result = derive(inputResult([first, second]));

  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) =>
      x.includes("duplicate_exact_site_identity")
    ),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a.13 non-exact upstream result contract blocks", () => {
  const bad = {
    ...inputResult(),
    producer: "wrong-producer",
  } as unknown as CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1;

  const result = derive(bad);

  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.includes("a4_6b2_result:not_exact_ready"),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a.14 zero upstream candidates remains ready with zero structural candidates", () => {
  const result = derive(inputResult([]));

  assert(result.status === "ready", JSON.stringify(result));
  assert(result.consideredCompatibilityCount === 0, JSON.stringify(result));
  assert(result.stringOperandCompatibleCount === 0, JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedOperandCompatibilityIds.length === 0,
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a.15 mixed string and unsupported operands preserve only structurally compatible sites", () => {
  const stringA = compatibility({
    id: "a46:string-a",
    leafRightOperandSiteAuthorityId: "site:a",
    referenceExpressionAuthorityId: "reference:a.pos",
    whereShapeAuthorityId: "where:a",
    ownerBindingDefinitionAuthorityId: "binding:owner-a",
    ownerBindingName: "ownerA",
    referencedBindingDefinitionAuthorityId: "binding:a",
    referencedBindingName: "a",
    referenceRootAuthorityId: "root:a",
    leafPath: "$.bindings.ownerA.where",
    leftReferenceExpression: "a.pos",
    rightOperandSnapshot: "NOUN",
  });

  const unsupported = compatibility({
    id: "a46:number",
    leafRightOperandSiteAuthorityId: "site:number",
    referenceExpressionAuthorityId: "reference:number.pos",
    whereShapeAuthorityId: "where:number",
    ownerBindingDefinitionAuthorityId: "binding:owner-number",
    ownerBindingName: "ownerNumber",
    referencedBindingDefinitionAuthorityId: "binding:number",
    referencedBindingName: "number",
    referenceRootAuthorityId: "root:number",
    leafPath: "$.bindings.ownerNumber.where",
    leftReferenceExpression: "number.pos",
    rightOperandSnapshot: 7,
  });

  const stringB = compatibility({
    id: "a46:string-b",
    leafRightOperandSiteAuthorityId: "site:b",
    referenceExpressionAuthorityId: "reference:b.pos",
    whereShapeAuthorityId: "where:b",
    ownerBindingDefinitionAuthorityId: "binding:owner-b",
    ownerBindingName: "ownerB",
    referencedBindingDefinitionAuthorityId: "binding:b",
    referencedBindingName: "b",
    referenceRootAuthorityId: "root:b",
    leafPath: "$.bindings.ownerB.where",
    leftReferenceExpression: "b.pos",
    rightOperandSnapshot: "VERB",
  });

  const result = derive(
    inputResult([stringA, unsupported, stringB]),
  );

  assert(result.status === "ready", JSON.stringify(result));
  assert(result.consideredCompatibilityCount === 3, JSON.stringify(result));
  assert(result.stringOperandCompatibleCount === 2, JSON.stringify(result));
  assert(result.candidates.length === 2, JSON.stringify(result));
  assert(
    JSON.stringify(result.unsupportedOperandCompatibilityIds) ===
      JSON.stringify(["a46:number"]),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a.16 governance remains structural-only with no normalization comparison occurrence or cardinality authority", () => {
  const result = derive();
  const g = result.candidates[0]!.governance;

  assert(
    g.exactA46b2ResultRequired === true &&
      g.exactA46b2AuthorityRequired === true &&
      g.exactA46b2IdentityPreserved === true &&
      g.rightOperandSnapshotConsumed === true &&
      g.rightOperandStructuralKindDerivedFromSnapshot === true &&
      g.stringRightOperandRequired === true &&
      g.nonEmptyStringOperandRequired === true &&
      g.stringOperandPreservedOpaque === true &&
      g.posLabelInputCompatibilityOnly === true &&
      g.operatorLabelPreservedOpaque === true &&
      g.propertyValueIsHypothesisSet === true &&
      g.operandKnownCanonicalPosLabel === false &&
      g.operandNormalizationPerformed === false &&
      g.unicodeNormalizationPerformed === false &&
      g.caseFoldingPerformed === false &&
      g.operatorSemanticsResolved === false &&
      g.tokenPosNormalizedLabelEqSemanticsResolved === false &&
      g.canonicalPosHypothesisRead === false &&
      g.canonicalPosHypothesisNormalized === false &&
      g.actualPosLabelCompared === false &&
      g.comparisonPerformed === false &&
      g.comparisonTruthResolved === false &&
      g.runtimeConditionTruthResolved === false &&
      g.candidateSentenceDomainConsumed === false &&
      g.tokenNodeIdInspected === false &&
      g.occurrenceEnumerationPerformed === false &&
      g.occurrenceFilteringPerformed === false &&
      g.occurrenceBindingPerformed === false &&
      g.cardinalityEnforcementPerformed === false &&
      g.graphMutationPerformed === false &&
      g.learnerErrorClassified === false &&
      g.candidateOnly === true &&
      g.frozenGrammarReadOnly === true,
    JSON.stringify(g),
  );
});

assert(
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1 ===
    "canonical_runtime_manifest_token_pos_string_operand_compatibility_v1",
  "unexpected producer identity",
);

assert(
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1 ===
    "1",
  "unexpected producer version",
);
