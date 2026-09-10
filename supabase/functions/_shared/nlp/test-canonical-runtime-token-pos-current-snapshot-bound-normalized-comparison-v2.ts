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

function assert(
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

      referencedBindingDefinitionAuthorityId: "binding-definition:tokenRef",

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

  assert(
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

import {
  type CanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1 as createCanonicalLanguageGraphV1_V2,
  type GraphStatus as GraphStatus_V2,
  type LanguageGraphEdgeV1 as LanguageGraphEdgeV1_V2,
  type LanguageGraphNodeV1 as LanguageGraphNodeV1_V2,
} from "./canonical-language-graph-core-v1.ts";

import {
  buildCanonicalSurfaceDocumentV1 as buildCanonicalSurfaceDocumentV1_V2,
  type CanonicalSurfaceDocumentV1,
} from "./canonical-surface-boundary-v1.ts";

import {
  deriveCanonicalGraphSnapshotIdentityAuthorityV1,
} from "./canonical-graph-snapshot-identity-authority-v1.ts";

import {
  type CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1,
  deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1,
} from "./canonical-runtime-token-pos-normalized-label-eq-authority-v1.ts";

import type {
  CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1
    as CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1_V2,
  CanonicalRuntimeTokenPosStringOperandCompatibilityV1
    as CanonicalRuntimeTokenPosStringOperandCompatibilityV1_V2,
} from "./canonical-runtime-token-pos-string-operand-compatibility-v1.ts";

import type {
  CanonicalPosFactOwnershipAuthorityResultV1,
} from "./canonical-pos-fact-ownership-authority-v1.ts";

import {
  deriveCanonicalPosFactOwnershipAuthoritiesV1,
} from "./canonical-pos-fact-ownership-authority-v1.ts";

import {
  deriveCanonicalTokenPosPropertyCapabilityV1,
} from "./canonical-token-pos-property-capability-v1.ts";

import {
  deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1,
} from "./canonical-token-pos-graph-bound-normalized-label-projection-v1.ts";
import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonResultV2,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2,
} from "./canonical-runtime-token-pos-current-snapshot-bound-normalized-comparison-v2.ts";

function v2BaseGraph() {
  const graph = createCanonicalLanguageGraphV1_V2(
    buildCanonicalSurfaceDocumentV1_V2(
      "x",
    ),
  );

  const token = graph.nodes.find(
    (node) =>
      node.type ===
        "token",
  );

  v2Assert(
    token !==
      undefined,
    "surface token missing",
  );

  return {
    graph,
    token,
  };
}

function v2PosFixture(
  options: {
    labels?: string[];
    statuses?: GraphStatus_V2[];
    alternativeStatus?:
      | "open"
      | "resolved"
      | "blocked";
    resolvedIndices?: number[];
  } = {},
) {
  const base = v2BaseGraph();

  const labels = options.labels ??
    [
      "noun",
      "adjective",
    ];

  const statuses = options.statuses ??
    labels.map(
      () => "candidate" as const,
    );

  const alternativeStatus = options.alternativeStatus ??
    "open";

  const resolvedIndices = options.resolvedIndices ??
    [];

  v2Assert(
    labels.length ===
      statuses.length,
    "v2PosFixture labels/status length mismatch",
  );

  const nodes: LanguageGraphNodeV1_V2[] = [];
  const edges: LanguageGraphEdgeV1_V2[] = [];
  const evidence: NonNullable<
    CanonicalLanguageGraphV1["evidence"]
  > = [];

  const memberIds: string[] = [];

  labels.forEach(
    (
      label,
      index,
    ) => {
      const lexicalId = `lex:${index}`;
      const posId = `pos:${index}`;

      const lexicalEvidenceId = `e:lex:${index}`;
      const posEvidenceId = `e:pos:${index}`;

      nodes.push({
        id: lexicalId,

        type: "lexical_reading",

        subtype: "lexical_candidate",

        status: "candidate",

        span: {
          ...base.token.span,
        },

        features: {
          sourcePos: label,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          lexicalEvidenceId,
        ],

        provenanceIds: [
          "prov:v2PosFixture",
        ],
      });

      nodes.push({
        id: posId,

        type: "lexical_reading",

        subtype: "pos_candidate",

        status: statuses[index],

        span: {
          ...base.token.span,
        },

        features: {
          pos: label,

          contributingLexicalReadingIds: [
            lexicalId,
          ],

          sourcePosIsEvidenceNotAuthority: true,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          posEvidenceId,
        ],

        provenanceIds: [
          "prov:v2PosFixture",
        ],
      });

      edges.push({
        id: `edge:lexical:${index}`,

        relation: "lexical_reading_of",

        sourceId: lexicalId,

        targetId: base.token.id,

        status: "candidate",

        features: {},

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          lexicalEvidenceId,
        ],

        provenanceIds: [
          "prov:v2PosFixture",
        ],
      });

      edges.push({
        id: `edge:pos:${index}`,

        relation: "pos_of",

        sourceId: posId,

        targetId: base.token.id,

        status: statuses[index],

        features: {
          pos: label,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          posEvidenceId,
        ],

        provenanceIds: [
          "prov:v2PosFixture",
        ],
      });

      edges.push({
        id: `support:${index}`,

        relation: "lexical_supports_pos",

        sourceId: lexicalId,

        targetId: posId,

        status: "candidate",

        features: {
          pos: label,
        },

        producer: "canonical_candidate_lattice_v1",

        evidenceIds: [
          posEvidenceId,
        ],

        provenanceIds: [
          "prov:v2PosFixture",
        ],
      });

      evidence.push(
        {
          id: lexicalEvidenceId,

          kind: "lexical",

          status: "supports",

          targetIds: [
            lexicalId,
            base.token.id,
          ],

          payload: {},

          producer: "canonical_candidate_lattice_v1",

          provenanceIds: [
            "prov:v2PosFixture",
          ],
        },
        {
          id: posEvidenceId,

          kind: "lexical",

          status: "supports",

          targetIds: [
            posId,
            lexicalId,
            base.token.id,
          ],

          payload: {
            pos: label,
          },

          producer: "canonical_candidate_lattice_v1",

          provenanceIds: [
            "prov:v2PosFixture",
          ],
        },
      );

      memberIds.push(
        posId,
      );
    },
  );

  const resolvedMemberIds = resolvedIndices.map(
    (index) => memberIds[index],
  );

  const graph: CanonicalLanguageGraphV1 = {
    ...base.graph,

    nodes: [
      ...base.graph.nodes,
      ...nodes,
    ],

    edges: [
      ...base.graph.edges,
      ...edges,
    ],

    evidence: [
      ...(base.graph.evidence ?? []),
      ...evidence,
    ],

    provenance: [
      ...(base.graph.provenance ?? []),
      {
        id: "prov:v2PosFixture",
        sourceType: "system",
        sourceId: "v2PosFixture",
      },
    ],

    alternativeSets: labels.length ===
        0
      ? []
      : [
        {
          id: `alt:pos:${base.token.id}`,

          memberIds,

          resolvedMemberIds,

          status: alternativeStatus,

          reason: "v2PosFixture",
        },
      ],
  };

  const ownership = deriveCanonicalPosFactOwnershipAuthoritiesV1(
    graph,
  );

  v2Assert(
    ownership.status ===
      "ready",
    `POS ownership v2PosFixture failed: ${
      JSON.stringify(
        ownership,
      )
    }`,
  );

  const capability = deriveCanonicalTokenPosPropertyCapabilityV1(
    ownership,
  );

  v2Assert(
    capability.status ===
      "ready",
    "POS capability v2PosFixture failed",
  );

  return {
    graph,
    tokenId: base.token.id,
    ownership,
    capability,
  };
}

