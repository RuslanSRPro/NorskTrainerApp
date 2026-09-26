import {
  assert,
  assertEquals,
} from "jsr:@std/assert";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-binding-readiness-v1.ts";

const productionSource = await Deno.readTextFile(
  new URL(
    "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-binding-readiness-v1.ts",
    import.meta.url,
  ),
);

Deno.test("post-WHERE OWNER binding readiness architecture guard", () => {
  assert(
    productionSource.includes(
      "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-cardinality-enforcement-v1.ts",
    ),
  );

  assertEquals(
    productionSource.includes(
      "./canonical-runtime-token-pos-current-snapshot-bound-cardinality-enforcement-v1.ts",
    ),
    false,
  );

  assertEquals(
    productionSource.includes(
      "./canonical-runtime-token-pos-current-snapshot-bound-occurrence-filtering-v1.ts",
    ),
    false,
  );

  assertEquals(
    productionSource.includes("deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundOccurrenceFilteringV1"),
    false,
  );

  assertEquals(
    productionSource.includes("as unknown as"),
    false,
  );

  assertEquals(
    productionSource.includes("as any"),
    false,
  );

  assertEquals(
    productionSource.includes(": any"),
    false,
  );
});

Deno.test("readiness contract preserves occurrence and domain distinctions", () => {
  assert(
    productionSource.includes(
      '| "eligible"',
    ),
  );

  assert(
    productionSource.includes(
      '| "unresolved"',
    ),
  );

  assert(
    productionSource.includes(
      '| "filtered_out"',
    ),
  );

  assert(
    productionSource.includes(
      '| "ready"',
    ),
  );

  assert(
    productionSource.includes(
      '| "unresolved_occurrences"',
    ),
  );

  assert(
    productionSource.includes(
      '| "cardinality_violation"',
    ),
  );
});

Deno.test("rejected occurrence is not binding eligible", () => {
  assert(
    productionSource.includes(
      'if (occurrence.occurrenceState === "rejected")',
    ),
  );

  assert(
    productionSource.includes(
      'state: "filtered_out"',
    ),
  );
});

Deno.test("uncertain survivor remains unresolved and not eligible", () => {
  assert(
    productionSource.includes(
      'if (occurrence.occurrenceState === "uncertain_survivor")',
    ),
  );

  assert(
    productionSource.includes(
      'state: "unresolved"',
    ),
  );
});

Deno.test("cardinality violation has readiness precedence over uncertainty", () => {
  const cardinalityIndex = productionSource.indexOf(
    'readinessState = "cardinality_violation"',
  );

  const unresolvedIndex = productionSource.indexOf(
    'readinessState = "unresolved_occurrences"',
  );

  assert(cardinalityIndex >= 0);
  assert(unresolvedIndex >= 0);
  assert(cardinalityIndex < unresolvedIndex);
});

Deno.test("readiness does not materialize or execute final binding", () => {
  assert(
    productionSource.includes(
      "bindingOccurrenceSetMaterialized: false",
    ),
  );

  assert(
    productionSource.includes(
      "occurrenceWinnerSelected: false",
    ),
  );

  assert(
    productionSource.includes(
      "finalRuntimeOccurrenceBindingPerformed: false",
    ),
  );

  assert(
    productionSource.includes(
      "whereTruthRecomputed: false",
    ),
  );
});

