import { deriveCanonicalGraphSnapshotIdentityAuthorityV1 } from "./canonical-graph-snapshot-identity-authority-v1.ts";
import { deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1 } from "./canonical-sentence-direct-token-occurrence-domain-capability-v1.ts";
import { deriveCanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionsV1 } from "./canonical-runtime-manifest-referenced-token-sentence-domain-composition-v1.ts";
import { bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1 } from "./canonical-runtime-manifest-referenced-token-sentence-domain-snapshot-binding-v1.ts";
import { deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2 } from "./canonical-token-pos-graph-bound-normalized-label-projection-v2.ts";
import { compareCanonicalTokenPosNormalizedLabelEvidenceV2 } from "./canonical-token-pos-normalized-label-comparison-evidence-v2.ts";
import { deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2 } from "./canonical-runtime-token-pos-site-occurrence-applicability-evidence-v2.ts";
import { deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1 } from "./canonical-runtime-token-pos-current-context-site-occurrence-applicability-evidence-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1 } from "./canonical-runtime-token-pos-current-binding-occurrence-domain-authority-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1 } from "./canonical-runtime-token-pos-current-snapshot-bound-final-runtime-binding-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthV1 } from "./canonical-runtime-token-pos-current-snapshot-bound-where-context-coherent-recursive-compound-truth-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceV1 } from "./canonical-runtime-token-pos-current-snapshot-bound-where-owner-binding-occurrence-provenance-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1 } from "./canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1 } from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-survivor-set-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1 } from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-final-runtime-binding-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceV1 } from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-bound-condition-evidence-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationV1 } from "./canonical-runtime-token-pos-current-snapshot-bound-where-terminal-aggregation-v1.ts";
import { deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1 } from "./canonical-runtime-token-pos-current-snapshot-bound-where-action-candidate-bridge-v1.ts";
import { deriveCanonicalDependencyRuntimeAuthoritiesV1 } from "./canonical-dependency-runtime-authority-v1.ts";
import { deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1 } from "./canonical-runtime-binding-definition-authority-v1.ts";
import { deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1 } from "./canonical-runtime-dependency-action-binding-association-boundary-v1.ts";
import { deriveCanonicalRuntimeExecutionReadinessEvidenceBoundaryV1 } from "./canonical-runtime-execution-readiness-evidence-boundary-v1.ts";
import { deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1 } from "./canonical-runtime-dependency-endpoint-resolution-evidence-boundary-v1.ts";
import { deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1 } from "./canonical-runtime-action-execution-precondition-evidence-boundary-v1.ts";
import { deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1 } from "./canonical-current-runtime-sentence-context-authority-v1.ts";

export const CANONICAL_RUNTIME_S0_INITIAL_EPOCH_COMPOSITION_BOUNDARY_V1 =
  "a3.6g:canonical-runtime-s0-initial-epoch-composition-boundary-v1" as const;
export const CANONICAL_RUNTIME_S0_INITIAL_EPOCH_COMPOSITION_BOUNDARY_VERSION_V1 =
  "1.0.0" as const;

type ExpectedResult = Parameters<
  typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthV1
>[2];
type ExpectedAuthority = Parameters<
  typeof compareCanonicalTokenPosNormalizedLabelEvidenceV2
>[1];
type CompatibilityResult = Parameters<
  typeof deriveCanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionsV1
>[0];
type ScopeResult = Parameters<
  typeof deriveCanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionsV1
>[1];
type ManifestRows = Parameters<
  typeof deriveCanonicalDependencyRuntimeAuthoritiesV1
>[0];
type SetRoleAuthorities = Parameters<
  typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1
>[0]["setRoleAuthorities"];
type Surface = Parameters<
  typeof deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2
>[0];

type InitialGraph = Parameters<
  typeof deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1
>[1];
type RawExecutionContextInput = Parameters<
  typeof deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1
>[2];

