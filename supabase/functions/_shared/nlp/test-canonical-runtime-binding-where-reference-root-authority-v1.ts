import {
  deriveCanonicalDependencyRuntimeAuthoritiesV1,
  type CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from './canonical-dependency-runtime-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1,
  type CanonicalRuntimeBindingDefinitionAuthorityV1,
} from './canonical-runtime-binding-definition-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1,
} from './canonical-runtime-binding-where-shape-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1,
} from './canonical-runtime-binding-where-reference-root-authority-v1.ts';


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
  bindingDefinitions:
    Record<string, unknown>,
): CanonicalDependencyRuntimeManifestAuthorityRowV1 {
  const firstBindingName =
    Object.keys(
      bindingDefinitions,
    )[0] ??
      'owner';


  return {
    id:
      'manifest-where-root',

    code:
      'manifest.where.root',

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
          firstBindingName,

        relation:
          'opaque-relation',

        value: {
          source_ref:
            firstBindingName,

          target_ref:
            firstBindingName,
        },
      },
    ],

    ir_spec: {
      source: {
        primary_candidate_code:
          'source.where.root',
      },

      bindings:
        bindingDefinitions,
    },
  } as unknown as CanonicalDependencyRuntimeManifestAuthorityRowV1;
}


function pipeline(
  bindingDefinitions:
    Record<string, unknown>,
) {
  const source =
    row(
      bindingDefinitions,
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


  const a330 =
    deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
      a30.authorities,
    );


  assert(
    a330.status ===
      'ready',
    `A3.3.0 fixture failed: ${JSON.stringify(a330)}`,
  );


  return {
    bindings:
      a30.authorities,

    whereShapes:
      a330.authorities,
  };
}


function binding(
  whereClause:
    unknown,
) {
  return {
    entity:
      'opaque-entity',

    scope:
      'opaque-scope',

    cardinality:
      'one',

    where:
      whereClause,
  };
}


Deno.test(
  'v1.46 A3.3.1: bare where reference exactly matching binding root is rooted',
  () => {
    const source =
      pipeline({
        x:
          binding({
            op:
              'future-op',

            left: {
              ref:
                'x',
            },
          }),
      });


    const result =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        source.whereShapes,
        source.bindings,
      );


    const site =
      result.authorities[0]
        ?.referenceSites[0];


    assert(
      result.status ===
        'ready' &&
      site?.rootStatus ===
        'exact_binding' &&
      site.rootBindingName ===
        'x' &&
      site.opaqueSuffix ===
        null,
      'exact binding root not proven',
    );
  },
);


Deno.test(
  'v1.46 A3.3.1: dotted where ref proves binding prefix and preserves opaque suffix',
  () => {
    const source =
      pipeline({
        finite:
          binding({
            op:
              'future-op',

            left: {
              ref:
                'finite.features.VerbForm',
            },

            right:
              'Fin',
          }),
      });


    const result =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        source.whereShapes,
        source.bindings,
      );


    const site =
      result.authorities[0]
        ?.referenceSites[0];


    assert(
      site?.rootStatus ===
        'binding_prefix_with_opaque_suffix' &&
      site.rootBindingName ===
        'finite' &&
      site.opaqueSuffix ===
        '.features.VerbForm',
      'opaque dotted suffix was not preserved',
    );
  },
);


Deno.test(
  'v1.46 A3.3.1: where clause may root reference to another binding in same manifest',
  () => {
    const source =
      pipeline({
        adj:
          binding({
            op:
              'future-op',

            left: {
              ref:
                'adj.pos',
            },
          }),

        controller:
          binding({
            op:
              'future-relation-op',

            left: {
              ref:
                'adj.node',
            },

            right:
              'opaque-relation',
          }),
      });


    const controllerShape =
      source.whereShapes.find(
        (authority) =>
          authority.bindingName ===
            'controller',
      );


    assert(
      controllerShape !==
        undefined,
      'controller where fixture missing',
    );


    const result =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        [
          controllerShape,
        ],
        source.bindings,
      );


    const site =
      result.authorities[0]
        ?.referenceSites[0];


    assert(
      site?.rootBindingName ===
        'adj' &&
      site.rootStatus ===
        'binding_prefix_with_opaque_suffix' &&
      site.opaqueSuffix ===
        '.node',
      'cross-binding manifest-local root failed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.1: longest exact binding prefix wins without suffix traversal',
  () => {
    const source =
      pipeline({
        x:
          binding(
            null,
          ),

        'x.deep':
          binding({
            op:
              'future-op',

            left: {
              ref:
                'x.deep.value.more',
            },
          }),
      });


    const result =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        source.whereShapes,
        source.bindings,
      );


    const rooted =
      result.authorities
        .flatMap(
          (authority) =>
            authority.referenceSites,
        )
        .find(
          (site) =>
            site.referenceExpression ===
              'x.deep.value.more',
        );


    assert(
      rooted?.rootBindingName ===
        'x.deep' &&
      rooted.opaqueSuffix ===
        '.value.more',
      'longest binding prefix did not win',
    );
  },
);


