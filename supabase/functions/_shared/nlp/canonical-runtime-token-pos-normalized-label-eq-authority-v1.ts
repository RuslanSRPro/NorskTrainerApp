// Norsk Trainer — Runtime Token POS Normalized-Label Eq Authority V1
//
// v1.46 A3.3.4a
//
// Source-backed semantic contract:
//
//   stringValue:
//     typeof value === string
//     -> trim
//     -> empty becomes unsupported
//
//   normalizedLabel:
//     -> Unicode NFC
//     -> toLocaleLowerCase('nb-NO')
//
// Canonical consumers additionally establish:
//
//   normalizedLabel(where.op) === 'eq'
//   normalizedLabel(where.right) -> expected POS label
//   normalizedLabel(canonical POS) -> actual POS label
//   normalized actual === normalized expected
//
// Scope of this authority:
//
//   Runtime token .pos + string-right-operand sites only.
//
// This is NOT generic JSON equality and NOT generic Runtime eq.
//
// This layer proves:
// - the operator is the token-POS normalized-label equality operator;
// - the exact label normalization transform;
// - the normalized expected POS-label input.
//
// It does NOT:
// - read a token occurrence;
// - read a canonical POS hypothesis set;
// - select a POS winner;
// - compare against an actual occurrence;
// - produce true/false Runtime condition truth;
// - classify learner correctness;
// - execute scope/cardinality;
// - generate graph/dependency facts.

import {
  CANONICAL_RUNTIME_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,
  type CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1,
  type CanonicalRuntimeTokenPosStringOperandCompatibilityV1,
} from './canonical-runtime-token-pos-string-operand-compatibility-v1.ts';


export const CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1 =
  'canonical_runtime_token_pos_normalized_label_eq_authority_v1';


export const CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1 = {
  authorityId:
    CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,

  status:
    'proven',

  semanticDomain:
    'runtime_token_pos_normalized_label_equality',

  operatorCanonicalLabel:
    'eq',

  normalization: {
    inputType:
      'string_only',

    trimWhitespace:
      true,

    emptyAfterTrimUnsupported:
      true,

    unicodeNormalization:
      'NFC',

    localeCaseTransform:
      'toLocaleLowerCase',

    locale:
      'nb-NO',

    equalityAfterNormalization:
      'exact_string_equality',
  },

  sourceEvidence: [
    'canonical-construction-candidate-lattice-v1:normalizedLabel',
    'canonical-construction-candidate-lattice-v1:token-pos-eq-consumer',
    'canonical-phrase-candidate-lattice-v1:normalizedLabel',
    'canonical-phrase-candidate-lattice-v1:token-pos-eq-consumer',
  ],

  governance: {
    tokenPosDomainOnly:
      true,

    genericRuntimeEqAuthority:
      false,

    genericJsonEqualityAuthority:
      false,

    rawStringEquality:
      false,

    normalizedLabelEquality:
      true,

    occurrenceTruthEvaluation:
      false,

    learnerErrorAuthority:
      false,

    frozenGrammarReadOnly:
      true,
  },
} as const;


