// Norsk Trainer — Canonical Predicate Sense Role Ontology V1
//
// v1.44 Wave B A2.4
//
// Purpose:
//
//   generic construction source roles
//        +
//   frozen semantic verb-role definitions
//        ↓
//   only semantically licensed predicate-sense roles
//
// This prevents structural roles such as:
//
//   finite_verb
//   head
//   complement
//
// from becoming predicate senses merely because a field ends in "_role".
//
// IMPORTANT:
// - semantic definitions are reference knowledge;
// - they are NOT promoted to executable grammar rules;
// - they only define the admissible ontology vocabulary;
// - occurrence evidence must still come from runtime structure;
// - candidate != resolved.
//
// No role names are hardcoded in this file.

import type {
  CanonicalPredicateSenseSourceRoleProjectionV1,
} from './canonical-predicate-sense-source-role-adapter-v1.ts';


type J = Record<string, unknown>;


export const CANONICAL_PREDICATE_SENSE_ROLE_ONTOLOGY_V1 =
  'canonical_predicate_sense_role_ontology_v1';

export const CANONICAL_PREDICATE_SENSE_ROLE_ONTOLOGY_VERSION_V1 =
  '1';


export type CanonicalPredicateSenseRoleDefinitionSnapshotRowV1 = {
  candidate_id?: string | null;
  candidate_code?: string | null;

  status?: string | null;

  requires_human_verification?: boolean | null;

  source_section?: string | null;

  extracted_payload?: J | null;
  digital_model?: J | null;
  execution_contract?: J | null;
};


export type CanonicalPredicateSenseRoleOntologySnapshotV1 = {
  read_only?: boolean | null;

  write_performed?: boolean | null;

  frozen_grammar_immutable?: boolean | null;

  reference_facts?:
    readonly CanonicalPredicateSenseRoleDefinitionSnapshotRowV1[] |
    null;
};


export type CanonicalPredicateSenseRoleDefinitionV1 = {
  role: string;

  meaningType?: string;

  sourceCandidateId?: string;
  sourceCandidateCode: string;

  sourceSection?: string;

  modelType: 'semantic_definition';

  executionRole:
    'semantic_reference';

  disposition:
    'KEEP_REFERENCE_ONLY';

  runtimeExecutable:
    false;

  ontologyOnly:
    true;

  frozenGrammarReadOnly:
    true;
};


export type CanonicalPredicateSenseRoleOntologyResultV1 = {
  producer:
    typeof CANONICAL_PREDICATE_SENSE_ROLE_ONTOLOGY_V1;

  producerVersion:
    typeof CANONICAL_PREDICATE_SENSE_ROLE_ONTOLOGY_VERSION_V1;

  status:
    | 'ready'
    | 'blocked';

  roles:
    CanonicalPredicateSenseRoleDefinitionV1[];

  diagnostics:
    Array<{
      code: string;
      candidateCode?: string;
    }>;
};


export type CanonicalPredicateSenseRoleProjectionFilterResultV1 = {
  accepted:
    CanonicalPredicateSenseSourceRoleProjectionV1[];

  rejected:
    Array<{
      projectionId: string;
      role: string;
      reason:
        'role_not_in_frozen_semantic_ontology';
    }>;
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
  if (
    typeof value !==
      'string'
  ) {
    return undefined;
  }

  const trimmed =
    value.trim();

  return trimmed || undefined;
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
    const object =
      objectValue(
        current,
      );

    if (!object) {
      return undefined;
    }

    current =
      object[key];
  }

  return stringValue(
    current,
  );
}


function unique<T>(
  values:
    readonly T[],
): T[] {
  return [
    ...new Set(values),
  ];
}


function safetyDiagnostics(
  snapshot:
    CanonicalPredicateSenseRoleOntologySnapshotV1,
): Array<{
  code: string;
}> {
  const out:
    Array<{
      code: string;
    }> = [];

  if (
    snapshot.read_only !== true
  ) {
    out.push({
      code:
        'snapshot_not_read_only',
    });
  }

  if (
    snapshot.write_performed !== false
  ) {
    out.push({
      code:
        'snapshot_write_state_not_safe',
    });
  }

  if (
    snapshot.frozen_grammar_immutable !== true
  ) {
    out.push({
      code:
        'frozen_grammar_immutability_not_proven',
    });
  }

  return out;
}


