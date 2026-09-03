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
  buildCanonicalPredicateProjectionFromSnapshotV1,
} from './canonical-predicate-projection-adapter-v1.ts';

import {
  buildCanonicalPredicateCandidateLatticePatchV1,
  summarizeCanonicalPredicateCandidateLatticePatchV1,
} from './canonical-predicate-candidate-lattice-v1.ts';

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


// Exact relevant fields from the live
// canonical_predicate_projection_snapshot_v1()
// verified after migration 20260903173000.
//
// Clause scope / compiler metadata are deliberately absent.
const LIVE_PREDICATE_SNAPSHOT = {
  plane:
    'build_control',

  version:
    'canonical-predicate-projection-snapshot-v1',

  read_only:
    true,

  write_performed:
    false,

  frozen_grammar_immutable:
    true,

  historical_rule_interpretation_only:
    true,

  source: {
    status:
      'source_verified',

    candidate_id:
      'd8123246-3111-4e3b-b669-0f7c5b692f69',

    candidate_code:
      'sentence.predicate.definition_verb_phrase',

    source_section:
      '8.1',

    requires_human_verification:
      false,

    extracted_payload: {
      details: {
        predicate_form:
          'verb_phrase',

        sentence_components: [
          'subject',
          'predicate',
        ],

        predicate_is_syntactic_unit:
          true,

        subject_plus_predicate_head_constituent:
          false,
      },

      candidate_code:
        'sentence.predicate.definition_verb_phrase',

      semantic_block:
        'predicate.definition_structure',

      source_section:
        '8.1',

      cross_references: [
        '1.5.1',
      ],
    },

    execution_contract: {
      audit: {
        version:
          1,

        disposition:
          'KEEP_GRAMMAR_RUNTIME',
      },

      execution: {
        role:
          'predicate_structure',

        consumed_by: [
          'clause_builder',
          'predicate_builder',
          'constituency_analysis',
          'error_analysis',
          'virtual_teacher',
          'language_graph',
        ],
      },

      placement: {
        target_layers: [
          'runtime',
        ],
      },
    },
  },

  manifest_projection: {
    manifest_id:
      '3fca7626-945c-478f-98ec-beff66c67872',

    manifest_code:
      'ir.structural.predicate.verb_phrase',

    primary_candidate_id:
      'd8123246-3111-4e3b-b669-0f7c5b692f69',

    primary_candidate_code:
      'sentence.predicate.definition_verb_phrase',

    runtime_family:
      'clause',

    execution_phase:
      'predicate_build',

    execution_mode:
      'deterministic',

    constraint_strength:
      'categorical',

    authoring_status:
      'validated',

    actions: [{
      value: {
        role:
          'predicate',
      },

      action:
        'set_role',

      target:
        'vp',

      reason_code:
        'nrg_predicate_is_verb_phrase',
    }],
  },

  rule_projection: {
    rule_id:
      '2adb73ce-f327-4a1a-8a72-0b6979ac8241',

    rule_code:
      'nrg_rt_v1.structural.predicate.verb_phrase',

    runtime_manifest_id:
      '3fca7626-945c-478f-98ec-beff66c67872',

    pattern_type:
      'graph_pattern',

    rule_type:
      'construction',

    is_active:
      false,

    pattern: {
      role:
        'predicate',

      bindings: {
        vp: {
          scope:
            'sentence',

          entity:
            'phrase',

          cardinality:
            'one_or_more',

          where: {
            op:
              'eq',

            left: {
              ref:
                'vp.type',
            },

            right:
              'VP',
          },
        },
      },

      condition: {
        op:
          'exists',

        left: {
          ref:
            'vp.head',
        },
      },

      target_ref:
        'vp',

      manifest_code:
        'ir.structural.predicate.verb_phrase',

      graph_operation:
        'assign_role',

      runtime_ir_version:
        '1.0',
    },

    actions: [{
      value: {
        role:
          'predicate',
      },

      action:
        'set_role',

      target:
        'vp',

      reason_code:
        'nrg_predicate_is_verb_phrase',
    }],
  },

  excluded_historical_fields: [
    'scope',
    'priority',
    'base_confidence',
    'compiler_version',
    'compile_hash',
    'legacy_predicate_builder',
    'clause_structure',
    'valency',
    'arguments',
  ],
} as const;