type GraphBoundArgs = Parameters<
  typeof deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1
>;

function asRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return (
      typeof value ===
        "object" &&
      value !==
        null &&
      !Array.isArray(
        value,
      )
    )
    ? value as Record<string, unknown>
    : undefined;
}

function exactFixtureParts(
  source: unknown,
): {
  graph: GraphBoundArgs[0];

  tokenNodeId: GraphBoundArgs[1];

  ownership: GraphBoundArgs[2];

  capability: GraphBoundArgs[3];
} {
  const record = asRecord(
    source,
  );

  v2Assert(
    record !==
      undefined,
    "v2PosFixture result is not an object",
  );

  const values = Object.values(
    record,
  );

  const graph = values.find(
    (value) =>
      asRecord(
        value,
      )?.version ===
        "canonical-language-graph-v1",
  ) as GraphBoundArgs[0] | undefined;

  // The reused A3.3.2d v2PosFixture owns the canonical token inside
  // its canonical graph. It is not required to expose that node as
  // a separate top-level v2PosFixture property.
  //
  // Read the exact canonical token occurrence from the v2PosFixture graph
  // itself, matching the ownership model used by A3.3.2d.
  const token = graph
    ?.nodes
    .find(
      (node) =>
        node.type ===
          "token",
    );

  const ownership = values.find(
    (value) =>
      asRecord(
        value,
      )?.producer ===
        "canonical_pos_fact_ownership_authority_v1",
  ) as GraphBoundArgs[2] | undefined;

  const capability = values.find(
    (value) =>
      asRecord(
        value,
      )?.producer ===
        "canonical_token_pos_property_capability_v1",
  ) as GraphBoundArgs[3] | undefined;

  v2Assert(
    graph !==
      undefined,
    "v2PosFixture canonical graph missing",
  );

  const tokenRecord = asRecord(
    token,
  );

  v2Assert(
    tokenRecord !==
        undefined &&
      typeof tokenRecord.id ===
        "string",
    "v2PosFixture token missing",
  );

  v2Assert(
    ownership !==
      undefined,
    "v2PosFixture POS ownership result missing",
  );

  v2Assert(
    capability !==
      undefined,
    "v2PosFixture token POS capability result missing",
  );

  return {
    graph,

    tokenNodeId: tokenRecord.id,

    ownership,

    capability,
  };
}

