// Norsk Trainer — Canonical Token POS Graph-Bound
// Normalized-Label Projection V1
//
// v1.46 A3.3.4b.1
//
// Purpose:
//
//   exact canonical graph snapshot
//       +
//   exact canonical token occurrence ID
//       +
//   exact POS ownership authority
//       +
//   exact token POS capability
//       |
//       v
//   A3.3.2d graph-bound POS hypothesis-set read
//       |
//       v
//   A3.3.4b unchanged normalized-label projection
//       |
//       v
//   graph-document-bound normalized POS projection.
//
// This layer exists ONLY to close snapshot provenance.
//
// A3.3.4b correctly preserves token occurrence identity but does not
// carry CanonicalLanguageGraphV1.documentId in its output.
//
// Therefore downstream Runtime WHERE comparison must not join an
// arbitrary normalized projection to a sentence-domain candidate only
// by tokenNodeId.
//
// This wrapper derives the read and projection from the SAME graph
// object and then preserves that graph's exact document identity.
//
// It DOES NOT:
//
// - implement POS comparison;
// - consume Runtime WHERE;
// - consume Runtime binding/domain;
// - consume Runtime expected operand;
// - reuse raw canonical-token-pos-label-comparison-v1 truth;
// - select a POS hypothesis;
// - resolve an alternative set;
// - propagate constraints;
// - select a sentence;
// - select a token;
// - enforce cardinality;
// - bind a Runtime occurrence;
// - mutate the graph.

import type {
  CanonicalLanguageGraphV1,
} from './canonical-language-graph-core-v1.ts';

import type {
  CanonicalPosFactOwnershipAuthorityResultV1,
} from './canonical-pos-fact-ownership-authority-v1.ts';

import type {
  CanonicalTokenPosPropertyCapabilityResultV1,
} from './canonical-token-pos-property-capability-v1.ts';

import {
  CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1,
  readCanonicalTokenPosHypothesisSetV1,
} from './canonical-token-pos-hypothesis-set-read-v1.ts';

import {
  CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V1,
  projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1,
  type CanonicalTokenPosHypothesisSetNormalizedLabelProjectionV1,
} from './canonical-token-pos-hypothesis-set-normalized-label-projection-v1.ts';


export const CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V1 =
  'canonical_token_pos_graph_bound_normalized_label_projection_v1';


