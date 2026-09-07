import type {
  CanonicalLanguageGraphV1,
  LanguageGraphEdgeV1,
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import {
  deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1,
} from './canonical-sentence-direct-token-occurrence-domain-capability-v1.ts';


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


const SURFACE =
  'canonical_surface_adapter_v1';


function surfaceGraph(
  sentenceTokenCounts:
    readonly number[],
): CanonicalLanguageGraphV1 {
  const documentId =
    'document:test';

  const nodes:
    LanguageGraphNodeV1[] = [];

  const edges:
    LanguageGraphEdgeV1[] = [];


  nodes.push({
    id:
      documentId,

    type:
      'document',

    status:
      'resolved',

    features:
      {},

    producer:
      SURFACE,

    evidenceIds:
      [],

    provenanceIds: [
      'prov:surface:test',
    ],
  });


  let documentTokenIndex =
    0;


  sentenceTokenCounts.forEach(
    (
      tokenCount,
      sentenceIndex,
    ) => {
      const sentenceNodeId =
        `sentence:${sentenceIndex}`;


      nodes.push({
        id:
          sentenceNodeId,

        type:
          'sentence',

        status:
          'resolved',

        features: {
          sentenceIndex,

          boundaryCandidateId:
            null,
        },

        producer:
          SURFACE,

        evidenceIds:
          [],

        provenanceIds: [
          'prov:surface:test',
        ],
      });


      edges.push({
        id:
          `edge:document-sentence:${sentenceIndex}`,

        relation:
          'contains',

        sourceId:
          documentId,

        targetId:
          sentenceNodeId,

        status:
          'resolved',

        features:
          {},

        producer:
          SURFACE,

        evidenceIds:
          [],

        provenanceIds: [
          'prov:surface:test',
        ],
      });


      for (
        let sentenceTokenIndex = 0;
        sentenceTokenIndex < tokenCount;
        sentenceTokenIndex++
      ) {
        const tokenNodeId =
          `token:${sentenceIndex}:${sentenceTokenIndex}`;


        nodes.push({
          id:
            tokenNodeId,

          type:
            'token',

          subtype:
            'word',

          status:
            'resolved',

          features: {
            sentenceIndex,

            sentenceTokenIndex,

            documentTokenIndex,
          },

          producer:
            SURFACE,

          evidenceIds:
            [],

          provenanceIds: [
            'prov:surface:test',
          ],
        });


        edges.push({
          id:
            `edge:sentence-token:${sentenceIndex}:${sentenceTokenIndex}`,

          relation:
            'contains',

          sourceId:
            sentenceNodeId,

          targetId:
            tokenNodeId,

          status:
            'resolved',

          features: {
            sentenceTokenIndex,
          },

          producer:
            SURFACE,

          evidenceIds:
            [],

          provenanceIds: [
            'prov:surface:test',
          ],
        });


        documentTokenIndex +=
          1;
      }
    },
  );


  return {
    version:
      'canonical-language-graph-v1',

    documentId,

    surfaceVersion:
      'canonical-surface-boundary-v1',

    nodes,

    edges,

    evidence:
      [],

    provenance:
      [],

    alternativeSets:
      [],

    constraintTrace:
      [],

    producerState: {
      [SURFACE]: {
        status:
          'ran',
      },
    },

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
  'v1.46 A3.2.4b-T: exact sentence direct-token membership becomes canonical token domain',
  () => {
    const result =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        surfaceGraph([
          2,
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.graphDocumentId ===
        'document:test' &&
      result.domains.length ===
        1 &&
      result.domains[0]
        ?.sentenceNodeId ===
        'sentence:0' &&
      result.domains[0]
        ?.occurrenceCount ===
        2 &&
      result.domains[0]
        ?.occurrences[0]
        ?.tokenNodeId ===
        'token:0:0' &&
      result.domains[0]
        ?.occurrences[1]
        ?.tokenNodeId ===
        'token:0:1',
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.2.4b-T: multiple sentence occurrences remain independent token domains',
  () => {
    const result =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        surfaceGraph([
          1,
          2,
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.domains.length ===
        2 &&
      result.domains[0]
        ?.sentenceNodeId ===
        'sentence:0' &&
      result.domains[0]
        ?.occurrenceCount ===
        1 &&
      result.domains[1]
        ?.sentenceNodeId ===
        'sentence:1' &&
      result.domains[1]
        ?.occurrenceCount ===
        2,
      'sentence domains collapsed across occurrences',
    );
  },
);


Deno.test(
  'v1.46 A3.2.4b-T: exact containment edge identity and sentence token index are preserved',
  () => {
    const result =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        surfaceGraph([
          2,
        ]),
      );


    const second =
      result.domains[0]
        ?.occurrences[1];


    assert(
      second
        ?.containmentEdgeId ===
        'edge:sentence-token:0:1' &&
      second.sentenceTokenIndex ===
        1,
      'direct membership provenance was reconstructed or lost',
    );
  },
);


Deno.test(
  'v1.46 A3.2.4b-T: domain membership comes from exact edge rather than sentenceIndex alone',
  () => {
    const input =
      surfaceGraph([
        1,
      ]);


    input.edges =
      input.edges.filter(
        (edge) =>
          edge.id !==
            'edge:sentence-token:0:0',
      );


    const result =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        input,
      );


    assert(
      result.status ===
        'blocked' &&
      result.domains.length ===
        0,
      'sentenceIndex alone created token containment',
    );
  },
);


Deno.test(
  'v1.46 A3.2.4b-T: non-resolved containment edge cannot become direct-token domain evidence',
  () => {
    const input =
      surfaceGraph([
        1,
      ]);


    const edge =
      input.edges.find(
        (item) =>
          item.id ===
            'edge:sentence-token:0:0',
      );


    assert(
      edge !==
        undefined,
      'fixture edge missing',
    );


    edge.status =
      'candidate';


    const result =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        input,
      );


    assert(
      result.status ===
        'blocked',
      'candidate contains edge became proven sentence membership',
    );
  },
);


Deno.test(
  'v1.46 A3.2.4b-T: non-surface containment producer cannot become domain evidence',
  () => {
    const input =
      surfaceGraph([
        1,
      ]);


    const edge =
      input.edges.find(
        (item) =>
          item.id ===
            'edge:sentence-token:0:0',
      );


    assert(
      edge !==
        undefined,
      'fixture edge missing',
    );


    edge.producer =
      'other_producer';


    const result =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        input,
      );


    assert(
      result.status ===
        'blocked',
      'non-surface contains edge became sentence membership',
    );
  },
);


Deno.test(
  'v1.46 A3.2.4b-T: stale surface token status blocks rather than using status preference',
  () => {
    const input =
      surfaceGraph([
        1,
      ]);


    const token =
      input.nodes.find(
        (node) =>
          node.id ===
            'token:0:0',
      );


    assert(
      token !==
        undefined,
      'fixture token missing',
    );


    token.status =
      'candidate';


    const result =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        input,
      );


    assert(
      result.status ===
        'blocked',
      'non-exact surface token was selected by preference',
    );
  },
);


Deno.test(
  'v1.46 A3.2.4b-T: unexpected graph version blocks both upstream authorities',
  () => {
    const input =
      surfaceGraph([
        1,
      ]);


    (
      input as unknown as {
        version:
          string;
      }
    ).version =
      'future-graph-version';


    const result =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        input,
      );


    assert(
      result.status ===
        'blocked',
      'unexpected graph version was consumed',
    );
  },
);


