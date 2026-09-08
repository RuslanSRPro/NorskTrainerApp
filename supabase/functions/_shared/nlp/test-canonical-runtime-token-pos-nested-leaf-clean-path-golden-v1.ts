import {
  CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2,
} from "./canonical-runtime-token-pos-eq-condition-truth-semantic-capability-v2.ts";

import {
  deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2,
} from "./canonical-runtime-token-pos-condition-truth-composition-v2.ts";
import {
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2,
  CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2,
  type CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2,
} from "./canonical-token-pos-normalized-label-comparison-evidence-v2.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1,
  CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1,
  type CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1,
} from "./canonical-runtime-manifest-referenced-token-sentence-domain-snapshot-binding-v1.ts";

import {
  deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2,
} from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function same(
  left: unknown,
  right: unknown,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

type Site = {
  tokenPosSuffixPropertyCompatibilityId: string;
  leafRightOperandSiteAuthorityId: string;
  referencedBindingDefinitionAuthorityId: string;
  manifestId: string;
  manifestCode: string;
  referencedBindingName: string;
  runtimeSuffix: string;
  canonicalNodeType: string;
};

type OccurrenceSpec = {
  tokenNodeId: string;
  containmentEdgeId?: string;
  sentenceTokenIndex?: number;
  graphStatus?: string;
  snapshotTokenOccurrenceIdentityId?: string;
};

type DomainSpec = {
  snapshotBoundDomainId?: string;
  sourceDomainCandidateId?: string;
  sentenceNodeId?: string;
  sentenceIndex?: number;
  canonicalTokenDomainId?: string;
  site?: Partial<Site>;
  occurrences?: OccurrenceSpec[];
};

const BASE_SITE: Site = {
  tokenPosSuffixPropertyCompatibilityId: "fixture:token-pos-compatibility",

  leafRightOperandSiteAuthorityId: "fixture:leaf-site",

  referencedBindingDefinitionAuthorityId: "fixture:binding-definition",

  manifestId: "fixture:manifest-id",

  manifestCode: "fixture_manifest",

  referencedBindingName: "tokenRef",

  runtimeSuffix: ".pos",

  canonicalNodeType: "token",
};

function c2Governance() {
  return {
    exactGraphBoundActualProjectionRequired: true,

    exactExpectedNormalizedLabelAuthorityRequired: true,

    exactSemanticCapabilityRequired: true,

    actualGraphBoundProjectionObjectPreservedWithoutReconstruction: true,

    expectedAuthorityObjectPreservedWithoutReconstruction: true,

    normalizedActualLabelsConsumedNotReconstructed: true,

    normalizedExpectedLabelConsumedNotReconstructed: true,

    exactStringEqualityExecutedPerMember: true,

    comparisonExecuted: true,

    comparisonEvidenceStateProduced: true,

    comparisonEvidenceStateIsBooleanTruth: false,

    actualMemberIdentityPreserved: true,

    actualMemberStatusPreserved: true,

    actualMemberMultiplicityPreserved: true,

    actualMemberOrderPreserved: true,

    pairingSuppliedByCaller: true,

    runtimeSiteApplicabilityResolved: false,

    runtimeBindingPerformed: false,

    sentenceDomainConsumed: false,

    occurrenceFilteringPerformed: false,

    occurrenceBindingPerformed: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforcementPerformed: false,

    booleanTruthProduced: false,

    comparisonTruthResolved: false,

    runtimeConditionTruthResolved: false,

    posWinnerSelected: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    frozenGrammarReadOnly: true,
  } as const;
}

function domainCandidateGovernance() {
  return {
    exactReferencedTokenSentenceDomainResultRequired: true,

    exactReferencedTokenSentenceDomainCandidateRequired: true,

    exactCapturedSurfaceRequired: true,

    exactCapturedGraphRequired: true,

    exactSurfaceGraphProvenanceBindingRequired: true,

    exactSnapshotAuthorityRequired: true,

    exactCanonicalDirectTokenDomainsRecomputedFromCapturedGraph: true,

    exactCanonicalTokenDomainIdentityRequired: true,

    exactSentenceOccurrenceIdentityPreserved: true,

    exactDirectTokenOccurrenceContentRequired: true,

    exactContainmentEdgeIdentityPreserved: true,

    exactSentenceTokenIndexPreserved: true,

    exactTokenGraphStatusPreserved: true,

    occurrenceOrderPreserved: true,

    occurrenceMultiplicityPreserved: true,

    sourceCandidateObjectPreservedWithoutReconstruction: true,

    snapshotSentenceOccurrenceIdentityProduced: true,

    snapshotTokenOccurrenceIdentityProduced: true,

    snapshotIdentityAndSentenceNodeIdFormDomainOccurrenceIdentity: true,

    snapshotIdentityAndTokenNodeIdFormTokenOccurrenceIdentity: true,

    graphDocumentIdUsedAsSnapshotIdentity: false,

    sentenceIndexIsOccurrenceIdentity: false,

    tokenNodeIdAloneUsedAsGlobalOccurrenceIdentity: false,

    runtimeBindingOccurrenceDomainResolved: false,

    currentRuntimeSentenceContextSelected: false,

    occurrenceFilteringPerformed: false,

    occurrenceWinnerSelected: false,

    occurrenceBindingPerformed: false,

    posComparisonPerformed: false,

    comparisonTruthResolved: false,

    booleanTruthProduced: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforcementPerformed: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    frozenGrammarReadOnly: true,
  } as const;
}

function domainResultGovernance() {
  return {
    exactReferencedTokenSentenceDomainResultRequired: true,

    sourceDomainResultObjectPreservedWithoutReconstruction: true,

    exactCapturedSurfaceRequired: true,

    exactCapturedGraphRequired: true,

    exactSurfaceGraphProvenanceBindingRequired: true,

    provenanceBindingDerivedFromCapturedSurfaceAndGraph: true,

    provenanceBindingCheckedBeforeDomainProjection: true,

    provenanceBindingRecheckedAfterDomainProjection: true,

    provenanceBindingStableAcrossProjection: true,

    exactSnapshotAuthorityRequired: true,

    snapshotIdentityCheckedBeforeDomainProjection: true,

    snapshotIdentityRecheckedAfterDomainProjection: true,

    snapshotIdentityStableAcrossProjection: true,

    exactCanonicalDirectTokenDomainsRecomputedFromCapturedGraph: true,

    allReferencedDomainCandidatesValidatedAgainstRecomputedDomains: true,

    graphDocumentIdPreservedAsProvenance: true,

    graphDocumentIdUsedAsSnapshotIdentity: false,

    sentenceNodeIdPreservedAsGraphLocalOccurrenceIdentity: true,

    sentenceIndexIsOccurrenceIdentity: false,

    tokenNodeIdAloneUsedAsGlobalOccurrenceIdentity: false,

    snapshotSentenceOccurrenceIdentityProduced: true,

    snapshotTokenOccurrenceIdentityProduced: true,

    runtimeSiteApplicabilityResolved: false,

    runtimeBindingOccurrenceDomainResolved: false,

    currentRuntimeSentenceContextSelected: false,

    occurrenceFilteringPerformed: false,

    occurrenceWinnerSelected: false,

    occurrenceBindingPerformed: false,

    posComparisonPerformed: false,

    comparisonTruthResolved: false,

    booleanTruthProduced: false,

    cardinalitySemanticsResolved: false,

    cardinalityEnforcementPerformed: false,

    graphMutationPerformed: false,

    learnerErrorClassified: false,

    frozenGrammarReadOnly: true,
  } as const;
}

function makeC2(
  options: {
    snapshotIdentityId?: string;
    snapshotSha256?: string;
    surfaceSnapshotSha256?: string;
    graphStateSha256?: string;
    graphDocumentId?: string;
    tokenNodeId?: string;
    graphOccurrenceId?: string;
    site?: Partial<Site>;
    producer?: string;
  } = {},
): CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2 {
  const snapshotIdentityId = options.snapshotIdentityId ??
    "canonical-graph-snapshot:sha256:fixture-snapshot";

  const snapshotSha256 = options.snapshotSha256 ??
    "fixture-snapshot";

  const surfaceSnapshotSha256 = options.surfaceSnapshotSha256 ??
    "fixture-surface";

  const graphStateSha256 = options.graphStateSha256 ??
    "fixture-graph";

  const graphDocumentId = options.graphDocumentId ??
    "document:0:0:5";

  const tokenNodeId = options.tokenNodeId ??
    "tok:0:0:2";

  const site = {
    ...BASE_SITE,
    ...options.site,
  };

  const expected = {
    id: "fixture:expected-authority",

    status: "candidate",

    tokenPosSuffixPropertyCompatibilityId:
      site.tokenPosSuffixPropertyCompatibilityId,

    leafRightOperandSiteAuthorityId: site.leafRightOperandSiteAuthorityId,

    referencedBindingDefinitionAuthorityId:
      site.referencedBindingDefinitionAuthorityId,

    manifestId: site.manifestId,

    manifestCode: site.manifestCode,

    referencedBindingName: site.referencedBindingName,

    runtimeSuffix: site.runtimeSuffix,

    canonicalNodeType: site.canonicalNodeType,
  };

  const actual = {
    snapshotIdentityId,
    snapshotSha256,
    surfaceSnapshotSha256,
    graphStateSha256,
    graphDocumentId,
    tokenNodeId,

    graphTokenOccurrenceIdentityId: options.graphOccurrenceId ??
      `fixture:g2-occurrence:${snapshotSha256}:${tokenNodeId}`,
  };

  return {
    producer: (
      options.producer ??
        CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2
    ) as typeof CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_V2,

    producerVersion:
      CANONICAL_TOKEN_POS_NORMALIZED_LABEL_COMPARISON_EVIDENCE_VERSION_V2,

    status: "ready",

    evidence: {
      comparisonEvidenceId: "fixture:c2-comparison",

      status: "candidate",

      comparisonState: "explicit_resolved_match",

      actualSnapshotIdentityId: snapshotIdentityId,

      actualSnapshotSha256: snapshotSha256,

      actualGraphDocumentId: graphDocumentId,

      actualTokenNodeId: tokenNodeId,

      actualGraphTokenOccurrenceIdentityId:
        actual.graphTokenOccurrenceIdentityId,

      expectedAuthorityId: expected.id,

      actualGraphBoundProjection: actual,

      expectedAuthority: expected,

      governance: c2Governance(),
    },

    blockingReasons: [],
  } as unknown as CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2;
}

function makeDomain(
  options: {
    snapshotIdentityId?: string;
    snapshotSha256?: string;
    surfaceSnapshotSha256?: string;
    graphStateSha256?: string;
    graphDocumentId?: string;
    domains?: DomainSpec[];
    producer?: string;
  } = {},
): CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1 {
  const snapshotIdentityId = options.snapshotIdentityId ??
    "canonical-graph-snapshot:sha256:fixture-snapshot";

  const snapshotSha256 = options.snapshotSha256 ??
    "fixture-snapshot";

  const surfaceSnapshotSha256 = options.surfaceSnapshotSha256 ??
    "fixture-surface";

  const graphStateSha256 = options.graphStateSha256 ??
    "fixture-graph";

  const graphDocumentId = options.graphDocumentId ??
    "document:0:0:5";

  const specs = options.domains ??
    [
      {
        snapshotBoundDomainId: "fixture:snapshot-domain:1",

        sourceDomainCandidateId: "fixture:source-domain:1",

        sentenceNodeId: "sentence:0:0:5",

        sentenceIndex: 0,

        canonicalTokenDomainId: "fixture:canonical-domain:1",

        occurrences: [
          {
            tokenNodeId: "tok:0:0:2",

            containmentEdgeId: "edge:sentence-token:1",

            sentenceTokenIndex: 0,

            graphStatus: "resolved",

            snapshotTokenOccurrenceIdentityId:
              "fixture:domain-occurrence:tok-1",
          },
        ],
      },
    ];

  const sourceCandidates: Record<string, unknown>[] = [];

  const candidates = specs.map(
    (
      spec,
      index,
    ) => {
      const site = {
        ...BASE_SITE,
        ...(spec.site ?? {}),
      };

      const sourceDomainCandidateId = spec.sourceDomainCandidateId ??
        `fixture:source-domain:${index}`;

      const snapshotBoundDomainId = spec.snapshotBoundDomainId ??
        `fixture:snapshot-domain:${index}`;

      const sentenceNodeId = spec.sentenceNodeId ??
        `sentence:${index}`;

      const sentenceIndex = spec.sentenceIndex ??
        index;

      const canonicalTokenDomainId = spec.canonicalTokenDomainId ??
        `fixture:canonical-domain:${index}`;

      const sourceCandidate = {
        id: sourceDomainCandidateId,

        graphDocumentId,

        canonicalTokenDomainId,

        sentenceNodeId,

        sentenceIndex,

        tokenPosSuffixPropertyCompatibilityId:
          site.tokenPosSuffixPropertyCompatibilityId,

        leafRightOperandSiteAuthorityId: site.leafRightOperandSiteAuthorityId,

        referencedBindingDefinitionAuthorityId:
          site.referencedBindingDefinitionAuthorityId,

        manifestId: site.manifestId,

        manifestCode: site.manifestCode,

        referencedBindingName: site.referencedBindingName,

        runtimeSuffix: site.runtimeSuffix,

        canonicalNodeType: site.canonicalNodeType,
      };

      sourceCandidates.push(
        sourceCandidate,
      );

      const occurrenceSpecs = spec.occurrences ??
        [];

      const occurrences = occurrenceSpecs.map(
        (
          occurrence,
          occurrenceIndex,
        ) => ({
          tokenNodeId: occurrence.tokenNodeId,

          containmentEdgeId: occurrence.containmentEdgeId ??
            `fixture:edge:${index}:${occurrenceIndex}`,

          sentenceTokenIndex: occurrence.sentenceTokenIndex ??
            occurrenceIndex,

          graphStatus: occurrence.graphStatus ??
            "resolved",

          snapshotTokenOccurrenceIdentityId:
            occurrence.snapshotTokenOccurrenceIdentityId ??
              `fixture:snapshot-occurrence:${index}:${occurrenceIndex}`,
        }),
      );

      return {
        snapshotBoundDomainId,

        status: "candidate",

        sourceDomainCandidateId,

        snapshotAuthorityId: "fixture:snapshot-authority-instance",

        snapshotIdentityId,

        snapshotSha256,

        surfaceSnapshotSha256,

        graphStateSha256,

        graphVersion: "canonical-language-graph-v1",

        graphDocumentId,

        canonicalTokenDomainId,

        sentenceNodeId,

        sentenceIndex,

        snapshotSentenceOccurrenceIdentityId:
          `fixture:snapshot-sentence:${index}`,

        occurrenceCount: occurrences.length,

        occurrences,

        sourceCandidate,

        governance: domainCandidateGovernance(),
      };
    },
  );

  const result = {
    producer: (
      options.producer ??
        CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1
    ) as typeof CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_REFERENCED_TOKEN_SENTENCE_DOMAIN_SNAPSHOT_BINDING_VERSION_V1,

    status: "ready",

    provenanceBindingAuthorityId: "fixture:provenance-binding",

    snapshotAuthorityId: "fixture:snapshot-authority-instance",

    snapshotIdentityId,

    snapshotSha256,

    surfaceSnapshotSha256,

    graphStateSha256,

    graphDocumentId,

    sourceDomainResult: {
      candidates: sourceCandidates,
    },

    candidates,

    candidateCount: candidates.length,

    blockingReasons: [],

    governance: domainResultGovernance(),
  };

  return result as unknown as CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1;
}

function readyEvidence(
  c2: CanonicalTokenPosNormalizedLabelComparisonEvidenceResultV2,
  domain:
    CanonicalRuntimeManifestReferencedTokenSentenceDomainSnapshotBindingResultV1,
) {
  const result =
    deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
      c2,
      domain,
    );

  assert(
    result.status ===
        "ready" &&
      result.evidence,
    `expected ready D2a result: ${JSON.stringify(result)}`,
  );

  return result.evidence;
}

