import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorDomainV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-survivor-set-v1.ts";

import {
  type CanonicalRuntimeBindingDefinitionAuthorityV1,
  deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-binding-definition-authority-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-semantics-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_VERSION_V1 =
  "1.0.0" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_SPEC_V1 =
  "late-v1.40:post-where-owner-cardinality-semantics-v1" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityLabelV1 =
  | "one"
  | "one_or_more"
  | "zero_or_more";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerMaximumCardinalityV1 =
  | number
  | "unbounded";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1 =
  {
    cardinalitySemanticDomainId: string;
    status: "proven_post_where_owner_cardinality_semantics";

    structuralAuthorityId: string;
    ownerBindingDefinitionAuthorityId: string;

    manifestId: string;
    manifestCode: string;
    ownerBindingName: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;
    graphDocumentId: string;
    sentenceNodeId: string;

    sourceOccurrenceCount: number;
    survivingOccurrenceCount: number;
    rejectedOccurrenceCount: number;
    uncertainSurvivorCount: number;

    cardinalityLabel:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityLabelV1;
    minimum: number;
    maximum:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerMaximumCardinalityV1;

    sourceSurvivorDomain:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorDomainV1;

    sourceBindingDefinitionAuthority:
      CanonicalRuntimeBindingDefinitionAuthorityV1;

    governance: {
      exactOwnerBindingDefinitionAuthorityJoinRequired: true;
      exactOwnerManifestLineageRequired: true;
      cardinalityLabelConsumedFromExactOwnerBindingDefinitionAuthority: true;
      cardinalityLabelNormalizedOrRewritten: false;
      unsupportedCardinalityLabelRejected: true;
      cardinalitySemanticsResolved: true;
      survivorCountUsedAsCardinalitySemanticAuthority: false;
      singletonSurvivorTreatedAsWinner: false;
      cardinalityEnforcementPerformed: false;
      domainCandidateWinnerSelected: false;
      occurrenceWinnerSelected: false;
      occurrenceBindingPerformed: false;
      finalRuntimeOccurrenceBindingPerformed: false;
      whereEvaluationPerformed: false;
      whereTruthRecomputed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_VERSION_V1;
    spec:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_SPEC_V1;
    status: "ready";
    sourceSurvivorResult:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1;
    domainCardinalitySemantics:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1[];
    domainCardinalitySemanticsCount: number;
    blockingReasons: readonly [];
    governance: {
      postWhereOwnerSurvivorResultConsumedWithoutReexecution: true;
      runtimeBindingDefinitionAuthorityPublicDerivationReexecuted: true;
      suppliedBindingDefinitionAuthorityAcceptedAsProof: false;
      ownerBindingDefinitionAuthorityExactJoinRequired: true;
      referencedBindingDefinitionAuthorityUsedAsOwnerAuthority: false;
      cardinalitySemanticsResolved: true;
      cardinalityEnforcementPerformed: false;
      occurrenceWinnerSelected: false;
      finalRuntimeOccurrenceBindingPerformed: false;
      learnerErrorClassified: false;
      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_VERSION_V1;
    spec:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_SPEC_V1;
    status: "blocked";
    sourceSurvivorResult:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1;
    domainCardinalitySemantics: readonly [];
    domainCardinalitySemanticsCount: 0;
    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsBlockedResultV1;

function idPart(value: string): string {
  return encodeURIComponent(value).replaceAll("%", "_");
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function blocked(
  sourceSurvivorResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1,
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_V1,
    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_VERSION_V1,
    spec:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_SPEC_V1,
    status: "blocked",
    sourceSurvivorResult,
    domainCardinalitySemantics: [],
    domainCardinalitySemanticsCount: 0,
    blockingReasons: unique(reasons),
  };
}

function exactCardinalitySemantics(
  cardinalityLabel: string | null,
): {
  cardinalityLabel:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalityLabelV1;
  minimum: number;
  maximum:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerMaximumCardinalityV1;
} | null {
  switch (cardinalityLabel) {
    case "one":
      return {
        cardinalityLabel: "one",
        minimum: 1,
        maximum: 1,
      };

    case "one_or_more":
      return {
        cardinalityLabel: "one_or_more",
        minimum: 1,
        maximum: "unbounded",
      };

    case "zero_or_more":
      return {
        cardinalityLabel: "zero_or_more",
        minimum: 0,
        maximum: "unbounded",
      };

    default:
      return null;
  }
}

type CanonicalOpaqueJsonRecord = {
  [key: string]: unknown;
};

function canonicalOpaqueJsonValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      canonicalOpaqueJsonValue,
    );
  }

  if (
    value !== null &&
    typeof value === "object"
  ) {
    const record =
      value as CanonicalOpaqueJsonRecord;

    const out: CanonicalOpaqueJsonRecord = {};

    for (
      const key of Object.keys(
        record,
      ).sort()
    ) {
      out[key] =
        canonicalOpaqueJsonValue(
          record[key],
        );
    }

    return out;
  }

  return value;
}

function sameCanonicalOpaqueJson(
  left: unknown,
  right: unknown,
): boolean {
  return JSON.stringify(
    canonicalOpaqueJsonValue(
      left,
    ),
  ) === JSON.stringify(
    canonicalOpaqueJsonValue(
      right,
    ),
  );
}

function exactBindingGovernance(
  binding: CanonicalRuntimeBindingDefinitionAuthorityV1,
): boolean {
  const g = binding.governance;

  return (
    binding.status === "candidate" &&
    g.exactValidatedManifestRequired === true &&
    g.exactA0DependencyAuthorityRequired === true &&
    g.bindingNamePreservedOpaque === true &&
    g.bindingDefinitionPreservedOpaque === true &&
    g.cardinalityLabelPreservedOpaque === true &&
    g.cardinalitySemanticsResolved === false &&
    g.occurrenceBindingPerformed === false &&
    g.productionActivationAssumed === false &&
    g.candidateOnly === true &&
    g.frozenGrammarReadOnly === true
  );
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsV1(
  sourceSurvivorResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetResultV1,
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1
  >[0],
  manifestRows: Parameters<
    typeof deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1
  >[1],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticsResultV1 {
  if (sourceSurvivorResult.status !== "ready") {
    return blocked(
      sourceSurvivorResult,
      [
        "post_where_owner_survivor_set:not_ready",
        ...sourceSurvivorResult.blockingReasons.map(
          (reason) => `post_where_owner_survivor_set:${reason}`,
        ),
      ],
    );
  }

  const bindingResult = deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
    dependencyAuthorities,
    manifestRows,
  );

  if (bindingResult.status !== "ready") {
    return blocked(
      sourceSurvivorResult,
      [
        "runtime_binding_definition_authority:not_ready",
        ...bindingResult.blockingReasons.map(
          (reason) => `runtime_binding_definition_authority:${reason}`,
        ),
      ],
    );
  }

  const blockingReasons: string[] = [];
  const domains:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerCardinalitySemanticDomainV1[] =
      [];

  for (const survivorDomain of sourceSurvivorResult.survivorDomains) {
    const ownerBindingDefinitionAuthorityId =
      survivorDomain.ownerBindingDefinitionAuthorityId;

    const ownerOccurrenceDomain = survivorDomain.sourceFinalWhereDecision
      .sourceOwnerBindingOccurrenceDomain;

    const ownerManifestBindingAuthority =
      ownerOccurrenceDomain.sourceStructuralAuthority
        .sourceWhereShapeAuthority
        .sourceBindingDefinitionAuthority;

    if (
      ownerBindingDefinitionAuthorityId !==
        ownerOccurrenceDomain.sourceStructuralAuthority
          .bindingDefinitionAuthorityId ||
      ownerBindingDefinitionAuthorityId !==
        ownerManifestBindingAuthority.id
    ) {
      blockingReasons.push(
        `owner_binding_definition_authority:${ownerBindingDefinitionAuthorityId}:not_exact_unique_match`,
      );
      continue;
    }

    const bindingMatches = bindingResult.authorities.filter(
      (binding) =>
        binding.manifestId === ownerOccurrenceDomain.manifestId &&
        binding.manifestCode === ownerOccurrenceDomain.manifestCode &&
        binding.bindingName === ownerOccurrenceDomain.ownerBindingName &&
        sameCanonicalOpaqueJson(
          binding.bindingDefinition,
          ownerManifestBindingAuthority.bindingDefinition,
        ),
    );

    if (bindingMatches.length !== 1) {
      blockingReasons.push(
        `owner_binding_definition_authority:${ownerBindingDefinitionAuthorityId}:not_exact_unique_match`,
      );
      continue;
    }

    const binding = bindingMatches[0]!;

    if (!exactBindingGovernance(binding)) {
      blockingReasons.push(
        `owner_binding_definition_authority:${binding.id}:unsafe_governance`,
      );
      continue;
    }

    if (
      binding.manifestId !== ownerOccurrenceDomain.manifestId ||
      binding.manifestCode !== ownerOccurrenceDomain.manifestCode ||
      binding.bindingName !== ownerOccurrenceDomain.ownerBindingName
    ) {
      blockingReasons.push(
        `owner_binding_definition_authority:${binding.id}:owner_lineage_mismatch`,
      );
      continue;
    }

    const semantics = exactCardinalitySemantics(binding.cardinalityLabel);

    if (!semantics) {
      blockingReasons.push(
        `owner_binding_definition_authority:${binding.id}:unsupported_cardinality_label`,
      );
      continue;
    }

    domains.push({
      cardinalitySemanticDomainId: [
        "post-where-owner-cardinality-semantics-v1",
        idPart(survivorDomain.structuralAuthorityId),
        idPart(ownerBindingDefinitionAuthorityId),
        idPart(survivorDomain.snapshotIdentityId),
        idPart(survivorDomain.snapshotSentenceOccurrenceIdentityId),
        idPart(semantics.cardinalityLabel),
      ].join(":"),

      status: "proven_post_where_owner_cardinality_semantics",

      structuralAuthorityId: survivorDomain.structuralAuthorityId,

      ownerBindingDefinitionAuthorityId,

      manifestId: binding.manifestId,

      manifestCode: binding.manifestCode,

      ownerBindingName: binding.bindingName,

      snapshotIdentityId: survivorDomain.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        survivorDomain.snapshotSentenceOccurrenceIdentityId,

      graphDocumentId: survivorDomain.graphDocumentId,

      sentenceNodeId: survivorDomain.sentenceNodeId,

      sourceOccurrenceCount: survivorDomain.sourceOccurrenceCount,

      survivingOccurrenceCount: survivorDomain.survivingOccurrenceCount,

      rejectedOccurrenceCount: survivorDomain.rejectedOccurrenceCount,

      uncertainSurvivorCount: survivorDomain.uncertainSurvivorCount,

      cardinalityLabel: semantics.cardinalityLabel,

      minimum: semantics.minimum,

      maximum: semantics.maximum,

      sourceSurvivorDomain: survivorDomain,

      sourceBindingDefinitionAuthority: binding,

      governance: {
        exactOwnerBindingDefinitionAuthorityJoinRequired: true,
        exactOwnerManifestLineageRequired: true,
        cardinalityLabelConsumedFromExactOwnerBindingDefinitionAuthority: true,
        cardinalityLabelNormalizedOrRewritten: false,
        unsupportedCardinalityLabelRejected: true,
        cardinalitySemanticsResolved: true,
        survivorCountUsedAsCardinalitySemanticAuthority: false,
        singletonSurvivorTreatedAsWinner: false,
        cardinalityEnforcementPerformed: false,
        domainCandidateWinnerSelected: false,
        occurrenceWinnerSelected: false,
        occurrenceBindingPerformed: false,
        finalRuntimeOccurrenceBindingPerformed: false,
        whereEvaluationPerformed: false,
        whereTruthRecomputed: false,
        learnerErrorClassified: false,
        graphMutationPerformed: false,
        frozenGrammarReadOnly: true,
      },
    });
  }

  if (blockingReasons.length > 0) {
    return blocked(
      sourceSurvivorResult,
      blockingReasons,
    );
  }

  if (domains.length !== sourceSurvivorResult.survivorDomains.length) {
    return blocked(
      sourceSurvivorResult,
      [
        "post_where_owner_cardinality_semantics:not_total_over_survivor_domains",
      ],
    );
  }

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_V1,
    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_VERSION_V1,
    spec:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_POST_OWNER_CARDINALITY_SEMANTICS_SPEC_V1,
    status: "ready",
    sourceSurvivorResult,
    domainCardinalitySemantics: domains,
    domainCardinalitySemanticsCount: domains.length,
    blockingReasons: [],
    governance: {
      postWhereOwnerSurvivorResultConsumedWithoutReexecution: true,
      runtimeBindingDefinitionAuthorityPublicDerivationReexecuted: true,
      suppliedBindingDefinitionAuthorityAcceptedAsProof: false,
      ownerBindingDefinitionAuthorityExactJoinRequired: true,
      referencedBindingDefinitionAuthorityUsedAsOwnerAuthority: false,
      cardinalitySemanticsResolved: true,
      cardinalityEnforcementPerformed: false,
      occurrenceWinnerSelected: false,
      finalRuntimeOccurrenceBindingPerformed: false,
      learnerErrorClassified: false,
      graphMutationPerformed: false,
      frozenGrammarReadOnly: true,
    },
  };
}