function runGraphBound(
  options: Parameters<typeof v2PosFixture>[0] = {},
) {
  const source = v2PosFixture(
    options,
  );

  const parts = exactFixtureParts(
    source,
  );

  const result = deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV1(
    parts.graph,
    parts.tokenNodeId,
    parts.ownership,
    parts.capability,
  );

  return {
    ...parts,
    result,
  };
}

function v2ExpectedCandidate(
  options: {
    id?: string;
    siteKey?: string;
    operator?: string;
    pos?: string;
  } = {},
): CanonicalRuntimeTokenPosStringOperandCompatibilityV1_V2 {
  return {
    id: options.id ??
      "string-operand:1",

    status: "candidate",

    leftRightSiteAuthorityId: "left-right:1",

    tokenPosSuffixCompatibilityId: "suffix:1",

    whereReferenceRootAuthorityId: "root:1",

    whereShapeAuthorityId: "shape:1",

    ownerBindingDefinitionAuthorityId: "binding:owner",

    referencedBindingDefinitionAuthorityId: "binding:token",

    manifestId: "manifest:1",

    manifestCode: "manifest.one",

    ownerBindingName: "owner",

    referencedBindingName: "token",

    referenceSiteKey: options.siteKey ??
      "root:1#$#token.pos",

    referencePath: "$",

    referenceExpression: "token.pos",

    runtimeSuffix: ".pos",

    entityCompatibilityId: "entity:token",

    runtimeEntityLabel: "token",

    canonicalNodeType: "token",

    tokenPosCapabilityId: "pos-capability:1",

    canonicalPropertyDomain: "canonical_token_occurrence",

    canonicalPropertyKind: "pos_hypothesis_set",

    operatorLabelOpaque: options.operator ??
      "eq",

    rightOperandStructuralKind: "string",

    posLabelInputOpaque: options.pos ??
      "verb",

    governance: {
      exactLeftRightSiteAuthorityRequired: true,

      exactTokenPosSuffixCompatibilityRequired: true,

      exactReferenceRootAuthorityIdentityMatch: true,

      exactWhereShapeAuthorityIdentityMatch: true,

      exactOwnerBindingIdentityMatch: true,

      exactReferencedBindingIdentityMatch: true,

      exactManifestIdentityMatch: true,

      exactBindingNameMatch: true,

      exactReferencePathMatch: true,

      exactReferenceExpressionMatch: true,

      exactReferenceSiteKeyMatch: true,

      exactRuntimePosSuffixRequired: true,

      exactCanonicalTokenCompatibilityRequired: true,

      exactTokenPosHypothesisSetCapabilityRequired: true,

      stringRightOperandRequired: true,

      stringOperandPreservedOpaque: true,

      posLabelInputCompatibilityOnly: true,

      operatorLabelPreservedOpaque: true,

      nonStringOperandRejectedByThisCapability: true,

      posVocabularyValidated: false,

      operandKnownCanonicalPosLabel: false,

      operandNormalizationPerformed: false,

      caseFoldingPerformed: false,

      operatorSemanticsResolved: false,

      whereEqExecuted: false,

      posHypothesisRead: false,

      posHypothesisSelected: false,

      posLabelCompared: false,

      comparisonPerformed: false,

      comparisonTruthResolved: false,

      learnerErrorClassified: false,

      runtimeBindingExecuted: false,

      occurrenceEnumerationPerformed: false,

      runtimeScopeExecutionPerformed: false,

      cardinalityEnforcementPerformed: false,

      occurrenceBindingPerformed: false,

      canonicalDependencyEdgeGenerated: false,

      grammaticalFunctionResolved: false,

      complementArgumentAttachmentResolved: false,

      realizesSlotGenerated: false,

      graphMutationPerformed: false,

      candidateOnly: true,

      frozenGrammarReadOnly: true,
    },
  };
}

