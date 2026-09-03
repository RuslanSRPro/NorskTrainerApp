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
  buildCanonicalPredicateSenseCandidateLatticePatchV1,
  summarizeCanonicalPredicateSenseCandidateLatticePatchV1,
  type CanonicalPredicateSenseEvidenceFactV1,
} from './canonical-predicate-sense-candidate-lattice-v1.ts';


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


function baseGraph(
  text = 'har',
): CanonicalLanguageGraphV1 {
  return createCanonicalLanguageGraphV1(
    buildCanonicalSurfaceDocumentV1(
      text,
    ),
  );
}


function token(
  graph: CanonicalLanguageGraphV1,
): LanguageGraphNodeV1 {
  const node =
    graph.nodes.find(
      (item) =>
        item.type ===
          'token',
    );

  if (!node) {
    throw new Error(
      'token missing',
    );
  }

  return node;
}


function predicatePatch(
  graph: CanonicalLanguageGraphV1,
  options: {
    status?:
      | 'candidate'
      | 'resolved'
      | 'ambiguous'
      | 'blocked'
      | 'rejected';

    id?: string;
  } = {},
): GraphPatchV1 {
  const head =
    token(graph);

  const predicateId =
    options.id ??
      'predicate:test:0';

  const evidenceId =
    `evidence:${predicateId}`;

  const predicate:
    LanguageGraphNodeV1 = {
    id:
      predicateId,

    type:
      'predicate',

    subtype:
      'predicate',

    status:
      options.status ??
        'candidate',

    span:
      head.span
        ? { ...head.span }
        : undefined,

    features: {
      role:
        'predicate',

      sentenceIndex:
        head.features.sentenceIndex,

      anchorHeadId:
        head.id,

      realizedByPhraseId:
        'phrase:test:vp',

      candidateGeneration:
        'test_structural_predicate',
    },

    producer:
      'canonical_predicate_candidate_lattice_v1',

    evidenceIds: [
      evidenceId,
    ],

    provenanceIds: [
      'prov:test:predicate',
    ],
  };

  return {
    producer:
      'canonical_predicate_candidate_lattice_v1',

    producerVersion:
      '1',

    nodes: [
      predicate,
    ],

    evidence: [{
      id:
        evidenceId,

      kind:
        'source_rule',

      status:
        'supports',

      targetIds: [
        predicate.id,
      ],

      payload: {
        test:
          true,
      },

      producer:
        'canonical_predicate_candidate_lattice_v1',

      provenanceIds: [
        'prov:test:predicate',
      ],
    }],

    provenance: [{
      id:
        'prov:test:predicate',

      sourceType:
        'system',

      sourceId:
        'test',
    }],
  };
}


function graphWithPredicate(
  text = 'har',
): CanonicalLanguageGraphV1 {
  let graph =
    baseGraph(text);

  graph =
    applyGraphPatchV1(
      graph,
      predicatePatch(graph),
    );

  return graph;
}


function fact(
  graph: CanonicalLanguageGraphV1,
  sense: string,
  overrides:
    Partial<CanonicalPredicateSenseEvidenceFactV1> = {},
): CanonicalPredicateSenseEvidenceFactV1 {
  const predicate =
    graph.nodes.find(
      (node) =>
        node.type ===
          'predicate',
    );

  if (!predicate) {
    throw new Error(
      'predicate missing',
    );
  }

  const headTokenId =
    String(
      predicate.features.anchorHeadId,
    );

  return {
    id:
      `sense-evidence:${sense}`,

    predicateId:
      predicate.id,

    headTokenId,

    sense,

    evidenceKind:
      'lexical_class',

    status:
      'candidate',

    sourceIds: [
      `lexical-class:test:${sense}`,
    ],

    provenanceIds: [
      'prov:test:sense',
    ],

    ...overrides,
  };
}


