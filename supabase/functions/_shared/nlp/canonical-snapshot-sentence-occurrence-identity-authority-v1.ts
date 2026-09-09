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
  CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,
  type CanonicalSentenceOccurrenceIdentityAuthorityResultV1,
  type CanonicalSentenceOccurrenceIdentityAuthorityV1,
  deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1,
} from "./canonical-sentence-occurrence-identity-authority-v1.ts";

export const CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1 =
  "canonical-snapshot-sentence-occurrence-identity-authority-v1" as const;

export const CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_VERSION_V1 =
  "1" as const;

export type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1 = {
  authorityId: string;

  status: "proven";

  snapshotSentenceOccurrenceIdentityId: string;

  snapshotAuthorityId: string;

  snapshotIdentityId: string;

  snapshotSha256: string;

  surfaceSnapshotSha256: string;

  graphStateSha256: string;

  graphDocumentId: string;

  sentenceNodeId: string;

  sentenceIndex: number;

  sourceSentenceOccurrenceIdentityAuthority:
    CanonicalSentenceOccurrenceIdentityAuthorityV1;

  governance: {
    exactCapturedSurfaceRequired: true;

    exactCapturedGraphRequired: true;

    exactSurfaceGraphProvenanceBindingRequired: true;

    exactSourceSnapshotIdentityResultRequired: true;

    suppliedSnapshotAuthorityRederivedFromCapturedSurfaceAndGraph: true;

    suppliedSnapshotAuthorityMatchesRederivedSnapshotAuthorityExactly: true;

    sentenceOccurrencesDerivedFromExactCapturedGraph: true;

    sourceSentenceOccurrenceIdentityAuthorityObjectPreservedWithoutReconstruction:
      true;

    snapshotIdentityAndSentenceNodeIdFormOccurrenceIdentity: true;

    sentenceNodeIdPreservedAsGraphLocalOccurrenceIdentity: true;

    sentenceIndexIsOccurrenceIdentity: false;

    sentenceIndexIsLocalityMetadataOnly: true;

    graphDocumentIdPreservedAsProvenance: true;

    graphDocumentIdUsedAsSnapshotIdentity: false;

    runtimeManifestConsumed: false;

    whereTruthComposed: false;

    tokenPosConsumed: false;

    currentRuntimeSentenceContextSelected: false;

    contextCandidateSelected: false;

    occurrenceWinnerSelected: false;

    finalRuntimeOccurrenceBindingPerformed: false;

    cardinalitySemanticsResolved: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;
  };
};

export type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityReadyResultV1 =
  {
    producer:
      typeof CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1;

    producerVersion:
      typeof CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_VERSION_V1;

    status: "ready";

    capturedSurface: CanonicalSurfaceDocumentV1;

    capturedGraph: CanonicalLanguageGraphV1;

    provenanceBindingResult:
      CanonicalSurfaceGraphProvenanceBindingAuthorityResultV1;

    provenanceBinding: CanonicalSurfaceGraphProvenanceBindingAuthorityV1;

    sourceSnapshotIdentityResult:
      CanonicalGraphSnapshotIdentityAuthorityResultV1;

    sourceSnapshotIdentityAuthority: CanonicalGraphSnapshotIdentityAuthorityV1;

    rederivedSnapshotIdentityResult:
      CanonicalGraphSnapshotIdentityAuthorityResultV1;

    rederivedSnapshotIdentityAuthority:
      CanonicalGraphSnapshotIdentityAuthorityV1;

    sourceSentenceOccurrenceIdentityResult:
      CanonicalSentenceOccurrenceIdentityAuthorityResultV1;

    authorities: CanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1[];

    authorityCount: number;

    blockingReasons: [];

    governance: {
      exactThreeInputPublicApi: true;

      callerSentenceResultAccepted: false;

      callerSentenceNodeIdAccepted: false;

      callerSentenceIndexAccepted: false;

      callerSnapshotSentenceOccurrenceIdentityAccepted: false;

      exactCapturedSurfaceRequired: true;

      exactCapturedGraphRequired: true;

      capturedInputsUsedForAllInternalDerivations: true;

      exactSurfaceGraphProvenanceBindingRequired: true;

      exactSourceSnapshotIdentityResultRequired: true;

      sourceSnapshotIdentityResultObjectPreservedByReference: true;

      sourceSnapshotIdentityAuthorityObjectPreservedByReference: true;

      snapshotAuthorityRederivedThroughClosedSnapshotAuthority: true;

      privateSnapshotHashSemanticsDuplicated: false;

      suppliedAndRederivedSnapshotAuthoritiesMustMatchExactly: true;

      sentenceOccurrenceIdentityResultDerivedInternally: true;

      sentenceOccurrenceIdentityResultDerivedFromSameCapturedGraph: true;

      sentenceOccurrenceIdentityResultObjectPreservedWithoutReconstruction:
        true;

      sourceSentenceOccurrenceAuthorityObjectsPreservedWithoutReconstruction:
        true;

      everySentenceOccurrencePreserved: true;

      occurrenceOrderPreserved: true;

      snapshotIdentityAndSentenceNodeIdFormOccurrenceIdentity: true;

      sentenceIndexIsOccurrenceIdentity: false;

      sentenceIndexIsLocalityMetadataOnly: true;

      graphDocumentIdPreservedAsProvenance: true;

      graphDocumentIdUsedAsSnapshotIdentity: false;

      runtimeManifestConsumed: false;

      whereTruthComposed: false;

      tokenPosConsumed: false;

      currentRuntimeSentenceContextSelected: false;

      contextCandidateSelected: false;

      occurrenceWinnerSelected: false;

      finalRuntimeOccurrenceBindingPerformed: false;

      cardinalitySemanticsResolved: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;
    };
  };

