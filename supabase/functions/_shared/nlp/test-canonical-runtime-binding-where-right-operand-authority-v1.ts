import type {
  CanonicalRuntimeBindingWhereShapeAuthorityResultV1,
  CanonicalRuntimeBindingWhereShapeAuthorityV1,
  CanonicalRuntimeWhereShapeNodeV1,
} from './canonical-runtime-binding-where-shape-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1,
} from './canonical-runtime-binding-where-right-operand-authority-v1.ts';


function assert(
  condition:
    unknown,

  message:
    string,
): asserts condition {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}


function leaf(
  options: {
    path?: string;
    right?: unknown;
    hasRight?: boolean;
  } = {},
): CanonicalRuntimeWhereShapeNodeV1 {
  const hasRight =
    options.hasRight ??
      true;

  const right =
    options.right ===
        undefined
      ? 'opaque-value'
      : options.right;


  return {
    shape:
      'leaf_operator',

    path:
      options.path ??
        '$',

    operatorLabel:
      'opaque-operator',

    leftReferenceExpression:
      'x.y',

    leftOperand: {
      ref:
        'x.y',
    },

    hasRightOperand:
      hasRight,

    rightOperand:
      hasRight
        ? right
        : null,

    rawSnapshot:
      hasRight
        ? {
            op:
              'opaque-operator',

            left: {
              ref:
                'x.y',
            },

            right,
          }
        : {
            op:
              'opaque-operator',

            left: {
              ref:
                'x.y',
            },
          },
  };
}


