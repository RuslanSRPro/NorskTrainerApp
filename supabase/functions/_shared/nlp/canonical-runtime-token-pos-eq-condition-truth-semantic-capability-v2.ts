import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
  type CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_V2 =
  "canonical_runtime_token_pos_eq_condition_truth_semantic_capability_v2" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_VERSION_V2 =
  "2" as const;

export type CanonicalRuntimeTokenPosEqConditionApplicabilityStateV2 =
  | "no_matching_site_domain"
  | "matching_site_domain_no_token_occurrence"
  | "unique_site_snapshot_token_occurrence_match"
  | "multiple_site_snapshot_token_occurrence_matches";

export type CanonicalRuntimeTokenPosEqConditionComparisonEvidenceStateV2 =
  | "no_pos_fact"
  | "blocked_hypothesis_set"
  | "open_match_possible"
  | "open_no_surviving_match"
  | "explicit_resolved_match"
  | "explicit_resolved_non_match"
  | "explicit_resolved_mixed";

export type CanonicalRuntimeTokenPosEqConditionTruthDispositionV2 =
  | "resolved_true"
  | "resolved_false"
  | "unresolved";

export type CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2 = {
  capabilityId:
    typeof CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_V2;

  version:
    typeof CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_VERSION_V2;

  status: "proven";

  semanticDomain:
    "canonical_runtime_token_pos_normalized_eq_leaf_condition_truth";

  sourceNormalizedEqSemanticCapabilityId:
    CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1[
      "capabilityId"
    ];

  sourceNormalizedEqSemanticCapabilityVersion:
    CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1["version"];

  sourceNormalizedEqSemanticCapability:
    CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1;

  applicabilityEligibility: {
    requiredApplicabilityState: "unique_site_snapshot_token_occurrence_match";

    requiredExactSiteSnapshotTokenOccurrenceMatchCount: 1;

    nonEligibleApplicabilityStates: readonly [
      "no_matching_site_domain",
      "matching_site_domain_no_token_occurrence",
      "multiple_site_snapshot_token_occurrence_matches",
    ];

    nonEligibleApplicabilityStatesForceUnresolved: true;
  };

  comparisonEvidenceStateDomain: readonly [
    "no_pos_fact",
    "blocked_hypothesis_set",
    "open_match_possible",
    "open_no_surviving_match",
    "explicit_resolved_match",
    "explicit_resolved_non_match",
    "explicit_resolved_mixed",
  ];

  truthDispositionDomain: readonly [
    "resolved_true",
    "resolved_false",
    "unresolved",
  ];

  comparisonEvidenceDispositionMapping: {
    no_pos_fact: "unresolved";

    blocked_hypothesis_set: "unresolved";

    open_match_possible: "unresolved";

    open_no_surviving_match: "unresolved";

    explicit_resolved_match: "resolved_true";

    explicit_resolved_non_match: "resolved_false";

    explicit_resolved_mixed: "unresolved";
  };

  booleanEligibilityByDisposition: {
    resolved_true: true;

    resolved_false: true;

    unresolved: false;
  };

  futureBooleanProjectionAuthorization: {
    resolvedTrueMayProjectToBooleanTrue: true;

    resolvedFalseMayProjectToBooleanFalse: true;

    unresolvedMayProjectToBoolean: false;

    executionMustOccurInSeparateComposer: true;
  };

  unresolvedSemantics: {
    noPosFactIsFalse: false;

    blockedHypothesisSetIsFalse: false;

    openMatchPossibleIsTrue: false;

    openNoSurvivingMatchIsFalse: false;

    explicitResolvedMixedIsFalse: false;

    nonUniqueApplicabilityIsFalse: false;

    unresolvedMayBeCollapsedToFalse: false;
  };

  governance: {
    exactTokenPosNormalizedEqSemanticDomainRequired: true;

    sourceNormalizedEqSemanticCapabilityExactSingletonRequired: true;

    uniqueApplicabilityRequiredForBooleanEligibility: true;

    exactSingleOccurrenceMatchRequiredForBooleanEligibility: true;

    explicitResolvedMatchMapsToResolvedTrue: true;

    explicitResolvedNonMatchMapsToResolvedFalse: true;

    allOtherComparisonStatesRemainUnresolved: true;

    nonUniqueApplicabilityAlwaysRemainsUnresolved: true;

    unresolvedNeverCollapsedToFalse: true;

    comparisonStateVocabularySpecified: true;

    applicabilityStateVocabularySpecified: true;

    truthDispositionVocabularySpecified: true;

    futureBooleanProjectionAuthorizationSpecified: true;

    semanticSpecificationOnly: true;

    familyNeutral: true;

    frozenGrammarReadOnly: true;

    d2aResultConsumed: false;

    comparisonEvidenceConsumed: false;

    surfaceConsumed: false;

    graphConsumed: false;

    runtimeManifestConsumed: false;

    runtimeDomainConsumed: false;

    historicalLeafRootDispositionConsumed: false;

    historicalDomainComparisonConsumed: false;

    historicalRuntimeEqAuthorityConsumed: false;

    applicabilitySelectionPerformed: false;

    booleanTruthExecuted: false;

    runtimeConditionEvaluated: false;

    runtimeSentenceContextSelected: false;

    occurrenceFilteringPerformed: false;

    occurrenceWinnerSelected: false;

    finalRuntimeOccurrenceBindingPerformed: false;

    expectedOperandReadPerformed: false;

    actualPosLabelReadPerformed: false;

    posNormalizationPerformed: false;

    posComparisonPerformed: false;

    comparisonTruthResolved: false;

    compoundTruthComposed: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforcementPerformed: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;
  };
};

