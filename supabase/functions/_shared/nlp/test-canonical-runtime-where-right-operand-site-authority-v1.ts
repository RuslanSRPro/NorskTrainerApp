import type {
  CanonicalRuntimeWhereShapeNodeV1,
} from './canonical-runtime-binding-where-shape-authority-v1.ts';

import {
  deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1,
} from './canonical-runtime-where-right-operand-site-authority-v1.ts';


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
    operatorLabel?: string;
    hasRightOperand?: boolean;
    rightOperand?: unknown;
  } = {},
): CanonicalRuntimeWhereShapeNodeV1 {
  const hasRightOperand =
    options.hasRightOperand ??
      true;


  return {
    shape:
      'leaf_operator',

    path:
      options.path ??
        '$',

    operatorLabel:
      options.operatorLabel ??
        'opaque_operator',

    leftReferenceExpression:
      'finite.pos',

    leftOperand: {
      ref:
        'finite.pos',
    },

    hasRightOperand,

    rightOperand:
      hasRightOperand
        ? (
            options.rightOperand ===
                undefined
              ? 'verb'
              : options.rightOperand
          )
        : null,

    rawSnapshot: {
      op:
        options.operatorLabel ??
          'opaque_operator',

      left: {
        ref:
          'finite.pos',
      },

      ...(hasRightOperand
        ? {
            right:
              options.rightOperand ===
                  undefined
                ? 'verb'
                : options.rightOperand,
          }
        : {}),
    },
  };
}


