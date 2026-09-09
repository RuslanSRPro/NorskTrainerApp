// Norsk Trainer — Canonical Runtime Execution Context Input V1
//
// Purpose
// -------
// This is the explicit invocation-side declaration consumed by the future
// CURRENT Runtime sentence-context authority.
//
// This layer is INPUT ONLY.
//
// It does NOT prove that the declared snapshot-bound sentence occurrence:
// - exists;
// - belongs to the current canonical graph snapshot;
// - is CURRENT;
// - is applicable to a Runtime site;
// - wins any occurrence competition;
// - satisfies binding or cardinality;
// - makes Runtime WHERE true;
// - licenses rule execution;
// - constitutes a learner error.
//
// Semantic boundary
// -----------------
// The caller may DECLARE the exact context it intends to execute:
//
//   snapshotIdentityId
//   +
//   snapshotSentenceOccurrenceIdentityId
//
// but caller declaration is never grammatical or canonical proof.
//
// The future CURRENT authority must independently verify this declaration
// against CanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1.
//
// Forbidden selectors:
// - sentenceIndex;
// - sentenceNodeId;
// - graphDocumentId;
// - token occurrence;
// - candidate identity;
// - singleton candidate count;
// - first sentence;
// - A4.6a1f rootCandidates;
// - applicability evidence.
//
// No linguistic Runtime module is imported here.

export const CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_V1 =
  "canonical_runtime_execution_context_input_v1" as const;

export const CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_VERSION_V1 =
  "1" as const;

export type CanonicalRuntimeExecutionContextInputV1 = {
  executionInvocationId: string;

  declaredCurrentSnapshotIdentityId: string;

  declaredCurrentSnapshotSentenceOccurrenceIdentityId: string;
};

export type CanonicalRuntimeExecutionContextInputGovernanceV1 = {
  explicitInvocationDeclarationRequired: true;

  declarationIsContextClaimOnly: true;

  callerSuppliedContextAcceptedAsProof: false;

  executionInvocationIdUsedAsContextSelector: false;

  sentenceIndexAcceptedAsSelector: false;

  sentenceNodeIdAcceptedAsSelector: false;

  graphDocumentIdAcceptedAsSelector: false;

  tokenOccurrenceAcceptedAsSelector: false;

  candidateIdentityAcceptedAsSelector: false;

  singletonCandidateInferenceAllowed: false;

  firstSentenceInferenceAllowed: false;

  rootCandidatesAcceptedAsSelector: false;

  applicabilityAcceptedAsSelector: false;

  currentRuntimeSentenceContextSelected: false;

  contextCandidateSelected: false;

  occurrenceWinnerSelected: false;

  runtimeSiteApplicabilityResolved: false;

  bindingTruthResolved: false;

  cardinalitySemanticsResolved: false;

  cardinalityEnforcementPerformed: false;

  runtimeWhereTruthResolved: false;

  ruleExecutionPerformed: false;

  learnerErrorClassified: false;
};

export type CanonicalRuntimeExecutionContextInputReadyResultV1 = {
  producer: typeof CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_V1;

  producerVersion: typeof CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_VERSION_V1;

  status: "ready";

  blockingReasons: readonly [];

  input: CanonicalRuntimeExecutionContextInputV1;

  governance: CanonicalRuntimeExecutionContextInputGovernanceV1;
};

export type CanonicalRuntimeExecutionContextInputBlockedResultV1 = {
  producer: typeof CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_V1;

  producerVersion: typeof CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_VERSION_V1;

  status: "blocked";

  blockingReasons: readonly string[];

  governance: CanonicalRuntimeExecutionContextInputGovernanceV1;
};

export type CanonicalRuntimeExecutionContextInputResultV1 =
  | CanonicalRuntimeExecutionContextInputReadyResultV1
  | CanonicalRuntimeExecutionContextInputBlockedResultV1;

const EXACT_INPUT_KEYS = [
  "declaredCurrentSnapshotIdentityId",
  "declaredCurrentSnapshotSentenceOccurrenceIdentityId",
  "executionInvocationId",
] as const;