function v2ExpectedInputResult(
  v2ExpectedCandidates:
    CanonicalRuntimeTokenPosStringOperandCompatibilityV1_V2[],
): CanonicalRuntimeTokenPosStringOperandCompatibilityResultV1_V2 {
  return {
    producer: "canonical_runtime_token_pos_string_operand_compatibility_v1",

    producerVersion: "1",

    status: "ready",

    candidates: v2ExpectedCandidates,

    consideredTokenPosLeftRightSiteCount: v2ExpectedCandidates.length,

    unsupportedOperandSiteIds: [],

    unmatchedStringOperandSiteIds: [],

    tokenPosSuffixCandidatesWithoutStringOperandSiteKeys: [],

    blockingReasons: [],
  };
}

function v2Assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function replaceExactStringsInPlace(
  value: unknown,
  replacements: ReadonlyMap<string, string>,
  seen: Set<object> = new Set<object>(),
): void {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return;
  }

  const object = value as Record<string, unknown>;

  if (
    seen.has(
      object,
    )
  ) {
    return;
  }

  seen.add(
    object,
  );

  for (
    const key of Object.keys(
      object,
    )
  ) {
    const member = object[key];

    if (
      typeof member ===
        "string"
    ) {
      const replacement = replacements.get(
        member,
      );

      if (
        replacement !==
          undefined
      ) {
        object[key] = replacement;
      }

      continue;
    }

    replaceExactStringsInPlace(
      member,
      replacements,
      seen,
    );
  }
}

type V2PosOptions = {
  labels?: string[];

  statuses?: GraphStatus_V2[];

  alternativeStatus?:
    | "open"
    | "resolved"
    | "blocked";

  resolvedIndices?: number[];
};

type V2InputOptions = {
  pos?: V2PosOptions;

  expectedPos?: string;

  domainMode?:
    | "one"
    | "none"
    | "two";

  occurrenceMode?:
    | "one"
    | "none"
    | "three";
};

async function makeV2Inputs(
  options: V2InputOptions = {},
): Promise<{
  surface: CanonicalSurfaceDocumentV1;

  graph: CanonicalLanguageGraphV1;

  tokenNodeId: string;

  currentDomainResult: ReturnType<
    typeof deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1
  >;

  expectedResult: CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1;
}> {
  const posFixture = v2PosFixture(
    options.pos ??
      {},
  );

  const graph = posFixture.graph as CanonicalLanguageGraphV1;

  const token = posFixture.graph.nodes.find(
    (node) =>
      node.id ===
        posFixture.tokenId,
  );

  v2Assert(
    token !== undefined &&
      token.type === "token",
    "V2 POS fixture token missing",
  );

  const surface = buildCanonicalSurfaceDocumentV1_V2(
    "x",
  );

  const sentence = graph.nodes.find(
    (node) =>
      node.type ===
        "sentence",
  );

  v2Assert(
    sentence !==
      undefined,
    "V2 Golden graph has no sentence node",
  );

  const snapshotResult = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    surface,
    graph,
  );

  v2Assert(
    snapshotResult.status ===
        "ready" &&
      snapshotResult.authority !==
        undefined,
    `snapshot fixture not ready: ${
      JSON.stringify(
        snapshotResult,
      )
    }`,
  );

  const snapshot = snapshotResult.authority;

  const makeOccurrences = (
    mode:
      | "one"
      | "none"
      | "three",
  ) => {
    if (
      mode ===
        "none"
    ) {
      return [];
    }

    if (
      mode ===
        "three"
    ) {
      return [
        occurrence(
          "1",
          token.id,
        ),
        occurrence(
          "2",
          token.id,
        ),
        occurrence(
          "3",
          token.id,
        ),
      ];
    }

    return [
      occurrence(
        "1",
        token.id,
      ),
    ];
  };

  const occurrenceMode = options.occurrenceMode ??
    "one";

  const domainMode = options.domainMode ??
    "one";

  const domains = domainMode ===
      "none"
    ? [
      pair(
        "1",
        domain(
          "1",
          makeOccurrences(
            occurrenceMode,
          ),
        ),
        {
          siteMatch: false,

          matchedTokenNodeId: null,
        },
      ),
    ]
    : domainMode ===
        "two"
    ? [
      pair(
        "1",
        domain(
          "1",
          makeOccurrences(
            occurrenceMode,
          ),
        ),
        {
          matchedTokenNodeId: occurrenceMode ===
              "none"
            ? null
            : token.id,
        },
      ),

      pair(
        "2",
        domain(
          "2",
          makeOccurrences(
            occurrenceMode,
          ).map(
            (
              item,
              index,
            ) => ({
              ...item,

              snapshotTokenOccurrenceIdentityId: `snapshot-token:domain2:${
                index + 1
              }`,
            }),
          ),
        ),
        {
          matchedTokenNodeId: occurrenceMode ===
              "none"
            ? null
            : token.id,
        },
      ),
    ]
    : [
      pair(
        "1",
        domain(
          "1",
          makeOccurrences(
            occurrenceMode,
          ),
        ),
        {
          matchedTokenNodeId: occurrenceMode ===
              "none"
            ? null
            : token.id,
        },
      ),
    ];

  const currentApplicability = fixture(
    domains,
  );

  replaceExactStringsInPlace(
    currentApplicability,
    new Map<string, string>([
      [
        "snapshot:1",
        snapshot.snapshotIdentityId,
      ],
      [
        "snapshot-authority:1",
        snapshot.authorityId,
      ],
      [
        "snapshot-sha:1",
        snapshot.snapshotSha256,
      ],
      [
        "surface-sha:1",
        snapshot.surfaceSnapshotSha256,
      ],
      [
        "graph-sha:1",
        snapshot.graphStateSha256,
      ],
      [
        "graph-document:1",
        graph.documentId,
      ],
      [
        "sentence:1",
        sentence.id,
      ],
      [
        "token:1",
        token.id,
      ],
    ]),
  );

  const currentDomainResult =
    deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
      currentApplicability,
    );

  v2Assert(
    currentDomainResult.status ===
      "ready",
    `CURRENT domain fixture not ready: ${
      JSON.stringify(
        currentDomainResult,
      )
    }`,
  );

  const compatibility = {
    ...v2ExpectedCandidate({
      pos: options.expectedPos ??
        "verb",
    }),

    referencedBindingDefinitionAuthorityId: "binding-definition:tokenRef",

    manifestId: "manifest:1",

    manifestCode: "manifest-code-1",

    referencedBindingName: "tokenRef",
  } as CanonicalRuntimeTokenPosStringOperandCompatibilityV1_V2;

  const expectedResult =
    deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(
      v2ExpectedInputResult([
        compatibility,
      ]),
    );

  v2Assert(
    expectedResult.status ===
        "ready" &&
      expectedResult.authorities.length ===
        1,
    `A3.3.4a expected fixture not ready: ${
      JSON.stringify(
        expectedResult,
      )
    }`,
  );

  return {
    surface,
    graph,
    tokenNodeId: token.id,
    currentDomainResult,
    expectedResult,
  };
}

