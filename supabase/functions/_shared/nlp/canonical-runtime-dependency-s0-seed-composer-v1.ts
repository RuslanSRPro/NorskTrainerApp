import { deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1 } from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";
import { deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1 } from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";
import { deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1 } from "./canonical-runtime-manifest-binding-where-reference-expression-shape-authority-v1.ts";
import { deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1 } from "./canonical-runtime-manifest-binding-where-reference-root-authority-v1.ts";
import { deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1 } from "./canonical-runtime-manifest-binding-where-leaf-right-operand-site-authority-v1.ts";
import { deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1 } from "./canonical-runtime-manifest-binding-entity-compatibility-v1.ts";
import { deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1 } from "./canonical-runtime-manifest-binding-scope-compatibility-v1.ts";
import { deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1 } from "./canonical-runtime-manifest-token-pos-suffix-property-compatibility-v1.ts";
import { deriveCanonicalRuntimeManifestTokenPosStringOperandCompatibilitiesV1 } from "./canonical-runtime-manifest-token-pos-string-operand-compatibility-v1.ts";
import { deriveCanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilitiesV1 } from "./canonical-runtime-manifest-token-pos-exact-eq-operator-source-compatibility-v1.ts";
import { deriveCanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthoritiesV1 } from "./canonical-runtime-manifest-token-pos-expected-normalized-label-eq-authority-v1.ts";
import { deriveCanonicalPosFactOwnershipAuthoritiesV1 } from "./canonical-pos-fact-ownership-authority-v1.ts";
import { deriveCanonicalTokenPosPropertyCapabilityV1 } from "./canonical-token-pos-property-capability-v1.ts";
import { deriveCanonicalRuntimeSentenceScopeBoundaryAuthoritiesV1 } from "./canonical-runtime-sentence-scope-boundary-authority-v1.ts";
import { deriveCanonicalRuntimeTokenNodeTypeAuthoritiesV1 } from "./canonical-runtime-token-node-type-authority-v1.ts";
import { deriveCanonicalDependencyRuntimeAuthoritiesV1 } from "./canonical-dependency-runtime-authority-v1.ts";
import { deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1 } from "./canonical-runtime-binding-definition-authority-v1.ts";
import { deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1 } from "./canonical-runtime-binding-where-shape-authority-v1.ts";
import { deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1 } from "./canonical-runtime-binding-where-reference-root-authority-v1.ts";
import { deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1 } from "./canonical-runtime-binding-where-right-operand-authority-v1.ts";
import { deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1 } from "./canonical-runtime-binding-where-left-right-site-authority-v1.ts";
import { deriveCanonicalRuntimeBindingEntityCompatibilitiesV1 } from "./canonical-runtime-binding-entity-compatibility-v1.ts";
import { deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1 } from "./canonical-runtime-token-pos-suffix-compatibility-v1.ts";
import { deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1 } from "./canonical-runtime-token-pos-string-operand-compatibility-v1.ts";
import { deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1 } from "./canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts";
import { deriveCanonicalRuntimeSetRoleActionAuthoritiesV1 } from "./canonical-runtime-set-role-action-authority-v1.ts";
import type { CanonicalRuntimeS0InitialEpochCompositionInputV1 } from "./canonical-runtime-s0-initial-epoch-composition-boundary-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_S0_SEED_COMPOSER_V1 =
  "a3.6z:canonical-runtime-dependency-s0-seed-composer-v1" as const;
export const CANONICAL_RUNTIME_DEPENDENCY_S0_SEED_COMPOSER_VERSION_V1 =
  "1.0.0" as const;

type ManifestRows = Parameters<
  typeof deriveCanonicalDependencyRuntimeAuthoritiesV1
>[0];
type Graph = CanonicalRuntimeS0InitialEpochCompositionInputV1["graph"];

export type CanonicalRuntimeDependencyS0SeedV1 = Readonly<
  Pick<
    CanonicalRuntimeS0InitialEpochCompositionInputV1,
    | "expectedResult"
    | "expectedAuthority"
    | "compatibilityResult"
    | "scopeResult"
    | "manifestRows"
    | "setRoleAuthorities"
  >
