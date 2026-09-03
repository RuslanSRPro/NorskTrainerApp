// Norsk Trainer — Canonical Predicate Sense Source Role Adapter V1
//
// v1.44 Wave B A2.1
//
// Build/control-plane adapter.
//
// Purpose:
//   frozen structured construction knowledge
//        -> generic member-role projections
//        -> later occurrence binding
//        -> predicate-sense evidence
//
// This file does NOT:
//   - inspect raw text;
//   - inspect lemma inventories;
//   - know language-specific sense labels;
//   - choose a winning sense;
//   - create graph nodes;
//   - create predicate candidates;
//   - mutate source grammar.
//
// Semantic role labels are copied verbatim from source-verified,
// runtime-eligible structured payload fields.
//
// Example generic shape:
//
//   finite_role: <opaque semantic role>
//   nonfinite_role: <opaque semantic role>
//
// becomes:
//
//   memberRef: finite
//   sense:     <same opaque semantic role>
//
// The adapter never infers a role from a candidate code or lemma.

type J = Record<string, unknown>;

export const CANONICAL_PREDICATE_SENSE_SOURCE_ROLE_ADAPTER_V1 =
  'canonical_predicate_sense_source_role_adapter_v1';

export const CANONICAL_PREDICATE_SENSE_SOURCE_ROLE_ADAPTER_VERSION_V1 =
  '1';

export type CanonicalPredicateSenseSourceCandidateSnapshotRowV1 = {
  candidate_id?: string | null;
  candidate_code?: string | null;

  status?: string | null;
  requires_human_verification?: boolean | null;

  source_section?: string | null;

  extracted_payload?: J | null;
  digital_model?: J | null;
  execution_contract?: J | null;
};

export type CanonicalPredicateSenseSourceSnapshotV1 = {
  version?: string | null;

  plane?: string | null;

  read_only?: boolean | null;
  write_performed?: boolean | null;
  frozen_grammar_immutable?: boolean | null;

  candidates?:
    readonly CanonicalPredicateSenseSourceCandidateSnapshotRowV1[] |
    null;
};

export type CanonicalPredicateSenseSourceRoleProjectionV1 = {
  projectionId: string;

  sourceCandidateId?: string;
  sourceCandidateCode: string;
  sourceSection?: string;

  modelType: string;
  modelSubtype?: string;
  executionRole: string;

  roleField: string;
  memberRef: string;

  // Opaque source semantic role.
  sense: string;

  sourceCandidateCodes: string[];
  sourceSections: string[];

  evidenceKind: 'source_rule';

  projectionPolicy:
    'source_role_candidate_support_only';

  frozenGrammarReadOnly: true;
};

export type CanonicalPredicateSenseSourceRoleAdapterDiagnosticV1 = {
  code: string;
  detail?: string;
};

export type CanonicalPredicateSenseSourceRoleProjectionResultV1 = {
  producer:
    typeof CANONICAL_PREDICATE_SENSE_SOURCE_ROLE_ADAPTER_V1;

  producerVersion:
    typeof CANONICAL_PREDICATE_SENSE_SOURCE_ROLE_ADAPTER_VERSION_V1;

  status:
    | 'ready'
    | 'blocked';

  projections:
    CanonicalPredicateSenseSourceRoleProjectionV1[];

  diagnostics:
    CanonicalPredicateSenseSourceRoleAdapterDiagnosticV1[];
};


function objectValue(
  value: unknown,
): J | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  return value as J;
}


function stringValue(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed =
    value.trim();

  return trimmed || undefined;
}


function boolValue(
  value: unknown,
): boolean | undefined {
  return typeof value === 'boolean'
    ? value
    : undefined;
}


function stringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map(stringValue)
        .filter(
          (
            item,
          ): item is string =>
            Boolean(item),
        ),
    ),
  ];
}


function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  ).replaceAll('%', '_');
}


