import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_VERSION_V1,
  deriveCanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthoritiesV1,
  normalizeCanonicalRuntimeManifestExpectedPosLabelV1,
} from "./canonical-runtime-manifest-token-pos-expected-normalized-label-eq-authority-v1.ts";
import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityResultV1,
  type CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1,
} from "./canonical-runtime-manifest-token-pos-exact-eq-operator-source-compatibility-v1.ts";
import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
  type CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SOURCE_GOVERNANCE = {
  exactB3b0aResultRequired: true,
  exactB3b0aAuthorityRequired: true,
  exactB3b0aIdentityPreserved: true,
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
  exactStringOperandCompatibilityPreserved: true,
  sourceOperatorValueConsumedFromManifestLineage: true,
  exactRawEqOperatorRequired: true,
  rawOperatorComparedByExactStringEquality: true,
  operatorSourceVocabularyCompatibilityOnly: true,
  candidateOnly: true,
  frozenGrammarReadOnly: true,
  operatorWhitespaceTrimmed: false,
  operatorUnicodeNormalized: false,
  operatorCaseFolded: false,
  operatorAliasResolved: false,
  operatorSemanticsResolved: false,
  genericRuntimeEqSemanticsResolved: false,
  genericJsonEqualitySemanticsResolved: false,
  tokenPosNormalizedLabelEqSemanticsResolved: false,
  posVocabularyValidated: false,
  operandKnownCanonicalPosLabel: false,
  expectedPosLabelNormalized: false,
  rightOperandNormalizationPerformed: false,
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
} as const;

function sourceCandidate(
  overrides: Record<string, unknown> = {},
): CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1 {
  return {
    id: "b3b0a2:subject:tokenRef.pos",
    status: "candidate",
    stringOperandCompatibilityId: "b3b0a:subject:tokenRef.pos",
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
    rightOperandSnapshot: "noun",
    posLabelInputOpaque: "noun",
    sourceOperatorLabelRaw: "eq",
    governance: { ...SOURCE_GOVERNANCE },
    ...overrides,
  } as unknown as CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1;
}

function sourceResult(
  candidates:
    CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1[] = [
      sourceCandidate(),
    ],
  overrides: Record<string, unknown> = {},
): CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1,
    status: "ready",
    candidates,
    consideredStringOperandCompatibilityCount: candidates.length,
    exactEqOperatorCompatibleCount: candidates.length,
    unsupportedOperatorCompatibilityIds: [],
    blockingReasons: [],
    ...overrides,
  } as unknown as CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityResultV1;
}

function derive(
  source = sourceResult(),
  semanticCapability:
    CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1 =
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
) {
  return deriveCanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthoritiesV1(
    source,
    semanticCapability,
  );
}

Deno.test("A4.6b3b0b.1 expected label helper normalizes padded mixed-case input", () => {
  assert(
    normalizeCanonicalRuntimeManifestExpectedPosLabelV1("  VeRb  ") === "verb",
    "expected VeRb -> verb",
  );
  assert(
    normalizeCanonicalRuntimeManifestExpectedPosLabelV1(42) === undefined,
    "non-string must remain unsupported",
  );
});

Deno.test("A4.6b3b0b.2 expected label helper performs Unicode NFC before lowercase", () => {
  const decomposed = "\u0041\u030A";
  const normalized = normalizeCanonicalRuntimeManifestExpectedPosLabelV1(
    decomposed,
  );
  assert(normalized === "\u00E5", JSON.stringify({ decomposed, normalized }));
  assert(
    normalized?.normalize("NFC") === normalized,
    normalized ?? "undefined",
  );
});

