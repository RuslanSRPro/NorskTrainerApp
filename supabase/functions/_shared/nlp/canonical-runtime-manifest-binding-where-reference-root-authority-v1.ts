import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityResultV1,
} from "./canonical-runtime-manifest-binding-where-reference-expression-shape-authority-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1 =
  "canonical_runtime_manifest_binding_where_reference_root_authority_v1";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_VERSION_V1 =
  "1";

export type CanonicalRuntimeManifestBindingWhereReferenceRootMatchV1 =
  | "exact_binding"
  | "binding_prefix_with_opaque_suffix"
  | "unrooted";

export type CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityV1 = {
  id: string;
  status: "candidate";
  referenceExpressionAuthorityId: string;
  whereShapeAuthorityId: string;
  ownerBindingDefinitionAuthorityId: string;
  manifestId: string;
  manifestCode: string;
  ownerBindingName: string;
  leafPath: string;
  operatorLabelOpaque: string;
  referenceExpression: string;
  rootMatch: CanonicalRuntimeManifestBindingWhereReferenceRootMatchV1;
  rooted: boolean;
  rootBindingName: string | null;
  rootBindingDefinitionAuthorityId: string | null;
  opaqueSuffix: string | null;
  governance: {
    exactA46a2a0cResultRequired: true;
    exactA46a2a0cAuthorityRequired: true;
    exactA43a1ResultRequired: true;
    exactManifestBindingDefinitionAuthorityRequired: true;

    ownerBindingAuthorityIdentityRequired: true;
    exactManifestIdentityRequired: true;
    manifestLocalBindingRootsOnly: true;

    exactReferenceExpressionComparison: true;
    exactBindingNameComparison: true;
    bindingPrefixDelimiter: ".";
    longestExactBindingPrefixWins: true;

    rootClassificationPerformed: true;
    rootBindingDefinitionIdentityPreserved: true;

    referenceExpressionNormalized: false;
    bindingNameNormalized: false;
    caseFoldingPerformed: false;

    dottedReferenceSplitPerformed: false;
    dottedReferenceTraversalPerformed: false;
    graphTraversalPerformed: false;

    suffixPreservedOpaque: true;
    suffixSemanticsResolved: false;

    referenceValueResolved: false;
    canonicalFactOwnershipResolved: false;

    operatorSemanticsResolved: false;
    compoundSemanticsResolved: false;
    compoundBooleanCompositionExecuted: false;
    comparisonPerformed: false;

    occurrenceDomainResolved: false;
    occurrenceEnumerationPerformed: false;
    occurrenceFilteringPerformed: false;
    occurrenceBindingPerformed: false;
    occurrenceWinnerSelected: false;

    sentenceMembershipResolved: false;
    runtimeScopeExecutionPerformed: false;

    cardinalitySemanticsResolved: false;
    cardinalityEnforcementPerformed: false;

    actionFamilySemanticsResolved: false;
    roleSemanticsResolved: false;
    grammaticalFunctionResolved: false;
    subjectOfRelationInferred: false;

    graphMutationPerformed: false;
    learnerErrorClassified: false;

    candidateOnly: true;
    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_VERSION_V1;
    status: "ready" | "blocked";
    authorities: CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityV1[];
    blockingReasons: string[];
  };

function present(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function key(manifestId: string, manifestCode: string): string {
  return JSON.stringify([manifestId, manifestCode]);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function classify(
  referenceExpression: string,
  bindings: readonly CanonicalRuntimeManifestBindingDefinitionAuthorityV1[],
): {
  rootMatch: CanonicalRuntimeManifestBindingWhereReferenceRootMatchV1;
  rooted: boolean;
  rootBindingName: string | null;
  rootBindingDefinitionAuthorityId: string | null;
  opaqueSuffix: string | null;
} {
  const exact = bindings.find((b) => referenceExpression === b.bindingName);

  if (exact) {
    return {
      rootMatch: "exact_binding",
      rooted: true,
      rootBindingName: exact.bindingName,
      rootBindingDefinitionAuthorityId: exact.id,
      opaqueSuffix: null,
    };
  }

  const selected = bindings
    .filter((b) => referenceExpression.startsWith(`${b.bindingName}.`))
    .sort((a, b) =>
      (b.bindingName.length - a.bindingName.length) ||
      a.bindingName.localeCompare(b.bindingName)
    )[0];

  if (!selected) {
    return {
      rootMatch: "unrooted",
      rooted: false,
      rootBindingName: null,
      rootBindingDefinitionAuthorityId: null,
      opaqueSuffix: null,
    };
  }

  return {
    rootMatch: "binding_prefix_with_opaque_suffix",
    rooted: true,
    rootBindingName: selected.bindingName,
    rootBindingDefinitionAuthorityId: selected.id,
    opaqueSuffix: referenceExpression.slice(selected.bindingName.length),
  };
}

function safeA43a1Authority(
  b: CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1[
    "authorities"
  ][number],
): boolean {
  const g = b.governance;

  return (
    b.status === "candidate" &&
    present(b.id) &&
    present(b.manifestId) &&
    present(b.manifestCode) &&
    present(b.bindingName) &&
    g.exactValidatedManifestRequired === true &&
    g.exactManifestIdentityRequired === true &&
    g.manifestLocalBindingsOnly === true &&
    g.actionAuthorityRequired === false &&
    g.actionFamilySemanticsResolved === false &&
    g.runtimeFamilyLabelPreservedOpaque === true &&
    g.executionPhaseLabelPreservedOpaque === true &&
    g.runtimeFamilySemanticsResolved === false &&
    g.executionPhaseSemanticsResolved === false &&
    g.bindingNamePreservedOpaque === true &&
    g.bindingDefinitionPreservedOpaque === true &&
    g.entityLabelPreservedOpaque === true &&
    g.scopeLabelPreservedOpaque === true &&
    g.cardinalityLabelPreservedOpaque === true &&
    g.whereClausePreservedOpaque === true &&
    g.entitySemanticsResolved === false &&
    g.scopeSemanticsResolved === false &&
    g.cardinalitySemanticsResolved === false &&
    g.whereSemanticsResolved === false &&
    g.referenceSemanticsResolved === false &&
    g.occurrenceEnumerationPerformed === false &&
    g.occurrenceBindingPerformed === false &&
    g.winnerSelected === false &&
    g.graphMutationPerformed === false &&
    g.productionActivationAssumed === false &&
    g.learnerErrorClassified === false &&
    g.candidateOnly === true &&
    g.frozenGrammarReadOnly === true
  );
}

function safeReferenceExpressionAuthority(
  r: CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityResultV1[
    "authorities"
  ][number],
): boolean {
  const g = r.governance;

  return (
    r.status === "candidate" &&
    present(r.id) &&
    present(r.whereShapeAuthorityId) &&
    present(r.bindingDefinitionAuthorityId) &&
    present(r.manifestId) &&
    present(r.manifestCode) &&
    present(r.ownerBindingName) &&
    present(r.leafPath) &&
    present(r.operatorLabelOpaque) &&
    r.referenceEncoding === "explicit_ref_wrapper_v1" &&
    present(r.referenceExpression) &&
    g.exactA46a1ResultRequired === true &&
    g.exactA46a1AuthorityRequired === true &&
    g.exactLeafOperatorRequired === true &&
    g.exactExplicitRefWrapperRequired === true &&
    g.exactSingleOwnRefKeyRequired === true &&
    g.ownRefStringRequired === true &&
    g.sourceEncodingPreserved === true &&
    g.directStringLeftRecognizedAsReference === false &&
    g.arbitraryObjectRecognizedAsReference === false &&
    g.extraWrapperKeysAccepted === false &&
    g.referenceExpressionNormalized === false &&
    g.caseFoldingPerformed === false &&
    g.dottedReferenceSplitPerformed === false &&
    g.dottedReferenceTraversalPerformed === false &&
    g.referenceRootResolved === false &&
    g.bindingRootMatched === false &&
    g.suffixSemanticsResolved === false &&
    g.operatorSemanticsResolved === false &&
    g.compoundSemanticsResolved === false &&
    g.compoundBooleanCompositionExecuted === false &&
    g.referenceValueResolved === false &&
    g.canonicalFactOwnershipResolved === false &&
    g.comparisonPerformed === false &&
    g.occurrenceDomainResolved === false &&
    g.occurrenceEnumerationPerformed === false &&
    g.occurrenceFilteringPerformed === false &&
    g.occurrenceBindingPerformed === false &&
    g.sentenceMembershipResolved === false &&
    g.runtimeScopeExecutionPerformed === false &&
    g.cardinalitySemanticsResolved === false &&
    g.cardinalityEnforcementPerformed === false &&
    g.actionFamilySemanticsResolved === false &&
    g.roleSemanticsResolved === false &&
    g.grammaticalFunctionResolved === false &&
    g.subjectOfRelationInferred === false &&
    g.winnerSelected === false &&
    g.graphMutationPerformed === false &&
    g.learnerErrorClassified === false &&
    g.candidateOnly === true &&
    g.frozenGrammarReadOnly === true
  );
}

function governance(): CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityV1[
  "governance"
] {
  return {
    exactA46a2a0cResultRequired: true,
    exactA46a2a0cAuthorityRequired: true,
    exactA43a1ResultRequired: true,
    exactManifestBindingDefinitionAuthorityRequired: true,

    ownerBindingAuthorityIdentityRequired: true,
    exactManifestIdentityRequired: true,
    manifestLocalBindingRootsOnly: true,

    exactReferenceExpressionComparison: true,
    exactBindingNameComparison: true,
    bindingPrefixDelimiter: ".",
    longestExactBindingPrefixWins: true,

    rootClassificationPerformed: true,
    rootBindingDefinitionIdentityPreserved: true,

    referenceExpressionNormalized: false,
    bindingNameNormalized: false,
    caseFoldingPerformed: false,

    dottedReferenceSplitPerformed: false,
    dottedReferenceTraversalPerformed: false,
    graphTraversalPerformed: false,

    suffixPreservedOpaque: true,
    suffixSemanticsResolved: false,

    referenceValueResolved: false,
    canonicalFactOwnershipResolved: false,

    operatorSemanticsResolved: false,
    compoundSemanticsResolved: false,
    compoundBooleanCompositionExecuted: false,
    comparisonPerformed: false,

    occurrenceDomainResolved: false,
    occurrenceEnumerationPerformed: false,
    occurrenceFilteringPerformed: false,
    occurrenceBindingPerformed: false,
    occurrenceWinnerSelected: false,

    sentenceMembershipResolved: false,
    runtimeScopeExecutionPerformed: false,

    cardinalitySemanticsResolved: false,
    cardinalityEnforcementPerformed: false,

    actionFamilySemanticsResolved: false,
    roleSemanticsResolved: false,
    grammaticalFunctionResolved: false,
    subjectOfRelationInferred: false,

    graphMutationPerformed: false,
    learnerErrorClassified: false,

    candidateOnly: true,
    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeManifestBindingWhereReferenceRootAuthoritiesV1(
  referenceResult:
    CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityResultV1,
  bindingResult: CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
): CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityResultV1 {
  const blockingReasons: string[] = [];

  if (
    referenceResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_V1 ||
    referenceResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_VERSION_V1 ||
    referenceResult.status !== "ready" ||
    referenceResult.blockingReasons.length !== 0
  ) {
    blockingReasons.push("a4_6a2a0c_result:not_exact_ready");
  }

  if (
    bindingResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1 ||
    bindingResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1 ||
    bindingResult.status !== "ready" ||
    bindingResult.blockingReasons.length !== 0
  ) {
    blockingReasons.push("a4_3a1_result:not_exact_ready");
  }

  const bindingById = new Map<
    string,
    CanonicalRuntimeManifestBindingDefinitionAuthorityV1
  >();
  const bindingsByManifest = new Map<
    string,
    CanonicalRuntimeManifestBindingDefinitionAuthorityV1[]
  >();
  const seenBindingIdentity = new Set<string>();

  for (const b of bindingResult.authorities) {
    const identity = JSON.stringify([
      b.manifestId,
      b.manifestCode,
      b.bindingName,
    ]);

    if (!safeA43a1Authority(b)) {
      blockingReasons.push(`binding:${b.id}:unsafe_contract`);
      continue;
    }

    if (bindingById.has(b.id) || seenBindingIdentity.has(identity)) {
      blockingReasons.push(`binding:${b.id}:duplicate_identity`);
      continue;
    }

    bindingById.set(b.id, b);
    seenBindingIdentity.add(identity);

    const manifestKey = key(b.manifestId, b.manifestCode);
    const group = bindingsByManifest.get(manifestKey) ?? [];
    group.push(b);
    bindingsByManifest.set(manifestKey, group);
  }

  const seenReferenceIds = new Set<string>();

  for (const r of referenceResult.authorities) {
    if (!safeReferenceExpressionAuthority(r)) {
      blockingReasons.push(`reference:${r.id}:unsafe_contract`);
      continue;
    }

    if (seenReferenceIds.has(r.id)) {
      blockingReasons.push(`reference:${r.id}:duplicate`);
      continue;
    }
    seenReferenceIds.add(r.id);

    const owner = bindingById.get(r.bindingDefinitionAuthorityId);

    if (!owner) {
      blockingReasons.push(`reference:${r.id}:owner_binding_authority_missing`);
      continue;
    }

    if (
      owner.manifestId !== r.manifestId ||
      owner.manifestCode !== r.manifestCode ||
      owner.bindingName !== r.ownerBindingName
    ) {
      blockingReasons.push(`reference:${r.id}:owner_binding_identity_mismatch`);
    }
  }

  if (blockingReasons.length > 0) {
    return {
      producer:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1,
      producerVersion:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_VERSION_V1,
      status: "blocked",
      authorities: [],
      blockingReasons: uniqueSorted(blockingReasons),
    };
  }

  const authorities = [...referenceResult.authorities]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r): CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityV1 => {
      const manifestBindings = [
        ...(bindingsByManifest.get(key(r.manifestId, r.manifestCode)) ?? []),
      ];

      const root = classify(r.referenceExpression, manifestBindings);

      return {
        id: [
          "runtime-manifest-binding-where-reference-root-v1",
          encodeURIComponent(r.id),
          root.rootMatch,
          encodeURIComponent(root.rootBindingName ?? "none"),
        ].join(":"),
        status: "candidate",
        referenceExpressionAuthorityId: r.id,
        whereShapeAuthorityId: r.whereShapeAuthorityId,
        ownerBindingDefinitionAuthorityId: r.bindingDefinitionAuthorityId,
        manifestId: r.manifestId,
        manifestCode: r.manifestCode,
        ownerBindingName: r.ownerBindingName,
        leafPath: r.leafPath,
        operatorLabelOpaque: r.operatorLabelOpaque,
        referenceExpression: r.referenceExpression,
        rootMatch: root.rootMatch,
        rooted: root.rooted,
        rootBindingName: root.rootBindingName,
        rootBindingDefinitionAuthorityId: root.rootBindingDefinitionAuthorityId,
        opaqueSuffix: root.opaqueSuffix,
        governance: governance(),
      };
    });

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_VERSION_V1,
    status: "ready",
    authorities,
    blockingReasons: [],
  };
}
