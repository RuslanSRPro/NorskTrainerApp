import {
  CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V2,
  CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_VERSION_V2,
  type CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV2,
  type CanonicalTokenPosGraphBoundNormalizedLabelProjectionV2,
} from "./canonical-token-pos-graph-bound-normalized-label-projection-v2.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1,
} from "./canonical-runtime-manifest-token-pos-expected-normalized-label-eq-authority-v1.ts";

import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1,
  type CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
  type CanonicalTokenPosNormalizedLabelNormalizationContractV1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

export const CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2 =
  "canonical_token_pos_normalized_label_comparison_evidence_v2" as const;

export const CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2 =
  "2" as const;

type ActualNormalizedMemberV2 =
  CanonicalTokenPosGraphBoundNormalizedLabelProjectionV2[
    "normalizedProjection"
  ]["members"][number];

export type CanonicalTokenPosNormalizedLabelComparisonEvidenceStateV2 =
  | "no_pos_fact"
  | "blocked_hypothesis_set"
  | "open_match_possible"
  | "open_no_surviving_match"
  | "explicit_resolved_match"
  | "explicit_resolved_non_match"
  | "explicit_resolved_mixed";

export type CanonicalTokenPosNormalizedLabelMemberComparisonEvidenceV2 = {
  memberIndex: number;

  posReadingNodeId: string;

  rawPosLabel: string;

  normalizedPosLabel: string;

  graphStatus: ActualNormalizedMemberV2["graphStatus"];

  explicitlyResolved: boolean;

  survivingForOpenComparison: boolean;

  equalsExpectedNormalizedLabel: boolean;
};

export type CanonicalTokenPosNormalizedLabelComparisonEvidenceV2 = {
  comparisonEvidenceId: string;

  status: "candidate";

  actualGraphBoundProjectionId: string;

  actualSnapshotIdentityId: string;

  actualSnapshotSha256: string;

  actualGraphDocumentId: string;

  actualTokenNodeId: string;

  actualGraphTokenOccurrenceIdentityId: string;

  actualSourceReadId: string;

  actualNormalizedProjectionId: string;

  expectedAuthorityId: string;

  expectedNormalizedPosLabel: string;

  semanticCapabilityId:
    typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1;

  semanticCapabilityVersion:
    typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1;

  semanticDomain: "canonical_token_pos_normalized_label_equality";

  canonicalPropertyDomain: "canonical_token_occurrence";

  canonicalPropertyKind: "pos_hypothesis_set";

  canonicalOperatorLabel: "eq";

  comparisonState: CanonicalTokenPosNormalizedLabelComparisonEvidenceStateV2;

  memberComparisons:
    CanonicalTokenPosNormalizedLabelMemberComparisonEvidenceV2[];

  survivingMemberIds: string[];

  matchingSurvivingMemberIds: string[];

  resolvedMemberIds: string[];

  matchingResolvedMemberIds: string[];

  actualGraphBoundProjection:
    CanonicalTokenPosGraphBoundNormalizedLabelProjectionV2;

  expectedAuthority:
    CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1;

  semanticCapability:
    CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1;

  governance: {
    exactGraphBoundActualProjectionRequired: true;

    exactExpectedNormalizedLabelAuthorityRequired: true;

    exactSemanticCapabilityRequired: true;

    actualGraphBoundProjectionObjectPreservedWithoutReconstruction: true;

    expectedAuthorityObjectPreservedWithoutReconstruction: true;

    semanticCapabilitySingletonPreserved: true;

    normalizedActualLabelsConsumedNotReconstructed: true;

    normalizedExpectedLabelConsumedNotReconstructed: true;

    actualNormalizationPerformed: false;

    expectedNormalizationPerformed: false;

    exactStringEqualityExecutedPerMember: true;

    comparisonExecuted: true;

    comparisonEvidenceStateProduced: true;

    comparisonEvidenceStateIsBooleanTruth: false;

    actualMemberIdentityPreserved: true;

    actualMemberStatusPreserved: true;

    actualMemberMultiplicityPreserved: true;

    actualMemberOrderPreserved: true;

    explicitResolvedIdentityPreserved: true;

    rejectedMemberCountsAsOpenPossibility: false;

    blockedMemberCountsAsOpenPossibility: false;

    ambiguousMemberMayRemainOpenPossibility: true;

    singletonOpenAutoResolved: false;

    normalizationCollisionMembersDeduplicated: false;

    pairingSuppliedByCaller: true;

    runtimeSiteApplicabilityResolved: false;

    operatorSemanticsReconstructed: false;

    runtimeConsumed: false;

    manifestTraversalPerformed: false;

    runtimeWhereConsumed: false;

    runtimeBindingPerformed: false;

    sentenceDomainConsumed: false;

    occurrenceEnumerationPerformed: false;

    occurrenceFilteringPerformed: false;

    occurrenceBindingPerformed: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforcementPerformed: false;

    booleanTruthProduced: false;

    comparisonTruthResolved: false;

    runtimeConditionTruthResolved: false;

    posWinnerSelected: false;

    historicalComparisonAuthorityImported: false;

    historicalRuntimeDomainComparisonImported: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2 = {
  producer: typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2;

  producerVersion:
    typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2;

  status:
    | "ready"
    | "blocked";

  evidence?: CanonicalTokenPosNormalizedLabelComparisonEvidenceV2;

  blockingReasons: string[];
};

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
      ),
  );
}

