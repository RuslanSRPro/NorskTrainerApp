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
  buildCanonicalConstructionCandidateLatticePatchV1,
  summarizeCanonicalConstructionCandidateLatticePatchV1,
  type CanonicalConstructionProjectionV1,
} from './canonical-construction-candidate-lattice-v1.ts';

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

function tokenBySurface(
  graph: CanonicalLanguageGraphV1,
  surface: string,
  occurrence = 0,
): LanguageGraphNodeV1 {
  const matches = graph.nodes.filter(
    (node) =>
      node.type === 'token' &&
      node.features.surface === surface,
  );

  const node = matches[occurrence];

  if (!node) {
    throw new Error(
      `token not found: ${surface}[${occurrence}]`,
    );
  }

  return node;
}

type MorphRow = {
  surface: string;
  features: Record<string, unknown>;
  status?:
    | 'candidate'
    | 'resolved'
    | 'ambiguous'
    | 'rejected'
    | 'blocked';
  suffix?: string;
  occurrence?: number;
};

function morphPatch(
  graph: CanonicalLanguageGraphV1,
  rows: readonly MorphRow[],
): GraphPatchV1 {
  const nodes: LanguageGraphNodeV1[] =
    rows.map((row, index) => {
      const token = tokenBySurface(
        graph,
        row.surface,
        row.occurrence ?? 0,
      );

      const id = [
        'morphcand',
        token.id,
        row.suffix ?? String(index),
      ].join(':');

      return {
        id,
        type: 'morph_reading',
        subtype: 'verb',
        status: row.status ?? 'candidate',
        span: { ...token.span },

        features: {
          pos: 'verb',
          canonicalFeatures: {
            ...row.features,
          },
        },

        producer: 'canonical_candidate_lattice_v1',

        evidenceIds: [`evidence:${id}`],
        provenanceIds: ['prov:test:morph'],
      };
    });

  return {
    producer: 'canonical_candidate_lattice_v1',
    producerVersion: '1',

    nodes,

    evidence: nodes.map((node) => ({
      id: node.evidenceIds[0],
      kind: 'morphological',
      status: 'supports',
      targetIds: [node.id],
      payload: { test: true },
      producer: 'canonical_candidate_lattice_v1',
      provenanceIds: ['prov:test:morph'],
    })),

    provenance: [{
      id: 'prov:test:morph',
      sourceType: 'system',
      sourceId: 'test',
    }],
  };
}

function buildGraph(
  text: string,
  rows: readonly MorphRow[],
): CanonicalLanguageGraphV1 {
  const surface =
    buildCanonicalSurfaceDocumentV1(text);

  let graph =
    createCanonicalLanguageGraphV1(surface);

  graph = applyGraphPatchV1(
    graph,
    morphPatch(graph, rows),
  );

  return graph;
}

// Mechanics fixture only.
//
// It represents a read-only execution projection from frozen source
// knowledge. It is NOT inserted into grammar_rules or Grammar KB.
const FIN_INF_PROJECTION:
  CanonicalConstructionProjectionV1 = {

  projectionId:
    'projection:test:finite-nonfinite:inf',

  projectionCode:
    'test_projection.finite_nonfinite.inf',

  constructionType:
    'finite_nonfinite_compound_structure',

  executionRole: 'construction',

  bindings: {
    finite: {
      scope: 'sentence',
      entity: 'candidate',
      cardinality: 'one_or_more',

      where: {
        op: 'has_feature',
        left: { ref: 'finite.morph' },
        right: 'VerbForm=Fin',
      },
    },

    nonfinite: {
      scope: 'sentence',
      entity: 'candidate',
      cardinality: 'one_or_more',

      where: {
        op: 'has_feature',
        left: { ref: 'nonfinite.morph' },
        right: 'VerbForm=Inf',
      },
    },
  },

  memberRefs: ['finite', 'nonfinite'],
  anchorRef: 'finite',

  constraintStrength: 'categorical',

  sourceCandidateCodes: [
    'verb.compound_form.finite_nonfinite.structure',
  ],

  sourceSections: ['7.2'],
};

