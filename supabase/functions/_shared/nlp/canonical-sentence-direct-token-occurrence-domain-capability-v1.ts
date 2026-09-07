// Norsk Trainer — Canonical Sentence Direct-Token Occurrence Domain Capability V1
//
// v1.46 A3.2.4b-T
//
// Canonical-only capability:
//
//   exact canonical graph snapshot
//       |
//       +-- CanonicalSentenceOccurrenceIdentityAuthorityV1
//       |
//       +-- neutral canonical token occurrence inventory
//       |
//       v
//   exact sentence -> direct-token occurrence domains.
//
// CRITICAL:
//
// Both upstream authorities are derived from the SAME canonical graph
// input inside this capability. Therefore sentence membership evidence
// and token occurrence identity cannot be mixed across graph snapshots.
//
// Domain membership is defined ONLY by the already-proven resolved
// canonical_surface_adapter_v1 sentence -> token contains relation.
//
// This layer DOES NOT:
//
// - infer containment from sentenceIndex;
// - infer containment from spans;
// - generalize token containment to phrase/predicate/clause nodes;
// - consume Runtime binding scope compatibility;
// - create a Runtime binding occurrence domain;
// - evaluate where;
// - enforce cardinality;
// - bind an occurrence;
// - create a clause;
// - mutate the graph.

import type {
  CanonicalLanguageGraphV1,
  GraphStatus,
} from './canonical-language-graph-core-v1.ts';

import {
  CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,
  deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1,
  type CanonicalSentenceOccurrenceIdentityAuthorityV1,
} from './canonical-sentence-occurrence-identity-authority-v1.ts';

import {
  CANONICAL_NODE_TYPE_OCCURRENCE_INVENTORY_CAPABILITY_V1,
  readCanonicalNodeTypeOccurrenceInventoryV1,
  type CanonicalNodeTypeOccurrenceInventoryV1,
} from './canonical-node-type-occurrence-inventory-capability-v1.ts';


export const CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1 =
  'canonical_sentence_direct_token_occurrence_domain_capability_v1';


export type CanonicalSentenceDirectTokenDomainOccurrenceV1 = {
  tokenNodeId:
    string;

  graphStatus:
    GraphStatus;

  containmentEdgeId:
    string;

  sentenceTokenIndex:
    number;
};


