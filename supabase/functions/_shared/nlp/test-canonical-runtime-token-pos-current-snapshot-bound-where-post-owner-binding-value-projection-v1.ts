import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "jsr:@std/assert";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-binding-value-projection-v1.ts";

const productionUrl =
  new URL(
    "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-binding-value-projection-v1.ts",
    import.meta.url,
  );

const source =
  await Deno.readTextFile(productionUrl);

Deno.test(
  "post-WHERE OWNER projection depends only on post-WHERE binding readiness",
  () => {
    assert(
      source.includes(
        "canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-binding-readiness-v1.ts",
      ),
    );

    assertEquals(
      source.includes(
        "canonical-runtime-token-pos-current-snapshot-bound-binding-occurrence-set-v1.ts",
      ),
      false,
    );

    assertEquals(
      source.includes(
        "canonical-runtime-token-pos-current-snapshot-bound-binding-eligibility-v1.ts",
      ),
      false,
    );

    assertEquals(
      source.includes(
        "canonical-runtime-token-pos-current-snapshot-bound-cardinality-enforcement-v1.ts",
      ),
      false,
    );
  },
);

Deno.test(
  "post-WHERE OWNER projected member preserves exact canonical direct occurrence value fields",
  () => {
    for (
      const field of [
        "snapshotTokenOccurrenceIdentityId",
        "tokenNodeId",
        "graphStatus",
        "containmentEdgeId",
        "sentenceTokenIndex",
      ]
    ) {
      assert(source.includes(field));
    }

    assert(
      source.includes(
        "occurrence.sourceOccurrenceDecision.sourceOccurrence",
      ),
    );
  },
);

Deno.test(
  "post-WHERE OWNER projection preserves OWNER domain identity and not old REFERENCED projection identity",
  () => {
    for (
      const field of [
        "structuralAuthorityId",
        "ownerBindingDefinitionAuthorityId",
        "manifestId",
        "manifestCode",
        "ownerBindingName",
      ]
    ) {
      assert(source.includes(field));
    }

    assertEquals(
      source.includes("referencedBindingName"),
      false,
    );

    assertEquals(
      source.includes("expectedSiteAuthorityId"),
      false,
    );
  },
);

Deno.test(
  "post-WHERE OWNER projection projects only binding-ready eligible occurrences",
  () => {
    assert(
      source.includes(
        'domain.readinessState !== "ready"',
      ),
    );

    assert(
      source.includes(
        "domain.bindingReady !== true",
      ),
    );

    assert(
      source.includes(
        'occurrence.eligibilityState === "eligible"',
      ),
    );

    assert(
      source.includes(
        "occurrence.bindingEligible === true",
      ),
    );

    assert(
      source.includes(
        "eligibleOccurrences.length !==",
      ),
    );

    assert(
      source.includes(
        "domain.survivingOccurrenceCount",
      ),
    );
  },
);

Deno.test(
  "post-WHERE OWNER projection preserves ordered collection semantics without winner or scalar collapse",
  () => {
    assert(
      source.includes(
        '"ordered_snapshot_token_occurrence_collection"',
      ),
    );

    assert(
      source.includes(
        "collectionOrderPreserved:",
      ),
    );

    assert(
      source.includes(
        "collectionMultiplicityPreserved:",
      ),
    );

    assert(
      source.includes(
        "singletonCollectionCollapsedToScalar:",
      ),
    );

    assert(
      source.includes(
        "singletonCollectionTreatedAsWinner:",
      ),
    );

    assert(
      source.includes(
        "zeroReadyOccurrencesProjectEmptyCollection:",
      ),
    );

    assert(
      source.includes(
        "occurrenceWinnerSelected:",
      ),
    );

    assert(
      source.includes(
        "finalRuntimeOccurrenceBindingPerformed:",
      ),
    );
  },
);

Deno.test(
  "post-WHERE OWNER projection does not execute WHERE, final binding, learner error, or graph mutation",
  () => {
    assert(
      source.includes(
        "whereEvaluationPerformed:",
      ),
    );

    assert(
      source.includes(
        "whereRecomputed:",
      ),
    );

    assert(
      source.includes(
        "bindingTruthResolved:",
      ),
    );

    assert(
      source.includes(
        "runtimeBindingExecuted:",
      ),
    );

    assert(
      source.includes(
        "learnerErrorCreated:",
      ),
    );

    assert(
      source.includes(
        "graphMutationPerformed:",
      ),
    );
  },
);

Deno.test(
  "post-WHERE OWNER projection source preserves exact eligibility occurrence object",
  () => {
    assert(
      source.includes(
        "sourceEligibilityOccurrence:",
      ),
    );

    assert(
      source.includes(
        "sourceEligibilityOccurrence:",
      ),
    );
  },
);

Deno.test(
  "post-WHERE OWNER projection public derivation remains downstream of readiness",
  async () => {
    assertStrictEquals(
      typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1,
      "function",
    );
  },
);

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

