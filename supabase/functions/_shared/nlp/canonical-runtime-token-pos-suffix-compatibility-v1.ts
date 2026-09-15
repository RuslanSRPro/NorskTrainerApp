// Norsk Trainer — Runtime Token POS Suffix Compatibility V1
//
// v1.46 A3.3.2c
//
// Purpose:
//
//   A3.3.1 exact rooted Runtime where reference
//       +
//   A3.1 independently-proven binding entity compatibility
//       +
//   A3.3.2b canonical token POS property capability
//       ->
//   candidate compatibility between exact Runtime token ".pos"
//   reference shape and the canonical token POS hypothesis-set property.
//
// This layer opens ONLY:
//
//   rooted binding
//       + opaque suffix ".pos"
//       + exact A3.1 canonical node compatibility = token
//       + proven canonical token POS property capability
//
// It does NOT:
// - execute a where operator;
// - inspect or compare the right operand;
// - select a POS hypothesis;
// - collapse a POS hypothesis set into a scalar;
// - enumerate Runtime occurrences;
// - execute clause/sentence/phrase scope;
// - infer phrase-head POS;
// - assign semantics to Runtime entity "candidate";
// - create graph edges.

import {
  CANONICAL_RUNTIME_BINDING_ENTITY_COMPATIBILITY_V1,
  type CanonicalRuntimeBindingEntityCompatibilityResultV1,
  type CanonicalRuntimeBindingEntityCompatibilityV1,
} from './canonical-runtime-binding-entity-compatibility-v1.ts';

import {
  CANONICAL_RUNTIME_BINDING_WHERE_REFERENCE_ROOT_AUTHORITY_V1,
  type CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1,
  type CanonicalRuntimeBindingWhereReferenceRootAuthorityV1,
  type CanonicalRuntimeWhereReferenceRootSiteV1,
} from './canonical-runtime-binding-where-reference-root-authority-v1.ts';

import {
  CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1,
  type CanonicalTokenPosPropertyCapabilityResultV1,
  type CanonicalTokenPosPropertyCapabilityV1,
} from './canonical-token-pos-property-capability-v1.ts';


export const CANONICAL_RUNTIME_TOKEN_POS_SUFFIX_COMPATIBILITY_V1 =
  'canonical_runtime_token_pos_suffix_compatibility_v1';


export type CanonicalRuntimeTokenPosSuffixCompatibilityV1 = {
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

  governance: {
    exactWhereReferenceRootAuthorityRequired:
      true;

    exactEntityCompatibilityAuthorityRequired:
      true;

    exactTokenPosCapabilityRequired:
      true;

    exactOpaqueSuffixMatch:
      true;

    rootedBindingIdentityPreserved:
      true;

    entityCompatibilityConsumedNotReconstructed:
      true;

    tokenPosCapabilityConsumedNotReconstructed:
      true;

    compatibilityOnly:
      true;

    candidateOnly:
      true;

    runtimeCandidatePosMapped:
      false;

    runtimePhrasePosMapped:
      false;

    propertyValueIsScalar:
      false;

    propertyValueIsHypothesisSet:
      true;

    posHypothesisSelected:
      false;

    rightOperandRead:
      false;

    rightOperandCompared:
      false;

    operatorSemanticsResolved:
      false;

    whereEqExecuted:
      false;

    referenceValueResolved:
      false;

    dottedReferenceTraversalPerformed:
      false;

    occurrenceEnumerationPerformed:
      false;

    runtimeScopeExecutionPerformed:
      false;

    clauseContainmentResolved:
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

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalRuntimeTokenPosSuffixCompatibilityResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_TOKEN_POS_SUFFIX_COMPATIBILITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  candidates:
    CanonicalRuntimeTokenPosSuffixCompatibilityV1[];

  consideredPosReferenceSiteCount:
    number;

  unmappedPosReferenceSiteKeys:
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
  authority:
    CanonicalRuntimeBindingWhereReferenceRootAuthorityV1,

  site:
    CanonicalRuntimeWhereReferenceRootSiteV1,
): string {
  return [
    authority.id,
    site.path,
    site.referenceExpression,
  ].join('#');
}


function safeEntityCandidate(
  candidate:
    CanonicalRuntimeBindingEntityCompatibilityV1,
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
        candidate.bindingDefinitionAuthorityId,
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
        candidate.bindingName,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.runtimeEntityLabel,
      ),
    ) &&

    Boolean(
      stringValue(
        candidate.canonicalNodeTypeAuthorityId,
      ),
    ) &&

    g.exactBindingDefinitionAuthorityRequired ===
      true &&

    g.exactCanonicalNodeTypeAuthorityRequired ===
      true &&

    g.exactOpaqueLabelMatch ===
      true &&

    g.runtimeEntityVocabularyHardcoded ===
      false &&

    g.canonicalNodeTypeInferredFromName ===
      false &&

    g.entitySemanticsResolved ===
      false &&

    g.occurrenceDomainResolved ===
      false &&

    g.occurrenceEnumerationPerformed ===
      false &&

    g.scopeSemanticsResolved ===
      false &&

    g.whereSemanticsResolved ===
      false &&

    g.cardinalitySemanticsResolved ===
      false &&

    g.occurrenceBindingPerformed ===
      false &&

    g.canonicalEdgeGenerated ===
      false &&

    g.complementArgumentAttachmentResolved ===
      false &&

    g.realizesSlotGenerated ===
      false &&

    g.compatibilityOnly ===
      true &&

    g.candidateOnly ===
      true &&

    g.frozenGrammarReadOnly ===
      true
  );
}