function canonicalGraph(
  text = 'skriver',
): CanonicalLanguageGraphV1 {
  const surface =
    buildCanonicalSurfaceDocumentV1(
      text,
    );

  return createCanonicalLanguageGraphV1(
    surface,
  );
}


function firstToken(
  graph: CanonicalLanguageGraphV1,
): LanguageGraphNodeV1 {
  const token =
    graph.nodes.find(
      (node) =>
        node.type ===
          'token',
    );

  if (!token) {
    throw new Error(
      'token missing',
    );
  }

  return token;
}


function vpPatch(
  graph: CanonicalLanguageGraphV1,
  options: {
    id?: string;
    subtype?: string;
    status?:
      | 'candidate'
      | 'resolved'
      | 'ambiguous'
      | 'rejected'
      | 'blocked';
    includeHeadEdge?: boolean;
    headTokenFeature?: boolean;
    suffix?: string;
  } = {},
): GraphPatchV1 {
  const token =
    firstToken(graph);

  const suffix =
    options.suffix ??
      '0';

  const vpId =
    options.id ??
      `phrase:test:vp:${suffix}`;

  const evidenceId =
    `evidence:${vpId}`;

  const phrase:
    LanguageGraphNodeV1 = {
    id:
      vpId,

    type:
      'phrase',

    subtype:
      options.subtype ??
        'VP',

    status:
      options.status ??
        'candidate',

    span: {
      ...token.span,
    },

    features: {
      phraseType:
        options.subtype ??
          'VP',

      sentenceIndex:
        token.features.sentenceIndex,

      ...(options.headTokenFeature ===
          false
        ? {}
        : {
            headTokenId:
              token.id,
          }),

      candidateGeneration:
        'test_upstream_phrase',
    },

    producer:
      'canonical_phrase_candidate_lattice_v1',

    evidenceIds: [
      evidenceId,
    ],

    provenanceIds: [
      'prov:test:vp',
    ],
  };

  const edges:
    LanguageGraphEdgeV1[] =
      options.includeHeadEdge ===
          false
        ? []
        : [{
            id:
              `edge:head_of:${token.id}:${vpId}`,

            relation:
              'head_of',

            sourceId:
              token.id,

            targetId:
              vpId,

            status:
              'candidate',

            features: {},

            producer:
              'canonical_phrase_candidate_lattice_v1',

            evidenceIds: [
              evidenceId,
            ],

            provenanceIds: [
              'prov:test:vp',
            ],
          }];

  return {
    producer:
      'canonical_phrase_candidate_lattice_v1',

    producerVersion:
      '1',

    nodes: [
      phrase,
    ],

    edges,

    evidence: [{
      id:
        evidenceId,

      kind:
        'source_rule',

      status:
        'supports',

      targetIds: [
        phrase.id,
        ...edges.map(
          (edge) =>
            edge.id,
        ),
      ],

      payload: {
        test:
          true,
      },

      producer:
        'canonical_phrase_candidate_lattice_v1',

      provenanceIds: [
        'prov:test:vp',
      ],
    }],

    provenance: [{
      id:
        'prov:test:vp',

      sourceType:
        'system',

      sourceId:
        'test',
    }],
  };
}


function withPatch(
  graph: CanonicalLanguageGraphV1,
  patch: GraphPatchV1,
): CanonicalLanguageGraphV1 {
  return applyGraphPatchV1(
    graph,
    patch,
  );
}


function liveProjection() {
  const result =
    buildCanonicalPredicateProjectionFromSnapshotV1(
      LIVE_PREDICATE_SNAPSHOT,
    );

  assert(
    result.status ===
      'ready' &&
      result.projection,
    result.blockingReasons.join(', '),
  );

  return result.projection;
}


