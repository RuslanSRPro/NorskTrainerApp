import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeManifestTokenPosStringOperandCompatibilityResultV1,
  type CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1,
} from "./canonical-runtime-manifest-token-pos-string-operand-compatibility-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1 =
  "canonical_runtime_manifest_token_pos_exact_eq_operator_source_compatibility_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1 =
  "1" as const;

export type CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1 =
  {
    id: string;
    status: "candidate";

    stringOperandCompatibilityId: string;
    tokenPosSuffixPropertyCompatibilityId: string;

    leafRightOperandSiteAuthorityId: string;
    referenceRootAuthorityId: string;
    referenceExpressionAuthorityId: string;
    whereShapeAuthorityId: string;

    ownerBindingDefinitionAuthorityId: string;
    manifestId: string;
    manifestCode: string;
    ownerBindingName: string;

    referencedBindingDefinitionAuthorityId: string;
    referencedBindingName: string;

    leafPath: string;
    leftReferenceExpression: string;

    runtimeSuffix: ".pos";
    canonicalNodeType: "token";
    canonicalPropertyDomain: "canonical_token_occurrence";
    canonicalPropertyKind: "pos_hypothesis_set";

    sourceOperatorLabelRaw: "eq";
    operatorLabelOpaque: "eq";

    rightOperandStructuralKind: "string";
    rightOperandSnapshot: string;
    posLabelInputOpaque: string;

    governance: {
      exactB3b0aResultRequired: true;
      exactB3b0aAuthorityRequired: true;
      exactB3b0aIdentityPreserved: true;

      exactLeafRightOperandSiteAuthorityPreserved: true;
      exactReferenceRootAuthorityPreserved: true;
      exactReferenceExpressionAuthorityPreserved: true;
      exactWhereShapeAuthorityPreserved: true;
      exactOwnerBindingIdentityPreserved: true;
      exactReferencedBindingIdentityPreserved: true;
      exactManifestIdentityPreserved: true;
      exactLeafPathPreserved: true;
      exactLeftReferenceExpressionPreserved: true;
      exactRuntimePosSuffixPreserved: true;
      exactStringOperandCompatibilityPreserved: true;

      sourceOperatorValueConsumedFromManifestLineage: true;
      exactRawEqOperatorRequired: true;
      rawOperatorComparedByExactStringEquality: true;
      operatorSourceVocabularyCompatibilityOnly: true;

      operatorWhitespaceTrimmed: false;
      operatorUnicodeNormalized: false;
      operatorCaseFolded: false;
      operatorAliasResolved: false;

      operatorSemanticsResolved: false;
      genericRuntimeEqSemanticsResolved: false;
      genericJsonEqualitySemanticsResolved: false;
      tokenPosNormalizedLabelEqSemanticsResolved: false;

      posVocabularyValidated: false;
      operandKnownCanonicalPosLabel: false;
      expectedPosLabelNormalized: false;
      rightOperandNormalizationPerformed: false;

      canonicalPosHypothesisRead: false;
      canonicalPosHypothesisNormalized: false;
      actualPosLabelCompared: false;
      comparisonPerformed: false;
      comparisonTruthResolved: false;
      runtimeConditionTruthResolved: false;

      candidateSentenceDomainConsumed: false;
      tokenNodeIdInspected: false;
      occurrenceEnumerationPerformed: false;
      occurrenceFilteringPerformed: false;
      occurrenceBindingPerformed: false;
      cardinalityEnforcementPerformed: false;

      graphMutationPerformed: false;
      learnerErrorClassified: false;

      candidateOnly: true;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1;
    status: "ready" | "blocked";

    candidates:
      CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1[];

    consideredStringOperandCompatibilityCount: number;
    exactEqOperatorCompatibleCount: number;
    unsupportedOperatorCompatibilityIds: string[];

    blockingReasons: string[];
  };

const EXPECTED_B3B0A_GOVERNANCE = {
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

function present(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
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

function safeB3b0aCandidate(
  candidate: CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1,
): boolean {
  return (
    candidate.status === "candidate" &&
    present(candidate.id) &&
    present(candidate.tokenPosSuffixPropertyCompatibilityId) &&
    present(candidate.leafRightOperandSiteAuthorityId) &&
    present(candidate.referenceRootAuthorityId) &&
    present(candidate.referenceExpressionAuthorityId) &&
    present(candidate.whereShapeAuthorityId) &&
    present(candidate.ownerBindingDefinitionAuthorityId) &&
    present(candidate.manifestId) &&
    present(candidate.manifestCode) &&
    present(candidate.ownerBindingName) &&
    present(candidate.referencedBindingDefinitionAuthorityId) &&
    present(candidate.referencedBindingName) &&
    present(candidate.leafPath) &&
    present(candidate.leftReferenceExpression) &&
    present(candidate.operatorLabelOpaque) &&
    candidate.runtimeSuffix === ".pos" &&
    candidate.canonicalNodeType === "token" &&
    candidate.canonicalPropertyDomain === "canonical_token_occurrence" &&
    candidate.canonicalPropertyKind === "pos_hypothesis_set" &&
    candidate.rightOperandStructuralKind === "string" &&
    present(candidate.rightOperandSnapshot) &&
    candidate.posLabelInputOpaque === candidate.rightOperandSnapshot &&
    exactGovernance(candidate.governance, EXPECTED_B3B0A_GOVERNANCE)
  );
}

function identityKey(
  candidate: CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1,
): string {
  return JSON.stringify([
    candidate.leafRightOperandSiteAuthorityId,
    candidate.referenceRootAuthorityId,
    candidate.referenceExpressionAuthorityId,
    candidate.whereShapeAuthorityId,
    candidate.ownerBindingDefinitionAuthorityId,
    candidate.manifestId,
    candidate.manifestCode,
    candidate.ownerBindingName,
    candidate.referencedBindingDefinitionAuthorityId,
    candidate.referencedBindingName,
    candidate.leafPath,
    candidate.leftReferenceExpression,
  ]);
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1,
    status: "blocked",
    candidates: [],
    consideredStringOperandCompatibilityCount: 0,
    exactEqOperatorCompatibleCount: 0,
    unsupportedOperatorCompatibilityIds: [],
    blockingReasons: uniqueSorted(reasons),
  };
}

export function deriveCanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilitiesV1(
  input: CanonicalRuntimeManifestTokenPosStringOperandCompatibilityResultV1,
): CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityResultV1 {
  const blockingReasons: string[] = [];

  if (
    input.producer !==
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1 ||
    input.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1 ||
    input.status !== "ready" ||
    input.blockingReasons.length !== 0 ||
    input.stringOperandCompatibleCount !== input.candidates.length
  ) {
    blockingReasons.push("b3b0a_result:not_exact_ready");
  }

  const seenIds = new Set<string>();
  const seenIdentities = new Set<string>();

  for (const candidate of input.candidates) {
    if (!safeB3b0aCandidate(candidate)) {
      blockingReasons.push(`b3b0a:${candidate.id}:unsafe_contract`);
    }

    if (seenIds.has(candidate.id)) {
      blockingReasons.push(`b3b0a:${candidate.id}:duplicate_id`);
    }

    seenIds.add(candidate.id);

    const key = identityKey(candidate);

    if (seenIdentities.has(key)) {
      blockingReasons.push(
        `b3b0a:${candidate.id}:duplicate_exact_site_identity`,
      );
    }

    seenIdentities.add(key);
  }

  if (blockingReasons.length !== 0) {
    return blocked(blockingReasons);
  }

  const candidates:
    CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1[] = [];

  const unsupportedOperatorCompatibilityIds: string[] = [];

  for (const candidate of input.candidates) {
    if (candidate.operatorLabelOpaque !== "eq") {
      unsupportedOperatorCompatibilityIds.push(candidate.id);
      continue;
    }

    candidates.push({
      id: [
        CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1,
        candidate.id,
      ].join(":"),

      status: "candidate",

      stringOperandCompatibilityId: candidate.id,
      tokenPosSuffixPropertyCompatibilityId:
        candidate.tokenPosSuffixPropertyCompatibilityId,

      leafRightOperandSiteAuthorityId:
        candidate.leafRightOperandSiteAuthorityId,
      referenceRootAuthorityId: candidate.referenceRootAuthorityId,
      referenceExpressionAuthorityId: candidate.referenceExpressionAuthorityId,
      whereShapeAuthorityId: candidate.whereShapeAuthorityId,

      ownerBindingDefinitionAuthorityId:
        candidate.ownerBindingDefinitionAuthorityId,
      manifestId: candidate.manifestId,
      manifestCode: candidate.manifestCode,
      ownerBindingName: candidate.ownerBindingName,

      referencedBindingDefinitionAuthorityId:
        candidate.referencedBindingDefinitionAuthorityId,
      referencedBindingName: candidate.referencedBindingName,

      leafPath: candidate.leafPath,
      leftReferenceExpression: candidate.leftReferenceExpression,

      runtimeSuffix: ".pos",
      canonicalNodeType: "token",
      canonicalPropertyDomain: "canonical_token_occurrence",
      canonicalPropertyKind: "pos_hypothesis_set",

      sourceOperatorLabelRaw: "eq",
      operatorLabelOpaque: "eq",

      rightOperandStructuralKind: "string",
      rightOperandSnapshot: candidate.rightOperandSnapshot,
      posLabelInputOpaque: candidate.posLabelInputOpaque,

      governance: {
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

        candidateOnly: true,
        frozenGrammarReadOnly: true,
      },
    });
  }

  candidates.sort((a, b) => a.id.localeCompare(b.id));

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1,
    status: "ready",
    candidates,
    consideredStringOperandCompatibilityCount: input.candidates.length,
    exactEqOperatorCompatibleCount: candidates.length,
    unsupportedOperatorCompatibilityIds: uniqueSorted(
      unsupportedOperatorCompatibilityIds,
    ),
    blockingReasons: [],
  };
}
