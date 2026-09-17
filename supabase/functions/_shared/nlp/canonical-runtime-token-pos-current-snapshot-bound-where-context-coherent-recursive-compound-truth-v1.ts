import {
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";

import {
  type CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1,
  deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1,
} from "./canonical-runtime-manifest-binding-where-compound-operator-shape-extension-v1.ts";

import {
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterResultV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-context-bound-child-truth-adapter-v1.ts";

import {
  type CanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthComposerResultV1,
  composeCanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthV1,
} from "./canonical-runtime-manifest-binding-where-context-coherent-recursive-compound-truth-composer-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-context-coherent-recursive-compound-truth-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_VERSION_V1 =
  "1.0.0" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_SPECIFICATION_ID_V1 =
  "v1.46:A4.6a1f-current:current-snapshot-bound-where-context-coherent-recursive-compound-truth-v1" as const;

type ContextProducer =
  typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterV1;

type Surface = Parameters<ContextProducer>[0];
type Graph = Parameters<ContextProducer>[1];
type ExpectedResult = Parameters<ContextProducer>[2];
type CurrentDomainResult = Parameters<ContextProducer>[3];
type DependencyAuthorities = Parameters<ContextProducer>[4];
type ManifestRows = Parameters<ContextProducer>[5];

type ContextResult = Awaited<ReturnType<ContextProducer>>;

type ReadyContextResult = Extract<ContextResult, { status: "ready" }>;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthGovernanceV1 =
  {
    closedCurrentContextBoundLeafTruthPublicDerivationReexecuted: true;
    suppliedContextBoundLeafTruthWrapperAcceptedAsProof: false;

    manifestStructuralChainIndependentlyRederived: true;
    exactA46a1aReadyStructuralResultRequired: true;

    exactStructuralAuthorityIdJoinRequired: true;
    exactStructuralNodePathJoinRequired: true;
    exactlyOneStructuralAuthorityRequiredPerLeaf: true;
    exactlyOneStructuralLeafNodeRequiredPerLeaf: true;

    contextBoundEvidencePassedToA46a1fWithoutReconstruction: true;
    structuralResultPassedToA46a1fWithoutReconstruction: true;

    recursiveWhereCompositionDelegatedToExistingA46a1f: true;
    duplicateRecursiveComposerImplemented: false;

    occurrenceWinnerSelected: false;
    contextWinnerSelected: false;
    cardinalitySemanticsResolved: false;
    cardinalityEnforcementPerformed: false;
    finalRuntimeBindingPerformed: false;
    bindingTruthResolved: false;
    learnerErrorClassified: false;
    graphMutationPerformed: false;
    frozenGrammarReadOnly: true;
  };

const GOVERNANCE:
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthGovernanceV1 =
    {
      closedCurrentContextBoundLeafTruthPublicDerivationReexecuted: true,
      suppliedContextBoundLeafTruthWrapperAcceptedAsProof: false,

      manifestStructuralChainIndependentlyRederived: true,
      exactA46a1aReadyStructuralResultRequired: true,

      exactStructuralAuthorityIdJoinRequired: true,
      exactStructuralNodePathJoinRequired: true,
      exactlyOneStructuralAuthorityRequiredPerLeaf: true,
      exactlyOneStructuralLeafNodeRequiredPerLeaf: true,

      contextBoundEvidencePassedToA46a1fWithoutReconstruction: true,
      structuralResultPassedToA46a1fWithoutReconstruction: true,

      recursiveWhereCompositionDelegatedToExistingA46a1f: true,
      duplicateRecursiveComposerImplemented: false,

      occurrenceWinnerSelected: false,
      contextWinnerSelected: false,
      cardinalitySemanticsResolved: false,
      cardinalityEnforcementPerformed: false,
      finalRuntimeBindingPerformed: false,
      bindingTruthResolved: false,
      learnerErrorClassified: false,
      graphMutationPerformed: false,
      frozenGrammarReadOnly: true,
    };

type ReadyStructuralResult =
  CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_SPECIFICATION_ID_V1;

    status: "ready";

    sourceContextBoundResult: ReadyContextResult;

    sourceShapeResult: ReadyStructuralResult;

    compositionResult:
      CanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthComposerResultV1;

    blockingReasons: readonly [];

    governance:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthGovernanceV1;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_SPECIFICATION_ID_V1;

    status: "blocked";

    sourceContextBoundResult: ContextResult | null;

    sourceShapeResult:
      | CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1
      | null;

    compositionResult:
      | CanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthComposerResultV1
      | null;

    blockingReasons: readonly string[];

    governance:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthGovernanceV1;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthBlockedResultV1;

function uniqueSorted(
  values: readonly string[],
): readonly string[] {
  return [...new Set(values)].sort();
}

function blocked(
  reasons: readonly string[],
  sourceContextBoundResult: ContextResult | null = null,
  sourceShapeResult:
    | CanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionResultV1
    | null = null,
  compositionResult:
    | CanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthComposerResultV1
    | null = null,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,

    status: "blocked",

    sourceContextBoundResult,
    sourceShapeResult,
    compositionResult,

    blockingReasons: uniqueSorted(reasons),

    governance: GOVERNANCE,
  };
}

function collectNodePaths(
  node: ReadyStructuralResult["authorities"][number]["root"],
): readonly string[] {
  const output: string[] = [node.path];

  if (node.shape !== "compound_operator") {
    return output;
  }

  for (const child of node.children) {
    output.push(...collectNodePaths(child));
  }

  return output;
}

function collectLeafPaths(
  node: ReadyStructuralResult["authorities"][number]["root"],
): readonly string[] {
  if (node.shape === "leaf_operator") {
    return [node.path];
  }

  if (node.shape !== "compound_operator") {
    return [];
  }

  return node.children.flatMap(
    (child) => collectLeafPaths(child),
  );
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthV1(
  surface: Surface,
  graph: Graph,
  expectedResult: ExpectedResult,
  currentDomainResult: CurrentDomainResult,
  dependencyAuthorities: DependencyAuthorities,
  manifestRows: ManifestRows,
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthResultV1
> {
  const contextBoundResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    contextBoundResult.status !== "ready" ||
    contextBoundResult.blockingReasons.length !== 0
  ) {
    return blocked([
      "current_context_bound:not_exact_ready",
      ...contextBoundResult.blockingReasons.map(
        (reason) => "current_context_bound:" + reason,
      ),
    ], contextBoundResult);
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
        (reason) => "binding_definition_authority:" + reason,
      ),
    ], contextBoundResult);
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
        (reason) => "where_shape_authority:" + reason,
      ),
    ], contextBoundResult);
  }

  const structuralResult =
    deriveCanonicalRuntimeManifestBindingWhereCompoundOperatorShapeExtensionsV1(
      whereShapeResult,
    );

  if (
    structuralResult.status !== "ready" ||
    structuralResult.blockingReasons.length !== 0
  ) {
    return blocked(
      [
        "a4_6a1a:not_exact_ready",
        ...structuralResult.blockingReasons.map(
          (reason) => "a4_6a1a:" + reason,
        ),
      ],
      contextBoundResult,
      structuralResult,
    );
  }

  for (const evidence of contextBoundResult.evidence) {
    const authorities = structuralResult.authorities.filter(
      (authority) => authority.id === evidence.structuralAuthorityId,
    );

    if (authorities.length !== 1) {
      return blocked(
        [
          "structural_lineage:authority_cardinality:" +
          evidence.structuralAuthorityId,
        ],
        contextBoundResult,
        structuralResult,
      );
    }

    const authority = authorities[0];

    const sourceLeafMatches = contextBoundResult.sourceResult.authority.evidence
      .filter(
        (leaf) =>
          leaf.structuralAuthorityId === evidence.structuralAuthorityId &&
          leaf.structuralNodePath === evidence.nodePath,
      );

    if (sourceLeafMatches.length !== 1) {
      return blocked(
        [
          "structural_lineage:source_leaf_cardinality:" +
          evidence.structuralAuthorityId +
          ":" +
          evidence.nodePath,
        ],
        contextBoundResult,
        structuralResult,
      );
    }

    const sourceLeaf = sourceLeafMatches[0];
    const sourceAuthority = sourceLeaf.sourceA46a1aAuthority;
    const sourceLeafNode = sourceLeaf.sourceA46a1aLeafNode;

    if (
      authority.id !== sourceAuthority.id ||
      authority.sourceWhereShapeAuthorityId !==
        sourceAuthority.sourceWhereShapeAuthorityId ||
      authority.bindingDefinitionAuthorityId !==
        sourceAuthority.bindingDefinitionAuthorityId ||
      authority.manifestId !== sourceAuthority.manifestId ||
      authority.manifestCode !== sourceAuthority.manifestCode ||
      authority.bindingName !== sourceAuthority.bindingName
    ) {
      return blocked(
        [
          "structural_lineage:canonical_authority_lineage_mismatch:" +
          evidence.structuralAuthorityId,
        ],
        contextBoundResult,
        structuralResult,
      );
    }

    const allPathMatches = collectNodePaths(
      authority.root,
    ).filter(
      (nodePath) => nodePath === evidence.nodePath,
    );

    if (allPathMatches.length !== 1) {
      return blocked(
        [
          "structural_lineage:node_path_cardinality:" +
          evidence.structuralAuthorityId +
          ":" +
          evidence.nodePath,
        ],
        contextBoundResult,
        structuralResult,
      );
    }

    const leafPathMatches = collectLeafPaths(
      authority.root,
    ).filter(
      (nodePath) => nodePath === evidence.nodePath,
    );

    if (leafPathMatches.length !== 1) {
      return blocked(
        [
          "structural_lineage:not_exact_leaf_node:" +
          evidence.structuralAuthorityId +
          ":" +
          evidence.nodePath,
        ],
        contextBoundResult,
        structuralResult,
      );
    }

    if (
      sourceLeafNode.shape !== "leaf_operator" ||
      sourceLeafNode.path !== evidence.nodePath
    ) {
      return blocked(
        [
          "structural_lineage:source_leaf_node_mismatch:" +
          evidence.structuralAuthorityId +
          ":" +
          evidence.nodePath,
        ],
        contextBoundResult,
        structuralResult,
      );
    }

    if (
      evidence.authorityBoundChildTruthEvidence !==
        sourceLeaf.authorityBoundChildTruth.evidence
    ) {
      return blocked(
        [
          "structural_lineage:exact_authority_bound_evidence_not_preserved:" +
          evidence.structuralAuthorityId +
          ":" +
          evidence.nodePath,
        ],
        contextBoundResult,
        structuralResult,
      );
    }
  }

  const compositionResult =
    composeCanonicalRuntimeManifestBindingWhereContextCoherentRecursiveCompoundTruthV1(
      structuralResult,
      contextBoundResult.evidence,
    );

  if (
    compositionResult.status !== "ready" ||
    compositionResult.blockingReasons.length !== 0
  ) {
    return blocked(
      [
        "a4_6a1f:not_exact_ready",
        ...compositionResult.blockingReasons.map(
          (reason) => "a4_6a1f:" + reason,
        ),
      ],
      contextBoundResult,
      structuralResult,
      compositionResult,
    );
  }

  if (
    compositionResult.sourceShapeResult !==
      structuralResult ||
    compositionResult.sourceLeafEvidence !==
      contextBoundResult.evidence
  ) {
    return blocked(
      [
        "a4_6a1f:source_reference_not_preserved",
      ],
      contextBoundResult,
      structuralResult,
      compositionResult,
    );
  }

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_COHERENT_RECURSIVE_COMPOUND_TRUTH_SPECIFICATION_ID_V1,

    status: "ready",

    sourceContextBoundResult: contextBoundResult,
    sourceShapeResult: structuralResult,
    compositionResult,

    blockingReasons: [],

    governance: GOVERNANCE,
  };
}