Deno.test(
  'v1.44 predicate A4.1: exact live snapshot derives VP -> predicate projection without clause scope',
  () => {
    const result =
      buildCanonicalPredicateProjectionFromSnapshotV1(
        LIVE_PREDICATE_SNAPSHOT,
      );

    assert(
      result.status ===
        'ready' &&
        result.projection,
      result.blockingReasons.join(', '),
    );

    const projection =
      result.projection;

    assert(
      projection.inputBindingRef ===
        'vp',
      `binding=${projection.inputBindingRef}`,
    );

    assert(
      projection.inputPhraseType ===
        'VP',
      `phraseType=${projection.inputPhraseType}`,
    );

    assert(
      projection.role ===
        'predicate',
      `role=${projection.role}`,
    );

    assert(
      projection.requireHead ===
        true,
      'head requirement missing',
    );

    assert(
      projection.graphOperation ===
        'assign_role',
      `operation=${projection.graphOperation}`,
    );

    assert(
      result.governance
        .clauseScopeConsumed ===
        false,
      'clause scope leaked',
    );

    assert(
      result.governance
        .historicalRuleActivated ===
        false,
      'historical rule activated',
    );
  },
);


Deno.test(
  'v1.44 predicate A4.1: canonical VP plus canonical head_of creates candidate predicate',
  () => {
    let graph =
      canonicalGraph();

    graph =
      withPatch(
        graph,
        vpPatch(graph),
      );

    const patch =
      buildCanonicalPredicateCandidateLatticePatchV1(
        graph,
        [
          liveProjection(),
        ],
      );

    const summary =
      summarizeCanonicalPredicateCandidateLatticePatchV1(
        patch,
      );

    assert(
      summary.predicateNodes ===
        1,
      `predicates=${summary.predicateNodes}`,
    );

    assert(
      summary.realizationEdges ===
        1,
      `realizationEdges=${summary.realizationEdges}`,
    );

    assert(
      summary.resolvedFacts ===
        0,
      `resolved=${summary.resolvedFacts}`,
    );

    const predicate =
      (patch.nodes ?? [])
        .find(
          (node) =>
            node.type ===
              'predicate',
        );

    assert(
      predicate?.status ===
        'candidate',
      'predicate auto-resolved',
    );

    assert(
      predicate?.features
        .realizationType ===
        'VP',
      'VP realization missing',
    );

    assert(
      predicate?.features
        .clauseScopeConsumed ===
        false,
      'clause scope leaked into predicate fact',
    );

    const edge =
      (patch.edges ?? [])
        .find(
          (item) =>
            item.relation ===
              'predicate_realized_by',
        );

    assert(
      edge?.sourceId ===
        predicate?.id,
      'predicate realization edge source mismatch',
    );

    assert(
      edge?.targetId ===
        predicate?.features
          .realizedByPhraseId,
      'predicate realization edge target mismatch',
    );

    assert(
      (patch.alternativeSets ?? [])
        .some(
          (set) =>
            set.memberIds.includes(
              predicate!.id,
            ) &&
            set.status ===
              'open',
        ),
      'predicate alternative set must remain open',
    );
  },
);


Deno.test(
  'v1.44 predicate A4.1: vp.head is mapped to canonical head_of, not a feature-only guess',
  () => {
    let graph =
      canonicalGraph();

    graph =
      withPatch(
        graph,
        vpPatch(
          graph,
          {
            includeHeadEdge:
              false,

            headTokenFeature:
              true,
          },
        ),
      );

    const patch =
      buildCanonicalPredicateCandidateLatticePatchV1(
        graph,
        [
          liveProjection(),
        ],
      );

    assert(
      (patch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'predicate',
        )
        .length === 0,
      'feature-only VP head was incorrectly treated as canonical head evidence',
    );
  },
);


Deno.test(
  'v1.44 predicate A4.1: non-VP phrase is ignored',
  () => {
    let graph =
      canonicalGraph();

    graph =
      withPatch(
        graph,
        vpPatch(
          graph,
          {
            subtype:
              'NP',
          },
        ),
      );

    const patch =
      buildCanonicalPredicateCandidateLatticePatchV1(
        graph,
        [
          liveProjection(),
        ],
      );

    assert(
      (patch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'predicate',
        )
        .length === 0,
      'non-VP phrase generated predicate',
    );
  },
);


