// Norsk Trainer — Canonical Cross-Predicate Attachment Ownership Bridge V1
//
// v1.49 A2
//
// Generic transport boundary:
//
//   resolved attachment:
//     exact matrix predicate -> exact embedded clause
//
//   +
//   resolved predicate_of_clause:
//     exact embedded predicate -> exact same clause
//
//   ->
//
//   candidate cross-predicate relation:
//     exact matrix predicate -> exact embedded predicate
//
// This boundary DOES NOT interpret the attachment relation.
// ccomp/csubj/advcl or any future relation remain opaque.
//
// It also DOES NOT infer predicate identity from token position,
// lemma, surface head, or node-id prefix.

import type {
  CanonicalLanguageGraphV1,
  GraphStatus,
  LanguageGraphEdgeV1,
} from './canonical-language-graph-core-v1.ts';


export const
  CANONICAL_CROSS_PREDICATE_ATTACHMENT_OWNERSHIP_BRIDGE_V1_PRODUCER =
    'canonical_cross_predicate_attachment_ownership_bridge_v1';


export const
  CANONICAL_CROSS_PREDICATE_ATTACHMENT_SOURCE_PRODUCER_V1 =
    'legacy_attachment_adapter_v1';


export const
  CANONICAL_PREDICATE_OF_CLAUSE_SOURCE_PRODUCER_V1 =
    'legacy_clause_adapter_v1';


export type CanonicalCrossPredicateAttachmentRelationCandidateV1 = {
  id: string;

  producer:
    typeof CANONICAL_CROSS_PREDICATE_ATTACHMENT_OWNERSHIP_BRIDGE_V1_PRODUCER;

  version: '1';

  status: 'candidate';

  relation: string;

  matrixPredicateId: string;

  embeddedPredicateId: string;

  embeddedClauseId: string;

  attachmentEdgeId: string;

  predicateOwnershipEdgeId: string;

  evidenceIds: string[];

  provenanceIds: string[];
};


export type CanonicalCrossPredicateAttachmentBridgeRejectionReasonV1 =
  | 'invalid_attachment'
  | 'attachment_not_resolved'
  | 'attachment_wrong_producer'
  | 'attachment_source_not_predicate'
  | 'attachment_target_not_clause'
  | 'ownership_not_found'
  | 'ownership_ambiguous'
  | 'ownership_source_not_predicate'
  | 'missing_evidence'
  | 'missing_provenance';


export type CanonicalCrossPredicateAttachmentBridgeRejectionV1 = {
  attachmentEdgeId: string;

  reason:
    CanonicalCrossPredicateAttachmentBridgeRejectionReasonV1;
};


export type CanonicalCrossPredicateAttachmentBridgeResultV1 = {
  candidates:
    CanonicalCrossPredicateAttachmentRelationCandidateV1[];

  rejections:
    CanonicalCrossPredicateAttachmentBridgeRejectionV1[];
};


function uniqueStrings(
  values: readonly string[],
): string[] {
  return [...new Set(values)];
}


function nodeType(
  graph: CanonicalLanguageGraphV1,
  nodeId: string,
): string | undefined {
  return graph.nodes.find(
    (node) => node.id === nodeId,
  )?.type;
}


function resolvedPredicateOwnershipEdges(
  graph: CanonicalLanguageGraphV1,
  clauseId: string,
): LanguageGraphEdgeV1[] {
  return graph.edges.filter(
    (edge) =>
      edge.relation === 'predicate_of_clause' &&
      edge.status === 'resolved' &&
      edge.producer ===
        CANONICAL_PREDICATE_OF_CLAUSE_SOURCE_PRODUCER_V1 &&
      edge.targetId === clauseId,
  );
}


function reject(
  rejections:
    CanonicalCrossPredicateAttachmentBridgeRejectionV1[],
  attachmentEdgeId: string,
  reason:
    CanonicalCrossPredicateAttachmentBridgeRejectionReasonV1,
): void {
  rejections.push({
    attachmentEdgeId,
    reason,
  });
}