async function runV2(
  options: V2InputOptions = {},
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonResultV2
> {
  const input = await makeV2Inputs(
    options,
  );

  return await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
    input.surface,
    input.graph,
    input.expectedResult,
    input.currentDomainResult,
  );
}

Deno.test(
  "v1.46 V2.1 producer version and public arity are frozen",
  () => {
    v2Assert(
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_V2 ===
          "canonical_runtime_token_pos_current_snapshot_bound_normalized_comparison_v2" &&
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_NORMALIZED_COMPARISON_VERSION_V2 ===
          "2" &&
        deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2
            .length ===
          4,
      "V2 producer/version/public API drift",
    );
  },
);

Deno.test(
  "v1.46 V2.2 exact snapshot and exact A3.3.4a authority produce snapshot-bound occurrence comparison",
  async () => {
    const input = await makeV2Inputs({
      pos: {
        labels: [
          "verb",
        ],

        statuses: [
          "resolved",
        ],

        alternativeStatus: "resolved",

        resolvedIndices: [
          0,
        ],
      },
    });

    const result =
      await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
        input.surface,
        input.graph,
        input.expectedResult,
        input.currentDomainResult,
      );

    v2Assert(
      result.status ===
        "ready",
      `exact V2 fixture blocked: ${
        JSON.stringify(
          result,
        )
      }`,
    );

    const domain = result.authority
      .domainComparisons[0];

    const occurrenceComparison = domain
      ?.occurrenceComparisons[0];

    v2Assert(
      result.authority.domainComparisonCount ===
          1 &&
        domain
            ?.expectedNormalizedPosLabel ===
          "verb" &&
        occurrenceComparison
            ?.snapshotTokenOccurrenceIdentityId ===
          "snapshot-token:1" &&
        occurrenceComparison.tokenNodeId ===
          input.tokenNodeId &&
        occurrenceComparison.comparisonState ===
          "explicit_resolved_match" &&
        occurrenceComparison.booleanTruth ===
          true &&
        occurrenceComparison.booleanTruthResolved ===
          true,
      `exact snapshot-bound comparison failed: ${
        JSON.stringify(
          result,
        )
      }`,
    );
  },
);

Deno.test(
  "v1.46 V2.3 same graphDocumentId with changed graph state is a different snapshot and blocks",
  async () => {
    const input = await makeV2Inputs({
      pos: {
        labels: [
          "verb",
        ],

        statuses: [
          "candidate",
        ],

        alternativeStatus: "resolved",

        resolvedIndices: [
          0,
        ],
      },
    });

    const changedGraph = {
      ...input.graph,

      producerState: {
        ...input.graph
          .producerState,

        v2GoldenSnapshotMutation: {
          version: "golden",

          factsAdded: 0,

          factsRejected: 0,
        },
      },
    } as unknown as CanonicalLanguageGraphV1;

    const result =
      await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
        input.surface,
        changedGraph,
        input.expectedResult,
        input.currentDomainResult,
      );

    v2Assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "snapshot_identity:current_domain_mismatch",
        ),
      `changed snapshot accepted: ${
        JSON.stringify(
          result,
        )
      }`,
    );
  },
);