function safeRootAuthority(
  authority:
    CanonicalRuntimeBindingWhereReferenceRootAuthorityV1,
): boolean {
  const g =
    authority.governance;


  if (
    authority.status !==
      'candidate' ||

    !stringValue(
      authority.id,
    ) ||

    !stringValue(
      authority.whereShapeAuthorityId,
    ) ||

    !stringValue(
      authority.bindingDefinitionAuthorityId,
    ) ||

    !stringValue(
      authority.manifestId,
    ) ||

    !stringValue(
      authority.manifestCode,
    ) ||

    !stringValue(
      authority.bindingName,
    ) ||

    g.exactWhereShapeAuthorityRequired !==
      true ||

    g.exactBindingDefinitionSetRequired !==
      true ||

    g.manifestLocalBindingRootsOnly !==
      true ||

    g.longestExactBindingPrefixWins !==
      true ||

    g.referenceExpressionPreserved !==
      true ||

    g.opaqueSuffixPreserved !==
      true ||

    g.runtimeBindingVocabularyHardcoded !==
      false ||

    g.dottedReferenceTraversalPerformed !==
      false ||

    g.suffixSemanticsResolved !==
      false ||

    g.referenceValueResolved !==
      false ||

    g.operatorSemanticsResolved !==
      false ||

    g.canonicalFactOwnershipResolved !==
      false ||

    g.graphTraversalPerformed !==
      false ||

    g.occurrenceEnumerationPerformed !==
      false ||

    g.runtimeScopeExecutionPerformed !==
      false ||

    g.cardinalityEnforcementPerformed !==
      false ||

    g.occurrenceBindingPerformed !==
      false ||

    g.canonicalDependencyEdgeGenerated !==
      false ||

    g.realizesSlotGenerated !==
      false ||

    g.candidateOnly !==
      true ||

    g.frozenGrammarReadOnly !==
      true
  ) {
    return false;
  }


  for (
    const site of
      authority.referenceSites
  ) {
    if (
      !stringValue(
        site.path,
      ) ||
      !stringValue(
        site.referenceExpression,
      )
    ) {
      return false;
    }


    if (
      site.rootStatus ===
        'unrooted'
    ) {
      if (
        site.rootBindingAuthorityId !==
          null ||
        site.rootBindingName !==
          null ||
        site.opaqueSuffix !==
          null
      ) {
        return false;
      }


      continue;
    }


    if (
      !stringValue(
        site.rootBindingAuthorityId,
      ) ||
      !stringValue(
        site.rootBindingName,
      )
    ) {
      return false;
    }


    if (
      site.rootStatus ===
        'exact_binding'
    ) {
      if (
        site.opaqueSuffix !==
          null
      ) {
        return false;
      }


      continue;
    }


    if (
      !stringValue(
        site.opaqueSuffix,
      )
    ) {
      return false;
    }
  }


  return true;
}


