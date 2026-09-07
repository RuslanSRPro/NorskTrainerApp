export const CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1 =
  "canonical_token_pos_normalized_label_eq_semantic_capability_v1" as const;

export const CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1 =
  "1" as const;

export const CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1 = {
  inputType: "string",
  trimWhitespace: true,
  emptyAfterTrimUnsupported: true,
  unicodeNormalization: "NFC",
  localeCaseTransform: "toLocaleLowerCase",
  locale: "nb-NO",
  equalityAfterNormalization: "exact_string_equality",
} as const;

export type CanonicalTokenPosNormalizedLabelNormalizationContractV1 =
  typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1;

export type CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1 = {
  capabilityId:
    typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1;
  version:
    typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1;
  status: "proven";
  semanticDomain: "canonical_token_pos_normalized_label_equality";
  canonicalPropertyDomain: "canonical_token_occurrence";
  canonicalPropertyKind: "pos_hypothesis_set";
  canonicalOperatorLabel: "eq";
  sourceRequirement: {
    exactRawSourceEqMustAlreadyBeProven: true;
    sourceOperatorParsingPerformed: false;
    operatorAliasNormalizationAuthorized: false;
  };
  expectedLabelNormalization:
    CanonicalTokenPosNormalizedLabelNormalizationContractV1;
  actualLabelNormalization:
    CanonicalTokenPosNormalizedLabelNormalizationContractV1;
  equalitySemantics: {
    leftValue: "normalized_actual_pos_label";
    relation: "exact_string_equality";
    rightValue: "normalized_expected_pos_label";
  };
  governance: {
    familyNeutral: true;
    runtimeProducerIndependent: true;
    manifestIndependent: true;
    exactSourceEqRequired: true;
    expectedLabelNormalizationSpecified: true;
    actualLabelNormalizationSpecified: true;
    normalizedLabelEqualitySemanticsSpecified: true;
    genericRuntimeEqAuthorityExcluded: true;
    genericJsonEqualityAuthorityExcluded: true;
    operatorAliasNormalizationAuthorized: false;
    sourceOperatorParsingPerformed: false;
    posVocabularyValidated: false;
    operandKnownCanonicalPosLabel: false;
    canonicalPosHypothesisRead: false;
    canonicalPosHypothesisSelected: false;
    expectedOperandReadPerformed: false;
    actualPosLabelReadPerformed: false;
    comparisonExecuted: false;
    comparisonTruthResolved: false;
    runtimeConditionTruthResolved: false;
    sentenceDomainConsumed: false;
    occurrenceEnumerationPerformed: false;
    occurrenceFilteringPerformed: false;
    occurrenceBindingPerformed: false;
    cardinalityEnforcementPerformed: false;
    graphMutationPerformed: false;
    learnerErrorClassified: false;
    frozenGrammarReadOnly: true;
  };
};

export const CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1:
  CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1 = {
    capabilityId:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,
    version:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1,
    status: "proven",
    semanticDomain: "canonical_token_pos_normalized_label_equality",
    canonicalPropertyDomain: "canonical_token_occurrence",
    canonicalPropertyKind: "pos_hypothesis_set",
    canonicalOperatorLabel: "eq",
    sourceRequirement: {
      exactRawSourceEqMustAlreadyBeProven: true,
      sourceOperatorParsingPerformed: false,
      operatorAliasNormalizationAuthorized: false,
    },
    expectedLabelNormalization:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1,
    actualLabelNormalization:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1,
    equalitySemantics: {
      leftValue: "normalized_actual_pos_label",
      relation: "exact_string_equality",
      rightValue: "normalized_expected_pos_label",
    },
    governance: {
      familyNeutral: true,
      runtimeProducerIndependent: true,
      manifestIndependent: true,
      exactSourceEqRequired: true,
      expectedLabelNormalizationSpecified: true,
      actualLabelNormalizationSpecified: true,
      normalizedLabelEqualitySemanticsSpecified: true,
      genericRuntimeEqAuthorityExcluded: true,
      genericJsonEqualityAuthorityExcluded: true,
      operatorAliasNormalizationAuthorized: false,
      sourceOperatorParsingPerformed: false,
      posVocabularyValidated: false,
      operandKnownCanonicalPosLabel: false,
      canonicalPosHypothesisRead: false,
      canonicalPosHypothesisSelected: false,
      expectedOperandReadPerformed: false,
      actualPosLabelReadPerformed: false,
      comparisonExecuted: false,
      comparisonTruthResolved: false,
      runtimeConditionTruthResolved: false,
      sentenceDomainConsumed: false,
      occurrenceEnumerationPerformed: false,
      occurrenceFilteringPerformed: false,
      occurrenceBindingPerformed: false,
      cardinalityEnforcementPerformed: false,
      graphMutationPerformed: false,
      learnerErrorClassified: false,
      frozenGrammarReadOnly: true,
    },
  };
