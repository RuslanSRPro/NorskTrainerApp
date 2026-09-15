// Norsk Trainer — Runtime Where Left/Right Site Authority V1
//
// v1.46 A3.3.3c
//
// Composition:
//
//   A3.3.1 rooted left-reference authority
//       +
//   A3.3.3b binding-owned right-operand authority
//       +
//   exact same:
//     whereShapeAuthorityId
//     owner binding-definition authority
//     manifest
//     binding name
//     leafPath
//       ->
//   one candidate structural left/right site.
//
// IMPORTANT:
//
// The binding that OWNS the where-clause and the binding REFERENCED by
// left.ref are different identities and remain explicitly separate.
//
// This layer does NOT:
// - execute the opaque operator;
// - interpret the right operand;
// - map a string operand to POS;
// - resolve the left dotted suffix;
// - enumerate Runtime occurrences;
// - execute scope/cardinality;
// - compare canonical values;
// - generate graph/dependency facts.

import {
  CANONICAL_RUNTIME_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1,
  type CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1,
  type CanonicalRuntimeBindingWhereReferenceRootAuthorityV1,
  type CanonicalRuntimeWhereReferenceRootSiteV1,
} from './canonical-runtime-binding-where-reference-root-authority-v1.ts';

import {
  CANONICAL_RUNTIME_BINDING_WHERE_RIGHT_OPERAND_AUTHORITY_V1,
  type CanonicalRuntimeBindingWhereRightOperandAuthorityResultV1,
  type CanonicalRuntimeBindingWhereRightOperandAuthorityV1,
} from './canonical-runtime-binding-where-right-operand-authority-v1.ts';

import type {
  CanonicalRuntimeWhereRightOperandStructuralKindV1,
} from './canonical-runtime-where-right-operand-site-authority-v1.ts';


export const CANONICAL_RUNTIME_BINDING_WHERE_LEFT_RIGHT_SITE_AUTHORITY_V1 =
  'canonical_runtime_binding_where_left_right_site_authority_v1';


