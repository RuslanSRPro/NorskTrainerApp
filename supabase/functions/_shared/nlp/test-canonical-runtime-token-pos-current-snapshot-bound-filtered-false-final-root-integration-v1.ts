// B-2 regression: direct ALL leaves reference one binding but retain
// disjoint snapshot-token occurrences. Eligibility must fail closed.
import { deriveCanonicalGraphSnapshotIdentityAuthorityV1 } from "./canonical-graph-snapshot-identity-authority-v1.ts";
import { buildCanonicalSurfaceDocumentV1 } from "./canonical-surface-boundary-v1.ts";
import { createCanonicalLanguageGraphV1 } from "./canonical-language-graph-core-v1.ts";
import { deriveCanonicalPosFactOwnershipAuthoritiesV1 } from "./canonical-pos-fact-ownership-authority-v1.ts";
import { deriveCanonicalTokenPosPropertyCapabilityV1 } from "./canonical-token-pos-property-capability-v1.ts";
import {
  deriveCanonicalDependencyRuntimeAuthoritiesV1,
} from "./canonical-dependency-runtime-authority-v1.ts";
import {
  deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1,
} from "./canonical-runtime-binding-definition-authority-v1.ts";
import {
  deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1,
} from "./canonical-runtime-binding-where-shape-authority-v1.ts";
import {
  deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1,
} from "./canonical-runtime-binding-where-reference-root-authority-v1.ts";
import {
  deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1,
} from "./canonical-runtime-binding-where-right-operand-authority-v1.ts";
import {
  deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1,
} from "./canonical-runtime-binding-where-left-right-site-authority-v1.ts";
import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_BINDING_OCCURRENCE_DOMAIN_AUTHORITY_VERSION_V1,
  deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1,
} from "./canonical-runtime-token-pos-current-binding-occurrence-domain-authority-v1.ts";
import {
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,
  CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,
  type CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1,
} from "./canonical-current-runtime-sentence-context-authority-v1.ts";
import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_CONTEXT_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1,
  deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1,
} from "./canonical-runtime-token-pos-current-context-site-occurrence-applicability-evidence-v1.ts";
import {
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,
  CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,
  type CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2,
  type CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";
import type {
  CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1,
  CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-snapshot-binding-v1.ts";

Deno.test("filtered FALSE survives production chain through final root", async () => {















const surface = buildCanonicalSurfaceDocumentV1("x");
const base = createCanonicalLanguageGraphV1(surface);
const tokens = base.nodes.filter((node) => node.type === "token");

if (tokens.length !== 1) {
  throw new Error(`Expected 1 token, got ${tokens.length}`);
}

const nodes: import("./canonical-language-graph-core-v1.ts").LanguageGraphNodeV1[] = [];
const edges: import("./canonical-language-graph-core-v1.ts").LanguageGraphEdgeV1[] = [];
const evidence: import("./canonical-language-graph-core-v1.ts").LanguageGraphEvidenceV1[] = [];
const alternativeSets: import("./canonical-language-graph-core-v1.ts").LanguageGraphAlternativeSetV1[] = [];

for (const [index, token] of tokens.entries()) {
  const label = "noun";
  const lexicalId = `lex:b2:${index}`;
  const posId = `pos:b2:${index}`;
  const lexicalEvidenceId = `e:lex:b2:${index}`;
  const posEvidenceId = `e:pos:b2:${index}`;

  nodes.push({
    id: lexicalId,
    type: "lexical_reading",
    subtype: "lexical_candidate",
    status: "candidate",
    span: { ...token.span },
    features: { sourcePos: label },
    producer: "canonical_candidate_lattice_v1",
    evidenceIds: [lexicalEvidenceId],
    provenanceIds: ["prov:b2-probe"],
  }, {
    id: posId,
    type: "lexical_reading",
    subtype: "pos_candidate",
    status: "resolved",
    span: { ...token.span },
    features: {
      pos: label,
      contributingLexicalReadingIds: [lexicalId],
      sourcePosIsEvidenceNotAuthority: true,
    },
    producer: "canonical_candidate_lattice_v1",
    evidenceIds: [posEvidenceId],
    provenanceIds: ["prov:b2-probe"],
  });

  for (const [relation, id, sourceId, targetId, status, evidenceId] of [
    ["lexical_reading_of", `edge:lexical:b2:${index}`, lexicalId, token.id, "candidate", lexicalEvidenceId],
    ["pos_of", `edge:pos:b2:${index}`, posId, token.id, "resolved", posEvidenceId],
    ["lexical_supports_pos", `support:b2:${index}`, lexicalId, posId, "candidate", posEvidenceId],
  ]) {
    edges.push({
      id, relation, sourceId, targetId, status: status as import("./canonical-language-graph-core-v1.ts").GraphStatus,
      features: relation === "lexical_reading_of" ? {} : { pos: label },
      producer: "canonical_candidate_lattice_v1",
      evidenceIds: [evidenceId],
      provenanceIds: ["prov:b2-probe"],
    });
  }

  evidence.push({
    id: lexicalEvidenceId,
    kind: "lexical",
    status: "supports",
    targetIds: [lexicalId, token.id],
    payload: {},
    producer: "canonical_candidate_lattice_v1",
    provenanceIds: ["prov:b2-probe"],
  }, {
    id: posEvidenceId,
    kind: "lexical",
    status: "supports",
    targetIds: [posId, lexicalId, token.id],
    payload: { pos: label },
    producer: "canonical_candidate_lattice_v1",
    provenanceIds: ["prov:b2-probe"],
  });

  alternativeSets.push({
    id: `alt:pos:${token.id}`,
    memberIds: [posId],
    resolvedMemberIds: [posId],
    status: "resolved",
    reason: "b2-probe",
  });
}

const graph = {
  ...base,
  nodes: [...base.nodes, ...nodes],
  edges: [...base.edges, ...edges],
  evidence: [...(base.evidence ?? []), ...evidence],
  provenance: [
    ...(base.provenance ?? []),
    {
      id: "prov:b2-probe",
      sourceType: "system" as const,
      sourceId: "b2-probe",
    },
  ],
  alternativeSets,
};

const snapshotResult = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
  surface,
  graph,
);

if (snapshotResult.status !== "ready" || !snapshotResult.authority) {
  throw new Error(`Snapshot not ready: ${JSON.stringify(snapshotResult)}`);
}

const sentence = graph.nodes.find((node) => node.type === "sentence");

if (!sentence) {
  throw new Error("Sentence node missing");
}

const occurrences = tokens.map((token, index) => {
  const containment = graph.edges.find(
    (edge) =>
      edge.relation === "contains" &&
      edge.sourceId === sentence.id &&
      edge.targetId === token.id,
  );

  if (!containment) {
    throw new Error(`Containment edge missing: ${token.id}`);
  }

  return {
    tokenNodeId: token.id,
    containmentEdgeId: containment.id,
    sentenceTokenIndex: index,
    graphStatus: containment.status,
    snapshotTokenOccurrenceIdentityId: `snapshot-token:b2:${index}`,
  };
});

console.log("B2_SNAPSHOT_PROBE=" + JSON.stringify({
  snapshotStatus: snapshotResult.status,
  snapshotIdentityId: snapshotResult.authority.snapshotIdentityId,
  sentenceNodeId: sentence.id,
  occurrenceCount: occurrences.length,
  occurrences,
}));
const ownership = deriveCanonicalPosFactOwnershipAuthoritiesV1(graph);
const capability = deriveCanonicalTokenPosPropertyCapabilityV1(ownership);

console.log(JSON.stringify({
  tokens: tokens.map((token, index) => ({
    tokenId: token.id,
    pos: index === 0 ? "verb" : "noun",
  })),
  ownershipStatus: ownership.status,
  ownershipBlockingReasons: ownership.blockingReasons,
  capabilityStatus: capability.status,
  capabilityBlockingReasons: capability.blockingReasons,
}, null, 2));
const rows = [{
  id: "manifest:1",
  code: "manifest-code-1",
  authoring_status: "validated",
  runtime_family: "opaque-family",
  execution_phase: "opaque-phase",
  constraint_strength: "opaque-strength",
  actions: [{
    action: "create_dependency",
    target: "tokenRef",
    relation: "opaque-relation",
    value: {
      source_ref: "tokenRef",
      target_ref: "tokenRef",
    },
  }],
  ir_spec: {
    source: { primary_candidate_code: "source.primary" },
    bindings: {
      tokenRef: {
        entity: "candidate",
        scope: "sentence",
        cardinality: "zero_or_more",
        where: {           op: "eq",           left: { ref: "tokenRef.pos" },           right: "verb",         },
      },
    },
  },
}];

const dependency = deriveCanonicalDependencyRuntimeAuthoritiesV1(rows);
const bindings = deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
  dependency.authorities, rows
);
const shapes = deriveCanonicalRuntimeBindingWhereShapeAuthoritiesV1(
  bindings.authorities
);
const roots = deriveCanonicalRuntimeBindingWhereReferenceRootAuthoritiesV1(
  shapes.authorities, bindings.authorities
);
const operands = deriveCanonicalRuntimeBindingWhereRightOperandAuthoritiesV1(
  shapes
);
const sites = deriveCanonicalRuntimeBindingWhereLeftRightSiteAuthoritiesV1(
  roots, operands
);

console.log("B2_ALL_RUNTIME_SITES=" + JSON.stringify({
  statuses: {
    dependency: dependency.status,
    bindings: bindings.status,
    shapes: shapes.status,
    roots: roots.status,
    operands: operands.status,
    sites: sites.status,
  },
  blockingReasons: {
    dependency: dependency.blockingReasons,
    bindings: bindings.blockingReasons,
    shapes: shapes.blockingReasons,
    roots: roots.blockingReasons,
    operands: operands.blockingReasons,
    sites: sites.blockingReasons,
  },
  siteCount: sites.authorities.length,
  sites: sites.authorities.map((site) => ({
    manifestId: site.manifestId,
    manifestCode: site.manifestCode,
    ownerBindingName: site.ownerBindingName,
    referencedBindingName: site.referencedBindingName,
    leafPath: site.leafPath,
    operator: site.operatorLabelOpaque,
    expectedPos: site.rightOperandSnapshot,
    referenceExpression: site.leftReferenceExpression,
    referenceSiteKey: [
      site.whereReferenceRootAuthorityId,
      site.leafPath,
      site.leftReferenceExpression,
    ].join("#"),
  })),
}));

if (
  sites.status !== "ready" ||
  sites.authorities.length !== 1 ||
  new Set(sites.authorities.map((site) => site.leafPath)).size !== 1
) {
  throw new Error("FALSE fixture must produce one ready runtime site");
}

const expectedModule = await import(
  "./canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts"
);

function upstreamStringOperandCandidate(
  options: {
    id?: string;
    siteKey?: string;
    operator?: string;
    pos?: string;
  } = {},
): import("./canonical-runtime-token-pos-string-operand-compatibility-v1.ts").CanonicalRuntimeTokenPosStringOperandCompatibilityV1 {
  return {
    id:
      options.id ??
        'string-operand:1',

    status:
      'candidate',

    leftRightSiteAuthorityId:
      'left-right:1',

    tokenPosSuffixCompatibilityId:
      'suffix:1',

    whereReferenceRootAuthorityId:
      'root:1',

    whereShapeAuthorityId:
      'shape:1',

    ownerBindingDefinitionAuthorityId:
      'binding:owner',

    referencedBindingDefinitionAuthorityId:
      'binding:token',

    manifestId:
      'manifest:1',

    manifestCode:
      'manifest.one',

    ownerBindingName:
      'owner',

    referencedBindingName:
      'token',

    referenceSiteKey:
      options.siteKey ??
        'root:1#$#token.pos',

    referencePath:
      '$',

    referenceExpression:
      'token.pos',

    runtimeSuffix:
      '.pos',

    entityCompatibilityId:
      'entity:token',

    runtimeEntityLabel:
      'token',

    canonicalNodeType:
      'token',

    tokenPosCapabilityId:
      'pos-capability:1',

    canonicalPropertyDomain:
      'canonical_token_occurrence',

    canonicalPropertyKind:
      'pos_hypothesis_set',

    operatorLabelOpaque:
      options.operator ??
        'eq',

    rightOperandStructuralKind:
      'string',

    posLabelInputOpaque:
      options.pos ??
        'verb',

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
  };
}


const expectedCandidates: import("./canonical-runtime-token-pos-string-operand-compatibility-v1.ts").CanonicalRuntimeTokenPosStringOperandCompatibilityV1[] = sites.authorities.map((site, index) => {
  const siteKey = [
    site.whereReferenceRootAuthorityId,
    site.leafPath,
    site.leftReferenceExpression,
  ].join("#");

  return {
    ...upstreamStringOperandCandidate({
      id: `b2-string-operand:${index}`,
      siteKey,
      operator: site.operatorLabelOpaque,
      pos: String(site.rightOperandSnapshot),
    }),
    leftRightSiteAuthorityId: site.id,
    whereReferenceRootAuthorityId: site.whereReferenceRootAuthorityId,
    whereShapeAuthorityId: site.whereShapeAuthorityId,
    ownerBindingDefinitionAuthorityId:
      site.ownerBindingDefinitionAuthorityId,
    referencedBindingDefinitionAuthorityId:
      site.referencedBindingDefinitionAuthorityId,
    manifestId: site.manifestId,
    manifestCode: site.manifestCode,
    ownerBindingName: site.ownerBindingName,
    referencedBindingName: site.referencedBindingName,
    referenceSiteKey: siteKey,
    referencePath: site.leafPath,
    referenceExpression: site.leftReferenceExpression,
  };
});
console.log("B2_ALL_EXPECTED_AUTHORITIES=" + JSON.stringify({
  candidateCount: expectedCandidates.length,
  candidates: expectedCandidates.map((candidate) => ({
    referencePath: candidate.referencePath,
    referenceSiteKey: candidate.referenceSiteKey,
    expectedPos: candidate.posLabelInputOpaque,
    referencedBindingName: candidate.referencedBindingName,
  })),
}));

const normalized = expectedModule
  .deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1({
    producer: "canonical_runtime_token_pos_string_operand_compatibility_v1",
    producerVersion: "1",
    status: "ready",
    candidates: expectedCandidates,
    consideredTokenPosLeftRightSiteCount: expectedCandidates.length,
    unsupportedOperandSiteIds: [],
    unmatchedStringOperandSiteIds: [],
    tokenPosSuffixCandidatesWithoutStringOperandSiteKeys: [],
    blockingReasons: [],
  });

console.log("B2_ALL_NORMALIZED_AUTHORITIES=" + JSON.stringify({
  status: normalized.status,
  blockingReasons: normalized.blockingReasons,
  authorityCount: normalized.authorities.length,
  authorities: normalized.authorities.map((authority) => ({
    manifestId: authority.manifestId,
    manifestCode: authority.manifestCode,
    referencedBindingName: authority.referencedBindingName,
    referencePath: authority.referencePath,
    referenceSiteKey: authority.referenceSiteKey,
    expectedPos: authority.normalizedPosLabelInput,
  })),
}));

if (
  normalized.status !== "ready" ||
  normalized.authorities.length !== 1
) {
  throw new Error("FALSE expected-authority normalization failed");
}

// B2_CURRENT_DOMAIN_HELPERS_BEGIN











function fixtureAssert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function occurrence(
  id: string,
  tokenNodeId = `token:${id}`,
): CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1 {
  return {
    tokenNodeId,
    containmentEdgeId: `edge:${id}`,
    sentenceTokenIndex: Number(
      id.replace(/\D/g, ""),
    ) || 0,
    graphStatus: "asserted",
    snapshotTokenOccurrenceIdentityId: `snapshot-token:${id}`,
  } as unknown as CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1;
}

function domain(
  id: string,
  occurrences: CanonicalRuntimeManifestSnapshotBoundTokenDomainOccurrenceV1[],
): CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1 {
  return {
    snapshotBoundDomainId: `snapshot-domain:${id}`,

    status: "candidate",

    sourceDomainCandidateId: `source-domain:${id}`,

    snapshotAuthorityId: "snapshot-authority:1",

    snapshotIdentityId: "snapshot:1",

    snapshotSha256: "snapshot-sha:1",

    surfaceSnapshotSha256: "surface-sha:1",

    graphStateSha256: "graph-sha:1",

    graphVersion: "canonical-language-graph-v1",

    graphDocumentId: "graph-document:1",

    canonicalTokenDomainId: `canonical-token-domain:${id}`,

    sentenceNodeId: "sentence:1",

    sentenceIndex: 0,

    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence:1",

    occurrenceCount: occurrences.length,

    occurrences,

    sourceCandidate: {
      id: `referenced-domain:${id}`,

      status: "candidate",

      tokenPosSuffixPropertyCompatibilityId: "suffix-property:1",

      leafRightOperandSiteAuthorityId: "leaf-site:1",

      referencedBindingDefinitionAuthorityId:
        "runtime-binding-definition-authority-v1:manifest-code-1:tokenRef",

      manifestId: "manifest:1",

      manifestCode: "manifest-code-1",

      referencedBindingName: "tokenRef",

      runtimeSuffix: "pos",

      canonicalNodeType: "token",

      manifestScopeCompatibilityId: "scope-compatibility:sentence",

      graphVersion: "canonical-language-graph-v1",

      graphDocumentId: "graph-document:1",

      canonicalTokenDomainId: `canonical-token-domain:${id}`,

      sentenceNodeId: "sentence:1",

      sentenceIndex: 0,

      occurrenceCount: occurrences.length,

      occurrences,
    },

    governance: {},
  } as unknown as CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1;
}

function pair(
  id: string,
  domainCandidate:
    CanonicalRuntimeManifestSnapshotBoundReferencedTokenSentenceDomainCandidateV1,
  options: {
    siteMatch?: boolean;
    matchedTokenNodeId?: string | null;
  } = {},
): CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2 {
  const siteMatch = options.siteMatch ??
    true;

  const matched = options.matchedTokenNodeId ===
      null
    ? []
    : domainCandidate.occurrences
      .filter(
        (item) =>
          item.tokenNodeId ===
            (
              options.matchedTokenNodeId ??
                "token:1"
            ),
      )
      .map(
        (item) => ({
          occurrenceMatchEvidenceId:
            `occurrence-match:${id}:${item.snapshotTokenOccurrenceIdentityId}`,

          tokenNodeId: item.tokenNodeId,

          containmentEdgeId: item.containmentEdgeId,

          sentenceTokenIndex: item.sentenceTokenIndex,

          graphStatus: item.graphStatus,

          snapshotTokenOccurrenceIdentityId:
            item.snapshotTokenOccurrenceIdentityId,

          occurrence: item,
        }),
      );

  return {
    pairEvidenceId: `pair:${id}`,

    pairIndex: Number(
      id.replace(/\D/g, ""),
    ) || 0,

    snapshotBoundDomainId: domainCandidate.snapshotBoundDomainId,

    sourceDomainCandidateId: domainCandidate.sourceDomainCandidateId,

    sentenceNodeId: "sentence:1",

    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence:1",

    siteIdentityFieldMatches: {
      tokenPosSuffixPropertyCompatibilityId: siteMatch,

      leafRightOperandSiteAuthorityId: siteMatch,

      referencedBindingDefinitionAuthorityId: siteMatch,

      manifestId: siteMatch,

      manifestCode: siteMatch,

      referencedBindingName: siteMatch,

      runtimeSuffix: siteMatch,

      canonicalNodeType: siteMatch,
    },

    siteIdentityMatches: siteMatch,

    snapshotIdentityMatches: true,

    matchingTokenOccurrences: siteMatch ? matched : [],

    matchingTokenOccurrenceCount: siteMatch ? matched.length : 0,

    exactSiteSnapshotTokenOccurrenceMatch: siteMatch &&
      matched.length >
        0,

    snapshotDomainCandidate: domainCandidate,
  };
}

function currentResult(): CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1 {
  const authority = {
    authorityId: "current-authority:1",

    status: "proven_current",

    executionInvocationId: "execution:1",

    snapshotIdentityId: "snapshot:1",

    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence:1",

    snapshotAuthorityId: "snapshot-authority:1",

    snapshotSentenceOccurrenceAuthorityId: "snapshot-sentence-authority:1",

    graphDocumentId: "graph-document:1",

    sentenceNodeId: "sentence:1",

    sentenceIndex: 0,

    sourceSnapshotSentenceOccurrenceAuthority: {},

    governance: {
      currentRuntimeSentenceContextSelected: true,

      currentContextProvenByIndependentAuthority: true,

      callerDeclarationAcceptedAsProof: false,

      executionInvocationIdUsedAsSentenceSelector: false,

      sentenceIndexUsedAsContextIdentity: false,

      sentenceIndexUsedAsSelector: false,

      sentenceIndexIsLocalityMetadataOnly: true,

      graphDocumentIdUsedAsSelector: false,

      sentenceNodeIdAcceptedFromCallerAsSelector: false,

      singletonSentenceInferenceAllowed: false,

      singletonCandidateInferenceAllowed: false,

      firstSentenceInferenceAllowed: false,

      rootCandidatesAcceptedAsSelector: false,

      runtimeSiteApplicabilityResolved: false,

      occurrenceWinnerSelected: false,

      bindingTruthResolved: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      runtimeWhereTruthResolved: false,

      ruleExecutionPerformed: false,

      learnerErrorClassified: false,
    },
  };

  return {
    producer: CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_V1,

    producerVersion:
      CANONICAL_CURRENT_RUNTIME_SENTENCE_CONTEXT_AUTHORITY_VERSION_V1,

    status: "ready",

    sourceExecutionContextInputResult: {} as never,

    sourceSnapshotIdentityResult: {} as never,

    sourceSnapshotSentenceOccurrenceIdentityResult: {} as never,

    authority,
    blockingReasons: [],
  } as unknown as CanonicalCurrentRuntimeSentenceContextAuthorityReadyResultV1;
}

function d2aResult(
  pairs: CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[],
): CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2 {
  const sitePairs = pairs.filter(
    (item) => item.siteIdentityMatches,
  );

  const exactPairs = pairs.filter(
    (item) => item.exactSiteSnapshotTokenOccurrenceMatch,
  );

  const occurrences = exactPairs.flatMap(
    (item) => item.matchingTokenOccurrences,
  );

  const state = sitePairs.length ===
      0
    ? "no_matching_site_domain"
    : occurrences.length ===
        0
    ? "matching_site_domain_no_token_occurrence"
    : occurrences.length ===
        1
    ? "unique_site_snapshot_token_occurrence_match"
    : "multiple_site_snapshot_token_occurrence_matches";

  const evidence = {
    applicabilityEvidenceId: "d2a:1",

    status: "candidate",

    applicabilityState: state,

    actualSnapshotIdentityId: "snapshot:1",

    snapshotDomainSnapshotIdentityId: "snapshot:1",

    pairEvidence: pairs,

    siteMatchingDomainCount: sitePairs.length,

    exactSiteSnapshotTokenOccurrenceMatchCount: occurrences.length,

    matchingPairEvidenceIds: exactPairs.map(
      (item) => item.pairEvidenceId,
    ),

    matchingOccurrenceEvidenceIds: occurrences.map(
      (item) => item.occurrenceMatchEvidenceId,
    ),

    c2ComparisonEvidenceId: "c2:1",

    actualSnapshotSha256: "snapshot-sha:1",

    actualGraphDocumentId: "graph-document:1",

    actualTokenNodeId: "token:1",

    actualGraphTokenOccurrenceIdentityId: "graph-token-occurrence:1",

    expectedAuthorityId: "expected:1",

    snapshotDomainSnapshotSha256: "snapshot-sha:1",

    snapshotDomainGraphDocumentId: "graph-document:1",

    c2ComparisonEvidence: {},

    snapshotDomainResult: {
      status: "ready",

      candidates: pairs.map(
        (item) => item.snapshotDomainCandidate,
      ),
    },

    governance: {
      exactC2ComparisonEvidenceRequired: true,

      exactSnapshotBoundDomainResultRequired: true,

      exactSnapshotIdentityEqualityRequired: true,

      graphDocumentIdConsistencyRequired: true,

      graphDocumentIdUsedAsSnapshotIdentity: false,

      siteDomainCandidateOrderPreserved: true,

      siteDomainCandidateMultiplicityPreserved: true,

      matchingOccurrenceOrderPreserved: true,

      matchingOccurrenceMultiplicityPreserved: true,

      applicabilityEvidenceStateProduced: true,

      applicabilityEvidenceStateIsBooleanTruth: false,

      snapshotMismatchProducesBlockedComposition: true,

      snapshotMismatchProducesNegativeApplicabilityEvidence: false,

      runtimeSiteApplicabilityResolved: false,

      currentRuntimeSentenceContextSelected: false,

      occurrenceFilteringPerformed: false,

      occurrenceWinnerSelected: false,

      finalRuntimeOccurrenceBindingPerformed: false,

      cardinalitySemanticsResolved: false,

      cardinalityEnforcementPerformed: false,

      graphMutationPerformed: false,

      learnerErrorClassified: false,
    },
  };

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_V2,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_SITE_OCCURRENCE_APPLICABILITY_EVIDENCE_VERSION_V2,

    status: "ready",

    evidence,

    blockingReasons: [],
  } as unknown as CanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceResultV2;
}

function fixture(
  pairs: CanonicalRuntimeTokenPosSiteDomainApplicabilityPairEvidenceV2[],
): CanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceReadyResultV1 {
  for (
    let index = 0;
    index <
      pairs.length;
    index++
  ) {
    pairs[index].pairIndex = index;
  }

  const current = currentResult();

  const d2a = d2aResult(
    pairs,
  );

  const result =
    deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
      current,
      d2a,
    );

  fixtureAssert(
    result.status ===
      "ready",
    `closed CURRENT-applicability fixture failed: ${
      JSON.stringify(
        result,
      )
    }`,
  );

  return result;
}
// B2_CURRENT_DOMAIN_HELPERS_END

