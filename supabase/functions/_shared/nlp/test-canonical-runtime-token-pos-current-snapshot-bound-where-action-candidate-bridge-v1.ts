import {
  assert,
  assertEquals,
  assertStrictEquals,
} from "jsr:@std/assert";

import {
  deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-action-candidate-bridge-v1.ts";

type AnyRecord = Record<string, any>;

function terminalEnvelope(): AnyRecord {
  const structuralAuthority = {
    id: "shape-authority-1",
    manifestId: "manifest-1",
    manifestCode: "manifest-code-1",
    root: {
      shape: "leaf_operator",
      path: "$",
      operatorLabel: "eq",
    },
  };

  return {
    envelopeId: "envelope-1",
    status: "terminal_governed_result_envelope",

    structuralAuthorityId:
      structuralAuthority.id,

    ownerBindingDefinitionAuthorityId:
      "binding-authority-1",

    snapshotIdentityId:
      "snapshot-1",

    snapshotSentenceOccurrenceIdentityId:
      "sentence-occurrence-1",

    graphDocumentId:
      "graph-document-1",

    sentenceNodeId:
      "sentence-node-1",

    rootTruthDisposition:
      "resolved_true",

    finalDecisionDisposition:
      "accepted",

    sourceRootCandidate: {},
    sourceFinalWhereDecision: {},
    sourcePostOwnerBoundConditionEvidence: {},

    sourceOperatorShapeAuthority:
      structuralAuthority,

    operatorShape:
      structuralAuthority.root,

    governance: {
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
    },
  };
}

function setRole(
  manifestId: string,
  manifestCode: string,
  actionIndex: number,
): AnyRecord {
  return {
    id:
      `set-role-authority:${manifestId}:${actionIndex}`,

    status: "candidate",

    manifestId,
    manifestCode,

    actionIndex,

    actionName: "set_role",

    actionTargetLabel: "subject",

    topLevelRoleLabel: "subject",
    nestedValueRoleLabel: null,

    roleShape: "top_level_role",

    reasonCodeLabel: null,
    reasonLabel: null,

    sourceCandidateCodes: [],

    rawActionSnapshot: {
      action: "set_role",
      target: "subject",
      role: "subject",
    },
  };
}

function dependency(
  manifestId: string,
  manifestCode: string,
  actionIndex: number,
): AnyRecord {
  return {
    id:
      `dependency-runtime-authority:${manifestId}:${actionIndex}`,

    status: "candidate",

    manifestId,
    manifestCode,

    runtimeFamily: "dependency_pattern",
    executionPhase: "structural",

    constraintStrength: null,

    actionIndex,

    relation: "subject_of",
    actionTarget: "subject",

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

Deno.test(
  "action candidate bridge: exact manifest keeps all matching source-backed candidates without winner selection",
  () => {
    const envelope =
      terminalEnvelope();

    const setRoleExact =
      setRole(
        "manifest-1",
        "manifest-code-1",
        2,
      );

    const setRoleForeign =
      setRole(
        "manifest-2",
        "manifest-code-2",
        0,
      );

    const dependencyExact =
      dependency(
        "manifest-1",
        "manifest-code-1",
        1,
      );

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1(
        {
          terminalEnvelope:
            envelope as never,

          setRoleAuthorities: {
            authority:
              "canonical_runtime_set_role_action_authority_v1",
            authorityVersion: "1",
            status: "ready",
            authorities: [
              setRoleExact,
              setRoleForeign,
            ],
            blockingReasons: [],
            governance: {} as never,
          } as never,

          dependencyAuthorities: {
            producer:
              "canonical_dependency_runtime_authority_v1",
            producerVersion: "1",
            status: "ready",
            authorities: [
              dependencyExact,
            ],
            blockingReasons: [],
          } as never,
        },
      );

    assertEquals(
      result.status,
      "ready",
    );

    if (result.status !== "ready") {
      throw new Error(
        result.blockingReasons.join(","),
      );
    }

    assertEquals(
      result.bridge.manifestId,
      "manifest-1",
    );

    assertEquals(
      result.bridge.manifestCode,
      "manifest-code-1",
    );

    assertEquals(
      result.bridge.actionCandidates.length,
      2,
    );

    assertEquals(
      result.bridge.actionCandidates.map(
        (candidate) => [
          candidate.family,
          candidate.actionIndex,
        ],
      ),
      [
        [
          "create_dependency",
          1,
        ],
        [
          "set_role",
          2,
        ],
      ],
    );

    assertStrictEquals(
      result.bridge.actionCandidates[0]!
        .sourceAuthority,
      dependencyExact,
    );

    assertStrictEquals(
      result.bridge.actionCandidates[1]!
        .sourceAuthority,
      setRoleExact,
    );

    const g =
      result.bridge.governance;

    assert(
      g.exactStructuralAuthorityPreserved &&
        g.exactManifestIdentityDerivedFromStructuralAuthority &&
        g.actionAuthoritiesPreservedWithoutReconstruction &&
        g.foreignManifestActionsExcluded &&
        g.actionMultiplicityPreserved &&
        g.actionIndexPreserved,
    );

    assertEquals(
      g.actionSelected,
      false,
    );

    assertEquals(
      g.singletonPromotedToWinner,
      false,
    );

    assertEquals(
      g.genericEligibilityDerived,
      false,
    );

    assertEquals(
      g.executableStateDerived,
      false,
    );

    assertEquals(
      g.schedulableStateDerived,
      false,
    );

    assertEquals(
      g.runtimeActionExecuted,
      false,
    );

    assertEquals(
      g.schedulerInvoked,
      false,
    );

    assertEquals(
      g.graphMutationPerformed,
      false,
    );
  },
);

Deno.test(
  "action candidate bridge: zero exact-manifest actions remains a valid empty candidate set",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1(
        {
          terminalEnvelope:
            terminalEnvelope() as never,

          setRoleAuthorities: {
            authority:
              "canonical_runtime_set_role_action_authority_v1",
            authorityVersion: "1",
            status: "ready",
            authorities: [
              setRole(
                "foreign-manifest",
                "foreign-code",
                0,
              ),
            ],
            blockingReasons: [],
            governance: {} as never,
          } as never,

          dependencyAuthorities: {
            producer:
              "canonical_dependency_runtime_authority_v1",
            producerVersion: "1",
            status: "ready",
            authorities: [],
            blockingReasons: [],
          } as never,
        },
      );

    assertEquals(
      result.status,
      "ready",
    );

    if (result.status !== "ready") {
      throw new Error(
        result.blockingReasons.join(","),
      );
    }

    assertEquals(
      result.bridge.actionCandidates,
      [],
    );

    assertEquals(
      result.bridge.governance.actionSelected,
      false,
    );

    assertEquals(
      result.bridge.governance.runtimeActionExecuted,
      false,
    );
  },
);

Deno.test(
  "action candidate bridge: structural authority mismatch fails closed",
  () => {
    const envelope =
      terminalEnvelope();

    envelope.structuralAuthorityId =
      "different-structural-authority";

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1(
        {
          terminalEnvelope:
            envelope as never,

          setRoleAuthorities: {
            authority:
              "canonical_runtime_set_role_action_authority_v1",
            authorityVersion: "1",
            status: "ready",
            authorities: [],
            blockingReasons: [],
            governance: {} as never,
          } as never,

          dependencyAuthorities: {
            producer:
              "canonical_dependency_runtime_authority_v1",
            producerVersion: "1",
            status: "ready",
            authorities: [],
            blockingReasons: [],
          } as never,
        },
      );

    assertEquals(
      result.status,
      "blocked",
    );

    if (result.status !== "blocked") {
      throw new Error(
        "expected blocked result",
      );
    }

    assertEquals(
      result.blockingReasons,
      [
        "terminal_structural_authority_identity_mismatch",
      ],
    );
  },
);

Deno.test(
  "action candidate bridge: blocked authority producer fails closed",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1(
        {
          terminalEnvelope:
            terminalEnvelope() as never,

          setRoleAuthorities: {
            authority:
              "canonical_runtime_set_role_action_authority_v1",
            authorityVersion: "1",
            status: "blocked",
            authorities: [],
            blockingReasons: [
              "fixture_blocked",
            ],
            governance: {} as never,
          } as never,

          dependencyAuthorities: {
            producer:
              "canonical_dependency_runtime_authority_v1",
            producerVersion: "1",
            status: "ready",
            authorities: [],
            blockingReasons: [],
          } as never,
        },
      );

    assertEquals(
      result.status,
      "blocked",
    );

    if (result.status !== "blocked") {
      throw new Error(
        "expected blocked result",
      );
    }

    assertEquals(
      result.blockingReasons,
      [
        "set_role_action_authority_result_blocked",
      ],
    );
  },
);
// A21024_SET_ROLE_ABSENCE_NORMALIZATION_TESTS

Deno.test(
  "action candidate bridge: exact set_role_action_not_found is treated only as an empty set-role family",
  () => {
    const envelope =
      terminalEnvelope();

    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1(
        {
          terminalEnvelope:
            envelope as any,

          setRoleAuthorities: {
            authority:
              "canonical_runtime_set_role_action_authority_v1",
            authorityVersion:
              "1",
            status:
              "blocked",
            authorities:
              [],
            blockingReasons: [
              "set_role_action_not_found",
            ],
            governance:
              {},
          } as any,

          dependencyAuthorities: {
            producer:
              "canonical_dependency_runtime_authority_v1",
            producerVersion:
              "1",
            status:
              "ready",
            authorities: [
              {
                id:
                  "dependency-authority:manifest-1:0",

                status:
                  "candidate",

                manifestId:
                  "manifest-1",

                manifestCode:
                  "manifest-code-1",

                actionIndex:
                  0,

                rawActionSnapshot: {
                  action:
                    "create_dependency",
                },
              },
            ],
            blockingReasons:
              [],
          } as any,
        },
      );

    assertEquals(
      result.status,
      "ready",
    );

    if (result.status !== "ready") {
      throw new Error(
        "exact set_role absence unexpectedly blocked bridge",
      );
    }

    assertEquals(
      result.bridge.actionCandidates.length,
      1,
    );

    assertEquals(
      result.bridge.actionCandidates[0].family,
      "create_dependency",
    );

    assertEquals(
      result.bridge.actionCandidates[0].actionIndex,
      0,
    );

    assertEquals(
      result.bridge.governance.actionSelected,
      false,
    );

    assertEquals(
      result.bridge.governance.genericEligibilityDerived,
      false,
    );

    assertEquals(
      result.bridge.governance.executableStateDerived,
      false,
    );

    assertEquals(
      result.bridge.governance.runtimeActionExecuted,
      false,
    );

    assertEquals(
      result.bridge.governance.schedulerInvoked,
      false,
    );

    assertEquals(
      result.bridge.governance.graphMutationPerformed,
      false,
    );
  },
);

Deno.test(
  "action candidate bridge: blocked set-role authority with any non-absence reason remains fail-closed",
  () => {
    const result =
      deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1(
        {
          terminalEnvelope:
            terminalEnvelope() as any,

          setRoleAuthorities: {
            authority:
              "canonical_runtime_set_role_action_authority_v1",
            authorityVersion:
              "1",
            status:
              "blocked",
            authorities:
              [],
            blockingReasons: [
              "manifest:manifest-code-1:action:0:role_missing",
            ],
            governance:
              {},
          } as any,

          dependencyAuthorities: {
            producer:
              "canonical_dependency_runtime_authority_v1",
            producerVersion:
              "1",
            status:
              "ready",
            authorities:
              [],
            blockingReasons:
              [],
          } as any,
        },
      );

    assertEquals(
      result.status,
      "blocked",
    );

    if (result.status !== "blocked") {
      throw new Error(
        "non-absence set-role block was incorrectly normalized",
      );
    }

    assertEquals(
      result.blockingReasons,
      [
        "set_role_action_authority_result_blocked",
      ],
    );

    assertEquals(
      result.governance.actionSelected,
      false,
    );

    assertEquals(
      result.governance.runtimeActionExecuted,
      false,
    );

    assertEquals(
      result.governance.schedulerInvoked,
      false,
    );

    assertEquals(
      result.governance.graphMutationPerformed,
      false,
    );
  },
);