export type CanonicalTokenPosGraphBoundNormalizedLabelProjectionV1 = {
  graphBoundProjectionId:
    string;

  status:
    'proven';

  graphVersion:
    'canonical-language-graph-v1';

  graphDocumentId:
    string;

  tokenNodeId:
    string;

  sourceReadId:
    string;

  normalizedProjectionId:
    string;

  projection:
    CanonicalTokenPosHypothesisSetNormalizedLabelProjectionV1;

  governance: {
    exactCanonicalGraphInputRequired:
      true;

    exactGraphVersionRequired:
      true;

    exactGraphDocumentIdentityPreserved:
      true;

    exactTokenOccurrenceIdentityRequired:
      true;

    exactA332dReadRequired:
      true;

    a332dReadDerivedFromSameGraphInput:
      true;

    exactA334bProjectionRequired:
      true;

    a334bProjectionDerivedFromSameRead:
      true;

    normalizedProjectionConsumedNotReconstructed:
      true;

    tokenNodeIdentityPreserved:
      true;

    readIdentityPreserved:
      true;

    normalizationAuthorityPreserved:
      true;

    hypothesisSetStatePreserved:
      true;

    alternativeSetIdentityPreserved:
      true;

    alternativeSetStatusPreserved:
      true;

    memberIdentityPreserved:
      true;

    memberMultiplicityPreserved:
      true;

    memberGraphStatusesPreserved:
      true;

    resolvedMemberIdsPreserved:
      true;

    normalizedLabelsPreserved:
      true;

    rawComparisonAuthorityConsumed:
      false;

    runtimeWhereConsumed:
      false;

    runtimeBindingConsumed:
      false;

    runtimeSentenceDomainConsumed:
      false;

    runtimeExpectedOperandConsumed:
      false;

    comparisonPerformed:
      false;

    comparisonTruthResolved:
      false;

    posWinnerSelected:
      false;

    alternativeSetResolutionPerformed:
      false;

    currentRuntimeSentenceContextSelected:
      false;

    cardinalityEnforcementPerformed:
      false;

    occurrenceBindingPerformed:
      false;

    constraintPropagationInvoked:
      false;

    graphMutationPerformed:
      false;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV1 = {
  producer:
    typeof CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  graphDocumentId:
    string | null;

  graphBoundProjection?:
    CanonicalTokenPosGraphBoundNormalizedLabelProjectionV1;

  blockingReasons:
    string[];
};


function stringPresent(
  value:
    unknown,
): value is string {
  return (
    typeof value ===
      'string' &&
    value.length >
      0
  );
}


function idPart(
  value:
    string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    '%',
    '_',
  );
}


function uniqueSorted(
  values:
    readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}


function blockedResult(
  reasons:
    readonly string[],

  graphDocumentId:
    string | null =
      null,
): CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV1 {
  return {
    producer:
      CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V1,

    producerVersion:
      '1',

    status:
      'blocked',

    graphDocumentId,

    blockingReasons:
      uniqueSorted(
        reasons,
      ),
  };
}


export function deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1(
  graph:
    CanonicalLanguageGraphV1,

  tokenNodeId:
    string,

  ownershipResult:
    CanonicalPosFactOwnershipAuthorityResultV1,

  capabilityResult:
    CanonicalTokenPosPropertyCapabilityResultV1,
): CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV1 {
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
    !stringPresent(
      graph.documentId,
    )
  ) {
    blockingReasons.push(
      'graph:document_id_missing',
    );
  }


  if (
    !stringPresent(
      tokenNodeId,
    )
  ) {
    blockingReasons.push(
      'token:node_id_missing',
    );
  }


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
      stringPresent(
        graph.documentId,
      )
        ? graph.documentId
        : null,
    );
  }


  // ---------------------------------------------------------------
  // A3.3.2d
  //
  // CRITICAL provenance point:
  //
  // The canonical POS read is performed against THIS exact graph
  // object and THIS exact token occurrence ID.
  // ---------------------------------------------------------------

  const readResult =
    readCanonicalTokenPosHypothesisSetV1(
      graph,
      tokenNodeId,
      ownershipResult,
      capabilityResult,
    );


  if (
    readResult.producer !==
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1 ||

    readResult.producerVersion !==
      '1' ||

    readResult.status !==
      'ready' ||

    readResult.blockingReasons.length !==
      0 ||

    !readResult.read
  ) {
    return blockedResult(
      [
        'a332d_read:not_exact_ready_graph_bound_read',
        ...readResult.blockingReasons.map(
          (reason) =>
            `a332d_read:${reason}`,
        ),
      ],
      graph.documentId,
    );
  }


  const read =
    readResult.read;


  if (
    read.tokenNodeId !==
      tokenNodeId
  ) {
    return blockedResult(
      [
        'a332d_read:token_identity_mismatch',
      ],
      graph.documentId,
    );
  }


  // ---------------------------------------------------------------
  // A3.3.4b
  //
  // Consume the exact read result unchanged.
  // ---------------------------------------------------------------

  const projectionResult =
    projectCanonicalTokenPosHypothesisSetNormalizedLabelsV1(
      readResult,
    );


  if (
    projectionResult.producer !==
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V1 ||

    projectionResult.producerVersion !==
      '1' ||

    projectionResult.status !==
      'ready' ||

    projectionResult.blockingReasons.length !==
      0 ||

    !projectionResult.projection
  ) {
    return blockedResult(
      [
        'a334b_projection:not_exact_ready_projection',
        ...projectionResult.blockingReasons.map(
          (reason) =>
            `a334b_projection:${reason}`,
        ),
      ],
      graph.documentId,
    );
  }


  const projection =
    projectionResult.projection;


  if (
    projection.tokenNodeId !==
      tokenNodeId
  ) {
    return blockedResult(
      [
        'a334b_projection:token_identity_mismatch',
      ],
      graph.documentId,
    );
  }


  if (
    projection.sourceReadId !==
      read.readId
  ) {
    return blockedResult(
      [
        'a334b_projection:source_read_identity_mismatch',
      ],
      graph.documentId,
    );
  }


  return {
    producer:
      CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V1,

    producerVersion:
      '1',

    status:
      'ready',

    graphDocumentId:
      graph.documentId,

    graphBoundProjection: {
      graphBoundProjectionId: [
        'canonical-token-pos-graph-bound-normalized-projection-v1',
        idPart(
          graph.documentId,
        ),
        idPart(
          tokenNodeId,
        ),
        idPart(
          projection.projectionId,
        ),
      ].join(':'),

      status:
        'proven',

      graphVersion:
        'canonical-language-graph-v1',

      graphDocumentId:
        graph.documentId,

      tokenNodeId,

      sourceReadId:
        read.readId,

      normalizedProjectionId:
        projection.projectionId,

      // Preserve exact A3.3.4b projection object.
      projection,

      governance: {
        exactCanonicalGraphInputRequired:
          true,

        exactGraphVersionRequired:
          true,

        exactGraphDocumentIdentityPreserved:
          true,

        exactTokenOccurrenceIdentityRequired:
          true,

        exactA332dReadRequired:
          true,

        a332dReadDerivedFromSameGraphInput:
          true,

        exactA334bProjectionRequired:
          true,

        a334bProjectionDerivedFromSameRead:
          true,

        normalizedProjectionConsumedNotReconstructed:
          true,

        tokenNodeIdentityPreserved:
          true,

        readIdentityPreserved:
          true,

        normalizationAuthorityPreserved:
          true,

        hypothesisSetStatePreserved:
          true,

        alternativeSetIdentityPreserved:
          true,

        alternativeSetStatusPreserved:
          true,

        memberIdentityPreserved:
          true,

        memberMultiplicityPreserved:
          true,

        memberGraphStatusesPreserved:
          true,

        resolvedMemberIdsPreserved:
          true,

        normalizedLabelsPreserved:
          true,

        rawComparisonAuthorityConsumed:
          false,

        runtimeWhereConsumed:
          false,

        runtimeBindingConsumed:
          false,

        runtimeSentenceDomainConsumed:
          false,

        runtimeExpectedOperandConsumed:
          false,

        comparisonPerformed:
          false,

        comparisonTruthResolved:
          false,

        posWinnerSelected:
          false,

        alternativeSetResolutionPerformed:
          false,

        currentRuntimeSentenceContextSelected:
          false,

        cardinalityEnforcementPerformed:
          false,

        occurrenceBindingPerformed:
          false,

        constraintPropagationInvoked:
          false,

        graphMutationPerformed:
          false,

        frozenGrammarReadOnly:
          true,
      },
    },

    blockingReasons:
      [],
  };
}