const NESTED_TARGET_LEAF_PATH = "$.any[1]";

const NESTED_SIBLING_LEAF_PATH = "$.any[0]";

function nestedLeafSiteId(
  leafPath: string,
): string {
  return `fixture:nested-leaf-site:${encodeURIComponent(leafPath)}`;
}

function exactTargetDomain(
  targetLeafSiteId: string,
) {
  return makeDomain({
    domains: [
      {
        snapshotBoundDomainId: "fixture:nested:snapshot-domain:target",

        sourceDomainCandidateId: "fixture:nested:source-domain:target",

        sentenceNodeId: "sentence:0:0:5",

        sentenceIndex: 0,

        canonicalTokenDomainId: "fixture:nested:canonical-domain:target",

        site: {
          leafRightOperandSiteAuthorityId: targetLeafSiteId,
        },

        occurrences: [
          {
            tokenNodeId: "tok:0:0:2",

            containmentEdgeId: "fixture:nested:edge:sentence-token",

            sentenceTokenIndex: 0,

            graphStatus: "resolved",

            snapshotTokenOccurrenceIdentityId:
              "fixture:nested:token-occurrence:target",
          },
        ],
      },
    ],
  });
}

Deno.test(
  "nested-leaf-clean.1 sibling paths map to distinct Runtime site identities",
  () => {
    const targetSite = nestedLeafSiteId(
      NESTED_TARGET_LEAF_PATH,
    );

    const siblingSite = nestedLeafSiteId(
      NESTED_SIBLING_LEAF_PATH,
    );

    assert(
      NESTED_TARGET_LEAF_PATH ===
          "$.any[1]" &&
        NESTED_SIBLING_LEAF_PATH ===
          "$.any[0]" &&
        targetSite !==
          siblingSite &&
        targetSite.includes(
          encodeURIComponent(
            NESTED_TARGET_LEAF_PATH,
          ),
        ) &&
        siblingSite.includes(
          encodeURIComponent(
            NESTED_SIBLING_LEAF_PATH,
          ),
        ),
      JSON.stringify({
        NESTED_TARGET_LEAF_PATH,
        NESTED_SIBLING_LEAF_PATH,
        targetSite,
        siblingSite,
      }),
    );
  },
);

