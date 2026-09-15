// Norsk Trainer — Binding-Owned Runtime Where Right-Operand Authority V1
//
// v1.46 A3.3.3b
//
// Input:
//
//   A3.3.0 binding-owned where-shape authority.
//
// Composition:
//
//   exact A3.3.0 authority
//       -> exact authority.root
//       -> A3.3.3a structural right-operand site derivation
//       -> ownership inherited ONLY from the same A3.3.0 wrapper.
//
// leafPath is therefore local to one exact where-shape authority.
// Equal leafPath values in different bindings/manifests are NOT merged.
//
// This layer proves structural source ownership only:
//
// - exact A3.3.0 where-shape authority ID;
// - exact binding-definition authority ID;
// - manifest identity;
// - binding name;
// - exact leaf path inside that owned root;
// - exact A3.3.3a right-operand site;
// - opaque operator label;
// - preserved operand snapshot and structural kind.
//
// It does NOT:
// - interpret operator semantics;
// - interpret operand value semantics;
// - map strings to POS;
// - compare values;
// - execute Runtime bindings;
// - enumerate occurrences;
// - execute scope/cardinality;
// - create graph/dependency facts.

import {
  CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1,
  type CanonicalRuntimeBindingWhereShapeAuthorityResultV1,
  type CanonicalRuntimeBindingWhereShapeAuthorityV1,
} from './canonical-runtime-binding-where-shape-authority-v1.ts';

import {
  CANONICAL_RUNTIME_WHERE_RIGHT_OPERAND_SITE_AUTHORITY_V1,
  deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1,
  type CanonicalRuntimeWhereRightOperandSiteAuthorityV1,
  type CanonicalRuntimeWhereRightOperandStructuralKindV1,
} from './canonical-runtime-where-right-operand-site-authority-v1.ts';


export const CANONICAL_RUNTIME_BINDING_WHERE_RIGHT_OPERAND_AUTHORITY_V1 =
  'canonical_runtime_binding_where_right_operand_authority_v1';


export type CanonicalRuntimeBindingWhereRightOperandAuthorityV1 = {
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

  rightOperandSiteAuthorityId:
    string;

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
    exactWhereShapeAuthorityRequired:
      true;

    exactRightOperandSiteAuthorityRequired:
      true;

    siteDerivedInsideExactOwnedRoot:
      true;

    leafPathIsAuthorityLocal:
      true;

    equalLeafPathsAcrossAuthoritiesMerged:
      false;

    bindingDefinitionAuthorityIdentityPreserved:
      true;

    manifestIdentityPreserved:
      true;

    bindingNamePreserved:
      true;

    rightOperandSnapshotPreserved:
      true;

    structuralOwnershipOnly:
      true;

    bindingDefinitionSemanticsResolved:
      false;

    operatorSemanticsResolved:
      false;

    rightOperandSemanticsResolved:
      false;

    stringOperandMappedToPos:
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


export type CanonicalRuntimeBindingWhereRightOperandAuthorityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_BINDING_WHERE_RIGHT_OPERAND_AUTHORITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  authorities:
    CanonicalRuntimeBindingWhereRightOperandAuthorityV1[];

  whereShapeAuthorityCount:
    number;

  rightOperandSiteCount:
    number;

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

    authority.unclassifiedPaths.every(
      (path) =>
        Boolean(
          stringValue(
            path,
          ),
        ),
    ) &&

    unique(
      authority.unclassifiedPaths,
    ).length ===
      authority.unclassifiedPaths.length &&

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

    g.compoundSemanticsResolved ===
      false &&

    g.referenceSemanticsResolved ===
      false &&

    g.dottedReferenceTraversalPerformed ===
      false &&

    g.rightOperandSemanticsResolved ===
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


function safeSiteAuthority(
  site:
    CanonicalRuntimeWhereRightOperandSiteAuthorityV1,
): boolean {
  const g =
    site.governance;


  return (
    site.status ===
      'candidate' &&

    Boolean(
      stringValue(
        site.id,
      ),
    ) &&

    Boolean(
      stringValue(
        site.leafPath,
      ),
    ) &&

    Boolean(
      stringValue(
        site.operatorLabelOpaque,
      ),
    ) &&

    site.hasRightOperand ===
      true &&

    g.exactA330LeafRequired ===
      true &&

    g.explicitRightOperandPresenceRequired ===
      true &&

    g.absenceDistinguishedFromExplicitNull ===
      true &&

    g.leafPathPreserved ===
      true &&

    g.operatorLabelPreservedOpaque ===
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
      true &&

    g.frozenGrammarReadOnly ===
      true
  );
}


function blockedResult(
  reasons:
    readonly string[],
): CanonicalRuntimeBindingWhereRightOperandAuthorityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_BINDING_WHERE_RIGHT_OPERAND_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'blocked',

    authorities:
      [],

    whereShapeAuthorityCount:
      0,

    rightOperandSiteCount:
      0,

    blockingReasons:
      unique(
        reasons,
      ),
  };
}