Deno.test(
  'v1.46 A3.2.4b-T: deterministic domain ordering is sentence occurrence then sentenceTokenIndex',
  () => {
    const a =
      surfaceGraph([
        2,
        1,
      ]);

    const b =
      surfaceGraph([
        2,
        1,
      ]);


    b.nodes =
      [...b.nodes].reverse();

    b.edges =
      [...b.edges].reverse();


    const x =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        a,
      );

    const y =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        b,
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'domain depends on graph insertion order',
    );
  },
);


Deno.test(
  'v1.46 A3.2.4b-T: capability remains token-only canonical scope infrastructure without Runtime binding semantics',
  () => {
    const result =
      deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
        surfaceGraph([
          2,
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.domains.every(
        (domain) => {
          const g =
            domain.governance;


          return (
            domain.boundaryLabel ===
              'sentence' &&

            domain.membershipModel ===
              'resolved_surface_contains_edge' &&

            domain.occurrences.every(
              (occurrence) =>
                occurrence.graphStatus ===
                  'resolved',
            ) &&

            g.exactSameCanonicalGraphInputRequired ===
              true &&

            g.exactSentenceOccurrenceAuthorityRequired ===
              true &&

            g.exactNeutralTokenInventoryRequired ===
              true &&

            g.sentenceNodeIdIsOccurrenceIdentity ===
              true &&

            g.directSurfaceTokenContainmentResolved ===
              true &&

            g.exactTokenNodeIdentityJoinRequired ===
              true &&

            g.membershipAuthorityDefinesDomain ===
              true &&

            g.sentenceIndexIsOccurrenceIdentity ===
              false &&

            g.sentenceIndexIsLocalityMetadataOnly ===
              true &&

            g.containmentInferredFromSentenceIndex ===
              false &&

            g.containmentInferredFromSpan ===
              false &&

            g.genericOccurrenceContainmentResolved ===
              false &&

            g.phraseContainmentResolved ===
              false &&

            g.predicateContainmentResolved ===
              false &&

            g.clauseContainmentResolved ===
              false &&

            g.runtimeBindingConsumed ===
              false &&

            g.runtimeScopeCompatibilityConsumed ===
              false &&

            g.runtimeBindingOccurrenceDomainResolved ===
              false &&

            g.runtimeScopeExecutionPerformed ===
              false &&

            g.whereEvaluationPerformed ===
              false &&

            g.cardinalityEnforcementPerformed ===
              false &&

            g.occurrenceBindingPerformed ===
              false &&

            g.occurrenceWinnerSelected ===
              false &&

            g.graphMutationPerformed ===
              false &&

            g.frozenGrammarReadOnly ===
              true
          );
        },
      ),
      'token-only sentence domain crossed Runtime or generic containment boundary',
    );
  },
);