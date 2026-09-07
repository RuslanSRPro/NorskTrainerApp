// Norsk Trainer — Canonical Token POS Property Capability V1
//
// v1.46 A3.3.2b
//
// Purpose:
//
//   proven POS-A ownership model
//       ->
//   canonical TOKEN -> POS-HYPOTHESIS property capability.
//
// This is a TYPE-LEVEL capability.
//
// Canonical model:
//
//   token occurrence
//       <-pos_of-
//   lexical_reading(subtype=pos_candidate)
//       features.pos = opaque POS label
//
// Important:
//
//   token POS is NOT modeled here as one scalar value.
//
// A token may have:
//   zero POS hypotheses,
//   one unresolved POS hypothesis,
//   multiple competing POS hypotheses,
//   or a separately resolved alternative winner.
//
// This layer does NOT:
// - map Runtime IR ".pos";
// - execute eq;
// - choose one POS candidate;
// - enumerate Runtime bindings;
// - execute scope/cardinality;
// - infer phrase-head POS;
// - assign semantics to Runtime entity "candidate".

import {
  CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1,
  type CanonicalPosFactOwnershipAuthorityResultV1,
  type CanonicalPosFactOwnershipAuthorityV1,
} from './canonical-pos-fact-ownership-authority-v1.ts';


export const CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1 =
  'canonical_token_pos_property_capability_v1';


export type CanonicalTokenPosPropertyCapabilityV1 = {
  capabilityId:
    string;

  status:
    'proven';

  propertyDomain:
    'canonical_token_occurrence';

  propertyKind:
    'pos_hypothesis_set';

  factNodeType:
    'lexical_reading';

  factNodeSubtype:
    'pos_candidate';

  factLabelFeature:
    'pos';

  occurrenceRelation:
    'pos_of';

  occurrenceRelationDirection:
    'pos_candidate_to_token';

  governance: {
    groundedInCanonicalPosOwnershipV1:
      true;

    posModel:
      'POS-A';

    tokenOccurrenceIsPropertyOwner:
      true;

    posFactIsSeparateReadingNode:
      true;

    propertyValueIsScalar:
      false;

    propertyValueIsHypothesisSet:
      true;

    zeroHypothesesAllowed:
      true;

    multipleHypothesesAllowed:
      true;

    candidateHypothesisIsResolvedValue:
      false;

    alternativeWinnerMustBeExplicit:
      true;

    firstCandidateWins:
      false;

    rawSurfaceSpellingRead:
      false;

    lexicalSourcePosUsedAsAuthority:
      false;

    runtimePosSuffixMapped:
      false;

    runtimeCandidateEntityResolved:
      false;

    phrasePosInheritedFromHead:
      false;

    whereEqExecuted:
      false;

    referenceValueResolved:
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

    realizesSlotGenerated:
      false;

    graphMutationPerformed:
      false;

    frozenGrammarReadOnly:
      true;
  };
};