export type CanonicalRuntimeS0InitialEpochCompositionInputV1 = Readonly<{
  surface: Surface;
  graph: InitialGraph;
  rawExecutionContextInput: RawExecutionContextInput;
  tokenNodeId: string;
  expectedResult: ExpectedResult;
  expectedAuthority: ExpectedAuthority;
  compatibilityResult: CompatibilityResult;
  scopeResult: ScopeResult;
  manifestRows: ManifestRows;
  setRoleAuthorities: SetRoleAuthorities;
}>;

function blocked(stage: string, reasons: readonly string[]) {
  return {
    producer: CANONICAL_RUNTIME_S0_INITIAL_EPOCH_COMPOSITION_BOUNDARY_V1,
    producerVersion:
      CANONICAL_RUNTIME_S0_INITIAL_EPOCH_COMPOSITION_BOUNDARY_VERSION_V1,
    status: "blocked" as const,
    stage,
    blockingReasons: [...new Set(reasons)].sort(),
    governance: {
      priorSnapshotBoundEvidenceReused: false as const,
      newLinguisticSemanticsCreated: false as const,
      sentenceIndexUsedAsIdentity: false as const,
      sentenceSelectedHere: false as const,
      graphMutationPerformed: false as const,
      runtimeActionExecuted: false as const,
      schedulerInvoked: false as const,
      activationPermissionResolved: false as const,
      executionAdmissionResolved: false as const,
      learnerFacingInterpretationPerformed: false as const,
    },
  };
}