// B2_REAL_CURRENT_DOMAIN_PROBE_BEGIN
const b2Domain = domain("b2-real", occurrences);

const b2Pair = pair("b2-real", b2Domain, {
  matchedTokenNodeId: tokens[0].id,
});

const b2Applicability = fixture([b2Pair]);

const b2Snapshot = snapshotResult.authority;
const b2Replacements = new Map<string, string>([
  ["snapshot:1", b2Snapshot.snapshotIdentityId],
  ["snapshot-authority:1", b2Snapshot.authorityId],
  ["snapshot-sha:1", b2Snapshot.snapshotSha256],
  ["surface-sha:1", b2Snapshot.surfaceSnapshotSha256],
  ["graph-sha:1", b2Snapshot.graphStateSha256],
  ["graph-document:1", graph.documentId],
  ["sentence:1", sentence.id],
  ["snapshot-sentence:1", ["canonical-snapshot-sentence-occurrence-v1", encodeURIComponent(b2Snapshot.snapshotIdentityId).replaceAll("%", "_"), encodeURIComponent(sentence.id).replaceAll("%", "_")].join(":")],
]);

const b2Replace = (
  value: unknown,
  seen = new WeakSet<object>(),
): void => {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }

  seen.add(value);

  for (const [key, member] of Object.entries(value)) {
    if (typeof member === "string") {
      const replacement = b2Replacements.get(member);

      if (replacement !== undefined) {
        (value as Record<string, unknown>)[key] = replacement;
      }
    } else {
      b2Replace(member, seen);
    }
  }
};

