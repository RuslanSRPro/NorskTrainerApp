import type {
  CanonicalRuntimeBindingEntityCompatibilityResultV1,
} from './canonical-runtime-binding-entity-compatibility-v1.ts';

import type {
  CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1,
} from './canonical-runtime-binding-where-reference-root-authority-v1.ts';

import type {
  CanonicalTokenPosPropertyCapabilityResultV1,
} from './canonical-token-pos-property-capability-v1.ts';

import {
  deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1,
} from './canonical-runtime-token-pos-suffix-compatibility-v1.ts';


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


function rootResult(
  options: {
    suffix?: string | null;
    rootStatus?:
      | 'exact_binding'
      | 'binding_prefix_with_opaque_suffix'
      | 'unrooted';
    rootBindingAuthorityId?: string | null;
    rootBindingName?: string | null;
    referenceExpression?: string;
  } = {},
): CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1 {
  const rootStatus =
    options.rootStatus ??
      'binding_prefix_with_opaque_suffix';

  const rootBindingAuthorityId =
    options.rootBindingAuthorityId ===
      undefined
      ? 'binding:finite'
      : options.rootBindingAuthorityId;

  const rootBindingName =
    options.rootBindingName ===
      undefined
      ? 'finite'
      : options.rootBindingName;

  const suffix =
    options.suffix ===
      undefined
      ? '.pos'
      : options.suffix;


  return {
    producer:
      'canonical_runtime_binding_where_reference_root_authority_v1',

    producerVersion:
      '1',

    status:
      'ready',

    authorities: [
      {
        id:
          'where-root:finite',

        status:
          'candidate',

        whereShapeAuthorityId:
          'where-shape:finite',

        bindingDefinitionAuthorityId:
          'binding:finite',

        manifestId:
          'manifest:finite',

        manifestCode:
          'manifest.finite',

        bindingName:
          'finite',

        referenceSites: [
          {
            path:
              '$',

            referenceExpression:
              options.referenceExpression ??
                (
                  rootStatus ===
                    'exact_binding'
                    ? 'finite'
                    : 'finite.pos'
                ),

            rootStatus,

            rootBindingAuthorityId:
              rootStatus ===
                'unrooted'
                ? null
                : rootBindingAuthorityId,

            rootBindingName:
              rootStatus ===
                'unrooted'
                ? null
                : rootBindingName,

            opaqueSuffix:
              rootStatus ===
                'binding_prefix_with_opaque_suffix'
                ? suffix
                : null,
          },
        ],

        unrootedPaths:
          rootStatus ===
              'unrooted'
            ? [
                '$',
              ]
            : [],

        governance: {
          exactWhereShapeAuthorityRequired:
            true,

          exactBindingDefinitionSetRequired:
            true,

          manifestLocalBindingRootsOnly:
            true,

          longestExactBindingPrefixWins:
            true,

          referenceExpressionPreserved:
            true,

          opaqueSuffixPreserved:
            true,

          runtimeBindingVocabularyHardcoded:
            false,

          dottedReferenceTraversalPerformed:
            false,

          suffixSemanticsResolved:
            false,

          referenceValueResolved:
            false,

          operatorSemanticsResolved:
            false,

          canonicalFactOwnershipResolved:
            false,

          graphTraversalPerformed:
            false,

          occurrenceEnumerationPerformed:
            false,

          runtimeScopeExecutionPerformed:
            false,

          cardinalityEnforcementPerformed:
            false,

          occurrenceBindingPerformed:
            false,

          endpointRoleResolved:
            false,

          dependencyDirectionResolved:
            false,

          canonicalDependencyEdgeGenerated:
            false,

          grammaticalFunctionResolved:
            false,

          complementArgumentAttachmentResolved:
            false,

          realizesSlotGenerated:
            false,

          candidateOnly:
            true,

          frozenGrammarReadOnly:
            true,
        },
      },
    ],

    blockingReasons:
      [],
  };
}


