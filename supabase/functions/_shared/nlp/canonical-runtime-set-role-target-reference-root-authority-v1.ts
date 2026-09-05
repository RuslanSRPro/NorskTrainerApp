/**
 * Norsk Trainer
 *
 * V1.46 A4.2
 *
 * SET_ROLE TARGET REFERENCE ROOT AUTHORITY
 *
 * Composition:
 *
 *   A4.1 exact opaque set_role action authority
 *       +
 *   A3.0 exact Runtime binding-definition authorities
 *       +
 *   exact validated Runtime manifest snapshot
 *       ->
 *   syntactic target reference-root classification.
 *
 * This layer may prove only:
 *
 *   target === exact manifest-local binding name
 *
 *     -> exact_binding
 *
 * or:
 *
 *   target starts with bindingName + "."
 *
 *     -> binding_prefix_with_opaque_suffix
 *
 * where the longest exact manifest-local binding prefix wins.
 *
 * Otherwise:
 *
 *     -> unrooted
 *
 * The suffix is opaque.
 *
 * This layer DOES NOT:
 *
 * - execute a Runtime binding;
 * - enumerate or select occurrences;
 * - traverse dotted properties;
 * - interpret a suffix;
 * - interpret role='subject';
 * - infer grammatical subject truth;
 * - infer subject_of;
 * - execute WHERE;
 * - execute scope;
 * - enforce cardinality;
 * - select a winner;
 * - mutate the graph;
 * - classify learner error.
 */

import {
  CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_V1,
  CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_VERSION_V1,
  type CanonicalRuntimeSetRoleActionAuthorityResultV1,
  type CanonicalRuntimeSetRoleActionAuthorityV1,
} from "./canonical-runtime-set-role-action-authority-v1.ts";

import type {
  CanonicalRuntimeBindingDefinitionAuthorityV1,
} from "./canonical-runtime-binding-definition-authority-v1.ts";

export const CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_V1 =
  "canonical_runtime_set_role_target_reference_root_authority_v1";

export const CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_VERSION_V1 =
  "1";

type JsonRecord = Record<string, unknown>;

export type CanonicalRuntimeSetRoleTargetReferenceRootMatchV1 =
  | "exact_binding"
  | "binding_prefix_with_opaque_suffix"
  | "unrooted";

