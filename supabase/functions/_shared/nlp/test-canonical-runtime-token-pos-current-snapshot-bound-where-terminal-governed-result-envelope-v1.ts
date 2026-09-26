import {
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_GOVERNED_RESULT_ENVELOPE_V1,
  CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_GOVERNED_RESULT_ENVELOPE_VERSION_V1,
  type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1,
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-terminal-governed-result-envelope-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test(
  "v1.53 terminal governed envelope declares a non-executing read-only boundary",
  () => {
    assert(
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_GOVERNED_RESULT_ENVELOPE_V1 ===
        "canonical_runtime_token_pos_current_snapshot_bound_where_terminal_governed_result_envelope_v1",
      "unexpected envelope authority id",
    );

    assert(
      CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_TERMINAL_GOVERNED_RESULT_ENVELOPE_VERSION_V1 ===
        "v1",
      "unexpected envelope version",
    );

    const source =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1
        .toString();

    for (
      const prohibited of [
        "eligible:",
        "ineligible:",
        "shouldExecute:",
        "readyToExecute:",
        "applyGraphPatch(",
      ]
    ) {
      assert(
        !source.includes(prohibited),
        `envelope must not implement ${prohibited}`,
      );
    }
  },
);

Deno.test(
  "v1.53 terminal governed envelope governance cannot claim execution or scheduling",
  () => {
    type Governance =
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1[
        "governance"
      ];

    const governance: Governance = {
      rootTruthPreservedWithoutRecomputation: true,
      finalDecisionPreservedWithoutRecomputation: true,

      postOwnerCardinalityOutcomePreserved: true,
      postOwnerBindingOutcomePreserved: true,

      exactStructuralAuthorityIdentityRequired: true,
      exactOperatorShapeAuthorityRequired: true,
      operatorIdentityInferred: false,

      snapshotIdentityPreserved: true,
      sentenceOccurrenceIdentityPreserved: true,
      ownerOccurrenceIdentityPreserved: true,

      genericEligibilityDerived: false,
      executableStateDerived: false,
      schedulableStateDerived: false,

      runtimeActionExecuted: false,
      schedulerInvoked: false,
      graphMutationPerformed: false,
    };

    assert(
      governance.genericEligibilityDerived === false,
      "generic eligibility must remain unresolved",
    );

    assert(
      governance.runtimeActionExecuted === false,
      "runtime action must not execute",
    );

    assert(
      governance.schedulerInvoked === false,
      "scheduler must not run",
    );

    assert(
      governance.graphMutationPerformed === false,
      "graph must remain read-only",
    );
  },
);
