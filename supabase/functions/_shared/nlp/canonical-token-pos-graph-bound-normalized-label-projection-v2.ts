import type {
  CanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import type {
  CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1,
  CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_VERSION_V1,
  type CanonicalSurfaceGraphProvenanceBindingAuthorityResultV1,
  type CanonicalSurfaceGraphProvenanceBindingAuthorityV1,
  deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1,
} from "./canonical-surface-graph-provenance-binding-authority-v1.ts";

import {
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1,
  type CanonicalGraphSnapshotIdentityAuthorityResultV1,
  type CanonicalGraphSnapshotIdentityAuthorityV1,
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import {
  CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1,
  type CanonicalPosFactOwnershipAuthorityResultV1,
  deriveCanonicalPosFactOwnershipAuthoritiesV1,
} from "./canonical-pos-fact-ownership-authority-v1.ts";

import {
  CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1,
  type CanonicalTokenPosPropertyCapabilityResultV1,
  deriveCanonicalTokenPosPropertyCapabilityV1,
} from "./canonical-token-pos-property-capability-v1.ts";

import {
  CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1,
  type CanonicalTokenPosHypothesisSetReadResultV1,
  readCanonicalTokenPosHypothesisSetV1,
} from "./canonical-token-pos-hypothesis-set-read-v1.ts";

import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
} from "./canonical-token-pos-normalized-label-eq-semantic-capability-v1.ts";

import {
  CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V2,
  CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_VERSION_V2,
  type CanonicalTokenPosHypothesisSetNormalizedLabelProjectionResultV2,
  type CanonicalTokenPosHypothesisSetNormalizedLabelProjectionV2,
  projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2,
} from "./canonical-token-pos-hypothesis-set-normalized-label-projection-v2.ts";

export const CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V2 =
  "canonical_token_pos_graph_bound_normalized_label_projection_v2";

export const CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_VERSION_V2 =
  "2";

export type CanonicalTokenPosGraphBoundNormalizedLabelProjectionV2 = {
  graphBoundProjectionId: string;

  status: "candidate";

  provenanceBindingAuthorityId:
    typeof CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1;

  snapshotAuthorityId: string;

  snapshotIdentityId: string;

  snapshotSha256: string;

  surfaceSnapshotSha256: string;

  graphStateSha256: string;

  graphDocumentId: string;

  graphVersion: "canonical-language-graph-v1";

  surfaceVersion: "canonical-surface-boundary-v1";

  tokenNodeId: string;

  graphTokenOccurrenceIdentityId: string;

  sourceReadId: string;

  normalizedProjectionId: string;

  provenanceBinding: CanonicalSurfaceGraphProvenanceBindingAuthorityV1;

  snapshotAuthority: CanonicalGraphSnapshotIdentityAuthorityV1;

  normalizedProjection:
    CanonicalTokenPosHypothesisSetNormalizedLabelProjectionV2;

  governance: {
    callerSurfaceCapturedBeforeAsyncWork: true;

    callerGraphCapturedBeforeAsyncWork: true;

    capturedSurfaceUsedForSnapshotIdentity: true;

    capturedGraphUsedForSnapshotIdentity: true;

    exactSurfaceGraphProvenanceBindingRequired: true;

    provenanceBindingDerivedFromCapturedSurfaceAndGraph: true;

    provenanceBindingCheckedBeforePosPipeline: true;

    provenanceBindingRecheckedAfterPosPipeline: true;

    provenanceBindingStableAcrossProjection: true;

    sameCapturedSurfaceUsedForBindingAndSnapshotIdentity: true;

    sameCapturedGraphUsedForBindingSnapshotAndPosRead: true;

    surfaceGraphAncestryProven: true;

    capturedGraphUsedForCanonicalPosRead: true;

    canonicalPosOwnershipDerivedFromCapturedGraph: true;

    tokenPosPropertyCapabilityDerivedFromExactOwnership: true;

    exactPosOwnershipAuthorityRequired: true;

    exactTokenPosPropertyCapabilityRequired: true;

    posOwnershipBypassPerformed: false;

    tokenPosPropertyBypassPerformed: false;

    sameCapturedGraphUsedForReadAndSnapshotIdentity: true;

    snapshotIdentityRecheckedAfterReadAndProjection: true;

    snapshotStableAcrossProjection: true;

    exactSnapshotAuthorityRequired: true;

    exactSnapshotIdentityPreserved: true;

    graphDocumentIdPreservedAsProvenance: true;

    graphDocumentIdUsedAsSnapshotIdentity: false;

    structuralTokenNodeIdUsedAsCrossSnapshotIdentityAlone: false;

    snapshotIdentityAndTokenNodeIdFormOccurrenceIdentity: true;

    exactTokenNodeIdRequired: true;

    exactTokenNodeIdPreserved: true;

    exactCanonicalPosReadRequired: true;

    exactP2ProjectionRequired: true;

    sourceReadIdentityPreserved: true;

    normalizedProjectionIdentityPreserved: true;

    normalizedProjectionObjectPreservedWithoutReconstruction: true;

    hypothesisSetStatePreservedByP2: true;

    normalizedMemberIdentityPreservedByP2: true;

    normalizedLabelMultiplicityPreservedByP2: true;

    runtimeConsumed: false;

    manifestConsumed: false;

    runtimeSentenceDomainConsumed: false;

    runtimeBindingConsumed: false;

    runtimeExpectedOperandConsumed: false;

    whereSemanticsResolved: false;

    comparisonPerformed: false;

    comparisonTruthResolved: false;

    occurrenceEnumerationPerformed: false;

    occurrenceFilteringPerformed: false;

    occurrenceBindingPerformed: false;

    cardinalityEnforcementPerformed: false;

    posWinnerSelected: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    candidateOnly: true;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV2 = {
  producer:
    typeof CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V2;

  producerVersion:
    typeof CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_VERSION_V2;

  status:
    | "ready"
    | "blocked";

  graphBoundProjection?: CanonicalTokenPosGraphBoundNormalizedLabelProjectionV2;

  blockingReasons: string[];
};

function blockedResult(
  reasons: readonly string[],
): CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV2 {
  return {
    producer: CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V2,

    producerVersion:
      CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_VERSION_V2,

    status: "blocked",

    blockingReasons: [
      ...reasons,
    ].sort(),
  };
}

function prefixReasons(
  prefix: string,
  reasons: readonly string[],
): string[] {
  if (
    reasons.length ===
      0
  ) {
    return [
      `${prefix}:blocked_without_reason`,
    ];
  }

  return reasons.map(
    (reason) => `${prefix}:${reason}`,
  );
}

function captureCanonicalSnapshot<T>(
  value: T,
): T | undefined {
  try {
    return structuredClone(
      value,
    );
  } catch {
    return undefined;
  }
}

function sameStringArrayV2(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length ===
      right.length &&
    left.every(
      (value, index) =>
        value ===
          right[index],
    )
  );
}

function exactBindingAuthorityResult(
  result: CanonicalSurfaceGraphProvenanceBindingAuthorityResultV1,
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
): result is CanonicalSurfaceGraphProvenanceBindingAuthorityResultV1 & {
  status: "ready";
  authority: CanonicalSurfaceGraphProvenanceBindingAuthorityV1;
} {
  const authority = result.authority;

  if (
    result.producer !==
      CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1 ||
    result.producerVersion !==
      CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_VERSION_V1 ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    !authority
  ) {
    return false;
  }

  const governance = authority.governance;

  const expectedTokenIds = surface.tokens.map(
    (token) => token.id,
  );

  const expectedSentenceIds = surface.sentences.map(
    (sentence) => sentence.id,
  );

  return (
    authority.authorityId ===
      CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1 &&
    authority.status ===
      "resolved" &&
    authority.surfaceVersion ===
      surface.version &&
    authority.graphVersion ===
      graph.version &&
    authority.graphDocumentId ===
      graph.documentId &&
    authority.surfaceTextLengthUtf16 ===
      surface.textLengthUtf16 &&
    sameStringArrayV2(
      authority.surfaceTokenIds,
      expectedTokenIds,
    ) &&
    sameStringArrayV2(
      authority.surfaceSentenceIds,
      expectedSentenceIds,
    ) &&
    authority.sourceAdapterCounts.documentNodes ===
      1 &&
    authority.sourceAdapterCounts.sentenceNodes ===
      surface.sentences.length &&
    authority.sourceAdapterCounts.tokenNodes ===
      surface.tokens.length &&
    governance.expectedBaseGraphRebuiltFromExactSurface ===
      true &&
    governance.canonicalCoreBuilderUsedForExpectedSubstrate ===
      true &&
    governance.exactSurfaceAdapterDocumentPreserved ===
      true &&
    governance.exactSurfaceAdapterSentencesPreserved ===
      true &&
    governance.exactSurfaceAdapterTokensPreserved ===
      true &&
    governance.exactSurfaceAdapterContainmentEdgesPreserved ===
      true &&
    governance.exactSurfaceProvenanceRecordPreserved ===
      true &&
    governance.exactSurfaceAdapterProducerStatePreserved ===
      true &&
    governance.exactSurfaceDerivedObjectShapesPreserved ===
      true &&
    governance.exactSurfaceDerivedArrayOrderInsideObjectsPreserved ===
      true &&
    governance.sourceAdapterObjectCollectionOrderRequired ===
      false &&
    governance.laterNonSurfaceGraphEnrichmentAllowed ===
      true &&
    governance.wholeGraphEqualityWithBaseGraphRequired ===
      false &&
    governance.graphDocumentIdPreservedAsProvenance ===
      true &&
    governance.graphDocumentIdUsedAsSnapshotIdentity ===
      false &&
    governance.snapshotIdentityDerived ===
      false &&
    governance.snapshotAuthorityConsumed ===
      false &&
    governance.posSemanticsConsumed ===
      false &&
    governance.runtimeConsumed ===
      false &&
    governance.manifestConsumed ===
      false &&
    governance.comparisonPerformed ===
      false &&
    governance.comparisonTruthResolved ===
      false &&
    governance.occurrenceBindingPerformed ===
      false &&
    governance.cardinalityEnforcementPerformed ===
      false &&
    governance.graphMutationPerformed ===
      false &&
    governance.learnerErrorClassified ===
      false
  );
}

function sameBindingAuthorityV2(
  left: CanonicalSurfaceGraphProvenanceBindingAuthorityV1,
  right: CanonicalSurfaceGraphProvenanceBindingAuthorityV1,
): boolean {
  return (
    left.authorityId ===
      right.authorityId &&
    left.status ===
      right.status &&
    left.surfaceVersion ===
      right.surfaceVersion &&
    left.graphVersion ===
      right.graphVersion &&
    left.graphDocumentId ===
      right.graphDocumentId &&
    left.surfaceTextLengthUtf16 ===
      right.surfaceTextLengthUtf16 &&
    sameStringArrayV2(
      left.surfaceTokenIds,
      right.surfaceTokenIds,
    ) &&
    sameStringArrayV2(
      left.surfaceSentenceIds,
      right.surfaceSentenceIds,
    ) &&
    sameStringArrayV2(
      left.sourceAdapterNodeIds,
      right.sourceAdapterNodeIds,
    ) &&
    sameStringArrayV2(
      left.sourceAdapterEdgeIds,
      right.sourceAdapterEdgeIds,
    ) &&
    sameStringArrayV2(
      left.sourceAdapterProvenanceIds,
      right.sourceAdapterProvenanceIds,
    ) &&
    left.sourceAdapterCounts.documentNodes ===
      right.sourceAdapterCounts.documentNodes &&
    left.sourceAdapterCounts.sentenceNodes ===
      right.sourceAdapterCounts.sentenceNodes &&
    left.sourceAdapterCounts.tokenNodes ===
      right.sourceAdapterCounts.tokenNodes &&
    left.sourceAdapterCounts.containsEdges ===
      right.sourceAdapterCounts.containsEdges
  );
}

function exactSnapshotAuthorityResult(
  result: CanonicalGraphSnapshotIdentityAuthorityResultV1,
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
): result is CanonicalGraphSnapshotIdentityAuthorityResultV1 & {
  status: "ready";
  authority: CanonicalGraphSnapshotIdentityAuthorityV1;
} {
  const authority = result.authority;

  if (
    result.producer !==
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1 ||
    result.producerVersion !==
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1 ||
    result.status !==
      "ready" ||
    !authority
  ) {
    return false;
  }

  const g = authority.governance;

  return (
    authority.status ===
      "resolved" &&
    /^[0-9a-f]{64}$/.test(
      authority.snapshotSha256,
    ) &&
    authority.snapshotIdentityId ===
      `canonical-graph-snapshot:sha256:${authority.snapshotSha256}` &&
    authority.graphDocumentId ===
      graph.documentId &&
    authority.graphVersion ===
      graph.version &&
    authority.surfaceVersion ===
      surface.version &&
    authority.surfaceTextLengthUtf16 ===
      surface.textLengthUtf16 &&
    g.exactSurfaceSnapshotInputRequired ===
      true &&
    g.exactGraphSnapshotInputRequired ===
      true &&
    g.fullCanonicalSurfaceSnapshotHashed ===
      true &&
    g.rawSurfaceTextParticipatesInIdentity ===
      true &&
    g.fullCanonicalGraphStateHashed ===
      true &&
    g.deterministicCanonicalSerialization ===
      true &&
    g.cryptographicSha256Used ===
      true &&
    g.sameExactInputReproducesIdentity ===
      true &&
    g.graphDocumentIdPreservedAsProvenance ===
      true &&
    g.graphDocumentIdReinterpretedAsSnapshotIdentity ===
      false &&
    g.structuralNodeIdsUsedAsSnapshotIdentity ===
      false &&
    g.structuralEdgeIdsUsedAsSnapshotIdentity ===
      false &&
    g.textLengthUsedAsSnapshotIdentity ===
      false &&
    g.randomIdentityUsed ===
      false &&
    g.wallClockUsed ===
      false &&
    g.runtimeConsumed ===
      false &&
    g.manifestConsumed ===
      false &&
    g.posSemanticsConsumed ===
      false &&
    g.whereSemanticsConsumed ===
      false &&
    g.comparisonPerformed ===
      false &&
    g.comparisonTruthResolved ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.cardinalityEnforcementPerformed ===
      false &&
    g.graphMutationPerformed ===
      false
  );
}

function exactOwnershipResult(
  result: CanonicalPosFactOwnershipAuthorityResultV1,
): boolean {
  return (
    result.producer ===
      CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1 &&
    result.producerVersion ===
      "1" &&
    result.status ===
      "ready"
  );
}

function exactPropertyCapabilityResult(
  result: CanonicalTokenPosPropertyCapabilityResultV1,
): boolean {
  return (
    result.producer ===
      CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1 &&
    result.producerVersion ===
      "1" &&
    result.status ===
      "ready"
  );
}

function exactReadResult(
  result: CanonicalTokenPosHypothesisSetReadResultV1,
  tokenNodeId: string,
): boolean {
  return (
    result.producer ===
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_READ_V1 &&
    result.producerVersion ===
      "1" &&
    result.status ===
      "ready" &&
    result.read !==
      undefined &&
    result.read.tokenNodeId ===
      tokenNodeId
  );
}

function exactP2Result(
  result: CanonicalTokenPosHypothesisSetNormalizedLabelProjectionResultV2,
  tokenNodeId: string,
): result is CanonicalTokenPosHypothesisSetNormalizedLabelProjectionResultV2 & {
  status: "ready";
  projection: CanonicalTokenPosHypothesisSetNormalizedLabelProjectionV2;
} {
  return (
    result.producer ===
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_V2 &&
    result.producerVersion ===
      CANONICAL_TOKEN_POS_HYPOTHESIS_SET_NORMALIZED_LABEL_PROJECTION_VERSION_V2 &&
    result.status ===
      "ready" &&
    result.projection !==
      undefined &&
    result.projection.tokenNodeId ===
      tokenNodeId
  );
}

function graphTokenOccurrenceIdentityIdV2(
  snapshotSha256: string,
  tokenNodeId: string,
): string {
  return [
    "canonical-graph-token-occurrence",
    "sha256",
    snapshotSha256,
    String(
      tokenNodeId.length,
    ),
    tokenNodeId,
  ].join(
    ":",
  );
}

export async function deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2(
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
  tokenNodeId: string,
): Promise<CanonicalTokenPosGraphBoundNormalizedLabelProjectionResultV2> {
  if (
    typeof tokenNodeId !==
      "string" ||
    tokenNodeId.length ===
      0
  ) {
    return blockedResult([
      "token_node_id:missing",
    ]);
  }

  const capturedSurface = captureCanonicalSnapshot(
    surface,
  );

  if (
    !capturedSurface
  ) {
    return blockedResult([
      "snapshot_capture:surface_clone_failed",
    ]);
  }

  const capturedGraph = captureCanonicalSnapshot(
    graph,
  );

  if (
    !capturedGraph
  ) {
    return blockedResult([
      "snapshot_capture:graph_clone_failed",
    ]);
  }

  const bindingBefore = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
    capturedSurface,
    capturedGraph,
  );

  if (
    !exactBindingAuthorityResult(
      bindingBefore,
      capturedSurface,
      capturedGraph,
    )
  ) {
    return blockedResult(
      bindingBefore.status ===
          "blocked"
        ? prefixReasons(
          "surface_graph_provenance_binding_before",
          bindingBefore.blockingReasons,
        )
        : [
          "surface_graph_provenance_binding_before:non_exact_authority_result",
        ],
    );
  }

  const provenanceBinding = bindingBefore.authority;

  const snapshotBefore = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    capturedSurface,
    capturedGraph,
  );

  if (
    !exactSnapshotAuthorityResult(
      snapshotBefore,
      capturedSurface,
      capturedGraph,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "snapshot_before",
        snapshotBefore.blockingReasons,
      ),
    );
  }

  const ownershipResult = deriveCanonicalPosFactOwnershipAuthoritiesV1(
    capturedGraph,
  );

  if (
    !exactOwnershipResult(
      ownershipResult,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "pos_ownership",
        ownershipResult.blockingReasons,
      ),
    );
  }

  const propertyCapabilityResult = deriveCanonicalTokenPosPropertyCapabilityV1(
    ownershipResult,
  );

  if (
    !exactPropertyCapabilityResult(
      propertyCapabilityResult,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "token_pos_property",
        propertyCapabilityResult.blockingReasons,
      ),
    );
  }

  const readResult = readCanonicalTokenPosHypothesisSetV1(
    capturedGraph,
    tokenNodeId,
    ownershipResult,
    propertyCapabilityResult,
  );

  if (
    !exactReadResult(
      readResult,
      tokenNodeId,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "canonical_pos_read",
        readResult.blockingReasons,
      ),
    );
  }

  const p2Result = projectCanonicalTokenPosHypothesisSetNormalizedLabelsV2(
    readResult,
    CANONICAL_TOKEN_POS_NORMALIZED_LABEL_EQ_SEMANTIC_CAPABILITY_RESULT_V1,
  );

  if (
    !exactP2Result(
      p2Result,
      tokenNodeId,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "normalized_projection",
        p2Result.blockingReasons,
      ),
    );
  }

  const bindingAfter = deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
    capturedSurface,
    capturedGraph,
  );

  if (
    !exactBindingAuthorityResult(
      bindingAfter,
      capturedSurface,
      capturedGraph,
    )
  ) {
    return blockedResult(
      bindingAfter.status ===
          "blocked"
        ? prefixReasons(
          "surface_graph_provenance_binding_after",
          bindingAfter.blockingReasons,
        )
        : [
          "surface_graph_provenance_binding_after:non_exact_authority_result",
        ],
    );
  }

  const provenanceBindingAfter = bindingAfter.authority;

  if (
    !sameBindingAuthorityV2(
      provenanceBinding,
      provenanceBindingAfter,
    )
  ) {
    return blockedResult([
      "surface_graph_provenance_binding:changed_during_projection",
    ]);
  }

  const snapshotAfter = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    capturedSurface,
    capturedGraph,
  );

  if (
    !exactSnapshotAuthorityResult(
      snapshotAfter,
      capturedSurface,
      capturedGraph,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "snapshot_after",
        snapshotAfter.blockingReasons,
      ),
    );
  }

  if (
    snapshotBefore.authority
      .snapshotIdentityId !==
      snapshotAfter.authority
        .snapshotIdentityId
  ) {
    return blockedResult([
      "snapshot_identity:changed_during_projection",
    ]);
  }

  if (
    snapshotBefore.authority
      .graphStateSha256 !==
      snapshotAfter.authority
        .graphStateSha256
  ) {
    return blockedResult([
      "graph_state:changed_during_projection",
    ]);
  }

  const projection = p2Result.projection;

  if (
    projection.sourceReadId !==
      readResult.read!.readId
  ) {
    return blockedResult([
      "normalized_projection:source_read_identity_mismatch",
    ]);
  }

  const snapshot = snapshotAfter.authority;

  const graphTokenOccurrenceIdentityId = graphTokenOccurrenceIdentityIdV2(
    snapshot.snapshotSha256,
    tokenNodeId,
  );

  return {
    producer: CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V2,

    producerVersion:
      CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_VERSION_V2,

    status: "ready",

    graphBoundProjection: {
      graphBoundProjectionId: [
        CANONICAL_TOKEN_POS_GRAPH_BOUND_NORMALIZED_LABEL_PROJECTION_V2,
        snapshot.snapshotSha256,
        String(
          tokenNodeId.length,
        ),
        tokenNodeId,
        projection.projectionId,
      ].join(
        ":",
      ),

      status: "candidate",

      provenanceBindingAuthorityId:
        CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1,

      snapshotAuthorityId: snapshot.authorityId,

      snapshotIdentityId: snapshot.snapshotIdentityId,

      snapshotSha256: snapshot.snapshotSha256,

      surfaceSnapshotSha256: snapshot.surfaceSnapshotSha256,

      graphStateSha256: snapshot.graphStateSha256,

      graphDocumentId: snapshot.graphDocumentId,

      graphVersion: snapshot.graphVersion,

      surfaceVersion: snapshot.surfaceVersion,

      tokenNodeId,

      graphTokenOccurrenceIdentityId,

      sourceReadId: projection.sourceReadId,

      normalizedProjectionId: projection.projectionId,

      provenanceBinding,

      snapshotAuthority: snapshot,

      normalizedProjection: projection,

      governance: {
        callerSurfaceCapturedBeforeAsyncWork: true,

        callerGraphCapturedBeforeAsyncWork: true,

        capturedSurfaceUsedForSnapshotIdentity: true,

        capturedGraphUsedForSnapshotIdentity: true,

        exactSurfaceGraphProvenanceBindingRequired: true,

        provenanceBindingDerivedFromCapturedSurfaceAndGraph: true,

        provenanceBindingCheckedBeforePosPipeline: true,

        provenanceBindingRecheckedAfterPosPipeline: true,

        provenanceBindingStableAcrossProjection: true,

        sameCapturedSurfaceUsedForBindingAndSnapshotIdentity: true,

        sameCapturedGraphUsedForBindingSnapshotAndPosRead: true,

        surfaceGraphAncestryProven: true,

        capturedGraphUsedForCanonicalPosRead: true,

        canonicalPosOwnershipDerivedFromCapturedGraph: true,

        tokenPosPropertyCapabilityDerivedFromExactOwnership: true,

        exactPosOwnershipAuthorityRequired: true,

        exactTokenPosPropertyCapabilityRequired: true,

        posOwnershipBypassPerformed: false,

        tokenPosPropertyBypassPerformed: false,

        sameCapturedGraphUsedForReadAndSnapshotIdentity: true,

        snapshotIdentityRecheckedAfterReadAndProjection: true,

        snapshotStableAcrossProjection: true,

        exactSnapshotAuthorityRequired: true,

        exactSnapshotIdentityPreserved: true,

        graphDocumentIdPreservedAsProvenance: true,

        graphDocumentIdUsedAsSnapshotIdentity: false,

        structuralTokenNodeIdUsedAsCrossSnapshotIdentityAlone: false,

        snapshotIdentityAndTokenNodeIdFormOccurrenceIdentity: true,

        exactTokenNodeIdRequired: true,

        exactTokenNodeIdPreserved: true,

        exactCanonicalPosReadRequired: true,

        exactP2ProjectionRequired: true,

        sourceReadIdentityPreserved: true,

        normalizedProjectionIdentityPreserved: true,

        normalizedProjectionObjectPreservedWithoutReconstruction: true,

        hypothesisSetStatePreservedByP2: true,

        normalizedMemberIdentityPreservedByP2: true,

        normalizedLabelMultiplicityPreservedByP2: true,

        runtimeConsumed: false,

        manifestConsumed: false,

        runtimeSentenceDomainConsumed: false,

        runtimeBindingConsumed: false,

        runtimeExpectedOperandConsumed: false,

        whereSemanticsResolved: false,

        comparisonPerformed: false,

        comparisonTruthResolved: false,

        occurrenceEnumerationPerformed: false,

        occurrenceFilteringPerformed: false,

        occurrenceBindingPerformed: false,

        cardinalityEnforcementPerformed: false,

        posWinnerSelected: false,

        graphMutationPerformed: false,

        learnerErrorClassified: false,

        candidateOnly: true,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
