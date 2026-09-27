import type {
  CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1,
} from "./canonical-runtime-token-pos-current-snapshot-bound-where-terminal-governed-result-envelope-v1.ts";

import type {
  CanonicalRuntimeSetRoleActionAuthorityResultV1,
  CanonicalRuntimeSetRoleActionAuthorityV1,
} from "./canonical-runtime-set-role-action-authority-v1.ts";

import type {
  CanonicalDependencyRuntimeActionAuthorityV1,
  CanonicalDependencyRuntimeAuthorityResultV1,
} from "./canonical-dependency-runtime-authority-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_ACTION_CANDIDATE_BRIDGE_V1 =
  "canonical_runtime_token_pos_current_snapshot_bound_where_action_candidate_bridge_v1" as const;

export const CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_ACTION_CANDIDATE_BRIDGE_VERSION_V1 =
  "v1" as const;

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateV1 =
  | {
    family: "set_role";

    actionIndex: number;

    sourceAuthority: CanonicalRuntimeSetRoleActionAuthorityV1;
  }
  | {
    family: "create_dependency";

    actionIndex: number;

    sourceAuthority: CanonicalDependencyRuntimeActionAuthorityV1;
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1 =
  {
    bridgeId: string;

    status: "candidate_set";

    manifestId: string;
    manifestCode: string;

    structuralAuthorityId: string;

    sourceTerminalEnvelope:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1;

    actionCandidates:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateV1[];

    governance: {
      exactStructuralAuthorityPreserved: true;
      exactManifestIdentityDerivedFromStructuralAuthority: true;

      actionAuthoritiesPreservedWithoutReconstruction: true;
      foreignManifestActionsExcluded: true;
      actionMultiplicityPreserved: true;
      actionIndexPreserved: true;

      rootTruthPreservedWithoutRecomputation: true;
      finalDecisionPreservedWithoutRecomputation: true;

      actionSelected: false;
      singletonPromotedToWinner: false;

      genericEligibilityDerived: false;
      executableStateDerived: false;
      schedulableStateDerived: false;

      runtimeActionExecuted: false;
      schedulerInvoked: false;
      graphMutationPerformed: false;
    };
  };

export type CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeResultV1 =
  | {
    status: "ready";

    bridge:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1;

    blockingReasons: [];
  }
  | {
    status: "blocked";

    blockingReasons: string[];

    governance: {
      semanticFallbackUsed: false;
      actionSelected: false;
      runtimeActionExecuted: false;
      schedulerInvoked: false;
      graphMutationPerformed: false;
    };
  };

function blocked(
  ...blockingReasons: string[]
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeResultV1 {
  return {
    status: "blocked",

    blockingReasons: [
      ...new Set(blockingReasons),
    ].sort(),

    governance: {
      semanticFallbackUsed: false,
      actionSelected: false,
      runtimeActionExecuted: false,
      schedulerInvoked: false,
      graphMutationPerformed: false,
    },
  };
}

export function deriveCanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeV1(
  input: {
    terminalEnvelope:
      CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereTerminalGovernedResultEnvelopeV1;

    setRoleAuthorities: CanonicalRuntimeSetRoleActionAuthorityResultV1;

    dependencyAuthorities: CanonicalDependencyRuntimeAuthorityResultV1;
  },
): CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateBridgeResultV1 {
  const {
    terminalEnvelope,
    setRoleAuthorities,
    dependencyAuthorities,
  } = input;

  const structuralAuthority = terminalEnvelope.sourceOperatorShapeAuthority;

  if (
    structuralAuthority.id !==
      terminalEnvelope.structuralAuthorityId
  ) {
    return blocked(
      "terminal_structural_authority_identity_mismatch",
    );
  }

  const manifestId = structuralAuthority.manifestId;

  const manifestCode = structuralAuthority.manifestCode;

  if (
    !manifestId ||
    !manifestCode
  ) {
    return blocked(
      "structural_authority_manifest_identity_missing",
    );
  }

  const setRoleFamilyAbsent = setRoleAuthorities.status === "blocked" &&
    setRoleAuthorities.authorities.length === 0 &&
    setRoleAuthorities.blockingReasons.length === 1 &&
    setRoleAuthorities.blockingReasons[0] ===
      "set_role_action_not_found";

  if (
    setRoleAuthorities.status === "blocked" &&
    !setRoleFamilyAbsent
  ) {
    return blocked(
      "set_role_action_authority_result_blocked",
    );
  }

  if (
    dependencyAuthorities.status === "blocked"
  ) {
    return blocked(
      "dependency_action_authority_result_blocked",
    );
  }

  const actionCandidates:
    CanonicalRuntimeTokenPosCurrentSnapshotBoundWhereActionCandidateV1[] = [];

  for (
    const authority of setRoleAuthorities.authorities
  ) {
    if (
      authority.manifestId !== manifestId ||
      authority.manifestCode !== manifestCode
    ) {
      continue;
    }

    actionCandidates.push({
      family: "set_role",

      actionIndex: authority.actionIndex,

      sourceAuthority: authority,
    });
  }

  for (
    const authority of dependencyAuthorities.authorities
  ) {
    if (
      authority.manifestId !== manifestId ||
      authority.manifestCode !== manifestCode
    ) {
      continue;
    }

    actionCandidates.push({
      family: "create_dependency",

      actionIndex: authority.actionIndex,

      sourceAuthority: authority,
    });
  }

  actionCandidates.sort(
    (
      left,
      right,
    ) =>
      left.actionIndex -
        right.actionIndex ||
      left.family.localeCompare(
        right.family,
      ) ||
      left.sourceAuthority.id.localeCompare(
        right.sourceAuthority.id,
      ),
  );

  const bridgeId = [
    CANONICAL_RUNTIME_TOKEN_POS_CURRENT_SNAPSHOT_BOUND_WHERE_ACTION_CANDIDATE_BRIDGE_V1,
    terminalEnvelope.envelopeId,
    manifestId,
  ].join(":");

  return {
    status: "ready",

    bridge: {
      bridgeId,

      status: "candidate_set",

      manifestId,
      manifestCode,

      structuralAuthorityId: terminalEnvelope.structuralAuthorityId,

      sourceTerminalEnvelope: terminalEnvelope,

      actionCandidates,

      governance: {
        exactStructuralAuthorityPreserved: true,
        exactManifestIdentityDerivedFromStructuralAuthority: true,

        actionAuthoritiesPreservedWithoutReconstruction: true,
        foreignManifestActionsExcluded: true,
        actionMultiplicityPreserved: true,
        actionIndexPreserved: true,

        rootTruthPreservedWithoutRecomputation: true,
        finalDecisionPreservedWithoutRecomputation: true,

        actionSelected: false,
        singletonPromotedToWinner: false,

        genericEligibilityDerived: false,
        executableStateDerived: false,
        schedulableStateDerived: false,

        runtimeActionExecuted: false,
        schedulerInvoked: false,
        graphMutationPerformed: false,
      },
    },

    blockingReasons: [],
  };
}
