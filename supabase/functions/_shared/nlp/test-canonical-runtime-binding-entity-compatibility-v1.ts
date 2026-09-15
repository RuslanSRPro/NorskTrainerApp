import {
  deriveCanonicalDependencyRuntimeAuthoritiesV1,
  type CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from './canonical-dependency-runtime-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1,
} from './canonical-runtime-binding-definition-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingEntityCompatibilitiesV1,
  type CanonicalGraphNodeTypeAuthorityV1,
} from './canonical-runtime-binding-entity-compatibility-v1.ts';


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


function canonicalAuthority(
  nodeType:
    CanonicalGraphNodeTypeAuthorityV1['nodeType'],
): CanonicalGraphNodeTypeAuthorityV1 {
  return {
    authorityId:
      `core-node-type:${nodeType}`,

    status:
      'proven',

    nodeType,

    source:
      'canonical_language_graph_core_v1',
  };
}


function row(
  entityLabel:
    string,
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

    actions: [
      {
        action:
          'create_dependency',

        relation:
          'opaque-relation',

        target:
          'x',

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
          'source.primary',
      },

      bindings: {
        x: {
          entity:
            entityLabel,

          scope:
            'opaque-scope',

          cardinality:
            'opaque-cardinality',

          where: {
            op:
              'opaque-op',
          },
        },
      },
    },
  };
}


function bindingAuthorities(
  source:
    CanonicalDependencyRuntimeManifestAuthorityRowV1,
) {
  const a0 =
    deriveCanonicalDependencyRuntimeAuthoritiesV1([
      source,
    ]);


  assert(
    a0.status ===
      'ready',
    'A0 setup failed',
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
    'A3.0 setup failed',
  );


  return a30.authorities;
}


Deno.test(
  'v1.46 A3.1: exact runtime entity label may become compatibility candidate',
  () => {
    const bindings =
      bindingAuthorities(
        row(
          'phrase',
        ),
      );


    const result =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        bindings,
        [
          canonicalAuthority(
            'phrase',
          ),
        ],
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        1,
      'exact compatibility missing',
    );


    assert(
      result.candidates[0]
        .runtimeEntityLabel ===
        'phrase' &&
      result.candidates[0]
        .canonicalNodeType ===
        'phrase',
      'opaque labels changed',
    );
  },
);


Deno.test(
  'v1.46 A3.1: multiple canonical node types remain independent authority vocabulary',
  () => {
    const result =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        bindingAuthorities(
          row(
            'token',
          ),
        ),
        [
          canonicalAuthority(
            'phrase',
          ),
          canonicalAuthority(
            'token',
          ),
          canonicalAuthority(
            'clause',
          ),
          canonicalAuthority(
            'span',
          ),
        ],
      );


    assert(
      result.candidates.length ===
        1 &&
      result.candidates[0]
        .canonicalNodeType ===
        'token',
      'exact node-type match failed',
    );
  },
);


Deno.test(
  'v1.46 A3.1: runtime candidate label remains unmapped when canonical node vocabulary has no exact label',
  () => {
    const bindings =
      bindingAuthorities(
        row(
          'candidate',
        ),
      );


    const result =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        bindings,
        [
          canonicalAuthority(
            'phrase',
          ),
          canonicalAuthority(
            'token',
          ),
        ],
      );


    assert(
      result.candidates.length ===
        0 &&
      result.unmappedBindingDefinitionAuthorityIds.length ===
        1,
      'runtime candidate was confused with graph candidate status',
    );
  },
);


Deno.test(
  'v1.46 A3.1: runtime graph_node remains unmapped without explicit canonical node-type authority',
  () => {
    const result =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        bindingAuthorities(
          row(
            'graph_node',
          ),
        ),
        [
          canonicalAuthority(
            'phrase',
          ),
          canonicalAuthority(
            'token',
          ),
          canonicalAuthority(
            'clause',
          ),
        ],
      );


    assert(
      result.candidates.length ===
        0 &&
      result.unmappedBindingDefinitionAuthorityIds.length ===
        1,
      'graph_node was assumed to mean any graph node',
    );
  },
);