Deno.test(
  'v1.44 predicate sense A1: source-backed evidence creates semantic_unit candidate linked by sense_of',
  () => {
    const graph =
      graphWithPredicate();

    const patch =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph,
        [
          fact(
            graph,
            'auxiliary',
          ),
        ],
      );

    const summary =
      summarizeCanonicalPredicateSenseCandidateLatticePatchV1(
        patch,
      );

    assert(
      summary.senseNodes ===
        1,
      `senseNodes=${summary.senseNodes}`,
    );

    assert(
      summary.senseEdges ===
        1,
      `senseEdges=${summary.senseEdges}`,
    );

    assert(
      summary.resolvedFacts ===
        0,
      `resolved=${summary.resolvedFacts}`,
    );

    const node =
      (patch.nodes ?? [])[0];

    assert(
      node?.type ===
        'semantic_unit',
      'sense must use semantic_unit',
    );

    assert(
      node?.subtype ===
        'predicate_sense',
      `subtype=${node?.subtype}`,
    );

    assert(
      node?.features.sense ===
        'auxiliary',
      `sense=${node?.features.sense}`,
    );

    assert(
      node?.status ===
        'candidate',
      'sense auto-resolved',
    );

    const edge =
      (patch.edges ?? [])[0];

    assert(
      edge?.relation ===
        'sense_of',
      `relation=${edge?.relation}`,
    );
  },
);


