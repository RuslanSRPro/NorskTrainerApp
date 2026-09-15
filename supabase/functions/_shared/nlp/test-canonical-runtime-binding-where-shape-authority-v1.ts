import {
  deriveCanonicalDependencyRuntimeAuthoritiesV1,
  type CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from './canonical-dependency-runtime-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1,
} from './canonical-runtime-binding-definition-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1,
} from './canonical-runtime-binding-where-shape-authority-v1.ts';


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
  whereClause:
    unknown,
): CanonicalDependencyRuntimeManifestAuthorityRowV1 {
  return {
    id:
      'manifest-where-shape',

    code:
      'manifest.where.shape',

    authoring_status:
      'validated',

    runtime_family:
      'dependency',

    execution_phase:
      'dependency_build',

    actions: [
      {
        action:
          'create_dependency',

        target:
          'x',

        relation:
          'opaque-relation',

        value: {
          source_ref:
            'x',

          target_ref:
            'x',
        },
      },
    ],

    ir_spec: {
      source: {
        primary_candidate_code:
          'source.where.shape',
      },

      bindings: {
        x: {
          entity:
            'opaque-entity',

          scope:
            'opaque-scope',

          cardinality:
            'opaque-cardinality',

          where:
            whereClause,
        },
      },
    },
  } as unknown as CanonicalDependencyRuntimeManifestAuthorityRowV1;
}


function bindings(
  whereClause:
    unknown,
) {
  const source =
    row(
      whereClause,
    );


  const a0 =
    deriveCanonicalDependencyRuntimeAuthoritiesV1([
      source,
    ]);


  assert(
    a0.status ===
      'ready',
    'A0 fixture failed',
  );


  const a30 =
    deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
      a0.authorities,
      [
        source,
      ],
    );


  assert(
    a30.status ===
      'ready',
    `A3.0 fixture failed: ${JSON.stringify(a30)}`,
  );


  return a30.authorities;
}


Deno.test(
  'v1.46 A3.3.0: leaf operator shape preserves opaque operator and operands',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
        bindings({
          op:
            'future-leaf-op',

          left: {
            ref:
              'x.attribute',
          },

          right:
            'future-value',
        }),
      );


    const root =
      result.authorities[0]
        ?.root;


    assert(
      result.status ===
        'ready' &&
      root?.shape ===
        'leaf_operator' &&
      root.operatorLabel ===
        'future-leaf-op' &&
      root.leftReferenceExpression ===
        'x.attribute' &&
      root.hasRightOperand ===
        true &&
      root.rightOperand ===
        'future-value',
      'leaf shape not preserved',
    );
  },
);


Deno.test(
  'v1.46 A3.3.0: leaf without right operand preserves absence without inventing semantics',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
        bindings({
          op:
            'future-unary-op',

          left: {
            ref:
              'x.attribute',
          },
        }),
      );


    const root =
      result.authorities[0]
        ?.root;


    assert(
      root?.shape ===
        'leaf_operator' &&
      root.hasRightOperand ===
        false &&
      root.rightOperand ===
        null,
      'unary leaf shape changed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.0: dotted reference is preserved as one opaque expression',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
        bindings({
          op:
            'future-op',

          left: {
            ref:
              'finite.features.VerbForm',
          },

          right:
            'Fin',
        }),
      );


    const root =
      result.authorities[0]
        ?.root;


    assert(
      root?.shape ===
        'leaf_operator' &&
      root.leftReferenceExpression ===
        'finite.features.VerbForm' &&
      result.authorities[0]
        .governance
        .dottedReferenceTraversalPerformed ===
        false &&
      result.authorities[0]
        .governance
        .referenceSemanticsResolved ===
        false,
      'dotted ref was interpreted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.0: array right operand is preserved structurally',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
        bindings({
          op:
            'future-array-op',

          left: {
            ref:
              'x.schema',
          },

          right: [
            'A',
            'B',
          ],
        }),
      );


    const root =
      result.authorities[0]
        ?.root;


    assert(
      root?.shape ===
        'leaf_operator' &&
      Array.isArray(
        root.rightOperand,
      ) &&
      JSON.stringify(
        root.rightOperand,
      ) ===
        JSON.stringify([
          'A',
          'B',
        ]),
      'array right operand changed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.0: compound array group is classified structurally without key semantics',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
        bindings({
          future_group: [
            {
              op:
                'first-op',

              left: {
                ref:
                  'x.a',
              },

              right:
                'A',
            },
            {
              op:
                'second-op',

              left: {
                ref:
                  'x.b',
              },
            },
          ],
        }),
      );


    const root =
      result.authorities[0]
        ?.root;


    assert(
      root?.shape ===
        'compound_array_group' &&
      root.compoundKey ===
        'future_group' &&
      root.children.length ===
        2 &&
      root.children[0]
        .shape ===
        'leaf_operator' &&
      result.authorities[0]
        .governance
        .compoundSemanticsResolved ===
        false,
      'compound key acquired semantics',
    );
  },
);


