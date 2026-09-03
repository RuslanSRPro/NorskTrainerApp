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
  buildCanonicalConstructionProjectionsFromFrozenGrammarV1,
  type CanonicalConstructionMorphRegistryEntryV1,
  type CanonicalFrozenGrammarFactV1,
} from './canonical-construction-projection-adapter-v1.ts';

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const CONSTRUCTION:
  CanonicalFrozenGrammarFactV1 = {
    candidateId: 'source:compound',
    candidateCode:
      'verb.compound_form.finite_aux_nonfinite_main',
    sourceSection: '7.2',
    status: 'source_verified',
    requiresHumanVerification: false,

    extractedPayload: {
      language: 'no',

      candidate_code:
        'verb.compound_form.finite_aux_nonfinite_main',

      source_section: '7.2',

      construction:
        'compound_verbal_form',

      finite_role: 'auxiliary',
      nonfinite_role: 'main_verb',

      allowed_nonfinite_forms: [
        'infinitive',
        'past_participle',
      ],
    },

    digitalModel: {
      model: {
        type:
          'construction_compatibility',
        subtype:
          'finite_auxiliary_nonfinite_main_verb',
        version: 1,
      },
    },

    executionContract: {
      audit: {
        version: 1,
        disposition:
          'KEEP_GRAMMAR_RUNTIME',
      },

      execution: {
        role: 'construction',

        consumed_by: [
          'construction_resolution',
          'predicate_builder',
        ],
      },

      placement: {
        target_layers: ['runtime'],
      },
    },
  };

const FINITE_INVENTORY:
  CanonicalFrozenGrammarFactV1 = {
    candidateId:
      'source:finite-inventory',

    candidateCode:
      'verb.form.finite.inventory',

    sourceSection: '7.1.2',

    status: 'source_verified',
    requiresHumanVerification: false,

    extractedPayload: {
      candidate_code:
        'verb.form.finite.inventory',

      source_section: '7.1.2',

      form_types: [
        'present',
        'past',
        'imperative',
      ],
    },
  };

const NONFINITE_INVENTORY:
  CanonicalFrozenGrammarFactV1 = {
    candidateId:
      'source:nonfinite-inventory',

    candidateCode:
      'verb.form.nonfinite.inventory',

    sourceSection: '7.1.2',

    status: 'source_verified',
    requiresHumanVerification: false,

    extractedPayload: {
      candidate_code:
        'verb.form.nonfinite.inventory',

      source_section: '7.1.2',

      form_types: [
        'infinitive',
        'past_participle',
      ],
    },
  };

const MORPH_REGISTRY:
  CanonicalConstructionMorphRegistryEntryV1[] =
    [
      {
        pos: 'verb',
        form_key: 'present',
        form_scope: 'token',
        canonical_features: {
          VerbForm: 'Fin',
          Tense: 'Pres',
        },
      },

      {
        pos: 'verb',
        form_key: 'past',
        form_scope: 'token',
        canonical_features: {
          VerbForm: 'Fin',
          Tense: 'Past',
        },
      },

      {
        pos: 'verb',
        form_key: 'imperative',
        form_scope: 'token',
        canonical_features: {
          Mood: 'Imp',
          VerbForm: 'Fin',
        },
      },

      {
        pos: 'verb',
        form_key: 'infinitive',
        form_scope: 'token',
        canonical_features: {
          VerbForm: 'Inf',
        },
      },

      {
        pos: 'verb',
        form_key: 'past_participle',
        form_scope: 'token',
        canonical_features: {
          Tense: 'Past',
          VerbForm: 'Part',
        },
      },

      // Negative-control registry entry.
      {
        pos: 'verb',
        form_key: 'present_participle',
        form_scope: 'token',
        canonical_features: {
          Tense: 'Pres',
          VerbForm: 'Part',
        },
      },
    ];

function buildAdapter(
  overrides: Partial<{
    construction:
      CanonicalFrozenGrammarFactV1;

    finite:
      CanonicalFrozenGrammarFactV1;

    nonfinite:
      CanonicalFrozenGrammarFactV1;

    registry:
      CanonicalConstructionMorphRegistryEntryV1[];
  }> = {},
) {
  return buildCanonicalConstructionProjectionsFromFrozenGrammarV1({
    constructionSource:
      overrides.construction ??
      CONSTRUCTION,

    finiteInventory:
      overrides.finite ??
      FINITE_INVENTORY,

    nonfiniteInventory:
      overrides.nonfinite ??
      NONFINITE_INVENTORY,

    morphRegistry:
      overrides.registry ??
      MORPH_REGISTRY,
  });
}

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

