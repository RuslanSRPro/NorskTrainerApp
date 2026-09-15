// Norsk Trainer — Runtime Where Right-Operand Site Authority V1
//
// v1.46 A3.3.3a
//
// Input:
//
//   CanonicalRuntimeWhereShapeNodeV1
//   produced structurally by A3.3.0.
//
// Output:
//
//   candidate structural authority for each leaf that explicitly
//   contains a right operand.
//
// This layer proves only:
//
// - exact leaf path;
// - explicit structural presence of a right operand;
// - exact preserved right-operand snapshot;
// - structural snapshot kind;
// - opaque operator label belonging to the same leaf.
//
// It does NOT prove:
//
// - operator semantics;
// - operand value semantics;
// - POS semantics;
// - lexical semantics;
// - array membership semantics;
// - object field semantics;
// - comparison semantics;
// - coercion or normalization;
// - Runtime binding/manifest ownership;
// - Runtime occurrence enumeration;
// - scope/cardinality execution;
// - dependency generation.

import type {
  CanonicalRuntimeWhereShapeNodeV1,
} from './canonical-runtime-binding-where-shape-authority-v1.ts';


export const CANONICAL_RUNTIME_WHERE_RIGHT_OPERAND_SITE_AUTHORITY_V1 =
  'canonical_runtime_where_right_operand_site_authority_v1';


export type CanonicalRuntimeWhereRightOperandStructuralKindV1 =
  | 'null'
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'other';


export type CanonicalRuntimeWhereRightOperandSiteAuthorityV1 = {
  id:
    string;

  status:
    'candidate';

  leafPath:
    string;

  operatorLabelOpaque:
    string;

  hasRightOperand:
    true;

  rightOperandStructuralKind:
    CanonicalRuntimeWhereRightOperandStructuralKindV1;

  rightOperandSnapshot:
    unknown;

  governance: {
    exactA330LeafRequired:
      true;

    explicitRightOperandPresenceRequired:
      true;

    absenceDistinguishedFromExplicitNull:
      true;

    leafPathPreserved:
      true;

    operatorLabelPreservedOpaque:
      true;

    rightOperandSnapshotPreserved:
      true;

    structuralKindOnly:
      true;

    operatorLabelSemanticsResolved:
      false;

    rightOperandSemanticsResolved:
      false;

    stringOperandMappedToPos:
      false;

    arrayMembershipSemanticsResolved:
      false;

    objectFieldSemanticsResolved:
      false;

    valueCoercionPerformed:
      false;

    caseNormalizationPerformed:
      false;

    comparisonPerformed:
      false;

    bindingOwnershipResolved:
      false;

    manifestOwnershipResolved:
      false;

    occurrenceEnumerationPerformed:
      false;

    runtimeScopeExecutionPerformed:
      false;

    cardinalityEnforcementPerformed:
      false;

    occurrenceBindingPerformed:
      false;

    canonicalDependencyEdgeGenerated:
      false;

    realizesSlotGenerated:
      false;

    graphMutationPerformed:
      false;

    candidateOnly:
      true;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalRuntimeWhereRightOperandSiteAuthorityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_WHERE_RIGHT_OPERAND_SITE_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalRuntimeWhereRightOperandSiteAuthorityV1[];

  leafCount:
    number;

  rightOperandLeafCount:
    number;

  leafPathsWithoutRightOperand:
    string[];

  blockingReasons:
    string[];
};


function stringValue(
  value:
    unknown,
): string | undefined {
  if (
    typeof value !==
      'string'
  ) {
    return undefined;
  }


  const trimmed =
    value.trim();


  return (
    trimmed ||
    undefined
  );
}


function unique(
  values:
    readonly string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}


function idPart(
  value:
    string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    '%',
    '_',
  );
}


function structuralKind(
  value:
    unknown,
): CanonicalRuntimeWhereRightOperandStructuralKindV1 {
  if (
    value ===
      null
  ) {
    return 'null';
  }


  if (
    Array.isArray(
      value,
    )
  ) {
    return 'array';
  }


  if (
    typeof value ===
      'string'
  ) {
    return 'string';
  }


  if (
    typeof value ===
      'number'
  ) {
    return 'number';
  }


  if (
    typeof value ===
      'boolean'
  ) {
    return 'boolean';
  }


  if (
    typeof value ===
      'object'
  ) {
    return 'object';
  }


  return 'other';
}