Deno.test("A4.6b3b0b.3 derive preserves raw expected operand while adding normalized authority", () => {
  const input = sourceCandidate({
    rightOperandSnapshot: "  VeRb  ",
    posLabelInputOpaque: "  VeRb  ",
  });
  const result = derive(sourceResult([input]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.candidates.length === 1, JSON.stringify(result));
  const c = result.candidates[0]!;
  assert(c.rightOperandSnapshot === "  VeRb  ", JSON.stringify(c));
  assert(c.posLabelInputOpaque === "  VeRb  ", JSON.stringify(c));
  assert(c.normalizedExpectedPosLabel === "verb", JSON.stringify(c));
});

Deno.test("A4.6b3b0b.4 semantic capability identity and semantic contract are preserved", () => {
  const c = derive().candidates[0]!;
  const semantic =
    CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1;
  assert(c.semanticCapabilityId === semantic.capabilityId, JSON.stringify(c));
  assert(c.semanticCapabilityVersion === semantic.version, JSON.stringify(c));
  assert(c.semanticDomain === semantic.semanticDomain, JSON.stringify(c));
  assert(
    c.expectedNormalizationContract === semantic.expectedLabelNormalization,
    "normalization contract detached",
  );
  assert(
    c.equalitySemantics === semantic.equalitySemantics,
    "equality semantics detached",
  );
});

Deno.test("A4.6b3b0b.5 exact manifest binding and site identities survive expected normalization", () => {
  const input = sourceCandidate({
    id: "b3b0a2:custom",
    stringOperandCompatibilityId: "b3b0a:custom",
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
  });
  const c = derive(sourceResult([input])).candidates[0]!;
  assert(
    c.exactEqOperatorSourceCompatibilityId === "b3b0a2:custom",
    JSON.stringify(c),
  );
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
});

Deno.test("A4.6b3b0b.6 source operator is consumed as exact eq and never reinterpreted", () => {
  const c = derive().candidates[0]!;
  assert(c.sourceOperatorLabelRaw === "eq", JSON.stringify(c));
  assert(c.canonicalOperatorLabel === "eq", JSON.stringify(c));
  assert(c.governance.exactRawSourceEqConsumed === true, JSON.stringify(c));
  assert(
    c.governance.sourceOperatorParsingPerformed === false,
    JSON.stringify(c),
  );
  assert(
    c.governance.operatorAliasNormalizationAuthorized === false,
    JSON.stringify(c),
  );
  assert(
    c.governance.operatorSemanticsReconstructed === false,
    JSON.stringify(c),
  );
});

Deno.test("A4.6b3b0b.7 whitespace-only expected label is unsupported non-blocking evidence", () => {
  const input = sourceCandidate({
    id: "b3b0a2:blank",
    rightOperandSnapshot: "   ",
    posLabelInputOpaque: "   ",
  });
  const result = derive(sourceResult([input]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(result.blockingReasons.length === 0, JSON.stringify(result));
  assert(
    result.consideredExactEqSourceCompatibilityCount === 1,
    JSON.stringify(result),
  );
  assert(
    result.expectedNormalizedLabelAuthorityCount === 0,
    JSON.stringify(result),
  );
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    JSON.stringify(result.unsupportedExpectedOperandCompatibilityIds) ===
      JSON.stringify(["b3b0a2:blank"]),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0b.8 mixed valid and blank expected labels preserve only normalized candidates", () => {
  const valid = sourceCandidate({
    id: "b3b0a2:valid",
    leafRightOperandSiteAuthorityId: "site:valid",
    referenceRootAuthorityId: "root:valid",
    referenceExpressionAuthorityId: "reference:valid.pos",
    whereShapeAuthorityId: "where:valid",
    ownerBindingDefinitionAuthorityId: "binding:owner-valid",
    ownerBindingName: "ownerValid",
    referencedBindingDefinitionAuthorityId: "binding:valid",
    referencedBindingName: "valid",
    leafPath: "$.bindings.ownerValid.where",
    leftReferenceExpression: "valid.pos",
    rightOperandSnapshot: "  NoUn  ",
    posLabelInputOpaque: "  NoUn  ",
  });
  const blank = sourceCandidate({
    id: "b3b0a2:blank",
    leafRightOperandSiteAuthorityId: "site:blank",
    referenceRootAuthorityId: "root:blank",
    referenceExpressionAuthorityId: "reference:blank.pos",
    whereShapeAuthorityId: "where:blank",
    ownerBindingDefinitionAuthorityId: "binding:owner-blank",
    ownerBindingName: "ownerBlank",
    referencedBindingDefinitionAuthorityId: "binding:blank",
    referencedBindingName: "blank",
    leafPath: "$.bindings.ownerBlank.where",
    leftReferenceExpression: "blank.pos",
    rightOperandSnapshot: "   ",
    posLabelInputOpaque: "   ",
  });
  const result = derive(sourceResult([blank, valid]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(
    result.consideredExactEqSourceCompatibilityCount === 2,
    JSON.stringify(result),
  );
  assert(
    result.expectedNormalizedLabelAuthorityCount === 1,
    JSON.stringify(result),
  );
  assert(result.candidates.length === 1, JSON.stringify(result));
  assert(
    result.candidates[0]!.normalizedExpectedPosLabel === "noun",
    JSON.stringify(result),
  );
  assert(
    result.unsupportedExpectedOperandCompatibilityIds.includes("b3b0a2:blank"),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0b.9 zero exact-eq source candidates remains ready with zero expected authorities", () => {
  const result = derive(sourceResult([]));
  assert(result.status === "ready", JSON.stringify(result));
  assert(
    result.consideredExactEqSourceCompatibilityCount === 0,
    JSON.stringify(result),
  );
  assert(
    result.expectedNormalizedLabelAuthorityCount === 0,
    JSON.stringify(result),
  );
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.unsupportedExpectedOperandCompatibilityIds.length === 0,
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0b.10 normalization does not validate a closed POS vocabulary", () => {
  const input = sourceCandidate({
    rightOperandSnapshot: "  Totally_New_Label  ",
    posLabelInputOpaque: "  Totally_New_Label  ",
  });
  const c = derive(sourceResult([input])).candidates[0]!;
  assert(
    c.normalizedExpectedPosLabel === "totally_new_label",
    JSON.stringify(c),
  );
  assert(c.governance.posVocabularyValidated === false, JSON.stringify(c));
  assert(
    c.governance.operandKnownCanonicalPosLabel === false,
    JSON.stringify(c),
  );
});

Deno.test("A4.6b3b0b.11 expected authority performs no canonical POS read or selection", () => {
  const g = derive().candidates[0]!.governance;
  assert(g.canonicalPosHypothesisRead === false, JSON.stringify(g));
  assert(g.canonicalPosHypothesisSelected === false, JSON.stringify(g));
  assert(g.actualPosLabelReadPerformed === false, JSON.stringify(g));
  assert(g.actualPosLabelNormalizationPerformed === false, JSON.stringify(g));
});

Deno.test("A4.6b3b0b.12 expected authority executes no actual-vs-expected comparison or truth", () => {
  const g = derive().candidates[0]!.governance;
  assert(g.comparisonExecuted === false, JSON.stringify(g));
  assert(g.comparisonTruthResolved === false, JSON.stringify(g));
  assert(g.runtimeConditionTruthResolved === false, JSON.stringify(g));
});

Deno.test("A4.6b3b0b.13 expected authority owns no sentence-domain occurrence or cardinality execution", () => {
  const g = derive().candidates[0]!.governance;
  assert(g.candidateSentenceDomainConsumed === false, JSON.stringify(g));
  assert(g.tokenNodeIdInspected === false, JSON.stringify(g));
  assert(g.occurrenceEnumerationPerformed === false, JSON.stringify(g));
  assert(g.occurrenceFilteringPerformed === false, JSON.stringify(g));
  assert(g.occurrenceBindingPerformed === false, JSON.stringify(g));
  assert(g.cardinalityEnforcementPerformed === false, JSON.stringify(g));
});

Deno.test("A4.6b3b0b.14 expected authority is not generic equality and never mutates graph", () => {
  const g = derive().candidates[0]!.governance;
  assert(g.genericRuntimeEqAuthority === false, JSON.stringify(g));
  assert(g.genericJsonEqualityAuthority === false, JSON.stringify(g));
  assert(g.graphMutationPerformed === false, JSON.stringify(g));
  assert(g.learnerErrorClassified === false, JSON.stringify(g));
  assert(g.candidateOnly === true, JSON.stringify(g));
  assert(g.frozenGrammarReadOnly === true, JSON.stringify(g));
});

Deno.test("A4.6b3b0b.15 non-exact source producer blocks fail-closed", () => {
  const bad = sourceResult([sourceCandidate()], {
    producer: "wrong-producer",
  });
  const result = derive(bad);
  assert(result.status === "blocked", JSON.stringify(result));
  assert(result.candidates.length === 0, JSON.stringify(result));
  assert(
    result.blockingReasons.includes("b3b0a2_result:not_exact_ready"),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0b.16 inconsistent exact-eq source count blocks fail-closed", () => {
  const bad = sourceResult([sourceCandidate()], {
    exactEqOperatorCompatibleCount: 2,
  });
  const result = derive(bad);
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.includes("b3b0a2_result:not_exact_ready"),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0b.17 unsafe source candidate governance blocks before normalization", () => {
  const base = sourceCandidate();
  const unsafe = sourceCandidate({
    governance: {
      ...base.governance,
      operatorSemanticsResolved: true,
    },
  });
  const result = derive(sourceResult([unsafe]));
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) =>
      x.includes("b3b0a2_candidate:unsafe_contract")
    ),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0b.18 duplicate source candidate id blocks rather than selecting one", () => {
  const first = sourceCandidate();
  const second = sourceCandidate({
    referenceRootAuthorityId: "root:other",
    referenceExpressionAuthorityId: "reference:other.pos",
    referencedBindingDefinitionAuthorityId: "binding:other",
    referencedBindingName: "other",
    leftReferenceExpression: "other.pos",
  });
  const result = derive(sourceResult([first, second]));
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) =>
      x.includes("b3b0a2_candidate:duplicate_id")
    ),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0b.19 duplicate exact source-site identity with different id blocks", () => {
  const first = sourceCandidate({ id: "b3b0a2:first" });
  const second = sourceCandidate({ id: "b3b0a2:second" });
  const result = derive(sourceResult([first, second]));
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.some((x) =>
      x.includes("b3b0a2_candidate:duplicate_exact_site_identity")
    ),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0b.20 stale semantic capability blocks normalization and derivation", () => {
  const semantic =
    CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1;
  const stale = {
    ...semantic,
    governance: {
      ...semantic.governance,
      comparisonExecuted: true,
    },
  } as unknown as CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1;
  assert(
    normalizeCanonicalRuntimeManifestExpectedPosLabelV1("noun", stale) ===
      undefined,
    "stale capability must not normalize",
  );
  const result = derive(sourceResult(), stale);
  assert(result.status === "blocked", JSON.stringify(result));
  assert(
    result.blockingReasons.includes(
      "b3b0b0_semantic_capability:not_exact_proven",
    ),
    JSON.stringify(result),
  );
});

Deno.test("A4.6b3b0b.21 identical source input produces deterministic authority output", () => {
  const a = sourceCandidate({
    id: "b3b0a2:a",
    leafRightOperandSiteAuthorityId: "site:a",
    referenceRootAuthorityId: "root:a",
    referenceExpressionAuthorityId: "reference:a.pos",
    whereShapeAuthorityId: "where:a",
    ownerBindingDefinitionAuthorityId: "binding:owner-a",
    ownerBindingName: "ownerA",
    referencedBindingDefinitionAuthorityId: "binding:a",
    referencedBindingName: "a",
    leafPath: "$.bindings.ownerA.where",
    leftReferenceExpression: "a.pos",
    rightOperandSnapshot: " VERB ",
    posLabelInputOpaque: " VERB ",
  });
  const b = sourceCandidate({
    id: "b3b0a2:b",
    leafRightOperandSiteAuthorityId: "site:b",
    referenceRootAuthorityId: "root:b",
    referenceExpressionAuthorityId: "reference:b.pos",
    whereShapeAuthorityId: "where:b",
    ownerBindingDefinitionAuthorityId: "binding:owner-b",
    ownerBindingName: "ownerB",
    referencedBindingDefinitionAuthorityId: "binding:b",
    referencedBindingName: "b",
    leafPath: "$.bindings.ownerB.where",
    leftReferenceExpression: "b.pos",
    rightOperandSnapshot: "   ",
    posLabelInputOpaque: "   ",
  });
  const input = sourceResult([b, a]);
  const first = derive(input);
  const second = derive(input);
  assert(
    JSON.stringify(first) === JSON.stringify(second),
    "derivation is not deterministic",
  );
});

assert(
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1 ===
    "canonical_runtime_manifest_token_pos_expected_normalized_label_eq_authority_v1",
  "unexpected producer id",
);

assert(
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_VERSION_V1 ===
    "1",
  "unexpected producer version",
);