function nestedObject(
  root: unknown,
  ...path: string[]
): J | undefined {
  let current:
    unknown = root;

  for (
    const key of path
  ) {
    const obj =
      objectValue(
        current,
      );

    if (!obj) {
      return undefined;
    }

    current =
      obj[key];
  }

  return objectValue(
    current,
  );
}


function nestedString(
  root: unknown,
  ...path: string[]
): string | undefined {
  let current:
    unknown = root;

  for (
    const key of path
  ) {
    const obj =
      objectValue(
        current,
      );

    if (!obj) {
      return undefined;
    }

    current =
      obj[key];
  }

  return stringValue(
    current,
  );
}


function nestedBoolean(
  root: unknown,
  ...path: string[]
): boolean | undefined {
  let current:
    unknown = root;

  for (
    const key of path
  ) {
    const obj =
      objectValue(
        current,
      );

    if (!obj) {
      return undefined;
    }

    current =
      obj[key];
  }

  return boolValue(
    current,
  );
}


function nestedStringArray(
  root: unknown,
  ...path: string[]
): string[] {
  let current:
    unknown = root;

  for (
    const key of path
  ) {
    const obj =
      objectValue(
        current,
      );

    if (!obj) {
      return [];
    }

    current =
      obj[key];
  }

  return stringArray(
    current,
  );
}


function snapshotSafetyDiagnostics(
  snapshot:
    CanonicalPredicateSenseSourceSnapshotV1,
): CanonicalPredicateSenseSourceRoleAdapterDiagnosticV1[] {
  const diagnostics:
    CanonicalPredicateSenseSourceRoleAdapterDiagnosticV1[] = [];

  if (
    snapshot.read_only !== true
  ) {
    diagnostics.push({
      code:
        'snapshot_not_read_only',
    });
  }

  if (
    snapshot.write_performed !== false
  ) {
    diagnostics.push({
      code:
        'snapshot_write_state_not_safe',
    });
  }

  if (
    snapshot.frozen_grammar_immutable !== true
  ) {
    diagnostics.push({
      code:
        'frozen_grammar_immutability_not_proven',
    });
  }

  if (
    snapshot.plane !==
      'build_control'
  ) {
    diagnostics.push({
      code:
        'unexpected_snapshot_plane',

      detail:
        String(
          snapshot.plane ??
            '',
        ),
    });
  }

  return diagnostics;
}


function runtimeConstructionCandidate(
  row:
    CanonicalPredicateSenseSourceCandidateSnapshotRowV1,
): {
  candidateCode: string;

  candidateId?: string;

  sourceSection?: string;

  payload: J;

  modelType: string;

  modelSubtype?: string;

  executionRole: string;
} | undefined {
  const candidateCode =
    stringValue(
      row.candidate_code,
    );

  if (!candidateCode) {
    return undefined;
  }

  if (
    row.status !==
      'source_verified'
  ) {
    return undefined;
  }

  if (
    row.requires_human_verification ===
      true
  ) {
    return undefined;
  }

  const payload =
    objectValue(
      row.extracted_payload,
    );

  if (!payload) {
    return undefined;
  }

  const modelType =
    nestedString(
      row.digital_model,
      'model',
      'type',
    );

  if (
    modelType !==
      'construction_compatibility'
  ) {
    return undefined;
  }

  const sourceStrictRuntime =
    nestedBoolean(
      row.digital_model,
      'model',
      'learning',
      'source_strict_runtime',
    );

  if (
    sourceStrictRuntime !==
      true
  ) {
    return undefined;
  }

  const disposition =
    nestedString(
      row.execution_contract,
      'audit',
      'disposition',
    );

  if (
    disposition !==
      'KEEP_GRAMMAR_RUNTIME'
  ) {
    return undefined;
  }

  const executionRole =
    nestedString(
      row.execution_contract,
      'execution',
      'role',
    );

  if (
    executionRole !==
      'construction'
  ) {
    return undefined;
  }

  const targetLayers =
    nestedStringArray(
      row.execution_contract,
      'placement',
      'target_layers',
    );

  if (
    !targetLayers.includes(
      'runtime',
    )
  ) {
    return undefined;
  }

  return {
    candidateCode,

    candidateId:
      stringValue(
        row.candidate_id,
      ),

    sourceSection:
      stringValue(
        row.source_section,
      ),

    payload,

    modelType,

    modelSubtype:
      nestedString(
        row.digital_model,
        'model',
        'subtype',
      ),

    executionRole,
  };
}