Deno.test(
  'v1.46 A3.1: matching is exact and performs no case folding',
  () => {
    const result =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        bindingAuthorities(
          row(
            'Phrase',
          ),
        ),
        [
          canonicalAuthority(
            'phrase',
          ),
        ],
      );


    assert(
      result.candidates.length ===
        0,
      'case-folded entity label match occurred',
    );
  },
);


Deno.test(
  'v1.46 A3.1: duplicate canonical authority for same node type blocks boundary',
  () => {
    const authority =
      canonicalAuthority(
        'phrase',
      );


    const result =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        bindingAuthorities(
          row(
            'phrase',
          ),
        ),
        [
          authority,
          {
            ...authority,

            authorityId:
              'another-authority',
          },
        ],
      );


    assert(
      result.status ===
        'blocked' &&
      result.candidates.length ===
        0,
      'ambiguous canonical authority accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.1: malformed canonical node-type authority blocks boundary',
  () => {
    const malformed = {
      authorityId:
        '',

      status:
        'proven',

      nodeType:
        'phrase',

      source:
        'canonical_language_graph_core_v1',
    } as unknown as CanonicalGraphNodeTypeAuthorityV1;


    const result =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        bindingAuthorities(
          row(
            'phrase',
          ),
        ),
        [
          malformed,
        ],
      );


    assert(
      result.status ===
        'blocked',
      'malformed canonical authority accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.1: duplicate binding authority identity blocks boundary',
  () => {
    const bindings =
      bindingAuthorities(
        row(
          'phrase',
        ),
      );


    const result =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        [
          bindings[0],
          bindings[0],
        ],
        [
          canonicalAuthority(
            'phrase',
          ),
        ],
      );


    assert(
      result.status ===
        'blocked',
      'duplicate binding authority accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.1: future unmatched runtime entity remains unmapped without guessing',
  () => {
    const result =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        bindingAuthorities(
          row(
            'future-runtime-entity',
          ),
        ),
        [
          canonicalAuthority(
            'phrase',
          ),
          canonicalAuthority(
            'predicate',
          ),
        ],
      );


    assert(
      result.status ===
        'ready' &&
      result.candidates.length ===
        0 &&
      result.unmappedBindingDefinitionAuthorityIds.length ===
        1,
      'future runtime entity was guessed',
    );
  },
);


Deno.test(
  'v1.46 A3.1: deterministic compatibility performs no occurrence or dependency semantics',
  () => {
    const bindings =
      bindingAuthorities(
        row(
          'clause',
        ),
      );


    const authorities = [
      canonicalAuthority(
        'token',
      ),
      canonicalAuthority(
        'clause',
      ),
      canonicalAuthority(
        'phrase',
      ),
    ];


    const x =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        bindings,
        authorities,
      );


    const y =
      deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
        [
          ...bindings,
        ].reverse(),
        [
          ...authorities,
        ].reverse(),
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'A3.1 not deterministic',
    );


    assert(
      x.candidates.every(
        (candidate) =>
          candidate.status ===
            'candidate' &&
          candidate.governance
            .exactOpaqueLabelMatch ===
            true &&
          candidate.governance
            .runtimeEntityVocabularyHardcoded ===
            false &&
          candidate.governance
            .canonicalNodeTypeInferredFromName ===
            false &&
          candidate.governance
            .entitySemanticsResolved ===
            false &&
          candidate.governance
            .occurrenceDomainResolved ===
            false &&
          candidate.governance
            .occurrenceEnumerationPerformed ===
            false &&
          candidate.governance
            .scopeSemanticsResolved ===
            false &&
          candidate.governance
            .whereSemanticsResolved ===
            false &&
          candidate.governance
            .cardinalitySemanticsResolved ===
            false &&
          candidate.governance
            .occurrenceBindingPerformed ===
            false &&
          candidate.governance
            .dependencyDirectionResolved ===
            false &&
          candidate.governance
            .canonicalEdgeGenerated ===
            false &&
          candidate.governance
            .realizesSlotGenerated ===
            false &&
          candidate.governance
            .compatibilityOnly ===
            true,
      ),
      'A3.1 crossed compatibility boundary',
    );
  },
);