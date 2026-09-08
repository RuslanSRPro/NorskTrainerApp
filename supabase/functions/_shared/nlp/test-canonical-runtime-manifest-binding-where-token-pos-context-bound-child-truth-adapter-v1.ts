import {
  adaptCanonicalRuntimeManifestBindingWhereTokenPosContextBoundChildTruthV1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,
} from "./canonical-runtime-manifest-binding-where-token-pos-context-bound-child-truth-adapter-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthAdapterResultV1,
} from "./canonical-runtime-manifest-binding-where-token-pos-authority-bound-child-truth-adapter-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
} from "./canonical-runtime-manifest-binding-where-context-bound-child-truth-evidence-interface-v1.ts";

type SourceResult =
  CanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthAdapterResultV1;

type TruthDisposition =
  | "resolved_true"
  | "resolved_false"
  | "unresolved";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

function sourceGovernance() {
  return {
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
  };
}

function fixture(
  truthDisposition: TruthDisposition = "resolved_true",
) {
  const occurrence = {
    tokenNodeId: "token-1",
    containmentEdgeId: "contains-1",
    sentenceTokenIndex: 0,
    graphStatus: "resolved",
    snapshotTokenOccurrenceIdentityId:
      "canonical-snapshot-token-occurrence-v1:snapshot-1:token-1",
  };

  const domain = {
    snapshotBoundDomainId: "domain-1",
    status: "candidate",
    sourceDomainCandidateId: "source-domain-1",
    snapshotAuthorityId: "snapshot-authority-1",
    snapshotIdentityId: "snapshot-1",
    snapshotSha256: "snapshot-sha-1",
    surfaceSnapshotSha256: "surface-sha-1",
    graphStateSha256: "graph-state-sha-1",
    graphVersion: "canonical-language-graph-v1",
    graphDocumentId: "document-1",
    canonicalTokenDomainId: "token-domain-1",
    sentenceNodeId: "sentence-1",
    sentenceIndex: 99,
    snapshotSentenceOccurrenceIdentityId:
      "canonical-snapshot-sentence-occurrence-v1:snapshot-1:sentence-1",
    occurrenceCount: 1,
    occurrences: [
      occurrence,
    ],
  };

  const occurrenceMatch = {
    occurrenceMatchEvidenceId: "occurrence-match-1",
    tokenNodeId: occurrence.tokenNodeId,
    containmentEdgeId: occurrence.containmentEdgeId,
    sentenceTokenIndex: occurrence.sentenceTokenIndex,
    graphStatus: occurrence.graphStatus,
    snapshotTokenOccurrenceIdentityId:
      occurrence.snapshotTokenOccurrenceIdentityId,
    occurrence,
  };

  const pair = {
    pairEvidenceId: "pair-1",
    pairIndex: 0,
    snapshotBoundDomainId: domain.snapshotBoundDomainId,
    sourceDomainCandidateId: domain.sourceDomainCandidateId,
    sentenceNodeId: domain.sentenceNodeId,
    snapshotSentenceOccurrenceIdentityId:
      domain.snapshotSentenceOccurrenceIdentityId,
    siteIdentityFieldMatches: {},
    siteIdentityMatches: true,
    snapshotIdentityMatches: true,
    matchingTokenOccurrences: [
      occurrenceMatch,
    ],
    matchingTokenOccurrenceCount: 1,
    exactSiteSnapshotTokenOccurrenceMatch: true,
    snapshotDomainCandidate: domain,
  };

  const d2a = {
    applicabilityEvidenceId: "d2a-1",
    status: "candidate",
    applicabilityState: "unique_site_snapshot_token_occurrence_match",
    c2ComparisonEvidenceId: "c2-1",
    actualSnapshotIdentityId: domain.snapshotIdentityId,
    actualSnapshotSha256: domain.snapshotSha256,
    actualGraphDocumentId: domain.graphDocumentId,
    actualTokenNodeId: occurrence.tokenNodeId,
    actualGraphTokenOccurrenceIdentityId: "graph-token-occurrence-1",
    expectedAuthorityId: "expected-1",
    snapshotDomainSnapshotIdentityId: domain.snapshotIdentityId,
    snapshotDomainSnapshotSha256: domain.snapshotSha256,
    snapshotDomainGraphDocumentId: domain.graphDocumentId,
    pairEvidence: [
      pair,
    ],
    siteMatchingDomainCount: 1,
    exactSiteSnapshotTokenOccurrenceMatchCount: 1,
    matchingPairEvidenceIds: [
      pair.pairEvidenceId,
    ],
    matchingOccurrenceEvidenceIds: [
      occurrenceMatch.occurrenceMatchEvidenceId,
    ],
  };

  const v2Evidence = {
    conditionTruthCompositionId: "truth-v2-1",
    status: "candidate",
    truthDisposition,
    booleanTruth: truthDisposition ===
        "resolved_true"
      ? true
      : truthDisposition ===
          "resolved_false"
      ? false
      : null,
    booleanTruthResolved: truthDisposition !==
      "unresolved",
    applicabilityEvidenceId: d2a.applicabilityEvidenceId,
    applicabilityState: d2a.applicabilityState,
    exactSiteSnapshotTokenOccurrenceMatchCount:
      d2a.exactSiteSnapshotTokenOccurrenceMatchCount,
    comparisonEvidenceId: "c2-1",
    comparisonState: truthDisposition ===
        "resolved_false"
      ? "explicit_resolved_non_match"
      : truthDisposition ===
          "resolved_true"
      ? "explicit_resolved_match"
      : "open_match_possible",
    snapshotIdentityId: d2a.actualSnapshotIdentityId,
    snapshotSha256: d2a.actualSnapshotSha256,
    graphDocumentId: d2a.actualGraphDocumentId,
    tokenNodeId: d2a.actualTokenNodeId,
    graphTokenOccurrenceIdentityId: d2a.actualGraphTokenOccurrenceIdentityId,
    expectedAuthorityId: d2a.expectedAuthorityId,
    d2aApplicabilityEvidence: d2a,
  };

  const v2Result = {
    producer: "canonical_runtime_token_pos_condition_truth_composition_v2",
    producerVersion: "2",
    status: "ready",
    evidence: v2Evidence,
    blockingReasons: [],
  };

  const leafTruth = {
    producer: "canonical-runtime-token-pos-condition-truth-composition-v3",
    producerVersion: "3",
    status: "ready",
    evidence: v2Evidence,
    sourceV2Result: v2Result,
    blockingReasons: [],
  };

  const childTruthEvidence = {
    childTruthEvidenceId: "child-truth-1",
    nodePath: "$.all[0]",
    sourceKind: "leaf_condition_truth",
    truthDisposition,
    sourceProducer: leafTruth.producer,
    sourceProducerVersion: leafTruth.producerVersion,
    sourceEvidenceId: v2Evidence.conditionTruthCompositionId,
    sourceEvidenceObject: v2Evidence,
    provenance: {
      exactStructuralNodePathClaimed: true,
      truthDispositionSuppliedBySourceAuthority: true,
      sourceProducerIdentityPreserved: true,
      sourceEvidenceIdentityPreserved: true,
      sourceEvidenceObjectPreservedWithoutReconstruction: true,
      truthRecomputedByInterface: false,
      booleanTruthInferredByInterface: false,
    },
  };

  const childTruth = {
    status: "ready",
    evidence: childTruthEvidence,
    blockingReasons: [],
  };

  const matchedLeafNode = {
    shape: "leaf_operator",
    path: "$.all[0]",
    operatorLabel: "eq",
  };

  const matchedShapeAuthority = {
    id: "shape-authority-1",
    root: matchedLeafNode,
  };

  const sourceShapeResult = {
    status: "ready",
    authorities: [
      matchedShapeAuthority,
    ],
    blockingReasons: [],
  };

  const a1c1Result = {
    producer:
      "canonical_runtime_manifest_binding_where_token_pos_leaf_truth_child_evidence_adapter_v1",
    producerVersion: "1",
    status: "ready",
    sourceLeafTruthResult: leafTruth,
    sourceShapeResult,
    matchedShapeAuthority,
    matchedLeafNode,
    childTruth,
    blockingReasons: [],
  };

  const authorityBoundEvidence = {
    authorityBoundChildTruthEvidenceId: "authority-bound-1",
    structuralAuthorityId: matchedShapeAuthority.id,
    nodePath: matchedLeafNode.path,
    childTruthEvidence,
    provenance: {
      exactStructuralAuthorityIdentityClaimed: true,
      exactStructuralNodePathClaimed: true,
      structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity: true,
      childTruthEvidenceObjectPreservedWithoutReconstruction: true,
      childTruthNodePathMatchesBoundNodePath: true,
      authorityNodePairProvenBySourceAdapter: true,
      structuralAuthorityInferredByInterface: false,
      nodePathInferredByInterface: false,
      callerSuppliedAuthorityNodePairAcceptedAsProof: false,
      truthDispositionDuplicatedAtBindingLayer: false,
      truthRecomputedByInterface: false,
    },
  };

  const source = {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,
    status: "ready",
    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,
    authorityBoundInterfaceSpecificationId:
      "runtime_where_authority_bound_child_truth_evidence_interface_a4_6a1c2_v1",
    sourceResult: a1c1Result,
    authorityBoundChildTruth: {
      status: "ready",
      evidence: authorityBoundEvidence,
      blockingReasons: [],
    },
    blockingReasons: [],
    governance: sourceGovernance(),
  } as unknown as SourceResult;

  return {
    source,
    occurrence,
    domain,
    occurrenceMatch,
    pair,
    d2a,
    v2Evidence,
    v2Result,
    leafTruth,
    childTruthEvidence,
    childTruth,
    matchedLeafNode,
    matchedShapeAuthority,
    a1c1Result,
    authorityBoundEvidence,
  };
}

