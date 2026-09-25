import type {
  GraphPatchV1,
  LanguageGraphEdgeV1,
} from './canonical-language-graph-core-v1.ts';

import type {
  CanonicalCrossPredicateAttachmentRelationCandidateV1,
} from './canonical-cross-predicate-attachment-ownership-bridge-v1.ts';


export const
  CANONICAL_CROSS_PREDICATE_RELATION_AUTHORITY_ADAPTER_V1_PRODUCER =
    'canonical_cross_predicate_relation_authority_adapter_v1';

export const
  CANONICAL_CROSS_PREDICATE_RELATION_AUTHORITY_ADAPTER_V1_VERSION =
    '1';


export function
buildCanonicalCrossPredicateRelationAuthorityPatchV1(
  candidates:
    readonly CanonicalCrossPredicateAttachmentRelationCandidateV1[],
): GraphPatchV1 {
  const edges: LanguageGraphEdgeV1[] =
    candidates.map((candidate) => ({
      id:
        `edge:cross_predicate_relation:${candidate.id}`,

      relation:
        candidate.relation,

      sourceId:
        candidate.matrixPredicateId,

      targetId:
        candidate.embeddedPredicateId,

      status:
        'candidate',

      features: {
        bridgeCandidateId:
          candidate.id,

        embeddedClauseId:
          candidate.embeddedClauseId,

        attachmentEdgeId:
          candidate.attachmentEdgeId,

        predicateOwnershipEdgeId:
          candidate.predicateOwnershipEdgeId,
      },

      producer:
        CANONICAL_CROSS_PREDICATE_RELATION_AUTHORITY_ADAPTER_V1_PRODUCER,

      evidenceIds:
        [...candidate.evidenceIds],

      provenanceIds:
        [...candidate.provenanceIds],
    }));

  return {
    producer:
      CANONICAL_CROSS_PREDICATE_RELATION_AUTHORITY_ADAPTER_V1_PRODUCER,

    producerVersion:
      CANONICAL_CROSS_PREDICATE_RELATION_AUTHORITY_ADAPTER_V1_VERSION,

    edges,
  };
}
