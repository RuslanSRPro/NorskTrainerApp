import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  type CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereChildTruthEvidenceBlockedEnvelopeV1,
  type CanonicalRuntimeManifestWhereChildTruthEvidenceReadyEnvelopeV1,
} from "./canonical-runtime-manifest-binding-where-child-truth-evidence-interface-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V2,
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V2,
} from "./canonical-runtime-token-pos-condition-truth-composition-v2.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3,
  CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3,
  type CanonicalRuntimeTokenPosConditionTruthCompositionResultV3,
} from "./canonical-runtime-token-pos-condition-truth-composition-v3.ts";

// v1.46 A4.6a1c1
//
// token.pos leaf truth -> generic child-truth evidence adapter.
//
// Source-specific executable bridge.
//
// Authoritative join:
//
//   D2b1-v3
//     -> preserved V2 evidence
//     -> preserved D2a evidence
//     -> preserved C2 evidence
//     -> preserved expected authority
//
//   expected.whereShapeAuthorityId
//     == A4.6a1a.sourceWhereShapeAuthorityId
//
//   expected.leafPath
//     == exactly one traversed A4.6a1a leaf_operator node.path
//
// Caller-supplied nodePath is forbidden.
//
// This adapter does NOT:
// - recompute token.pos truth;
// - choose Runtime occurrence;
// - create missing truth for synthetic unary-not leaves;
// - compose all/any/not;
// - resolve manifest truth;
// - enforce cardinality.

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1 =
  "canonical_runtime_manifest_binding_where_token_pos_leaf_truth_child_evidence_adapter_v1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1 =
  "1" as const;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1 =
  "runtime_where_token_pos_leaf_truth_child_evidence_adapter_a4_6a1c1_v1" as const;

type LeafNodeV1 = Extract<
  CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  {
    shape: "leaf_operator";
  }
>;

type AdapterGovernanceV1 = {
  exactD2b1V3ResultRequired: true;

  exactPreservedD2b1V2ResultRequired: true;

  exactPreservedV2EvidenceIdentityRequired: true;

  preservedD2aC2ExpectedAuthorityLineageConsumed: true;

  exactA46a1aResultRequired: true;

  exactA46a1aAuthorityContractRequired: true;

  whereShapeAuthorityIdJoinRequired: true;

  whereShapeAuthorityJoinMustBeUnique: true;

  exactManifestIdentityConsistencyRequired: true;

  exactOwnerBindingIdentityConsistencyRequired: true;

  leafPathJoinRequired: true;

  leafPathJoinMustBeUnique: true;

  matchedNodeMustBeLeafOperator: true;

  exactLeafOperatorLabelConsistencyRequired: true;

  exactLeafReferenceWrapperConsistencyRequired: true;

  exactLeafRightOperandConsistencyRequired: true;

  callerNodePathAccepted: false;

  sourceTruthRecomputed: false;

  sourceComparisonRecomputed: false;

  structuralPathInferredWithoutAuthority: false;

  childTruthEvidenceAdapted: true;

  syntheticUnaryNotLeafTruthCreated: false;

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
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1;

  status: "ready";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1;

  interfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceLeafTruthResult:
    CanonicalRuntimeTokenPosConditionTruthCompositionResultV3;

  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1;

  matchedShapeAuthority:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1;

  matchedLeafNode: LeafNodeV1;

  childTruth: CanonicalRuntimeManifestWhereChildTruthEvidenceReadyEnvelopeV1;

  blockingReasons: readonly [];

  governance: AdapterGovernanceV1;
};

type BlockedResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1;

  status: "blocked";

  specificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1;

  interfaceSpecificationId:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

  sourceLeafTruthResult:
    CanonicalRuntimeTokenPosConditionTruthCompositionResultV3;

  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1;

  matchedShapeAuthority: null;

  matchedLeafNode: null;

  childTruth: CanonicalRuntimeManifestWhereChildTruthEvidenceBlockedEnvelopeV1;

  blockingReasons: string[];

  governance: AdapterGovernanceV1;
};

export type CanonicalRuntimeManifestBindingWhereTokenPosLeafTruthChildEvidenceAdapterResultV1 =
  | ReadyResultV1
  | BlockedResultV1;

