// Norsk Trainer вЂ” Runtime Token POS CURRENT Snapshot-Bound
// Normalized Comparison V2
//
// v1.46
//
// Exact composition:
//
//   exact surface + exact canonical graph
//       +
//   A3.3.4a normalized expected token.pos equality authority
//       +
//   CLOSED CURRENT binding occurrence-domain authority
//       ->
//   snapshot-bound per-occurrence normalized POS comparison evidence.
//
// This layer independently proves that the supplied surface + graph are the
// exact snapshot selected by the CURRENT binding-domain authority.
//
// Actual POS evidence is then rederived from THIS graph.
//
// IMPORTANT:
//
// - historical A3.3.4c V1 is immutable and is NOT invoked with fabricated
//   historical domain authority;
// - normalized expected POS is consumed from exact A3.3.4a authority;
// - graphDocumentId is provenance only, never snapshot identity;
// - tokenNodeId is graph-local identity only;
// - snapshotTokenOccurrenceIdentityId is preserved from the snapshot-bound
//   CURRENT occurrence domain;
// - candidate/domain/occurrence multiplicity is preserved;
// - no filtering, cardinality, winner selection, final binding,
//   runtime condition truth, WHERE evaluation, learner-error classification,
//   dependency generation, clause generation, or graph mutation occurs.

import type {
  CanonicalLanguageGraphV1,
  GraphStatus,
} from "./canonical-language-graph-core-v1.ts";

import type {
  CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1,
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
  CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1,
  type CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1,
  type CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1,
} from "./canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityResultV1,
  type CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainEvidenceV1,
  deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1,
} from "./canonical-runtime-token-pos-current-binding-occurrence-domain-authority-v1.ts";

import {
  CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1,
  deriveCanonicalPosFactOwnershipAuthoritiesV1,
} from "./canonical-pos-fact-ownership-authority-v1.ts";

import {
  CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1,
  deriveCanonicalTokenPosPropertyCapabilityV1,
} from "./canonical-token-pos-property-capability-v1.ts";

