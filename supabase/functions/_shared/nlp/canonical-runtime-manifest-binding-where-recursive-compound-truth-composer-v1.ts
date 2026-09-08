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
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_VERSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestCompoundTruthDispositionV1,
} from "./canonical-runtime-manifest-binding-where-compound-truth-semantic-capability-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-child-truth-evidence-interface-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1,
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts";

// v1.46 A4.6a1d
//
// Generic recursive compound truth composer.
//
// Inputs:
//   1. exact A4.6a1a structural result
//   2. readonly A4.6a1c2 external READY LEAF evidence[]
//
// A4.6a1b is imported as the exact normative Runtime-language truth
// specification. It is not supplied by the caller.
//
// Composite structural occurrence identity:
//
//   structuralAuthorityId + nodePath
//
// blocked / unsupported / missing evidence are OUTSIDE the three-valued
// truth domain and therefore never participate in all/any/not composition.
//
// The composer recursively evaluates ALL structurally required children
// before parent composition. It performs no semantic short-circuit across
// missing or blocked proof.
//
// External evidence is leaf-only.
// Compound child-truth evidence is produced internally by this composer.
//
// This layer does NOT:
// - import token.pos;
// - import A4.6a1c1 or A4.6a1c2a;
// - select Runtime sentence context;
// - resolve manifest-level WHERE execution;
// - select occurrence winners;
// - execute cardinality;
// - mutate the graph;
// - classify learner error.

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1 =
  "canonical_runtime_manifest_binding_where_recursive_compound_truth_composer_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1 =
  "runtime_where_recursive_compound_truth_composer_a4_6a1d_v1" as const;

type ExternalLeafEvidenceV1 =
  CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceV1;

type ReadyBoundEvidenceV1 =
  CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1;

type ComposerGovernanceV1 = {
  exactA46a1aResultRequired: true;

  exactA46a1aProducerRequired: true;

  exactA46a1aVersionRequired: true;

  exactA46a1bSemanticCapabilityImported: true;

  exactA46a1bSpecificationRequired: true;

  exactA46a1cEvidenceContractUsed: true;

  exactA46a1c2AuthorityBoundEvidenceContractUsed: true;

  callerTruthCapabilityAccepted: false;

  externalEvidenceLeafOnly: true;

  externalCompoundTruthAccepted: false;

  compositeStructuralOccurrenceIdentityRequired: true;

  duplicateCompositeEvidenceKeyBlocks: true;

  unknownStructuralAuthorityBlocks: true;

  unknownStructuralPathBlocks: true;

  externalEvidenceForNonLeafBlocks: true;

  missingLeafEvidenceBlocks: true;

  blockedChildParticipatesInTruthTable: false;

  unsupportedChildParticipatesInTruthTable: false;

  absentRootAssignedImplicitTrue: false;

  recursiveChildrenFullyEvaluatedBeforeParentTruth: true;

  sourceLeafEvidenceObjectsPreservedWithoutReconstruction: true;

  sourceAuthorityObjectsPreservedWithoutReconstruction: true;

  composedChildTruthEvidenceProducedInternally: true;

  composedAuthorityBoundEvidenceProducedInternally: true;

  sourceSpecificLeafAdapterImported: false;

  tokenPosAuthorityImported: false;

  compoundTruthComposed: true;

  booleanExecutionPerformed: true;

  shortCircuitExecuted: false;

  wholeResultBlocksWhenAnyAuthorityBlocks: true;

  partialRuntimeWhereTruthExposedFromBlockedResult: false;

  manifestConditionTruthResolved: false;

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

type AuthorityReadyResultV1 = {
  structuralAuthorityId: string;

  sourceAuthority:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1;

  status: "ready";

  rootTruth: ReadyBoundEvidenceV1;

  composedCompoundTruthEvidence: readonly ReadyBoundEvidenceV1[];
};

type ReadyResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1;

  status: "ready";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1;

  structuralSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1;

  truthSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1;

  childTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  authorityBoundChildTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1;

  sourceLeafEvidence: readonly ExternalLeafEvidenceV1[];

  authorityResults: readonly AuthorityReadyResultV1[];

  blockingReasons: readonly [];

  governance: ComposerGovernanceV1;
};

type BlockedResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1;

  status: "blocked";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1;

  structuralSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1;

  truthSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1;

  childTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  authorityBoundChildTruthEvidenceInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1;

  sourceLeafEvidence: readonly ExternalLeafEvidenceV1[];

  authorityResults: readonly [];

  blockingReasons: readonly string[];

  governance: ComposerGovernanceV1;
};

export type CanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthComposerResultV1 =
  | ReadyResultV1
  | BlockedResultV1;

type NodeEvaluationReadyV1 = {
  status: "ready";

  truth: CanonicalRuntimeManifestCompoundTruthDispositionV1;

  rootTruth: ReadyBoundEvidenceV1;

  composedCompoundTruthEvidence: ReadyBoundEvidenceV1[];
};

type NodeEvaluationBlockedV1 = {
  status: "blocked";

  blockingReasons: string[];
};

type NodeEvaluationV1 =
  | NodeEvaluationReadyV1
  | NodeEvaluationBlockedV1;

const GOVERNANCE: ComposerGovernanceV1 = {
  exactA46a1aResultRequired: true,

  exactA46a1aProducerRequired: true,

  exactA46a1aVersionRequired: true,

  exactA46a1bSemanticCapabilityImported: true,

  exactA46a1bSpecificationRequired: true,

  exactA46a1cEvidenceContractUsed: true,

  exactA46a1c2AuthorityBoundEvidenceContractUsed: true,

  callerTruthCapabilityAccepted: false,

  externalEvidenceLeafOnly: true,

  externalCompoundTruthAccepted: false,

  compositeStructuralOccurrenceIdentityRequired: true,

  duplicateCompositeEvidenceKeyBlocks: true,

  unknownStructuralAuthorityBlocks: true,

  unknownStructuralPathBlocks: true,

  externalEvidenceForNonLeafBlocks: true,

  missingLeafEvidenceBlocks: true,

  blockedChildParticipatesInTruthTable: false,

  unsupportedChildParticipatesInTruthTable: false,

  absentRootAssignedImplicitTrue: false,

  recursiveChildrenFullyEvaluatedBeforeParentTruth: true,

  sourceLeafEvidenceObjectsPreservedWithoutReconstruction: true,

  sourceAuthorityObjectsPreservedWithoutReconstruction: true,

  composedChildTruthEvidenceProducedInternally: true,

  composedAuthorityBoundEvidenceProducedInternally: true,

  sourceSpecificLeafAdapterImported: false,

  tokenPosAuthorityImported: false,

  compoundTruthComposed: true,

  booleanExecutionPerformed: true,

  shortCircuitExecuted: false,

  wholeResultBlocksWhenAnyAuthorityBlocks: true,

  partialRuntimeWhereTruthExposedFromBlockedResult: false,

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

function present(
  value: unknown,
): value is string {
  return typeof value ===
      "string" &&
    value.trim().length >
      0;
}

function truthDisposition(
  value: unknown,
): value is CanonicalRuntimeManifestCompoundTruthDispositionV1 {
  return CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_RESULT_V1
    .truthDispositionDomain.includes(
      value as CanonicalRuntimeManifestCompoundTruthDispositionV1,
    );
}

function compositeKey(
  structuralAuthorityId: string,
  nodePath: string,
): string {
  return JSON.stringify(
    [
      structuralAuthorityId,
      nodePath,
    ],
  );
}

function collectNodes(
  node: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
): CanonicalRuntimeManifestCompoundOperatorShapeNodeV1[] {
  if (
    node.shape !==
      "compound_operator"
  ) {
    return [
      node,
    ];
  }

  return [
    node,
    ...node.children.flatMap(
      collectNodes,
    ),
  ];
}

function exactTruthCapability(): boolean {
  const cap =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_RESULT_V1;

  return cap.producer ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_V1 &&
    cap.producerVersion ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_VERSION_V1 &&
    cap.status ===
      "proven" &&
    cap.authorityKind ===
      "runtime_language_specification" &&
    cap.decisionStatus ===
      "normative" &&
    cap.specificationId ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1 &&
    cap.blockedOutsideTruthDomain ===
      true &&
    cap.unsupportedOutsideTruthDomain ===
      true &&
    cap.truthDispositionDomain.length ===
      3 &&
    cap.truthDispositionDomain[0] ===
      "resolved_true" &&
    cap.truthDispositionDomain[1] ===
      "resolved_false" &&
    cap.truthDispositionDomain[2] ===
      "unresolved" &&
    cap.allSemantics.requiredEncoding ===
      "array" &&
    cap.allSemantics.minimumStructuralArity ===
      2 &&
    cap.allSemantics.resolvedFalseRule ===
      "any_child_resolved_false" &&
    cap.allSemantics.resolvedTrueRule ===
      "all_children_resolved_true" &&
    cap.allSemantics.childOrderAffectsTruthResult ===
      false &&
    cap.anySemantics.requiredEncoding ===
      "array" &&
    cap.anySemantics.minimumStructuralArity ===
      2 &&
    cap.anySemantics.resolvedTrueRule ===
      "any_child_resolved_true" &&
    cap.anySemantics.resolvedFalseRule ===
      "all_children_resolved_false" &&
    cap.anySemantics.childOrderAffectsTruthResult ===
      false &&
    cap.notSemantics.requiredEncoding ===
      "unary_object" &&
    cap.notSemantics.exactStructuralArity ===
      1 &&
    cap.notSemantics.resultByChildDisposition.resolved_true ===
      "resolved_false" &&
    cap.notSemantics.resultByChildDisposition.resolved_false ===
      "resolved_true" &&
    cap.notSemantics.resultByChildDisposition.unresolved ===
      "unresolved" &&
    cap.unresolvedSemantics.unresolvedMayCollapseToFalse ===
      false &&
    cap.unresolvedSemantics.unresolvedMayCollapseToTrue ===
      false &&
    cap.unsupportedSemantics.unsupportedShapeIsFalse ===
      false &&
    cap.unsupportedSemantics.unsupportedShapeIsTrue ===
      false &&
    cap.governance.shortCircuitExecuted ===
      false;
}

function exactExternalEvidence(
  evidence: ExternalLeafEvidenceV1,
): boolean {
  const p = evidence.provenance;

  return present(
    evidence.authorityBoundChildTruthEvidenceId,
  ) &&
    present(
      evidence.structuralAuthorityId,
    ) &&
    present(
      evidence.nodePath,
    ) &&
    evidence.childTruthEvidence.nodePath ===
      evidence.nodePath &&
    evidence.childTruthEvidence.sourceKind ===
      "leaf_condition_truth" &&
    truthDisposition(
      evidence.childTruthEvidence.truthDisposition,
    ) &&
    present(
      evidence.childTruthEvidence.childTruthEvidenceId,
    ) &&
    present(
      evidence.childTruthEvidence.sourceProducer,
    ) &&
    present(
      evidence.childTruthEvidence.sourceProducerVersion,
    ) &&
    present(
      evidence.childTruthEvidence.sourceEvidenceId,
    ) &&
    p.exactStructuralAuthorityIdentityClaimed ===
      true &&
    p.exactStructuralNodePathClaimed ===
      true &&
    p.structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity ===
      true &&
    p.childTruthEvidenceObjectPreservedWithoutReconstruction ===
      true &&
    p.childTruthNodePathMatchesBoundNodePath ===
      true &&
    p.authorityNodePairProvenBySourceAdapter ===
      true &&
    p.structuralAuthorityInferredByInterface ===
      false &&
    p.nodePathInferredByInterface ===
      false &&
    p.callerSuppliedAuthorityNodePairAcceptedAsProof ===
      false &&
    p.truthDispositionDuplicatedAtBindingLayer ===
      false &&
    p.truthRecomputedByInterface ===
      false;
}

function block(
  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  sourceLeafEvidence: readonly ExternalLeafEvidenceV1[],
  reasons: readonly string[],
): BlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1,

    status: "blocked",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1,

    structuralSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    truthSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,

    childTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    authorityBoundChildTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceShapeResult,

    sourceLeafEvidence,

    authorityResults: [],

    blockingReasons: [
      ...reasons,
    ],

    governance: GOVERNANCE,
  };
}

