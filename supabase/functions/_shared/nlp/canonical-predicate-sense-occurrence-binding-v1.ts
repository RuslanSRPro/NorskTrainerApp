// Norsk Trainer — Canonical Predicate Sense Occurrence Binding V1
//
// v1.44 Wave B A2.2
//
// Generic structural occurrence binding:
//
// source-backed member-role projection
//        +
// canonical construction occurrence
//        +
// exact canonical predicate head occurrence
//        ↓
// CanonicalPredicateSenseEvidenceFactV1
//
// This layer does NOT:
// - inspect lemmas;
// - inspect language-specific lexical classes;
// - interpret sense labels;
// - create semantic_unit nodes;
// - choose a sense winner;
// - infer a default sense;
// - construct clauses;
// - resolve valency.
//
// Required canonical construction contract:
//
// construction.features.sourceCandidateCodes
//
// construction_member_of edge:
//   sourceId = exact lexical/morph/member candidate
//   targetId = construction candidate
//   features.roleRef
//   features.memberTokenId
//
// Exact occurrence binding requires:
//
//   memberTokenId === predicate.features.anchorHeadId

import type {
  CanonicalLanguageGraphV1,
  LanguageGraphEdgeV1,
  LanguageGraphNodeV1,
} from './canonical-language-graph-core-v1.ts';

import type {
  CanonicalPredicateSenseEvidenceFactV1,
} from './canonical-predicate-sense-candidate-lattice-v1.ts';

import type {
  CanonicalPredicateSenseSourceRoleProjectionV1,
} from './canonical-predicate-sense-source-role-adapter-v1.ts';


export const CANONICAL_PREDICATE_SENSE_OCCURRENCE_BINDING_V1 =
  'canonical_predicate_sense_occurrence_binding_v1';

export const CANONICAL_PREDICATE_SENSE_OCCURRENCE_BINDING_VERSION_V1 =
  '1';


export type CanonicalPredicateSenseOccurrenceBindingDiagnosticV1 = {
  code: string;

  projectionId?: string;
  predicateId?: string;
  constructionId?: string;
  edgeId?: string;

  detail?: string;
};


export type CanonicalPredicateSenseOccurrenceBindingResultV1 = {
  producer:
    typeof CANONICAL_PREDICATE_SENSE_OCCURRENCE_BINDING_V1;

  producerVersion:
    typeof CANONICAL_PREDICATE_SENSE_OCCURRENCE_BINDING_VERSION_V1;

  evidenceFacts:
    CanonicalPredicateSenseEvidenceFactV1[];

  diagnostics:
    CanonicalPredicateSenseOccurrenceBindingDiagnosticV1[];
};


function stringValue(
  value: unknown,
): string | undefined {
  if (
    typeof value !==
      'string'
  ) {
    return undefined;
  }

  const trimmed =
    value.trim();

  return trimmed || undefined;
}


function stringArray(
  value: unknown,
): string[] {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(
          stringValue,
        )
        .filter(
          (
            item,
          ): item is string =>
            Boolean(item),
        ),
    ),
  ];
}


function unique<T>(
  values:
    readonly T[],
): T[] {
  return [
    ...new Set(values),
  ];
}


function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    '%',
    '_',
  );
}


function usableStatus(
  status: string,
): boolean {
  return status !==
      'rejected' &&
    status !==
      'blocked';
}


function usableNode(
  node:
    LanguageGraphNodeV1,
): boolean {
  return usableStatus(
    node.status,
  );
}


function usableEdge(
  edge:
    LanguageGraphEdgeV1,
): boolean {
  return usableStatus(
    edge.status,
  );
}


function nodeById(
  graph:
    CanonicalLanguageGraphV1,
  id: string,
): LanguageGraphNodeV1 | undefined {
  return graph.nodes.find(
    (node) =>
      node.id === id,
  );
}


