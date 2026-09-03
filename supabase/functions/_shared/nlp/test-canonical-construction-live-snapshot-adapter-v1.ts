import {
  buildCanonicalSurfaceDocumentV1,
} from './canonical-surface-boundary-v1.ts';

import {
  applyGraphPatchV1,
  createCanonicalLanguageGraphV1,
  type CanonicalLanguageGraphV1,
  type GraphPatchV1,
  type LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import {
  buildCanonicalConstructionCandidateLatticePatchV1,
} from './canonical-construction-candidate-lattice-v1.ts';

import {
  buildCanonicalConstructionProjectionBatchFromSnapshotV1,
} from './canonical-construction-projection-adapter-v1.ts';

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


// Exact structural snapshot of the live v1.44 A3 result.
//
// It intentionally retains:
// - all 4 frozen scoped candidates;
// - both frozen morphology reference facts;
// - all live verb token-form registry rows returned by the snapshot;
// - blocked scoped-template governance.
//
// This is a snapshot test, NOT a second grammar definition.
const LIVE_SNAPSHOT = {
  plane: 'build_control',

  safety: {
    grammar_mutation_allowed: false,
    production_activation_performed: false,
    manifest_materialization_performed: false,
    grammar_rule_materialization_performed: false,
  },

  version:
    'canonical-construction-projection-snapshot-v1',

  template: {
    rule_type: null,
    model_type:
      'construction_compatibility',

    pattern_type: null,

    template_code:
      'construction.aux_nonfinite_core.v1',

    execution_role:
      'construction',

    approval_status:
      'blocked',

    candidate_codes: [
      'verb.auxiliary.complement.nonfinite_main',
      'verb.compound_form.finite_aux_nonfinite_main',
      'verb.compound_form.finite_nonfinite.structure',
      'verb.infinitive.bare_after_auxiliary',
    ],

    builder_contract: null,

    capability_status:
      'blocked',

    semantic_category: null,

    required_capabilities: [
      'generic_construction_schema_operator',
    ],
  },

  read_only: true,

  write_performed: false,

  frozen_grammar_immutable: true,

  candidates: [
    {
      status: 'source_verified',

      candidate_id:
        '831b4913-3e78-4490-9011-302db0a016b2',

      candidate_code:
        'verb.auxiliary.complement.nonfinite_main',

      source_section:
        '7.2.1',

      extracted_payload: {
        language: 'no',

        head_role:
          'auxiliary',

        candidate_code:
          'verb.auxiliary.complement.nonfinite_main',

        semantic_block:
          'verb.auxiliary.complement',

        source_section:
          '7.2.1',

        complement_role:
          'main_verb',

        allowed_complement_forms: [
          'infinitive',
          'past_participle',
        ],
      },

      digital_model: {
        model: {
          type:
            'construction_compatibility',

          subtype:
            'auxiliary_nonfinite_main_complement',

          version: 1,
        },
      },

      execution_contract: {
        audit: {
          version: 1,
          disposition:
            'KEEP_GRAMMAR_RUNTIME',
        },

        execution: {
          role:
            'construction',

          consumed_by: [
            'construction_resolution',
            'predicate_builder',
          ],
        },

        placement: {
          target_layers: [
            'runtime',
          ],
        },
      },

      requires_human_verification:
        false,
    },

    {
      status: 'source_verified',

      candidate_id:
        'fd5b9c73-6f64-4ca0-901f-ffa0cfe5f8ed',

      candidate_code:
        'verb.compound_form.finite_aux_nonfinite_main',

      source_section:
        '7.2',

      extracted_payload: {
        language: 'no',

        finite_role:
          'auxiliary',

        construction:
          'compound_verbal_form',

        candidate_code:
          'verb.compound_form.finite_aux_nonfinite_main',

        nonfinite_role:
          'main_verb',

        semantic_block:
          'verb.compound_form',

        source_section:
          '7.2',
      },

      digital_model: {
        model: {
          type:
            'construction_compatibility',

          subtype:
            'finite_auxiliary_nonfinite_main_verb',

          version: 1,
        },
      },

      execution_contract: {
        audit: {
          version: 1,
          disposition:
            'KEEP_GRAMMAR_RUNTIME',
        },

        execution: {
          role:
            'construction',

          consumed_by: [
            'construction_resolution',
            'predicate_builder',
          ],
        },

        placement: {
          target_layers: [
            'runtime',
          ],
        },
      },

      requires_human_verification:
        false,
    },

    {
      status: 'source_verified',

      candidate_id:
        'cf83ec1a-6862-4290-a1ec-491c1e18d667',

      candidate_code:
        'verb.compound_form.finite_nonfinite.structure',

      source_section:
        '7.2',

      extracted_payload: {
        language: 'no',

        construction:
          'compound_verbal_form',

        candidate_code:
          'verb.compound_form.finite_nonfinite.structure',

        semantic_block:
          'verb.compound_form.finite_nonfinite',

        source_section:
          '7.2',
      },

      digital_model: {
        model: {
          type:
            'construction_compatibility',

          subtype:
            'finite_nonfinite_compound_structure',

          version: 1,
        },
      },

      execution_contract: {
        audit: {
          version: 1,
          disposition:
            'KEEP_GRAMMAR_RUNTIME',
        },

        execution: {
          role:
            'construction',

          consumed_by: [
            'construction_resolution',
            'predicate_builder',
          ],
        },

        placement: {
          target_layers: [
            'runtime',
          ],
        },
      },

      requires_human_verification:
        false,
    },

    {
      status: 'source_verified',

      candidate_id:
        '15acaeb7-7178-4991-8b2b-e80be1ec057a',

      candidate_code:
        'verb.infinitive.bare_after_auxiliary',

      source_section:
        '7.1.2.2.1',

      extracted_payload: {
        marker:
          'absent',

        language:
          'no',

        governors: [
          'selected_auxiliary',
        ],

        candidate_code:
          'verb.infinitive.bare_after_auxiliary',

        semantic_block:
          'verb.infinitive',

        source_section:
          '7.1.2.2.1',

        future_rule_family:
          'auxiliary.bare_infinitive',
      },

      digital_model: {
        model: {
          type:
            'construction_compatibility',

          subtype:
            'bare_infinitive_after_auxiliary',

          version: 1,
        },
      },

      execution_contract: {
        audit: {
          version: 1,
          disposition:
            'KEEP_GRAMMAR_RUNTIME',
        },

        execution: {
          role:
            'construction',

          consumed_by: [
            'construction_resolution',
          ],
        },

        placement: {
          target_layers: [
            'runtime',
          ],
        },
      },

      requires_human_verification:
        false,
    },
  ],

  reference_facts: [
    {
      status:
        'source_verified',

      candidate_id:
        '9655ab7a-dacf-4a39-a942-df2b9f1e63a1',

      candidate_code:
        'verb.form.finite.inventory',

      source_section:
        '7.1.2',

      extracted_payload: {
        language:
          'no',

        form_types: [
          'present',
          'past',
          'imperative',
        ],

        candidate_code:
          'verb.form.finite.inventory',

        semantic_block:
          'verb.form.finite',

        source_section:
          '7.1.2',

        future_rule_family:
          'verb.form.finite.identify',
      },

      digital_model: {
        model: {
          type:
            'morphological_classification',

          subtype:
            'finite_form_inventory',

          version:
            1,
        },
      },

      execution_contract: {
        audit: {
          version: 1,

          disposition:
            'KEEP_REFERENCE_ONLY',
        },

        execution: {
          role:
            'morphology_reference',

          consumed_by: [],
        },

        placement: {
          target_layers: [
            'grammar_reference',
          ],
        },
      },

      requires_human_verification:
        false,
    },

    {
      status:
        'source_verified',

      candidate_id:
        '9eb36805-2d3b-40a9-816e-59cc8278780e',

      candidate_code:
        'verb.form.nonfinite.inventory',

      source_section:
        '7.1.2',

      extracted_payload: {
        language:
          'no',

        form_types: [
          'infinitive',
          'past_participle',
        ],

        candidate_code:
          'verb.form.nonfinite.inventory',

        semantic_block:
          'verb.form.nonfinite',

        source_section:
          '7.1.2',

        future_rule_family:
          'verb.form.nonfinite.identify',
      },

      digital_model: {
        model: {
          type:
            'morphological_classification',

          subtype:
            'nonfinite_form_inventory',

          version:
            1,
        },
      },

      execution_contract: {
        audit: {
          version: 1,

          disposition:
            'KEEP_REFERENCE_ONLY',
        },

        execution: {
          role:
            'morphology_reference',

          consumed_by: [],
        },

        placement: {
          target_layers: [
            'grammar_reference',
          ],
        },
      },

      requires_human_verification:
        false,
    },
  ],

  morph_registry: [
    {
      pos: 'verb',
      form_key:
        'adjectival_past_participle_common',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Tense: 'Past',
        Gender: 'Com',
        Number: 'Sing',
        Definite: 'Ind',
        VerbForm: 'Part',
      },
    },

    {
      pos: 'verb',
      form_key:
        'adjectival_past_participle_definite',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Tense: 'Past',
        Definite: 'Def',
        VerbForm: 'Part',
      },
    },

    {
      pos: 'verb',
      form_key:
        'adjectival_past_participle_neuter',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Tense: 'Past',
        Gender: 'Neut',
        Number: 'Sing',
        Definite: 'Ind',
        VerbForm: 'Part',
      },
    },

    {
      pos: 'verb',
      form_key:
        'adjectival_past_participle_plural',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Tense: 'Past',
        Number: 'Plur',
        VerbForm: 'Part',
      },
    },

    {
      pos: 'verb',
      form_key: 'imperative',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Mood: 'Imp',
        VerbForm: 'Fin',
      },
    },

    {
      pos: 'verb',
      form_key: 'infinitive',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        VerbForm: 'Inf',
      },
    },

    {
      pos: 'verb',
      form_key:
        'infinitive_passive',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Voice: 'Pass',
        VerbForm: 'Inf',
      },
    },

    {
      pos: 'verb',
      form_key: 'past',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Tense: 'Past',
        VerbForm: 'Fin',
      },
    },

    {
      pos: 'verb',
      form_key:
        'past_participle',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Tense: 'Past',
        VerbForm: 'Part',
      },
    },

    {
      pos: 'verb',
      form_key: 'present',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Tense: 'Pres',
        VerbForm: 'Fin',
      },
    },

    {
      pos: 'verb',
      form_key:
        'present_participle',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Tense: 'Pres',
        VerbForm: 'Part',
      },
    },

    {
      pos: 'verb',
      form_key:
        'present_passive',
      form_scope: 'token',
      provenance_policy:
        'lexeme_form_variants.source_verified',

      canonical_features: {
        Tense: 'Pres',
        Voice: 'Pass',
        VerbForm: 'Fin',
      },
    },
  ],
} as const;


