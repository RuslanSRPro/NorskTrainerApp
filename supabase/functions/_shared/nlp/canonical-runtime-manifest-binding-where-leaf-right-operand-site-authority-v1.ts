// Norsk Trainer — Canonical Runtime Manifest Binding WHERE Leaf / Right-Operand Site Authority V1
//
// v1.46 A4.6a2b
//
// Composition:
//
//   family-neutral A4.6a1 exact WHERE-shape authority
//       +
//   family-neutral A4.6a2a exact rooted left-reference authority
//       +
//   exact same owner / manifest / leaf identity
//       ->
//   one candidate rooted leaf/right-operand structural site.
//
// IMPORTANT:
//
// The binding that OWNS the WHERE clause and the binding REFERENCED by
// left.ref are separate identities and remain separate.
//
// This layer proves structural site identity and preserves an exact detached
// right-operand snapshot. It does NOT interpret the operand, execute the
// operator, resolve the opaque dotted suffix, bind Runtime occurrences,
// execute scope/cardinality, infer grammatical roles, or mutate the graph.

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1,
  type CanonicalRuntimeManifestBindingWhereShapeAuthorityV1,
  type CanonicalRuntimeManifestWhereShapeNodeV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityResultV1,
  type CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityV1,
  type CanonicalRuntimeManifestBindingWhereReferenceRootMatchV1,
} from "./canonical-runtime-manifest-binding-where-reference-root-authority-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_V1 =
  "canonical_runtime_manifest_binding_where_leaf_right_operand_site_authority_v1";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_VERSION_V1 =
  "1";

