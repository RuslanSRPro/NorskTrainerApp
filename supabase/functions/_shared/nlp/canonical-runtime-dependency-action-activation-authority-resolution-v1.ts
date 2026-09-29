// Norsk Trainer — Canonical Runtime Dependency Action Activation Authority Resolution V1
//
// D6.3
//
// Pure fail-closed resolution boundary:
//
//   D4 action execution precondition evidence
//        +
//   authored activation authorities
//        ->
//   exact dependency-action activation resolution
//
// Authored policy scope:
//   manifestId + dependencyActionAuthorityId
//
// This layer intentionally DOES NOT:
// - infer activation from is_active;
// - infer activation from validated/compiled/shadow/canary state;
// - infer activation from WHERE truth;
// - infer activation from D4 evidence completeness;
// - select an action;
// - promote a singleton candidate;
// - derive execution admission;
// - invoke a scheduler;
// - execute an action;
// - generate a canonical edge;
// - mutate the graph.
//
// Provenance is intentionally opaque at this boundary. It is preserved by
// exact object reference and is not interpreted or reconstructed here.

import type {
  CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
} from "./canonical-runtime-action-execution-precondition-evidence-boundary-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_AUTHORITY_RESOLUTION_V1 =
  "d6.3:dependency-action-activation-authority-resolution-v1" as const;

export type CanonicalRuntimeDependencyActionActivationDecisionV1 =
  | "granted"
  | "denied";

export type CanonicalRuntimeDependencyActionActivationAuthorityV1 = {
  authorityId: string;
  version: string;

  manifestId: string;
  dependencyActionAuthorityId: string;

  decision:
    CanonicalRuntimeDependencyActionActivationDecisionV1;

  provenance:
    Readonly<Record<string, unknown>>;

  supersedesAuthorityId:
    string | null;
};

export type CanonicalRuntimeDependencyActionActivationResolutionStateV1 =
  | "resolved_granted"
  | "resolved_denied"
  | "unresolved_absent"
  | "unresolved_ambiguous"
  | "unresolved_invalid";

export type CanonicalRuntimeDependencyActionActivationPreconditionInputV1 =
  Pick<
    CanonicalRuntimeActionExecutionPreconditionEvidenceV1,
    | "manifestId"
    | "dependencyActionAuthorityId"
  >;

export type CanonicalRuntimeDependencyActionActivationResolutionV1 = {
  producer:
    typeof CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_AUTHORITY_RESOLUTION_V1;

  producerVersion:
    "1";

  status:
    "candidate";

  manifestId:
    string;

  dependencyActionAuthorityId:
    string;

  state:
    CanonicalRuntimeDependencyActionActivationResolutionStateV1;

  sourcePreconditionEvidence:
    CanonicalRuntimeDependencyActionActivationPreconditionInputV1;

  sourceAuthority:
    CanonicalRuntimeDependencyActionActivationAuthorityV1 | null;

  applicableAuthorities:
    readonly CanonicalRuntimeDependencyActionActivationAuthorityV1[];

  blockingReasons:
    readonly string[];

  governance: {
    exactManifestIdentityRequired: true;
    exactDependencyActionAuthorityIdentityRequired: true;

    authoredGrantRequiredForResolvedGrant: true;
    authoredDenialRequiredForResolvedDenial: true;

    authorityProvenancePreservedOpaque: true;
    authorityVersionPreservedOpaque: true;
    explicitSupersessionRequired: true;
    implicitLatestVersionSelectionAllowed: false;

    absenceFailsClosed: true;
    ambiguityFailsClosed: true;
    invalidAuthorityFailsClosed: true;

    runtimeSnapshotOutsideAuthoredPolicyScope: true;
    runtimeSentenceOccurrenceOutsideAuthoredPolicyScope: true;

    finalWhereTruthRecomputed: false;
    preconditionCompletenessPromotedToPermission: false;

    actionSelected: false;
    singletonActionPromotedToWinner: false;
    endpointDirectionResolved: false;
    endpointBindingPerformed: false;
    dependencySemanticsResolved: false;

    executionAdmissionDerived: false;
    executableStateDerived: false;
    schedulableStateDerived: false;

    runtimeActionExecuted: false;
    schedulerInvoked: false;
    canonicalEdgeGenerated: false;
    graphMutationPerformed: false;

    frozenGrammarReadOnly: true;
  };
};

function nonEmpty(
  value: string,
): boolean {
  return value.trim().length > 0;
}

function sameScope(
  authority:
    CanonicalRuntimeDependencyActionActivationAuthorityV1,
  precondition:
    CanonicalRuntimeDependencyActionActivationPreconditionInputV1,
): boolean {
  return (
    authority.manifestId ===
      precondition.manifestId &&
    authority.dependencyActionAuthorityId ===
      precondition.dependencyActionAuthorityId
  );
}

