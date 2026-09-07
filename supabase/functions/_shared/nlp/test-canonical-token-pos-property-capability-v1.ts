import {
  type CanonicalPosFactOwnershipAuthorityResultV1,
} from './canonical-pos-fact-ownership-authority-v1.ts';

import {
  deriveCanonicalTokenPosPropertyCapabilityV1,
} from './canonical-token-pos-property-capability-v1.ts';


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


function ownershipResult(
  count =
    1,
): CanonicalPosFactOwnershipAuthorityResultV1 {
  return {
    producer:
      'canonical_pos_fact_ownership_authority_v1',

    producerVersion:
      '1',

    status:
      'ready',

    authorities:
      Array.from(
        {
          length:
            count,
        },

        (
          _,
          index,
        ) => ({
          authorityId:
            `canonical-pos-fact:pos:${index}`,

          status:
            'proven' as const,

          model:
            'POS-A' as const,

          posReadingNodeId:
            `pos:${index}`,

          posLabel:
            index ===
                0
              ? 'noun'
              : 'adjective',

          posReadingGraphStatus:
            'candidate' as const,

          tokenNodeId:
            'token:1',

          posOfEdgeId:
            `edge:pos:${index}`,

          posOfEdgeGraphStatus:
            'candidate' as const,

          contributingLexicalReadingIds: [
            `lex:${index}`,
          ],

          lexicalSupportEdgeIds: [
            `edge:support:${index}`,
          ],

          lexicalSupportGraphStatuses: [
            'candidate' as const,
          ],

          alternativeSetId:
            'alt:pos:token:1',

          alternativeSetStatus:
            'open' as const,

          alternativeMemberIds:
            Array.from(
              {
                length:
                  count,
              },

              (
                __,
                memberIndex,
              ) =>
                `pos:${memberIndex}`,
            ),

          resolvedMemberIds:
            [],

          governance: {
            exactCanonicalPosRepresentation:
              true as const,

            posModel:
              'POS-A' as const,

            posFactNodeType:
              'lexical_reading' as const,

            posFactSubtype:
              'pos_candidate' as const,

            posLabelOwnedByNodeFeature:
              true as const,

            exactOccurrenceOwnershipUsesPosOfEdge:
              true as const,

            posOfDirection:
              'pos_candidate_to_token' as const,

            lexicalSupportDirection:
              'lexical_candidate_to_pos_candidate' as const,

            sourcePosIsEvidenceNotAuthority:
              true as const,

            alternativeDomainIsTokenLocal:
              true as const,

            multiplePosCandidatesMayCoexist:
              true as const,

            underlyingGraphStatusPreserved:
              true as const,

            candidateDoesNotMeanResolved:
              true as const,

            resolvedAlternativeWinnerNotInferred:
              true as const,

            compatibilitySubtypePosPromoted:
              false as const,

            runtimePosSuffixMapped:
              false as const,

            whereOperatorSemanticsResolved:
              false as const,

            whereEqExecuted:
              false as const,

            referenceValueResolved:
              false as const,

            rawSurfaceSpellingRead:
              false as const,

            firstCandidateWins:
              false as const,

            occurrenceEnumerationPerformed:
              false as const,

            runtimeScopeExecutionPerformed:
              false as const,

            cardinalityEnforcementPerformed:
              false as const,

            occurrenceBindingPerformed:
              false as const,

            dependencyDirectionResolved:
              false as const,

            canonicalDependencyEdgeGenerated:
              false as const,

            grammaticalFunctionResolved:
              false as const,

            complementArgumentAttachmentResolved:
              false as const,

            realizesSlotGenerated:
              false as const,

            graphMutationPerformed:
              false as const,

            frozenGrammarReadOnly:
              true as const,
          },
        }),
      ),

    blockingReasons:
      [],
  };
}


