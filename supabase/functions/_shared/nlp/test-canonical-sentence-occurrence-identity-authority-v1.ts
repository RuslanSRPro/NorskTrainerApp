import {
  createCanonicalLanguageGraphV1,
  type CanonicalLanguageGraphV1,
  type LanguageGraphEdgeV1,
  type LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import {
  buildCanonicalSurfaceDocumentV1,
} from './canonical-surface-boundary-v1.ts';

import {
  deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1,
} from './canonical-sentence-occurrence-identity-authority-v1.ts';


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


function graph(
  text =
    'x y',
): CanonicalLanguageGraphV1 {
  return createCanonicalLanguageGraphV1(
    buildCanonicalSurfaceDocumentV1(
      text,
    ),
  );
}


function sentence(
  source:
    CanonicalLanguageGraphV1,
): LanguageGraphNodeV1 {
  const result =
    source.nodes.find(
      (node) =>
        node.type ===
          'sentence',
    );


  assert(
    result !==
      undefined,
    'sentence fixture missing',
  );


  return result;
}


function token(
  source:
    CanonicalLanguageGraphV1,
): LanguageGraphNodeV1 {
  const result =
    source.nodes.find(
      (node) =>
        node.type ===
          'token' &&
        node.features
          .sentenceIndex !==
          null,
    );


  assert(
    result !==
      undefined,
    'token fixture missing',
  );


  return result;
}


Deno.test(
  'v1.46 A3.2.1: canonical surface sentence node yields exact occurrence authority',
  () => {
    const result =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        graph(),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        1,
      `result=${JSON.stringify(result)}`,
    );


    assert(
      result.authorities[0]
        .status ===
        'proven',
      'sentence authority not proven',
    );
  },
);


Deno.test(
  'v1.46 A3.2.1: sentence node id is occurrence identity while sentenceIndex is metadata only',
  () => {
    const source =
      graph();

    const s =
      sentence(
        source,
      );

    const result =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        source,
      );

    const authority =
      result.authorities[0];


    assert(
      authority !==
        undefined &&
      authority.sentenceNodeId ===
        s.id &&
      authority.governance
        .identityModel ===
        'sentence_node_id' &&
      authority.governance
        .sentenceNodeIdIsOccurrenceIdentity ===
        true &&
      authority.governance
        .sentenceIndexIsOccurrenceIdentity ===
        false &&
      authority.governance
        .sentenceIndexIsLocalityMetadataOnly ===
        true,
      'MODEL C identity contract lost',
    );
  },
);


Deno.test(
  'v1.46 A3.2.1: direct token membership is read from resolved contains edge',
  () => {
    const source =
      graph();

    const t =
      token(
        source,
      );

    const result =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        source,
      );


    const authority =
      result.authorities[0];


    assert(
      authority !==
        undefined &&
      authority
        .directTokenMemberships
        .some(
          (membership) =>
            membership.tokenNodeId ===
              t.id,
        ),
      'direct surface token membership missing',
    );


    assert(
      authority.governance
        .membershipModel ===
        'resolved_surface_contains_edge' &&
      authority.governance
        .membershipInferredFromSentenceIndex ===
        false,
      'membership was reduced to sentenceIndex',
    );
  },
);


Deno.test(
  'v1.46 A3.2.1: sentenceIndex metadata mismatch blocks instead of rebinding token by index',
  () => {
    const source =
      graph();

    const s =
      sentence(
        source,
      );


    const mutatedSentence:
      LanguageGraphNodeV1 = {
        ...s,

        features: {
          ...s.features,

          sentenceIndex:
            99,
        },
      };


    const mutated:
      CanonicalLanguageGraphV1 = {
        ...source,

        nodes:
          source.nodes.map(
            (node) =>
              node.id ===
                s.id
                ? mutatedSentence
                : node,
          ),
      };


    const result =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        mutated,
      );


    assert(
      result.status ===
        'blocked' &&
      result.authorities.length ===
        0,
      'sentenceIndex mismatch silently rebound token',
    );
  },
);


Deno.test(
  'v1.46 A3.2.1: missing exact document to sentence membership blocks',
  () => {
    const source =
      graph();

    const s =
      sentence(
        source,
      );


    const mutated:
      CanonicalLanguageGraphV1 = {
        ...source,

        edges:
          source.edges.filter(
            (edge) =>
              !(
                edge.relation ===
                  'contains' &&
                edge.sourceId ===
                  source.documentId &&
                edge.targetId ===
                  s.id
              ),
          ),
      };


    const result =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        mutated,
      );


    assert(
      result.status ===
        'blocked',
      'unanchored sentence accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.2.1: non-resolved sentence cannot own exact surface boundary authority',
  () => {
    const source =
      graph();

    const s =
      sentence(
        source,
      );


    const mutated:
      CanonicalLanguageGraphV1 = {
        ...source,

        nodes:
          source.nodes.map(
            (node) =>
              node.id ===
                s.id
                ? {
                    ...node,

                    status:
                      'candidate',
                  }
                : node,
          ),
      };


    const result =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        mutated,
      );


    assert(
      result.status ===
        'blocked',
      'candidate sentence treated as exact surface boundary',
    );
  },
);


