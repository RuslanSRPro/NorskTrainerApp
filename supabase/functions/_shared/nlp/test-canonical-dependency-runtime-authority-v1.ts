import {
  deriveCanonicalDependencyRuntimeAuthoritiesV1,
  type CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from './canonical-dependency-runtime-authority-v1.ts';


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


function row(
  overrides:
    Partial<CanonicalDependencyRuntimeManifestAuthorityRowV1> = {},
): CanonicalDependencyRuntimeManifestAuthorityRowV1 {
  return {
    id:
      'manifest-id-alpha',

    code:
      'manifest.alpha',

    authoring_status:
      'validated',

    runtime_family:
      'runtime-family-alpha',

    execution_phase:
      'phase-alpha',

    constraint_strength:
      'default',

    actions: [
      {
        action:
          'create_dependency',

        target:
          'opaque-target',

        relation:
          'opaque-relation',

        reason_code:
          'opaque-reason',

        value: {
          source_ref:
            'source-binding',

          target_ref:
            'target-binding',
        },
      },
    ],

    ir_spec: {
      source: {
        primary_candidate_code:
          'source.primary',

        supporting_candidate_codes: [
          'source.z',
          'source.a',
        ],
      },
    },

    ...overrides,
  };
}


Deno.test(
  'v1.46 A0: validated create_dependency action yields one opaque authority',
  () => {
    const result =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        row(),
      ]);


    assert(
      result.status ===
        'ready',
      `blocked=${JSON.stringify(result.blockingReasons)}`,
    );


    assert(
      result.authorities.length ===
        1,
      `authorities=${result.authorities.length}`,
    );


    const authority =
      result.authorities[0];


    assert(
      authority.relation ===
        'opaque-relation' &&
      authority.actionTarget ===
        'opaque-target',
      'runtime dependency action semantics not preserved',
    );
  },
);


Deno.test(
  'v1.46 A0: relation runtime family phase and action value remain fully opaque',
  () => {
    const result =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        row({
          runtime_family:
            'totally-unrelated-family',

          execution_phase:
            'totally-unrelated-phase',

          actions: [
            {
              action:
                'create_dependency',

              target:
                'strange-target',

              relation:
                'totally-unrelated-relation',

              value: {
                controller_ref:
                  'some-reference',
              },
            },
          ],
        }),
      ]);


    const authority =
      result.authorities[0];


    assert(
      authority.runtimeFamily ===
        'totally-unrelated-family' &&
      authority.executionPhase ===
        'totally-unrelated-phase' &&
      authority.relation ===
        'totally-unrelated-relation' &&
      authority.actionTarget ===
        'strange-target' &&
      authority.actionValue
        ?.controller_ref ===
        'some-reference',
      'opaque runtime data was interpreted or lost',
    );
  },
);


Deno.test(
  'v1.46 A0: multiple create_dependency actions in one manifest remain independent authorities',
  () => {
    const result =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        row({
          actions: [
            {
              action:
                'create_dependency',

              target:
                'a',

              relation:
                'rel-a',

              value: {
                ref:
                  'x',
              },
            },

            {
              action:
                'create_dependency',

              target:
                'b',

              relation:
                'rel-b',

              value: {
                ref:
                  'y',
              },
            },
          ],
        }),
      ]);


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        2,
      'dependency action multiplicity collapsed',
    );


    assert(
      new Set(
        result.authorities.map(
          (authority) =>
            authority.actionIndex,
        ),
      ).size ===
        2,
      'action identity collapsed',
    );
  },
);


Deno.test(
  'v1.46 A0: non-validated manifest creates no dependency authority',
  () => {
    const result =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        row({
          authoring_status:
            'draft',
        }),
      ]);


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        0,
      'non-validated manifest became authority',
    );
  },
);


Deno.test(
  'v1.46 A0: non create_dependency actions are ignored',
  () => {
    const result =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        row({
          actions: [
            {
              action:
                'create_phrase',

              target:
                'x',

              relation:
                'irrelevant',
            },

            {
              action:
                'add_trace',

              target:
                'x',
            },
          ],
        }),
      ]);


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        0,
      'unrelated runtime action became dependency authority',
    );
  },
);


Deno.test(
  'v1.46 A0: malformed validated dependency action blocks whole boundary',
  () => {
    const result =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        row({
          actions: [
            {
              action:
                'create_dependency',

              target:
                'x',
            },
          ],
        }),
      ]);


    assert(
      result.status ===
        'blocked' &&
      result.authorities.length ===
        0,
      'missing dependency relation accepted',
    );
  },
);


Deno.test(
  'v1.46 A0: validated manifest missing runtime identity blocks',
  () => {
    const result =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        row({
          runtime_family:
            null,
        }),
      ]);


    assert(
      result.status ===
        'blocked',
      'validated manifest with incomplete runtime identity accepted',
    );
  },
);


Deno.test(
  'v1.46 A0: duplicate manifest identity blocks rather than silently duplicating authority',
  () => {
    const a =
      row();

    const b =
      row();


    const result =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        a,
        b,
      ]);


    assert(
      result.status ===
        'blocked' &&
      result.authorities.length ===
        0,
      'duplicate manifest accepted',
    );
  },
);


Deno.test(
  'v1.46 A0: source candidate provenance is preserved and normalized',
  () => {
    const result =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        row(),
      ]);


    assert(
      JSON.stringify(
        result.authorities[0]
          .sourceCandidateCodes,
      ) ===
        JSON.stringify([
          'source.a',
          'source.primary',
          'source.z',
        ]),
      'source candidate provenance lost',
    );
  },
);


Deno.test(
  'v1.46 A0: projection is deterministic and performs no binding edge generation or activation',
  () => {
    const input = [
      row({
        id:
          'manifest-b',

        code:
          'manifest.b',
      }),

      row({
        id:
          'manifest-a',

        code:
          'manifest.a',
      }),
    ];


    const x =
      deriveCanonicalDependencyRuntimeAuthoritiesV1(
        input,
      );

    const y =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        input[1],
        input[0],
      ]);


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'dependency authority projection not deterministic',
    );


    assert(
      x.authorities.every(
        (authority) =>
          authority.status ===
            'candidate' &&
          authority.governance
            .endpointDirectionResolved ===
            false &&
          authority.governance
            .endpointBindingPerformed ===
            false &&
          authority.governance
            .dependencySemanticsResolved ===
            false &&
          authority.governance
            .canonicalEdgeGenerated ===
            false &&
          authority.governance
            .alternativeSetGenerated ===
            false &&
          authority.governance
            .productionActivationAssumed ===
            false,
      ),
      'A0 crossed dependency authority boundary',
    );
  },
);