Deno.test(
  "v1.46 V2.4 forged CURRENT-domain ready wrapper cannot replace CLOSED rederivation",
  async () => {
    const input = await makeV2Inputs();

    v2Assert(
      input.currentDomainResult.status ===
        "ready",
      "fixture not ready",
    );

    const forged = {
      ...input.currentDomainResult,

      authority: {
        ...input.currentDomainResult
          .authority,

        sentenceIndex: input.currentDomainResult
          .authority
          .sentenceIndex +
          1,
      },
    } as typeof input.currentDomainResult;

    const result =
      await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
        input.surface,
        input.graph,
        input.expectedResult,
        forged,
      );

    v2Assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.includes(
          "current_domain_result:does_not_match_independent_rederivation",
        ),
      `forged CURRENT-domain wrapper accepted: ${
        JSON.stringify(
          result,
        )
      }`,
    );
  },
);

Deno.test(
  "v1.46 V2.5 unsafe semanticized expected authority blocks instead of becoming comparison truth",
  async () => {
    const input = await makeV2Inputs();

    v2Assert(
      input.expectedResult.status ===
        "ready",
      "expected fixture not ready",
    );

    const authority = input.expectedResult
      .authorities[0];

    const forgedExpected = {
      ...input.expectedResult,

      authorities: [
        {
          ...authority,

          governance: {
            ...authority
              .governance,

            actualPosLabelCompared: true,
          },
        },
      ],
    } as unknown as CanonicalRuntimeTokenPosNormalizedLabelEqAuthorityResultV1;

    const result =
      await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
        input.surface,
        input.graph,
        forgedExpected,
        input.currentDomainResult,
      );

    v2Assert(
      result.status ===
          "blocked" &&
        result.blockingReasons.some(
          (reason) =>
            reason.includes(
              "unsafe_contract",
            ),
        ),
      `unsafe expected authority accepted: ${
        JSON.stringify(
          result,
        )
      }`,
    );
  },
);

Deno.test(
  "v1.46 V2.6 seven-state comparison semantics remain exact",
  async () => {
    const cases: {
      name: string;

      pos: V2PosOptions;

      expectedPos: string;

      expectedState:
        | "no_fact"
        | "blocked"
        | "open_match_possible"
        | "open_no_surviving_match"
        | "explicit_resolved_match"
        | "explicit_resolved_non_match"
        | "explicit_resolved_mixed";

      expectedTruth:
        | boolean
        | null;

      expectedResolved: boolean;
    }[] = [
      {
        name: "no_fact",

        pos: {
          labels: [],
          statuses: [],
        },

        expectedPos: "verb",

        expectedState: "no_fact",

        expectedTruth: null,

        expectedResolved: false,
      },

      {
        name: "blocked",

        pos: {
          labels: [
            "verb",
          ],

          statuses: [
            "blocked",
          ],

          alternativeStatus: "blocked",
        },

        expectedPos: "verb",

        expectedState: "blocked",

        expectedTruth: null,

        expectedResolved: false,
      },

      {
        name: "open_match_possible",

        pos: {
          labels: [
            "verb",
            "noun",
          ],

          statuses: [
            "candidate",
            "candidate",
          ],

          alternativeStatus: "open",
        },

        expectedPos: "verb",

        expectedState: "open_match_possible",

        expectedTruth: null,

        expectedResolved: false,
      },

      {
        name: "open_no_surviving_match",

        pos: {
          labels: [
            "noun",
          ],

          statuses: [
            "candidate",
          ],

          alternativeStatus: "open",
        },

        expectedPos: "verb",

        expectedState: "open_no_surviving_match",

        expectedTruth: null,

        expectedResolved: false,
      },

      {
        name: "explicit_resolved_match",

        pos: {
          labels: [
            "verb",
          ],

          statuses: [
            "resolved",
          ],

          alternativeStatus: "resolved",

          resolvedIndices: [
            0,
          ],
        },

        expectedPos: "verb",

        expectedState: "explicit_resolved_match",

        expectedTruth: true,

        expectedResolved: true,
      },

      {
        name: "explicit_resolved_non_match",

        pos: {
          labels: [
            "noun",
          ],

          statuses: [
            "resolved",
          ],

          alternativeStatus: "resolved",

          resolvedIndices: [
            0,
          ],
        },

        expectedPos: "verb",

        expectedState: "explicit_resolved_non_match",

        expectedTruth: false,

        expectedResolved: true,
      },

      {
        name: "explicit_resolved_mixed",

        pos: {
          labels: [
            "verb",
            "noun",
          ],

          statuses: [
            "resolved",
            "resolved",
          ],

          alternativeStatus: "resolved",

          resolvedIndices: [
            0,
            1,
          ],
        },

        expectedPos: "verb",

        expectedState: "explicit_resolved_mixed",

        expectedTruth: null,

        expectedResolved: false,
      },
    ];

    for (
      const testCase of cases
    ) {
      const result = await runV2({
        pos: testCase.pos,

        expectedPos: testCase.expectedPos,
      });

      v2Assert(
        result.status ===
          "ready",
        `${testCase.name} blocked: ${
          JSON.stringify(
            result,
          )
        }`,
      );

      const occurrenceComparison = result.authority
        .domainComparisons[0]
        ?.occurrenceComparisons[0];

      v2Assert(
        occurrenceComparison
              ?.comparisonState ===
            testCase.expectedState &&
          occurrenceComparison
              .booleanTruth ===
            testCase.expectedTruth &&
          occurrenceComparison
              .booleanTruthResolved ===
            testCase.expectedResolved,
        `${testCase.name} truth-table drift: ${
          JSON.stringify(
            occurrenceComparison,
          )
        }`,
      );
    }
  },
);