Deno.test(
  'v1.46 A3.3.3a: explicit string right operand becomes structural site authority',
  () => {
    const result =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        leaf(),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        1 &&
      result.authorities[0]
        ?.rightOperandStructuralKind ===
        'string' &&
      result.authorities[0]
        ?.rightOperandSnapshot ===
        'verb',
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.3a: explicit null is structurally present and differs from operand absence',
  () => {
    const result =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        leaf({
          rightOperand:
            null,
        }),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        1 &&
      result.authorities[0]
        ?.rightOperandStructuralKind ===
        'null',
      'explicit null was confused with absent right operand',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3a: leaf without right operand creates no invented operand authority',
  () => {
    const result =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        leaf({
          hasRightOperand:
            false,
        }),
      );


    assert(
      result.status ===
        'ready' &&
      result.leafCount ===
        1 &&
      result.rightOperandLeafCount ===
        0 &&
      JSON.stringify(
        result.leafPathsWithoutRightOperand,
      ) ===
        JSON.stringify([
          '$',
        ]),
      'absent right operand was invented',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3a: array right operand is preserved as array structure without membership semantics',
  () => {
    const operand = [
      'A',
      'B',
    ];


    const result =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        leaf({
          rightOperand:
            operand,
        }),
      );


    assert(
      result.authorities[0]
        ?.rightOperandStructuralKind ===
        'array' &&
      JSON.stringify(
        result.authorities[0]
          ?.rightOperandSnapshot,
      ) ===
        JSON.stringify(
          operand,
        ) &&
      result.authorities[0]
        ?.governance
        .arrayMembershipSemanticsResolved ===
        false,
      'array acquired membership semantics',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3a: object right operand is preserved without object-field semantics',
  () => {
    const operand = {
      feature:
        'value',
    };


    const result =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        leaf({
          rightOperand:
            operand,
        }),
      );


    assert(
      result.authorities[0]
        ?.rightOperandStructuralKind ===
        'object' &&
      JSON.stringify(
        result.authorities[0]
          ?.rightOperandSnapshot,
      ) ===
        JSON.stringify(
          operand,
        ) &&
      result.authorities[0]
        ?.governance
        .objectFieldSemanticsResolved ===
        false,
      'object operand acquired field semantics',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3a: nested compound enumerates exact leaf paths only',
  () => {
    const root:
      CanonicalRuntimeWhereShapeNodeV1 = {
        shape:
          'compound_array_group',

        path:
          '$',

        compoundKey:
          'opaque_group',

        children: [
          leaf({
            path:
              '$.opaque_group[0]',
          }),

          leaf({
            path:
              '$.opaque_group[1]',

            hasRightOperand:
              false,
          }),
        ],

        rawSnapshot: {},
      };


    const result =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        root,
      );


    assert(
      result.status ===
        'ready' &&
      result.leafCount ===
        2 &&
      result.authorities.length ===
        1 &&
      result.authorities[0]
        ?.leafPath ===
        '$.opaque_group[0]' &&
      JSON.stringify(
        result.leafPathsWithoutRightOperand,
      ) ===
        JSON.stringify([
          '$.opaque_group[1]',
        ]),
      'compound leaf ownership changed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3a: operator label is preserved as opaque metadata only',
  () => {
    const result =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        leaf({
          operatorLabel:
            'future_operator',
        }),
      );


    const authority =
      result.authorities[0];


    assert(
      authority
        ?.operatorLabelOpaque ===
        'future_operator' &&
      authority.governance
        .operatorLabelSemanticsResolved ===
        false &&
      authority.governance
        .comparisonPerformed ===
        false,
      'operator label acquired semantics',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3a: duplicate structural leaf path blocks rather than merging sites',
  () => {
    const root:
      CanonicalRuntimeWhereShapeNodeV1 = {
        shape:
          'compound_array_group',

        path:
          '$',

        compoundKey:
          'opaque_group',

        children: [
          leaf({
            path:
              '$.same',
          }),

          leaf({
            path:
              '$.same',

            rightOperand:
              'other',
          }),
        ],

        rawSnapshot: {},
      };


    const result =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        root,
      );


    assert(
      result.status ===
        'blocked' &&
      result.authorities.length ===
        0,
      'duplicate leaf path was merged',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3a: result is deterministic across compound child ordering',
  () => {
    const a =
      leaf({
        path:
          '$.group[0]',

        rightOperand:
          'x',
      });

    const b =
      leaf({
        path:
          '$.group[1]',

        rightOperand:
          [
            'y',
          ],
      });


    const first:
      CanonicalRuntimeWhereShapeNodeV1 = {
        shape:
          'compound_array_group',

        path:
          '$',

        compoundKey:
          'group',

        children: [
          a,
          b,
        ],

        rawSnapshot: {},
      };


    const second:
      CanonicalRuntimeWhereShapeNodeV1 = {
        ...first,

        children: [
          b,
          a,
        ],
      };


    const x =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        first,
      );

    const y =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        second,
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'right operand site authority is not deterministic',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3a: structural authority performs no operand binding comparison scope cardinality or dependency semantics',
  () => {
    const result =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        leaf(),
      );


    const g =
      result.authorities[0]
        ?.governance;


    assert(
      g !==
        undefined &&
      g.exactA330LeafRequired ===
        true &&
      g.explicitRightOperandPresenceRequired ===
        true &&
      g.absenceDistinguishedFromExplicitNull ===
        true &&
      g.rightOperandSnapshotPreserved ===
        true &&
      g.structuralKindOnly ===
        true &&
      g.operatorLabelSemanticsResolved ===
        false &&
      g.rightOperandSemanticsResolved ===
        false &&
      g.stringOperandMappedToPos ===
        false &&
      g.arrayMembershipSemanticsResolved ===
        false &&
      g.objectFieldSemanticsResolved ===
        false &&
      g.valueCoercionPerformed ===
        false &&
      g.caseNormalizationPerformed ===
        false &&
      g.comparisonPerformed ===
        false &&
      g.bindingOwnershipResolved ===
        false &&
      g.manifestOwnershipResolved ===
        false &&
      g.occurrenceEnumerationPerformed ===
        false &&
      g.runtimeScopeExecutionPerformed ===
        false &&
      g.cardinalityEnforcementPerformed ===
        false &&
      g.occurrenceBindingPerformed ===
        false &&
      g.canonicalDependencyEdgeGenerated ===
        false &&
      g.realizesSlotGenerated ===
        false &&
      g.graphMutationPerformed ===
        false &&
      g.candidateOnly ===
        true,
      'A3.3.3a crossed structural operand boundary',
    );
  },
);