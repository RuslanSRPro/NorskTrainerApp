/**
 * Norsk Trainer — Runtime Set-Role Action Authority V1
 *
 * V1.46 A4.1
 *
 * PURPOSE
 *
 * Preserve the exact structural shape of validated Runtime `set_role`
 * actions without executing their linguistic or graph semantics.
 *
 * Source-backed facts available to this layer:
 *
 * - `set_role` is a registered structural Runtime action;
 * - the generic scalar action executor preserves `set_role` inside
 *   `structural_actions`;
 * - Runtime manifests may carry target / role / reason fields;
 * - historical predicate projection may interpret a specific role
 *   contract locally, but that does not define generic set_role
 *   semantics.
 *
 * THIS LAYER DOES NOT:
 *
 * - define what a Runtime role means;
 * - map `subject` to grammatical-function truth;
 * - map `subject` to relation `subject_of`;
 * - mutate node.features.role;
 * - generate graph nodes or edges;
 * - execute Runtime conditions;
 * - execute Runtime scope;
 * - enforce cardinality;
 * - bind an occurrence;
 * - select a winner;
 * - resolve conflicting grammatical roles;
 * - classify learner error.
 */

export const CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_V1 =
  "canonical_runtime_set_role_action_authority_v1";

export const CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_VERSION_V1 = "1";

type JsonRecord = Record<string, unknown>;

export type CanonicalRuntimeSetRoleShapeV1 =
  | "top_level_role"
  | "nested_value_role"
  | "top_level_and_nested_equal";

export type CanonicalRuntimeSetRoleActionAuthorityV1 = {
  id: string;

  status: "candidate";

  manifestId: string;
  manifestCode: string;

  actionIndex: number;
  actionName: "set_role";

  actionTargetLabel: string;

  topLevelRoleLabel: string | null;
  nestedValueRoleLabel: string | null;

  roleShape: CanonicalRuntimeSetRoleShapeV1;

  reasonCodeLabel: string | null;
  reasonLabel: string | null;

  sourceCandidateCodes: string[];

  rawActionSnapshot: JsonRecord;
};

export type CanonicalRuntimeSetRoleActionAuthorityResultV1 = {
  authority: typeof CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_V1;

  authorityVersion:
    typeof CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_VERSION_V1;

  status: "ready" | "blocked";

  authorities: CanonicalRuntimeSetRoleActionAuthorityV1[];

  blockingReasons: string[];

  governance: {
    validatedManifestRequired: true;

    setRoleVocabularySourceBacked: true;
    structuralActionTransportSourceBacked: true;

    actionShapeAuthorityResolved: true;

    actionTargetPreservedOpaque: true;
    roleLabelsPreservedOpaque: true;
    reasonFieldsPreservedOpaque: true;
    sourceCandidateCodesPreserved: true;

    targetBindingSemanticsResolved: false;
    roleSemanticsResolved: false;
    subjectRoleSemanticsResolved: false;

    subjectOfRelationInferred: false;

    graphOperationResolved: false;
    nodeRoleFeatureMutationResolved: false;

    runtimeConditionExecuted: false;
    runtimeScopeExecutionPerformed: false;
    cardinalityEnforcementPerformed: false;
    occurrenceBindingPerformed: false;

    winnerSelected: false;

    graphMutationPerformed: false;
    manifestMutationPerformed: false;
    frozenGrammarMutationPerformed: false;

    learnerErrorClassified: false;

    candidateOnly: true;
    frozenGrammarReadOnly: true;
  };
};

function asRecord(
  value: unknown,
): JsonRecord {
  return value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function stringValue(
  value: unknown,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function stringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];

  for (const item of value) {
    const text = stringValue(item);

    if (text && !out.includes(text)) {
      out.push(text);
    }
  }

  return out;
}

function stableJsonValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const record = value as JsonRecord;

    const out: JsonRecord = {};

    for (
      const key of Object.keys(record).sort()
    ) {
      out[key] = stableJsonValue(
        record[key],
      );
    }

    return out;
  }

  return value;
}

function sameJson(
  left: unknown,
  right: unknown,
): boolean {
  return JSON.stringify(
    stableJsonValue(left),
  ) ===
    JSON.stringify(
      stableJsonValue(right),
    );
}