b2Replace(b2Applicability);

const b2CurrentDomain =
  deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
    b2Applicability,
  );

if (b2CurrentDomain.status !== "ready") {
  throw new Error(
    "B2 CURRENT-domain blocked: " +
      JSON.stringify(b2CurrentDomain.blockingReasons),
  );
}

const b2ActualOccurrences =
  b2CurrentDomain.authority.bindingOccurrenceDomains.flatMap(
    (item) => item.occurrences,
  );

const b2ActualTokenIds = b2ActualOccurrences.map(
  (item) => item.tokenNodeId,
);

const b2ExpectedTokenIds = tokens.map((item) => item.id);

if (
  JSON.stringify(b2ActualTokenIds) !==
  JSON.stringify(b2ExpectedTokenIds)
) {
  throw new Error(
    "B2 CURRENT-domain lost occurrences: " +
      JSON.stringify(b2ActualTokenIds),
  );
}

console.log("B2_REAL_CURRENT_DOMAIN=" + JSON.stringify({
  status: b2CurrentDomain.status,
  domainCount:
    b2CurrentDomain.authority.bindingOccurrenceDomains.length,
  applicabilityMatchedCount:
    b2Pair.matchingTokenOccurrences.length,
  preservedOccurrenceCount: b2ActualOccurrences.length,
  tokenNodeIds: b2ActualTokenIds,
}));
// B2_REAL_CURRENT_DOMAIN_PROBE_END
// B2_PRODUCTION_COHERENCE_PROBE_BEGIN
const b2CoherenceModule = await import(
  "./canonical-runtime-token-pos-current-snapshot-bound-where-direct-all-occurrence-coherence-evidence-v1.ts"
);