export type CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1 = {
  id:
    string;

  status:
    'candidate';

  semanticAuthorityId:
    typeof CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1;

  stringOperandCompatibilityId:
    string;

  whereReferenceRootAuthorityId:
    string;

  whereShapeAuthorityId:
    string;

  ownerBindingDefinitionAuthorityId:
    string;

  referencedBindingDefinitionAuthorityId:
    string;

  manifestId:
    string;

  manifestCode:
    string;

  ownerBindingName:
    string;

  referencedBindingName:
    string;

  referenceSiteKey:
    string;

  referencePath:
    string;

  referenceExpression:
    string;

  runtimeSuffix:
    '.pos';

  canonicalNodeType:
    'token';

  canonicalPropertyDomain:
    'canonical_token_occurrence';

  canonicalPropertyKind:
    'pos_hypothesis_set';

  rawOperatorLabel:
    string;

  normalizedOperatorLabel:
    'eq';

  rawPosLabelInput:
    string;

  normalizedPosLabelInput:
    string;

  normalizationContract: {
    trimWhitespace:
      true;

    unicodeNormalization:
      'NFC';

    localeCaseTransform:
      'toLocaleLowerCase';

    locale:
      'nb-NO';

    equalityAfterNormalization:
      'exact_string_equality';
  };

  governance: {
    exactA333dCompatibilityRequired:
      true;

    exactTokenPosDomainRequired:
      true;

    operatorNormalizationExecuted:
      true;

    rightOperandNormalizationExecuted:
      true;

    operatorRecognizedAsNormalizedEq:
      true;

    tokenPosNormalizedLabelEqSemanticsResolved:
      true;

    genericRuntimeEqSemanticsResolved:
      false;

    genericJsonEqualitySemanticsResolved:
      false;

    rawLabelEqualityUsed:
      false;

    expectedPosLabelNormalized:
      true;

    canonicalPosHypothesisRead:
      false;

    canonicalPosHypothesisNormalized:
      false;

    actualPosLabelCompared:
      false;

    comparisonTruthResolved:
      false;

    runtimeConditionTruthResolved:
      false;

    occurrenceEnumerationPerformed:
      false;

    occurrenceBindingPerformed:
      false;

    runtimeScopeExecutionPerformed:
      false;

    cardinalityEnforcementPerformed:
      false;

    learnerErrorClassified:
      false;

    canonicalDependencyEdgeGenerated:
      false;

    realizesSlotGenerated:
      false;

    graphMutationPerformed:
      false;

    candidateOnly:
      true;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1[];

  consideredTokenPosStringOperandCount:
    number;

  unsupportedOperatorSiteIds:
    string[];

  blockingReasons:
    string[];
};


export function normalizeCanonicalRuntimeTokenPosLabelV1(
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


  if (!trimmed) {
    return undefined;
  }


  return trimmed
    .normalize(
      'NFC',
    )
    .toLocaleLowerCase(
      'nb-NO',
    );
}


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


function safeInput(
  candidate:
    CanonicalRuntimeTokenPosStringOperandCompatibilityV1,
): boolean {
  const g =
    candidate.governance;


  return (
    candidate.status ===
      'candidate' &&

    Boolean(
      stringValue(
        candidate.id,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.whereReferenceRootAuthorityId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.whereShapeAuthorityId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.ownerBindingDefinitionAuthorityId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referencedBindingDefinitionAuthorityId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.manifestId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.manifestCode,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.ownerBindingName,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referencedBindingName,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referenceSiteKey,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referencePath,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referenceExpression,
      ),
    ) &&

    candidate.runtimeSuffix ===
      '.pos' &&

    candidate.canonicalNodeType ===
      'token' &&

    candidate.canonicalPropertyDomain ===
      'canonical_token_occurrence' &&

    candidate.canonicalPropertyKind ===
      'pos_hypothesis_set' &&

    candidate.rightOperandStructuralKind ===
      'string' &&

    Boolean(
      stringValue(
        candidate.operatorLabelOpaque,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.posLabelInputOpaque,
      ),
    ) &&

    g.exactLeftRightSiteAuthorityRequired ===
      true &&

    g.exactTokenPosSuffixCompatibilityRequired ===
      true &&

    g.exactReferenceRootAuthorityIdentityMatch ===
      true &&

    g.exactWhereShapeAuthorityIdentityMatch ===
      true &&

    g.exactOwnerBindingIdentityMatch ===
      true &&

    g.exactReferencedBindingIdentityMatch ===
      true &&

    g.exactManifestIdentityMatch ===
      true &&

    g.exactBindingNameMatch ===
      true &&

    g.exactReferencePathMatch ===
      true &&

    g.exactReferenceExpressionMatch ===
      true &&

    g.exactReferenceSiteKeyMatch ===
      true &&

    g.exactRuntimePosSuffixRequired ===
      true &&

    g.exactCanonicalTokenCompatibilityRequired ===
      true &&

    g.exactTokenPosHypothesisSetCapabilityRequired ===
      true &&

    g.stringRightOperandRequired ===
      true &&

    g.stringOperandPreservedOpaque ===
      true &&

    g.posLabelInputCompatibilityOnly ===
      true &&

    g.operatorLabelPreservedOpaque ===
      true &&

    g.posVocabularyValidated ===
      false &&

    g.operandKnownCanonicalPosLabel ===
      false &&

    g.operandNormalizationPerformed ===
      false &&

    g.caseFoldingPerformed ===
      false &&

    g.operatorSemanticsResolved ===
      false &&

    g.whereEqExecuted ===
      false &&

    g.posHypothesisRead ===
      false &&

    g.posLabelCompared ===
      false &&

    g.comparisonPerformed ===
      false &&

    g.comparisonTruthResolved ===
      false &&

    g.learnerErrorClassified ===
      false &&

    g.runtimeBindingExecuted ===
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

    g.candidateOnly ===
      true &&

    g.frozenGrammarReadOnly ===
      true
  );
}


function blockedResult(
  reasons:
    readonly string[],
): CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'blocked',

    authorities:
      [],

    consideredTokenPosStringOperandCount:
      0,

    unsupportedOperatorSiteIds:
      [],

    blockingReasons:
      unique(
        reasons,
      ),
  };
}