function sourceRoleEntries(
  payload: J,
): {
  roleField: string;
  memberRef: string;
  sense: string;
}[] {
  const entries: {
    roleField: string;
    memberRef: string;
    sense: string;
  }[] = [];

  for (
    const [
      key,
      rawValue,
    ] of Object.entries(
      payload,
    ).sort(
      ([a], [b]) =>
        a.localeCompare(b),
    )
  ) {
    if (
      !/^[a-z][a-z0-9_]*_role$/i
        .test(key)
    ) {
      continue;
    }

    const sense =
      stringValue(
        rawValue,
      );

    if (!sense) {
      continue;
    }

    const memberRef =
      key.slice(
        0,
        -'_role'.length,
      );

    if (!memberRef) {
      continue;
    }

    entries.push({
      roleField:
        key,

      memberRef,

      sense,
    });
  }

  return entries;
}


export function deriveCanonicalPredicateSenseSourceRoleProjectionsV1(
  snapshot:
    CanonicalPredicateSenseSourceSnapshotV1,
): CanonicalPredicateSenseSourceRoleProjectionResultV1 {
  const diagnostics =
    snapshotSafetyDiagnostics(
      snapshot,
    );

  if (
    diagnostics.length > 0
  ) {
    return {
      producer:
        CANONICAL_PREDICATE_SENSE_SOURCE_ROLE_ADAPTER_V1,

      producerVersion:
        CANONICAL_PREDICATE_SENSE_SOURCE_ROLE_ADAPTER_VERSION_V1,

      status:
        'blocked',

      projections:
        [],

      diagnostics,
    };
  }

  const projections:
    CanonicalPredicateSenseSourceRoleProjectionV1[] = [];

  for (
    const row of
      [
        ...(snapshot.candidates ??
          []),
      ].sort(
        (a, b) =>
          String(
            a.candidate_code ??
              '',
          ).localeCompare(
            String(
              b.candidate_code ??
                '',
            ),
          ),
      )
  ) {
    const candidate =
      runtimeConstructionCandidate(
        row,
      );

    if (!candidate) {
      continue;
    }

    for (
      const role of
        sourceRoleEntries(
          candidate.payload,
        )
    ) {
      const sourceSections =
        candidate.sourceSection
          ? [
              candidate.sourceSection,
            ]
          : [];

      projections.push({
        projectionId: [
          'predicate-sense-source-role',
          idPart(
            candidate.candidateCode,
          ),
          idPart(
            role.roleField,
          ),
          idPart(
            role.sense,
          ),
        ].join(':'),

        sourceCandidateId:
          candidate.candidateId,

        sourceCandidateCode:
          candidate.candidateCode,

        sourceSection:
          candidate.sourceSection,

        modelType:
          candidate.modelType,

        modelSubtype:
          candidate.modelSubtype,

        executionRole:
          candidate.executionRole,

        roleField:
          role.roleField,

        memberRef:
          role.memberRef,

        sense:
          role.sense,

        sourceCandidateCodes: [
          candidate.candidateCode,
        ],

        sourceSections,

        evidenceKind:
          'source_rule',

        projectionPolicy:
          'source_role_candidate_support_only',

        frozenGrammarReadOnly:
          true,
      });
    }
  }

  projections.sort(
    (a, b) =>
      a.projectionId.localeCompare(
        b.projectionId,
      ),
  );

  return {
    producer:
      CANONICAL_PREDICATE_SENSE_SOURCE_ROLE_ADAPTER_V1,

    producerVersion:
      CANONICAL_PREDICATE_SENSE_SOURCE_ROLE_ADAPTER_VERSION_V1,

    status:
      'ready',

    projections,

    diagnostics:
      [],
  };
}