import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionMemberEvidenceV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-bound-condition-evidence-v1.ts";

import {
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeAuthorityV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-leaf-structural-bridge-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";

import {
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1,
  type CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import type {
  CanonicalRuntimeManifestWhereChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-child-truth-evidence-interface-v1.ts";

import type {
  CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1,
} from "./canonical-runtime-manifest-binding-where-authority-bound-child-truth-evidence-interface-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-authority-bound-leaf-truth-evidence-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1 =
  "1.0.0" as const;

type ManifestRows = Parameters<
  typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1
>[5];

type A46a1aAuthority =
  CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionAuthorityV1;

type LeafNode = Extract<
  CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  { shape: "leaf_operator" }
>;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceV1 =
  {
    leafTruthEvidenceId: string;

    status:
      "proven_current_snapshot_bound_where_authority_bound_leaf_truth_evidence";

    expectedSiteAuthorityId: string;

    manifestId: string;
    manifestCode: string;

    ownerBindingName: string;
    ownerBindingDefinitionAuthorityId: string;

    referencedBindingName: string;
    referencedBindingDefinitionAuthorityId: string;

    whereShapeAuthorityId: string;

    manifestLeafSiteAuthorityId: string;
    manifestLeafPath: string;

    structuralAuthorityId: string;
    structuralNodePath: string;

    snapshotIdentityId: string;
    snapshotSentenceOccurrenceIdentityId: string;
    snapshotTokenOccurrenceIdentityId: string;

    sourceBoundConditionMemberEvidence:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionMemberEvidenceV1;

    sourceStructuralBridgeAuthority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeAuthorityV1;

    sourceA46a1aAuthority: A46a1aAuthority;
    sourceA46a1aLeafNode: LeafNode;

    childTruthEvidence: CanonicalRuntimeManifestWhereChildTruthEvidenceV1;

    authorityBoundChildTruth:
      CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceAuthorityV1 =
  {
    authorityId: string;

    status:
      "proven_current_snapshot_bound_where_authority_bound_leaf_truth_evidence";

    sourceBoundConditionAuthorityId: string;

    evidence:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceV1[];

    evidenceCount: number;

    governance: {
      closedBoundConditionPublicDerivationReexecuted: true;
      suppliedBoundConditionWrapperAcceptedAsProof: false;

      closedStructuralBridgePublicDerivationReexecuted: true;
      suppliedStructuralBridgeWrapperAcceptedAsProof: false;

      manifestStructuralChainIndependentlyRederived: true;
      exactA46a1aStructuralAuthorityRequired: true;
      exactA46a1aLeafNodeRequired: true;

      exactExpectedSiteAuthorityJoinRequired: true;
      exactManifestIdentityJoinRequired: true;
      exactReferencedBindingDefinitionAuthorityJoinRequired: true;
      exactReferencedBindingNameJoinRequired: true;

      exactOwnerBindingDefinitionAuthorityJoinRequired: true;
      exactOwnerBindingNameJoinRequired: true;
      exactWhereShapeAuthorityJoinRequired: true;

      structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity: true;

      manifestLeafPathTakenOnlyFromStructuralBridge: true;
      sourceReferencePathTreatedAsLeafPath: false;

      exactlyOneBoundMemberRequiredForLeafTruthMaterialization: true;
      emptyBoundCollectionTruthInferred: false;
      multipleBoundMemberTruthAggregated: false;

      membersEveryBooleanTruthUsed: false;
      membersSomeBooleanTruthUsed: false;

      sourceBoundConditionTruthConsumedNotRecomputed: true;
      sourceComparisonRecomputed: false;

      genericChildTruthEvidenceConstructed: true;
      authorityBoundChildTruthEvidenceConstructed: true;

      recursiveWhereCompositionPerformed: false;
      compoundTruthComposed: false;
      manifestConditionTruthResolved: false;
      runtimeConditionTruthResolved: false;
      bindingTruthResolved: false;
      whereEvaluationPerformed: false;

      learnerErrorClassified: false;
      constraintPropagationInvoked: false;
      canonicalDependencyEdgeGenerated: false;
      clauseNodeGenerated: false;
      graphMutationPerformed: false;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1;

    status: "ready";

    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceAuthorityV1;

    blockingReasons: readonly [];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1;

    status: "blocked";

    authority: null;

    blockingReasons: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceBlockedResultV1;

function uniqueSorted(
  values: readonly string[],
): string[] {
  return Array.from(
    new Set(values),
  ).sort();
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1,

    status: "blocked",

    authority: null,

    blockingReasons: uniqueSorted(reasons),
  };
}

function collectNodesAtPath(
  node: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  path: string,
  out: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1[],
): void {
  if (node.path === path) {
    out.push(node);
  }

  if (
    node.shape === "compound_operator"
  ) {
    for (const child of node.children) {
      collectNodesAtPath(
        child,
        path,
        out,
      );
    }
  }
}

function exactStructuralAuthorityMatchesBridge(
  authority: A46a1aAuthority,
  bridge:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeAuthorityV1,
): boolean {
  return (
    authority.manifestId ===
      bridge.manifestId &&
    authority.manifestCode ===
      bridge.manifestCode &&
    authority.bindingName ===
      bridge.ownerBindingName
  );
}

function truthDispositionFromBoundMember(
  member:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionMemberEvidenceV1,
): "resolved_true" | "resolved_false" | null {
  if (
    member.booleanTruthResolved !== true
  ) {
    return null;
  }

  if (
    member.booleanTruth === true
  ) {
    return "resolved_true";
  }

  if (
    member.booleanTruth === false
  ) {
    return "resolved_false";
  }

  return null;
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1
  >[3],
  dependencyAuthorities: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1
  >[4],
  manifestRows: ManifestRows,
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceResultV1
> {
  const boundCondition =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    boundCondition.status !== "ready" ||
    boundCondition.authority === null ||
    boundCondition.blockingReasons.length !== 0
  ) {
    return blocked([
      "bound_condition:not_exact_ready",
      ...boundCondition.blockingReasons.map(
        (reason) => `bound_condition:${reason}`,
      ),
    ]);
  }

  const bridge =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1(
      expectedResult,
      manifestRows,
    );

  if (
    bridge.status !== "ready" ||
    bridge.blockingReasons.length !== 0
  ) {
    return blocked([
      "structural_bridge:not_exact_ready",
      ...bridge.blockingReasons.map(
        (reason) => `structural_bridge:${reason}`,
      ),
    ]);
  }

  const bindingResult =
    deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      manifestRows,
    );

  if (
    bindingResult.status !== "ready" ||
    bindingResult.blockingReasons.length !== 0
  ) {
    return blocked([
      "binding_definition_authority:not_exact_ready",
      ...bindingResult.blockingReasons.map(
        (reason) => `binding_definition_authority:${reason}`,
      ),
    ]);
  }

  const whereShapeResult =
    deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult,
    );

  if (
    whereShapeResult.status !== "ready" ||
    whereShapeResult.blockingReasons.length !== 0
  ) {
    return blocked([
      "where_shape_authority:not_exact_ready",
      ...whereShapeResult.blockingReasons.map(
        (reason) => `where_shape_authority:${reason}`,
      ),
    ]);
  }

  const structuralResult =
    deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1(
      whereShapeResult,
    );

  if (
    structuralResult.status !== "ready" ||
    structuralResult.blockingReasons.length !== 0
  ) {
    return blocked([
      "a4_6a1a:not_exact_ready",
      ...structuralResult.blockingReasons.map(
        (reason) => `a4_6a1a:${reason}`,
      ),
    ]);
  }

  const output:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceV1[] =
      [];

  for (
    const domain of boundCondition.authority.domainBoundConditionEvidence
  ) {
    if (
      domain.boundConditionDomainState !==
        "binding_consumed" ||
      domain.runtimeBindingConsumed !==
        true ||
      domain.conditionEvidenceProjected !==
        true ||
      domain.boundConditionCollection ===
        null
    ) {
      return blocked([
        `bound_condition_domain:not_consumed:${domain.boundConditionDomainEvidenceId}`,
      ]);
    }

    const collection = domain.boundConditionCollection;

    if (
      collection.memberCount !==
        collection.members.length
    ) {
      return blocked([
        `bound_condition_collection:member_count_mismatch:${collection.boundConditionCollectionId}`,
      ]);
    }

    if (
      collection.memberCount !== 1
    ) {
      return blocked([
        collection.memberCount === 0
          ? `bound_condition_collection:empty_truth_not_specified:${collection.boundConditionCollectionId}`
          : `bound_condition_collection:multiple_member_truth_aggregation_not_specified:${collection.boundConditionCollectionId}`,
      ]);
    }

    const member = collection.members[0];

    if (!member) {
      return blocked([
        `bound_condition_collection:singleton_member_missing:${collection.boundConditionCollectionId}`,
      ]);
    }

    const truthDisposition = truthDispositionFromBoundMember(
      member,
    );

    if (
      truthDisposition === null
    ) {
      return blocked([
        `bound_condition_member:truth_not_resolved:${member.boundConditionMemberEvidenceId}`,
      ]);
    }

    const bridgeMatches = bridge.authorities.filter(
      (candidate) =>
        candidate.expectedSiteAuthorityId ===
          domain.expectedSiteAuthorityId &&
        candidate.manifestId ===
          domain.manifestId &&
        candidate.manifestCode ===
          domain.manifestCode &&
        candidate.referencedBindingDefinitionAuthorityId ===
          domain.bindingDefinitionAuthorityId &&
        candidate.referencedBindingName ===
          domain.referencedBindingName,
    );

    if (
      bridgeMatches.length !== 1
    ) {
      return blocked([
        `structural_bridge_join:not_exactly_one:${domain.boundConditionDomainEvidenceId}`,
      ]);
    }

    const structuralBridge = bridgeMatches[0]!;

    const structuralAuthorities = structuralResult.authorities.filter(
      (candidate) =>
        exactStructuralAuthorityMatchesBridge(
          candidate,
          structuralBridge,
        ),
    );

    if (
      structuralAuthorities.length !== 1
    ) {
      return blocked([
        `a4_6a1a_authority_join:not_exactly_one:${structuralBridge.id}`,
      ]);
    }

    const structuralAuthority = structuralAuthorities[0]!;

    const nodes: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1[] = [];

    collectNodesAtPath(
      structuralAuthority.root,
      structuralBridge.manifestLeafPath,
      nodes,
    );

    if (
      nodes.length !== 1
    ) {
      return blocked([
        `a4_6a1a_leaf_path:not_exactly_one:${structuralAuthority.id}:${structuralBridge.manifestLeafPath}`,
      ]);
    }

    const node = nodes[0]!;

    if (
      node.shape !== "leaf_operator"
    ) {
      return blocked([
        `a4_6a1a_leaf_path:not_leaf_operator:${structuralAuthority.id}:${structuralBridge.manifestLeafPath}`,
      ]);
    }

    const leafNode: LeafNode = node;

    if (
      member.expectedSiteAuthorityId !==
        domain.expectedSiteAuthorityId ||
      member.bindingDefinitionAuthorityId !==
        domain.bindingDefinitionAuthorityId ||
      member.snapshotIdentityId !==
        domain.snapshotIdentityId ||
      member.snapshotSentenceOccurrenceIdentityId !==
        domain.snapshotSentenceOccurrenceIdentityId
    ) {
      return blocked([
        `bound_condition_member:domain_lineage_mismatch:${member.boundConditionMemberEvidenceId}`,
      ]);
    }

    const sourceEvidenceId = member.boundConditionMemberEvidenceId;

    const childTruthEvidenceId = [
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1,
      sourceEvidenceId,
      structuralAuthority.id,
      structuralBridge.manifestLeafPath,
      "child_truth",
    ].join(":");

    const childTruthEvidence:
      CanonicalRuntimeManifestWhereChildTruthEvidenceV1 = {
        childTruthEvidenceId,

        nodePath: structuralBridge.manifestLeafPath,

        sourceKind: "leaf_condition_truth",

        truthDisposition,

        sourceProducer:
          CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_V1,

        sourceProducerVersion:
          CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_BOUND_CONDITION_EVIDENCE_VERSION_V1,

        sourceEvidenceId,

        sourceEvidenceObject: member,

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

    const authorityBoundChildTruth:
      CanonicalRuntimeManifestWhereAuthorityBoundChildTruthEvidenceReadyEnvelopeV1 =
        {
          status: "ready",

          evidence: {
            authorityBoundChildTruthEvidenceId: [
              CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1,
              structuralAuthority.id,
              structuralBridge.manifestLeafPath,
              childTruthEvidenceId,
            ].join(":"),

            structuralAuthorityId: structuralAuthority.id,

            nodePath: structuralBridge.manifestLeafPath,

            childTruthEvidence,

            provenance: {
              exactStructuralAuthorityIdentityClaimed: true,

              exactStructuralNodePathClaimed: true,

              structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity:
                true,

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

    output.push({
      leafTruthEvidenceId: [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1,
        domain.boundConditionDomainEvidenceId,
        structuralBridge.id,
        member.boundConditionMemberEvidenceId,
      ].join(":"),

      status:
        "proven_current_snapshot_bound_where_authority_bound_leaf_truth_evidence",

      expectedSiteAuthorityId: domain.expectedSiteAuthorityId,

      manifestId: domain.manifestId,

      manifestCode: domain.manifestCode,

      ownerBindingName: structuralBridge.ownerBindingName,

      ownerBindingDefinitionAuthorityId:
        structuralBridge.ownerBindingDefinitionAuthorityId,

      referencedBindingName: domain.referencedBindingName,

      referencedBindingDefinitionAuthorityId:
        domain.bindingDefinitionAuthorityId,

      whereShapeAuthorityId: structuralBridge.whereShapeAuthorityId,

      manifestLeafSiteAuthorityId: structuralBridge.manifestLeafSiteAuthorityId,

      manifestLeafPath: structuralBridge.manifestLeafPath,

      structuralAuthorityId: structuralAuthority.id,

      structuralNodePath: structuralBridge.manifestLeafPath,

      snapshotIdentityId: member.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        member.snapshotSentenceOccurrenceIdentityId,

      snapshotTokenOccurrenceIdentityId:
        member.snapshotTokenOccurrenceIdentityId,

      sourceBoundConditionMemberEvidence: member,

      sourceStructuralBridgeAuthority: structuralBridge,

      sourceA46a1aAuthority: structuralAuthority,

      sourceA46a1aLeafNode: leafNode,

      childTruthEvidence,

      authorityBoundChildTruth,
    });
  }

  if (
    output.length === 0
  ) {
    return blocked([
      "leaf_truth_evidence:no_materialized_evidence",
    ]);
  }

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1,

    status: "ready",

    authority: {
      authorityId: [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1,
        boundCondition.authority.authorityId,
      ].join(":"),

      status:
        "proven_current_snapshot_bound_where_authority_bound_leaf_truth_evidence",

      sourceBoundConditionAuthorityId: boundCondition.authority.authorityId,

      evidence: output,

      evidenceCount: output.length,

      governance: {
        closedBoundConditionPublicDerivationReexecuted: true,
        suppliedBoundConditionWrapperAcceptedAsProof: false,

        closedStructuralBridgePublicDerivationReexecuted: true,
        suppliedStructuralBridgeWrapperAcceptedAsProof: false,

        manifestStructuralChainIndependentlyRederived: true,
        exactA46a1aStructuralAuthorityRequired: true,
        exactA46a1aLeafNodeRequired: true,

        exactExpectedSiteAuthorityJoinRequired: true,
        exactManifestIdentityJoinRequired: true,
        exactReferencedBindingDefinitionAuthorityJoinRequired: true,
        exactReferencedBindingNameJoinRequired: true,

        exactOwnerBindingDefinitionAuthorityJoinRequired: true,
        exactOwnerBindingNameJoinRequired: true,
        exactWhereShapeAuthorityJoinRequired: true,

        structuralAuthorityAndNodePathFormCompositeOccurrenceIdentity: true,

        manifestLeafPathTakenOnlyFromStructuralBridge: true,
        sourceReferencePathTreatedAsLeafPath: false,

        exactlyOneBoundMemberRequiredForLeafTruthMaterialization: true,
        emptyBoundCollectionTruthInferred: false,
        multipleBoundMemberTruthAggregated: false,

        membersEveryBooleanTruthUsed: false,
        membersSomeBooleanTruthUsed: false,

        sourceBoundConditionTruthConsumedNotRecomputed: true,
        sourceComparisonRecomputed: false,

        genericChildTruthEvidenceConstructed: true,
        authorityBoundChildTruthEvidenceConstructed: true,

        recursiveWhereCompositionPerformed: false,
        compoundTruthComposed: false,
        manifestConditionTruthResolved: false,
        runtimeConditionTruthResolved: false,
        bindingTruthResolved: false,
        whereEvaluationPerformed: false,

        learnerErrorClassified: false,
        constraintPropagationInvoked: false,
        canonicalDependencyEdgeGenerated: false,
        clauseNodeGenerated: false,
        graphMutationPerformed: false,

        frozenGrammarReadOnly: true,
      },
    },

    blockingReasons: [],
  };
}