function entityResult(
  canonicalNodeType:
    'token' | 'phrase' = 'token',

  includeCandidate =
    true,
): CanonicalRuntimeBindingEntityCompatibilityResultV1 {
  return {
    producer:
      'canonical_runtime_binding_entity_compatibility_v1',

    producerVersion:
      '1',

    status:
      'ready',

    candidates:
      includeCandidate
        ? [
            {
              id:
                `entity-compat:finite:${canonicalNodeType}`,

              status:
                'candidate',

              bindingDefinitionAuthorityId:
                'binding:finite',

              manifestId:
                'manifest:finite',

              manifestCode:
                'manifest.finite',

              bindingName:
                'finite',

              runtimeEntityLabel:
                canonicalNodeType,

              canonicalNodeType,

              canonicalNodeTypeAuthorityId:
                `node-type:${canonicalNodeType}`,

              governance: {
                exactBindingDefinitionAuthorityRequired:
                  true,

                exactCanonicalNodeTypeAuthorityRequired:
                  true,

                exactOpaqueLabelMatch:
                  true,

                runtimeEntityVocabularyHardcoded:
                  false,

                canonicalNodeTypeInferredFromName:
                  false,

                entitySemanticsResolved:
                  false,

                occurrenceDomainResolved:
                  false,

                occurrenceEnumerationPerformed:
                  false,

                scopeSemanticsResolved:
                  false,

                whereSemanticsResolved:
                  false,

                cardinalitySemanticsResolved:
                  false,

                occurrenceBindingPerformed:
                  false,

                endpointRoleResolved:
                  false,

                dependencyDirectionResolved:
                  false,

                dependencySemanticsResolved:
                  false,

                canonicalEdgeGenerated:
                  false,

                grammaticalFunctionResolved:
                  false,

                complementArgumentAttachmentResolved:
                  false,

                realizesSlotGenerated:
                  false,

                compatibilityOnly:
                  true,

                candidateOnly:
                  true,

                frozenGrammarReadOnly:
                  true,
              },
            },
          ]
        : [],

    unmappedBindingDefinitionAuthorityIds:
      includeCandidate
        ? []
        : [
            'binding:finite',
          ],

    blockingReasons:
      [],
  };
}


