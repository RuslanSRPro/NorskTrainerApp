import {
  applyGraphPatchV1,
  assertCanonicalLanguageGraphV1,
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
  bindCanonicalPredicateSenseSourceRolesToOccurrencesV1,
} from './canonical-predicate-sense-occurrence-binding-v1.ts';

import {
  buildCanonicalPredicateSenseCandidateLatticePatchV1,
} from './canonical-predicate-sense-candidate-lattice-v1.ts';

import type {
  CanonicalPredicateSenseSourceRoleProjectionV1,
} from './canonical-predicate-sense-source-role-adapter-v1.ts';


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


const SOURCE_CODE =
  'source.test.role.structure';


function projection(
  memberRef:
    string,

  sense:
    string,
): CanonicalPredicateSenseSourceRoleProjectionV1 {
  return {
    projectionId:
      `projection:${memberRef}:${sense}`,

    sourceCandidateId:
      'source-id:test',

    sourceCandidateCode:
      SOURCE_CODE,

    sourceSection:
      '7.test',

    modelType:
      'construction_compatibility',

    modelSubtype:
      'test_structure',

    executionRole:
      'construction',

    roleField:
      `${memberRef}_role`,

    memberRef,

    sense,

    sourceCandidateCodes: [
      SOURCE_CODE,
    ],

    sourceSections: [
      '7.test',
    ],

    evidenceKind:
      'source_rule',

    projectionPolicy:
      'source_role_candidate_support_only',

    frozenGrammarReadOnly:
      true,
  };
}


