/**
 * CURRENT snapshot-bound WHERE authority-bound leaf truth
 * -> A4.6a1e context-bound child truth adapter.
 *
 * Context identity:
 *   snapshotIdentityId
 *     + snapshotSentenceOccurrenceIdentityId
 *
 * graphDocumentId and sentenceNodeId are context-consistency metadata only.
 *
 * The adapter:
 * - reexecutes the closed CURRENT authority-bound leaf-truth producer;
 * - consumes the exact preserved CURRENT sentence-context lineage;
 * - preserves the exact A4.6a1c2 authority-bound evidence object;
 * - does not reconstruct truth;
 * - does not compose recursive/compound WHERE truth;
 * - does not select Runtime context;
 * - does not resolve binding/cardinality;
 * - does not mutate graph or classify learner error.
 */

import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-authority-bound-leaf-truth-evidence-v1.ts";

import {
  CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,
  type CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1,
} from "./canonical-runtime-manifest-binding-where-context-bound-child-truth-evidence-interface-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1 =
  "canonical-runtime-token-pos-current-snapshot-bound-where-context-bound-child-truth-adapter-v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1 =
  "1.0.0" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1 =
  "v1.46:A4.6a1e:current-snapshot-bound-where-context-bound-child-truth-adapter-v1" as const;

type LeafProducer =
  typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceV1;

type LeafResult = Awaited<ReturnType<LeafProducer>>;

type Surface = Parameters<LeafProducer>[0];
type Graph = Parameters<LeafProducer>[1];
type ExpectedResult = Parameters<LeafProducer>[2];
type CurrentDomainResult = Parameters<LeafProducer>[3];
type DependencyAuthorities = Parameters<LeafProducer>[4];
type ManifestRows = Parameters<LeafProducer>[5];

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterGovernanceV1 =
  {
    closedCurrentLeafTruthPublicDerivationReexecuted: true;
    suppliedCurrentLeafTruthWrapperAcceptedAsProof: false;

    exactCurrentDomainReadyAuthorityRequired: true;
    exactPreservedCurrentContextApplicabilityResultRequired: true;
    exactPreservedCurrentContextResultRequired: true;
    exactCurrentRuntimeSentenceContextAuthorityRequired: true;

    snapshotIdentityAndSentenceOccurrenceIdentityFormContextCompositeIdentity:
      true;

    graphDocumentIdUsedAsContextIdentity: false;
    sentenceNodeIdUsedAsContextIdentity: false;
    sentenceIndexUsedAsContextIdentity: false;
    snapshotTokenOccurrenceIdentityUsedAsSentenceContextIdentity: false;

    graphDocumentIdPreservedAsContextConsistencyMetadata: true;
    sentenceNodeIdPreservedAsContextConsistencyMetadata: true;

    exactAuthorityBoundChildTruthEvidenceRequired: true;
    authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction: true;

    truthDispositionDuplicatedAtContextBindingLayer: false;
    truthRecomputedAtContextBindingLayer: false;

    recursiveWhereCompositionPerformed: false;
    compoundTruthComposed: false;
    manifestConditionTruthResolved: false;
    runtimeConditionTruthResolved: false;
    bindingTruthResolved: false;
    whereEvaluationPerformed: false;

    occurrenceWinnerSelected: false;
    cardinalitySemanticsResolved: false;
    cardinalityEnforcementPerformed: false;

    learnerErrorClassified: false;
    graphMutationPerformed: false;
    frozenGrammarReadOnly: true;
  };