export type CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1 = {
  id:
    string;

  status:
    'candidate';

  whereReferenceRootAuthorityId:
    string;

  whereShapeAuthorityId:
    string;

  ownerBindingDefinitionAuthorityId:
    string;

  manifestId:
    string;

  manifestCode:
    string;

  ownerBindingName:
    string;

  leafPath:
    string;

  leftReferenceExpression:
    string;

  leftRootStatus:
    | 'exact_binding'
    | 'binding_prefix_with_opaque_suffix';

  referencedBindingDefinitionAuthorityId:
    string;

  referencedBindingName:
    string;

  opaqueLeftSuffix:
    string | null;

  rightOperandAuthorityId:
    string;

  operatorLabelOpaque:
    string;

  rightOperandStructuralKind:
    CanonicalRuntimeWhereRightOperandStructuralKindV1;

  rightOperandSnapshot:
    unknown;

  governance: {
    exactReferenceRootAuthorityRequired:
      true;

    whereReferenceRootAuthorityIdentityPreserved:
      true;

    exactRightOperandAuthorityRequired:
      true;

    sameWhereShapeAuthorityRequired:
      true;

    sameOwnerBindingAuthorityRequired:
      true;

    sameManifestRequired:
      true;

    sameOwnerBindingNameRequired:
      true;

    sameLeafPathRequired:
      true;

    ownerBindingAndReferencedBindingKeptSeparate:
      true;

    referencedBindingMayDifferFromOwner:
      true;

    unrootedLeftReferenceExcluded:
      true;

    leftReferenceExpressionPreserved:
      true;

    opaqueLeftSuffixPreserved:
      true;

    rightOperandSnapshotPreserved:
      true;

    operatorLabelPreservedOpaque:
      true;

    structuralCompositionOnly:
      true;

    dottedReferenceTraversalPerformed:
      false;

    leftReferenceValueResolved:
      false;

    rightOperandSemanticsResolved:
      false;

    stringOperandMappedToPos:
      false;

    operatorSemanticsResolved:
      false;

    comparisonPerformed:
      false;

    runtimeBindingExecuted:
      false;

    occurrenceEnumerationPerformed:
      false;

    runtimeScopeExecutionPerformed:
      false;

    cardinalityEnforcementPerformed:
      false;

    occurrenceBindingPerformed:
      false;

    canonicalFactOwnershipResolved:
      false;

    canonicalDependencyEdgeGenerated:
      false;

    grammaticalFunctionResolved:
      false;

    complementArgumentAttachmentResolved:
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


export type CanonicalRuntimeBindingWhereLeftRightSiteAuthorityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_BINDING_WHERE_LEFT_RIGHT_SITE_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1[];

  rootedLeftSiteCount:
    number;

  rightOperandSiteCount:
    number;

  composedSiteCount:
    number;

  rootedLeftSitesWithoutRight:
    string[];

  rightSitesWithoutRootedLeft:
    string[];

  unrootedLeftSites:
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


function siteKey(
  whereShapeAuthorityId:
    string,

  leafPath:
    string,
): string {
  return [
    whereShapeAuthorityId,
    leafPath,
  ].join('::');
}


function safeRootSite(
  site:
    CanonicalRuntimeWhereReferenceRootSiteV1,
): boolean {
  return (
    Boolean(
      stringValue(
        site.path,
      ),
    ) &&

    Boolean(
      stringValue(
        site.referenceExpression,
      ),
    ) &&

    (
      site.rootStatus ===
        'exact_binding' ||
      site.rootStatus ===
        'binding_prefix_with_opaque_suffix' ||
      site.rootStatus ===
        'unrooted'
    )
  );
}


function safeRootAuthority(
  authority:
    CanonicalRuntimeBindingWhereReferenceRootAuthorityV1,
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
        authority.whereShapeAuthorityId,
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

    authority.referenceSites.every(
      safeRootSite,
    ) &&

    g.exactWhereShapeAuthorityRequired ===
      true &&

    g.exactBindingDefinitionSetRequired ===
      true &&

    g.manifestLocalBindingRootsOnly ===
      true &&

    g.longestExactBindingPrefixWins ===
      true &&

    g.referenceExpressionPreserved ===
      true &&

    g.opaqueSuffixPreserved ===
      true &&

    g.runtimeBindingVocabularyHardcoded ===
      false &&

    g.dottedReferenceTraversalPerformed ===
      false &&

    g.suffixSemanticsResolved ===
      false &&

    g.referenceValueResolved ===
      false &&

    g.operatorSemanticsResolved ===
      false &&

    g.canonicalFactOwnershipResolved ===
      false &&

    g.graphTraversalPerformed ===
      false &&

    g.occurrenceEnumerationPerformed ===
      false &&

    g.runtimeScopeExecutionPerformed ===
      false &&

    g.cardinalityEnforcementPerformed ===
      false &&

    g.occurrenceBindingPerformed ===
      false &&

    g.endpointRoleResolved ===
      false &&

    g.dependencyDirectionResolved ===
      false &&

    g.canonicalDependencyEdgeGenerated ===
      false &&

    g.grammaticalFunctionResolved ===
      false &&

    g.complementArgumentAttachmentResolved ===
      false &&

    g.realizesSlotGenerated ===
      false &&

    g.candidateOnly ===
      true &&

    g.frozenGrammarReadOnly ===
      true
  );
}


function safeRightAuthority(
  authority:
    CanonicalRuntimeBindingWhereRightOperandAuthorityV1,
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
        authority.whereShapeAuthorityId,
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

    Boolean(
      stringValue(
        authority.leafPath,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.operatorLabelOpaque,
      ),
    ) &&

    authority.hasRightOperand ===
      true &&

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

    g.bindingNamePreserved ===
      true &&

    g.rightOperandSnapshotPreserved ===
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

    g.grammaticalFunctionResolved ===
      false &&

    g.complementArgumentAttachmentResolved ===
      false &&

    g.realizesSlotGenerated ===
      false &&

    g.graphMutationPerformed ===
      false &&

    g.candidateOnly ===
      true &&

    g.frozenGrammarReadOnly ===
      true
  );
}


