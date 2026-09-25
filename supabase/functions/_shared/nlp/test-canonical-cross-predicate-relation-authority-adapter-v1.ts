import {
  buildCanonicalCrossPredicateRelationAuthorityPatchV1,
  CANONICAL_CROSS_PREDICATE_RELATION_AUTHORITY_ADAPTER_V1_PRODUCER,
} from './canonical-cross-predicate-relation-authority-adapter-v1.ts';

import type {
  CanonicalCrossPredicateAttachmentRelationCandidateV1,
} from './canonical-cross-predicate-attachment-ownership-bridge-v1.ts';


function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}


function candidate(
  overrides:
    Partial<CanonicalCrossPredicateAttachmentRelationCandidateV1> = {},
): CanonicalCrossPredicateAttachmentRelationCandidateV1 {
  return {
    id:
      'cross-predicate-attachment:attachment:1:ownership:1',

    producer:
      'canonical_cross_predicate_attachment_ownership_bridge_v1',

    version:
      '1',

    status:
      'candidate',

    relation:
      'ccomp',

    matrixPredicateId:
      'predicate:matrix',

    embeddedPredicateId:
      'predicate:embedded',

    embeddedClauseId:
      'clause:embedded',

    attachmentEdgeId:
      'edge:attachment:1',

    predicateOwnershipEdgeId:
      'edge:predicate_of_clause:1',

    evidenceIds:
      ['evidence:attachment', 'evidence:ownership'],

    provenanceIds:
      ['prov:attachment', 'prov:ownership'],

    ...overrides,
  };
}


Deno.test(
  'v1.49 A3: A2 candidate projects to candidate predicate-to-predicate canonical edge',
  () => {
    const input =
      candidate();

    const patch =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [input],
      );

    assert(
      patch.edges?.length === 1,
      'expected exactly one projected edge',
    );

    const edge =
      patch.edges[0];

    assert(
      edge.sourceId === input.matrixPredicateId,
      'matrix predicate identity changed',
    );

    assert(
      edge.targetId === input.embeddedPredicateId,
      'embedded predicate identity changed',
    );

    assert(
      edge.status === 'candidate',
      'adapter promoted candidate semantics',
    );

    assert(
      edge.producer ===
        CANONICAL_CROSS_PREDICATE_RELATION_AUTHORITY_ADAPTER_V1_PRODUCER,
      'wrong edge producer',
    );
  },
);


Deno.test(
  'v1.49 A3: relation is transported opaquely',
  () => {
    const input =
      candidate({
        relation:
          'future_nonlocal_relation_xyz',
      });

    const patch =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [input],
      );

    assert(
      patch.edges?.[0]?.relation ===
        'future_nonlocal_relation_xyz',
      'adapter interpreted or renamed relation',
    );
  },
);


Deno.test(
  'v1.49 A3: exact source occurrence identities are preserved in edge features',
  () => {
    const input =
      candidate();

    const edge =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [input],
      ).edges?.[0];

    assert(
      edge?.features.bridgeCandidateId ===
        input.id,
      'bridge candidate occurrence lost',
    );

    assert(
      edge?.features.embeddedClauseId ===
        input.embeddedClauseId,
      'embedded clause identity lost',
    );

    assert(
      edge?.features.attachmentEdgeId ===
        input.attachmentEdgeId,
      'attachment occurrence identity lost',
    );

    assert(
      edge?.features.predicateOwnershipEdgeId ===
        input.predicateOwnershipEdgeId,
      'ownership occurrence identity lost',
    );
  },
);


Deno.test(
  'v1.49 A3: evidence and provenance IDs pass through unchanged',
  () => {
    const input =
      candidate({
        evidenceIds:
          ['e:1', 'e:2'],

        provenanceIds:
          ['p:1', 'p:2'],
      });

    const edge =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [input],
      ).edges?.[0];

    assert(
      JSON.stringify(edge?.evidenceIds) ===
        JSON.stringify(input.evidenceIds),
      'evidence IDs changed',
    );

    assert(
      JSON.stringify(edge?.provenanceIds) ===
        JSON.stringify(input.provenanceIds),
      'provenance IDs changed',
    );

    assert(
      edge?.evidenceIds !== input.evidenceIds,
      'adapter reused mutable evidence array',
    );

    assert(
      edge?.provenanceIds !== input.provenanceIds,
      'adapter reused mutable provenance array',
    );
  },
);


Deno.test(
  'v1.49 A3: adapter does not fabricate evidence or provenance objects',
  () => {
    const patch =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [candidate()],
      );

    assert(
      patch.evidence === undefined,
      'adapter fabricated evidence objects',
    );

    assert(
      patch.provenance === undefined,
      'adapter fabricated provenance objects',
    );
  },
);


Deno.test(
  'v1.49 A3: projected edge identity is deterministic and occurrence-sensitive',
  () => {
    const first =
      candidate({
        id: 'candidate:occurrence:1',
      });

    const second =
      candidate({
        id: 'candidate:occurrence:2',
      });

    const firstId =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [first],
      ).edges?.[0]?.id;

    const repeatedId =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [first],
      ).edges?.[0]?.id;

    const secondId =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [second],
      ).edges?.[0]?.id;

    assert(
      firstId === repeatedId,
      'same occurrence produced unstable edge identity',
    );

    assert(
      firstId !== secondId,
      'distinct bridge occurrences collapsed',
    );
  },
);


Deno.test(
  'v1.49 A3: multiple candidates remain distinct canonical edges',
  () => {
    const first =
      candidate({
        id: 'candidate:1',
      });

    const second =
      candidate({
        id: 'candidate:2',
        attachmentEdgeId:
          'edge:attachment:2',
      });

    const patch =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [first, second],
      );

    assert(
      patch.edges?.length === 2,
      'candidate occurrences collapsed',
    );

    assert(
      patch.edges[0].id !== patch.edges[1].id,
      'edge occurrence IDs collided',
    );
  },
);


Deno.test(
  'v1.49 A3: empty candidate set yields empty edge patch',
  () => {
    const patch =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [],
      );

    assert(
      Array.isArray(patch.edges),
      'edges field missing',
    );

    assert(
      patch.edges.length === 0,
      'empty input produced facts',
    );
  },
);


Deno.test(
  'v1.49 A3: input candidates are not mutated',
  () => {
    const input =
      candidate();

    const before =
      JSON.stringify(input);

    buildCanonicalCrossPredicateRelationAuthorityPatchV1(
      [input],
    );

    assert(
      JSON.stringify(input) === before,
      'adapter mutated A2 candidate',
    );
  },
);


Deno.test(
  'v1.49 A3: GraphPatch producer and version are explicit',
  () => {
    const patch =
      buildCanonicalCrossPredicateRelationAuthorityPatchV1(
        [candidate()],
      );

    assert(
      patch.producer ===
        CANONICAL_CROSS_PREDICATE_RELATION_AUTHORITY_ADAPTER_V1_PRODUCER,
      'wrong patch producer',
    );

    assert(
      patch.producerVersion === '1',
      'wrong patch producer version',
    );
  },
);
