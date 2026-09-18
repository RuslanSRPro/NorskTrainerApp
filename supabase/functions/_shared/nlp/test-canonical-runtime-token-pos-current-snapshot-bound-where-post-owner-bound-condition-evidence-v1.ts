import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "jsr:@std/assert";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-bound-condition-evidence-v1.ts";

const productionUrl = new URL(
  "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-bound-condition-evidence-v1.ts",
  import.meta.url,
);

const source = await Deno.readTextFile(productionUrl);

Deno.test("post-final OWNER bound-condition evidence consumes only post-WHERE OWNER final runtime binding", () => {
  assert(
    source.includes(
      "canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-final-runtime-binding-v1.ts",
    ),
  );

  for (const forbidden of [
    "canonical-runtime-token-pos-current-snapshot-bound-comparison-v2",
    "canonical-runtime-token-pos-current-snapshot-bound-bound-condition-evidence-v1",
    "deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundDomainComparisonV2",
  ]) {
    assertEquals(source.includes(forbidden), false);
  }
});

Deno.test("post-final OWNER bound-condition evidence preserves transitive final-WHERE and A4.6a1f provenance", () => {
  for (const token of [
    "sourceFinalWhereDecision",
    "sourceRootCandidate",
    "exactFinalWhereDecisionPreservedTransitively: true",
    "exactA46a1fRootCandidatePreservedTransitively: true",
  ]) {
    assert(source.includes(token));
  }
});

Deno.test("post-final OWNER bound-condition evidence excludes REFERENCED identity impersonation and winner selection", () => {
  for (const forbidden of [
    "expectedSiteAuthorityId",
    "referencedBindingDefinitionAuthorityId",
    "referencedBindingName",
    "referenceSiteKey",
    "referencePath",
  ]) {
    assertEquals(source.includes(forbidden), false);
  }

  assert(source.includes("rawComparisonV2Rejoined: false"));
  assert(source.includes("referencedBindingIdentityUsedAsOwnerIdentity: false"));
  assert(source.includes("occurrenceWinnerSelected: false"));
});

Deno.test("post-final OWNER bound-condition evidence does not activate runtime or resolve condition truth", () => {
  for (const token of [
    "runtimeBindingExecuted: false",
    "runtimeConditionTruthResolved: false",
    "bindingTruthResolved: false",
    "whereEvaluationPerformed: false",
    "whereRecomputed: false",
    "learnerErrorClassified: false",
    "constraintPropagationInvoked: false",
    "graphMutationPerformed: false",
  ]) {
    assert(source.includes(token));
  }
});

Deno.test("post-final OWNER bound-condition evidence public derivation is available", () => {
  assertStrictEquals(
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceV1,
    "function",
  );
});

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-survivor-set-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionReadyResultV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1.ts";

import type {
  CanonicalDependencyRuntimeActionAuthorityV1,
  CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from "./canonical-dependency-runtime-authority-v1.ts";

type ProjectionRuntimeFinalReady =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionReadyResultV1;

type ProjectionRuntimeDecision =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1;

function finalBindingRuntimeOccurrence(
  tokenNodeId: string,
  snapshotTokenOccurrenceIdentityId: string,
) {
  return {
    tokenNodeId,
    graphStatus: "resolved",
    containmentEdgeId: "contains:" + tokenNodeId,
    sentenceTokenIndex: tokenNodeId === "token-1" ? 0 : 1,
    snapshotTokenOccurrenceIdentityId,
  };
}

function finalBindingRuntimeFinalWhereFixture(
  disposition: "satisfied" | "rejected" | "uncertain",
  occurrences: ReturnType<typeof finalBindingRuntimeOccurrence>[],
) {
  const ownerBindingDefinitionAuthorityId =
    "runtime-binding-definition-authority-v1:manifest-code-1:owner";

  const sourceDomain = {
    id: "owner-domain-1",
    status: "candidate",

    structuralAuthorityId: "structural-1",

    ownerBindingDefinitionAuthorityId,

    manifestId: "manifest-id-1",
    manifestCode: "manifest-code-1",
    ownerBindingName: "owner",

    runtimeScopeLabel: "sentence",
    canonicalBoundaryLabel: "sentence",
    canonicalBoundaryAuthorityId: "boundary-authority-1",

    snapshotAuthorityId: "snapshot-authority-1",

    snapshotIdentityId: "snapshot-1",
    snapshotSentenceOccurrenceIdentityId: "sentence-occurrence-1",

    graphDocumentId: "graph-1",
    sentenceNodeId: "sentence-1",
    sentenceIndex: 0,

    canonicalTokenDomainId: "token-domain-1",

    occurrenceCount: occurrences.length,
    occurrences,

    sourceRootCandidate: {},
    sourceStructuralAuthority: {},
    sourceScopeCompatibility: {},
    sourceDirectDomain: {},
    sourceSnapshotAuthority: {},
    governance: {},
  };

  const decision = {
    decisionId: "final-where-decision-1",

    status: "proven_final_where_root_truth_decision",

    structuralAuthorityId: "structural-1",

    ownerBindingDefinitionAuthorityId,

    snapshotIdentityId: "snapshot-1",
    snapshotSentenceOccurrenceIdentityId: "sentence-occurrence-1",

    graphDocumentId: "graph-1",
    sentenceNodeId: "sentence-1",

    rootTruthDisposition: disposition === "satisfied"
      ? "resolved_true"
      : disposition === "rejected"
      ? "resolved_false"
      : "unresolved",

    decisionDisposition: disposition,

    sourceOwnerBindingOccurrenceDomain: sourceDomain,

    sourceRootCandidate: {},
    governance: {},
  } as unknown as ProjectionRuntimeDecision;

  const result = {
    producer:
      "canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1",

    producerVersion: "1.0.0",

    specificationId: "late-v1.40:final-runtime-where-root-truth-decision-v1",

    status: "ready",

    sourceOwnerResult: {},

    decisions: [decision],
    decisionCount: 1,

    blockingReasons: [],
    governance: {},
  } as unknown as ProjectionRuntimeFinalReady;

  return result;
}

function finalBindingRuntimeSurvivorResult(
  disposition: "satisfied" | "rejected" | "uncertain",
  occurrences: ReturnType<typeof finalBindingRuntimeOccurrence>[],
) {
  return deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
    finalBindingRuntimeFinalWhereFixture(
      disposition,
      occurrences,
    ),
  );
}

