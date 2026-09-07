import type {
  CanonicalLanguageGraphV1,
  GraphNodeType,
  GraphStatus,
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import {
  readCanonicalNodeTypeOccurrenceInventoryV1,
} from './canonical-node-type-occurrence-inventory-capability-v1.ts';


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


function node(
  id:
    string,

  type:
    GraphNodeType,

  status:
    GraphStatus,
): LanguageGraphNodeV1 {
  return {
    id,

    type,

    status,

    features:
      {},

    producer:
      'fixture',

    evidenceIds:
      [],

    provenanceIds:
      [],
  };
}


function graph(
  nodes:
    LanguageGraphNodeV1[],

  version:
    CanonicalLanguageGraphV1['version'] =
      'canonical-language-graph-v1',
): CanonicalLanguageGraphV1 {
  return {
    version,

    documentId:
      'document:test',

    surfaceVersion:
      'canonical-surface-boundary-v1',

    nodes,

    edges:
      [],

    evidence:
      [],

    provenance:
      [],

    alternativeSets:
      [],

    constraintTrace:
      [],

    producerState:
      {},

    invariants: {
      oneCanonicalGraph:
        true,

      stableSurfaceTokenIds:
        true,

      appendEvidenceDoNotReparseText:
        true,
    },
  } as unknown as CanonicalLanguageGraphV1;
}


Deno.test(
  'v1.46 A3.2.3d: zero occurrences is a valid neutral inventory',
  () => {
    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        graph([
          node(
            'token:1',
            'token',
            'resolved',
          ),
        ]),

        'predicate',
      );


    assert(
      result.status ===
        'ready' &&
      result.inventory
        ?.canonicalNodeType ===
        'predicate' &&
      result.inventory
        .occurrenceCount ===
        0 &&
      result.inventory
        .occurrences.length ===
        0,
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d: one occurrence preserves exact node id type and candidate status',
  () => {
    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        graph([
          node(
            'predicate:alpha',
            'predicate',
            'candidate',
          ),
        ]),

        'predicate',
      );


    const occurrence =
      result.inventory
        ?.occurrences[0];


    assert(
      occurrence
        ?.nodeId ===
        'predicate:alpha' &&
      occurrence.nodeType ===
        'predicate' &&
      occurrence.graphStatus ===
        'candidate',
      'exact occurrence snapshot was not preserved',
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d: all five GraphStatus values are preserved without filtering',
  () => {
    const statuses:
      GraphStatus[] = [
        'candidate',
        'resolved',
        'rejected',
        'blocked',
        'ambiguous',
      ];


    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        graph(
          statuses.map(
            (
              status,
              index,
            ) =>
              node(
                `phrase:${index}`,
                'phrase',
                status,
              ),
          ),
        ),

        'phrase',
      );


    const actual =
      result.inventory
        ?.occurrences
        .map(
          (occurrence) =>
            occurrence.graphStatus,
        )
        .sort();


    assert(
      result.inventory
        ?.occurrenceCount ===
        5 &&
      JSON.stringify(
        actual,
      ) ===
        JSON.stringify(
          [...statuses].sort(),
        ),
      `statuses=${JSON.stringify(actual)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d: multiple occurrences remain multiple and no winner is selected',
  () => {
    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        graph([
          node(
            'predicate:candidate',
            'predicate',
            'candidate',
          ),

          node(
            'predicate:resolved',
            'predicate',
            'resolved',
          ),

          node(
            'predicate:ambiguous',
            'predicate',
            'ambiguous',
          ),
        ]),

        'predicate',
      );


    assert(
      result.inventory
        ?.occurrences.length ===
        3 &&
      result.inventory
        .governance
        .occurrenceWinnerSelected ===
        false &&
      result.inventory
        .governance
        .resolvedOccurrencePreferred ===
        false,
      'multiple graph occurrences collapsed into a winner',
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d: selector uses exact canonical node type only',
  () => {
    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        graph([
          node(
            'phrase:1',
            'phrase',
            'candidate',
          ),

          node(
            'predicate:1',
            'predicate',
            'candidate',
          ),

          node(
            'construction:1',
            'construction',
            'candidate',
          ),
        ]),

        'predicate',
      );


    assert(
      JSON.stringify(
        result.inventory
          ?.occurrences.map(
            (occurrence) =>
              occurrence.nodeId,
          ),
      ) ===
        JSON.stringify([
          'predicate:1',
        ]),
      'node-type selector crossed graph type boundary',
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d: deterministic ordering is by exact node id, not status preference',
  () => {
    const a =
      graph([
        node(
          'predicate:z',
          'predicate',
          'resolved',
        ),

        node(
          'predicate:a',
          'predicate',
          'candidate',
        ),

        node(
          'predicate:m',
          'predicate',
          'blocked',
        ),
      ]);


    const b =
      graph([
        node(
          'predicate:m',
          'predicate',
          'blocked',
        ),

        node(
          'predicate:z',
          'predicate',
          'resolved',
        ),

        node(
          'predicate:a',
          'predicate',
          'candidate',
        ),
      ]);


    const x =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        a,
        'predicate',
      );

    const y =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        b,
        'predicate',
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'inventory depends on graph node insertion order',
    );


    assert(
      JSON.stringify(
        x.inventory
          ?.occurrences.map(
            (occurrence) =>
              occurrence.nodeId,
          ),
      ) ===
        JSON.stringify([
          'predicate:a',
          'predicate:m',
          'predicate:z',
        ]),
      'inventory ordering contains hidden status preference',
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d: duplicate graph node identity blocks rather than deduplicating',
  () => {
    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        graph([
          node(
            'predicate:duplicate',
            'predicate',
            'candidate',
          ),

          node(
            'predicate:duplicate',
            'predicate',
            'resolved',
          ),
        ]),

        'predicate',
      );


    assert(
      result.status ===
        'blocked' &&
      result.inventory ===
        undefined &&
      result.blockingReasons.some(
        (reason) =>
          reason.includes(
            'duplicate_id',
          ),
      ),
      'duplicate graph occurrence identity was silently deduplicated',
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d: unexpected graph version blocks inventory read',
  () => {
    const stale =
      graph([
        node(
          'predicate:1',
          'predicate',
          'candidate',
        ),
      ]);


    (
      stale as unknown as {
        version:
          string;
      }
    ).version =
      'future-graph-version';


    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        stale,
        'predicate',
      );


    assert(
      result.status ===
        'blocked' &&
      result.inventory ===
        undefined,
      'unexpected canonical graph version was consumed',
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d: reading inventory does not mutate graph or alternative sets',
  () => {
    const input =
      graph([
        node(
          'phrase:1',
          'phrase',
          'rejected',
        ),

        node(
          'phrase:2',
          'phrase',
          'resolved',
        ),
      ]);


    input.alternativeSets =
      [
        {
          id:
            'alt:phrase:test',

          memberIds: [
            'phrase:1',
            'phrase:2',
          ],

          resolvedMemberIds: [
            'phrase:2',
          ],

          status:
            'resolved',
        },
      ];


    const before =
      JSON.stringify(
        input,
      );


    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        input,
        'phrase',
      );


    const after =
      JSON.stringify(
        input,
      );


    assert(
      before ===
        after &&
      result.inventory
        ?.occurrences.length ===
        2 &&
      result.inventory
        .governance
        .alternativeSetReadPerformed ===
        false &&
      result.inventory
        .governance
        .alternativeSetResolutionPerformed ===
        false &&
      result.inventory
        .governance
        .graphMutationPerformed ===
        false,
      'inventory read mutated or interpreted canonical graph state',
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d: capability remains graph-only and performs no Runtime binding scope where cardinality clause semantics',
  () => {
    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        graph([
          node(
            'predicate:1',
            'predicate',
            'candidate',
          ),
        ]),

        'predicate',
      );


    const g =
      result.inventory
        ?.governance;


    assert(
      result.status ===
        'ready' &&
      g !==
        undefined &&

      g.exactCanonicalGraphVersionRequired ===
        true &&

      g.canonicalNodeTypeUsedAsGraphTypeSelectorOnly ===
        true &&

      g.exactNodeIdPreserved ===
        true &&

      g.exactNodeTypePreserved ===
        true &&

      g.exactGraphStatusPreserved ===
        true &&

      g.zeroOccurrencesAllowed ===
        true &&

      g.multipleOccurrencesAllowed ===
        true &&

      g.allGraphStatusesPreserved ===
        true &&

      g.deterministicNodeIdOrdering ===
        true &&

      g.graphNodeIdentityConsumedNotReconstructed ===
        true &&

      g.neutralGraphInventoryOnly ===
        true &&

      g.bindingAgnostic ===
        true &&

      g.runtimeBindingConsumed ===
        false &&

      g.runtimeEntitySemanticsResolved ===
        false &&

      g.runtimeBindingOccurrenceDomainResolved ===
        false &&

      g.scopeSemanticsResolved ===
        false &&

      g.whereSemanticsResolved ===
        false &&

      g.cardinalitySemanticsResolved ===
        false &&

      g.occurrenceWinnerSelected ===
        false &&

      g.resolvedOccurrencePreferred ===
        false &&

      g.candidateOccurrenceDiscarded ===
        false &&

      g.rejectedOccurrenceDiscarded ===
        false &&

      g.blockedOccurrenceDiscarded ===
        false &&

      g.ambiguousOccurrenceDiscarded ===
        false &&

      g.alternativeSetReadPerformed ===
        false &&

      g.alternativeSetResolutionPerformed ===
        false &&

      g.occurrenceBindingPerformed ===
        false &&

      g.runtimeScopeExecutionPerformed ===
        false &&

      g.whereEvaluationPerformed ===
        false &&

      g.cardinalityEnforcementPerformed ===
        false &&

      g.predicateSemanticsResolved ===
        false &&

      g.clauseIdentityResolved ===
        false &&

      g.clauseNodeGenerated ===
        false &&

      g.graphMutationPerformed ===
        false &&

      g.frozenGrammarReadOnly ===
        true,
      'neutral graph inventory crossed Runtime-binding boundary',
    );
  },
);

Deno.test(
  'v1.46 A3.2.3d.1: inventory identity is graph-document-local',
  () => {
    const graphA =
      graph([
        node(
          'predicate:1',
          'predicate',
          'candidate',
        ),
      ]);


    const graphB =
      graph([
        node(
          'predicate:1',
          'predicate',
          'candidate',
        ),
      ]);


    graphA.documentId =
      'document:a';

    graphB.documentId =
      'document:b';


    const a =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        graphA,
        'predicate',
      );

    const b =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        graphB,
        'predicate',
      );


    assert(
      a.status ===
        'ready' &&
      b.status ===
        'ready' &&
      a.inventory
        ?.graphVersion ===
        'canonical-language-graph-v1' &&
      a.inventory
        .graphDocumentId ===
        'document:a' &&
      b.inventory
        ?.graphDocumentId ===
        'document:b' &&
      a.inventory
        .inventoryId !==
        b.inventory
          .inventoryId &&
      a.inventory
        .governance
        .exactGraphDocumentIdentityPreserved ===
        true &&
      b.inventory
        .governance
        .exactGraphDocumentIdentityPreserved ===
        true,
      'different canonical graph documents shared occurrence-inventory identity',
    );
  },
);


Deno.test(
  'v1.46 A3.2.3d.1: missing graph document identity blocks neutral inventory',
  () => {
    const input =
      graph([
        node(
          'phrase:1',
          'phrase',
          'candidate',
        ),
      ]);


    input.documentId =
      '';


    const result =
      readCanonicalNodeTypeOccurrenceInventoryV1(
        input,
        'phrase',
      );


    assert(
      result.status ===
        'blocked' &&
      result.inventory ===
        undefined &&
      result.blockingReasons.includes(
        'graph:document_id_missing',
      ),
      'inventory accepted graph without exact document identity',
    );
  },
);