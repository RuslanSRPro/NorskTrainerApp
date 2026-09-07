// Norsk Trainer — Canonical Sentence Occurrence Identity Authority V1
//
// v1.46 A3.2.1
//
// Identity model:
//
//   MODEL C
//
//   sentence node.id
//       = exact canonical sentence occurrence identity
//
//   resolved contains edge
//       sentence.id -> token.id
//       = exact direct surface-token membership
//
// sentenceIndex is locality / ordinal metadata only.
// boundaryCandidateId is sentence-boundary metadata only.
//
// Neither field is used as occurrence identity.
//
// This layer does NOT:
// - infer membership from sentenceIndex;
// - infer phrase containment;
// - infer clause containment;
// - interpret Runtime IR scope;
// - enumerate Runtime IR binding candidates;
// - execute where/cardinality;
// - create dependency edges.
//
// It only reads exact facts already materialized by
// canonical_surface_adapter_v1.

import type {
  CanonicalLanguageGraphV1,
  LanguageGraphEdgeV1,
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';


export const CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1 =
  'canonical_sentence_occurrence_identity_authority_v1';


const SURFACE_PRODUCER =
  'canonical_surface_adapter_v1';


export type CanonicalSentenceDirectTokenMembershipV1 = {
  tokenNodeId:
    string;

  containmentEdgeId:
    string;

  sentenceTokenIndex:
    number;
};


export type CanonicalSentenceOccurrenceIdentityAuthorityV1 = {
  authorityId:
    string;

  status:
    'proven';

  boundaryLabel:
    'sentence';

  source:
    typeof CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1;

  sentenceNodeId:
    string;

  sentenceIndex:
    number;

  boundaryCandidateId:
    string | null;

  directTokenMemberships:
    CanonicalSentenceDirectTokenMembershipV1[];

  governance: {
    identityModel:
      'sentence_node_id';

    membershipModel:
      'resolved_surface_contains_edge';

    sentenceNodeIdIsOccurrenceIdentity:
      true;

    sentenceIndexIsOccurrenceIdentity:
      false;

    sentenceIndexIsLocalityMetadataOnly:
      true;

    boundaryCandidateIdIsOccurrenceIdentity:
      false;

    boundaryCandidateIdMayBeNull:
      true;

    directSurfaceTokenContainmentResolved:
      true;

    membershipInferredFromSentenceIndex:
      false;

    phraseContainmentResolved:
      false;

    clauseContainmentResolved:
      false;

    selfSemanticsResolved:
      false;

    runtimeScopeExecutionPerformed:
      false;

    runtimeBindingOccurrenceEnumerationPerformed:
      false;

    whereExecutionPerformed:
      false;

    cardinalityEnforcementPerformed:
      false;

    dependencyDirectionResolved:
      false;

    canonicalDependencyEdgeGenerated:
      false;

    grammaticalFunctionResolved:
      false;

    complementArgumentAttachmentResolved:
      false;

    realizesSlotGenerated:
      false;

    graphMutationPerformed:
      false;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalSentenceOccurrenceIdentityAuthorityResultV1 = {
  producer:
    typeof CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalSentenceOccurrenceIdentityAuthorityV1[];

  blockingReasons:
    string[];
};


function stringValue(
  value:
    unknown,
): string | undefined {
  if (
    typeof value !==
      'string'
  ) {
    return undefined;
  }


  const trimmed =
    value.trim();


  return (
    trimmed ||
    undefined
  );
}


function integerValue(
  value:
    unknown,
): number | undefined {
  return (
    typeof value ===
      'number' &&
    Number.isInteger(
      value,
    ) &&
    value >=
      0
  )
    ? value
    : undefined;
}


function boundaryCandidateValue(
  node:
    LanguageGraphNodeV1,
): string | null | undefined {
  if (
    !Object.prototype.hasOwnProperty.call(
      node.features,
      'boundaryCandidateId',
    )
  ) {
    return undefined;
  }


  const value =
    node.features
      .boundaryCandidateId;


  if (
    value ===
      null
  ) {
    return null;
  }


  return stringValue(
    value,
  );
}


function unique(
  values:
    readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}


function nodeMatches(
  graph:
    CanonicalLanguageGraphV1,

  id:
    string,
): LanguageGraphNodeV1[] {
  return graph.nodes.filter(
    (node) =>
      node.id ===
        id,
  );
}


function exactNode(
  graph:
    CanonicalLanguageGraphV1,

  id:
    string,
): LanguageGraphNodeV1 | undefined {
  const matches =
    nodeMatches(
      graph,
      id,
    );


  return (
    matches.length ===
      1
  )
    ? matches[0]
    : undefined;
}


function isExactSurfaceSentence(
  node:
    LanguageGraphNodeV1,
): boolean {
  return (
    node.type ===
      'sentence' &&
    node.status ===
      'resolved' &&
    node.producer ===
      SURFACE_PRODUCER
  );
}


function isExactSurfaceToken(
  node:
    LanguageGraphNodeV1,
): boolean {
  return (
    node.type ===
      'token' &&
    node.status ===
      'resolved' &&
    node.producer ===
      SURFACE_PRODUCER
  );
}


function isExactSurfaceContains(
  edge:
    LanguageGraphEdgeV1,
): boolean {
  return (
    edge.relation ===
      'contains' &&
    edge.status ===
      'resolved' &&
    edge.producer ===
      SURFACE_PRODUCER
  );
}


export function deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
  graph:
    CanonicalLanguageGraphV1,
): CanonicalSentenceOccurrenceIdentityAuthorityResultV1 {
  const blockingReasons:
    string[] = [];


  if (
    graph.version !==
      'canonical-language-graph-v1'
  ) {
    blockingReasons.push(
      'graph:unexpected_version',
    );
  }


  if (
    graph.surfaceVersion !==
      'canonical-surface-boundary-v1'
  ) {
    blockingReasons.push(
      'graph:unexpected_surface_version',
    );
  }


  const producerState =
    graph.producerState[
      SURFACE_PRODUCER
    ];


  if (
    !producerState ||
    producerState.status !==
      'ran'
  ) {
    blockingReasons.push(
      'graph:surface_adapter_not_ran',
    );
  }


  const document =
    exactNode(
      graph,
      graph.documentId,
    );


  if (
    !document ||
    document.type !==
      'document' ||
    document.status !==
      'resolved' ||
    document.producer !==
      SURFACE_PRODUCER
  ) {
    blockingReasons.push(
      'graph:exact_surface_document_missing',
    );
  }


  const sentenceNodes =
    graph.nodes.filter(
      (node) =>
        node.type ===
          'sentence',
    );


  const sentenceIds =
    new Set<
      string
    >();


  for (
    const sentence of
      sentenceNodes
  ) {
    if (
      sentenceIds.has(
        sentence.id,
      )
    ) {
      blockingReasons.push(
        `sentence:${sentence.id}:duplicate_node_identity`,
      );

      continue;
    }


    sentenceIds.add(
      sentence.id,
    );


    if (
      !isExactSurfaceSentence(
        sentence,
      )
    ) {
      blockingReasons.push(
        `sentence:${sentence.id}:not_exact_resolved_surface_sentence`,
      );

      continue;
    }


    const sentenceIndex =
      integerValue(
        sentence.features
          .sentenceIndex,
      );


    if (
      sentenceIndex ===
        undefined
    ) {
      blockingReasons.push(
        `sentence:${sentence.id}:invalid_sentence_index`,
      );
    }


    const boundaryCandidateId =
      boundaryCandidateValue(
        sentence,
      );


    if (
      boundaryCandidateId ===
        undefined
    ) {
      blockingReasons.push(
        `sentence:${sentence.id}:invalid_boundary_candidate_metadata`,
      );
    }


    const documentMembership =
      graph.edges.filter(
        (edge) =>
          isExactSurfaceContains(
            edge,
          ) &&
          edge.sourceId ===
            graph.documentId &&
          edge.targetId ===
            sentence.id,
      );


    if (
      documentMembership.length !==
        1
    ) {
      blockingReasons.push(
        `sentence:${sentence.id}:exact_document_membership_count:${documentMembership.length}`,
      );
    }
  }


  const surfaceTokens =
    graph.nodes.filter(
      (node) =>
        node.type ===
          'token' &&
        node.producer ===
          SURFACE_PRODUCER,
    );


  for (
    const token of
      surfaceTokens
  ) {
    if (
      !isExactSurfaceToken(
        token,
      )
    ) {
      blockingReasons.push(
        `token:${token.id}:not_exact_resolved_surface_token`,
      );

      continue;
    }


    const tokenSentenceIndexRaw =
      token.features
        .sentenceIndex;


    if (
      tokenSentenceIndexRaw ===
        null ||
      tokenSentenceIndexRaw ===
        undefined
    ) {
      continue;
    }


    const tokenSentenceIndex =
      integerValue(
        tokenSentenceIndexRaw,
      );


    if (
      tokenSentenceIndex ===
        undefined
    ) {
      blockingReasons.push(
        `token:${token.id}:invalid_sentence_index`,
      );

      continue;
    }


    const membershipEdges =
      graph.edges.filter(
        (edge) =>
          isExactSurfaceContains(
            edge,
          ) &&
          edge.targetId ===
            token.id &&
          sentenceIds.has(
            edge.sourceId,
          ),
      );


    if (
      membershipEdges.length !==
        1
    ) {
      blockingReasons.push(
        `token:${token.id}:exact_sentence_membership_count:${membershipEdges.length}`,
      );

      continue;
    }


    const membership =
      membershipEdges[0];


    const sentence =
      exactNode(
        graph,
        membership.sourceId,
      );


    if (
      !sentence ||
      !isExactSurfaceSentence(
        sentence,
      )
    ) {
      blockingReasons.push(
        `token:${token.id}:membership_source_not_exact_sentence`,
      );

      continue;
    }


    const sentenceIndex =
      integerValue(
        sentence.features
          .sentenceIndex,
      );


    if (
      sentenceIndex ===
        undefined ||
      sentenceIndex !==
        tokenSentenceIndex
    ) {
      blockingReasons.push(
        `token:${token.id}:sentence_index_metadata_mismatch`,
      );
    }


    const tokenSentenceTokenIndex =
      integerValue(
        token.features
          .sentenceTokenIndex,
      );


    const edgeSentenceTokenIndex =
      integerValue(
        membership.features
          .sentenceTokenIndex,
      );


    if (
      tokenSentenceTokenIndex ===
        undefined ||
      edgeSentenceTokenIndex ===
        undefined ||
      tokenSentenceTokenIndex !==
        edgeSentenceTokenIndex
    ) {
      blockingReasons.push(
        `token:${token.id}:sentence_token_index_metadata_mismatch`,
      );
    }
  }


  const reasons =
    unique(
      blockingReasons,
    );


  if (
    reasons.length >
      0
  ) {
    return {
      producer:
        CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,

      producerVersion:
        '1',

      status:
        'blocked',

      authorities:
        [],

      blockingReasons:
        reasons,
    };
  }


  const authorities:
    CanonicalSentenceOccurrenceIdentityAuthorityV1[] =
      [];


  for (
    const sentence of
      sentenceNodes
  ) {
    const sentenceIndex =
      integerValue(
        sentence.features
          .sentenceIndex,
      );


    const boundaryCandidateId =
      boundaryCandidateValue(
        sentence,
      );


    if (
      sentenceIndex ===
        undefined ||
      boundaryCandidateId ===
        undefined
    ) {
      continue;
    }


    const memberships:
      CanonicalSentenceDirectTokenMembershipV1[] =
      [];


    for (
      const edge of
        graph.edges
    ) {
      if (
        !isExactSurfaceContains(
          edge,
        ) ||
        edge.sourceId !==
          sentence.id
      ) {
        continue;
      }


      const token =
        exactNode(
          graph,
          edge.targetId,
        );


      if (
        !token ||
        !isExactSurfaceToken(
          token,
        )
      ) {
        continue;
      }


      const sentenceTokenIndex =
        integerValue(
          edge.features
            .sentenceTokenIndex,
        );


      if (
        sentenceTokenIndex ===
          undefined
      ) {
        continue;
      }


      memberships.push({
        tokenNodeId:
          token.id,

        containmentEdgeId:
          edge.id,

        sentenceTokenIndex,
      });
    }


    memberships.sort(
      (a, b) =>
        a.sentenceTokenIndex -
          b.sentenceTokenIndex ||
        a.tokenNodeId.localeCompare(
          b.tokenNodeId,
        ),
    );


    authorities.push({
      authorityId:
        `canonical-sentence-occurrence:${sentence.id}`,

      status:
        'proven',

      boundaryLabel:
        'sentence',

      source:
        CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,

      sentenceNodeId:
        sentence.id,

      sentenceIndex,

      boundaryCandidateId,

      directTokenMemberships:
        memberships,

      governance: {
        identityModel:
          'sentence_node_id',

        membershipModel:
          'resolved_surface_contains_edge',

        sentenceNodeIdIsOccurrenceIdentity:
          true,

        sentenceIndexIsOccurrenceIdentity:
          false,

        sentenceIndexIsLocalityMetadataOnly:
          true,

        boundaryCandidateIdIsOccurrenceIdentity:
          false,

        boundaryCandidateIdMayBeNull:
          true,

        directSurfaceTokenContainmentResolved:
          true,

        membershipInferredFromSentenceIndex:
          false,

        phraseContainmentResolved:
          false,

        clauseContainmentResolved:
          false,

        selfSemanticsResolved:
          false,

        runtimeScopeExecutionPerformed:
          false,

        runtimeBindingOccurrenceEnumerationPerformed:
          false,

        whereExecutionPerformed:
          false,

        cardinalityEnforcementPerformed:
          false,

        dependencyDirectionResolved:
          false,

        canonicalDependencyEdgeGenerated:
          false,

        grammaticalFunctionResolved:
          false,

        complementArgumentAttachmentResolved:
          false,

        realizesSlotGenerated:
          false,

        graphMutationPerformed:
          false,

        frozenGrammarReadOnly:
          true,
      },
    });
  }


  authorities.sort(
    (a, b) =>
      a.sentenceNodeId.localeCompare(
        b.sentenceNodeId,
      ),
  );


  return {
    producer:
      CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    blockingReasons:
      [],
  };
}