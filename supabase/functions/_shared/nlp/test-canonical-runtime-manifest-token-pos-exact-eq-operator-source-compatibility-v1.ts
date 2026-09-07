import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1,
  deriveCanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilitiesV1,
} from "./canonical-runtime-manifest-token-pos-exact-eq-operator-source-compatibility-v1.ts";
import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeManifestTokenPosStringOperandCompatibilityResultV1,
  type CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1,
} from "./canonical-runtime-manifest-token-pos-string-operand-compatibility-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const B3B0A_GOVERNANCE = {
  exactA46b2ResultRequired: true,
  exactA46b2AuthorityRequired: true,
  exactA46b2IdentityPreserved: true,
  exactLeafRightOperandSiteAuthorityPreserved: true,
  exactReferenceRootAuthorityPreserved: true,
  exactReferenceExpressionAuthorityPreserved: true,
  exactWhereShapeAuthorityPreserved: true,
  exactOwnerBindingIdentityPreserved: true,
  exactReferencedBindingIdentityPreserved: true,
  exactManifestIdentityPreserved: true,
  exactLeafPathPreserved: true,
  exactLeftReferenceExpressionPreserved: true,
  exactRuntimePosSuffixPreserved: true,
  rightOperandSnapshotConsumed: true,
  rightOperandStructuralKindDerivedFromSnapshot: true,
  stringRightOperandRequired: true,
  nonEmptyStringOperandRequired: true,
  stringOperandPreservedOpaque: true,
  posLabelInputCompatibilityOnly: true,
  operatorLabelPreservedOpaque: true,
  propertyValueIsHypothesisSet: true,
  operandKnownCanonicalPosLabel: false,
  operandNormalizationPerformed: false,
  unicodeNormalizationPerformed: false,
  caseFoldingPerformed: false,
  operatorSemanticsResolved: false,
  tokenPosNormalizedLabelEqSemanticsResolved: false,
  canonicalPosHypothesisRead: false,
  canonicalPosHypothesisNormalized: false,
  actualPosLabelCompared: false,
  comparisonPerformed: false,
  comparisonTruthResolved: false,
  runtimeConditionTruthResolved: false,
  candidateSentenceDomainConsumed: false,
  tokenNodeIdInspected: false,
  occurrenceEnumerationPerformed: false,
  occurrenceFilteringPerformed: false,
  occurrenceBindingPerformed: false,
  cardinalityEnforcementPerformed: false,
  graphMutationPerformed: false,
  learnerErrorClassified: false,
  candidateOnly: true,
  frozenGrammarReadOnly: true,
} as const;

function candidate(
  overrides: Partial<
    CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1
  > = {},
): CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1 {
  return {
    id: "b3b0a:subject:tokenRef.pos",
    status: "candidate",
    tokenPosSuffixPropertyCompatibilityId: "a46b2:subject:tokenRef.pos",
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
    canonicalNodeType: "token",
    canonicalPropertyDomain: "canonical_token_occurrence",
    canonicalPropertyKind: "pos_hypothesis_set",
    rightOperandStructuralKind: "string",
    rightOperandSnapshot: "NOUN",
    posLabelInputOpaque: "NOUN",
    governance: { ...B3B0A_GOVERNANCE },
    ...overrides,
  };
}

function inputResult(
  candidates: CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1[] = [
    candidate(),
  ],
): CanonicalRuntimeManifestTokenPosStringOperandCompatibilityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1,
    status: "ready",
    candidates,
    consideredCompatibilityCount: candidates.length,
    stringOperandCompatibleCount: candidates.length,
    unsupportedOperandCompatibilityIds: [],
    blockingReasons: [],
  };
}

function derive(
  input = inputResult(),
) {
  return deriveCanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilitiesV1(
    input,
  );
}

Deno.test("A4.6b3b0a2.1 exact raw eq creates source-vocabulary compatibility", () => {
  const result = derive();
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 1, JSON.stringify(result));
  assert(result.exactEqOperatorCompatibleCount === 1, JSON.stringify(result));
  const c = result.candidates[0]!;
  assert(c.sourceOperatorLabelRaw === "eq", JSON.stringify(c));
  assert(c.operatorLabelOpaque === "eq", JSON.stringify(c));
});

