import type {
  CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1,
  CanonicalRuntimeTokenPosStringOperandCompatibilityV1,
} from "./canonical-runtime-token-pos-string-operand-compatibility-v1.ts";
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
  deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1,
} from "./canonical-runtime-manifest-token-pos-suffix-property-compatibility-v1.ts";

import {
  deriveCanonicalRuntimeManifestTokenPosStringOperandCompatibilitiesV1,
} from "./canonical-runtime-manifest-token-pos-string-operand-compatibility-v1.ts";

import {
  deriveCanonicalRuntimeManifestTokenPosExactEqOperatorSourceCompatibilitiesV1,
} from "./canonical-runtime-manifest-token-pos-exact-eq-operator-source-compatibility-v1.ts";

import {
  CANONICAL_RUNTIME_TOKEN_POS_NORMALIZED_LABEL_EQ_AUTHORITY_V1,
  type CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1,
  deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1,
} from "./canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-leaf-structural-bridge-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const manifestRows = [{
  id: "manifest-1",
  code: "test.token_pos.where_leaf_bridge",
  authoring_status: "validated",
  runtime_family: "test",
  execution_phase: "test",
  ir_spec: {
    bindings: {
      subject: {
        entity: "token",
        cardinality: "one",
        where: {
          op: "eq",
          left: { ref: "subject.pos" },
          right: "NOUN",
        },
      },
    },
  },
}];

function upstreamStringOperandCandidate(
  options: {
    id?: string;
    siteKey?: string;
    operator?: string;
    pos?: string;
  } = {},
): CanonicalRuntimeTokenPosStringOperandCompatibilityV1 {
  return {
    id:
      options.id ??
        'string-operand:1',

    status:
      'candidate',

    leftRightSiteAuthorityId:
      'left-right:1',

    tokenPosSuffixCompatibilityId:
      'suffix:1',

    whereReferenceRootAuthorityId:
      'root:1',

    whereShapeAuthorityId:
      'shape:1',

    ownerBindingDefinitionAuthorityId:
      'binding:owner',

    referencedBindingDefinitionAuthorityId:
      'binding:token',

    manifestId:
      'manifest:1',

    manifestCode:
      'manifest.one',

    ownerBindingName:
      'owner',

    referencedBindingName:
      'token',

    referenceSiteKey:
      options.siteKey ??
        'root:1#$#token.pos',

    referencePath:
      '$',

    referenceExpression:
      'token.pos',

    runtimeSuffix:
      '.pos',

    entityCompatibilityId:
      'entity:token',

    runtimeEntityLabel:
      'token',

    canonicalNodeType:
      'token',

    tokenPosCapabilityId:
      'pos-capability:1',

    canonicalPropertyDomain:
      'canonical_token_occurrence',

    canonicalPropertyKind:
      'pos_hypothesis_set',

    operatorLabelOpaque:
      options.operator ??
        'eq',

    rightOperandStructuralKind:
      'string',

    posLabelInputOpaque:
      options.pos ??
        'verb',

    governance: {
      exactLeftRightSiteAuthorityRequired:
        true,

      exactTokenPosSuffixCompatibilityRequired:
        true,

      exactReferenceRootAuthorityIdentityMatch:
        true,

      exactWhereShapeAuthorityIdentityMatch:
        true,

      exactOwnerBindingIdentityMatch:
        true,

      exactReferencedBindingIdentityMatch:
        true,

      exactManifestIdentityMatch:
        true,

      exactBindingNameMatch:
        true,

      exactReferencePathMatch:
        true,

      exactReferenceExpressionMatch:
        true,

      exactReferenceSiteKeyMatch:
        true,

      exactRuntimePosSuffixRequired:
        true,

      exactCanonicalTokenCompatibilityRequired:
        true,

      exactTokenPosHypothesisSetCapabilityRequired:
        true,

      stringRightOperandRequired:
        true,

      stringOperandPreservedOpaque:
        true,

      posLabelInputCompatibilityOnly:
        true,

      operatorLabelPreservedOpaque:
        true,

      nonStringOperandRejectedByThisCapability:
        true,

      posVocabularyValidated:
        false,

      operandKnownCanonicalPosLabel:
        false,

      operandNormalizationPerformed:
        false,

      caseFoldingPerformed:
        false,

      operatorSemanticsResolved:
        false,

      whereEqExecuted:
        false,

      posHypothesisRead:
        false,

      posHypothesisSelected:
        false,

      posLabelCompared:
        false,

      comparisonPerformed:
        false,

      comparisonTruthResolved:
        false,

      learnerErrorClassified:
        false,

      runtimeBindingExecuted:
        false,

      occurrenceEnumerationPerformed:
        false,

      runtimeScopeExecutionPerformed:
        false,

      cardinalityEnforcementPerformed:
        false,

      occurrenceBindingPerformed:
        false,

      canonicalDependencyEdgeGenerated:
        false,

      grammaticalFunctionResolved:
        false,

      complementArgumentAttachmentResolved:
        false,

      realizesSlotGenerated:
        false,

      graphMutationPerformed:
        false,

      candidateOnly:
        true,

      frozenGrammarReadOnly:
        true,
    },
  };
}