const CONFIG = {
  finiteInventoryCode:
    'verb.form.finite.inventory',

  nonfiniteInventoryCode:
    'verb.form.nonfinite.inventory',
};


function readyLiveProjections() {
  const batch =
    buildCanonicalConstructionProjectionBatchFromSnapshotV1(
      LIVE_SNAPSHOT,
      CONFIG,
    );

  assert(
    batch.projectionState ===
      'partially_projectable',
    `unexpected projection state=${batch.projectionState}`,
  );

  return batch.candidates.flatMap(
    (candidate) =>
      candidate.status === 'ready'
        ? candidate.projections
        : [],
  );
}


function tokenBySurface(
  graph: CanonicalLanguageGraphV1,
  surface: string,
): LanguageGraphNodeV1 {
  const node =
    graph.nodes.find(
      (candidate) =>
        candidate.type === 'token' &&
        candidate.features.surface === surface,
    );

  if (!node) {
    throw new Error(
      `token missing: ${surface}`,
    );
  }

  return node;
}


function graphWithLiveMorphReadings(
  text: string,
  rows: Array<{
    surface: string;
    features: Record<string, unknown>;
  }>,
): CanonicalLanguageGraphV1 {
  const surface =
    buildCanonicalSurfaceDocumentV1(text);

  let graph =
    createCanonicalLanguageGraphV1(
      surface,
    );

  const nodes:
    LanguageGraphNodeV1[] =
      rows.map((row, index) => {
        const token =
          tokenBySurface(
            graph,
            row.surface,
          );

        const id =
          `morph:live-a32:${index}:${token.id}`;

        return {
          id,

          type: 'morph_reading',

          subtype: 'verb',

          status: 'candidate',

          span: {
            ...token.span,
          },

          features: {
            pos: 'verb',

            canonicalFeatures: {
              ...row.features,
            },
          },

          producer:
            'canonical_candidate_lattice_v1',

          evidenceIds: [
            `evidence:${id}`,
          ],

          provenanceIds: [
            'prov:live-a32:morph',
          ],
        };
      });

  const patch: GraphPatchV1 = {
    producer:
      'canonical_candidate_lattice_v1',

    producerVersion:
      '1',

    nodes,

    evidence:
      nodes.map((node) => ({
        id:
          node.evidenceIds[0],

        kind:
          'morphological',

        status:
          'supports',

        targetIds: [
          node.id,
        ],

        payload: {
          liveSnapshotIntegration:
            true,
        },

        producer:
          'canonical_candidate_lattice_v1',

        provenanceIds: [
          'prov:live-a32:morph',
        ],
      })),

    provenance: [{
      id:
        'prov:live-a32:morph',

      sourceType:
        'system',

      sourceId:
        'live-snapshot-a3.2-test',
    }],
  };

  graph =
    applyGraphPatchV1(
      graph,
      patch,
    );

  return graph;
}