function governance() {
  return {
    exactManifestIdentityRequired: true,
    exactDependencyActionAuthorityIdentityRequired: true,

    authoredGrantRequiredForResolvedGrant: true,
    authoredDenialRequiredForResolvedDenial: true,

    authorityProvenancePreservedOpaque: true,
    authorityVersionPreservedOpaque: true,
    explicitSupersessionRequired: true,
    implicitLatestVersionSelectionAllowed: false,

    absenceFailsClosed: true,
    ambiguityFailsClosed: true,
    invalidAuthorityFailsClosed: true,

    runtimeSnapshotOutsideAuthoredPolicyScope: true,
    runtimeSentenceOccurrenceOutsideAuthoredPolicyScope: true,

    finalWhereTruthRecomputed: false,
    preconditionCompletenessPromotedToPermission: false,

    actionSelected: false,
    singletonActionPromotedToWinner: false,
    endpointDirectionResolved: false,
    endpointBindingPerformed: false,
    dependencySemanticsResolved: false,

    executionAdmissionDerived: false,
    executableStateDerived: false,
    schedulableStateDerived: false,

    runtimeActionExecuted: false,
    schedulerInvoked: false,
    canonicalEdgeGenerated: false,
    graphMutationPerformed: false,

    frozenGrammarReadOnly: true,
  } as const;
}

export function resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
  sourcePreconditionEvidence:
    CanonicalRuntimeDependencyActionActivationPreconditionInputV1,
  authorities:
    readonly CanonicalRuntimeDependencyActionActivationAuthorityV1[],
): CanonicalRuntimeDependencyActionActivationResolutionV1 {
  const applicableAuthorities =
    authorities.filter(
      (authority) =>
        sameScope(
          authority,
          sourcePreconditionEvidence,
        ),
    );

  const base = {
    producer:
      CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_AUTHORITY_RESOLUTION_V1,
    producerVersion:
      "1" as const,
    status:
      "candidate" as const,
    manifestId:
      sourcePreconditionEvidence.manifestId,
    dependencyActionAuthorityId:
      sourcePreconditionEvidence.dependencyActionAuthorityId,
    sourcePreconditionEvidence,
    applicableAuthorities,
    governance:
      governance(),
  };

  if (
    !nonEmpty(
      sourcePreconditionEvidence.manifestId,
    ) ||
    !nonEmpty(
      sourcePreconditionEvidence.dependencyActionAuthorityId,
    )
  ) {
    return {
      ...base,
      state:
        "unresolved_invalid",
      sourceAuthority:
        null,
      blockingReasons: [
        "activation_scope_identity_invalid",
      ],
    };
  }

  if (
    applicableAuthorities.length ===
      0
  ) {
    return {
      ...base,
      state:
        "unresolved_absent",
      sourceAuthority:
        null,
      blockingReasons: [
        "activation_authority_absent",
      ],
    };
  }

  const ids =
    new Set<string>();

  for (
    const authority of
    applicableAuthorities
  ) {
    if (
      !nonEmpty(
        authority.authorityId,
      ) ||
      !nonEmpty(
        authority.version,
      ) ||
      !nonEmpty(
        authority.manifestId,
      ) ||
      !nonEmpty(
        authority.dependencyActionAuthorityId,
      ) ||
      (
        authority.decision !==
          "granted" &&
        authority.decision !==
          "denied"
      ) ||
      authority.provenance ===
        null ||
      typeof authority.provenance !==
        "object" ||
      Array.isArray(
        authority.provenance,
      )
    ) {
      return {
        ...base,
        state:
          "unresolved_invalid",
        sourceAuthority:
          null,
        blockingReasons: [
          "activation_authority_invalid",
        ],
      };
    }

    if (
      ids.has(
        authority.authorityId,
      )
    ) {
      return {
        ...base,
        state:
          "unresolved_invalid",
        sourceAuthority:
          null,
        blockingReasons: [
          "activation_authority_duplicate_id",
        ],
      };
    }

    ids.add(
      authority.authorityId,
    );
  }

  for (
    const authority of
    applicableAuthorities
  ) {
    if (
      authority.supersedesAuthorityId !==
        null &&
      (
        !nonEmpty(
          authority.supersedesAuthorityId,
        ) ||
        authority.supersedesAuthorityId ===
          authority.authorityId ||
        !ids.has(
          authority.supersedesAuthorityId,
        )
      )
    ) {
      return {
        ...base,
        state:
          "unresolved_invalid",
        sourceAuthority:
          null,
        blockingReasons: [
          "activation_authority_supersession_invalid",
        ],
      };
    }
  }

  const supersededIds =
    new Set<string>();

  for (
    const authority of
    applicableAuthorities
  ) {
    if (
      authority.supersedesAuthorityId !==
        null
    ) {
      supersededIds.add(
        authority.supersedesAuthorityId,
      );
    }
  }

  const heads =
    applicableAuthorities.filter(
      (authority) =>
        !supersededIds.has(
          authority.authorityId,
        ),
    );

  if (
    heads.length ===
      0
  ) {
    return {
      ...base,
      state:
        "unresolved_invalid",
      sourceAuthority:
        null,
      blockingReasons: [
        "activation_authority_supersession_cycle_or_no_head",
      ],
    };
  }

  if (
    heads.length !==
      1
  ) {
    return {
      ...base,
      state:
        "unresolved_ambiguous",
      sourceAuthority:
        null,
      blockingReasons: [
        "activation_authority_ambiguous",
      ],
    };
  }

  const sourceAuthority =
    heads[0];

  return {
    ...base,
    state:
      sourceAuthority.decision ===
        "granted"
        ? "resolved_granted"
        : "resolved_denied",
    sourceAuthority,
    blockingReasons: [],
  };
}