function buildGraph(
  options: {
    sourceCode?: string;

    constructionStatus?:
      | 'candidate'
      | 'resolved'
      | 'ambiguous'
      | 'blocked'
      | 'rejected';

    memberEdgeStatus?:
      | 'candidate'
      | 'resolved'
      | 'ambiguous'
      | 'blocked'
      | 'rejected';

    memberNodeStatus?:
      | 'candidate'
      | 'resolved'
      | 'ambiguous'
      | 'blocked'
      | 'rejected';

    constructionSuffix?: string;
  } = {},
): {
  graph:
    CanonicalLanguageGraphV1;

  headTokenId:
    string;

  otherTokenId:
    string;

  predicateId:
    string;

  constructionId:
    string;
} {
  const surface =
    buildCanonicalSurfaceDocumentV1(
      'x y',
    );

  let graph =
    createCanonicalLanguageGraphV1(
      surface,
    );

  const tokens =
    graph.nodes
      .filter(
        (node) =>
          node.type ===
            'token',
      )
      .sort(
        (a, b) =>
          (
            Number(
              a.features
                .sentenceTokenIndex ??
                0,
            ) -
            Number(
              b.features
                .sentenceTokenIndex ??
                0,
            )
          ),
      );

  assert(
    tokens.length >= 2,
    'fixture tokens missing',
  );

  const head =
    tokens[0];

  const other =
    tokens[1];

  const suffix =
    options
      .constructionSuffix ??
      '0';

  const predicateId =
    'predicate:test:0';

  const constructionId =
    `construction:test:${suffix}`;

  const headMemberId =
    `morph:test:head:${suffix}`;

  const otherMemberId =
    `morph:test:other:${suffix}`;

  const evidenceId =
    `evidence:test:structure:${suffix}`;

  const provenanceId =
    `prov:test:structure:${suffix}`;

  const headMember:
    LanguageGraphNodeV1 = {
    id:
      headMemberId,

    type:
      'morph_reading',

    subtype:
      'verb',

    status:
      options.memberNodeStatus ??
        'candidate',

    span:
      head.span
        ? { ...head.span }
        : undefined,

    features: {
      canonicalFeatures: {
        Test:
          'Head',
      },
    },

    producer:
      'test',

    evidenceIds: [
      evidenceId,
    ],

    provenanceIds: [
      provenanceId,
    ],
  };

  const otherMember:
    LanguageGraphNodeV1 = {
    id:
      otherMemberId,

    type:
      'morph_reading',

    subtype:
      'verb',

    status:
      'candidate',

    span:
      other.span
        ? { ...other.span }
        : undefined,

    features: {
      canonicalFeatures: {
        Test:
          'Other',
      },
    },

    producer:
      'test',

    evidenceIds: [
      evidenceId,
    ],

    provenanceIds: [
      provenanceId,
    ],
  };

  const predicate:
    LanguageGraphNodeV1 = {
    id:
      predicateId,

    type:
      'predicate',

    subtype:
      'predicate',

    status:
      'candidate',

    span:
      head.span
        ? { ...head.span }
        : undefined,

    features: {
      role:
        'predicate',

      sentenceIndex:
        head.features
          .sentenceIndex,

      anchorHeadId:
        head.id,

      realizedByPhraseId:
        'phrase:test:vp',
    },

    producer:
      'canonical_predicate_candidate_lattice_v1',

    evidenceIds: [
      evidenceId,
    ],

    provenanceIds: [
      provenanceId,
    ],
  };

  const construction:
    LanguageGraphNodeV1 = {
    id:
      constructionId,

    type:
      'construction',

    subtype:
      'test_structure',

    status:
      options
        .constructionStatus ??
        'candidate',

    span: {
      startTokenId:
        head.id,

      endTokenId:
        other.id,

      tokenIds: [
        head.id,
        other.id,
      ],
    },

    features: {
      sentenceIndex:
        head.features
          .sentenceIndex,

      sourceCandidateCodes: [
        options.sourceCode ??
          SOURCE_CODE,
      ],

      memberTokenIds: [
        head.id,
        other.id,
      ],
    },

    producer:
      'canonical_construction_candidate_lattice_v1',

    evidenceIds: [
      evidenceId,
    ],

    provenanceIds: [
      provenanceId,
    ],
  };

  const edges:
    LanguageGraphEdgeV1[] = [
      {
        id:
          `edge:test:slot-a:${suffix}`,

        relation:
          'construction_member_of',

        sourceId:
          headMember.id,

        targetId:
          construction.id,

        status:
          options
            .memberEdgeStatus ??
            'candidate',

        features: {
          roleRef:
            'slot_a',

          memberTokenId:
            head.id,
        },

        producer:
          'canonical_construction_candidate_lattice_v1',

        evidenceIds: [
          evidenceId,
        ],

        provenanceIds: [
          provenanceId,
        ],
      },

      {
        id:
          `edge:test:slot-b:${suffix}`,

        relation:
          'construction_member_of',

        sourceId:
          otherMember.id,

        targetId:
          construction.id,

        status:
          'candidate',

        features: {
          roleRef:
            'slot_b',

          memberTokenId:
            other.id,
        },

        producer:
          'canonical_construction_candidate_lattice_v1',

        evidenceIds: [
          evidenceId,
        ],

        provenanceIds: [
          provenanceId,
        ],
      },
    ];

  const patch:
    GraphPatchV1 = {
    producer:
      'test',

    producerVersion:
      '1',

    nodes: [
      headMember,
      otherMember,
      predicate,
      construction,
    ],

    edges,

    evidence: [{
      id:
        evidenceId,

      kind:
        'structural',

      status:
        'supports',

      targetIds: [
        headMember.id,
        otherMember.id,
        predicate.id,
        construction.id,
        ...edges.map(
          (edge) =>
            edge.id,
        ),
      ],

      payload: {
        fixture:
          true,
      },

      producer:
        'test',

      provenanceIds: [
        provenanceId,
      ],
    }],

    provenance: [{
      id:
        provenanceId,

      sourceType:
        'system',

      sourceId:
        'test',
    }],
  };

  graph =
    applyGraphPatchV1(
      graph,
      patch,
    );

  return {
    graph,

    headTokenId:
      head.id,

    otherTokenId:
      other.id,

    predicateId,

    constructionId,
  };
}


