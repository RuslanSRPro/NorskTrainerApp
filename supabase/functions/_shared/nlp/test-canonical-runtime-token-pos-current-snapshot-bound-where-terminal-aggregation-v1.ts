import {
  assert,
  assertEquals,
} from "jsr:@std/assert";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-terminal-aggregation-v1.ts";

Deno.test("terminal aggregation: production contract requires exact decision object identity and forbids semantic/execution fallback", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "./canonical-runtime-token-pos-current-snapshot-bound-where-terminal-aggregation-v1.ts",
      import.meta.url,
    ),
  );

  assert(
    source.includes(
      "domain.sourceFinalWhereDecision === decision",
    ),
  );

  assert(
    !source.includes(
      "domain.sourceFinalWhereDecision.decisionId === decision.decisionId",
    ),
  );

  assert(
    source.includes(
      "terminal_evidence_missing_for_exact_decision",
    ),
  );

  assert(
    source.includes(
      "terminal_evidence_ambiguous_for_exact_decision",
    ),
  );

  assert(
    source.includes(
      "terminal_unmatched_post_owner_evidence",
    ),
  );

  assert(
    source.includes(
      "indexBasedJoinUsed: false",
    ),
  );

  assert(
    source.includes(
      "stringIdentityFallbackUsed: false",
    ),
  );

  assert(
    source.includes(
      "genericEligibilityDerived: false",
    ),
  );

  assert(
    source.includes(
      "runtimeActionExecuted: false",
    ),
  );

  assert(
    source.includes(
      "schedulerInvoked: false",
    ),
  );

  assert(
    source.includes(
      "graphMutationPerformed: false",
    ),
  );

  assertEquals(
    typeof deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalAggregationV1,
    "function",
  );
});

Deno.test("terminal aggregation: no index-zero shortcut or winner selection is present", async () => {
  const source = await Deno.readTextFile(
    new URL(
      "./canonical-runtime-token-pos-current-snapshot-bound-where-terminal-aggregation-v1.ts",
      import.meta.url,
    ),
  );

  assert(
    !source.includes(
      "domainBoundConditionEvidence[0]",
    ),
  );

  assert(
    !source.includes(
      "decisions[0]",
    ),
  );

  assert(
    !source.includes(
      "winnerSelected: true",
    ),
  );

  assert(
    source.includes(
      "exactMatches.length > 1",
    ),
  );

  assert(
    source.includes(
      "consumedEvidence.size !== evidence.length",
    ),
  );
});