// Public derivation type presence guard. Runtime fixture construction belongs
// downstream of the already-proven post-WHERE OWNER survivor fixture surface.
Deno.test("public derivation remains callable from canonical source inputs", () => {
  assertEquals(
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessV1,
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

type ReadinessRuntimeFinalReady =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionReadyResultV1;

type ReadinessRuntimeDecision =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1;

function readinessRuntimeOccurrence(
  tokenNodeId: string,
  snapshotTokenOccurrenceIdentityId: string,
) {
  return {
    tokenNodeId,
    containmentEdgeId: "contains:" + tokenNodeId,
    sentenceTokenIndex: tokenNodeId === "token-1" ? 0 : 1,
    snapshotTokenOccurrenceIdentityId,
  };
}

function readinessRuntimeFinalWhereFixture(
  disposition: "satisfied" | "rejected" | "uncertain",
  occurrences: ReturnType<typeof readinessRuntimeOccurrence>[],
  cardinality: "one" | "one_or_more" | "zero_or_more",
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
    sourceStructuralAuthority: {
      id: "structural-1",
      bindingDefinitionAuthorityId: ownerBindingDefinitionAuthorityId,
      sourceWhereShapeAuthorityId: "structural-1",
      sourceWhereShapeAuthority: {
        id: "structural-1",
        bindingDefinitionAuthorityId: ownerBindingDefinitionAuthorityId,
        sourceBindingDefinitionAuthority: {
          id: ownerBindingDefinitionAuthorityId,
          status: "candidate",
          manifestId: "manifest-id-1",
          manifestCode: "manifest-code-1",
          runtimeFamilyLabel: null,
          executionPhaseLabel: null,
          bindingName: "owner",
          bindingDefinition: {
            entity: "token",
            scope: "sentence",
            cardinality,
          },
          entityLabel: "token",
          scopeLabel: "sentence",
          cardinalityLabel: cardinality,
          whereClause: null,
          rawManifestSnapshot: {},
          governance: {
            exactValidatedManifestRequired: true,
            exactManifestIdentityRequired: true,
            manifestLocalBindingsOnly: true,
            actionAuthorityRequired: false,
            actionFamilySemanticsResolved: false,
            runtimeFamilyLabelPreservedOpaque: true,
            executionPhaseLabelPreservedOpaque: true,
            runtimeFamilySemanticsResolved: false,
            executionPhaseSemanticsResolved: false,
            bindingNamePreservedOpaque: true,
            bindingDefinitionPreservedOpaque: true,
            entityLabelPreservedOpaque: true,
            scopeLabelPreservedOpaque: true,
            cardinalityLabelPreservedOpaque: true,
            whereClausePreservedOpaque: true,
            entitySemanticsResolved: false,
            scopeSemanticsResolved: false,
            cardinalitySemanticsResolved: false,
            whereSemanticsResolved: false,
            referenceSemanticsResolved: false,
            occurrenceEnumerationPerformed: false,
            occurrenceBindingPerformed: false,
            winnerSelected: false,
            graphMutationPerformed: false,
            productionActivationAssumed: false,
            learnerErrorClassified: false,
            candidateOnly: true,
            frozenGrammarReadOnly: true,
          },
        },
      },
    },
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
  } as unknown as ReadinessRuntimeDecision;

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
  } as unknown as ReadinessRuntimeFinalReady;

  return result;
}

function readinessRuntimeSurvivorResult(
  disposition: "satisfied" | "rejected" | "uncertain",
  occurrences: ReturnType<typeof readinessRuntimeOccurrence>[],
  cardinality: "one" | "one_or_more" | "zero_or_more",
) {
  return deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
    readinessRuntimeFinalWhereFixture(
      disposition,
      occurrences,
      cardinality,
    ),
  );
}