Deno.test(
  'v1.46 A3.3.1: unknown where reference remains explicitly unrooted',
  () => {
    const source =
      pipeline({
        x:
          binding({
            op:
              'future-op',

            left: {
              ref:
                'unknown.attribute',
            },
          }),
      });


    const result =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        source.whereShapes,
        source.bindings,
      );


    const authority =
      result.authorities[0];

    const site =
      authority
        ?.referenceSites[0];


    assert(
      site?.rootStatus ===
        'unrooted' &&
      site.rootBindingAuthorityId ===
        null &&
      site.rootBindingName ===
        null &&
      site.opaqueSuffix ===
        null &&
      JSON.stringify(
        authority.unrootedPaths,
      ) ===
        JSON.stringify([
          '$',
        ]),
      'unknown root was guessed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.1: nested compound tree roots each leaf reference independently',
  () => {
    const source =
      pipeline({
        x:
          binding({
            future_group: [
              {
                op:
                  'first-op',

                left: {
                  ref:
                    'x.a',
                },
              },
              {
                inner_group: [
                  {
                    op:
                      'second-op',

                    left: {
                      ref:
                        'x.b.c',
                    },
                  },
                ],
              },
            ],
          }),
      });


    const result =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        source.whereShapes,
        source.bindings,
      );


    const sites =
      result.authorities[0]
        ?.referenceSites;


    assert(
      sites?.length ===
        2 &&
      sites.every(
        (site) =>
          site.rootBindingName ===
            'x',
      ) &&
      sites.some(
        (site) =>
          site.opaqueSuffix ===
            '.a',
      ) &&
      sites.some(
        (site) =>
          site.opaqueSuffix ===
            '.b.c',
      ),
      'nested leaf references not independently rooted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.1: leaf without left.ref creates no invented reference site',
  () => {
    const source =
      pipeline({
        x:
          binding({
            op:
              'future-op',

            left: {
              value:
                'not-a-ref',
            },
          }),
      });


    const result =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        source.whereShapes,
        source.bindings,
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities[0]
        ?.referenceSites.length ===
        0,
      'reference expression was invented',
    );
  },
);


Deno.test(
  'v1.46 A3.3.1: duplicate binding name in exact manifest authority set blocks ambiguity',
  () => {
    const source =
      pipeline({
        x:
          binding({
            op:
              'future-op',

            left: {
              ref:
                'x.a',
            },
          }),
      });


    const original =
      source.bindings[0];


    assert(
      original !==
        undefined,
      'binding fixture missing',
    );


    const duplicate = {
      ...original,

      id:
        `${original.id}:duplicate`,
    } as CanonicalRuntimeBindingDefinitionAuthorityV1;


    const result =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        source.whereShapes,
        [
          ...source.bindings,
          duplicate,
        ],
      );


    assert(
      result.status ===
        'blocked' &&
      result.authorities.length ===
        0,
      'duplicate binding root ambiguity accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.1: mismatched where-shape owner snapshot blocks whole boundary',
  () => {
    const source =
      pipeline({
        x:
          binding({
            op:
              'future-op',

            left: {
              ref:
                'x.a',
            },
          }),
      });


    const shape =
      source.whereShapes[0];


    assert(
      shape !==
        undefined,
      'where-shape fixture missing',
    );


    const malformed = {
      ...shape,

      manifestCode:
        'wrong.manifest.code',
    };


    const result =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        [
          malformed,
        ],
        source.bindings,
      );


    assert(
      result.status ===
        'blocked',
      'stale where-shape snapshot accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.1: deterministic rooting performs no suffix traversal operator graph scope cardinality binding or dependency execution',
  () => {
    const source =
      pipeline({
        adj:
          binding({
            future_group: [
              {
                op:
                  'future-op',

                left: {
                  ref:
                    'adj.features.Deep.Value',
                },

                right: {
                  z:
                    1,

                  a:
                    2,
                },
              },
            ],
          }),

        controller:
          binding({
            op:
              'future-op',

            left: {
              ref:
                'adj.node',
            },
          }),
      });


    const x =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        source.whereShapes,
        source.bindings,
      );


    const y =
      deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
        [
          ...source.whereShapes,
        ].reverse(),

        [
          ...source.bindings,
        ].reverse(),
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'A3.3.1 not deterministic',
    );


    assert(
      x.authorities.every(
        (authority) => {
          const g =
            authority.governance;


          return (
            g.manifestLocalBindingRootsOnly ===
              true &&
            g.longestExactBindingPrefixWins ===
              true &&
            g.runtimeBindingVocabularyHardcoded ===
              false &&
            g.dottedReferenceTraversalPerformed ===
              false &&
            g.suffixSemanticsResolved ===
              false &&
            g.referenceValueResolved ===
              false &&
            g.operatorSemanticsResolved ===
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
              false
          );
        },
      ),
      'A3.3.1 crossed reference-root boundary',
    );
  },
);