>;

function blocked(stage: string, reasons: readonly string[]) {
  return {
    producer: CANONICAL_RUNTIME_DEPENDENCY_S0_SEED_COMPOSER_V1,
    producerVersion: CANONICAL_RUNTIME_DEPENDENCY_S0_SEED_COMPOSER_VERSION_V1,
    status: "blocked" as const,
    stage,
    seeds: [] as readonly CanonicalRuntimeDependencyS0SeedV1[],
    blockingReasons: [...new Set(reasons)].sort(),
    governance: {
      dependencyOnly: true as const,
      setRoleAuthorityInvented: false as const,
      createClauseAuthorityInvented: false as const,
      expectedAuthorityWinnerSelected: false as const,
      tokenOccurrenceSelected: false as const,
      currentSentenceSelected: false as const,
      schedulerInvoked: false as const,
      activationPermissionResolved: false as const,
      graphMutationPerformed: false as const,
      learnerFacingInterpretationPerformed: false as const,
    },
  };
}

export function deriveCanonicalRuntimeDependencyS0SeedsV1(
  manifestRows: ManifestRows,
  graph: Graph,
) {
  const dependencyAuthorities = deriveCanonicalDependencyRuntimeAuthoritiesV1(
    manifestRows,
  );
  if (dependencyAuthorities.status !== "ready") {
    return blocked(
      "dependency_authority",
      dependencyAuthorities.blockingReasons,
    );
  }

  const bindingResult =
    deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
      manifestRows,
    );
  if (bindingResult.status !== "ready") {
    return blocked("binding_definition", bindingResult.blockingReasons);
  }

  const whereShapeResult =
    deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(bindingResult);
  if (whereShapeResult.status !== "ready") {
    return blocked("where_shape", whereShapeResult.blockingReasons);
  }

  const referenceShapeResult =
    deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
      whereShapeResult,
    );
  if (referenceShapeResult.status !== "ready") {
    return blocked(
      "where_reference_shape",
      referenceShapeResult.blockingReasons,
    );
  }

  const referenceRootResult =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      referenceShapeResult,
      bindingResult,
    );
  if (referenceRootResult.status !== "ready") {
    return blocked("where_reference_root", referenceRootResult.blockingReasons);
  }

  const rightOperandSiteResult =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      whereShapeResult,
      referenceRootResult,
    );
  if (rightOperandSiteResult.status !== "ready") {
    return blocked(
      "where_right_operand_site",
      rightOperandSiteResult.blockingReasons,
    );
  }

  const nodeTypeAuthorities =
    deriveCanonicalRuntimeTokenNodeTypeAuthoritiesV1();
  const entityCompatibilityResult =
    deriveCanonicalRuntimeManifestBindingEntityCompatibilitiesV1(
      bindingResult,
      nodeTypeAuthorities,
    );
  if (entityCompatibilityResult.status !== "ready") {
    return blocked(
      "binding_entity_compatibility",
      entityCompatibilityResult.blockingReasons,
    );
  }

  const ownershipResult = deriveCanonicalPosFactOwnershipAuthoritiesV1(graph);
  if (ownershipResult.status !== "ready") {
    return blocked("pos_ownership", ownershipResult.blockingReasons);
  }

  const propertyCapabilityResult = deriveCanonicalTokenPosPropertyCapabilityV1(
    ownershipResult,
  );
  if (propertyCapabilityResult.status !== "ready") {
    return blocked(
      "token_pos_property",
      propertyCapabilityResult.blockingReasons,
    );
  }
  // Runtime expected authority is a separate authority chain from the manifest
  // authoring chain. Reuse the canonical runtime producers; do not treat a
  // manifest expected candidate as runtime truth.
  const runtimeBindingResult =
    deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
      dependencyAuthorities.authorities,
      manifestRows,
    );
  if (runtimeBindingResult.status !== "ready") {
    return blocked(
      "runtime_binding_definition",
      runtimeBindingResult.blockingReasons,
    );
  }

  const runtimeWhereShapeResult =
    deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
      runtimeBindingResult.authorities,
    );
  if (runtimeWhereShapeResult.status !== "ready") {
    return blocked(
      "runtime_where_shape",
      runtimeWhereShapeResult.blockingReasons,
    );
  }

  const runtimeReferenceRootResult =
    deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
      runtimeWhereShapeResult.authorities,
      runtimeBindingResult.authorities,
    );
  if (runtimeReferenceRootResult.status !== "ready") {
    return blocked(
      "runtime_reference_root",
      runtimeReferenceRootResult.blockingReasons,
    );
  }

  const runtimeRightOperandResult =
    deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
      runtimeWhereShapeResult,
    );
  if (runtimeRightOperandResult.status !== "ready") {
    return blocked(
      "runtime_right_operand",
      runtimeRightOperandResult.blockingReasons,
    );
  }

  const runtimeLeftRightResult =
    deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
      runtimeReferenceRootResult,
      runtimeRightOperandResult,
    );
  if (runtimeLeftRightResult.status !== "ready") {
    return blocked(
      "runtime_left_right_site",
      runtimeLeftRightResult.blockingReasons,
    );
  }

  const runtimeEntityCompatibilityResult =
    deriveCanonicalRuntimeBindingEntityCompatibilitiesV1(
      runtimeBindingResult.authorities,
      nodeTypeAuthorities,
    );
  if (runtimeEntityCompatibilityResult.status !== "ready") {
    return blocked(
      "runtime_entity_compatibility",
      runtimeEntityCompatibilityResult.blockingReasons,
    );
  }

  const runtimeTokenPosSuffixResult =
    deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
      runtimeReferenceRootResult,
      runtimeEntityCompatibilityResult,
      propertyCapabilityResult,
    );
  if (runtimeTokenPosSuffixResult.status !== "ready") {
    return blocked(
      "runtime_token_pos_suffix",
      runtimeTokenPosSuffixResult.blockingReasons,
    );
  }

  const runtimeStringOperandResult =
    deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
      runtimeLeftRightResult,
      runtimeTokenPosSuffixResult,
    );
  if (runtimeStringOperandResult.status !== "ready") {
    return blocked(
      "runtime_string_operand",
      runtimeStringOperandResult.blockingReasons,
    );
  }

  const runtimeExpectedResult =
    deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
      runtimeStringOperandResult,
    );
  if (runtimeExpectedResult.status !== "ready") {
    return blocked(
      "runtime_expected_authority",
      runtimeExpectedResult.blockingReasons,
    );
  }

  const suffixCompatibilityResult =
    deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
      rightOperandSiteResult,
      entityCompatibilityResult,
      propertyCapabilityResult,
    );
  if (suffixCompatibilityResult.status !== "ready") {
    return blocked(
      "suffix_property_compatibility",
      suffixCompatibilityResult.blockingReasons,
    );
  }

  const stringOperandResult =
    deriveCanonicalRuntimeManifestTokenPosStringOperandCompatibilitiesV1(
      suffixCompatibilityResult,
    );
  if (stringOperandResult.status !== "ready") {
    return blocked(
      "string_operand_compatibility",
      stringOperandResult.blockingReasons,
    );
  }

  const exactEqResult =
    deriveCanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilitiesV1(
      stringOperandResult,
    );
  if (exactEqResult.status !== "ready") {
    return blocked("exact_eq_compatibility", exactEqResult.blockingReasons);
  }

  const expectedResult =
    deriveCanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthoritiesV1(
      exactEqResult,
    );
  if (expectedResult.status !== "ready") {
    return blocked("expected_authority", expectedResult.blockingReasons);
  }

  const scopeAuthorities =
    deriveCanonicalRuntimeSentenceScopeBoundaryAuthoritiesV1();
  const scopeResult =
    deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      bindingResult,
      scopeAuthorities,
    );
  if (scopeResult.status !== "ready") {
    return blocked("scope_compatibility", scopeResult.blockingReasons);
  }

  // Dependency-only rollout: preserve every canonical expected authority as its
  // own seed. No candidate winner is selected and no set_role authority is invented.
  const setRoleAuthorities = deriveCanonicalRuntimeSetRoleActionAuthoritiesV1(
    [...manifestRows],
  );
  // Absence of set_role is a valid dependency-only case: preserve the canonical
  // result object intact. Do not synthesize an empty result or infer authority.

  const seeds: CanonicalRuntimeDependencyS0SeedV1[] = expectedResult.candidates
    .flatMap((expectedAuthority) => {
      const runtimeMatches = runtimeExpectedResult.authorities.filter(
        (runtimeExpectedAuthority) =>
          runtimeExpectedAuthority.manifestId ===
            expectedAuthority.manifestId &&
          runtimeExpectedAuthority.manifestCode ===
            expectedAuthority.manifestCode &&
          runtimeExpectedAuthority.ownerBindingDefinitionAuthorityId ===
            expectedAuthority.ownerBindingDefinitionAuthorityId &&
          runtimeExpectedAuthority.ownerBindingName ===
            expectedAuthority.ownerBindingName &&
          runtimeExpectedAuthority.referencedBindingDefinitionAuthorityId ===
            expectedAuthority.referencedBindingDefinitionAuthorityId &&
          runtimeExpectedAuthority.referencedBindingName ===
            expectedAuthority.referencedBindingName &&
          runtimeExpectedAuthority.referencePath ===
            expectedAuthority.leafPath &&
          runtimeExpectedAuthority.referenceExpression ===
            expectedAuthority.leftReferenceExpression &&
          runtimeExpectedAuthority.runtimeSuffix ===
            expectedAuthority.runtimeSuffix &&
          runtimeExpectedAuthority.canonicalNodeType ===
            expectedAuthority.canonicalNodeType &&
          runtimeExpectedAuthority.canonicalPropertyDomain ===
            expectedAuthority.canonicalPropertyDomain &&
          runtimeExpectedAuthority.canonicalPropertyKind ===
            expectedAuthority.canonicalPropertyKind &&
          runtimeExpectedAuthority.normalizedOperatorLabel ===
            expectedAuthority.canonicalOperatorLabel &&
          runtimeExpectedAuthority.normalizedPosLabelInput ===
            expectedAuthority.normalizedExpectedPosLabel,
      );

      if (runtimeMatches.length !== 1) return [];

      return [{
        expectedResult: runtimeExpectedResult,
        expectedAuthority,
        compatibilityResult: suffixCompatibilityResult,
        scopeResult,
        manifestRows,
        setRoleAuthorities,
      }];
    });

  if (
    seeds.length !== expectedResult.candidates.length ||
    seeds.length !== runtimeExpectedResult.authorities.length
  ) {
    return blocked(
      "runtime_manifest_expected_authority_pairing",
      ["runtime_manifest_expected_authority_pairing_not_exact"],
    );
  }
  return {
    producer: CANONICAL_RUNTIME_DEPENDENCY_S0_SEED_COMPOSER_V1,
    producerVersion: CANONICAL_RUNTIME_DEPENDENCY_S0_SEED_COMPOSER_VERSION_V1,
    status: "ready" as const,
    seeds,
    expectedAuthorityCount: seeds.length,
    dependencyAuthorityCount: dependencyAuthorities.authorities.length,
    blockingReasons: [] as readonly string[],
    governance: {
      dependencyOnly: true as const,
      setRoleAuthorityInvented: false as const,
      createClauseAuthorityInvented: false as const,
      expectedAuthorityWinnerSelected: false as const,
      tokenOccurrenceSelected: false as const,
      currentSentenceSelected: false as const,
      schedulerInvoked: false as const,
      activationPermissionResolved: false as const,
      graphMutationPerformed: false as const,
      learnerFacingInterpretationPerformed: false as const,
    },
  };
}
