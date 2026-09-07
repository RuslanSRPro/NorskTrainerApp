// Norsk Trainer — Canonical Runtime Manifest Token POS Suffix Property Compatibility V1
//
// v1.46 A4.6b2
//
// Purpose:
//
//   exact family-neutral A4.6a2b rooted leaf/right-operand site
//       +
//   exact family-neutral referenced-binding entity compatibility
//       +
//   exact canonical token POS property capability
//       ->
//   candidate compatibility between Runtime suffix ".pos" and the
//   canonical token POS hypothesis-set PROPERTY KIND.
//
// This layer proves compatibility only. It does NOT:
// - bind the Runtime reference site to a token occurrence;
// - resolve canonical POS fact ownership for that site;
// - read or select POS hypotheses;
// - inspect or compare the right operand;
// - execute WHERE/operator truth;
// - traverse ".pos" as a JavaScript property;
// - execute scope/cardinality;
// - mutate the graph;
// - classify learner error.

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityResultV1,
  type CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityV1,
} from "./canonical-runtime-manifest-binding-where-leaf-right-operand-site-authority-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_V1,
  CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_VERSION_V1,
  type CanonicalRuntimeManifestBindingEntityCompatibilityResultV1,
  type CanonicalRuntimeManifestBindingEntityCompatibilityV1,
} from "./canonical-runtime-manifest-binding-entity-compatibility-v1.ts";

import {
  CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1,
  type CanonicalTokenPosPropertyCapabilityResultV1,
  type CanonicalTokenPosPropertyCapabilityV1,
} from "./canonical-token-pos-property-capability-v1.ts";

export const CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1 =
  "canonical_runtime_manifest_token_pos_suffix_property_compatibility_v1";

export const CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1 =
  "1";

