import {
  deriveCanonicalDependencyRuntimeAuthoritiesV1,
} from "./canonical-dependency-runtime-authority-v1.ts";

import {
  deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-binding-definition-authority-v1.ts";

import {
  deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-binding-where-shape-authority-v1.ts";

import {
  deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1,
} from "./canonical-runtime-binding-where-reference-root-authority-v1.ts";

import {
  deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1,
} from "./canonical-runtime-binding-where-right-operand-authority-v1.ts";

import {
  deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1,
} from "./canonical-runtime-binding-where-left-right-site-authority-v1.ts";
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
  Parameters<typeof deriveCanonicalDependencyRuntimeAuthoritiesV1>[0];

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

  runtimeStructuralSiteAuthorityId: string;

  manifestLeafSiteAuthorityId: string;
  manifestLeafPath: string;

  sourceExpectedAuthority:
    CanonicalRuntimeTokenPosNormalizedLabelEqSiteAuthorityV1;

  sourceRuntimeStructuralSiteAuthority:
    ReturnType<
      typeof deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1
    >["authorities"][number];

  sourceManifestLeafSiteAuthority:
    ReturnType<
      typeof deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1
    >["authorities"][number];

  governance: {
    manifestStructuralChainIndependentlyRederived: true;
    suppliedManifestStructuralWrapperAcceptedAsProof: false;

    runtimeStructuralChainIndependentlyRederived: true;
    suppliedRuntimeStructuralWrapperAcceptedAsProof: false;

    exactExpectedAuthorityRequired: true;
    exactRuntimeStructuralSiteAuthorityRequired: true;
    exactManifestLeafSiteAuthorityRequired: true;

    producerSpecificAuthorityIdsComparedOnlyWithinRuntimeFamily: true;
    producerSpecificAuthorityIdsEquatedAcrossFamilies: false;
    crossFamilyStructuralSourceIdentityRequired: true;

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

  const runtimeDependencyAuthorities =
    deriveCanonicalDependencyRuntimeAuthoritiesV1(
      manifestRows,
    );

  if (
    runtimeDependencyAuthorities.status !== "ready" ||
    runtimeDependencyAuthorities.blockingReasons.length !== 0
  ) {
    return blocked("runtime_dependency_authority:not_exact_ready");
  }

  const runtimeBindings =
    deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
      runtimeDependencyAuthorities.authorities,
      manifestRows,
    );

  if (
    runtimeBindings.status !== "ready" ||
    runtimeBindings.blockingReasons.length !== 0
  ) {
    return blocked("runtime_binding_authority:not_exact_ready");
  }

  const runtimeShapes =
    deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
      runtimeBindings.authorities,
    );

  if (
    runtimeShapes.status !== "ready" ||
    runtimeShapes.blockingReasons.length !== 0
  ) {
    return blocked("runtime_where_shape:not_exact_ready");
  }

  const runtimeRoots =
    deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
      runtimeShapes.authorities,
      runtimeBindings.authorities,
    );

  if (
    runtimeRoots.status !== "ready" ||
    runtimeRoots.blockingReasons.length !== 0
  ) {
    return blocked("runtime_where_reference_root:not_exact_ready");
  }

  const runtimeRightOperands =
    deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
      runtimeShapes,
    );

  if (
    runtimeRightOperands.status !== "ready" ||
    runtimeRightOperands.blockingReasons.length !== 0
  ) {
    return blocked("runtime_where_right_operand:not_exact_ready");
  }

  const runtimeStructuralSites =
    deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
      runtimeRoots,
      runtimeRightOperands,
    );

  if (
    runtimeStructuralSites.status !== "ready" ||
    runtimeStructuralSites.blockingReasons.length !== 0
  ) {
    return blocked("runtime_where_left_right_site:not_exact_ready");
  }

  const authorities:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeAuthorityV1[] =
      [];

  for (const expected of expectedResult.authorities) {
    const runtimeStructuralSite = exactOne(
      runtimeStructuralSites.authorities,
      (candidate) =>
        candidate.whereReferenceRootAuthorityId ===
          expected.whereReferenceRootAuthorityId &&
        candidate.whereShapeAuthorityId ===
          expected.whereShapeAuthorityId &&
        candidate.ownerBindingDefinitionAuthorityId ===
          expected.ownerBindingDefinitionAuthorityId &&
        candidate.referencedBindingDefinitionAuthorityId ===
          expected.referencedBindingDefinitionAuthorityId &&
        candidate.manifestId === expected.manifestId &&
        candidate.manifestCode === expected.manifestCode &&
        candidate.ownerBindingName === expected.ownerBindingName &&
        candidate.referencedBindingName ===
          expected.referencedBindingName &&
        candidate.leafPath === expected.referencePath &&
        candidate.leftReferenceExpression ===
          expected.referenceExpression &&
        candidate.opaqueLeftSuffix === expected.runtimeSuffix &&
        candidate.operatorLabelOpaque === expected.rawOperatorLabel &&
        candidate.rightOperandStructuralKind === "string" &&
        typeof candidate.rightOperandSnapshot === "string" &&
        candidate.rightOperandSnapshot === expected.rawPosLabelInput,
    );

    if (runtimeStructuralSite === null) {
      return blocked(
        `expected_site:${expected.id}:runtime_structural_site_not_exactly_one`,
      );
    }

    const leafSite = exactOne(
      leafSites.authorities,
      (candidate) =>
        candidate.manifestId === runtimeStructuralSite.manifestId &&
        candidate.manifestCode === runtimeStructuralSite.manifestCode &&
        candidate.ownerBindingName ===
          runtimeStructuralSite.ownerBindingName &&
        candidate.referencedBindingName ===
          runtimeStructuralSite.referencedBindingName &&
        candidate.leafPath === runtimeStructuralSite.leafPath &&
        candidate.leftReferenceExpression ===
          runtimeStructuralSite.leftReferenceExpression &&
        candidate.opaqueLeftSuffix ===
          runtimeStructuralSite.opaqueLeftSuffix &&
        candidate.operatorLabelOpaque ===
          runtimeStructuralSite.operatorLabelOpaque &&
        candidate.hasRightOperand === true &&
        runtimeStructuralSite.rightOperandStructuralKind === "string" &&
        typeof runtimeStructuralSite.rightOperandSnapshot === "string" &&
        candidate.rightOperandSnapshot ===
          runtimeStructuralSite.rightOperandSnapshot,
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

      runtimeStructuralSiteAuthorityId:
        runtimeStructuralSite.id,

      manifestLeafSiteAuthorityId: leafSite.id,
      manifestLeafPath: leafSite.leafPath,

      sourceExpectedAuthority: expected,
      sourceRuntimeStructuralSiteAuthority:
        runtimeStructuralSite,
      sourceManifestLeafSiteAuthority: leafSite,

      governance: {
        manifestStructuralChainIndependentlyRederived: true,
        suppliedManifestStructuralWrapperAcceptedAsProof: false,

        runtimeStructuralChainIndependentlyRederived: true,
        suppliedRuntimeStructuralWrapperAcceptedAsProof: false,

        exactExpectedAuthorityRequired: true,
        exactRuntimeStructuralSiteAuthorityRequired: true,
        exactManifestLeafSiteAuthorityRequired: true,

        producerSpecificAuthorityIdsComparedOnlyWithinRuntimeFamily: true,
        producerSpecificAuthorityIdsEquatedAcrossFamilies: false,
        crossFamilyStructuralSourceIdentityRequired: true,

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