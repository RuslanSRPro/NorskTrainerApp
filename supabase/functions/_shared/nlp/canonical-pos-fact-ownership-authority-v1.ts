// Norsk Trainer — Canonical POS Fact Ownership Authority V1
//
// v1.46 A3.3.2a
//
// Proven model:
//
//   POS-A
//
// Canonical POS fact:
//
//   lexical_reading
//     subtype = pos_candidate
//     features.pos = opaque POS label
//
// Exact occurrence ownership:
//
//   pos_candidate
//       --pos_of-->
//   exact canonical surface token
//
// Source support:
//
//   lexical_candidate
//       --lexical_supports_pos-->
//   pos_candidate
//
// Competition domain:
//
//   alt:pos:<token-id>
//
// Important:
//
//   A POS candidate is a hypothesis.
//   candidate != resolved.
//
// This layer proves only canonical POS FACT OWNERSHIP.
// It does NOT map Runtime IR ".pos".
// It does NOT execute eq.
// It does NOT select a POS winner.
// It does NOT inspect raw token spelling.

import type {
  CanonicalLanguageGraphV1,
  GraphStatus,
  LanguageGraphAlternativeSetV1,
  LanguageGraphEdgeV1,
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';


export const CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1 =
  'canonical_pos_fact_ownership_authority_v1';


const CANDIDATE_LATTICE_PRODUCER =
  'canonical_candidate_lattice_v1';


const SURFACE_PRODUCER =
  'canonical_surface_adapter_v1';


export type CanonicalPosFactOwnershipAuthorityV1 = {
  authorityId:
    string;

  status:
    'proven';

  model:
    'POS-A';

  posReadingNodeId:
    string;

  posLabel:
    string;

  posReadingGraphStatus:
    GraphStatus;

  tokenNodeId:
    string;

  posOfEdgeId:
    string;

  posOfEdgeGraphStatus:
    GraphStatus;

  contributingLexicalReadingIds:
    string[];

  lexicalSupportEdgeIds:
    string[];

  lexicalSupportGraphStatuses:
    GraphStatus[];

  alternativeSetId:
    string;

  alternativeSetStatus:
    LanguageGraphAlternativeSetV1['status'];

  alternativeMemberIds:
    string[];

  resolvedMemberIds:
    string[];

  governance: {
    exactCanonicalPosRepresentation:
      true;

    posModel:
      'POS-A';

    posFactNodeType:
      'lexical_reading';

    posFactSubtype:
      'pos_candidate';

    posLabelOwnedByNodeFeature:
      true;

    exactOccurrenceOwnershipUsesPosOfEdge:
      true;

    posOfDirection:
      'pos_candidate_to_token';

    lexicalSupportDirection:
      'lexical_candidate_to_pos_candidate';

    sourcePosIsEvidenceNotAuthority:
      true;

    alternativeDomainIsTokenLocal:
      true;

    multiplePosCandidatesMayCoexist:
      true;

    underlyingGraphStatusPreserved:
      true;

    candidateDoesNotMeanResolved:
      true;

    resolvedAlternativeWinnerNotInferred:
      true;

    compatibilitySubtypePosPromoted:
      false;

    runtimePosSuffixMapped:
      false;

    whereOperatorSemanticsResolved:
      false;

    whereEqExecuted:
      false;

    referenceValueResolved:
      false;

    rawSurfaceSpellingRead:
      false;

    firstCandidateWins:
      false;

    occurrenceEnumerationPerformed:
      false;

    runtimeScopeExecutionPerformed:
      false;

    cardinalityEnforcementPerformed:
      false;

    occurrenceBindingPerformed:
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


export type CanonicalPosFactOwnershipAuthorityResultV1 = {
  producer:
    typeof CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalPosFactOwnershipAuthorityV1[];

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


function stringArray(
  value:
    unknown,
): string[] | undefined {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return undefined;
  }


  const out =
    value.map(
      stringValue,
    );


  if (
    out.some(
      (item) =>
        !item,
    )
  ) {
    return undefined;
  }


  return [
    ...new Set(
      out as string[],
    ),
  ].sort();
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


function exactNode(
  graph:
    CanonicalLanguageGraphV1,

  id:
    string,
): LanguageGraphNodeV1 | undefined {
  const matches =
    graph.nodes.filter(
      (node) =>
        node.id ===
          id,
    );


  return matches.length ===
      1
    ? matches[0]
    : undefined;
}


function exactEdge(
  graph:
    CanonicalLanguageGraphV1,

  id:
    string,
): LanguageGraphEdgeV1 | undefined {
  const matches =
    graph.edges.filter(
      (edge) =>
        edge.id ===
          id,
    );


  return matches.length ===
      1
    ? matches[0]
    : undefined;
}


function exactAlternativeSet(
  graph:
    CanonicalLanguageGraphV1,

  id:
    string,
): LanguageGraphAlternativeSetV1 | undefined {
  const matches =
    graph.alternativeSets.filter(
      (set) =>
        set.id ===
          id,
    );


  return matches.length ===
      1
    ? matches[0]
    : undefined;
}


function singleTokenId(
  node:
    LanguageGraphNodeV1,
): string | undefined {
  const ids =
    node.span
      ?.tokenIds ??
      [];


  if (
    ids.length ===
      1
  ) {
    return ids[0];
  }


  if (
    node.span
      ?.startTokenId &&
    node.span.startTokenId ===
      node.span.endTokenId
  ) {
    return node.span
      .startTokenId;
  }


  return undefined;
}


function exactPosOfEdges(
  graph:
    CanonicalLanguageGraphV1,

  posReadingId:
    string,
): LanguageGraphEdgeV1[] {
  return graph.edges.filter(
    (edge) =>
      edge.relation ===
        'pos_of' &&
      edge.sourceId ===
        posReadingId,
  );
}


function exactLexicalSupportEdges(
  graph:
    CanonicalLanguageGraphV1,

  posReadingId:
    string,
): LanguageGraphEdgeV1[] {
  return graph.edges.filter(
    (edge) =>
      edge.relation ===
        'lexical_supports_pos' &&
      edge.targetId ===
        posReadingId,
  );
}


function exactLexicalReadingOfEdges(
  graph:
    CanonicalLanguageGraphV1,

  lexicalReadingId:
    string,
): LanguageGraphEdgeV1[] {
  return graph.edges.filter(
    (edge) =>
      edge.relation ===
        'lexical_reading_of' &&
      edge.sourceId ===
        lexicalReadingId,
  );
}


function posAlternativeSetId(
  tokenId:
    string,
): string {
  return `alt:pos:${tokenId}`;
}


function validateAlternativeMembers(
  graph:
    CanonicalLanguageGraphV1,

  set:
    LanguageGraphAlternativeSetV1,

  tokenId:
    string,
): string[] {
  const reasons:
    string[] = [];


  for (
    const memberId of
      set.memberIds
  ) {
    const member =
      exactNode(
        graph,
        memberId,
      );


    if (
      !member ||
      member.type !==
        'lexical_reading' ||
      member.subtype !==
        'pos_candidate'
    ) {
      reasons.push(
        `alternative:${set.id}:non_pos_candidate_member:${memberId}`,
      );

      continue;
    }


    const memberPosOf =
      exactPosOfEdges(
        graph,
        member.id,
      );


    if (
      memberPosOf.length !==
        1 ||
      memberPosOf[0]
        .targetId !==
        tokenId
    ) {
      reasons.push(
        `alternative:${set.id}:member_not_anchored_to_same_token:${memberId}`,
      );
    }
  }


  return reasons;
}


export function deriveCanonicalPosFactOwnershipAuthoritiesV1(
  graph:
    CanonicalLanguageGraphV1,
): CanonicalPosFactOwnershipAuthorityResultV1 {
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


  const posReadings =
    graph.nodes
      .filter(
        (node) =>
          node.type ===
            'lexical_reading' &&
          node.subtype ===
            'pos_candidate',
      )
      .sort(
        (a, b) =>
          a.id.localeCompare(
            b.id,
          ),
      );


  for (
    const posReading of
      posReadings
  ) {
    if (
      posReading.producer !==
        CANDIDATE_LATTICE_PRODUCER
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:unexpected_producer`,
      );

      continue;
    }


    const posLabel =
      stringValue(
        posReading.features
          .pos,
      );


    if (!posLabel) {
      blockingReasons.push(
        `pos:${posReading.id}:missing_pos_label`,
      );
    }


    if (
      posReading.features
        .sourcePosIsEvidenceNotAuthority !==
        true
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:source_pos_authority_marker_invalid`,
      );
    }


    const contributingIds =
      stringArray(
        posReading.features
          .contributingLexicalReadingIds,
      );


    if (
      !contributingIds ||
      contributingIds.length ===
        0
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:missing_contributing_lexical_readings`,
      );
    }


    const spanTokenId =
      singleTokenId(
        posReading,
      );


    if (!spanTokenId) {
      blockingReasons.push(
        `pos:${posReading.id}:not_single_token_span`,
      );
    }


    const posOfEdges =
      exactPosOfEdges(
        graph,
        posReading.id,
      );


    if (
      posOfEdges.length !==
        1
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:pos_of_count:${posOfEdges.length}`,
      );

      continue;
    }


    const posOf =
      posOfEdges[0];


    if (
      posOf.producer !==
        CANDIDATE_LATTICE_PRODUCER
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:pos_of_wrong_producer`,
      );
    }


    const token =
      exactNode(
        graph,
        posOf.targetId,
      );


    if (
      !token ||
      token.type !==
        'token' ||
      token.status !==
        'resolved' ||
      token.producer !==
        SURFACE_PRODUCER
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:exact_surface_token_missing`,
      );

      continue;
    }


    if (
      spanTokenId !==
        token.id
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:span_and_pos_of_token_mismatch`,
      );
    }


    if (
      stringValue(
        posOf.features
          .pos,
      ) !==
        posLabel
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:pos_of_label_mismatch`,
      );
    }


    const supportEdges =
      exactLexicalSupportEdges(
        graph,
        posReading.id,
      )
        .sort(
          (a, b) =>
            a.id.localeCompare(
              b.id,
            ),
        );


    const supportSourceIds =
      unique(
        supportEdges.map(
          (edge) =>
            edge.sourceId,
        ),
      );


    if (
      !contributingIds ||
      JSON.stringify(
        supportSourceIds,
      ) !==
        JSON.stringify(
          contributingIds,
        )
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:lexical_support_source_set_mismatch`,
      );
    }


    for (
      const edge of
        supportEdges
    ) {
      if (
        edge.producer !==
          CANDIDATE_LATTICE_PRODUCER
      ) {
        blockingReasons.push(
          `pos:${posReading.id}:lexical_support_wrong_producer:${edge.id}`,
        );
      }


      if (
        stringValue(
          edge.features
            .pos,
        ) !==
          posLabel
      ) {
        blockingReasons.push(
          `pos:${posReading.id}:lexical_support_label_mismatch:${edge.id}`,
        );
      }


      const lexical =
        exactNode(
          graph,
          edge.sourceId,
        );


      if (
        !lexical ||
        lexical.type !==
          'lexical_reading' ||
        lexical.subtype !==
          'lexical_candidate' ||
        lexical.producer !==
          CANDIDATE_LATTICE_PRODUCER
      ) {
        blockingReasons.push(
          `pos:${posReading.id}:invalid_lexical_support_source:${edge.sourceId}`,
        );

        continue;
      }


      const lexicalOccurrenceEdges =
        exactLexicalReadingOfEdges(
          graph,
          lexical.id,
        );


      if (
        lexicalOccurrenceEdges.length !==
          1 ||
        lexicalOccurrenceEdges[0]
          .targetId !==
          token.id
      ) {
        blockingReasons.push(
          `pos:${posReading.id}:lexical_support_not_same_occurrence:${lexical.id}`,
        );
      }
    }


    const alternativeId =
      posAlternativeSetId(
        token.id,
      );


    const alternative =
      exactAlternativeSet(
        graph,
        alternativeId,
      );


    if (
      !alternative
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:pos_alternative_set_missing`,
      );

      continue;
    }


    if (
      !alternative.memberIds.includes(
        posReading.id,
      )
    ) {
      blockingReasons.push(
        `pos:${posReading.id}:not_member_of_token_pos_alternative`,
      );
    }


    blockingReasons.push(
      ...validateAlternativeMembers(
        graph,
        alternative,
        token.id,
      ),
    );
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
        CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1,

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
    CanonicalPosFactOwnershipAuthorityV1[] =
      [];


  for (
    const posReading of
      posReadings
  ) {
    const posLabel =
      stringValue(
        posReading.features
          .pos,
      );


    const contributingIds =
      stringArray(
        posReading.features
          .contributingLexicalReadingIds,
      );


    const posOf =
      exactPosOfEdges(
        graph,
        posReading.id,
      )[0];


    if (
      !posLabel ||
      !contributingIds ||
      !posOf
    ) {
      continue;
    }


    const supportEdges =
      exactLexicalSupportEdges(
        graph,
        posReading.id,
      )
        .sort(
          (a, b) =>
            a.id.localeCompare(
              b.id,
            ),
        );


    const alternative =
      exactAlternativeSet(
        graph,
        posAlternativeSetId(
          posOf.targetId,
        ),
      );


    if (!alternative) {
      continue;
    }


    authorities.push({
      authorityId:
        `canonical-pos-fact:${posReading.id}`,

      status:
        'proven',

      model:
        'POS-A',

      posReadingNodeId:
        posReading.id,

      posLabel,

      posReadingGraphStatus:
        posReading.status,

      tokenNodeId:
        posOf.targetId,

      posOfEdgeId:
        posOf.id,

      posOfEdgeGraphStatus:
        posOf.status,

      contributingLexicalReadingIds:
        contributingIds,

      lexicalSupportEdgeIds:
        supportEdges.map(
          (edge) =>
            edge.id,
        ),

      lexicalSupportGraphStatuses:
        supportEdges.map(
          (edge) =>
            edge.status,
        ),

      alternativeSetId:
        alternative.id,

      alternativeSetStatus:
        alternative.status,

      alternativeMemberIds:
        [
          ...alternative.memberIds,
        ].sort(),

      resolvedMemberIds:
        [
          ...alternative.resolvedMemberIds,
        ].sort(),

      governance: {
        exactCanonicalPosRepresentation:
          true,

        posModel:
          'POS-A',

        posFactNodeType:
          'lexical_reading',

        posFactSubtype:
          'pos_candidate',

        posLabelOwnedByNodeFeature:
          true,

        exactOccurrenceOwnershipUsesPosOfEdge:
          true,

        posOfDirection:
          'pos_candidate_to_token',

        lexicalSupportDirection:
          'lexical_candidate_to_pos_candidate',

        sourcePosIsEvidenceNotAuthority:
          true,

        alternativeDomainIsTokenLocal:
          true,

        multiplePosCandidatesMayCoexist:
          true,

        underlyingGraphStatusPreserved:
          true,

        candidateDoesNotMeanResolved:
          true,

        resolvedAlternativeWinnerNotInferred:
          true,

        compatibilitySubtypePosPromoted:
          false,

        runtimePosSuffixMapped:
          false,

        whereOperatorSemanticsResolved:
          false,

        whereEqExecuted:
          false,

        referenceValueResolved:
          false,

        rawSurfaceSpellingRead:
          false,

        firstCandidateWins:
          false,

        occurrenceEnumerationPerformed:
          false,

        runtimeScopeExecutionPerformed:
          false,

        cardinalityEnforcementPerformed:
          false,

        occurrenceBindingPerformed:
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
      a.posReadingNodeId.localeCompare(
        b.posReadingNodeId,
      ),
  );


  return {
    producer:
      CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    blockingReasons:
      [],
  };
}