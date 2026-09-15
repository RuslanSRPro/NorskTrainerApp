import {
  deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1,
} from './canonical-token-pos-graph-bound-normalized-label-projection-v1.ts';
import {
  createCanonicalLanguageGraphV1,
  type CanonicalLanguageGraphV1,
  type GraphStatus,
  type LanguageGraphEdgeV1,
  type LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import {
  buildCanonicalSurfaceDocumentV1,
} from './canonical-surface-boundary-v1.ts';

import type {
  CanonicalPosFactOwnershipAuthorityResultV1,
} from './canonical-pos-fact-ownership-authority-v1.ts';

import {
  deriveCanonicalTokenPosPropertyCapabilityV1,
} from './canonical-token-pos-property-capability-v1.ts';

import {
  readCanonicalTokenPosHypothesisSetV1,
} from './canonical-token-pos-hypothesis-set-read-v1.ts';


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


function baseGraph() {
  const graph =
    createCanonicalLanguageGraphV1(
      buildCanonicalSurfaceDocumentV1(
        'x',
      ),
    );


  const token =
    graph.nodes.find(
      (node) =>
        node.type ===
          'token',
    );


  assert(
    token !==
      undefined,
    'surface token missing',
  );


  return {
    graph,
    token,
  };
}


function fixture(
  options: {
    labels?: string[];
    statuses?: GraphStatus[];
    alternativeStatus?:
      | 'open'
      | 'resolved'
      | 'blocked';
    resolvedIndices?: number[];
  } = {},
) {
  const base =
    baseGraph();

  const labels =
    options.labels ??
      [
        'noun',
        'adjective',
      ];

  const statuses =
    options.statuses ??
      labels.map(
        () =>
          'candidate' as const,
      );

  const alternativeStatus =
    options.alternativeStatus ??
      'open';

  const resolvedIndices =
    options.resolvedIndices ??
      [];


  assert(
    labels.length ===
      statuses.length,
    'fixture labels/status length mismatch',
  );


  const nodes:
    LanguageGraphNodeV1[] =
      [];

  const edges:
    LanguageGraphEdgeV1[] =
      [];


  labels.forEach(
    (
      label,
      index,
    ) => {
      const id =
        `pos:${index}`;


      nodes.push({
        id,

        type:
          'lexical_reading',

        subtype:
          'pos_candidate',

        status:
          statuses[index],

        span: {
          ...base.token.span,
        },

        features: {
          pos:
            label,
        },

        producer:
          'canonical_candidate_lattice_v1',

        evidenceIds:
          [],

        provenanceIds:
          [],
      });


      edges.push({
        id:
          `edge:pos:${index}`,

        relation:
          'pos_of',

        sourceId:
          id,

        targetId:
          base.token.id,

        status:
          statuses[index],

        features: {
          pos:
            label,
        },

        producer:
          'canonical_candidate_lattice_v1',

        evidenceIds:
          [],

        provenanceIds:
          [],
      });
    },
  );


  const memberIds =
    nodes.map(
      (node) =>
        node.id,
    );

  const resolvedMemberIds =
    resolvedIndices.map(
      (index) =>
        memberIds[index],
    );


  const graph:
    CanonicalLanguageGraphV1 = {
      ...base.graph,

      nodes: [
        ...base.graph.nodes,
        ...nodes,
      ],

      edges: [
        ...base.graph.edges,
        ...edges,
      ],

      alternativeSets:
        labels.length ===
            0
          ? []
          : [
              {
                id:
                  `alt:pos:${base.token.id}`,

                memberIds,

                resolvedMemberIds,

                status:
                  alternativeStatus,

                reason:
                  'fixture',
              },
            ],
    };


  const ownership:
    CanonicalPosFactOwnershipAuthorityResultV1 = {
      producer:
        'canonical_pos_fact_ownership_authority_v1',

      producerVersion:
        '1',

      status:
        'ready',

      authorities:
        labels.map(
          (
            label,
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
              label,

            posReadingGraphStatus:
              statuses[index],

            tokenNodeId:
              base.token.id,

            posOfEdgeId:
              `edge:pos:${index}`,

            posOfEdgeGraphStatus:
              statuses[index],

            contributingLexicalReadingIds: [
              `lex:${index}`,
            ],

            lexicalSupportEdgeIds: [
              `support:${index}`,
            ],

            lexicalSupportGraphStatuses: [
              'candidate' as const,
            ],

            alternativeSetId:
              `alt:pos:${base.token.id}`,

            alternativeSetStatus:
              alternativeStatus,

            alternativeMemberIds:
              [
                ...memberIds,
              ],

            resolvedMemberIds:
              [
                ...resolvedMemberIds,
              ],

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


  const capability =
    deriveCanonicalTokenPosPropertyCapabilityV1(
      ownership,
    );


  assert(
    capability.status ===
      'ready',
    'POS capability fixture failed',
  );


  return {
    graph,
    tokenId:
      base.token.id,
    ownership,
    capability,
  };
}




type GraphBoundArgs =
  Parameters<
    typeof deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1
  >;


function asRecord(
  value:
    unknown,
): Record<string, unknown> | undefined {
  return (
      typeof value ===
        'object' &&
      value !==
        null &&
      !Array.isArray(
        value,
      )
    )
    ? value as Record<string, unknown>
    : undefined;
}


function exactFixtureParts(
  source:
    unknown,
): {
  graph:
    GraphBoundArgs[0];

  tokenNodeId:
    GraphBoundArgs[1];

  ownership:
    GraphBoundArgs[2];

  capability:
    GraphBoundArgs[3];
} {
  const record =
    asRecord(
      source,
    );


  assert(
    record !==
      undefined,
    'fixture result is not an object',
  );


  const values =
    Object.values(
      record,
    );


  const graph =
    values.find(
      (value) =>
        asRecord(
          value,
        )?.version ===
          'canonical-language-graph-v1',
    ) as GraphBoundArgs[0] | undefined;


  // The reused A3.3.2d fixture owns the canonical token inside
  // its canonical graph. It is not required to expose that node as
  // a separate top-level fixture property.
  //
  // Read the exact canonical token occurrence from the fixture graph
  // itself, matching the ownership model used by A3.3.2d.
  const token =
    graph
      ?.nodes
      .find(
        (node) =>
          node.type ===
            'token',
      );


  const ownership =
    values.find(
      (value) =>
        asRecord(
          value,
        )?.producer ===
          'canonical_pos_fact_ownership_authority_v1',
    ) as GraphBoundArgs[2] | undefined;


  const capability =
    values.find(
      (value) =>
        asRecord(
          value,
        )?.producer ===
          'canonical_token_pos_property_capability_v1',
    ) as GraphBoundArgs[3] | undefined;


  assert(
    graph !==
      undefined,
    'fixture canonical graph missing',
  );


  const tokenRecord =
    asRecord(
      token,
    );


  assert(
    tokenRecord !==
      undefined &&
    typeof tokenRecord.id ===
      'string',
    'fixture token missing',
  );


  assert(
    ownership !==
      undefined,
    'fixture POS ownership result missing',
  );


  assert(
    capability !==
      undefined,
    'fixture token POS capability result missing',
  );


  return {
    graph,

    tokenNodeId:
      tokenRecord.id,

    ownership,

    capability,
  };
}


function runGraphBound(
  options:
    Parameters<typeof fixture>[0] = {},
) {
  const source =
    fixture(
      options,
    );

  const parts =
    exactFixtureParts(
      source,
    );


  const result =
    deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1(
      parts.graph,
      parts.tokenNodeId,
      parts.ownership,
      parts.capability,
    );


  return {
    ...parts,
    result,
  };
}


Deno.test(
  'v1.46 A3.3.4b.1: exact graph-bound A3.3.2d read becomes exact normalized projection',
  () => {
    const {
      graph,
      tokenNodeId,
      result,
    } =
      runGraphBound();


    assert(
      result.status ===
        'ready' &&
      result.graphDocumentId ===
        graph.documentId &&
      result.graphBoundProjection
        ?.tokenNodeId ===
        tokenNodeId &&
      result.graphBoundProjection
        ?.projection.tokenNodeId ===
        tokenNodeId,
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b.1: exact graph document identity is added without reconstructing normalized projection',
  () => {
    const {
      graph,
      result,
    } =
      runGraphBound();


    const bound =
      result.graphBoundProjection;


    assert(
      result.status ===
        'ready' &&
      bound
        ?.graphVersion ===
        'canonical-language-graph-v1' &&
      bound.graphDocumentId ===
        graph.documentId &&
      bound.governance
        .exactGraphDocumentIdentityPreserved ===
        true &&
      bound.governance
        .normalizedProjectionConsumedNotReconstructed ===
        true,
      'graph snapshot identity was not preserved',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b.1: source read identity remains exact through A3.3.4b projection',
  () => {
    const {
      result,
    } =
      runGraphBound();


    const bound =
      result.graphBoundProjection;


    assert(
      bound !==
        undefined,
      'graph-bound normalized projection missing',
    );


    assert(
      result.status ===
        'ready' &&
      bound.sourceReadId ===
        bound.projection.sourceReadId &&
      bound.normalizedProjectionId ===
        bound.projection.projectionId,
      'read/projection provenance identity diverged',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b.1: raw and normalized member labels are preserved from exact A3.3.4b output',
  () => {
    const {
      result,
    } =
      runGraphBound({
        labels: [
          'noun',
          'adjective',
        ],
      });


    const members =
      result.graphBoundProjection
        ?.projection.members ??
        [];


    assert(
      result.status ===
        'ready' &&
      members.length ===
        2 &&
      members.every(
        (member) =>
          typeof member.rawPosLabel ===
            'string' &&
          typeof member.normalizedPosLabel ===
            'string',
      ),
      'normalized member projection was lost',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b.1: open hypothesis-set identity and multiplicity remain unchanged',
  () => {
    const {
      result,
    } =
      runGraphBound({
        labels: [
          'noun',
          'adjective',
        ],

        alternativeStatus:
          'open',
      });


    const projection =
      result.graphBoundProjection
        ?.projection;


    assert(
      result.status ===
        'ready' &&
      projection
        ?.readState ===
        'open_hypothesis_set' &&
      projection.alternativeSetStatus ===
        'open' &&
      projection.members.length ===
        2,
      'open hypothesis set was collapsed or reclassified',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b.1: explicitly resolved member identities remain explicit and no winner is selected by wrapper',
  () => {
    const {
      result,
    } =
      runGraphBound({
        labels: [
          'noun',
          'adjective',
        ],

        statuses: [
          'resolved',
          'candidate',
        ],

        alternativeStatus:
          'resolved',

        resolvedIndices: [
          0,
        ],
      });


    const projection =
      result.graphBoundProjection
        ?.projection;


    assert(
      result.status ===
        'ready' &&
      projection
        ?.readState ===
        'explicit_resolved' &&
      projection.resolvedMemberIds.length ===
        1 &&
      result.graphBoundProjection
        ?.governance.posWinnerSelected ===
        false &&
      result.graphBoundProjection
        ?.governance.alternativeSetResolutionPerformed ===
        false,
      'wrapper changed explicit resolution state',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b.1: no POS fact remains explicit no_pos_fact graph-bound projection',
  () => {
    const {
      result,
    } =
      runGraphBound({
        labels:
          [],
      });


    const projection =
      result.graphBoundProjection
        ?.projection;


    assert(
      result.status ===
        'ready' &&
      projection
        ?.readState ===
        'no_pos_fact' &&
      projection.members.length ===
        0 &&
      projection.resolvedMemberIds.length ===
        0,
      'absence of POS facts was converted into another state',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b.1: blocked POS hypothesis set remains blocked and is not compared',
  () => {
    const {
      result,
    } =
      runGraphBound({
        labels: [
          'noun',
          'adjective',
        ],

        statuses: [
          'blocked',
          'rejected',
        ],

        alternativeStatus:
          'blocked',
      });


    const bound =
      result.graphBoundProjection;


    assert(
      result.status ===
        'ready' &&
      bound
        ?.projection.readState ===
        'blocked_hypothesis_set' &&
      bound.governance.comparisonPerformed ===
        false &&
      bound.governance.comparisonTruthResolved ===
        false,
      'blocked hypothesis set was not preserved exactly',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b.1: unexpected graph version blocks before graph-bound projection',
  () => {
    const source =
      fixture();

    const parts =
      exactFixtureParts(
        source,
      );


    const staleGraph = {
      ...parts.graph,

      version:
        'future-canonical-graph',
    } as unknown as GraphBoundArgs[0];


    const result =
      deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1(
        staleGraph,
        parts.tokenNodeId,
        parts.ownership,
        parts.capability,
      );


    assert(
      result.status ===
        'blocked' &&
      result.graphBoundProjection ===
        undefined,
      'unexpected graph version was consumed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.4b.1: deterministic wrapper performs no raw comparison Runtime WHERE domain cardinality binding propagation or graph mutation',
  () => {
    const a =
      runGraphBound();

    const b =
      runGraphBound();


    assert(
      JSON.stringify(
        a.result,
      ) ===
        JSON.stringify(
          b.result,
        ),
      'graph-bound projection is not deterministic',
    );


    const g =
      a.result.graphBoundProjection
        ?.governance;


    assert(
      g
        ?.exactCanonicalGraphInputRequired ===
        true &&

      g.exactGraphVersionRequired ===
        true &&

      g.exactGraphDocumentIdentityPreserved ===
        true &&

      g.exactTokenOccurrenceIdentityRequired ===
        true &&

      g.exactA332dReadRequired ===
        true &&

      g.a332dReadDerivedFromSameGraphInput ===
        true &&

      g.exactA334bProjectionRequired ===
        true &&

      g.a334bProjectionDerivedFromSameRead ===
        true &&

      g.normalizedProjectionConsumedNotReconstructed ===
        true &&

      g.tokenNodeIdentityPreserved ===
        true &&

      g.readIdentityPreserved ===
        true &&

      g.normalizationAuthorityPreserved ===
        true &&

      g.hypothesisSetStatePreserved ===
        true &&

      g.alternativeSetIdentityPreserved ===
        true &&

      g.alternativeSetStatusPreserved ===
        true &&

      g.memberIdentityPreserved ===
        true &&

      g.memberMultiplicityPreserved ===
        true &&

      g.memberGraphStatusesPreserved ===
        true &&

      g.resolvedMemberIdsPreserved ===
        true &&

      g.normalizedLabelsPreserved ===
        true &&

      g.rawComparisonAuthorityConsumed ===
        false &&

      g.runtimeWhereConsumed ===
        false &&

      g.runtimeBindingConsumed ===
        false &&

      g.runtimeSentenceDomainConsumed ===
        false &&

      g.runtimeExpectedOperandConsumed ===
        false &&

      g.comparisonPerformed ===
        false &&

      g.comparisonTruthResolved ===
        false &&

      g.posWinnerSelected ===
        false &&

      g.alternativeSetResolutionPerformed ===
        false &&

      g.currentRuntimeSentenceContextSelected ===
        false &&

      g.cardinalityEnforcementPerformed ===
        false &&

      g.occurrenceBindingPerformed ===
        false &&

      g.constraintPropagationInvoked ===
        false &&

      g.graphMutationPerformed ===
        false &&

      g.frozenGrammarReadOnly ===
        true,
      'A3.3.4b.1 crossed snapshot-projection boundary',
    );
  },
);