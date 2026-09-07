// Norsk Trainer — Canonical Node-Type Occurrence Inventory Capability V1
//
// v1.46 A3.2.3d
//
// Neutral graph-only capability:
//
//   canonical graph
//       +
//   canonical GraphNodeType
//       ->
//   zero / one / many exact graph-node occurrence snapshots.
//
// This layer is deliberately binding-agnostic.
//
// It proves only that the canonical graph can expose all nodes of one
// canonical node type while preserving:
//
// - exact node ID;
// - exact node type;
// - exact GraphStatus;
// - zero occurrences;
// - multiple occurrences;
// - deterministic ordering.
//
// It intentionally DOES NOT:
//
// - interpret Runtime bindings;
// - consume binding entity/scope/where/cardinality;
// - call this inventory a Runtime occurrence domain;
// - select one occurrence;
// - prefer resolved occurrences;
// - discard candidate / resolved / rejected / blocked / ambiguous nodes;
// - resolve alternative sets;
// - execute scope;
// - execute where;
// - enforce cardinality;
// - create a clause;
// - mutate the graph.

import type {
  CanonicalLanguageGraphV1,
  GraphNodeType,
  GraphStatus,
} from './canonical-language-graph-core-v1.ts';


export const CANONICAL_NODE_TYPE_OCCURRENCE_INVENTORY_CAPABILITY_V1 =
  'canonical_node_type_occurrence_inventory_capability_v1';


export type CanonicalNodeTypeOccurrenceInventoryMemberV1 = {
  nodeId:
    string;

  nodeType:
    GraphNodeType;

  graphStatus:
    GraphStatus;
};