const FIN_PART_PAST_PROJECTION:
  CanonicalConstructionProjectionV1 = {

  ...FIN_INF_PROJECTION,

  projectionId:
    'projection:test:finite-nonfinite:part-past',

  projectionCode:
    'test_projection.finite_nonfinite.part_past',

  bindings: {
    finite: FIN_INF_PROJECTION.bindings.finite,

    nonfinite: {
      scope: 'sentence',
      entity: 'candidate',
      cardinality: 'one_or_more',

      where: {
        all: [
          {
            op: 'has_feature',
            left: { ref: 'nonfinite.morph' },
            right: 'VerbForm=Part',
          },
          {
            op: 'has_feature',
            left: { ref: 'nonfinite.morph' },
            right: 'Tense=Past',
          },
        ],
      },
    },
  },
};

Deno.test(
  'v1.44 construction A1: source-backed projection creates candidate construction',
  () => {
    const graph = buildGraph(
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

    const patch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph,
        [FIN_INF_PROJECTION],
      );

    const summary =
      summarizeCanonicalConstructionCandidateLatticePatchV1(
        patch,
      );

    assert(
      summary.constructionNodes === 1,
      `constructionNodes=${summary.constructionNodes}`,
    );

    assert(
      summary.constructionTypes
        .finite_nonfinite_compound_structure === 1,
      'compound construction missing',
    );

    assert(
      summary.memberEdges === 2,
      `memberEdges=${summary.memberEdges}`,
    );

    assert(
      summary.resolvedFacts === 0,
      `resolvedFacts=${summary.resolvedFacts}`,
    );

    const construction =
      (patch.nodes ?? []).find(
        (node) =>
          node.type === 'construction',
      );

    assert(
      construction?.status === 'candidate',
      'construction must remain candidate',
    );

    assert(
      construction?.features
        .frozenGrammarReadOnly === true,
      'frozen grammar read-only marker missing',
    );

    assert(
      (patch.alternativeSets ?? [])[0]
        ?.status === 'open',
      'construction alternative must stay open',
    );
  },
);

Deno.test(
  'v1.44 construction A1: producer does not create phrase or predicate facts',
  () => {
    const graph = buildGraph(
      'har skrive',
      [
        {
          surface: 'har',
          features: { VerbForm: 'Fin' },
        },
        {
          surface: 'skrive',
          features: { VerbForm: 'Inf' },
        },
      ],
    );

    const patch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph,
        [FIN_INF_PROJECTION],
      );

    assert(
      !(patch.nodes ?? []).some(
        (node) =>
          node.type === 'phrase' ||
          node.type === 'predicate',
      ),
      'construction producer crossed ownership boundary',
    );
  },
);

Deno.test(
  'v1.44 construction A1: no word-order assumption is hidden in TypeScript',
  () => {
    const graph = buildGraph(
      'skrive har',
      [
        {
          surface: 'skrive',
          features: { VerbForm: 'Inf' },
        },
        {
          surface: 'har',
          features: { VerbForm: 'Fin' },
        },
      ],
    );

    const patch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph,
        [FIN_INF_PROJECTION],
      );

    const constructions =
      (patch.nodes ?? []).filter(
        (node) =>
          node.type === 'construction',
      );

    assert(
      constructions.length === 1,
      `generic operator encoded order: ${constructions.length}`,
    );
  },
);

Deno.test(
  'v1.44 construction A1: same anchor may retain multiple structural candidates',
  () => {
    const graph = buildGraph(
      'har skrive lese',
      [
        {
          surface: 'har',
          features: { VerbForm: 'Fin' },
        },
        {
          surface: 'skrive',
          features: { VerbForm: 'Inf' },
        },
        {
          surface: 'lese',
          features: { VerbForm: 'Inf' },
        },
      ],
    );

    const patch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph,
        [FIN_INF_PROJECTION],
      );

    const constructions =
      (patch.nodes ?? []).filter(
        (node) =>
          node.type === 'construction',
      );

    assert(
      constructions.length === 2,
      `construction alternatives=${constructions.length}`,
    );

    const alt =
      (patch.alternativeSets ?? []).find(
        (set) =>
          set.memberIds.length === 2,
      );

    assert(
      alt?.status === 'open',
      'ambiguous construction set must remain open',
    );
  },
);