Deno.test(
  "v1.46 V2.7 zero CURRENT domains remain a proven empty comparison-domain set",
  async () => {
    const result = await runV2({
      domainMode: "none",
    });

    v2Assert(
      result.status ===
          "ready" &&
        result.authority
            .domainComparisonCount ===
          0 &&
        result.authority
            .domainComparisons.length ===
          0,
      `zero domains were not preserved: ${
        JSON.stringify(
          result,
        )
      }`,
    );
  },
);

Deno.test(
  "v1.46 V2.8 singleton domain and singleton occurrence do not become winner or final binding",
  async () => {
    const result = await runV2({
      domainMode: "one",

      occurrenceMode: "one",
    });

    v2Assert(
      result.status ===
        "ready",
      "singleton fixture blocked",
    );

    const g = result.authority
      .governance;

    v2Assert(
      result.authority
            .domainComparisonCount ===
          1 &&
        result.authority
            .domainComparisons[0]
            .occurrenceCount ===
          1 &&
        g.domainCandidateWinnerSelected ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.occurrenceBindingPerformed ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false,
      "singleton comparison became downstream authority",
    );
  },
);

Deno.test(
  "v1.46 V2.9 multiple CURRENT domains preserve order and multiplicity",
  async () => {
    const result = await runV2({
      domainMode: "two",

      occurrenceMode: "one",
    });

    v2Assert(
      result.status ===
        "ready",
      `multi-domain fixture blocked: ${
        JSON.stringify(
          result,
        )
      }`,
    );

    v2Assert(
      result.authority
            .domainComparisonCount ===
          2 &&
        result.authority
            .domainComparisons.length ===
          2 &&
        result.authority
            .domainComparisons[0]
            .domainEvidenceId !==
          result.authority
            .domainComparisons[1]
            .domainEvidenceId &&
        result.authority
            .governance
            .domainCandidateWinnerSelected ===
          false,
      `domain multiplicity/order collapsed: ${
        JSON.stringify(
          result.authority
            .domainComparisons,
        )
      }`,
    );
  },
);

Deno.test(
  "v1.46 V2.10 zero occurrences remain zero and do not invent token truth",
  async () => {
    const result = await runV2({
      occurrenceMode: "none",
    });

    v2Assert(
      result.status ===
          "ready" &&
        result.authority
            .domainComparisonCount ===
          1 &&
        result.authority
            .domainComparisons[0]
            .occurrenceCount ===
          0 &&
        result.authority
            .domainComparisons[0]
            .occurrenceComparisons
            .length ===
          0,
      `zero occurrence domain invented comparison: ${
        JSON.stringify(
          result,
        )
      }`,
    );
  },
);

Deno.test(
  "v1.46 V2.11 repeated graph-local token keeps three distinct snapshot occurrence identities",
  async () => {
    const result = await runV2({
      occurrenceMode: "three",
    });

    v2Assert(
      result.status ===
        "ready",
      `three-occurrence fixture blocked: ${
        JSON.stringify(
          result,
        )
      }`,
    );

    const occurrences = result.authority
      .domainComparisons[0]
      .occurrenceComparisons;

    v2Assert(
      occurrences.length ===
          3 &&
        occurrences.every(
          (item) =>
            item.tokenNodeId ===
              occurrences[0]
                .tokenNodeId,
        ) &&
        occurrences
            .map(
              (item) =>
                item
                  .snapshotTokenOccurrenceIdentityId,
            )
            .join("|") ===
          "snapshot-token:1|snapshot-token:2|snapshot-token:3",
      `snapshot occurrence multiplicity collapsed: ${
        JSON.stringify(
          occurrences,
        )
      }`,
    );
  },
);

