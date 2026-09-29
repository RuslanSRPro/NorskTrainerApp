import {
  type CanonicalRuntimeDependencyActionActivationAuthorityV1,
  type CanonicalRuntimeDependencyActionActivationPreconditionInputV1,
  type CanonicalRuntimeDependencyActionActivationResolutionV1,
  resolveCanonicalRuntimeDependencyActionActivationAuthorityV1,
} from "./canonical-runtime-dependency-action-activation-authority-resolution-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_SOURCE_READER_V1 =
  "a2.3:canonical-runtime-dependency-action-activation-source-reader-v1" as const;

export type CanonicalRuntimeDependencyActionActivationSourceRowV1 = {
  authority_id: unknown;
  manifest_id: unknown;
  dependency_action_authority_id: unknown;
  version: unknown;
  decision: unknown;
  provenance: unknown;
  supersedes_authority_id: unknown;
};

export type CanonicalRuntimeDependencyActionActivationSourceReaderResultV1 = {
  producer:
    typeof CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_SOURCE_READER_V1;

  producerVersion: "1";

  status:
    | "resolved_source_rows"
    | "unresolved_source_rows";

  manifestId: string;
  dependencyActionAuthorityId: string;

  sourceRows: readonly CanonicalRuntimeDependencyActionActivationSourceRowV1[];

  mappedAuthorities:
    readonly CanonicalRuntimeDependencyActionActivationAuthorityV1[];

  activationResolution: CanonicalRuntimeDependencyActionActivationResolutionV1;

  blockingReasons: readonly string[];

  governance: {
    exactScopeRequired: true;
    sourceRowsMappedLosslessly: true;
    malformedRowsFailClosed: true;

    supersessionResolvedHere: false;
    winnerSelectedHere: false;
    activationPermissionInferredHere: false;

    isActiveInferenceUsed: false;
    readinessInferenceUsed: false;
    validationInferenceUsed: false;
    shadowInferenceUsed: false;

    d6OwnsSupersessionResolution: true;
    d6OwnsAmbiguityResolution: true;
    d6OwnsGrantDenialResolution: true;

    runtimeActionExecuted: false;
    schedulerInvoked: false;
    graphMutationPerformed: false;
  };
};

function nonEmptyString(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function validProvenance(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function rowMatchesScope(
  row: CanonicalRuntimeDependencyActionActivationSourceRowV1,
  sourcePreconditionEvidence:
    CanonicalRuntimeDependencyActionActivationPreconditionInputV1,
): boolean {
  return (
    row.manifest_id ===
      sourcePreconditionEvidence.manifestId &&
    row.dependency_action_authority_id ===
      sourcePreconditionEvidence.dependencyActionAuthorityId
  );
}

function mapExactRow(
  row: CanonicalRuntimeDependencyActionActivationSourceRowV1,
):
  | CanonicalRuntimeDependencyActionActivationAuthorityV1
  | null {
  if (
    !nonEmptyString(row.authority_id) ||
    !nonEmptyString(row.manifest_id) ||
    !nonEmptyString(row.dependency_action_authority_id) ||
    !nonEmptyString(row.version) ||
    (
      row.decision !== "granted" &&
      row.decision !== "denied"
    ) ||
    !validProvenance(row.provenance) ||
    (
      row.supersedes_authority_id !== null &&
      !nonEmptyString(row.supersedes_authority_id)
    )
  ) {
    return null;
  }

  return {
    authorityId: row.authority_id,
    version: row.version,
    manifestId: row.manifest_id,
    dependencyActionAuthorityId: row.dependency_action_authority_id,
    decision: row.decision,
    provenance: row.provenance,
    supersedesAuthorityId: row.supersedes_authority_id,
  };
}

function governance() {
  return {
    exactScopeRequired: true,
    sourceRowsMappedLosslessly: true,
    malformedRowsFailClosed: true,

    supersessionResolvedHere: false,
    winnerSelectedHere: false,
    activationPermissionInferredHere: false,

    isActiveInferenceUsed: false,
    readinessInferenceUsed: false,
    validationInferenceUsed: false,
    shadowInferenceUsed: false,

    d6OwnsSupersessionResolution: true,
    d6OwnsAmbiguityResolution: true,
    d6OwnsGrantDenialResolution: true,

    runtimeActionExecuted: false,
    schedulerInvoked: false,
    graphMutationPerformed: false,
  } as const;
}

export function readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
  sourcePreconditionEvidence:
    CanonicalRuntimeDependencyActionActivationPreconditionInputV1,
  sourceRows: readonly CanonicalRuntimeDependencyActionActivationSourceRowV1[],
): CanonicalRuntimeDependencyActionActivationSourceReaderResultV1 {
  const base = {
    producer: CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_SOURCE_READER_V1,
    producerVersion: "1" as const,
    manifestId: sourcePreconditionEvidence.manifestId,
    dependencyActionAuthorityId:
      sourcePreconditionEvidence.dependencyActionAuthorityId,
    sourceRows,
    governance: governance(),
  };

  const exactScopeRows = sourceRows.filter(
    (row) =>
      rowMatchesScope(
        row,
        sourcePreconditionEvidence,
      ),
  );

  const mappedAuthorities:
    CanonicalRuntimeDependencyActionActivationAuthorityV1[] = [];

  for (const row of exactScopeRows) {
    const mapped = mapExactRow(row);

    if (mapped === null) {
      return {
        ...base,
        status: "unresolved_source_rows",
        mappedAuthorities: [],
        activationResolution:
          resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
            sourcePreconditionEvidence,
            [],
          ),
        blockingReasons: [
          "activation_source_row_invalid",
        ],
      };
    }

    mappedAuthorities.push(mapped);
  }

  const activationResolution =
    resolveCanonicalRuntimeDependencyActionActivationAuthorityV1(
      sourcePreconditionEvidence,
      mappedAuthorities,
    );

  return {
    ...base,
    status: "resolved_source_rows",
    mappedAuthorities,
    activationResolution,
    blockingReasons: [],
  };
}