const GOVERNANCE: AdapterGovernanceV1 = {
  exactD2b1V3ResultRequired: true,

  exactPreservedD2b1V2ResultRequired: true,

  exactPreservedV2EvidenceIdentityRequired: true,

  preservedD2aC2ExpectedAuthorityLineageConsumed: true,

  exactA46a1aResultRequired: true,

  exactA46a1aAuthorityContractRequired: true,

  whereShapeAuthorityIdJoinRequired: true,

  whereShapeAuthorityJoinMustBeUnique: true,

  exactManifestIdentityConsistencyRequired: true,

  exactOwnerBindingIdentityConsistencyRequired: true,

  leafPathJoinRequired: true,

  leafPathJoinMustBeUnique: true,

  matchedNodeMustBeLeafOperator: true,

  exactLeafOperatorLabelConsistencyRequired: true,

  exactLeafReferenceWrapperConsistencyRequired: true,

  exactLeafRightOperandConsistencyRequired: true,

  callerNodePathAccepted: false,

  sourceTruthRecomputed: false,

  sourceComparisonRecomputed: false,

  structuralPathInferredWithoutAuthority: false,

  childTruthEvidenceAdapted: true,

  syntheticUnaryNotLeafTruthCreated: false,

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

function present(
  value: unknown,
): value is string {
  return typeof value ===
      "string" &&
    value.length >
      0;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value ===
      "object" &&
    value !==
      null &&
    !Array.isArray(
      value,
    );
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return Array.from(
    new Set(
      values,
    ),
  ).sort();
}

function blocked(
  sourceLeafTruthResult:
    CanonicalRuntimeTokenPosConditionTruthCompositionResultV3,
  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  reasons: string[],
): BlockedResultV1 {
  const blockingReasons = uniqueSorted(
    reasons,
  );

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1,

    status: "blocked",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1,

    interfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceLeafTruthResult,

    sourceShapeResult,

    matchedShapeAuthority: null,

    matchedLeafNode: null,

    childTruth: {
      status: "blocked",

      blockingReasons,
    },

    blockingReasons,

    governance: GOVERNANCE,
  };
}

function exactV3Governance(
  value: unknown,
): boolean {
  if (
    !isRecord(
      value,
    )
  ) {
    return false;
  }

  return value.exactD2b0ComparisonStateDomainConsumed ===
      true &&
    value.comparisonStateMembershipValidatedBeforeV2Delegation ===
      true &&
    value.validComparisonStateDelegatesToImmutableV2 ===
      true &&
    value.v2TruthSemanticsReimplemented ===
      false &&
    value.v2ContractMutated ===
      false &&
    value.compoundWhereTruthResolved ===
      false &&
    value.compoundBooleanCompositionExecuted ===
      false &&
    value.manifestConditionTruthResolved ===
      false &&
    value.cardinalitySemanticsResolved ===
      false &&
    value.cardinalityEnforcementPerformed ===
      false &&
    value.graphMutationPerformed ===
      false &&
    value.learnerErrorClassified ===
      false &&
    value.frozenGrammarReadOnly ===
      true;
}

function exactV2EvidenceGovernance(
  value: unknown,
): boolean {
  if (
    !isRecord(
      value,
    )
  ) {
    return false;
  }

  return value.exactD2aApplicabilityEvidenceRequired ===
      true &&
    value.exactD2b0TruthSemanticCapabilitySingletonRequired ===
      true &&
    value.preservedC2ComparisonEvidenceConsumedThroughD2aOnly ===
      true &&
    value.leafConditionTruthDispositionProduced ===
      true &&
    value.comparisonRecomputed ===
      false &&
    value.runtimeSentenceContextSelected ===
      false &&
    value.finalRuntimeOccurrenceBindingPerformed ===
      false &&
    value.compoundWhereTruthResolved ===
      false &&
    value.manifestConditionTruthResolved ===
      false &&
    value.cardinalitySemanticsResolved ===
      false &&
    value.graphMutationPerformed ===
      false &&
    value.learnerErrorClassified ===
      false &&
    value.frozenGrammarReadOnly ===
      true;
}

