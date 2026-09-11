//
// Norsk Trainer — CURRENT snapshot-bound cardinality semantics V1
//
// v1.46
//
// Purpose:
//
//   CLOSED CURRENT snapshot-bound occurrence filtering
//       +
//   exact A3.3.4a expected token.pos site authority
//       +
//   independently rederived runtime binding-definition authority
//       ->
//   exact CURRENT binding cardinality semantics
//
// This layer resolves ONLY the meaning of the Runtime IR cardinality label.
//
// It DOES NOT:
// - enforce cardinality against survivor counts;
// - infer authority from singleton survivor count;
// - select domain or occurrence winners;
// - bind final Runtime occurrences;
// - execute WHERE;
// - classify learner error;
// - mutate the Canonical Graph.
//
// Candidate != current.
// Current != applicable.
// Applicable != selected.
// Selected != final binding truth.
// Binding truth != cardinality.
// Singleton != authority.
//

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-occurrence-filtering-v1.ts";

import {
  deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-binding-definition-authority-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-cardinality-semantics-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityLabelV1 =
  | "one"
  | "one_or_more"
  | "zero_or_more";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundMaximumCardinalityV1 =
  | number
  | "unbounded";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundResolvedCardinalitySemanticsV1 =
  {
    cardinalityLabel:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityLabelV1;

    minimum:
      number;

    maximum:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundMaximumCardinalityV1;
  };

const CARDINALITY_SEMANTICS = {
  "one": {
    minimum: 1,
    maximum: 1,
  },

  "one_or_more": {
    minimum: 1,
    maximum: "unbounded",
  },

  "zero_or_more": {
    minimum: 0,
    maximum: "unbounded",
  },
} as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticDomainV1 =
  {
    cardinalitySemanticDomainId:
      string;

    status:
      "proven_snapshot_bound_cardinality_semantics";

    sourceFilteringDomainId:
      string;

    expectedSiteAuthorityId:
      string;

    bindingDefinitionAuthorityId:
      string;

    manifestId:
      string;

    manifestCode:
      string;

    referencedBindingName:
      string;

    snapshotIdentityId:
      string;

    snapshotSentenceOccurrenceIdentityId:
      string;

    graphDocumentId:
      string;

    sentenceNodeId:
      string;

    sentenceIndex:
      number;

    sourceOccurrenceCount:
      number;

    survivingOccurrenceCount:
      number;

    filteredOutOccurrenceCount:
      number;

    cardinalityLabel:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalityLabelV1;

    minimum:
      number;

    maximum:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundMaximumCardinalityV1;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsAuthorityV1 =
  {
    authorityId:
      string;

    status:
      "proven_current_snapshot_bound_cardinality_semantics";

    sourceFilteringAuthorityId:
      string;

    sourceDispositionAuthorityId:
      string;

    sourceComparisonAuthorityId:
      string;

    snapshotIdentityId:
      string;

    graphDocumentId:
      string;

    sentenceNodeId:
      string;

    sentenceIndex:
      number;

    domainCardinalitySemantics:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticDomainV1[];

    domainCardinalitySemanticsCount:
      number;

    governance: {
      closedCurrentSnapshotBoundOccurrenceFilteringPublicDerivationReexecuted:
        true;

      runtimeBindingDefinitionAuthorityPublicDerivationReexecuted:
        true;

      suppliedOccurrenceFilteringAcceptedAsProof:
        false;

      suppliedBindingDefinitionAuthorityAcceptedAsProof:
        false;

      expectedSiteAuthorityExactJoinRequired:
        true;

      referencedBindingDefinitionAuthorityExactJoinRequired:
        true;

      cardinalityLabelConsumedFromExactBindingDefinitionAuthority:
        true;

      cardinalityLabelNormalizedOrRewritten:
        false;

      unsupportedCardinalityLabelRejected:
        true;

      cardinalitySemanticsResolved:
        true;

      survivorCountUsedAsCardinalitySemanticAuthority:
        false;

      singletonSurvivorTreatedAsWinner:
        false;

      cardinalityEnforcementPerformed:
        false;

      domainCandidateWinnerSelected:
        false;

      occurrenceWinnerSelected:
        false;

      occurrenceBindingPerformed:
        false;

      finalRuntimeOccurrenceBindingPerformed:
        false;

      whereEvaluationPerformed:
        false;

      learnerErrorClassified:
        false;

      constraintPropagationInvoked:
        false;

      canonicalDependencyEdgeGenerated:
        false;

      clauseNodeGenerated:
        false;

      graphMutationPerformed:
        false;

      frozenGrammarReadOnly:
        true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_VERSION_V1;

    status:
      "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsAuthorityV1;

    blockingReasons:
      readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_VERSION_V1;

    status:
      "blocked";

    authority:
      null;

    blockingReasons:
      readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsBlockedResultV1;

function idPart(
  value:
    string,
): string {
  return encodeURIComponent(
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
  ];
}

function blocked(
  reasons:
    readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_VERSION_V1,

    status:
      "blocked",

    authority:
      null,

    blockingReasons:
      unique(
        reasons,
      ),
  };
}

function exactCardinalitySemantics(
  cardinalityLabel:
    string | null,
):
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundResolvedCardinalitySemanticsV1
  | null {
  if (
    cardinalityLabel ===
    "one"
  ) {
    return {
      cardinalityLabel:
        "one",

      minimum:
        CARDINALITY_SEMANTICS.one.minimum,

      maximum:
        CARDINALITY_SEMANTICS.one.maximum,
    };
  }

  if (
    cardinalityLabel ===
    "one_or_more"
  ) {
    return {
      cardinalityLabel:
        "one_or_more",

      minimum:
        CARDINALITY_SEMANTICS.one_or_more.minimum,

      maximum:
        CARDINALITY_SEMANTICS.one_or_more.maximum,
    };
  }

  if (
    cardinalityLabel ===
    "zero_or_more"
  ) {
    return {
      cardinalityLabel:
        "zero_or_more",

      minimum:
        CARDINALITY_SEMANTICS.zero_or_more.minimum,

      maximum:
        CARDINALITY_SEMANTICS.zero_or_more.maximum,
    };
  }

  return null;
}

function exactBindingGovernance(
  value:
    unknown,
): boolean {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return false;
  }

  const g =
    value as Record<
      string,
      unknown
    >;

  return (
    g.exactValidatedManifestRequired ===
      true &&
    g.exactA0DependencyAuthorityRequired ===
      true &&
    g.bindingNamePreservedOpaque ===
      true &&
    g.bindingDefinitionPreservedOpaque ===
      true &&
    g.cardinalityLabelPreservedOpaque ===
      true &&
    g.cardinalitySemanticsResolved ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.productionActivationAssumed ===
      false &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsV1(
  surface:
    Parameters<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1
    >[0],

  graph:
    Parameters<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1
    >[1],

  expectedResult:
    Parameters<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1
    >[2],

  currentDomainResult:
    Parameters<
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1
    >[3],

  dependencyAuthorities:
    Parameters<
      typeof deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1
    >[0],

  manifestRows:
    Parameters<
      typeof deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1
    >[1],
): Promise<CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticsResultV1> {
  const filteringResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
    );

  if (
    filteringResult.status !==
    "ready"
  ) {
    return blocked(
      [
        "current_snapshot_bound_occurrence_filtering:not_ready",
        ...filteringResult.blockingReasons.map(
          (reason) =>
            `current_snapshot_bound_occurrence_filtering:${reason}`,
        ),
      ],
    );
  }

  const bindingResult =
    deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
      dependencyAuthorities,
      manifestRows,
    );

  if (
    bindingResult.status !==
    "ready"
  ) {
    return blocked(
      [
        "runtime_binding_definition_authority:not_ready",
        ...bindingResult.blockingReasons.map(
          (reason) =>
            `runtime_binding_definition_authority:${reason}`,
        ),
      ],
    );
  }

  if (
    expectedResult.status !==
    "ready"
  ) {
    return blocked(
      [
        "expected_token_pos_authority:not_ready",
      ],
    );
  }

  const blockingReasons:
    string[] = [];

  const domainCardinalitySemantics:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundCardinalitySemanticDomainV1[] =
      [];

  for (
    const domain of
    filteringResult.authority.domainFiltering
  ) {
    const expectedSiteMatches =
      expectedResult.authorities.filter(
        (site) =>
          site.id ===
          domain.expectedSiteAuthorityId,
      );

    if (
      expectedSiteMatches.length !==
      1
    ) {
      blockingReasons.push(
        `expected_site_authority:${domain.expectedSiteAuthorityId}:not_exact_unique_match`,
      );

      continue;
    }

    const expectedSite =
      expectedSiteMatches[0]!;

    const bindingDefinitionAuthorityId =
      expectedSite.referencedBindingDefinitionAuthorityId;

    const bindingMatches =
      bindingResult.authorities.filter(
        (binding) =>
          binding.id ===
          bindingDefinitionAuthorityId,
      );

    if (
      bindingMatches.length !==
      1
    ) {
      blockingReasons.push(
        `binding_definition_authority:${bindingDefinitionAuthorityId}:not_exact_unique_match`,
      );

      continue;
    }

    const binding =
      bindingMatches[0]!;

    if (
      !exactBindingGovernance(
        binding.governance,
      )
    ) {
      blockingReasons.push(
        `binding_definition_authority:${binding.id}:governance_not_exact`,
      );

      continue;
    }

    if (
      binding.manifestId !==
        expectedSite.manifestId ||
      binding.manifestCode !==
        expectedSite.manifestCode ||
      binding.bindingName !==
        expectedSite.referencedBindingName
    ) {
      blockingReasons.push(
        `binding_definition_authority:${binding.id}:expected_site_lineage_mismatch`,
      );

      continue;
    }

    const semantics =
      exactCardinalitySemantics(
        binding.cardinalityLabel,
      );

    if (
      !semantics
    ) {
      blockingReasons.push(
        `binding_definition_authority:${binding.id}:unsupported_cardinality_label`,
      );

      continue;
    }

    domainCardinalitySemantics.push({
      cardinalitySemanticDomainId:
        [
          "current-snapshot-bound-cardinality-semantics-v1",
          idPart(
            domain.filteringDomainId,
          ),
          idPart(
            binding.id,
          ),
          idPart(
            semantics.cardinalityLabel,
          ),
        ].join(
          ":",
        ),

      status:
        "proven_snapshot_bound_cardinality_semantics",

      sourceFilteringDomainId:
        domain.filteringDomainId,

      expectedSiteAuthorityId:
        domain.expectedSiteAuthorityId,

      bindingDefinitionAuthorityId:
        binding.id,

      manifestId:
        binding.manifestId,

      manifestCode:
        binding.manifestCode,

      referencedBindingName:
        binding.bindingName,

      snapshotIdentityId:
        domain.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        domain.snapshotSentenceOccurrenceIdentityId,

      graphDocumentId:
        domain.graphDocumentId,

      sentenceNodeId:
        domain.sentenceNodeId,

      sentenceIndex:
        domain.sentenceIndex,

      sourceOccurrenceCount:
        domain.sourceOccurrenceCount,

      survivingOccurrenceCount:
        domain.survivingOccurrenceCount,

      filteredOutOccurrenceCount:
        domain.filteredOutOccurrenceCount,

      cardinalityLabel:
        semantics.cardinalityLabel,

      minimum:
        semantics.minimum,

      maximum:
        semantics.maximum,
    });
  }

  if (
    blockingReasons.length >
    0
  ) {
    return blocked(
      blockingReasons,
    );
  }

  if (
    domainCardinalitySemantics.length !==
    filteringResult.authority.domainFiltering.length
  ) {
    return blocked(
      [
        "domain_cardinality_semantics:not_total_over_filtering_domains",
      ],
    );
  }

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_CARDINALITY_SEMANTICS_VERSION_V1,

    status:
      "ready",

    authority: {
      authorityId:
        [
          "current-snapshot-bound-cardinality-semantics-authority-v1",
          idPart(
            filteringResult.authority.authorityId,
          ),
        ].join(
          ":",
        ),

      status:
        "proven_current_snapshot_bound_cardinality_semantics",

      sourceFilteringAuthorityId:
        filteringResult.authority.authorityId,

      sourceDispositionAuthorityId:
        filteringResult.authority.sourceDispositionAuthorityId,

      sourceComparisonAuthorityId:
        filteringResult.authority.sourceComparisonAuthorityId,

      snapshotIdentityId:
        filteringResult.authority.snapshotIdentityId,

      graphDocumentId:
        filteringResult.authority.graphDocumentId,

      sentenceNodeId:
        filteringResult.authority.sentenceNodeId,

      sentenceIndex:
        filteringResult.authority.sentenceIndex,

      domainCardinalitySemantics,

      domainCardinalitySemanticsCount:
        domainCardinalitySemantics.length,

      governance: {
        closedCurrentSnapshotBoundOccurrenceFilteringPublicDerivationReexecuted:
          true,

        runtimeBindingDefinitionAuthorityPublicDerivationReexecuted:
          true,

        suppliedOccurrenceFilteringAcceptedAsProof:
          false,

        suppliedBindingDefinitionAuthorityAcceptedAsProof:
          false,

        expectedSiteAuthorityExactJoinRequired:
          true,

        referencedBindingDefinitionAuthorityExactJoinRequired:
          true,

        cardinalityLabelConsumedFromExactBindingDefinitionAuthority:
          true,

        cardinalityLabelNormalizedOrRewritten:
          false,

        unsupportedCardinalityLabelRejected:
          true,

        cardinalitySemanticsResolved:
          true,

        survivorCountUsedAsCardinalitySemanticAuthority:
          false,

        singletonSurvivorTreatedAsWinner:
          false,

        cardinalityEnforcementPerformed:
          false,

        domainCandidateWinnerSelected:
          false,

        occurrenceWinnerSelected:
          false,

        occurrenceBindingPerformed:
          false,

        finalRuntimeOccurrenceBindingPerformed:
          false,

        whereEvaluationPerformed:
          false,

        learnerErrorClassified:
          false,

        constraintPropagationInvoked:
          false,

        canonicalDependencyEdgeGenerated:
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