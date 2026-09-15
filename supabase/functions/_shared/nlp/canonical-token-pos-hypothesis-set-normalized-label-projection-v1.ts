// Norsk Trainer — Canonical Token POS Hypothesis-Set
// Normalized-Label Projection V1
//
// v1.46 A3.3.4b
//
// Input:
//
//   exact A3.3.2d canonical POS hypothesis-set read.
//
// Transform:
//
//   exact A3.3.4a token-POS normalization:
//     string
//       -> trim
//       -> Unicode NFC
//       -> toLocaleLowerCase('nb-NO')
//
// Output:
//
//   the SAME canonical POS hypothesis set with an additional
//   normalized label beside every raw label.
//
// This is a projection only.
//
// It does NOT:
// - collapse members whose normalized labels are equal;
// - deduplicate resolved labels;
// - select a POS winner;
// - alter open/resolved/blocked state;
// - alter graph statuses;
// - alter explicit resolution;
// - validate POS vocabulary;
// - consume a Runtime expected label;
// - compare labels;
// - execute Runtime condition truth;
// - propagate constraints;
// - mutate the graph.

import {
  CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1,
  type CanonicalTokenPosHypothesisMemberReadV1,
  type CanonicalTokenPosHypothesisSetReadResultV1,
  type CanonicalTokenPosHypothesisSetReadStateV1,
  type CanonicalTokenPosHypothesisSetReadV1,
} from './canonical-token-pos-hypothesis-set-read-v1.ts';

import {
  CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
  CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1,
  normalizeCanonicalRuntimeTokenPosLabelV1,
} from './canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts';


export const CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V1 =
  'canonical_token_pos_hypothesis_set_normalized_label_projection_v1';


export type CanonicalTokenPosNormalizedHypothesisMemberV1 = {
  posReadingNodeId:
    string;

  rawPosLabel:
    string;

  normalizedPosLabel:
    string;

  graphStatus:
    CanonicalTokenPosHypothesisMemberReadV1['graphStatus'];

  explicitlyResolved:
    boolean;
};


