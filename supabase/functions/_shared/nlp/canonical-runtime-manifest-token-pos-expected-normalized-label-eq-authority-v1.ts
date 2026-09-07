import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityResultV1,
  type CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1,
} from "./canonical-runtime-manifest-token-pos-exact-eq-operator-source-compatibility-v1.ts";
import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1,
  type CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1 =
  "canonical_runtime_manifest_token_pos_expected_normalized_label_eq_authority_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_VERSION_V1 =
  "1" as const;

type StatusV1 = "candidate";

export type CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1 =
  {
    id: string;
    status: StatusV1;

    exactEqOperatorSourceCompatibilityId: string;
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
    canonicalOperatorLabel: "eq";

    rightOperandStructuralKind: "string";
    rightOperandSnapshot: string;
    posLabelInputOpaque: string;

    normalizedExpectedPosLabel: string;

    semanticCapabilityId:
      typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1;
    semanticCapabilityVersion:
      typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1;
    semanticDomain: "canonical_token_pos_normalized_label_equality";

    expectedNormalizationContract: {
      inputType: "string";
      trimWhitespace: true;
      emptyAfterTrimUnsupported: true;
      unicodeNormalization: "NFC";
      localeCaseTransform: "toLocaleLowerCase";
      locale: "nb-NO";
      equalityAfterNormalization: "exact_string_equality";
    };

    equalitySemantics: {
      leftValue: "normalized_actual_pos_label";
      relation: "exact_string_equality";
      rightValue: "normalized_expected_pos_label";
    };

    governance: {
      exactSourceEqResultRequired: true;
      exactSourceEqAuthorityRequired: true;
      exactSourceEqIdentityPreserved: true;

      exactSemanticCapabilityRequired: true;
      exactSemanticCapabilityIdentityPreserved: true;
      semanticCapabilityContractValidatedBeforeExecution: true;

      exactManifestIdentityPreserved: true;
      exactOwnerBindingIdentityPreserved: true;
      exactReferencedBindingIdentityPreserved: true;
      exactLeafSiteIdentityPreserved: true;
      exactRuntimePosSuffixPreserved: true;

      exactRawSourceEqConsumed: true;
      sourceOperatorParsingPerformed: false;
      operatorAliasNormalizationAuthorized: false;
      operatorSemanticsReconstructed: false;

      expectedOperandReadPerformed: true;
      expectedLabelNormalizationPerformed: true;
      expectedLabelTrimPerformed: true;
      expectedLabelEmptyAfterTrimUnsupported: true;
      expectedLabelUnicodeNfcPerformed: true;
      expectedLabelNbNoLowercasePerformed: true;
      normalizedExpectedLabelProduced: true;

      posVocabularyValidated: false;
      operandKnownCanonicalPosLabel: false;

      canonicalPosHypothesisRead: false;
      canonicalPosHypothesisSelected: false;
      actualPosLabelReadPerformed: false;
      actualPosLabelNormalizationPerformed: false;

      comparisonExecuted: false;
      comparisonTruthResolved: false;
      runtimeConditionTruthResolved: false;

      candidateSentenceDomainConsumed: false;
      tokenNodeIdInspected: false;
      occurrenceEnumerationPerformed: false;
      occurrenceFilteringPerformed: false;
      occurrenceBindingPerformed: false;
      cardinalityEnforcementPerformed: false;

      genericRuntimeEqAuthority: false;
      genericJsonEqualityAuthority: false;

      graphMutationPerformed: false;
      learnerErrorClassified: false;

      candidateOnly: true;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_VERSION_V1;
    status: "ready" | "blocked";
    candidates:
      CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1[];
    consideredExactEqSourceCompatibilityCount: number;
    expectedNormalizedLabelAuthorityCount: number;
    unsupportedExpectedOperandCompatibilityIds: string[];
    blockingReasons: string[];
  };

const EXPECTED_SOURCE_GOVERNANCE = {
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

function sameBooleanGovernance(
  actual: Record<string, unknown>,
  expected: Record<string, boolean>,
): boolean {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) return false;
  }
  return true;
}

