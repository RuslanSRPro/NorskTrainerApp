import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "jsr:@std/assert";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-final-runtime-binding-v1.ts";

const productionUrl = new URL(
  "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-final-runtime-binding-v1.ts",
  import.meta.url,
);

const source = await Deno.readTextFile(productionUrl);

Deno.test("post-WHERE OWNER final binding depends only on post-WHERE OWNER binding value projection", () => {
  assert(
    source.includes(
      "canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-binding-value-projection-v1.ts",
    ),
  );

  for (const forbidden of [
    "canonical-runtime-token-pos-current-snapshot-bound-binding-value-projection-v1.ts",
    "canonical-runtime-token-pos-current-snapshot-bound-binding-occurrence-set-v1.ts",
    "canonical-runtime-token-pos-current-snapshot-bound-binding-eligibility-v1.ts",
    "canonical-runtime-token-pos-current-snapshot-bound-occurrence-filtering-v1.ts",
  ]) {
    assertEquals(source.includes(forbidden), false);
  }
});

Deno.test("post-WHERE OWNER final binding preserves OWNER lineage and excludes old REFERENCED lineage", () => {
  for (const field of [
    "structuralAuthorityId",
    "ownerBindingDefinitionAuthorityId",
    "manifestId",
    "manifestCode",
    "ownerBindingName",
    "snapshotIdentityId",
    "snapshotSentenceOccurrenceIdentityId",
    "graphDocumentId",
    "sentenceNodeId",
  ]) {
    assert(source.includes(field));
  }

  assertEquals(source.includes("referencedBindingName"), false);
  assertEquals(source.includes("expectedSiteAuthorityId"), false);
});

Deno.test("post-WHERE OWNER final binding maps only exact projection states", () => {
  for (const state of [
    '"projected"',
    '"not_projected_unresolved"',
    '"not_projected_cardinality_violation"',
    '"bound"',
    '"not_bound_unresolved"',
    '"not_bound_cardinality_violation"',
  ]) {
    assert(source.includes(state));
  }
});

Deno.test("post-WHERE OWNER final binding preserves collection semantics without winner or scalar collapse", () => {
  for (const token of [
    "canonicalCollectionValuePreserved: true",
    "emptyCollectionFinalBindingAllowed: true",
    "emptyCollectionTreatedAsOccurrenceBinding: false",
    "singletonCollectionCollapsedToScalar: false",
    "singletonCollectionTreatedAsWinner: false",
    "occurrenceWinnerSelected: false",
  ]) {
    assert(source.includes(token));
  }
});

Deno.test("post-WHERE OWNER final binding does not activate runtime or recompute upstream semantics", () => {
  for (const token of [
    "readinessRecomputed: false",
    "cardinalityRecomputed: false",
    "whereEvaluationPerformed: false",
    "whereRecomputed: false",
    "runtimeBindingExecuted: false",
    "bindingTruthResolved: false",
    "learnerErrorClassified: false",
    "constraintPropagationInvoked: false",
    "graphMutationPerformed: false",
  ]) {
    assert(source.includes(token));
  }
});

