import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereTokenPosLeafTruthChildEvidenceAdapterResultV1,
} from "./canonical-runtime-manifest-binding-where-token-pos-leaf-truth-child-evidence-adapter-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceBlockedEnvelopeV1,
  type CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1,
} from "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts";

// v1.46 A4.6a1c2a
//
// token.pos-specific source adapter:
//
//   exact A4.6a1c1 result
//     -> generic A4.6a1c2 authority-bound child-truth evidence.
//
// This adapter receives exactly ONE upstream proof object.
//
// It never accepts:
// - caller structuralAuthorityId;
// - caller nodePath;
// - caller matched authority;
// - caller matched leaf;
// - caller child-truth evidence.
//
// READY identity is derived only from the already-proven A4.6a1c1 result:
//
//   structuralAuthorityId = source.matchedShapeAuthority.id
//   nodePath              = source.childTruth.evidence.nodePath
//
// The adapter additionally revalidates exact object identity:
// - matchedShapeAuthority must be the exact authority object preserved in
//   sourceShapeResult.authorities;
// - matchedLeafNode.path must equal childTruth.evidence.nodePath;
// - exactly one node at that path must occur inside matchedShapeAuthority.root;
// - that exact node object must be source.matchedLeafNode.
//
// This does NOT perform a second external authority search.
// It only validates the internal consistency of the exact A4.6a1c1 proof object.
//
// BLOCKED source remains blocked.
// blocked != unresolved.
//
// No truth recomputation.
// No truth-disposition duplication.
// No compound truth composition.

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1 =
  "canonical_runtime_manifest_binding_where_token_pos_authority_bound_child_truth_adapter_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1 =
  "runtime_where_token_pos_authority_bound_child_truth_adapter_a4_6a1c2a_v1" as const;

type SourceResultV1 =
  CanonicalRuntimeManifestBindingWhereTokenPosLeafTruthChildEvidenceAdapterResultV1;

type ReadySourceV1 = Extract<
  SourceResultV1,
  {
    status: "ready";
  }
>;

type SourceNodeV1 = ReadySourceV1["matchedShapeAuthority"]["root"];

type AdapterGovernanceV1 = {
  exactA46a1c1ResultRequired: true;

  exactA46a1c1ProducerRequired: true;

  exactA46a1c1VersionRequired: true;

  exactA46a1c1SpecificationRequired: true;

  exactA46a1cInterfaceSpecificationRequired: true;

  exactA46a1c1GovernanceProofRequired: true;

  sourceReadyRequiredForReadyOutput: true;

  sourceBlockedPreservedAsBlocked: true;

  sourceShapeResultReadyRequired: true;

  exactMatchedShapeAuthorityObjectMembershipRevalidated: true;

  exactMatchedShapeAuthorityObjectMembershipMustBeUnique: true;

  matchedLeafMustRemainLeafOperator: true;

  sourceChildTruthReadyRequired: true;

  sourceChildTruthNodePathRequired: true;

  matchedLeafPathMustEqualChildTruthNodePath: true;

  uniqueLeafPathWithinMatchedAuthorityRevalidated: true;

  exactMatchedLeafObjectIdentityRevalidated: true;

  structuralAuthorityIdDerivedFromMatchedShapeAuthority: true;

  nodePathDerivedFromPreservedChildTruthEvidence: true;

  childTruthEvidenceObjectPreservedWithoutReconstruction: true;

  callerStructuralAuthorityIdAccepted: false;

  callerNodePathAccepted: false;

  callerMatchedAuthorityAccepted: false;

  callerMatchedLeafAccepted: false;

  callerChildTruthEvidenceAccepted: false;

  secondExternalAuthoritySearchPerformed: false;

  sourceTruthRecomputed: false;

  truthDispositionDuplicatedAtBindingLayer: false;

  authorityBoundChildTruthEvidenceConstructed: true;

  compoundTruthComposed: false;

  compoundBooleanCompositionExecuted: false;

  shortCircuitExecuted: false;

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

type ReadyResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1;

  status: "ready";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1;

  authorityBoundInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceResult: ReadySourceV1;

  authorityBoundChildTruth:
    CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1;

  blockingReasons: readonly [];

  governance: AdapterGovernanceV1;
};

type BlockedResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1;

  status: "blocked";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1;

  authorityBoundInterfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceResult: SourceResultV1;

  authorityBoundChildTruth:
    CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceBlockedEnvelopeV1;

  blockingReasons: readonly string[];

  governance: AdapterGovernanceV1;
};

export type CanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthAdapterResultV1 =
  | ReadyResultV1
  | BlockedResultV1;

