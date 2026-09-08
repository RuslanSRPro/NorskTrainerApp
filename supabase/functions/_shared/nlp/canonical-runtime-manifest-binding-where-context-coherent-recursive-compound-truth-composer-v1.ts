/**
 * v1.46 A4.6a1f
 *
 * Generic context-coherent recursive compound truth composer.
 *
 * Inputs:
 *   1. exact A4.6a1a structural WHERE result
 *   2. readonly exact A4.6a1e READY LEAF evidence objects
 *
 * Context coherence is enforced independently inside each structural
 * authority.
 *
 * Context identity:
 *
 *   structuralAuthorityId
 *     + nodePath
 *     + snapshotIdentityId
 *     + snapshotSentenceOccurrenceIdentityId
 *
 * graphDocumentId and sentenceNodeId are consistency metadata.
 *
 * Multiple complete contexts remain multiple candidates.
 * Zero complete contexts remain zero candidates.
 *
 * This layer does NOT:
 * - import A4.6a1d;
 * - import token.pos / D2 / C2 source-specific authorities;
 * - mix evidence across sentence contexts;
 * - require independent WHERE authorities to share one context;
 * - collapse missing coherent proof to false or unresolved;
 * - select a context candidate;
 * - select a Runtime occurrence;
 * - perform final Runtime binding;
 * - resolve or enforce cardinality;
 * - mutate the graph;
 * - classify learner error.
 */

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  type CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_RESULT_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestCompoundTruthDispositionV1,
} from "./canonical-runtime-manifest-binding-where-compound-truth-semantic-capability-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-child-truth-evidence-interface-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-context-bound-child-truth-evidence-interface-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1 =
  "canonical_runtime_manifest_binding_where_context_coherent_recursive_compound_truth_composer_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1 =
  "runtime_where_context_coherent_recursive_compound_truth_composer_a4_6a1f_v1" as const;

type ExternalLeafEvidenceV1 =
  CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1;

type ContextRootCandidateV1 = {
  contextCandidateId: string;

  structuralAuthorityId: string;

  snapshotIdentityId: string;

  snapshotSentenceOccurrenceIdentityId: string;

  graphDocumentId: string;

  sentenceNodeId: string;

  rootTruth: CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1;

  composedCompoundTruthEvidence:
    readonly CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1[];
};

type AuthorityReadyResultV1 = {
  structuralAuthorityId: string;

  sourceAuthority:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1;

  status: "ready";

  rootCandidates: readonly ContextRootCandidateV1[];
};

type ComposerGovernanceV1 = {
  exactA46a1aResultRequired: true;

  exactA46a1aProducerRequired: true;

  exactA46a1aVersionRequired: true;

  exactA46a1aStructuralSpecificationRequired: true;

  exactA46a1bSemanticCapabilityImported: true;

  exactA46a1bTruthSpecificationRequired: true;

  exactA46a1cEvidenceContractUsed: true;

  exactA46a1c2AuthorityBoundEvidenceContractUsed: true;

  exactA46a1eContextBoundEvidenceContractUsed: true;

  externalEvidenceLeafOnly: true;

  externalCompoundTruthAccepted: false;

  sourceSpecificLeafAdapterImported: false;

  tokenPosAuthorityImported: false;

  d2AuthorityImported: false;

  c2AuthorityImported: false;

  a46a1dComposerImported: false;

  contextCoherenceEnforcedPerStructuralAuthority: true;

  crossAuthorityContextEqualityRequired: false;

  compositeContextNodeIdentityRequired: true;

  graphDocumentIdIsConsistencyMetadata: true;

  sentenceNodeIdIsConsistencyMetadata: true;

  sentenceIndexUsedAsContextIdentity: false;

  tokenOccurrenceUsedAsSentenceContextIdentity: false;

  duplicateAuthorityPathContextEvidenceKeyBlocks: true;

  contextMetadataConflictBlocks: true;

  recursiveChildrenEvaluatedWithinOneContextOnly: true;

  missingLeafEvidenceParticipatesInTruthTable: false;

  missingLeafEvidenceCreatesFalseTruth: false;

  missingLeafEvidenceCreatesUnresolvedTruth: false;

  zeroCompleteContextsAllowed: true;

  zeroCompleteContextsAssignedFalse: false;

  zeroCompleteContextsAssignedUnresolved: false;

  multipleCompleteContextsPreservedAsCandidates: true;

  multipleCompleteContextsBlockAsNonunique: false;

  contextCandidateWinnerSelected: false;

  composedChildTruthEvidenceProducedInternally: true;

  composedAuthorityBoundEvidenceProducedInternally: true;

  composedContextBoundEvidenceProducedInternally: true;

  compoundTruthComposed: true;

  booleanShortCircuitExecutedAcrossMissingProof: false;

  wholeResultBlocksOnMalformedExternalEvidence: true;

  wholeResultBlocksOnUnsafeStructuralContract: true;

  wholeResultBlocksOnZeroCoherentContexts: false;

  wholeResultBlocksWhenIndependentAuthorityHasZeroCandidates: false;

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
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1;

  status: "ready";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1;

  structuralSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1;

  truthSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1;

  childTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  authorityBoundChildTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  contextBoundChildTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1;

  sourceLeafEvidence: readonly ExternalLeafEvidenceV1[];

  authorityResults: readonly AuthorityReadyResultV1[];

  blockingReasons: readonly [];

  governance: ComposerGovernanceV1;
};

type BlockedResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1;

  status: "blocked";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1;

  structuralSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1;

  truthSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1;

  childTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  authorityBoundChildTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  contextBoundChildTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1;

  sourceLeafEvidence: readonly ExternalLeafEvidenceV1[];

  authorityResults: readonly [];

  blockingReasons: readonly string[];

  governance: ComposerGovernanceV1;
};

export type CanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthComposerResultV1 =
  | ReadyResultV1
  | BlockedResultV1;

type NodeReadyV1 = {
  status: "ready";

  rootTruth: CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1;

  composedCompoundTruthEvidence:
    CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1[];
};

type NodeUnavailableV1 = {
  status: "unavailable";
};

type NodeBlockedV1 = {
  status: "blocked";

  blockingReasons: string[];
};

type NodeResultV1 =
  | NodeReadyV1
  | NodeUnavailableV1
  | NodeBlockedV1;

type ContextMetadataV1 = {
  snapshotIdentityId: string;

  snapshotSentenceOccurrenceIdentityId: string;

  graphDocumentId: string;

  sentenceNodeId: string;
};

const GOVERNANCE: ComposerGovernanceV1 = {
  exactA46a1aResultRequired: true,

  exactA46a1aProducerRequired: true,

  exactA46a1aVersionRequired: true,

  exactA46a1aStructuralSpecificationRequired: true,

  exactA46a1bSemanticCapabilityImported: true,

  exactA46a1bTruthSpecificationRequired: true,

  exactA46a1cEvidenceContractUsed: true,

  exactA46a1c2AuthorityBoundEvidenceContractUsed: true,

  exactA46a1eContextBoundEvidenceContractUsed: true,

  externalEvidenceLeafOnly: true,

  externalCompoundTruthAccepted: false,

  sourceSpecificLeafAdapterImported: false,

  tokenPosAuthorityImported: false,

  d2AuthorityImported: false,

  c2AuthorityImported: false,

  a46a1dComposerImported: false,

  contextCoherenceEnforcedPerStructuralAuthority: true,

  crossAuthorityContextEqualityRequired: false,

  compositeContextNodeIdentityRequired: true,

  graphDocumentIdIsConsistencyMetadata: true,

  sentenceNodeIdIsConsistencyMetadata: true,

  sentenceIndexUsedAsContextIdentity: false,

  tokenOccurrenceUsedAsSentenceContextIdentity: false,

  duplicateAuthorityPathContextEvidenceKeyBlocks: true,

  contextMetadataConflictBlocks: true,

  recursiveChildrenEvaluatedWithinOneContextOnly: true,

  missingLeafEvidenceParticipatesInTruthTable: false,

  missingLeafEvidenceCreatesFalseTruth: false,

  missingLeafEvidenceCreatesUnresolvedTruth: false,

  zeroCompleteContextsAllowed: true,

  zeroCompleteContextsAssignedFalse: false,

  zeroCompleteContextsAssignedUnresolved: false,

  multipleCompleteContextsPreservedAsCandidates: true,

  multipleCompleteContextsBlockAsNonunique: false,

  contextCandidateWinnerSelected: false,

  composedChildTruthEvidenceProducedInternally: true,

  composedAuthorityBoundEvidenceProducedInternally: true,

  composedContextBoundEvidenceProducedInternally: true,

  compoundTruthComposed: true,

  booleanShortCircuitExecutedAcrossMissingProof: false,

  wholeResultBlocksOnMalformedExternalEvidence: true,

  wholeResultBlocksOnUnsafeStructuralContract: true,

  wholeResultBlocksOnZeroCoherentContexts: false,

  wholeResultBlocksWhenIndependentAuthorityHasZeroCandidates: false,

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

function truthDisposition(
  value: unknown,
): value is CanonicalRuntimeManifestCompoundTruthDispositionV1 {
  return (
    value ===
      "resolved_true" ||
    value ===
      "resolved_false" ||
    value ===
      "unresolved"
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

function contextKey(
  snapshotIdentityId: string,
  snapshotSentenceOccurrenceIdentityId: string,
): string {
  return [
    snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId,
  ].join(
    "\u0000",
  );
}

function evidenceKey(
  structuralAuthorityId: string,
  nodePath: string,
  snapshotIdentityId: string,
  snapshotSentenceOccurrenceIdentityId: string,
): string {
  return [
    structuralAuthorityId,
    nodePath,
    snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId,
  ].join(
    "\u0000",
  );
}

function blocked(
  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  sourceLeafEvidence: readonly ExternalLeafEvidenceV1[],
  reasons: readonly string[],
): BlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1,

    status: "blocked",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1,

    structuralSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    truthSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,

    childTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    authorityBoundChildTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    contextBoundChildTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceShapeResult,

    sourceLeafEvidence,

    authorityResults: [],

    blockingReasons: uniqueSorted(
      reasons,
    ),

    governance: GOVERNANCE,
  };
}

function exactContextEvidence(
  evidence: CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1,
): boolean {
  const contextProvenance = evidence.provenance;

  const authorityBound = evidence.authorityBoundChildTruthEvidence;

  const authorityProvenance = authorityBound.provenance;

  const child = authorityBound.childTruthEvidence;

  const childProvenance = child.provenance;

  return (
    present(
      evidence.contextBoundChildTruthEvidenceId,
    ) &&
    present(
      evidence.structuralAuthorityId,
    ) &&
    present(
      evidence.nodePath,
    ) &&
    present(
      evidence.snapshotIdentityId,
    ) &&
    present(
      evidence.snapshotSentenceOccurrenceIdentityId,
    ) &&
    present(
      evidence.graphDocumentId,
    ) &&
    present(
      evidence.sentenceNodeId,
    ) &&
    authorityBound.structuralAuthorityId ===
      evidence.structuralAuthorityId &&
    authorityBound.nodePath ===
      evidence.nodePath &&
    child.nodePath ===
      evidence.nodePath &&
    child.sourceKind ===
      "leaf_condition_truth" &&
    truthDisposition(
      child.truthDisposition,
    ) &&
    present(
      child.childTruthEvidenceId,
    ) &&
    present(
      child.sourceProducer,
    ) &&
    present(
      child.sourceProducerVersion,
    ) &&
    present(
      child.sourceEvidenceId,
    ) &&
    childProvenance.exactStructuralNodePathClaimed ===
      true &&
    childProvenance.truthDispositionSuppliedBySourceAuthority ===
      true &&
    childProvenance.sourceProducerIdentityPreserved ===
      true &&
    childProvenance.sourceEvidenceIdentityPreserved ===
      true &&
    childProvenance.sourceEvidenceObjectPreservedWithoutReconstruction ===
      true &&
    childProvenance.truthRecomputedByInterface ===
      false &&
    childProvenance.booleanTruthInferredByInterface ===
      false &&
    authorityProvenance.exactStructuralAuthorityIdentityClaimed ===
      true &&
    authorityProvenance.exactStructuralNodePathClaimed ===
      true &&
    authorityProvenance
        .structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity ===
      true &&
    authorityProvenance
        .childTruthEvidenceObjectPreservedWithoutReconstruction ===
      true &&
    authorityProvenance.childTruthNodePathMatchesBoundNodePath ===
      true &&
    authorityProvenance.authorityNodePairProvenBySourceAdapter ===
      true &&
    authorityProvenance.structuralAuthorityInferredByInterface ===
      false &&
    authorityProvenance.nodePathInferredByInterface ===
      false &&
    authorityProvenance.callerSuppliedAuthorityNodePairAcceptedAsProof ===
      false &&
    authorityProvenance.truthDispositionDuplicatedAtBindingLayer ===
      false &&
    authorityProvenance.truthRecomputedByInterface ===
      false &&
    contextProvenance.exactAuthorityBoundChildTruthEvidenceRequired ===
      true &&
    contextProvenance
        .authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction ===
      true &&
    contextProvenance.structuralAuthorityIdMatchesWrappedEvidence ===
      true &&
    contextProvenance.nodePathMatchesWrappedEvidence ===
      true &&
    contextProvenance.canonicalSnapshotSentenceOccurrenceIdentityRequired ===
      true &&
    contextProvenance.snapshotIdentityRequired ===
      true &&
    contextProvenance.snapshotSentenceOccurrenceIdentityRequired ===
      true &&
    contextProvenance
        .snapshotIdentityAndSentenceOccurrenceIdentityFormContextCompositeIdentity ===
      true &&
    contextProvenance.graphDocumentIdPreservedAsContextConsistencyMetadata ===
      true &&
    contextProvenance.sentenceNodeIdPreservedAsContextConsistencyMetadata ===
      true &&
    contextProvenance.sentenceIndexUsedAsContextIdentity ===
      false &&
    contextProvenance.tokenNodeIdUsedAsSentenceContextIdentity ===
      false &&
    contextProvenance
        .snapshotTokenOccurrenceIdentityUsedAsSentenceContextIdentity ===
      false &&
    contextProvenance.authorityContextPairProvenBySourceAdapter ===
      true &&
    contextProvenance.contextInferredByInterface ===
      false &&
    contextProvenance.callerSuppliedContextAcceptedAsProof ===
      false &&
    contextProvenance.truthDispositionDuplicatedAtContextBindingLayer ===
      false &&
    contextProvenance.truthRecomputedByInterface ===
      false
  );
}

function structuralNodeMap(
  authority:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
):
  | {
    status: "ready";

    nodes: Map<
      string,
      CanonicalRuntimeManifestCompoundOperatorShapeNodeV1
    >;
  }
  | {
    status: "blocked";

    reasons: string[];
  } {
  const nodes = new Map<
    string,
    CanonicalRuntimeManifestCompoundOperatorShapeNodeV1
  >();

  const reasons: string[] = [];

  function visit(
    node: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  ): void {
    const record = node as unknown as Record<
      string,
      unknown
    >;

    const shape = record.shape;

    const path = record.path;

    if (
      !present(
        path,
      )
    ) {
      reasons.push(
        `authority:${authority.id}:node_path:missing`,
      );

      return;
    }

    if (
      nodes.has(
        path,
      )
    ) {
      reasons.push(
        `authority:${authority.id}:node_path:${path}:duplicate`,
      );

      return;
    }

    nodes.set(
      path,
      node,
    );

    if (
      shape ===
        "leaf_operator"
    ) {
      return;
    }

    if (
      shape !==
        "compound_operator"
    ) {
      reasons.push(
        `authority:${authority.id}:node_path:${path}:unsupported_shape:${
          String(shape)
        }`,
      );

      return;
    }

    const operatorKey = record.operatorKey;

    const children = record.children;

    if (
      !Array.isArray(
        children,
      )
    ) {
      reasons.push(
        `authority:${authority.id}:node_path:${path}:children:not_array`,
      );

      return;
    }

    if (
      (
        operatorKey ===
          "all" ||
        operatorKey ===
          "any"
      ) &&
      children.length <
        2
    ) {
      reasons.push(
        `authority:${authority.id}:node_path:${path}:${
          String(operatorKey)
        }:invalid_arity`,
      );
    } else if (
      operatorKey ===
        "not" &&
      children.length !==
        1
    ) {
      reasons.push(
        `authority:${authority.id}:node_path:${path}:not:invalid_arity`,
      );
    } else if (
      operatorKey !==
        "all" &&
      operatorKey !==
        "any" &&
      operatorKey !==
        "not"
    ) {
      reasons.push(
        `authority:${authority.id}:node_path:${path}:unknown_operator:${
          String(operatorKey)
        }`,
      );
    }

    for (
      const child of children
    ) {
      visit(
        child as CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
      );
    }
  }

  visit(
    authority.root,
  );

  if (
    reasons.length >
      0
  ) {
    return {
      status: "blocked",

      reasons: uniqueSorted(
        reasons,
      ),
    };
  }

  return {
    status: "ready",

    nodes,
  };
}

function composeDisposition(
  node: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  children: readonly CanonicalRuntimeManifestCompoundTruthDispositionV1[],
):
  | {
    status: "ready";

    truth: CanonicalRuntimeManifestCompoundTruthDispositionV1;
  }
  | {
    status: "blocked";

    reason: string;
  } {
  const record = node as unknown as Record<
    string,
    unknown
  >;

  const operatorKey = record.operatorKey;

  const resolvedTrueCount = children.filter(
    (value) =>
      value ===
        "resolved_true",
  ).length;

  const resolvedFalseCount = children.filter(
    (value) =>
      value ===
        "resolved_false",
  ).length;

  const unresolvedCount = children.filter(
    (value) =>
      value ===
        "unresolved",
  ).length;

  if (
    resolvedTrueCount +
        resolvedFalseCount +
        unresolvedCount !==
      children.length
  ) {
    return {
      status: "blocked",

      reason: `node:${String(record.path)}:truth_domain:not_exact`,
    };
  }

  if (
    operatorKey ===
      "all"
  ) {
    if (
      resolvedFalseCount >
        0
    ) {
      return {
        status: "ready",
        truth: "resolved_false",
      };
    }

    if (
      resolvedTrueCount ===
        children.length
    ) {
      return {
        status: "ready",
        truth: "resolved_true",
      };
    }

    return {
      status: "ready",
      truth: "unresolved",
    };
  }

  if (
    operatorKey ===
      "any"
  ) {
    if (
      resolvedTrueCount >
        0
    ) {
      return {
        status: "ready",
        truth: "resolved_true",
      };
    }

    if (
      resolvedFalseCount ===
        children.length
    ) {
      return {
        status: "ready",
        truth: "resolved_false",
      };
    }

    return {
      status: "ready",
      truth: "unresolved",
    };
  }

  if (
    operatorKey ===
      "not"
  ) {
    if (
      children.length !==
        1
    ) {
      return {
        status: "blocked",
        reason: `node:${String(record.path)}:not:invalid_arity`,
      };
    }

    if (
      children[0] ===
        "resolved_true"
    ) {
      return {
        status: "ready",
        truth: "resolved_false",
      };
    }

    if (
      children[0] ===
        "resolved_false"
    ) {
      return {
        status: "ready",
        truth: "resolved_true",
      };
    }

    return {
      status: "ready",
      truth: "unresolved",
    };
  }

  return {
    status: "blocked",

    reason: `node:${String(record.path)}:operator:unsupported`,
  };
}

function buildCompoundContextEvidence(
  authority:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
  node: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  childResults: readonly NodeReadyV1[],
  truth: CanonicalRuntimeManifestCompoundTruthDispositionV1,
  context: ContextMetadataV1,
): CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1 {
  const record = node as unknown as Record<
    string,
    unknown
  >;

  const nodePath = record.path as string;

  const childTruthEvidence = childResults.map(
    (child) =>
      child.rootTruth
        .authorityBoundChildTruthEvidence
        .childTruthEvidence,
  );

  const compositionEvidenceObject = {
    structuralAuthorityId: authority.id,

    nodePath,

    operatorKey: record.operatorKey,

    encoding: record.encoding,

    sourceNode: node,

    snapshotIdentityId: context.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId:
      context.snapshotSentenceOccurrenceIdentityId,

    graphDocumentId: context.graphDocumentId,

    sentenceNodeId: context.sentenceNodeId,

    childTruthEvidence,

    childTruthDispositions: childTruthEvidence.map(
      (evidence) => evidence.truthDisposition,
    ),

    semanticCapability:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_RESULT_V1,
  };

  const sourceEvidenceId = [
    "a4_6a1f",
    idPart(
      authority.id,
    ),
    idPart(
      nodePath,
    ),
    idPart(
      context.snapshotIdentityId,
    ),
    idPart(
      context.snapshotSentenceOccurrenceIdentityId,
    ),
  ].join(
    ":",
  );

  const genericChildTruth: CanonicalRuntimeManifestWhereChildTruthEvidenceV1 = {
    childTruthEvidenceId: [
      sourceEvidenceId,
      "child_truth",
    ].join(
      ":",
    ),

    nodePath,

    sourceKind: "compound_condition_truth",

    truthDisposition: truth,

    sourceProducer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1,

    sourceProducerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1,

    sourceEvidenceId,

    sourceEvidenceObject: compositionEvidenceObject,

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

  const authorityBound:
    CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1 = {
      authorityBoundChildTruthEvidenceId: [
        sourceEvidenceId,
        genericChildTruth.childTruthEvidenceId,
      ].join(
        ":",
      ),

      structuralAuthorityId: authority.id,

      nodePath,

      childTruthEvidence: genericChildTruth,

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

  return {
    contextBoundChildTruthEvidenceId: [
      sourceEvidenceId,
      authorityBound.authorityBoundChildTruthEvidenceId,
      "context",
    ].join(
      ":",
    ),

    structuralAuthorityId: authority.id,

    nodePath,

    snapshotIdentityId: context.snapshotIdentityId,

    snapshotSentenceOccurrenceIdentityId:
      context.snapshotSentenceOccurrenceIdentityId,

    graphDocumentId: context.graphDocumentId,

    sentenceNodeId: context.sentenceNodeId,

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
}

function evaluateNode(
  authority:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
  node: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  context: ContextMetadataV1,
  evidenceByKey: ReadonlyMap<
    string,
    ExternalLeafEvidenceV1
  >,
): NodeResultV1 {
  const record = node as unknown as Record<
    string,
    unknown
  >;

  const shape = record.shape;

  const nodePath = record.path;

  if (
    !present(
      nodePath,
    )
  ) {
    return {
      status: "blocked",

      blockingReasons: [
        `authority:${authority.id}:node_path:missing`,
      ],
    };
  }

  if (
    shape ===
      "leaf_operator"
  ) {
    const key = evidenceKey(
      authority.id,
      nodePath,
      context.snapshotIdentityId,
      context.snapshotSentenceOccurrenceIdentityId,
    );

    const evidence = evidenceByKey.get(
      key,
    );

    if (
      evidence ===
        undefined
    ) {
      return {
        status: "unavailable",
      };
    }

    return {
      status: "ready",

      rootTruth: evidence,

      composedCompoundTruthEvidence: [],
    };
  }

  if (
    shape !==
      "compound_operator"
  ) {
    return {
      status: "blocked",

      blockingReasons: [
        `authority:${authority.id}:node_path:${nodePath}:unsupported_shape`,
      ],
    };
  }

  const children = record.children;

  if (
    !Array.isArray(
      children,
    )
  ) {
    return {
      status: "blocked",

      blockingReasons: [
        `authority:${authority.id}:node_path:${nodePath}:children:not_array`,
      ],
    };
  }

  const childResults: NodeResultV1[] = [];

  for (
    const child of children
  ) {
    childResults.push(
      evaluateNode(
        authority,
        child as CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
        context,
        evidenceByKey,
      ),
    );
  }

  const blockedReasons = childResults.flatMap(
    (result) =>
      result.status ===
          "blocked"
        ? result.blockingReasons
        : [],
  );

  if (
    blockedReasons.length >
      0
  ) {
    return {
      status: "blocked",

      blockingReasons: uniqueSorted(
        blockedReasons,
      ),
    };
  }

  if (
    childResults.some(
      (result) =>
        result.status ===
          "unavailable",
    )
  ) {
    return {
      status: "unavailable",
    };
  }

  const readyChildren = childResults as NodeReadyV1[];

  const disposition = composeDisposition(
    node,
    readyChildren.map(
      (child) =>
        child.rootTruth
          .authorityBoundChildTruthEvidence
          .childTruthEvidence
          .truthDisposition,
    ),
  );

  if (
    disposition.status ===
      "blocked"
  ) {
    return {
      status: "blocked",

      blockingReasons: [
        disposition.reason,
      ],
    };
  }

  const current = buildCompoundContextEvidence(
    authority,
    node,
    readyChildren,
    disposition.truth,
    context,
  );

  return {
    status: "ready",

    rootTruth: current,

    composedCompoundTruthEvidence: [
      ...readyChildren.flatMap(
        (child) => child.composedCompoundTruthEvidence,
      ),
      current,
    ],
  };
}

export function composeCanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthV1(
  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  sourceLeafEvidence: readonly ExternalLeafEvidenceV1[],
): CanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthComposerResultV1 {
  const sourceRecord = sourceShapeResult as unknown as Record<
    string,
    unknown
  >;

  if (
    sourceShapeResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1 ||
    sourceShapeResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1 ||
    sourceRecord.specificationId !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1 ||
    sourceShapeResult.status !==
      "ready" ||
    sourceShapeResult.blockingReasons.length !==
      0
  ) {
    return blocked(
      sourceShapeResult,
      sourceLeafEvidence,
      [
        "source_a4_6a1a:not_exact_ready_contract",
      ],
    );
  }

  if (
    sourceShapeResult.authorities.length ===
      0
  ) {
    return blocked(
      sourceShapeResult,
      sourceLeafEvidence,
      [
        "source_a4_6a1a:no_authorities",
      ],
    );
  }

  const authorityById = new Map<
    string,
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1
  >();

  const nodesByAuthority = new Map<
    string,
    Map<
      string,
      CanonicalRuntimeManifestCompoundOperatorShapeNodeV1
    >
  >();

  const structuralReasons: string[] = [];

  for (
    const authority of sourceShapeResult.authorities
  ) {
    if (
      !present(
        authority.id,
      ) ||
      authority.status !==
        "candidate" ||
      authority.specificationId !==
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1 ||
      !present(
        authority.bindingDefinitionAuthorityId,
      ) ||
      !present(
        authority.manifestId,
      ) ||
      !present(
        authority.manifestCode,
      ) ||
      !present(
        authority.bindingName,
      )
    ) {
      structuralReasons.push(
        `authority:${authority.id}:contract_not_exact`,
      );

      continue;
    }

    if (
      authorityById.has(
        authority.id,
      )
    ) {
      structuralReasons.push(
        `authority:${authority.id}:duplicate_id`,
      );

      continue;
    }

    const structural = structuralNodeMap(
      authority,
    );

    if (
      structural.status ===
        "blocked"
    ) {
      structuralReasons.push(
        ...structural.reasons,
      );

      continue;
    }

    authorityById.set(
      authority.id,
      authority,
    );

    nodesByAuthority.set(
      authority.id,
      structural.nodes,
    );
  }

  if (
    structuralReasons.length >
      0
  ) {
    return blocked(
      sourceShapeResult,
      sourceLeafEvidence,
      structuralReasons,
    );
  }

  const evidenceByKey = new Map<
    string,
    ExternalLeafEvidenceV1
  >();

  const contextsByAuthority = new Map<
    string,
    Map<
      string,
      ContextMetadataV1
    >
  >();

  const evidenceReasons: string[] = [];

  for (
    const evidence of sourceLeafEvidence
  ) {
    if (
      !exactContextEvidence(
        evidence,
      )
    ) {
      evidenceReasons.push(
        `external_evidence:${evidence.contextBoundChildTruthEvidenceId}:contract_not_exact`,
      );

      continue;
    }

    const authority = authorityById.get(
      evidence.structuralAuthorityId,
    );

    if (
      authority ===
        undefined
    ) {
      evidenceReasons.push(
        `external_evidence:${evidence.contextBoundChildTruthEvidenceId}:unknown_structural_authority`,
      );

      continue;
    }

    const node = nodesByAuthority.get(
      authority.id,
    )?.get(
      evidence.nodePath,
    );

    if (
      node ===
        undefined
    ) {
      evidenceReasons.push(
        `external_evidence:${evidence.contextBoundChildTruthEvidenceId}:unknown_structural_path`,
      );

      continue;
    }

    const nodeRecord = node as unknown as Record<
      string,
      unknown
    >;

    if (
      nodeRecord.shape !==
        "leaf_operator"
    ) {
      evidenceReasons.push(
        `external_evidence:${evidence.contextBoundChildTruthEvidenceId}:external_evidence_for_non_leaf`,
      );

      continue;
    }

    const exactKey = evidenceKey(
      evidence.structuralAuthorityId,
      evidence.nodePath,
      evidence.snapshotIdentityId,
      evidence.snapshotSentenceOccurrenceIdentityId,
    );

    if (
      evidenceByKey.has(
        exactKey,
      )
    ) {
      evidenceReasons.push(
        `external_evidence:${exactKey}:duplicate_authority_path_context_key`,
      );

      continue;
    }

    evidenceByKey.set(
      exactKey,
      evidence,
    );

    const authorityContexts = contextsByAuthority.get(
      authority.id,
    ) ??
      new Map<
        string,
        ContextMetadataV1
      >();

    const localContextKey = contextKey(
      evidence.snapshotIdentityId,
      evidence.snapshotSentenceOccurrenceIdentityId,
    );

    const existingContext = authorityContexts.get(
      localContextKey,
    );

    if (
      existingContext !==
        undefined
    ) {
      if (
        existingContext.graphDocumentId !==
          evidence.graphDocumentId ||
        existingContext.sentenceNodeId !==
          evidence.sentenceNodeId
      ) {
        evidenceReasons.push(
          `authority:${authority.id}:context:${localContextKey}:consistency_metadata_conflict`,
        );

        continue;
      }
    } else {
      authorityContexts.set(
        localContextKey,
        {
          snapshotIdentityId: evidence.snapshotIdentityId,

          snapshotSentenceOccurrenceIdentityId:
            evidence.snapshotSentenceOccurrenceIdentityId,

          graphDocumentId: evidence.graphDocumentId,

          sentenceNodeId: evidence.sentenceNodeId,
        },
      );
    }

    contextsByAuthority.set(
      authority.id,
      authorityContexts,
    );
  }

  if (
    evidenceReasons.length >
      0
  ) {
    return blocked(
      sourceShapeResult,
      sourceLeafEvidence,
      evidenceReasons,
    );
  }

  const authorityResults: AuthorityReadyResultV1[] = [];

  for (
    const authority of sourceShapeResult.authorities
  ) {
    const authorityContexts = contextsByAuthority.get(
      authority.id,
    );

    const contexts = authorityContexts ===
        undefined
      ? []
      : [
        ...authorityContexts.values(),
      ].sort(
        (
          a,
          b,
        ) =>
          contextKey(
            a.snapshotIdentityId,
            a.snapshotSentenceOccurrenceIdentityId,
          ).localeCompare(
            contextKey(
              b.snapshotIdentityId,
              b.snapshotSentenceOccurrenceIdentityId,
            ),
          ),
      );

    const rootCandidates: ContextRootCandidateV1[] = [];

    for (
      const context of contexts
    ) {
      const evaluation = evaluateNode(
        authority,
        authority.root,
        context,
        evidenceByKey,
      );

      if (
        evaluation.status ===
          "blocked"
      ) {
        return blocked(
          sourceShapeResult,
          sourceLeafEvidence,
          evaluation.blockingReasons.map(
            (reason) =>
              `authority:${authority.id}:context:${
                contextKey(
                  context.snapshotIdentityId,
                  context.snapshotSentenceOccurrenceIdentityId,
                )
              }:${reason}`,
          ),
        );
      }

      if (
        evaluation.status ===
          "unavailable"
      ) {
        continue;
      }

      rootCandidates.push(
        {
          contextCandidateId: [
            "a4_6a1f_root_candidate",
            idPart(
              authority.id,
            ),
            idPart(
              evaluation.rootTruth.nodePath,
            ),
            idPart(
              context.snapshotIdentityId,
            ),
            idPart(
              context.snapshotSentenceOccurrenceIdentityId,
            ),
          ].join(
            ":",
          ),

          structuralAuthorityId: authority.id,

          snapshotIdentityId: context.snapshotIdentityId,

          snapshotSentenceOccurrenceIdentityId:
            context.snapshotSentenceOccurrenceIdentityId,

          graphDocumentId: context.graphDocumentId,

          sentenceNodeId: context.sentenceNodeId,

          rootTruth: evaluation.rootTruth,

          composedCompoundTruthEvidence:
            evaluation.composedCompoundTruthEvidence,
        },
      );
    }

    authorityResults.push(
      {
        structuralAuthorityId: authority.id,

        sourceAuthority: authority,

        status: "ready",

        rootCandidates,
      },
    );
  }

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1,

    status: "ready",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1,

    structuralSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    truthSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,

    childTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    authorityBoundChildTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    contextBoundChildTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceShapeResult,

    sourceLeafEvidence,

    authorityResults,

    blockingReasons: [],

    governance: GOVERNANCE,
  };
}