function upstreamStringOperandResult(
  candidates:
    CanonicalRuntimeTokenPosStringOperandCompatibilityV1[],
): CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1 {
  return {
    producer:
      'canonical_runtime_token_pos_string_operand_compatibility_v1',

    producerVersion:
      '1',

    status:
      'ready',

    candidates,

    consideredTokenPosLeftRightSiteCount:
      candidates.length,

    unsupportedOperandSiteIds:
      [],

    unmatchedStringOperandSiteIds:
      [],

    tokenPosSuffixCandidatesWithoutStringOperandSiteKeys:
      [],

    blockingReasons:
      [],
  };
}

function expectedResult(): CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1 {
  const bindings =
    deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(manifestRows);

  const shapes =
    deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(bindings);

  const references =
    deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
      shapes,
    );

  const roots =
    deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
      references,
      bindings,
    );

  const sites =
    deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
      shapes,
      roots,
    );

  assert(
    bindings.status === "ready" &&
      shapes.status === "ready" &&
      references.status === "ready" &&
      roots.status === "ready" &&
      sites.status === "ready" &&
      sites.authorities.length === 1,
    JSON.stringify({ bindings, shapes, references, roots, sites }),
  );

  const leaf = sites.authorities[0]!;

  const base =
    upstreamStringOperandCandidate({
      id: "runtime-string-operand-1",
      siteKey: "runtime-reference-site-1",
      operator: "eq",
      pos: "NOUN",
    });

  const source: CanonicalRuntimeTokenPosStringOperandCompatibilityV1 = {
    ...base,

    whereReferenceRootAuthorityId:
      leaf.referenceRootAuthorityId,

    whereShapeAuthorityId:
      leaf.whereShapeAuthorityId,

    ownerBindingDefinitionAuthorityId:
      leaf.ownerBindingDefinitionAuthorityId,

    referencedBindingDefinitionAuthorityId:
      leaf.referencedBindingDefinitionAuthorityId,

    manifestId:
      leaf.manifestId,

    manifestCode:
      leaf.manifestCode,

    ownerBindingName:
      leaf.ownerBindingName,

    referencedBindingName:
      leaf.referencedBindingName,

    referencePath:
      "runtime-reference-path-not-leaf-path",

    referenceExpression:
      leaf.leftReferenceExpression,
  };

  return deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
    upstreamStringOperandResult([
      source,
    ]),
  );
}

