// Norsk Trainer — Runtime Token .pos String-Operand Compatibility V1
//
// v1.46 A3.3.3d
//
// Composition:
//
//   A3.3.3c exact owned left/right structural site
//       +
//   A3.3.2c exact token .pos suffix compatibility
//       +
//   exact same:
//     whereReferenceRootAuthorityId
//     whereShapeAuthorityId
//     owner binding
//     referenced binding
//     manifest
//     owner/referenced binding names
//     reference path
//     reference expression
//     referenceSiteKey
//       +
//   right operand structural kind = string
//       ->
//   candidate token-.pos string-operand compatibility.
//
// IMPORTANT:
//
// A string on the right side is preserved as an opaque prospective
// POS-label input. This layer does NOT prove that the string belongs
// to canonical POS vocabulary.
//
// "verb" is therefore NOT converted into semantic POS truth here.
//
// This layer does NOT:
// - execute operator semantics;
// - require or interpret operator "eq";
// - validate POS vocabulary;
// - read canonical POS hypotheses;
// - compare requested POS against canonical POS;
// - classify learner correctness;
// - enumerate Runtime occurrences;
// - execute scope/cardinality;
// - bind an occurrence;
// - generate dependency or graph facts.

import {
  CANONICAL_RUNTIME_BINDING_WHERE_LEFT_RIGHT_SITE_AUTHORITY_V1,
  type CanonicalRuntimeBindingWhereLeftRightSiteAuthorityResultV1,
  type CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1,
} from './canonical-runtime-binding-where-left-right-site-authority-v1.ts';

import {
  CANONICAL_RUNTIME_TOKEN_POS_SUFFIX_COMPATIBILITY_V1,
  type CanonicalRuntimeTokenPosSuffixCompatibilityResultV1,
  type CanonicalRuntimeTokenPosSuffixCompatibilityV1,
} from './canonical-runtime-token-pos-suffix-compatibility-v1.ts';


export const CANONICAL_RUNTIME_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1 =
  'canonical_runtime_token_pos_string_operand_compatibility_v1';


