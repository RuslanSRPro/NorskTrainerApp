import type {
  CanonicalTokenPosHypothesisMemberReadV1,
  CanonicalTokenPosHypothesisSetReadResultV1,
  CanonicalTokenPosHypothesisSetReadStateV1,
} from './canonical-token-pos-hypothesis-set-read-v1.ts';

import {
  projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1,
} from './canonical-token-pos-hypothesis-set-normalized-label-projection-v1.ts';


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


function member(
  id:
    string,

  label:
    string,

  options: {
    graphStatus?:
      CanonicalTokenPosHypothesisMemberReadV1['graphStatus'];

    explicitlyResolved?:
      boolean;
  } = {},
): CanonicalTokenPosHypothesisMemberReadV1 {
  return {
    posReadingNodeId:
      id,

    posLabel:
      label,

    graphStatus:
      options.graphStatus ??
        'candidate',

    explicitlyResolved:
      options.explicitlyResolved ??
        false,
  };
}


function readResult(
  options: {
    readState?:
      CanonicalTokenPosHypothesisSetReadStateV1;

    members?:
      CanonicalTokenPosHypothesisMemberReadV1[];

    alternativeSetId?:
      string | null;

    alternativeSetStatus?:
      'open'
      | 'resolved'
      | 'blocked'
      | null;

    resolvedMemberIds?:
      string[];

    resolvedPosLabels?:
      string[];
  } = {},
): CanonicalTokenPosHypothesisSetReadResultV1 {
  return {
    producer:
      'canonical_token_pos_hypothesis_set_read_v1',

    producerVersion:
      '1',

    status:
      'ready',

    read: {
      readId:
        'pos-read:token-1',

      status:
        'proven',

      tokenNodeId:
        'token:1',

      readState:
        options.readState ??
          'open_hypothesis_set',

      alternativeSetId:
        options.alternativeSetId ===
            undefined
          ? 'alt:pos:token:1'
          : options.alternativeSetId,

      alternativeSetStatus:
        options.alternativeSetStatus ===
            undefined
          ? 'open'
          : options.alternativeSetStatus,

      members:
        options.members ??
          [
            member(
              'pos:verb',
              'verb',
            ),
          ],

      resolvedMemberIds:
        options.resolvedMemberIds ??
          [],

      resolvedPosLabels:
        options.resolvedPosLabels ??
          [],

      governance: {
        exactCanonicalTokenRequired:
          true,

        exactPosOwnershipAuthorityRequired:
          true,

        exactTokenPosCapabilityRequired:
          true,

        readsExistingCanonicalStateOnly:
          true,

        alternativeSetStatusIsAuthoritative:
          true,

        resolvedMembersMustBeExplicit:
          true,

        singletonAutoResolved:
          false,

        survivingCandidateAutoResolved:
          false,

        positiveConstraintEvidenceReevaluated:
          false,

        constraintPropagationInvoked:
          false,

        graphFactAmbiguousStatusPromotedToSetAmbiguity:
          false,

        memberGraphStatusesPreserved:
          true,

        propertyValueIsScalar:
          false,

        propertyValueIsHypothesisSet:
          true,

        runtimePosSuffixConsumed:
          false,

        runtimeBindingConsumed:
          false,

        rightOperandRead:
          false,

        operatorSemanticsResolved:
          false,

        whereEqExecuted:
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
  'v1.46 A3.3.4b: no_pos_fact remains no_pos_fact with empty projection',
  () => {
    const result =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        readResult({
          readState:
            'no_pos_fact',

          members:
            [],

          alternativeSetId:
            null,

          alternativeSetStatus:
            null,
        }),
      );


    const projection =
      result.projection;


    assert(
      result.status ===
        'ready' &&
      projection
        ?.readState ===
        'no_pos_fact' &&
      projection.members.length ===
        0 &&
      projection.alternativeSetId ===
        null,
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b: open hypothesis set preserves every member and adds normalized labels',
  () => {
    const result =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        readResult({
          members: [
            member(
              'pos:1',
              ' Verb ',
            ),

            member(
              'pos:2',
              'NOUN',
            ),
          ],
        }),
      );


    const projection =
      result.projection;


    assert(
      projection
        ?.readState ===
        'open_hypothesis_set' &&
      projection.members.length ===
        2 &&
      projection.members[0]
        ?.rawPosLabel ===
        ' Verb ' &&
      projection.members[0]
        ?.normalizedPosLabel ===
        'verb' &&
      projection.members[1]
        ?.normalizedPosLabel ===
        'noun',
      'open member projection changed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b: singleton open hypothesis remains open and is never auto-resolved',
  () => {
    const result =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        readResult(),
      );


    const projection =
      result.projection;


    assert(
      projection
        ?.readState ===
        'open_hypothesis_set' &&
      projection.members.length ===
        1 &&
      projection.members[0]
        ?.explicitlyResolved ===
        false &&
      projection.resolvedMemberIds.length ===
        0 &&
      projection.governance
        .posWinnerSelected ===
        false,
      'normalization resolved singleton POS hypothesis',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b: explicit resolved state and resolved member identity are preserved exactly',
  () => {
    const result =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        readResult({
          readState:
            'explicit_resolved',

          alternativeSetStatus:
            'resolved',

          members: [
            member(
              'pos:verb',
              'VERB',
              {
                graphStatus:
                  'resolved',

                explicitlyResolved:
                  true,
              },
            ),
          ],

          resolvedMemberIds: [
            'pos:verb',
          ],

          resolvedPosLabels: [
            'VERB',
          ],
        }),
      );


    const projection =
      result.projection;


    assert(
      projection
        ?.readState ===
        'explicit_resolved' &&
      JSON.stringify(
        projection.resolvedMemberIds,
      ) ===
        JSON.stringify([
          'pos:verb',
        ]) &&
      JSON.stringify(
        projection.rawResolvedPosLabels,
      ) ===
        JSON.stringify([
          'VERB',
        ]) &&
      JSON.stringify(
        projection.normalizedResolvedPosLabels,
      ) ===
        JSON.stringify([
          'verb',
        ]) &&
      projection.members[0]
        ?.graphStatus ===
        'resolved' &&
      projection.members[0]
        ?.explicitlyResolved ===
        true,
      'explicit resolution changed during projection',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b: blocked hypothesis-set state remains blocked',
  () => {
    const result =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        readResult({
          readState:
            'blocked_hypothesis_set',

          alternativeSetStatus:
            'blocked',

          members:
            [],
        }),
      );


    assert(
      result.projection
        ?.readState ===
        'blocked_hypothesis_set' &&
      result.projection
        ?.alternativeSetStatus ===
        'blocked',
      'blocked state was changed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b: member ambiguous graph status is preserved rather than promoted to set semantics',
  () => {
    const result =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        readResult({
          members: [
            member(
              'pos:ambiguous',
              'ADJECTIVE',
              {
                graphStatus:
                  'ambiguous',
              },
            ),
          ],
        }),
      );


    assert(
      result.projection
        ?.members[0]
        ?.graphStatus ===
        'ambiguous' &&
      result.projection
        ?.readState ===
        'open_hypothesis_set',
      'member graph ambiguity changed set state',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b: normalization collision preserves two distinct POS facts without merging',
  () => {
    const result =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        readResult({
          members: [
            member(
              'pos:upper',
              'VERB',
            ),

            member(
              'pos:lower',
              'verb',
            ),
          ],
        }),
      );


    const projection =
      result.projection;


    assert(
      projection
        ?.members.length ===
        2 &&
      projection.members[0]
        ?.posReadingNodeId !==
        projection.members[1]
          ?.posReadingNodeId &&
      projection.members[0]
        ?.normalizedPosLabel ===
        'verb' &&
      projection.members[1]
        ?.normalizedPosLabel ===
        'verb' &&
      projection.governance
        .normalizationCollisionMerged ===
        false &&
      projection.governance
        .normalizationCollisionResolvesAlternative ===
        false,
      'normalization collision collapsed canonical facts',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b: resolved normalized-label collisions preserve multiplicity and resolved identities',
  () => {
    const result =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        readResult({
          readState:
            'explicit_resolved',

          alternativeSetStatus:
            'resolved',

          members: [
            member(
              'pos:a',
              'VERB',
              {
                graphStatus:
                  'resolved',

                explicitlyResolved:
                  true,
              },
            ),

            member(
              'pos:b',
              'verb',
              {
                graphStatus:
                  'resolved',

                explicitlyResolved:
                  true,
              },
            ),
          ],

          resolvedMemberIds: [
            'pos:a',
            'pos:b',
          ],

          resolvedPosLabels: [
            'VERB',
            'verb',
          ],
        }),
      );


    const projection =
      result.projection;


    assert(
      projection
        ?.resolvedMemberIds.length ===
        2 &&
      JSON.stringify(
        projection.normalizedResolvedPosLabels,
      ) ===
        JSON.stringify([
          'verb',
          'verb',
        ]) &&
      projection.governance
        .resolvedLabelMultiplicityPreserved ===
        true,
      'resolved label collision was deduplicated',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b: invalid blank canonical POS label blocks projection rather than silently dropping fact',
  () => {
    const result =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        readResult({
          members: [
            member(
              'pos:blank',
              '   ',
            ),
          ],
        }),
      );


    assert(
      result.status ===
        'blocked' &&
      result.projection ===
        undefined,
      'invalid label was silently dropped',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b: deterministic projection performs no comparison truth resolution propagation Runtime or graph mutation',
  () => {
    const input =
      readResult({
        members: [
          member(
            'pos:a',
            'VERB',
          ),

          member(
            'pos:b',
            'NOUN',
          ),
        ],
      });


    const x =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        input,
      );

    const y =
      projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
        input,
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'normalized POS projection is not deterministic',
    );


    const g =
      x.projection
        ?.governance;


    assert(
      g !==
        undefined &&
      g.exactA332dReadRequired ===
        true &&
      g.exactA334aNormalizationRequired ===
        true &&
      g.existingCanonicalStateReadOnly ===
        true &&
      g.rawLabelsPreserved ===
        true &&
      g.normalizedLabelsAdded ===
        true &&
      g.readStatePreserved ===
        true &&
      g.memberIdentityPreserved ===
        true &&
      g.memberMultiplicityPreserved ===
        true &&
      g.memberGraphStatusesPreserved ===
        true &&
      g.explicitResolutionFlagsPreserved ===
        true &&
      g.resolvedMemberIdsPreserved ===
        true &&
      g.normalizationCollisionMerged ===
        false &&
      g.posVocabularyValidated ===
        false &&
      g.posWinnerSelected ===
        false &&
      g.resolutionStateChanged ===
        false &&
      g.positiveConstraintEvidenceReevaluated ===
        false &&
      g.constraintPropagationInvoked ===
        false &&
      g.runtimeExpectedLabelConsumed ===
        false &&
      g.runtimeBindingConsumed ===
        false &&
      g.runtimePosSuffixConsumed ===
        false &&
      g.operatorExecuted ===
        false &&
      g.comparisonPerformed ===
        false &&
      g.comparisonTruthResolved ===
        false &&
      g.runtimeConditionTruthResolved ===
        false &&
      g.occurrenceEnumerationPerformed ===
        false &&
      g.runtimeScopeExecutionPerformed ===
        false &&
      g.cardinalityEnforcementPerformed ===
        false &&
      g.occurrenceBindingPerformed ===
        false &&
      g.learnerErrorClassified ===
        false &&
      g.canonicalDependencyEdgeGenerated ===
        false &&
      g.realizesSlotGenerated ===
        false &&
      g.graphMutationPerformed ===
        false,
      'A3.3.4b crossed projection boundary',
    );
  },
);