/**
 * v1.46 A4.6a1e1
 *
 * token.pos A4.6a1c2a -> A4.6a1e source adapter.
 *
 * Purpose:
 * - consume the exact authority-bound token.pos leaf-truth source;
 * - follow its preserved D2b1 V2 -> D2a object lineage;
 * - prove exactly one snapshot-bound token occurrence;
 * - project only its sentence-level Runtime context;
 * - wrap the exact A4.6a1c2 evidence object without truth reconstruction.
 *
 * Runtime sentence-context identity:
 *
 *   snapshotIdentityId
 *     + snapshotSentenceOccurrenceIdentityId
 *
 * graphDocumentId and sentenceNodeId remain consistency metadata.
 *
 * tokenNodeId / snapshotTokenOccurrenceIdentityId remain proof-only and
 * never become sentence-context identity.
 *
 * This adapter does NOT:
 * - recompute or duplicate truth;
 * - compose compound WHERE truth;
 * - compare sibling leaf contexts;
 * - globally select Runtime sentence context;
 * - filter/select final binding occurrences;
 * - resolve/enforce cardinality;
 * - mutate graph;
 * - classify learner error.
 */

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthAdapterResultV1,
} from "./canonical-runtime-manifest-binding-where-token-pos-authority-bound-child-truth-adapter-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-context-bound-child-truth-evidence-interface-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1 =
  "canonical_runtime_manifest_binding_where_token_pos_context_bound_child_truth_adapter_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1 =
  "runtime_where_token_pos_context_bound_child_truth_adapter_a4_6a1e1_v1" as const;

type SourceResultV1 =
  CanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthAdapterResultV1;

type ReadySourceV1 = Extract<
  SourceResultV1,
  {
    status: "ready";
  }
>;

type ContextBoundReadyEnvelopeV1 = {
  status: "ready";

  evidence: CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1;

  blockingReasons: readonly [];
};

type ContextBoundBlockedEnvelopeV1 = {
  status: "blocked";

  blockingReasons: readonly string[];
};

type AdapterGovernanceV1 = {
  exactA46a1c2aResultRequired: true;
  exactA46a1c2aProducerRequired: true;
  exactA46a1c2aVersionRequired: true;
  exactA46a1c2aSpecificationRequired: true;
  exactA46a1eInterfaceSpecificationRequired: true;

  soleRuntimeInputIsA46a1c2aResult: true;

  sourceReadyRequiredForReadyOutput: true;
  sourceBlockedPreservedAsBlocked: true;

  exactAuthorityBoundChildTruthRequired: true;
  exactA46a1c1ChildTruthObjectLineageRequired: true;
  exactD2b1V2EvidenceObjectLineageRequired: true;
  exactD2aEvidenceObjectLineageRequired: true;

  uniqueApplicabilityStateRequired: true;
  exactSingleOccurrenceMatchRequired: true;
  matchingPairUniquenessRevalidated: true;
  matchingOccurrenceUniquenessRevalidated: true;
  matchingPairEvidenceIdsRevalidated: true;
  matchingOccurrenceEvidenceIdsRevalidated: true;

  snapshotContextConsistencyRevalidated: true;
  graphDocumentConsistencyRevalidated: true;
  sentenceContextConsistencyRevalidated: true;
  tokenOccurrenceProofConsistencyRevalidated: true;

  unresolvedTruthWithUniqueContextAllowed: true;

  contextBoundChildTruthEvidenceConstructed: true;

  authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction: true;
  d2b1V2EvidenceObjectPreservedWithoutReconstruction: true;
  d2aEvidenceObjectPreservedWithoutReconstruction: true;

  callerStructuralAuthorityIdAccepted: false;
  callerNodePathAccepted: false;
  callerSnapshotIdentityIdAccepted: false;
  callerSnapshotSentenceOccurrenceIdentityIdAccepted: false;
  callerSentenceNodeIdAccepted: false;
  callerGraphDocumentIdAccepted: false;

  sentenceIndexUsedAsContextIdentity: false;
  tokenOccurrenceUsedAsSentenceContextIdentity: false;

  truthDispositionDuplicatedAtContextBindingLayer: false;
  truthRecomputedByAdapter: false;

  compoundTruthComposed: false;
  siblingLeafContextsCompared: false;

  runtimeSentenceContextSelected: false;

  occurrenceFilteringPerformed: false;
  occurrenceWinnerSelected: false;
  finalRuntimeOccurrenceBindingPerformed: false;

  cardinalitySemanticsResolved: false;
  cardinalityEnforcementPerformed: false;

  graphMutationPerformed: false;
  learnerErrorClassified: false;

  frozenGrammarReadOnly: true;
};

type ReadyResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1;

  status: "ready";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1;

  sourceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1;

  contextBoundInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceResult: ReadySourceV1;

  contextBoundChildTruth: ContextBoundReadyEnvelopeV1;

  blockingReasons: readonly [];

  governance: AdapterGovernanceV1;
};

type BlockedResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1;

  status: "blocked";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1;

  sourceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1;

  contextBoundInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceResult: SourceResultV1;

  contextBoundChildTruth: ContextBoundBlockedEnvelopeV1;

  blockingReasons: readonly string[];

  governance: AdapterGovernanceV1;
};

export type CanonicalRuntimeManifestBindingWhereTokenPosContextBoundChildTruthAdapterResultV1 =
  | ReadyResultV1
  | BlockedResultV1;

const SOURCE_GOVERNANCE_EXPECTED = {
  exactA46a1c1ResultRequired: true,
  exactA46a1c1ProducerRequired: true,
  exactA46a1c1VersionRequired: true,
  exactA46a1c1SpecificationRequired: true,
  exactA46a1cInterfaceSpecificationRequired: true,
  exactA46a1c1GovernanceProofRequired: true,
  sourceReadyRequiredForReadyOutput: true,
  sourceBlockedPreservedAsBlocked: true,
  sourceShapeResultReadyRequired: true,
  exactMatchedShapeAuthorityObjectMembershipRevalidated: true,
  exactMatchedShapeAuthorityObjectMembershipMustBeUnique: true,
  matchedLeafMustRemainLeafOperator: true,
  sourceChildTruthReadyRequired: true,
  sourceChildTruthNodePathRequired: true,
  matchedLeafPathMustEqualChildTruthNodePath: true,
  uniqueLeafPathWithinMatchedAuthorityRevalidated: true,
  exactMatchedLeafObjectIdentityRevalidated: true,
  structuralAuthorityIdDerivedFromMatchedShapeAuthority: true,
  nodePathDerivedFromPreservedChildTruthEvidence: true,
  childTruthEvidenceObjectPreservedWithoutReconstruction: true,
  callerStructuralAuthorityIdAccepted: false,
  callerNodePathAccepted: false,
  callerMatchedAuthorityAccepted: false,
  callerMatchedLeafAccepted: false,
  callerChildTruthEvidenceAccepted: false,
  secondExternalAuthoritySearchPerformed: false,
  sourceTruthRecomputed: false,
  truthDispositionDuplicatedAtBindingLayer: false,
  authorityBoundChildTruthEvidenceConstructed: true,
  compoundTruthComposed: false,
  compoundBooleanCompositionExecuted: false,
  shortCircuitExecuted: false,
  manifestConditionTruthResolved: false,
  runtimeSentenceContextSelected: false,
  occurrenceFilteringPerformed: false,
  occurrenceWinnerSelected: false,
  finalRuntimeOccurrenceBindingPerformed: false,
  cardinalitySemanticsResolved: false,
  cardinalityEnforcementPerformed: false,
  graphMutationPerformed: false,
  learnerErrorClassified: false,
  frozenGrammarReadOnly: true,
} as const;