export type CanonicalSentenceDirectTokenOccurrenceDomainV1 = {
  domainId:
    string;

  status:
    'proven';

  graphVersion:
    'canonical-language-graph-v1';

  graphDocumentId:
    string;

  sentenceAuthorityId:
    string;

  sentenceNodeId:
    string;

  sentenceIndex:
    number;

  boundaryLabel:
    'sentence';

  boundaryCandidateId:
    string | null;

  membershipModel:
    'resolved_surface_contains_edge';

  occurrences:
    CanonicalSentenceDirectTokenDomainOccurrenceV1[];

  occurrenceCount:
    number;

  governance: {
    exactSameCanonicalGraphInputRequired:
      true;

    exactSentenceOccurrenceAuthorityRequired:
      true;

    exactNeutralTokenInventoryRequired:
      true;

    sentenceNodeIdIsOccurrenceIdentity:
      true;

    directSurfaceTokenContainmentResolved:
      true;

    exactTokenNodeIdentityJoinRequired:
      true;

    exactContainmentEdgeIdentityPreserved:
      true;

    exactSentenceTokenIndexPreserved:
      true;

    exactTokenGraphStatusPreserved:
      true;

    membershipAuthorityDefinesDomain:
      true;

    zeroDirectTokensAllowed:
      true;

    multipleDirectTokensAllowed:
      true;

    deterministicSentenceTokenOrdering:
      true;

    sentenceIndexIsOccurrenceIdentity:
      false;

    sentenceIndexIsLocalityMetadataOnly:
      true;

    containmentInferredFromSentenceIndex:
      false;

    containmentInferredFromSpan:
      false;

    genericOccurrenceContainmentResolved:
      false;

    phraseContainmentResolved:
      false;

    predicateContainmentResolved:
      false;

    clauseContainmentResolved:
      false;

    runtimeBindingConsumed:
      false;

    runtimeScopeCompatibilityConsumed:
      false;

    runtimeBindingOccurrenceDomainResolved:
      false;

    runtimeScopeExecutionPerformed:
      false;

    whereEvaluationPerformed:
      false;

    cardinalityEnforcementPerformed:
      false;

    occurrenceBindingPerformed:
      false;

    occurrenceWinnerSelected:
      false;

    graphMutationPerformed:
      false;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalSentenceDirectTokenOccurrenceDomainResultV1 = {
  producer:
    typeof CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  graphDocumentId:
    string | null;

  domains:
    CanonicalSentenceDirectTokenOccurrenceDomainV1[];

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


function safeSentenceAuthority(
  authority:
    CanonicalSentenceOccurrenceIdentityAuthorityV1,
): boolean {
  const g =
    authority.governance;


  if (
    !stringPresent(
      authority.authorityId,
    ) ||

    authority.status !==
      'proven' ||

    authority.boundaryLabel !==
      'sentence' ||

    authority.source !==
      CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1 ||

    !stringPresent(
      authority.sentenceNodeId,
    ) ||

    !Number.isInteger(
      authority.sentenceIndex,
    ) ||

    authority.sentenceIndex <
      0 ||

    !Array.isArray(
      authority.directTokenMemberships,
    ) ||

    g.identityModel !==
      'sentence_node_id' ||

    g.membershipModel !==
      'resolved_surface_contains_edge' ||

    g.sentenceNodeIdIsOccurrenceIdentity !==
      true ||

    g.sentenceIndexIsOccurrenceIdentity !==
      false ||

    g.sentenceIndexIsLocalityMetadataOnly !==
      true ||

    g.boundaryCandidateIdIsOccurrenceIdentity !==
      false ||

    g.boundaryCandidateIdMayBeNull !==
      true ||

    g.directSurfaceTokenContainmentResolved !==
      true ||

    g.membershipInferredFromSentenceIndex !==
      false ||

    g.phraseContainmentResolved !==
      false ||

    g.clauseContainmentResolved !==
      false ||

    g.selfSemanticsResolved !==
      false ||

    g.runtimeScopeExecutionPerformed !==
      false ||

    g.runtimeBindingOccurrenceEnumerationPerformed !==
      false ||

    g.whereExecutionPerformed !==
      false ||

    g.cardinalityEnforcementPerformed !==
      false ||

    g.dependencyDirectionResolved !==
      false ||

    g.canonicalDependencyEdgeGenerated !==
      false ||

    g.grammaticalFunctionResolved !==
      false ||

    g.complementArgumentAttachmentResolved !==
      false ||

    g.realizesSlotGenerated !==
      false ||

    g.graphMutationPerformed !==
      false ||

    g.frozenGrammarReadOnly !==
      true
  ) {
    return false;
  }


  const tokenIds =
    new Set<
      string
    >();

  const edgeIds =
    new Set<
      string
    >();

  const tokenIndexes =
    new Set<
      number
    >();


  for (
    const membership of
      authority.directTokenMemberships
  ) {
    if (
      !stringPresent(
        membership.tokenNodeId,
      ) ||

      !stringPresent(
        membership.containmentEdgeId,
      ) ||

      !Number.isInteger(
        membership.sentenceTokenIndex,
      ) ||

      membership.sentenceTokenIndex <
        0 ||

      tokenIds.has(
        membership.tokenNodeId,
      ) ||

      edgeIds.has(
        membership.containmentEdgeId,
      ) ||

      tokenIndexes.has(
        membership.sentenceTokenIndex,
      )
    ) {
      return false;
    }


    tokenIds.add(
      membership.tokenNodeId,
    );

    edgeIds.add(
      membership.containmentEdgeId,
    );

    tokenIndexes.add(
      membership.sentenceTokenIndex,
    );
  }


  return true;
}


function safeTokenInventory(
  inventory:
    CanonicalNodeTypeOccurrenceInventoryV1,
): boolean {
  const g =
    inventory.governance;


  if (
    inventory.status !==
      'proven' ||

    inventory.graphVersion !==
      'canonical-language-graph-v1' ||

    !stringPresent(
      inventory.graphDocumentId,
    ) ||

    inventory.canonicalNodeType !==
      'token' ||

    !stringPresent(
      inventory.inventoryId,
    ) ||

    !Array.isArray(
      inventory.occurrences,
    ) ||

    inventory.occurrenceCount !==
      inventory.occurrences.length ||

    g.exactCanonicalGraphVersionRequired !==
      true ||

    g.exactGraphDocumentIdentityPreserved !==
      true ||

    g.canonicalNodeTypeUsedAsGraphTypeSelectorOnly !==
      true ||

    g.exactNodeIdPreserved !==
      true ||

    g.exactNodeTypePreserved !==
      true ||

    g.exactGraphStatusPreserved !==
      true ||

    g.zeroOccurrencesAllowed !==
      true ||

    g.multipleOccurrencesAllowed !==
      true ||

    g.allGraphStatusesPreserved !==
      true ||

    g.deterministicNodeIdOrdering !==
      true ||

    g.graphNodeIdentityConsumedNotReconstructed !==
      true ||

    g.neutralGraphInventoryOnly !==
      true ||

    g.bindingAgnostic !==
      true ||

    g.runtimeBindingConsumed !==
      false ||

    g.runtimeEntitySemanticsResolved !==
      false ||

    g.runtimeBindingOccurrenceDomainResolved !==
      false ||

    g.scopeSemanticsResolved !==
      false ||

    g.whereSemanticsResolved !==
      false ||

    g.cardinalitySemanticsResolved !==
      false ||

    g.occurrenceWinnerSelected !==
      false ||

    g.resolvedOccurrencePreferred !==
      false ||

    g.candidateOccurrenceDiscarded !==
      false ||

    g.rejectedOccurrenceDiscarded !==
      false ||

    g.blockedOccurrenceDiscarded !==
      false ||

    g.ambiguousOccurrenceDiscarded !==
      false ||

    g.alternativeSetReadPerformed !==
      false ||

    g.alternativeSetResolutionPerformed !==
      false ||

    g.occurrenceBindingPerformed !==
      false ||

    g.runtimeScopeExecutionPerformed !==
      false ||

    g.whereEvaluationPerformed !==
      false ||

    g.cardinalityEnforcementPerformed !==
      false ||

    g.predicateSemanticsResolved !==
      false ||

    g.clauseIdentityResolved !==
      false ||

    g.clauseNodeGenerated !==
      false ||

    g.graphMutationPerformed !==
      false ||

    g.frozenGrammarReadOnly !==
      true
  ) {
    return false;
  }


  const seenNodeIds =
    new Set<
      string
    >();


  for (
    const occurrence of
      inventory.occurrences
  ) {
    if (
      !stringPresent(
        occurrence.nodeId,
      ) ||

      occurrence.nodeType !==
        'token' ||

      seenNodeIds.has(
        occurrence.nodeId,
      )
    ) {
      return false;
    }


    seenNodeIds.add(
      occurrence.nodeId,
    );
  }


  return true;
}


function blockedResult(
  reasons:
    readonly string[],
): CanonicalSentenceDirectTokenOccurrenceDomainResultV1 {
  return {
    producer:
      CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1,

    producerVersion:
      '1',

    status:
      'blocked',

    graphDocumentId:
      null,

    domains:
      [],

    blockingReasons:
      uniqueSorted(
        reasons,
      ),
  };
}


export function deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
  graph:
    CanonicalLanguageGraphV1,
): CanonicalSentenceDirectTokenOccurrenceDomainResultV1 {
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
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  // IMPORTANT:
  // Both authorities are derived from this exact same graph object.
  const sentenceResult =
    deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
      graph,
    );

  const tokenInventoryResult =
    readCanonicalNodeTypeOccurrenceInventoryV1(
      graph,
      'token',
    );


  if (
    sentenceResult.producer !==
      CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1 ||

    sentenceResult.producerVersion !==
      '1' ||

    sentenceResult.status !==
      'ready' ||

    sentenceResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      'sentence_authority_result:not_exact_ready',
    );
  }


  if (
    tokenInventoryResult.producer !==
      CANONICAL_NODE_TYPE_OCCURRENCE_INVENTORY_CAPABILITY_V1 ||

    tokenInventoryResult.producerVersion !==
      '1' ||

    tokenInventoryResult.status !==
      'ready' ||

    tokenInventoryResult.blockingReasons.length !==
      0 ||

    !tokenInventoryResult.inventory
  ) {
    blockingReasons.push(
      'token_inventory_result:not_exact_ready',
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


  const tokenInventory =
    tokenInventoryResult.inventory!;


  if (
    tokenInventory.graphDocumentId !==
      graph.documentId
  ) {
    return blockedResult([
      'token_inventory:graph_document_identity_mismatch',
    ]);
  }


  if (
    !safeTokenInventory(
      tokenInventory,
    )
  ) {
    return blockedResult([
      'token_inventory:unsafe_contract',
    ]);
  }


  const seenAuthorityIds =
    new Set<
      string
    >();

  const seenSentenceNodeIds =
    new Set<
      string
    >();

  const seenDirectTokenIds =
    new Set<
      string
    >();


  for (
    const authority of
      sentenceResult.authorities
  ) {
    if (
      seenAuthorityIds.has(
        authority.authorityId,
      )
    ) {
      blockingReasons.push(
        `sentence_authority:${authority.authorityId}:duplicate_id`,
      );
    }


    seenAuthorityIds.add(
      authority.authorityId,
    );


    if (
      seenSentenceNodeIds.has(
        authority.sentenceNodeId,
      )
    ) {
      blockingReasons.push(
        `sentence_node:${authority.sentenceNodeId}:duplicate_occurrence_identity`,
      );
    }


    seenSentenceNodeIds.add(
      authority.sentenceNodeId,
    );


    if (
      !safeSentenceAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `sentence_authority:${authority.authorityId}:unsafe_contract`,
      );
    }


    for (
      const membership of
        authority.directTokenMemberships
    ) {
      if (
        seenDirectTokenIds.has(
          membership.tokenNodeId,
        )
      ) {
        blockingReasons.push(
          `token:${membership.tokenNodeId}:belongs_to_multiple_sentence_domains`,
        );
      }


      seenDirectTokenIds.add(
        membership.tokenNodeId,
      );
    }
  }


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  const tokenOccurrenceById =
    new Map(
      tokenInventory.occurrences.map(
        (occurrence) => [
          occurrence.nodeId,
          occurrence,
        ] as const,
      ),
    );


  const domains:
    CanonicalSentenceDirectTokenOccurrenceDomainV1[] =
      [];


  for (
    const authority of
      [...sentenceResult.authorities].sort(
        (a, b) =>
          a.sentenceIndex -
            b.sentenceIndex ||

          a.sentenceNodeId.localeCompare(
            b.sentenceNodeId,
          ),
      )
  ) {
    const occurrences:
      CanonicalSentenceDirectTokenDomainOccurrenceV1[] =
        [];


    for (
      const membership of
        authority.directTokenMemberships
    ) {
      const occurrence =
        tokenOccurrenceById.get(
          membership.tokenNodeId,
        );


      if (!occurrence) {
        blockingReasons.push(
          `sentence:${authority.sentenceNodeId}:token:${membership.tokenNodeId}:missing_from_neutral_inventory`,
        );

        continue;
      }


      // Membership, not GraphStatus preference, defines the domain.
      // GraphStatus is copied exactly from the neutral inventory.
      occurrences.push({
        tokenNodeId:
          occurrence.nodeId,

        graphStatus:
          occurrence.graphStatus,

        containmentEdgeId:
          membership.containmentEdgeId,

        sentenceTokenIndex:
          membership.sentenceTokenIndex,
      });
    }


    occurrences.sort(
      (a, b) =>
        a.sentenceTokenIndex -
          b.sentenceTokenIndex ||

        a.tokenNodeId.localeCompare(
          b.tokenNodeId,
        ),
    );


    domains.push({
      domainId: [
        'canonical-sentence-direct-token-domain-v1',
        idPart(
          graph.documentId,
        ),
        idPart(
          authority.sentenceNodeId,
        ),
      ].join(':'),

      status:
        'proven',

      graphVersion:
        'canonical-language-graph-v1',

      graphDocumentId:
        graph.documentId,

      sentenceAuthorityId:
        authority.authorityId,

      sentenceNodeId:
        authority.sentenceNodeId,

      sentenceIndex:
        authority.sentenceIndex,

      boundaryLabel:
        'sentence',

      boundaryCandidateId:
        authority.boundaryCandidateId,

      membershipModel:
        'resolved_surface_contains_edge',

      occurrences,

      occurrenceCount:
        occurrences.length,

      governance: {
        exactSameCanonicalGraphInputRequired:
          true,

        exactSentenceOccurrenceAuthorityRequired:
          true,

        exactNeutralTokenInventoryRequired:
          true,

        sentenceNodeIdIsOccurrenceIdentity:
          true,

        directSurfaceTokenContainmentResolved:
          true,

        exactTokenNodeIdentityJoinRequired:
          true,

        exactContainmentEdgeIdentityPreserved:
          true,

        exactSentenceTokenIndexPreserved:
          true,

        exactTokenGraphStatusPreserved:
          true,

        membershipAuthorityDefinesDomain:
          true,

        zeroDirectTokensAllowed:
          true,

        multipleDirectTokensAllowed:
          true,

        deterministicSentenceTokenOrdering:
          true,

        sentenceIndexIsOccurrenceIdentity:
          false,

        sentenceIndexIsLocalityMetadataOnly:
          true,

        containmentInferredFromSentenceIndex:
          false,

        containmentInferredFromSpan:
          false,

        genericOccurrenceContainmentResolved:
          false,

        phraseContainmentResolved:
          false,

        predicateContainmentResolved:
          false,

        clauseContainmentResolved:
          false,

        runtimeBindingConsumed:
          false,

        runtimeScopeCompatibilityConsumed:
          false,

        runtimeBindingOccurrenceDomainResolved:
          false,

        runtimeScopeExecutionPerformed:
          false,

        whereEvaluationPerformed:
          false,

        cardinalityEnforcementPerformed:
          false,

        occurrenceBindingPerformed:
          false,

        occurrenceWinnerSelected:
          false,

        graphMutationPerformed:
          false,

        frozenGrammarReadOnly:
          true,
      },
    });
  }


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  return {
    producer:
      CANONICAL_SENTENCE_DIRECT_TOKEN_OCCURRENCE_DOMAIN_CAPABILITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    graphDocumentId:
      graph.documentId,

    domains,

    blockingReasons:
      [],
  };
}