function isSafeSourceCandidate(
  candidate:
    CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1,
): boolean {
  return candidate.status === "candidate" &&
    candidate.runtimeSuffix === ".pos" &&
    candidate.canonicalNodeType === "token" &&
    candidate.canonicalPropertyDomain === "canonical_token_occurrence" &&
    candidate.canonicalPropertyKind === "pos_hypothesis_set" &&
    candidate.sourceOperatorLabelRaw === "eq" &&
    candidate.operatorLabelOpaque === "eq" &&
    candidate.rightOperandStructuralKind === "string" &&
    typeof candidate.rightOperandSnapshot === "string" &&
    typeof candidate.posLabelInputOpaque === "string" &&
    candidate.posLabelInputOpaque === candidate.rightOperandSnapshot &&
    sameBooleanGovernance(
      candidate.governance as unknown as Record<string, unknown>,
      EXPECTED_SOURCE_GOVERNANCE,
    );
}

function isExactSemanticCapability(
  capability: CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
): boolean {
  return capability.capabilityId ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1 &&
    capability.version ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1 &&
    capability.status === "proven" &&
    capability.semanticDomain ===
      "canonical_token_pos_normalized_label_equality" &&
    capability.canonicalPropertyDomain === "canonical_token_occurrence" &&
    capability.canonicalPropertyKind === "pos_hypothesis_set" &&
    capability.canonicalOperatorLabel === "eq" &&
    capability.sourceRequirement.exactRawSourceEqMustAlreadyBeProven === true &&
    capability.sourceRequirement.sourceOperatorParsingPerformed === false &&
    capability.sourceRequirement.operatorAliasNormalizationAuthorized ===
      false &&
    capability.expectedLabelNormalization.inputType === "string" &&
    capability.expectedLabelNormalization.trimWhitespace === true &&
    capability.expectedLabelNormalization.emptyAfterTrimUnsupported === true &&
    capability.expectedLabelNormalization.unicodeNormalization === "NFC" &&
    capability.expectedLabelNormalization.localeCaseTransform ===
      "toLocaleLowerCase" &&
    capability.expectedLabelNormalization.locale === "nb-NO" &&
    capability.expectedLabelNormalization.equalityAfterNormalization ===
      "exact_string_equality" &&
    capability.actualLabelNormalization ===
      capability.expectedLabelNormalization &&
    capability.equalitySemantics.leftValue ===
      "normalized_actual_pos_label" &&
    capability.equalitySemantics.relation === "exact_string_equality" &&
    capability.equalitySemantics.rightValue ===
      "normalized_expected_pos_label" &&
    capability.governance.familyNeutral === true &&
    capability.governance.runtimeProducerIndependent === true &&
    capability.governance.manifestIndependent === true &&
    capability.governance.exactSourceEqRequired === true &&
    capability.governance.expectedLabelNormalizationSpecified === true &&
    capability.governance.actualLabelNormalizationSpecified === true &&
    capability.governance.normalizedLabelEqualitySemanticsSpecified === true &&
    capability.governance.genericRuntimeEqAuthorityExcluded === true &&
    capability.governance.genericJsonEqualityAuthorityExcluded === true &&
    capability.governance.operatorAliasNormalizationAuthorized === false &&
    capability.governance.sourceOperatorParsingPerformed === false &&
    capability.governance.posVocabularyValidated === false &&
    capability.governance.operandKnownCanonicalPosLabel === false &&
    capability.governance.canonicalPosHypothesisRead === false &&
    capability.governance.canonicalPosHypothesisSelected === false &&
    capability.governance.expectedOperandReadPerformed === false &&
    capability.governance.actualPosLabelReadPerformed === false &&
    capability.governance.comparisonExecuted === false &&
    capability.governance.comparisonTruthResolved === false &&
    capability.governance.runtimeConditionTruthResolved === false &&
    capability.governance.sentenceDomainConsumed === false &&
    capability.governance.occurrenceEnumerationPerformed === false &&
    capability.governance.occurrenceFilteringPerformed === false &&
    capability.governance.occurrenceBindingPerformed === false &&
    capability.governance.cardinalityEnforcementPerformed === false &&
    capability.governance.graphMutationPerformed === false &&
    capability.governance.learnerErrorClassified === false &&
    capability.governance.frozenGrammarReadOnly === true;
}

