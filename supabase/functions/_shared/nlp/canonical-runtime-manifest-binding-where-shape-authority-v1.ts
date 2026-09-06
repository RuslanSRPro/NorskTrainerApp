// Norsk Trainer — Canonical Runtime Manifest Binding WHERE Shape Authority V1
//
// v1.46 A4.6a1
//
// Family-neutral structural authority for Runtime manifest binding WHERE.
//
//   exact A4.3a1 manifest-local binding-definition authority
//       +
//   opaque whereClause
//       ->
//   structural WHERE shape only
//
// Supported structural classifications:
//
//   absent
//   leaf_operator
//   compound_array_group
//   unclassified
//
// IMPORTANT:
//
// Shape is NOT truth.
//
// This layer does NOT:
// - assign semantics to operator labels;
// - assign semantics to compound keys;
// - interpret all / any / not;
// - execute boolean composition;
// - traverse dotted references;
// - resolve reference semantics;
// - compare values;
// - map strings to POS;
// - enumerate/filter graph occurrences;
// - execute sentence scope;
// - enforce cardinality;
// - bind Runtime occurrences;
// - resolve grammatical roles;
// - mutate the canonical graph.

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
  type CanonicalRuntimeManifestBindingDefinitionAuthorityV1,
} from "./canonical-runtime-manifest-binding-definition-authority-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1 =
  "canonical_runtime_manifest_binding_where_shape_authority_v1";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1 =
  "1";

export type CanonicalRuntimeManifestWhereShapeNodeV1 =
  | {
    shape: "absent";

    path: string;
  }
  | {
    shape: "leaf_operator";

    path: string;

    operatorLabel: string;

    leftOperandSnapshot: unknown;

    hasRightOperand: boolean;

    rightOperandSnapshot: unknown;

    rawSnapshot: unknown;
  }
  | {
    shape: "compound_array_group";

    path: string;

    compoundKey: string;

    children: CanonicalRuntimeManifestWhereShapeNodeV1[];

    rawSnapshot: unknown;
  }
  | {
    shape: "unclassified";

    path: string;

    rawSnapshot: unknown;
  };

