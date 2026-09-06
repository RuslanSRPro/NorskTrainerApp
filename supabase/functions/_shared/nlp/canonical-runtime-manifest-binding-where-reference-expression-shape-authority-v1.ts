// Norsk Trainer
//
// v1.46 A4.6a2a0c
//
// FAMILY-NEUTRAL MANIFEST BINDING WHERE
// REFERENCE-EXPRESSION SHAPE AUTHORITY
//
// Proven Runtime source encoding:
//
//   left: {
//     ref: "subject.pos"
//   }
//
// This layer recognizes ONLY the exact structural wrapper:
//
//   object
//   exactly one own key: "ref"
//   ref value is a non-empty string
//
// It preserves that string as an opaque reference expression.
//
// IMPORTANT:
//
// It does NOT:
//
// - treat a direct string left operand as a reference;
// - accept arbitrary objects containing ref plus additional fields;
// - split dotted references;
// - traverse properties;
// - resolve a binding root;
// - interpret suffixes;
// - execute WHERE operators;
// - combine compound truth;
// - compare values;
// - enumerate/filter/bind occurrences;
// - execute scope/cardinality;
// - resolve role semantics;
// - mutate the graph.

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1,
  type CanonicalRuntimeManifestBindingWhereShapeAuthorityV1,
  type CanonicalRuntimeManifestWhereShapeNodeV1,
} from "./canonical-runtime-manifest-binding-where-shape-authority-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_V1 =
  "canonical_runtime_manifest_binding_where_reference_expression_shape_authority_v1";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_VERSION_V1 =
  "1";

type JsonRecord = Record<
  string,
  unknown
>;

export type CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityV1 =
  {
    id: string;

    status: "candidate";

    whereShapeAuthorityId: string;

    bindingDefinitionAuthorityId: string;

    manifestId: string;

    manifestCode: string;

    ownerBindingName: string;

    leafPath: string;

    operatorLabelOpaque: string;

    referenceEncoding: "explicit_ref_wrapper_v1";

    referenceExpression: string;

    leftOperandSnapshot: unknown;

    governance: {
      exactA46a1ResultRequired: true;

      exactA46a1AuthorityRequired: true;

      exactLeafOperatorRequired: true;

      exactExplicitRefWrapperRequired: true;

      exactSingleOwnRefKeyRequired: true;

      ownRefStringRequired: true;

      sourceEncodingPreserved: true;

      directStringLeftRecognizedAsReference: false;

      arbitraryObjectRecognizedAsReference: false;

      extraWrapperKeysAccepted: false;

      referenceExpressionNormalized: false;

      caseFoldingPerformed: false;

      dottedReferenceSplitPerformed: false;

      dottedReferenceTraversalPerformed: false;

      referenceRootResolved: false;

      bindingRootMatched: false;

      suffixSemanticsResolved: false;

      operatorSemanticsResolved: false;

      compoundSemanticsResolved: false;

      compoundBooleanCompositionExecuted: false;

      referenceValueResolved: false;

      canonicalFactOwnershipResolved: false;

      comparisonPerformed: false;

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

      winnerSelected: false;

      graphMutationPerformed: false;

      learnerErrorClassified: false;

      candidateOnly: true;

      frozenGrammarReadOnly: true;
    };
  };

export type CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_VERSION_V1;

    status:
      | "ready"
      | "blocked";

    authorities:
      CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityV1[];

    examinedLeafCount: number;

    recognizedReferenceLeafCount: number;

    unsupportedEncodingSiteKeys: string[];

    blockingReasons: string[];
  };

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    value !==
      null &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  );
}

function hasOwn(
  value: JsonRecord,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  );
}

function stringPresentExact(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.length >
      0
  );
}

function cloneSnapshot(
  value: unknown,
): unknown {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      cloneSnapshot,
    );
  }

  if (
    isRecord(
      value,
    )
  ) {
    const out: JsonRecord = {};

    for (
      const key of Object.keys(
        value,
      )
    ) {
      out[key] = cloneSnapshot(
        value[
          key
        ],
      );
    }

    return out;
  }

  return value;
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  );
}

