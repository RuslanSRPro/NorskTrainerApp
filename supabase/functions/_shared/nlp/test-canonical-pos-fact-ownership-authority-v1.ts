import {
  applyGraphPatchV1,
  createCanonicalLanguageGraphV1,
  type CanonicalLanguageGraphV1,
  type GraphPatchV1,
  type LanguageGraphEdgeV1,
  type LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import {
  buildCanonicalSurfaceDocumentV1,
} from './canonical-surface-boundary-v1.ts';

import {
  deriveCanonicalPosFactOwnershipAuthoritiesV1,
} from './canonical-pos-fact-ownership-authority-v1.ts';


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


function baseGraph(): CanonicalLanguageGraphV1 {
  return createCanonicalLanguageGraphV1(
    buildCanonicalSurfaceDocumentV1(
      'x',
    ),
  );
}


function token(
  graph:
    CanonicalLanguageGraphV1,
): LanguageGraphNodeV1 {
  const value =
    graph.nodes.find(
      (node) =>
        node.type ===
          'token',
    );


  assert(
    value !==
      undefined,
    'token missing',
  );


  return value;
}


function fixture(
  labels:
    string[] = [
      'noun',
    ],
): CanonicalLanguageGraphV1 {
  const graph =
    baseGraph();

  const t =
    token(
      graph,
    );


  const nodes:
    LanguageGraphNodeV1[] = [];

  const edges:
    LanguageGraphEdgeV1[] = [];

  const evidence:
    NonNullable<
      GraphPatchV1['evidence']
    > = [];

  const memberIds:
    string[] = [];


  labels.forEach(
    (
      label,
      index,
    ) => {
      const lexicalId =
        `lex:${index}`;

      const posId =
        `pos:${index}:${label}`;

      const lexicalEvidenceId =
        `e:lex:${index}`;

      const posEvidenceId =
        `e:pos:${index}`;


      nodes.push({
        id:
          lexicalId,

        type:
          'lexical_reading',

        subtype:
          'lexical_candidate',

        status:
          'candidate',

        span: {
          ...t.span,
        },

        features: {
          sourcePos:
            label,
        },

        producer:
          'canonical_candidate_lattice_v1',

        evidenceIds: [
          lexicalEvidenceId,
        ],

        provenanceIds: [
          'prov:fixture',
        ],
      });


      nodes.push({
        id:
          posId,

        type:
          'lexical_reading',

        subtype:
          'pos_candidate',

        status:
          'candidate',

        span: {
          ...t.span,
        },

        features: {
          pos:
            label,

          contributingLexicalReadingIds: [
            lexicalId,
          ],

          sourcePosIsEvidenceNotAuthority:
            true,
        },

        producer:
          'canonical_candidate_lattice_v1',

        evidenceIds: [
          posEvidenceId,
        ],

        provenanceIds: [
          'prov:fixture',
        ],
      });


      edges.push({
        id:
          `edge:lexical:${index}`,

        relation:
          'lexical_reading_of',

        sourceId:
          lexicalId,

        targetId:
          t.id,

        status:
          'candidate',

        features:
          {},

        producer:
          'canonical_candidate_lattice_v1',

        evidenceIds: [
          lexicalEvidenceId,
        ],

        provenanceIds: [
          'prov:fixture',
        ],
      });


      edges.push({
        id:
          `edge:pos:${index}`,

        relation:
          'pos_of',

        sourceId:
          posId,

        targetId:
          t.id,

        status:
          'candidate',

        features: {
          pos:
            label,
        },

        producer:
          'canonical_candidate_lattice_v1',

        evidenceIds: [
          posEvidenceId,
        ],

        provenanceIds: [
          'prov:fixture',
        ],
      });


      edges.push({
        id:
          `edge:support:${index}`,

        relation:
          'lexical_supports_pos',

        sourceId:
          lexicalId,

        targetId:
          posId,

        status:
          'candidate',

        features: {
          pos:
            label,
        },

        producer:
          'canonical_candidate_lattice_v1',

        evidenceIds: [
          posEvidenceId,
        ],

        provenanceIds: [
          'prov:fixture',
        ],
      });


      evidence.push(
        {
          id:
            lexicalEvidenceId,

          kind:
            'lexical',

          status:
            'supports',

          targetIds: [
            lexicalId,
            t.id,
          ],

          payload:
            {},

          producer:
            'canonical_candidate_lattice_v1',

          provenanceIds: [
            'prov:fixture',
          ],
        },
        {
          id:
            posEvidenceId,

          kind:
            'lexical',

          status:
            'supports',

          targetIds: [
            posId,
            lexicalId,
            t.id,
          ],

          payload: {
            pos:
              label,
          },

          producer:
            'canonical_candidate_lattice_v1',

          provenanceIds: [
            'prov:fixture',
          ],
        },
      );


      memberIds.push(
        posId,
      );
    },
  );


  const patch:
    GraphPatchV1 = {
      producer:
        'canonical_candidate_lattice_v1',

      producerVersion:
        '1',

      nodes,

      edges,

      evidence,

      provenance: [
        {
          id:
            'prov:fixture',

          sourceType:
            'system',

          sourceId:
            'fixture',
        },
      ],

      alternativeSets: [
        {
          id:
            `alt:pos:${t.id}`,

          memberIds,

          resolvedMemberIds:
            [],

          status:
            'open',

          reason:
            'awaiting_constraint_propagation',
        },
      ],
    };


  return applyGraphPatchV1(
    graph,
    patch,
  );
}


Deno.test(
  'v1.46 A3.3.2a: exact canonical POS-A fact yields ownership authority',
  () => {
    const result =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        fixture(),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        1 &&
      result.authorities[0]
        .model ===
        'POS-A',
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.2a: POS label is owned by pos_candidate features.pos',
  () => {
    const result =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        fixture([
          'adjective',
        ]),
      );


    assert(
      result.authorities[0]
        ?.posLabel ===
        'adjective' &&
      result.authorities[0]
        .governance
        .posLabelOwnedByNodeFeature ===
        true,
      'POS label ownership lost',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2a: occurrence ownership requires directed pos_candidate to token pos_of edge',
  () => {
    const source =
      fixture();

    const posEdge =
      source.edges.find(
        (edge) =>
          edge.relation ===
            'pos_of',
      );


    assert(
      posEdge !==
        undefined,
      'pos_of fixture missing',
    );


    const mutated:
      CanonicalLanguageGraphV1 = {
        ...source,

        edges:
          source.edges.map(
            (edge) =>
              edge.id ===
                posEdge.id
                ? {
                    ...edge,

                    sourceId:
                      posEdge.targetId,

                    targetId:
                      posEdge.sourceId,
                  }
                : edge,
          ),
      };


    const result =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        mutated,
      );


    assert(
      result.status ===
        'blocked',
      'reversed pos_of relation accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2a: lexical_supports_pos is support chain and not occurrence ownership',
  () => {
    const source =
      fixture();

    const result =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        source,
      );


    const authority =
      result.authorities[0];


    assert(
      authority !==
        undefined &&
      authority.lexicalSupportEdgeIds.length ===
        1 &&
      authority.governance
        .exactOccurrenceOwnershipUsesPosOfEdge ===
        true &&
      authority.governance
        .lexicalSupportDirection ===
        'lexical_candidate_to_pos_candidate',
      'support/ownership roles collapsed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2a: missing lexical support chain blocks ownership authority',
  () => {
    const source =
      fixture();


    const mutated:
      CanonicalLanguageGraphV1 = {
        ...source,

        edges:
          source.edges.filter(
            (edge) =>
              edge.relation !==
                'lexical_supports_pos',
          ),
      };


    const result =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        mutated,
      );


    assert(
      result.status ===
        'blocked',
      'POS fact without lexical support chain accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2a: multiple POS candidates for one token coexist in one open alternative domain',
  () => {
    const result =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        fixture([
          'noun',
          'adjective',
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        2 &&
      result.authorities.every(
        (authority) =>
          authority.alternativeMemberIds.length ===
            2 &&
          authority.alternativeSetStatus ===
            'open' &&
          authority.governance
            .multiplePosCandidatesMayCoexist ===
            true,
      ),
      'POS alternatives collapsed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2a: candidate status is preserved and never upgraded to resolved',
  () => {
    const result =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        fixture(),
      );


    const authority =
      result.authorities[0];


    assert(
      authority
        ?.posReadingGraphStatus ===
        'candidate' &&
      authority.governance
        .candidateDoesNotMeanResolved ===
        true &&
      authority.governance
        .resolvedAlternativeWinnerNotInferred ===
        true &&
      authority.resolvedMemberIds.length ===
        0,
      'candidate POS was upgraded',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2a: compatibility subtype pos is not promoted into current POS ownership model',
  () => {
    const source =
      fixture();


    const current =
      source.nodes.find(
        (node) =>
          node.subtype ===
            'pos_candidate',
      );


    assert(
      current !==
        undefined,
      'POS fixture missing',
    );


    const compatibilityNode:
      LanguageGraphNodeV1 = {
        ...current,

        id:
          'compatibility-pos',

        subtype:
          'pos',
      };


    const mutated:
      CanonicalLanguageGraphV1 = {
        ...source,

        nodes: [
          ...source.nodes,
          compatibilityNode,
        ],
      };


    const result =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        mutated,
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        1 &&
      result.authorities.every(
        (authority) =>
          authority.posReadingNodeId !==
            'compatibility-pos' &&
          authority.governance
            .compatibilitySubtypePosPromoted ===
            false,
      ),
      'compatibility subtype was promoted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2a: mismatched POS label between node and pos_of edge blocks',
  () => {
    const source =
      fixture();


    const mutated:
      CanonicalLanguageGraphV1 = {
        ...source,

        edges:
          source.edges.map(
            (edge) =>
              edge.relation ===
                'pos_of'
                ? {
                    ...edge,

                    features: {
                      ...edge.features,

                      pos:
                        'different-pos',
                    },
                  }
                : edge,
          ),
      };


    const result =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        mutated,
      );


    assert(
      result.status ===
        'blocked',
      'POS label mismatch accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.2a: deterministic ownership performs no Runtime suffix where winner binding or dependency execution',
  () => {
    const source =
      fixture([
        'noun',
        'adjective',
      ]);


    const x =
      deriveCanonicalPosFactOwnershipAuthoritiesV1(
        source,
      );


    const y =
      deriveCanonicalPosFactOwnershipAuthoritiesV1({
        ...source,

        nodes: [
          ...source.nodes,
        ].reverse(),

        edges: [
          ...source.edges,
        ].reverse(),

        alternativeSets: [
          ...source.alternativeSets,
        ].reverse(),
      });


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'POS ownership authority not deterministic',
    );


    assert(
      x.authorities.every(
        (authority) => {
          const g =
            authority.governance;


          return (
            g.runtimePosSuffixMapped ===
              false &&
            g.whereOperatorSemanticsResolved ===
              false &&
            g.whereEqExecuted ===
              false &&
            g.referenceValueResolved ===
              false &&
            g.rawSurfaceSpellingRead ===
              false &&
            g.firstCandidateWins ===
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
              false
          );
        },
      ),
      'A3.3.2a crossed POS ownership boundary',
    );
  },
);