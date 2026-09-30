import type { CanonicalLanguageGraphV1 } from "./canonical-language-graph-core-v1.ts";
import type { CanonicalSurfaceDocumentV1 } from "./canonical-surface-boundary-v1.ts";
import type { CanonicalGraphSnapshotIdentityAuthorityResultV1 } from "./canonical-graph-snapshot-identity-authority-v1.ts";
import {
  type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityResultV1,
  type CanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1,
  deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1,
} from "./canonical-snapshot-sentence-occurrence-identity-authority-v1.ts";
import type { CanonicalRuntimeExecutionContextInputV1 } from "./canonical-runtime-execution-context-input-v1.ts";

export const CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_V1 =
  "canonical-runtime-current-declaration-boundary-v1" as const;
export const CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_VERSION_V1 =
  "a3.6j:canonical-runtime-current-declaration-boundary-v1" as const;

export type CanonicalRuntimeCurrentDeclarationBoundaryInputV1 = {
  surface: CanonicalSurfaceDocumentV1;
  graph: CanonicalLanguageGraphV1;
  sourceSnapshotIdentityResult: CanonicalGraphSnapshotIdentityAuthorityResultV1;
  selectedSentenceNodeId: string;
  executionInvocationId: string;
};

export type CanonicalRuntimeCurrentDeclarationBoundaryReadyResultV1 = {
  producer: typeof CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_V1;
  producerVersion:
    typeof CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_VERSION_V1;
  status: "ready";
  selectedSentenceNodeId: string;
  selectedOccurrenceAuthority:
    CanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1;
  snapshotSentenceOccurrenceIdentityResult:
    CanonicalSnapshotSentenceOccurrenceIdentityAuthorityResultV1;
  rawExecutionContextInput: CanonicalRuntimeExecutionContextInputV1;
  blockingReasons: [];
  governance: {
    callerSelectedSentenceNodeIdRequired: true;
    sentenceIndexAcceptedAsSelector: false;
    candidateCardinalityUsedAsSelector: false;
    selectedSentenceNodeIdMatchedAgainstCanonicalOccurrenceAuthorities: true;
    exactSingleSelectedSentenceNodeIdMatchRequired: true;
    snapshotIdentityCopiedFromCanonicalSnapshotAuthority: true;
    snapshotSentenceOccurrenceIdentityCopiedFromCanonicalOccurrenceAuthority:
      true;
    executionInvocationIdOpaqueAndCallerSupplied: true;
    currentContextAuthorityDerivedHere: false;
    linguisticSemanticsCreated: false;
    graphMutationPerformed: false;
    activationResolved: false;
    schedulerInvoked: false;
  };
};

export type CanonicalRuntimeCurrentDeclarationBoundaryBlockedResultV1 = {
  producer: typeof CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_V1;
  producerVersion:
    typeof CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_VERSION_V1;
  status: "blocked";
  blockingReasons: string[];
};

export type CanonicalRuntimeCurrentDeclarationBoundaryResultV1 =
  | CanonicalRuntimeCurrentDeclarationBoundaryReadyResultV1
  | CanonicalRuntimeCurrentDeclarationBoundaryBlockedResultV1;

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeCurrentDeclarationBoundaryBlockedResultV1 {
  return {
    producer: CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_V1,
    producerVersion: CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_VERSION_V1,
    status: "blocked",
    blockingReasons: reasons.length > 0
      ? [...reasons]
      : ["current_declaration:blocked_without_reason"],
  };
}

function exactNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function deriveCanonicalRuntimeCurrentDeclarationBoundaryV1(
  input: CanonicalRuntimeCurrentDeclarationBoundaryInputV1,
): Promise<CanonicalRuntimeCurrentDeclarationBoundaryResultV1> {
  const selectedSentenceNodeId = exactNonEmptyString(
    input.selectedSentenceNodeId,
  );
  if (selectedSentenceNodeId === undefined) {
    return blocked(["current_declaration:selected_sentence_node_id_invalid"]);
  }

  const executionInvocationId = exactNonEmptyString(
    input.executionInvocationId,
  );
  if (executionInvocationId === undefined) {
    return blocked(["current_declaration:execution_invocation_id_invalid"]);
  }

  if (
    input.sourceSnapshotIdentityResult.status !== "ready" ||
    input.sourceSnapshotIdentityResult.authority === undefined
  ) {
    return blocked(["current_declaration:source_snapshot_identity_not_ready"]);
  }

  const sourceSnapshotIdentityAuthority =
    input.sourceSnapshotIdentityResult.authority;

  const occurrenceResult =
    await deriveCanonicalSnapshotSentenceOccurrenceIdentityAuthorityV1(
      input.surface,
      input.graph,
      input.sourceSnapshotIdentityResult,
    );

  if (occurrenceResult.status !== "ready") {
    return blocked(
      occurrenceResult.blockingReasons.map(
        (reason) => `current_declaration:occurrence:${reason}`,
      ),
    );
  }

  const matches = occurrenceResult.authorities.filter(
    (authority) =>
      authority.status === "proven" &&
      authority.snapshotIdentityId ===
        sourceSnapshotIdentityAuthority.snapshotIdentityId &&
      authority.sentenceNodeId === selectedSentenceNodeId,
  );

  if (matches.length !== 1) {
    return blocked([
      `current_declaration:selected_sentence_exact_match_count:${matches.length}`,
    ]);
  }

  const selectedOccurrenceAuthority = matches[0];

  return {
    producer: CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_V1,
    producerVersion: CANONICAL_RUNTIME_CURRENT_DECLARATION_BOUNDARY_VERSION_V1,
    status: "ready",
    selectedSentenceNodeId,
    selectedOccurrenceAuthority,
    snapshotSentenceOccurrenceIdentityResult: occurrenceResult,
    rawExecutionContextInput: {
      executionInvocationId,
      declaredCurrentSnapshotIdentityId:
        sourceSnapshotIdentityAuthority.snapshotIdentityId,
      declaredCurrentSnapshotSentenceOccurrenceIdentityId:
        selectedOccurrenceAuthority.snapshotSentenceOccurrenceIdentityId,
    },
    blockingReasons: [],
    governance: {
      callerSelectedSentenceNodeIdRequired: true,
      sentenceIndexAcceptedAsSelector: false,
      candidateCardinalityUsedAsSelector: false,
      selectedSentenceNodeIdMatchedAgainstCanonicalOccurrenceAuthorities: true,
      exactSingleSelectedSentenceNodeIdMatchRequired: true,
      snapshotIdentityCopiedFromCanonicalSnapshotAuthority: true,
      snapshotSentenceOccurrenceIdentityCopiedFromCanonicalOccurrenceAuthority:
        true,
      executionInvocationIdOpaqueAndCallerSupplied: true,
      currentContextAuthorityDerivedHere: false,
      linguisticSemanticsCreated: false,
      graphMutationPerformed: false,
      activationResolved: false,
      schedulerInvoked: false,
    },
  };
}