Deno.test(
  'v1.44 predicate sense A1: auxiliary and copular evidence coexist for one occurrence',
  () => {
    const graph =
      graphWithPredicate(
        'blir',
      );

    const patch =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph,
        [
          fact(
            graph,
            'auxiliary',
            {
              id:
                'evidence:aux',

              sourceIds: [
                'lexical_class:auxiliary_bli',
              ],
            },
          ),

          fact(
            graph,
            'copular',
            {
              id:
                'evidence:cop',

              sourceIds: [
                'lexical_class:copula',
              ],
            },
          ),
        ],
      );

    const senses =
      (patch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'semantic_unit',
        )
        .map(
          (node) =>
            node.features.sense,
        )
        .sort();

    assert(
      JSON.stringify(senses) ===
        JSON.stringify([
          'auxiliary',
          'copular',
        ]),
      `senses=${JSON.stringify(senses)}`,
    );

    const alt =
      (patch.alternativeSets ?? [])[0];

    assert(
      alt?.memberIds.length ===
        2,
      `members=${alt?.memberIds.length}`,
    );

    assert(
      alt?.status ===
        'open',
      'sense alternatives resolved prematurely',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A1: multiple evidence facts for same sense coalesce into one candidate',
  () => {
    const graph =
      graphWithPredicate();

    const patch =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph,
        [
          fact(
            graph,
            'auxiliary',
            {
              id:
                'evidence:lexical',

              evidenceKind:
                'lexical_class',

              sourceIds: [
                'lexical_class:auxiliary_ha',
              ],
            },
          ),

          fact(
            graph,
            'auxiliary',
            {
              id:
                'evidence:construction',

              evidenceKind:
                'construction',

              sourceCandidateCodes: [
                'test.compound.structure',
              ],

              sourceIds: [
                'construction:test:0',
              ],
            },
          ),
        ],
      );

    assert(
      (patch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'semantic_unit',
        )
        .length ===
        1,
      'same sense generated duplicate semantic units',
    );

    assert(
      (patch.evidence ?? [])
        .length ===
        2,
      `support evidence=${patch.evidence?.length}`,
    );

    const node =
      (patch.nodes ?? [])[0];

    assert(
      Array.isArray(
        node.features.supportFactIds,
      ) &&
      (
        node.features.supportFactIds as string[]
      ).length === 2,
      'support facts not preserved',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A1: singleton alternative remains open and candidate-only',
  () => {
    const graph =
      graphWithPredicate();

    const patch =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph,
        [
          fact(
            graph,
            'auxiliary',
          ),
        ],
      );

    const alt =
      (patch.alternativeSets ?? [])[0];

    assert(
      alt?.memberIds.length ===
        1,
      'expected singleton alternative',
    );

    assert(
      alt?.status ===
        'open',
      'singleton sense auto-resolved',
    );

    assert(
      alt?.resolvedMemberIds.length ===
        0,
      'singleton alternative has resolved member',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A1: evidence cannot leak across predicate occurrences or heads',
  () => {
    const graph =
      graphWithPredicate();

    const predicate =
      graph.nodes.find(
        (node) =>
          node.type ===
            'predicate',
      )!;

    const patchWrongPredicate =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph,
        [
          fact(
            graph,
            'auxiliary',
            {
              predicateId:
                'predicate:other',
            },
          ),
        ],
      );

    assert(
      (patchWrongPredicate.nodes ?? [])
        .length === 0,
      'evidence leaked to another predicate',
    );

    const patchWrongHead =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph,
        [
          fact(
            graph,
            'auxiliary',
            {
              predicateId:
                predicate.id,

              headTokenId:
                'token:other',
            },
          ),
        ],
      );

    assert(
      (patchWrongHead.nodes ?? [])
        .length === 0,
      'evidence leaked across head occurrence',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A1: rejected and blocked predicates or evidence are ignored',
  () => {
    for (
      const predicateStatus of
        ['rejected', 'blocked'] as const
    ) {
      let graph =
        baseGraph();

      graph =
        applyGraphPatchV1(
          graph,
          predicatePatch(
            graph,
            {
              status:
                predicateStatus,
            },
          ),
        );

      const patch =
        buildCanonicalPredicateSenseCandidateLatticePatchV1(
          graph,
          [
            fact(
              graph,
              'auxiliary',
            ),
          ],
        );

      assert(
        (patch.nodes ?? [])
          .length === 0,
        `${predicateStatus} predicate generated sense`,
      );
    }

    const graph =
      graphWithPredicate();

    for (
      const evidenceStatus of
        ['rejected', 'blocked'] as const
    ) {
      const patch =
        buildCanonicalPredicateSenseCandidateLatticePatchV1(
          graph,
          [
            fact(
              graph,
              'auxiliary',
              {
                status:
                  evidenceStatus,
              },
            ),
          ],
        );

      assert(
        (patch.nodes ?? [])
          .length === 0,
        `${evidenceStatus} evidence generated sense`,
      );
    }
  },
);


Deno.test(
  'v1.44 predicate sense A1: lexical_main is never inferred from absence of auxiliary evidence',
  () => {
    const graph =
      graphWithPredicate();

    const patch =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph,
        [],
      );

    assert(
      (patch.nodes ?? [])
        .length === 0,
      'absence of evidence generated a default sense',
    );

    assert(
      (patch.alternativeSets ?? [])
        .length === 0,
      'empty evidence generated an alternative set',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A1: producer stays outside clause, valency, TAM and sense resolution',
  () => {
    const graph =
      graphWithPredicate();

    const patch =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph,
        [
          fact(
            graph,
            'auxiliary',
          ),
        ],
      );

    assert(
      !(patch.nodes ?? [])
        .some(
          (node) =>
            node.type ===
              'clause' ||
            node.type ===
              'predicate' ||
            node.type ===
              'construction',
        ),
      'sense producer crossed node-family ownership',
    );

    const serialized =
      JSON.stringify(patch);

    for (
      const forbidden of [
        '"valency"',
        '"arguments"',
        '"subject"',
        '"TAM"',
        '"tenseProfile"',
        '"resolvedSense"',
      ]
    ) {
      assert(
        !serialized.includes(
          forbidden,
        ),
        `ownership leak: ${forbidden}`,
      );
    }
  },
);


Deno.test(
  'v1.44 predicate sense A1: graph invariants and determinism stay green',
  () => {
    const graph0 =
      graphWithPredicate();

    const evidenceFacts = [
      fact(
        graph0,
        'auxiliary',
      ),

      fact(
        graph0,
        'copular',
        {
          id:
            'sense-evidence:copular',

          sourceIds: [
            'lexical_class:copula',
          ],
        },
      ),
    ];

    const a =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph0,
        evidenceFacts,
      );

    const b =
      buildCanonicalPredicateSenseCandidateLatticePatchV1(
        graph0,
        evidenceFacts,
      );

    assert(
      JSON.stringify(a) ===
        JSON.stringify(b),
      'sense patch is not deterministic',
    );

    const graph =
      applyGraphPatchV1(
        graph0,
        a,
      );

    const errors =
      assertCanonicalLanguageGraphV1(
        graph,
      );

    assert(
      errors.length === 0,
      `graph invariant errors: ${errors.join(', ')}`,
    );
  },
);