Deno.test(
  "nested-leaf-clean.2 nested target leaf reaches unique D2a applicability without whole-root gate",
  () => {
    const targetSite = nestedLeafSiteId(
      NESTED_TARGET_LEAF_PATH,
    );

    const c2 = makeC2({
      site: {
        leafRightOperandSiteAuthorityId: targetSite,
      },
    });

    const domain = exactTargetDomain(
      targetSite,
    );

    const result =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        c2,
        domain,
      );

    assert(
      result.status ===
          "ready" &&
        result.evidence !==
          undefined &&
        result.evidence
            .applicabilityState ===
          "unique_site_snapshot_token_occurrence_match" &&
        result.evidence
            .siteMatchingDomainCount ===
          1 &&
        result.evidence
            .exactSiteSnapshotTokenOccurrenceMatchCount ===
          1,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "nested-leaf-clean.3 unrelated sibling leaf cannot consume target leaf site domain",
  () => {
    const targetSite = nestedLeafSiteId(
      NESTED_TARGET_LEAF_PATH,
    );

    const siblingSite = nestedLeafSiteId(
      NESTED_SIBLING_LEAF_PATH,
    );

    const siblingC2 = makeC2({
      site: {
        leafRightOperandSiteAuthorityId: siblingSite,
      },
    });

    const domain = exactTargetDomain(
      targetSite,
    );

    const result =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        siblingC2,
        domain,
      );

    assert(
      result.status ===
          "ready" &&
        result.evidence !==
          undefined &&
        result.evidence
            .applicabilityState ===
          "no_matching_site_domain" &&
        result.evidence
            .siteMatchingDomainCount ===
          0 &&
        result.evidence
            .exactSiteSnapshotTokenOccurrenceMatchCount ===
          0,
      JSON.stringify(result),
    );
  },
);