Deno.test(
  'v1.46 A3.3.2b: proven POS-A ownership yields canonical token POS property capability',
  () => {
    const result =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        ownershipResult(),
      );


    assert(
      result.status ===
        'ready' &&
      result.capability !==
        undefined &&
      result.capability
        .propertyDomain ===
        'canonical_token_occurrence' &&
      result.capability
        .propertyKind ===
        'pos_hypothesis_set',
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.2b: capability preserves POS-A node and pos_of representation',
  () => {
    const capability =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        ownershipResult(),
      ).capability;


    assert(
      capability?.factNodeType ===
        'lexical_reading' &&
      capability.factNodeSubtype ===
        'pos_candidate' &&
      capability.factLabelFeature ===
        'pos' &&
      capability.occurrenceRelation ===
        'pos_of' &&
      capability
        .occurrenceRelationDirection ===
        'pos_candidate_to_token',
      'POS-A representation lost',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2b: token POS property is explicitly a hypothesis set and not scalar',
  () => {
    const capability =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        ownershipResult(
          2,
        ),
      ).capability;


    assert(
      capability?.governance
        .propertyValueIsScalar ===
        false &&
      capability.governance
        .propertyValueIsHypothesisSet ===
        true &&
      capability.governance
        .multipleHypothesesAllowed ===
        true,
      'POS ambiguity collapsed into scalar property',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2b: zero current POS occurrences does not invalidate type-level capability',
  () => {
    const result =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        ownershipResult(
          0,
        ),
      );


    assert(
      result.status ===
        'ready' &&
      result.capability !==
        undefined &&
      result.capability
        .governance
        .zeroHypothesesAllowed ===
        true,
      'capability incorrectly depends on current occurrence count',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2b: stale POS ownership producer blocks capability',
  () => {
    const source =
      ownershipResult();


    const malformed = {
      ...source,

      producer:
        'stale-pos-owner',
    } as unknown as CanonicalPosFactOwnershipAuthorityResultV1;


    const result =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        malformed,
      );


    assert(
      result.status ===
        'blocked',
      'stale upstream producer accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2b: unsafe POS model blocks capability',
  () => {
    const source =
      ownershipResult();


    source.authorities[0] = {
      ...source.authorities[0],

      model:
        'POS-B',
    } as unknown as typeof source.authorities[number];


    const result =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        source,
      );


    assert(
      result.status ===
        'blocked',
      'wrong POS ownership model accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2b: inferred winner semantics are rejected',
  () => {
    const source =
      ownershipResult();


    source.authorities[0] = {
      ...source.authorities[0],

      governance: {
        ...source.authorities[0]
          .governance,

        resolvedAlternativeWinnerNotInferred:
          false,
      },
    } as unknown as typeof source.authorities[number];


    const result =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        source,
      );


    assert(
      result.status ===
        'blocked',
      'winner inference accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2b: duplicate POS authority identity blocks capability',
  () => {
    const source =
      ownershipResult();


    source.authorities = [
      source.authorities[0],
      source.authorities[0],
    ];


    const result =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        source,
      );


    assert(
      result.status ===
        'blocked',
      'duplicate POS authority accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2b: candidate POS cannot become resolved scalar through capability',
  () => {
    const capability =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        ownershipResult(),
      ).capability;


    assert(
      capability?.governance
        .candidateHypothesisIsResolvedValue ===
        false &&
      capability.governance
        .alternativeWinnerMustBeExplicit ===
        true &&
      capability.governance
        .firstCandidateWins ===
        false,
      'candidate POS promoted into scalar truth',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2b: deterministic capability performs no Runtime suffix phrase-head where scope cardinality or dependency execution',
  () => {
    const source =
      ownershipResult(
        2,
      );


    const x =
      deriveCanonicalTokenPosPropertyCapabilityV1(
        source,
      );


    const y =
      deriveCanonicalTokenPosPropertyCapabilityV1({
        ...source,

        authorities: [
          ...source.authorities,
        ].reverse(),
      });


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'A3.3.2b not deterministic',
    );


    const g =
      x.capability
        ?.governance;


    assert(
      g !==
        undefined &&
      g.runtimePosSuffixMapped ===
        false &&
      g.runtimeCandidateEntityResolved ===
        false &&
      g.phrasePosInheritedFromHead ===
        false &&
      g.whereEqExecuted ===
        false &&
      g.referenceValueResolved ===
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
      'A3.3.2b crossed property-capability boundary',
    );
  },
);