function exactA46a1aAuthority(
  authority:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
): boolean {
  const g = authority.governance;

  return authority.status ===
      "candidate" &&
    authority.specificationId ===
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_SPECIFICATION_ID_V1 &&
    authority.authorityKind ===
      "runtime_language_structural_specification" &&
    authority.decisionStatus ===
      "normative" &&
    present(
      authority.id,
    ) &&
    present(
      authority.sourceWhereShapeAuthorityId,
    ) &&
    authority.sourceWhereShapeAuthority.id ===
      authority.sourceWhereShapeAuthorityId &&
    present(
      authority.bindingDefinitionAuthorityId,
    ) &&
    present(
      authority.manifestId,
    ) &&
    present(
      authority.manifestCode,
    ) &&
    present(
      authority.bindingName,
    ) &&
    g.exactA46a1ResultRequired ===
      true &&
    g.exactA46a1AuthorityRequired ===
      true &&
    g.sourceA46a1AuthorityObjectPreservedWithoutReconstruction ===
      true &&
    g.sourceStructuralPathIdentityPreserved ===
      true &&
    g.sourceRawSnapshotMutated ===
      false &&
    g.operatorTruthSemanticsResolved ===
      false &&
    g.compoundTruthComposed ===
      false &&
    g.compoundBooleanCompositionExecuted ===
      false &&
    g.leafTruthResolved ===
      false &&
    g.cardinalitySemanticsResolved ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.frozenGrammarReadOnly ===
      true;
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

function exactReferenceWrapper(
  snapshot: unknown,
  expectedReference: string,
): boolean {
  if (
    !isRecord(
      snapshot,
    )
  ) {
    return false;
  }

  const keys = Object.keys(
    snapshot,
  );

  return keys.length ===
      1 &&
    keys[0] ===
      "ref" &&
    snapshot.ref ===
      expectedReference;
}

function exactTruthDisposition(
  value: unknown,
): value is
  | "resolved_true"
  | "resolved_false"
  | "unresolved" {
  return value ===
      "resolved_true" ||
    value ===
      "resolved_false" ||
    value ===
      "unresolved";
}

export function adaptCanonicalRuntimeTokenPosLeafTruthToChildEvidenceV1(
  sourceLeafTruthResult:
    CanonicalRuntimeTokenPosConditionTruthCompositionResultV3,
  sourceShapeResult:
    CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
): CanonicalRuntimeManifestBindingWhereTokenPosLeafTruthChildEvidenceAdapterResultV1 {
  if (
    sourceLeafTruthResult.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V3 ||
    sourceLeafTruthResult.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V3 ||
    !exactV3Governance(
      sourceLeafTruthResult.governance,
    )
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "d2b1_v3:not_exact_contract",
      ],
    );
  }

  if (
    sourceLeafTruthResult.status ===
      "blocked"
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "d2b1_v3:blocked",
        ...sourceLeafTruthResult.blockingReasons.map(
          (reason) => `d2b1_v3:${reason}`,
        ),
      ],
    );
  }

  if (
    sourceLeafTruthResult.status !==
      "ready" ||
    sourceLeafTruthResult.blockingReasons.length !==
      0 ||
    sourceLeafTruthResult.evidence ===
      undefined ||
    sourceLeafTruthResult.sourceV2Result ===
      null
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "d2b1_v3:not_exact_ready",
      ],
    );
  }

  const v2 = sourceLeafTruthResult.sourceV2Result;

  if (
    v2.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_V2 ||
    v2.producerVersion !==
      CANONICAL_RUNTIME_TOKEN_POS_CONDITION_TRUTH_COMPOSITION_VERSION_V2 ||
    v2.status !==
      "ready" ||
    v2.blockingReasons.length !==
      0 ||
    v2.evidence ===
      undefined ||
    v2.evidence !==
      sourceLeafTruthResult.evidence
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "d2b1_v2_lineage:not_exact_ready",
      ],
    );
  }

  const evidence = sourceLeafTruthResult.evidence;

  if (
    !exactV2EvidenceGovernance(
      evidence.governance,
    ) ||
    !present(
      evidence.conditionTruthCompositionId,
    ) ||
    !exactTruthDisposition(
      evidence.truthDisposition,
    )
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "d2b1_v2_evidence:not_exact_contract",
      ],
    );
  }

  const d2a = evidence.d2aApplicabilityEvidence;

  const c2 = d2a.c2ComparisonEvidence;

  const expected = c2.expectedAuthority;

  if (
    !present(
      expected.id,
    ) ||
    evidence.expectedAuthorityId !==
      expected.id ||
    d2a.expectedAuthorityId !==
      expected.id ||
    c2.expectedAuthorityId !==
      expected.id ||
    !present(
      expected.whereShapeAuthorityId,
    ) ||
    !present(
      expected.leafPath,
    ) ||
    !present(
      expected.manifestId,
    ) ||
    !present(
      expected.ownerBindingDefinitionAuthorityId,
    ) ||
    !present(
      expected.ownerBindingName,
    ) ||
    expected.sourceOperatorLabelRaw !==
      "eq" ||
    !present(
      expected.leftReferenceExpression,
    )
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "expected_authority_lineage:not_exact",
      ],
    );
  }

  if (
    sourceShapeResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_V1 ||
    sourceShapeResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_COMPOUND_OPERATOR_SHAPE_EXTENSION_VERSION_V1 ||
    sourceShapeResult.status !==
      "ready" ||
    sourceShapeResult.blockingReasons.length !==
      0
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "a4_6a1a_result:not_exact_ready",
      ],
    );
  }

  const seenAuthorityIds = new Set<string>();

  for (
    const authority of sourceShapeResult.authorities
  ) {
    if (
      seenAuthorityIds.has(
        authority.id,
      )
    ) {
      return blocked(
        sourceLeafTruthResult,
        sourceShapeResult,
        [
          "a4_6a1a_result:duplicate_authority_id",
        ],
      );
    }

    seenAuthorityIds.add(
      authority.id,
    );

    if (
      !exactA46a1aAuthority(
        authority,
      )
    ) {
      return blocked(
        sourceLeafTruthResult,
        sourceShapeResult,
        [
          `a4_6a1a_authority:${authority.id}:unsafe_contract`,
        ],
      );
    }
  }

  const authorityMatches = sourceShapeResult.authorities.filter(
    (authority) =>
      authority.sourceWhereShapeAuthorityId ===
        expected.whereShapeAuthorityId,
  );

  if (
    authorityMatches.length ===
      0
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "where_shape_authority_join:no_match",
      ],
    );
  }

  if (
    authorityMatches.length !==
      1
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "where_shape_authority_join:multiple_matches",
      ],
    );
  }

  const authority = authorityMatches[0]!;

  if (
    authority.manifestId !==
      expected.manifestId
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "manifest_identity:mismatch",
      ],
    );
  }

  if (
    authority.bindingDefinitionAuthorityId !==
      expected.ownerBindingDefinitionAuthorityId ||
    authority.bindingName !==
      expected.ownerBindingName
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "owner_binding_identity:mismatch",
      ],
    );
  }

  const pathMatches = collectNodes(
    authority.root,
  ).filter(
    (node) =>
      node.path ===
        expected.leafPath,
  );

  if (
    pathMatches.length ===
      0
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "leaf_path_join:no_match",
      ],
    );
  }

  if (
    pathMatches.length !==
      1
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "leaf_path_join:multiple_matches",
      ],
    );
  }

  const matched = pathMatches[0]!;

  if (
    matched.shape !==
      "leaf_operator"
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "leaf_path_join:not_leaf_operator",
      ],
    );
  }

  if (
    matched.operatorLabel !==
      expected.sourceOperatorLabelRaw
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "leaf_structure:operator_mismatch",
      ],
    );
  }

  if (
    !exactReferenceWrapper(
      matched.leftOperandSnapshot,
      expected.leftReferenceExpression,
    )
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "leaf_structure:left_reference_mismatch",
      ],
    );
  }

  if (
    matched.hasRightOperand !==
      true ||
    matched.rightOperandSnapshot !==
      expected.rightOperandSnapshot
  ) {
    return blocked(
      sourceLeafTruthResult,
      sourceShapeResult,
      [
        "leaf_structure:right_operand_mismatch",
      ],
    );
  }

  const childTruthEvidenceId = [
    "runtime-where-token-pos-child-truth-a4-6a1c1-v1",
    encodeURIComponent(
      evidence.conditionTruthCompositionId,
    ),
    encodeURIComponent(
      authority.id,
    ),
    encodeURIComponent(
      matched.path,
    ),
  ].join(
    ":",
  );

  const childTruth:
    CanonicalRuntimeManifestWhereChildTruthEvidenceReadyEnvelopeV1 = {
      status: "ready",

      evidence: {
        childTruthEvidenceId,

        nodePath: matched.path,

        sourceKind: "leaf_condition_truth",

        truthDisposition: evidence.truthDisposition,

        sourceProducer: sourceLeafTruthResult.producer,

        sourceProducerVersion: sourceLeafTruthResult.producerVersion,

        sourceEvidenceId: evidence.conditionTruthCompositionId,

        sourceEvidenceObject: evidence,

        provenance: {
          exactStructuralNodePathClaimed: true,

          truthDispositionSuppliedBySourceAuthority: true,

          sourceProducerIdentityPreserved: true,

          sourceEvidenceIdentityPreserved: true,

          sourceEvidenceObjectPreservedWithoutReconstruction: true,

          truthRecomputedByInterface: false,

          booleanTruthInferredByInterface: false,
        },
      },

      blockingReasons: [],
    };

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_VERSION_V1,

    status: "ready",

    specificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_TOKEN_POS_LEAF_TRUTH_CHILD_EVIDENCE_ADAPTER_SPECIFICATION_ID_V1,

    interfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    sourceLeafTruthResult,

    sourceShapeResult,

    matchedShapeAuthority: authority,

    matchedLeafNode: matched,

    childTruth,

    blockingReasons: [],

    governance: GOVERNANCE,
  };
}