export type CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1 = {
  id: string;
  status: "candidate";

  leafRightOperandSiteAuthorityId: string;
  referenceRootAuthorityId: string;
  referenceExpressionAuthorityId: string;
  whereShapeAuthorityId: string;

  ownerBindingDefinitionAuthorityId: string;
  manifestId: string;
  manifestCode: string;
  ownerBindingName: string;

  referencedBindingDefinitionAuthorityId: string;
  referencedBindingName: string;

  leafPath: string;
  operatorLabelOpaque: string;
  leftReferenceExpression: string;

  runtimeSuffix: ".pos";

  entityCompatibilityId: string;
  runtimeEntityLabel: string;
  canonicalNodeType: "token";
  canonicalNodeTypeAuthorityId: string;

  canonicalPropertyCapabilityId: string;
  canonicalPropertyDomain: "canonical_token_occurrence";
  canonicalPropertyKind: "pos_hypothesis_set";
  canonicalFactNodeType: "lexical_reading";
  canonicalFactNodeSubtype: "pos_candidate";
  canonicalFactLabelFeature: "pos";

  rightOperandSnapshot: unknown;

  governance: {
    exactA46a2bResultRequired: true;
    exactA46a2bAuthorityRequired: true;

    exactEntityCompatibilityResultRequired: true;
    exactEntityCompatibilityAuthorityRequired: true;

    exactTokenPosPropertyCapabilityResultRequired: true;
    exactTokenPosPropertyCapabilityRequired: true;

    referencedBindingIdentityMatchRequired: true;
    ownerBindingExcludedFromEntityJoin: true;

    exactOpaqueSuffixMatch: true;
    exactCanonicalTokenCompatibilityRequired: true;
    rootedBindingIdentityPreserved: true;

    entityCompatibilityConsumedNotReconstructed: true;
    tokenPosCapabilityConsumedNotReconstructed: true;

    compatibilityOnly: true;
    candidateOnly: true;

    rightOperandSnapshotPreserved: true;
    rightOperandSnapshotDetached: true;

    runtimeCandidatePosMapped: false;
    runtimePhrasePosMapped: false;

    propertyValueIsScalar: false;
    propertyValueIsHypothesisSet: true;
    posHypothesisSelected: false;

    rightOperandRead: false;
    rightOperandCompared: false;

    operatorSemanticsResolved: false;
    whereEqExecuted: false;
    referenceValueResolved: false;
    dottedReferenceTraversalPerformed: false;

    canonicalFactOwnershipResolved: false;
    occurrenceEnumerationPerformed: false;
    occurrenceBindingPerformed: false;
    runtimeScopeExecutionPerformed: false;
    sentenceMembershipResolved: false;
    clauseContainmentResolved: false;
    cardinalityEnforcementPerformed: false;

    canonicalDependencyEdgeGenerated: false;
    grammaticalFunctionResolved: false;
    complementArgumentAttachmentResolved: false;
    realizesSlotGenerated: false;

    graphMutationPerformed: false;
    learnerErrorClassified: false;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1;
    producerVersion:
      typeof CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1;
    status: "ready" | "blocked";

    candidates: CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1[];

    consideredPosReferenceSiteCount: number;
    compatibleTokenEntitySiteCount: number;

    unmappedPosReferenceSiteKeys: string[];
    ignoredNonPosSuffixSiteKeys: string[];

    blockingReasons: string[];
  };

function present(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function cloneSnapshot<T>(value: T): T {
  return structuredClone(value);
}

function siteKey(
  site: CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityV1,
): string {
  return JSON.stringify([
    site.id,
    site.whereShapeAuthorityId,
    site.leafPath,
    site.referencedBindingDefinitionAuthorityId,
    site.referencedBindingName,
  ]);
}

function entityIdentity(
  candidate: CanonicalRuntimeManifestBindingEntityCompatibilityV1,
): string {
  return JSON.stringify([
    candidate.bindingDefinitionAuthorityId,
    candidate.manifestId,
    candidate.manifestCode,
    candidate.bindingName,
  ]);
}

function safeA46a2bAuthority(
  authority:
    CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityV1,
): boolean {
  const g = authority.governance as unknown as Record<string, unknown>;

  return (
    authority.status === "candidate" &&
    present(authority.id) &&
    present(authority.referenceRootAuthorityId) &&
    present(authority.referenceExpressionAuthorityId) &&
    present(authority.whereShapeAuthorityId) &&
    present(authority.ownerBindingDefinitionAuthorityId) &&
    present(authority.manifestId) &&
    present(authority.manifestCode) &&
    present(authority.ownerBindingName) &&
    present(authority.leafPath) &&
    present(authority.operatorLabelOpaque) &&
    present(authority.leftReferenceExpression) &&
    present(authority.referencedBindingDefinitionAuthorityId) &&
    present(authority.referencedBindingName) &&
    authority.hasRightOperand === true &&
    (
      authority.opaqueLeftSuffix === null ||
      present(authority.opaqueLeftSuffix)
    ) &&
    g.exactA46a1ResultRequired === true &&
    g.exactA46a1AuthorityRequired === true &&
    g.exactA46a2aResultRequired === true &&
    g.exactA46a2aAuthorityRequired === true &&
    g.sameWhereShapeAuthorityRequired === true &&
    g.sameOwnerBindingDefinitionAuthorityRequired === true &&
    g.sameManifestIdentityRequired === true &&
    g.sameOwnerBindingNameRequired === true &&
    g.sameLeafPathRequired === true &&
    g.sameOperatorLabelRequired === true &&
    g.rootedReferenceRequired === true &&
    g.referencedBindingIdentityRequired === true &&
    g.ownerBindingAndReferencedBindingKeptSeparate === true &&
    g.rightOperandPresenceRequired === true &&
    g.rightOperandSnapshotPreserved === true &&
    g.rightOperandSnapshotDetached === true &&
    g.leftReferenceExpressionPreserved === true &&
    g.opaqueLeftSuffixPreserved === true &&
    g.operatorLabelPreservedOpaque === true &&
    g.structuralSiteOnly === true &&
    g.unrootedReferenceExcluded === true &&
    g.unrootedReferenceIsDiagnostic === true &&
    g.rootedWithoutRightOperandIsDiagnostic === true &&
    g.rightOperandSemanticsResolved === false &&
    g.stringOperandMappedToPos === false &&
    g.operatorSemanticsResolved === false &&
    g.compoundSemanticsResolved === false &&
    g.compoundBooleanCompositionExecuted === false &&
    g.referenceSuffixSemanticsResolved === false &&
    g.dottedReferenceTraversalPerformed === false &&
    g.referenceValueResolved === false &&
    g.canonicalFactOwnershipResolved === false &&
    g.comparisonPerformed === false &&
    g.valueCoercionPerformed === false &&
    g.caseNormalizationPerformed === false &&
    g.occurrenceDomainResolved === false &&
    g.occurrenceEnumerationPerformed === false &&
    g.occurrenceFilteringPerformed === false &&
    g.occurrenceBindingPerformed === false &&
    g.sentenceMembershipResolved === false &&
    g.runtimeScopeExecutionPerformed === false &&
    g.cardinalitySemanticsResolved === false &&
    g.cardinalityEnforcementPerformed === false &&
    g.actionFamilySemanticsResolved === false &&
    g.roleSemanticsResolved === false &&
    g.grammaticalFunctionResolved === false &&
    g.subjectOfRelationInferred === false &&
    g.graphTraversalPerformed === false &&
    g.graphMutationPerformed === false &&
    g.learnerErrorClassified === false &&
    g.candidateOnly === true &&
    g.frozenGrammarReadOnly === true
  );
}

function safeEntityCandidate(
  candidate: CanonicalRuntimeManifestBindingEntityCompatibilityV1,
): boolean {
  const g = candidate.governance;

  return (
    candidate.status === "candidate" &&
    present(candidate.id) &&
    present(candidate.bindingDefinitionAuthorityId) &&
    present(candidate.manifestId) &&
    present(candidate.manifestCode) &&
    present(candidate.bindingName) &&
    present(candidate.runtimeEntityLabel) &&
    present(candidate.canonicalNodeType) &&
    present(candidate.canonicalNodeTypeAuthorityId) &&
    g.exactA43a1ResultRequired === true &&
    g.exactManifestBindingDefinitionAuthorityRequired === true &&
    g.exactCanonicalNodeTypeAuthorityRequired === true &&
    g.exactOpaqueLabelMatch === true &&
    g.runtimeEntityVocabularyHardcoded === false &&
    g.runtimeEntityLabelNormalized === false &&
    g.caseFoldingPerformed === false &&
    g.canonicalNodeTypeInferredFromBindingName === false &&
    g.canonicalNodeTypeAuthorityIdentityPreserved === true &&
    g.entitySemanticsResolved === false &&
    g.occurrenceDomainResolved === false &&
    g.occurrenceEnumerationPerformed === false &&
    g.occurrenceBindingPerformed === false &&
    g.scopeSemanticsResolved === false &&
    g.whereSemanticsResolved === false &&
    g.cardinalitySemanticsResolved === false &&
    g.actionFamilySemanticsResolved === false &&
    g.roleSemanticsResolved === false &&
    g.grammaticalFunctionResolved === false &&
    g.subjectOfRelationInferred === false &&
    g.winnerSelected === false &&
    g.graphMutationPerformed === false &&
    g.learnerErrorClassified === false &&
    g.compatibilityOnly === true &&
    g.candidateOnly === true &&
    g.frozenGrammarReadOnly === true
  );
}

function safeTokenPosCapability(
  capability: CanonicalTokenPosPropertyCapabilityV1,
): boolean {
  const g = capability.governance;

  return (
    capability.status === "proven" &&
    present(capability.capabilityId) &&
    capability.propertyDomain === "canonical_token_occurrence" &&
    capability.propertyKind === "pos_hypothesis_set" &&
    capability.factNodeType === "lexical_reading" &&
    capability.factNodeSubtype === "pos_candidate" &&
    capability.factLabelFeature === "pos" &&
    capability.occurrenceRelation === "pos_of" &&
    capability.occurrenceRelationDirection === "pos_candidate_to_token" &&
    g.groundedInCanonicalPosOwnershipV1 === true &&
    g.posModel === "POS-A" &&
    g.tokenOccurrenceIsPropertyOwner === true &&
    g.posFactIsSeparateReadingNode === true &&
    g.propertyValueIsScalar === false &&
    g.propertyValueIsHypothesisSet === true &&
    g.zeroHypothesesAllowed === true &&
    g.multipleHypothesesAllowed === true &&
    g.candidateHypothesisIsResolvedValue === false &&
    g.alternativeWinnerMustBeExplicit === true &&
    g.firstCandidateWins === false &&
    g.rawSurfaceSpellingRead === false &&
    g.lexicalSourcePosUsedAsAuthority === false &&
    g.runtimePosSuffixMapped === false &&
    g.runtimeCandidateEntityResolved === false &&
    g.phrasePosInheritedFromHead === false &&
    g.whereEqExecuted === false &&
    g.referenceValueResolved === false &&
    g.occurrenceEnumerationPerformed === false &&
    g.runtimeScopeExecutionPerformed === false &&
    g.clauseContainmentResolved === false &&
    g.cardinalityEnforcementPerformed === false &&
    g.occurrenceBindingPerformed === false &&
    g.canonicalDependencyEdgeGenerated === false &&
    g.realizesSlotGenerated === false &&
    g.graphMutationPerformed === false &&
    g.frozenGrammarReadOnly === true
  );
}

function governance(): CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1[
  "governance"
] {
  return {
    exactA46a2bResultRequired: true,
    exactA46a2bAuthorityRequired: true,

    exactEntityCompatibilityResultRequired: true,
    exactEntityCompatibilityAuthorityRequired: true,

    exactTokenPosPropertyCapabilityResultRequired: true,
    exactTokenPosPropertyCapabilityRequired: true,

    referencedBindingIdentityMatchRequired: true,
    ownerBindingExcludedFromEntityJoin: true,

    exactOpaqueSuffixMatch: true,
    exactCanonicalTokenCompatibilityRequired: true,
    rootedBindingIdentityPreserved: true,

    entityCompatibilityConsumedNotReconstructed: true,
    tokenPosCapabilityConsumedNotReconstructed: true,

    compatibilityOnly: true,
    candidateOnly: true,

    rightOperandSnapshotPreserved: true,
    rightOperandSnapshotDetached: true,

    runtimeCandidatePosMapped: false,
    runtimePhrasePosMapped: false,

    propertyValueIsScalar: false,
    propertyValueIsHypothesisSet: true,
    posHypothesisSelected: false,

    rightOperandRead: false,
    rightOperandCompared: false,

    operatorSemanticsResolved: false,
    whereEqExecuted: false,
    referenceValueResolved: false,
    dottedReferenceTraversalPerformed: false,

    canonicalFactOwnershipResolved: false,
    occurrenceEnumerationPerformed: false,
    occurrenceBindingPerformed: false,
    runtimeScopeExecutionPerformed: false,
    sentenceMembershipResolved: false,
    clauseContainmentResolved: false,
    cardinalityEnforcementPerformed: false,

    canonicalDependencyEdgeGenerated: false,
    grammaticalFunctionResolved: false,
    complementArgumentAttachmentResolved: false,
    realizesSlotGenerated: false,

    graphMutationPerformed: false,
    learnerErrorClassified: false,

    frozenGrammarReadOnly: true,
  };
}

function blocked(
  reasons: readonly string[],
): CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1,
    status: "blocked",
    candidates: [],
    consideredPosReferenceSiteCount: 0,
    compatibleTokenEntitySiteCount: 0,
    unmappedPosReferenceSiteKeys: [],
    ignoredNonPosSuffixSiteKeys: [],
    blockingReasons: uniqueSorted(reasons),
  };
}