function projectionRuntimeOccurrence(
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

function projectionRuntimeFinalWhereFixture(
  disposition: "satisfied" | "rejected" | "uncertain",
  occurrences: ReturnType<typeof projectionRuntimeOccurrence>[],
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

function projectionRuntimeSurvivorResult(
  disposition: "satisfied" | "rejected" | "uncertain",
  occurrences: ReturnType<typeof projectionRuntimeOccurrence>[],
) {
  return deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
    projectionRuntimeFinalWhereFixture(
      disposition,
      occurrences,
    ),
  );
}

function projectionRuntimeDependencyAuthority(): CanonicalDependencyRuntimeActionAuthorityV1 {
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

function projectionRuntimeManifestRow(
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


Deno.test("runtime projection: ready singleton projects exact OWNER member", () => {
  const survivorResult = projectionRuntimeSurvivorResult(
    "satisfied",
    [projectionRuntimeOccurrence("token-1", "snapshot-token-1")],
  );

  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1(
    survivorResult,
    [projectionRuntimeDependencyAuthority()],
    [projectionRuntimeManifestRow("one")],
  );

  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;
  assertEquals(result.projectionDomains.length, 1);
  const domain = result.projectionDomains[0];
  assertEquals(domain.projectionState, "projected");
  assertEquals(domain.readinessState, "ready");
  assertEquals(domain.bindingReady, true);
  assert(domain.projectedValue !== null);
  if (domain.projectedValue === null) return;
  assertEquals(domain.projectedValue.memberCount, 1);
  const member = domain.projectedValue.members[0];
  assertEquals(member.snapshotTokenOccurrenceIdentityId, "snapshot-token-1");
  assertEquals(member.tokenNodeId, "token-1");
  assertEquals(member.graphStatus, "resolved");
  assertEquals(member.containmentEdgeId, "contains:token-1");
  assertEquals(member.sentenceTokenIndex, 0);
  assertStrictEquals(
    member.sourceEligibilityOccurrence,
    domain.sourceReadinessDomain.occurrenceEligibility[0],
  );
});

Deno.test("runtime projection: ready zero OWNER occurrences project empty collection", () => {
  const survivorResult = projectionRuntimeSurvivorResult("satisfied", []);
  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1(
    survivorResult,
    [projectionRuntimeDependencyAuthority()],
    [projectionRuntimeManifestRow("zero_or_more")],
  );
  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;
  const domain = result.projectionDomains[0];
  assertEquals(domain.projectionState, "projected");
  assert(domain.projectedValue !== null);
  if (domain.projectedValue === null) return;
  assertEquals(domain.projectedValue.memberCount, 0);
  assertEquals(domain.projectedValue.members, []);
});

Deno.test("runtime projection: unresolved readiness remains explicit non-projection", () => {
  const survivorResult = projectionRuntimeSurvivorResult(
    "uncertain",
    [projectionRuntimeOccurrence("token-1", "snapshot-token-1")],
  );
  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1(
    survivorResult,
    [projectionRuntimeDependencyAuthority()],
    [projectionRuntimeManifestRow("one")],
  );
  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;
  assertEquals(result.projectionDomains.length, 1);
  const domain = result.projectionDomains[0];
  assertEquals(domain.projectionState, "not_projected_unresolved");
  assertEquals(domain.readinessState, "unresolved_occurrences");
  assertEquals(domain.bindingReady, false);
  assertEquals(domain.projectedValue, null);
});

Deno.test("runtime projection: cardinality violation remains explicit without winner", () => {
  const survivorResult = projectionRuntimeSurvivorResult(
    "satisfied",
    [
      projectionRuntimeOccurrence("token-1", "snapshot-token-1"),
      projectionRuntimeOccurrence("token-2", "snapshot-token-2"),
    ],
  );
  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1(
    survivorResult,
    [projectionRuntimeDependencyAuthority()],
    [projectionRuntimeManifestRow("one")],
  );
  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;
  assertEquals(result.projectionDomains.length, 1);
  const domain = result.projectionDomains[0];
  assertEquals(domain.projectionState, "not_projected_cardinality_violation");
  assertEquals(domain.readinessState, "cardinality_violation");
  assertEquals(domain.bindingReady, false);
  assertEquals(domain.projectedValue, null);
  assertEquals(domain.governance.occurrenceWinnerSelected, false);
});

Deno.test("runtime projection: multiple ready OWNER occurrences preserve order and multiplicity", () => {
  const survivorResult = projectionRuntimeSurvivorResult(
    "satisfied",
    [
      projectionRuntimeOccurrence("token-1", "snapshot-token-1"),
      projectionRuntimeOccurrence("token-2", "snapshot-token-2"),
    ],
  );
  const result = deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingValueProjectionV1(
    survivorResult,
    [projectionRuntimeDependencyAuthority()],
    [projectionRuntimeManifestRow("one_or_more")],
  );
  assertEquals(result.status, "ready");
  if (result.status !== "ready") return;
  const domain = result.projectionDomains[0];
  assertEquals(domain.projectionState, "projected");
  assert(domain.projectedValue !== null);
  if (domain.projectedValue === null) return;
  assertEquals(domain.projectedValue.memberCount, 2);
  assertEquals(
    domain.projectedValue.members.map((member) => member.tokenNodeId),
    ["token-1", "token-2"],
  );
  assertEquals(
    domain.projectedValue.members.map((member) => member.sentenceTokenIndex),
    [0, 1],
  );
  assertEquals(
    domain.projectedValue.members.map((member) => member.snapshotTokenOccurrenceIdentityId),
    ["snapshot-token-1", "snapshot-token-2"],
  );
  assertStrictEquals(
    domain.projectedValue.members[0].sourceEligibilityOccurrence,
    domain.sourceReadinessDomain.occurrenceEligibility[0],
  );
  assertStrictEquals(
    domain.projectedValue.members[1].sourceEligibilityOccurrence,
    domain.sourceReadinessDomain.occurrenceEligibility[1],
  );
});
