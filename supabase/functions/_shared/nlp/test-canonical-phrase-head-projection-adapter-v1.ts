import {
  buildCanonicalSurfaceDocumentV1,
} from './canonical-surface-boundary-v1.ts';

import {
  applyGraphPatchV1,
  assertCanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
  type CanonicalLanguageGraphV1,
  type GraphPatchV1,
  type LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import {
  buildCanonicalPhraseCandidateLatticePatchV1,
} from './canonical-phrase-candidate-lattice-v1.ts';

import {
  buildCanonicalPhraseHeadProjectionFromSnapshotV1,
} from './canonical-phrase-head-projection-adapter-v1.ts';

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


// Exact relevant fields from the live
// canonical_phrase_head_projection_snapshot_v1()
// result verified on 2026-09-03.
//
// Historical bindings/dependencies/compiler/build_strategy
// are deliberately absent because the DB snapshot deliberately
// excludes them.
const LIVE_VP_HEAD_SNAPSHOT = {
  plane:
    'build_control',

  version:
    'canonical-phrase-head-projection-snapshot-v1',

  read_only:
    true,

  write_performed:
    false,

  frozen_grammar_immutable:
    true,

  historical_manifest_interpretation_only:
    true,

  source: {
    status:
      'source_verified',

    candidate_id:
      'f1d4d40e-c58c-4f69-82ea-833ac9bae976',

    candidate_code:
      'verb.phrase.head.finite',

    source_section:
      '7.1',

    requires_human_verification:
      false,

    extracted_payload: {
      language:
        'no',

      head_role:
        'finite_verb',

      construction:
        'verb_phrase',

      candidate_code:
        'verb.phrase.head.finite',

      semantic_block:
        'verb.phrase.head',

      source_section:
        '7.1',

      future_rule_family:
        'verb_phrase.head.resolve',
    },

    digital_model: {
      model: {
        type:
          'construction_compatibility',

        subtype:
          'finite_verb_phrase_head',

        version:
          1,
      },
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
  },

  morphology_inventory: {
    status:
      'source_verified',

    candidate_id:
      '9655ab7a-dacf-4a39-a942-df2b9f1e63a1',

    candidate_code:
      'verb.form.finite.inventory',

    source_section:
      '7.1.2',

    requires_human_verification:
      false,

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

    execution_contract: {
      audit: {
        version:
          1,

        disposition:
          'KEEP_REFERENCE_ONLY',
      },

      execution: {
        role:
          'morphology_reference',

        consumed_by:
          [],
      },

      placement: {
        target_layers: [
          'grammar_reference',
        ],
      },
    },
  },

  manifest_projection: {
    manifest_id:
      '43870fa5-a17a-49cf-be15-a369ea68eec6',

    manifest_code:
      'ir.structural.verb_phrase.finite_head',

    runtime_family:
      'verb_phrase',

    execution_phase:
      'phrase_build',

    authoring_status:
      'validated',

    constraint_strength:
      'categorical',

    primary_candidate_code:
      'verb.phrase.head.finite',

    supporting_candidate_codes: [
      'verb.phrase.simple_compound',
      'grammar.foundations.phrase.type_from_head',
    ],

    actions: [
      {
        value: {
          phrase_type:
            'VP',
        },

        action:
          'create_phrase',

        target:
          'finite',

        reason_code:
          'nrg_finite_verb_vp_head',
      },

      {
        value: {
          phrase_type:
            'VP',
        },

        action:
          'set_head',

        target:
          'finite',

        reason_code:
          'nrg_finite_verb_head',
      },
    ],
  },

  // Keep the three inventory-owned rows plus distractors.
  // The adapter must select rows by frozen form_types,
  // never by "looks finite" heuristics.
  morph_registry: [
    {
      pos:
        'verb',

      form_key:
        'imperative',

      form_scope:
        'token',

      canonical_features: {
        Mood:
          'Imp',

        VerbForm:
          'Fin',
      },

      provenance_policy:
        'lexeme_form_variants.source_verified',
    },

    {
      pos:
        'verb',

      form_key:
        'infinitive',

      form_scope:
        'token',

      canonical_features: {
        VerbForm:
          'Inf',
      },

      provenance_policy:
        'lexeme_form_variants.source_verified',
    },

    {
      pos:
        'verb',

      form_key:
        'past',

      form_scope:
        'token',

      canonical_features: {
        Tense:
          'Past',

        VerbForm:
          'Fin',
      },

      provenance_policy:
        'lexeme_form_variants.source_verified',
    },

    {
      pos:
        'verb',

      form_key:
        'past_participle',

      form_scope:
        'token',

      canonical_features: {
        Tense:
          'Past',

        VerbForm:
          'Part',
      },

      provenance_policy:
        'lexeme_form_variants.source_verified',
    },

    {
      pos:
        'verb',

      form_key:
        'present',

      form_scope:
        'token',

      canonical_features: {
        Tense:
          'Pres',

        VerbForm:
          'Fin',
      },

      provenance_policy:
        'lexeme_form_variants.source_verified',
    },

    {
      pos:
        'verb',

      form_key:
        'present_participle',

      form_scope:
        'token',

      canonical_features: {
        Tense:
          'Pres',

        VerbForm:
          'Part',
      },

      provenance_policy:
        'lexeme_form_variants.source_verified',
    },
  ],

  excluded_historical_fields: [
    'dependencies',
    'bindings',
    'condition',
    'compiler',
    'compiled_rule',
    'build_strategy',
    'transparent_lexical_classes',
    'max_gap',
  ],
} as const;


function tokenBySurface(
  graph: CanonicalLanguageGraphV1,
  surface: string,
): LanguageGraphNodeV1 {
  const token =
    graph.nodes.find(
      (node) =>
        node.type === 'token' &&
        node.features.surface === surface,
    );

  if (!token) {
    throw new Error(
      `token missing: ${surface}`,
    );
  }

  return token;
}


function graphWithMorph(
  text: string,
  surfaceValue: string,
  features: Record<string, unknown>,
): CanonicalLanguageGraphV1 {
  const surface =
    buildCanonicalSurfaceDocumentV1(
      text,
    );

  let graph =
    createCanonicalLanguageGraphV1(
      surface,
    );

  const token =
    tokenBySurface(
      graph,
      surfaceValue,
    );

  const node:
    LanguageGraphNodeV1 = {
    id:
      `morph:vp-live:${token.id}`,

    type:
      'morph_reading',

    subtype:
      'verb',

    status:
      'candidate',

    span: {
      ...token.span,
    },

    features: {
      pos:
        'verb',

      canonicalFeatures: {
        ...features,
      },
    },

    producer:
      'canonical_candidate_lattice_v1',

    evidenceIds: [
      `evidence:morph:vp-live:${token.id}`,
    ],

    provenanceIds: [
      'prov:test:vp-live-morph',
    ],
  };

  const patch:
    GraphPatchV1 = {
    producer:
      'canonical_candidate_lattice_v1',

    producerVersion:
      '1',

    nodes: [
      node,
    ],

    evidence: [{
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
        liveVpHeadProjection:
          true,
      },

      producer:
        'canonical_candidate_lattice_v1',

      provenanceIds: [
        'prov:test:vp-live-morph',
      ],
    }],

    provenance: [{
      id:
        'prov:test:vp-live-morph',

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

  return graph;
}


Deno.test(
  'v1.44 VP head projection: exact live snapshot derives head-only VP and VerbForm=Fin from data',
  () => {
    const result =
      buildCanonicalPhraseHeadProjectionFromSnapshotV1(
        LIVE_VP_HEAD_SNAPSHOT,
      );

    assert(
      result.status ===
        'ready',
      result.blockingReasons.join(', '),
    );

    assert(
      result.derived.phraseType ===
        'VP',
      `phraseType=${result.derived.phraseType}`,
    );

    assert(
      result.derived.headRef ===
        'finite',
      `headRef=${result.derived.headRef}`,
    );

    assert(
      result.derived.pos ===
        'verb',
      `pos=${result.derived.pos}`,
    );

    assert(
      JSON.stringify(
        result.derived
          .commonCanonicalFeatures,
      ) ===
        JSON.stringify({
          VerbForm:
            'Fin',
        }),
      `common features=${
        JSON.stringify(
          result.derived
            .commonCanonicalFeatures,
        )
      }`,
    );

    const rule =
      result.rule!;

    assert(
      rule.pattern
        .build_strategy ===
        'head_only',
      `strategy=${rule.pattern.build_strategy}`,
    );

    assert(
      rule.pattern
        .phrase_type ===
        'VP',
      'VP not derived',
    );

    assert(
      rule.pattern
        .head_ref ===
        'finite',
      'finite head ref not derived',
    );

    const serialized =
      JSON.stringify(rule);

    assert(
      serialized.includes(
        'VerbForm=Fin',
      ),
      'derived Fin constraint missing',
    );

    assert(
      !serialized.includes(
        'sentence_adverbial',
      ),
      'historical sentence-adverbial dependency leaked',
    );

    assert(
      !serialized.includes(
        'max_gap',
      ),
      'historical max_gap leaked',
    );

    assert(
      !serialized.includes(
        'finite_head_plus_following_nonfinite',
      ),
      'historical compound strategy leaked',
    );
  },
);


Deno.test(
  'v1.44 VP head projection: present, past and imperative all execute through the same data-derived projection',
  () => {
    const result =
      buildCanonicalPhraseHeadProjectionFromSnapshotV1(
        LIVE_VP_HEAD_SNAPSHOT,
      );

    assert(
      result.status ===
        'ready' &&
        result.rule,
      'projection blocked',
    );

    const cases = [
      {
        text:
          'skriver',

        features: {
          Tense:
            'Pres',

          VerbForm:
            'Fin',
        },
      },

      {
        text:
          'skrev',

        features: {
          Tense:
            'Past',

          VerbForm:
            'Fin',
        },
      },

      {
        text:
          'skriv',

        features: {
          Mood:
            'Imp',

          VerbForm:
            'Fin',
        },
      },
    ];

    for (const item of cases) {
      const graph =
        graphWithMorph(
          item.text,
          item.text,
          item.features,
        );

      const patch =
        buildCanonicalPhraseCandidateLatticePatchV1(
          graph,
          [
            result.rule,
          ],
        );

      const vp =
        (patch.nodes ?? [])
          .filter(
            (node) =>
              node.type ===
                'phrase' &&
              node.subtype ===
                'VP',
          );

      assert(
        vp.length === 1,
        `${item.text}: VP=${vp.length}`,
      );

      assert(
        vp[0].status ===
          'candidate',
        `${item.text}: VP auto-resolved`,
      );

      const alt =
        (patch.alternativeSets ?? [])
          .find(
            (set) =>
              set.memberIds.includes(
                vp[0].id,
              ),
          );

      assert(
        alt?.status ===
          'open',
        `${item.text}: VP alternative not open`,
      );
    }
  },
);


Deno.test(
  'v1.44 VP head projection: infinitive does not match finite head projection',
  () => {
    const result =
      buildCanonicalPhraseHeadProjectionFromSnapshotV1(
        LIVE_VP_HEAD_SNAPSHOT,
      );

    assert(
      result.status ===
        'ready' &&
        result.rule,
      'projection blocked',
    );

    const graph =
      graphWithMorph(
        'skrive',
        'skrive',
        {
          VerbForm:
            'Inf',
        },
      );

    const patch =
      buildCanonicalPhraseCandidateLatticePatchV1(
        graph,
        [
          result.rule,
        ],
      );

    assert(
      (patch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'phrase' &&
            node.subtype ===
              'VP',
        )
        .length === 0,
      'infinitive incorrectly generated finite VP',
    );
  },
);


Deno.test(
  'v1.44 VP head projection: contradictory manifest actions block instead of guessing phrase identity',
  () => {
    const broken = {
      ...LIVE_VP_HEAD_SNAPSHOT,

      manifest_projection: {
        ...LIVE_VP_HEAD_SNAPSHOT
          .manifest_projection,

        actions: [
          {
            action:
              'create_phrase',

            target:
              'finite',

            value: {
              phrase_type:
                'VP',
            },
          },

          {
            action:
              'set_head',

            target:
              'other',

            value: {
              phrase_type:
                'VP',
            },
          },
        ],
      },
    };

    const result =
      buildCanonicalPhraseHeadProjectionFromSnapshotV1(
        broken,
      );

    assert(
      result.status ===
        'blocked',
      'contradictory manifest was projected',
    );

    assert(
      result.blockingReasons.includes(
        'manifest:head_target_disagreement',
      ),
      result.blockingReasons.join(', '),
    );
  },
);


Deno.test(
  'v1.44 VP head projection: missing inventory registry row blocks instead of hardcoding Fin',
  () => {
    const broken = {
      ...LIVE_VP_HEAD_SNAPSHOT,

      morph_registry:
        LIVE_VP_HEAD_SNAPSHOT
          .morph_registry
          .filter(
            (row) =>
              row.form_key !==
                'imperative',
          ),
    };

    const result =
      buildCanonicalPhraseHeadProjectionFromSnapshotV1(
        broken,
      );

    assert(
      result.status ===
        'blocked',
      'missing registry row was ignored',
    );

    assert(
      result.blockingReasons.includes(
        'morph_registry:imperative:missing_or_ambiguous',
      ),
      result.blockingReasons.join(', '),
    );
  },
);


Deno.test(
  'v1.44 VP head projection: resulting Phrase patch preserves graph invariants',
  () => {
    const result =
      buildCanonicalPhraseHeadProjectionFromSnapshotV1(
        LIVE_VP_HEAD_SNAPSHOT,
      );

    assert(
      result.status ===
        'ready' &&
        result.rule,
      'projection blocked',
    );

    const graph0 =
      graphWithMorph(
        'skriver',
        'skriver',
        {
          Tense:
            'Pres',

          VerbForm:
            'Fin',
        },
      );

    const patch =
      buildCanonicalPhraseCandidateLatticePatchV1(
        graph0,
        [
          result.rule,
        ],
      );

    const graph =
      applyGraphPatchV1(
        graph0,
        patch,
      );

    const errors =
      assertCanonicalLanguageGraphV1(
        graph,
      );

    assert(
      errors.length === 0,
      `graph invariant errors: ${errors.join(', ')}`,
    );

    assert(
      result.governance
        .frozenGrammarReadOnly ===
        true,
      'frozen grammar guard missing',
    );

    assert(
      result.governance
        .grammarRuleMaterialized ===
        false,
      'adapter claims grammar rule materialization',
    );
  },
);