function execute(
  value: ReturnType<typeof fixture>,
) {
  return adaptCanonicalRuntimeManifestBindingWhereTokenPosContextBoundChildTruthV1(
    value.source,
  );
}

function assertReady(
  result: ReturnType<typeof execute>,
) {
  assert(
    result.status ===
      "ready",
    `expected ready, got ${result.status}: ${result.blockingReasons.join(",")}`,
  );

  return result;
}

function assertBlocked(
  result: ReturnType<typeof execute>,
) {
  assert(
    result.status ===
      "blocked",
    "expected blocked result",
  );

  assert(
    result.contextBoundChildTruth.status ===
      "blocked",
    "blocked result must not expose ready context evidence",
  );

  return result;
}

Deno.test("A4.6a1e1.1 exact unique token occurrence produces ready context-bound child truth", () => {
  const f = fixture();

  const result = assertReady(
    execute(
      f,
    ),
  );

  const evidence = result.contextBoundChildTruth.evidence;

  assert(
    evidence.snapshotIdentityId ===
      f.domain.snapshotIdentityId,
    "snapshotIdentityId must project exactly",
  );

  assert(
    evidence.snapshotSentenceOccurrenceIdentityId ===
      f.domain.snapshotSentenceOccurrenceIdentityId,
    "snapshot sentence occurrence identity must project exactly",
  );
});