const GOVERNANCE: AdapterGovernanceV1 = {
  exactA46a1c2aResultRequired: true,
  exactA46a1c2aProducerRequired: true,
  exactA46a1c2aVersionRequired: true,
  exactA46a1c2aSpecificationRequired: true,
  exactA46a1eInterfaceSpecificationRequired: true,

  soleRuntimeInputIsA46a1c2aResult: true,

  sourceReadyRequiredForReadyOutput: true,
  sourceBlockedPreservedAsBlocked: true,

  exactAuthorityBoundChildTruthRequired: true,
  exactA46a1c1ChildTruthObjectLineageRequired: true,
  exactD2b1V2EvidenceObjectLineageRequired: true,
  exactD2aEvidenceObjectLineageRequired: true,

  uniqueApplicabilityStateRequired: true,
  exactSingleOccurrenceMatchRequired: true,
  matchingPairUniquenessRevalidated: true,
  matchingOccurrenceUniquenessRevalidated: true,
  matchingPairEvidenceIdsRevalidated: true,
  matchingOccurrenceEvidenceIdsRevalidated: true,

  snapshotContextConsistencyRevalidated: true,
  graphDocumentConsistencyRevalidated: true,
  sentenceContextConsistencyRevalidated: true,
  tokenOccurrenceProofConsistencyRevalidated: true,

  unresolvedTruthWithUniqueContextAllowed: true,

  contextBoundChildTruthEvidenceConstructed: true,

  authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction: true,
  d2b1V2EvidenceObjectPreservedWithoutReconstruction: true,
  d2aEvidenceObjectPreservedWithoutReconstruction: true,

  callerStructuralAuthorityIdAccepted: false,
  callerNodePathAccepted: false,
  callerSnapshotIdentityIdAccepted: false,
  callerSnapshotSentenceOccurrenceIdentityIdAccepted: false,
  callerSentenceNodeIdAccepted: false,
  callerGraphDocumentIdAccepted: false,

  sentenceIndexUsedAsContextIdentity: false,
  tokenOccurrenceUsedAsSentenceContextIdentity: false,

  truthDispositionDuplicatedAtContextBindingLayer: false,
  truthRecomputedByAdapter: false,

  compoundTruthComposed: false,
  siblingLeafContextsCompared: false,

  runtimeSentenceContextSelected: false,

  occurrenceFilteringPerformed: false,
  occurrenceWinnerSelected: false,
  finalRuntimeOccurrenceBindingPerformed: false,

  cardinalitySemanticsResolved: false,
  cardinalityEnforcementPerformed: false,

  graphMutationPerformed: false,
  learnerErrorClassified: false,

  frozenGrammarReadOnly: true,
};

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

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
      ),
  );
}

function exactSourceGovernance(
  governance: unknown,
): boolean {
  if (
    typeof governance !==
      "object" ||
    governance ===
      null ||
    Array.isArray(
      governance,
    )
  ) {
    return false;
  }

  const actual = governance as Record<
    string,
    unknown
  >;

  const expected = SOURCE_GOVERNANCE_EXPECTED as Record<
    string,
    unknown
  >;

  const actualKeys = Object.keys(
    actual,
  ).sort();

  const expectedKeys = Object.keys(
    expected,
  ).sort();

  if (
    actualKeys.length !==
      expectedKeys.length
  ) {
    return false;
  }

  for (
    let index = 0;
    index < expectedKeys.length;
    index += 1
  ) {
    const key = expectedKeys[index];

    if (
      actualKeys[index] !==
        key ||
      actual[key] !==
        expected[key]
    ) {
      return false;
    }
  }

  return true;
}

function blocked(
  sourceResult: SourceResultV1,
  reasons: readonly string[],
): BlockedResultV1 {
  const blockingReasons = uniqueSorted(
    reasons,
  );

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,

    status: "blocked",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,

    sourceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,

    contextBoundInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceResult,

    contextBoundChildTruth: {
      status: "blocked",

      blockingReasons,
    },

    blockingReasons,

    governance: GOVERNANCE,
  };
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