function governance(): CanonicalRuntimeExecutionContextInputGovernanceV1 {
  return {
    explicitInvocationDeclarationRequired: true,

    declarationIsContextClaimOnly: true,

    callerSuppliedContextAcceptedAsProof: false,

    executionInvocationIdUsedAsContextSelector: false,

    sentenceIndexAcceptedAsSelector: false,

    sentenceNodeIdAcceptedAsSelector: false,

    graphDocumentIdAcceptedAsSelector: false,

    tokenOccurrenceAcceptedAsSelector: false,

    candidateIdentityAcceptedAsSelector: false,

    singletonCandidateInferenceAllowed: false,

    firstSentenceInferenceAllowed: false,

    rootCandidatesAcceptedAsSelector: false,

    applicabilityAcceptedAsSelector: false,

    currentRuntimeSentenceContextSelected: false,

    contextCandidateSelected: false,

    occurrenceWinnerSelected: false,

    runtimeSiteApplicabilityResolved: false,

    bindingTruthResolved: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforcementPerformed: false,

    runtimeWhereTruthResolved: false,

    ruleExecutionPerformed: false,

    learnerErrorClassified: false,
  };
}

function stableReasons(
  reasons: readonly string[],
): string[] {
  return [...new Set(reasons)].sort((a, b) => a.localeCompare(b));
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function exactIdentityString(
  value: unknown,
  field: string,
  reasons: string[],
): string | undefined {
  if (typeof value !== "string") {
    reasons.push(
      `execution_context_input:${field}:not_string`,
    );

    return undefined;
  }

  if (value.length === 0) {
    reasons.push(
      `execution_context_input:${field}:empty`,
    );

    return undefined;
  }

  if (value.trim() !== value) {
    reasons.push(
      `execution_context_input:${field}:surrounding_whitespace`,
    );

    return undefined;
  }

  if (/[\u0000-\u001F\u007F]/u.test(value)) {
    reasons.push(
      `execution_context_input:${field}:control_character`,
    );

    return undefined;
  }

  return value;
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeExecutionContextInputBlockedResultV1 {
  return {
    producer: CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_V1,

    producerVersion: CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_VERSION_V1,

    status: "blocked",

    blockingReasons: stableReasons(reasons),

    governance: governance(),
  };
}

/**
 * Validates one explicit Runtime execution-context declaration.
 *
 * Important:
 * - the declaration is NOT accepted as proof;
 * - exact identity strings are preserved without normalization;
 * - no sentence, candidate or applicability selection is performed.
 */
export function deriveCanonicalRuntimeExecutionContextInputV1(
  raw: unknown,
): CanonicalRuntimeExecutionContextInputResultV1 {
  if (!isRecord(raw)) {
    return blocked([
      "execution_context_input:not_object",
    ]);
  }

  const reasons: string[] = [];

  const keys = Object.keys(raw).sort((a, b) => a.localeCompare(b));

  for (const key of keys) {
    if (
      !EXACT_INPUT_KEYS.includes(
        key as (typeof EXACT_INPUT_KEYS)[number],
      )
    ) {
      reasons.push(
        `execution_context_input:unexpected_field:${key}`,
      );
    }
  }

  for (const key of EXACT_INPUT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) {
      reasons.push(
        `execution_context_input:missing_field:${key}`,
      );
    }
  }

  const executionInvocationId = exactIdentityString(
    raw.executionInvocationId,
    "executionInvocationId",
    reasons,
  );

  const declaredCurrentSnapshotIdentityId = exactIdentityString(
    raw.declaredCurrentSnapshotIdentityId,
    "declaredCurrentSnapshotIdentityId",
    reasons,
  );

  const declaredCurrentSnapshotSentenceOccurrenceIdentityId =
    exactIdentityString(
      raw.declaredCurrentSnapshotSentenceOccurrenceIdentityId,
      "declaredCurrentSnapshotSentenceOccurrenceIdentityId",
      reasons,
    );

  if (
    reasons.length > 0 ||
    executionInvocationId === undefined ||
    declaredCurrentSnapshotIdentityId === undefined ||
    declaredCurrentSnapshotSentenceOccurrenceIdentityId ===
      undefined
  ) {
    return blocked(reasons);
  }

  return {
    producer: CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_V1,

    producerVersion: CANONICAL_RUNTIME_EXECUTION_CONTEXT_INPUT_VERSION_V1,

    status: "ready",

    blockingReasons: [],

    input: {
      executionInvocationId,

      declaredCurrentSnapshotIdentityId,

      declaredCurrentSnapshotSentenceOccurrenceIdentityId,
    },

    governance: governance(),
  };
}