function capabilityResult():
  CanonicalTokenPosPropertyCapabilityResultV1 {
  return {
    producer:
      'canonical_token_pos_property_capability_v1',

    producerVersion:
      '1',

    status:
      'ready',

    capability: {
      capabilityId:
        'canonical-token-pos-property:pos-a:v1',

      status:
        'proven',

      propertyDomain:
        'canonical_token_occurrence',

      propertyKind:
        'pos_hypothesis_set',

      factNodeType:
        'lexical_reading',

      factNodeSubtype:
        'pos_candidate',

      factLabelFeature:
        'pos',

      occurrenceRelation:
        'pos_of',

      occurrenceRelationDirection:
        'pos_candidate_to_token',

      governance: {
        groundedInCanonicalPosOwnershipV1:
          true,

        posModel:
          'POS-A',

        tokenOccurrenceIsPropertyOwner:
          true,

        posFactIsSeparateReadingNode:
          true,

        propertyValueIsScalar:
          false,

        propertyValueIsHypothesisSet:
          true,

        zeroHypothesesAllowed:
          true,

        multipleHypothesesAllowed:
          true,

        candidateHypothesisIsResolvedValue:
          false,

        alternativeWinnerMustBeExplicit:
          true,

        firstCandidateWins:
          false,

        rawSurfaceSpellingRead:
          false,

        lexicalSourcePosUsedAsAuthority:
          false,

        runtimePosSuffixMapped:
          false,

        runtimeCandidateEntityResolved:
          false,

        phrasePosInheritedFromHead:
          false,

        whereEqExecuted:
          false,

        referenceValueResolved:
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


Deno.test(
  'v1.46 A3.3.2c: exact rooted token .pos reference yields candidate suffix compatibility',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        rootResult(),
        entityResult(),
        capabilityResult(),
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        1 &&
      result.consideredPosReferenceSiteCount ===
        1,
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.2c: compatibility preserves exact rooted binding and token POS hypothesis-set capability',
  () => {
    const candidate =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        rootResult(),
        entityResult(),
        capabilityResult(),
      ).candidates[0];


    assert(
      candidate
        ?.referencedBindingDefinitionAuthorityId ===
        'binding:finite' &&
      candidate.referencedBindingName ===
        'finite' &&
      candidate.runtimeSuffix ===
        '.pos' &&
      candidate.canonicalNodeType ===
        'token' &&
      candidate.canonicalPropertyDomain ===
        'canonical_token_occurrence' &&
      candidate.canonicalPropertyKind ===
        'pos_hypothesis_set',
      'exact token POS bridge identity lost',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2c: phrase .pos remains unmapped rather than inheriting head POS',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        rootResult(),
        entityResult(
          'phrase',
        ),
        capabilityResult(),
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        0 &&
      result.consideredPosReferenceSiteCount ===
        1 &&
      result.unmappedPosReferenceSiteKeys.length ===
        1,
      'phrase.pos was incorrectly mapped to token POS',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2c: binding without A3.1 entity mapping remains unmapped',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        rootResult(),
        entityResult(
          'token',
          false,
        ),
        capabilityResult(),
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        0 &&
      result.unmappedPosReferenceSiteKeys.length ===
        1,
      'unmapped Runtime entity acquired token POS semantics',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2c: unrelated suffix is outside this capability and is not interpreted',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        rootResult({
          suffix:
            '.future_attribute',

          referenceExpression:
            'finite.future_attribute',
        }),
        entityResult(),
        capabilityResult(),
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        0 &&
      result.consideredPosReferenceSiteCount ===
        0 &&
      result.unmappedPosReferenceSiteKeys.length ===
        0,
      'unrelated suffix entered token POS capability',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2c: bare binding reference is not treated as .pos',
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        rootResult({
          rootStatus:
            'exact_binding',

          suffix:
            null,

          referenceExpression:
            'finite',
        }),
        entityResult(),
        capabilityResult(),
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        0 &&
      result.consideredPosReferenceSiteCount ===
        0,
      'bare binding was promoted to POS property',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2c: blocked entity-compatibility authority blocks whole bridge',
  () => {
    const entity =
      entityResult();


    const malformed = {
      ...entity,

      status:
        'blocked',

      blockingReasons: [
        'fixture:block',
      ],
    } as unknown as CanonicalRuntimeBindingEntityCompatibilityResultV1;


    const result =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        rootResult(),
        malformed,
        capabilityResult(),
      );


    assert(
      result.status ===
        'blocked' &&
      result.candidates.length ===
        0,
      'blocked A3.1 authority was consumed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2c: scalarized token POS capability is rejected',
  () => {
    const capability =
      capabilityResult();


    const malformed = {
      ...capability,

      capability: {
        ...capability.capability!,

        governance: {
          ...capability.capability!
            .governance,

          propertyValueIsScalar:
            true,

          propertyValueIsHypothesisSet:
            false,
        },
      },
    } as unknown as CanonicalTokenPosPropertyCapabilityResultV1;


    const result =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        rootResult(),
        entityResult(),
        malformed,
      );


    assert(
      result.status ===
        'blocked',
      'scalarized POS capability accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2c: ambiguous duplicate token entity compatibility blocks rather than choosing one',
  () => {
    const entity =
      entityResult();


    const original =
      entity.candidates[0];


    assert(
      original !==
        undefined,
      'entity fixture missing',
    );


    entity.candidates.push({
      ...original,

      id:
        `${original.id}:duplicate`,
    });


    const result =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        rootResult(),
        entity,
        capabilityResult(),
      );


    assert(
      result.status ===
        'blocked' &&
      result.candidates.length ===
        0,
      'ambiguous token entity compatibility was arbitrarily selected',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2c: deterministic compatibility performs no operand operator hypothesis scope cardinality binding or dependency execution',
  () => {
    const roots =
      rootResult();


    roots.authorities[0]
      .referenceSites.push({
        path:
          '$.future',

        referenceExpression:
          'finite.future_attribute',

        rootStatus:
          'binding_prefix_with_opaque_suffix',

        rootBindingAuthorityId:
          'binding:finite',

        rootBindingName:
          'finite',

        opaqueSuffix:
          '.future_attribute',
      });


    const x =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        roots,
        entityResult(),
        capabilityResult(),
      );


    const y =
      deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
        {
          ...roots,

          authorities:
            roots.authorities.map(
              (authority) => ({
                ...authority,

                referenceSites: [
                  ...authority.referenceSites,
                ].reverse(),
              }),
            ),
        },
        entityResult(),
        capabilityResult(),
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'A3.3.2c is not deterministic',
    );


    const g =
      x.candidates[0]
        ?.governance;


    assert(
      g !==
        undefined &&
      g.compatibilityOnly ===
        true &&
      g.candidateOnly ===
        true &&
      g.runtimeCandidatePosMapped ===
        false &&
      g.runtimePhrasePosMapped ===
        false &&
      g.propertyValueIsScalar ===
        false &&
      g.propertyValueIsHypothesisSet ===
        true &&
      g.posHypothesisSelected ===
        false &&
      g.rightOperandRead ===
        false &&
      g.rightOperandCompared ===
        false &&
      g.operatorSemanticsResolved ===
        false &&
      g.whereEqExecuted ===
        false &&
      g.referenceValueResolved ===
        false &&
      g.dottedReferenceTraversalPerformed ===
        false &&
      g.occurrenceEnumerationPerformed ===
        false &&
      g.runtimeScopeExecutionPerformed ===
        false &&
      g.clauseContainmentResolved ===
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
      'A3.3.2c crossed compatibility boundary',
    );
  },
);