export type CanonicalNodeTypeOccurrenceInventoryV1 = {
  inventoryId:
    string;

  status:
    'proven';

  graphVersion:
    'canonical-language-graph-v1';

  graphDocumentId:
    string;

  canonicalNodeType:
    GraphNodeType;

  occurrences:
    CanonicalNodeTypeOccurrenceInventoryMemberV1[];

  occurrenceCount:
    number;

  governance: {
    exactCanonicalGraphVersionRequired:
      true;

    exactGraphDocumentIdentityPreserved:
      true;

    canonicalNodeTypeUsedAsGraphTypeSelectorOnly:
      true;

    exactNodeIdPreserved:
      true;

    exactNodeTypePreserved:
      true;

    exactGraphStatusPreserved:
      true;

    zeroOccurrencesAllowed:
      true;

    multipleOccurrencesAllowed:
      true;

    allGraphStatusesPreserved:
      true;

    deterministicNodeIdOrdering:
      true;

    graphNodeIdentityConsumedNotReconstructed:
      true;

    neutralGraphInventoryOnly:
      true;

    bindingAgnostic:
      true;

    runtimeBindingConsumed:
      false;

    runtimeEntitySemanticsResolved:
      false;

    runtimeBindingOccurrenceDomainResolved:
      false;

    scopeSemanticsResolved:
      false;

    whereSemanticsResolved:
      false;

    cardinalitySemanticsResolved:
      false;

    occurrenceWinnerSelected:
      false;

    resolvedOccurrencePreferred:
      false;

    candidateOccurrenceDiscarded:
      false;

    rejectedOccurrenceDiscarded:
      false;

    blockedOccurrenceDiscarded:
      false;

    ambiguousOccurrenceDiscarded:
      false;

    alternativeSetReadPerformed:
      false;

    alternativeSetResolutionPerformed:
      false;

    occurrenceBindingPerformed:
      false;

    runtimeScopeExecutionPerformed:
      false;

    whereEvaluationPerformed:
      false;

    cardinalityEnforcementPerformed:
      false;

    predicateSemanticsResolved:
      false;

    clauseIdentityResolved:
      false;

    clauseNodeGenerated:
      false;

    graphMutationPerformed:
      false;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalNodeTypeOccurrenceInventoryResultV1 = {
  producer:
    typeof CANONICAL_NODE_TYPE_OCCURRENCE_INVENTORY_CAPABILITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  inventory?:
    CanonicalNodeTypeOccurrenceInventoryV1;

  blockingReasons:
    string[];
};


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


function blockedResult(
  reasons:
    readonly string[],
): CanonicalNodeTypeOccurrenceInventoryResultV1 {
  return {
    producer:
      CANONICAL_NODE_TYPE_OCCURRENCE_INVENTORY_CAPABILITY_V1,

    producerVersion:
      '1',

    status:
      'blocked',

    blockingReasons:
      uniqueSorted(
        reasons,
      ),
  };
}


export function readCanonicalNodeTypeOccurrenceInventoryV1(
  graph:
    CanonicalLanguageGraphV1,

  canonicalNodeType:
    GraphNodeType,
): CanonicalNodeTypeOccurrenceInventoryResultV1 {
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
    typeof graph.documentId !==
      'string' ||
    graph.documentId.length ===
      0
  ) {
    blockingReasons.push(
      'graph:document_id_missing',
    );
  }


  if (
    !Array.isArray(
      graph.nodes,
    )
  ) {
    blockingReasons.push(
      'graph:nodes_not_array',
    );
  }


  if (
    typeof canonicalNodeType !==
      'string' ||
    canonicalNodeType.length ===
      0
  ) {
    blockingReasons.push(
      'canonical_node_type:missing',
    );
  }


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  const seenNodeIds =
    new Set<
      string
    >();


  for (
    const node of
      graph.nodes
  ) {
    if (
      typeof node.id !==
        'string' ||
      node.id.length ===
        0
    ) {
      blockingReasons.push(
        'graph_node:missing_id',
      );

      continue;
    }


    if (
      seenNodeIds.has(
        node.id,
      )
    ) {
      blockingReasons.push(
        `graph_node:${node.id}:duplicate_id`,
      );

      continue;
    }


    seenNodeIds.add(
      node.id,
    );
  }


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  const occurrences:
    CanonicalNodeTypeOccurrenceInventoryMemberV1[] =
      graph.nodes
        .filter(
          (node) =>
            node.type ===
              canonicalNodeType,
        )
        .map(
          (node) => ({
            nodeId:
              node.id,

            nodeType:
              node.type,

            graphStatus:
              node.status,
          }),
        )
        .sort(
          (a, b) =>
            a.nodeId.localeCompare(
              b.nodeId,
            ),
        );


  return {
    producer:
      CANONICAL_NODE_TYPE_OCCURRENCE_INVENTORY_CAPABILITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    inventory: {
      inventoryId: [
        'canonical-node-type-occurrence-inventory-v1',
        idPart(
          graph.documentId,
        ),
        idPart(
          canonicalNodeType,
        ),
      ].join(':'),

      status:
        'proven',

      graphVersion:
        'canonical-language-graph-v1',

      graphDocumentId:
        graph.documentId,

      canonicalNodeType,

      occurrences,

      occurrenceCount:
        occurrences.length,

      governance: {
        exactCanonicalGraphVersionRequired:
          true,

        exactGraphDocumentIdentityPreserved:
          true,

        canonicalNodeTypeUsedAsGraphTypeSelectorOnly:
          true,

        exactNodeIdPreserved:
          true,

        exactNodeTypePreserved:
          true,

        exactGraphStatusPreserved:
          true,

        zeroOccurrencesAllowed:
          true,

        multipleOccurrencesAllowed:
          true,

        allGraphStatusesPreserved:
          true,

        deterministicNodeIdOrdering:
          true,

        graphNodeIdentityConsumedNotReconstructed:
          true,

        neutralGraphInventoryOnly:
          true,

        bindingAgnostic:
          true,

        runtimeBindingConsumed:
          false,

        runtimeEntitySemanticsResolved:
          false,

        runtimeBindingOccurrenceDomainResolved:
          false,

        scopeSemanticsResolved:
          false,

        whereSemanticsResolved:
          false,

        cardinalitySemanticsResolved:
          false,

        occurrenceWinnerSelected:
          false,

        resolvedOccurrencePreferred:
          false,

        candidateOccurrenceDiscarded:
          false,

        rejectedOccurrenceDiscarded:
          false,

        blockedOccurrenceDiscarded:
          false,

        ambiguousOccurrenceDiscarded:
          false,

        alternativeSetReadPerformed:
          false,

        alternativeSetResolutionPerformed:
          false,

        occurrenceBindingPerformed:
          false,

        runtimeScopeExecutionPerformed:
          false,

        whereEvaluationPerformed:
          false,

        cardinalityEnforcementPerformed:
          false,

        predicateSemanticsResolved:
          false,

        clauseIdentityResolved:
          false,

        clauseNodeGenerated:
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