export function normalizeCanonicalRuntimeManifestExpectedPosLabelV1(
  value: unknown,
  capability: CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1 =
    CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
): string | undefined {
  if (!isExactSemanticCapability(capability)) return undefined;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return trimmed.normalize("NFC").toLocaleLowerCase("nb-NO");
}

function duplicateIdentityKey(
  candidate:
    CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1,
): string {
  return [
    candidate.manifestId,
    candidate.manifestCode,
    candidate.ownerBindingDefinitionAuthorityId,
    candidate.ownerBindingName,
    candidate.referencedBindingDefinitionAuthorityId,
    candidate.referencedBindingName,
    candidate.leafRightOperandSiteAuthorityId,
    candidate.referenceExpressionAuthorityId,
    candidate.leafPath,
  ].join("\u001f");
}

function outputId(
  candidate:
    CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityV1,
): string {
  return `${CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1}:${candidate.id}`;
}

export function deriveCanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthoritiesV1(
  source:
    CanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilityResultV1,
  semanticCapability:
    CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1 =
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
): CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityResultV1 {
  const blocked = (
    reason: string,
  ): CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityResultV1 => ({
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_VERSION_V1,
    status: "blocked",
    candidates: [],
    consideredExactEqSourceCompatibilityCount: 0,
    expectedNormalizedLabelAuthorityCount: 0,
    unsupportedExpectedOperandCompatibilityIds: [],
    blockingReasons: [reason],
  });

  if (
    source.producer !==
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_V1 ||
    source.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXACT_EQ_OPERATOR_SOURCE_COMPATIBILITY_VERSION_V1 ||
    source.status !== "ready" ||
    source.blockingReasons.length !== 0 ||
    source.exactEqOperatorCompatibleCount !== source.candidates.length
  ) {
    return blocked("b3b0a2_result:not_exact_ready");
  }

  if (!isExactSemanticCapability(semanticCapability)) {
    return blocked("b3b0b0_semantic_capability:not_exact_proven");
  }

  const seenIds = new Set<string>();
  const seenIdentities = new Set<string>();

  for (const candidate of source.candidates) {
    if (!isSafeSourceCandidate(candidate)) {
      return blocked(`b3b0a2_candidate:unsafe_contract:${candidate.id}`);
    }

    if (seenIds.has(candidate.id)) {
      return blocked(`b3b0a2_candidate:duplicate_id:${candidate.id}`);
    }
    seenIds.add(candidate.id);

    const identity = duplicateIdentityKey(candidate);
    if (seenIdentities.has(identity)) {
      return blocked(
        `b3b0a2_candidate:duplicate_exact_site_identity:${candidate.id}`,
      );
    }
    seenIdentities.add(identity);
  }

  const candidates:
    CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1[] = [];
  const unsupportedExpectedOperandCompatibilityIds: string[] = [];

  for (const sourceCandidate of source.candidates) {
    const normalizedExpectedPosLabel =
      normalizeCanonicalRuntimeManifestExpectedPosLabelV1(
        sourceCandidate.posLabelInputOpaque,
        semanticCapability,
      );

    if (!normalizedExpectedPosLabel) {
      unsupportedExpectedOperandCompatibilityIds.push(sourceCandidate.id);
      continue;
    }

    candidates.push({
      id: outputId(sourceCandidate),
      status: "candidate",

      exactEqOperatorSourceCompatibilityId: sourceCandidate.id,
      stringOperandCompatibilityId:
        sourceCandidate.stringOperandCompatibilityId,
      tokenPosSuffixPropertyCompatibilityId:
        sourceCandidate.tokenPosSuffixPropertyCompatibilityId,
      leafRightOperandSiteAuthorityId:
        sourceCandidate.leafRightOperandSiteAuthorityId,
      referenceRootAuthorityId: sourceCandidate.referenceRootAuthorityId,
      referenceExpressionAuthorityId:
        sourceCandidate.referenceExpressionAuthorityId,
      whereShapeAuthorityId: sourceCandidate.whereShapeAuthorityId,

      ownerBindingDefinitionAuthorityId:
        sourceCandidate.ownerBindingDefinitionAuthorityId,
      manifestId: sourceCandidate.manifestId,
      manifestCode: sourceCandidate.manifestCode,
      ownerBindingName: sourceCandidate.ownerBindingName,
      referencedBindingDefinitionAuthorityId:
        sourceCandidate.referencedBindingDefinitionAuthorityId,
      referencedBindingName: sourceCandidate.referencedBindingName,

      leafPath: sourceCandidate.leafPath,
      leftReferenceExpression: sourceCandidate.leftReferenceExpression,
      runtimeSuffix: ".pos",

      canonicalNodeType: "token",
      canonicalPropertyDomain: "canonical_token_occurrence",
      canonicalPropertyKind: "pos_hypothesis_set",

      sourceOperatorLabelRaw: "eq",
      canonicalOperatorLabel: "eq",

      rightOperandStructuralKind: "string",
      rightOperandSnapshot: sourceCandidate.rightOperandSnapshot,
      posLabelInputOpaque: sourceCandidate.posLabelInputOpaque,

      normalizedExpectedPosLabel,

      semanticCapabilityId:
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,
      semanticCapabilityVersion:
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1,
      semanticDomain: "canonical_token_pos_normalized_label_equality",

      expectedNormalizationContract:
        semanticCapability.expectedLabelNormalization,

      equalitySemantics: semanticCapability.equalitySemantics,

      governance: {
        exactSourceEqResultRequired: true,
        exactSourceEqAuthorityRequired: true,
        exactSourceEqIdentityPreserved: true,

        exactSemanticCapabilityRequired: true,
        exactSemanticCapabilityIdentityPreserved: true,
        semanticCapabilityContractValidatedBeforeExecution: true,

        exactManifestIdentityPreserved: true,
        exactOwnerBindingIdentityPreserved: true,
        exactReferencedBindingIdentityPreserved: true,
        exactLeafSiteIdentityPreserved: true,
        exactRuntimePosSuffixPreserved: true,

        exactRawSourceEqConsumed: true,
        sourceOperatorParsingPerformed: false,
        operatorAliasNormalizationAuthorized: false,
        operatorSemanticsReconstructed: false,

        expectedOperandReadPerformed: true,
        expectedLabelNormalizationPerformed: true,
        expectedLabelTrimPerformed: true,
        expectedLabelEmptyAfterTrimUnsupported: true,
        expectedLabelUnicodeNfcPerformed: true,
        expectedLabelNbNoLowercasePerformed: true,
        normalizedExpectedLabelProduced: true,

        posVocabularyValidated: false,
        operandKnownCanonicalPosLabel: false,

        canonicalPosHypothesisRead: false,
        canonicalPosHypothesisSelected: false,
        actualPosLabelReadPerformed: false,
        actualPosLabelNormalizationPerformed: false,

        comparisonExecuted: false,
        comparisonTruthResolved: false,
        runtimeConditionTruthResolved: false,

        candidateSentenceDomainConsumed: false,
        tokenNodeIdInspected: false,
        occurrenceEnumerationPerformed: false,
        occurrenceFilteringPerformed: false,
        occurrenceBindingPerformed: false,
        cardinalityEnforcementPerformed: false,

        genericRuntimeEqAuthority: false,
        genericJsonEqualityAuthority: false,

        graphMutationPerformed: false,
        learnerErrorClassified: false,

        candidateOnly: true,
        frozenGrammarReadOnly: true,
      },
    });
  }

  candidates.sort((a, b) => a.id.localeCompare(b.id));

  unsupportedExpectedOperandCompatibilityIds.sort((a, b) => a.localeCompare(b));

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_VERSION_V1,
    status: "ready",
    candidates,
    consideredExactEqSourceCompatibilityCount: source.candidates.length,
    expectedNormalizedLabelAuthorityCount: candidates.length,
    unsupportedExpectedOperandCompatibilityIds: [
      ...new Set(unsupportedExpectedOperandCompatibilityIds),
    ],
    blockingReasons: [],
  };
}