Deno.test("A4.6b3b0a2.2 uppercase EQ is outside exact source vocabulary", () => {
  const input = candidate({ operatorLabelOpaque: "EQ" });
  const result = derive(inputResult([input]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedOperatorCompatibilityIds.includes(input.id),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.3 padded lowercase eq is outside exact source vocabulary", () => {
  const input = candidate({ operatorLabelOpaque: "  eq  " });
  const result = derive(inputResult([input]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedOperatorCompatibilityIds.includes(input.id),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.4 padded uppercase EQ historical alias is rejected here", () => {
  const input = candidate({ operatorLabelOpaque: "  EQ  " });
  const result = derive(inputResult([input]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedOperatorCompatibilityIds.includes(input.id),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.5 unrelated operator is unsupported without blocking", () => {
  const input = candidate({ operatorLabelOpaque: "has_feature" });
  const result = derive(inputResult([input]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(result.blockingReasons.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedOperatorCompatibilityIds.includes(input.id),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.6 exact b3b0a identities and operand remain preserved", () => {
  const input = candidate({
    id: "b3b0a:custom",
    tokenPosSuffixPropertyCompatibilityId: "a46b2:custom",
    leafRightOperandSiteAuthorityId: "site:custom",
    referenceRootAuthorityId: "root:custom",
    referenceExpressionAuthorityId: "reference:custom.pos",
    whereShapeAuthorityId: "where:custom",
    ownerBindingDefinitionAuthorityId: "binding:owner",
    manifestId: "manifest:custom",
    manifestCode: "ir.custom",
    ownerBindingName: "owner",
    referencedBindingDefinitionAuthorityId: "binding:custom",
    referencedBindingName: "custom",
    leafPath: "$.bindings.owner.where",
    leftReferenceExpression: "custom.pos",
    rightOperandSnapshot: "Verb",
    posLabelInputOpaque: "Verb",
  });
  const result = derive(inputResult([input]));
  const c = result.candidates[0]!;
  assert(c.stringOperandCompatibilityId === "b3b0a:custom", JSON.stringify(c));
  assert(
    c.tokenPosSuffixPropertyCompatibilityId === "a46b2:custom",
    JSON.stringify(c),
  );
  assert(
    c.leafRightOperandSiteAuthorityId === "site:custom",
    JSON.stringify(c),
  );
  assert(c.referenceRootAuthorityId === "root:custom", JSON.stringify(c));
  assert(
    c.referenceExpressionAuthorityId === "reference:custom.pos",
    JSON.stringify(c),
  );
  assert(c.whereShapeAuthorityId === "where:custom", JSON.stringify(c));
  assert(
    c.ownerBindingDefinitionAuthorityId === "binding:owner",
    JSON.stringify(c),
  );
  assert(c.manifestId === "manifest:custom", JSON.stringify(c));
  assert(c.manifestCode === "ir.custom", JSON.stringify(c));
  assert(c.ownerBindingName === "owner", JSON.stringify(c));
  assert(
    c.referencedBindingDefinitionAuthorityId === "binding:custom",
    JSON.stringify(c),
  );
  assert(c.referencedBindingName === "custom", JSON.stringify(c));
  assert(c.leafPath === "$.bindings.owner.where", JSON.stringify(c));
  assert(c.leftReferenceExpression === "custom.pos", JSON.stringify(c));
  assert(c.rightOperandSnapshot === "Verb", JSON.stringify(c));
  assert(c.posLabelInputOpaque === "Verb", JSON.stringify(c));
});

Deno.test("A4.6b3b0a2.7 exact eq source compatibility does not resolve eq semantics", () => {
  const g = derive().candidates[0]!.governance;
  assert(
    g.operatorSourceVocabularyCompatibilityOnly === true,
    JSON.stringify(g),
  );
  assert(g.operatorSemanticsResolved === false, JSON.stringify(g));
  assert(g.genericRuntimeEqSemanticsResolved === false, JSON.stringify(g));
  assert(g.genericJsonEqualitySemanticsResolved === false, JSON.stringify(g));
  assert(
    g.tokenPosNormalizedLabelEqSemanticsResolved === false,
    JSON.stringify(g),
  );
});

Deno.test("A4.6b3b0a2.8 exact raw comparison performs no trim NFC case-fold or alias resolution", () => {
  const g = derive().candidates[0]!.governance;
  assert(g.exactRawEqOperatorRequired === true, JSON.stringify(g));
  assert(
    g.rawOperatorComparedByExactStringEquality === true,
    JSON.stringify(g),
  );
  assert(g.operatorWhitespaceTrimmed === false, JSON.stringify(g));
  assert(g.operatorUnicodeNormalized === false, JSON.stringify(g));
  assert(g.operatorCaseFolded === false, JSON.stringify(g));
  assert(g.operatorAliasResolved === false, JSON.stringify(g));
});

Deno.test("A4.6b3b0a2.9 exact eq does not validate or normalize expected POS operand", () => {
  const input = candidate({
    rightOperandSnapshot: "  VeRb  ",
    posLabelInputOpaque: "  VeRb  ",
  });
  const result = derive(inputResult([input]));
  const c = result.candidates[0]!;
  assert(c.rightOperandSnapshot === "  VeRb  ", JSON.stringify(c));
  assert(c.posLabelInputOpaque === "  VeRb  ", JSON.stringify(c));
  assert(c.governance.posVocabularyValidated === false, JSON.stringify(c));
  assert(
    c.governance.operandKnownCanonicalPosLabel === false,
    JSON.stringify(c),
  );
  assert(c.governance.expectedPosLabelNormalized === false, JSON.stringify(c));
  assert(
    c.governance.rightOperandNormalizationPerformed === false,
    JSON.stringify(c),
  );
});

Deno.test("A4.6b3b0a2.10 stale b3b0a governance blocks fail-closed", () => {
  const base = candidate();
  const stale = {
    ...base,
    governance: {
      ...base.governance,
      operatorSemanticsResolved: true,
    },
  } as unknown as CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1;
  const result = derive(inputResult([stale]));
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("unsafe_contract")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.11 duplicate b3b0a candidate id blocks", () => {
  const first = candidate();
  const second = candidate({
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

Deno.test("A4.6b3b0a2.12 duplicate exact site identity with different id blocks", () => {
  const first = candidate({ id: "b3b0a:first" });
  const second = candidate({ id: "b3b0a:second" });
  const result = derive(inputResult([first, second]));
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) =>
      x.includes("duplicate_exact_site_identity")
    ),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.13 non-exact upstream producer blocks", () => {
  const bad = {
    ...inputResult(),
    producer: "wrong-producer",
  } as unknown as CanonicalRuntimeManifestTokenPosStringOperandCompatibilityResultV1;
  const result = derive(bad);
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.includes("b3b0a_result:not_exact_ready"),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.14 inconsistent upstream count blocks", () => {
  const bad = {
    ...inputResult(),
    stringOperandCompatibleCount: 2,
  };
  const result = derive(bad);
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.includes("b3b0a_result:not_exact_ready"),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.15 zero upstream candidates remains ready", () => {
  const result = derive(inputResult([]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(
    result.consideredStringOperandCompatibilityCount === 0,
    JSON.stringify(result),
  );
  assert(result.exactEqOperatorCompatibleCount === 0, JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedOperatorCompatibilityIds.length === 0,
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.16 malformed upstream pos suffix blocks rather than reinterpreting site", () => {
  const base = candidate();
  const malformed = {
    ...base,
    runtimeSuffix: ".morph",
  } as unknown as CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1;
  const result = derive(inputResult([malformed]));
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("unsafe_contract")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.17 detached operand identity corruption blocks", () => {
  const malformed = candidate({
    rightOperandSnapshot: "NOUN",
    posLabelInputOpaque: "VERB",
  });
  const result = derive(inputResult([malformed]));
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) => x.includes("unsafe_contract")),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0a2.18 mixed source operators preserve only exact raw eq and remain semantic-free", () => {
  const exact = candidate({
    id: "b3b0a:exact",
    leafRightOperandSiteAuthorityId: "site:exact",
    referenceRootAuthorityId: "root:exact",
    referenceExpressionAuthorityId: "reference:exact.pos",
    whereShapeAuthorityId: "where:exact",
    ownerBindingDefinitionAuthorityId: "binding:owner-exact",
    ownerBindingName: "ownerExact",
    referencedBindingDefinitionAuthorityId: "binding:exact",
    referencedBindingName: "exact",
    leafPath: "$.bindings.ownerExact.where",
    leftReferenceExpression: "exact.pos",
    operatorLabelOpaque: "eq",
  });
  const upper = candidate({
    id: "b3b0a:upper",
    leafRightOperandSiteAuthorityId: "site:upper",
    referenceRootAuthorityId: "root:upper",
    referenceExpressionAuthorityId: "reference:upper.pos",
    whereShapeAuthorityId: "where:upper",
    ownerBindingDefinitionAuthorityId: "binding:owner-upper",
    ownerBindingName: "ownerUpper",
    referencedBindingDefinitionAuthorityId: "binding:upper",
    referencedBindingName: "upper",
    leafPath: "$.bindings.ownerUpper.where",
    leftReferenceExpression: "upper.pos",
    operatorLabelOpaque: "EQ",
  });
  const other = candidate({
    id: "b3b0a:other",
    leafRightOperandSiteAuthorityId: "site:other",
    referenceRootAuthorityId: "root:other",
    referenceExpressionAuthorityId: "reference:other.pos",
    whereShapeAuthorityId: "where:other",
    ownerBindingDefinitionAuthorityId: "binding:owner-other",
    ownerBindingName: "ownerOther",
    referencedBindingDefinitionAuthorityId: "binding:other",
    referencedBindingName: "other",
    leafPath: "$.bindings.ownerOther.where",
    leftReferenceExpression: "other.pos",
    operatorLabelOpaque: "has_feature",
  });
  const result = derive(inputResult([upper, exact, other]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(
    result.consideredStringOperandCompatibilityCount === 3,
    JSON.stringify(result),
  );
  assert(result.exactEqOperatorCompatibleCount === 1, JSON.stringify(result));
  assert(result.candidates.length === 1, JSON.stringify(result));
  assert(
    result.candidates[0]!.stringOperandCompatibilityId === "b3b0a:exact",
    JSON.stringify(result),
  );
  assert(
    JSON.stringify(result.unsupportedOperatorCompatibilityIds) ===
      JSON.stringify(["b3b0a:other", "b3b0a:upper"]),
    JSON.stringify(result),
  );
  assert(
    result.candidates[0]!.governance.operatorSemanticsResolved === false,
    JSON.stringify(result),
  );
});

assert(
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1 ===
    "canonical_runtime_manifest_token_pos_exact_eq_operator_source_compatibility_v1",
  "unexpected producer identity",
);

assert(
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1 ===
    "1",
  "unexpected producer version",
);
