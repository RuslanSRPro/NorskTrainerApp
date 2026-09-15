import type {
  CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1,
  CanonicalRuntimeBindingWhereReferenceRootAuthorityV1,
  CanonicalRuntimeWhereReferenceRootSiteV1,
} from './canonical-runtime-binding-where-reference-root-authority-v1.ts';

import type {
  CanonicalRuntimeBindingWhereRightOperandAuthorityResultV1,
  CanonicalRuntimeBindingWhereRightOperandAuthorityV1,
} from './canonical-runtime-binding-where-right-operand-authority-v1.ts';

import {
  deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1,
} from './canonical-runtime-binding-where-left-right-site-authority-v1.ts';


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


function referenceSite(
  options: {
    path?: string;
    expression?: string;
    rootStatus?:
      | 'exact_binding'
      | 'binding_prefix_with_opaque_suffix'
      | 'unrooted';
    rootBindingId?: string | null;
    rootBindingName?: string | null;
    suffix?: string | null;
  } = {},
): CanonicalRuntimeWhereReferenceRootSiteV1 {
  const status =
    options.rootStatus ??
      'binding_prefix_with_opaque_suffix';


  return {
    path:
      options.path ??
        '$',

    referenceExpression:
      options.expression ??
        'finite.pos',

    rootStatus:
      status,

    rootBindingAuthorityId:
      status ===
          'unrooted'
        ? null
        : (
            options.rootBindingId ??
            'binding:finite'
          ),

    rootBindingName:
      status ===
          'unrooted'
        ? null
        : (
            options.rootBindingName ??
            'finite'
          ),

    opaqueSuffix:
      status ===
          'binding_prefix_with_opaque_suffix'
        ? (
            options.suffix ??
            '.pos'
          )
        : null,
  };
}