Deno.test(
  'v1.44 construction A3.1: exact live frozen snapshot is partially projectable',
  () => {
    const result =
      buildCanonicalConstructionProjectionBatchFromSnapshotV1(
        LIVE_SNAPSHOT,
        CONFIG,
      );

    assert(
      result.projectionState ===
        'partially_projectable',
      `state=${result.projectionState}`,
    );

    assert(
      result.candidateCount === 4,
      `candidateCount=${result.candidateCount}`,
    );

    assert(
      result.readyCandidateCount === 1,
      `ready=${result.readyCandidateCount}`,
    );

    assert(
      result.blockedCandidateCount === 3,
      `blocked=${result.blockedCandidateCount}`,
    );
  },
);


Deno.test(
  'v1.44 construction A3.1: finite_aux_nonfinite source is the only currently projectable source',
  () => {
    const result =
      buildCanonicalConstructionProjectionBatchFromSnapshotV1(
        LIVE_SNAPSHOT,
        CONFIG,
      );

    const ready =
      result.candidates.filter(
        (candidate) =>
          candidate.status === 'ready',
      );

    assert(
      ready.length === 1,
      `ready=${ready.length}`,
    );

    assert(
      ready[0].candidateCode ===
        'verb.compound_form.finite_aux_nonfinite_main',
      `ready source=${ready[0].candidateCode}`,
    );

    assert(
      ready[0].projections.length === 2,
      `projections=${ready[0].projections.length}`,
    );
  },
);


