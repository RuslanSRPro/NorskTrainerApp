import type {
  CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1,
  CanonicalRuntimeTokenPosStringOperandCompatibilityV1,
} from './canonical-runtime-token-pos-string-operand-compatibility-v1.ts';

import {
  CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1,
  deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1,
  normalizeCanonicalRuntimeTokenPosLabelV1,
} from './canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts';


function assert(
  condition:
    unknown,

  message:
    string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}


function candidate(
  options: {
    id?: string;
    siteKey?: string;
    operator?: string;
    pos?: string;
  } = {},
): CanonicalRuntimeTokenPosStringOperandCompatibilityV1 {
  return {
    id:
      options.id ??
        'string-operand:1',

    status:
      'candidate',

    leftRightSiteAuthorityId:
      'left-right:1',

    tokenPosSuffixCompatibilityId:
      'suffix:1',

    whereReferenceRootAuthorityId:
      'root:1',

    whereShapeAuthorityId:
      'shape:1',

    ownerBindingDefinitionAuthorityId:
      'binding:owner',

    referencedBindingDefinitionAuthorityId:
      'binding:token',

    manifestId:
      'manifest:1',

    manifestCode:
      'manifest.one',

    ownerBindingName:
      'owner',

    referencedBindingName:
      'token',

    referenceSiteKey:
      options.siteKey ??
        'root:1#$#token.pos',

    referencePath:
      '$',

    referenceExpression:
      'token.pos',

    runtimeSuffix:
      '.pos',

    entityCompatibilityId:
      'entity:token',

    runtimeEntityLabel:
      'token',

    canonicalNodeType:
      'token',

    tokenPosCapabilityId:
      'pos-capability:1',

    canonicalPropertyDomain:
      'canonical_token_occurrence',

    canonicalPropertyKind:
      'pos_hypothesis_set',

    operatorLabelOpaque:
      options.operator ??
        'eq',

    rightOperandStructuralKind:
      'string',

    posLabelInputOpaque:
      options.pos ??
        'verb',

    governance: {
      exactLeftRightSiteAuthorityRequired:
        true,

      exactTokenPosSuffixCompatibilityRequired:
        true,

      exactReferenceRootAuthorityIdentityMatch:
        true,

      exactWhereShapeAuthorityIdentityMatch:
        true,

      exactOwnerBindingIdentityMatch:
        true,

      exactReferencedBindingIdentityMatch:
        true,

      exactManifestIdentityMatch:
        true,

      exactBindingNameMatch:
        true,

      exactReferencePathMatch:
        true,

      exactReferenceExpressionMatch:
        true,

      exactReferenceSiteKeyMatch:
        true,

      exactRuntimePosSuffixRequired:
        true,

      exactCanonicalTokenCompatibilityRequired:
        true,

      exactTokenPosHypothesisSetCapabilityRequired:
        true,

      stringRightOperandRequired:
        true,

      stringOperandPreservedOpaque:
        true,

      posLabelInputCompatibilityOnly:
        true,

      operatorLabelPreservedOpaque:
        true,

      nonStringOperandRejectedByThisCapability:
        true,

      posVocabularyValidated:
        false,

      operandKnownCanonicalPosLabel:
        false,

      operandNormalizationPerformed:
        false,

      caseFoldingPerformed:
        false,

      operatorSemanticsResolved:
        false,

      whereEqExecuted:
        false,

      posHypothesisRead:
        false,

      posHypothesisSelected:
        false,

      posLabelCompared:
        false,

      comparisonPerformed:
        false,

      comparisonTruthResolved:
        false,

      learnerErrorClassified:
        false,

      runtimeBindingExecuted:
        false,

      occurrenceEnumerationPerformed:
        false,

      runtimeScopeExecutionPerformed:
        false,

      cardinalityEnforcementPerformed:
        false,

      occurrenceBindingPerformed:
        false,

      canonicalDependencyEdgeGenerated:
        false,

      grammaticalFunctionResolved:
        false,

      complementArgumentAttachmentResolved:
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
  };
}


function result(
  candidates:
    CanonicalRuntimeTokenPosStringOperandCompatibilityV1[],
): CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1 {
  return {
    producer:
      'canonical_runtime_token_pos_string_operand_compatibility_v1',

    producerVersion:
      '1',

    status:
      'ready',

    candidates,

    consideredTokenPosLeftRightSiteCount:
      candidates.length,

    unsupportedOperandSiteIds:
      [],

    unmatchedStringOperandSiteIds:
      [],

    tokenPosSuffixCandidatesWithoutStringOperandSiteKeys:
      [],

    blockingReasons:
      [],
  };
}


Deno.test(
  'v1.46 A3.3.4a: exact eq token .pos site receives normalized-label semantic authority',
  () => {
    const out =
      deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
        result([
          candidate(),
        ]),
      );


    const authority =
      out.authorities[0];


    assert(
      out.status ===
        'ready' &&
      out.authorities.length ===
        1 &&
      authority
        ?.normalizedOperatorLabel ===
        'eq' &&
      authority.normalizedPosLabelInput ===
        'verb',
      `out=${JSON.stringify(out)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.4a: operator recognition uses trim NFC and nb-NO lowercase',
  () => {
    const out =
      deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
        result([
          candidate({
            operator:
              '  EQ  ',
          }),
        ]),
      );


    assert(
      out.authorities.length ===
        1 &&
      out.authorities[0]
        ?.normalizedOperatorLabel ===
        'eq',
      'normalized eq operator was not recognized',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4a: right POS label is normalized while raw source value is preserved',
  () => {
    const out =
      deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
        result([
          candidate({
            pos:
              '  Verb  ',
          }),
        ]),
      );


    const authority =
      out.authorities[0];


    assert(
      authority
        ?.rawPosLabelInput ===
        '  Verb  ' &&
      authority.normalizedPosLabelInput ===
        'verb',
      'raw/normalized POS input ownership changed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4a: Unicode canonically equivalent labels normalize to identical NFC strings',
  () => {
    const composed =
      normalizeCanonicalRuntimeTokenPosLabelV1(
        '\u00C5',
      );

    const decomposed =
      normalizeCanonicalRuntimeTokenPosLabelV1(
        'A\u030A',
      );


    assert(
      composed ===
        decomposed &&
      composed ===
        '\u00E5',
      `composed=${composed} decomposed=${decomposed}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.4a: blank and non-string labels remain unsupported',
  () => {
    assert(
      normalizeCanonicalRuntimeTokenPosLabelV1(
        '   ',
      ) ===
        undefined &&
      normalizeCanonicalRuntimeTokenPosLabelV1(
        123,
      ) ===
        undefined,
      'invalid normalized label was invented',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4a: non-eq operator remains outside this semantic authority without blocking',
  () => {
    const input =
      candidate({
        operator:
          'has_feature',
      });


    const out =
      deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
        result([
          input,
        ]),
      );


    assert(
      out.status ===
        'ready' &&
      out.authorities.length ===
        0 &&
      JSON.stringify(
        out.unsupportedOperatorSiteIds,
      ) ===
        JSON.stringify([
          input.id,
        ]),
      'non-eq operator acquired eq semantics',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4a: semantic contract is token-POS normalized-label equality rather than generic equality',
  () => {
    const contract =
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1;


    assert(
      contract.status ===
        'proven' &&
      contract.semanticDomain ===
        'runtime_token_pos_normalized_label_equality' &&
      contract.normalization.trimWhitespace ===
        true &&
      contract.normalization.unicodeNormalization ===
        'NFC' &&
      contract.normalization.locale ===
        'nb-NO' &&
      contract.normalization.equalityAfterNormalization ===
        'exact_string_equality' &&
      contract.governance.genericRuntimeEqAuthority ===
        false &&
      contract.governance.genericJsonEqualityAuthority ===
        false,
      'semantic authority was widened beyond token POS labels',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4a: duplicate exact input identity blocks rather than selecting one',
  () => {
    const x =
      candidate();


    const out =
      deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
        result([
          x,
          {
            ...x,
          },
        ]),
      );


    assert(
      out.status ===
        'blocked',
      'duplicate exact site was accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4a: stale semanticized A3.3.3d input is rejected',
  () => {
    const x =
      candidate();


    const malformed = {
      ...x,

      governance: {
        ...x.governance,

        operatorSemanticsResolved:
          true,
      },
    } as unknown as CanonicalRuntimeTokenPosStringOperandCompatibilityV1;


    const out =
      deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
        result([
          malformed,
        ]),
      );


    assert(
      out.status ===
        'blocked',
      'unexpected upstream semantic widening was consumed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4a: deterministic authority performs no POS read actual comparison truth scope occurrence learner-error or dependency execution',
  () => {
    const a =
      candidate({
        id:
          'operand:a',

        siteKey:
          'root:a#$#token.pos',

        pos:
          'VERB',
      });

    const b =
      candidate({
        id:
          'operand:b',

        siteKey:
          'root:b#$#token.pos',

        pos:
          'NOUN',
      });


    const x =
      deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
        result([
          a,
          b,
        ]),
      );

    const y =
      deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
        result([
          b,
          a,
        ]),
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'authority is not deterministic',
    );


    const g =
      x.authorities[0]
        ?.governance;


    assert(
      g !==
        undefined &&
      g.operatorNormalizationExecuted ===
        true &&
      g.rightOperandNormalizationExecuted ===
        true &&
      g.operatorRecognizedAsNormalizedEq ===
        true &&
      g.tokenPosNormalizedLabelEqSemanticsResolved ===
        true &&
      g.genericRuntimeEqSemanticsResolved ===
        false &&
      g.genericJsonEqualitySemanticsResolved ===
        false &&
      g.rawLabelEqualityUsed ===
        false &&
      g.expectedPosLabelNormalized ===
        true &&
      g.canonicalPosHypothesisRead ===
        false &&
      g.canonicalPosHypothesisNormalized ===
        false &&
      g.actualPosLabelCompared ===
        false &&
      g.comparisonTruthResolved ===
        false &&
      g.runtimeConditionTruthResolved ===
        false &&
      g.occurrenceEnumerationPerformed ===
        false &&
      g.occurrenceBindingPerformed ===
        false &&
      g.runtimeScopeExecutionPerformed ===
        false &&
      g.cardinalityEnforcementPerformed ===
        false &&
      g.learnerErrorClassified ===
        false &&
      g.canonicalDependencyEdgeGenerated ===
        false &&
      g.realizesSlotGenerated ===
        false &&
      g.graphMutationPerformed ===
        false,
      'A3.3.4a crossed semantic-authority boundary',
    );
  },
);