Deno.test(
  "nested-leaf-clean.4 exact nested target leaf reaches resolved_true D2b1 truth",
  () => {
    const targetSite = nestedLeafSiteId(
      NESTED_TARGET_LEAF_PATH,
    );

    const c2 = makeC2({
      site: {
        leafRightOperandSiteAuthorityId: targetSite,
      },
    });

    const domain = exactTargetDomain(
      targetSite,
    );

    const d2a =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        c2,
        domain,
      );

    assert(
      d2a.status ===
          "ready" &&
        d2a.evidence !==
          undefined &&
        d2a.evidence
            .applicabilityState ===
          "unique_site_snapshot_token_occurrence_match",
      JSON.stringify(d2a),
    );

    const d2b1 = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2(
      d2a,
      CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2,
    );

    assert(
      d2b1.status ===
          "ready" &&
        d2b1.evidence !==
          undefined &&
        d2b1.evidence
            .truthDisposition ===
          "resolved_true" &&
        d2b1.evidence
            .booleanTruth ===
          true &&
        d2b1.evidence
            .booleanTruthResolved ===
          true,
      JSON.stringify(d2b1),
    );

    assert(
      d2b1.evidence
            .governance
            .compoundWhereTruthResolved ===
          false &&
        d2b1.evidence
            .governance
            .manifestConditionTruthResolved ===
          false &&
        d2b1.evidence
            .governance
            .cardinalitySemanticsResolved ===
          false,
      "nested leaf truth leaked into compound/manifest/cardinality truth",
    );
  },
);