Deno.test("A4.6a1e1.2 unresolved truth with unique context remains ready", () => {
  const f = fixture(
    "unresolved",
  );

  const result = assertReady(
    execute(
      f,
    ),
  );

  assert(
    result.contextBoundChildTruth.evidence
      .authorityBoundChildTruthEvidence
      .childTruthEvidence
      .truthDisposition ===
      "unresolved",
    "unresolved truth must remain preserved",
  );
});

Deno.test("A4.6a1e1.3 resolved true with unique context remains ready", () => {
  assertReady(
    execute(
      fixture(
        "resolved_true",
      ),
    ),
  );
});

Deno.test("A4.6a1e1.4 resolved false with unique context remains ready", () => {
  assertReady(
    execute(
      fixture(
        "resolved_false",
      ),
    ),
  );
});

Deno.test("A4.6a1e1.5 blocked A4.6a1c2a remains blocked", () => {
  const f = fixture();

  const mutable = f.source as unknown as {
    status: string;
    blockingReasons: string[];
  };

  mutable.status = "blocked";

  mutable.blockingReasons = [
    "upstream_block",
  ];

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.6 no matching site domain blocks context binding", () => {
  const f = fixture();

  f.d2a.applicabilityState = "no_matching_site_domain";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.7 matching domain without token occurrence blocks context binding", () => {
  const f = fixture();

  f.d2a.applicabilityState = "matching_site_domain_no_token_occurrence";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.8 multiple token occurrence applicability blocks context binding", () => {
  const f = fixture();

  f.d2a.applicabilityState = "multiple_site_snapshot_token_occurrence_matches";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.9 unique state with non-one exact count blocks", () => {
  const f = fixture();

  f.d2a.exactSiteSnapshotTokenOccurrenceMatchCount = 2;

  f.v2Evidence.exactSiteSnapshotTokenOccurrenceMatchCount = 2;

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.10 unique state with zero exact matching pairs blocks", () => {
  const f = fixture();

  f.pair.exactSiteSnapshotTokenOccurrenceMatch = false;

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.11 unique state with more than one exact matching pair blocks", () => {
  const f = fixture();

  const secondPair = {
    ...f.pair,
    pairEvidenceId: "pair-2",
    matchingTokenOccurrences: [
      f.occurrenceMatch,
    ],
  };

  f.d2a.pairEvidence.push(
    secondPair,
  );

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.12 unique pair occurrence count inconsistency blocks", () => {
  const f = fixture();

  f.pair.matchingTokenOccurrenceCount = 2;

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.13 pair site identity must remain exact true", () => {
  const f = fixture();

  f.pair.siteIdentityMatches = false;

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.14 pair snapshot identity match must remain exact true", () => {
  const f = fixture();

  f.pair.snapshotIdentityMatches = false;

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.15 pair snapshot differs from actual snapshot blocks", () => {
  const f = fixture();

  f.domain.snapshotIdentityId = "snapshot-other";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.16 D2a domain snapshot mismatch blocks", () => {
  const f = fixture();

  f.d2a.snapshotDomainSnapshotIdentityId = "snapshot-domain-other";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.17 graph document mismatch blocks", () => {
  const f = fixture();

  f.domain.graphDocumentId = "document-other";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.18 pair sentence node mismatch blocks", () => {
  const f = fixture();

  f.pair.sentenceNodeId = "sentence-other";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.19 snapshot sentence occurrence mismatch blocks", () => {
  const f = fixture();

  f.pair.snapshotSentenceOccurrenceIdentityId = "snapshot-sentence-other";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.20 pair domain identity mismatch blocks", () => {
  const f = fixture();

  f.pair.snapshotBoundDomainId = "domain-other";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.21 token node proof mismatch blocks", () => {
  const f = fixture();

  f.occurrenceMatch.tokenNodeId = "token-other";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.22 token occurrence object inconsistency blocks", () => {
  const f = fixture();

  f.occurrenceMatch.occurrence = {
    ...f.occurrence,
    tokenNodeId: "token-other",
  };

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.23 snapshot token occurrence proof mismatch blocks", () => {
  const f = fixture();

  f.occurrenceMatch.snapshotTokenOccurrenceIdentityId = "snapshot-token-other";

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.24 matching pair evidence id list must be exact", () => {
  const f = fixture();

  f.d2a.matchingPairEvidenceIds = [
    "wrong-pair",
  ];

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.25 matching occurrence evidence id list must be exact", () => {
  const f = fixture();

  f.d2a.matchingOccurrenceEvidenceIds = [
    "wrong-occurrence",
  ];

  assertBlocked(
    execute(
      f,
    ),
  );
});