Deno.test(
  "v1.46 V2.12 semantic ceiling stops at per-occurrence POS comparison truth",
  async () => {
    const result = await runV2({
      pos: {
        labels: [
          "verb",
        ],

        statuses: [
          "resolved",
        ],

        alternativeStatus: "resolved",

        resolvedIndices: [
          0,
        ],
      },
    });

    v2Assert(
      result.status ===
        "ready",
      "semantic-ceiling fixture blocked",
    );

    const g = result.authority
      .governance;

    v2Assert(
      g.posComparisonExecuted ===
          true &&
        g.normalizedMemberEqualityPerformed ===
          true &&
        g.comparisonStateResolved ===
          true &&
        g.runtimeConditionTruthResolved ===
          false &&
        g.occurrenceFilteringPerformed ===
          false &&
        g.cardinalitySemanticsResolved ===
          false &&
        g.cardinalityEnforcementPerformed ===
          false &&
        g.domainCandidateWinnerSelected ===
          false &&
        g.occurrenceWinnerSelected ===
          false &&
        g.occurrenceBindingPerformed ===
          false &&
        g.finalRuntimeOccurrenceBindingPerformed ===
          false &&
        g.whereEvaluationPerformed ===
          false &&
        g.learnerErrorClassified ===
          false &&
        g.constraintPropagationInvoked ===
          false &&
        g.canonicalDependencyEdgeGenerated ===
          false &&
        g.clauseNodeGenerated ===
          false &&
        g.graphMutationPerformed ===
          false &&
        g.frozenGrammarReadOnly ===
          true,
      `V2 crossed semantic ceiling: ${
        JSON.stringify(
          g,
        )
      }`,
    );
  },
);

Deno.test(
  "v1.46 V2.13 production does not reconstruct historical A3.2.4c-T or call historical A3.3.4c",
  async () => {
    const source = await Deno.readTextFile(
      new URL(
        "./canonical-runtime-token-pos-current-snapshot-bound-normalized-comparison-v2.ts",
        import.meta.url,
      ),
    );

    const forbidden = [
      "deriveCanonicalRuntimeTokenPosDomainBoundNormalizedComparisonsV1(",
      "CanonicalRuntimeTokenSentenceDomainCompositionResultV1",
      "graphDocumentIdUsedAsSnapshotIdentity: true",
      "runtimeConditionTruthResolved: true",
      "occurrenceFilteringPerformed: true",
      "cardinalityEnforcementPerformed: true",
      "domainCandidateWinnerSelected: true",
      "occurrenceWinnerSelected: true",
      "finalRuntimeOccurrenceBindingPerformed: true",
      "whereEvaluationPerformed: true",
      "learnerErrorClassified: true",
      "graphMutationPerformed: true",
    ];

    for (
      const token of forbidden
    ) {
      v2Assert(
        !source.includes(
          token,
        ),
        `forbidden V2 semantic ownership detected: ${token}`,
      );
    }
  },
);

Deno.test(
  "v1.46 V2.14 deterministic derivation does not mutate exact evidence inputs",
  async () => {
    const input = await makeV2Inputs({
      pos: {
        labels: [
          "verb",
          "noun",
        ],

        statuses: [
          "candidate",
          "candidate",
        ],

        alternativeStatus: "open",
      },

      occurrenceMode: "three",
    });

    const surfaceBefore = JSON.stringify(
      input.surface,
    );

    const graphBefore = JSON.stringify(
      input.graph,
    );

    const expectedBefore = JSON.stringify(
      input.expectedResult,
    );

    const currentBefore = JSON.stringify(
      input.currentDomainResult,
    );

    const first =
      await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
        input.surface,
        input.graph,
        input.expectedResult,
        input.currentDomainResult,
      );

    const second =
      await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundNormalizedComparisonsV2(
        input.surface,
        input.graph,
        input.expectedResult,
        input.currentDomainResult,
      );

    v2Assert(
      first.status ===
          "ready" &&
        second.status ===
          "ready" &&
        JSON.stringify(
            first,
          ) ===
          JSON.stringify(
            second,
          ) &&
        JSON.stringify(
            input.surface,
          ) ===
          surfaceBefore &&
        JSON.stringify(
            input.graph,
          ) ===
          graphBefore &&
        JSON.stringify(
            input.expectedResult,
          ) ===
          expectedBefore &&
        JSON.stringify(
            input.currentDomainResult,
          ) ===
          currentBefore,
      "V2 derivation is nondeterministic or mutated source evidence",
    );
  },
);
