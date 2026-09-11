import {
  deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-reference-expression-shape-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-reference-root-authority-v1.ts";

import {
  deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1,
} from "./canonical-runtime-manifest-binding-where-leaf-right-operand-site-authority-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
  type CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1,
  type CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1,
} from "./canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_LEAF_STRUCTURAL_BRIDGE_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-leaf-structural-bridge-v1";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_LEAF_STRUCTURAL_BRIDGE_VERSION_V1 =
  "1.0.0";

type ManifestRows =
  Parameters<typeof deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1>[0];

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeAuthorityV1 = {
  id: string;

  expectedSiteAuthorityId: string;
  manifestId: string;
  manifestCode: string;
  ownerBindingName: string;
  ownerBindingDefinitionAuthorityId: string;
  referencedBindingName: string;
  referencedBindingDefinitionAuthorityId: string;
  whereShapeAuthorityId: string;

  sourceReferenceSiteKey: string;
  sourceReferencePath: string;

  manifestLeafSiteAuthorityId: string;
  manifestLeafPath: string;

  sourceExpectedAuthority:
    CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1;

  sourceManifestLeafSiteAuthority:
    ReturnType<
      typeof deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1
    >["authorities"][number];

  governance: {
    manifestStructuralChainIndependentlyRederived: true;
    suppliedManifestStructuralWrapperAcceptedAsProof: false;

    exactExpectedAuthorityRequired: true;
    exactManifestLeafSiteAuthorityRequired: true;

    sameManifestIdentityRequired: true;
    sameOwnerBindingNameRequired: true;
    sameOwnerBindingDefinitionAuthorityRequired: true;
    sameReferencedBindingNameRequired: true;
    sameReferencedBindingDefinitionAuthorityRequired: true;
    sameWhereShapeAuthorityRequired: true;
    sameReferenceRootAuthorityRequired: true;
    sameReferenceExpressionRequired: true;

    referencePathTreatedAsLeafPath: false;
    leafPathTakenOnlyFromManifestStructuralAuthority: true;

    semanticEvaluationPerformed: false;
    operatorSemanticsResolved: false;
    runtimeBindingExecuted: false;
    runtimeConditionTruthResolved: false;
    bindingTruthResolved: false;
    whereEvaluationPerformed: false;
    learnerErrorProduced: false;
    dependencyGenerationPerformed: false;
    clauseGenerationPerformed: false;
    graphMutationPerformed: false;
  };
};

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_LEAF_STRUCTURAL_BRIDGE_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_LEAF_STRUCTURAL_BRIDGE_VERSION_V1;

  status: "ready" | "blocked";
  authorities:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeAuthorityV1[];
  blockingReasons: string[];
};

function blocked(
  reason: string,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_LEAF_STRUCTURAL_BRIDGE_V1,
    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_LEAF_STRUCTURAL_BRIDGE_VERSION_V1,
    status: "blocked",
    authorities: [],
    blockingReasons: [reason],
  };
}