Deno.test(
  "nested-leaf-clean.5 sibling leaf remains unresolved when only target site is applicable",
  () => {
    const targetSite = nestedLeafSiteId(
      NESTED_TARGET_LEAF_PATH,
    );

    const siblingSite = nestedLeafSiteId(
      NESTED_SIBLING_LEAF_PATH,
    );

    const siblingC2 = makeC2({
      site: {
        leafRightOperandSiteAuthorityId: siblingSite,
      },
    });

    const domain = exactTargetDomain(
      targetSite,
    );

    const d2a =
      deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
        siblingC2,
        domain,
      );

    assert(
      d2a.status ===
          "ready" &&
        d2a.evidence !==
          undefined &&
        d2a.evidence
            .applicabilityState ===
          "no_matching_site_domain",
      JSON.stringify(d2a),
    );

    const d2b1 = deriveCanonicalRuntimeTokenPosConditionTruthCompositionV2(
      d2a,
      CANONICAL_RUNTIME_TOKEN_POS_EQ_CONDITION_TRUTH_SEMANTIC_CAPABILITY_RESULT_V2,
    );

    assert(
      d2b1.status ===
          "ready" &&
        d2b1.evidence !==
          undefined &&
        d2b1.evidence
            .truthDisposition ===
          "unresolved" &&
        d2b1.evidence
            .booleanTruth ===
          null &&
        d2b1.evidence
            .booleanTruthResolved ===
          false,
      JSON.stringify(d2b1),
    );

    assert(
      d2b1.evidence
        .governance
        .compoundWhereTruthResolved ===
        false,
      "sibling unresolved leaf accidentally executed compound truth",
    );
  },
);
