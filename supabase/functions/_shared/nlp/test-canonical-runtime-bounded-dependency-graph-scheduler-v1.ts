import { assert } from "jsr:@std/assert";

const source = await Deno.readTextFile(
  new URL(
    "./canonical-runtime-bounded-dependency-graph-scheduler-v1.ts",
    import.meta.url,
  ),
);

const required = [
  "resolveCanonicalRuntimeDependencyActionActivationAuthorityV1",
  "deriveCanonicalRuntimeActionExecutionAdmissionBoundaryV1",
  "deriveCanonicalRuntimeDependencyExecutionPlanBoundaryV1",
  "deriveCanonicalRuntimeDependencyExecutionGraphPatchBoundaryV1",
  "deriveCanonicalRuntimeDependencyExecutionGraphTransitionBoundaryV1",
  "deriveCanonicalRuntimeDependencyExecutionResultEnvelopeV1",
  "deriveCanonicalRuntimeEpochCurrentContextTransitionBoundaryV1",
  "deriveCanonicalRuntimePostTransitionReevaluationCompositionBoundaryV1",
  "cross_manifest_admitted_action_priority:not_source_backed",
  "unsupported_action_family",
  "snapshot_action_pair:repeated",
  "snapshot_identity:unchanged_after_transition",
  "max_transitions:reached_before_quiescence",
  "staleSnapshotBoundEvidenceReusedAfterTransition: false",
  "crossManifestPriorityInvented: false",
  "newLinguisticSemanticsCreated: false",
];

for (const needle of required) {
  assert(source.includes(needle), `missing governance/chain proof: ${needle}`);
}

assert(
  !source.includes("as any"),
  "unsafe any cast must not be used",
);
assert(
  !source.includes("sentenceIndex"),
  "scheduler must not use sentenceIndex",
);

const transitionPos = source.indexOf(
  "deriveCanonicalRuntimeDependencyExecutionGraphTransitionBoundaryV1",
);
const reevaluationPos = source.lastIndexOf(
  "deriveCanonicalRuntimePostTransitionReevaluationCompositionBoundaryV1",
);
assert(transitionPos >= 0 && reevaluationPos > transitionPos);
