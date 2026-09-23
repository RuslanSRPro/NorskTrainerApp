import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-occurrence-filtering-v1.ts";

import {
  type CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from "./canonical-dependency-runtime-authority-v1.ts";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-leaf-structural-bridge-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1,
  type CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";
export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-direct-all-occurrence-coherence-evidence-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceLeafV1 =
  {
    manifestLeafPath: string;
    expectedSiteAuthorityId: string;
    referencedBindingDefinitionAuthorityId: string;
    filteringDomainId: string;
    survivingSnapshotTokenOccurrenceIdentityIds: readonly string[];
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceGroupV1 =
  {
    referencedBindingDefinitionAuthorityId: string;
    manifestLeafPaths: readonly string[];
    filteringDomainIds: readonly string[];
    survivingSnapshotTokenOccurrenceIdentityIdsByLeaf:
      readonly {
        manifestLeafPath: string;
        snapshotTokenOccurrenceIdentityIds: readonly string[];
      }[];
    sharedSnapshotTokenOccurrenceIdentityIds: readonly string[];
    coherenceState:
      | "coherent_shared_occurrence_exists"
      | "incoherent_no_shared_occurrence";
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1 =
  {
    allPath: string;
    status: "proven_direct_all_occurrence_coherence_evidence";
    groups:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceGroupV1[];
    groupCount: number;
    coherenceFailureCount: number;
    governance: {
      directAllLeafChildrenOnly: true;
      sameReferencedBindingOnly: true;
      differentReferencedBindingsComparedForOccurrenceEquality: false;
      survivingOccurrencesOnly: true;
      occurrenceWinnerSelected: false;
      emptyIntersectionClassifiedAsBooleanFalse: false;
      booleanTruthExecuted: false;
      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;
      anySemanticsChanged: false;
      notSemanticsChanged: false;
      nestedCompoundSemanticsGeneralized: false;
      graphMutationPerformed: false;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceDecisionV1 =
  | {
    status: "ready";
    evidence:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1;
    blockingReasons: readonly [];
  }
  | {
    status: "blocked";
    evidence: null;
    blockingReasons: readonly string[];
  };

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceDecisionV1 {
  return {
    status: "blocked",
    evidence: null,
    blockingReasons: uniqueSorted(
      reasons,
    ),
  };
}

function exactIntersection(
  sets: readonly (readonly string[])[],
): string[] {
  if (
    sets.length ===
    0
  ) {
    return [];
  }

  const first =
    uniqueSorted(
      sets[0],
    );

  return first.filter(
    (candidate) =>
      sets.every(
        (set) =>
          set.includes(
            candidate,
          ),
      ),
  );
}

export function decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
  allPath: string,
  directLeafPaths: readonly string[],
  leaves:
    readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceLeafV1[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceDecisionV1 {
  const reasons: string[] = [];

  if (
    allPath.length ===
    0
  ) {
    reasons.push(
      "direct_all:path_missing",
    );
  }

  if (
    directLeafPaths.length <
    2
  ) {
    reasons.push(
      "direct_all:requires_at_least_two_direct_leaf_children",
    );
  }

  const uniqueLeafPaths =
    uniqueSorted(
      directLeafPaths,
    );

  if (
    uniqueLeafPaths.length !==
    directLeafPaths.length
  ) {
    reasons.push(
      "direct_all:duplicate_direct_leaf_path",
    );
  }

  const exactLeaves:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceLeafV1[] =
      [];

  for (
    const leafPath of directLeafPaths
  ) {
    const matches =
      leaves.filter(
        (leaf) =>
          leaf.manifestLeafPath ===
          leafPath,
      );

    if (
      matches.length !==
      1
    ) {
      reasons.push(
        `direct_all_leaf:${leafPath}:not_exactly_one_filtering_domain`,
      );

      continue;
    }

    const leaf =
      matches[0];

    if (
      leaf.expectedSiteAuthorityId.length ===
        0 ||
      leaf.referencedBindingDefinitionAuthorityId.length ===
        0 ||
      leaf.filteringDomainId.length ===
        0
    ) {
      reasons.push(
        `direct_all_leaf:${leafPath}:incomplete_lineage`,
      );

      continue;
    }

    const occurrenceIds =
      leaf.survivingSnapshotTokenOccurrenceIdentityIds;

    if (
      uniqueSorted(
        occurrenceIds,
      ).length !==
      occurrenceIds.length
    ) {
      reasons.push(
        `direct_all_leaf:${leafPath}:duplicate_surviving_occurrence_identity`,
      );

      continue;
    }

    exactLeaves.push(
      leaf,
    );
  }

  const outOfScopeLeaves =
    leaves.filter(
      (leaf) =>
        !directLeafPaths.includes(
          leaf.manifestLeafPath,
        ),
    );

  if (
    outOfScopeLeaves.length >
    0
  ) {
    reasons.push(
      "direct_all:unexpected_leaf_evidence_outside_direct_children",
    );
  }

  if (
    reasons.length >
    0
  ) {
    return blocked(
      reasons,
    );
  }

  const referencedBindingIds =
    uniqueSorted(
      exactLeaves.map(
        (leaf) =>
          leaf.referencedBindingDefinitionAuthorityId,
      ),
    );

  const groups:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceGroupV1[] =
      [];

  for (
    const referencedBindingDefinitionAuthorityId of referencedBindingIds
  ) {
    const groupLeaves =
      exactLeaves.filter(
        (leaf) =>
          leaf.referencedBindingDefinitionAuthorityId ===
          referencedBindingDefinitionAuthorityId,
      );

    if (
      groupLeaves.length <
      2
    ) {
      continue;
    }

    const orderedLeaves =
      [...groupLeaves].sort(
        (
          left,
          right,
        ) =>
          left.manifestLeafPath.localeCompare(
            right.manifestLeafPath,
          ),
      );

    const survivingByLeaf =
      orderedLeaves.map(
        (leaf) => ({
          manifestLeafPath:
            leaf.manifestLeafPath,
          snapshotTokenOccurrenceIdentityIds:
            uniqueSorted(
              leaf.survivingSnapshotTokenOccurrenceIdentityIds,
            ),
        }),
      );

    const shared =
      exactIntersection(
        survivingByLeaf.map(
          (leaf) =>
            leaf.snapshotTokenOccurrenceIdentityIds,
        ),
      );

    groups.push({
      referencedBindingDefinitionAuthorityId,
      manifestLeafPaths:
        orderedLeaves.map(
          (leaf) =>
            leaf.manifestLeafPath,
        ),
      filteringDomainIds:
        orderedLeaves.map(
          (leaf) =>
            leaf.filteringDomainId,
        ),
      survivingSnapshotTokenOccurrenceIdentityIdsByLeaf:
        survivingByLeaf,
      sharedSnapshotTokenOccurrenceIdentityIds:
        shared,
      coherenceState:
        shared.length >
            0
          ? "coherent_shared_occurrence_exists"
          : "incoherent_no_shared_occurrence",
    });
  }

  const coherenceFailureCount =
    groups.filter(
      (group) =>
        group.coherenceState ===
        "incoherent_no_shared_occurrence",
    ).length;

  return {
    status: "ready",
    evidence: {
      allPath,
      status:
        "proven_direct_all_occurrence_coherence_evidence",
      groups,
      groupCount:
        groups.length,
      coherenceFailureCount,
      governance: {
        directAllLeafChildrenOnly:
          true,
        sameReferencedBindingOnly:
          true,
        differentReferencedBindingsComparedForOccurrenceEquality:
          false,
        survivingOccurrencesOnly:
          true,
        occurrenceWinnerSelected:
          false,
        emptyIntersectionClassifiedAsBooleanFalse:
          false,
        booleanTruthExecuted:
          false,
        cardinalitySemanticsResolved:
          false,
        cardinalityEnforcementPerformed:
          false,
        anySemanticsChanged:
          false,
        notSemanticsChanged:
          false,
        nestedCompoundSemanticsGeneralized:
          false,
        graphMutationPerformed:
          false,
      },
    },
    blockingReasons: [],
  };
}
export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceAuthorityV1 =
  {
    authorityId: string;
    status: "proven_current_snapshot_bound_where_direct_all_occurrence_coherence";

    sourceFilteringAuthorityId: string;

    allEvidence:
      readonly CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1[];

    allEvidenceCount: number;
    coherenceFailureCount: number;

    governance: {
      closedCurrentSnapshotBoundOccurrenceFilteringPublicDerivationReexecuted: true;
      suppliedOccurrenceFilteringAcceptedAsProof: false;

      leafStructuralBridgePublicDerivationReexecuted: true;
      suppliedLeafStructuralBridgeAcceptedAsProof: false;

      manifestWhereShapePublicDerivationReexecuted: true;
      compoundOperatorShapePublicDerivationReexecuted: true;
      suppliedCompoundOperatorShapeAcceptedAsProof: false;

      directAllLeafChildrenOnly: true;
      nestedCompoundChildrenRejectedFromThisContract: true;

      exactExpectedSiteToStructuralBridgeJoinRequired: true;
      exactManifestLeafPathToDirectAllChildJoinRequired: true;

      sameReferencedBindingOnly: true;
      differentReferencedBindingsComparedForOccurrenceEquality: false;

      occurrenceWinnerSelected: false;
      emptyIntersectionClassifiedAsBooleanFalse: false;
      booleanTruthExecuted: false;

      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;

      anySemanticsChanged: false;
      notSemanticsChanged: false;

      graphMutationPerformed: false;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherencePublicResultV1 =
  | {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_VERSION_V1;
    status: "ready";
    authority:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceAuthorityV1;
    blockingReasons: readonly [];
  }
  | {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_VERSION_V1;
    status: "blocked";
    blockingReasons: readonly string[];
  };

function publicBlocked(
  reasons: readonly string[],
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherencePublicResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_V1,
    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_VERSION_V1,
    status: "blocked",
    blockingReasons:
      uniqueSorted(
        reasons,
      ),
  };
}

function collectDirectAllNodes(
  node: CanonicalRuntimeManifestCompoundOperatorShapeNodeV1,
  target:
    CanonicalRuntimeManifestCompoundOperatorShapeNodeV1[],
): void {
  if (
    node.shape !==
    "compound_operator"
  ) {
    return;
  }

  if (
    node.operatorKey ===
    "all"
  ) {
    target.push(
      node,
    );
  }

  for (
    const child of node.children
  ) {
    collectDirectAllNodes(
      child,
      target,
    );
  }
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
  surface: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1
  >[0],
  graph: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1
  >[1],
  expectedResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1
  >[2],
  currentDomainResult: Parameters<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1
  >[3],
  manifestRows:
    readonly CanonicalDependencyRuntimeManifestAuthorityRowV1[],
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherencePublicResultV1
> {
  const filteringResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
    );

  if (
    filteringResult.status !==
      "ready" ||
    filteringResult.blockingReasons.length !==
      0
  ) {
    return publicBlocked([
      "occurrence_filtering:not_exact_ready",
    ]);
  }

  const bridgeResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1(
      expectedResult,
      manifestRows,
    );

  if (
    bridgeResult.status !==
      "ready" ||
    bridgeResult.blockingReasons.length !==
      0
  ) {
    return publicBlocked([
      "where_leaf_structural_bridge:not_exact_ready",
    ]);
  }

  const bindingResult =
    deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      manifestRows,
    );

  if (
    bindingResult.status !==
      "ready" ||
    bindingResult.blockingReasons.length !==
      0
  ) {
    return publicBlocked([
      "manifest_binding_definition:not_exact_ready",
    ]);
  }

  const shapeResult =
    deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
      bindingResult,
    );

  if (
    shapeResult.status !==
      "ready" ||
    shapeResult.blockingReasons.length !==
      0
  ) {
    return publicBlocked([
      "manifest_where_shape:not_exact_ready",
    ]);
  }

  const compoundResult =
    deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1(
      shapeResult,
    );

  if (
    compoundResult.status !==
      "ready" ||
    compoundResult.blockingReasons.length !==
      0
  ) {
    return publicBlocked([
      "compound_operator_shape:not_exact_ready",
    ]);
  }

  const blockingReasons: string[] = [];

  const leafEvidence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceLeafV1[] =
      [];

  for (
    const domain of filteringResult.authority.domainFiltering
  ) {
    const bridgeMatches =
      bridgeResult.authorities.filter(
        (bridge) =>
          bridge.expectedSiteAuthorityId ===
          domain.expectedSiteAuthorityId,
      );

    if (
      bridgeMatches.length !==
      1
    ) {
      blockingReasons.push(
        `filtering_domain:${domain.filteringDomainId}:structural_bridge_not_exactly_one`,
      );

      continue;
    }

    const bridge =
      bridgeMatches[0];

    leafEvidence.push({
      manifestLeafPath:
        bridge.manifestLeafPath,
      expectedSiteAuthorityId:
        domain.expectedSiteAuthorityId,
      referencedBindingDefinitionAuthorityId:
        bridge.referencedBindingDefinitionAuthorityId,
      filteringDomainId:
        domain.filteringDomainId,
      survivingSnapshotTokenOccurrenceIdentityIds:
        domain.occurrenceFiltering
          .filter(
            (occurrence) =>
              occurrence.survivesFiltering ===
              true,
          )
          .map(
            (occurrence) =>
              occurrence.snapshotTokenOccurrenceIdentityId,
          ),
    });
  }

  if (
    blockingReasons.length >
    0
  ) {
    return publicBlocked(
      blockingReasons,
    );
  }

  const allEvidence:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1[] =
      [];

  for (
    const structuralAuthority of compoundResult.authorities
  ) {
    const structuralBridgeAuthorities =
      bridgeResult.authorities.filter(
        (bridge) =>
          bridge.manifestId ===
            structuralAuthority.manifestId &&
          bridge.manifestCode ===
            structuralAuthority.manifestCode &&
          bridge.ownerBindingName === structuralAuthority.bindingName,
      );

    const allNodes:
      CanonicalRuntimeManifestCompoundOperatorShapeNodeV1[] =
        [];

    collectDirectAllNodes(
      structuralAuthority.root,
      allNodes,
    );

    for (
      const node of allNodes
    ) {
      if (
        node.shape !==
          "compound_operator" ||
        node.operatorKey !==
          "all"
      ) {
        continue;
      }

      const nestedChildren =
        node.children.filter(
          (child) =>
            child.shape !==
            "leaf_operator",
        );

      if (
        nestedChildren.length >
        0
      ) {
        blockingReasons.push(
          `direct_all:${node.path}:nested_or_non_leaf_child_outside_contract`,
        );

        continue;
      }

      const directLeafPaths =
        node.children.map(
          (child) =>
            child.path,
        );

      const directLeafSet =
        new Set(
          directLeafPaths,
        );

      const structuralExpectedSiteAuthorityIds =
        new Set(
          structuralBridgeAuthorities
            .filter(
              (bridge) =>
                directLeafSet.has(
                  bridge.manifestLeafPath,
                ),
            )
            .map(
              (bridge) =>
                bridge.expectedSiteAuthorityId,
            ),
        );

      const scopedLeaves =
        leafEvidence.filter(
          (leaf) =>
            directLeafSet.has(
              leaf.manifestLeafPath,
            ) &&
            structuralExpectedSiteAuthorityIds.has(
              leaf.expectedSiteAuthorityId,
            ),
        );

      const decision =
        decideCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
          node.path,
          directLeafPaths,
          scopedLeaves,
        );

      if (
        decision.status !==
        "ready"
      ) {
        for (
          const reason of decision.blockingReasons
        ) {
          blockingReasons.push(
            `direct_all:${node.path}:${reason}`,
          );
        }

        continue;
      }

      allEvidence.push(
        decision.evidence,
      );
    }
  }

  const coherenceFailureCount =
    allEvidence.reduce(
      (
        total,
        evidence,
      ) =>
        total +
        evidence.coherenceFailureCount,
      0,
    );

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_V1,
    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_VERSION_V1,
    status:
      "ready",
    authority: {
      authorityId: [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_DIRECT_ALL_OCCURRENCE_COHERENCE_EVIDENCE_V1,
        filteringResult.authority.authorityId,
      ].join(
        ":",
      ),
      status:
        "proven_current_snapshot_bound_where_direct_all_occurrence_coherence",
      sourceFilteringAuthorityId:
        filteringResult.authority.authorityId,
      allEvidence,
      allEvidenceCount:
        allEvidence.length,
      coherenceFailureCount,
      governance: {
        closedCurrentSnapshotBoundOccurrenceFilteringPublicDerivationReexecuted:
          true,
        suppliedOccurrenceFilteringAcceptedAsProof:
          false,
        leafStructuralBridgePublicDerivationReexecuted:
          true,
        suppliedLeafStructuralBridgeAcceptedAsProof:
          false,
        manifestWhereShapePublicDerivationReexecuted:
          true,
        compoundOperatorShapePublicDerivationReexecuted:
          true,
        suppliedCompoundOperatorShapeAcceptedAsProof:
          false,
        directAllLeafChildrenOnly:
          true,
        nestedCompoundChildrenRejectedFromThisContract:
          true,
        exactExpectedSiteToStructuralBridgeJoinRequired:
          true,
        exactManifestLeafPathToDirectAllChildJoinRequired:
          true,
        sameReferencedBindingOnly:
          true,
        differentReferencedBindingsComparedForOccurrenceEquality:
          false,
        occurrenceWinnerSelected:
          false,
        emptyIntersectionClassifiedAsBooleanFalse:
          false,
        booleanTruthExecuted:
          false,
        cardinalitySemanticsResolved:
          false,
        cardinalityEnforcementPerformed:
          false,
        anySemanticsChanged:
          false,
        notSemanticsChanged:
          false,
        graphMutationPerformed:
          false,
        frozenGrammarReadOnly:
          true,
      },
    },
    blockingReasons: [],
  };
}
