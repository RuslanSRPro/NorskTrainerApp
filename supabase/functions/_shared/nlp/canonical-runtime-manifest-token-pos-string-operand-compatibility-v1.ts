import {
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1,
  type CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1,
} from "./canonical-runtime-manifest-token-pos-suffix-property-compatibility-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1 =
  "canonical_runtime_manifest_token_pos_string_operand_compatibility_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1 =
  "1" as const;

export type CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1 = {
  id: string;
  status: "candidate";

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
  operatorLabelOpaque: string;
  leftReferenceExpression: string;

  runtimeSuffix: ".pos";
  canonicalNodeType: "token";
  canonicalPropertyDomain: "canonical_token_occurrence";
  canonicalPropertyKind: "pos_hypothesis_set";

  rightOperandStructuralKind: "string";
  rightOperandSnapshot: string;
  posLabelInputOpaque: string;

  governance: {
    exactA46b2ResultRequired: true;
    exactA46b2AuthorityRequired: true;
    exactA46b2IdentityPreserved: true;

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

    rightOperandSnapshotConsumed: true;
    rightOperandStructuralKindDerivedFromSnapshot: true;
    stringRightOperandRequired: true;
    nonEmptyStringOperandRequired: true;
    stringOperandPreservedOpaque: true;
    posLabelInputCompatibilityOnly: true;
    operatorLabelPreservedOpaque: true;

    propertyValueIsHypothesisSet: true;
    operandKnownCanonicalPosLabel: false;
    operandNormalizationPerformed: false;
    unicodeNormalizationPerformed: false;
    caseFoldingPerformed: false;

    operatorSemanticsResolved: false;
    tokenPosNormalizedLabelEqSemanticsResolved: false;

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

export type CanonicalRuntimeManifestTokenPosStringOperandCompatibilityResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1;
    status: "ready" | "blocked";

    candidates: CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1[];

    consideredCompatibilityCount: number;
    stringOperandCompatibleCount: number;
    unsupportedOperandCompatibilityIds: string[];

    blockingReasons: string[];
  };

const EXPECTED_A46B2_GOVERNANCE = {
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

function safeA46b2Candidate(
  candidate: CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1,
): boolean {
  return (
    candidate.status === "candidate" &&
    present(candidate.id) &&
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
    present(candidate.operatorLabelOpaque) &&
    present(candidate.leftReferenceExpression) &&
    candidate.runtimeSuffix === ".pos" &&
    candidate.canonicalNodeType === "token" &&
    candidate.canonicalPropertyDomain === "canonical_token_occurrence" &&
    candidate.canonicalPropertyKind === "pos_hypothesis_set" &&
    exactGovernance(candidate.governance, EXPECTED_A46B2_GOVERNANCE)
  );
}

function identityKey(
  candidate: CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1,
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
): CanonicalRuntimeManifestTokenPosStringOperandCompatibilityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1,
    status: "blocked",
    candidates: [],
    consideredCompatibilityCount: 0,
    stringOperandCompatibleCount: 0,
    unsupportedOperandCompatibilityIds: [],
    blockingReasons: uniqueSorted(reasons),
  };
}

export function deriveCanonicalRuntimeManifestTokenPosStringOperandCompatibilitiesV1(
  input: CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1,
): CanonicalRuntimeManifestTokenPosStringOperandCompatibilityResultV1 {
  const blockingReasons: string[] = [];

  if (
    input.producer !==
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1 ||
    input.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1 ||
    input.status !== "ready" ||
    input.blockingReasons.length !== 0 ||
    input.compatibleTokenEntitySiteCount !== input.candidates.length
  ) {
    blockingReasons.push("a4_6b2_result:not_exact_ready");
  }

  const seenIds = new Set<string>();
  const seenIdentities = new Set<string>();

  for (const candidate of input.candidates) {
    if (!safeA46b2Candidate(candidate)) {
      blockingReasons.push(`a4_6b2:${candidate.id}:unsafe_contract`);
    }

    if (seenIds.has(candidate.id)) {
      blockingReasons.push(`a4_6b2:${candidate.id}:duplicate_id`);
    }

    seenIds.add(candidate.id);

    const key = identityKey(candidate);

    if (seenIdentities.has(key)) {
      blockingReasons.push(
        `a4_6b2:${candidate.id}:duplicate_exact_site_identity`,
      );
    }

    seenIdentities.add(key);
  }

  if (blockingReasons.length !== 0) {
    return blocked(blockingReasons);
  }

  const candidates:
    CanonicalRuntimeManifestTokenPosStringOperandCompatibilityV1[] = [];

  const unsupportedOperandCompatibilityIds: string[] = [];

  for (const candidate of input.candidates) {
    const snapshot = candidate.rightOperandSnapshot;

    if (typeof snapshot !== "string" || snapshot.length === 0) {
      unsupportedOperandCompatibilityIds.push(candidate.id);
      continue;
    }

    candidates.push({
      id: [
        CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,
        candidate.id,
      ].join(":"),

      status: "candidate",

      tokenPosSuffixPropertyCompatibilityId: candidate.id,

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
      operatorLabelOpaque: candidate.operatorLabelOpaque,
      leftReferenceExpression: candidate.leftReferenceExpression,

      runtimeSuffix: ".pos",
      canonicalNodeType: "token",
      canonicalPropertyDomain: "canonical_token_occurrence",
      canonicalPropertyKind: "pos_hypothesis_set",

      rightOperandStructuralKind: "string",
      rightOperandSnapshot: snapshot,
      posLabelInputOpaque: snapshot,

      governance: {
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
      },
    });
  }

  candidates.sort((a, b) => a.id.localeCompare(b.id));

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_VERSION_V1,
    status: "ready",
    candidates,
    consideredCompatibilityCount: input.candidates.length,
    stringOperandCompatibleCount: candidates.length,
    unsupportedOperandCompatibilityIds: uniqueSorted(
      unsupportedOperandCompatibilityIds,
    ),
    blockingReasons: [],
  };
}