const b2Coherence =
  await b2CoherenceModule
    .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereDirectAllOccurrenceCoherenceEvidenceV1(
      surface,
      graph,
      normalized,
      b2CurrentDomain,
      rows,
    );

console.log("B2_PRODUCTION_COHERENCE=" + JSON.stringify({
  status: b2Coherence.status,
  blockingReasons: b2Coherence.blockingReasons,
  coherenceFailureCount:
    b2Coherence.status === "ready"
      ? b2Coherence.authority.coherenceFailureCount
      : null,
  allEvidence:
    b2Coherence.status === "ready"
      ? b2Coherence.authority.allEvidence
      : null,
}));
// B2_PRODUCTION_COHERENCE_PROBE_END
// B2_BINDING_ELIGIBILITY_PROBE_BEGIN
const b2EligibilityModule = await import(
  "./canonical-runtime-token-pos-current-snapshot-bound-binding-eligibility-v1.ts"
);

const b2Eligibility =
  await b2EligibilityModule
    .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBindingEligibilityV1(
      surface,
      graph,
      normalized,
      b2CurrentDomain,
      dependency.authorities,
      rows,
    );

console.log("FALSE_BINDING_ELIGIBILITY=" + JSON.stringify({
  status: b2Eligibility.status,
  blockingReasons: b2Eligibility.blockingReasons,
}));