function shapeAuthority(
  options: {
    id?: string;
    bindingId?: string;
    manifestId?: string;
    manifestCode?: string;
    bindingName?: string;
    root?: CanonicalRuntimeWhereShapeNodeV1;
  } = {},
): CanonicalRuntimeBindingWhereShapeAuthorityV1 {
  return {
    id:
      options.id ??
        'where-shape:finite',

    status:
      'candidate',

    bindingDefinitionAuthorityId:
      options.bindingId ??
        'binding:finite',

    manifestId:
      options.manifestId ??
        'manifest:finite',

    manifestCode:
      options.manifestCode ??
        'manifest.finite',

    bindingName:
      options.bindingName ??
        'finite',

    root:
      options.root ??
        leaf(),

    unclassifiedPaths:
      [],

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
}


function shapeResult(
  authorities:
    CanonicalRuntimeBindingWhereShapeAuthorityV1[],
): CanonicalRuntimeBindingWhereShapeAuthorityResultV1 {
  return {
    producer:
      'canonical_runtime_binding_where_shape_authority_v1',

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    blockingReasons:
      [],
  };
}


Deno.test(
  'v1.46 A3.3.3b: right operand inherits exact binding and manifest ownership from its own A3.3.0 wrapper',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          shapeAuthority(),
        ]),
      );


    const authority =
      result.authorities[0];


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        1 &&
      authority
        ?.whereShapeAuthorityId ===
        'where-shape:finite' &&
      authority.bindingDefinitionAuthorityId ===
        'binding:finite' &&
      authority.manifestId ===
        'manifest:finite' &&
      authority.manifestCode ===
        'manifest.finite' &&
      authority.bindingName ===
        'finite',
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.3b: exact operand snapshot and structural kind survive ownership composition',
  () => {
    const operand = [
      'A',
      'B',
    ];


    const result =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          shapeAuthority({
            root:
              leaf({
                right:
                  operand,
              }),
          }),
        ]),
      );


    const authority =
      result.authorities[0];


    assert(
      authority
        ?.rightOperandStructuralKind ===
        'array' &&
      JSON.stringify(
        authority.rightOperandSnapshot,
      ) ===
        JSON.stringify(
          operand,
        ),
      'operand snapshot changed during ownership composition',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3b: explicit null remains owned operand and is not confused with absence',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          shapeAuthority({
            root:
              leaf({
                right:
                  null,
              }),
          }),
        ]),
      );


    assert(
      result.authorities.length ===
        1 &&
      result.authorities[0]
        ?.rightOperandStructuralKind ===
        'null',
      'explicit null lost during ownership composition',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3b: leaf without right operand creates no owned operand authority',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          shapeAuthority({
            root:
              leaf({
                hasRight:
                  false,
              }),
          }),
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.whereShapeAuthorityCount ===
        1 &&
      result.rightOperandSiteCount ===
        0 &&
      result.authorities.length ===
        0,
      'absent right operand was invented',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3b: identical leaf paths in different binding wrappers remain different owned sites',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          shapeAuthority({
            id:
              'where-shape:a',

            bindingId:
              'binding:a',

            manifestId:
              'manifest:a',

            manifestCode:
              'manifest.a',

            bindingName:
              'a',

            root:
              leaf({
                path:
                  '$',
              }),
          }),

          shapeAuthority({
            id:
              'where-shape:b',

            bindingId:
              'binding:b',

            manifestId:
              'manifest:b',

            manifestCode:
              'manifest.b',

            bindingName:
              'b',

            root:
              leaf({
                path:
                  '$',
              }),
          }),
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        2 &&
      result.authorities[0]
        ?.bindingDefinitionAuthorityId !==
        result.authorities[1]
          ?.bindingDefinitionAuthorityId &&
      result.authorities.every(
        (authority) =>
          authority.leafPath ===
            '$',
      ),
      'same leafPath across wrappers was globally merged',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3b: nested leaf path retains ownership of exact binding wrapper',
  () => {
    const root:
      CanonicalRuntimeWhereShapeNodeV1 = {
        shape:
          'compound_array_group',

        path:
          '$',

        compoundKey:
          'group',

        children: [
          leaf({
            path:
              '$.group[0]',
          }),
        ],

        rawSnapshot:
          {},
      };


    const result =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          shapeAuthority({
            root,
          }),
        ]),
      );


    assert(
      result.authorities[0]
        ?.leafPath ===
        '$.group[0]' &&
      result.authorities[0]
        ?.bindingName ===
        'finite',
      'nested site lost wrapper ownership',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3b: duplicate A3.3.0 authority identity blocks composition',
  () => {
    const authority =
      shapeAuthority();


    const result =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          authority,
          {
            ...authority,
          },
        ]),
      );


    assert(
      result.status ===
        'blocked' &&
      result.authorities.length ===
        0,
      'duplicate where-shape authority was accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3b: two wrappers claiming same exact binding-definition authority block ownership ambiguity',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          shapeAuthority({
            id:
              'where-shape:a',
          }),

          shapeAuthority({
            id:
              'where-shape:b',
          }),
        ]),
      );


    assert(
      result.status ===
        'blocked',
      'duplicate binding ownership was accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3b: unsafe upstream where-shape governance blocks composition',
  () => {
    const authority =
      shapeAuthority();


    const malformed = {
      ...authority,

      governance: {
        ...authority.governance,

        rightOperandSemanticsResolved:
          true,
      },
    } as unknown as CanonicalRuntimeBindingWhereShapeAuthorityV1;


    const result =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          malformed,
        ]),
      );


    assert(
      result.status ===
        'blocked',
      'semanticized upstream where authority was consumed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3b: deterministic composition performs no operator operand POS occurrence scope cardinality or dependency execution',
  () => {
    const a =
      shapeAuthority({
        id:
          'where-shape:a',

        bindingId:
          'binding:a',

        manifestId:
          'manifest:a',

        manifestCode:
          'manifest.a',

        bindingName:
          'a',
      });


    const b =
      shapeAuthority({
        id:
          'where-shape:b',

        bindingId:
          'binding:b',

        manifestId:
          'manifest:b',

        manifestCode:
          'manifest.b',

        bindingName:
          'b',

        root:
          leaf({
            right: {
              future:
                true,
            },
          }),
      });


    const x =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          a,
          b,
        ]),
      );


    const y =
      deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
        shapeResult([
          b,
          a,
        ]),
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'A3.3.3b is not deterministic',
    );


    const g =
      x.authorities[0]
        ?.governance;


    assert(
      g !==
        undefined &&
      g.exactWhereShapeAuthorityRequired ===
        true &&
      g.exactRightOperandSiteAuthorityRequired ===
        true &&
      g.siteDerivedInsideExactOwnedRoot ===
        true &&
      g.leafPathIsAuthorityLocal ===
        true &&
      g.equalLeafPathsAcrossAuthoritiesMerged ===
        false &&
      g.bindingDefinitionAuthorityIdentityPreserved ===
        true &&
      g.manifestIdentityPreserved ===
        true &&
      g.structuralOwnershipOnly ===
        true &&
      g.bindingDefinitionSemanticsResolved ===
        false &&
      g.operatorSemanticsResolved ===
        false &&
      g.rightOperandSemanticsResolved ===
        false &&
      g.stringOperandMappedToPos ===
        false &&
      g.comparisonPerformed ===
        false &&
      g.runtimeBindingExecuted ===
        false &&
      g.occurrenceEnumerationPerformed ===
        false &&
      g.runtimeScopeExecutionPerformed ===
        false &&
      g.cardinalityEnforcementPerformed ===
        false &&
      g.occurrenceBindingPerformed ===
        false &&
      g.canonicalFactOwnershipResolved ===
        false &&
      g.canonicalDependencyEdgeGenerated ===
        false &&
      g.realizesSlotGenerated ===
        false &&
      g.graphMutationPerformed ===
        false,
      'A3.3.3b crossed structural ownership boundary',
    );
  },
);