Deno.test("post-WHERE OWNER final binding public derivation is available", () => {
  assertStrictEquals(
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1,
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

Deno.test("runtime final binding: ready singleton creates exact one-member OWNER binding", () => {
  const survivorResult = finalBindingRuntimeSurvivorResult(
    "satisfied",
    [finalBindingRuntimeOccurrence("token-1", "snapshot-token-1")],
  );

  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1(
    survivorResult,
    [finalBindingRuntimeDependencyAuthority()],
    [finalBindingRuntimeManifestRow("one")],
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  assertEquals(result.domainFinalRuntimeBindings.length, 1);
  const domain = result.domainFinalRuntimeBindings[0];

  assertEquals(domain.bindingState, "bound");
  assertEquals(domain.finalRuntimeBindingResolved, true);
  assert(domain.finalRuntimeBindingValue !== null);
  if (domain.finalRuntimeBindingValue === null) return;

  assertEquals(domain.finalRuntimeBindingValue.valueKind, "ordered_snapshot_token_occurrence_collection");
  assertEquals(domain.finalRuntimeBindingValue.memberCount, 1);
  assertEquals(domain.boundOccurrenceCount, 1);
  assertEquals(domain.occurrenceBindingPerformed, true);
  assertEquals(domain.finalRuntimeOccurrenceBindingPerformed, true);

  const member = domain.finalRuntimeBindingValue.members[0];
  assertEquals(member.snapshotTokenOccurrenceIdentityId, "snapshot-token-1");
  assertEquals(member.tokenNodeId, "token-1");
  assertEquals(member.graphStatus, "resolved");
  assertEquals(member.containmentEdgeId, "contains:token-1");
  assertEquals(member.sentenceTokenIndex, 0);

  assertStrictEquals(
    domain.finalRuntimeBindingValue,
    domain.sourceProjectionDomain.projectedValue,
  );
});

Deno.test("runtime final binding: ready zero OWNER occurrences bind empty collection without occurrence binding", () => {
  const survivorResult = finalBindingRuntimeSurvivorResult("satisfied", []);

  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1(
    survivorResult,
    [finalBindingRuntimeDependencyAuthority()],
    [finalBindingRuntimeManifestRow("zero_or_more")],
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  const domain = result.domainFinalRuntimeBindings[0];
  assertEquals(domain.bindingState, "bound");
  assertEquals(domain.finalRuntimeBindingResolved, true);
  assert(domain.finalRuntimeBindingValue !== null);
  if (domain.finalRuntimeBindingValue === null) return;

  assertEquals(domain.finalRuntimeBindingValue.memberCount, 0);
  assertEquals(domain.finalRuntimeBindingValue.members, []);
  assertEquals(domain.boundOccurrenceCount, 0);
  assertEquals(domain.occurrenceBindingPerformed, false);
  assertEquals(domain.finalRuntimeOccurrenceBindingPerformed, false);
  assertEquals(result.boundDomainCount, 1);
  assertEquals(result.boundOccurrenceCount, 0);
  assertEquals(result.governance.finalRuntimeBindingResolved, true);
  assertEquals(result.governance.occurrenceBindingPerformed, false);
  assertEquals(result.governance.finalRuntimeOccurrenceBindingPerformed, false);
});

Deno.test("runtime final binding: unresolved OWNER projection remains explicitly not bound", () => {
  const survivorResult = finalBindingRuntimeSurvivorResult(
    "uncertain",
    [finalBindingRuntimeOccurrence("token-1", "snapshot-token-1")],
  );

  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1(
    survivorResult,
    [finalBindingRuntimeDependencyAuthority()],
    [finalBindingRuntimeManifestRow("one")],
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  const domain = result.domainFinalRuntimeBindings[0];
  assertEquals(domain.bindingState, "not_bound_unresolved");
  assertEquals(domain.finalRuntimeBindingResolved, false);
  assertEquals(domain.finalRuntimeBindingValue, null);
  assertEquals(domain.boundOccurrenceCount, 0);
  assertEquals(domain.occurrenceBindingPerformed, false);
  assertEquals(domain.finalRuntimeOccurrenceBindingPerformed, false);
  assertEquals(result.boundDomainCount, 0);
  assertEquals(result.unresolvedDomainCount, 1);
  assertEquals(result.cardinalityViolationDomainCount, 0);
});

Deno.test("runtime final binding: cardinality violation remains explicitly not bound without winner", () => {
  const survivorResult = finalBindingRuntimeSurvivorResult(
    "satisfied",
    [
      finalBindingRuntimeOccurrence("token-1", "snapshot-token-1"),
      finalBindingRuntimeOccurrence("token-2", "snapshot-token-2"),
    ],
  );

  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1(
    survivorResult,
    [finalBindingRuntimeDependencyAuthority()],
    [finalBindingRuntimeManifestRow("one")],
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  const domain = result.domainFinalRuntimeBindings[0];
  assertEquals(domain.bindingState, "not_bound_cardinality_violation");
  assertEquals(domain.finalRuntimeBindingResolved, false);
  assertEquals(domain.finalRuntimeBindingValue, null);
  assertEquals(domain.boundOccurrenceCount, 0);
  assertEquals(domain.occurrenceBindingPerformed, false);
  assertEquals(domain.finalRuntimeOccurrenceBindingPerformed, false);
  assertEquals(domain.governance.occurrenceWinnerSelected, false);
  assertEquals(result.boundDomainCount, 0);
  assertEquals(result.unresolvedDomainCount, 0);
  assertEquals(result.cardinalityViolationDomainCount, 1);
});

Deno.test("runtime final binding: multiple OWNER occurrences preserve exact order multiplicity and collection identity", () => {
  const survivorResult = finalBindingRuntimeSurvivorResult(
    "satisfied",
    [
      finalBindingRuntimeOccurrence("token-1", "snapshot-token-1"),
      finalBindingRuntimeOccurrence("token-2", "snapshot-token-2"),
    ],
  );

  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerFinalRuntimeBindingV1(
    survivorResult,
    [finalBindingRuntimeDependencyAuthority()],
    [finalBindingRuntimeManifestRow("one_or_more")],
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;

  const domain = result.domainFinalRuntimeBindings[0];
  assertEquals(domain.bindingState, "bound");
  assert(domain.finalRuntimeBindingValue !== null);
  if (domain.finalRuntimeBindingValue === null) return;

  assertEquals(domain.finalRuntimeBindingValue.memberCount, 2);
  assertEquals(
    domain.finalRuntimeBindingValue.members.map((member) => member.tokenNodeId),
    ["token-1", "token-2"],
  );
  assertEquals(
    domain.finalRuntimeBindingValue.members.map((member) => member.snapshotTokenOccurrenceIdentityId),
    ["snapshot-token-1", "snapshot-token-2"],
  );
  assertEquals(
    domain.finalRuntimeBindingValue.members.map((member) => member.sentenceTokenIndex),
    [0, 1],
  );
  assertStrictEquals(
    domain.finalRuntimeBindingValue,
    domain.sourceProjectionDomain.projectedValue,
  );
  assertEquals(domain.boundOccurrenceCount, 2);
  assertEquals(domain.occurrenceBindingPerformed, true);
  assertEquals(domain.finalRuntimeOccurrenceBindingPerformed, true);
  assertEquals(domain.governance.occurrenceWinnerSelected, false);
});