if (b2Eligibility.status !== "ready") {
  throw new Error(
    "FALSE binding eligibility must remain ready: " +
      JSON.stringify(b2Eligibility)
  );
}
// B2_BINDING_ELIGIBILITY_PROBE_END

// B2_TRANSITIVE_BLOCKING_REGRESSION_BEGIN
const b2PublicInputs = [
  surface,
  graph,
  normalized,
  b2CurrentDomain,
  dependency.authorities,
  rows,
] as const;

const b2FinalBindingModule = await import(
  "./canonical-runtime-token-pos-current-snapshot-bound-final-runtime-binding-v1.ts"
);
const b2BoundConditionModule = await import(
  "./canonical-runtime-token-pos-current-snapshot-bound-bound-condition-evidence-v1.ts"
);
const b2LeafTruthModule = await import(
  "./canonical-runtime-token-pos-current-snapshot-bound-where-authority-bound-leaf-truth-evidence-v1.ts"
);
const b2RecursiveWhereModule = await import(
  "./canonical-runtime-token-pos-current-snapshot-bound-where-context-coherent-recursive-compound-truth-v1.ts"
);

const b2PublicStages = [
  {
    name: "final-runtime-binding",
    run: () =>
      b2FinalBindingModule
        .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1(
          ...b2PublicInputs
        ),
  },
  {
    name: "bound-condition-evidence",
    run: () =>
      b2BoundConditionModule
        .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundBoundConditionEvidenceV1(
          ...b2PublicInputs
        ),
  },
  {
    name: "authority-bound-leaf-truth",
    run: () =>
      b2LeafTruthModule
        .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceV1(
          ...b2PublicInputs
        ),
  },
  {
    name: "recursive-where",
    run: () =>
      b2RecursiveWhereModule
        .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthV1(
          ...b2PublicInputs
        ),
  },
];