export type CanonicalTokenPosHypothesisSetNormalizedLabelProjectionV1 = {
  projectionId:
    string;

  status:
    'proven';

  sourceReadId:
    string;

  tokenNodeId:
    string;

  readState:
    CanonicalTokenPosHypothesisSetReadStateV1;

  alternativeSetId:
    string | null;

  alternativeSetStatus:
    CanonicalTokenPosHypothesisSetReadV1['alternativeSetStatus'];

  members:
    CanonicalTokenPosNormalizedHypothesisMemberV1[];

  resolvedMemberIds:
    string[];

  rawResolvedPosLabels:
    string[];

  normalizedResolvedPosLabels:
    string[];

  normalizationAuthorityId:
    typeof CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1;

  normalizationContract: {
    trimWhitespace:
      true;

    unicodeNormalization:
      'NFC';

    localeCaseTransform:
      'toLocaleLowerCase';

    locale:
      'nb-NO';
  };

  governance: {
    exactA332dReadRequired:
      true;

    exactA334aNormalizationRequired:
      true;

    existingCanonicalStateReadOnly:
      true;

    rawLabelsPreserved:
      true;

    normalizedLabelsAdded:
      true;

    readStatePreserved:
      true;

    alternativeSetIdentityPreserved:
      true;

    alternativeSetStatusPreserved:
      true;

    memberIdentityPreserved:
      true;

    memberOrderPreserved:
      true;

    memberMultiplicityPreserved:
      true;

    memberGraphStatusesPreserved:
      true;

    explicitResolutionFlagsPreserved:
      true;

    resolvedMemberIdsPreserved:
      true;

    resolvedLabelOrderPreserved:
      true;

    resolvedLabelMultiplicityPreserved:
      true;

    normalizationCollisionMerged:
      false;

    normalizationCollisionResolvesAlternative:
      false;

    posVocabularyValidated:
      false;

    posWinnerSelected:
      false;

    resolutionStateChanged:
      false;

    positiveConstraintEvidenceReevaluated:
      false;

    constraintPropagationInvoked:
      false;

    runtimeExpectedLabelConsumed:
      false;

    runtimeBindingConsumed:
      false;

    runtimePosSuffixConsumed:
      false;

    operatorExecuted:
      false;

    comparisonPerformed:
      false;

    comparisonTruthResolved:
      false;

    runtimeConditionTruthResolved:
      false;

    occurrenceEnumerationPerformed:
      false;

    runtimeScopeExecutionPerformed:
      false;

    cardinalityEnforcementPerformed:
      false;

    occurrenceBindingPerformed:
      false;

    learnerErrorClassified:
      false;

    canonicalDependencyEdgeGenerated:
      false;

    realizesSlotGenerated:
      false;

    graphMutationPerformed:
      false;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalTokenPosHypothesisSetNormalizedLabelProjectionResultV1 = {
  producer:
    typeof CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  projection?:
    CanonicalTokenPosHypothesisSetNormalizedLabelProjectionV1;

  blockingReasons:
    string[];
};


function stringValue(
  value:
    unknown,
): string | undefined {
  if (
    typeof value !==
      'string'
  ) {
    return undefined;
  }


  const trimmed =
    value.trim();


  return (
    trimmed ||
    undefined
  );
}


function unique(
  values:
    readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}


function idPart(
  value:
    string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    '%',
    '_',
  );
}


function safeRead(
  read:
    CanonicalTokenPosHypothesisSetReadV1,
): boolean {
  const g =
    read.governance;


  if (
    read.status !==
      'proven' ||
    !stringValue(
      read.readId,
    ) ||
    !stringValue(
      read.tokenNodeId,
    )
  ) {
    return false;
  }


  const seenMemberIds =
    new Set<
      string
    >();


  for (
    const member of
      read.members
  ) {
    if (
      !stringValue(
        member.posReadingNodeId,
      ) ||
      typeof member.posLabel !==
        'string' ||
      seenMemberIds.has(
        member.posReadingNodeId,
      )
    ) {
      return false;
    }


    seenMemberIds.add(
      member.posReadingNodeId,
    );
  }


  if (
    new Set(
      read.resolvedMemberIds,
    ).size !==
      read.resolvedMemberIds.length
  ) {
    return false;
  }


  return (
    g.exactCanonicalTokenRequired ===
      true &&

    g.exactPosOwnershipAuthorityRequired ===
      true &&

    g.exactTokenPosCapabilityRequired ===
      true &&

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
      false &&

    g.frozenGrammarReadOnly ===
      true
  );
}


function blockedResult(
  reasons:
    readonly string[],
): CanonicalTokenPosHypothesisSetNormalizedLabelProjectionResultV1 {
  return {
    producer:
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V1,

    producerVersion:
      '1',

    status:
      'blocked',

    blockingReasons:
      unique(
        reasons,
      ),
  };
}


export function projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
  input:
    CanonicalTokenPosHypothesisSetReadResultV1,
): CanonicalTokenPosHypothesisSetNormalizedLabelProjectionResultV1 {
  const blockingReasons:
    string[] = [];


  if (
    input.producer !==
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1 ||
    input.producerVersion !==
      '1' ||
    input.status !==
      'ready' ||
    input.blockingReasons.length !==
      0 ||
    !input.read
  ) {
    blockingReasons.push(
      'pos_hypothesis_set_read:not_exact_ready_read',
    );

    return blockedResult(
      blockingReasons,
    );
  }


  const read =
    input.read;


  if (
    !safeRead(
      read,
    )
  ) {
    blockingReasons.push(
      `pos_hypothesis_set_read:${read.readId}:unsafe_contract`,
    );

    return blockedResult(
      blockingReasons,
    );
  }


  const members:
    CanonicalTokenPosNormalizedHypothesisMemberV1[] =
      [];


  for (
    const member of
      read.members
  ) {
    const normalized =
      normalizeCanonicalRuntimeTokenPosLabelV1(
        member.posLabel,
      );


    if (!normalized) {
      blockingReasons.push(
        `pos_member:${member.posReadingNodeId}:label_normalization_failed`,
      );

      continue;
    }


    members.push({
      posReadingNodeId:
        member.posReadingNodeId,

      rawPosLabel:
        member.posLabel,

      normalizedPosLabel:
        normalized,

      graphStatus:
        member.graphStatus,

      explicitlyResolved:
        member.explicitlyResolved,
    });
  }


  const normalizedResolvedPosLabels:
    string[] = [];


  for (
    let index = 0;
    index <
      read.resolvedPosLabels.length;
    index++
  ) {
    const raw =
      read.resolvedPosLabels[
        index
      ];


    const normalized =
      normalizeCanonicalRuntimeTokenPosLabelV1(
        raw,
      );


    if (!normalized) {
      blockingReasons.push(
        `resolved_pos_label:${index}:normalization_failed`,
      );

      continue;
    }


    normalizedResolvedPosLabels.push(
      normalized,
    );
  }


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  return {
    producer:
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V1,

    producerVersion:
      '1',

    status:
      'ready',

    projection: {
      projectionId: [
        'canonical-token-pos-normalized-projection-v1',
        idPart(
          read.readId,
        ),
      ].join(':'),

      status:
        'proven',

      sourceReadId:
        read.readId,

      tokenNodeId:
        read.tokenNodeId,

      readState:
        read.readState,

      alternativeSetId:
        read.alternativeSetId,

      alternativeSetStatus:
        read.alternativeSetStatus,

      members,

      resolvedMemberIds:
        [
          ...read.resolvedMemberIds,
        ],

      rawResolvedPosLabels:
        [
          ...read.resolvedPosLabels,
        ],

      normalizedResolvedPosLabels,

      normalizationAuthorityId:
        CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,

      normalizationContract: {
        trimWhitespace:
          CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1
            .normalization
            .trimWhitespace,

        unicodeNormalization:
          CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1
            .normalization
            .unicodeNormalization,

        localeCaseTransform:
          CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1
            .normalization
            .localeCaseTransform,

        locale:
          CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1
            .normalization
            .locale,
      },

      governance: {
        exactA332dReadRequired:
          true,

        exactA334aNormalizationRequired:
          true,

        existingCanonicalStateReadOnly:
          true,

        rawLabelsPreserved:
          true,

        normalizedLabelsAdded:
          true,

        readStatePreserved:
          true,

        alternativeSetIdentityPreserved:
          true,

        alternativeSetStatusPreserved:
          true,

        memberIdentityPreserved:
          true,

        memberOrderPreserved:
          true,

        memberMultiplicityPreserved:
          true,

        memberGraphStatusesPreserved:
          true,

        explicitResolutionFlagsPreserved:
          true,

        resolvedMemberIdsPreserved:
          true,

        resolvedLabelOrderPreserved:
          true,

        resolvedLabelMultiplicityPreserved:
          true,

        normalizationCollisionMerged:
          false,

        normalizationCollisionResolvesAlternative:
          false,

        posVocabularyValidated:
          false,

        posWinnerSelected:
          false,

        resolutionStateChanged:
          false,

        positiveConstraintEvidenceReevaluated:
          false,

        constraintPropagationInvoked:
          false,

        runtimeExpectedLabelConsumed:
          false,

        runtimeBindingConsumed:
          false,

        runtimePosSuffixConsumed:
          false,

        operatorExecuted:
          false,

        comparisonPerformed:
          false,

        comparisonTruthResolved:
          false,

        runtimeConditionTruthResolved:
          false,

        occurrenceEnumerationPerformed:
          false,

        runtimeScopeExecutionPerformed:
          false,

        cardinalityEnforcementPerformed:
          false,

        occurrenceBindingPerformed:
          false,

        learnerErrorClassified:
          false,

        canonicalDependencyEdgeGenerated:
          false,

        realizesSlotGenerated:
          false,

        graphMutationPerformed:
          false,

        frozenGrammarReadOnly:
          true,
      },
    },

    blockingReasons:
      [],
  };
}