export async function deriveCanonicalRuntimeS0InitialEpochCompositionBoundaryV1(
  input: CanonicalRuntimeS0InitialEpochCompositionInputV1,
) {
  const resultingGraph = input.graph;
  const resultingCurrentContext =
    await deriveCanonicalCurrentRuntimeSentenceContextAuthorityV1(
      input.surface,
      resultingGraph,
      input.rawExecutionContextInput,
    );
  if (resultingCurrentContext.status !== "ready") {
    return blocked(
      "s0_current_context",
      resultingCurrentContext.blockingReasons.map((x) =>
        `current_context:${x}`
      ),
    );
  }

  if (typeof input.tokenNodeId !== "string" || input.tokenNodeId.length === 0) {
    return blocked("evaluation_seed", ["token_node_id:missing"]);
  }
  if (input.expectedResult.status !== "ready") {
    return blocked("evaluation_seed", ["expected_result:not_ready"]);
  }

  const snapshotResult = await deriveCanonicalGraphSnapshotIdentityAuthorityV1(
    input.surface,
    resultingGraph,
  );
  if (snapshotResult.status !== "ready") {
    return blocked(
      "s0_snapshot",
      snapshotResult.blockingReasons.map((x) => `snapshot:${x}`),
    );
  }
  const snapshotAuthority = snapshotResult.authority;
  if (snapshotAuthority === undefined) {
    return blocked("s0_snapshot", ["snapshot:authority_missing"]);
  }
  if (
    snapshotAuthority.snapshotIdentityId !==
      resultingCurrentContext.authority.snapshotIdentityId
  ) {
    return blocked("s0_snapshot", ["snapshot:current_identity_mismatch"]);
  }

  const directTokenDomainResult =
    deriveCanonicalSentenceDirectTokenOccurrenceDomainsV1(resultingGraph);
  if (directTokenDomainResult.status !== "ready") {
    return blocked(
      "s0_direct_token_domain",
      directTokenDomainResult.blockingReasons.map((x) => `direct_domain:${x}`),
    );
  }

  const referencedDomainCompositionResult =
    deriveCanonicalRuntimeManifestReferencedTokenSentenceDomainCompositionsV1(
      input.compatibilityResult,
      input.scopeResult,
      directTokenDomainResult,
    );
  if (referencedDomainCompositionResult.status !== "ready") {
    return blocked(
      "s0_referenced_domain_composition",
      referencedDomainCompositionResult.blockingReasons.map((x) =>
        `referenced_domain:${x}`
      ),
    );
  }

  const snapshotDomainResult =
    await bindCanonicalRuntimeManifestReferencedTokenSentenceDomainsToSnapshotV1(
      input.surface,
      resultingGraph,
      referencedDomainCompositionResult,
    );
  if (snapshotDomainResult.status !== "ready") {
    return blocked(
      "s0_snapshot_domain",
      snapshotDomainResult.blockingReasons.map((x) => `snapshot_domain:${x}`),
    );
  }

  const graphBoundProjectionResult =
    await deriveCanonicalTokenPosGraphBoundNormalizedLabelProjectionV2(
      input.surface,
      resultingGraph,
      input.tokenNodeId,
    );
  if (graphBoundProjectionResult.status !== "ready") {
    return blocked(
      "s0_graph_bound_projection",
      graphBoundProjectionResult.blockingReasons.map((x) => `projection:${x}`),
    );
  }

  const c2Result = compareCanonicalTokenPosNormalizedLabelEvidenceV2(
    graphBoundProjectionResult,
    input.expectedAuthority,
  );
  if (c2Result.status !== "ready") {
    return blocked("s0_c2", c2Result.blockingReasons.map((x) => `c2:${x}`));
  }

  const d2aResult =
    deriveCanonicalRuntimeTokenPosSiteOccurrenceApplicabilityEvidenceV2(
      c2Result,
      snapshotDomainResult,
    );
  if (d2aResult.status !== "ready") {
    return blocked("s0_d2a", d2aResult.blockingReasons.map((x) => `d2a:${x}`));
  }

  const currentApplicabilityResult =
    deriveCanonicalRuntimeTokenPosCurrentContextSiteOccurrenceApplicabilityEvidenceV1(
      resultingCurrentContext,
      d2aResult,
    );
  if (currentApplicabilityResult.status !== "ready") {
    return blocked(
      "s0_current_applicability",
      currentApplicabilityResult.blockingReasons.map((x) =>
        `current_applicability:${x}`
      ),
    );
  }

  const currentDomainResult =
    deriveCanonicalRuntimeTokenPosCurrentBindingOccurrenceDomainAuthorityV1(
      currentApplicabilityResult,
    );
  if (currentDomainResult.status !== "ready") {
    return blocked(
      "s0_current_binding_domain",
      currentDomainResult.blockingReasons.map((x) => `current_domain:${x}`),
    );
  }

  const dependencyAuthorityResult =
    deriveCanonicalDependencyRuntimeAuthoritiesV1(input.manifestRows);
  if (dependencyAuthorityResult.status !== "ready") {
    return blocked(
      "dependency_authorities",
      dependencyAuthorityResult.blockingReasons.map((x) =>
        `dependency_authority:${x}`
      ),
    );
  }

  const finalRuntimeBindingResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundFinalRuntimeBindingV1(
      input.surface,
      resultingGraph,
      input.expectedResult,
      currentDomainResult,
      dependencyAuthorityResult.authorities,
      input.manifestRows,
    );
  if (finalRuntimeBindingResult.status !== "ready") {
    return blocked(
      "s0_final_runtime_binding",
      finalRuntimeBindingResult.blockingReasons.map((x) =>
        `final_runtime_binding:${x}`
      ),
    );
  }

  const recursiveWhereResult =
    await deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereContextCoherentRecursiveCompoundTruthV1(
      input.surface,
      resultingGraph,
      input.expectedResult,
      currentDomainResult,
      dependencyAuthorityResult.authorities,
      input.manifestRows,
    );
  if (recursiveWhereResult.status !== "ready") {
    return blocked(
      "s0_recursive_where",
      recursiveWhereResult.blockingReasons.map((x) => `recursive_where:${x}`),
    );
  }

  const ownerProvenanceResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceV1(
      recursiveWhereResult,
      input.scopeResult,
      directTokenDomainResult,
      snapshotResult,
    );
  if (ownerProvenanceResult.status !== "ready") {
    return blocked(
      "s0_owner_provenance",
      ownerProvenanceResult.blockingReasons.map((x) => `owner:${x}`),
    );
  }

  const finalWhereDecisionResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1(
      ownerProvenanceResult,
    );
  if (finalWhereDecisionResult.status !== "ready") {
    return blocked(
      "s0_final_where",
      finalWhereDecisionResult.blockingReasons.map((x) => `final_where:${x}`),
    );
  }

  const survivorResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
      finalWhereDecisionResult,
    );
  if (survivorResult.status !== "ready") {
    return blocked(
      "s0_post_owner_survivor",
      survivorResult.blockingReasons.map((x) => `survivor:${x}`),
    );
  }

  const postOwnerFinalBindingResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1(
      survivorResult,
      dependencyAuthorityResult.authorities,
      input.manifestRows,
    );
  if (postOwnerFinalBindingResult.status !== "ready") {
    return blocked(
      "s0_post_owner_final_binding",
      postOwnerFinalBindingResult.blockingReasons.map((x) =>
        `post_owner_binding:${x}`
      ),
    );
  }

  const postOwnerBoundConditionEvidenceResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceV1(
      survivorResult,
      dependencyAuthorityResult.authorities,
      input.manifestRows,
    );
  if (postOwnerBoundConditionEvidenceResult.status !== "ready") {
    return blocked(
      "s0_post_owner_bound_condition",
      postOwnerBoundConditionEvidenceResult.blockingReasons.map((x) =>
        `post_owner_condition:${x}`
      ),
    );
  }

  const terminalAggregationResult =
    deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationV1(
      {
        finalWhereDecisionResult,
        postOwnerBoundConditionEvidenceResult,
      },
    );
  if (terminalAggregationResult.status !== "ready") {
    return blocked(
      "s0_terminal_aggregation",
      terminalAggregationResult.blockingReasons.map((x) => `terminal:${x}`),
    );
  }

  const bindingAuthorityResult =
    deriveCanonicalRuntimeBindingDefinitionAuthoritiesV1(
      dependencyAuthorityResult.authorities,
      input.manifestRows,
    );
  if (bindingAuthorityResult.status !== "ready") {
    return blocked(
      "binding_authorities",
      bindingAuthorityResult.blockingReasons.map((x) =>
        `binding_authority:${x}`
      ),
    );
  }

  const readinessEvidence = [] as ReturnType<
    typeof deriveCanonicalRuntimeExecutionReadinessEvidenceBoundaryV1
  >["evidence"] extends readonly (infer T)[] ? T[] : never[];
  const actionCandidateBridges = [] as ReturnType<
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1
  >[];
  const associationResults = [] as ReturnType<
    typeof deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1
  >[];

  for (
    const terminalEnvelope of terminalAggregationResult.aggregation
      .terminalEnvelopes
  ) {
    const bridge =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1(
        {
          terminalEnvelope,
          setRoleAuthorities: input.setRoleAuthorities,
          dependencyAuthorities: dependencyAuthorityResult,
        },
      );
    actionCandidateBridges.push(bridge);
    if (bridge.status !== "ready") {
      return blocked(
        "s0_action_candidate_bridge",
        bridge.blockingReasons.map((x) => `action_bridge:${x}`),
      );
    }

    const exactOwnerEvidence = postOwnerBoundConditionEvidenceResult
      .domainBoundConditionEvidence.filter(
        (evidence) =>
          evidence.sourceFinalWhereDecision ===
            terminalEnvelope.sourceFinalWhereDecision,
      );
    if (exactOwnerEvidence.length !== 1) {
      return blocked("s0_action_binding_association", [
        "post_owner_evidence:not_exact_singleton_for_terminal_envelope",
      ]);
    }

    const association =
      deriveCanonicalRuntimeDependencyActionBindingAssociationBoundaryV1(
        dependencyAuthorityResult.authorities,
        bindingAuthorityResult.authorities,
        exactOwnerEvidence,
      );
    associationResults.push(association);
    if (association.status !== "ready") {
      return blocked(
        "s0_action_binding_association",
        association.blockingReasons.map((x) => `association:${x}`),
      );
    }

    const readiness =
      deriveCanonicalRuntimeExecutionReadinessEvidenceBoundaryV1({
        actionCandidateBridge: bridge,
        dependencyActionBindingAssociation: association,
      });
    if (readiness.status !== "ready") {
      return blocked(
        "s0_execution_readiness",
        readiness.blockingReasons.map((x) => `readiness:${x}`),
      );
    }
    readinessEvidence.push(...readiness.evidence);
  }

  const endpointResolutionEvidenceResult =
    deriveCanonicalRuntimeDependencyEndpointResolutionEvidenceBoundaryV1({
      executionReadinessEvidence: readinessEvidence,
      finalRuntimeBindings:
        finalRuntimeBindingResult.authority.domainFinalRuntimeBinding,
    });
  if (endpointResolutionEvidenceResult.status !== "ready") {
    return blocked(
      "s0_endpoint_resolution",
      endpointResolutionEvidenceResult.blockingReasons.map((x) =>
        `endpoint:${x}`
      ),
    );
  }

  const d4PreconditionEvidenceResult =
    deriveCanonicalRuntimeActionExecutionPreconditionEvidenceBoundaryV1({
      executionReadinessEvidence: readinessEvidence,
      endpointResolutionEvidence: endpointResolutionEvidenceResult.evidence,
    });
  if (d4PreconditionEvidenceResult.status !== "ready") {
    return blocked(
      "s0_d4_precondition",
      d4PreconditionEvidenceResult.blockingReasons.map((x) => `d4:${x}`),
    );
  }

  return {
    producer: CANONICAL_RUNTIME_S0_INITIAL_EPOCH_COMPOSITION_BOUNDARY_V1,
    producerVersion:
      CANONICAL_RUNTIME_S0_INITIAL_EPOCH_COMPOSITION_BOUNDARY_VERSION_V1,
    status: "ready" as const,
    state: "resolved_s0_initial_epoch_composition" as const,
    snapshotIdentityId: snapshotAuthority.snapshotIdentityId,
    snapshotSentenceOccurrenceIdentityId:
      resultingCurrentContext.authority.snapshotSentenceOccurrenceIdentityId,
    sentenceNodeId: resultingCurrentContext.authority.sentenceNodeId,
    tokenNodeId: input.tokenNodeId,
    graph: resultingGraph,
    currentContextResult: resultingCurrentContext,
    snapshotIdentityAuthority: snapshotAuthority,
    snapshotResult,
    directTokenDomainResult,
    referencedDomainCompositionResult,
    snapshotDomainResult,
    graphBoundProjectionResult,
    c2Result,
    d2aResult,
    currentApplicabilityResult,
    currentDomainResult,
    dependencyAuthorityResult,
    recursiveWhereResult,
    ownerProvenanceResult,
    finalWhereDecisionResult,
    survivorResult,
    postOwnerFinalBindingResult,
    postOwnerBoundConditionEvidenceResult,
    terminalAggregationResult,
    bindingAuthorityResult,
    actionCandidateBridges,
    associationResults,
    executionReadinessEvidence: readinessEvidence,
    endpointResolutionEvidenceResult,
    d4PreconditionEvidenceResult,
    blockingReasons: [] as const,
    governance: {
      s0GraphConsumedFromExplicitInput: true as const,
      s0CurrentContextDerivedCanonically: true as const,
      s0DirectTokenDomainDerived: true as const,
      s0SnapshotDomainDerived: true as const,
      s0GraphBoundProjectionDerived: true as const,
      s0C2Derived: true as const,
      s0D2aDerived: true as const,
      s0CurrentApplicabilityDerived: true as const,
      s0BindingWhereChainDerivedThroughCanonicalPublicDerivers: true as const,
      s0ActionCandidatesDerived: true as const,
      s0ExecutionReadinessDerived: true as const,
      s0EndpointEvidenceDerived: true as const,
      s0D4PreconditionDerived: true as const,
      priorSnapshotBoundEvidenceReused: false as const,
      pseudoTransitionCreated: false as const,
      newLinguisticSemanticsCreated: false as const,
      sentenceIndexUsedAsIdentity: false as const,
      sentenceSelectedHere: false as const,
      newIdentityFormulaCreated: false as const,
      graphMutationPerformed: false as const,
      runtimeActionExecuted: false as const,
      schedulerInvoked: false as const,
      activationPermissionResolved: false as const,
      executionAdmissionResolved: false as const,
      learnerFacingInterpretationPerformed: false as const,
    },
  };
}