Deno.test(
  'v1.44 predicate A4.1: rejected and blocked VP candidates are ignored',
  () => {
    for (
      const status of
        ['rejected', 'blocked'] as const
    ) {
      let graph =
        canonicalGraph();

      graph =
        withPatch(
          graph,
          vpPatch(
            graph,
            {
              status,
            },
          ),
        );

      const patch =
        buildCanonicalPredicateCandidateLatticePatchV1(
          graph,
          [
            liveProjection(),
          ],
        );

      assert(
        (patch.nodes ?? [])
          .filter(
            (node) =>
              node.type ===
                'predicate',
          )
          .length === 0,
        `${status} VP generated predicate`,
      );
    }
  },
);


Deno.test(
  'v1.44 predicate A4.1: VP alternatives sharing one head remain predicate alternatives',
  () => {
    let graph =
      canonicalGraph();

    graph =
      withPatch(
        graph,
        vpPatch(
          graph,
          {
            suffix:
              'a',
          },
        ),
      );

    graph =
      withPatch(
        graph,
        vpPatch(
          graph,
          {
            suffix:
              'b',
          },
        ),
      );

    const patch =
      buildCanonicalPredicateCandidateLatticePatchV1(
        graph,
        [
          liveProjection(),
        ],
      );

    const predicates =
      (patch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'predicate',
        );

    assert(
      predicates.length ===
        2,
      `predicates=${predicates.length}`,
    );

    const alt =
      (patch.alternativeSets ?? [])
        .find(
          (set) =>
            set.memberIds.length ===
              2,
        );

    assert(
      alt?.status ===
        'open',
      'shared-head predicate alternatives not preserved',
    );
  },
);


Deno.test(
  'v1.44 predicate A4.1: producer does not cross ownership into clause, valency or predicate sense',
  () => {
    let graph =
      canonicalGraph();

    graph =
      withPatch(
        graph,
        vpPatch(graph),
      );

    const patch =
      buildCanonicalPredicateCandidateLatticePatchV1(
        graph,
        [
          liveProjection(),
        ],
      );

    assert(
      !(patch.nodes ?? [])
        .some(
          (node) =>
            node.type ===
              'clause' ||
            node.type ===
              'construction',
        ),
      'predicate producer created foreign node family',
    );

    const serialized =
      JSON.stringify(patch);

    for (
      const forbidden of [
        '"arguments"',
        '"valency"',
        '"subject"',
        '"lexical_main"',
        '"auxiliary"',
        '"copular"',
        '"copular_like"',
        '"TAM"',
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
  'v1.44 predicate A4.1: contradictory frozen projection blocks instead of guessing',
  () => {
    const broken = {
      ...LIVE_PREDICATE_SNAPSHOT,

      rule_projection: {
        ...LIVE_PREDICATE_SNAPSHOT
          .rule_projection,

        pattern: {
          ...LIVE_PREDICATE_SNAPSHOT
            .rule_projection
            .pattern,

          role:
            'something_else',
        },
      },
    };

    const result =
      buildCanonicalPredicateProjectionFromSnapshotV1(
        broken,
      );

    assert(
      result.status ===
        'blocked',
      'contradictory predicate projection was accepted',
    );

    assert(
      result.blockingReasons.includes(
        'projection:manifest_pattern_role_disagreement',
      ),
      result.blockingReasons.join(', '),
    );
  },
);


Deno.test(
  'v1.44 predicate A4.1: graph invariants and determinism stay green',
  () => {
    let graph0 =
      canonicalGraph();

    graph0 =
      withPatch(
        graph0,
        vpPatch(graph0),
      );

    const projection =
      liveProjection();

    const a =
      buildCanonicalPredicateCandidateLatticePatchV1(
        graph0,
        [
          projection,
        ],
      );

    const b =
      buildCanonicalPredicateCandidateLatticePatchV1(
        graph0,
        [
          projection,
        ],
      );

    assert(
      JSON.stringify(a) ===
        JSON.stringify(b),
      'predicate patch is not deterministic',
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
      errors.length ===
        0,
      `graph invariant errors: ${errors.join(', ')}`,
    );
  },
);