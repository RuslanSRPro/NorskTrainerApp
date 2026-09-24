import {
  applyGraphPatchV1,
  createCanonicalLanguageGraphV1,
  type CanonicalLanguageGraphV1,
  type GraphPatchV1,
  type LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import {
  buildCanonicalSurfaceDocumentV1,
} from './canonical-surface-boundary-v1.ts';

import {
  collectCanonicalTamEvidenceBoundaryV1,
  type CanonicalTamEvidenceFactV1,
} from './canonical-tam-evidence-boundary-v1.ts';

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function baseGraph(
  text = 'har',
): CanonicalLanguageGraphV1 {
  return createCanonicalLanguageGraphV1(
    buildCanonicalSurfaceDocumentV1(text),
  );
}

function token(
  graph: CanonicalLanguageGraphV1,
): LanguageGraphNodeV1 {
  const node =
    graph.nodes.find(
      (item) => item.type === 'token',
    );

  if (!node) {
    throw new Error('token missing');
  }

  return node;
}

function withPredicate(
  graph: CanonicalLanguageGraphV1,
  options: {
    predicateId?: string;
    status?:
      | 'candidate'
      | 'resolved'
      | 'ambiguous'
      | 'blocked'
      | 'rejected';
  } = {},
): {
  graph: CanonicalLanguageGraphV1;
  predicateId: string;
  headTokenId: string;
} {
  const head = token(graph);

  const predicateId =
    options.predicateId ??
      'predicate:test:0';

  const predicate:
    LanguageGraphNodeV1 = {
      id: predicateId,
      type: 'predicate',
      subtype: 'predicate',
      status:
        options.status ??
          'candidate',

      span:
        head.span
          ? { ...head.span }
          : undefined,

      features: {
        role: 'predicate',
        sentenceIndex:
          head.features.sentenceIndex,
        anchorHeadId: head.id,
        realizedByPhraseId:
          'phrase:test:vp',
        candidateGeneration:
          'test_structural_predicate',
      },

      producer:
        'test_predicate_fixture',

      evidenceIds: [],
      provenanceIds: [],
    };

  const patch: GraphPatchV1 = {
    producer:
      'test_predicate_fixture',

    producerVersion:
      '1',

    nodes: [predicate],
    edges: [],
    evidence: [],
    provenance: [],
    alternativeSets: [],
  };

  return {
    graph:
      applyGraphPatchV1(
        graph,
        patch,
      ),

    predicateId,
    headTokenId: head.id,
  };
}

function fact(
  predicateId: string,
  headTokenId: string,
  overrides:
    Partial<CanonicalTamEvidenceFactV1> = {},
): CanonicalTamEvidenceFactV1 {
  return {
    id: 'tam:evidence:1',
    predicateId,
    headTokenId,

    // Deliberately opaque. A1 must not enumerate TAM labels.
    dimension: 'opaque_dimension',
    value: 'opaque_value',

    status: 'resolved',

    sourceIds: [
      'source:test:tam',
    ],

    ...overrides,
  };
}

Deno.test(
  'TAM A1 accepts exact source-backed occurrence as candidate only',
  () => {
    const fixture =
      withPredicate(
        baseGraph(),
      );

    const result =
      collectCanonicalTamEvidenceBoundaryV1(
        fixture.graph,
        [
          fact(
            fixture.predicateId,
            fixture.headTokenId,
          ),
        ],
      );

    assert(
      result.candidates.length === 1,
      'expected one TAM candidate',
    );

    assert(
      result.rejected.length === 0,
      'exact evidence must not be rejected',
    );

    const candidate =
      result.candidates[0];

    assert(
      candidate.status === 'candidate',
      'A1 must never auto-resolve TAM',
    );

    assert(
      candidate.sourceStatus === 'resolved',
      'source certainty must be preserved separately',
    );

    assert(
      candidate.dimension ===
        'opaque_dimension' &&
        candidate.value ===
          'opaque_value',
      'dimension/value must remain opaque and unchanged',
    );
  },
);

Deno.test(
  'TAM A1 rejects evidence for another predicate occurrence',
  () => {
    const first =
      withPredicate(
        baseGraph(),
        {
          predicateId:
            'predicate:test:first',
        },
      );

    const second =
      withPredicate(
        first.graph,
        {
          predicateId:
            'predicate:test:second',
        },
      );

    const result =
      collectCanonicalTamEvidenceBoundaryV1(
        second.graph,
        [
          fact(
            second.predicateId,
            first.headTokenId,
            {
              predicateId:
                'predicate:test:missing',
            },
          ),
        ],
      );

    assert(
      result.candidates.length === 0,
      'cross-occurrence evidence must not become a candidate',
    );

    assert(
      result.rejected.length === 1 &&
      result.rejected[0].reason ===
        'predicate_not_usable',
      'missing exact predicate occurrence must fail closed',
    );
  },
);

Deno.test(
  'TAM A1 rejects mismatched canonical head occurrence',
  () => {
    const surface =
      baseGraph('har gått');

    const fixture =
      withPredicate(surface);

    const otherToken =
      fixture.graph.nodes.find(
        (node) =>
          node.type === 'token' &&
          node.id !==
            fixture.headTokenId,
      );

    assert(
      otherToken,
      'second token missing',
    );

    const result =
      collectCanonicalTamEvidenceBoundaryV1(
        fixture.graph,
        [
          fact(
            fixture.predicateId,
            otherToken.id,
          ),
        ],
      );

    assert(
      result.candidates.length === 0,
      'wrong head occurrence must not pass',
    );

    assert(
      result.rejected.length === 1 &&
      result.rejected[0].reason ===
        'head_occurrence_mismatch',
      'wrong head must fail on exact occurrence binding',
    );
  },
);

Deno.test(
  'TAM A1 rejects evidence without source provenance',
  () => {
    const fixture =
      withPredicate(
        baseGraph(),
      );

    const result =
      collectCanonicalTamEvidenceBoundaryV1(
        fixture.graph,
        [
          fact(
            fixture.predicateId,
            fixture.headTokenId,
            {
              sourceCandidateCodes: [],
              sourceIds: [],
              evidenceIds: [],
              provenanceIds: [],
            },
          ),
        ],
      );

    assert(
      result.candidates.length === 0,
      'unsupported TAM must not be fabricated',
    );

    assert(
      result.rejected.length === 1 &&
      result.rejected[0].reason ===
        'missing_source_provenance',
      'missing provenance must fail closed',
    );
  },
);

Deno.test(
  'TAM A1 rejects blocked source evidence',
  () => {
    const fixture =
      withPredicate(
        baseGraph(),
      );

    const result =
      collectCanonicalTamEvidenceBoundaryV1(
        fixture.graph,
        [
          fact(
            fixture.predicateId,
            fixture.headTokenId,
            {
              status: 'blocked',
            },
          ),
        ],
      );

    assert(
      result.candidates.length === 0,
      'blocked evidence must not become TAM candidate evidence',
    );

    assert(
      result.rejected.length === 1 &&
      result.rejected[0].reason ===
        'unusable_source_status',
      'blocked evidence must fail closed',
    );
  },
);

Deno.test(
  'TAM A1 does not mutate the language graph',
  () => {
    const fixture =
      withPredicate(
        baseGraph(),
      );

    const before =
      JSON.stringify(
        fixture.graph,
      );

    collectCanonicalTamEvidenceBoundaryV1(
      fixture.graph,
      [
        fact(
          fixture.predicateId,
          fixture.headTokenId,
        ),
      ],
    );

    const after =
      JSON.stringify(
        fixture.graph,
      );

    assert(
      after === before,
      'TAM evidence boundary must be read-only',
    );
  },
);