Deno.test("A4.6a1e1.26 exact authority-bound evidence object is preserved by reference", () => {
  const f = fixture();

  const result = assertReady(
    execute(
      f,
    ),
  );

  assert(
    result.contextBoundChildTruth.evidence
      .authorityBoundChildTruthEvidence ===
      f.authorityBoundEvidence,
    "authority-bound evidence must remain exact source object",
  );
});

Deno.test("A4.6a1e1.27 exact A4.6a1c1 child truth evidence object is preserved by reference", () => {
  const f = fixture();

  const result = assertReady(
    execute(
      f,
    ),
  );

  assert(
    result.contextBoundChildTruth.evidence
      .authorityBoundChildTruthEvidence
      .childTruthEvidence ===
      f.childTruthEvidence,
    "child truth evidence must remain exact source object",
  );
});

Deno.test("A4.6a1e1.28 exact D2b1 V2 evidence remains reachable by reference", () => {
  const f = fixture();

  const result = assertReady(
    execute(
      f,
    ),
  );

  assert(
    result.contextBoundChildTruth.evidence
      .authorityBoundChildTruthEvidence
      .childTruthEvidence
      .sourceEvidenceObject ===
      f.v2Evidence,
    "D2b1 V2 evidence must remain exact source object",
  );
});

Deno.test("A4.6a1e1.29 exact D2a evidence remains reachable without reconstruction", () => {
  const f = fixture();

  const result = assertReady(
    execute(
      f,
    ),
  );

  const v2 = result.contextBoundChildTruth.evidence
    .authorityBoundChildTruthEvidence
    .childTruthEvidence
    .sourceEvidenceObject as {
      d2aApplicabilityEvidence?: unknown;
    };

  assert(
    v2.d2aApplicabilityEvidence ===
      f.d2a,
    "D2a evidence must remain exact preserved object",
  );
});