Deno.test(
  'v1.46 A3.3.0: nested compound structures remain structural trees only',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
        bindings({
          outer_group: [
            {
              inner_group: [
                {
                  op:
                    'future-op',

                  left: {
                    ref:
                      'x.a.b',
                  },

                  right:
                    true,
                },
              ],
            },
          ],
        }),
      );


    const root =
      result.authorities[0]
        ?.root;


    assert(
      root?.shape ===
        'compound_array_group' &&
      root.children[0]
        ?.shape ===
        'compound_array_group' &&
      root.children[0]
        .children[0]
        ?.shape ===
        'leaf_operator',
      'nested structural tree lost',
    );
  },
);


Deno.test(
  'v1.46 A3.3.0: ambiguous object shape remains unclassified rather than guessed',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
        bindings({
          group_a: [],
          group_b: [],
        }),
      );


    const authority =
      result.authorities[0];


    assert(
      result.status ===
        'ready' &&
      authority.root.shape ===
        'unclassified' &&
      JSON.stringify(
        authority.unclassifiedPaths,
      ) ===
        JSON.stringify([
          '$',
        ]),
      'ambiguous future shape was guessed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.0: non-object upstream where payload arrives as absent after A3.0 normalization',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
        bindings(
          'future-where-shape',
        ),
      );


    const root =
      result.authorities[0]
        ?.root;


    assert(
      result.status ===
        'ready' &&
      root?.shape ===
        'absent' &&
      root.path ===
        '$',
      'A3.3.0 did not respect A3.0 normalized where absence',
    );
  },
);


Deno.test(
  'v1.46 A3.3.0: duplicate binding authority identity blocks whole boundary',
  () => {
    const source =
      bindings({
        op:
          'future-op',

        left: {
          ref:
            'x.a',
        },
      });


    const result =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1([
        source[0],
        source[0],
      ]);


    assert(
      result.status ===
        'blocked' &&
      result.authorities.length ===
        0,
      'duplicate binding authority accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.0: deterministic shape authority performs no operator reference graph scope cardinality or dependency execution',
  () => {
    const source =
      bindings({
        future_group: [
          {
            op:
              'z-op',

            left: {
              extra:
                2,

              ref:
                'x.deep.ref',
            },

            right: {
              z:
                1,

              a:
                2,
            },
          },
        ],
      });


    const x =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
        source,
      );


    const y =
      deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1([
        ...source,
      ].reverse());


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'A3.3.0 not deterministic',
    );


    const g =
      x.authorities[0]
        ?.governance;


    assert(
      g !==
        undefined &&
      g.runtimeOperatorVocabularyHardcoded ===
        false &&
      g.compoundKeyVocabularyHardcoded ===
        false &&
      g.operatorSemanticsResolved ===
        false &&
      g.compoundSemanticsResolved ===
        false &&
      g.referenceSemanticsResolved ===
        false &&
      g.dottedReferenceTraversalPerformed ===
        false &&
      g.rightOperandSemanticsResolved ===
        false &&
      g.canonicalFactOwnershipResolved ===
        false &&
      g.graphTraversalPerformed ===
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
        false,
      'A3.3.0 crossed where-shape boundary',
    );
  },
);