export function deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
  shapeResult:
    CanonicalRuntimeBindingWhereShapeAuthorityResultV1,
): CanonicalRuntimeBindingWhereRightOperandAuthorityResultV1 {
  const blockingReasons:
    string[] = [];


  if (
    shapeResult.producer !==
      CANONICAL_RUNTIME_BINDING_WHERE_SHAPE_AUTHORITY_V1 ||
    shapeResult.producerVersion !==
      '1' ||
    shapeResult.status !==
      'ready' ||
    shapeResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      'where_shape_result:not_exact_ready_authority',
    );
  }


  const seenShapeAuthorityIds =
    new Set<
      string
    >();

  const seenBindingAuthorityIds =
    new Set<
      string
    >();


  for (
    const authority of
      shapeResult.authorities
  ) {
    if (
      seenShapeAuthorityIds.has(
        authority.id,
      )
    ) {
      blockingReasons.push(
        `where_shape_authority:${authority.id}:duplicate`,
      );
    }


    seenShapeAuthorityIds.add(
      authority.id,
    );


    if (
      seenBindingAuthorityIds.has(
        authority.bindingDefinitionAuthorityId,
      )
    ) {
      blockingReasons.push(
        `binding_definition_authority:${authority.bindingDefinitionAuthorityId}:duplicate_where_shape_ownership`,
      );
    }


    seenBindingAuthorityIds.add(
      authority.bindingDefinitionAuthorityId,
    );


    if (
      !safeWhereShapeAuthority(
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
    return blockedResult(
      blockingReasons,
    );
  }


  const authorities:
    CanonicalRuntimeBindingWhereRightOperandAuthorityV1[] =
      [];


  for (
    const shapeAuthority of
      [...shapeResult.authorities].sort(
        (a, b) =>
          a.id.localeCompare(
            b.id,
          ),
      )
  ) {
    const siteResult =
      deriveCanonicalRuntimeWhereRightOperandSiteAuthoritiesV1(
        shapeAuthority.root,
      );


    if (
      siteResult.producer !==
        CANONICAL_RUNTIME_WHERE_RIGHT_OPERAND_SITE_AUTHORITY_V1 ||
      siteResult.producerVersion !==
        '1' ||
      siteResult.status !==
        'ready' ||
      siteResult.blockingReasons.length !==
        0
    ) {
      blockingReasons.push(
        `where_shape_authority:${shapeAuthority.id}:right_operand_site_derivation_blocked`,
      );

      continue;
    }


    for (
      const site of
        siteResult.authorities
    ) {
      if (
        !safeSiteAuthority(
          site,
        )
      ) {
        blockingReasons.push(
          `where_shape_authority:${shapeAuthority.id}:right_operand_site:${site.id}:unsafe_contract`,
        );

        continue;
      }


      authorities.push({
        id: [
          'runtime-binding-where-right-operand-v1',
          idPart(
            shapeAuthority.id,
          ),
          idPart(
            site.leafPath,
          ),
        ].join(':'),

        status:
          'candidate',

        whereShapeAuthorityId:
          shapeAuthority.id,

        bindingDefinitionAuthorityId:
          shapeAuthority.bindingDefinitionAuthorityId,

        manifestId:
          shapeAuthority.manifestId,

        manifestCode:
          shapeAuthority.manifestCode,

        bindingName:
          shapeAuthority.bindingName,

        rightOperandSiteAuthorityId:
          site.id,

        leafPath:
          site.leafPath,

        operatorLabelOpaque:
          site.operatorLabelOpaque,

        hasRightOperand:
          true,

        rightOperandStructuralKind:
          site.rightOperandStructuralKind,

        rightOperandSnapshot:
          site.rightOperandSnapshot,

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


  return {
    producer:
      CANONICAL_RUNTIME_BINDING_WHERE_RIGHT_OPERAND_AUTHORITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    authorities,

    whereShapeAuthorityCount:
      shapeResult.authorities.length,

    rightOperandSiteCount:
      authorities.length,

    blockingReasons:
      [],
  };
}