function readinessRuntimeDependencyAuthority(): CanonicalDependencyRuntimeActionAuthorityV1 {
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

function readinessRuntimeManifestRow(
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

function deriveReadinessRuntimeFixture(
  disposition: "satisfied" | "rejected" | "uncertain",
  occurrences: ReturnType<typeof readinessRuntimeOccurrence>[],
  cardinality: "one" | "one_or_more" | "zero_or_more",
) {
  const survivorResult = readinessRuntimeSurvivorResult(
    disposition,
    occurrences,
    cardinality,
  );

  assertEquals(
    survivorResult.status,
    "ready",
  );

  return deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerBindingReadinessV1(
    survivorResult,
    [readinessRuntimeDependencyAuthority()],
    [readinessRuntimeManifestRow(cardinality)],
  );
}

Deno.test(
  "runtime readiness: satisfied singleton with one cardinality is ready",
  () => {
    const result = deriveReadinessRuntimeFixture(
      "satisfied",
      [
        readinessRuntimeOccurrence(
          "token-1",
          "snapshot-token-1",
        ),
      ],
      "one",
    );

    assertEquals(result.status, "ready");

    if (result.status !== "ready") {
      return;
    }

    assertEquals(result.domainCount, 1);
    assertEquals(result.readyDomainCount, 1);
    assertEquals(result.unresolvedDomainCount, 0);
    assertEquals(result.cardinalityViolationDomainCount, 0);

    const domain = result.domainBindingReadiness[0];

    assertEquals(domain.readinessState, "ready");
    assertEquals(domain.bindingReady, true);
    assertEquals(domain.cardinalityEnforcementState, "satisfied");
    assertEquals(domain.cardinalitySatisfied, true);

    assertEquals(domain.survivingOccurrenceCount, 1);
    assertEquals(domain.uncertainSurvivorCount, 0);

    assertEquals(domain.eligibleOccurrenceCount, 1);
    assertEquals(domain.unresolvedOccurrenceCount, 0);
    assertEquals(domain.filteredOutOccurrenceCount, 0);

    assertEquals(domain.occurrenceEligibility.length, 1);
    assertEquals(
      domain.occurrenceEligibility[0].occurrenceState,
      "proven_survivor",
    );
    assertEquals(
      domain.occurrenceEligibility[0].eligibilityState,
      "eligible",
    );
    assertEquals(
      domain.occurrenceEligibility[0].bindingEligible,
      true,
    );
  },
);

Deno.test(
  "runtime readiness: uncertain singleton with satisfied one cardinality remains unresolved",
  () => {
    const result = deriveReadinessRuntimeFixture(
      "uncertain",
      [
        readinessRuntimeOccurrence(
          "token-1",
          "snapshot-token-1",
        ),
      ],
      "one",
    );

    assertEquals(result.status, "ready");

    if (result.status !== "ready") {
      return;
    }

    assertEquals(result.domainCount, 1);
    assertEquals(result.readyDomainCount, 0);
    assertEquals(result.unresolvedDomainCount, 1);
    assertEquals(result.cardinalityViolationDomainCount, 0);

    const domain = result.domainBindingReadiness[0];

    assertEquals(domain.cardinalityEnforcementState, "satisfied");
    assertEquals(domain.cardinalitySatisfied, true);
    assertEquals(domain.readinessState, "unresolved_occurrences");
    assertEquals(domain.bindingReady, false);

    assertEquals(domain.survivingOccurrenceCount, 1);
    assertEquals(domain.uncertainSurvivorCount, 1);

    assertEquals(domain.eligibleOccurrenceCount, 0);
    assertEquals(domain.unresolvedOccurrenceCount, 1);
    assertEquals(domain.filteredOutOccurrenceCount, 0);

    assertEquals(
      domain.occurrenceEligibility[0].occurrenceState,
      "uncertain_survivor",
    );
    assertEquals(
      domain.occurrenceEligibility[0].eligibilityState,
      "unresolved",
    );
    assertEquals(
      domain.occurrenceEligibility[0].bindingEligible,
      false,
    );
  },
);

Deno.test(
  "runtime readiness: two satisfied survivors violate one cardinality without winner selection",
  () => {
    const result = deriveReadinessRuntimeFixture(
      "satisfied",
      [
        readinessRuntimeOccurrence(
          "token-1",
          "snapshot-token-1",
        ),
        readinessRuntimeOccurrence(
          "token-2",
          "snapshot-token-2",
        ),
      ],
      "one",
    );

    assertEquals(result.status, "ready");

    if (result.status !== "ready") {
      return;
    }

    assertEquals(result.domainCount, 1);
    assertEquals(result.readyDomainCount, 0);
    assertEquals(result.unresolvedDomainCount, 0);
    assertEquals(result.cardinalityViolationDomainCount, 1);

    const domain = result.domainBindingReadiness[0];

    assertEquals(domain.cardinalityEnforcementState, "overflow");
    assertEquals(domain.cardinalitySatisfied, false);
    assertEquals(domain.readinessState, "cardinality_violation");
    assertEquals(domain.bindingReady, false);

    assertEquals(domain.survivingOccurrenceCount, 2);
    assertEquals(domain.eligibleOccurrenceCount, 2);
    assertEquals(domain.unresolvedOccurrenceCount, 0);
    assertEquals(domain.filteredOutOccurrenceCount, 0);

    assert(
      domain.occurrenceEligibility.every(
        (occurrence) =>
          occurrence.eligibilityState === "eligible" &&
          occurrence.bindingEligible,
      ),
    );

    assertEquals(
      domain.governance.occurrenceWinnerSelected,
      false,
    );
    assertEquals(
      domain.governance.finalRuntimeOccurrenceBindingPerformed,
      false,
    );
  },
);

Deno.test(
  "runtime readiness: rejected occurrences with zero_or_more produce ready empty eligible set",
  () => {
    const result = deriveReadinessRuntimeFixture(
      "rejected",
      [
        readinessRuntimeOccurrence(
          "token-1",
          "snapshot-token-1",
        ),
        readinessRuntimeOccurrence(
          "token-2",
          "snapshot-token-2",
        ),
      ],
      "zero_or_more",
    );

    assertEquals(result.status, "ready");

    if (result.status !== "ready") {
      return;
    }

    assertEquals(result.domainCount, 1);
    assertEquals(result.readyDomainCount, 1);
    assertEquals(result.unresolvedDomainCount, 0);
    assertEquals(result.cardinalityViolationDomainCount, 0);

    const domain = result.domainBindingReadiness[0];

    assertEquals(domain.cardinalityEnforcementState, "satisfied");
    assertEquals(domain.cardinalitySatisfied, true);
    assertEquals(domain.readinessState, "ready");
    assertEquals(domain.bindingReady, true);

    assertEquals(domain.sourceOccurrenceCount, 2);
    assertEquals(domain.survivingOccurrenceCount, 0);
    assertEquals(domain.rejectedOccurrenceCount, 2);

    assertEquals(domain.eligibleOccurrenceCount, 0);
    assertEquals(domain.unresolvedOccurrenceCount, 0);
    assertEquals(domain.filteredOutOccurrenceCount, 2);

    assert(
      domain.occurrenceEligibility.every(
        (occurrence) =>
          occurrence.occurrenceState === "rejected" &&
          occurrence.eligibilityState === "filtered_out" &&
          !occurrence.bindingEligible,
      ),
    );
  },
);

Deno.test(
  "runtime readiness: real zero-occurrence OWNER domain with zero_or_more is ready without synthesis",
  () => {
    const result = deriveReadinessRuntimeFixture(
      "satisfied",
      [],
      "zero_or_more",
    );

    assertEquals(result.status, "ready");

    if (result.status !== "ready") {
      return;
    }

    assertEquals(result.domainCount, 1);
    assertEquals(result.readyDomainCount, 1);
    assertEquals(result.unresolvedDomainCount, 0);
    assertEquals(result.cardinalityViolationDomainCount, 0);

    const domain = result.domainBindingReadiness[0];

    assertEquals(domain.cardinalityEnforcementState, "satisfied");
    assertEquals(domain.cardinalitySatisfied, true);
    assertEquals(domain.readinessState, "ready");
    assertEquals(domain.bindingReady, true);

    assertEquals(domain.sourceOccurrenceCount, 0);
    assertEquals(domain.survivingOccurrenceCount, 0);
    assertEquals(domain.rejectedOccurrenceCount, 0);
    assertEquals(domain.uncertainSurvivorCount, 0);

    assertEquals(domain.occurrenceEligibility.length, 0);
    assertEquals(domain.eligibleOccurrenceCount, 0);
    assertEquals(domain.unresolvedOccurrenceCount, 0);
    assertEquals(domain.filteredOutOccurrenceCount, 0);
  },
);