export function
deriveCanonicalCrossPredicateAttachmentOwnershipV1(
  graph: CanonicalLanguageGraphV1,
  attachmentEdges: readonly LanguageGraphEdgeV1[],
): CanonicalCrossPredicateAttachmentBridgeResultV1 {
  const candidates:
    CanonicalCrossPredicateAttachmentRelationCandidateV1[] = [];

  const rejections:
    CanonicalCrossPredicateAttachmentBridgeRejectionV1[] = [];

  for (const attachment of attachmentEdges) {
    if (
      !attachment.id ||
      !attachment.relation ||
      !attachment.sourceId ||
      !attachment.targetId
    ) {
      reject(
        rejections,
        attachment.id ?? '',
        'invalid_attachment',
      );
      continue;
    }

    if (attachment.status !== 'resolved') {
      reject(
        rejections,
        attachment.id,
        'attachment_not_resolved',
      );
      continue;
    }

    if (
      attachment.producer !==
        CANONICAL_CROSS_PREDICATE_ATTACHMENT_SOURCE_PRODUCER_V1
    ) {
      reject(
        rejections,
        attachment.id,
        'attachment_wrong_producer',
      );
      continue;
    }

    if (
      nodeType(
        graph,
        attachment.sourceId,
      ) !== 'predicate'
    ) {
      reject(
        rejections,
        attachment.id,
        'attachment_source_not_predicate',
      );
      continue;
    }

    if (
      nodeType(
        graph,
        attachment.targetId,
      ) !== 'clause'
    ) {
      reject(
        rejections,
        attachment.id,
        'attachment_target_not_clause',
      );
      continue;
    }

    if (attachment.evidenceIds.length === 0) {
      reject(
        rejections,
        attachment.id,
        'missing_evidence',
      );
      continue;
    }

    if (attachment.provenanceIds.length === 0) {
      reject(
        rejections,
        attachment.id,
        'missing_provenance',
      );
      continue;
    }

    const ownership =
      resolvedPredicateOwnershipEdges(
        graph,
        attachment.targetId,
      );

    if (ownership.length === 0) {
      reject(
        rejections,
        attachment.id,
        'ownership_not_found',
      );
      continue;
    }

    if (ownership.length > 1) {
      reject(
        rejections,
        attachment.id,
        'ownership_ambiguous',
      );
      continue;
    }

    const owner = ownership[0];

    if (
      nodeType(
        graph,
        owner.sourceId,
      ) !== 'predicate'
    ) {
      reject(
        rejections,
        attachment.id,
        'ownership_source_not_predicate',
      );
      continue;
    }

    if (owner.evidenceIds.length === 0) {
      reject(
        rejections,
        attachment.id,
        'missing_evidence',
      );
      continue;
    }

    if (owner.provenanceIds.length === 0) {
      reject(
        rejections,
        attachment.id,
        'missing_provenance',
      );
      continue;
    }

    candidates.push({
      id:
        `cross-predicate-attachment:${attachment.id}:${owner.id}`,

      producer:
        CANONICAL_CROSS_PREDICATE_ATTACHMENT_OWNERSHIP_BRIDGE_V1_PRODUCER,

      version: '1',

      status: 'candidate',

      relation:
        attachment.relation,

      matrixPredicateId:
        attachment.sourceId,

      embeddedPredicateId:
        owner.sourceId,

      embeddedClauseId:
        attachment.targetId,

      attachmentEdgeId:
        attachment.id,

      predicateOwnershipEdgeId:
        owner.id,

      evidenceIds:
        uniqueStrings([
          ...attachment.evidenceIds,
          ...owner.evidenceIds,
        ]),

      provenanceIds:
        uniqueStrings([
          ...attachment.provenanceIds,
          ...owner.provenanceIds,
        ]),
    });
  }

  return {
    candidates,
    rejections,
  };
}

