import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-post-owner-survivor-set-v1.ts";

import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionReadyResultV1,
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-final-root-truth-decision-v1.ts";

type FinalReady =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionReadyResultV1;

type Decision =
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereFinalRootTruthDecisionV1;

function assert(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function occurrence(
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

function fixture(
  disposition:
    | "satisfied"
    | "rejected"
    | "uncertain",
  occurrences: ReturnType<typeof occurrence>[],
) {
  const sourceDomain = {
    id: "owner-domain-1",
    status: "candidate",

    structuralAuthorityId: "structural-authority-1",

    ownerBindingDefinitionAuthorityId: "owner-binding-authority-1",

    manifestId: "manifest-1",
    manifestCode: "RULE_1",
    ownerBindingName: "OWNER",

    runtimeScopeLabel: "sentence",
    canonicalBoundaryLabel: "sentence",
    canonicalBoundaryAuthorityId: "boundary-authority-1",

    snapshotAuthorityId: "snapshot-authority-1",

    snapshotIdentityId: "snapshot-1",

    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence-1",

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

    structuralAuthorityId: "structural-authority-1",

    ownerBindingDefinitionAuthorityId: "owner-binding-authority-1",

    snapshotIdentityId: "snapshot-1",

    snapshotSentenceOccurrenceIdentityId: "snapshot-sentence-1",

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
  } as unknown as Decision;

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
  } as unknown as FinalReady;

  return {
    sourceDomain: decision.sourceOwnerBindingOccurrenceDomain,
    decision,
    result,
  };
}

Deno.test(
  "post-WHERE OWNER survivor set preserves every satisfied occurrence as a proven survivor",
  () => {
    const f = fixture(
      "satisfied",
      [
        occurrence(
          "token-1",
          "snapshot-token-1",
        ),
        occurrence(
          "token-2",
          "snapshot-token-2",
        ),
      ],
    );

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
        f.result,
      );

    assert(
      result.status === "ready",
      "expected ready",
    );

    assert(
      result.domainCount === 1,
      "expected one domain",
    );

    const domain = result.survivorDomains[0];

    assert(
      domain.sourceOccurrenceCount === 2,
      "expected two source occurrences",
    );

    assert(
      domain.survivingOccurrenceCount === 2,
      "all satisfied occurrences must survive",
    );

    assert(
      domain.rejectedOccurrenceCount === 0,
      "no satisfied occurrence may be rejected",
    );

    assert(
      domain.uncertainSurvivorCount === 0,
      "satisfied occurrences are not uncertain",
    );

    assert(
      domain.occurrenceDecisions.every(
        (d) =>
          d.occurrenceState ===
            "proven_survivor" &&
          d.survivesWhere &&
          d.whereTruthResolved,
      ),
      "every satisfied occurrence must be a proven survivor",
    );

    assert(
      domain.survivingOccurrences[0] ===
          f.sourceDomain.occurrences[0] &&
        domain.survivingOccurrences[1] ===
          f.sourceDomain.occurrences[1],
      "exact occurrence identity and order must be preserved",
    );

    assert(
      domain.sourceFinalWhereDecision ===
        f.decision,
      "exact final WHERE decision must be preserved",
    );

    assert(
      !domain.governance.cardinalitySemanticsResolved &&
        !domain.governance.cardinalityEnforcementPerformed &&
        !domain.governance.occurrenceWinnerSelected,
      "survivor seam must not perform downstream authority work",
    );
  },
);

Deno.test(
  "post-WHERE OWNER survivor set eliminates every rejected occurrence",
  () => {
    const f = fixture(
      "rejected",
      [
        occurrence(
          "token-1",
          "snapshot-token-1",
        ),
        occurrence(
          "token-2",
          "snapshot-token-2",
        ),
      ],
    );

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
        f.result,
      );

    assert(
      result.status === "ready",
      "expected ready",
    );

    const domain = result.survivorDomains[0];

    assert(
      domain.sourceOccurrenceCount === 2,
      "expected two source occurrences",
    );

    assert(
      domain.survivingOccurrenceCount === 0,
      "rejected WHERE must leave no OWNER survivors",
    );

    assert(
      domain.rejectedOccurrenceCount === 2,
      "all occurrences must be explicitly rejected",
    );

    assert(
      domain.survivingOccurrences.length === 0,
      "rejected occurrences must not enter survivor set",
    );

    assert(
      domain.occurrenceDecisions.every(
        (d) =>
          d.occurrenceState === "rejected" &&
          !d.survivesWhere &&
          d.whereTruthResolved,
      ),
      "all occurrence decisions must preserve rejection",
    );
  },
);