export type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1;

    producerVersion:
      typeof CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_VERSION_V1;

    status: "blocked";

    authorities: [];

    authorityCount: 0;

    blockingReasons: string[];
  };

export type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityResultV1 =
  | CanonicalSnapshotSentenceOccurrenceIdentityAuthorityReadyResultV1
  | CanonicalSnapshotSentenceOccurrenceIdentityAuthorityBlockedResultV1;

function blockedResult(
  reasons: readonly string[],
): CanonicalSnapshotSentenceOccurrenceIdentityAuthorityBlockedResultV1 {
  const normalizedReasons = reasons.length > 0
    ? [...reasons]
    : ["generic_snapshot_sentence_occurrence:blocked_without_reason"];

  return {
    producer: CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,

    producerVersion:
      CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_VERSION_V1,

    status: "blocked",

    authorities: [],

    authorityCount: 0,

    blockingReasons: normalizedReasons,
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
      `${prefix}:non_exact_result`,
    ];
  }

  return reasons.map(
    (reason) => `${prefix}:${reason}`,
  );
}

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

function captureCanonicalSnapshot<T>(
  value: T,
): T | null {
  try {
    return structuredClone(
      value,
    );
  } catch {
    return null;
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

/**
 * Exact structural equality only.
 *
 * This function does NOT derive snapshot identity, hash graph state,
 * canonicalize graph state, or duplicate snapshot semantics.
 *
 * Snapshot truth remains exclusively owned by
 * CanonicalGraphSnapshotIdentityAuthorityV1. This helper only checks that
 * a caller-supplied authority object is structurally identical to the
 * authority re-derived by that closed upstream producer.
 */
function exactStructuralEqual(
  left: unknown,
  right: unknown,
): boolean {
  if (
    Object.is(
      left,
      right,
    )
  ) {
    return true;
  }

  if (
    Array.isArray(
      left,
    ) ||
    Array.isArray(
      right,
    )
  ) {
    if (
      !Array.isArray(
        left,
      ) ||
      !Array.isArray(
        right,
      ) ||
      left.length !==
        right.length
    ) {
      return false;
    }

    for (
      let index = 0;
      index <
        left.length;
      index++
    ) {
      if (
        !exactStructuralEqual(
          left[index],
          right[index],
        )
      ) {
        return false;
      }
    }

    return true;
  }

  if (
    isRecord(
      left,
    ) &&
    isRecord(
      right,
    )
  ) {
    const leftKeys = Object.keys(
      left,
    ).sort();

    const rightKeys = Object.keys(
      right,
    ).sort();

    if (
      leftKeys.length !==
        rightKeys.length
    ) {
      return false;
    }

    for (
      let index = 0;
      index <
        leftKeys.length;
      index++
    ) {
      if (
        leftKeys[index] !==
          rightKeys[index]
      ) {
        return false;
      }

      const key = leftKeys[index];

      if (
        !exactStructuralEqual(
          left[key],
          right[key],
        )
      ) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function readyProvenanceBindingResult(
  result: CanonicalSurfaceGraphProvenanceBindingAuthorityResultV1,
): result is CanonicalSurfaceGraphProvenanceBindingAuthorityResultV1 & {
  status: "ready";
  authority: CanonicalSurfaceGraphProvenanceBindingAuthorityV1;
} {
  return (
    result.producer ===
      CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_V1 &&
    result.producerVersion ===
      CANONICAL_SURFACE_GRAPH_PROVENANCE_BINDING_AUTHORITY_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.authority !==
      undefined &&
    result.blockingReasons.length ===
      0
  );
}

function readySnapshotResult(
  result: CanonicalGraphSnapshotIdentityAuthorityResultV1,
): result is CanonicalGraphSnapshotIdentityAuthorityResultV1 & {
  status: "ready";
  authority: CanonicalGraphSnapshotIdentityAuthorityV1;
} {
  return (
    result.producer ===
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1 &&
    result.producerVersion ===
      CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.authority !==
      undefined &&
    result.authority.status ===
      "resolved" &&
    result.blockingReasons.length ===
      0
  );
}

function readySentenceOccurrenceResult(
  result: CanonicalSentenceOccurrenceIdentityAuthorityResultV1,
): boolean {
  if (
    result.producer !==
      CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1 ||
    result.producerVersion !==
      "1" ||
    result.status !==
      "ready" ||
    result.blockingReasons.length !==
      0 ||
    !Array.isArray(
      result.authorities,
    )
  ) {
    return false;
  }

  for (
    const authority of result.authorities
  ) {
    if (
      authority.status !==
        "proven" ||
      authority.boundaryLabel !==
        "sentence" ||
      authority.source !==
        CANONICAL_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1 ||
      !present(
        authority.authorityId,
      ) ||
      !present(
        authority.sentenceNodeId,
      ) ||
      !Number.isInteger(
        authority.sentenceIndex,
      ) ||
      authority.sentenceIndex <
        0 ||
      authority.governance
          .identityModel !==
        "sentence_node_id" ||
      authority.governance
          .sentenceNodeIdIsOccurrenceIdentity !==
        true ||
      authority.governance
          .sentenceIndexIsOccurrenceIdentity !==
        false ||
      authority.governance
          .sentenceIndexIsLocalityMetadataOnly !==
        true
    ) {
      return false;
    }
  }

  return true;
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

/**
 * Frozen historical snapshot-bound sentence occurrence identity encoding.
 *
 * Identity inputs are EXACTLY:
 *   snapshotIdentityId + sentenceNodeId
 *
 * sentenceIndex is deliberately excluded.
 */
function snapshotSentenceOccurrenceIdentityId(
  snapshotIdentityId: string,
  sentenceNodeId: string,
): string {
  return [
    "canonical-snapshot-sentence-occurrence-v1",
    idPart(
      snapshotIdentityId,
    ),
    idPart(
      sentenceNodeId,
    ),
  ].join(
    ":",
  );
}

function snapshotSentenceAuthorityId(
  snapshotIdentityId: string,
  sentenceNodeId: string,
): string {
  return [
    CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,
    idPart(
      snapshotIdentityId,
    ),
    idPart(
      sentenceNodeId,
    ),
  ].join(
    ":",
  );
}

/**
 * Generic Canonical Language Graph foundation.
 *
 * Semantic ceiling:
 * - proves exact snapshot-bound sentence occurrence identity;
 * - consumes no Runtime manifest;
 * - consumes no binding WHERE;
 * - consumes no token.pos;
 * - selects no CURRENT sentence;
 * - selects no context candidate;
 * - selects no occurrence winner;
 * - performs no final Runtime binding;
 * - resolves/enforces no cardinality;
 * - mutates no graph;
 * - classifies no learner error.
 */
export async function deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
  sourceSnapshotIdentityResult: CanonicalGraphSnapshotIdentityAuthorityResultV1,
): Promise<
  CanonicalSnapshotSentenceOccurrenceIdentityAuthorityResultV1
> {
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

  const provenanceBindingResult =
    deriveCanonicalSurfaceGraphProvenanceBindingAuthorityV1(
      capturedSurface,
      capturedGraph,
    );

  if (
    !readyProvenanceBindingResult(
      provenanceBindingResult,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "surface_graph_provenance_binding",
        provenanceBindingResult
          .blockingReasons,
      ),
    );
  }

  if (
    !readySnapshotResult(
      sourceSnapshotIdentityResult,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "source_snapshot_identity",
        sourceSnapshotIdentityResult
          .blockingReasons,
      ),
    );
  }

  const sourceSnapshotIdentityAuthority = sourceSnapshotIdentityResult
    .authority;

  const rederivedSnapshotIdentityResult =
    await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      capturedSurface,
      capturedGraph,
    );

  if (
    !readySnapshotResult(
      rederivedSnapshotIdentityResult,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "rederived_snapshot_identity",
        rederivedSnapshotIdentityResult
          .blockingReasons,
      ),
    );
  }

  const rederivedSnapshotIdentityAuthority = rederivedSnapshotIdentityResult
    .authority;

  if (
    capturedGraph.documentId !==
      sourceSnapshotIdentityAuthority
        .graphDocumentId
  ) {
    return blockedResult([
      "source_snapshot_identity:graph_document_provenance_mismatch",
    ]);
  }

  if (
    !exactStructuralEqual(
      sourceSnapshotIdentityAuthority,
      rederivedSnapshotIdentityAuthority,
    )
  ) {
    return blockedResult([
      "source_snapshot_identity:not_exact_rederived_snapshot_authority",
    ]);
  }

  const sourceSentenceOccurrenceIdentityResult =
    deriveCanonicalSentenceOccurrenceIdentityAuthoritiesV1(
      capturedGraph,
    );

  if (
    !readySentenceOccurrenceResult(
      sourceSentenceOccurrenceIdentityResult,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "sentence_occurrence_identity",
        sourceSentenceOccurrenceIdentityResult
          .blockingReasons,
      ),
    );
  }

  const sentenceNodeIds = new Set<string>();

  const occurrenceIds = new Set<string>();

  const authorityIds = new Set<string>();

  const authorities: CanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1[] =
    [];

  for (
    const sourceSentenceAuthority of sourceSentenceOccurrenceIdentityResult
      .authorities
  ) {
    if (
      sentenceNodeIds.has(
        sourceSentenceAuthority
          .sentenceNodeId,
      )
    ) {
      return blockedResult([
        `sentence_occurrence_identity:duplicate_sentence_node_id:${sourceSentenceAuthority.sentenceNodeId}`,
      ]);
    }

    sentenceNodeIds.add(
      sourceSentenceAuthority
        .sentenceNodeId,
    );

    const occurrenceIdentityId = snapshotSentenceOccurrenceIdentityId(
      sourceSnapshotIdentityAuthority
        .snapshotIdentityId,
      sourceSentenceAuthority
        .sentenceNodeId,
    );

    if (
      occurrenceIds.has(
        occurrenceIdentityId,
      )
    ) {
      return blockedResult([
        `snapshot_sentence_occurrence_identity:duplicate_identity:${occurrenceIdentityId}`,
      ]);
    }

    occurrenceIds.add(
      occurrenceIdentityId,
    );

    const authorityId = snapshotSentenceAuthorityId(
      sourceSnapshotIdentityAuthority
        .snapshotIdentityId,
      sourceSentenceAuthority
        .sentenceNodeId,
    );

    if (
      authorityIds.has(
        authorityId,
      )
    ) {
      return blockedResult([
        `snapshot_sentence_occurrence_authority:duplicate_authority_id:${authorityId}`,
      ]);
    }

    authorityIds.add(
      authorityId,
    );

    authorities.push({
      authorityId,

      status: "proven",

      snapshotSentenceOccurrenceIdentityId: occurrenceIdentityId,

      snapshotAuthorityId: sourceSnapshotIdentityAuthority
        .authorityId,

      snapshotIdentityId: sourceSnapshotIdentityAuthority
        .snapshotIdentityId,

      snapshotSha256: sourceSnapshotIdentityAuthority
        .snapshotSha256,

      surfaceSnapshotSha256: sourceSnapshotIdentityAuthority
        .surfaceSnapshotSha256,

      graphStateSha256: sourceSnapshotIdentityAuthority
        .graphStateSha256,

      graphDocumentId: capturedGraph.documentId,

      sentenceNodeId: sourceSentenceAuthority
        .sentenceNodeId,

      sentenceIndex: sourceSentenceAuthority
        .sentenceIndex,

      sourceSentenceOccurrenceIdentityAuthority: sourceSentenceAuthority,

      governance: {
        exactCapturedSurfaceRequired: true,

        exactCapturedGraphRequired: true,

        exactSurfaceGraphProvenanceBindingRequired: true,

        exactSourceSnapshotIdentityResultRequired: true,

        suppliedSnapshotAuthorityRederivedFromCapturedSurfaceAndGraph: true,

        suppliedSnapshotAuthorityMatchesRederivedSnapshotAuthorityExactly: true,

        sentenceOccurrencesDerivedFromExactCapturedGraph: true,

        sourceSentenceOccurrenceIdentityAuthorityObjectPreservedWithoutReconstruction:
          true,

        snapshotIdentityAndSentenceNodeIdFormOccurrenceIdentity: true,

        sentenceNodeIdPreservedAsGraphLocalOccurrenceIdentity: true,

        sentenceIndexIsOccurrenceIdentity: false,

        sentenceIndexIsLocalityMetadataOnly: true,

        graphDocumentIdPreservedAsProvenance: true,

        graphDocumentIdUsedAsSnapshotIdentity: false,

        runtimeManifestConsumed: false,

        whereTruthComposed: false,

        tokenPosConsumed: false,

        currentRuntimeSentenceContextSelected: false,

        contextCandidateSelected: false,

        occurrenceWinnerSelected: false,

        finalRuntimeOccurrenceBindingPerformed: false,

        cardinalitySemanticsResolved: false,

        graphMutationPerformed: false,

        learnerErrorClassified: false,
      },
    });
  }

  return {
    producer: CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,

    producerVersion:
      CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_VERSION_V1,

    status: "ready",

    capturedSurface,

    capturedGraph,

    provenanceBindingResult,

    provenanceBinding: provenanceBindingResult
      .authority,

    sourceSnapshotIdentityResult,

    sourceSnapshotIdentityAuthority,

    rederivedSnapshotIdentityResult,

    rederivedSnapshotIdentityAuthority,

    sourceSentenceOccurrenceIdentityResult,

    authorities,

    authorityCount: authorities.length,

    blockingReasons: [],

    governance: {
      exactThreeInputPublicApi: true,

      callerSentenceResultAccepted: false,

      callerSentenceNodeIdAccepted: false,

      callerSentenceIndexAccepted: false,

      callerSnapshotSentenceOccurrenceIdentityAccepted: false,

      exactCapturedSurfaceRequired: true,

      exactCapturedGraphRequired: true,

      capturedInputsUsedForAllInternalDerivations: true,

      exactSurfaceGraphProvenanceBindingRequired: true,

      exactSourceSnapshotIdentityResultRequired: true,

      sourceSnapshotIdentityResultObjectPreservedByReference: true,

      sourceSnapshotIdentityAuthorityObjectPreservedByReference: true,

      snapshotAuthorityRederivedThroughClosedSnapshotAuthority: true,

      privateSnapshotHashSemanticsDuplicated: false,

      suppliedAndRederivedSnapshotAuthoritiesMustMatchExactly: true,

      sentenceOccurrenceIdentityResultDerivedInternally: true,

      sentenceOccurrenceIdentityResultDerivedFromSameCapturedGraph: true,

      sentenceOccurrenceIdentityResultObjectPreservedWithoutReconstruction:
        true,

      sourceSentenceOccurrenceAuthorityObjectsPreservedWithoutReconstruction:
        true,

      everySentenceOccurrencePreserved: true,

      occurrenceOrderPreserved: true,

      snapshotIdentityAndSentenceNodeIdFormOccurrenceIdentity: true,

      sentenceIndexIsOccurrenceIdentity: false,

      sentenceIndexIsLocalityMetadataOnly: true,

      graphDocumentIdPreservedAsProvenance: true,

      graphDocumentIdUsedAsSnapshotIdentity: false,

      runtimeManifestConsumed: false,

      whereTruthComposed: false,

      tokenPosConsumed: false,

      currentRuntimeSentenceContextSelected: false,

      contextCandidateSelected: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      cardinalitySemanticsResolved: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,
    },
  };
}