const GOVERNANCE:
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterGovernanceV1 =
    {
      closedCurrentLeafTruthPublicDerivationReexecuted: true,
      suppliedCurrentLeafTruthWrapperAcceptedAsProof: false,

      exactCurrentDomainReadyAuthorityRequired: true,
      exactPreservedCurrentContextApplicabilityResultRequired: true,
      exactPreservedCurrentContextResultRequired: true,
      exactCurrentRuntimeSentenceContextAuthorityRequired: true,

      snapshotIdentityAndSentenceOccurrenceIdentityFormContextCompositeIdentity:
        true,

      graphDocumentIdUsedAsContextIdentity: false,
      sentenceNodeIdUsedAsContextIdentity: false,
      sentenceIndexUsedAsContextIdentity: false,
      snapshotTokenOccurrenceIdentityUsedAsSentenceContextIdentity: false,

      graphDocumentIdPreservedAsContextConsistencyMetadata: true,
      sentenceNodeIdPreservedAsContextConsistencyMetadata: true,

      exactAuthorityBoundChildTruthEvidenceRequired: true,
      authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction:
        true,

      truthDispositionDuplicatedAtContextBindingLayer: false,
      truthRecomputedAtContextBindingLayer: false,

      recursiveWhereCompositionPerformed: false,
      compoundTruthComposed: false,
      manifestConditionTruthResolved: false,
      runtimeConditionTruthResolved: false,
      bindingTruthResolved: false,
      whereEvaluationPerformed: false,

      occurrenceWinnerSelected: false,
      cardinalitySemanticsResolved: false,
      cardinalityEnforcementPerformed: false,

      learnerErrorClassified: false,
      graphMutationPerformed: false,
      frozenGrammarReadOnly: true,
    };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterReadyResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1;

    sourceProducer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1;

    sourceProducerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1;

    contextBoundInterfaceSpecificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

    status: "ready";

    sourceResult: Extract<LeafResult, { status: "ready" }>;

    evidence:
      readonly CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1[];

    evidenceCount: number;

    blockingReasons: readonly [];

    governance:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterGovernanceV1;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterBlockedResultV1 =
  {
    producer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1;

    producerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1;

    specificationId:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1;

    sourceProducer:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1;

    sourceProducerVersion:
      typeof CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1;

    contextBoundInterfaceSpecificationId:
      typeof CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1;

    status: "blocked";

    sourceResult: LeafResult | null;

    evidence: readonly [];

    evidenceCount: 0;

    blockingReasons: readonly string[];

    governance:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterGovernanceV1;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterResultV1 =
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterReadyResultV1
  | CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterBlockedResultV1;

function uniqueSorted(
  values: readonly string[],
): readonly string[] {
  return [...new Set(values)].sort();
}

function blocked(
  reasons: readonly string[],
  sourceResult: LeafResult | null = null,
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterBlockedResultV1 {
  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,

    sourceProducer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1,

    sourceProducerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1,

    contextBoundInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    status: "blocked",

    sourceResult,

    evidence: [],
    evidenceCount: 0,

    blockingReasons: uniqueSorted(
      reasons,
    ),

    governance: GOVERNANCE,
  };
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll(
    "%",
    "_",
  );
}

export async function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterV1(
  surface: Surface,
  graph: Graph,
  expectedResult: ExpectedResult,
  currentDomainResult: CurrentDomainResult,
  dependencyAuthorities: DependencyAuthorities,
  manifestRows: ManifestRows,
): Promise<
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextBoundChildTruthAdapterResultV1
> {
  const leafResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereAuthorityBoundLeafTruthEvidenceV1(
      surface,
      graph,
      expectedResult,
      currentDomainResult,
      dependencyAuthorities,
      manifestRows,
    );

  if (
    leafResult.status !== "ready" ||
    leafResult.authority === null ||
    leafResult.blockingReasons.length !== 0
  ) {
    return blocked([
      "current_leaf_truth:not_ready",
      ...leafResult.blockingReasons.map(
        (reason) => `current_leaf_truth:${reason}`,
      ),
    ], leafResult);
  }

  if (
    currentDomainResult.status !== "ready" ||
    currentDomainResult.authority === null ||
    currentDomainResult.blockingReasons.length !== 0
  ) {
    return blocked([
      "current_domain:not_ready",
    ], leafResult);
  }

  const currentApplicability =
    currentDomainResult.sourceCurrentContextApplicabilityResult;

  if (
    currentApplicability.status !== "ready" ||
    currentApplicability.blockingReasons.length !== 0
  ) {
    return blocked([
      "current_context_applicability:not_ready",
    ], leafResult);
  }

  const currentContextResult = currentApplicability.sourceCurrentContextResult;

  if (
    currentContextResult.status !== "ready" ||
    currentContextResult.authority === null ||
    currentContextResult.blockingReasons.length !== 0
  ) {
    return blocked([
      "current_context:not_ready",
    ], leafResult);
  }

  const current = currentContextResult.authority;

  if (
    currentDomainResult.authority.snapshotIdentityId !==
      current.snapshotIdentityId ||
    currentDomainResult.authority.snapshotSentenceOccurrenceIdentityId !==
      current.snapshotSentenceOccurrenceIdentityId ||
    currentDomainResult.authority.graphDocumentId !==
      current.graphDocumentId ||
    currentDomainResult.authority.sentenceNodeId !==
      current.sentenceNodeId
  ) {
    return blocked([
      "current_domain:context_lineage_mismatch",
    ], leafResult);
  }

  const evidence:
    CanonicalRuntimeManifestWhereContextBoundChildTruthEvidenceV1[] = [];

  for (
    const leaf of leafResult.authority.evidence
  ) {
    if (
      leaf.snapshotIdentityId !==
        current.snapshotIdentityId ||
      leaf.snapshotSentenceOccurrenceIdentityId !==
        current.snapshotSentenceOccurrenceIdentityId
    ) {
      return blocked([
        `current_leaf_truth:context_identity_mismatch:${leaf.leafTruthEvidenceId}`,
      ], leafResult);
    }

    if (
      leaf.authorityBoundChildTruth.status !==
        "ready" ||
      leaf.authorityBoundChildTruth.blockingReasons.length !==
        0
    ) {
      return blocked([
        `current_leaf_truth:authority_bound_child_truth_not_ready:${leaf.leafTruthEvidenceId}`,
      ], leafResult);
    }

    const authorityBound = leaf.authorityBoundChildTruth.evidence;

    if (
      authorityBound.structuralAuthorityId !==
        leaf.structuralAuthorityId ||
      authorityBound.nodePath !==
        leaf.structuralNodePath
    ) {
      return blocked([
        `current_leaf_truth:authority_bound_structural_identity_mismatch:${leaf.leafTruthEvidenceId}`,
      ], leafResult);
    }

    evidence.push({
      contextBoundChildTruthEvidenceId: [
        CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1,
        idPart(
          authorityBound.structuralAuthorityId,
        ),
        idPart(
          authorityBound.nodePath,
        ),
        idPart(
          current.snapshotIdentityId,
        ),
        idPart(
          current.snapshotSentenceOccurrenceIdentityId,
        ),
      ].join(":"),

      structuralAuthorityId: authorityBound.structuralAuthorityId,

      nodePath: authorityBound.nodePath,

      snapshotIdentityId: current.snapshotIdentityId,

      snapshotSentenceOccurrenceIdentityId:
        current.snapshotSentenceOccurrenceIdentityId,

      graphDocumentId: current.graphDocumentId,

      sentenceNodeId: current.sentenceNodeId,

      authorityBoundChildTruthEvidence: authorityBound,

      provenance: {
        exactAuthorityBoundChildTruthEvidenceRequired: true,

        authorityBoundChildTruthEvidenceObjectPreservedWithoutReconstruction:
          true,

        structuralAuthorityIdMatchesWrappedEvidence: true,

        nodePathMatchesWrappedEvidence: true,

        canonicalSnapshotSentenceOccurrenceIdentityRequired: true,

        snapshotIdentityRequired: true,

        snapshotSentenceOccurrenceIdentityRequired: true,

        snapshotIdentityAndSentenceOccurrenceIdentityFormContextCompositeIdentity:
          true,

        graphDocumentIdPreservedAsContextConsistencyMetadata: true,

        sentenceNodeIdPreservedAsContextConsistencyMetadata: true,

        sentenceIndexUsedAsContextIdentity: false,

        tokenNodeIdUsedAsSentenceContextIdentity: false,

        snapshotTokenOccurrenceIdentityUsedAsSentenceContextIdentity: false,

        authorityContextPairProvenBySourceAdapter: true,

        contextInferredByInterface: false,

        callerSuppliedContextAcceptedAsProof: false,

        truthDispositionDuplicatedAtContextBindingLayer: false,

        truthRecomputedByInterface: false,
      },
    });
  }

  if (evidence.length === 0) {
    return blocked([
      "context_bound_child_truth:no_materialized_evidence",
    ], leafResult);
  }

  return {
    producer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_V1,

    producerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_VERSION_V1,

    specificationId:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_CONTEXT_BOUND_CHILD_TRUTH_ADAPTER_SPECIFICATION_ID_V1,

    sourceProducer:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_V1,

    sourceProducerVersion:
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_AUTHORITY_BOUND_LEAF_TRUTH_EVIDENCE_VERSION_V1,

    contextBoundInterfaceSpecificationId:
      CANONICAL_RUNTIME_MANIFEST_BINDING_WHERE_CONTEXT_BOUND_CHILD_TRUTH_EVIDENCE_INTERFACE_SPECIFICATION_ID_V1,

    status: "ready",

    sourceResult: leafResult,

    evidence,

    evidenceCount: evidence.length,

    blockingReasons: [],

    governance: GOVERNANCE,
  };
}