export const CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2:
  CanonicalRuntimeTokenPosEqConditionTruthSemanticCapabilityV2 = {
    capabilityId:
      CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_V2,

    version:
      CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_VERSION_V2,

    status: "proven",

    semanticDomain:
      "canonical_runtime_token_pos_normalized_eq_leaf_condition_truth",

    sourceNormalizedEqSemanticCapabilityId:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1
        .capabilityId,

    sourceNormalizedEqSemanticCapabilityVersion:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1
        .version,

    sourceNormalizedEqSemanticCapability:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,

    applicabilityEligibility: {
      requiredApplicabilityState: "unique_site_snapshot_token_occurrence_match",

      requiredExactSiteSnapshotTokenOccurrenceMatchCount: 1,

      nonEligibleApplicabilityStates: [
        "no_matching_site_domain",
        "matching_site_domain_no_token_occurrence",
        "multiple_site_snapshot_token_occurrence_matches",
      ],

      nonEligibleApplicabilityStatesForceUnresolved: true,
    },

    comparisonEvidenceStateDomain: [
      "no_pos_fact",
      "blocked_hypothesis_set",
      "open_match_possible",
      "open_no_surviving_match",
      "explicit_resolved_match",
      "explicit_resolved_non_match",
      "explicit_resolved_mixed",
    ],

    truthDispositionDomain: [
      "resolved_true",
      "resolved_false",
      "unresolved",
    ],

    comparisonEvidenceDispositionMapping: {
      no_pos_fact: "unresolved",

      blocked_hypothesis_set: "unresolved",

      open_match_possible: "unresolved",

      open_no_surviving_match: "unresolved",

      explicit_resolved_match: "resolved_true",

      explicit_resolved_non_match: "resolved_false",

      explicit_resolved_mixed: "unresolved",
    },

    booleanEligibilityByDisposition: {
      resolved_true: true,

      resolved_false: true,

      unresolved: false,
    },

    futureBooleanProjectionAuthorization: {
      resolvedTrueMayProjectToBooleanTrue: true,

      resolvedFalseMayProjectToBooleanFalse: true,

      unresolvedMayProjectToBoolean: false,

      executionMustOccurInSeparateComposer: true,
    },

    unresolvedSemantics: {
      noPosFactIsFalse: false,

      blockedHypothesisSetIsFalse: false,

      openMatchPossibleIsTrue: false,

      openNoSurvivingMatchIsFalse: false,

      explicitResolvedMixedIsFalse: false,

      nonUniqueApplicabilityIsFalse: false,

      unresolvedMayBeCollapsedToFalse: false,
    },

    governance: {
      exactTokenPosNormalizedEqSemanticDomainRequired: true,

      sourceNormalizedEqSemanticCapabilityExactSingletonRequired: true,

      uniqueApplicabilityRequiredForBooleanEligibility: true,

      exactSingleOccurrenceMatchRequiredForBooleanEligibility: true,

      explicitResolvedMatchMapsToResolvedTrue: true,

      explicitResolvedNonMatchMapsToResolvedFalse: true,

      allOtherComparisonStatesRemainUnresolved: true,

      nonUniqueApplicabilityAlwaysRemainsUnresolved: true,

      unresolvedNeverCollapsedToFalse: true,

      comparisonStateVocabularySpecified: true,

      applicabilityStateVocabularySpecified: true,

      truthDispositionVocabularySpecified: true,

      futureBooleanProjectionAuthorizationSpecified: true,

      semanticSpecificationOnly: true,

      familyNeutral: true,

      frozenGrammarReadOnly: true,

      d2aResultConsumed: false,

      comparisonEvidenceConsumed: false,

      surfaceConsumed: false,

      graphConsumed: false,

      runtimeManifestConsumed: false,

      runtimeDomainConsumed: false,

      historicalLeafRootDispositionConsumed: false,

      historicalDomainComparisonConsumed: false,

      historicalRuntimeEqAuthorityConsumed: false,

      applicabilitySelectionPerformed: false,

      booleanTruthExecuted: false,

      runtimeConditionEvaluated: false,

      runtimeSentenceContextSelected: false,

      occurrenceFilteringPerformed: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      expectedOperandReadPerformed: false,

      actualPosLabelReadPerformed: false,

      posNormalizationPerformed: false,

      posComparisonPerformed: false,

      comparisonTruthResolved: false,

      compoundTruthComposed: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,
    },
  };