export type CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityV1 =
  {
    id: string;
    status: "candidate";

    referenceRootAuthorityId: string;
    referenceExpressionAuthorityId: string;
    whereShapeAuthorityId: string;

    ownerBindingDefinitionAuthorityId: string;
    manifestId: string;
    manifestCode: string;
    ownerBindingName: string;

    leafPath: string;
    operatorLabelOpaque: string;

    leftReferenceExpression: string;
    leftRootMatch: Exclude<
      CanonicalRuntimeManifestBindingWhereReferenceRootMatchV1,
      "unrooted"
    >;

    referencedBindingDefinitionAuthorityId: string;
    referencedBindingName: string;
    opaqueLeftSuffix: string | null;

    hasRightOperand: true;
    rightOperandSnapshot: unknown;

    governance: {
      exactA46a1ResultRequired: true;
      exactA46a1AuthorityRequired: true;
      exactA46a2aResultRequired: true;
      exactA46a2aAuthorityRequired: true;

      sameWhereShapeAuthorityRequired: true;
      sameOwnerBindingDefinitionAuthorityRequired: true;
      sameManifestIdentityRequired: true;
      sameOwnerBindingNameRequired: true;
      sameLeafPathRequired: true;
      sameOperatorLabelRequired: true;

      rootedReferenceRequired: true;
      referencedBindingIdentityRequired: true;
      ownerBindingAndReferencedBindingKeptSeparate: true;

      rightOperandPresenceRequired: true;
      rightOperandSnapshotPreserved: true;
      rightOperandSnapshotDetached: true;

      leftReferenceExpressionPreserved: true;
      opaqueLeftSuffixPreserved: true;
      operatorLabelPreservedOpaque: true;

      structuralSiteOnly: true;
      unrootedReferenceExcluded: true;
      unrootedReferenceIsDiagnostic: true;
      rootedWithoutRightOperandIsDiagnostic: true;

      rightOperandSemanticsResolved: false;
      stringOperandMappedToPos: false;
      operatorSemanticsResolved: false;
      compoundSemanticsResolved: false;
      compoundBooleanCompositionExecuted: false;

      referenceSuffixSemanticsResolved: false;
      dottedReferenceTraversalPerformed: false;
      referenceValueResolved: false;
      canonicalFactOwnershipResolved: false;

      comparisonPerformed: false;
      valueCoercionPerformed: false;
      caseNormalizationPerformed: false;

      occurrenceDomainResolved: false;
      occurrenceEnumerationPerformed: false;
      occurrenceFilteringPerformed: false;
      occurrenceBindingPerformed: false;

      sentenceMembershipResolved: false;
      runtimeScopeExecutionPerformed: false;

      cardinalitySemanticsResolved: false;
      cardinalityEnforcementPerformed: false;

      actionFamilySemanticsResolved: false;
      roleSemanticsResolved: false;
      grammaticalFunctionResolved: false;
      subjectOfRelationInferred: false;

      graphTraversalPerformed: false;
      graphMutationPerformed: false;
      learnerErrorClassified: false;

      candidateOnly: true;
      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_VERSION_V1;

    status: "ready" | "blocked";
    authorities:
      CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityV1[];

    rootedReferenceSiteCount: number;
    explicitRightOperandSiteCount: number;
    composedSiteCount: number;

    unrootedReferenceSites: string[];
    rootedSitesWithoutRightOperand: string[];

    blockingReasons: string[];
  };

function present(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function ownerIdentity(
  bindingDefinitionAuthorityId: string,
  manifestId: string,
  manifestCode: string,
  bindingName: string,
): string {
  return JSON.stringify([
    bindingDefinitionAuthorityId,
    manifestId,
    manifestCode,
    bindingName,
  ]);
}

function siteKey(whereShapeAuthorityId: string, leafPath: string): string {
  return JSON.stringify([whereShapeAuthorityId, leafPath]);
}

function cloneSnapshot(value: unknown): unknown {
  return structuredClone(value);
}

function safeShapeNode(
  node: CanonicalRuntimeManifestWhereShapeNodeV1,
): boolean {
  if (!present(node.path)) return false;

  if (node.shape === "absent") return true;

  if (node.shape === "leaf_operator") {
    return (
      present(node.operatorLabel) &&
      typeof node.hasRightOperand === "boolean" &&
      hasOwn(node as unknown as object, "leftOperandSnapshot") &&
      hasOwn(node as unknown as object, "rightOperandSnapshot") &&
      hasOwn(node as unknown as object, "rawSnapshot")
    );
  }

  if (node.shape === "compound_array_group") {
    return (
      present(node.compoundKey) &&
      Array.isArray(node.children) &&
      node.children.every(safeShapeNode) &&
      hasOwn(node as unknown as object, "rawSnapshot")
    );
  }

  return (
    node.shape === "unclassified" &&
    hasOwn(node as unknown as object, "rawSnapshot")
  );
}

function safeA46a1Authority(
  authority: CanonicalRuntimeManifestBindingWhereShapeAuthorityV1,
): boolean {
  const g = authority.governance;

  return (
    authority.status === "candidate" &&
    present(authority.id) &&
    present(authority.bindingDefinitionAuthorityId) &&
    present(authority.manifestId) &&
    present(authority.manifestCode) &&
    present(authority.bindingName) &&
    safeShapeNode(authority.root) &&
    Array.isArray(authority.unclassifiedPaths) &&
    authority.unclassifiedPaths.every(present) &&
    g.exactA43a1ResultRequired === true &&
    g.exactManifestBindingDefinitionAuthorityRequired === true &&
    g.whereClauseConsumedFromA43a1 === true &&
    g.whereClauseReadOnly === true &&
    g.whereShapeOnly === true &&
    g.rawSnapshotPreserved === true &&
    g.structuralPathIdentityPreserved === true &&
    g.runtimeOperatorVocabularyHardcoded === false &&
    g.compoundKeyVocabularyHardcoded === false &&
    g.operatorSemanticsResolved === false &&
    g.compoundSemanticsResolved === false &&
    g.compoundBooleanCompositionExecuted === false &&
    g.referenceSemanticsResolved === false &&
    g.dottedReferenceTraversalPerformed === false &&
    g.leftOperandSemanticsResolved === false &&
    g.rightOperandSemanticsResolved === false &&
    g.canonicalFactOwnershipResolved === false &&
    g.comparisonPerformed === false &&
    g.valueCoercionPerformed === false &&
    g.caseNormalizationPerformed === false &&
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

function safeA46a2aAuthority(
  authority: CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityV1,
): boolean {
  const g = authority.governance;

  const rootFieldsSafe = authority.rootMatch === "exact_binding"
    ? (
      authority.rooted === true &&
      present(authority.rootBindingName) &&
      present(authority.rootBindingDefinitionAuthorityId) &&
      authority.opaqueSuffix === null
    )
    : authority.rootMatch === "binding_prefix_with_opaque_suffix"
    ? (
      authority.rooted === true &&
      present(authority.rootBindingName) &&
      present(authority.rootBindingDefinitionAuthorityId) &&
      present(authority.opaqueSuffix)
    )
    : (
      authority.rootMatch === "unrooted" &&
      authority.rooted === false &&
      authority.rootBindingName === null &&
      authority.rootBindingDefinitionAuthorityId === null &&
      authority.opaqueSuffix === null
    );

  return (
    authority.status === "candidate" &&
    present(authority.id) &&
    present(authority.referenceExpressionAuthorityId) &&
    present(authority.whereShapeAuthorityId) &&
    present(authority.ownerBindingDefinitionAuthorityId) &&
    present(authority.manifestId) &&
    present(authority.manifestCode) &&
    present(authority.ownerBindingName) &&
    present(authority.leafPath) &&
    present(authority.operatorLabelOpaque) &&
    present(authority.referenceExpression) &&
    rootFieldsSafe &&
    g.exactA46a2a0cResultRequired === true &&
    g.exactA46a2a0cAuthorityRequired === true &&
    g.exactA43a1ResultRequired === true &&
    g.exactManifestBindingDefinitionAuthorityRequired === true &&
    g.ownerBindingAuthorityIdentityRequired === true &&
    g.exactManifestIdentityRequired === true &&
    g.manifestLocalBindingRootsOnly === true &&
    g.exactReferenceExpressionComparison === true &&
    g.exactBindingNameComparison === true &&
    g.bindingPrefixDelimiter === "." &&
    g.longestExactBindingPrefixWins === true &&
    g.rootClassificationPerformed === true &&
    g.rootBindingDefinitionIdentityPreserved === true &&
    g.referenceExpressionNormalized === false &&
    g.bindingNameNormalized === false &&
    g.caseFoldingPerformed === false &&
    g.dottedReferenceSplitPerformed === false &&
    g.dottedReferenceTraversalPerformed === false &&
    g.graphTraversalPerformed === false &&
    g.suffixPreservedOpaque === true &&
    g.suffixSemanticsResolved === false &&
    g.referenceValueResolved === false &&
    g.canonicalFactOwnershipResolved === false &&
    g.operatorSemanticsResolved === false &&
    g.compoundSemanticsResolved === false &&
    g.compoundBooleanCompositionExecuted === false &&
    g.comparisonPerformed === false &&
    g.occurrenceDomainResolved === false &&
    g.occurrenceEnumerationPerformed === false &&
    g.occurrenceFilteringPerformed === false &&
    g.occurrenceBindingPerformed === false &&
    g.occurrenceWinnerSelected === false &&
    g.sentenceMembershipResolved === false &&
    g.runtimeScopeExecutionPerformed === false &&
    g.cardinalitySemanticsResolved === false &&
    g.cardinalityEnforcementPerformed === false &&
    g.actionFamilySemanticsResolved === false &&
    g.roleSemanticsResolved === false &&
    g.grammaticalFunctionResolved === false &&
    g.subjectOfRelationInferred === false &&
    g.graphMutationPerformed === false &&
    g.learnerErrorClassified === false &&
    g.candidateOnly === true &&
    g.frozenGrammarReadOnly === true
  );
}

function collectLeafOperatorsAtPath(
  node: CanonicalRuntimeManifestWhereShapeNodeV1,
  path: string,
  out: Extract<
    CanonicalRuntimeManifestWhereShapeNodeV1,
    { shape: "leaf_operator" }
  >[],
): void {
  if (node.shape === "leaf_operator") {
    if (node.path === path) out.push(node);
    return;
  }

  if (node.shape === "compound_array_group") {
    for (const child of node.children) {
      collectLeafOperatorsAtPath(child, path, out);
    }
  }
}

function governance(): CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityV1[
  "governance"
] {
  return {
    exactA46a1ResultRequired: true,
    exactA46a1AuthorityRequired: true,
    exactA46a2aResultRequired: true,
    exactA46a2aAuthorityRequired: true,

    sameWhereShapeAuthorityRequired: true,
    sameOwnerBindingDefinitionAuthorityRequired: true,
    sameManifestIdentityRequired: true,
    sameOwnerBindingNameRequired: true,
    sameLeafPathRequired: true,
    sameOperatorLabelRequired: true,

    rootedReferenceRequired: true,
    referencedBindingIdentityRequired: true,
    ownerBindingAndReferencedBindingKeptSeparate: true,

    rightOperandPresenceRequired: true,
    rightOperandSnapshotPreserved: true,
    rightOperandSnapshotDetached: true,

    leftReferenceExpressionPreserved: true,
    opaqueLeftSuffixPreserved: true,
    operatorLabelPreservedOpaque: true,

    structuralSiteOnly: true,
    unrootedReferenceExcluded: true,
    unrootedReferenceIsDiagnostic: true,
    rootedWithoutRightOperandIsDiagnostic: true,

    rightOperandSemanticsResolved: false,
    stringOperandMappedToPos: false,
    operatorSemanticsResolved: false,
    compoundSemanticsResolved: false,
    compoundBooleanCompositionExecuted: false,

    referenceSuffixSemanticsResolved: false,
    dottedReferenceTraversalPerformed: false,
    referenceValueResolved: false,
    canonicalFactOwnershipResolved: false,

    comparisonPerformed: false,
    valueCoercionPerformed: false,
    caseNormalizationPerformed: false,

    occurrenceDomainResolved: false,
    occurrenceEnumerationPerformed: false,
    occurrenceFilteringPerformed: false,
    occurrenceBindingPerformed: false,

    sentenceMembershipResolved: false,
    runtimeScopeExecutionPerformed: false,

    cardinalitySemanticsResolved: false,
    cardinalityEnforcementPerformed: false,

    actionFamilySemanticsResolved: false,
    roleSemanticsResolved: false,
    grammaticalFunctionResolved: false,
    subjectOfRelationInferred: false,

    graphTraversalPerformed: false,
    graphMutationPerformed: false,
    learnerErrorClassified: false,

    candidateOnly: true,
    frozenGrammarReadOnly: true,
  };
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_VERSION_V1,
    status: "blocked",
    authorities: [],
    rootedReferenceSiteCount: 0,
    explicitRightOperandSiteCount: 0,
    composedSiteCount: 0,
    unrootedReferenceSites: [],
    rootedSitesWithoutRightOperand: [],
    blockingReasons: uniqueSorted(reasons),
  };
}

export function deriveCanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthoritiesV1(
  shapeResult: CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1,
  rootResult:
    CanonicalRuntimeManifestBindingWhereReferenceRootAuthorityResultV1,
): CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityResultV1 {
  const blockingReasons: string[] = [];

  if (
    shapeResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1 ||
    shapeResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1 ||
    shapeResult.status !== "ready" ||
    shapeResult.blockingReasons.length !== 0
  ) {
    blockingReasons.push("a4_6a1_result:not_exact_ready");
  }

  if (
    rootResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1 ||
    rootResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_VERSION_V1 ||
    rootResult.status !== "ready" ||
    rootResult.blockingReasons.length !== 0
  ) {
    blockingReasons.push("a4_6a2a_result:not_exact_ready");
  }

  const shapeById = new Map<
    string,
    CanonicalRuntimeManifestBindingWhereShapeAuthorityV1
  >();
  const seenOwnerIdentity = new Set<string>();

  for (const shape of shapeResult.authorities) {
    if (!safeA46a1Authority(shape)) {
      blockingReasons.push(`shape:${shape.id}:unsafe_contract`);
      continue;
    }

    if (shapeById.has(shape.id)) {
      blockingReasons.push(`shape:${shape.id}:duplicate_id`);
      continue;
    }

    const owner = ownerIdentity(
      shape.bindingDefinitionAuthorityId,
      shape.manifestId,
      shape.manifestCode,
      shape.bindingName,
    );

    if (seenOwnerIdentity.has(owner)) {
      blockingReasons.push(`shape:${shape.id}:duplicate_owner_identity`);
      continue;
    }

    shapeById.set(shape.id, shape);
    seenOwnerIdentity.add(owner);
  }

  const seenRootIds = new Set<string>();

  for (const root of rootResult.authorities) {
    if (!safeA46a2aAuthority(root)) {
      blockingReasons.push(`root:${root.id}:unsafe_contract`);
      continue;
    }

    if (seenRootIds.has(root.id)) {
      blockingReasons.push(`root:${root.id}:duplicate_id`);
      continue;
    }

    seenRootIds.add(root.id);

    const shape = shapeById.get(root.whereShapeAuthorityId);

    if (!shape) {
      blockingReasons.push(`root:${root.id}:unknown_where_shape_authority`);
      continue;
    }

    if (
      root.ownerBindingDefinitionAuthorityId !==
        shape.bindingDefinitionAuthorityId ||
      root.manifestId !== shape.manifestId ||
      root.manifestCode !== shape.manifestCode ||
      root.ownerBindingName !== shape.bindingName
    ) {
      blockingReasons.push(`root:${root.id}:shape_owner_identity_mismatch`);
      continue;
    }

    const leaves: Extract<
      CanonicalRuntimeManifestWhereShapeNodeV1,
      { shape: "leaf_operator" }
    >[] = [];

    collectLeafOperatorsAtPath(shape.root, root.leafPath, leaves);

    if (leaves.length === 0) {
      blockingReasons.push(`root:${root.id}:leaf_path_missing`);
      continue;
    }

    if (leaves.length !== 1) {
      blockingReasons.push(`root:${root.id}:duplicate_leaf_path`);
      continue;
    }

    const leaf = leaves[0]!;

    if (leaf.operatorLabel !== root.operatorLabelOpaque) {
      blockingReasons.push(`root:${root.id}:operator_label_mismatch`);
    }
  }

  if (blockingReasons.length > 0) {
    return blocked(blockingReasons);
  }

  const authorities:
    CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityV1[] = [];

  const unrootedReferenceSites: string[] = [];
  const rootedSitesWithoutRightOperand: string[] = [];

  let rootedReferenceSiteCount = 0;
  let explicitRightOperandSiteCount = 0;

  for (
    const root of [...rootResult.authorities].sort((a, b) =>
      a.id.localeCompare(b.id)
    )
  ) {
    const shape = shapeById.get(root.whereShapeAuthorityId)!;

    const leaves: Extract<
      CanonicalRuntimeManifestWhereShapeNodeV1,
      { shape: "leaf_operator" }
    >[] = [];

    collectLeafOperatorsAtPath(shape.root, root.leafPath, leaves);

    const leaf = leaves[0]!;
    const key = siteKey(root.whereShapeAuthorityId, root.leafPath);

    if (leaf.hasRightOperand) {
      explicitRightOperandSiteCount += 1;
    }

    if (!root.rooted || root.rootMatch === "unrooted") {
      unrootedReferenceSites.push(key);
      continue;
    }

    rootedReferenceSiteCount += 1;

    if (
      !present(root.rootBindingDefinitionAuthorityId) ||
      !present(root.rootBindingName)
    ) {
      return blocked([
        `root:${root.id}:rooted_reference_missing_referenced_binding_identity`,
      ]);
    }

    if (!leaf.hasRightOperand) {
      rootedSitesWithoutRightOperand.push(key);
      continue;
    }

    authorities.push({
      id: [
        "runtime-manifest-binding-where-leaf-right-operand-site-v1",
        encodeURIComponent(root.id),
        encodeURIComponent(root.whereShapeAuthorityId),
        encodeURIComponent(root.leafPath),
      ].join(":"),
      status: "candidate",

      referenceRootAuthorityId: root.id,
      referenceExpressionAuthorityId: root.referenceExpressionAuthorityId,
      whereShapeAuthorityId: root.whereShapeAuthorityId,

      ownerBindingDefinitionAuthorityId: root.ownerBindingDefinitionAuthorityId,
      manifestId: root.manifestId,
      manifestCode: root.manifestCode,
      ownerBindingName: root.ownerBindingName,

      leafPath: root.leafPath,
      operatorLabelOpaque: root.operatorLabelOpaque,

      leftReferenceExpression: root.referenceExpression,
      leftRootMatch: root.rootMatch,

      referencedBindingDefinitionAuthorityId:
        root.rootBindingDefinitionAuthorityId,
      referencedBindingName: root.rootBindingName,
      opaqueLeftSuffix: root.opaqueSuffix,

      hasRightOperand: true,
      rightOperandSnapshot: cloneSnapshot(leaf.rightOperandSnapshot),

      governance: governance(),
    });
  }

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_VERSION_V1,
    status: "ready",
    authorities,
    rootedReferenceSiteCount,
    explicitRightOperandSiteCount,
    composedSiteCount: authorities.length,
    unrootedReferenceSites: uniqueSorted(unrootedReferenceSites),
    rootedSitesWithoutRightOperand: uniqueSorted(
      rootedSitesWithoutRightOperand,
    ),
    blockingReasons: [],
  };
}