function morphGraph(
  text: string,
  rows: Array<{
    surface: string;
    features:
      Record<string, unknown>;
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
          `morph:test:${index}:${token.id}`;

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
            'prov:test:morph',
          ],
        };
      });

  const patch: GraphPatchV1 = {
    producer:
      'canonical_candidate_lattice_v1',

    producerVersion: '1',

    nodes,

    evidence:
      nodes.map((node) => ({
        id: node.evidenceIds[0],

        kind: 'morphological',
        status: 'supports',

        targetIds: [node.id],

        payload: {
          test: true,
        },

        producer:
          'canonical_candidate_lattice_v1',

        provenanceIds: [
          'prov:test:morph',
        ],
      })),

    provenance: [{
      id: 'prov:test:morph',
      sourceType: 'system',
      sourceId: 'test',
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
  'v1.44 construction A2: frozen data produces two nonfinite projections',
  () => {
    const result = buildAdapter();

    assert(
      result.status === 'ready',
      result.blockingReasons.join(', '),
    );

    assert(
      result.projections.length === 2,
      `projections=${result.projections.length}`,
    );

    // CanonicalConstructionProjectionV1 has no free-form grammar
    // `features` field by contract. The TypeScript type itself prevents
    // the adapter from smuggling additional grammar payload here.
  },
);


Deno.test(
  'v1.44 construction A2: finite feature is derived as registry intersection',
  () => {
    const result = buildAdapter();

    assert(
      result.status === 'ready',
      'adapter blocked',
    );

    for (
      const projection of
        result.projections
    ) {
      const finite =
        projection.bindings.finite;

      const where =
        finite.where as {
          op?: string;
          right?: string;
        };

      assert(
        where.op === 'has_feature',
        'finite intersection must reduce to one canonical feature',
      );

      assert(
        where.right === 'VerbForm=Fin',
        `finite feature=${where.right}`,
      );

      assert(
        finite.required_pos === 'verb',
        `finite required_pos=${finite.required_pos}`,
      );
    }
  },
);


Deno.test(
  'v1.44 construction A2: nonfinite source labels are translated through registry data',
  () => {
    const result = buildAdapter();

    const serialized =
      result.projections.map(
        (projection) =>
          JSON.stringify(
            projection.bindings.nonfinite.where,
          ),
      );

    assert(
      serialized.some(
        (value) =>
          value.includes(
            'VerbForm=Inf',
          ),
      ),
      'infinitive registry mapping missing',
    );

    assert(
      serialized.some(
        (value) =>
          value.includes(
            'VerbForm=Part',
          ) &&
          value.includes(
            'Tense=Past',
          ),
      ),
      'past participle registry mapping missing',
    );
  },
);


Deno.test(
  'v1.44 construction A2: generated projections execute in canonical A1',
  () => {
    const result = buildAdapter();

    assert(
      result.status === 'ready',
      'adapter blocked',
    );

    const infGraph =
      morphGraph(
        'har skrive',
        [
          {
            surface: 'har',
            features: {
              VerbForm: 'Fin',
              Tense: 'Pres',
            },
          },
          {
            surface: 'skrive',
            features: {
              VerbForm: 'Inf',
            },
          },
        ],
      );

    const partGraph =
      morphGraph(
        'har skrevet',
        [
          {
            surface: 'har',
            features: {
              VerbForm: 'Fin',
              Tense: 'Pres',
            },
          },
          {
            surface: 'skrevet',
            features: {
              VerbForm: 'Part',
              Tense: 'Past',
            },
          },
        ],
      );

    const infPatch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        infGraph,
        result.projections,
      );

    const partPatch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        partGraph,
        result.projections,
      );

    assert(
      (infPatch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'construction',
        )
        .length === 1,
      'Inf construction missing',
    );

    assert(
      (partPatch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'construction',
        )
        .length === 1,
      'past participle construction missing',
    );
  },
);


Deno.test(
  'v1.44 construction A2: present participle is not silently accepted',
  () => {
    const result = buildAdapter();

    const graph =
      morphGraph(
        'har skrivende',
        [
          {
            surface: 'har',
            features: {
              VerbForm: 'Fin',
              Tense: 'Pres',
            },
          },
          {
            surface: 'skrivende',
            features: {
              VerbForm: 'Part',
              Tense: 'Pres',
            },
          },
        ],
      );

    const patch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph,
        result.projections,
      );

    assert(
      (patch.nodes ?? [])
        .filter(
          (node) =>
            node.type ===
              'construction',
        )
        .length === 0,
      'present participle incorrectly matched',
    );
  },
);


Deno.test(
  'v1.44 construction A2: incomplete frozen source blocks instead of guessing',
  () => {
    const broken:
      CanonicalFrozenGrammarFactV1 = {
        ...CONSTRUCTION,

        candidateId:
          'source:broken',

        candidateCode:
          'test.source.broken',

        extractedPayload: {
          ...CONSTRUCTION
            .extractedPayload,

          candidate_code:
            'test.source.broken',

          finite_role: undefined,
        },
      };

    const result =
      buildAdapter({
        construction: broken,
      });

    assert(
      result.status === 'blocked',
      'incomplete source was guessed',
    );

    assert(
      result.projections.length === 0,
      'blocked source produced projections',
    );

    assert(
      result.blockingReasons.some(
        (reason) =>
          reason.endsWith(
            ':finite_role_missing',
          ),
      ),
      `reasons=${result.blockingReasons.join(',')}`,
    );
  },
);


Deno.test(
  'v1.44 construction A2: missing registry form blocks instead of hardcoding morphology',
  () => {
    const registry =
      MORPH_REGISTRY.filter(
        (entry) =>
          entry.form_key !==
            'imperative',
      );

    const result =
      buildAdapter({
        registry,
      });

    assert(
      result.status === 'blocked',
      'missing registry evidence was ignored',
    );

    assert(
      result.blockingReasons.includes(
        'morph_registry:imperative:missing_or_ambiguous',
      ),
      `reasons=${result.blockingReasons.join(',')}`,
    );
  },
);


Deno.test(
  'v1.44 construction A2: adapter is candidate-code agnostic',
  () => {
    const source:
      CanonicalFrozenGrammarFactV1 = {
        ...CONSTRUCTION,

        candidateId:
          'source:other',

        candidateCode:
          'test.other.source',

        extractedPayload: {
          ...CONSTRUCTION
            .extractedPayload,

          candidate_code:
            'test.other.source',
        },
      };

    const result =
      buildAdapter({
        construction: source,
      });

    assert(
      result.status === 'ready',
      result.blockingReasons.join(', '),
    );

    assert(
      result.sourceCandidateCodes.includes(
        'test.other.source',
      ),
      'adapter hardcoded NRG candidate code',
    );
  },
);