Deno.test("WHERE leaf structural bridge V1 exact canonical manifest leaf joins", () => {
  const expected = expectedResult();

  assert(expected.status === "ready", JSON.stringify(expected));
  assert(expected.authorities.length === 1, JSON.stringify(expected));

  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1(
      expected,
      manifestRows,
    );

  assert(result.status === "ready", JSON.stringify(result));
  assert(result.authorities.length === 1, JSON.stringify(result));

  const a = result.authorities[0]!;
  const e = expected.authorities[0]!;

  assert(a.expectedSiteAuthorityId === e.id, JSON.stringify(a));
  assert(a.manifestId === e.manifestId, JSON.stringify(a));
  assert(a.manifestCode === e.manifestCode, JSON.stringify(a));
  assert(a.whereShapeAuthorityId === e.whereShapeAuthorityId, JSON.stringify(a));

  assert(a.sourceExpectedAuthority === e, "exact expected authority reference lost");
  assert(a.manifestLeafPath.length > 0, JSON.stringify(a));

  assert(
    a.governance.referencePathTreatedAsLeafPath === false &&
      a.governance.leafPathTakenOnlyFromManifestStructuralAuthority === true &&
      a.governance.semanticEvaluationPerformed === false &&
      a.governance.runtimeBindingExecuted === false &&
      a.governance.runtimeConditionTruthResolved === false &&
      a.governance.bindingTruthResolved === false &&
      a.governance.whereEvaluationPerformed === false,
    JSON.stringify(a.governance),
  );
});

Deno.test("WHERE leaf structural bridge V1 fails closed when expected lineage is forged", () => {
  const expected = expectedResult();

  assert(expected.status === "ready", JSON.stringify(expected));
  assert(expected.authorities.length === 1, JSON.stringify(expected));

  const forged = {
    ...expected,
    authorities: expected.authorities.map((authority, index) =>
      index === 0
        ? {
            ...authority,
            whereShapeAuthorityId: "forged-where-shape-authority",
          }
        : authority
    ),
  } as unknown as typeof expected;

  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1(
      forged,
      manifestRows,
    );

  assert(
    result.status === "blocked" &&
      result.authorities.length === 0 &&
      result.blockingReasons.some((reason) =>
        reason.includes("manifest_leaf_site_not_exactly_one")
      ),
    JSON.stringify(result),
  );
});

Deno.test("WHERE leaf structural bridge V1 does not equate runtime referencePath with manifest leafPath", () => {
  const expected = expectedResult();

  assert(expected.status === "ready", JSON.stringify(expected));

  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1(
      expected,
      manifestRows,
    );

  assert(result.status === "ready", JSON.stringify(result));

  const a = result.authorities[0]!;

  assert(
    a.governance.referencePathTreatedAsLeafPath === false,
    JSON.stringify(a.governance),
  );

  assert(
    a.manifestLeafPath === a.sourceManifestLeafSiteAuthority.leafPath,
    JSON.stringify(a),
  );
});

Deno.test("WHERE leaf structural bridge V1 fails closed when reference-root lineage is forged", () => {
  const expected = expectedResult();

  const forged = structuredClone(expected);

  forged.authorities[0]!.whereReferenceRootAuthorityId =
    "forged-reference-root-authority";

  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1(
      forged,
      manifestRows,
    );

  assert(result.status === "blocked", JSON.stringify(result));
  assert(result.authorities.length === 0, JSON.stringify(result));
});

Deno.test("WHERE leaf structural bridge V1 fails closed when reference-expression lineage is forged", () => {
  const expected = expectedResult();

  const forged = structuredClone(expected);

  forged.authorities[0]!.referenceExpression =
    "forged.reference.expression";

  const result =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1(
      forged,
      manifestRows,
    );

  assert(result.status === "blocked", JSON.stringify(result));
  assert(result.authorities.length === 0, JSON.stringify(result));
});
Deno.test("WHERE leaf structural bridge V1 public API remains exactly two source inputs", () => {
  assert(
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1.length === 2,
    `unexpected public API length: ${
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereLeafStructuralBridgeV1.length
    }`,
  );
});