function safeTokenPosCapability(
  capability:
    CanonicalTokenPosPropertyCapabilityV1,
): boolean {
  const g =
    capability.governance;


  return (
    capability.status ===
      'proven' &&

    Boolean(
      stringValue(
        capability.capabilityId,
      ),
    ) &&

    capability.propertyDomain ===
      'canonical_token_occurrence' &&

    capability.propertyKind ===
      'pos_hypothesis_set' &&

    capability.factNodeType ===
      'lexical_reading' &&

    capability.factNodeSubtype ===
      'pos_candidate' &&

    capability.factLabelFeature ===
      'pos' &&

    capability.occurrenceRelation ===
      'pos_of' &&

    capability.occurrenceRelationDirection ===
      'pos_candidate_to_token' &&

    g.groundedInCanonicalPosOwnershipV1 ===
      true &&

    g.posModel ===
      'POS-A' &&

    g.tokenOccurrenceIsPropertyOwner ===
      true &&

    g.posFactIsSeparateReadingNode ===
      true &&

    g.propertyValueIsScalar ===
      false &&

    g.propertyValueIsHypothesisSet ===
      true &&

    g.zeroHypothesesAllowed ===
      true &&

    g.multipleHypothesesAllowed ===
      true &&

    g.candidateHypothesisIsResolvedValue ===
      false &&

    g.alternativeWinnerMustBeExplicit ===
      true &&

    g.firstCandidateWins ===
      false &&

    g.runtimePosSuffixMapped ===
      false &&

    g.runtimeCandidateEntityResolved ===
      false &&

    g.phrasePosInheritedFromHead ===
      false &&

    g.whereEqExecuted ===
      false &&

    g.referenceValueResolved ===
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

    g.realizesSlotGenerated ===
      false &&

    g.graphMutationPerformed ===
      false &&

    g.frozenGrammarReadOnly ===
      true
  );
}