function nodeCoversToken(
  node:
    LanguageGraphNodeV1,
  tokenId: string,
): boolean {
  const tokenIds =
    node.span?.tokenIds ?? [];

  if (
    tokenIds.includes(
      tokenId,
    )
  ) {
    return true;
  }

  return (
    node.span?.startTokenId ===
      tokenId &&
    node.span?.endTokenId ===
      tokenId
  );
}


function exactPredicateHead(
  graph:
    CanonicalLanguageGraphV1,
  predicate:
    LanguageGraphNodeV1,
): string | undefined {
  if (
    predicate.type !==
      'predicate' ||
    !usableNode(
      predicate,
    )
  ) {
    return undefined;
  }

  const headTokenId =
    stringValue(
      predicate.features
        .anchorHeadId,
    );

  if (!headTokenId) {
    return undefined;
  }

  const token =
    nodeById(
      graph,
      headTokenId,
    );

  if (
    !token ||
    token.type !==
      'token' ||
    !usableNode(token)
  ) {
    return undefined;
  }

  return headTokenId;
}


function constructionSourceCodes(
  construction:
    LanguageGraphNodeV1,
): string[] {
  return stringArray(
    construction.features
      .sourceCandidateCodes,
  );
}


function projectionIsUsable(
  projection:
    CanonicalPredicateSenseSourceRoleProjectionV1,
): boolean {
  return Boolean(
    stringValue(
      projection.projectionId,
    ) &&
    stringValue(
      projection.sourceCandidateCode,
    ) &&
    stringValue(
      projection.memberRef,
    ) &&
    stringValue(
      projection.sense,
    ) &&
    projection.projectionPolicy ===
      'source_role_candidate_support_only' &&
    projection.frozenGrammarReadOnly ===
      true,
  );
}


function matchingMemberEdges(
  graph:
    CanonicalLanguageGraphV1,
  construction:
    LanguageGraphNodeV1,
  projection:
    CanonicalPredicateSenseSourceRoleProjectionV1,
  headTokenId:
    string,
): LanguageGraphEdgeV1[] {
  return graph.edges
    .filter(
      (edge) =>
        edge.relation ===
          'construction_member_of' &&
        edge.targetId ===
          construction.id &&
        usableEdge(edge),
    )
    .filter(
      (edge) =>
        stringValue(
          edge.features
            .roleRef,
        ) ===
          projection.memberRef,
    )
    .filter(
      (edge) =>
        stringValue(
          edge.features
            .memberTokenId,
        ) ===
          headTokenId,
    )
    .filter(
      (edge) => {
        const member =
          nodeById(
            graph,
            edge.sourceId,
          );

        if (
          !member ||
          !usableNode(member)
        ) {
          return false;
        }

        return nodeCoversToken(
          member,
          headTokenId,
        );
      },
    )
    .sort(
      (a, b) =>
        a.id.localeCompare(
          b.id,
        ),
    );
}