Deno.test(
  'v1.44 construction A3.1: generic finite_nonfinite source blocks instead of acquiring invented roles',
  () => {
    const result =
      buildCanonicalConstructionProjectionBatchFromSnapshotV1(
        LIVE_SNAPSHOT,
        CONFIG,
      );

    const candidate =
      result.candidates.find(
        (item) =>
          item.candidateCode ===
            'verb.compound_form.finite_nonfinite.structure',
      );

    assert(
      candidate?.status === 'blocked',
      'generic structure unexpectedly projected',
    );

    assert(
      candidate.blockingReasons.includes(
        'verb.compound_form.finite_nonfinite.structure:finite_role_missing',
      ),
      candidate.blockingReasons.join(', '),
    );

    assert(
      candidate.blockingReasons.includes(
        'verb.compound_form.finite_nonfinite.structure:nonfinite_role_missing',
      ),
      candidate.blockingReasons.join(', '),
    );
  },
);


Deno.test(
  'v1.44 construction A3.1: auxiliary complement schema remains blocked until its own generic schema adapter exists',
  () => {
    const result =
      buildCanonicalConstructionProjectionBatchFromSnapshotV1(
        LIVE_SNAPSHOT,
        CONFIG,
      );

    const candidate =
      result.candidates.find(
        (item) =>
          item.candidateCode ===
            'verb.auxiliary.complement.nonfinite_main',
      );

    assert(
      candidate?.status === 'blocked',
      'head/complement schema was silently coerced',
    );

    assert(
      candidate.blockingReasons.some(
        (reason) =>
          reason.endsWith(
            ':construction_type_missing',
          ),
      ),
      candidate.blockingReasons.join(', '),
    );

    assert(
      candidate.blockingReasons.some(
        (reason) =>
          reason.endsWith(
            ':finite_role_missing',
          ),
      ),
      candidate.blockingReasons.join(', '),
    );

    assert(
      candidate.blockingReasons.some(
        (reason) =>
          reason.endsWith(
            ':nonfinite_role_missing',
          ),
      ),
      candidate.blockingReasons.join(', '),
    );
  },
);