function roleDefinition(
  row:
    CanonicalPredicateSenseRoleDefinitionSnapshotRowV1,
): CanonicalPredicateSenseRoleDefinitionV1 | undefined {
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

  const candidateCode =
    stringValue(
      row.candidate_code,
    );

  if (!candidateCode) {
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
      'semantic_definition'
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
      'KEEP_REFERENCE_ONLY'
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
      'semantic_reference'
  ) {
    return undefined;
  }

  const targetLayers =
    objectValue(
      objectValue(
        row.execution_contract,
      )?.placement,
    )?.target_layers;

  if (
    !Array.isArray(
      targetLayers,
    ) ||
    !targetLayers
      .map(stringValue)
      .includes(
        'grammar_reference',
      )
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

  const role =
    stringValue(
      payload.verb_role,
    );

  if (!role) {
    return undefined;
  }

  return {
    role,

    meaningType:
      stringValue(
        payload.meaning_type,
      ),

    sourceCandidateId:
      stringValue(
        row.candidate_id,
      ),

    sourceCandidateCode:
      candidateCode,

    sourceSection:
      stringValue(
        row.source_section,
      ),

    modelType:
      'semantic_definition',

    executionRole:
      'semantic_reference',

    disposition:
      'KEEP_REFERENCE_ONLY',

    runtimeExecutable:
      false,

    ontologyOnly:
      true,

    frozenGrammarReadOnly:
      true,
  };
}


export function deriveCanonicalPredicateSenseRoleOntologyV1(
  snapshot:
    CanonicalPredicateSenseRoleOntologySnapshotV1,
): CanonicalPredicateSenseRoleOntologyResultV1 {
  const diagnostics =
    safetyDiagnostics(
      snapshot,
    );

  if (
    diagnostics.length > 0
  ) {
    return {
      producer:
        CANONICAL_PREDICATE_SENSE_ROLE_ONTOLOGY_V1,

      producerVersion:
        CANONICAL_PREDICATE_SENSE_ROLE_ONTOLOGY_VERSION_V1,

      status:
        'blocked',

      roles:
        [],

      diagnostics,
    };
  }

  const byRole =
    new Map<
      string,
      CanonicalPredicateSenseRoleDefinitionV1
    >();

  for (
    const row of
      snapshot.reference_facts ??
      []
  ) {
    const definition =
      roleDefinition(
        row,
      );

    if (!definition) {
      continue;
    }

    // If multiple reference facts define the same role, keep the
    // deterministic first source identity. This is ontology vocabulary,
    // not evidence weighting.
    if (
      !byRole.has(
        definition.role,
      )
    ) {
      byRole.set(
        definition.role,
        definition,
      );
    }
  }

  const roles =
    [...byRole.values()]
      .sort(
        (a, b) =>
          a.role.localeCompare(
            b.role,
          ),
      );

  return {
    producer:
      CANONICAL_PREDICATE_SENSE_ROLE_ONTOLOGY_V1,

    producerVersion:
      CANONICAL_PREDICATE_SENSE_ROLE_ONTOLOGY_VERSION_V1,

    status:
      'ready',

    roles,

    diagnostics:
      [],
  };
}


export function filterCanonicalPredicateSenseSourceRolesByOntologyV1(
  projections:
    readonly CanonicalPredicateSenseSourceRoleProjectionV1[],

  ontology:
    readonly CanonicalPredicateSenseRoleDefinitionV1[],
): CanonicalPredicateSenseRoleProjectionFilterResultV1 {
  const allowed =
    new Set(
      ontology.map(
        (definition) =>
          definition.role,
      ),
    );

  const accepted:
    CanonicalPredicateSenseSourceRoleProjectionV1[] = [];

  const rejected:
    CanonicalPredicateSenseRoleProjectionFilterResultV1[
      'rejected'
    ] = [];

  for (
    const projection of
      [...projections]
        .sort(
          (a, b) =>
            a.projectionId
              .localeCompare(
                b.projectionId,
              ),
        )
  ) {
    if (
      allowed.has(
        projection.sense,
      )
    ) {
      accepted.push(
        projection,
      );

      continue;
    }

    rejected.push({
      projectionId:
        projection.projectionId,

      role:
        projection.sense,

      reason:
        'role_not_in_frozen_semantic_ontology',
    });
  }

  return {
    accepted,

    rejected,
  };
}