export function adaptCanonicalRuntimeManifestBindingWhereTokenPosContextBoundChildTruthV1(
  sourceResult: SourceResultV1,
): CanonicalRuntimeManifestBindingWhereTokenPosContextBoundChildTruthAdapterResultV1 {
  if (
    sourceResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1 ||
    sourceResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1 ||
    sourceResult.specificationId !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1
  ) {
    return blocked(
      sourceResult,
      [
        "a4_6a1c2a:not_exact_contract",
      ],
    );
  }

  if (
    sourceResult.status ===
      "blocked"
  ) {
    return blocked(
      sourceResult,
      [
        "a4_6a1c2a:blocked",
        ...sourceResult.blockingReasons.map(
          (reason) => `a4_6a1c2a:${reason}`,
        ),
      ],
    );
  }

  if (
    sourceResult.status !==
      "ready" ||
    sourceResult.blockingReasons.length !==
      0 ||
    !exactSourceGovernance(
      sourceResult.governance,
    )
  ) {
    return blocked(
      sourceResult,
      [
        "a4_6a1c2a:not_exact_ready",
      ],
    );
  }

  if (
    sourceResult.authorityBoundChildTruth.status !==
      "ready" ||
    sourceResult.authorityBoundChildTruth.blockingReasons.length !==
      0
  ) {
    return blocked(
      sourceResult,
      [
        "authority_bound_child_truth:not_exact_ready",
      ],
    );
  }

  const source = sourceResult.sourceResult;

  if (
    source.childTruth.status !==
      "ready" ||
    source.childTruth.blockingReasons.length !==
      0
  ) {
    return blocked(
      sourceResult,
      [
        "a4_6a1c1_child_truth:not_exact_ready",
      ],
    );
  }

  const authorityBound = sourceResult.authorityBoundChildTruth.evidence;

  const childTruth = source.childTruth.evidence;

  if (
    authorityBound.childTruthEvidence !==
      childTruth
  ) {
    return blocked(
      sourceResult,
      [
        "authority_bound_child_truth:child_truth_object_not_exact_source_object",
      ],
    );
  }

  if (
    authorityBound.structuralAuthorityId !==
      source.matchedShapeAuthority.id ||
    authorityBound.nodePath !==
      source.matchedLeafNode.path ||
    authorityBound.nodePath !==
      childTruth.nodePath
  ) {
    return blocked(
      sourceResult,
      [
        "authority_bound_child_truth:structural_identity_mismatch",
      ],
    );
  }

  if (
    source.matchedLeafNode.shape !==
      "leaf_operator" ||
    childTruth.sourceKind !==
      "leaf_condition_truth"
  ) {
    return blocked(
      sourceResult,
      [
        "source_leaf:not_exact_leaf_condition_truth",
      ],
    );
  }

  const leafTruth = source.sourceLeafTruthResult;

  if (
    leafTruth.status !==
      "ready" ||
    leafTruth.blockingReasons.length !==
      0 ||
    leafTruth.evidence ===
      undefined ||
    leafTruth.sourceV2Result ===
      null
  ) {
    return blocked(
      sourceResult,
      [
        "d2b1_v3:not_exact_ready_lineage",
      ],
    );
  }

  const v2 = leafTruth.sourceV2Result;

  if (
    v2.status !==
      "ready" ||
    v2.blockingReasons.length !==
      0 ||
    v2.evidence ===
      undefined ||
    v2.evidence !==
      leafTruth.evidence
  ) {
    return blocked(
      sourceResult,
      [
        "d2b1_v2:not_exact_ready_lineage",
      ],
    );
  }

  const v2Evidence = v2.evidence;

  if (
    childTruth.sourceEvidenceObject !==
      v2Evidence ||
    childTruth.sourceEvidenceId !==
      v2Evidence.conditionTruthCompositionId ||
    childTruth.truthDisposition !==
      v2Evidence.truthDisposition
  ) {
    return blocked(
      sourceResult,
      [
        "a4_6a1c1_child_truth:d2b1_v2_evidence_lineage_mismatch",
      ],
    );
  }

  const d2a = v2Evidence.d2aApplicabilityEvidence;

  if (
    v2Evidence.applicabilityEvidenceId !==
      d2a.applicabilityEvidenceId ||
    v2Evidence.applicabilityState !==
      d2a.applicabilityState ||
    v2Evidence.exactSiteSnapshotTokenOccurrenceMatchCount !==
      d2a.exactSiteSnapshotTokenOccurrenceMatchCount ||
    v2Evidence.snapshotIdentityId !==
      d2a.actualSnapshotIdentityId ||
    v2Evidence.graphDocumentId !==
      d2a.actualGraphDocumentId ||
    v2Evidence.tokenNodeId !==
      d2a.actualTokenNodeId
  ) {
    return blocked(
      sourceResult,
      [
        "d2b1_v2:d2a_preserved_lineage_mismatch",
      ],
    );
  }

  const matchingPairs = d2a.pairEvidence.filter(
    (pair) => pair.exactSiteSnapshotTokenOccurrenceMatch,
  );

  const matchingOccurrences = matchingPairs.flatMap(
    (pair) => pair.matchingTokenOccurrences,
  );

  if (
    d2a.applicabilityState !==
      "unique_site_snapshot_token_occurrence_match" ||
    d2a.exactSiteSnapshotTokenOccurrenceMatchCount !==
      1 ||
    matchingPairs.length !==
      1 ||
    matchingOccurrences.length !==
      1
  ) {
    return blocked(
      sourceResult,
      [
        "d2a:unique_runtime_leaf_context_not_proven",
      ],
    );
  }

  const uniquePair = matchingPairs[0]!;

  const uniqueOccurrence = matchingOccurrences[0]!;

  if (
    uniquePair.siteIdentityMatches !==
      true ||
    uniquePair.snapshotIdentityMatches !==
      true ||
    uniquePair.matchingTokenOccurrenceCount !==
      1 ||
    uniquePair.matchingTokenOccurrences.length !==
      1 ||
    uniquePair.matchingTokenOccurrences[0] !==
      uniqueOccurrence
  ) {
    return blocked(
      sourceResult,
      [
        "d2a:unique_pair_occurrence_structure_not_exact",
      ],
    );
  }

  if (
    d2a.matchingPairEvidenceIds.length !==
      1 ||
    d2a.matchingPairEvidenceIds[0] !==
      uniquePair.pairEvidenceId
  ) {
    return blocked(
      sourceResult,
      [
        "d2a:matching_pair_evidence_ids_not_exact",
      ],
    );
  }

  if (
    d2a.matchingOccurrenceEvidenceIds.length !==
      1 ||
    d2a.matchingOccurrenceEvidenceIds[0] !==
      uniqueOccurrence.occurrenceMatchEvidenceId
  ) {
    return blocked(
      sourceResult,
      [
        "d2a:matching_occurrence_evidence_ids_not_exact",
      ],
    );
  }

  const domain = uniquePair.snapshotDomainCandidate;

  if (
    uniquePair.snapshotBoundDomainId !==
      domain.snapshotBoundDomainId ||
    uniquePair.sourceDomainCandidateId !==
      domain.sourceDomainCandidateId
  ) {
    return blocked(
      sourceResult,
      [
        "runtime_context:pair_domain_identity_mismatch",
      ],
    );
  }

  if (
    !present(
      domain.snapshotIdentityId,
    ) ||
    domain.snapshotIdentityId !==
      d2a.actualSnapshotIdentityId ||
    domain.snapshotIdentityId !==
      d2a.snapshotDomainSnapshotIdentityId
  ) {
    return blocked(
      sourceResult,
      [
        "runtime_context:snapshot_identity_mismatch",
      ],
    );
  }

  if (
    !present(
      domain.graphDocumentId,
    ) ||
    domain.graphDocumentId !==
      d2a.actualGraphDocumentId ||
    domain.graphDocumentId !==
      d2a.snapshotDomainGraphDocumentId
  ) {
    return blocked(
      sourceResult,
      [
        "runtime_context:graph_document_identity_mismatch",
      ],
    );
  }

  if (
    !present(
      uniquePair.sentenceNodeId,
    ) ||
    uniquePair.sentenceNodeId !==
      domain.sentenceNodeId
  ) {
    return blocked(
      sourceResult,
      [
        "runtime_context:sentence_node_identity_mismatch",
      ],
    );
  }

  if (
    !present(
      uniquePair.snapshotSentenceOccurrenceIdentityId,
    ) ||
    uniquePair.snapshotSentenceOccurrenceIdentityId !==
      domain.snapshotSentenceOccurrenceIdentityId
  ) {
    return blocked(
      sourceResult,
      [
        "runtime_context:snapshot_sentence_occurrence_identity_mismatch",
      ],
    );
  }

  if (
    uniqueOccurrence.tokenNodeId !==
      uniqueOccurrence.occurrence.tokenNodeId ||
    uniqueOccurrence.tokenNodeId !==
      d2a.actualTokenNodeId
  ) {
    return blocked(
      sourceResult,
      [
        "runtime_context:token_occurrence_node_proof_mismatch",
      ],
    );
  }

  if (
    !present(
      uniqueOccurrence.snapshotTokenOccurrenceIdentityId,
    ) ||
    uniqueOccurrence.snapshotTokenOccurrenceIdentityId !==
      uniqueOccurrence.occurrence.snapshotTokenOccurrenceIdentityId
  ) {
    return blocked(
      sourceResult,
      [
        "runtime_context:snapshot_token_occurrence_proof_mismatch",
      ],
    );
  }

  const snapshotIdentityId = domain.snapshotIdentityId;

  const snapshotSentenceOccurrenceIdentityId =
    uniquePair.snapshotSentenceOccurrenceIdentityId;

  const graphDocumentId = domain.graphDocumentId;

  const sentenceNodeId = uniquePair.sentenceNodeId;

  const contextBoundChildTruthEvidenceId = [
    "a4_6a1e1",
    idPart(
      authorityBound.structuralAuthorityId,
    ),
    idPart(
      authorityBound.nodePath,
    ),
    idPart(
      snapshotIdentityId,
    ),
    idPart(
      snapshotSentenceOccurrenceIdentityId,
    ),
  ].join(
    ":",
  );

  const contextBoundEvidence:
    CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1 = {
      contextBoundChildTruthEvidenceId,

      structuralAuthorityId: authorityBound.structuralAuthorityId,

      nodePath: authorityBound.nodePath,

      snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId,

      graphDocumentId,

      sentenceNodeId,

      authorityBoundChildTruthEvidence: authorityBound,

      provenance: {
        exactAuthorityBoundChildTruthEvidenceRequired: true,
        authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction:
          true,
        structuralAuthorityIdMatchesWrappedEvidence: true,
        nodePathMatchesWrappedEvidence: true,
        canonicalSnapshotSentenceOccurrenceIdentityRequired: true,
        snapshotIdentityRequired: true,
        snapshotSentenceOccurrenceIdentityRequired: true,
        snapshotIdentityAndSentenceOccurrenceIdentityFormContextCompositeIdentity:
          true,
        graphDocumentIdPreservedAsContextConsistencyMetadata: true,
        sentenceNodeIdPreservedAsContextConsistencyMetadata: true,
        sentenceIndexUsedAsContextIdentity: false,
        tokenNodeIdUsedAsSentenceContextIdentity: false,
        snapshotTokenOccurrenceIdentityUsedAsSentenceContextIdentity: false,
        authorityContextPairProvenBySourceAdapter: true,
        contextInferredByInterface: false,
        callerSuppliedContextAcceptedAsProof: false,
        truthDispositionDuplicatedAtContextBindingLayer: false,
        truthRecomputedByInterface: false,
      },
    };

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,

    status: "ready",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,

    sourceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,

    contextBoundInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceResult,

    contextBoundChildTruth: {
      status: "ready",

      evidence: contextBoundEvidence,

      blockingReasons: [],
    },

    blockingReasons: [],

    governance: GOVERNANCE,
  };
}