function uniqueSorted(
  values: string[],
): string[] {
  return [
    ...new Set(values),
  ].sort();
}

function manifestValidationStatus(
  row: JsonRecord,
): {
  status?: string;
  conflict: boolean;
} {
  const labels = [
    stringValue(
      row.authoring_status,
    ),
    stringValue(
      row.authoringStatus,
    ),
    stringValue(
      row.validation_status,
    ),
    stringValue(
      row.validationStatus,
    ),
  ].filter(
    (value): value is string => Boolean(value),
  );

  const unique = [...new Set(labels)];

  return {
    status: unique.length === 1 ? unique[0] : undefined,

    conflict: unique.length > 1,
  };
}

function manifestActions(
  row: JsonRecord,
): {
  actions: unknown[];
  conflict: boolean;
} {
  const irSpec = asRecord(
    row.ir_spec ??
      row.irSpec,
  );

  const topLevelExists = Array.isArray(
    row.actions,
  );

  const irSpecExists = Array.isArray(
    irSpec.actions,
  );

  const topLevelActions = topLevelExists ? row.actions as unknown[] : [];

  const irSpecActions = irSpecExists ? irSpec.actions as unknown[] : [];

  if (
    topLevelExists &&
    irSpecExists &&
    !sameJson(
      topLevelActions,
      irSpecActions,
    )
  ) {
    return {
      actions: [],
      conflict: true,
    };
  }

  return {
    actions: topLevelExists ? topLevelActions : irSpecActions,

    conflict: false,
  };
}

function sourceCandidateCodes(
  row: JsonRecord,
): string[] {
  const irSpec = asRecord(
    row.ir_spec ??
      row.irSpec,
  );

  const source = asRecord(
    irSpec.source,
  );

  const primary = stringValue(
    source.primary_candidate_code ??
      source.primaryCandidateCode,
  );

  const supporting = stringArray(
    source.supporting_candidate_codes ??
      source.supportingCandidateCodes,
  );

  const out: string[] = [];

  if (primary) {
    out.push(primary);
  }

  for (const code of supporting) {
    if (!out.includes(code)) {
      out.push(code);
    }
  }

  return out;
}

