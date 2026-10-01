import {
  CANONICAL_RUNTIME_BOUNDED_DEPENDENCY_GRAPH_SCHEDULER_V1,
  runCanonicalRuntimeBoundedDependencyGraphSchedulerV1,
} from "./canonical-runtime-bounded-dependency-graph-scheduler-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.8D scheduler is wired to multi-site post-transition reevaluation", () => {
  assert(
    CANONICAL_RUNTIME_BOUNDED_DEPENDENCY_GRAPH_SCHEDULER_V1 ===
      "a3.4:canonical-runtime-bounded-dependency-graph-scheduler-v1",
    "scheduler producer changed",
  );
  assert(
    typeof runCanonicalRuntimeBoundedDependencyGraphSchedulerV1 === "function",
    "scheduler function missing",
  );
  const source = Deno.readTextFileSync(
    new URL(
      "./canonical-runtime-bounded-dependency-graph-scheduler-v1.ts",
      import.meta.url,
    ),
  );
  for (
    const token of [
      "deriveCanonicalRuntimeMultiSitePostTransitionReevaluationBoundaryV1",
      "CanonicalRuntimeMultiSitePostTransitionReevaluationInputV1",
      "tokenNodeIds: readonly string[]",
      "tokenNodeIds: input.tokenNodeIds",
      "seed: {",
      "...input.reevaluationSeed",
      "epochTransitionResult",
      "postTransitionEvidenceRederivedByCanonicalA38C: true",
    ]
  ) {
    assert(source.includes(token), `missing A3.8D token: ${token}`);
  }
  assert(
    !source.includes(
      "deriveCanonicalRuntimePostTransitionReevaluationCompositionBoundaryV1(",
    ),
    "single-site post-transition reevaluation call must be removed from scheduler",
  );
  assert(
    !source.includes("reevaluationSeed.tokenNodeId"),
    "scheduler must not select a single token authority",
  );
});