export type CanonicalRuntimeManifestBindingWhereShapeAuthorityV1 = {
  id: string;

  status: "candidate";

  bindingDefinitionAuthorityId: string;

  manifestId: string;

  manifestCode: string;

  bindingName: string;

  root: CanonicalRuntimeManifestWhereShapeNodeV1;

  unclassifiedPaths: string[];

  governance: {
    exactA43a1ResultRequired: true;

    exactManifestBindingDefinitionAuthorityRequired: true;

    whereClauseConsumedFromA43a1: true;

    whereClauseReadOnly: true;

    whereShapeOnly: true;

    rawSnapshotPreserved: true;

    structuralPathIdentityPreserved: true;

    runtimeOperatorVocabularyHardcoded: false;

    compoundKeyVocabularyHardcoded: false;

    operatorSemanticsResolved: false;

    compoundSemanticsResolved: false;

    compoundBooleanCompositionExecuted: false;

    referenceSemanticsResolved: false;

    dottedReferenceTraversalPerformed: false;

    leftOperandSemanticsResolved: false;

    rightOperandSemanticsResolved: false;

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

    winnerSelected: false;

    graphMutationPerformed: false;

    learnerErrorClassified: false;

    candidateOnly: true;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1 = {
  producer: typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1;

  status:
    | "ready"
    | "blocked";

  authorities: CanonicalRuntimeManifestBindingWhereShapeAuthorityV1[];

  blockingReasons: string[];
};

type JsonRecord = Record<string, unknown>;

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

function stringPresent(
  value: unknown,
): value is string {
  return (
    typeof value ===
      "string" &&
    value.trim().length >
      0
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
        value[key],
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

function safeA43a1Authority(
  authority: CanonicalRuntimeManifestBindingDefinitionAuthorityV1,
): boolean {
  const g = authority.governance;

  return (
    authority.status ===
      "candidate" &&
    stringPresent(
      authority.id,
    ) &&
    stringPresent(
      authority.manifestId,
    ) &&
    stringPresent(
      authority.manifestCode,
    ) &&
    stringPresent(
      authority.bindingName,
    ) &&
    (
      authority.whereClause ===
        null ||
      isRecord(
        authority.whereClause,
      )
    ) &&
    g.exactValidatedManifestRequired ===
      true &&
    g.exactManifestIdentityRequired ===
      true &&
    g.manifestLocalBindingsOnly ===
      true &&
    g.actionAuthorityRequired ===
      false &&
    g.actionFamilySemanticsResolved ===
      false &&
    g.runtimeFamilyLabelPreservedOpaque ===
      true &&
    g.executionPhaseLabelPreservedOpaque ===
      true &&
    g.runtimeFamilySemanticsResolved ===
      false &&
    g.executionPhaseSemanticsResolved ===
      false &&
    g.bindingNamePreservedOpaque ===
      true &&
    g.bindingDefinitionPreservedOpaque ===
      true &&
    g.entityLabelPreservedOpaque ===
      true &&
    g.scopeLabelPreservedOpaque ===
      true &&
    g.cardinalityLabelPreservedOpaque ===
      true &&
    g.whereClausePreservedOpaque ===
      true &&
    g.entitySemanticsResolved ===
      false &&
    g.scopeSemanticsResolved ===
      false &&
    g.cardinalitySemanticsResolved ===
      false &&
    g.whereSemanticsResolved ===
      false &&
    g.referenceSemanticsResolved ===
      false &&
    g.occurrenceEnumerationPerformed ===
      false &&
    g.occurrenceBindingPerformed ===
      false &&
    g.winnerSelected ===
      false &&
    g.graphMutationPerformed ===
      false &&
    g.productionActivationAssumed ===
      false &&
    g.learnerErrorClassified ===
      false &&
    g.candidateOnly ===
      true &&
    g.frozenGrammarReadOnly ===
      true
  );
}

function classifyWhereShape(
  value: unknown,
  path: string,
): CanonicalRuntimeManifestWhereShapeNodeV1 {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return {
      shape: "absent",

      path,
    };
  }

  if (
    !isRecord(
      value,
    )
  ) {
    return {
      shape: "unclassified",

      path,

      rawSnapshot: cloneSnapshot(
        value,
      ),
    };
  }

  const operatorLabel = stringPresent(
      value.op,
    )
    ? value.op
    : null;

  if (
    operatorLabel !==
      null
  ) {
    const hasRightOperand = hasOwn(
      value,
      "right",
    );

    return {
      shape: "leaf_operator",

      path,

      operatorLabel,

      leftOperandSnapshot: cloneSnapshot(
        value.left,
      ),

      hasRightOperand,

      rightOperandSnapshot: hasRightOperand
        ? cloneSnapshot(
          value.right,
        )
        : undefined,

      rawSnapshot: cloneSnapshot(
        value,
      ),
    };
  }

  const keys = Object.keys(
    value,
  );

  if (
    keys.length ===
      1
  ) {
    const compoundKey = keys[0]!;

    const possibleChildren = value[
      compoundKey
    ];

    if (
      Array.isArray(
        possibleChildren,
      )
    ) {
      return {
        shape: "compound_array_group",

        path,

        compoundKey,

        children: possibleChildren.map(
          (
            child,
            index,
          ) =>
            classifyWhereShape(
              child,
              `${path}.${compoundKey}[${index}]`,
            ),
        ),

        rawSnapshot: cloneSnapshot(
          value,
        ),
      };
    }
  }

  return {
    shape: "unclassified",

    path,

    rawSnapshot: cloneSnapshot(
      value,
    ),
  };
}

function collectUnclassifiedPaths(
  node: CanonicalRuntimeManifestWhereShapeNodeV1,
): string[] {
  if (
    node.shape ===
      "unclassified"
  ) {
    return [
      node.path,
    ];
  }

  if (
    node.shape !==
      "compound_array_group"
  ) {
    return [];
  }

  return node.children
    .flatMap(
      collectUnclassifiedPaths,
    )
    .sort();
}

function governance(): CanonicalRuntimeManifestBindingWhereShapeAuthorityV1[
  "governance"
] {
  return {
    exactA43a1ResultRequired: true,

    exactManifestBindingDefinitionAuthorityRequired: true,

    whereClauseConsumedFromA43a1: true,

    whereClauseReadOnly: true,

    whereShapeOnly: true,

    rawSnapshotPreserved: true,

    structuralPathIdentityPreserved: true,

    runtimeOperatorVocabularyHardcoded: false,

    compoundKeyVocabularyHardcoded: false,

    operatorSemanticsResolved: false,

    compoundSemanticsResolved: false,

    compoundBooleanCompositionExecuted: false,

    referenceSemanticsResolved: false,

    dottedReferenceTraversalPerformed: false,

    leftOperandSemanticsResolved: false,

    rightOperandSemanticsResolved: false,

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

    winnerSelected: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeManifestBindingWhereShapeAuthoritiesV1(
  bindingResult: CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1,
): CanonicalRuntimeManifestBindingWhereShapeAuthorityResultV1 {
  const blockingReasons: string[] = [];

  if (
    bindingResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1 ||
    bindingResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1 ||
    bindingResult.status !==
      "ready" ||
    bindingResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      "a4_3a1_result:not_exact_ready",
    );
  }

  const seenAuthorityIds = new Set<string>();

  for (
    const bindingAuthority of bindingResult.authorities
  ) {
    if (
      seenAuthorityIds.has(
        bindingAuthority.id,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${bindingAuthority.id}:duplicate`,
      );

      continue;
    }

    seenAuthorityIds.add(
      bindingAuthority.id,
    );

    if (
      !safeA43a1Authority(
        bindingAuthority,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${bindingAuthority.id}:unsafe_contract`,
      );
    }
  }

  if (
    blockingReasons.length >
      0
  ) {
    return {
      producer: CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1,

      status: "blocked",

      authorities: [],

      blockingReasons: uniqueSorted(
        blockingReasons,
      ),
    };
  }

  const authorities = bindingResult.authorities
    .map(
      (
        bindingAuthority,
      ): CanonicalRuntimeManifestBindingWhereShapeAuthorityV1 => {
        const root = classifyWhereShape(
          bindingAuthority.whereClause,
          "$",
        );

        return {
          id: [
            "runtime-manifest-binding-where-shape-v1",
            idPart(
              bindingAuthority.id,
            ),
          ].join(":"),

          status: "candidate",

          bindingDefinitionAuthorityId: bindingAuthority.id,

          manifestId: bindingAuthority.manifestId,

          manifestCode: bindingAuthority.manifestCode,

          bindingName: bindingAuthority.bindingName,

          root,

          unclassifiedPaths: collectUnclassifiedPaths(
            root,
          ),

          governance: governance(),
        };
      },
    )
    .sort(
      (
        a,
        b,
      ) =>
        a.id.localeCompare(
          b.id,
        ),
    );

  return {
    producer: CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_SHAPE_AUTHORITY_VERSION_V1,

    status: "ready",

    authorities,

    blockingReasons: [],
  };
}
