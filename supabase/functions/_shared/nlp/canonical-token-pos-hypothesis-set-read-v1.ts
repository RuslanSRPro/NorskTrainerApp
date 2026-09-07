// Norsk Trainer — Canonical Token POS Hypothesis-Set Read V1
//
// v1.46 A3.3.2d
//
// Purpose:
//
//   exact canonical token occurrence
//       +
//   A3.3.2a canonical POS ownership authority
//       +
//   A3.3.2b token POS property capability
//       ->
//   read-only structural classification of CURRENT canonical POS state.
//
// Supported read states:
//
//   no_pos_fact
//     no canonical POS fact exists for the exact token.
//
//   open_hypothesis_set
//     canonical POS alternative set is explicitly open.
//
//   explicit_resolved
//     canonical POS alternative set is explicitly resolved and
//     resolvedMemberIds explicitly names the resolved fact(s).
//
//   blocked_hypothesis_set
//     canonical POS alternative set is explicitly blocked.
//
// Important:
//
//   This layer READS existing canonical state.
//   It does NOT decide what the state should become.
//
// In particular:
//
// - one candidate does NOT imply resolved;
// - one surviving candidate does NOT imply resolved;
// - GraphStatus "ambiguous" does NOT become an alternative-set state;
// - positive constraint evidence is NOT reevaluated here;
// - constraint propagation is NOT invoked;
// - Runtime IR is NOT consumed;
// - equality is NOT evaluated.

import type {
  CanonicalLanguageGraphV1,
  GraphStatus,
  LanguageGraphAlternativeSetV1,
  LanguageGraphNodeV1,
} from "./canonical-language-graph-core-v1.ts";

import {
  CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1,
  type CanonicalPosFactOwnershipAuthorityResultV1,
  type CanonicalPosFactOwnershipAuthorityV1,
} from "./canonical-pos-fact-ownership-authority-v1.ts";

import {
  CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1,
  type CanonicalTokenPosPropertyCapabilityResultV1,
  type CanonicalTokenPosPropertyCapabilityV1,
} from "./canonical-token-pos-property-capability-v1.ts";

export const CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1 =
  "canonical_token_pos_hypothesis_set_read_v1";

const SURFACE_PRODUCER = "canonical_surface_adapter_v1";

export type CanonicalTokenPosHypothesisMemberReadV1 = {
  posReadingNodeId: string;

  posLabel: string;

  graphStatus: GraphStatus;

  explicitlyResolved: boolean;
};

export type CanonicalTokenPosHypothesisSetReadStateV1 =
  | "no_pos_fact"
  | "open_hypothesis_set"
  | "explicit_resolved"
  | "blocked_hypothesis_set";