function composeDisposition(
  node: Extract<
    CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
    {
      shape: "compound_operator";
    }
  >,
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
  const cap =
    CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_RESULT_V1;

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

      reason: `compound:${node.path}:child_truth_outside_exact_domain`,
    };
  }

  if (
    node.operatorKey ===
      "all"
  ) {
    if (
      node.encoding !==
        cap.allSemantics.requiredEncoding ||
      children.length <
        cap.allSemantics.minimumStructuralArity
    ) {
      return {
        status: "blocked",

        reason: `compound:${node.path}:all_structural_contract_mismatch`,
      };
    }

    if (
      resolvedFalseCount >
        0
    ) {
      return {
        status: "ready",

        truth: cap.allSemantics.resultByVectorClass.anyResolvedFalse,
      };
    }

    if (
      resolvedTrueCount ===
        children.length
    ) {
      return {
        status: "ready",

        truth: cap.allSemantics.resultByVectorClass.allResolvedTrue,
      };
    }

    return {
      status: "ready",

      truth: cap.allSemantics.resultByVectorClass.otherwise,
    };
  }

  if (
    node.operatorKey ===
      "any"
  ) {
    if (
      node.encoding !==
        cap.anySemantics.requiredEncoding ||
      children.length <
        cap.anySemantics.minimumStructuralArity
    ) {
      return {
        status: "blocked",

        reason: `compound:${node.path}:any_structural_contract_mismatch`,
      };
    }

    if (
      resolvedTrueCount >
        0
    ) {
      return {
        status: "ready",

        truth: cap.anySemantics.resultByVectorClass.anyResolvedTrue,
      };
    }

    if (
      resolvedFalseCount ===
        children.length
    ) {
      return {
        status: "ready",

        truth: cap.anySemantics.resultByVectorClass.allResolvedFalse,
      };
    }

    return {
      status: "ready",

      truth: cap.anySemantics.resultByVectorClass.otherwise,
    };
  }

  if (
    node.operatorKey ===
      "not"
  ) {
    if (
      node.encoding !==
        cap.notSemantics.requiredEncoding ||
      children.length !==
        cap.notSemantics.exactStructuralArity
    ) {
      return {
        status: "blocked",

        reason: `compound:${node.path}:not_structural_contract_mismatch`,
      };
    }

    return {
      status: "ready",

      truth: cap.notSemantics.resultByChildDisposition[
        children[0]!
      ],
    };
  }

  return {
    status: "blocked",

    reason: `compound:${node.path}:operator_outside_exact_a4_6a1b_domain`,
  };
}