function safeShapeNode(
  node: CanonicalRuntimeManifestWhereShapeNodeV1,
): boolean {
  if (
    !stringPresentExact(
      node.path,
    )
  ) {
    return false;
  }

  if (
    node.shape ===
      "absent"
  ) {
    return true;
  }

  if (
    node.shape ===
      "leaf_operator"
  ) {
    return (
      stringPresentExact(
        node.operatorLabel,
      ) &&
      typeof node.hasRightOperand ===
        "boolean" &&
      hasOwn(
        node as unknown as JsonRecord,
        "leftOperandSnapshot",
      ) &&
      hasOwn(
        node as unknown as JsonRecord,
        "rightOperandSnapshot",
      ) &&
      hasOwn(
        node as unknown as JsonRecord,
        "rawSnapshot",
      )
    );
  }

  if (
    node.shape ===
      "compound_array_group"
  ) {
    return (
      stringPresentExact(
        node.compoundKey,
      ) &&
      Array.isArray(
        node.children,
      ) &&
      node.children.every(
        safeShapeNode,
      ) &&
      hasOwn(
        node as unknown as JsonRecord,
        "rawSnapshot",
      )
    );
  }

  return (
    node.shape ===
      "unclassified" &&
    hasOwn(
      node as unknown as JsonRecord,
      "rawSnapshot",
    )
  );
}

