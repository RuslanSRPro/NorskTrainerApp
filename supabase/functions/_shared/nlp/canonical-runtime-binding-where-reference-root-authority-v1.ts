// Norsk Trainer — Runtime Binding Where Reference Root Authority V1
//
// v1.46 A3.3.1
//
// Purpose:
//
//   A3.3.0 structural where leaf
//       +
//   exact A3.0 Runtime binding definitions from the same manifest
//       ->
//   syntactic binding-root authority for left.ref.
//
// Example:
//
//   finite.features.VerbForm
//
// proves only:
//
//   root binding = finite
//   opaque suffix = .features.VerbForm
//
// It does NOT prove what "features" or "VerbForm" means.
//
// A where clause owned by one binding may reference another binding
// from the same Runtime IR manifest. Therefore rooting is performed
// against the complete exact binding-definition set of that manifest.
//
// Longest exact binding prefix wins.
//
// This layer does NOT:
// - traverse dotted references;
// - interpret suffix segments;
// - execute where operators;
// - resolve canonical graph fields;
// - enumerate occurrences;
// - execute scope/cardinality;
// - create dependencies.

import type {
  CanonicalRuntimeBindingDefinitionAuthorityV1,
} from './canonical-runtime-binding-definition-authority-v1.ts';

import type {
  CanonicalRuntimeBindingWhereShapeAuthorityV1,
  CanonicalRuntimeWhereShapeNodeV1,
} from './canonical-runtime-binding-where-shape-authority-v1.ts';


export const CANONICAL_RUNTIME_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1 =
  'canonical_runtime_binding_where_reference_root_authority_v1';


export type CanonicalRuntimeWhereReferenceRootSiteV1 = {
  path:
    string;

  referenceExpression:
    string;

  rootStatus:
    | 'exact_binding'
    | 'binding_prefix_with_opaque_suffix'
    | 'unrooted';

  rootBindingAuthorityId:
    string | null;

  rootBindingName:
    string | null;

  opaqueSuffix:
    string | null;
};