function blockedResult(
  reasons:
    readonly string[],
): CanonicalRuntimeBindingWhereLeftRightSiteAuthorityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_BINDING_WHERE_LEFT_RIGHT_SITE_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'blocked',

    authorities:
      [],

    rootedLeftSiteCount:
      0,

    rightOperandSiteCount:
      0,

    composedSiteCount:
      0,

    rootedLeftSitesWithoutRight:
      [],

    rightSitesWithoutRootedLeft:
      [],

    unrootedLeftSites:
      [],

    blockingReasons:
      unique(
        reasons,
      ),
  };
}


export function deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
  rootResult:
    CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1,

  rightResult:
    CanonicalRuntimeBindingWhereRightOperandAuthorityResultV1,
): CanonicalRuntimeBindingWhereLeftRightSiteAuthorityResultV1 {
  const blockingReasons:
    string[] = [];


  if (
    rootResult.producer !==
      CANONICAL_RUNTIME_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1 ||
    rootResult.producerVersion !==
      '1' ||
    rootResult.status !==
      'ready' ||
    rootResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      'reference_root_result:not_exact_ready_authority',
    );
  }


  if (
    rightResult.producer !==
      CANONICAL_RUNTIME_BINDING_WHERE_RIGHT_OPERAND_AUTHORITY_V1 ||
    rightResult.producerVersion !==
      '1' ||
    rightResult.status !==
      'ready' ||
    rightResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      'right_operand_result:not_exact_ready_authority',
    );
  }


  const rootAuthorityByShapeId =
    new Map<
      string,
      CanonicalRuntimeBindingWhereReferenceRootAuthorityV1
    >();


  for (
    const authority of
      rootResult.authorities
  ) {
    if (
      rootAuthorityByShapeId.has(
        authority.whereShapeAuthorityId,
      )
    ) {
      blockingReasons.push(
        `where_shape_authority:${authority.whereShapeAuthorityId}:duplicate_reference_root_owner`,
      );
    }


    rootAuthorityByShapeId.set(
      authority.whereShapeAuthorityId,
      authority,
    );


    if (
      !safeRootAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `reference_root_authority:${authority.id}:unsafe_contract`,
      );
    }


    const paths =
      authority.referenceSites.map(
        (site) =>
          site.path,
      );


    if (
      unique(
        paths,
      ).length !==
        paths.length
    ) {
      blockingReasons.push(
        `reference_root_authority:${authority.id}:duplicate_reference_site_path`,
      );
    }
  }


  const rightByKey =
    new Map<
      string,
      CanonicalRuntimeBindingWhereRightOperandAuthorityV1
    >();


  for (
    const authority of
      rightResult.authorities
  ) {
    if (
      !safeRightAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `right_operand_authority:${authority.id}:unsafe_contract`,
      );
    }


    const key =
      siteKey(
        authority.whereShapeAuthorityId,
        authority.leafPath,
      );


    if (
      rightByKey.has(
        key,
      )
    ) {
      blockingReasons.push(
        `right_operand_site:${key}:duplicate`,
      );
    }


    rightByKey.set(
      key,
      authority,
    );
  }


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  const authorities:
    CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1[] =
      [];

  const rootedLeftKeys =
    new Set<
      string
    >();

  const unrootedLeftSites:
    string[] = [];


  for (
    const rootAuthority of
      [...rootResult.authorities].sort(
        (a, b) =>
          a.whereShapeAuthorityId.localeCompare(
            b.whereShapeAuthorityId,
          ),
      )
  ) {
    for (
      const site of
        [...rootAuthority.referenceSites].sort(
          (a, b) =>
            a.path.localeCompare(
              b.path,
            ),
        )
    ) {
      const key =
        siteKey(
          rootAuthority.whereShapeAuthorityId,
          site.path,
        );


      if (
        site.rootStatus ===
          'unrooted'
      ) {
        unrootedLeftSites.push(
          key,
        );

        continue;
      }


      rootedLeftKeys.add(
        key,
      );


      const right =
        rightByKey.get(
          key,
        );


      if (!right) {
        continue;
      }


      if (
        right.whereShapeAuthorityId !==
          rootAuthority.whereShapeAuthorityId ||
        right.bindingDefinitionAuthorityId !==
          rootAuthority.bindingDefinitionAuthorityId ||
        right.manifestId !==
          rootAuthority.manifestId ||
        right.manifestCode !==
          rootAuthority.manifestCode ||
        right.bindingName !==
          rootAuthority.bindingName ||
        right.leafPath !==
          site.path
      ) {
        blockingReasons.push(
          `left_right_site:${key}:ownership_mismatch`,
        );

        continue;
      }


      const referencedBindingAuthorityId =
        stringValue(
          site.rootBindingAuthorityId,
        );

      const referencedBindingName =
        stringValue(
          site.rootBindingName,
        );


      if (
        !referencedBindingAuthorityId ||
        !referencedBindingName
      ) {
        blockingReasons.push(
          `left_reference_site:${key}:rooted_site_missing_referenced_binding_identity`,
        );

        continue;
      }


      authorities.push({
        id: [
          'runtime-binding-where-left-right-site-v1',
          idPart(
            rootAuthority.whereShapeAuthorityId,
          ),
          idPart(
            site.path,
          ),
        ].join(':'),

        status:
          'candidate',

        whereReferenceRootAuthorityId:
          rootAuthority.id,

        whereShapeAuthorityId:
          rootAuthority.whereShapeAuthorityId,

        ownerBindingDefinitionAuthorityId:
          rootAuthority.bindingDefinitionAuthorityId,

        manifestId:
          rootAuthority.manifestId,

        manifestCode:
          rootAuthority.manifestCode,

        ownerBindingName:
          rootAuthority.bindingName,

        leafPath:
          site.path,

        leftReferenceExpression:
          site.referenceExpression,

        leftRootStatus:
          site.rootStatus,

        referencedBindingDefinitionAuthorityId:
          referencedBindingAuthorityId,

        referencedBindingName,

        opaqueLeftSuffix:
          site.opaqueSuffix,

        rightOperandAuthorityId:
          right.id,

        operatorLabelOpaque:
          right.operatorLabelOpaque,

        rightOperandStructuralKind:
          right.rightOperandStructuralKind,

        rightOperandSnapshot:
          right.rightOperandSnapshot,

        governance: {
          exactReferenceRootAuthorityRequired:
            true,

          whereReferenceRootAuthorityIdentityPreserved:
            true,

          exactRightOperandAuthorityRequired:
            true,

          sameWhereShapeAuthorityRequired:
            true,

          sameOwnerBindingAuthorityRequired:
            true,

          sameManifestRequired:
            true,

          sameOwnerBindingNameRequired:
            true,

          sameLeafPathRequired:
            true,

          ownerBindingAndReferencedBindingKeptSeparate:
            true,

          referencedBindingMayDifferFromOwner:
            true,

          unrootedLeftReferenceExcluded:
            true,

          leftReferenceExpressionPreserved:
            true,

          opaqueLeftSuffixPreserved:
            true,

          rightOperandSnapshotPreserved:
            true,

          operatorLabelPreservedOpaque:
            true,

          structuralCompositionOnly:
            true,

          dottedReferenceTraversalPerformed:
            false,

          leftReferenceValueResolved:
            false,

          rightOperandSemanticsResolved:
            false,

          stringOperandMappedToPos:
            false,

          operatorSemanticsResolved:
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
      });
    }
  }


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


  const composedKeys =
    new Set(
      authorities.map(
        (authority) =>
          siteKey(
            authority.whereShapeAuthorityId,
            authority.leafPath,
          ),
      ),
    );


  const rootedLeftSitesWithoutRight =
    [...rootedLeftKeys]
      .filter(
        (key) =>
          !rightByKey.has(
            key,
          ),
      )
      .sort();


  const rightSitesWithoutRootedLeft =
    [...rightByKey.keys()]
      .filter(
        (key) =>
          !rootedLeftKeys.has(
            key,
          ) &&
          !composedKeys.has(
            key,
          ),
      )
      .sort();


  return {
    producer:
      CANONICAL_RUNTIME_BINDING_WHERE_LEFT_RIGHT_SITE_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    rootedLeftSiteCount:
      rootedLeftKeys.size,

    rightOperandSiteCount:
      rightByKey.size,

    composedSiteCount:
      authorities.length,

    rootedLeftSitesWithoutRight,

    rightSitesWithoutRootedLeft,

    unrootedLeftSites:
      unique(
        unrootedLeftSites,
      ),

    blockingReasons:
      [],
  };
}