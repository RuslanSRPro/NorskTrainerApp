import { assertEquals, assertStrictEquals } from "jsr:@std/assert";

import {
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceDomainV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceReadyResultV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-owner-binding-occurrence-provenance-v1.ts";

type TruthDisposition =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1[
    "rootTruthDisposition"
  ];

type OwnerReady =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceProvenanceReadyResultV1;

type OwnerDomain =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereOwnerBindingOccurrenceDomainV1;

function ownerReadyFixture(
  truth: TruthDisposition,
): {
  ownerResult: OwnerReady;
  domain: OwnerDomain;
} {
  const rootTruth = {
    authorityBoundChildTruthEvidence: {
      childTruthEvidence: {
        truthDisposition: truth,
      },
    },
  };

  const rootCandidate = {
    contextCandidateId: "context-candidate-1",
    rootTruth,
  };

  const domain = {
    id: "owner-domain-1",
    status: "candidate",

    structuralAuthorityId: "structural-authority-1",
    ownerBindingDefinitionAuthorityId: "owner-binding-authority-1",

    manifestId: "manifest-1",
    manifestCode: "MANIFEST_1",
    ownerBindingName: "OWNER",

    runtimeScopeLabel: "sentence",
    canonicalBoundaryLabel: "sentence",
    canonicalBoundaryAuthorityId: "sentence-authority-1",

    snapshotAuthorityId: "snapshot-authority-1",
    snapshotIdentityId: "snapshot-1",
    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence-1",

    graphDocumentId: "graph-1",
    sentenceNodeId: "sentence-node-1",
    sentenceIndex: 0,

    canonicalTokenDomainId: "token-domain-1",

    occurrenceCount: 0,
    occurrences: [],

    sourceRootCandidate: rootCandidate,

    governance: {
      exactA46a1fRootCandidateRequired: true,
      whereTruthRecomputed: false,
      ownerBindingDerivedFromStructuralAuthority: true,
      referencedLeafOccurrenceUsedAsOwnerOccurrence: false,
      exactOwnerBindingScopeCompatibilityRequired: true,
      neutralDirectOccurrenceDomainConsumed: true,
      duplicateOccurrenceEnumerationImplemented: false,
      exactSnapshotIdentityRequired: true,
      exactSnapshotSentenceOccurrenceIdentityRequired: true,
      snapshotIdentityAndSentenceNodeIdFormDomainOccurrenceIdentity: true,
      snapshotIdentityAndTokenNodeIdFormTokenOccurrenceIdentity: true,
      sentenceIndexIsOccurrenceIdentity: false,
      occurrenceMultiplicityPreserved: true,
      occurrenceOrderPreserved: true,
      zeroOccurrencesPreserved: true,
      occurrenceFilteringPerformed: false,
      occurrenceWinnerSelected: false,
      cardinalitySemanticsResolved: false,
      cardinalityEnforcementPerformed: false,
      finalRuntimeBindingPerformed: false,
      bindingTruthResolved: false,
      learnerErrorClassified: false,
      graphMutationPerformed: false,
      frozenGrammarReadOnly: true,
    },
  } as unknown as OwnerDomain;

  const ownerResult = {
    status: "ready",
    blockingReasons: [],
    ownerBindingOccurrenceDomains: [
      domain,
    ],
    domainCount: 1,
  } as unknown as OwnerReady;

  return {
    ownerResult,
    domain,
  };
}

Deno.test(
  "final WHERE decision maps resolved_true to satisfied and preserves exact source identity",
  () => {
    const fixture = ownerReadyFixture(
      "resolved_true",
    );

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1(
        fixture.ownerResult,
      );

    assertEquals(
      result.status,
      "ready",
    );

    if (result.status !== "ready") {
      throw new Error("expected ready");
    }

    assertEquals(
      result.decisionCount,
      1,
    );

    const decision = result.decisions[0];

    assertEquals(
      decision.rootTruthDisposition,
      "resolved_true",
    );

    assertEquals(
      decision.decisionDisposition,
      "satisfied",
    );

    assertStrictEquals(
      decision.sourceOwnerBindingOccurrenceDomain,
      fixture.domain,
    );

    assertStrictEquals(
      decision.sourceRootCandidate,
      fixture.domain.sourceRootCandidate,
    );

    assertEquals(
      decision.governance.rootTruthConsumedWithoutRecomputation,
      true,
    );

    assertEquals(
      decision.governance.ownerOccurrenceFilteringPerformed,
      false,
    );

    assertEquals(
      decision.governance.cardinalitySemanticsResolved,
      false,
    );

    assertEquals(
      decision.governance.finalRuntimeBindingPerformed,
      false,
    );
  },
);

Deno.test(
  "final WHERE decision maps resolved_false to rejected",
  () => {
    const fixture = ownerReadyFixture(
      "resolved_false",
    );

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1(
        fixture.ownerResult,
      );

    if (result.status !== "ready") {
      throw new Error("expected ready");
    }

    assertEquals(
      result.decisions[0].decisionDisposition,
      "rejected",
    );
  },
);

Deno.test(
  "final WHERE decision maps unresolved to uncertain without collapsing to false",
  () => {
    const fixture = ownerReadyFixture(
      "unresolved",
    );

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1(
        fixture.ownerResult,
      );

    if (result.status !== "ready") {
      throw new Error("expected ready");
    }

    assertEquals(
      result.decisions[0].rootTruthDisposition,
      "unresolved",
    );

    assertEquals(
      result.decisions[0].decisionDisposition,
      "uncertain",
    );

    assertEquals(
      result.decisions[0].governance.missingRootCandidateCollapsedToFalse,
      false,
    );
  },
);

Deno.test(
  "final WHERE decision preserves zero OWNER domains as zero decisions",
  () => {
    const fixture = ownerReadyFixture(
      "resolved_true",
    );

    const zeroOwnerResult = {
      ...fixture.ownerResult,
      ownerBindingOccurrenceDomains: [],
      domainCount: 0,
    } as OwnerReady;

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1(
        zeroOwnerResult,
      );

    assertEquals(
      result.status,
      "ready",
    );

    if (result.status !== "ready") {
      throw new Error("expected ready");
    }

    assertEquals(
      result.decisionCount,
      0,
    );

    assertEquals(
      result.decisions.length,
      0,
    );

    assertEquals(
      result.governance.zeroOwnerDomainsProduceZeroDecisions,
      true,
    );
  },
);
Deno.test(
  "final WHERE decision preserves OWNER domain multiplicity without occurrence filtering",
  () => {
    const fixture = ownerReadyFixture(
      "resolved_true",
    );

    const secondDomain = {
      ...fixture.domain,
      id: "owner-domain-2",
    };

    const multipleOwnerResult = {
      ...fixture.ownerResult,
      ownerBindingOccurrenceDomains: [
        fixture.domain,
        secondDomain,
      ],
      domainCount: 2,
    };

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1(
        multipleOwnerResult,
      );

    assertEquals(
      result.status,
      "ready",
    );

    if (result.status !== "ready") {
      throw new Error("expected ready");
    }

    assertEquals(
      result.decisionCount,
      2,
    );

    assertEquals(
      result.decisions.length,
      2,
    );

    assertStrictEquals(
      result.decisions[0].sourceOwnerBindingOccurrenceDomain,
      fixture.domain,
    );

    assertStrictEquals(
      result.decisions[1].sourceOwnerBindingOccurrenceDomain,
      secondDomain,
    );

    assertEquals(
      result.decisions[0].decisionDisposition,
      "satisfied",
    );

    assertEquals(
      result.decisions[1].decisionDisposition,
      "satisfied",
    );

    assertEquals(
      result.governance.ownerDomainMultiplicityPreserved,
      true,
    );

    assertEquals(
      result.governance.ownerOccurrenceFilteringPerformed,
      false,
    );

    assertEquals(
      result.governance.occurrenceWinnerSelected,
      false,
    );

    assertEquals(
      result.governance.cardinalitySemanticsResolved,
      false,
    );
  },
);

Deno.test(
  "final WHERE decision blocks when OWNER provenance is blocked",
  () => {
    const fixture = ownerReadyFixture(
      "resolved_true",
    );

    const blockedOwnerResult = {
      ...fixture.ownerResult,
      status: "blocked" as const,
      ownerBindingOccurrenceDomains: [] as const,
      domainCount: 0 as const,
      blockingReasons: [
        "owner_fixture:blocked",
      ],
    };

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1(
        blockedOwnerResult,
      );

    assertEquals(
      result.status,
      "blocked",
    );

    if (result.status !== "blocked") {
      throw new Error("expected blocked");
    }

    assertEquals(
      result.decisionCount,
      0,
    );

    assertEquals(
      result.decisions.length,
      0,
    );

    assertEquals(
      result.blockingReasons.some(
        (reason) => reason.includes("owner_fixture:blocked"),
      ),
      true,
    );

    assertStrictEquals(
      result.sourceOwnerResult,
      blockedOwnerResult,
    );

    assertEquals(
      result.governance.ownerResultConsumedWithoutReexecution,
      true,
    );

    assertEquals(
      result.governance.rootTruthConsumedWithoutRecomputation,
      true,
    );

    assertEquals(
      result.governance.ownerOccurrenceFilteringPerformed,
      false,
    );

    assertEquals(
      result.governance.cardinalityEnforcementPerformed,
      false,
    );

    assertEquals(
      result.governance.finalRuntimeBindingPerformed,
      false,
    );

    assertEquals(
      result.governance.learnerErrorClassified,
      false,
    );

    assertEquals(
      result.governance.graphMutationPerformed,
      false,
    );
  },
);