import {
  CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V1,
  type CanonicalTokenPosGraphBoundNormalizedLabelProjectionV1,
  deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1,
} from "./canonical-token-pos-graph-bound-normalized-label-projection-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2 =
  "canonical_runtime_token_pos_current_snapshot_bound_normalized_comparison_v2" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2 =
  "2" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonStateV2 =
  | "no_fact"
  | "blocked"
  | "open_match_possible"
  | "open_no_surviving_match"
  | "explicit_resolved_match"
  | "explicit_resolved_non_match"
  | "explicit_resolved_mixed";

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedMemberComparisonV2 =
  {
    posReadingNodeId: string;

    rawPosLabel: string;

    normalizedPosLabel: string;

    graphStatus: GraphStatus;

    explicitlyResolved: boolean;

    survivingForOpenComparison: boolean;

    equalsExpectedNormalizedLabel: boolean;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceComparisonV2 =
  {
    comparisonId: string;

    status: "proven_snapshot_bound_comparison";

    snapshotIdentityId: string;

    snapshotSentenceOccurrenceIdentityId: string;

    snapshotTokenOccurrenceIdentityId: string;

    graphDocumentId: string;

    sentenceNodeId: string;

    sentenceIndex: number;

    tokenNodeId: string;

    tokenGraphStatus: GraphStatus;

    containmentEdgeId: string;

    sentenceTokenIndex: number;

    graphBoundProjectionId: string;

    sourceReadId: string;

    normalizedProjectionId: string;

    readState: CanonicalTokenPosGraphBoundNormalizedLabelProjectionV1[
      "projection"
    ][
      "readState"
    ];

    alternativeSetId: string | null;

    alternativeSetStatus:
      CanonicalTokenPosGraphBoundNormalizedLabelProjectionV1[
        "projection"
      ][
        "alternativeSetStatus"
      ];

    resolvedMemberIds: string[];

    rawResolvedPosLabels: string[];

    normalizedResolvedPosLabels: string[];

    expectedNormalizedPosLabel: string;

    memberComparisons:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedMemberComparisonV2[];

    matchingSurvivingMemberIds: string[];

    matchingResolvedMemberIds: string[];

    comparisonState:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonStateV2;

    booleanTruth: boolean | null;

    booleanTruthResolved: boolean;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundDomainComparisonV2 = {
  comparisonId: string;

  status: "candidate_comparison_domain";

  expectedSiteAuthorityId: string;

  semanticAuthorityId:
    typeof CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1;

  stringOperandCompatibilityId: string;

  whereReferenceRootAuthorityId: string;

  whereShapeAuthorityId: string;

  ownerBindingDefinitionAuthorityId: string;

  referencedBindingDefinitionAuthorityId: string;

  manifestId: string;

  manifestCode: string;

  ownerBindingName: string;

  referencedBindingName: string;

  referenceSiteKey: string;

  referencePath: string;

  domainEvidenceId: string;

  snapshotBoundDomainId: string;

  sourceDomainCandidateId: string;

  snapshotIdentityId: string;

  snapshotSentenceOccurrenceIdentityId: string;

  graphDocumentId: string;

  sentenceNodeId: string;

  sentenceIndex: number;

  expectedNormalizedPosLabel: string;

  occurrenceComparisons:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceComparisonV2[];

  occurrenceCount: number;
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonAuthorityV2 =
  {
    authorityId: string;

    status: "proven_current_snapshot_bound_pos_comparison";

    sourceCurrentBindingOccurrenceDomainAuthorityId: string;

    snapshotAuthorityId: string;

    snapshotIdentityId: string;

    snapshotSha256: string;

    surfaceSnapshotSha256: string;

    graphStateSha256: string;

    graphDocumentId: string;

    sentenceNodeId: string;

    sentenceIndex: number;

    domainComparisons:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundDomainComparisonV2[];

    domainComparisonCount: number;

    unmappedExpectedSiteAuthorityIds: readonly string[];

    governance: {
      exactSurfaceInputRequired: true;

      exactGraphInputRequired: true;

      exactSnapshotAuthorityIndependentlyRederived: true;

      exactSnapshotIdentityMustMatchCurrentDomain: true;

      graphDocumentIdUsedAsSnapshotIdentity: false;

      exactA334aExpectedAuthorityRequired: true;

      normalizedExpectedLabelConsumedNotReconstructed: true;

      closedCurrentBindingDomainPublicDerivationReexecuted: true;

      suppliedCurrentBindingDomainMustMatchRederivedAuthority: true;

      forgedCurrentBindingDomainWrapperAcceptedAsProof: false;

      posOwnershipRederivedFromExactSnapshotGraph: true;

      posCapabilityRederivedFromExactSnapshotGraphOwnership: true;

      graphBoundPosProjectionRederivedPerCurrentOccurrence: true;

      graphBoundPosProjectionDerivedFromExactSnapshotGraph: true;

      snapshotTokenOccurrenceIdentityPreserved: true;

      graphDocumentIdPreservedAsConsistencyMetadata: true;

      sentenceNodeIdPreservedAsConsistencyMetadata: true;

      sentenceIndexIsLocalityMetadataOnly: true;

      normalizedMemberEqualityPerformed: true;

      comparisonStateResolved: true;

      posComparisonExecuted: true;

      noFactCollapsedToFalse: false;

      blockedCollapsedToFalse: false;

      openNoSurvivingMatchCollapsedToFalse: false;

      openMatchPossibleCollapsedToTrue: false;

      mixedResolvedLabelsCollapsedToBoolean: false;

      runtimeConditionTruthResolved: false;

      occurrenceFilteringPerformed: false;

      cardinalitySemanticsResolved: false;

      cardinalityEnforcementPerformed: false;

      domainCandidateWinnerSelected: false;

      occurrenceWinnerSelected: false;

      occurrenceBindingPerformed: false;

      finalRuntimeOccurrenceBindingPerformed: false;

      whereEvaluationPerformed: false;

      learnerErrorClassified: false;

      constraintPropagationInvoked: false;

      canonicalDependencyEdgeGenerated: false;

      clauseNodeGenerated: false;

      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonReadyResultV2 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonAuthorityV2;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonBlockedResultV2 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2;

    status: "blocked";

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonResultV2 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonReadyResultV2
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonBlockedResultV2;

function present(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length >
      0
  );
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    "%",
    "_",
  );
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonBlockedResultV2 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2,

    status: "blocked",

    blockingReasons: uniqueSorted(
      reasons,
    ),
  };
}

function exactExpectedSite(
  expected: CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1,
): boolean {
  const g = expected.governance;

  return (
    expected.status ===
      "candidate" &&
    present(
      expected.id,
    ) &&
    expected.semanticAuthorityId ===
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1 &&
    present(
      expected.stringOperandCompatibilityId,
    ) &&
    present(
      expected.whereReferenceRootAuthorityId,
    ) &&
    present(
      expected.whereShapeAuthorityId,
    ) &&
    present(
      expected.ownerBindingDefinitionAuthorityId,
    ) &&
    present(
      expected.referencedBindingDefinitionAuthorityId,
    ) &&
    present(
      expected.manifestId,
    ) &&
    present(
      expected.manifestCode,
    ) &&
    present(
      expected.ownerBindingName,
    ) &&
    present(
      expected.referencedBindingName,
    ) &&
    present(
      expected.referenceSiteKey,
    ) &&
    present(
      expected.referencePath,
    ) &&
    expected.runtimeSuffix ===
      ".pos" &&
    expected.canonicalNodeType ===
      "token" &&
    expected.canonicalPropertyDomain ===
      "canonical_token_occurrence" &&
    expected.canonicalPropertyKind ===
      "pos_hypothesis_set" &&
    expected.normalizedOperatorLabel ===
      "eq" &&
    present(
      expected.normalizedPosLabelInput,
    ) &&
    expected.normalizationContract.trimWhitespace ===
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1
        .normalization
        .trimWhitespace &&
    expected.normalizationContract.unicodeNormalization ===
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1
        .normalization
        .unicodeNormalization &&
    expected.normalizationContract.localeCaseTransform ===
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1
        .normalization
        .localeCaseTransform &&
    expected.normalizationContract.locale ===
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CONTRACT_V1
        .normalization
        .locale &&
    g.operatorNormalizationExecuted ===
      true &&
    g.rightOperandNormalizationExecuted ===
      true &&
    g.operatorRecognizedAsNormalizedEq ===
      true &&
    g.tokenPosNormalizedLabelEqSemanticsResolved ===
      true &&
    g.rawLabelEqualityUsed ===
      false &&
    g.expectedPosLabelNormalized ===
      true &&
    g.actualPosLabelCompared ===
      false &&
    g.comparisonTruthResolved ===
      false &&
    g.runtimeConditionTruthResolved ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.cardinalityEnforcementPerformed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function sameCurrentDomain(
  supplied:
    CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityResultV1,
  rederived:
    CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityResultV1,
): boolean {
  if (
    supplied.status !==
      "ready" ||
    rederived.status !==
      "ready"
  ) {
    return false;
  }

  const left = supplied.authority;

  const right = rederived.authority;

  if (
    supplied.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1 ||
    supplied.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1 ||
    left.authorityId !==
      right.authorityId ||
    left.snapshotIdentityId !==
      right.snapshotIdentityId ||
    left.snapshotSentenceOccurrenceIdentityId !==
      right.snapshotSentenceOccurrenceIdentityId ||
    left.graphDocumentId !==
      right.graphDocumentId ||
    left.sentenceNodeId !==
      right.sentenceNodeId ||
    left.sentenceIndex !==
      right.sentenceIndex ||
    left.bindingOccurrenceDomainCandidateCount !==
      right.bindingOccurrenceDomainCandidateCount ||
    left.bindingOccurrenceDomains.length !==
      right.bindingOccurrenceDomains.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index <
      left.bindingOccurrenceDomains.length;
    index++
  ) {
    const l = left.bindingOccurrenceDomains[index];

    const r = right.bindingOccurrenceDomains[index];

    if (
      l.domainEvidenceId !==
        r.domainEvidenceId ||
      l.pairEvidenceId !==
        r.pairEvidenceId ||
      l.snapshotBoundDomainId !==
        r.snapshotBoundDomainId ||
      l.sourceDomainCandidateId !==
        r.sourceDomainCandidateId ||
      l.referencedBindingDefinitionAuthorityId !==
        r.referencedBindingDefinitionAuthorityId ||
      l.manifestId !==
        r.manifestId ||
      l.manifestCode !==
        r.manifestCode ||
      l.referencedBindingName !==
        r.referencedBindingName ||
      l.snapshotIdentityId !==
        r.snapshotIdentityId ||
      l.snapshotSentenceOccurrenceIdentityId !==
        r.snapshotSentenceOccurrenceIdentityId ||
      l.graphDocumentId !==
        r.graphDocumentId ||
      l.sentenceNodeId !==
        r.sentenceNodeId ||
      l.sentenceIndex !==
        r.sentenceIndex ||
      l.occurrenceCount !==
        r.occurrenceCount ||
      l.occurrences !==
        r.occurrences ||
      l.sourcePairEvidence !==
        r.sourcePairEvidence ||
      l.sourceSnapshotDomainCandidate !==
        r.sourceSnapshotDomainCandidate
    ) {
      return false;
    }
  }

  return true;
}

function compare(
  bound: CanonicalTokenPosGraphBoundNormalizedLabelProjectionV1,
  expectedNormalizedPosLabel: string,
): {
  memberComparisons:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedMemberComparisonV2[];

  matchingSurvivingMemberIds: string[];

  matchingResolvedMemberIds: string[];

  comparisonState:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonStateV2;

  booleanTruth: boolean | null;

  booleanTruthResolved: boolean;
} {
  const projection = bound.projection;

  const memberComparisons = projection.members.map(
    (member) => {
      const survivingForOpenComparison = member.graphStatus !==
          "blocked" &&
        member.graphStatus !==
          "rejected";

      return {
        posReadingNodeId: member.posReadingNodeId,

        rawPosLabel: member.rawPosLabel,

        normalizedPosLabel: member.normalizedPosLabel,

        graphStatus: member.graphStatus,

        explicitlyResolved: member.explicitlyResolved,

        survivingForOpenComparison,

        equalsExpectedNormalizedLabel: member.normalizedPosLabel ===
          expectedNormalizedPosLabel,
      };
    },
  );

  const matchingSurvivingMemberIds = memberComparisons
    .filter(
      (member) =>
        member.survivingForOpenComparison &&
        member.equalsExpectedNormalizedLabel,
    )
    .map(
      (member) => member.posReadingNodeId,
    );

  const resolvedIdSet = new Set(
    projection.resolvedMemberIds,
  );

  const resolvedMembers = memberComparisons.filter(
    (member) =>
      resolvedIdSet.has(
        member.posReadingNodeId,
      ),
  );

  const matchingResolvedMemberIds = resolvedMembers
    .filter(
      (member) => member.equalsExpectedNormalizedLabel,
    )
    .map(
      (member) => member.posReadingNodeId,
    );

  switch (
    projection.readState
  ) {
    case "no_pos_fact":
      return {
        memberComparisons,
        matchingSurvivingMemberIds,
        matchingResolvedMemberIds,
        comparisonState: "no_fact",
        booleanTruth: null,
        booleanTruthResolved: false,
      };

    case "blocked_hypothesis_set":
      return {
        memberComparisons,
        matchingSurvivingMemberIds,
        matchingResolvedMemberIds,
        comparisonState: "blocked",
        booleanTruth: null,
        booleanTruthResolved: false,
      };

    case "open_hypothesis_set":
      return {
        memberComparisons,
        matchingSurvivingMemberIds,
        matchingResolvedMemberIds,
        comparisonState: matchingSurvivingMemberIds.length >
            0
          ? "open_match_possible"
          : "open_no_surviving_match",
        booleanTruth: null,
        booleanTruthResolved: false,
      };

    case "explicit_resolved": {
      const resolvedCount = resolvedMembers.length;

      const matchingCount = matchingResolvedMemberIds.length;

      if (
        resolvedCount >
          0 &&
        matchingCount ===
          resolvedCount
      ) {
        return {
          memberComparisons,
          matchingSurvivingMemberIds,
          matchingResolvedMemberIds,
          comparisonState: "explicit_resolved_match",
          booleanTruth: true,
          booleanTruthResolved: true,
        };
      }

      if (
        resolvedCount >
          0 &&
        matchingCount ===
          0
      ) {
        return {
          memberComparisons,
          matchingSurvivingMemberIds,
          matchingResolvedMemberIds,
          comparisonState: "explicit_resolved_non_match",
          booleanTruth: false,
          booleanTruthResolved: true,
        };
      }

      return {
        memberComparisons,
        matchingSurvivingMemberIds,
        matchingResolvedMemberIds,
        comparisonState: "explicit_resolved_mixed",
        booleanTruth: null,
        booleanTruthResolved: false,
      };
    }
  }
}

function domainMatchesExpected(
  domain: CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainEvidenceV1,
  expected: CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1,
): boolean {
  return (
    domain.referencedBindingDefinitionAuthorityId ===
      expected.referencedBindingDefinitionAuthorityId &&
    domain.manifestId ===
      expected.manifestId &&
    domain.manifestCode ===
      expected.manifestCode &&
    domain.referencedBindingName ===
      expected.referencedBindingName
  );
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
  expectedResult: CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1,
  currentDomainResult:
    CanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityResultV1,
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonResultV2
> {
  const reasons: string[] = [];

  if (
    expectedResult.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1 ||
    expectedResult.producerVersion !==
      "1" ||
    expectedResult.status !==
      "ready" ||
    expectedResult.blockingReasons.length !==
      0
  ) {
    reasons.push(
      "expected_result:not_exact_ready_a334a",
    );
  }

  const expectedIds = new Set<string>();

  const expectedSiteKeys = new Set<string>();

  if (
    expectedResult.status ===
      "ready"
  ) {
    for (
      const expected of expectedResult.authorities
    ) {
      if (
        !exactExpectedSite(
          expected,
        )
      ) {
        reasons.push(
          `expected_site:${expected.id}:unsafe_contract`,
        );

        continue;
      }

      if (
        expectedIds.has(
          expected.id,
        )
      ) {
        reasons.push(
          `expected_site:${expected.id}:duplicate_id`,
        );
      }

      if (
        expectedSiteKeys.has(
          expected.referenceSiteKey,
        )
      ) {
        reasons.push(
          `expected_site:${expected.referenceSiteKey}:duplicate_reference_site`,
        );
      }

      expectedIds.add(
        expected.id,
      );

      expectedSiteKeys.add(
        expected.referenceSiteKey,
      );
    }
  }

  if (
    currentDomainResult.status !==
      "ready" ||
    currentDomainResult.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1 ||
    currentDomainResult.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1 ||
    currentDomainResult.blockingReasons.length !==
      0
  ) {
    reasons.push(
      "current_domain_result:not_exact_ready",
    );
  }

  if (
    reasons.length >
      0
  ) {
    return blocked(
      reasons,
    );
  }

  if (
    currentDomainResult.status !==
      "ready"
  ) {
    return blocked([
      "current_domain_result:not_ready",
    ]);
  }

  const rederivedCurrentDomain =
    deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
      currentDomainResult.sourceCurrentContextApplicabilityResult,
    );

  if (
    !sameCurrentDomain(
      currentDomainResult,
      rederivedCurrentDomain,
    )
  ) {
    return blocked([
      "current_domain_result:does_not_match_independent_rederivation",
    ]);
  }

  const current = currentDomainResult.authority;

  const snapshotResult = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    surface,
    graph,
  );

  if (
    snapshotResult.producer !==
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1 ||
    snapshotResult.producerVersion !==
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1 ||
    snapshotResult.status !==
      "ready" ||
    !snapshotResult.authority ||
    snapshotResult.blockingReasons.length !==
      0
  ) {
    return blocked([
      "snapshot_authority:not_exact_ready",
      ...snapshotResult.blockingReasons.map(
        (reason) => `snapshot_authority:${reason}`,
      ),
    ]);
  }

  const snapshot = snapshotResult.authority;

  if (
    snapshot.snapshotIdentityId !==
      current.snapshotIdentityId
  ) {
    return blocked([
      "snapshot_identity:current_domain_mismatch",
    ]);
  }

  if (
    snapshot.graphDocumentId !==
      current.graphDocumentId ||
    graph.documentId !==
      current.graphDocumentId
  ) {
    return blocked([
      "graph_document:current_domain_consistency_mismatch",
    ]);
  }

  const ownershipResult = deriveCanonicalPosFactOwnershipAuthoritiesV1(
    graph,
  );

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
    return blocked([
      "pos_ownership:not_exact_ready",
      ...ownershipResult.blockingReasons.map(
        (reason) => `pos_ownership:${reason}`,
      ),
    ]);
  }

  const capabilityResult = deriveCanonicalTokenPosPropertyCapabilityV1(
    ownershipResult,
  );

  if (
    capabilityResult.producer !==
      CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1 ||
    capabilityResult.producerVersion !==
      "1" ||
    capabilityResult.status !==
      "ready" ||
    !capabilityResult.capability ||
    capabilityResult.blockingReasons.length !==
      0
  ) {
    return blocked([
      "pos_capability:not_exact_ready",
      ...capabilityResult.blockingReasons.map(
        (reason) => `pos_capability:${reason}`,
      ),
    ]);
  }

  const graphBoundByToken = new Map<
    string,
    CanonicalTokenPosGraphBoundNormalizedLabelProjectionV1
  >();

  const uniqueTokenIds = uniqueSorted(
    current.bindingOccurrenceDomains.flatMap(
      (domain) =>
        domain.occurrences.map(
          (occurrence) => occurrence.tokenNodeId,
        ),
    ),
  );

  for (
    const tokenNodeId of uniqueTokenIds
  ) {
    const boundResult =
      deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1(
        graph,
        tokenNodeId,
        ownershipResult,
        capabilityResult,
      );

    if (
      boundResult.producer !==
        CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V1 ||
      boundResult.producerVersion !==
        "1" ||
      boundResult.status !==
        "ready" ||
      !boundResult.graphBoundProjection ||
      boundResult.blockingReasons.length !==
        0
    ) {
      reasons.push(
        `token:${tokenNodeId}:graph_bound_projection_not_exact_ready`,
      );

      for (
        const reason of boundResult.blockingReasons
      ) {
        reasons.push(
          `token:${tokenNodeId}:graph_bound_projection:${reason}`,
        );
      }

      continue;
    }

    const bound = boundResult.graphBoundProjection;

    if (
      bound.graphDocumentId !==
        current.graphDocumentId ||
      bound.tokenNodeId !==
        tokenNodeId
    ) {
      reasons.push(
        `token:${tokenNodeId}:graph_bound_projection_identity_mismatch`,
      );

      continue;
    }

    graphBoundByToken.set(
      tokenNodeId,
      bound,
    );
  }

  if (
    reasons.length >
      0
  ) {
    return blocked(
      reasons,
    );
  }

  const domainComparisons:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundDomainComparisonV2[] = [];

  const mappedExpectedIds = new Set<string>();

  for (
    const expected of expectedResult.authorities
  ) {
    const matchingDomains = current.bindingOccurrenceDomains.filter(
      (domain) =>
        domainMatchesExpected(
          domain,
          expected,
        ),
    );

    if (
      matchingDomains.length ===
        0
    ) {
      continue;
    }

    mappedExpectedIds.add(
      expected.id,
    );

    for (
      const domain of matchingDomains
    ) {
      if (
        domain.snapshotIdentityId !==
          current.snapshotIdentityId ||
        domain.snapshotSentenceOccurrenceIdentityId !==
          current.snapshotSentenceOccurrenceIdentityId ||
        domain.graphDocumentId !==
          current.graphDocumentId ||
        domain.sentenceNodeId !==
          current.sentenceNodeId ||
        domain.sentenceIndex !==
          current.sentenceIndex ||
        domain.occurrenceCount !==
          domain.occurrences.length
      ) {
        reasons.push(
          `domain:${domain.domainEvidenceId}:current_snapshot_identity_mismatch`,
        );

        continue;
      }

      const occurrenceComparisons:
        CanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceComparisonV2[] =
          [];

      for (
        const occurrence of domain.occurrences
      ) {
        const bound = graphBoundByToken.get(
          occurrence.tokenNodeId,
        );

        if (!bound) {
          reasons.push(
            `domain:${domain.domainEvidenceId}:token:${occurrence.tokenNodeId}:missing_rederived_graph_bound_projection`,
          );

          continue;
        }

        const projection = bound.projection;

        if (
          projection.normalizationAuthorityId !==
            expected.semanticAuthorityId ||
          projection.normalizationContract.trimWhitespace !==
            expected.normalizationContract.trimWhitespace ||
          projection.normalizationContract.unicodeNormalization !==
            expected.normalizationContract.unicodeNormalization ||
          projection.normalizationContract.localeCaseTransform !==
            expected.normalizationContract.localeCaseTransform ||
          projection.normalizationContract.locale !==
            expected.normalizationContract.locale
        ) {
          reasons.push(
            `domain:${domain.domainEvidenceId}:token:${occurrence.tokenNodeId}:normalization_contract_mismatch`,
          );

          continue;
        }

        const state = compare(
          bound,
          expected.normalizedPosLabelInput,
        );

        occurrenceComparisons.push({
          comparisonId: [
            "runtime-token-pos-current-snapshot-bound-occurrence-comparison-v2",
            idPart(
              current.snapshotIdentityId,
            ),
            idPart(
              expected.referenceSiteKey,
            ),
            idPart(
              domain.domainEvidenceId,
            ),
            idPart(
              occurrence.snapshotTokenOccurrenceIdentityId,
            ),
          ].join(
            ":",
          ),

          status: "proven_snapshot_bound_comparison",

          snapshotIdentityId: current.snapshotIdentityId,

          snapshotSentenceOccurrenceIdentityId:
            current.snapshotSentenceOccurrenceIdentityId,

          snapshotTokenOccurrenceIdentityId:
            occurrence.snapshotTokenOccurrenceIdentityId,

          graphDocumentId: domain.graphDocumentId,

          sentenceNodeId: domain.sentenceNodeId,

          sentenceIndex: domain.sentenceIndex,

          tokenNodeId: occurrence.tokenNodeId,

          tokenGraphStatus: occurrence.graphStatus,

          containmentEdgeId: occurrence.containmentEdgeId,

          sentenceTokenIndex: occurrence.sentenceTokenIndex,

          graphBoundProjectionId: bound.graphBoundProjectionId,

          sourceReadId: bound.sourceReadId,

          normalizedProjectionId: bound.normalizedProjectionId,

          readState: projection.readState,

          alternativeSetId: projection.alternativeSetId,

          alternativeSetStatus: projection.alternativeSetStatus,

          resolvedMemberIds: [
            ...projection.resolvedMemberIds,
          ],

          rawResolvedPosLabels: [
            ...projection.rawResolvedPosLabels,
          ],

          normalizedResolvedPosLabels: [
            ...projection.normalizedResolvedPosLabels,
          ],

          expectedNormalizedPosLabel: expected.normalizedPosLabelInput,

          memberComparisons: state.memberComparisons,

          matchingSurvivingMemberIds: state.matchingSurvivingMemberIds,

          matchingResolvedMemberIds: state.matchingResolvedMemberIds,

          comparisonState: state.comparisonState,

          booleanTruth: state.booleanTruth,

          booleanTruthResolved: state.booleanTruthResolved,
        });
      }

      domainComparisons.push({
        comparisonId: [
          "runtime-token-pos-current-snapshot-bound-domain-comparison-v2",
          idPart(
            current.snapshotIdentityId,
          ),
          idPart(
            expected.referenceSiteKey,
          ),
          idPart(
            domain.domainEvidenceId,
          ),
        ].join(
          ":",
        ),

        status: "candidate_comparison_domain",

        expectedSiteAuthorityId: expected.id,

        semanticAuthorityId: expected.semanticAuthorityId,

        stringOperandCompatibilityId: expected.stringOperandCompatibilityId,

        whereReferenceRootAuthorityId: expected.whereReferenceRootAuthorityId,

        whereShapeAuthorityId: expected.whereShapeAuthorityId,

        ownerBindingDefinitionAuthorityId:
          expected.ownerBindingDefinitionAuthorityId,

        referencedBindingDefinitionAuthorityId:
          expected.referencedBindingDefinitionAuthorityId,

        manifestId: expected.manifestId,

        manifestCode: expected.manifestCode,

        ownerBindingName: expected.ownerBindingName,

        referencedBindingName: expected.referencedBindingName,

        referenceSiteKey: expected.referenceSiteKey,

        referencePath: expected.referencePath,

        domainEvidenceId: domain.domainEvidenceId,

        snapshotBoundDomainId: domain.snapshotBoundDomainId,

        sourceDomainCandidateId: domain.sourceDomainCandidateId,

        snapshotIdentityId: domain.snapshotIdentityId,

        snapshotSentenceOccurrenceIdentityId:
          domain.snapshotSentenceOccurrenceIdentityId,

        graphDocumentId: domain.graphDocumentId,

        sentenceNodeId: domain.sentenceNodeId,

        sentenceIndex: domain.sentenceIndex,

        expectedNormalizedPosLabel: expected.normalizedPosLabelInput,

        occurrenceComparisons,

        occurrenceCount: occurrenceComparisons.length,
      });
    }
  }

  if (
    reasons.length >
      0
  ) {
    return blocked(
      reasons,
    );
  }

  const unmappedExpectedSiteAuthorityIds = expectedResult.authorities
    .filter(
      (expected) =>
        !mappedExpectedIds.has(
          expected.id,
        ),
    )
    .map(
      (expected) => expected.id,
    );

  const authorityId = [
    CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2,
    idPart(
      current.authorityId,
    ),
    idPart(
      snapshot.snapshotIdentityId,
    ),
    ...domainComparisons.map(
      (comparison) =>
        idPart(
          comparison.comparisonId,
        ),
    ),
  ].join(
    ":",
  );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2,

    status: "ready",

    authority: {
      authorityId,

      status: "proven_current_snapshot_bound_pos_comparison",

      sourceCurrentBindingOccurrenceDomainAuthorityId: current.authorityId,

      snapshotAuthorityId: snapshot.authorityId,

      snapshotIdentityId: snapshot.snapshotIdentityId,

      snapshotSha256: snapshot.snapshotSha256,

      surfaceSnapshotSha256: snapshot.surfaceSnapshotSha256,

      graphStateSha256: snapshot.graphStateSha256,

      graphDocumentId: current.graphDocumentId,

      sentenceNodeId: current.sentenceNodeId,

      sentenceIndex: current.sentenceIndex,

      domainComparisons,

      domainComparisonCount: domainComparisons.length,

      unmappedExpectedSiteAuthorityIds,

      governance: {
        exactSurfaceInputRequired: true,

        exactGraphInputRequired: true,

        exactSnapshotAuthorityIndependentlyRederived: true,

        exactSnapshotIdentityMustMatchCurrentDomain: true,

        graphDocumentIdUsedAsSnapshotIdentity: false,

        exactA334aExpectedAuthorityRequired: true,

        normalizedExpectedLabelConsumedNotReconstructed: true,

        closedCurrentBindingDomainPublicDerivationReexecuted: true,

        suppliedCurrentBindingDomainMustMatchRederivedAuthority: true,

        forgedCurrentBindingDomainWrapperAcceptedAsProof: false,

        posOwnershipRederivedFromExactSnapshotGraph: true,

        posCapabilityRederivedFromExactSnapshotGraphOwnership: true,

        graphBoundPosProjectionRederivedPerCurrentOccurrence: true,

        graphBoundPosProjectionDerivedFromExactSnapshotGraph: true,

        snapshotTokenOccurrenceIdentityPreserved: true,

        graphDocumentIdPreservedAsConsistencyMetadata: true,

        sentenceNodeIdPreservedAsConsistencyMetadata: true,

        sentenceIndexIsLocalityMetadataOnly: true,

        normalizedMemberEqualityPerformed: true,

        comparisonStateResolved: true,

        posComparisonExecuted: true,

        noFactCollapsedToFalse: false,

        blockedCollapsedToFalse: false,

        openNoSurvivingMatchCollapsedToFalse: false,

        openMatchPossibleCollapsedToTrue: false,

        mixedResolvedLabelsCollapsedToBoolean: false,

        runtimeConditionTruthResolved: false,

        occurrenceFilteringPerformed: false,

        cardinalitySemanticsResolved: false,

        cardinalityEnforcementPerformed: false,

        domainCandidateWinnerSelected: false,

        occurrenceWinnerSelected: false,

        occurrenceBindingPerformed: false,

        finalRuntimeOccurrenceBindingPerformed: false,

        whereEvaluationPerformed: false,

        learnerErrorClassified: false,

        constraintPropagationInvoked: false,

        canonicalDependencyEdgeGenerated: false,

        clauseNodeGenerated: false,

        graphMutationPerformed: false,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