const GOVERNANCE: AdapterGovernanceV1 = {
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

function collectNodes(
  node: SourceNodeV1,
): SourceNodeV1[] {
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

function exactSourceGovernance(
  source: SourceResultV1,
): boolean {
  const g = source.governance;

  return g.exactA46a1aResultRequired ===
      true &&
    g.exactA46a1aAuthorityContractRequired ===
      true &&
    g.whereShapeAuthorityIdJoinRequired ===
      true &&
    g.whereShapeAuthorityJoinMustBeUnique ===
      true &&
    g.exactManifestIdentityConsistencyRequired ===
      true &&
    g.exactOwnerBindingIdentityConsistencyRequired ===
      true &&
    g.leafPathJoinRequired ===
      true &&
    g.leafPathJoinMustBeUnique ===
      true &&
    g.matchedNodeMustBeLeafOperator ===
      true &&
    g.exactLeafOperatorLabelConsistencyRequired ===
      true &&
    g.exactLeafReferenceWrapperConsistencyRequired ===
      true &&
    g.exactLeafRightOperandConsistencyRequired ===
      true &&
    g.callerNodePathAccepted ===
      false &&
    g.sourceTruthRecomputed ===
      false &&
    g.compoundTruthComposed ===
      false;
}

function block(
  sourceResult: SourceResultV1,
  reasons: readonly string[],
): BlockedResultV1 {
  const blockingReasons = [
    ...reasons,
  ];

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,

    status: "blocked",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,

    authorityBoundInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceResult,

    authorityBoundChildTruth: {
      status: "blocked",

      blockingReasons,
    },

    blockingReasons,

    governance: GOVERNANCE,
  };
}

export function adaptCanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthV1(
  sourceResult: SourceResultV1,
): CanonicalRuntimeManifestBindingWhereTokenPosAuthorityBoundChildTruthAdapterResultV1 {
  if (
    sourceResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1
  ) {
    return block(
      sourceResult,
      [
        "source_a4_6a1c1_producer:not_exact",
      ],
    );
  }

  if (
    sourceResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1
  ) {
    return block(
      sourceResult,
      [
        "source_a4_6a1c1_version:not_exact",
      ],
    );
  }

  if (
    sourceResult.specificationId !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1
  ) {
    return block(
      sourceResult,
      [
        "source_a4_6a1c1_specification:not_exact",
      ],
    );
  }

  if (
    sourceResult.interfaceSpecificationId !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_RESULT_V1
        .childTruthEvidenceInterfaceSpecificationId
  ) {
    return block(
      sourceResult,
      [
        "source_a4_6a1c_interface_specification:not_exact",
      ],
    );
  }

  if (
    !exactSourceGovernance(
      sourceResult,
    )
  ) {
    return block(
      sourceResult,
      [
        "source_a4_6a1c1_governance:not_exact",
      ],
    );
  }

  if (
    sourceResult.status ===
      "blocked"
  ) {
    return block(
      sourceResult,
      [
        "source_a4_6a1c1:blocked",
        ...sourceResult.blockingReasons.map(
          (reason) => `source_a4_6a1c1:${reason}`,
        ),
      ],
    );
  }

  if (
    sourceResult.blockingReasons.length !==
      0
  ) {
    return block(
      sourceResult,
      [
        "source_a4_6a1c1_ready:blocking_reasons_not_empty",
      ],
    );
  }

  if (
    sourceResult.sourceShapeResult.status !==
      "ready"
  ) {
    return block(
      sourceResult,
      [
        "source_shape_result:not_ready",
      ],
    );
  }

  if (
    sourceResult.childTruth.status !==
      "ready" ||
    sourceResult.childTruth.blockingReasons.length !==
      0
  ) {
    return block(
      sourceResult,
      [
        "source_child_truth:not_exact_ready",
      ],
    );
  }

  const authority = sourceResult.matchedShapeAuthority;

  if (
    typeof authority.id !==
      "string" ||
    authority.id.trim().length ===
      0
  ) {
    return block(
      sourceResult,
      [
        "matched_shape_authority_id:missing",
      ],
    );
  }

  const authorityObjectMatches = sourceResult.sourceShapeResult.authorities
    .filter(
      (candidate) =>
        candidate ===
          authority,
    );

  if (
    authorityObjectMatches.length !==
      1
  ) {
    return block(
      sourceResult,
      [
        "matched_shape_authority_object:not_unique_in_source_shape_result",
      ],
    );
  }

  const matchedLeaf = sourceResult.matchedLeafNode;

  if (
    matchedLeaf.shape !==
      "leaf_operator"
  ) {
    return block(
      sourceResult,
      [
        "matched_leaf_node:not_leaf_operator",
      ],
    );
  }

  const childTruthEvidence = sourceResult.childTruth.evidence;

  if (
    typeof childTruthEvidence.nodePath !==
      "string" ||
    childTruthEvidence.nodePath.length ===
      0
  ) {
    return block(
      sourceResult,
      [
        "source_child_truth_node_path:missing",
      ],
    );
  }

  if (
    matchedLeaf.path !==
      childTruthEvidence.nodePath
  ) {
    return block(
      sourceResult,
      [
        "matched_leaf_path:does_not_equal_child_truth_node_path",
      ],
    );
  }

  const pathMatches = collectNodes(
    authority.root,
  ).filter(
    (node) =>
      node.path ===
        childTruthEvidence.nodePath,
  );

  if (
    pathMatches.length !==
      1
  ) {
    return block(
      sourceResult,
      [
        pathMatches.length ===
            0
          ? "matched_leaf_path:not_found_in_matched_authority"
          : "matched_leaf_path:not_unique_in_matched_authority",
      ],
    );
  }

  if (
    pathMatches[0] !==
      matchedLeaf
  ) {
    return block(
      sourceResult,
      [
        "matched_leaf_object:not_exact_authority_tree_object",
      ],
    );
  }

  if (
    pathMatches[0]!.shape !==
      "leaf_operator"
  ) {
    return block(
      sourceResult,
      [
        "matched_authority_path_node:not_leaf_operator",
      ],
    );
  }

  const structuralAuthorityId = authority.id;

  const nodePath = childTruthEvidence.nodePath;

  const authorityBoundChildTruth:
    CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1 =
      {
        status: "ready",

        evidence: {
          authorityBoundChildTruthEvidenceId: [
            "a4_6a1c2a",
            structuralAuthorityId,
            childTruthEvidence.childTruthEvidenceId,
          ].join(
            ":",
          ),

          structuralAuthorityId,

          nodePath,

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
        },

        blockingReasons: [],
      };

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,

    status: "ready",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_AUTHORITY_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,

    authorityBoundInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_AUTHORITY_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceResult,

    authorityBoundChildTruth,

    blockingReasons: [],

    governance: GOVERNANCE,
  };
}