function rootAuthority(
  options: {
    id?: string;
    shapeId?: string;
    ownerBindingId?: string;
    manifestId?: string;
    manifestCode?: string;
    ownerBindingName?: string;
    sites?: CanonicalRuntimeWhereReferenceRootSiteV1[];
  } = {},
): CanonicalRuntimeBindingWhereReferenceRootAuthorityV1 {
  const sites =
    options.sites ??
      [
        referenceSite(),
      ];


  return {
    id:
      options.id ??
        'root-authority:finite',

    status:
      'candidate',

    whereShapeAuthorityId:
      options.shapeId ??
        'where-shape:finite',

    bindingDefinitionAuthorityId:
      options.ownerBindingId ??
        'binding:owner',

    manifestId:
      options.manifestId ??
        'manifest:1',

    manifestCode:
      options.manifestCode ??
        'manifest.one',

    bindingName:
      options.ownerBindingName ??
        'owner',

    referenceSites:
      sites,

    unrootedPaths:
      sites
        .filter(
          (site) =>
            site.rootStatus ===
              'unrooted',
        )
        .map(
          (site) =>
            site.path,
        ),

    governance: {
      exactWhereShapeAuthorityRequired:
        true,

      exactBindingDefinitionSetRequired:
        true,

      manifestLocalBindingRootsOnly:
        true,

      longestExactBindingPrefixWins:
        true,

      referenceExpressionPreserved:
        true,

      opaqueSuffixPreserved:
        true,

      runtimeBindingVocabularyHardcoded:
        false,

      dottedReferenceTraversalPerformed:
        false,

      suffixSemanticsResolved:
        false,

      referenceValueResolved:
        false,

      operatorSemanticsResolved:
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

      endpointRoleResolved:
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


function rootResult(
  authorities:
    CanonicalRuntimeBindingWhereReferenceRootAuthorityV1[],
): CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1 {
  return {
    producer:
      'canonical_runtime_binding_where_reference_root_authority_v1',

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    blockingReasons:
      [],
  };
}


function rightAuthority(
  options: {
    id?: string;
    shapeId?: string;
    ownerBindingId?: string;
    manifestId?: string;
    manifestCode?: string;
    ownerBindingName?: string;
    path?: string;
    operator?: string;
    right?: unknown;
  } = {},
): CanonicalRuntimeBindingWhereRightOperandAuthorityV1 {
  return {
    id:
      options.id ??
        'right-authority:finite',

    status:
      'candidate',

    whereShapeAuthorityId:
      options.shapeId ??
        'where-shape:finite',

    bindingDefinitionAuthorityId:
      options.ownerBindingId ??
        'binding:owner',

    manifestId:
      options.manifestId ??
        'manifest:1',

    manifestCode:
      options.manifestCode ??
        'manifest.one',

    bindingName:
      options.ownerBindingName ??
        'owner',

    rightOperandSiteAuthorityId:
      'right-site:1',

    leafPath:
      options.path ??
        '$',

    operatorLabelOpaque:
      options.operator ??
        'future_operator',

    hasRightOperand:
      true,

    rightOperandStructuralKind:
      typeof (
        options.right ??
        'verb'
      ) ===
          'string'
        ? 'string'
        : 'object',

    rightOperandSnapshot:
      options.right ??
        'verb',

    governance: {
      exactWhereShapeAuthorityRequired:
        true,

      exactRightOperandSiteAuthorityRequired:
        true,

      siteDerivedInsideExactOwnedRoot:
        true,

      leafPathIsAuthorityLocal:
        true,

      equalLeafPathsAcrossAuthoritiesMerged:
        false,

      bindingDefinitionAuthorityIdentityPreserved:
        true,

      manifestIdentityPreserved:
        true,

      bindingNamePreserved:
        true,

      rightOperandSnapshotPreserved:
        true,

      structuralOwnershipOnly:
        true,

      bindingDefinitionSemanticsResolved:
        false,

      operatorSemanticsResolved:
        false,

      rightOperandSemanticsResolved:
        false,

      stringOperandMappedToPos:
        false,

      comparisonPerformed:
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

      canonicalFactOwnershipResolved:
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


function rightResult(
  authorities:
    CanonicalRuntimeBindingWhereRightOperandAuthorityV1[],
): CanonicalRuntimeBindingWhereRightOperandAuthorityResultV1 {
  return {
    producer:
      'canonical_runtime_binding_where_right_operand_authority_v1',

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    whereShapeAuthorityCount:
      authorities.length,

    rightOperandSiteCount:
      authorities.length,

    blockingReasons:
      [],
  };
}


Deno.test(
  'v1.46 A3.3.3c: exact same owned leaf composes rooted left and right sites',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult([
          rootAuthority(),
        ]),

        rightResult([
          rightAuthority(),
        ]),
      );


    const authority =
      result.authorities[0];


    assert(
      result.status ===
        'ready' &&
      result.composedSiteCount ===
        1 &&
      authority
        ?.whereReferenceRootAuthorityId ===
        'root-authority:finite' &&
      authority.leafPath ===
        '$' &&
      authority.leftReferenceExpression ===
        'finite.pos' &&
      authority.rightOperandSnapshot ===
        'verb',
      `result=${JSON.stringify(result)}`,
    );
  },
);


Deno.test(
  'v1.46 A3.3.3c: owner binding and referenced binding remain distinct identities',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult([
          rootAuthority({
            ownerBindingId:
              'binding:owner',

            ownerBindingName:
              'owner',

            sites: [
              referenceSite({
                rootBindingId:
                  'binding:finite',

                rootBindingName:
                  'finite',
              }),
            ],
          }),
        ]),

        rightResult([
          rightAuthority({
            ownerBindingId:
              'binding:owner',

            ownerBindingName:
              'owner',
          }),
        ]),
      );


    const authority =
      result.authorities[0];


    assert(
      authority
        ?.ownerBindingDefinitionAuthorityId ===
        'binding:owner' &&
      authority.referencedBindingDefinitionAuthorityId ===
        'binding:finite' &&
      authority.ownerBindingName ===
        'owner' &&
      authority.referencedBindingName ===
        'finite',
      'owner and referenced binding were collapsed',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3c: exact binding reference preserves null suffix',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult([
          rootAuthority({
            sites: [
              referenceSite({
                expression:
                  'finite',

                rootStatus:
                  'exact_binding',

                suffix:
                  null,
              }),
            ],
          }),
        ]),

        rightResult([
          rightAuthority(),
        ]),
      );


    assert(
      result.authorities[0]
        ?.leftRootStatus ===
        'exact_binding' &&
      result.authorities[0]
        ?.opaqueLeftSuffix ===
        null,
      'exact root invented suffix semantics',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3c: unrooted left reference is excluded rather than guessed',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult([
          rootAuthority({
            sites: [
              referenceSite({
                rootStatus:
                  'unrooted',

                expression:
                  'unknown.pos',
              }),
            ],
          }),
        ]),

        rightResult([
          rightAuthority(),
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        0 &&
      result.unrootedLeftSites.length ===
        1 &&
      result.rightSitesWithoutRootedLeft.length ===
        1,
      'unrooted left reference was interpreted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3c: rooted left site without right operand remains unmatched rather than invented',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult([
          rootAuthority(),
        ]),

        rightResult(
          [],
        ),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        0 &&
      result.rootedLeftSitesWithoutRight.length ===
        1,
      'missing right operand was invented',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3c: right operand without rooted left reference remains unmatched',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult([
          rootAuthority({
            sites:
              [],
          }),
        ]),

        rightResult([
          rightAuthority(),
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        0 &&
      result.rightSitesWithoutRootedLeft.length ===
        1,
      'right-only site acquired invented left reference',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3c: same leaf path with mismatched owner identity blocks composition',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult([
          rootAuthority(),
        ]),

        rightResult([
          rightAuthority({
            ownerBindingId:
              'binding:other-owner',
          }),
        ]),
      );


    assert(
      result.status ===
        'blocked',
      'ownership mismatch was accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3c: identical leaf paths in different where wrappers remain independent',
  () => {
    const result =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult([
          rootAuthority({
            id:
              'root:a',

            shapeId:
              'shape:a',

            ownerBindingId:
              'binding:a',

            manifestId:
              'manifest:a',

            manifestCode:
              'manifest.a',

            ownerBindingName:
              'a',
          }),

          rootAuthority({
            id:
              'root:b',

            shapeId:
              'shape:b',

            ownerBindingId:
              'binding:b',

            manifestId:
              'manifest:b',

            manifestCode:
              'manifest.b',

            ownerBindingName:
              'b',
          }),
        ]),

        rightResult([
          rightAuthority({
            id:
              'right:a',

            shapeId:
              'shape:a',

            ownerBindingId:
              'binding:a',

            manifestId:
              'manifest:a',

            manifestCode:
              'manifest.a',

            ownerBindingName:
              'a',
          }),

          rightAuthority({
            id:
              'right:b',

            shapeId:
              'shape:b',

            ownerBindingId:
              'binding:b',

            manifestId:
              'manifest:b',

            manifestCode:
              'manifest.b',

            ownerBindingName:
              'b',
          }),
        ]),
      );


    assert(
      result.status ===
        'ready' &&
      result.authorities.length ===
        2 &&
      result.authorities[0]
        ?.whereShapeAuthorityId !==
        result.authorities[1]
          ?.whereShapeAuthorityId,
      'local leaf paths were globally merged',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3c: duplicate reference path inside one owned root blocks ambiguity',
  () => {
    const site =
      referenceSite();


    const result =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult([
          rootAuthority({
            sites: [
              site,
              {
                ...site,
              },
            ],
          }),
        ]),

        rightResult([
          rightAuthority(),
        ]),
      );


    assert(
      result.status ===
        'blocked',
      'duplicate left site path was accepted',
    );
  },
);


