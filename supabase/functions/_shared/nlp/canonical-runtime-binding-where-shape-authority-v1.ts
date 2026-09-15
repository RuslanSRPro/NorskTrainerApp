// Norsk Trainer — Runtime Binding Where Shape Authority V1
//
// v1.46 A3.3.0
//
// Purpose:
//
//   A3.0 opaque Runtime IR where clause
//       ->
//   structural where-shape authority only.
//
// This layer recognizes encoding SHAPES, not operator semantics.
//
// Generic shapes:
//
//   leaf:
//     {
//       op: <opaque string>,
//       left: <opaque JSON>,
//       right?: <opaque JSON>
//     }
//
//   compound array group:
//     {
//       <opaque key>: [
//         <where child>,
//         ...
//       ]
//     }
//
// The compound key is opaque. No particular key is interpreted.
//
// This layer does NOT:
// - execute an operator;
// - interpret a reference suffix;
// - traverse dotted paths;
// - evaluate equality/existence/features/classes/relations/membership;
// - enumerate graph occurrences;
// - execute scope;
// - enforce cardinality;
// - bind Runtime IR occurrences;
// - create dependency edges.

import type {
  CanonicalRuntimeBindingDefinitionAuthorityV1,
} from './canonical-runtime-binding-definition-authority-v1.ts';


export const CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1 =
  'canonical_runtime_binding_where_shape_authority_v1';


export type CanonicalRuntimeWhereShapeNodeV1 =
  | {
      shape:
        'absent';

      path:
        string;
    }

  | {
      shape:
        'leaf_operator';

      path:
        string;

      operatorLabel:
        string;

      leftReferenceExpression?:
        string;

      leftOperand:
        unknown;

      hasRightOperand:
        boolean;

      rightOperand:
        unknown;

      rawSnapshot:
        unknown;
    }

  | {
      shape:
        'compound_array_group';

      path:
        string;

      compoundKey:
        string;

      children:
        CanonicalRuntimeWhereShapeNodeV1[];

      rawSnapshot:
        unknown;
    }

  | {
      shape:
        'unclassified';

      path:
        string;

      rawSnapshot:
        unknown;
    };


