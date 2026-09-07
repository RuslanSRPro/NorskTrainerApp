import {
  CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1,
  type CanonicalTokenPosHypothesisMemberReadV1,
  type CanonicalTokenPosHypothesisSetReadResultV1,
  type CanonicalTokenPosHypothesisSetReadStateV1,
  type CanonicalTokenPosHypothesisSetReadV1,
} from "./canonical-token-pos-hypothesis-set-read-v1.ts";

import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1,
  type CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
  type CanonicalTokenPosNormalizedLabelNormalizationContractV1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

export const CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V2 =
  "canonical_token_pos_hypothesis_set_normalized_label_projection_v2";

export const CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_VERSION_V2 =
  "2";

export type CanonicalTokenPosNormalizedHypothesisMemberV2 = {
  posReadingNodeId: string;

  rawPosLabel: string;

  normalizedPosLabel: string;

  graphStatus: CanonicalTokenPosHypothesisMemberReadV1["graphStatus"];

  explicitlyResolved: boolean;
};

export type CanonicalTokenPosHypothesisSetNormalizedLabelProjectionV2 = {
  projectionId: string;

  status: "candidate";

  sourceReadId: string;

  tokenNodeId: string;

  readState: CanonicalTokenPosHypothesisSetReadStateV1;

  alternativeSetId: string | null;

  alternativeSetStatus:
    CanonicalTokenPosHypothesisSetReadV1["alternativeSetStatus"];

  members: CanonicalTokenPosNormalizedHypothesisMemberV2[];

  resolvedMemberIds: string[];

  rawResolvedPosLabels: string[];

  normalizedResolvedPosLabels: string[];

  semanticCapabilityId:
    typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1;

  semanticCapabilityVersion: "1";

  semanticDomain: "canonical_token_pos_normalized_label_equality";

  canonicalPropertyDomain: "canonical_token_occurrence";

  canonicalPropertyKind: "pos_hypothesis_set";

  actualNormalizationContract:
    CanonicalTokenPosNormalizedLabelNormalizationContractV1;

  governance: {
    exactReadResultRequired: true;

    exactReadIdentityPreserved: true;

    exactTokenIdentityPreserved: true;

    exactSemanticCapabilityRequired: true;

    semanticCapabilityContractValidatedBeforeExecution: true;

    canonicalPosHypothesisReadConsumed: true;

    actualPosLabelReadPerformed: true;

    actualLabelNormalizationPerformed: true;

    actualLabelTrimPerformed: true;

    actualLabelEmptyAfterTrimUnsupported: true;

    actualLabelUnicodeNfcPerformed: true;

    actualLabelNbNoLowercasePerformed: true;

    normalizedLabelsAdded: true;

    hypothesisSetStatePreserved: true;

    alternativeSetIdentityPreserved: true;

    alternativeSetStatusPreserved: true;

    memberIdentityPreserved: true;

    memberGraphStatusesPreserved: true;

    explicitResolvedFlagsPreserved: true;

    resolvedMemberIdsPreserved: true;

    resolvedLabelOrderPreserved: true;

    resolvedLabelMultiplicityPreserved: true;

    normalizationCollisionMultiplicityPreserved: true;

    historicalRuntimeEqAuthorityImported: false;

    runtimeProducerConsumed: false;

    manifestConsumed: false;

    runtimeWhereConsumed: false;

    runtimeBindingConsumed: false;

    runtimeExpectedLabelConsumed: false;

    posVocabularyValidated: false;

    membersDeduplicated: false;

    normalizationCollisionResolvesAlternative: false;

    posWinnerSelected: false;

    alternativeSetResolutionPerformed: false;

    comparisonPerformed: false;

    comparisonTruthResolved: false;

    runtimeConditionTruthResolved: false;

    sentenceDomainConsumed: false;

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

export type CanonicalTokenPosHypothesisSetNormalizedLabelProjectionResultV2 = {
  producer:
    typeof CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V2;

  producerVersion:
    typeof CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_VERSION_V2;

  status:
    | "ready"
    | "blocked";

  projection?: CanonicalTokenPosHypothesisSetNormalizedLabelProjectionV2;

  blockingReasons: string[];
};

function blockedResult(
  reasons: readonly string[],
): CanonicalTokenPosHypothesisSetNormalizedLabelProjectionResultV2 {
  return {
    producer: CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V2,

    producerVersion:
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_VERSION_V2,

    status: "blocked",

    blockingReasons: [
      ...reasons,
    ].sort(),
  };
}

function exactSemanticCapability(
  capability: CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
): boolean {
  if (
    capability !==
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1
  ) {
    return false;
  }

  const sourceRequirement = capability.sourceRequirement;

  const equality = capability.equalitySemantics;

  const g = capability.governance;

  return (
    capability.status ===
      "proven" &&
    capability.semanticDomain ===
      "canonical_token_pos_normalized_label_equality" &&
    capability.canonicalPropertyDomain ===
      "canonical_token_occurrence" &&
    capability.canonicalPropertyKind ===
      "pos_hypothesis_set" &&
    capability.canonicalOperatorLabel ===
      "eq" &&
    sourceRequirement.exactRawSourceEqMustAlreadyBeProven ===
      true &&
    sourceRequirement.sourceOperatorParsingPerformed ===
      false &&
    sourceRequirement.operatorAliasNormalizationAuthorized ===
      false &&
    capability.expectedLabelNormalization ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1 &&
    capability.actualLabelNormalization ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_NORMALIZATION_CONTRACT_V1 &&
    capability.actualLabelNormalization.inputType ===
      "string" &&
    capability.actualLabelNormalization.trimWhitespace ===
      true &&
    capability.actualLabelNormalization.emptyAfterTrimUnsupported ===
      true &&
    capability.actualLabelNormalization.unicodeNormalization ===
      "NFC" &&
    capability.actualLabelNormalization.localeCaseTransform ===
      "toLocaleLowerCase" &&
    capability.actualLabelNormalization.locale ===
      "nb-NO" &&
    capability.actualLabelNormalization.equalityAfterNormalization ===
      "exact_string_equality" &&
    equality.leftValue ===
      "normalized_actual_pos_label" &&
    equality.relation ===
      "exact_string_equality" &&
    equality.rightValue ===
      "normalized_expected_pos_label" &&
    g.familyNeutral ===
      true &&
    g.runtimeProducerIndependent ===
      true &&
    g.manifestIndependent ===
      true &&
    g.exactSourceEqRequired ===
      true &&
    g.expectedLabelNormalizationSpecified ===
      true &&
    g.actualLabelNormalizationSpecified ===
      true &&
    g.normalizedLabelEqualitySemanticsSpecified ===
      true &&
    g.genericRuntimeEqAuthorityExcluded ===
      true &&
    g.genericJsonEqualityAuthorityExcluded ===
      true &&
    g.operatorAliasNormalizationAuthorized ===
      false &&
    g.sourceOperatorParsingPerformed ===
      false &&
    g.posVocabularyValidated ===
      false &&
    g.operandKnownCanonicalPosLabel ===
      false &&
    g.canonicalPosHypothesisRead ===
      false &&
    g.canonicalPosHypothesisSelected ===
      false &&
    g.expectedOperandReadPerformed ===
      false &&
    g.actualPosLabelReadPerformed ===
      false &&
    g.comparisonExecuted ===
      false &&
    g.comparisonTruthResolved ===
      false &&
    g.runtimeConditionTruthResolved ===
      false &&
    g.sentenceDomainConsumed ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceFilteringPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.cardinalityEnforcementPerformed ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function exactReadResult(
  result: CanonicalTokenPosHypothesisSetReadResultV1,
): result is CanonicalTokenPosHypothesisSetReadResultV1 & {
  status: "ready";
  read: CanonicalTokenPosHypothesisSetReadV1;
} {
  if (
    result.producer !==
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1 ||
    result.producerVersion !==
      "1" ||
    result.status !==
      "ready" ||
    !result.read
  ) {
    return false;
  }

  const read = result.read;

  const g = read.governance;

  return (
    Boolean(
      read.readId,
    ) &&
    Boolean(
      read.tokenNodeId,
    ) &&
    g.readsExistingCanonicalStateOnly ===
      true &&
    g.alternativeSetStatusIsAuthoritative ===
      true &&
    g.resolvedMembersMustBeExplicit ===
      true &&
    g.singletonAutoResolved ===
      false &&
    g.survivingCandidateAutoResolved ===
      false &&
    g.positiveConstraintEvidenceReevaluated ===
      false &&
    g.constraintPropagationInvoked ===
      false &&
    g.graphFactAmbiguousStatusPromotedToSetAmbiguity ===
      false &&
    g.memberGraphStatusesPreserved ===
      true &&
    g.propertyValueIsScalar ===
      false &&
    g.propertyValueIsHypothesisSet ===
      true &&
    g.runtimePosSuffixConsumed ===
      false &&
    g.runtimeBindingConsumed ===
      false &&
    g.rightOperandRead ===
      false &&
    g.operatorSemanticsResolved ===
      false &&
    g.whereEqExecuted ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.runtimeScopeExecutionPerformed ===
      false &&
    g.cardinalityEnforcementPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.canonicalDependencyEdgeGenerated ===
      false &&
    g.realizesSlotGenerated ===
      false &&
    g.graphMutationPerformed ===
      false
  );
}

export function normalizeCanonicalTokenPosActualLabelV2(
  value: unknown,
  capability: CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1 =
    CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
): string | undefined {
  if (
    !exactSemanticCapability(
      capability,
    )
  ) {
    return undefined;
  }

  if (
    typeof value !==
      "string"
  ) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed
    .normalize(
      "NFC",
    )
    .toLocaleLowerCase(
      "nb-NO",
    );
}

export function projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
  readResult: CanonicalTokenPosHypothesisSetReadResultV1,
  capability: CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1 =
    CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
): CanonicalTokenPosHypothesisSetNormalizedLabelProjectionResultV2 {
  if (
    !exactReadResult(
      readResult,
    )
  ) {
    return blockedResult([
      "source_read:not_exact_ready_canonical_pos_hypothesis_set_read",
    ]);
  }

  if (
    !exactSemanticCapability(
      capability,
    )
  ) {
    return blockedResult([
      "semantic_capability:not_exact_normalized_label_eq_capability",
    ]);
  }

  const read = readResult.read;

  const normalizedMembers: CanonicalTokenPosNormalizedHypothesisMemberV2[] = [];

  for (
    const member of read.members
  ) {
    const normalized = normalizeCanonicalTokenPosActualLabelV2(
      member.posLabel,
      capability,
    );

    if (!normalized) {
      return blockedResult([
        `member:${member.posReadingNodeId}:actual_pos_label_normalization_failed`,
      ]);
    }

    normalizedMembers.push({
      posReadingNodeId: member.posReadingNodeId,

      rawPosLabel: member.posLabel,

      normalizedPosLabel: normalized,

      graphStatus: member.graphStatus,

      explicitlyResolved: member.explicitlyResolved,
    });
  }

  const rawResolvedPosLabels = [
    ...read.resolvedPosLabels,
  ];

  const normalizedResolvedPosLabels: string[] = [];

  for (
    let index = 0;
    index <
      rawResolvedPosLabels.length;
    index++
  ) {
    const raw = rawResolvedPosLabels[index];

    const normalized = normalizeCanonicalTokenPosActualLabelV2(
      raw,
      capability,
    );

    if (!normalized) {
      return blockedResult([
        `resolved_pos_label:${index}:actual_pos_label_normalization_failed`,
      ]);
    }

    normalizedResolvedPosLabels.push(
      normalized,
    );
  }

  return {
    producer: CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V2,

    producerVersion:
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_VERSION_V2,

    status: "ready",

    projection: {
      projectionId:
        `canonical-token-pos-normalized-projection-v2:${read.readId}`,

      status: "candidate",

      sourceReadId: read.readId,

      tokenNodeId: read.tokenNodeId,

      readState: read.readState,

      alternativeSetId: read.alternativeSetId,

      alternativeSetStatus: read.alternativeSetStatus,

      members: normalizedMembers,

      resolvedMemberIds: [
        ...read.resolvedMemberIds,
      ],

      rawResolvedPosLabels,

      normalizedResolvedPosLabels,

      semanticCapabilityId:
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,

      semanticCapabilityVersion: "1",

      semanticDomain: capability.semanticDomain,

      canonicalPropertyDomain: capability.canonicalPropertyDomain,

      canonicalPropertyKind: capability.canonicalPropertyKind,

      actualNormalizationContract: capability.actualLabelNormalization,

      governance: {
        exactReadResultRequired: true,

        exactReadIdentityPreserved: true,

        exactTokenIdentityPreserved: true,

        exactSemanticCapabilityRequired: true,

        semanticCapabilityContractValidatedBeforeExecution: true,

        canonicalPosHypothesisReadConsumed: true,

        actualPosLabelReadPerformed: true,

        actualLabelNormalizationPerformed: true,

        actualLabelTrimPerformed: true,

        actualLabelEmptyAfterTrimUnsupported: true,

        actualLabelUnicodeNfcPerformed: true,

        actualLabelNbNoLowercasePerformed: true,

        normalizedLabelsAdded: true,

        hypothesisSetStatePreserved: true,

        alternativeSetIdentityPreserved: true,

        alternativeSetStatusPreserved: true,

        memberIdentityPreserved: true,

        memberGraphStatusesPreserved: true,

        explicitResolvedFlagsPreserved: true,

        resolvedMemberIdsPreserved: true,

        resolvedLabelOrderPreserved: true,

        resolvedLabelMultiplicityPreserved: true,

        normalizationCollisionMultiplicityPreserved: true,

        historicalRuntimeEqAuthorityImported: false,

        runtimeProducerConsumed: false,

        manifestConsumed: false,

        runtimeWhereConsumed: false,

        runtimeBindingConsumed: false,

        runtimeExpectedLabelConsumed: false,

        posVocabularyValidated: false,

        membersDeduplicated: false,

        normalizationCollisionResolvesAlternative: false,

        posWinnerSelected: false,

        alternativeSetResolutionPerformed: false,

        comparisonPerformed: false,

        comparisonTruthResolved: false,

        runtimeConditionTruthResolved: false,

        sentenceDomainConsumed: false,

        occurrenceEnumerationPerformed: false,

        occurrenceFilteringPerformed: false,

        occurrenceBindingPerformed: false,

        cardinalityEnforcementPerformed: false,

        graphMutationPerformed: false,

        learnerErrorClassified: false,

        candidateOnly: true,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