Deno.test(
  'v1.46 A3.3.3c: deterministic structural composition executes no POS operator occurrence scope cardinality or dependency semantics',
  () => {
    const roots = [
      rootAuthority({
        id:
          'root:a',

        shapeId:
          'shape:a',

        ownerBindingId:
          'binding:a',

        manifestId:
          'manifest:a',

        manifestCode:
          'manifest.a',

        ownerBindingName:
          'a',
      }),

      rootAuthority({
        id:
          'root:b',

        shapeId:
          'shape:b',

        ownerBindingId:
          'binding:b',

        manifestId:
          'manifest:b',

        manifestCode:
          'manifest.b',

        ownerBindingName:
          'b',
      }),
    ];


    const rights = [
      rightAuthority({
        id:
          'right:a',

        shapeId:
          'shape:a',

        ownerBindingId:
          'binding:a',

        manifestId:
          'manifest:a',

        manifestCode:
          'manifest.a',

        ownerBindingName:
          'a',
      }),

      rightAuthority({
        id:
          'right:b',

        shapeId:
          'shape:b',

        ownerBindingId:
          'binding:b',

        manifestId:
          'manifest:b',

        manifestCode:
          'manifest.b',

        ownerBindingName:
          'b',
      }),
    ];


    const x =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult(
          roots,
        ),

        rightResult(
          rights,
        ),
      );


    const y =
      deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
        rootResult(
          [...roots].reverse(),
        ),

        rightResult(
          [...rights].reverse(),
        ),
      );


    assert(
      JSON.stringify(
        x,
      ) ===
        JSON.stringify(
          y,
        ),
      'A3.3.3c is not deterministic',
    );


    const g =
      x.authorities[0]
        ?.governance;


    assert(
      g !==
        undefined &&
      g.whereReferenceRootAuthorityIdentityPreserved ===
        true &&
      g.sameWhereShapeAuthorityRequired ===
        true &&
      g.sameOwnerBindingAuthorityRequired ===
        true &&
      g.sameManifestRequired ===
        true &&
      g.sameLeafPathRequired ===
        true &&
      g.ownerBindingAndReferencedBindingKeptSeparate ===
        true &&
      g.referencedBindingMayDifferFromOwner ===
        true &&
      g.unrootedLeftReferenceExcluded ===
        true &&
      g.structuralCompositionOnly ===
        true &&
      g.dottedReferenceTraversalPerformed ===
        false &&
      g.leftReferenceValueResolved ===
        false &&
      g.rightOperandSemanticsResolved ===
        false &&
      g.stringOperandMappedToPos ===
        false &&
      g.operatorSemanticsResolved ===
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
      g.canonicalDependencyEdgeGenerated ===
        false &&
      g.realizesSlotGenerated ===
        false &&
      g.graphMutationPerformed ===
        false,
      'A3.3.3c crossed structural boundary',
    );
  },
);