function blockedResult(
  reasons:
    readonly string[],
): CanonicalRuntimeWhereRightOperandSiteAuthorityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_WHERE_RIGHT_OPERAND_SITE_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'blocked',

    authorities:
      [],

    leafCount:
      0,

    rightOperandLeafCount:
      0,

    leafPathsWithoutRightOperand:
      [],

    blockingReasons:
      unique(
        reasons,
      ),
  };
}


export function deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
  root:
    CanonicalRuntimeWhereShapeNodeV1,
): CanonicalRuntimeWhereRightOperandSiteAuthorityResultV1 {
  const blockingReasons:
    string[] = [];

  const authorities:
    CanonicalRuntimeWhereRightOperandSiteAuthorityV1[] =
      [];

  const leafPathsWithoutRightOperand:
    string[] = [];

  const seenPaths =
    new Set<
      string
    >();

  let leafCount =
    0;


  function visit(
    node:
      CanonicalRuntimeWhereShapeNodeV1,
  ): void {
    const path =
      stringValue(
        node.path,
      );


    if (!path) {
      blockingReasons.push(
        'where_shape_node:missing_path',
      );

      return;
    }


    if (
      seenPaths.has(
        path,
      )
    ) {
      blockingReasons.push(
        `where_shape_node:${path}:duplicate_path`,
      );

      return;
    }


    seenPaths.add(
      path,
    );


    if (
      node.shape ===
        'leaf_operator'
    ) {
      leafCount +=
        1;


      const operatorLabel =
        stringValue(
          node.operatorLabel,
        );


      if (!operatorLabel) {
        blockingReasons.push(
          `where_leaf:${path}:missing_operator_label`,
        );

        return;
      }


      if (
        node.hasRightOperand ===
          false
      ) {
        if (
          node.rightOperand !==
            null
        ) {
          blockingReasons.push(
            `where_leaf:${path}:absent_right_operand_has_non_null_snapshot`,
          );

          return;
        }


        leafPathsWithoutRightOperand.push(
          path,
        );

        return;
      }


      authorities.push({
        id:
          `runtime-where-right-operand-site-v1:${idPart(path)}`,

        status:
          'candidate',

        leafPath:
          path,

        operatorLabelOpaque:
          operatorLabel,

        hasRightOperand:
          true,

        rightOperandStructuralKind:
          structuralKind(
            node.rightOperand,
          ),

        rightOperandSnapshot:
          node.rightOperand,

        governance: {
          exactA330LeafRequired:
            true,

          explicitRightOperandPresenceRequired:
            true,

          absenceDistinguishedFromExplicitNull:
            true,

          leafPathPreserved:
            true,

          operatorLabelPreservedOpaque:
            true,

          rightOperandSnapshotPreserved:
            true,

          structuralKindOnly:
            true,

          operatorLabelSemanticsResolved:
            false,

          rightOperandSemanticsResolved:
            false,

          stringOperandMappedToPos:
            false,

          arrayMembershipSemanticsResolved:
            false,

          objectFieldSemanticsResolved:
            false,

          valueCoercionPerformed:
            false,

          caseNormalizationPerformed:
            false,

          comparisonPerformed:
            false,

          bindingOwnershipResolved:
            false,

          manifestOwnershipResolved:
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

          realizesSlotGenerated:
            false,

          graphMutationPerformed:
            false,

          candidateOnly:
            true,

          frozenGrammarReadOnly:
            true,
        },
      });

      return;
    }


    if (
      node.shape ===
        'compound_array_group'
    ) {
      if (
        !stringValue(
          node.compoundKey,
        )
      ) {
        blockingReasons.push(
          `where_compound:${path}:missing_compound_key`,
        );

        return;
      }


      for (
        const child of
          node.children
      ) {
        visit(
          child,
        );
      }


      return;
    }


    // absent and unclassified are structurally valid A3.3.0 shapes.
    // They do not contain executable leaf right-operand sites.
  }


  visit(
    root,
  );


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  authorities.sort(
    (a, b) =>
      a.id.localeCompare(
        b.id,
      ),
  );


  return {
    producer:
      CANONICAL_RUNTIME_WHERE_RIGHT_OPERAND_SITE_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    leafCount,

    rightOperandLeafCount:
      authorities.length,

    leafPathsWithoutRightOperand:
      unique(
        leafPathsWithoutRightOperand,
      ),

    blockingReasons:
      [],
  };
}