function finalBindingRuntimeDependencyAuthority(): CanonicalDependencyRuntimeActionAuthorityV1 {
  return {
    id: "dependency-authority-1",
    status: "candidate",

    manifestId: "manifest-id-1",
    manifestCode: "manifest-code-1",

    runtimeFamily: "token_pos",
    executionPhase: "runtime",
    constraintStrength: null,

    actionIndex: 0,

    relation: "opaque",
    actionTarget: "opaque",
    actionValue: null,
    reasonCode: null,

    sourceCandidateCodes: [],

    governance: {
      validatedManifestRequired: true,
      createDependencyActionRequired: true,
      relationPreservedOpaque: true,
      actionTargetPreservedOpaque: true,
      actionValuePreservedOpaque: true,
      executionPhasePreservedOpaque: true,
      runtimeFamilyPreservedOpaque: true,
      endpointDirectionResolved: false,
      endpointBindingPerformed: false,
      dependencySemanticsResolved: false,
      canonicalEdgeGenerated: false,
      alternativeSetGenerated: false,
      productionActivationAssumed: false,
      manifestMutationPerformed: false,
      candidateOnly: true,
      frozenGrammarReadOnly: true,
    },
  };
}

function finalBindingRuntimeManifestRow(
  cardinality: string,
): CanonicalDependencyRuntimeManifestAuthorityRowV1 {
  return {
    id: "manifest-id-1",
    code: "manifest-code-1",
    authoring_status: "validated",
    runtime_family: "token_pos",
    execution_phase: "runtime",

    ir_spec: {
      bindings: {
        owner: {
          entity: "token",
          scope: "sentence",
          cardinality,
        },
      },
    },
  } as CanonicalDependencyRuntimeManifestAuthorityRowV1;
}

function deriveBoundConditionEvidence(
  disposition: "satisfied" | "rejected" | "uncertain",
  occurrences: ReturnType<typeof finalBindingRuntimeOccurrence>[],
  cardinality: string,
) {
  const survivorResult = finalBindingRuntimeSurvivorResult(
    disposition,
    occurrences,
  );

  return deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBoundConditionEvidenceV1(
    survivorResult,
    [finalBindingRuntimeDependencyAuthority()],
    [finalBindingRuntimeManifestRow(cardinality)],
  );
}