Deno.test(
  'v1.44 predicate sense A2.2: exact construction member bound to predicate head creates evidence fact',
  () => {
    const fixture =
      buildGraph();

    const result =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        fixture.graph,
        [
          projection(
            'slot_a',
            'sense_a',
          ),
        ],
      );

    assert(
      result.evidenceFacts.length ===
        1,
      `facts=${result.evidenceFacts.length}`,
    );

    const fact =
      result.evidenceFacts[0];

    assert(
      fact.predicateId ===
        fixture.predicateId,
      `predicate=${fact.predicateId}`,
    );

    assert(
      fact.headTokenId ===
        fixture.headTokenId,
      `head=${fact.headTokenId}`,
    );

    assert(
      fact.sense ===
        'sense_a',
      `sense=${fact.sense}`,
    );

    assert(
      fact.evidenceKind ===
        'construction',
      `kind=${fact.evidenceKind}`,
    );

    assert(
      fact.status ===
        'candidate',
      'occurrence evidence resolved sense',
    );

    assert(
      fact.payload
        ?.exactPredicateHeadBinding ===
        true,
      'exact head binding marker missing',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.2: non-head construction member does not become sense evidence for finite predicate occurrence',
  () => {
    const fixture =
      buildGraph();

    const result =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        fixture.graph,
        [
          projection(
            'slot_b',
            'sense_b',
          ),
        ],
      );

    assert(
      result.evidenceFacts.length ===
        0,
      'non-head member leaked into predicate sense',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.2: source candidate identity must match construction provenance',
  () => {
    const fixture =
      buildGraph({
        sourceCode:
          'source.other.structure',
      });

    const result =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        fixture.graph,
        [
          projection(
            'slot_a',
            'sense_a',
          ),
        ],
      );

    assert(
      result.evidenceFacts.length ===
        0,
      'source role projection attached to unrelated construction',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.2: roleRef must match exact frozen member role',
  () => {
    const fixture =
      buildGraph();

    const result =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        fixture.graph,
        [
          projection(
            'slot_missing',
            'sense_a',
          ),
        ],
      );

    assert(
      result.evidenceFacts.length ===
        0,
      'binder guessed an unmatched construction role',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.2: blocked or rejected structural facts cannot create sense evidence',
  () => {
    for (
      const constructionStatus of
        [
          'blocked',
          'rejected',
        ] as const
    ) {
      const fixture =
        buildGraph({
          constructionStatus,
        });

      const result =
        bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
          fixture.graph,
          [
            projection(
              'slot_a',
              'sense_a',
            ),
          ],
        );

      assert(
        result.evidenceFacts.length ===
          0,
        `${constructionStatus} construction generated evidence`,
      );
    }

    for (
      const memberEdgeStatus of
        [
          'blocked',
          'rejected',
        ] as const
    ) {
      const fixture =
        buildGraph({
          memberEdgeStatus,
        });

      const result =
        bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
          fixture.graph,
          [
            projection(
              'slot_a',
              'sense_a',
            ),
          ],
        );

      assert(
        result.evidenceFacts.length ===
          0,
        `${memberEdgeStatus} member edge generated evidence`,
      );
    }

    for (
      const memberNodeStatus of
        [
          'blocked',
          'rejected',
        ] as const
    ) {
      const fixture =
        buildGraph({
          memberNodeStatus,
        });

      const result =
        bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
          fixture.graph,
          [
            projection(
              'slot_a',
              'sense_a',
            ),
          ],
        );

      assert(
        result.evidenceFacts.length ===
          0,
        `${memberNodeStatus} member candidate generated evidence`,
      );
    }
  },
);


Deno.test(
  'v1.44 predicate sense A2.2: evidence cannot jump from another token occurrence',
  () => {
    const fixture =
      buildGraph();

    const badEdge =
      fixture.graph.edges.find(
        (edge) =>
          edge.relation ===
            'construction_member_of' &&
          edge.features.roleRef ===
            'slot_a',
      );

    assert(
      badEdge,
      'fixture member edge missing',
    );

    badEdge.features.memberTokenId =
      fixture.otherTokenId;

    const result =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        fixture.graph,
        [
          projection(
            'slot_a',
            'sense_a',
          ),
        ],
      );

    assert(
      result.evidenceFacts.length ===
        0,
      'sense evidence leaked across token occurrence',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.2: multiple structural alternatives preserve evidence multiplicity but A1 coalesces semantic candidate',
  () => {
    const first =
      buildGraph({
        constructionSuffix:
          'a',
      });

    const second =
      buildGraph({
        constructionSuffix:
          'b',
      });

    let graph =
      first.graph;

    const secondConstruction =
      second.graph.nodes
        .filter(
          (node) =>
            node.type ===
              'construction' ||
            node.type ===
              'morph_reading',
        );

    const secondEdges =
      second.graph.edges
        .filter(
          (edge) =>
            edge.relation ===
              'construction_member_of',
        );

    const secondEvidence =
      second.graph.evidence
        .filter(
          (item) =>
            item.producer ===
              'test',
        );

    const secondProvenance =
      second.graph.provenance
        .filter(
          (item) =>
            item.sourceId ===
              'test',
        );

    graph =
      applyGraphPatchV1(
        graph,
        {
          producer:
            'test',

          producerVersion:
            '1',

          nodes:
            secondConstruction,

          edges:
            secondEdges,

          evidence:
            secondEvidence,

          provenance:
            secondProvenance,
        },
      );

    const bound =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        graph,
        [
          projection(
            'slot_a',
            'sense_a',
          ),
        ],
      );

    assert(
      bound.evidenceFacts.length ===
        2,
      `occurrence evidence=${bound.evidenceFacts.length}`,
    );

    const sensePatch =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph,
        bound.evidenceFacts,
      );

    const senses =
      (sensePatch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'semantic_unit' &&
            node.subtype ===
              'predicate_sense',
        );

    assert(
      senses.length ===
        1,
      `semantic candidates=${senses.length}`,
    );

    assert(
      (
        senses[0].features
          .supportFactIds as string[]
      ).length ===
        2,
      'structural support multiplicity was lost',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.2: structural resolution never auto-resolves predicate sense evidence',
  () => {
    const fixture =
      buildGraph({
        constructionStatus:
          'resolved',

        memberEdgeStatus:
          'resolved',

        memberNodeStatus:
          'resolved',
      });

    const result =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        fixture.graph,
        [
          projection(
            'slot_a',
            'sense_a',
          ),
        ],
      );

    assert(
      result.evidenceFacts.length ===
        1,
      `facts=${result.evidenceFacts.length}`,
    );

    assert(
      result.evidenceFacts[0]
        .status ===
        'candidate',
      'resolved structure auto-resolved semantic evidence',
    );

    assert(
      result.evidenceFacts[0]
        .payload
        ?.candidateSupportOnly ===
        true,
      'candidate-only contract missing',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.2: binding and downstream sense graph stay deterministic and invariant-safe',
  () => {
    const fixture =
      buildGraph();

    const projections = [
      projection(
        'slot_a',
        'sense_a',
      ),

      projection(
        'slot_b',
        'sense_b',
      ),
    ];

    const a =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        fixture.graph,
        projections,
      );

    const b =
      bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
        fixture.graph,
        projections,
      );

    assert(
      JSON.stringify(a) ===
        JSON.stringify(b),
      'occurrence binding is not deterministic',
    );

    const sensePatch =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        fixture.graph,
        a.evidenceFacts,
      );

    const graph =
      applyGraphPatchV1(
        fixture.graph,
        sensePatch,
      );

    const errors =
      assertCanonicalLanguageGraphV1(
        graph,
      );

    assert(
      errors.length ===
        0,
      `graph invariant errors: ${errors.join(', ')}`,
    );
  },
);