Deno.test(
  'v1.44 construction A3.1: bare infinitive specialization remains blocked rather than broadened to nonfinite inventory',
  () => {
    const result =
      buildCanonicalConstructionProjectionBatchFromSnapshotV1(
        LIVE_SNAPSHOT,
        CONFIG,
      );

    const candidate =
      result.candidates.find(
        (item) =>
          item.candidateCode ===
            'verb.infinitive.bare_after_auxiliary',
      );

    assert(
      candidate?.status === 'blocked',
      'bare infinitive source was over-generalized',
    );

    assert(
      candidate.projections.length === 0,
      'blocked specialization emitted projections',
    );
  },
);


Deno.test(
  'v1.44 construction A3.1: snapshot normalization never changes materialization governance',
  () => {
    const result =
      buildCanonicalConstructionProjectionBatchFromSnapshotV1(
        LIVE_SNAPSHOT,
        CONFIG,
      );

    assert(
      LIVE_SNAPSHOT.template.capability_status ===
        'blocked',
      'fixture governance drifted',
    );

    assert(
      LIVE_SNAPSHOT.template.approval_status ===
        'blocked',
      'fixture approval drifted',
    );

    assert(
      result.governance
        .grammarMutationPerformed === false,
      'grammar mutation reported',
    );

    assert(
      result.governance
        .manifestMaterializationPerformed === false,
      'manifest materialization reported',
    );

    assert(
      result.governance
        .grammarRuleMaterializationPerformed === false,
      'grammar rule materialization reported',
    );
  },
);


Deno.test(
  'v1.44 construction A3.1: unsafe snapshot is blocked globally',
  () => {
    const unsafe = {
      ...LIVE_SNAPSHOT,
      read_only: false,
    };

    const result =
      buildCanonicalConstructionProjectionBatchFromSnapshotV1(
        unsafe,
        CONFIG,
      );

    assert(
      result.projectionState ===
        'blocked',
      `state=${result.projectionState}`,
    );

    assert(
      result.readyCandidateCount === 0,
      `ready=${result.readyCandidateCount}`,
    );

    assert(
      result.blockingReasons.includes(
        'snapshot:not_read_only',
      ),
      result.blockingReasons.join(', '),
    );
  },
);