function safeA46a1Authority(
  authority: CanonicalRuntimeManifestBindingWhereShapeAuthorityV1,
): boolean {
  const g = authority.governance;

  return (
    authority.status ===
      "candidate" &&
    stringPresentExact(
      authority.id,
    ) &&
    stringPresentExact(
      authority.bindingDefinitionAuthorityId,
    ) &&
    stringPresentExact(
      authority.manifestId,
    ) &&
    stringPresentExact(
      authority.manifestCode,
    ) &&
    stringPresentExact(
      authority.bindingName,
    ) &&
    safeShapeNode(
      authority.root,
    ) &&
    Array.isArray(
      authority.unclassifiedPaths,
    ) &&
    g.exactA43a1ResultRequired ===
      true &&
    g.exactManifestBindingDefinitionAuthorityRequired ===
      true &&
    g.whereClauseConsumedFromA43a1 ===
      true &&
    g.whereClauseReadOnly ===
      true &&
    g.whereShapeOnly ===
      true &&
    g.rawSnapshotPreserved ===
      true &&
    g.structuralPathIdentityPreserved ===
      true &&
    g.runtimeOperatorVocabularyHardcoded ===
      false &&
    g.compoundKeyVocabularyHardcoded ===
      false &&
    g.operatorSemanticsResolved ===
      false &&
    g.compoundSemanticsResolved ===
      false &&
    g.compoundBooleanCompositionExecuted ===
      false &&
    g.referenceSemanticsResolved ===
      false &&
    g.dottedReferenceTraversalPerformed ===
      false &&
    g.leftOperandSemanticsResolved ===
      false &&
    g.rightOperandSemanticsResolved ===
      false &&
    g.canonicalFactOwnershipResolved ===
      false &&
    g.comparisonPerformed ===
      false &&
    g.valueCoercionPerformed ===
      false &&
    g.caseNormalizationPerformed ===
      false &&
    g.occurrenceDomainResolved ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceFilteringPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.sentenceMembershipResolved ===
      false &&
    g.runtimeScopeExecutionPerformed ===
      false &&
    g.cardinalitySemanticsResolved ===
      false &&
    g.cardinalityEnforcementPerformed ===
      false &&
    g.actionFamilySemanticsResolved ===
      false &&
    g.roleSemanticsResolved ===
      false &&
    g.grammaticalFunctionResolved ===
      false &&
    g.subjectOfRelationInferred ===
      false &&
    g.winnerSelected ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function exactRefExpression(
  value: unknown,
): string | null {
  if (
    !isRecord(
      value,
    )
  ) {
    return null;
  }

  const keys = Object.keys(
    value,
  );

  if (
    keys.length !==
      1 ||
    keys[0] !==
      "ref" ||
    !hasOwn(
      value,
      "ref",
    ) ||
    !stringPresentExact(
      value.ref,
    )
  ) {
    return null;
  }

  return value.ref;
}

type LeafSite = {
  path: string;

  operatorLabel: string;

  leftOperandSnapshot: unknown;
};

function collectLeafSites(
  node: CanonicalRuntimeManifestWhereShapeNodeV1,
): LeafSite[] {
  if (
    node.shape ===
      "leaf_operator"
  ) {
    return [{
      path: node.path,

      operatorLabel: node.operatorLabel,

      leftOperandSnapshot: node.leftOperandSnapshot,
    }];
  }

  if (
    node.shape !==
      "compound_array_group"
  ) {
    return [];
  }

  return node.children
    .flatMap(
      collectLeafSites,
    );
}

function siteKey(
  authority: CanonicalRuntimeManifestBindingWhereShapeAuthorityV1,
  leaf: LeafSite,
): string {
  return [
    authority.id,
    leaf.path,
  ].join(
    "#",
  );
}

function governance(): CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityV1[
  "governance"
] {
  return {
    exactA46a1ResultRequired: true,

    exactA46a1AuthorityRequired: true,

    exactLeafOperatorRequired: true,

    exactExplicitRefWrapperRequired: true,

    exactSingleOwnRefKeyRequired: true,

    ownRefStringRequired: true,

    sourceEncodingPreserved: true,

    directStringLeftRecognizedAsReference: false,

    arbitraryObjectRecognizedAsReference: false,

    extraWrapperKeysAccepted: false,

    referenceExpressionNormalized: false,

    caseFoldingPerformed: false,

    dottedReferenceSplitPerformed: false,

    dottedReferenceTraversalPerformed: false,

    referenceRootResolved: false,

    bindingRootMatched: false,

    suffixSemanticsResolved: false,

    operatorSemanticsResolved: false,

    compoundSemanticsResolved: false,

    compoundBooleanCompositionExecuted: false,

    referenceValueResolved: false,

    canonicalFactOwnershipResolved: false,

    comparisonPerformed: false,

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

    winnerSelected: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthoritiesV1(
  shapeResult: CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1,
): CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityResultV1 {
  const blockingReasons: string[] = [];

  if (
    shapeResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1 ||
    shapeResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1 ||
    shapeResult.status !==
      "ready" ||
    shapeResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      "a4_6a1_result:not_exact_ready",
    );
  }

  const seenAuthorityIds = new Set<string>();

  for (
    const authority of shapeResult.authorities
  ) {
    if (
      seenAuthorityIds.has(
        authority.id,
      )
    ) {
      blockingReasons.push(
        `where_shape_authority:${authority.id}:duplicate`,
      );

      continue;
    }

    seenAuthorityIds.add(
      authority.id,
    );

    if (
      !safeA46a1Authority(
        authority,
      )
    ) {
      blockingReasons.push(
        `where_shape_authority:${authority.id}:unsafe_contract`,
      );
    }
  }

  if (
    blockingReasons.length >
      0
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_VERSION_V1,

      status: "blocked",

      authorities: [],

      examinedLeafCount: 0,

      recognizedReferenceLeafCount: 0,

      unsupportedEncodingSiteKeys: [],

      blockingReasons: uniqueSorted(
        blockingReasons,
      ),
    };
  }

  const authorities:
    CanonicalRuntimeManifestBindingWhereReferenceExpressionShapeAuthorityV1[] =
      [];

  const unsupportedEncodingSiteKeys: string[] = [];

  let examinedLeafCount = 0;

  for (
    const shapeAuthority of [...shapeResult.authorities].sort(
      (
        a,
        b,
      ) =>
        a.id.localeCompare(
          b.id,
        ),
    )
  ) {
    const leaves = collectLeafSites(
      shapeAuthority.root,
    );

    for (
      const leaf of leaves
    ) {
      examinedLeafCount++;

      const expression = exactRefExpression(
        leaf.leftOperandSnapshot,
      );

      if (
        expression ===
          null
      ) {
        unsupportedEncodingSiteKeys.push(
          siteKey(
            shapeAuthority,
            leaf,
          ),
        );

        continue;
      }

      authorities.push({
        id: [
          "runtime-manifest-binding-where-reference-expression-shape-v1",
          idPart(
            shapeAuthority.id,
          ),
          idPart(
            leaf.path,
          ),
          idPart(
            expression,
          ),
        ].join(
          ":",
        ),

        status: "candidate",

        whereShapeAuthorityId: shapeAuthority.id,

        bindingDefinitionAuthorityId:
          shapeAuthority.bindingDefinitionAuthorityId,

        manifestId: shapeAuthority.manifestId,

        manifestCode: shapeAuthority.manifestCode,

        ownerBindingName: shapeAuthority.bindingName,

        leafPath: leaf.path,

        operatorLabelOpaque: leaf.operatorLabel,

        referenceEncoding: "explicit_ref_wrapper_v1",

        referenceExpression: expression,

        leftOperandSnapshot: cloneSnapshot(
          leaf.leftOperandSnapshot,
        ),

        governance: governance(),
      });
    }
  }

  authorities.sort(
    (
      a,
      b,
    ) =>
      a.id.localeCompare(
        b.id,
      ),
  );

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_REFERENCE_EXPRESSION_SHAPE_AUTHORITY_VERSION_V1,

    status: "ready",

    authorities,

    examinedLeafCount,

    recognizedReferenceLeafCount: authorities.length,

    unsupportedEncodingSiteKeys: uniqueSorted(
      unsupportedEncodingSiteKeys,
    ),

    blockingReasons: [],
  };
}