export type CanonicalTokenPosHypothesisSetReadV1 = {
  readId: string;

  status: "proven";

  tokenNodeId: string;

  readState: CanonicalTokenPosHypothesisSetReadStateV1;

  alternativeSetId: string | null;

  alternativeSetStatus: LanguageGraphAlternativeSetV1["status"] | null;

  members: CanonicalTokenPosHypothesisMemberReadV1[];

  resolvedMemberIds: string[];

  resolvedPosLabels: string[];

  governance: {
    exactCanonicalTokenRequired: true;

    exactPosOwnershipAuthorityRequired: true;

    exactTokenPosCapabilityRequired: true;

    readsExistingCanonicalStateOnly: true;

    alternativeSetStatusIsAuthoritative: true;

    resolvedMembersMustBeExplicit: true;

    singletonAutoResolved: false;

    survivingCandidateAutoResolved: false;

    positiveConstraintEvidenceReevaluated: false;

    constraintPropagationInvoked: false;

    graphFactAmbiguousStatusPromotedToSetAmbiguity: false;

    memberGraphStatusesPreserved: true;

    propertyValueIsScalar: false;

    propertyValueIsHypothesisSet: true;

    runtimePosSuffixConsumed: false;

    runtimeBindingConsumed: false;

    rightOperandRead: false;

    operatorSemanticsResolved: false;

    whereEqExecuted: false;

    occurrenceEnumerationPerformed: false;

    runtimeScopeExecutionPerformed: false;

    cardinalityEnforcementPerformed: false;

    occurrenceBindingPerformed: false;

    canonicalDependencyEdgeGenerated: false;

    realizesSlotGenerated: false;

    graphMutationPerformed: false;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalTokenPosHypothesisSetReadResultV1 = {
  producer: typeof CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1;

  producerVersion: "1";

  status:
    | "ready"
    | "blocked";

  read?: CanonicalTokenPosHypothesisSetReadV1;

  blockingReasons: string[];
};

function stringValue(
  value: unknown,
): string | undefined {
  if (
    typeof value !==
      "string"
  ) {
    return undefined;
  }

  const trimmed = value.trim();

  return (
    trimmed ||
    undefined
  );
}

function unique(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}

function sameStrings(
  a: readonly string[],
  b: readonly string[],
): boolean {
  return (
    JSON.stringify(
      unique(
        a,
      ),
    ) ===
      JSON.stringify(
        unique(
          b,
        ),
      )
  );
}

function exactNode(
  graph: CanonicalLanguageGraphV1,
  nodeId: string,
): LanguageGraphNodeV1 | undefined {
  const matches = graph.nodes.filter(
    (node) =>
      node.id ===
        nodeId,
  );

  return matches.length ===
      1
    ? matches[0]
    : undefined;
}

function exactAlternativeSet(
  graph: CanonicalLanguageGraphV1,
  setId: string,
): LanguageGraphAlternativeSetV1 | undefined {
  const matches = graph.alternativeSets.filter(
    (set) =>
      set.id ===
        setId,
  );

  return matches.length ===
      1
    ? matches[0]
    : undefined;
}

function exactCanonicalToken(
  graph: CanonicalLanguageGraphV1,
  tokenNodeId: string,
): LanguageGraphNodeV1 | undefined {
  const node = exactNode(
    graph,
    tokenNodeId,
  );

  if (
    !node ||
    node.type !==
      "token" ||
    node.status !==
      "resolved" ||
    node.producer !==
      SURFACE_PRODUCER
  ) {
    return undefined;
  }

  return node;
}

function graphPosReadingIdsForToken(
  graph: CanonicalLanguageGraphV1,
  tokenNodeId: string,
): string[] {
  return unique(
    graph.edges
      .filter(
        (edge) =>
          edge.relation ===
            "pos_of" &&
          edge.targetId ===
            tokenNodeId,
      )
      .map(
        (edge) => edge.sourceId,
      )
      .filter(
        (nodeId) => {
          const node = exactNode(
            graph,
            nodeId,
          );

          return (
            node?.type ===
              "lexical_reading" &&
            node.subtype ===
              "pos_candidate"
          );
        },
      ),
  );
}

function safeOwnershipAuthority(
  authority: CanonicalPosFactOwnershipAuthorityV1,
): boolean {
  const g = authority.governance;

  return (
    authority.status ===
      "proven" &&
    authority.model ===
      "POS-A" &&
    Boolean(
      stringValue(
        authority.authorityId,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.posReadingNodeId,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.posLabel,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.tokenNodeId,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.alternativeSetId,
      ),
    ) &&
    g.exactCanonicalPosRepresentation ===
      true &&
    g.posModel ===
      "POS-A" &&
    g.posFactNodeType ===
      "lexical_reading" &&
    g.posFactSubtype ===
      "pos_candidate" &&
    g.posLabelOwnedByNodeFeature ===
      true &&
    g.exactOccurrenceOwnershipUsesPosOfEdge ===
      true &&
    g.posOfDirection ===
      "pos_candidate_to_token" &&
    g.alternativeDomainIsTokenLocal ===
      true &&
    g.multiplePosCandidatesMayCoexist ===
      true &&
    g.underlyingGraphStatusPreserved ===
      true &&
    g.candidateDoesNotMeanResolved ===
      true &&
    g.resolvedAlternativeWinnerNotInferred ===
      true &&
    g.runtimePosSuffixMapped ===
      false &&
    g.whereEqExecuted ===
      false &&
    g.firstCandidateWins ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function safeCapability(
  capability: CanonicalTokenPosPropertyCapabilityV1,
): boolean {
  const g = capability.governance;

  return (
    capability.status ===
      "proven" &&
    Boolean(
      stringValue(
        capability.capabilityId,
      ),
    ) &&
    capability.propertyDomain ===
      "canonical_token_occurrence" &&
    capability.propertyKind ===
      "pos_hypothesis_set" &&
    capability.factNodeType ===
      "lexical_reading" &&
    capability.factNodeSubtype ===
      "pos_candidate" &&
    capability.factLabelFeature ===
      "pos" &&
    capability.occurrenceRelation ===
      "pos_of" &&
    capability.occurrenceRelationDirection ===
      "pos_candidate_to_token" &&
    g.groundedInCanonicalPosOwnershipV1 ===
      true &&
    g.posModel ===
      "POS-A" &&
    g.propertyValueIsScalar ===
      false &&
    g.propertyValueIsHypothesisSet ===
      true &&
    g.zeroHypothesesAllowed ===
      true &&
    g.multipleHypothesesAllowed ===
      true &&
    g.candidateHypothesisIsResolvedValue ===
      false &&
    g.alternativeWinnerMustBeExplicit ===
      true &&
    g.firstCandidateWins ===
      false &&
    g.runtimePosSuffixMapped ===
      false &&
    g.whereEqExecuted ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.runtimeScopeExecutionPerformed ===
      false &&
    g.cardinalityEnforcementPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function blockedResult(
  blockingReasons: readonly string[],
): CanonicalTokenPosHypothesisSetReadResultV1 {
  return {
    producer: CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1,

    producerVersion: "1",

    status: "blocked",

    blockingReasons: unique(
      blockingReasons,
    ),
  };
}

export function readCanonicalTokenPosHypothesisSetV1(
  graph: CanonicalLanguageGraphV1,
  tokenNodeId: string,
  ownershipResult: CanonicalPosFactOwnershipAuthorityResultV1,
  capabilityResult: CanonicalTokenPosPropertyCapabilityResultV1,
): CanonicalTokenPosHypothesisSetReadResultV1 {
  const blockingReasons: string[] = [];

  if (
    graph.version !==
      "canonical-language-graph-v1"
  ) {
    blockingReasons.push(
      "graph:unexpected_version",
    );
  }

  const token = exactCanonicalToken(
    graph,
    tokenNodeId,
  );

  if (!token) {
    blockingReasons.push(
      `token:${tokenNodeId}:not_exact_resolved_surface_token`,
    );
  }

  if (
    ownershipResult.producer !==
      CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1 ||
    ownershipResult.producerVersion !==
      "1" ||
    ownershipResult.status !==
      "ready" ||
    ownershipResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      "pos_ownership_result:not_exact_ready_authority",
    );
  }

  if (
    capabilityResult.producer !==
      CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1 ||
    capabilityResult.producerVersion !==
      "1" ||
    capabilityResult.status !==
      "ready" ||
    capabilityResult.blockingReasons.length !==
      0 ||
    !capabilityResult.capability ||
    !safeCapability(
      capabilityResult.capability,
    )
  ) {
    blockingReasons.push(
      "token_pos_capability_result:not_exact_ready_capability",
    );
  }

  const seenAuthorityIds = new Set<
    string
  >();

  const seenReadingIds = new Set<
    string
  >();

  for (
    const authority of ownershipResult.authorities
  ) {
    if (
      seenAuthorityIds.has(
        authority.authorityId,
      )
    ) {
      blockingReasons.push(
        `pos_authority:${authority.authorityId}:duplicate_authority_id`,
      );
    }

    seenAuthorityIds.add(
      authority.authorityId,
    );

    if (
      seenReadingIds.has(
        authority.posReadingNodeId,
      )
    ) {
      blockingReasons.push(
        `pos_reading:${authority.posReadingNodeId}:duplicate_authority`,
      );
    }

    seenReadingIds.add(
      authority.posReadingNodeId,
    );

    if (
      !safeOwnershipAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `pos_authority:${authority.authorityId}:unsafe_contract`,
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

  const authorities = ownershipResult.authorities
    .filter(
      (authority) =>
        authority.tokenNodeId ===
          tokenNodeId,
    )
    .sort(
      (a, b) =>
        a.posReadingNodeId.localeCompare(
          b.posReadingNodeId,
        ),
    );

  const authorityReadingIds = authorities.map(
    (authority) => authority.posReadingNodeId,
  );

  const graphReadingIds = graphPosReadingIdsForToken(
    graph,
    tokenNodeId,
  );

  if (
    !sameStrings(
      authorityReadingIds,
      graphReadingIds,
    )
  ) {
    return blockedResult([
      `token:${tokenNodeId}:graph_and_pos_authority_fact_set_mismatch`,
    ]);
  }

  const expectedAlternativeSetId = `alt:pos:${tokenNodeId}`;

  const alternative = exactAlternativeSet(
    graph,
    expectedAlternativeSetId,
  );

  if (
    authorities.length ===
      0
  ) {
    if (alternative) {
      return blockedResult([
        `token:${tokenNodeId}:alternative_set_exists_without_pos_facts`,
      ]);
    }

    return {
      producer: CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1,

      producerVersion: "1",

      status: "ready",

      read: {
        readId: `canonical-token-pos-read:${tokenNodeId}`,

        status: "proven",

        tokenNodeId,

        readState: "no_pos_fact",

        alternativeSetId: null,

        alternativeSetStatus: null,

        members: [],

        resolvedMemberIds: [],

        resolvedPosLabels: [],

        governance: {
          exactCanonicalTokenRequired: true,

          exactPosOwnershipAuthorityRequired: true,

          exactTokenPosCapabilityRequired: true,

          readsExistingCanonicalStateOnly: true,

          alternativeSetStatusIsAuthoritative: true,

          resolvedMembersMustBeExplicit: true,

          singletonAutoResolved: false,

          survivingCandidateAutoResolved: false,

          positiveConstraintEvidenceReevaluated: false,

          constraintPropagationInvoked: false,

          graphFactAmbiguousStatusPromotedToSetAmbiguity: false,

          memberGraphStatusesPreserved: true,

          propertyValueIsScalar: false,

          propertyValueIsHypothesisSet: true,

          runtimePosSuffixConsumed: false,

          runtimeBindingConsumed: false,

          rightOperandRead: false,

          operatorSemanticsResolved: false,

          whereEqExecuted: false,

          occurrenceEnumerationPerformed: false,

          runtimeScopeExecutionPerformed: false,

          cardinalityEnforcementPerformed: false,

          occurrenceBindingPerformed: false,

          canonicalDependencyEdgeGenerated: false,

          realizesSlotGenerated: false,

          graphMutationPerformed: false,

          frozenGrammarReadOnly: true,
        },
      },

      blockingReasons: [],
    };
  }

  if (!alternative) {
    return blockedResult([
      `token:${tokenNodeId}:pos_alternative_set_missing`,
    ]);
  }

  if (
    !sameStrings(
      alternative.memberIds,
      authorityReadingIds,
    )
  ) {
    return blockedResult([
      `token:${tokenNodeId}:alternative_member_set_mismatch`,
    ]);
  }

  for (
    const authority of authorities
  ) {
    if (
      authority.alternativeSetId !==
        alternative.id ||
      authority.alternativeSetStatus !==
        alternative.status ||
      !sameStrings(
        authority.alternativeMemberIds,
        alternative.memberIds,
      ) ||
      !sameStrings(
        authority.resolvedMemberIds,
        alternative.resolvedMemberIds,
      )
    ) {
      blockingReasons.push(
        `pos:${authority.posReadingNodeId}:stale_alternative_snapshot`,
      );
    }

    const node = exactNode(
      graph,
      authority.posReadingNodeId,
    );

    if (
      !node ||
      node.type !==
        "lexical_reading" ||
      node.subtype !==
        "pos_candidate"
    ) {
      blockingReasons.push(
        `pos:${authority.posReadingNodeId}:graph_fact_missing`,
      );

      continue;
    }

    if (
      node.status !==
        authority.posReadingGraphStatus
    ) {
      blockingReasons.push(
        `pos:${authority.posReadingNodeId}:graph_status_snapshot_mismatch`,
      );
    }

    if (
      stringValue(
        node.features
          .pos,
      ) !==
        authority.posLabel
    ) {
      blockingReasons.push(
        `pos:${authority.posReadingNodeId}:pos_label_snapshot_mismatch`,
      );
    }
  }

  if (
    alternative.status ===
      "open" &&
    alternative.resolvedMemberIds.length !==
      0
  ) {
    blockingReasons.push(
      `alternative:${alternative.id}:open_set_has_resolved_members`,
    );
  }

  if (
    alternative.status ===
      "open"
  ) {
    for (
      const authority of authorities
    ) {
      if (
        authority.posReadingGraphStatus ===
          "resolved"
      ) {
        blockingReasons.push(
          `alternative:${alternative.id}:open_set_has_graph_resolved_fact:${authority.posReadingNodeId}`,
        );
      }
    }
  }

  if (
    alternative.status ===
      "resolved"
  ) {
    if (
      alternative.resolvedMemberIds.length ===
        0
    ) {
      blockingReasons.push(
        `alternative:${alternative.id}:resolved_set_has_no_explicit_members`,
      );
    }

    for (
      const resolvedId of alternative.resolvedMemberIds
    ) {
      if (
        !alternative.memberIds.includes(
          resolvedId,
        )
      ) {
        blockingReasons.push(
          `alternative:${alternative.id}:resolved_member_not_in_set:${resolvedId}`,
        );

        continue;
      }

      const resolvedAuthority = authorities.find(
        (authority) =>
          authority.posReadingNodeId ===
            resolvedId,
      );

      if (
        !resolvedAuthority ||
        resolvedAuthority.posReadingGraphStatus !==
          "resolved"
      ) {
        blockingReasons.push(
          `alternative:${alternative.id}:explicit_member_not_graph_resolved:${resolvedId}`,
        );
      }
    }

    const graphResolvedMemberIds = authorities
      .filter(
        (authority) =>
          authority.posReadingGraphStatus ===
            "resolved",
      )
      .map(
        (authority) => authority.posReadingNodeId,
      );

    if (
      !sameStrings(
        graphResolvedMemberIds,
        alternative.resolvedMemberIds,
      )
    ) {
      blockingReasons.push(
        `alternative:${alternative.id}:graph_resolved_members_do_not_match_explicit_resolution`,
      );
    }
  }

  if (
    alternative.status ===
      "blocked"
  ) {
    if (
      alternative.resolvedMemberIds.length !==
        0
    ) {
      blockingReasons.push(
        `alternative:${alternative.id}:blocked_set_has_resolved_members`,
      );
    }

    for (
      const authority of authorities
    ) {
      if (
        authority.posReadingGraphStatus !==
          "rejected" &&
        authority.posReadingGraphStatus !==
          "blocked"
      ) {
        blockingReasons.push(
          `alternative:${alternative.id}:blocked_set_has_surviving_fact:${authority.posReadingNodeId}`,
        );
      }
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

  const members: CanonicalTokenPosHypothesisMemberReadV1[] = authorities.map(
    (authority) => ({
      posReadingNodeId: authority.posReadingNodeId,

      posLabel: authority.posLabel,

      graphStatus: authority.posReadingGraphStatus,

      explicitlyResolved: alternative.resolvedMemberIds.includes(
        authority.posReadingNodeId,
      ),
    }),
  );

  const resolvedPosLabels = members
    .filter(
      (member) => member.explicitlyResolved,
    )
    .map(
      (member) => member.posLabel,
    )
    .sort();

  const readState: CanonicalTokenPosHypothesisSetReadStateV1 =
    alternative.status ===
        "resolved"
      ? "explicit_resolved"
      : alternative.status ===
          "blocked"
      ? "blocked_hypothesis_set"
      : "open_hypothesis_set";

  return {
    producer: CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1,

    producerVersion: "1",

    status: "ready",

    read: {
      readId: `canonical-token-pos-read:${tokenNodeId}`,

      status: "proven",

      tokenNodeId,

      readState,

      alternativeSetId: alternative.id,

      alternativeSetStatus: alternative.status,

      members,

      resolvedMemberIds: [
        ...alternative.resolvedMemberIds,
      ].sort(),

      resolvedPosLabels,

      governance: {
        exactCanonicalTokenRequired: true,

        exactPosOwnershipAuthorityRequired: true,

        exactTokenPosCapabilityRequired: true,

        readsExistingCanonicalStateOnly: true,

        alternativeSetStatusIsAuthoritative: true,

        resolvedMembersMustBeExplicit: true,

        singletonAutoResolved: false,

        survivingCandidateAutoResolved: false,

        positiveConstraintEvidenceReevaluated: false,

        constraintPropagationInvoked: false,

        graphFactAmbiguousStatusPromotedToSetAmbiguity: false,

        memberGraphStatusesPreserved: true,

        propertyValueIsScalar: false,

        propertyValueIsHypothesisSet: true,

        runtimePosSuffixConsumed: false,

        runtimeBindingConsumed: false,

        rightOperandRead: false,

        operatorSemanticsResolved: false,

        whereEqExecuted: false,

        occurrenceEnumerationPerformed: false,

        runtimeScopeExecutionPerformed: false,

        cardinalityEnforcementPerformed: false,

        occurrenceBindingPerformed: false,

        canonicalDependencyEdgeGenerated: false,

        realizesSlotGenerated: false,

        graphMutationPerformed: false,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
