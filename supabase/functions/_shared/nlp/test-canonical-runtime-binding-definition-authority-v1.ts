import {
  deriveCanonicalDependencyRuntimeAuthoritiesV1,
  type CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from './canonical-dependency-runtime-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1,
} from './canonical-runtime-binding-definition-authority-v1.ts';


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
      'manifest-alpha',

    code:
      'manifest.alpha',

    authoring_status:
      'validated',

    runtime_family:
      'opaque-family',

    execution_phase:
      'opaque-phase',

    constraint_strength:
      'opaque-strength',

    actions: [
      {
        action:
          'create_dependency',

        target:
          'binding-a',

        relation:
          'opaque-relation',

        value: {
          source_ref:
            'binding-a',

          target_ref:
            'binding-b',
        },
      },
    ],

    ir_spec: {
      source: {
        primary_candidate_code:
          'source.primary',
      },

      bindings: {
        'binding-b': {
          entity:
            'opaque-entity-b',

          scope:
            'opaque-scope-b',

          cardinality:
            'opaque-cardinality-b',

          where: {
            op:
              'opaque-op-b',

            left: {
              ref:
                'binding-b.some.path',
            },
          },
        },

        'binding-a': {
          entity:
            'opaque-entity-a',

          scope:
            'opaque-scope-a',

          cardinality:
            'opaque-cardinality-a',

          where: {
            op:
              'opaque-op-a',

            left: {
              ref:
                'binding-a.other.path',
            },
          },
        },
      },
    },

    ...overrides,
  };
}


function derive(
  rows:
    readonly CanonicalDependencyRuntimeManifestAuthorityRowV1[],
) {
  const a0 =
    deriveCanonicalDependencyRuntimeAuthoritiesV1(
      rows,
    );


  assert(
    a0.status ===
      'ready',
    `A0 blocked=${JSON.stringify(a0.blockingReasons)}`,
  );


  return deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
    a0.authorities,
    rows,
  );
}


Deno.test(
  'v1.46 A3.0: validated dependency manifest projects exact binding definitions',
  () => {
    const result =
      derive([
        row(),
      ]);


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        2,
      `authorities=${result.authorities.length}`,
    );


    assert(
      result.authorities.map(
        (authority) =>
          authority.bindingName,
      ).join(',') ===
        'binding-a,binding-b',
      'binding identities lost',
    );
  },
);


Deno.test(
  'v1.46 A3.0: entity scope cardinality and where operator remain opaque runtime labels',
  () => {
    const result =
      derive([
        row(),
      ]);


    const binding =
      result.authorities.find(
        (authority) =>
          authority.bindingName ===
            'binding-a',
      );


    assert(
      binding !==
        undefined &&
      binding.entityLabel ===
        'opaque-entity-a' &&
      binding.scopeLabel ===
        'opaque-scope-a' &&
      binding.cardinalityLabel ===
        'opaque-cardinality-a' &&
      binding.topLevelWhereOperator ===
        'opaque-op-a',
      'runtime labels were lost or interpreted',
    );
  },
);


Deno.test(
  'v1.46 A3.0: full where clause is preserved without reference execution',
  () => {
    const result =
      derive([
        row(),
      ]);


    const binding =
      result.authorities.find(
        (authority) =>
          authority.bindingName ===
            'binding-b',
      );


    assert(
      binding !==
        undefined &&
      JSON.stringify(
        binding.whereClause,
      ).includes(
        'binding-b.some.path',
      ),
      'where clause/reference expression lost',
    );


    assert(
      binding.governance
        .whereSemanticsResolved ===
        false &&
      binding.governance
        .referenceSemanticsResolved ===
        false,
      'where/reference semantics executed',
    );
  },
);


Deno.test(
  'v1.46 A3.0: multiple create_dependency actions share one manifest binding authority set',
  () => {
    const result =
      derive([
        row({
          actions: [
            {
              action:
                'create_dependency',

              target:
                'binding-a',

              relation:
                'relation-a',

              value: {
                controller_ref:
                  'binding-b',
              },
            },

            {
              action:
                'create_dependency',

              target:
                'binding-b',

              relation:
                'relation-b',

              value: {
                source_ref:
                  'binding-a',

                target_ref:
                  'binding-b',
              },
            },
          ],
        }),
      ]);


    assert(
      result.authorities.length ===
        2,
      'bindings duplicated per dependency action',
    );


    assert(
      result.authorities.every(
        (authority) =>
          authority
            .supportingDependencyAuthorityIds
            .length ===
            2,
      ),
      'dependency authority provenance not coalesced',
    );
  },
);