export type CanonicalRuntimeBindingWhereReferenceRootAuthorityV1 = {
  id:
    string;

  status:
    'candidate';

  whereShapeAuthorityId:
    string;

  bindingDefinitionAuthorityId:
    string;

  manifestId:
    string;

  manifestCode:
    string;

  bindingName:
    string;

  referenceSites:
    CanonicalRuntimeWhereReferenceRootSiteV1[];

  unrootedPaths:
    string[];

  governance: {
    exactWhereShapeAuthorityRequired:
      true;

    exactBindingDefinitionSetRequired:
      true;

    manifestLocalBindingRootsOnly:
      true;

    longestExactBindingPrefixWins:
      true;

    referenceExpressionPreserved:
      true;

    opaqueSuffixPreserved:
      true;

    runtimeBindingVocabularyHardcoded:
      false;

    dottedReferenceTraversalPerformed:
      false;

    suffixSemanticsResolved:
      false;

    referenceValueResolved:
      false;

    operatorSemanticsResolved:
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

    endpointRoleResolved:
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


export type CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalRuntimeBindingWhereReferenceRootAuthorityV1[];

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


function safeWhereShapeAuthority(
  authority:
    CanonicalRuntimeBindingWhereShapeAuthorityV1,
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
        authority.bindingDefinitionAuthorityId,
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

    g.exactBindingDefinitionAuthorityRequired ===
      true &&

    g.whereClauseReadOnly ===
      true &&

    g.whereShapeOnly ===
      true &&

    g.runtimeOperatorVocabularyHardcoded ===
      false &&

    g.compoundKeyVocabularyHardcoded ===
      false &&

    g.operatorSemanticsResolved ===
      false &&

    g.referenceSemanticsResolved ===
      false &&

    g.dottedReferenceTraversalPerformed ===
      false &&

    g.graphTraversalPerformed ===
      false &&

    g.occurrenceEnumerationPerformed ===
      false &&

    g.occurrenceBindingPerformed ===
      false &&

    g.canonicalDependencyEdgeGenerated ===
      false &&

    g.candidateOnly ===
      true &&

    g.frozenGrammarReadOnly ===
      true
  );
}


function collectReferenceExpressions(
  node:
    CanonicalRuntimeWhereShapeNodeV1,
): Array<{
  path:
    string;

  referenceExpression:
    string;
}> {
  if (
    node.shape ===
      'leaf_operator'
  ) {
    const referenceExpression =
      stringValue(
        node.leftReferenceExpression,
      );


    return referenceExpression
      ? [
          {
            path:
              node.path,

            referenceExpression,
          },
        ]
      : [];
  }


  if (
    node.shape !==
      'compound_array_group'
  ) {
    return [];
  }


  return node.children
    .flatMap(
      collectReferenceExpressions,
    )
    .sort(
      (a, b) =>
        a.path.localeCompare(
          b.path,
        ) ||
        a.referenceExpression.localeCompare(
          b.referenceExpression,
        ),
    );
}


function rootReference(
  referenceExpression:
    string,

  bindingAuthorities:
    readonly CanonicalRuntimeBindingDefinitionAuthorityV1[],
): CanonicalRuntimeWhereReferenceRootSiteV1 {
  const matches =
    bindingAuthorities
      .filter(
        (bindingAuthority) => {
          const bindingName =
            bindingAuthority.bindingName;


          return (
            referenceExpression ===
              bindingName ||
            referenceExpression.startsWith(
              `${bindingName}.`,
            )
          );
        },
      )
      .sort(
        (a, b) =>
          b.bindingName.length -
            a.bindingName.length ||
          a.bindingName.localeCompare(
            b.bindingName,
          ) ||
          a.id.localeCompare(
            b.id,
          ),
      );


  const root =
    matches[0];


  if (!root) {
    return {
      path:
        '',

      referenceExpression,

      rootStatus:
        'unrooted',

      rootBindingAuthorityId:
        null,

      rootBindingName:
        null,

      opaqueSuffix:
        null,
    };
  }


  if (
    referenceExpression ===
      root.bindingName
  ) {
    return {
      path:
        '',

      referenceExpression,

      rootStatus:
        'exact_binding',

      rootBindingAuthorityId:
        root.id,

      rootBindingName:
        root.bindingName,

      opaqueSuffix:
        null,
    };
  }


  return {
    path:
      '',

    referenceExpression,

    rootStatus:
      'binding_prefix_with_opaque_suffix',

    rootBindingAuthorityId:
      root.id,

    rootBindingName:
      root.bindingName,

    opaqueSuffix:
      referenceExpression.slice(
        root.bindingName.length,
      ),
  };
}


export function deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
  whereShapeAuthorities:
    readonly CanonicalRuntimeBindingWhereShapeAuthorityV1[],

  bindingAuthorities:
    readonly CanonicalRuntimeBindingDefinitionAuthorityV1[],
): CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1 {
  const blockingReasons:
    string[] = [];


  const bindingById =
    new Map<
      string,
      CanonicalRuntimeBindingDefinitionAuthorityV1
    >();

  const bindingSetsByManifest =
    new Map<
      string,
      CanonicalRuntimeBindingDefinitionAuthorityV1[]
    >();


  for (
    const authority of
      bindingAuthorities
  ) {
    if (
      bindingById.has(
        authority.id,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:duplicate`,
      );

      continue;
    }


    if (
      !safeBindingAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `binding_authority:${authority.id}:unsafe_contract`,
      );
    }


    bindingById.set(
      authority.id,
      authority,
    );


    const manifestSet =
      bindingSetsByManifest.get(
        authority.manifestId,
      ) ?? [];


    manifestSet.push(
      authority,
    );


    bindingSetsByManifest.set(
      authority.manifestId,
      manifestSet,
    );
  }


  for (
    const [
      manifestId,
      manifestBindings,
    ] of bindingSetsByManifest
  ) {
    const seenNames =
      new Set<
        string
      >();


    for (
      const binding of
        manifestBindings
    ) {
      if (
        seenNames.has(
          binding.bindingName,
        )
      ) {
        blockingReasons.push(
          `manifest:${manifestId}:duplicate_binding_name:${binding.bindingName}`,
        );
      }


      seenNames.add(
        binding.bindingName,
      );
    }
  }


  const seenWhereShapeIds =
    new Set<
      string
    >();


  for (
    const whereAuthority of
      whereShapeAuthorities
  ) {
    if (
      seenWhereShapeIds.has(
        whereAuthority.id,
      )
    ) {
      blockingReasons.push(
        `where_shape_authority:${whereAuthority.id}:duplicate`,
      );

      continue;
    }


    seenWhereShapeIds.add(
      whereAuthority.id,
    );


    if (
      !safeWhereShapeAuthority(
        whereAuthority,
      )
    ) {
      blockingReasons.push(
        `where_shape_authority:${whereAuthority.id}:unsafe_contract`,
      );

      continue;
    }


    const ownerBinding =
      bindingById.get(
        whereAuthority.bindingDefinitionAuthorityId,
      );


    if (!ownerBinding) {
      blockingReasons.push(
        `where_shape_authority:${whereAuthority.id}:owner_binding_missing`,
      );

      continue;
    }


    if (
      ownerBinding.manifestId !==
        whereAuthority.manifestId ||
      ownerBinding.manifestCode !==
        whereAuthority.manifestCode ||
      ownerBinding.bindingName !==
        whereAuthority.bindingName
    ) {
      blockingReasons.push(
        `where_shape_authority:${whereAuthority.id}:owner_binding_snapshot_mismatch`,
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
        CANONICAL_RUNTIME_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1,

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
    whereShapeAuthorities.map(
      (
        whereAuthority,
      ): CanonicalRuntimeBindingWhereReferenceRootAuthorityV1 => {
        const manifestBindings =
          bindingSetsByManifest.get(
            whereAuthority.manifestId,
          ) ?? [];


        const referenceSites =
          collectReferenceExpressions(
            whereAuthority.root,
          )
            .map(
              (
                reference,
              ): CanonicalRuntimeWhereReferenceRootSiteV1 => ({
                ...rootReference(
                  reference.referenceExpression,
                  manifestBindings,
                ),

                path:
                  reference.path,
              }),
            )
            .sort(
              (a, b) =>
                a.path.localeCompare(
                  b.path,
                ) ||
                a.referenceExpression.localeCompare(
                  b.referenceExpression,
                ),
            );


        return {
          id: [
            'runtime-binding-where-reference-root-v1',
            idPart(
              whereAuthority.id,
            ),
          ].join(':'),

          status:
            'candidate',

          whereShapeAuthorityId:
            whereAuthority.id,

          bindingDefinitionAuthorityId:
            whereAuthority.bindingDefinitionAuthorityId,

          manifestId:
            whereAuthority.manifestId,

          manifestCode:
            whereAuthority.manifestCode,

          bindingName:
            whereAuthority.bindingName,

          referenceSites,

          unrootedPaths:
            referenceSites
              .filter(
                (site) =>
                  site.rootStatus ===
                    'unrooted',
              )
              .map(
                (site) =>
                  site.path,
              )
              .sort(),

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
      CANONICAL_RUNTIME_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    blockingReasons:
      [],
  };
}