Deno.test("A4.6a1e1.30 structural authority and node path remain exact", () => {
  const f = fixture();

  const result = assertReady(
    execute(
      f,
    ),
  );

  const evidence = result.contextBoundChildTruth.evidence;

  assert(
    evidence.structuralAuthorityId ===
      f.authorityBoundEvidence.structuralAuthorityId,
    "structural authority changed",
  );

  assert(
    evidence.nodePath ===
      f.authorityBoundEvidence.nodePath,
    "node path changed",
  );
});

Deno.test("A4.6a1e1.31 sentenceIndex never becomes Runtime sentence-context identity", () => {
  const f = fixture();

  f.domain.sentenceIndex = 777;

  const result = assertReady(
    execute(
      f,
    ),
  );

  assert(
    !(
      "sentenceIndex" in
        result.contextBoundChildTruth.evidence
    ),
    "sentenceIndex leaked into context evidence",
  );
});

Deno.test("A4.6a1e1.32 token occurrence identities remain proof-only", () => {
  const result = assertReady(
    execute(
      fixture(),
    ),
  );

  const evidence = result.contextBoundChildTruth.evidence as unknown as Record<
    string,
    unknown
  >;

  assert(
    !(
      "tokenNodeId" in
        evidence
    ),
    "tokenNodeId leaked into sentence context",
  );

  assert(
    !(
      "snapshotTokenOccurrenceIdentityId" in
        evidence
    ),
    "snapshot token occurrence leaked into sentence context",
  );
});

Deno.test("A4.6a1e1.33 adapter API arity is exactly one with no caller context proof", () => {
  assert(
    adaptCanonicalRuntimeManifestBindingWhereTokenPosContextBoundChildTruthV1
      .length ===
      1,
    "adapter must accept exact A4.6a1c2a result only",
  );
});

Deno.test("A4.6a1e1.34 context layer does not duplicate or recompute truth", () => {
  const result = assertReady(
    execute(
      fixture(
        "unresolved",
      ),
    ),
  );

  const evidence = result.contextBoundChildTruth.evidence as unknown as Record<
    string,
    unknown
  >;

  assert(
    !(
      "truthDisposition" in
        evidence
    ),
    "context layer duplicated truth disposition",
  );

  assert(
    result.governance.truthDispositionDuplicatedAtContextBindingLayer ===
        false &&
      result.governance.truthRecomputedByAdapter ===
        false,
    "truth ceiling violated",
  );
});

Deno.test("A4.6a1e1.35 adapter ceiling excludes compound context selection cardinality mutation and learner error", () => {
  const result = assertReady(
    execute(
      fixture(),
    ),
  );

  assert(
    result.producer ===
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1 &&
      result.producerVersion ===
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1 &&
      result.specificationId ===
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1 &&
      result.sourceSpecificationId ===
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1 &&
      result.contextBoundInterfaceSpecificationId ===
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
    "exact adapter identity/specification mismatch",
  );

  assert(
    result.governance.compoundTruthComposed ===
        false &&
      result.governance.siblingLeafContextsCompared ===
        false &&
      result.governance.runtimeSentenceContextSelected ===
        false &&
      result.governance.occurrenceFilteringPerformed ===
        false &&
      result.governance.occurrenceWinnerSelected ===
        false &&
      result.governance.finalRuntimeOccurrenceBindingPerformed ===
        false &&
      result.governance.cardinalitySemanticsResolved ===
        false &&
      result.governance.cardinalityEnforcementPerformed ===
        false &&
      result.governance.graphMutationPerformed ===
        false &&
      result.governance.learnerErrorClassified ===
        false &&
      result.governance.frozenGrammarReadOnly ===
        true,
    "semantic ceiling violated",
  );
});