Deno.test(
  'v1.44 construction A3.2: exact live READY projection executes Inf and past-participle branches',
  () => {
    const projections =
      readyLiveProjections();

    assert(
      projections.length === 2,
      `live projections=${projections.length}`,
    );

    const cases = [
      {
        text:
          'har skrive',

        rows: [
          {
            surface:
              'har',

            features: {
              VerbForm:
                'Fin',

              Tense:
                'Pres',
            },
          },

          {
            surface:
              'skrive',

            features: {
              VerbForm:
                'Inf',
            },
          },
        ],
      },

      {
        text:
          'har skrevet',

        rows: [
          {
            surface:
              'har',

            features: {
              VerbForm:
                'Fin',

              Tense:
                'Pres',
            },
          },

          {
            surface:
              'skrevet',

            features: {
              VerbForm:
                'Part',

              Tense:
                'Past',
            },
          },
        ],
      },
    ];

    for (const testCase of cases) {
      const graph =
        graphWithLiveMorphReadings(
          testCase.text,
          testCase.rows,
        );

      const patch =
        buildCanonicalConstructionCandidateLatticePatchV1(
          graph,
          projections,
        );

      const constructions =
        (patch.nodes ?? [])
          .filter(
            (node) =>
              node.type ===
                'construction',
          );

      assert(
        constructions.length === 1,
        `${testCase.text}: constructions=${constructions.length}`,
      );

      const construction =
        constructions[0];

      assert(
        construction.status ===
          'candidate',
        `${testCase.text}: construction resolved prematurely`,
      );

      assert(
        construction.subtype ===
          'compound_verbal_form',
        `${testCase.text}: subtype=${construction.subtype}`,
      );

      const sourceCodes =
        construction.features
          .sourceCandidateCodes as string[];

      assert(
        sourceCodes.includes(
          'verb.compound_form.finite_aux_nonfinite_main',
        ),
        `${testCase.text}: structural source provenance missing`,
      );

      assert(
        sourceCodes.includes(
          'verb.form.finite.inventory',
        ),
        `${testCase.text}: finite inventory provenance missing`,
      );

      assert(
        sourceCodes.includes(
          'verb.form.nonfinite.inventory',
        ),
        `${testCase.text}: nonfinite inventory provenance missing`,
      );
    }
  },
);


Deno.test(
  'v1.44 construction A3.2: exact live projection still excludes present participle',
  () => {
    const graph =
      graphWithLiveMorphReadings(
        'har skrivende',
        [
          {
            surface:
              'har',

            features: {
              VerbForm:
                'Fin',

              Tense:
                'Pres',
            },
          },

          {
            surface:
              'skrivende',

            features: {
              VerbForm:
                'Part',

              Tense:
                'Pres',
            },
          },
        ],
      );

    const patch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph,
        readyLiveProjections(),
      );

    assert(
      (patch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'construction',
        )
        .length === 0,
      'live projection accepted present participle',
    );
  },
);


Deno.test(
  'v1.44 construction A3.2: exact live projection contains no hidden word-order rule',
  () => {
    const graph =
      graphWithLiveMorphReadings(
        'skrive har',
        [
          {
            surface:
              'skrive',

            features: {
              VerbForm:
                'Inf',
            },
          },

          {
            surface:
              'har',

            features: {
              VerbForm:
                'Fin',

              Tense:
                'Pres',
            },
          },
        ],
      );

    const patch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph,
        readyLiveProjections(),
      );

    const constructions =
      (patch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'construction',
        );

    assert(
      constructions.length === 1,
      `hidden word-order assumption detected: ${constructions.length}`,
    );

    assert(
      constructions[0].status ===
        'candidate',
      'reverse-order candidate resolved prematurely',
    );
  },
);