export type CanonicalRuntimeBindingWhereShapeAuthorityV1 = {
  id:
    string;

  status:
    'candidate';

  bindingDefinitionAuthorityId:
    string;

  manifestId:
    string;

  manifestCode:
    string;

  bindingName:
    string;

  root:
    CanonicalRuntimeWhereShapeNodeV1;

  unclassifiedPaths:
    string[];

  governance: {
    exactBindingDefinitionAuthorityRequired:
      true;

    whereClauseReadOnly:
      true;

    whereShapeOnly:
      true;

    runtimeOperatorVocabularyHardcoded:
      false;

    compoundKeyVocabularyHardcoded:
      false;

    operatorSemanticsResolved:
      false;

    compoundSemanticsResolved:
      false;

    referenceSemanticsResolved:
      false;

    dottedReferenceTraversalPerformed:
      false;

    rightOperandSemanticsResolved:
      false;

    canonicalFactOwnershipResolved:
      false;

    graphTraversalPerformed:
      false;

    occurrenceEnumerationPerformed:
      false;

    runtimeScopeExecutionPerformed:
      false;

    cardinalityEnforcementPerformed:
      false;

    occurrenceBindingPerformed:
      false;

    dependencyDirectionResolved:
      false;

    canonicalDependencyEdgeGenerated:
      false;

    grammaticalFunctionResolved:
      false;

    complementArgumentAttachmentResolved:
      false;

    realizesSlotGenerated:
      false;

    candidateOnly:
      true;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalRuntimeBindingWhereShapeAuthorityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalRuntimeBindingWhereShapeAuthorityV1[];

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


function isRecord(
  value:
    unknown,
): value is Record<string, unknown> {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}


function hasOwn(
  value:
    Record<string, unknown>,
  key:
    string,
): boolean {
  return Object.prototype.hasOwnProperty.call(
    value,
    key,
  );
}


function stableSnapshot(
  value:
    unknown,
): unknown {
  if (
    value ===
      null ||
    typeof value ===
      'string' ||
    typeof value ===
      'number' ||
    typeof value ===
      'boolean'
  ) {
    return value;
  }


  if (
    Array.isArray(
      value,
    )
  ) {
    return value.map(
      stableSnapshot,
    );
  }


  if (
    isRecord(
      value,
    )
  ) {
    const output:
      Record<string, unknown> = {};


    for (
      const key of
        Object.keys(
          value,
        ).sort()
    ) {
      output[key] =
        stableSnapshot(
          value[key],
        );
    }


    return output;
  }


  return null;
}


function leftReferenceExpression(
  value:
    unknown,
): string | undefined {
  if (
    !isRecord(
      value,
    )
  ) {
    return undefined;
  }


  return stringValue(
    value.ref,
  );
}


function collectUnclassifiedPaths(
  node:
    CanonicalRuntimeWhereShapeNodeV1,
): string[] {
  if (
    node.shape ===
      'unclassified'
  ) {
    return [
      node.path,
    ];
  }


  if (
    node.shape !==
      'compound_array_group'
  ) {
    return [];
  }


  return node.children
    .flatMap(
      collectUnclassifiedPaths,
    )
    .sort();
}


function classifyWhereShape(
  value:
    unknown,

  path:
    string,
): CanonicalRuntimeWhereShapeNodeV1 {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return {
      shape:
        'absent',

      path,
    };
  }


  if (
    !isRecord(
      value,
    )
  ) {
    return {
      shape:
        'unclassified',

      path,

      rawSnapshot:
        stableSnapshot(
          value,
        ),
    };
  }


  const operatorLabel =
    stringValue(
      value.op,
    );


  if (operatorLabel) {
    const hasRightOperand =
      hasOwn(
        value,
        'right',
      );


    return {
      shape:
        'leaf_operator',

      path,

      operatorLabel,

      leftReferenceExpression:
        leftReferenceExpression(
          value.left,
        ),

      leftOperand:
        stableSnapshot(
          value.left,
        ),

      hasRightOperand,

      rightOperand:
        hasRightOperand
          ? stableSnapshot(
              value.right,
            )
          : null,

      rawSnapshot:
        stableSnapshot(
          value,
        ),
    };
  }


  const keys =
    Object.keys(
      value,
    );


  const arrayKeys =
    keys.filter(
      (key) =>
        Array.isArray(
          value[key],
        ),
    );


  if (
    keys.length ===
      1 &&
    arrayKeys.length ===
      1
  ) {
    const compoundKey =
      arrayKeys[0];

    const rawChildren =
      value[
        compoundKey
      ] as unknown[];


    return {
      shape:
        'compound_array_group',

      path,

      compoundKey,

      children:
        rawChildren.map(
          (
            child,
            index,
          ) =>
            classifyWhereShape(
              child,
              `${path}.${compoundKey}[${index}]`,
            ),
        ),

      rawSnapshot:
        stableSnapshot(
          value,
        ),
    };
  }


  return {
    shape:
      'unclassified',

    path,

    rawSnapshot:
      stableSnapshot(
        value,
      ),
  };
}


function safeBindingAuthority(
  authority:
    CanonicalRuntimeBindingDefinitionAuthorityV1,
): boolean {
  const g =
    authority.governance;


  return (
    authority.status ===
      'candidate' &&

    Boolean(
      stringValue(
        authority.id,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.manifestId,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.manifestCode,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.bindingName,
      ),
    ) &&

    g.exactValidatedManifestRequired ===
      true &&

    g.exactA0DependencyAuthorityRequired ===
      true &&

    g.bindingDefinitionPreservedOpaque ===
      true &&

    g.whereSemanticsResolved ===
      false &&

    g.occurrenceEnumerationPerformed ===
      false &&

    g.occurrenceBindingPerformed ===
      false &&

    g.canonicalEdgeGenerated ===
      false &&

    g.candidateOnly ===
      true &&

    g.frozenGrammarReadOnly ===
      true
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


export function deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
  bindingAuthorities:
    readonly CanonicalRuntimeBindingDefinitionAuthorityV1[],
): CanonicalRuntimeBindingWhereShapeAuthorityResultV1 {
  const blockingReasons:
    string[] = [];


  const seenIds =
    new Set<
      string
    >();


  for (
    const authority of
      bindingAuthorities
  ) {
    if (
      seenIds.has(
        authority.id,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:duplicate`,
      );

      continue;
    }


    seenIds.add(
      authority.id,
    );


    if (
      !safeBindingAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:unsafe_contract`,
      );
    }
  }


  const reasons =
    unique(
      blockingReasons,
    );


  if (
    reasons.length >
      0
  ) {
    return {
      producer:
        CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1,

      producerVersion:
        '1',

      status:
        'blocked',

      authorities:
        [],

      blockingReasons:
        reasons,
    };
  }


  const authorities =
    bindingAuthorities.map(
      (
        bindingAuthority,
      ): CanonicalRuntimeBindingWhereShapeAuthorityV1 => {
        const root =
          classifyWhereShape(
            bindingAuthority
              .whereClause,
            '$',
          );


        return {
          id: [
            'runtime-binding-where-shape-v1',
            idPart(
              bindingAuthority.id,
            ),
          ].join(':'),

          status:
            'candidate',

          bindingDefinitionAuthorityId:
            bindingAuthority.id,

          manifestId:
            bindingAuthority.manifestId,

          manifestCode:
            bindingAuthority.manifestCode,

          bindingName:
            bindingAuthority.bindingName,

          root,

          unclassifiedPaths:
            collectUnclassifiedPaths(
              root,
            ),

          governance: {
            exactBindingDefinitionAuthorityRequired:
              true,

            whereClauseReadOnly:
              true,

            whereShapeOnly:
              true,

            runtimeOperatorVocabularyHardcoded:
              false,

            compoundKeyVocabularyHardcoded:
              false,

            operatorSemanticsResolved:
              false,

            compoundSemanticsResolved:
              false,

            referenceSemanticsResolved:
              false,

            dottedReferenceTraversalPerformed:
              false,

            rightOperandSemanticsResolved:
              false,

            canonicalFactOwnershipResolved:
              false,

            graphTraversalPerformed:
              false,

            occurrenceEnumerationPerformed:
              false,

            runtimeScopeExecutionPerformed:
              false,

            cardinalityEnforcementPerformed:
              false,

            occurrenceBindingPerformed:
              false,

            dependencyDirectionResolved:
              false,

            canonicalDependencyEdgeGenerated:
              false,

            grammaticalFunctionResolved:
              false,

            complementArgumentAttachmentResolved:
              false,

            realizesSlotGenerated:
              false,

            candidateOnly:
              true,

            frozenGrammarReadOnly:
              true,
          },
        };
      },
    );


  authorities.sort(
    (a, b) =>
      a.id.localeCompare(
        b.id,
      ),
  );


  return {
    producer:
      CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    blockingReasons:
      [],
  };
}