Deno.test("runtime post-final evidence: ready singleton consumes exact OWNER collection and preserves provenance identity", () => {
  const result = deriveBoundConditionEvidence(
    "satisfied",
    [finalBindingRuntimeOccurrence("token-1", "snapshot-token-1")],
    "one",
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  assertEquals(result.domainCount, 1);
  assertEquals(result.consumedBindingDomainCount, 1);
  assertEquals(result.projectedConditionMemberCount, 1);

  const evidence = result.domainBoundConditionEvidence[0];

  assertEquals(evidence.boundConditionDomainState, "binding_consumed");
  assertEquals(evidence.runtimeBindingConsumed, true);
  assertEquals(evidence.conditionEvidenceProjected, true);
  assert(evidence.boundConditionCollection !== null);
  if (evidence.boundConditionCollection === null) return;

  assertEquals(evidence.boundConditionCollection.memberCount, 1);
  assertEquals(
    evidence.boundConditionCollection.members[0].snapshotTokenOccurrenceIdentityId,
    "snapshot-token-1",
  );
  assertEquals(
    evidence.boundConditionCollection.members[0].tokenNodeId,
    "token-1",
  );

  assertStrictEquals(
    evidence.boundConditionCollection.sourceFinalRuntimeBindingValue,
    evidence.sourceFinalRuntimeBindingDomain.finalRuntimeBindingValue,
  );
  assertStrictEquals(
    evidence.boundConditionCollection.members,
    evidence.sourceFinalRuntimeBindingDomain.finalRuntimeBindingValue?.members,
  );
  assertStrictEquals(
    evidence.sourceFinalWhereDecision,
    evidence.sourceFinalRuntimeBindingDomain
      .sourceProjectionDomain
      .sourceReadinessDomain
      .sourceCardinalityEnforcementDomain
      .sourceCardinalitySemanticDomain
      .sourceSurvivorDomain
      .sourceFinalWhereDecision,
  );
  assertStrictEquals(
    evidence.sourceRootCandidate,
    evidence.sourceFinalWhereDecision.sourceRootCandidate,
  );
});

Deno.test("runtime post-final evidence: ready zero OWNER occurrences consume exact empty collection without synthetic occurrence evidence", () => {
  const result = deriveBoundConditionEvidence(
    "satisfied",
    [],
    "zero_or_more",
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  const evidence = result.domainBoundConditionEvidence[0];

  assertEquals(evidence.boundConditionDomainState, "binding_consumed");
  assertEquals(evidence.runtimeBindingConsumed, true);
  assertEquals(evidence.conditionEvidenceProjected, true);
  assert(evidence.boundConditionCollection !== null);
  if (evidence.boundConditionCollection === null) return;

  assertEquals(evidence.boundConditionCollection.memberCount, 0);
  assertEquals(evidence.boundConditionCollection.members, []);
  assertEquals(result.projectedConditionMemberCount, 0);
  assertEquals(
    evidence.governance.emptyFinalBindingSynthesizesOccurrenceEvidence,
    false,
  );
});

Deno.test("runtime post-final evidence: unresolved OWNER binding remains explicit non-consumption", () => {
  const result = deriveBoundConditionEvidence(
    "uncertain",
    [finalBindingRuntimeOccurrence("token-1", "snapshot-token-1")],
    "one",
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  const evidence = result.domainBoundConditionEvidence[0];

  assertEquals(
    evidence.boundConditionDomainState,
    "binding_not_consumed_unresolved",
  );
  assertEquals(evidence.runtimeBindingConsumed, false);
  assertEquals(evidence.conditionEvidenceProjected, false);
  assertEquals(evidence.boundConditionCollection, null);
  assertEquals(result.consumedBindingDomainCount, 0);
  assertEquals(result.unconsumedUnresolvedDomainCount, 1);
  assertEquals(result.projectedConditionMemberCount, 0);
  assertStrictEquals(
    evidence.sourceRootCandidate,
    evidence.sourceFinalWhereDecision.sourceRootCandidate,
  );
});

Deno.test("runtime post-final evidence: cardinality violation remains explicit non-consumption without winner", () => {
  const result = deriveBoundConditionEvidence(
    "satisfied",
    [
      finalBindingRuntimeOccurrence("token-1", "snapshot-token-1"),
      finalBindingRuntimeOccurrence("token-2", "snapshot-token-2"),
    ],
    "one",
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  const evidence = result.domainBoundConditionEvidence[0];

  assertEquals(
    evidence.boundConditionDomainState,
    "binding_not_consumed_cardinality_violation",
  );
  assertEquals(evidence.runtimeBindingConsumed, false);
  assertEquals(evidence.conditionEvidenceProjected, false);
  assertEquals(evidence.boundConditionCollection, null);
  assertEquals(result.consumedBindingDomainCount, 0);
  assertEquals(result.unconsumedCardinalityViolationDomainCount, 1);
  assertEquals(result.projectedConditionMemberCount, 0);
  assertEquals(evidence.governance.occurrenceWinnerSelected, false);
});

Deno.test("runtime post-final evidence: multiple OWNER occurrences preserve exact order multiplicity and collection identity", () => {
  const result = deriveBoundConditionEvidence(
    "satisfied",
    [
      finalBindingRuntimeOccurrence("token-1", "snapshot-token-1"),
      finalBindingRuntimeOccurrence("token-2", "snapshot-token-2"),
    ],
    "one_or_more",
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  const evidence = result.domainBoundConditionEvidence[0];

  assertEquals(evidence.boundConditionDomainState, "binding_consumed");
  assert(evidence.boundConditionCollection !== null);
  if (evidence.boundConditionCollection === null) return;

  assertEquals(evidence.boundConditionCollection.memberCount, 2);
  assertEquals(
    evidence.boundConditionCollection.members.map((member) => member.tokenNodeId),
    ["token-1", "token-2"],
  );
  assertEquals(
    evidence.boundConditionCollection.members.map(
      (member) => member.snapshotTokenOccurrenceIdentityId,
    ),
    ["snapshot-token-1", "snapshot-token-2"],
  );
  assertEquals(
    evidence.boundConditionCollection.members.map(
      (member) => member.sentenceTokenIndex,
    ),
    [0, 1],
  );

  assertStrictEquals(
    evidence.boundConditionCollection.members,
    evidence.sourceFinalRuntimeBindingDomain.finalRuntimeBindingValue?.members,
  );
  assertEquals(result.projectedConditionMemberCount, 2);
  assertEquals(evidence.governance.occurrenceWinnerSelected, false);
});