for (const stage of b2PublicStages) {
  const result = await stage.run();
  console.log("FALSE_STAGE_" + stage.name + "=" + JSON.stringify(result));
}
  // FALSE_OWNER_FINAL_ROOT_REGRESSION_BEGIN
  const falseManifestBindingModule = await import(
    "./canonical-runtime-manifest-binding-definition-authority-v1.ts"
  );
  const falseScopeModule = await import(
    "./canonical-runtime-manifest-binding-scope-compatibility-v1.ts"
  );
  const falseDirectDomainModule = await import(
    "./canonical-sentence-direct-token-occurrence-domain-capability-v1.ts"
  );
  const falseOwnerModule = await import(
    "./canonical-runtime-token-pos-current-snapshot-bound-where-owner-binding-occurrence-provenance-v1.ts"
  );
  const falseFinalRootModule = await import(
    "./canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1.ts"
  );

  const falseManifestBindings =
    falseManifestBindingModule.deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(rows);

  const falseSentenceBoundary = {
    authorityId: "boundary:sentence",
    status: "proven" as const,
    boundaryLabel: "sentence" as const,
    source: "canonical_sentence_scope_boundary_capability_v1" as const,
  };

  const falseManifestScope =
    falseScopeModule.deriveCanonicalRuntimeManifestBindingScopeCompatibilitiesV1(
      falseManifestBindings,
      [falseSentenceBoundary],
    );

  const falseDirectTokenDomains =
    falseDirectDomainModule.deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(
      graph,
    );

  const falseRecursiveWhere = await b2RecursiveWhereModule
    .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthV1(
      ...b2PublicInputs
    );

  if (falseRecursiveWhere.status !== "ready") {
    throw new Error("FALSE recursive WHERE was not ready: " + JSON.stringify(falseRecursiveWhere));
  }

  const falseOwner = falseOwnerModule
    .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceV1(
      falseRecursiveWhere,
      falseManifestScope,
      falseDirectTokenDomains,
      snapshotResult,
    );

  if (falseOwner.status !== "ready") {
    throw new Error("FALSE owner provenance was not ready: " + JSON.stringify(falseOwner));
  }

  const falseFinalRoot = falseFinalRootModule
    .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1(
      falseOwner,
    );

  if (
    falseFinalRoot.status !== "ready" ||
    falseFinalRoot.decisions.length !== 1 ||
    falseFinalRoot.decisions[0].rootTruthDisposition !== "resolved_false" ||
    falseFinalRoot.decisions[0].decisionDisposition !== "rejected"
  ) {
    throw new Error("FALSE final root truth was not preserved: " + JSON.stringify(falseFinalRoot));
  }

  // A21021_REAL_TERMINAL_AGGREGATION_PROBE_BEGIN
  const falsePostOwnerSurvivorModule = await import(
    "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-survivor-set-v1.ts"
  );

  const falsePostOwnerEvidenceModule = await import(
    "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-bound-condition-evidence-v1.ts"
  );

  const falseTerminalAggregationModule = await import(
    "./canonical-runtime-token-pos-current-snapshot-bound-where-terminal-aggregation-v1.ts"
  );

  const falsePostOwnerSurvivor =
    falsePostOwnerSurvivorModule
      .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
        falseFinalRoot,
      );

  if (falsePostOwnerSurvivor.status !== "ready") {
    throw new Error(
      "FALSE real post-owner survivor was not ready: " +
        JSON.stringify(falsePostOwnerSurvivor),
    );
  }

  const falsePostOwnerBoundEvidence =
    falsePostOwnerEvidenceModule
      .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceV1(
        falsePostOwnerSurvivor,
        dependency.authorities,
        rows,
      );

  if (falsePostOwnerBoundEvidence.status !== "ready") {
    throw new Error(
      "FALSE real post-owner bound evidence was not ready: " +
        JSON.stringify(falsePostOwnerBoundEvidence),
    );
  }

  if (
    falsePostOwnerBoundEvidence.domainBoundConditionEvidence.length !==
    falseFinalRoot.decisions.length
  ) {
    throw new Error(
      "FALSE real terminal input cardinality diverged: " +
        JSON.stringify({
          decisionCount: falseFinalRoot.decisions.length,
          evidenceCount:
            falsePostOwnerBoundEvidence.domainBoundConditionEvidence.length,
        }),
    );
  }

  if (
    falsePostOwnerBoundEvidence.domainBoundConditionEvidence.length !== 1
  ) {
    throw new Error(
      "FALSE real terminal probe expected exactly one domain evidence item: " +
        JSON.stringify(falsePostOwnerBoundEvidence),
    );
  }

  if (
    falsePostOwnerBoundEvidence
      .domainBoundConditionEvidence[0]
      .sourceFinalWhereDecision !==
    falseFinalRoot.decisions[0]
  ) {
    throw new Error(
      "FALSE real terminal probe lost exact FinalRootTruthDecision object identity",
    );
  }

  const falseTerminalAggregation =
    falseTerminalAggregationModule
      .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationV1(
        {
          finalWhereDecisionResult:
            falseFinalRoot,

          postOwnerBoundConditionEvidenceResult:
            falsePostOwnerBoundEvidence,
        },
      );

  if (falseTerminalAggregation.status !== "ready") {
    throw new Error(
      "FALSE real terminal aggregation was not ready: " +
        JSON.stringify(falseTerminalAggregation),
    );
  }

  if (
    falseTerminalAggregation.aggregation.envelopeCount !== 1
  ) {
    throw new Error(
      "FALSE real terminal aggregation envelope count mismatch: " +
        JSON.stringify(falseTerminalAggregation),
    );
  }

  if (
    falseTerminalAggregation
      .aggregation
      .sourceFinalWhereDecisionResult !==
    falseFinalRoot
  ) {
    throw new Error(
      "FALSE real terminal aggregation did not preserve exact final decision result identity",
    );
  }

  if (
    falseTerminalAggregation
      .aggregation
      .sourcePostOwnerBoundConditionEvidenceResult !==
    falsePostOwnerBoundEvidence
  ) {
    throw new Error(
      "FALSE real terminal aggregation did not preserve exact bound evidence result identity",
    );
  }

  if (
    falseTerminalAggregation
      .aggregation
      .terminalEnvelopes[0]
      .rootTruthDisposition !== "resolved_false"
  ) {
    throw new Error(
      "FALSE real terminal aggregation changed root truth disposition: " +
        JSON.stringify(
          falseTerminalAggregation.aggregation.terminalEnvelopes[0],
        ),
    );
  }

  if (
    falseTerminalAggregation
      .aggregation
      .terminalEnvelopes[0]
      .finalDecisionDisposition !== "rejected"
  ) {
    throw new Error(
      "FALSE real terminal aggregation changed final decision disposition: " +
        JSON.stringify(
          falseTerminalAggregation.aggregation.terminalEnvelopes[0],
        ),
    );
  }

  // A21026_REAL_ACTION_CANDIDATE_BRIDGE_PROBE_BEGIN
  const falseSetRoleActionAuthorityModule = await import(
    "./canonical-runtime-set-role-action-authority-v1.ts"
  );

  const falseActionCandidateBridgeModule = await import(
    "./canonical-runtime-token-pos-current-snapshot-bound-where-action-candidate-bridge-v1.ts"
  );

  const falseSetRoleAuthorities =
    falseSetRoleActionAuthorityModule
      .deriveCanonicalRuntimeSetRoleActionAuthoritiesV1(
        rows,
      );

  if (
    falseSetRoleAuthorities.status !== "blocked" ||
    falseSetRoleAuthorities.authorities.length !== 0 ||
    falseSetRoleAuthorities.blockingReasons.length !== 1 ||
    falseSetRoleAuthorities.blockingReasons[0] !==
      "set_role_action_not_found"
  ) {
    throw new Error(
      "FALSE real rows did not produce exact benign set_role absence: " +
        JSON.stringify(falseSetRoleAuthorities),
    );
  }

  if (
    dependency.status !== "ready" ||
    dependency.blockingReasons.length !== 0 ||
    dependency.authorities.length !== 1
  ) {
    throw new Error(
      "FALSE real rows did not preserve one ready dependency action authority: " +
        JSON.stringify(dependency),
    );
  }

  if (
    falseTerminalAggregation.status !== "ready" ||
    falseTerminalAggregation.aggregation.terminalEnvelopes.length !== 1
  ) {
    throw new Error(
      "FALSE terminal aggregation not ready for action bridge: " +
        JSON.stringify(falseTerminalAggregation),
    );
  }

  const falseTerminalEnvelope =
    falseTerminalAggregation
      .aggregation
      .terminalEnvelopes[0];

  const falseActionCandidateBridge =
    falseActionCandidateBridgeModule
      .deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1(
        {
          terminalEnvelope:
            falseTerminalEnvelope,

          setRoleAuthorities:
            falseSetRoleAuthorities,

          dependencyAuthorities:
            dependency,
        },
      );

  if (falseActionCandidateBridge.status !== "ready") {
    throw new Error(
      "FALSE real action candidate bridge was not ready: " +
        JSON.stringify(falseActionCandidateBridge),
    );
  }

  if (
    falseActionCandidateBridge.bridge.actionCandidates.length !== 1
  ) {
    throw new Error(
      "FALSE real action candidate bridge expected exactly one candidate: " +
        JSON.stringify(falseActionCandidateBridge),
    );
  }

  const falseActionCandidate =
    falseActionCandidateBridge.bridge.actionCandidates[0];

  if (
    falseActionCandidate.family !== "create_dependency"
  ) {
    throw new Error(
      "FALSE real action candidate family changed: " +
        JSON.stringify(falseActionCandidate),
    );
  }

  if (
    falseActionCandidate.sourceAuthority.manifestId !== "manifest:1" ||
    falseActionCandidate.sourceAuthority.manifestCode !== "manifest-code-1"
  ) {
    throw new Error(
      "FALSE real action candidate manifest identity changed: " +
        JSON.stringify(falseActionCandidate),
    );
  }

  if (
    falseActionCandidate.actionIndex !== 0
  ) {
    throw new Error(
      "FALSE real action candidate index changed: " +
        JSON.stringify(falseActionCandidate),
    );
  }

  if (
    falseActionCandidate.sourceAuthority !==
    dependency.authorities[0]
  ) {
    throw new Error(
      "FALSE real dependency source authority object identity was not preserved",
    );
  }

  if (
    falseActionCandidateBridge
      .bridge
      .sourceTerminalEnvelope !==
    falseTerminalEnvelope
  ) {
    throw new Error(
      "FALSE real terminal envelope object identity was not preserved by bridge",
    );
  }

  if (
    falseActionCandidateBridge.bridge.governance.actionSelected !== false ||
    falseActionCandidateBridge.bridge.governance.genericEligibilityDerived !== false ||
    falseActionCandidateBridge.bridge.governance.executableStateDerived !== false ||
    falseActionCandidateBridge.bridge.governance.schedulableStateDerived !== false ||
    falseActionCandidateBridge.bridge.governance.runtimeActionExecuted !== false ||
    falseActionCandidateBridge.bridge.governance.schedulerInvoked !== false ||
    falseActionCandidateBridge.bridge.governance.graphMutationPerformed !== false
  ) {
    throw new Error(
      "FALSE real action candidate bridge crossed a prohibited semantic boundary: " +
        JSON.stringify(falseActionCandidateBridge.bridge.governance),
    );
  }

  console.log(
    "FALSE_REAL_ACTION_CANDIDATE_BRIDGE=" +
      JSON.stringify({
        terminalRootTruthDisposition:
          falseTerminalEnvelope.rootTruthDisposition,

        terminalFinalDecisionDisposition:
          falseTerminalEnvelope.finalDecisionDisposition,

        setRoleStatus:
          falseSetRoleAuthorities.status,

        setRoleBlockingReasons:
          falseSetRoleAuthorities.blockingReasons,

        dependencyStatus:
          dependency.status,

        dependencyAuthorityCount:
          dependency.authorities.length,

        bridgeStatus:
          falseActionCandidateBridge.status,

        actionCandidateCount:
          falseActionCandidateBridge.bridge.actionCandidates.length,

        actionFamily:
          falseActionCandidate.family,

        manifestId:
          falseActionCandidate.sourceAuthority.manifestId,

        manifestCode:
          falseActionCandidate.sourceAuthority.manifestCode,

        actionIndex:
          falseActionCandidate.actionIndex,

        sourceAuthorityObjectIdentityPreserved:
          falseActionCandidate.sourceAuthority ===
          dependency.authorities[0],

        terminalEnvelopeObjectIdentityPreserved:
          falseActionCandidateBridge
            .bridge
            .sourceTerminalEnvelope ===
          falseTerminalEnvelope,

        actionSelected:
          falseActionCandidateBridge
            .bridge
            .governance
            .actionSelected,

        genericEligibilityDerived:
          falseActionCandidateBridge
            .bridge
            .governance
            .genericEligibilityDerived,

        executableStateDerived:
          falseActionCandidateBridge
            .bridge
            .governance
            .executableStateDerived,

        schedulableStateDerived:
          falseActionCandidateBridge
            .bridge
            .governance
            .schedulableStateDerived,

        runtimeActionExecuted:
          falseActionCandidateBridge
            .bridge
            .governance
            .runtimeActionExecuted,

        schedulerInvoked:
          falseActionCandidateBridge
            .bridge
            .governance
            .schedulerInvoked,

        graphMutationPerformed:
          falseActionCandidateBridge
            .bridge
            .governance
            .graphMutationPerformed,
      }),
  );
  // FALSE_REAL_ASSOCIATION_READINESS_PROBE_BEGIN
  const falseAssociationModule = await import(
    "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts",
  );

  const falseExecutionReadinessModule = await import(
    "./canonical-runtime-execution-readiness-evidence-boundary-v1.ts",
  );

  const falseRealBoundEvidence =
    falsePostOwnerBoundEvidence.domainBoundConditionEvidence[0];

  const falseRealCanonicalOwnerBindingAuthority =
    falseRealBoundEvidence.sourceFinalRuntimeBindingDomain
      .sourceProjectionDomain
      .sourceReadinessDomain
      .sourceCardinalityEnforcementDomain
      .sourceCardinalitySemanticDomain
      .sourceBindingDefinitionAuthority;

  const falseAssociationOwnerEvidence = {
    boundConditionDomainEvidenceId:
      falseRealBoundEvidence.boundConditionDomainEvidenceId,
    manifestId:
      falseRealBoundEvidence.manifestId,
    manifestCode:
      falseRealBoundEvidence.manifestCode,
    ownerBindingDefinitionAuthorityId:
      falseRealBoundEvidence.ownerBindingDefinitionAuthorityId,
    ownerBindingName:
      falseRealBoundEvidence.ownerBindingName,
    sourceBindingDefinitionAuthority:
      falseRealCanonicalOwnerBindingAuthority,
  };

  const falseDependencyAssociation =
    falseAssociationModule
      .deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        dependency.authorities,
        [falseRealCanonicalOwnerBindingAuthority],
        [falseAssociationOwnerEvidence],
      );

  if (falseDependencyAssociation.status !== "ready") {
    throw new Error(
      "FALSE real dependency association was not ready through proven canonical OWNER authority reuse: " +
        JSON.stringify(falseDependencyAssociation),
    );
  }

  if (falseDependencyAssociation.domains.length !== 1) {
    throw new Error(
      "FALSE real dependency association expected exactly one domain: " +
        JSON.stringify(falseDependencyAssociation),
    );
  }

  const falseAssociationDomain =
    falseDependencyAssociation.domains[0];

  if (
    falseAssociationDomain.associationState !==
      "resolved_exact_action_binding_provenance"
  ) {
    throw new Error(
      "FALSE real dependency association did not resolve exact action/binding provenance: " +
        JSON.stringify(falseAssociationDomain),
    );
  }

  if (
    falseAssociationDomain.bindingDefinitionCandidates.length !== 1 ||
    falseAssociationDomain.bindingDefinitionCandidates[0] !==
      falseRealCanonicalOwnerBindingAuthority
  ) {
    throw new Error(
      "FALSE real association did not preserve exact canonical OWNER authority object identity",
    );
  }

  if (
    falseAssociationDomain.sourcePostFinalOwnerBoundConditionEvidence !==
      falseAssociationOwnerEvidence
  ) {
    throw new Error(
      "FALSE real association did not preserve exact owner evidence object identity",
    );
  }

  if (
    falseAssociationDomain.selectedDependencyActionAuthorityId !== null ||
    falseAssociationDomain.dependencyEndpointRole !== null ||
    falseAssociationDomain.governance.endpointDirectionResolved !== false ||
    falseAssociationDomain.governance.endpointBindingPerformed !== false ||
    falseAssociationDomain.governance.dependencySemanticsResolved !== false ||
    falseAssociationDomain.governance.activationReadinessResolved !== false ||
    falseAssociationDomain.governance.runtimeBindingExecuted !== false ||
    falseAssociationDomain.governance.graphMutationPerformed !== false
  ) {
    throw new Error(
      "FALSE real association crossed a prohibited semantic boundary: " +
        JSON.stringify(falseAssociationDomain),
    );
  }

  if (
    falseTerminalEnvelope.rootTruthDisposition !== "resolved_false" ||
    falseTerminalEnvelope.finalDecisionDisposition !== "rejected"
  ) {
    throw new Error(
      "FALSE truth changed before execution readiness evidence boundary",
    );
  }

  const falseExecutionReadiness =
    falseExecutionReadinessModule
      .deriveCanonicalRuntimeExecutionReadinessEvidenceBoundaryV1({
        actionCandidateBridge:
          falseActionCandidateBridge,
        dependencyActionBindingAssociation:
          falseDependencyAssociation,
      });

  if (falseExecutionReadiness.status !== "ready") {
    throw new Error(
      "FALSE real execution readiness evidence boundary was not ready: " +
        JSON.stringify(falseExecutionReadiness),
    );
  }

  if (falseExecutionReadiness.evidence.length !== 1) {
    throw new Error(
      "FALSE real execution readiness expected exactly one evidence domain: " +
        JSON.stringify(falseExecutionReadiness),
    );
  }

  const falseExecutionReadinessEvidence =
    falseExecutionReadiness.evidence[0];

  if (
    falseExecutionReadinessEvidence.sourceActionCandidateBridge !==
      falseActionCandidateBridge.bridge
  ) {
    throw new Error(
      "FALSE readiness evidence lost exact action candidate bridge object identity",
    );
  }

  if (
    falseExecutionReadinessEvidence
      .sourceDependencyActionBindingAssociation !==
      falseAssociationDomain
  ) {
    throw new Error(
      "FALSE readiness evidence lost exact dependency association object identity",
    );
  }

  if (
    falseExecutionReadinessEvidence
      .sourceActionCandidateBridge
      .sourceTerminalEnvelope !==
      falseTerminalEnvelope
  ) {
    throw new Error(
      "FALSE readiness evidence lost exact terminal envelope object identity",
    );
  }

  if (
    falseExecutionReadinessEvidence
      .sourceActionCandidateBridge
      .sourceTerminalEnvelope
      .rootTruthDisposition !== "resolved_false" ||
    falseExecutionReadinessEvidence
      .sourceActionCandidateBridge
      .sourceTerminalEnvelope
      .finalDecisionDisposition !== "rejected"
  ) {
    throw new Error(
      "FALSE readiness evidence changed resolved FALSE/rejected terminal truth",
    );
  }

  if (
    falseExecutionReadinessEvidence.governance
      .finalWhereTruthRecomputed !== false ||
    falseExecutionReadinessEvidence.governance
      .postOwnerEvidenceRecomputed !== false ||
    falseExecutionReadinessEvidence.governance
      .actionSelected !== false ||
    falseExecutionReadinessEvidence.governance
      .singletonPromotedToWinner !== false ||
    falseExecutionReadinessEvidence.governance
      .activationPermissionDerived !== false ||
    falseExecutionReadinessEvidence.governance
      .executableStateDerived !== false ||
    falseExecutionReadinessEvidence.governance
      .schedulableStateDerived !== false ||
    falseExecutionReadinessEvidence.governance
      .endpointDirectionResolved !== false ||
    falseExecutionReadinessEvidence.governance
      .endpointBindingPerformed !== false ||
    falseExecutionReadinessEvidence.governance
      .dependencySemanticsResolved !== false ||
    falseExecutionReadinessEvidence.governance
      .runtimeActionExecuted !== false ||
    falseExecutionReadinessEvidence.governance
      .schedulerInvoked !== false ||
    falseExecutionReadinessEvidence.governance
      .canonicalEdgeGenerated !== false ||
    falseExecutionReadinessEvidence.governance
      .graphMutationPerformed !== false
  ) {
    throw new Error(
      "FALSE readiness evidence crossed a prohibited semantic boundary: " +
        JSON.stringify(falseExecutionReadinessEvidence.governance),
    );
  }

  console.log(
    "FALSE_REAL_ASSOCIATION_READINESS=" +
      JSON.stringify({
        rootTruthDisposition:
          falseExecutionReadinessEvidence
            .sourceActionCandidateBridge
            .sourceTerminalEnvelope
            .rootTruthDisposition,
        finalDecisionDisposition:
          falseExecutionReadinessEvidence
            .sourceActionCandidateBridge
            .sourceTerminalEnvelope
            .finalDecisionDisposition,
        associationState:
          falseAssociationDomain.associationState,
        canonicalOwnerAuthorityObjectIdentityPreserved:
          falseAssociationDomain.bindingDefinitionCandidates[0] ===
          falseRealCanonicalOwnerBindingAuthority,
        readinessEvidenceCount:
          falseExecutionReadiness.evidence.length,
        actionSelected:
          falseExecutionReadinessEvidence.governance.actionSelected,
        activationPermissionDerived:
          falseExecutionReadinessEvidence.governance
            .activationPermissionDerived,
        executableStateDerived:
          falseExecutionReadinessEvidence.governance
            .executableStateDerived,
        runtimeActionExecuted:
          falseExecutionReadinessEvidence.governance
            .runtimeActionExecuted,
        graphMutationPerformed:
          falseExecutionReadinessEvidence.governance
            .graphMutationPerformed,
      }),
  );
  // FALSE_REAL_ASSOCIATION_READINESS_PROBE_END
  // A21026_REAL_ACTION_CANDIDATE_BRIDGE_PROBE_END
  console.log(
    "FALSE_REAL_TERMINAL_AGGREGATION=" +
      JSON.stringify({
        finalRootStatus:
          falseFinalRoot.status,

        rootTruthDisposition:
          falseFinalRoot.decisions[0].rootTruthDisposition,

        decisionDisposition:
          falseFinalRoot.decisions[0].decisionDisposition,

        survivorStatus:
          falsePostOwnerSurvivor.status,

        boundEvidenceStatus:
          falsePostOwnerBoundEvidence.status,

        exactDecisionObjectIdentityPreserved:
          falsePostOwnerBoundEvidence
            .domainBoundConditionEvidence[0]
            .sourceFinalWhereDecision ===
          falseFinalRoot.decisions[0],

        aggregationStatus:
          falseTerminalAggregation.status,

        envelopeCount:
          falseTerminalAggregation.aggregation.envelopeCount,

        terminalRootTruthDisposition:
          falseTerminalAggregation
            .aggregation
            .terminalEnvelopes[0]
            .rootTruthDisposition,

        terminalFinalDecisionDisposition:
          falseTerminalAggregation
            .aggregation
            .terminalEnvelopes[0]
            .finalDecisionDisposition,

        runtimeActionExecuted:
          falseTerminalAggregation
            .aggregation
            .governance
            .runtimeActionExecuted,

        schedulerInvoked:
          falseTerminalAggregation
            .aggregation
            .governance
            .schedulerInvoked,

        graphMutationPerformed:
          falseTerminalAggregation
            .aggregation
            .governance
            .graphMutationPerformed,
      }),
  );
  // A21021_REAL_TERMINAL_AGGREGATION_PROBE_END
  console.log("FALSE_OWNER_FINAL_ROOT=" + JSON.stringify({
    ownerStatus: falseOwner.status,
    finalRootStatus: falseFinalRoot.status,
    finalRootDecisionCount: falseFinalRoot.decisions.length,
    rootTruthDisposition: falseFinalRoot.decisions[0].rootTruthDisposition,
    decisionDisposition: falseFinalRoot.decisions[0].decisionDisposition,
  }));
  // FALSE_OWNER_FINAL_ROOT_REGRESSION_END
// B2_TRANSITIVE_BLOCKING_REGRESSION_END
});