Deno.test(
  'v1.46 A3.2.1: nullable boundary candidate metadata is valid and is not occurrence identity',
  () => {
    const source =
      graph();

    const s =
      sentence(
        source,
      );


    const mutated:
      CanonicalLanguageGraphV1 = {
        ...source,

        nodes:
          source.nodes.map(
            (node) =>
              node.id ===
                s.id
                ? {
                    ...node,

                    features: {
                      ...node.features,

                      boundaryCandidateId:
                        null,
                    },
                  }
                : node,
          ),
      };


    const result =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        mutated,
      );


    const authority =
      result.authorities[0];


    assert(
      result.status ===
        'ready' &&
      authority !==
        undefined &&
      authority.boundaryCandidateId ===
        null &&
      authority.governance
        .boundaryCandidateIdIsOccurrenceIdentity ===
        false &&
      authority.governance
        .boundaryCandidateIdMayBeNull ===
        true,
      'nullable canonical boundary metadata was rejected or promoted to identity',
    );
  },
);


Deno.test(
  'v1.46 A3.2.1: ambiguous direct token containment blocks instead of choosing by sentenceIndex',
  () => {
    const source =
      graph();

    const s =
      sentence(
        source,
      );

    const t =
      token(
        source,
      );


    const secondSentenceId =
      `${s.id}:second`;


    const secondSentence:
      LanguageGraphNodeV1 = {
        ...s,

        id:
          secondSentenceId,
      };


    const docMembership:
      LanguageGraphEdgeV1 = {
        id:
          `edge:test:doc:${secondSentenceId}`,

        relation:
          'contains',

        sourceId:
          source.documentId,

        targetId:
          secondSentenceId,

        status:
          'resolved',

        features:
          {},

        producer:
          'canonical_surface_adapter_v1',

        evidenceIds:
          [],

        provenanceIds:
          [
            'prov:surface:canonical-v1',
          ],
      };


    const tokenMembership:
      LanguageGraphEdgeV1 = {
        id:
          `edge:test:${secondSentenceId}:${t.id}`,

        relation:
          'contains',

        sourceId:
          secondSentenceId,

        targetId:
          t.id,

        status:
          'resolved',

        features: {
          sentenceTokenIndex:
            t.features
              .sentenceTokenIndex,
        },

        producer:
          'canonical_surface_adapter_v1',

        evidenceIds:
          [],

        provenanceIds:
          [
            'prov:surface:canonical-v1',
          ],
      };


    const mutated:
      CanonicalLanguageGraphV1 = {
        ...source,

        nodes: [
          ...source.nodes,
          secondSentence,
        ],

        edges: [
          ...source.edges,
          docMembership,
          tokenMembership,
        ],
      };


    const result =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        mutated,
      );


    assert(
      result.status ===
        'blocked',
      'ambiguous token membership selected by index',
    );
  },
);


Deno.test(
  'v1.46 A3.2.1: sentence authority does not infer phrase or clause containment',
  () => {
    const result =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        graph(),
      );


    const authority =
      result.authorities[0];


    assert(
      authority !==
        undefined &&
      authority.governance
        .phraseContainmentResolved ===
        false &&
      authority.governance
        .clauseContainmentResolved ===
        false &&
      authority.governance
        .selfSemanticsResolved ===
        false &&
      authority.governance
        .runtimeScopeExecutionPerformed ===
        false,
      'sentence authority crossed containment boundary',
    );
  },
);


Deno.test(
  'v1.46 A3.2.1: derivation is deterministic and performs no binding where cardinality dependency or realization work',
  () => {
    const source =
      graph();


    const x =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
        source,
      );


    const y =
      deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1({
        ...source,

        nodes: [
          ...source.nodes,
        ].reverse(),

        edges: [
          ...source.edges,
        ].reverse(),
      });


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'sentence authority not deterministic',
    );


    assert(
      x.authorities.every(
        (authority) =>
          authority.governance
            .runtimeBindingOccurrenceEnumerationPerformed ===
            false &&
          authority.governance
            .whereExecutionPerformed ===
            false &&
          authority.governance
            .cardinalityEnforcementPerformed ===
            false &&
          authority.governance
            .dependencyDirectionResolved ===
            false &&
          authority.governance
            .canonicalDependencyEdgeGenerated ===
            false &&
          authority.governance
            .grammaticalFunctionResolved ===
            false &&
          authority.governance
            .complementArgumentAttachmentResolved ===
            false &&
          authority.governance
            .realizesSlotGenerated ===
            false &&
          authority.governance
            .graphMutationPerformed ===
            false,
      ),
      'A3.2.1 crossed sentence identity boundary',
    );
  },
);