export function bindCanonicalPredicateSenseSourceRolesToOccurrencesV1(
  graph:
    CanonicalLanguageGraphV1,

  projections:
    readonly CanonicalPredicateSenseSourceRoleProjectionV1[],
): CanonicalPredicateSenseOccurrenceBindingResultV1 {
  const evidenceFacts:
    CanonicalPredicateSenseEvidenceFactV1[] = [];

  const diagnostics:
    CanonicalPredicateSenseOccurrenceBindingDiagnosticV1[] = [];

  const predicates =
    graph.nodes
      .filter(
        (node) =>
          node.type ===
            'predicate' &&
          usableNode(node),
      )
      .sort(
        (a, b) =>
          a.id.localeCompare(
            b.id,
          ),
      );

  const constructions =
    graph.nodes
      .filter(
        (node) =>
          node.type ===
            'construction' &&
          usableNode(node),
      )
      .sort(
        (a, b) =>
          a.id.localeCompare(
            b.id,
          ),
      );

  for (
    const projection of
      [...projections]
        .sort(
          (a, b) =>
            a.projectionId
              .localeCompare(
                b.projectionId,
              ),
        )
  ) {
    if (
      !projectionIsUsable(
        projection,
      )
    ) {
      diagnostics.push({
        code:
          'projection_not_usable',

        projectionId:
          projection.projectionId,
      });

      continue;
    }

    const matchingConstructions =
      constructions.filter(
        (construction) =>
          constructionSourceCodes(
            construction,
          ).includes(
            projection
              .sourceCandidateCode,
          ),
      );

    for (
      const construction of
        matchingConstructions
    ) {
      for (
        const predicate of
          predicates
      ) {
        const headTokenId =
          exactPredicateHead(
            graph,
            predicate,
          );

        if (!headTokenId) {
          continue;
        }

        const memberEdges =
          matchingMemberEdges(
            graph,
            construction,
            projection,
            headTokenId,
          );

        for (
          const memberEdge of
            memberEdges
        ) {
          const memberNode =
            nodeById(
              graph,
              memberEdge.sourceId,
            );

          if (!memberNode) {
            continue;
          }

          const factId = [
            'predicate-sense-occurrence',
            idPart(
              predicate.id,
            ),
            idPart(
              projection
                .projectionId,
            ),
            idPart(
              construction.id,
            ),
            idPart(
              memberEdge.id,
            ),
          ].join(':');

          evidenceFacts.push({
            id:
              factId,

            predicateId:
              predicate.id,

            headTokenId,

            // Opaque source role.
            sense:
              projection.sense,

            evidenceKind:
              'construction',

            // Structural evidence supports a candidate sense.
            // It never resolves the sense by itself.
            status:
              'candidate',

            sourceCandidateCodes:
              unique([
                ...projection
                  .sourceCandidateCodes,

                ...constructionSourceCodes(
                  construction,
                ),
              ]).sort(),

            sourceSections:
              unique([
                ...projection
                  .sourceSections,
              ]).sort(),

            sourceIds:
              unique([
                construction.id,
                memberEdge.id,
                memberNode.id,
              ]).sort(),

            evidenceIds:
              unique([
                ...construction
                  .evidenceIds,

                ...memberEdge
                  .evidenceIds,

                ...memberNode
                  .evidenceIds,

                ...predicate
                  .evidenceIds,
              ]).sort(),

            provenanceIds:
              unique([
                ...construction
                  .provenanceIds,

                ...memberEdge
                  .provenanceIds,

                ...memberNode
                  .provenanceIds,

                ...predicate
                  .provenanceIds,
              ]).sort(),

            payload: {
              projectionId:
                projection
                  .projectionId,

              projectionPolicy:
                projection
                  .projectionPolicy,

              sourceRoleField:
                projection
                  .roleField,

              sourceMemberRef:
                projection
                  .memberRef,

              sourceCandidateCode:
                projection
                  .sourceCandidateCode,

              constructionId:
                construction.id,

              constructionStatus:
                construction.status,

              constructionMemberEdgeId:
                memberEdge.id,

              constructionMemberStatus:
                memberEdge.status,

              memberNodeId:
                memberNode.id,

              memberNodeType:
                memberNode.type,

              exactOccurrenceBinding:
                true,

              exactPredicateHeadBinding:
                true,

              candidateSupportOnly:
                true,

              frozenGrammarReadOnly:
                true,
            },
          });
        }
      }
    }
  }

  evidenceFacts.sort(
    (a, b) =>
      a.id.localeCompare(
        b.id,
      ),
  );

  diagnostics.sort(
    (a, b) =>
      [
        a.code,
        a.projectionId ?? '',
        a.predicateId ?? '',
        a.constructionId ?? '',
        a.edgeId ?? '',
      ].join('|')
        .localeCompare(
          [
            b.code,
            b.projectionId ?? '',
            b.predicateId ?? '',
            b.constructionId ?? '',
            b.edgeId ?? '',
          ].join('|'),
        ),
  );

  return {
    producer:
      CANONICAL_PREDICATE_SENSE_OCCURRENCE_BINDING_V1,

    producerVersion:
      CANONICAL_PREDICATE_SENSE_OCCURRENCE_BINDING_VERSION_V1,

    evidenceFacts,

    diagnostics,
  };
}