export type CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1 = {
  id: string;

  status: "candidate";

  setRoleActionAuthorityId: string;

  manifestId: string;

  manifestCode: string;

  actionIndex: number;

  actionTargetLabel: string;

  rootMatch: CanonicalRuntimeSetRoleTargetReferenceRootMatchV1;

  rooted: boolean;

  rootBindingName: string | null;

  rootBindingDefinitionAuthorityId: string | null;

  rootBindingDefinition: Record<string, unknown> | null;

  opaqueSuffix: string | null;

  sourceCandidateCodes: string[];

  governance: {
    setRoleActionAuthorityRequired: true;

    exactValidatedManifestRequired: true;

    exactActionSnapshotRequired: true;

    exactBindingDefinitionSetRequired: true;

    manifestLocalBindingRootsOnly: true;

    longestExactBindingPrefixWins: true;

    lexicalDelimiterOnly: true;

    referenceExpressionPreserved: true;

    opaqueSuffixPreserved: true;

    targetReferenceRootResolved: true;

    referenceExpressionGrammarResolved: false;

    dottedPathSemanticsResolved: false;

    suffixSemanticsResolved: false;

    bindingSemanticsResolved: false;

    roleSemanticsResolved: false;

    subjectRoleSemanticsResolved: false;

    targetOccurrenceBound: false;

    whereExecuted: false;

    scopeExecuted: false;

    cardinalityEnforced: false;

    subjectOfRelationInferred: false;

    graphMutationPerformed: false;

    winnerSelected: false;

    learnerErrorClassified: false;

    candidateOnly: true;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeSetRoleTargetReferenceRootAuthorityResultV1 = {
  authority:
    typeof CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_V1;

  authorityVersion:
    typeof CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_VERSION_V1;

  status:
    | "ready"
    | "blocked";

  authorities: CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1[];

  rootedAuthorityIds: string[];

  unrootedAuthorityIds: string[];

  blockingReasons: string[];
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
  if (
    typeof value !==
      "string"
  ) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(values),
  ].sort();
}

function stableValue(
  value: unknown,
): unknown {
  if (
    Array.isArray(value)
  ) {
    return value.map(
      stableValue,
    );
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
      out[key] = stableValue(
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
    stableValue(left),
  ) ===
    JSON.stringify(
      stableValue(right),
    );
}

function exactManifestRow(
  rows: readonly unknown[],
  manifestId: string,
  manifestCode: string,
): JsonRecord | undefined {
  const matches = rows
    .map(
      asRecord,
    )
    .filter(
      (row) =>
        stringValue(
            row.id ??
              row.manifest_id ??
              row.manifestId,
          ) ===
          manifestId &&
        stringValue(
            row.code ??
              row.manifest_code ??
              row.manifestCode,
          ) ===
          manifestCode,
    );

  return matches.length ===
      1
    ? matches[0]
    : undefined;
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

  const irExists = Array.isArray(
    irSpec.actions,
  );

  const top = topLevelExists ? row.actions as unknown[] : [];

  const ir = irExists ? irSpec.actions as unknown[] : [];

  if (
    topLevelExists &&
    irExists &&
    !sameJson(
      top,
      ir,
    )
  ) {
    return {
      actions: [],
      conflict: true,
    };
  }

  return {
    actions: topLevelExists ? top : ir,

    conflict: false,
  };
}

function manifestBindings(
  row: JsonRecord,
): Record<string, unknown> | null {
  const irSpec = asRecord(
    row.ir_spec ??
      row.irSpec,
  );

  const bindings = asRecord(
    irSpec.bindings,
  );

  return Object.keys(
      bindings,
    ).length > 0
    ? bindings
    : null;
}

function safeSetRoleResult(
  result: CanonicalRuntimeSetRoleActionAuthorityResultV1,
): boolean {
  const g = result.governance;

  return (
    result.authority ===
      CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_V1 &&
    result.authorityVersion ===
      CANONICAL_RUNTIME_SET_ROLE_ACTION_AUTHORITY_VERSION_V1 &&
    result.status === "ready" &&
    result.blockingReasons.length === 0 &&
    result.authorities.length > 0 &&
    g.validatedManifestRequired === true &&
    g.setRoleVocabularySourceBacked === true &&
    g.structuralActionTransportSourceBacked === true &&
    g.actionShapeAuthorityResolved === true &&
    g.actionTargetPreservedOpaque === true &&
    g.roleLabelsPreservedOpaque === true &&
    g.reasonFieldsPreservedOpaque === true &&
    g.sourceCandidateCodesPreserved === true &&
    g.targetBindingSemanticsResolved === false &&
    g.roleSemanticsResolved === false &&
    g.subjectRoleSemanticsResolved === false &&
    g.subjectOfRelationInferred === false &&
    g.graphOperationResolved === false &&
    g.nodeRoleFeatureMutationResolved === false &&
    g.runtimeConditionExecuted === false &&
    g.runtimeScopeExecutionPerformed === false &&
    g.cardinalityEnforcementPerformed === false &&
    g.occurrenceBindingPerformed === false &&
    g.winnerSelected === false &&
    g.graphMutationPerformed === false &&
    g.manifestMutationPerformed === false &&
    g.frozenGrammarMutationPerformed === false &&
    g.learnerErrorClassified === false &&
    g.candidateOnly === true &&
    g.frozenGrammarReadOnly === true
  );
}

function safeSetRoleAuthority(
  authority: CanonicalRuntimeSetRoleActionAuthorityV1,
): boolean {
  return (
    authority.status === "candidate" &&
    Boolean(
      stringValue(
        authority.id,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.manifestId,
      ),
    ) &&
    Boolean(
      stringValue(
        authority.manifestCode,
      ),
    ) &&
    Number.isInteger(
      authority.actionIndex,
    ) &&
    authority.actionIndex >= 0 &&
    authority.actionName === "set_role" &&
    Boolean(
      stringValue(
        authority.actionTargetLabel,
      ),
    )
  );
}
function safeBindingAuthority(
  authority: CanonicalRuntimeBindingDefinitionAuthorityV1,
): boolean {
  const raw = authority as unknown as JsonRecord;

  const governance = asRecord(
    raw.governance,
  );

  return (
    raw.status ===
      "candidate" &&
    Boolean(
      stringValue(
        raw.id,
      ),
    ) &&
    Boolean(
      stringValue(
        raw.manifestId,
      ),
    ) &&
    Boolean(
      stringValue(
        raw.manifestCode,
      ),
    ) &&
    Boolean(
      stringValue(
        raw.bindingName,
      ),
    ) &&
    Object.keys(
        asRecord(
          raw.bindingDefinition,
        ),
      ).length >
      0 &&
    governance.exactValidatedManifestRequired ===
      true &&
    governance.bindingNamePreservedOpaque ===
      true &&
    governance.bindingDefinitionPreservedOpaque ===
      true &&
    governance.entitySemanticsResolved ===
      false &&
    governance.scopeSemanticsResolved ===
      false &&
    governance.cardinalitySemanticsResolved ===
      false &&
    governance.whereSemanticsResolved ===
      false &&
    governance.occurrenceEnumerationPerformed ===
      false
  );
}

function bindingAuthoritiesForManifest(
  authorities: readonly CanonicalRuntimeBindingDefinitionAuthorityV1[],
  manifestId: string,
  manifestCode: string,
): CanonicalRuntimeBindingDefinitionAuthorityV1[] {
  return authorities.filter(
    (authority) => {
      const raw = authority as unknown as JsonRecord;

      return (
        stringValue(
            raw.manifestId,
          ) ===
          manifestId &&
        stringValue(
            raw.manifestCode,
          ) ===
          manifestCode
      );
    },
  );
}

function bindingSnapshotFromAuthorities(
  authorities: readonly CanonicalRuntimeBindingDefinitionAuthorityV1[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (
    const authority of authorities
  ) {
    const raw = authority as unknown as JsonRecord;

    const bindingName = stringValue(
      raw.bindingName,
    );

    if (!bindingName) {
      continue;
    }

    out[bindingName] = asRecord(
      raw.bindingDefinition,
    );
  }

  return out;
}

function bindingAuthorityId(
  authority: CanonicalRuntimeBindingDefinitionAuthorityV1,
): string | null {
  const raw = authority as unknown as JsonRecord;

  return stringValue(
    raw.id,
  ) ??
    null;
}

function bindingName(
  authority: CanonicalRuntimeBindingDefinitionAuthorityV1,
): string | null {
  const raw = authority as unknown as JsonRecord;

  return stringValue(
    raw.bindingName,
  ) ??
    null;
}

function bindingDefinition(
  authority: CanonicalRuntimeBindingDefinitionAuthorityV1,
): Record<string, unknown> {
  const raw = authority as unknown as JsonRecord;

  return asRecord(
    raw.bindingDefinition,
  );
}

function rootMatch(
  expression: string,
  bindingNames: readonly string[],
): {
  rootMatch: CanonicalRuntimeSetRoleTargetReferenceRootMatchV1;

  rootBindingName: string | null;

  opaqueSuffix: string | null;
} {
  const exact = bindingNames.find(
    (name) =>
      expression ===
        name,
  );

  if (exact) {
    return {
      rootMatch: "exact_binding",

      rootBindingName: exact,

      opaqueSuffix: null,
    };
  }

  const prefixCandidates = bindingNames
    .filter(
      (name) => {
        const prefix = `${name}.`;

        return (
          expression.startsWith(
            prefix,
          ) &&
          expression.length >
            prefix.length
        );
      },
    )
    .sort(
      (a, b) =>
        b.length -
          a.length ||
        a.localeCompare(
          b,
        ),
    );

  const root = prefixCandidates[0];

  if (root) {
    return {
      rootMatch: "binding_prefix_with_opaque_suffix",

      rootBindingName: root,

      opaqueSuffix: expression.slice(
        root.length +
          1,
      ),
    };
  }

  return {
    rootMatch: "unrooted",

    rootBindingName: null,

    opaqueSuffix: null,
  };
}

function governance(): CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1[
  "governance"
] {
  return {
    setRoleActionAuthorityRequired: true,

    exactValidatedManifestRequired: true,

    exactActionSnapshotRequired: true,

    exactBindingDefinitionSetRequired: true,

    manifestLocalBindingRootsOnly: true,

    longestExactBindingPrefixWins: true,

    lexicalDelimiterOnly: true,

    referenceExpressionPreserved: true,

    opaqueSuffixPreserved: true,

    targetReferenceRootResolved: true,

    referenceExpressionGrammarResolved: false,

    dottedPathSemanticsResolved: false,

    suffixSemanticsResolved: false,

    bindingSemanticsResolved: false,

    roleSemanticsResolved: false,

    subjectRoleSemanticsResolved: false,

    targetOccurrenceBound: false,

    whereExecuted: false,

    scopeExecuted: false,

    cardinalityEnforced: false,

    subjectOfRelationInferred: false,

    graphMutationPerformed: false,

    winnerSelected: false,

    learnerErrorClassified: false,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeSetRoleTargetReferenceRootAuthoritiesV1(
  setRoleResult: CanonicalRuntimeSetRoleActionAuthorityResultV1,
  bindingAuthorities: readonly CanonicalRuntimeBindingDefinitionAuthorityV1[],
  manifestRows: readonly unknown[],
): CanonicalRuntimeSetRoleTargetReferenceRootAuthorityResultV1 {
  const blockingReasons: string[] = [];

  const out: CanonicalRuntimeSetRoleTargetReferenceRootAuthorityV1[] = [];

  const rootedAuthorityIds: string[] = [];

  const unrootedAuthorityIds: string[] = [];

  const seenActionAuthorityIds = new Set<string>();

  if (
    !safeSetRoleResult(
      setRoleResult,
    )
  ) {
    return {
      authority: CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_V1,

      authorityVersion:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_VERSION_V1,

      status: "blocked",

      authorities: [],

      rootedAuthorityIds: [],

      unrootedAuthorityIds: [],

      blockingReasons: [
        "unsafe_a4_1_result",
      ],
    };
  }

  const setRoleAuthorities = setRoleResult.authorities;

  for (
    const actionAuthority of setRoleAuthorities
  ) {
    if (
      seenActionAuthorityIds.has(
        actionAuthority.id,
      )
    ) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:duplicate`,
      );

      continue;
    }

    seenActionAuthorityIds.add(
      actionAuthority.id,
    );

    if (
      !safeSetRoleAuthority(
        actionAuthority,
      )
    ) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:unsafe_a4_1_authority`,
      );

      continue;
    }

    const row = exactManifestRow(
      manifestRows,
      actionAuthority.manifestId,
      actionAuthority.manifestCode,
    );

    if (!row) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:exact_manifest_missing_or_ambiguous`,
      );

      continue;
    }

    if (
      stringValue(
        row.authoring_status ??
          row.authoringStatus,
      ) !==
        "validated"
    ) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:manifest_not_validated`,
      );

      continue;
    }

    const actions = manifestActions(
      row,
    );

    if (actions.conflict) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:manifest_action_snapshot_conflict`,
      );

      continue;
    }

    const exactAction = actions.actions[
      actionAuthority.actionIndex
    ];

    if (
      !exactAction ||
      !sameJson(
        exactAction,
        actionAuthority.rawActionSnapshot,
      )
    ) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:exact_action_snapshot_stale`,
      );

      continue;
    }

    const exactActionRecord = asRecord(
      exactAction,
    );

    if (
      stringValue(
          exactActionRecord.action,
        ) !==
        "set_role" ||
      stringValue(
          exactActionRecord.target,
        ) !==
        actionAuthority.actionTargetLabel
    ) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:exact_action_target_mismatch`,
      );

      continue;
    }

    const bindingGroup = bindingAuthoritiesForManifest(
      bindingAuthorities,
      actionAuthority.manifestId,
      actionAuthority.manifestCode,
    );

    if (
      bindingGroup.length ===
        0
    ) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:binding_definition_set_missing`,
      );

      continue;
    }

    const seenBindingIds = new Set<string>();

    const seenBindingNames = new Set<string>();

    let unsafeBindingSet = false;

    for (
      const bindingAuthority of bindingGroup
    ) {
      if (
        !safeBindingAuthority(
          bindingAuthority,
        )
      ) {
        blockingReasons.push(
          `authority:${actionAuthority.id}:unsafe_binding_definition_authority`,
        );

        unsafeBindingSet = true;

        continue;
      }

      const id = bindingAuthorityId(
        bindingAuthority,
      );

      const name = bindingName(
        bindingAuthority,
      );

      if (
        !id ||
        !name
      ) {
        blockingReasons.push(
          `authority:${actionAuthority.id}:binding_identity_missing`,
        );

        unsafeBindingSet = true;

        continue;
      }

      if (
        seenBindingIds.has(
          id,
        )
      ) {
        blockingReasons.push(
          `authority:${actionAuthority.id}:duplicate_binding_authority_id:${id}`,
        );

        unsafeBindingSet = true;
      }

      if (
        seenBindingNames.has(
          name,
        )
      ) {
        blockingReasons.push(
          `authority:${actionAuthority.id}:duplicate_binding_name:${name}`,
        );

        unsafeBindingSet = true;
      }

      seenBindingIds.add(
        id,
      );

      seenBindingNames.add(
        name,
      );
    }

    if (unsafeBindingSet) {
      continue;
    }

    const exactBindings = manifestBindings(
      row,
    );

    if (!exactBindings) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:manifest_bindings_missing`,
      );

      continue;
    }

    const authorityBindingSnapshot = bindingSnapshotFromAuthorities(
      bindingGroup,
    );

    if (
      !sameJson(
        exactBindings,
        authorityBindingSnapshot,
      )
    ) {
      blockingReasons.push(
        `authority:${actionAuthority.id}:binding_definition_snapshot_stale`,
      );

      continue;
    }

    const names = bindingGroup
      .map(
        bindingName,
      )
      .filter(
        (name): name is string => Boolean(name),
      )
      .sort();

    const match = rootMatch(
      actionAuthority.actionTargetLabel,
      names,
    );

    const rootAuthority = match.rootBindingName
      ? bindingGroup.find(
        (authority) =>
          bindingName(
            authority,
          ) ===
            match.rootBindingName,
      )
      : undefined;

    const id = [
      "set-role-target-root",
      encodeURIComponent(
        actionAuthority.id,
      ),
    ].join(":");

    const rooted = match.rootBindingName !==
      null;

    if (rooted) {
      rootedAuthorityIds.push(
        id,
      );
    } else {
      unrootedAuthorityIds.push(
        id,
      );
    }

    out.push({
      id,

      status: "candidate",

      setRoleActionAuthorityId: actionAuthority.id,

      manifestId: actionAuthority.manifestId,

      manifestCode: actionAuthority.manifestCode,

      actionIndex: actionAuthority.actionIndex,

      actionTargetLabel: actionAuthority.actionTargetLabel,

      rootMatch: match.rootMatch,

      rooted,

      rootBindingName: match.rootBindingName,

      rootBindingDefinitionAuthorityId: rootAuthority
        ? bindingAuthorityId(
          rootAuthority,
        )
        : null,

      rootBindingDefinition: rootAuthority
        ? bindingDefinition(
          rootAuthority,
        )
        : null,

      opaqueSuffix: match.opaqueSuffix,

      sourceCandidateCodes: [
        ...actionAuthority
          .sourceCandidateCodes,
      ],

      governance: governance(),
    });
  }

  const uniqueReasons = uniqueSorted(
    blockingReasons,
  );

  if (
    uniqueReasons.length >
      0
  ) {
    return {
      authority: CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_V1,

      authorityVersion:
        CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_VERSION_V1,

      status: "blocked",

      authorities: [],

      rootedAuthorityIds: [],

      unrootedAuthorityIds: [],

      blockingReasons: uniqueReasons,
    };
  }

  return {
    authority: CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_V1,

    authorityVersion:
      CANONICAL_RUNTIME_SET_ROLE_TARGET_REFERENCE_ROOT_AUTHORITY_VERSION_V1,

    status: "ready",

    authorities: out.sort(
      (a, b) =>
        a.id.localeCompare(
          b.id,
        ),
    ),

    rootedAuthorityIds: uniqueSorted(
      rootedAuthorityIds,
    ),

    unrootedAuthorityIds: uniqueSorted(
      unrootedAuthorityIds,
    ),

    blockingReasons: [],
  };
}