export type CanonicalTokenPosPropertyCapabilityResultV1 = {
  producer:
    typeof CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1;

  producerVersion:
    '1';

  status:
    | 'ready'
    | 'blocked';

  capability?:
    CanonicalTokenPosPropertyCapabilityV1;

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


function safePosAuthority(
  authority:
    CanonicalPosFactOwnershipAuthorityV1,
): boolean {
  const g =
    authority.governance;


  return (
    authority.status ===
      'proven' &&

    authority.model ===
      'POS-A' &&

    Boolean(
      stringValue(
        authority.authorityId,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.posReadingNodeId,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.posLabel,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.tokenNodeId,
      ),
    ) &&

    Boolean(
      stringValue(
        authority.posOfEdgeId,
      ),
    ) &&

    g.exactCanonicalPosRepresentation ===
      true &&

    g.posModel ===
      'POS-A' &&

    g.posFactNodeType ===
      'lexical_reading' &&

    g.posFactSubtype ===
      'pos_candidate' &&

    g.posLabelOwnedByNodeFeature ===
      true &&

    g.exactOccurrenceOwnershipUsesPosOfEdge ===
      true &&

    g.posOfDirection ===
      'pos_candidate_to_token' &&

    g.sourcePosIsEvidenceNotAuthority ===
      true &&

    g.alternativeDomainIsTokenLocal ===
      true &&

    g.multiplePosCandidatesMayCoexist ===
      true &&

    g.underlyingGraphStatusPreserved ===
      true &&

    g.candidateDoesNotMeanResolved ===
      true &&

    g.resolvedAlternativeWinnerNotInferred ===
      true &&

    g.runtimePosSuffixMapped ===
      false &&

    g.whereEqExecuted ===
      false &&

    g.rawSurfaceSpellingRead ===
      false &&

    g.firstCandidateWins ===
      false &&

    g.occurrenceEnumerationPerformed ===
      false &&

    g.occurrenceBindingPerformed ===
      false &&

    g.graphMutationPerformed ===
      false &&

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


export function deriveCanonicalTokenPosPropertyCapabilityV1(
  posOwnershipResult:
    CanonicalPosFactOwnershipAuthorityResultV1,
): CanonicalTokenPosPropertyCapabilityResultV1 {
  const blockingReasons:
    string[] = [];


  if (
    posOwnershipResult.producer !==
      CANONICAL_POS_FACT_OWNERSHIP_AUTHORITY_V1
  ) {
    blockingReasons.push(
      'pos_ownership_result:unexpected_producer',
    );
  }


  if (
    posOwnershipResult.producerVersion !==
      '1'
  ) {
    blockingReasons.push(
      'pos_ownership_result:unexpected_version',
    );
  }


  if (
    posOwnershipResult.status !==
      'ready'
  ) {
    blockingReasons.push(
      'pos_ownership_result:not_ready',
    );
  }


  if (
    posOwnershipResult.blockingReasons.length !==
      0
  ) {
    blockingReasons.push(
      'pos_ownership_result:contains_blocking_reasons',
    );
  }


  const seenAuthorityIds =
    new Set<
      string
    >();

  const seenPosReadingIds =
    new Set<
      string
    >();


  for (
    const authority of
      posOwnershipResult.authorities
  ) {
    if (
      seenAuthorityIds.has(
        authority.authorityId,
      )
    ) {
      blockingReasons.push(
        `pos_authority:${authority.authorityId}:duplicate_authority_id`,
      );
    }


    seenAuthorityIds.add(
      authority.authorityId,
    );


    if (
      seenPosReadingIds.has(
        authority.posReadingNodeId,
      )
    ) {
      blockingReasons.push(
        `pos_reading:${authority.posReadingNodeId}:duplicate_fact_identity`,
      );
    }


    seenPosReadingIds.add(
      authority.posReadingNodeId,
    );


    if (
      !safePosAuthority(
        authority,
      )
    ) {
      blockingReasons.push(
        `pos_authority:${authority.authorityId}:unsafe_contract`,
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
        CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1,

      producerVersion:
        '1',

      status:
        'blocked',

      blockingReasons:
        reasons,
    };
  }


  return {
    producer:
      CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1,

    producerVersion:
      '1',

    status:
      'ready',

    capability: {
      capabilityId:
        'canonical-token-pos-property:pos-a:v1',

      status:
        'proven',

      propertyDomain:
        'canonical_token_occurrence',

      propertyKind:
        'pos_hypothesis_set',

      factNodeType:
        'lexical_reading',

      factNodeSubtype:
        'pos_candidate',

      factLabelFeature:
        'pos',

      occurrenceRelation:
        'pos_of',

      occurrenceRelationDirection:
        'pos_candidate_to_token',

      governance: {
        groundedInCanonicalPosOwnershipV1:
          true,

        posModel:
          'POS-A',

        tokenOccurrenceIsPropertyOwner:
          true,

        posFactIsSeparateReadingNode:
          true,

        propertyValueIsScalar:
          false,

        propertyValueIsHypothesisSet:
          true,

        zeroHypothesesAllowed:
          true,

        multipleHypothesesAllowed:
          true,

        candidateHypothesisIsResolvedValue:
          false,

        alternativeWinnerMustBeExplicit:
          true,

        firstCandidateWins:
          false,

        rawSurfaceSpellingRead:
          false,

        lexicalSourcePosUsedAsAuthority:
          false,

        runtimePosSuffixMapped:
          false,

        runtimeCandidateEntityResolved:
          false,

        phrasePosInheritedFromHead:
          false,

        whereEqExecuted:
          false,

        referenceValueResolved:
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

        realizesSlotGenerated:
          false,

        graphMutationPerformed:
          false,

        frozenGrammarReadOnly:
          true,
      },
    },

    blockingReasons:
      [],
  };
}