function exactOne<T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
): T | null {
  const matches = values.filter(predicate);
  return matches.length === 1 ? matches[0]! : null;
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1(
  expectedResult:
    CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1,
  manifestRows: ManifestRows,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeResultV1 {
  if (
    expectedResult.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1 ||
    expectedResult.producerVersion !==
      "1" ||
    expectedResult.status !== "ready" ||
    expectedResult.blockingReasons.length !== 0
  ) {
    return blocked("expected_result:not_exact_ready");
  }

  const bindings =
    deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(manifestRows);

  if (bindings.status !== "ready" || bindings.blockingReasons.length !== 0) {
    return blocked("manifest_binding_authority:not_exact_ready");
  }

  const shapes =
    deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(bindings);

  if (shapes.status !== "ready" || shapes.blockingReasons.length !== 0) {
    return blocked("manifest_where_shape:not_exact_ready");
  }

  const references =
    deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
      shapes,
    );

  if (
    references.status !== "ready" ||
    references.blockingReasons.length !== 0
  ) {
    return blocked("manifest_where_reference_shape:not_exact_ready");
  }

  const roots =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      references,
      bindings,
    );

  if (roots.status !== "ready" || roots.blockingReasons.length !== 0) {
    return blocked("manifest_where_reference_root:not_exact_ready");
  }

  const leafSites =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      shapes,
      roots,
    );

  if (
    leafSites.status !== "ready" ||
    leafSites.blockingReasons.length !== 0
  ) {
    return blocked("manifest_where_leaf_site:not_exact_ready");
  }

  const authorities:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeAuthorityV1[] =
      [];

  for (const expected of expectedResult.authorities) {
    const leafSite = exactOne(
      leafSites.authorities,
      (candidate) =>
        candidate.manifestId === expected.manifestId &&
        candidate.manifestCode === expected.manifestCode &&
        candidate.ownerBindingName === expected.ownerBindingName &&
        candidate.ownerBindingDefinitionAuthorityId ===
          expected.ownerBindingDefinitionAuthorityId &&
        candidate.referencedBindingName === expected.referencedBindingName &&
        candidate.referencedBindingDefinitionAuthorityId ===
          expected.referencedBindingDefinitionAuthorityId &&
        candidate.whereShapeAuthorityId === expected.whereShapeAuthorityId &&
        candidate.referenceRootAuthorityId ===
          expected.whereReferenceRootAuthorityId &&
        candidate.leftReferenceExpression === expected.referenceExpression,
    );

    if (leafSite === null) {
      return blocked(
        `expected_site:${expected.id}:manifest_leaf_site_not_exactly_one`,
      );
    }

    authorities.push({
      id:
        `${CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_LEAF_STRUCTURAL_BRIDGE_V1}:` +
        `${expected.id}:${leafSite.id}`,

      expectedSiteAuthorityId: expected.id,
      manifestId: expected.manifestId,
      manifestCode: expected.manifestCode,
      ownerBindingName: expected.ownerBindingName,
      ownerBindingDefinitionAuthorityId:
        expected.ownerBindingDefinitionAuthorityId,
      referencedBindingName: expected.referencedBindingName,
      referencedBindingDefinitionAuthorityId:
        expected.referencedBindingDefinitionAuthorityId,
      whereShapeAuthorityId: expected.whereShapeAuthorityId,

      sourceReferenceSiteKey: expected.referenceSiteKey,
      sourceReferencePath: expected.referencePath,

      manifestLeafSiteAuthorityId: leafSite.id,
      manifestLeafPath: leafSite.leafPath,

      sourceExpectedAuthority: expected,
      sourceManifestLeafSiteAuthority: leafSite,

      governance: {
        manifestStructuralChainIndependentlyRederived: true,
        suppliedManifestStructuralWrapperAcceptedAsProof: false,

        exactExpectedAuthorityRequired: true,
        exactManifestLeafSiteAuthorityRequired: true,

        sameManifestIdentityRequired: true,
        sameOwnerBindingNameRequired: true,
        sameOwnerBindingDefinitionAuthorityRequired: true,
        sameReferencedBindingNameRequired: true,
        sameReferencedBindingDefinitionAuthorityRequired: true,
        sameWhereShapeAuthorityRequired: true,
        sameReferenceRootAuthorityRequired: true,
        sameReferenceExpressionRequired: true,

        referencePathTreatedAsLeafPath: false,
        leafPathTakenOnlyFromManifestStructuralAuthority: true,

        semanticEvaluationPerformed: false,
        operatorSemanticsResolved: false,
        runtimeBindingExecuted: false,
        runtimeConditionTruthResolved: false,
        bindingTruthResolved: false,
        whereEvaluationPerformed: false,
        learnerErrorProduced: false,
        dependencyGenerationPerformed: false,
        clauseGenerationPerformed: false,
        graphMutationPerformed: false,
      },
    });
  }

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_LEAF_STRUCTURAL_BRIDGE_V1,
    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_LEAF_STRUCTURAL_BRIDGE_VERSION_V1,
    status: "ready",
    authorities,
    blockingReasons: [],
  };
}