function blockedResult(
  reasons: readonly string[],
): CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2 {
  return {
    producer: CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2,

    producerVersion:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2,

    status: "blocked",

    blockingReasons: uniqueSorted(
      reasons,
    ),
  };
}

function nonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length >
      0
  );
}

function sameNormalizationContract(
  value: CanonicalTokenPosNormalizedLabelNormalizationContractV1,
  expected: CanonicalTokenPosNormalizedLabelNormalizationContractV1,
): boolean {
  return (
    value.inputType ===
      expected.inputType &&
    value.trimWhitespace ===
      expected.trimWhitespace &&
    value.emptyAfterTrimUnsupported ===
      expected.emptyAfterTrimUnsupported &&
    value.unicodeNormalization ===
      expected.unicodeNormalization &&
    value.localeCaseTransform ===
      expected.localeCaseTransform &&
    value.locale ===
      expected.locale &&
    value.equalityAfterNormalization ===
      expected.equalityAfterNormalization
  );
}

function alreadyNormalizedLabel(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length >
      0 &&
    value ===
      value.trim() &&
    value ===
      value.normalize(
        "NFC",
      ) &&
    value ===
      value.toLocaleLowerCase(
        "nb-NO",
      )
  );
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

  const g = capability.governance;

  return (
    capability.capabilityId ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1 &&
    capability.version ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1 &&
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
    capability.sourceRequirement
        .exactRawSourceEqMustAlreadyBeProven ===
      true &&
    capability.sourceRequirement
        .sourceOperatorParsingPerformed ===
      false &&
    capability.sourceRequirement
        .operatorAliasNormalizationAuthorized ===
      false &&
    capability.equalitySemantics.leftValue ===
      "normalized_actual_pos_label" &&
    capability.equalitySemantics.relation ===
      "exact_string_equality" &&
    capability.equalitySemantics.rightValue ===
      "normalized_expected_pos_label" &&
    sameNormalizationContract(
      capability.actualLabelNormalization,
      capability.expectedLabelNormalization,
    ) &&
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

function exactExpectedAuthority(
  expected:
    CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1,
  semanticCapability:
    CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
): boolean {
  const g = expected.governance;

  return (
    nonEmptyString(
      expected.id,
    ) &&
    expected.id.startsWith(
      `${CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1}:`,
    ) &&
    expected.id.length >
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_EXPECTED_NORMALIZED_LABEL_EQ_AUTHORITY_V1
          .length +
        1 &&
    expected.status ===
      "candidate" &&
    nonEmptyString(
      expected.exactEqOperatorSourceCompatibilityId,
    ) &&
    nonEmptyString(
      expected.stringOperandCompatibilityId,
    ) &&
    nonEmptyString(
      expected.tokenPosSuffixPropertyCompatibilityId,
    ) &&
    nonEmptyString(
      expected.leafRightOperandSiteAuthorityId,
    ) &&
    nonEmptyString(
      expected.referenceRootAuthorityId,
    ) &&
    nonEmptyString(
      expected.referenceExpressionAuthorityId,
    ) &&
    nonEmptyString(
      expected.whereShapeAuthorityId,
    ) &&
    nonEmptyString(
      expected.ownerBindingDefinitionAuthorityId,
    ) &&
    nonEmptyString(
      expected.manifestId,
    ) &&
    nonEmptyString(
      expected.manifestCode,
    ) &&
    nonEmptyString(
      expected.ownerBindingName,
    ) &&
    nonEmptyString(
      expected.referencedBindingDefinitionAuthorityId,
    ) &&
    nonEmptyString(
      expected.referencedBindingName,
    ) &&
    nonEmptyString(
      expected.leafPath,
    ) &&
    nonEmptyString(
      expected.leftReferenceExpression,
    ) &&
    expected.runtimeSuffix ===
      ".pos" &&
    expected.canonicalNodeType ===
      "token" &&
    expected.canonicalPropertyDomain ===
      "canonical_token_occurrence" &&
    expected.canonicalPropertyKind ===
      "pos_hypothesis_set" &&
    expected.sourceOperatorLabelRaw ===
      "eq" &&
    expected.canonicalOperatorLabel ===
      "eq" &&
    expected.rightOperandStructuralKind ===
      "string" &&
    expected.rightOperandSnapshot ===
      expected.posLabelInputOpaque &&
    alreadyNormalizedLabel(
      expected.normalizedExpectedPosLabel,
    ) &&
    expected.semanticCapabilityId ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1 &&
    expected.semanticCapabilityVersion ===
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1 &&
    expected.semanticDomain ===
      "canonical_token_pos_normalized_label_equality" &&
    sameNormalizationContract(
      expected.expectedNormalizationContract,
      semanticCapability.expectedLabelNormalization,
    ) &&
    expected.equalitySemantics.leftValue ===
      semanticCapability.equalitySemantics.leftValue &&
    expected.equalitySemantics.relation ===
      semanticCapability.equalitySemantics.relation &&
    expected.equalitySemantics.rightValue ===
      semanticCapability.equalitySemantics.rightValue &&
    g.exactSourceEqResultRequired ===
      true &&
    g.exactSourceEqAuthorityRequired ===
      true &&
    g.exactSourceEqIdentityPreserved ===
      true &&
    g.exactSemanticCapabilityRequired ===
      true &&
    g.exactSemanticCapabilityIdentityPreserved ===
      true &&
    g.semanticCapabilityContractValidatedBeforeExecution ===
      true &&
    g.exactManifestIdentityPreserved ===
      true &&
    g.exactOwnerBindingIdentityPreserved ===
      true &&
    g.exactReferencedBindingIdentityPreserved ===
      true &&
    g.exactLeafSiteIdentityPreserved ===
      true &&
    g.exactRuntimePosSuffixPreserved ===
      true &&
    g.exactRawSourceEqConsumed ===
      true &&
    g.sourceOperatorParsingPerformed ===
      false &&
    g.operatorAliasNormalizationAuthorized ===
      false &&
    g.operatorSemanticsReconstructed ===
      false &&
    g.expectedOperandReadPerformed ===
      true &&
    g.expectedLabelNormalizationPerformed ===
      true &&
    g.expectedLabelTrimPerformed ===
      true &&
    g.expectedLabelEmptyAfterTrimUnsupported ===
      true &&
    g.expectedLabelUnicodeNfcPerformed ===
      true &&
    g.expectedLabelNbNoLowercasePerformed ===
      true &&
    g.normalizedExpectedLabelProduced ===
      true &&
    g.posVocabularyValidated ===
      false &&
    g.operandKnownCanonicalPosLabel ===
      false &&
    g.canonicalPosHypothesisRead ===
      false &&
    g.canonicalPosHypothesisSelected ===
      false &&
    g.actualPosLabelReadPerformed ===
      false &&
    g.actualPosLabelNormalizationPerformed ===
      false &&
    g.comparisonExecuted ===
      false &&
    g.comparisonTruthResolved ===
      false &&
    g.runtimeConditionTruthResolved ===
      false &&
    g.candidateSentenceDomainConsumed ===
      false &&
    g.tokenNodeIdInspected ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceFilteringPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.cardinalityEnforcementPerformed ===
      false &&
    g.genericRuntimeEqAuthority ===
      false &&
    g.genericJsonEqualityAuthority ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function exactActualResult(
  result: CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV2,
  semanticCapability:
    CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1,
): result is CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV2 & {
  status: "ready";

  graphBoundProjection: CanonicalTokenPosGraphBoundNormalizedLabelProjectionV2;
} {
  if (
    result.producer !==
      CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V2 ||
    result.producerVersion !==
      CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_VERSION_V2 ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    !result.graphBoundProjection
  ) {
    return false;
  }

  const actual = result.graphBoundProjection;

  const projection = actual.normalizedProjection;

  const g = actual.governance;

  const pg = projection.governance;

  if (
    actual.status !==
      "candidate" ||
    !nonEmptyString(
      actual.graphBoundProjectionId,
    ) ||
    !nonEmptyString(
      actual.snapshotAuthorityId,
    ) ||
    !nonEmptyString(
      actual.snapshotIdentityId,
    ) ||
    !nonEmptyString(
      actual.snapshotSha256,
    ) ||
    !nonEmptyString(
      actual.graphDocumentId,
    ) ||
    !nonEmptyString(
      actual.tokenNodeId,
    ) ||
    !nonEmptyString(
      actual.graphTokenOccurrenceIdentityId,
    ) ||
    !nonEmptyString(
      actual.sourceReadId,
    ) ||
    !nonEmptyString(
      actual.normalizedProjectionId,
    ) ||
    actual.snapshotAuthority.authorityId !==
      actual.snapshotAuthorityId ||
    actual.snapshotAuthority.snapshotIdentityId !==
      actual.snapshotIdentityId ||
    actual.snapshotAuthority.snapshotSha256 !==
      actual.snapshotSha256 ||
    actual.provenanceBinding.graphDocumentId !==
      actual.graphDocumentId ||
    projection.status !==
      "candidate" ||
    projection.projectionId !==
      actual.normalizedProjectionId ||
    projection.sourceReadId !==
      actual.sourceReadId ||
    projection.tokenNodeId !==
      actual.tokenNodeId ||
    projection.semanticCapabilityId !==
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1 ||
    projection.semanticCapabilityVersion !==
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1 ||
    projection.semanticDomain !==
      "canonical_token_pos_normalized_label_equality" ||
    projection.canonicalPropertyDomain !==
      "canonical_token_occurrence" ||
    projection.canonicalPropertyKind !==
      "pos_hypothesis_set" ||
    !sameNormalizationContract(
      projection.actualNormalizationContract,
      semanticCapability.actualLabelNormalization,
    )
  ) {
    return false;
  }

  const seenMemberIds = new Set<string>();

  for (
    const member of projection.members
  ) {
    if (
      !nonEmptyString(
        member.posReadingNodeId,
      ) ||
      seenMemberIds.has(
        member.posReadingNodeId,
      ) ||
      !nonEmptyString(
        member.rawPosLabel,
      ) ||
      member.rawPosLabel !==
        member.rawPosLabel.trim() ||
      !alreadyNormalizedLabel(
        member.normalizedPosLabel,
      ) ||
      typeof member.explicitlyResolved !==
        "boolean"
    ) {
      return false;
    }

    seenMemberIds.add(
      member.posReadingNodeId,
    );
  }

  const resolvedIdSet = new Set(
    projection.resolvedMemberIds,
  );

  if (
    resolvedIdSet.size !==
      projection.resolvedMemberIds.length
  ) {
    return false;
  }

  for (
    const resolvedId of projection.resolvedMemberIds
  ) {
    const member = projection.members.find(
      (candidate) =>
        candidate.posReadingNodeId ===
          resolvedId,
    );

    if (
      !member ||
      member.explicitlyResolved !==
        true
    ) {
      return false;
    }
  }

  for (
    const member of projection.members
  ) {
    if (
      member.explicitlyResolved !==
        resolvedIdSet.has(
          member.posReadingNodeId,
        )
    ) {
      return false;
    }
  }

  if (
    projection.rawResolvedPosLabels.length !==
      projection.resolvedMemberIds.length ||
    projection.normalizedResolvedPosLabels.length !==
      projection.resolvedMemberIds.length
  ) {
    return false;
  }

  return (
    g.exactSurfaceGraphProvenanceBindingRequired ===
      true &&
    g.provenanceBindingDerivedFromCapturedSurfaceAndGraph ===
      true &&
    g.provenanceBindingCheckedBeforePosPipeline ===
      true &&
    g.provenanceBindingRecheckedAfterPosPipeline ===
      true &&
    g.provenanceBindingStableAcrossProjection ===
      true &&
    g.surfaceGraphAncestryProven ===
      true &&
    g.exactSnapshotAuthorityRequired ===
      true &&
    g.exactSnapshotIdentityPreserved ===
      true &&
    g.snapshotIdentityAndTokenNodeIdFormOccurrenceIdentity ===
      true &&
    g.exactTokenNodeIdRequired ===
      true &&
    g.exactTokenNodeIdPreserved ===
      true &&
    g.exactCanonicalPosReadRequired ===
      true &&
    g.exactP2ProjectionRequired ===
      true &&
    g.sourceReadIdentityPreserved ===
      true &&
    g.normalizedProjectionIdentityPreserved ===
      true &&
    g.normalizedProjectionObjectPreservedWithoutReconstruction ===
      true &&
    g.hypothesisSetStatePreservedByP2 ===
      true &&
    g.normalizedMemberIdentityPreservedByP2 ===
      true &&
    g.normalizedLabelMultiplicityPreservedByP2 ===
      true &&
    g.runtimeConsumed ===
      false &&
    g.manifestConsumed ===
      false &&
    g.runtimeSentenceDomainConsumed ===
      false &&
    g.runtimeBindingConsumed ===
      false &&
    g.runtimeExpectedOperandConsumed ===
      false &&
    g.whereSemanticsResolved ===
      false &&
    g.comparisonPerformed ===
      false &&
    g.comparisonTruthResolved ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceFilteringPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.cardinalityEnforcementPerformed ===
      false &&
    g.posWinnerSelected ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.frozenGrammarReadOnly ===
      true &&
    pg.exactSemanticCapabilityRequired ===
      true &&
    pg.semanticCapabilityContractValidatedBeforeExecution ===
      true &&
    pg.canonicalPosHypothesisReadConsumed ===
      true &&
    pg.actualPosLabelReadPerformed ===
      true &&
    pg.actualLabelNormalizationPerformed ===
      true &&
    pg.normalizedLabelsAdded ===
      true &&
    pg.hypothesisSetStatePreserved ===
      true &&
    pg.memberIdentityPreserved ===
      true &&
    pg.memberGraphStatusesPreserved ===
      true &&
    pg.explicitResolvedFlagsPreserved ===
      true &&
    pg.resolvedMemberIdsPreserved ===
      true &&
    pg.resolvedLabelOrderPreserved ===
      true &&
    pg.resolvedLabelMultiplicityPreserved ===
      true &&
    pg.normalizationCollisionMultiplicityPreserved ===
      true &&
    pg.historicalRuntimeEqAuthorityImported ===
      false &&
    pg.runtimeProducerConsumed ===
      false &&
    pg.manifestConsumed ===
      false &&
    pg.runtimeWhereConsumed ===
      false &&
    pg.runtimeBindingConsumed ===
      false &&
    pg.runtimeExpectedLabelConsumed ===
      false &&
    pg.membersDeduplicated ===
      false &&
    pg.posWinnerSelected ===
      false &&
    pg.alternativeSetResolutionPerformed ===
      false &&
    pg.comparisonPerformed ===
      false &&
    pg.comparisonTruthResolved ===
      false &&
    pg.runtimeConditionTruthResolved ===
      false &&
    pg.sentenceDomainConsumed ===
      false &&
    pg.occurrenceEnumerationPerformed ===
      false &&
    pg.occurrenceFilteringPerformed ===
      false &&
    pg.occurrenceBindingPerformed ===
      false &&
    pg.cardinalityEnforcementPerformed ===
      false &&
    pg.graphMutationPerformed ===
      false &&
    pg.learnerErrorClassified ===
      false &&
    pg.frozenGrammarReadOnly ===
      true
  );
}

function survivingForOpenComparison(
  member: ActualNormalizedMemberV2,
): boolean {
  return (
    member.graphStatus ===
      "candidate" ||
    member.graphStatus ===
      "ambiguous" ||
    member.graphStatus ===
      "resolved"
  );
}

function comparisonEvidenceId(
  actual: CanonicalTokenPosGraphBoundNormalizedLabelProjectionV2,
  expected:
    CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1,
): string {
  return [
    "canonical-token-pos-normalized-label-comparison-evidence-v2",
    encodeURIComponent(
      actual.snapshotIdentityId,
    ),
    encodeURIComponent(
      actual.tokenNodeId,
    ),
    encodeURIComponent(
      expected.id,
    ),
  ].join(
    ":",
  );
}

export function compareCanonicalTokenPosNormalizedLabelEvidenceV2(
  actualResult: CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV2,
  expected:
    CanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthorityV1,
  semanticCapability:
    CanonicalTokenPosNormalizedLabelEqSemanticCapabilityResultV1 =
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
): CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2 {
  const reasons: string[] = [];

  if (
    !exactSemanticCapability(
      semanticCapability,
    )
  ) {
    reasons.push(
      "semantic_capability:not_exact_singleton",
    );
  }

  if (
    !exactActualResult(
      actualResult,
      semanticCapability,
    )
  ) {
    reasons.push(
      "actual_graph_bound_projection:not_exact_ready",
    );
  }

  if (
    !exactExpectedAuthority(
      expected,
      semanticCapability,
    )
  ) {
    reasons.push(
      "expected_normalized_label_authority:not_exact_candidate",
    );
  }

  if (
    reasons.length >
      0
  ) {
    return blockedResult(
      reasons,
    );
  }

  const actual = actualResult.graphBoundProjection!;

  const projection = actual.normalizedProjection;

  const expectedNormalizedPosLabel = expected.normalizedExpectedPosLabel;

  const memberComparisons:
    CanonicalTokenPosNormalizedLabelMemberComparisonEvidenceV2[] = projection
      .members.map(
        (
          member,
          memberIndex,
        ) => ({
          memberIndex,

          posReadingNodeId: member.posReadingNodeId,

          rawPosLabel: member.rawPosLabel,

          normalizedPosLabel: member.normalizedPosLabel,

          graphStatus: member.graphStatus,

          explicitlyResolved: member.explicitlyResolved,

          survivingForOpenComparison: survivingForOpenComparison(
            member,
          ),

          equalsExpectedNormalizedLabel: member.normalizedPosLabel ===
            expectedNormalizedPosLabel,
        }),
      );

  const survivingMembers = memberComparisons.filter(
    (member) => member.survivingForOpenComparison,
  );

  const matchingSurvivingMembers = survivingMembers.filter(
    (member) => member.equalsExpectedNormalizedLabel,
  );

  const comparisonByMemberId = new Map(
    memberComparisons.map(
      (member) =>
        [
          member.posReadingNodeId,
          member,
        ] as const,
    ),
  );

  const resolvedMemberIds = [
    ...projection.resolvedMemberIds,
  ];

  const matchingResolvedMemberIds = resolvedMemberIds.filter(
    (memberId) =>
      comparisonByMemberId.get(
        memberId,
      )
        ?.equalsExpectedNormalizedLabel ===
        true,
  );

  let comparisonState:
    CanonicalTokenPosNormalizedLabelComparisonEvidenceStateV2;

  if (
    projection.readState ===
      "no_pos_fact"
  ) {
    comparisonState = "no_pos_fact";
  } else if (
    projection.readState ===
      "blocked_hypothesis_set"
  ) {
    comparisonState = "blocked_hypothesis_set";
  } else if (
    projection.readState ===
      "open_hypothesis_set"
  ) {
    comparisonState = matchingSurvivingMembers.length >
        0
      ? "open_match_possible"
      : "open_no_surviving_match";
  } else {
    const allResolvedMatch = resolvedMemberIds.length >
        0 &&
      matchingResolvedMemberIds.length ===
        resolvedMemberIds.length;

    const noResolvedMatch = resolvedMemberIds.length >
        0 &&
      matchingResolvedMemberIds.length ===
        0;

    comparisonState = allResolvedMatch
      ? "explicit_resolved_match"
      : noResolvedMatch
      ? "explicit_resolved_non_match"
      : "explicit_resolved_mixed";
  }

  return {
    producer: CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2,

    producerVersion:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2,

    status: "ready",

    evidence: {
      comparisonEvidenceId: comparisonEvidenceId(
        actual,
        expected,
      ),

      status: "candidate",

      actualGraphBoundProjectionId: actual.graphBoundProjectionId,

      actualSnapshotIdentityId: actual.snapshotIdentityId,

      actualSnapshotSha256: actual.snapshotSha256,

      actualGraphDocumentId: actual.graphDocumentId,

      actualTokenNodeId: actual.tokenNodeId,

      actualGraphTokenOccurrenceIdentityId:
        actual.graphTokenOccurrenceIdentityId,

      actualSourceReadId: actual.sourceReadId,

      actualNormalizedProjectionId: actual.normalizedProjectionId,

      expectedAuthorityId: expected.id,

      expectedNormalizedPosLabel,

      semanticCapabilityId:
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_V1,

      semanticCapabilityVersion:
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_VERSION_V1,

      semanticDomain: "canonical_token_pos_normalized_label_equality",

      canonicalPropertyDomain: "canonical_token_occurrence",

      canonicalPropertyKind: "pos_hypothesis_set",

      canonicalOperatorLabel: "eq",

      comparisonState,

      memberComparisons,

      survivingMemberIds: survivingMembers.map(
        (member) => member.posReadingNodeId,
      ),

      matchingSurvivingMemberIds: matchingSurvivingMembers.map(
        (member) => member.posReadingNodeId,
      ),

      resolvedMemberIds,

      matchingResolvedMemberIds,

      actualGraphBoundProjection: actual,

      expectedAuthority: expected,

      semanticCapability,

      governance: {
        exactGraphBoundActualProjectionRequired: true,

        exactExpectedNormalizedLabelAuthorityRequired: true,

        exactSemanticCapabilityRequired: true,

        actualGraphBoundProjectionObjectPreservedWithoutReconstruction: true,

        expectedAuthorityObjectPreservedWithoutReconstruction: true,

        semanticCapabilitySingletonPreserved: true,

        normalizedActualLabelsConsumedNotReconstructed: true,

        normalizedExpectedLabelConsumedNotReconstructed: true,

        actualNormalizationPerformed: false,

        expectedNormalizationPerformed: false,

        exactStringEqualityExecutedPerMember: true,

        comparisonExecuted: true,

        comparisonEvidenceStateProduced: true,

        comparisonEvidenceStateIsBooleanTruth: false,

        actualMemberIdentityPreserved: true,

        actualMemberStatusPreserved: true,

        actualMemberMultiplicityPreserved: true,

        actualMemberOrderPreserved: true,

        explicitResolvedIdentityPreserved: true,

        rejectedMemberCountsAsOpenPossibility: false,

        blockedMemberCountsAsOpenPossibility: false,

        ambiguousMemberMayRemainOpenPossibility: true,

        singletonOpenAutoResolved: false,

        normalizationCollisionMembersDeduplicated: false,

        pairingSuppliedByCaller: true,

        runtimeSiteApplicabilityResolved: false,

        operatorSemanticsReconstructed: false,

        runtimeConsumed: false,

        manifestTraversalPerformed: false,

        runtimeWhereConsumed: false,

        runtimeBindingPerformed: false,

        sentenceDomainConsumed: false,

        occurrenceEnumerationPerformed: false,

        occurrenceFilteringPerformed: false,

        occurrenceBindingPerformed: false,

        cardinalitySemanticsResolved: false,

        cardinalityEnforcementPerformed: false,

        booleanTruthProduced: false,

        comparisonTruthResolved: false,

        runtimeConditionTruthResolved: false,

        posWinnerSelected: false,

        historicalComparisonAuthorityImported: false,

        historicalRuntimeDomainComparisonImported: false,

        graphMutationPerformed: false,

        learnerErrorClassified: false,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
