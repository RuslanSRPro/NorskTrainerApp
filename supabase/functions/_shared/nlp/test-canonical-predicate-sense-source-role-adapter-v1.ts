import {
  deriveCanonicalPredicateSenseSourceRoleProjectionsV1,
  type CanonicalPredicateSenseSourceCandidateSnapshotRowV1,
  type CanonicalPredicateSenseSourceSnapshotV1,
} from './canonical-predicate-sense-source-role-adapter-v1.ts';


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


function runtimeConstructionRow(
  candidateCode: string,
  payload:
    Record<string, unknown>,
  overrides:
    Partial<CanonicalPredicateSenseSourceCandidateSnapshotRowV1> = {},
): CanonicalPredicateSenseSourceCandidateSnapshotRowV1 {
  return {
    candidate_id:
      `id:${candidateCode}`,

    candidate_code:
      candidateCode,

    status:
      'source_verified',

    requires_human_verification:
      false,

    source_section:
      '7.test',

    extracted_payload: {
      candidate_code:
        candidateCode,

      ...payload,
    },

    digital_model: {
      model: {
        type:
          'construction_compatibility',

        subtype:
          `subtype:${candidateCode}`,

        learning: {
          source_strict_runtime:
            true,
        },
      },
    },

    execution_contract: {
      audit: {
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

    ...overrides,
  };
}


function liveSnapshotFixture():
  CanonicalPredicateSenseSourceSnapshotV1 {
  return {
    version:
      'canonical-construction-projection-snapshot-v1',

    plane:
      'build_control',

    read_only:
      true,

    write_performed:
      false,

    frozen_grammar_immutable:
      true,

    candidates: [
      runtimeConstructionRow(
        'verb.auxiliary.complement.nonfinite_main',
        {
          language:
            'no',

          head_role:
            'auxiliary',

          complement_role:
            'main_verb',

          allowed_complement_forms: [
            'infinitive',
            'past_participle',
          ],
        },
        {
          candidate_id:
            '831b4913-3e78-4490-9011-302db0a016b2',

          source_section:
            '7.2.1',
        },
      ),

      runtimeConstructionRow(
        'verb.compound_form.finite_aux_nonfinite_main',
        {
          language:
            'no',

          construction:
            'compound_verbal_form',

          finite_role:
            'auxiliary',

          nonfinite_role:
            'main_verb',
        },
        {
          candidate_id:
            'fd5b9c73-6f64-4ca0-901f-ffa0cfe5f8ed',

          source_section:
            '7.2',
        },
      ),

      runtimeConstructionRow(
        'verb.compound_form.finite_nonfinite.structure',
        {
          language:
            'no',

          construction:
            'compound_verbal_form',

          semantic_block:
            'verb.compound_form.finite_nonfinite',
        },
        {
          candidate_id:
            'cf83ec1a-6862-4290-a1ec-491c1e18d667',

          source_section:
            '7.2',
        },
      ),

      runtimeConstructionRow(
        'verb.infinitive.bare_after_auxiliary',
        {
          marker:
            'absent',

          language:
            'no',

          governors: [
            'selected_auxiliary',
          ],

          future_rule_family:
            'auxiliary.bare_infinitive',
        },
        {
          candidate_id:
            '15acaeb7-7178-4991-8b2b-e80be1ec057a',

          source_section:
            '7.1.2.2.1',
        },
      ),
    ],
  };
}


Deno.test(
  'v1.44 predicate sense A2.1: exact live construction snapshot derives source role projections',
  () => {
    const result =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        liveSnapshotFixture(),
      );

    assert(
      result.status ===
        'ready',
      `status=${result.status}`,
    );

    assert(
      result.projections.length ===
        4,
      `projection count=${result.projections.length}`,
    );

    const compact =
      result.projections
        .map(
          (projection) =>
            [
              projection.sourceCandidateCode,
              projection.memberRef,
              projection.sense,
            ].join('|'),
        )
        .sort();

    assert(
      compact.includes(
        'verb.compound_form.finite_aux_nonfinite_main|finite|auxiliary',
      ),
      `missing finite source role: ${JSON.stringify(compact)}`,
    );

    assert(
      compact.includes(
        'verb.compound_form.finite_aux_nonfinite_main|nonfinite|main_verb',
      ),
      `missing nonfinite source role: ${JSON.stringify(compact)}`,
    );

    assert(
      compact.includes(
        'verb.auxiliary.complement.nonfinite_main|head|auxiliary',
      ),
      `missing head source role: ${JSON.stringify(compact)}`,
    );

    assert(
      compact.includes(
        'verb.auxiliary.complement.nonfinite_main|complement|main_verb',
      ),
      `missing complement source role: ${JSON.stringify(compact)}`,
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.1: generic finite-nonfinite structure does not invent semantic roles',
  () => {
    const snapshot =
      liveSnapshotFixture();

    snapshot.candidates =
      snapshot.candidates?.filter(
        (candidate) =>
          candidate.candidate_code ===
            'verb.compound_form.finite_nonfinite.structure',
      );

    const result =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        snapshot,
      );

    assert(
      result.projections.length ===
        0,
      `generic structure invented roles: ${JSON.stringify(result.projections)}`,
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.1: governor labels are not reinterpreted as member-role evidence',
  () => {
    const snapshot =
      liveSnapshotFixture();

    snapshot.candidates =
      snapshot.candidates?.filter(
        (candidate) =>
          candidate.candidate_code ===
            'verb.infinitive.bare_after_auxiliary',
      );

    const result =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        snapshot,
      );

    assert(
      result.projections.length ===
        0,
      `governor metadata became sense evidence`,
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.1: reference-only semantic role facts are not promoted to runtime',
  () => {
    const snapshot =
      liveSnapshotFixture();

    snapshot.candidates = [
      runtimeConstructionRow(
        'test.reference.only',
        {
          head_role:
            'test_role',
        },
        {
          digital_model: {
            model: {
              type:
                'construction_compatibility',

              learning: {
                source_strict_runtime:
                  false,
              },
            },
          },

          execution_contract: {
            audit: {
              disposition:
                'KEEP_REFERENCE_ONLY',
            },

            execution: {
              role:
                'semantic_reference',
            },

            placement: {
              target_layers: [
                'grammar_reference',
              ],
            },
          },
        },
      ),
    ];

    const result =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        snapshot,
      );

    assert(
      result.projections.length ===
        0,
      'reference-only knowledge was promoted to runtime evidence',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.1: non-construction role-looking fields do not become projections',
  () => {
    const snapshot =
      liveSnapshotFixture();

    snapshot.candidates = [
      runtimeConstructionRow(
        'test.usage.constraint',
        {
          counterexample_role:
            'some_role',
        },
        {
          digital_model: {
            model: {
              type:
                'usage_constraint',

              learning: {
                source_strict_runtime:
                  true,
              },
            },
          },
        },
      ),
    ];

    const result =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        snapshot,
      );

    assert(
      result.projections.length ===
        0,
      'non-construction role-looking metadata became structural role evidence',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.1: source verification and human-review gates are enforced',
  () => {
    const snapshot =
      liveSnapshotFixture();

    snapshot.candidates = [
      runtimeConstructionRow(
        'test.not.verified',
        {
          head_role:
            'role_a',
        },
        {
          status:
            'draft',
        },
      ),

      runtimeConstructionRow(
        'test.needs.review',
        {
          head_role:
            'role_b',
        },
        {
          requires_human_verification:
            true,
        },
      ),
    ];

    const result =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        snapshot,
      );

    assert(
      result.projections.length ===
        0,
      'unverified source knowledge became runtime projection',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.1: snapshot safety failure blocks all projection',
  () => {
    const unsafe =
      liveSnapshotFixture();

    unsafe.read_only =
      false;

    const result =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        unsafe,
      );

    assert(
      result.status ===
        'blocked',
      `status=${result.status}`,
    );

    assert(
      result.projections.length ===
        0,
      'unsafe snapshot produced projections',
    );

    assert(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code ===
            'snapshot_not_read_only',
      ),
      'missing read-only safety diagnostic',
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.1: competing source roles are preserved rather than resolved',
  () => {
    const snapshot =
      liveSnapshotFixture();

    snapshot.candidates = [
      runtimeConstructionRow(
        'test.role.a',
        {
          head_role:
            'sense_a',
        },
      ),

      runtimeConstructionRow(
        'test.role.b',
        {
          head_role:
            'sense_b',
        },
      ),
    ];

    const result =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        snapshot,
      );

    assert(
      result.projections.length ===
        2,
      `projections=${result.projections.length}`,
    );

    const senses =
      result.projections
        .map(
          (projection) =>
            projection.sense,
        )
        .sort();

    assert(
      JSON.stringify(senses) ===
        JSON.stringify([
          'sense_a',
          'sense_b',
        ]),
      `senses=${JSON.stringify(senses)}`,
    );
  },
);


Deno.test(
  'v1.44 predicate sense A2.1: adapter is deterministic and does not mutate snapshot',
  () => {
    const snapshot =
      liveSnapshotFixture();

    const before =
      JSON.stringify(
        snapshot,
      );

    const a =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        snapshot,
      );

    const b =
      deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
        snapshot,
      );

    assert(
      JSON.stringify(a) ===
        JSON.stringify(b),
      'projection output is not deterministic',
    );

    assert(
      JSON.stringify(snapshot) ===
        before,
      'adapter mutated source snapshot',
    );
  },
);