export function deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
  input:
    CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1,
): CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1 {
  const blockingReasons:
    string[] = [];


  if (
    input.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1 ||
    input.producerVersion !==
      '1' ||
    input.status !==
      'ready' ||
    input.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      'token_pos_string_operand_result:not_exact_ready_compatibility',
    );
  }


  const seenIds =
    new Set<
      string
    >();

  const seenSiteKeys =
    new Set<
      string
    >();


  for (
    const candidate of
      input.candidates
  ) {
    if (
      seenIds.has(
        candidate.id,
      )
    ) {
      blockingReasons.push(
        `token_pos_string_operand:${candidate.id}:duplicate_id`,
      );
    }


    seenIds.add(
      candidate.id,
    );


    if (
      seenSiteKeys.has(
        candidate.referenceSiteKey,
      )
    ) {
      blockingReasons.push(
        `token_pos_string_operand:${candidate.referenceSiteKey}:duplicate_reference_site`,
      );
    }


    seenSiteKeys.add(
      candidate.referenceSiteKey,
    );


    if (
      !safeInput(
        candidate,
      )
    ) {
      blockingReasons.push(
        `token_pos_string_operand:${candidate.id}:unsafe_contract`,
      );
    }
  }


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  const authorities:
    CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1[] =
      [];

  const unsupportedOperatorSiteIds:
    string[] = [];


  for (
    const candidate of
      [...input.candidates].sort(
        (a, b) =>
          a.id.localeCompare(
            b.id,
          ),
      )
  ) {
    const normalizedOperator =
      normalizeCanonicalRuntimeTokenPosLabelV1(
        candidate.operatorLabelOpaque,
      );


    if (
      normalizedOperator !==
        'eq'
    ) {
      unsupportedOperatorSiteIds.push(
        candidate.id,
      );

      continue;
    }


    const normalizedPos =
      normalizeCanonicalRuntimeTokenPosLabelV1(
        candidate.posLabelInputOpaque,
      );


    if (!normalizedPos) {
      blockingReasons.push(
        `token_pos_string_operand:${candidate.id}:normalization_failed`,
      );

      continue;
    }


    authorities.push({
      id: [
        'runtime-token-pos-normalized-label-eq-v1',
        idPart(
          candidate.referenceSiteKey,
        ),
      ].join(':'),

      status:
        'candidate',

      semanticAuthorityId:
        CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,

      stringOperandCompatibilityId:
        candidate.id,

      whereReferenceRootAuthorityId:
        candidate.whereReferenceRootAuthorityId,

      whereShapeAuthorityId:
        candidate.whereShapeAuthorityId,

      ownerBindingDefinitionAuthorityId:
        candidate.ownerBindingDefinitionAuthorityId,

      referencedBindingDefinitionAuthorityId:
        candidate.referencedBindingDefinitionAuthorityId,

      manifestId:
        candidate.manifestId,

      manifestCode:
        candidate.manifestCode,

      ownerBindingName:
        candidate.ownerBindingName,

      referencedBindingName:
        candidate.referencedBindingName,

      referenceSiteKey:
        candidate.referenceSiteKey,

      referencePath:
        candidate.referencePath,

      referenceExpression:
        candidate.referenceExpression,

      runtimeSuffix:
        '.pos',

      canonicalNodeType:
        'token',

      canonicalPropertyDomain:
        'canonical_token_occurrence',

      canonicalPropertyKind:
        'pos_hypothesis_set',

      rawOperatorLabel:
        candidate.operatorLabelOpaque,

      normalizedOperatorLabel:
        'eq',

      rawPosLabelInput:
        candidate.posLabelInputOpaque,

      normalizedPosLabelInput:
        normalizedPos,

      normalizationContract: {
        trimWhitespace:
          true,

        unicodeNormalization:
          'NFC',

        localeCaseTransform:
          'toLocaleLowerCase',

        locale:
          'nb-NO',

        equalityAfterNormalization:
          'exact_string_equality',
      },

      governance: {
        exactA333dCompatibilityRequired:
          true,

        exactTokenPosDomainRequired:
          true,

        operatorNormalizationExecuted:
          true,

        rightOperandNormalizationExecuted:
          true,

        operatorRecognizedAsNormalizedEq:
          true,

        tokenPosNormalizedLabelEqSemanticsResolved:
          true,

        genericRuntimeEqSemanticsResolved:
          false,

        genericJsonEqualitySemanticsResolved:
          false,

        rawLabelEqualityUsed:
          false,

        expectedPosLabelNormalized:
          true,

        canonicalPosHypothesisRead:
          false,

        canonicalPosHypothesisNormalized:
          false,

        actualPosLabelCompared:
          false,

        comparisonTruthResolved:
          false,

        runtimeConditionTruthResolved:
          false,

        occurrenceEnumerationPerformed:
          false,

        occurrenceBindingPerformed:
          false,

        runtimeScopeExecutionPerformed:
          false,

        cardinalityEnforcementPerformed:
          false,

        learnerErrorClassified:
          false,

        canonicalDependencyEdgeGenerated:
          false,

        realizesSlotGenerated:
          false,

        graphMutationPerformed:
          false,

        candidateOnly:
          true,

        frozenGrammarReadOnly:
          true,
      },
    });
  }


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  authorities.sort(
    (a, b) =>
      a.id.localeCompare(
        b.id,
      ),
  );


  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    consideredTokenPosStringOperandCount:
      input.candidates.length,

    unsupportedOperatorSiteIds:
      unique(
        unsupportedOperatorSiteIds,
      ),

    blockingReasons:
      [],
  };
}