Deno.test(
  'v1.46 A3.0: non-validated manifest never becomes binding authority',
  () => {
    const result =
      deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
        [],
        [
          row({
            authoring_status:
              'draft',
          }),
        ],
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        0,
      'draft manifest became binding authority',
    );
  },
);


Deno.test(
  'v1.46 A3.0: dependency manifest without bindings is surfaced without inventing definitions',
  () => {
    const result =
      derive([
        row({
          ir_spec: {
            source: {
              primary_candidate_code:
                'source.primary',
            },
          },
        }),
      ]);


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        0 &&
      result.manifestsWithoutBindings.length ===
        1,
      'missing bindings were invented or destructively blocked',
    );
  },
);


Deno.test(
  'v1.46 A3.0: malformed binding definition blocks whole authority boundary',
  () => {
    const result =
      derive([
        row({
          ir_spec: {
            source: {
              primary_candidate_code:
                'source.primary',
            },

            bindings: {
              good:
                {},

              bad:
                'not-an-object',
            },
          },
        }),
      ]);


    assert(
      result.status ===
        'blocked' &&
      result.authorities.length ===
        0,
      'malformed binding accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.0: duplicate A0 dependency authority identity blocks',
  () => {
    const source =
      row();


    const a0 =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        source,
      ]);


    assert(
      a0.status ===
        'ready',
      'A0 setup failed',
    );


    const result =
      deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
        [
          a0.authorities[0],
          a0.authorities[0],
        ],
        [
          source,
        ],
      );


    assert(
      result.status ===
        'blocked',
      'duplicate A0 authority accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.0: ambiguous exact manifest identity blocks rather than choosing one row',
  () => {
    const source =
      row();


    const a0 =
      deriveCanonicalDependencyRuntimeAuthoritiesV1([
        source,
      ]);


    assert(
      a0.status ===
        'ready',
      'A0 setup failed',
    );


    const result =
      deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
        a0.authorities,
        [
          source,
          source,
        ],
      );


    assert(
      result.status ===
        'blocked',
      'ambiguous manifest row accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.0: deterministic authority performs no binding execution occurrence enumeration or dependency generation',
  () => {
    const rows = [
      row({
        id:
          'manifest-z',

        code:
          'manifest.z',
      }),

      row({
        id:
          'manifest-a',

        code:
          'manifest.a',

        ir_spec: {
          source: {
            primary_candidate_code:
              'source.a',
          },

          bindings: {
            x: {
              entity:
                'future-entity',

              scope:
                'future-scope',

              cardinality:
                'future-cardinality',

              where: {
                op:
                  'future-op',
              },
            },
          },
        },
      }),
    ];


    const a0 =
      deriveCanonicalDependencyRuntimeAuthoritiesV1(
        rows,
      );


    assert(
      a0.status ===
        'ready',
      'A0 setup failed',
    );


    const x =
      deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
        a0.authorities,
        rows,
      );


    const y =
      deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
        [
          ...a0.authorities,
        ].reverse(),
        [
          ...rows,
        ].reverse(),
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'A3.0 not deterministic',
    );


    assert(
      x.authorities.every(
        (authority) =>
          authority.status ===
            'candidate' &&
          authority.governance
            .entitySemanticsResolved ===
            false &&
          authority.governance
            .scopeSemanticsResolved ===
            false &&
          authority.governance
            .cardinalitySemanticsResolved ===
            false &&
          authority.governance
            .whereSemanticsResolved ===
            false &&
          authority.governance
            .referenceSemanticsResolved ===
            false &&
          authority.governance
            .occurrenceEnumerationPerformed ===
            false &&
          authority.governance
            .occurrenceBindingPerformed ===
            false &&
          authority.governance
            .dependencyDirectionResolved ===
            false &&
          authority.governance
            .canonicalEdgeGenerated ===
            false &&
          authority.governance
            .grammaticalFunctionResolved ===
            false &&
          authority.governance
            .complementArgumentAttachmentResolved ===
            false &&
          authority.governance
            .realizesSlotGenerated ===
            false,
      ),
      'A3.0 crossed binding-definition boundary',
    );
  },
);