function baseGovernance(): CanonicalRuntimeSetRoleActionAuthorityResultV1[
  "governance"
] {
  return {
    validatedManifestRequired: true,

    setRoleVocabularySourceBacked: true,

    structuralActionTransportSourceBacked: true,

    actionShapeAuthorityResolved: true,

    actionTargetPreservedOpaque: true,

    roleLabelsPreservedOpaque: true,

    reasonFieldsPreservedOpaque: true,

    sourceCandidateCodesPreserved: true,

    targetBindingSemanticsResolved: false,

    roleSemanticsResolved: false,

    subjectRoleSemanticsResolved: false,

    subjectOfRelationInferred: false,

    graphOperationResolved: false,

    nodeRoleFeatureMutationResolved: false,

    runtimeConditionExecuted: false,

    runtimeScopeExecutionPerformed: false,

    cardinalityEnforcementPerformed: false,

    occurrenceBindingPerformed: false,

    winnerSelected: false,

    graphMutationPerformed: false,

    manifestMutationPerformed: false,

    frozenGrammarMutationPerformed: false,

    learnerErrorClassified: false,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeSetRoleActionAuthoritiesV1(
  manifestRows: unknown[],
): CanonicalRuntimeSetRoleActionAuthorityResultV1 {
  const blockingReasons: string[] = [];

  const authorities: CanonicalRuntimeSetRoleActionAuthorityV1[] = [];

  const seenManifestIds = new Set<string>();

  const seenManifestCodes = new Set<string>();

  for (
    let rowIndex = 0;
    rowIndex < manifestRows.length;
    rowIndex += 1
  ) {
    const row = asRecord(
      manifestRows[rowIndex],
    );

    const manifestId = stringValue(
      row.id ??
        row.manifest_id ??
        row.manifestId,
    );

    const manifestCode = stringValue(
      row.code ??
        row.manifest_code ??
        row.manifestCode,
    );

    if (!manifestId) {
      blockingReasons.push(
        `row:${rowIndex}:manifest_id_missing`,
      );
    }

    if (!manifestCode) {
      blockingReasons.push(
        `row:${rowIndex}:manifest_code_missing`,
      );
    }

    if (
      manifestId &&
      seenManifestIds.has(
        manifestId,
      )
    ) {
      blockingReasons.push(
        `manifest:${manifestId}:duplicate_id`,
      );
    }

    if (
      manifestCode &&
      seenManifestCodes.has(
        manifestCode,
      )
    ) {
      blockingReasons.push(
        `manifest:${manifestCode}:duplicate_code`,
      );
    }

    if (manifestId) {
      seenManifestIds.add(
        manifestId,
      );
    }

    if (manifestCode) {
      seenManifestCodes.add(
        manifestCode,
      );
    }

    const validation = manifestValidationStatus(
      row,
    );

    if (validation.conflict) {
      blockingReasons.push(
        `row:${rowIndex}:validation_status_conflict`,
      );
    } else if (
      validation.status !==
        "validated"
    ) {
      blockingReasons.push(
        `row:${rowIndex}:manifest_not_validated`,
      );
    }

    const actionSnapshot = manifestActions(
      row,
    );

    if (actionSnapshot.conflict) {
      blockingReasons.push(
        `row:${rowIndex}:manifest_action_snapshot_conflict`,
      );

      continue;
    }

    if (
      !manifestId ||
      !manifestCode
    ) {
      continue;
    }

    const provenance = sourceCandidateCodes(
      row,
    );

    for (
      let actionIndex = 0;
      actionIndex <
        actionSnapshot.actions.length;
      actionIndex += 1
    ) {
      const action = asRecord(
        actionSnapshot
          .actions[actionIndex],
      );

      const actionName = stringValue(
        action.action,
      );

      if (
        actionName !==
          "set_role"
      ) {
        continue;
      }

      const target = stringValue(
        action.target,
      );

      const topLevelRole = stringValue(
        action.role,
      );

      const value = asRecord(
        action.value,
      );

      const nestedValueRole = stringValue(
        value.role,
      );

      const reasonCode = stringValue(
        action.reason_code ??
          action.reasonCode,
      );

      const reason = stringValue(
        action.reason,
      );

      if (!target) {
        blockingReasons.push(
          `manifest:${manifestCode}:action:${actionIndex}:target_missing`,
        );

        continue;
      }

      if (
        !topLevelRole &&
        !nestedValueRole
      ) {
        blockingReasons.push(
          `manifest:${manifestCode}:action:${actionIndex}:role_missing`,
        );

        continue;
      }

      if (
        topLevelRole &&
        nestedValueRole &&
        topLevelRole !==
          nestedValueRole
      ) {
        blockingReasons.push(
          `manifest:${manifestCode}:action:${actionIndex}:role_shape_conflict`,
        );

        continue;
      }

      const roleShape: CanonicalRuntimeSetRoleShapeV1 = topLevelRole &&
          nestedValueRole
        ? "top_level_and_nested_equal"
        : topLevelRole
        ? "top_level_role"
        : "nested_value_role";

      authorities.push({
        id: `set-role-authority:${manifestId}:${actionIndex}`,

        status: "candidate",

        manifestId,
        manifestCode,

        actionIndex,

        actionName: "set_role",

        actionTargetLabel: target,

        topLevelRoleLabel: topLevelRole ??
          null,

        nestedValueRoleLabel: nestedValueRole ??
          null,

        roleShape,

        reasonCodeLabel: reasonCode ??
          null,

        reasonLabel: reason ??
          null,

        sourceCandidateCodes: provenance,

        rawActionSnapshot: action,
      });
    }
  }

  if (
    blockingReasons.length === 0 &&
    authorities.length === 0
  ) {
    blockingReasons.push(
      "set_role_action_not_found",
    );
  }

  const finalBlockingReasons = uniqueSorted(
    blockingReasons,
  );

  return {
    authority: CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_V1,

    authorityVersion: CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_VERSION_V1,

    status: finalBlockingReasons.length === 0 ? "ready" : "blocked",

    authorities: finalBlockingReasons.length === 0 ? authorities : [],

    blockingReasons: finalBlockingReasons,

    governance: baseGovernance(),
  };
}