Deno.test(
  "post-WHERE OWNER survivor set preserves uncertain occurrences without collapsing truth",
  () => {
    const f = fixture(
      "uncertain",
      [
        occurrence(
          "token-1",
          "snapshot-token-1",
        ),
        occurrence(
          "token-2",
          "snapshot-token-2",
        ),
      ],
    );

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
        f.result,
      );

    assert(
      result.status === "ready",
      "expected ready",
    );

    const domain = result.survivorDomains[0];

    assert(
      domain.survivingOccurrenceCount === 2,
      "uncertain occurrences must remain survivors",
    );

    assert(
      domain.rejectedOccurrenceCount === 0,
      "uncertain must not become rejected",
    );

    assert(
      domain.uncertainSurvivorCount === 2,
      "uncertainty must remain explicit",
    );

    assert(
      domain.occurrenceDecisions.every(
        (d) =>
          d.occurrenceState ===
            "uncertain_survivor" &&
          d.survivesWhere &&
          !d.whereTruthResolved,
      ),
      "uncertain must survive without becoming satisfied",
    );

    assert(
      result.governance.rejectedOnlyElimination &&
        result.governance.uncertainPreservedAsSurvivor,
      "result governance must expose conservative survivor semantics",
    );
  },
);

Deno.test(
  "post-WHERE OWNER survivor set preserves a real zero-occurrence OWNER domain",
  () => {
    const f = fixture(
      "satisfied",
      [],
    );

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
        f.result,
      );

    assert(
      result.status === "ready",
      "expected ready",
    );

    const domain = result.survivorDomains[0];

    assert(
      domain.sourceOccurrenceCount === 0 &&
        domain.survivingOccurrenceCount === 0 &&
        domain.rejectedOccurrenceCount === 0 &&
        domain.uncertainSurvivorCount === 0,
      "zero occurrence domain must remain structurally zero",
    );

    assert(
      domain.occurrenceDecisions.length === 0 &&
        domain.survivingOccurrences.length === 0,
      "zero occurrences must not synthesize a candidate",
    );
  },
);

Deno.test(
  "post-WHERE OWNER survivor set preserves multiple decision domains without winner selection",
  () => {
    const first = fixture(
      "satisfied",
      [
        occurrence(
          "token-1",
          "snapshot-token-1",
        ),
      ],
    );

    const secondDecision = {
      ...first.decision,
      decisionId: "final-where-decision-2",
      structuralAuthorityId: "structural-authority-2",
      sourceOwnerBindingOccurrenceDomain: {
        ...first.decision
          .sourceOwnerBindingOccurrenceDomain,
        id: "owner-domain-2",
        structuralAuthorityId: "structural-authority-2",
      },
    };

    const multiple = {
      ...first.result,
      decisions: [
        first.decision,
        secondDecision,
      ],
      decisionCount: 2,
    };

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
        multiple,
      );

    assert(
      result.status === "ready",
      "expected ready",
    );

    assert(
      result.domainCount === 2,
      "both OWNER decision domains must be preserved",
    );

    assert(
      result.survivorDomains[0]
            .sourceFinalWhereDecision ===
          first.decision &&
        result.survivorDomains[1]
            .sourceFinalWhereDecision ===
          secondDecision,
      "decision-domain identity and order must be preserved",
    );

    assert(
      !result.governance.occurrenceWinnerSelected &&
        !result.governance.cardinalitySemanticsResolved,
      "multiple domains must not trigger winner or cardinality inference",
    );
  },
);

Deno.test(
  "post-WHERE OWNER survivor set blocks when final WHERE decision result is blocked",
  () => {
    const f = fixture(
      "satisfied",
      [
        occurrence(
          "token-1",
          "snapshot-token-1",
        ),
      ],
    );

    const blockedInput = {
      ...f.result,
      status: "blocked" as const,
      decisions: [] as const,
      decisionCount: 0 as const,
      blockingReasons: [
        "fixture:blocked",
      ],
    };

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWherePostOwnerSurvivorSetV1(
        blockedInput,
      );

    assert(
      result.status === "blocked",
      "blocked input must remain blocked",
    );

    assert(
      result.domainCount === 0 &&
        result.survivorDomains.length === 0,
      "blocked input must not synthesize survivor domains",
    );

    assert(
      result.blockingReasons.some(
        (reason) =>
          reason.includes(
            "fixture:blocked",
          ),
      ),
      "blocking provenance must be preserved",
    );

    assert(
      result.sourceFinalWhereResult ===
        blockedInput,
      "exact blocked source result must be preserved",
    );
  },
);
