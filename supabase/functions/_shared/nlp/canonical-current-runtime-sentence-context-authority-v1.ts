import type {
  CanonicalLanguageGraphV1,
} from "./canonical-language-graph-core-v1.ts";

import type {
  CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_V1,
  CANONICAL_GRAPH_SNAPSHOT_IDENTITY_AUTHORITY_VERSION_V1,
  type CanonicalGraphSnapshotIdentityAuthorityResultV1,
  type CanonicalGraphSnapshotIdentityAuthorityV1,
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import {
  CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1,
  CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_VERSION_V1,
  type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityReadyResultV1,
  type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityResultV1,
  type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1,
  deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1,
} from "./canonical-snapshot-sentence-occurrence-identity-authority-v1.ts";

import {
  CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_V1,
  CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_VERSION_V1,
  type CanonicalRuntimeExecutionContextInputReadyResultV1,
  type CanonicalRuntimeExecutionContextInputResultV1,
  deriveCanonicalRuntimeExecutionContextInputV1,
} from "./canonical-runtime-execution-context-input-v1.ts";

// Norsk Trainer — Canonical CURRENT Runtime Sentence Context Authority V1
//
// Semantic responsibility
// -----------------------
// This is the first layer allowed to prove that one exact snapshot-bound
// sentence occurrence is CURRENT for one Runtime execution invocation.
//
// CURRENT is NOT inferred from linguistic candidates.
//
// The invocation declares an exact target context. That declaration remains
// a claim, never proof.
//
// Proof is obtained only by:
// 1. validating the explicit execution-context declaration;
// 2. capturing exact surface + graph once;
// 3. independently deriving exact graph snapshot identity;
// 4. independently deriving all snapshot-bound sentence occurrences through
//    the already closed snapshot-sentence authority;
// 5. requiring the declared snapshot identity to equal the independently
//    derived snapshot identity;
// 6. requiring the declared snapshot-sentence occurrence identity to match
//    exactly one independently proven occurrence.
//
// Explicitly forbidden:
// - sentenceIndex as selector;
// - first sentence;
// - singleton sentence / singleton candidate inference;
// - graphDocumentId as selector;
// - sentenceNodeId as caller selector;
// - token / lexical / POS / phrase / predicate candidate selection;
// - A4.6a1f rootCandidates;
// - site applicability;
// - binding truth;
// - occurrence winner semantics;
// - cardinality;
// - WHERE truth;
// - rule execution;
// - learner error classification.

export const CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1 =
  "canonical_current_runtime_sentence_context_authority_v1" as const;

export const CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1 =
  "1" as const;

export type CanonicalCurrentRuntimeSentenceContextAuthorityV1 = {
  authorityId: string;

  status: "proven_current";

  executionInvocationId: string;

  snapshotIdentityId: string;

  snapshotSentenceOccurrenceIdentityId: string;

  snapshotAuthorityId: string;

  snapshotSentenceOccurrenceAuthorityId: string;

  graphDocumentId: string;

  sentenceNodeId: string;

  sentenceIndex: number;

  sourceSnapshotSentenceOccurrenceAuthority:
    CanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1;

  governance: {
    explicitExecutionInvocationDeclarationRequired: true;

    callerDeclarationAcceptedAsProof: false;

    exactCapturedSurfaceRequired: true;

    exactCapturedGraphRequired: true;

    capturedInputsUsedForAllProofDerivations: true;

    snapshotIdentityDerivedInternally: true;

    snapshotSentenceOccurrencesDerivedInternally: true;

    snapshotSentenceOccurrenceProofDelegatedToClosedAuthority: true;

    privateSnapshotIdentitySemanticsDuplicated: false;

    privateSnapshotSentenceOccurrenceIdentitySemanticsDuplicated: false;

    declaredSnapshotIdentityMustMatchIndependentSnapshotAuthority: true;

    declaredSnapshotSentenceOccurrenceMustMatchIndependentAuthority: true;

    exactlyOneIndependentSnapshotSentenceOccurrenceMatchRequired: true;

    currentRuntimeSentenceContextSelected: true;

    currentContextProvenByIndependentAuthority: true;

    executionInvocationIdUsedAsSentenceSelector: false;

    sentenceIndexUsedAsContextIdentity: false;

    sentenceIndexUsedAsSelector: false;

    sentenceIndexIsLocalityMetadataOnly: true;

    graphDocumentIdUsedAsSelector: false;

    graphDocumentIdPreservedAsConsistencyMetadata: true;

    sentenceNodeIdAcceptedFromCallerAsSelector: false;

    sentenceNodeIdPreservedAsConsistencyMetadata: true;

    singletonSentenceInferenceAllowed: false;

    singletonCandidateInferenceAllowed: false;

    firstSentenceInferenceAllowed: false;

    rootCandidatesAcceptedAsSelector: false;

    contextCandidateSelected: false;

    runtimeSiteApplicabilityResolved: false;

    occurrenceWinnerSelected: false;

    bindingTruthResolved: false;

    cardinalitySemanticsResolved: false;

    cardinalityEnforcementPerformed: false;

    runtimeWhereTruthResolved: false;

    ruleExecutionPerformed: false;

    graphMutated: false;

    learnerErrorClassified: false;
  };
};

export type CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1 = {
  producer: typeof CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1;

  producerVersion:
    typeof CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1;

  status: "ready";

  capturedSurface: CanonicalSurfaceDocumentV1;

  capturedGraph: CanonicalLanguageGraphV1;

  executionContextInputResult:
    CanonicalRuntimeExecutionContextInputReadyResultV1;

  snapshotIdentityResult: CanonicalGraphSnapshotIdentityAuthorityResultV1;

  snapshotIdentityAuthority: CanonicalGraphSnapshotIdentityAuthorityV1;

  snapshotSentenceOccurrenceIdentityResult:
    CanonicalSnapshotSentenceOccurrenceIdentityAuthorityReadyResultV1;

  authority: CanonicalCurrentRuntimeSentenceContextAuthorityV1;

  blockingReasons: [];
};

export type CanonicalCurrentRuntimeSentenceContextAuthorityBlockedResultV1 = {
  producer: typeof CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1;

  producerVersion:
    typeof CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1;

  status: "blocked";

  blockingReasons: string[];
};

export type CanonicalCurrentRuntimeSentenceContextAuthorityResultV1 =
  | CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1
  | CanonicalCurrentRuntimeSentenceContextAuthorityBlockedResultV1;

function stableReasons(
  reasons: readonly string[],
): string[] {
  return [...new Set(reasons)].sort((a, b) => a.localeCompare(b));
}

function blockedResult(
  reasons: readonly string[],
): CanonicalCurrentRuntimeSentenceContextAuthorityBlockedResultV1 {
  return {
    producer: CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,

    producerVersion:
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,

    status: "blocked",

    blockingReasons: stableReasons(
      reasons.length > 0 ? reasons : [
        "current_runtime_sentence_context:blocked_without_reason",
      ],
    ),
  };
}

function prefixReasons(
  prefix: string,
  reasons: readonly string[],
): string[] {
  if (reasons.length === 0) {
    return [
      `${prefix}:non_exact_result`,
    ];
  }

  return reasons.map(
    (reason) => `${prefix}:${reason}`,
  );
}

function captureExact<T>(
  value: T,
): T | undefined {
  try {
    return structuredClone(value);
  } catch {
    return undefined;
  }
}

function readyExecutionContextInput(
  result: CanonicalRuntimeExecutionContextInputResultV1,
): result is CanonicalRuntimeExecutionContextInputReadyResultV1 {
  return (
    result.producer ===
      CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_V1 &&
    result.producerVersion ===
      CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.blockingReasons.length ===
      0
  );
}

function readySnapshotIdentity(
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

function readySnapshotSentenceOccurrences(
  result: CanonicalSnapshotSentenceOccurrenceIdentityAuthorityResultV1,
): result is CanonicalSnapshotSentenceOccurrenceIdentityAuthorityReadyResultV1 {
  return (
    result.producer ===
      CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_V1 &&
    result.producerVersion ===
      CANONICAL_SNAPSHOT_SENTENCE_OCCURRENCE_IDENTITY_AUTHORITY_VERSION_V1 &&
    result.status ===
      "ready" &&
    result.blockingReasons.length ===
      0 &&
    result.authorityCount ===
      result.authorities.length
  );
}

function currentAuthorityId(
  executionInvocationId: string,
  snapshotIdentityId: string,
  snapshotSentenceOccurrenceIdentityId: string,
): string {
  const parts = [
    CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,
    executionInvocationId,
    snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId,
  ];

  return parts
    .map((part) => `${part.length}:${part}`)
    .join("|");
}

/**
 * Proves one exact snapshot-bound sentence occurrence as CURRENT for one
 * explicit Runtime execution invocation.
 *
 * Public API intentionally accepts exactly three inputs:
 *
 *   surface
 *   graph
 *   rawExecutionContextInput
 *
 * Caller-supplied snapshot results, sentence results, candidate results,
 * applicability results and winner/cardinality results are deliberately not
 * accepted.
 */
export async function deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
  surface: CanonicalSurfaceDocumentV1,
  graph: CanonicalLanguageGraphV1,
  rawExecutionContextInput: unknown,
): Promise<CanonicalCurrentRuntimeSentenceContextAuthorityResultV1> {
  const executionContextInputResult =
    deriveCanonicalRuntimeExecutionContextInputV1(
      rawExecutionContextInput,
    );

  if (
    !readyExecutionContextInput(
      executionContextInputResult,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "execution_context_input",
        executionContextInputResult
          .blockingReasons,
      ),
    );
  }

  const capturedSurface = captureExact(surface);

  if (
    capturedSurface ===
      undefined
  ) {
    return blockedResult([
      "current_runtime_sentence_context:surface_capture_failed",
    ]);
  }

  const capturedGraph = captureExact(graph);

  if (
    capturedGraph ===
      undefined
  ) {
    return blockedResult([
      "current_runtime_sentence_context:graph_capture_failed",
    ]);
  }

  const snapshotIdentityResult =
    await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
      capturedSurface,
      capturedGraph,
    );

  if (
    !readySnapshotIdentity(
      snapshotIdentityResult,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "snapshot_identity",
        snapshotIdentityResult
          .blockingReasons,
      ),
    );
  }

  const snapshotIdentityAuthority = snapshotIdentityResult.authority;

  if (
    executionContextInputResult
      .input
      .declaredCurrentSnapshotIdentityId !==
      snapshotIdentityAuthority
        .snapshotIdentityId
  ) {
    return blockedResult([
      "current_runtime_sentence_context:declared_snapshot_identity_mismatch",
    ]);
  }

  const snapshotSentenceOccurrenceIdentityResult =
    await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
      capturedSurface,
      capturedGraph,
      snapshotIdentityResult,
    );

  if (
    !readySnapshotSentenceOccurrences(
      snapshotSentenceOccurrenceIdentityResult,
    )
  ) {
    return blockedResult(
      prefixReasons(
        "snapshot_sentence_occurrence_identity",
        snapshotSentenceOccurrenceIdentityResult
          .blockingReasons,
      ),
    );
  }

  const declaredSnapshotSentenceOccurrenceIdentityId =
    executionContextInputResult
      .input
      .declaredCurrentSnapshotSentenceOccurrenceIdentityId;

  const matches = snapshotSentenceOccurrenceIdentityResult
    .authorities
    .filter(
      (candidate) =>
        candidate.status ===
          "proven" &&
        candidate.snapshotIdentityId ===
          snapshotIdentityAuthority
            .snapshotIdentityId &&
        candidate.snapshotSentenceOccurrenceIdentityId ===
          declaredSnapshotSentenceOccurrenceIdentityId,
    );

  if (
    matches.length ===
      0
  ) {
    return blockedResult([
      "current_runtime_sentence_context:declared_snapshot_sentence_occurrence_not_proven",
    ]);
  }

  if (
    matches.length !==
      1
  ) {
    return blockedResult([
      "current_runtime_sentence_context:declared_snapshot_sentence_occurrence_not_unique",
    ]);
  }

  const sourceSnapshotSentenceOccurrenceAuthority = matches[0];

  if (
    sourceSnapshotSentenceOccurrenceAuthority
        .snapshotAuthorityId !==
      snapshotIdentityAuthority
        .authorityId ||
    sourceSnapshotSentenceOccurrenceAuthority
        .graphDocumentId !==
      capturedGraph.documentId
  ) {
    return blockedResult([
      "current_runtime_sentence_context:source_authority_consistency_mismatch",
    ]);
  }

  const authority: CanonicalCurrentRuntimeSentenceContextAuthorityV1 = {
    authorityId: currentAuthorityId(
      executionContextInputResult
        .input
        .executionInvocationId,
      snapshotIdentityAuthority
        .snapshotIdentityId,
      sourceSnapshotSentenceOccurrenceAuthority
        .snapshotSentenceOccurrenceIdentityId,
    ),

    status: "proven_current",

    executionInvocationId: executionContextInputResult
      .input
      .executionInvocationId,

    snapshotIdentityId: snapshotIdentityAuthority
      .snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId:
      sourceSnapshotSentenceOccurrenceAuthority
        .snapshotSentenceOccurrenceIdentityId,

    snapshotAuthorityId: snapshotIdentityAuthority
      .authorityId,

    snapshotSentenceOccurrenceAuthorityId:
      sourceSnapshotSentenceOccurrenceAuthority
        .authorityId,

    graphDocumentId: sourceSnapshotSentenceOccurrenceAuthority
      .graphDocumentId,

    sentenceNodeId: sourceSnapshotSentenceOccurrenceAuthority
      .sentenceNodeId,

    sentenceIndex: sourceSnapshotSentenceOccurrenceAuthority
      .sentenceIndex,

    sourceSnapshotSentenceOccurrenceAuthority,

    governance: {
      explicitExecutionInvocationDeclarationRequired: true,

      callerDeclarationAcceptedAsProof: false,

      exactCapturedSurfaceRequired: true,

      exactCapturedGraphRequired: true,

      capturedInputsUsedForAllProofDerivations: true,

      snapshotIdentityDerivedInternally: true,

      snapshotSentenceOccurrencesDerivedInternally: true,

      snapshotSentenceOccurrenceProofDelegatedToClosedAuthority: true,

      privateSnapshotIdentitySemanticsDuplicated: false,

      privateSnapshotSentenceOccurrenceIdentitySemanticsDuplicated: false,

      declaredSnapshotIdentityMustMatchIndependentSnapshotAuthority: true,

      declaredSnapshotSentenceOccurrenceMustMatchIndependentAuthority: true,

      exactlyOneIndependentSnapshotSentenceOccurrenceMatchRequired: true,

      currentRuntimeSentenceContextSelected: true,

      currentContextProvenByIndependentAuthority: true,

      executionInvocationIdUsedAsSentenceSelector: false,

      sentenceIndexUsedAsContextIdentity: false,

      sentenceIndexUsedAsSelector: false,

      sentenceIndexIsLocalityMetadataOnly: true,

      graphDocumentIdUsedAsSelector: false,

      graphDocumentIdPreservedAsConsistencyMetadata: true,

      sentenceNodeIdAcceptedFromCallerAsSelector: false,

      sentenceNodeIdPreservedAsConsistencyMetadata: true,

      singletonSentenceInferenceAllowed: false,

      singletonCandidateInferenceAllowed: false,

      firstSentenceInferenceAllowed: false,

      rootCandidatesAcceptedAsSelector: false,

      contextCandidateSelected: false,

      runtimeSiteApplicabilityResolved: false,

      occurrenceWinnerSelected: false,

      bindingTruthResolved: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      runtimeWhereTruthResolved: false,

      ruleExecutionPerformed: false,

      graphMutated: false,

      learnerErrorClassified: false,
    },
  };

  return {
    producer: CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,

    producerVersion:
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,

    status: "ready",

    capturedSurface,

    capturedGraph,

    executionContextInputResult,

    snapshotIdentityResult,

    snapshotIdentityAuthority,

    snapshotSentenceOccurrenceIdentityResult,

    authority,

    blockingReasons: [],
  };
}
