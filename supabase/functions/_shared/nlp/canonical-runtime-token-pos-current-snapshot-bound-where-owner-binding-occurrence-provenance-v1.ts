import type {
  CanonicalRuntimeManifestBindingScopeCompatibilityResultV1,
  CanonicalRuntimeManifestBindingScopeCompatibilityV1,
} from "./canonical-runtime-manifest-binding-scope-compatibility-v1.ts";

import {
  deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1,
} from "./canonical-sentence-direct-token-occurrence-domain-capability-v1.ts";

import {
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthReadyResultV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthResultV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-context-coherent-recursive-compound-truth-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-owner-binding-occurrence-provenance-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_VERSION_V1 =
  "1.0.0" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_SPECIFICATION_ID_V1 =
  "late-v1.40:owner-binding-occurrence-provenance-v1" as const;

type DirectDomainResult = ReturnType<
  typeof deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1
>;

type DirectDomain = DirectDomainResult["domains"][number];

type DirectOccurrence = DirectDomain["occurrences"][number];

type SnapshotResult = Awaited<
  ReturnType<typeof deriveCanonicalGraphSnapshotIdentityAuthorityV1>
>;

type SnapshotAuthority = NonNullable<SnapshotResult["authority"]>;

type ReadyWhereResult =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthReadyResultV1;

type RootCandidate =
  ReadyWhereResult["compositionResult"]["authorityResults"][number][
    "rootCandidates"
  ][number];

type StructuralAuthority =
  ReadyWhereResult["sourceShapeResult"]["authorities"][number];

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceV1 =
  & DirectOccurrence
  & {
    snapshotTokenOccurrenceIdentityId: string;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceDomainV1 =
  {
    id: string;

    status: "candidate";

    structuralAuthorityId: string;

    ownerBindingDefinitionAuthorityId: string;

    manifestId: string;

    manifestCode: string;

    ownerBindingName: string;

    runtimeScopeLabel: string;

    canonicalBoundaryLabel: string;

    canonicalBoundaryAuthorityId: string;

    snapshotAuthorityId: string;

    snapshotIdentityId: string;

    snapshotSentenceOccurrenceIdentityId: string;

    graphDocumentId: string;

    sentenceNodeId: string;

    sentenceIndex: number;

    canonicalTokenDomainId: string;

    occurrenceCount: number;

    occurrences:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceV1[];

    sourceRootCandidate: RootCandidate;

    sourceStructuralAuthority: StructuralAuthority;

    sourceScopeCompatibility:
      CanonicalRuntimeManifestBindingScopeCompatibilityV1;

    sourceDirectDomain: DirectDomain;

    sourceSnapshotAuthority: SnapshotAuthority;

    governance: {
      exactA46a1fRootCandidateRequired: true;

      whereTruthRecomputed: false;

      ownerBindingDerivedFromStructuralAuthority: true;

      referencedLeafOccurrenceUsedAsOwnerOccurrence: false;

      exactOwnerBindingScopeCompatibilityRequired: true;

      neutralDirectOccurrenceDomainConsumed: true;

      duplicateOccurrenceEnumerationImplemented: false;

      exactSnapshotIdentityRequired: true;

      exactSnapshotSentenceOccurrenceIdentityRequired: true;

      snapshotIdentityAndSentenceNodeIdFormDomainOccurrenceIdentity: true;

      snapshotIdentityAndTokenNodeIdFormTokenOccurrenceIdentity: true;

      sentenceIndexIsOccurrenceIdentity: false;

      occurrenceMultiplicityPreserved: true;

      occurrenceOrderPreserved: true;

      zeroOccurrencesPreserved: true;

      occurrenceFilteringPerformed: false;

      occurrenceWinnerSelected: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      finalRuntimeBindingPerformed: false;

      bindingTruthResolved: false;

      learnerErrorClassified: false;

      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_SPECIFICATION_ID_V1;

    status: "ready";

    sourceWhereResult: ReadyWhereResult;

    sourceScopeResult:
      CanonicalRuntimeManifestBindingScopeCompatibilityResultV1;

    sourceDirectDomainResult: DirectDomainResult;

    sourceSnapshotResult: SnapshotResult;

    ownerBindingOccurrenceDomains:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceDomainV1[];

    domainCount: number;

    blockingReasons: readonly [];

    governance: {
      whereResultConsumedWithoutReexecution: true;

      ownerAndReferencedBindingRolesKeptDistinct: true;

      neutralOccurrenceEnumerationReused: true;

      duplicateOccurrenceEnumerationImplemented: false;

      currentSentenceContextPreserved: true;

      occurrenceFilteringPerformed: false;

      occurrenceWinnerSelected: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      finalRuntimeBindingPerformed: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_SPECIFICATION_ID_V1;

    status: "blocked";

    sourceWhereResult:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthResultV1;

    sourceScopeResult:
      CanonicalRuntimeManifestBindingScopeCompatibilityResultV1;

    sourceDirectDomainResult: DirectDomainResult;

    sourceSnapshotResult: SnapshotResult;

    ownerBindingOccurrenceDomains: readonly [];

    domainCount: 0;

    blockingReasons: readonly string[];

    governance: {
      whereResultConsumedWithoutReexecution: true;

      ownerAndReferencedBindingRolesKeptDistinct: true;

      neutralOccurrenceEnumerationReused: true;

      duplicateOccurrenceEnumerationImplemented: false;

      currentSentenceContextPreserved: true;

      occurrenceFilteringPerformed: false;

      occurrenceWinnerSelected: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      finalRuntimeBindingPerformed: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceBlockedResultV1;

const RESULT_GOVERNANCE = {
  whereResultConsumedWithoutReexecution: true,
  ownerAndReferencedBindingRolesKeptDistinct: true,
  neutralOccurrenceEnumerationReused: true,
  duplicateOccurrenceEnumerationImplemented: false,
  currentSentenceContextPreserved: true,
  occurrenceFilteringPerformed: false,
  occurrenceWinnerSelected: false,
  cardinalitySemanticsResolved: false,
  cardinalityEnforcementPerformed: false,
  finalRuntimeBindingPerformed: false,
  graphMutationPerformed: false,
  learnerErrorClassified: false,
  frozenGrammarReadOnly: true,
} as const;

const DOMAIN_GOVERNANCE = {
  exactA46a1fRootCandidateRequired: true,
  whereTruthRecomputed: false,
  ownerBindingDerivedFromStructuralAuthority: true,
  referencedLeafOccurrenceUsedAsOwnerOccurrence: false,
  exactOwnerBindingScopeCompatibilityRequired: true,
  neutralDirectOccurrenceDomainConsumed: true,
  duplicateOccurrenceEnumerationImplemented: false,
  exactSnapshotIdentityRequired: true,
  exactSnapshotSentenceOccurrenceIdentityRequired: true,
  snapshotIdentityAndSentenceNodeIdFormDomainOccurrenceIdentity: true,
  snapshotIdentityAndTokenNodeIdFormTokenOccurrenceIdentity: true,
  sentenceIndexIsOccurrenceIdentity: false,
  occurrenceMultiplicityPreserved: true,
  occurrenceOrderPreserved: true,
  zeroOccurrencesPreserved: true,
  occurrenceFilteringPerformed: false,
  occurrenceWinnerSelected: false,
  cardinalitySemanticsResolved: false,
  cardinalityEnforcementPerformed: false,
  finalRuntimeBindingPerformed: false,
  bindingTruthResolved: false,
  learnerErrorClassified: false,
  graphMutationPerformed: false,
  frozenGrammarReadOnly: true,
} as const;

function uniqueSorted(
  values: readonly string[],
): readonly string[] {
  return [...new Set(values)].sort();
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(value).replaceAll(
    "%",
    "_",
  );
}

function snapshotSentenceOccurrenceIdentityId(
  snapshotIdentityId: string,
  sentenceNodeId: string,
): string {
  return [
    "canonical-snapshot-sentence-occurrence-v1",
    idPart(snapshotIdentityId),
    idPart(sentenceNodeId),
  ].join(":");
}

function snapshotTokenOccurrenceIdentityId(
  snapshotIdentityId: string,
  tokenNodeId: string,
): string {
  return [
    "canonical-snapshot-token-occurrence-v1",
    idPart(snapshotIdentityId),
    idPart(tokenNodeId),
  ].join(":");
}

function blocked(
  sourceWhereResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthResultV1,
  sourceScopeResult: CanonicalRuntimeManifestBindingScopeCompatibilityResultV1,
  sourceDirectDomainResult: DirectDomainResult,
  sourceSnapshotResult: SnapshotResult,
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_SPECIFICATION_ID_V1,

    status: "blocked",

    sourceWhereResult,
    sourceScopeResult,
    sourceDirectDomainResult,
    sourceSnapshotResult,

    ownerBindingOccurrenceDomains: [],

    domainCount: 0,

    blockingReasons: uniqueSorted(reasons),

    governance: RESULT_GOVERNANCE,
  };
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceV1(
  whereResult:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthResultV1,
  scopeResult: CanonicalRuntimeManifestBindingScopeCompatibilityResultV1,
  directDomainResult: DirectDomainResult,
  snapshotResult: SnapshotResult,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceResultV1 {
  if (
    whereResult.status !== "ready" ||
    whereResult.blockingReasons.length !== 0
  ) {
    return blocked(
      whereResult,
      scopeResult,
      directDomainResult,
      snapshotResult,
      [
        "a4_6a1f_current:not_exact_ready",
        ...whereResult.blockingReasons.map(
          (reason) => "a4_6a1f_current:" + reason,
        ),
      ],
    );
  }

  if (
    scopeResult.status !== "ready" ||
    scopeResult.blockingReasons.length !== 0
  ) {
    return blocked(
      whereResult,
      scopeResult,
      directDomainResult,
      snapshotResult,
      [
        "owner_scope:not_exact_ready",
        ...scopeResult.blockingReasons.map(
          (reason) => "owner_scope:" + reason,
        ),
      ],
    );
  }

  if (
    directDomainResult.status !== "ready" ||
    directDomainResult.blockingReasons.length !== 0
  ) {
    return blocked(
      whereResult,
      scopeResult,
      directDomainResult,
      snapshotResult,
      [
        "neutral_direct_domain:not_exact_ready",
        ...directDomainResult.blockingReasons.map(
          (reason) => "neutral_direct_domain:" + reason,
        ),
      ],
    );
  }

  if (
    snapshotResult.status !== "ready" ||
    snapshotResult.blockingReasons.length !== 0 ||
    snapshotResult.authority === undefined
  ) {
    return blocked(
      whereResult,
      scopeResult,
      directDomainResult,
      snapshotResult,
      [
        "snapshot_authority:not_exact_ready",
        ...snapshotResult.blockingReasons.map(
          (reason) => "snapshot_authority:" + reason,
        ),
      ],
    );
  }

  const snapshotAuthority = snapshotResult.authority;

  const reasons: string[] = [];

  const domains:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceDomainV1[] =
      [];

  for (
    const authorityResult of whereResult.compositionResult.authorityResults
  ) {
    for (
      const rootCandidate of authorityResult.rootCandidates
    ) {
      const structuralMatches = whereResult.sourceShapeResult.authorities
        .filter(
          (authority) => authority.id === rootCandidate.structuralAuthorityId,
        );

      if (structuralMatches.length !== 1) {
        reasons.push(
          "owner_structural_authority:cardinality:" +
            rootCandidate.structuralAuthorityId,
        );

        continue;
      }

      const structuralAuthority = structuralMatches[0];

      const ownerBindingDefinitionAuthorityId =
        structuralAuthority.bindingDefinitionAuthorityId;

      const directMatches = directDomainResult.domains.filter(
        (domain) =>
          domain.graphDocumentId === rootCandidate.graphDocumentId &&
          domain.sentenceNodeId === rootCandidate.sentenceNodeId,
      );

      if (directMatches.length !== 1) {
        reasons.push(
          "neutral_direct_domain:sentence_context_cardinality:" +
            rootCandidate.structuralAuthorityId +
            ":" +
            rootCandidate.sentenceNodeId,
        );

        continue;
      }

      const directDomain = directMatches[0];

      const scopeMatches = scopeResult.candidates.filter(
        (scope) =>
          scope.bindingDefinitionAuthorityId ===
            ownerBindingDefinitionAuthorityId &&
          scope.manifestId === structuralAuthority.manifestId &&
          scope.manifestCode === structuralAuthority.manifestCode &&
          scope.bindingName === structuralAuthority.bindingName &&
          scope.canonicalBoundaryLabel === directDomain.boundaryLabel,
      );

      if (scopeMatches.length !== 1) {
        reasons.push(
          "owner_scope:exact_compatibility_cardinality:" +
            ownerBindingDefinitionAuthorityId,
        );

        continue;
      }

      const scopeCompatibility = scopeMatches[0];

      if (
        rootCandidate.snapshotIdentityId !==
          snapshotAuthority.snapshotIdentityId
      ) {
        reasons.push(
          "snapshot_identity:mismatch:" +
            rootCandidate.structuralAuthorityId,
        );

        continue;
      }

      if (
        rootCandidate.graphDocumentId !==
          directDomainResult.graphDocumentId
      ) {
        reasons.push(
          "graph_document:mismatch:" +
            rootCandidate.structuralAuthorityId,
        );

        continue;
      }

      const expectedSentenceOccurrenceIdentityId =
        snapshotSentenceOccurrenceIdentityId(
          snapshotAuthority.snapshotIdentityId,
          directDomain.sentenceNodeId,
        );

      if (
        rootCandidate.snapshotSentenceOccurrenceIdentityId !==
          expectedSentenceOccurrenceIdentityId
      ) {
        reasons.push(
          "snapshot_sentence_occurrence_identity:mismatch:" +
            rootCandidate.structuralAuthorityId,
        );

        continue;
      }

      const occurrences = directDomain.occurrences.map(
        (occurrence) => ({
          ...occurrence,

          snapshotTokenOccurrenceIdentityId: snapshotTokenOccurrenceIdentityId(
            snapshotAuthority.snapshotIdentityId,
            occurrence.tokenNodeId,
          ),
        }),
      );

      domains.push({
        id: [
          CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_V1,
          idPart(rootCandidate.structuralAuthorityId),
          idPart(ownerBindingDefinitionAuthorityId),
          idPart(rootCandidate.snapshotIdentityId),
          idPart(rootCandidate.snapshotSentenceOccurrenceIdentityId),
        ].join(":"),

        status: "candidate",

        structuralAuthorityId: rootCandidate.structuralAuthorityId,

        ownerBindingDefinitionAuthorityId,

        manifestId: structuralAuthority.manifestId,

        manifestCode: structuralAuthority.manifestCode,

        ownerBindingName: structuralAuthority.bindingName,

        runtimeScopeLabel: scopeCompatibility.runtimeScopeLabel,

        canonicalBoundaryLabel: scopeCompatibility.canonicalBoundaryLabel,

        canonicalBoundaryAuthorityId:
          scopeCompatibility.canonicalBoundaryAuthorityId,

        snapshotAuthorityId: snapshotAuthority.authorityId,

        snapshotIdentityId: snapshotAuthority.snapshotIdentityId,

        snapshotSentenceOccurrenceIdentityId:
          rootCandidate.snapshotSentenceOccurrenceIdentityId,

        graphDocumentId: directDomain.graphDocumentId,

        sentenceNodeId: directDomain.sentenceNodeId,

        sentenceIndex: directDomain.sentenceIndex,

        canonicalTokenDomainId: directDomain.domainId,

        occurrenceCount: occurrences.length,

        occurrences,

        sourceRootCandidate: rootCandidate,

        sourceStructuralAuthority: structuralAuthority,

        sourceScopeCompatibility: scopeCompatibility,

        sourceDirectDomain: directDomain,

        sourceSnapshotAuthority: snapshotAuthority,

        governance: DOMAIN_GOVERNANCE,
      });
    }
  }

  if (reasons.length !== 0) {
    return blocked(
      whereResult,
      scopeResult,
      directDomainResult,
      snapshotResult,
      reasons,
    );
  }

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_OWNER_BINDING_OCCURRENCE_PROVENANCE_SPECIFICATION_ID_V1,

    status: "ready",

    sourceWhereResult: whereResult,

    sourceScopeResult: scopeResult,

    sourceDirectDomainResult: directDomainResult,

    sourceSnapshotResult: snapshotResult,

    ownerBindingOccurrenceDomains: domains,

    domainCount: domains.length,

    blockingReasons: [],

    governance: RESULT_GOVERNANCE,
  };
}