export type CanonicalRuntimeTokenPosStringOperandCompatibilityV1 = {
  id:
    string;

  status:
    'candidate';

  leftRightSiteAuthorityId:
    string;

  tokenPosSuffixCompatibilityId:
    string;

  whereReferenceRootAuthorityId:
    string;

  whereShapeAuthorityId:
    string;

  ownerBindingDefinitionAuthorityId:
    string;

  referencedBindingDefinitionAuthorityId:
    string;

  manifestId:
    string;

  manifestCode:
    string;

  ownerBindingName:
    string;

  referencedBindingName:
    string;

  referenceSiteKey:
    string;

  referencePath:
    string;

  referenceExpression:
    string;

  runtimeSuffix:
    '.pos';

  entityCompatibilityId:
    string;

  runtimeEntityLabel:
    string;

  canonicalNodeType:
    'token';

  tokenPosCapabilityId:
    string;

  canonicalPropertyDomain:
    'canonical_token_occurrence';

  canonicalPropertyKind:
    'pos_hypothesis_set';

  operatorLabelOpaque:
    string;

  rightOperandStructuralKind:
    'string';

  posLabelInputOpaque:
    string;

  governance: {
    exactLeftRightSiteAuthorityRequired:
      true;

    exactTokenPosSuffixCompatibilityRequired:
      true;

    exactReferenceRootAuthorityIdentityMatch:
      true;

    exactWhereShapeAuthorityIdentityMatch:
      true;

    exactOwnerBindingIdentityMatch:
      true;

    exactReferencedBindingIdentityMatch:
      true;

    exactManifestIdentityMatch:
      true;

    exactBindingNameMatch:
      true;

    exactReferencePathMatch:
      true;

    exactReferenceExpressionMatch:
      true;

    exactReferenceSiteKeyMatch:
      true;

    exactRuntimePosSuffixRequired:
      true;

    exactCanonicalTokenCompatibilityRequired:
      true;

    exactTokenPosHypothesisSetCapabilityRequired:
      true;

    stringRightOperandRequired:
      true;

    stringOperandPreservedOpaque:
      true;

    posLabelInputCompatibilityOnly:
      true;

    operatorLabelPreservedOpaque:
      true;

    nonStringOperandRejectedByThisCapability:
      true;

    posVocabularyValidated:
      false;

    operandKnownCanonicalPosLabel:
      false;

    operandNormalizationPerformed:
      false;

    caseFoldingPerformed:
      false;

    operatorSemanticsResolved:
      false;

    whereEqExecuted:
      false;

    posHypothesisRead:
      false;

    posHypothesisSelected:
      false;

    posLabelCompared:
      false;

    comparisonPerformed:
      false;

    comparisonTruthResolved:
      false;

    learnerErrorClassified:
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


export type CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  candidates:
    CanonicalRuntimeTokenPosStringOperandCompatibilityV1[];

  consideredTokenPosLeftRightSiteCount:
    number;

  unsupportedOperandSiteIds:
    string[];

  unmatchedStringOperandSiteIds:
    string[];

  tokenPosSuffixCandidatesWithoutStringOperandSiteKeys:
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


function referenceSiteKey(
  site:
    CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1,
): string {
  return [
    site.whereReferenceRootAuthorityId,
    site.leafPath,
    site.leftReferenceExpression,
  ].join('#');
}


function safeLeftRightSite(
  site:
    CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1,
): boolean {
  const g =
    site.governance;


  if (
    site.status !==
      'candidate' ||
    !stringValue(
      site.id,
    ) ||
    !stringValue(
      site.whereReferenceRootAuthorityId,
    ) ||
    !stringValue(
      site.whereShapeAuthorityId,
    ) ||
    !stringValue(
      site.ownerBindingDefinitionAuthorityId,
    ) ||
    !stringValue(
      site.referencedBindingDefinitionAuthorityId,
    ) ||
    !stringValue(
      site.manifestId,
    ) ||
    !stringValue(
      site.manifestCode,
    ) ||
    !stringValue(
      site.ownerBindingName,
    ) ||
    !stringValue(
      site.referencedBindingName,
    ) ||
    !stringValue(
      site.leafPath,
    ) ||
    !stringValue(
      site.leftReferenceExpression,
    ) ||
    !stringValue(
      site.rightOperandAuthorityId,
    ) ||
    !stringValue(
      site.operatorLabelOpaque,
    )
  ) {
    return false;
  }


  if (
    site.leftRootStatus ===
      'exact_binding'
  ) {
    if (
      site.opaqueLeftSuffix !==
        null
    ) {
      return false;
    }
  } else if (
    site.leftRootStatus ===
      'binding_prefix_with_opaque_suffix'
  ) {
    if (
      !stringValue(
        site.opaqueLeftSuffix,
      )
    ) {
      return false;
    }
  } else {
    return false;
  }


  return (
    g.exactReferenceRootAuthorityRequired ===
      true &&
    g.whereReferenceRootAuthorityIdentityPreserved ===
      true &&
    g.exactRightOperandAuthorityRequired ===
      true &&
    g.sameWhereShapeAuthorityRequired ===
      true &&
    g.sameOwnerBindingAuthorityRequired ===
      true &&
    g.sameManifestRequired ===
      true &&
    g.sameOwnerBindingNameRequired ===
      true &&
    g.sameLeafPathRequired ===
      true &&
    g.ownerBindingAndReferencedBindingKeptSeparate ===
      true &&
    g.referencedBindingMayDifferFromOwner ===
      true &&
    g.unrootedLeftReferenceExcluded ===
      true &&
    g.leftReferenceExpressionPreserved ===
      true &&
    g.opaqueLeftSuffixPreserved ===
      true &&
    g.rightOperandSnapshotPreserved ===
      true &&
    g.operatorLabelPreservedOpaque ===
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


function safeTokenPosSuffixCandidate(
  candidate:
    CanonicalRuntimeTokenPosSuffixCompatibilityV1,
): boolean {
  const g =
    candidate.governance;


  return (
    candidate.status ===
      'candidate' &&

    Boolean(
      stringValue(
        candidate.id,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.whereReferenceRootAuthorityId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.whereShapeAuthorityId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.ownerBindingDefinitionAuthorityId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referencedBindingDefinitionAuthorityId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.manifestId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.manifestCode,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.ownerBindingName,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referencedBindingName,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referenceSiteKey,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referencePath,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.referenceExpression,
      ),
    ) &&

    candidate.runtimeSuffix ===
      '.pos' &&

    Boolean(
      stringValue(
        candidate.entityCompatibilityId,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.runtimeEntityLabel,
      ),
    ) &&

    candidate.canonicalNodeType ===
      'token' &&

    Boolean(
      stringValue(
        candidate.tokenPosCapabilityId,
      ),
    ) &&

    candidate.canonicalPropertyDomain ===
      'canonical_token_occurrence' &&

    candidate.canonicalPropertyKind ===
      'pos_hypothesis_set' &&

    g.exactWhereReferenceRootAuthorityRequired ===
      true &&

    g.exactEntityCompatibilityAuthorityRequired ===
      true &&

    g.exactTokenPosCapabilityRequired ===
      true &&

    g.exactOpaqueSuffixMatch ===
      true &&

    g.rootedBindingIdentityPreserved ===
      true &&

    g.entityCompatibilityConsumedNotReconstructed ===
      true &&

    g.tokenPosCapabilityConsumedNotReconstructed ===
      true &&

    g.compatibilityOnly ===
      true &&

    g.candidateOnly ===
      true &&

    g.runtimeCandidatePosMapped ===
      false &&

    g.runtimePhrasePosMapped ===
      false &&

    g.propertyValueIsScalar ===
      false &&

    g.propertyValueIsHypothesisSet ===
      true &&

    g.posHypothesisSelected ===
      false &&

    g.rightOperandRead ===
      false &&

    g.rightOperandCompared ===
      false &&

    g.operatorSemanticsResolved ===
      false &&

    g.whereEqExecuted ===
      false &&

    g.referenceValueResolved ===
      false &&

    g.dottedReferenceTraversalPerformed ===
      false &&

    g.occurrenceEnumerationPerformed ===
      false &&

    g.runtimeScopeExecutionPerformed ===
      false &&

    g.clauseContainmentResolved ===
      false &&

    g.cardinalityEnforcementPerformed ===
      false &&

    g.occurrenceBindingPerformed ===
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

    g.frozenGrammarReadOnly ===
      true
  );
}


function blockedResult(
  reasons:
    readonly string[],
): CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,

    producerVersion:
      '1',

    status:
      'blocked',

    candidates:
      [],

    consideredTokenPosLeftRightSiteCount:
      0,

    unsupportedOperandSiteIds:
      [],

    unmatchedStringOperandSiteIds:
      [],

    tokenPosSuffixCandidatesWithoutStringOperandSiteKeys:
      [],

    blockingReasons:
      unique(
        reasons,
      ),
  };
}


export function deriveCanonicalRuntimeTokenPosStringOperandCompatibilitiesV1(
  leftRightResult:
    CanonicalRuntimeBindingWhereLeftRightSiteAuthorityResultV1,

  tokenPosSuffixResult:
    CanonicalRuntimeTokenPosSuffixCompatibilityResultV1,
): CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1 {
  const blockingReasons:
    string[] = [];


  if (
    leftRightResult.producer !==
      CANONICAL_RUNTIME_BINDING_WHERE_LEFT_RIGHT_SITE_AUTHORITY_V1 ||
    leftRightResult.producerVersion !==
      '1' ||
    leftRightResult.status !==
      'ready' ||
    leftRightResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      'left_right_result:not_exact_ready_authority',
    );
  }


  if (
    tokenPosSuffixResult.producer !==
      CANONICAL_RUNTIME_TOKEN_POS_SUFFIX_COMPATIBILITY_V1 ||
    tokenPosSuffixResult.producerVersion !==
      '1' ||
    tokenPosSuffixResult.status !==
      'ready' ||
    tokenPosSuffixResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      'token_pos_suffix_result:not_exact_ready_compatibility',
    );
  }


  const leftRightByReferenceSiteKey =
    new Map<
      string,
      CanonicalRuntimeBindingWhereLeftRightSiteAuthorityV1
    >();


  for (
    const site of
      leftRightResult.authorities
  ) {
    if (
      !safeLeftRightSite(
        site,
      )
    ) {
      blockingReasons.push(
        `left_right_site:${site.id}:unsafe_contract`,
      );

      continue;
    }


    const key =
      referenceSiteKey(
        site,
      );


    if (
      leftRightByReferenceSiteKey.has(
        key,
      )
    ) {
      blockingReasons.push(
        `left_right_site:${key}:duplicate_exact_reference_site`,
      );
    }


    leftRightByReferenceSiteKey.set(
      key,
      site,
    );
  }


  const posSuffixByReferenceSiteKey =
    new Map<
      string,
      CanonicalRuntimeTokenPosSuffixCompatibilityV1
    >();


  for (
    const candidate of
      tokenPosSuffixResult.candidates
  ) {
    if (
      !safeTokenPosSuffixCandidate(
        candidate,
      )
    ) {
      blockingReasons.push(
        `token_pos_suffix_candidate:${candidate.id}:unsafe_contract`,
      );

      continue;
    }


    if (
      posSuffixByReferenceSiteKey.has(
        candidate.referenceSiteKey,
      )
    ) {
      blockingReasons.push(
        `token_pos_suffix_candidate:${candidate.referenceSiteKey}:duplicate_exact_reference_site`,
      );
    }


    posSuffixByReferenceSiteKey.set(
      candidate.referenceSiteKey,
      candidate,
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


  const candidates:
    CanonicalRuntimeTokenPosStringOperandCompatibilityV1[] =
      [];

  const unsupportedOperandSiteIds:
    string[] = [];

  const unmatchedStringOperandSiteIds:
    string[] = [];

  const consumedSuffixKeys =
    new Set<
      string
    >();

  let consideredTokenPosLeftRightSiteCount =
    0;


  for (
    const site of
      [...leftRightResult.authorities].sort(
        (a, b) =>
          a.id.localeCompare(
            b.id,
          ),
      )
  ) {
    if (
      site.leftRootStatus !==
        'binding_prefix_with_opaque_suffix' ||
      site.opaqueLeftSuffix !==
        '.pos'
    ) {
      continue;
    }


    consideredTokenPosLeftRightSiteCount +=
      1;


    if (
      site.rightOperandStructuralKind !==
        'string' ||
      typeof site.rightOperandSnapshot !==
        'string' ||
      !stringValue(
        site.rightOperandSnapshot,
      )
    ) {
      unsupportedOperandSiteIds.push(
        site.id,
      );

      continue;
    }


    const key =
      referenceSiteKey(
        site,
      );


    const suffix =
      posSuffixByReferenceSiteKey.get(
        key,
      );


    if (!suffix) {
      unmatchedStringOperandSiteIds.push(
        site.id,
      );

      continue;
    }


    if (
      suffix.referenceSiteKey !==
        key ||
      suffix.whereReferenceRootAuthorityId !==
        site.whereReferenceRootAuthorityId ||
      suffix.whereShapeAuthorityId !==
        site.whereShapeAuthorityId ||
      suffix.ownerBindingDefinitionAuthorityId !==
        site.ownerBindingDefinitionAuthorityId ||
      suffix.referencedBindingDefinitionAuthorityId !==
        site.referencedBindingDefinitionAuthorityId ||
      suffix.manifestId !==
        site.manifestId ||
      suffix.manifestCode !==
        site.manifestCode ||
      suffix.ownerBindingName !==
        site.ownerBindingName ||
      suffix.referencedBindingName !==
        site.referencedBindingName ||
      suffix.referencePath !==
        site.leafPath ||
      suffix.referenceExpression !==
        site.leftReferenceExpression ||
      suffix.runtimeSuffix !==
        '.pos'
    ) {
      blockingReasons.push(
        `token_pos_operand_site:${key}:exact_identity_mismatch`,
      );

      continue;
    }


    consumedSuffixKeys.add(
      key,
    );


    const operandLabel =
      site.rightOperandSnapshot;


    candidates.push({
      id: [
        'runtime-token-pos-string-operand-compatibility-v1',
        idPart(
          site.whereReferenceRootAuthorityId,
        ),
        idPart(
          site.leafPath,
        ),
        idPart(
          site.leftReferenceExpression,
        ),
      ].join(':'),

      status:
        'candidate',

      leftRightSiteAuthorityId:
        site.id,

      tokenPosSuffixCompatibilityId:
        suffix.id,

      whereReferenceRootAuthorityId:
        site.whereReferenceRootAuthorityId,

      whereShapeAuthorityId:
        site.whereShapeAuthorityId,

      ownerBindingDefinitionAuthorityId:
        site.ownerBindingDefinitionAuthorityId,

      referencedBindingDefinitionAuthorityId:
        site.referencedBindingDefinitionAuthorityId,

      manifestId:
        site.manifestId,

      manifestCode:
        site.manifestCode,

      ownerBindingName:
        site.ownerBindingName,

      referencedBindingName:
        site.referencedBindingName,

      referenceSiteKey:
        key,

      referencePath:
        site.leafPath,

      referenceExpression:
        site.leftReferenceExpression,

      runtimeSuffix:
        '.pos',

      entityCompatibilityId:
        suffix.entityCompatibilityId,

      runtimeEntityLabel:
        suffix.runtimeEntityLabel,

      canonicalNodeType:
        'token',

      tokenPosCapabilityId:
        suffix.tokenPosCapabilityId,

      canonicalPropertyDomain:
        'canonical_token_occurrence',

      canonicalPropertyKind:
        'pos_hypothesis_set',

      operatorLabelOpaque:
        site.operatorLabelOpaque,

      rightOperandStructuralKind:
        'string',

      posLabelInputOpaque:
        operandLabel,

      governance: {
        exactLeftRightSiteAuthorityRequired:
          true,

        exactTokenPosSuffixCompatibilityRequired:
          true,

        exactReferenceRootAuthorityIdentityMatch:
          true,

        exactWhereShapeAuthorityIdentityMatch:
          true,

        exactOwnerBindingIdentityMatch:
          true,

        exactReferencedBindingIdentityMatch:
          true,

        exactManifestIdentityMatch:
          true,

        exactBindingNameMatch:
          true,

        exactReferencePathMatch:
          true,

        exactReferenceExpressionMatch:
          true,

        exactReferenceSiteKeyMatch:
          true,

        exactRuntimePosSuffixRequired:
          true,

        exactCanonicalTokenCompatibilityRequired:
          true,

        exactTokenPosHypothesisSetCapabilityRequired:
          true,

        stringRightOperandRequired:
          true,

        stringOperandPreservedOpaque:
          true,

        posLabelInputCompatibilityOnly:
          true,

        operatorLabelPreservedOpaque:
          true,

        nonStringOperandRejectedByThisCapability:
          true,

        posVocabularyValidated:
          false,

        operandKnownCanonicalPosLabel:
          false,

        operandNormalizationPerformed:
          false,

        caseFoldingPerformed:
          false,

        operatorSemanticsResolved:
          false,

        whereEqExecuted:
          false,

        posHypothesisRead:
          false,

        posHypothesisSelected:
          false,

        posLabelCompared:
          false,

        comparisonPerformed:
          false,

        comparisonTruthResolved:
          false,

        learnerErrorClassified:
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


  if (
    blockingReasons.length >
      0
  ) {
    return blockedResult(
      blockingReasons,
    );
  }


  candidates.sort(
    (a, b) =>
      a.id.localeCompare(
        b.id,
      ),
  );


  const tokenPosSuffixCandidatesWithoutStringOperandSiteKeys =
    [...posSuffixByReferenceSiteKey.keys()]
      .filter(
        (key) =>
          !consumedSuffixKeys.has(
            key,
          ),
      )
      .sort();


  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_STRING_OPERAND_COMPATIBILITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    candidates,

    consideredTokenPosLeftRightSiteCount,

    unsupportedOperandSiteIds:
      unique(
        unsupportedOperandSiteIds,
      ),

    unmatchedStringOperandSiteIds:
      unique(
        unmatchedStringOperandSiteIds,
      ),

    tokenPosSuffixCandidatesWithoutStringOperandSiteKeys,

    blockingReasons:
      [],
  };
}