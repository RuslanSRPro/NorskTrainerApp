import type {
  CanonicalRuntimeBindingWhereLeftRightSiteAuthorityResultV1,
  CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1,
} from './canonical-runtime-binding-where-left-right-site-authority-v1.ts';

import type {
  CanonicalRuntimeTokenPosSuffixCompatibilityResultV1,
  CanonicalRuntimeTokenPosSuffixCompatibilityV1,
} from './canonical-runtime-token-pos-suffix-compatibility-v1.ts';

import {
  deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1,
} from './canonical-runtime-token-pos-string-operand-compatibility-v1.ts';


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


function leftRightSite(
  options: {
    id?: string;
    rootAuthorityId?: string;
    shapeId?: string;
    ownerBindingId?: string;
    referencedBindingId?: string;
    manifestId?: string;
    manifestCode?: string;
    ownerBindingName?: string;
    referencedBindingName?: string;
    path?: string;
    expression?: string;
    suffix?: string | null;
    rootStatus?:
      | 'exact_binding'
      | 'binding_prefix_with_opaque_suffix';
    operator?: string;
    kind?:
      | 'null'
      | 'string'
      | 'number'
      | 'boolean'
      | 'array'
      | 'object'
      | 'other';
    right?: unknown;
  } = {},
): CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1 {
  const rootStatus =
    options.rootStatus ??
      'binding_prefix_with_opaque_suffix';

  const suffix =
    rootStatus ===
        'exact_binding'
      ? null
      : (
          options.suffix ??
          '.pos'
        );

  const kind =
    options.kind ??
      'string';

  const right =
    options.right ===
        undefined
      ? 'verb'
      : options.right;


  return {
    id:
      options.id ??
        'left-right:1',

    status:
      'candidate',

    whereReferenceRootAuthorityId:
      options.rootAuthorityId ??
        'root-authority:1',

    whereShapeAuthorityId:
      options.shapeId ??
        'where-shape:1',

    ownerBindingDefinitionAuthorityId:
      options.ownerBindingId ??
        'binding:owner',

    referencedBindingDefinitionAuthorityId:
      options.referencedBindingId ??
        'binding:finite',

    manifestId:
      options.manifestId ??
        'manifest:1',

    manifestCode:
      options.manifestCode ??
        'manifest.one',

    ownerBindingName:
      options.ownerBindingName ??
        'owner',

    leafPath:
      options.path ??
        '$',

    leftReferenceExpression:
      options.expression ??
        'finite.pos',

    leftRootStatus:
      rootStatus,

    referencedBindingName:
      options.referencedBindingName ??
        'finite',

    opaqueLeftSuffix:
      suffix,

    rightOperandAuthorityId:
      'right:1',

    operatorLabelOpaque:
      options.operator ??
        'future_operator',

    rightOperandStructuralKind:
      kind,

    rightOperandSnapshot:
      right,

    governance: {
      exactReferenceRootAuthorityRequired:
        true,

      whereReferenceRootAuthorityIdentityPreserved:
        true,

      exactRightOperandAuthorityRequired:
        true,

      sameWhereShapeAuthorityRequired:
        true,

      sameOwnerBindingAuthorityRequired:
        true,

      sameManifestRequired:
        true,

      sameOwnerBindingNameRequired:
        true,

      sameLeafPathRequired:
        true,

      ownerBindingAndReferencedBindingKeptSeparate:
        true,

      referencedBindingMayDifferFromOwner:
        true,

      unrootedLeftReferenceExcluded:
        true,

      leftReferenceExpressionPreserved:
        true,

      opaqueLeftSuffixPreserved:
        true,

      rightOperandSnapshotPreserved:
        true,

      operatorLabelPreservedOpaque:
        true,

      structuralCompositionOnly:
        true,

      dottedReferenceTraversalPerformed:
        false,

      leftReferenceValueResolved:
        false,

      rightOperandSemanticsResolved:
        false,

      stringOperandMappedToPos:
        false,

      operatorSemanticsResolved:
        false,

      comparisonPerformed:
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

      canonicalFactOwnershipResolved:
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


function leftRightResult(
  authorities:
    CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1[],
): CanonicalRuntimeBindingWhereLeftRightSiteAuthorityResultV1 {
  return {
    producer:
      'canonical_runtime_binding_where_left_right_site_authority_v1',

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    rootedLeftSiteCount:
      authorities.length,

    rightOperandSiteCount:
      authorities.length,

    composedSiteCount:
      authorities.length,

    rootedLeftSitesWithoutRight:
      [],

    rightSitesWithoutRootedLeft:
      [],

    unrootedLeftSites:
      [],

    blockingReasons:
      [],
  };
}


function siteKey(
  rootAuthorityId:
    string,

  path:
    string,

  expression:
    string,
): string {
  return [
    rootAuthorityId,
    path,
    expression,
  ].join('#');
}


function posSuffixCandidate(
  options: {
    id?: string;
    rootAuthorityId?: string;
    shapeId?: string;
    ownerBindingId?: string;
    referencedBindingId?: string;
    manifestId?: string;
    manifestCode?: string;
    ownerBindingName?: string;
    referencedBindingName?: string;
    path?: string;
    expression?: string;
  } = {},
): CanonicalRuntimeTokenPosSuffixCompatibilityV1 {
  const rootAuthorityId =
    options.rootAuthorityId ??
      'root-authority:1';

  const path =
    options.path ??
      '$';

  const expression =
    options.expression ??
      'finite.pos';


  return {
    id:
      options.id ??
        'token-pos-suffix:1',

    status:
      'candidate',

    whereReferenceRootAuthorityId:
      rootAuthorityId,

    whereShapeAuthorityId:
      options.shapeId ??
        'where-shape:1',

    ownerBindingDefinitionAuthorityId:
      options.ownerBindingId ??
        'binding:owner',

    referencedBindingDefinitionAuthorityId:
      options.referencedBindingId ??
        'binding:finite',

    manifestId:
      options.manifestId ??
        'manifest:1',

    manifestCode:
      options.manifestCode ??
        'manifest.one',

    ownerBindingName:
      options.ownerBindingName ??
        'owner',

    referencedBindingName:
      options.referencedBindingName ??
        'finite',

    referenceSiteKey:
      siteKey(
        rootAuthorityId,
        path,
        expression,
      ),

    referencePath:
      path,

    referenceExpression:
      expression,

    runtimeSuffix:
      '.pos',

    entityCompatibilityId:
      'entity-compatibility:finite-token',

    runtimeEntityLabel:
      'token',

    canonicalNodeType:
      'token',

    tokenPosCapabilityId:
      'token-pos-capability:1',

    canonicalPropertyDomain:
      'canonical_token_occurrence',

    canonicalPropertyKind:
      'pos_hypothesis_set',

    governance: {
      exactWhereReferenceRootAuthorityRequired:
        true,

      exactEntityCompatibilityAuthorityRequired:
        true,

      exactTokenPosCapabilityRequired:
        true,

      exactOpaqueSuffixMatch:
        true,

      rootedBindingIdentityPreserved:
        true,

      entityCompatibilityConsumedNotReconstructed:
        true,

      tokenPosCapabilityConsumedNotReconstructed:
        true,

      compatibilityOnly:
        true,

      candidateOnly:
        true,

      runtimeCandidatePosMapped:
        false,

      runtimePhrasePosMapped:
        false,

      propertyValueIsScalar:
        false,

      propertyValueIsHypothesisSet:
        true,

      posHypothesisSelected:
        false,

      rightOperandRead:
        false,

      rightOperandCompared:
        false,

      operatorSemanticsResolved:
        false,

      whereEqExecuted:
        false,

      referenceValueResolved:
        false,

      dottedReferenceTraversalPerformed:
        false,

      occurrenceEnumerationPerformed:
        false,

      runtimeScopeExecutionPerformed:
        false,

      clauseContainmentResolved:
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

      frozenGrammarReadOnly:
        true,
    },
  };
}


function posSuffixResult(
  candidates:
    CanonicalRuntimeTokenPosSuffixCompatibilityV1[],
): CanonicalRuntimeTokenPosSuffixCompatibilityResultV1 {
  return {
    producer:
      'canonical_runtime_token_pos_suffix_compatibility_v1',

    producerVersion:
      '1',

    status:
      'ready',

    candidates,

    consideredPosReferenceSiteCount:
      candidates.length,

    unmappedPosReferenceSiteKeys:
      [],

    blockingReasons:
      [],
  };
}


Deno.test(
  'v1.46 A3.3.3d: exact token .pos site plus string right operand yields candidate compatibility',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          leftRightSite(),
        ]),

        posSuffixResult([
          posSuffixCandidate(),
        ]),
      );


    const candidate =
      result.candidates[0];


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        1 &&
      candidate
        ?.posLabelInputOpaque ===
        'verb' &&
      candidate.runtimeSuffix ===
        '.pos' &&
      candidate.canonicalNodeType ===
        'token' &&
      candidate.canonicalPropertyKind ===
        'pos_hypothesis_set',
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.3d: exact A3.3.1 reference-site identity is preserved and rechecked',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          leftRightSite({
            rootAuthorityId:
              'root:exact',

            path:
              '$.all[0]',

            expression:
              'finite.pos',
          }),
        ]),

        posSuffixResult([
          posSuffixCandidate({
            rootAuthorityId:
              'root:exact',

            path:
              '$.all[0]',

            expression:
              'finite.pos',
          }),
        ]),
      );


    const candidate =
      result.candidates[0];


    assert(
      candidate
        ?.whereReferenceRootAuthorityId ===
        'root:exact' &&
      candidate.referenceSiteKey ===
        'root:exact#$.all[0]#finite.pos',
      'exact upstream reference-site identity was lost',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3d: operator label remains opaque and no eq operator is required',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          leftRightSite({
            operator:
              'future_unknown_operator',
          }),
        ]),

        posSuffixResult([
          posSuffixCandidate(),
        ]),
      );


    const candidate =
      result.candidates[0];


    assert(
      candidate
        ?.operatorLabelOpaque ===
        'future_unknown_operator' &&
      candidate.governance
        .operatorSemanticsResolved ===
        false &&
      candidate.governance
        .whereEqExecuted ===
        false,
      'opaque operator acquired semantics',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3d: string operand is preserved exactly without POS vocabulary validation or normalization',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          leftRightSite({
            right:
              'Verb',
          }),
        ]),

        posSuffixResult([
          posSuffixCandidate(),
        ]),
      );


    const candidate =
      result.candidates[0];


    assert(
      candidate
        ?.posLabelInputOpaque ===
        'Verb' &&
      candidate.governance
        .posVocabularyValidated ===
        false &&
      candidate.governance
        .operandKnownCanonicalPosLabel ===
        false &&
      candidate.governance
        .operandNormalizationPerformed ===
        false &&
      candidate.governance
        .caseFoldingPerformed ===
        false,
      'operand was normalized or treated as known POS vocabulary',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3d: non-string right operand is unsupported by this capability rather than interpreted',
  () => {
    const site =
      leftRightSite({
        kind:
          'array',

        right: [
          'noun',
          'verb',
        ],
      });


    const result =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          site,
        ]),

        posSuffixResult([
          posSuffixCandidate(),
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        0 &&
      JSON.stringify(
        result.unsupportedOperandSiteIds,
      ) ===
        JSON.stringify([
          site.id,
        ]),
      'array operand was interpreted as POS string input',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3d: token .pos site without A3.3.2c mapping remains unmatched and never guessed',
  () => {
    const site =
      leftRightSite();


    const result =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          site,
        ]),

        posSuffixResult(
          [],
        ),
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        0 &&
      JSON.stringify(
        result.unmatchedStringOperandSiteIds,
      ) ===
        JSON.stringify([
          site.id,
        ]),
      'missing A3.3.2c token compatibility was reconstructed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3d: matching referenceSiteKey with conflicting binding identity blocks stale composition',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          leftRightSite({
            referencedBindingId:
              'binding:finite',
          }),
        ]),

        posSuffixResult([
          posSuffixCandidate({
            referencedBindingId:
              'binding:other',
          }),
        ]),
      );


    assert(
      result.status ===
        'blocked',
      'conflicting exact-site provenance was accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3d: duplicate A3.3.2c referenceSiteKey blocks rather than selecting first candidate',
  () => {
    const first =
      posSuffixCandidate({
        id:
          'suffix:a',
      });


    const second = {
      ...first,

      id:
        'suffix:b',
    };


    const result =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          leftRightSite(),
        ]),

        posSuffixResult([
          first,
          second,
        ]),
      );


    assert(
      result.status ===
        'blocked',
      'duplicate POS suffix candidate was arbitrarily selected',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3d: identical local paths under different reference-root authorities remain independent',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          leftRightSite({
            id:
              'left:a',

            rootAuthorityId:
              'root:a',

            shapeId:
              'shape:a',

            ownerBindingId:
              'owner:a',

            referencedBindingId:
              'ref:a',

            manifestId:
              'manifest:a',

            manifestCode:
              'manifest.a',

            ownerBindingName:
              'owner-a',

            referencedBindingName:
              'ref-a',
          }),

          leftRightSite({
            id:
              'left:b',

            rootAuthorityId:
              'root:b',

            shapeId:
              'shape:b',

            ownerBindingId:
              'owner:b',

            referencedBindingId:
              'ref:b',

            manifestId:
              'manifest:b',

            manifestCode:
              'manifest.b',

            ownerBindingName:
              'owner-b',

            referencedBindingName:
              'ref-b',

            right:
              'noun',
          }),
        ]),

        posSuffixResult([
          posSuffixCandidate({
            id:
              'suffix:a',

            rootAuthorityId:
              'root:a',

            shapeId:
              'shape:a',

            ownerBindingId:
              'owner:a',

            referencedBindingId:
              'ref:a',

            manifestId:
              'manifest:a',

            manifestCode:
              'manifest.a',

            ownerBindingName:
              'owner-a',

            referencedBindingName:
              'ref-a',
          }),

          posSuffixCandidate({
            id:
              'suffix:b',

            rootAuthorityId:
              'root:b',

            shapeId:
              'shape:b',

            ownerBindingId:
              'owner:b',

            referencedBindingId:
              'ref:b',

            manifestId:
              'manifest:b',

            manifestCode:
              'manifest.b',

            ownerBindingName:
              'owner-b',

            referencedBindingName:
              'ref-b',
          }),
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        2 &&
      result.candidates[0]
        ?.referenceSiteKey !==
        result.candidates[1]
          ?.referenceSiteKey,
      'local sites from separate root authorities were merged',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3d: deterministic compatibility performs no POS read comparison operator scope occurrence learner-error or dependency semantics',
  () => {
    const leftA =
      leftRightSite({
        id:
          'left:a',

        rootAuthorityId:
          'root:a',

        shapeId:
          'shape:a',

        ownerBindingId:
          'owner:a',

        referencedBindingId:
          'ref:a',

        manifestId:
          'manifest:a',

        manifestCode:
          'manifest.a',

        ownerBindingName:
          'owner-a',

        referencedBindingName:
          'ref-a',
      });


    const leftB =
      leftRightSite({
        id:
          'left:b',

        rootAuthorityId:
          'root:b',

        shapeId:
          'shape:b',

        ownerBindingId:
          'owner:b',

        referencedBindingId:
          'ref:b',

        manifestId:
          'manifest:b',

        manifestCode:
          'manifest.b',

        ownerBindingName:
          'owner-b',

        referencedBindingName:
          'ref-b',

        right:
          'noun',
      });


    const suffixA =
      posSuffixCandidate({
        id:
          'suffix:a',

        rootAuthorityId:
          'root:a',

        shapeId:
          'shape:a',

        ownerBindingId:
          'owner:a',

        referencedBindingId:
          'ref:a',

        manifestId:
          'manifest:a',

        manifestCode:
          'manifest.a',

        ownerBindingName:
          'owner-a',

        referencedBindingName:
          'ref-a',
      });


    const suffixB =
      posSuffixCandidate({
        id:
          'suffix:b',

        rootAuthorityId:
          'root:b',

        shapeId:
          'shape:b',

        ownerBindingId:
          'owner:b',

        referencedBindingId:
          'ref:b',

        manifestId:
          'manifest:b',

        manifestCode:
          'manifest.b',

        ownerBindingName:
          'owner-b',

        referencedBindingName:
          'ref-b',
      });


    const x =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          leftA,
          leftB,
        ]),

        posSuffixResult([
          suffixA,
          suffixB,
        ]),
      );


    const y =
      deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
        leftRightResult([
          leftB,
          leftA,
        ]),

        posSuffixResult([
          suffixB,
          suffixA,
        ]),
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'A3.3.3d is not deterministic',
    );


    const g =
      x.candidates[0]
        ?.governance;


    assert(
      g !==
        undefined &&
      g.exactReferenceRootAuthorityIdentityMatch ===
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
      g.posVocabularyValidated ===
        false &&
      g.operandKnownCanonicalPosLabel ===
        false &&
      g.operatorSemanticsResolved ===
        false &&
      g.whereEqExecuted ===
        false &&
      g.posHypothesisRead ===
        false &&
      g.posHypothesisSelected ===
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
        false,
      'A3.3.3d crossed compatibility boundary',
    );
  },
);