function composedEvidence(
  authority:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
  node: Extract<
    CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
    {
      shape: "compound_operator";
    }
  >,
  childResults: readonly NodeEvaluationReadyV1[],
  truth: CanonicalRuntimeManifestCompoundTruthDispositionV1,
): ReadyBoundEvidenceV1 {
  const childTruthEvidence = childResults.map(
    (child) => child.rootTruth.evidence.childTruthEvidence,
  );

  const compositionEvidenceObject = {
    structuralAuthorityId: authority.id,

    nodePath: node.path,

    operatorKey: node.operatorKey,

    encoding: node.encoding,

    sourceNode: node,

    childTruthEvidence,

    childTruthDispositions: childTruthEvidence.map(
      (evidence) => evidence.truthDisposition,
    ),

    semanticCapability:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SEMANTIC_CAPABILITY_RESULT_V1,
  };

  const sourceEvidenceId = [
    "a4_6a1d",
    authority.id,
    node.path,
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

    nodePath: node.path,

    sourceKind: "compound_condition_truth",

    truthDisposition: truth,

    sourceProducer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1,

    sourceProducerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1,

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

  return {
    status: "ready",

    evidence: {
      authorityBoundChildTruthEvidenceId: [
        sourceEvidenceId,
        genericChildTruth.childTruthEvidenceId,
      ].join(
        ":",
      ),

      structuralAuthorityId: authority.id,

      nodePath: node.path,

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
    },

    blockingReasons: [],
  };
}

function evaluateNode(
  authority:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
  node: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  evidenceByKey: ReadonlyMap<string, ExternalLeafEvidenceV1>,
): NodeEvaluationV1 {
  if (
    node.shape ===
      "absent"
  ) {
    return {
      status: "blocked",

      blockingReasons: [
        `node:${authority.id}:${node.path}:absent_outside_compound_truth_domain`,
      ],
    };
  }

  if (
    node.shape ===
      "unsupported"
  ) {
    return {
      status: "blocked",

      blockingReasons: [
        `node:${authority.id}:${node.path}:unsupported_outside_compound_truth_domain:${node.reason}`,
      ],
    };
  }

  if (
    node.shape ===
      "leaf_operator"
  ) {
    const key = compositeKey(
      authority.id,
      node.path,
    );

    const evidence = evidenceByKey.get(
      key,
    );

    if (
      evidence ===
        undefined
    ) {
      return {
        status: "blocked",

        blockingReasons: [
          `leaf:${authority.id}:${node.path}:missing_external_ready_evidence`,
        ],
      };
    }

    return {
      status: "ready",

      truth: evidence.childTruthEvidence.truthDisposition,

      rootTruth: {
        status: "ready",

        evidence,

        blockingReasons: [],
      },

      composedCompoundTruthEvidence: [],
    };
  }

  const childResults = node.children.map(
    (child) =>
      evaluateNode(
        authority,
        child,
        evidenceByKey,
      ),
  );

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

      blockingReasons: [
        `compound:${authority.id}:${node.path}:required_child_blocked`,
        ...blockedReasons,
      ],
    };
  }

  const readyChildren = childResults as NodeEvaluationReadyV1[];

  const disposition = composeDisposition(
    node,
    readyChildren.map(
      (child) => child.truth,
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

  const current = composedEvidence(
    authority,
    node,
    readyChildren,
    disposition.truth,
  );

  return {
    status: "ready",

    truth: disposition.truth,

    rootTruth: current,

    composedCompoundTruthEvidence: [
      ...readyChildren.flatMap(
        (child) => child.composedCompoundTruthEvidence,
      ),
      current,
    ],
  };
}

export function composeCanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthV1(
  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  sourceLeafEvidence: readonly ExternalLeafEvidenceV1[],
): CanonicalRuntimeManifestBindingWhereRecursiveCompoundTruthComposerResultV1 {
  if (
    sourceShapeResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1
  ) {
    return block(
      sourceShapeResult,
      sourceLeafEvidence,
      [
        "source_a4_6a1a_producer:not_exact",
      ],
    );
  }

  if (
    sourceShapeResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1
  ) {
    return block(
      sourceShapeResult,
      sourceLeafEvidence,
      [
        "source_a4_6a1a_version:not_exact",
      ],
    );
  }

  if (
    sourceShapeResult.status !==
      "ready" ||
    sourceShapeResult.blockingReasons.length !==
      0
  ) {
    return block(
      sourceShapeResult,
      sourceLeafEvidence,
      [
        "source_a4_6a1a_result:not_exact_ready",
      ],
    );
  }

  if (
    !exactTruthCapability()
  ) {
    return block(
      sourceShapeResult,
      sourceLeafEvidence,
      [
        "a4_6a1b_semantic_capability:not_exact",
      ],
    );
  }

  if (
    sourceShapeResult.authorities.length ===
      0
  ) {
    return block(
      sourceShapeResult,
      sourceLeafEvidence,
      [
        "source_a4_6a1a_result:no_authorities",
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
      )
    ) {
      structuralReasons.push(
        "source_authority:id_missing",
      );

      continue;
    }

    if (
      authorityById.has(
        authority.id,
      )
    ) {
      structuralReasons.push(
        `source_authority:${authority.id}:duplicate_identity`,
      );

      continue;
    }

    if (
      authority.status !==
        "candidate" ||
      authority.specificationId !==
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1 ||
      authority.authorityKind !==
        "runtime_language_structural_specification" ||
      authority.decisionStatus !==
        "normative"
    ) {
      structuralReasons.push(
        `source_authority:${authority.id}:contract_not_exact`,
      );

      continue;
    }

    authorityById.set(
      authority.id,
      authority,
    );

    const nodeMap = new Map<
      string,
      CanonicalRuntimeManifestCompoundOperatorShapeNodeV1
    >();

    for (
      const node of collectNodes(
        authority.root,
      )
    ) {
      if (
        !present(
          node.path,
        )
      ) {
        structuralReasons.push(
          `source_authority:${authority.id}:node_path_missing`,
        );

        continue;
      }

      if (
        nodeMap.has(
          node.path,
        )
      ) {
        structuralReasons.push(
          `source_authority:${authority.id}:duplicate_node_path:${node.path}`,
        );

        continue;
      }

      nodeMap.set(
        node.path,
        node,
      );
    }

    nodesByAuthority.set(
      authority.id,
      nodeMap,
    );
  }

  if (
    structuralReasons.length >
      0
  ) {
    return block(
      sourceShapeResult,
      sourceLeafEvidence,
      structuralReasons,
    );
  }

  const evidenceByKey = new Map<
    string,
    ExternalLeafEvidenceV1
  >();

  const evidenceReasons: string[] = [];

  for (
    const evidence of sourceLeafEvidence
  ) {
    if (
      !exactExternalEvidence(
        evidence,
      )
    ) {
      evidenceReasons.push(
        `external_evidence:${evidence.authorityBoundChildTruthEvidenceId}:contract_not_exact`,
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
        `external_evidence:${evidence.authorityBoundChildTruthEvidenceId}:unknown_structural_authority`,
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
        `external_evidence:${evidence.authorityBoundChildTruthEvidenceId}:unknown_structural_path`,
      );

      continue;
    }

    if (
      node.shape !==
        "leaf_operator"
    ) {
      evidenceReasons.push(
        `external_evidence:${evidence.authorityBoundChildTruthEvidenceId}:external_evidence_for_non_leaf`,
      );

      continue;
    }

    const key = compositeKey(
      evidence.structuralAuthorityId,
      evidence.nodePath,
    );

    if (
      evidenceByKey.has(
        key,
      )
    ) {
      evidenceReasons.push(
        `external_evidence:${key}:duplicate_composite_key`,
      );

      continue;
    }

    evidenceByKey.set(
      key,
      evidence,
    );
  }

  if (
    evidenceReasons.length >
      0
  ) {
    return block(
      sourceShapeResult,
      sourceLeafEvidence,
      evidenceReasons,
    );
  }

  const evaluatedAuthorities = sourceShapeResult.authorities.map(
    (authority) => {
      const evaluation = evaluateNode(
        authority,
        authority.root,
        evidenceByKey,
      );

      return {
        authority,
        evaluation,
      };
    },
  );

  const authorityBlockingReasons = evaluatedAuthorities.flatMap(
    ({
      authority,
      evaluation,
    }) =>
      evaluation.status ===
          "blocked"
        ? [
          `authority:${authority.id}:blocked`,
          ...evaluation.blockingReasons,
        ]
        : [],
  );

  if (
    authorityBlockingReasons.length >
      0
  ) {
    return block(
      sourceShapeResult,
      sourceLeafEvidence,
      authorityBlockingReasons,
    );
  }

  const authorityResults: AuthorityReadyResultV1[] = evaluatedAuthorities.map(
    ({
      authority,
      evaluation,
    }) => {
      const ready = evaluation as NodeEvaluationReadyV1;

      return {
        structuralAuthorityId: authority.id,

        sourceAuthority: authority,

        status: "ready",

        rootTruth: ready.rootTruth,

        composedCompoundTruthEvidence: ready.composedCompoundTruthEvidence,
      };
    },
  );

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_VERSION_V1,

    status: "ready",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_RECURSIVE_COMPOUND_TRUTH_COMPOSER_SPECIFICATION_ID_V1,

    structuralSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,

    truthSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,

    childTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    authorityBoundChildTruthEvidenceInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceShapeResult,

    sourceLeafEvidence,

    authorityResults,

    blockingReasons: [],

    governance: GOVERNANCE,
  };
}