export function deriveCanonicalRuntimeTokenPosSuffixCompatibilitiesV1(
  rootResult:
    CanonicalRuntimeBindingWhereReferenceRootAuthorityResultV1,

  entityCompatibilityResult:
    CanonicalRuntimeBindingEntityCompatibilityResultV1,

  tokenPosCapabilityResult:
    CanonicalTokenPosPropertyCapabilityResultV1,
): CanonicalRuntimeTokenPosSuffixCompatibilityResultV1 {
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
      'where_reference_root_result:not_exact_ready_authority',
    );
  }


  if (
    entityCompatibilityResult.producer !==
      CANONICAL_RUNTIME_BINDING_ENTITY_COMPATIBILITY_V1 ||
    entityCompatibilityResult.producerVersion !==
      '1' ||
    entityCompatibilityResult.status !==
      'ready' ||
    entityCompatibilityResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      'entity_compatibility_result:not_exact_ready_authority',
    );
  }


  if (
    tokenPosCapabilityResult.producer !==
      CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1 ||
    tokenPosCapabilityResult.producerVersion !==
      '1' ||
    tokenPosCapabilityResult.status !==
      'ready' ||
    tokenPosCapabilityResult.blockingReasons.length !==
      0 ||
    !tokenPosCapabilityResult.capability ||
    !safeTokenPosCapability(
      tokenPosCapabilityResult.capability,
    )
  ) {
    blockingReasons.push(
      'token_pos_capability_result:not_exact_ready_capability',
    );
  }


  const seenRootIds =
    new Set<
      string
    >();


  for (
    const authority of
      rootResult.authorities
  ) {
    if (
      seenRootIds.has(
        authority.id,
      )
    ) {
      blockingReasons.push(
        `where_reference_root:${authority.id}:duplicate`,
      );
    }


    seenRootIds.add(
      authority.id,
    );


    if (
      !safeRootAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `where_reference_root:${authority.id}:unsafe_contract`,
      );
    }
  }


  const seenEntityCandidateIds =
    new Set<
      string
    >();


  for (
    const candidate of
      entityCompatibilityResult.candidates
  ) {
    if (
      seenEntityCandidateIds.has(
        candidate.id,
      )
    ) {
      blockingReasons.push(
        `entity_compatibility:${candidate.id}:duplicate`,
      );
    }


    seenEntityCandidateIds.add(
      candidate.id,
    );


    if (
      !safeEntityCandidate(
        candidate,
      )
    ) {
      blockingReasons.push(
        `entity_compatibility:${candidate.id}:unsafe_contract`,
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
        CANONICAL_RUNTIME_TOKEN_POS_SUFFIX_COMPATIBILITY_V1,

      producerVersion:
        '1',

      status:
        'blocked',

      candidates:
        [],

      consideredPosReferenceSiteCount:
        0,

      unmappedPosReferenceSiteKeys:
        [],

      blockingReasons:
        reasons,
    };
  }


  const capability =
    tokenPosCapabilityResult.capability!;


  const candidates:
    CanonicalRuntimeTokenPosSuffixCompatibilityV1[] =
      [];

  const unmappedPosReferenceSiteKeys:
    string[] = [];

  let consideredPosReferenceSiteCount =
    0;


  for (
    const rootAuthority of
      [...rootResult.authorities].sort(
        (a, b) =>
          a.id.localeCompare(
            b.id,
          ),
      )
  ) {
    for (
      const site of
        [...rootAuthority.referenceSites].sort(
          (a, b) =>
            a.path.localeCompare(
              b.path,
            ) ||
            a.referenceExpression.localeCompare(
              b.referenceExpression,
            ),
        )
    ) {
      if (
        site.rootStatus !==
          'binding_prefix_with_opaque_suffix' ||
        site.opaqueSuffix !==
          '.pos' ||
        !site.rootBindingAuthorityId ||
        !site.rootBindingName
      ) {
        continue;
      }


      consideredPosReferenceSiteCount +=
        1;


      const siteKey =
        referenceSiteKey(
          rootAuthority,
          site,
        );


      const exactTokenMatches =
        entityCompatibilityResult.candidates
          .filter(
            (candidate) =>
              candidate.bindingDefinitionAuthorityId ===
                site.rootBindingAuthorityId &&

              candidate.manifestId ===
                rootAuthority.manifestId &&

              candidate.manifestCode ===
                rootAuthority.manifestCode &&

              candidate.bindingName ===
                site.rootBindingName &&

              candidate.canonicalNodeType ===
                'token',
          )
          .sort(
            (a, b) =>
              a.id.localeCompare(
                b.id,
              ),
          );


      if (
        exactTokenMatches.length >
          1
      ) {
        return {
          producer:
            CANONICAL_RUNTIME_TOKEN_POS_SUFFIX_COMPATIBILITY_V1,

          producerVersion:
            '1',

          status:
            'blocked',

          candidates:
            [],

          consideredPosReferenceSiteCount,

          unmappedPosReferenceSiteKeys:
            [],

          blockingReasons: [
            `reference_site:${siteKey}:ambiguous_token_entity_compatibility`,
          ],
        };
      }


      const entityCompatibility =
        exactTokenMatches[0];


      if (!entityCompatibility) {
        unmappedPosReferenceSiteKeys.push(
          siteKey,
        );

        continue;
      }


      candidates.push({
        id: [
          'runtime-token-pos-suffix-compatibility-v1',
          idPart(
            rootAuthority.id,
          ),
          idPart(
            site.path,
          ),
          idPart(
            site.referenceExpression,
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

        referencedBindingDefinitionAuthorityId:
          site.rootBindingAuthorityId,

        manifestId:
          rootAuthority.manifestId,

        manifestCode:
          rootAuthority.manifestCode,

        ownerBindingName:
          rootAuthority.bindingName,

        referencedBindingName:
          site.rootBindingName,

        referenceSiteKey:
          siteKey,

        referencePath:
          site.path,

        referenceExpression:
          site.referenceExpression,

        runtimeSuffix:
          '.pos',

        entityCompatibilityId:
          entityCompatibility.id,

        runtimeEntityLabel:
          entityCompatibility.runtimeEntityLabel,

        canonicalNodeType:
          'token',

        tokenPosCapabilityId:
          capability.capabilityId,

        canonicalPropertyDomain:
          capability.propertyDomain,

        canonicalPropertyKind:
          capability.propertyKind,

        governance: {
          exactWhereReferenceRootAuthorityRequired:
            true,

          exactEntityCompatibilityAuthorityRequired:
            true,

          exactTokenPosCapabilityRequired:
            true,

          exactOpaqueSuffixMatch:
            true,

          rootedBindingIdentityPreserved:
            true,

          entityCompatibilityConsumedNotReconstructed:
            true,

          tokenPosCapabilityConsumedNotReconstructed:
            true,

          compatibilityOnly:
            true,

          candidateOnly:
            true,

          runtimeCandidatePosMapped:
            false,

          runtimePhrasePosMapped:
            false,

          propertyValueIsScalar:
            false,

          propertyValueIsHypothesisSet:
            true,

          posHypothesisSelected:
            false,

          rightOperandRead:
            false,

          rightOperandCompared:
            false,

          operatorSemanticsResolved:
            false,

          whereEqExecuted:
            false,

          referenceValueResolved:
            false,

          dottedReferenceTraversalPerformed:
            false,

          occurrenceEnumerationPerformed:
            false,

          runtimeScopeExecutionPerformed:
            false,

          clauseContainmentResolved:
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

          frozenGrammarReadOnly:
            true,
        },
      });
    }
  }


  candidates.sort(
    (a, b) =>
      a.id.localeCompare(
        b.id,
      ),
  );


  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_SUFFIX_COMPATIBILITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    candidates,

    consideredPosReferenceSiteCount,

    unmappedPosReferenceSiteKeys:
      unique(
        unmappedPosReferenceSiteKeys,
      ),

    blockingReasons:
      [],
  };
}