Deno.test(
  'v1.44 construction A1: candidate never crosses sentence boundary',
  () => {
    const graph = buildGraph(
      'har. skrive',
      [
        {
          surface: 'har',
          features: { VerbForm: 'Fin' },
        },
        {
          surface: 'skrive',
          features: { VerbForm: 'Inf' },
        },
      ],
    );

    const patch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph,
        [FIN_INF_PROJECTION],
      );

    assert(
      (patch.nodes ?? []).filter(
        (node) =>
          node.type === 'construction',
      ).length === 0,
      'construction crossed sentence boundary',
    );
  },
);

Deno.test(
  'v1.44 construction A1: rejected and blocked members are ignored',
  () => {
    for (
      const status of
        ['rejected', 'blocked'] as const
    ) {
      const graph = buildGraph(
        'har skrive',
        [
          {
            surface: 'har',
            features: { VerbForm: 'Fin' },
          },
          {
            surface: 'skrive',
            features: { VerbForm: 'Inf' },
            status,
          },
        ],
      );

      const patch =
        buildCanonicalConstructionCandidateLatticePatchV1(
          graph,
          [FIN_INF_PROJECTION],
        );

      assert(
        (patch.nodes ?? []).filter(
          (node) =>
            node.type === 'construction',
        ).length === 0,
        `${status} member generated construction`,
      );
    }
  },
);

Deno.test(
  'v1.44 construction A1: conjunctive morph binding is generic',
  () => {
    const past = buildGraph(
      'har skrevet',
      [
        {
          surface: 'har',
          features: { VerbForm: 'Fin' },
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

    const present = buildGraph(
      'har skrivende',
      [
        {
          surface: 'har',
          features: { VerbForm: 'Fin' },
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

    const pastPatch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        past,
        [FIN_PART_PAST_PROJECTION],
      );

    const presentPatch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        present,
        [FIN_PART_PAST_PROJECTION],
      );

    assert(
      (pastPatch.nodes ?? []).filter(
        (node) =>
          node.type === 'construction',
      ).length === 1,
      'conjunctive matching failed',
    );

    assert(
      (presentPatch.nodes ?? []).filter(
        (node) =>
          node.type === 'construction',
      ).length === 0,
      'partial conjunction incorrectly matched',
    );
  },
);

Deno.test(
  'v1.44 construction A1: projection must be source-backed',
  () => {
    const graph = buildGraph(
      'har skrive',
      [
        {
          surface: 'har',
          features: { VerbForm: 'Fin' },
        },
        {
          surface: 'skrive',
          features: { VerbForm: 'Inf' },
        },
      ],
    );

    const unbacked:
      CanonicalConstructionProjectionV1 = {
        ...FIN_INF_PROJECTION,

        projectionId:
          'projection:test:unbacked',

        projectionCode:
          'test_projection.unbacked',

        sourceCandidateCodes: [],
      };

    const patch =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph,
        [unbacked],
      );

    assert(
      (patch.nodes ?? []).length === 0,
      'unbacked execution projection was accepted',
    );
  },
);

Deno.test(
  'v1.44 construction A1: graph invariants and determinism stay green',
  () => {
    const graph0 = buildGraph(
      'har skrive',
      [
        {
          surface: 'har',
          features: { VerbForm: 'Fin' },
        },
        {
          surface: 'skrive',
          features: { VerbForm: 'Inf' },
        },
      ],
    );

    const a =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph0,
        [FIN_INF_PROJECTION],
      );

    const b =
      buildCanonicalConstructionCandidateLatticePatchV1(
        graph0,
        [FIN_INF_PROJECTION],
      );

    assert(
      JSON.stringify(a) === JSON.stringify(b),
      'construction patch must be deterministic',
    );

    const graph =
      applyGraphPatchV1(graph0, a);

    const errors =
      assertCanonicalLanguageGraphV1(graph);

    assert(
      errors.length === 0,
      `graph invariant errors: ${errors.join(', ')}`,
    );
  },
);