export function deriveCanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilitiesV1(
  siteResult:
    CanonicalRuntimeManifestBindingWhereLeafRightOperandSiteAuthorityResultV1,
  entityCompatibilityResult:
    CanonicalRuntimeManifestBindingEntityCompatibilityResultV1,
  tokenPosCapabilityResult: CanonicalTokenPosPropertyCapabilityResultV1,
): CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityResultV1 {
  const blockingReasons: string[] = [];

  if (
    siteResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_V1 ||
    siteResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_LEAF_RIGHT_OPERAND_SITE_AUTHORITY_VERSION_V1 ||
    siteResult.status !== "ready" ||
    siteResult.blockingReasons.length !== 0 ||
    siteResult.composedSiteCount !== siteResult.authorities.length
  ) {
    blockingReasons.push("a4_6a2b_result:not_exact_ready");
  }

  if (
    entityCompatibilityResult.producer !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_V1 ||
    entityCompatibilityResult.producerVersion !==
      CANONICAL_RUNTIME_MANIFEST_BINDING_ENTITY_COMPATIBILITY_VERSION_V1 ||
    entityCompatibilityResult.status !== "ready" ||
    entityCompatibilityResult.blockingReasons.length !== 0
  ) {
    blockingReasons.push("entity_result:not_exact_ready");
  }

  if (
    tokenPosCapabilityResult.producer !==
      CANONICAL_TOKEN_POS_PROPERTY_CAPABILITY_V1 ||
    tokenPosCapabilityResult.producerVersion !== "1" ||
    tokenPosCapabilityResult.status !== "ready" ||
    tokenPosCapabilityResult.blockingReasons.length !== 0 ||
    !tokenPosCapabilityResult.capability
  ) {
    blockingReasons.push("token_pos_capability_result:not_exact_ready");
  }

  const seenSiteIds = new Set<string>();

  for (const site of siteResult.authorities) {
    if (seenSiteIds.has(site.id)) {
      blockingReasons.push(`site:${site.id}:duplicate_id`);
      continue;
    }
    seenSiteIds.add(site.id);

    if (!safeA46a2bAuthority(site)) {
      blockingReasons.push(`site:${site.id}:unsafe_contract`);
    }
  }

  const seenEntityIds = new Set<string>();
  const seenEntityIdentities = new Set<string>();

  for (const entity of entityCompatibilityResult.candidates) {
    if (seenEntityIds.has(entity.id)) {
      blockingReasons.push(`entity:${entity.id}:duplicate_id`);
      continue;
    }
    seenEntityIds.add(entity.id);

    if (!safeEntityCandidate(entity)) {
      blockingReasons.push(`entity:${entity.id}:unsafe_contract`);
      continue;
    }

    const identity = entityIdentity(entity);

    if (seenEntityIdentities.has(identity)) {
      blockingReasons.push(
        `entity:${entity.id}:duplicate_referenced_binding_identity`,
      );
      continue;
    }

    seenEntityIdentities.add(identity);
  }

  const capability = tokenPosCapabilityResult.capability;

  if (capability && !safeTokenPosCapability(capability)) {
    blockingReasons.push(
      `token_pos_capability:${capability.capabilityId}:unsafe_contract`,
    );
  }

  if (blockingReasons.length > 0) {
    return blocked(blockingReasons);
  }

  if (!capability) {
    return blocked(["token_pos_capability_result:not_exact_ready"]);
  }

  for (const site of siteResult.authorities) {
    if (site.opaqueLeftSuffix !== ".pos") {
      continue;
    }

    const sameReferencedAuthority = entityCompatibilityResult.candidates.filter(
      (entity) =>
        entity.bindingDefinitionAuthorityId ===
          site.referencedBindingDefinitionAuthorityId,
    );

    for (const entity of sameReferencedAuthority) {
      if (
        entity.manifestId !== site.manifestId ||
        entity.manifestCode !== site.manifestCode ||
        entity.bindingName !== site.referencedBindingName
      ) {
        blockingReasons.push(
          `site:${site.id}:referenced_entity_identity_mismatch`,
        );
      }
    }

    const sameReferencedManifestAndName = entityCompatibilityResult.candidates
      .filter((entity) =>
        entity.manifestId === site.manifestId &&
        entity.manifestCode === site.manifestCode &&
        entity.bindingName === site.referencedBindingName
      );

    for (const entity of sameReferencedManifestAndName) {
      if (
        entity.bindingDefinitionAuthorityId !==
          site.referencedBindingDefinitionAuthorityId
      ) {
        blockingReasons.push(
          `site:${site.id}:referenced_entity_authority_id_mismatch`,
        );
      }
    }
  }

  if (blockingReasons.length > 0) {
    return blocked(blockingReasons);
  }

  const candidates:
    CanonicalRuntimeManifestTokenPosSuffixPropertyCompatibilityV1[] = [];
  const unmappedPosReferenceSiteKeys: string[] = [];
  const ignoredNonPosSuffixSiteKeys: string[] = [];

  let consideredPosReferenceSiteCount = 0;
  let compatibleTokenEntitySiteCount = 0;

  const entitiesByIdentity = new Map<
    string,
    CanonicalRuntimeManifestBindingEntityCompatibilityV1
  >();

  for (const entity of entityCompatibilityResult.candidates) {
    entitiesByIdentity.set(entityIdentity(entity), entity);
  }

  for (
    const site of [...siteResult.authorities].sort((a, b) =>
      a.id.localeCompare(b.id)
    )
  ) {
    const key = siteKey(site);

    if (site.opaqueLeftSuffix !== ".pos") {
      ignoredNonPosSuffixSiteKeys.push(key);
      continue;
    }

    consideredPosReferenceSiteCount += 1;

    const referencedIdentity = JSON.stringify([
      site.referencedBindingDefinitionAuthorityId,
      site.manifestId,
      site.manifestCode,
      site.referencedBindingName,
    ]);

    const entity = entitiesByIdentity.get(referencedIdentity);

    if (!entity || entity.canonicalNodeType !== "token") {
      unmappedPosReferenceSiteKeys.push(key);
      continue;
    }

    compatibleTokenEntitySiteCount += 1;

    candidates.push({
      id: [
        "runtime-manifest-token-pos-suffix-property-compatibility-v1",
        encodeURIComponent(site.id),
        encodeURIComponent(entity.id),
        encodeURIComponent(capability.capabilityId),
      ].join(":"),

      status: "candidate",

      leafRightOperandSiteAuthorityId: site.id,
      referenceRootAuthorityId: site.referenceRootAuthorityId,
      referenceExpressionAuthorityId: site.referenceExpressionAuthorityId,
      whereShapeAuthorityId: site.whereShapeAuthorityId,

      ownerBindingDefinitionAuthorityId: site.ownerBindingDefinitionAuthorityId,
      manifestId: site.manifestId,
      manifestCode: site.manifestCode,
      ownerBindingName: site.ownerBindingName,

      referencedBindingDefinitionAuthorityId:
        site.referencedBindingDefinitionAuthorityId,
      referencedBindingName: site.referencedBindingName,

      leafPath: site.leafPath,
      operatorLabelOpaque: site.operatorLabelOpaque,
      leftReferenceExpression: site.leftReferenceExpression,

      runtimeSuffix: ".pos",

      entityCompatibilityId: entity.id,
      runtimeEntityLabel: entity.runtimeEntityLabel,
      canonicalNodeType: "token",
      canonicalNodeTypeAuthorityId: entity.canonicalNodeTypeAuthorityId,

      canonicalPropertyCapabilityId: capability.capabilityId,
      canonicalPropertyDomain: "canonical_token_occurrence",
      canonicalPropertyKind: "pos_hypothesis_set",
      canonicalFactNodeType: "lexical_reading",
      canonicalFactNodeSubtype: "pos_candidate",
      canonicalFactLabelFeature: "pos",

      rightOperandSnapshot: cloneSnapshot(site.rightOperandSnapshot),

      governance: governance(),
    });
  }

  return {
    producer:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_V1,
    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_TOKEN_POS_SUFFIX_PROPERTY_COMPATIBILITY_VERSION_V1,
    status: "ready",
    candidates,
    consideredPosReferenceSiteCount,
    compatibleTokenEntitySiteCount,
    unmappedPosReferenceSiteKeys: uniqueSorted(unmappedPosReferenceSiteKeys),
    ignoredNonPosSuffixSiteKeys: uniqueSorted(ignoredNonPosSuffixSiteKeys),
    blockingReasons: [],
  };
}
