/**
 * Norsk Trainer
 *
 * V1.46 A4.3a1
 *
 * FAMILY-NEUTRAL RUNTIME MANIFEST BINDING DEFINITION AUTHORITY
 *
 * Purpose:
 *
 *   exact validated Runtime manifest
 *       +
 *   exact manifest-local ir_spec.bindings snapshot
 *       ->
 *   opaque binding-definition authorities
 *
 * This capability is deliberately action-family neutral.
 *
 * It does NOT require:
 *
 * - create_dependency authority;
 * - create_clause authority;
 * - set_role authority;
 * - dependency semantics;
 * - clause semantics;
 * - role semantics.
 *
 * It preserves binding structure only.
 *
 * It does NOT:
 *
 * - execute entity;
 * - execute scope;
 * - execute cardinality;
 * - execute where;
 * - interpret reference expressions;
 * - enumerate graph occurrences;
 * - bind occurrences;
 * - select a winner;
 * - mutate the Canonical Graph;
 * - classify learner error.
 *
 * All Runtime labels remain opaque.
 * Candidate != resolved.
 * Validated != activated.
 * Frozen grammar remains read-only.
 */

type JsonRecord = Record<string, unknown>;

export const CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1 =
  "canonical_runtime_manifest_binding_definition_authority_v1";

export const CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1 =
  "1";

export type CanonicalRuntimeManifestBindingDefinitionAuthorityV1 = {
  id: string;

  status: "candidate";

  manifestId: string;

  manifestCode: string;

  runtimeFamilyLabel: string | null;

  executionPhaseLabel: string | null;

  bindingName: string;

  bindingDefinition: JsonRecord;

  entityLabel: string | null;

  scopeLabel: string | null;

  cardinalityLabel: string | null;

  whereClause: JsonRecord | null;

  rawManifestSnapshot: JsonRecord;

  governance: {
    exactValidatedManifestRequired: true;

    exactManifestIdentityRequired: true;

    manifestLocalBindingsOnly: true;

    actionAuthorityRequired: false;

    actionFamilySemanticsResolved: false;

    runtimeFamilyLabelPreservedOpaque: true;

    executionPhaseLabelPreservedOpaque: true;

    runtimeFamilySemanticsResolved: false;

    executionPhaseSemanticsResolved: false;

    bindingNamePreservedOpaque: true;

    bindingDefinitionPreservedOpaque: true;

    entityLabelPreservedOpaque: true;

    scopeLabelPreservedOpaque: true;

    cardinalityLabelPreservedOpaque: true;

    whereClausePreservedOpaque: true;

    entitySemanticsResolved: false;

    scopeSemanticsResolved: false;

    cardinalitySemanticsResolved: false;

    whereSemanticsResolved: false;

    referenceSemanticsResolved: false;

    occurrenceEnumerationPerformed: false;

    occurrenceBindingPerformed: false;

    winnerSelected: false;

    graphMutationPerformed: false;

    productionActivationAssumed: false;

    learnerErrorClassified: false;

    candidateOnly: true;

    frozenGrammarReadOnly: true;
  };
};

export type CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1 = {
  producer: typeof CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1;

  producerVersion:
    typeof CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1;

  status:
    | "ready"
    | "blocked";

  authorities: CanonicalRuntimeManifestBindingDefinitionAuthorityV1[];

  manifestsWithoutBindings: string[];

  ignoredUnvalidatedManifestCodes: string[];

  blockingReasons: string[];
};

function recordValue(
  value: unknown,
): JsonRecord | null {
  return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    )
    ? value as JsonRecord
    : null;
}

function stringValue(
  value: unknown,
): string | null {
  if (
    typeof value !==
      "string" ||
    value.trim().length ===
      0
  ) {
    return null;
  }

  // Validation may inspect whitespace, but the exact source label is returned.
  return value;
}

function cloneValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      cloneValue,
    );
  }

  const record = recordValue(value);

  if (record) {
    const out: JsonRecord = {};

    for (
      const key of Object.keys(record)
    ) {
      out[key] = cloneValue(
        record[key],
      );
    }

    return out;
  }

  return value;
}

function cloneRecord(
  value: JsonRecord,
): JsonRecord {
  return cloneValue(
    value,
  ) as JsonRecord;
}

function idPart(
  value: string,
): string {
  return encodeURIComponent(
    value,
  );
}

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [
    ...new Set(values),
  ].sort();
}

function governance(): CanonicalRuntimeManifestBindingDefinitionAuthorityV1[
  "governance"
] {
  return {
    exactValidatedManifestRequired: true,

    exactManifestIdentityRequired: true,

    manifestLocalBindingsOnly: true,

    actionAuthorityRequired: false,

    actionFamilySemanticsResolved: false,

    runtimeFamilyLabelPreservedOpaque: true,

    executionPhaseLabelPreservedOpaque: true,

    runtimeFamilySemanticsResolved: false,

    executionPhaseSemanticsResolved: false,

    bindingNamePreservedOpaque: true,

    bindingDefinitionPreservedOpaque: true,

    entityLabelPreservedOpaque: true,

    scopeLabelPreservedOpaque: true,

    cardinalityLabelPreservedOpaque: true,

    whereClausePreservedOpaque: true,

    entitySemanticsResolved: false,

    scopeSemanticsResolved: false,

    cardinalitySemanticsResolved: false,

    whereSemanticsResolved: false,

    referenceSemanticsResolved: false,

    occurrenceEnumerationPerformed: false,

    occurrenceBindingPerformed: false,

    winnerSelected: false,

    graphMutationPerformed: false,

    productionActivationAssumed: false,

    learnerErrorClassified: false,

    candidateOnly: true,

    frozenGrammarReadOnly: true,
  };
}

export function deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(
  rows: readonly unknown[],
): CanonicalRuntimeManifestBindingDefinitionAuthorityResultV1 {
  const blockingReasons: string[] = [];

  const authorities: CanonicalRuntimeManifestBindingDefinitionAuthorityV1[] =
    [];

  const manifestsWithoutBindings: string[] = [];

  const ignoredUnvalidatedManifestCodes: string[] = [];

  const seenManifestIdentities = new Set<string>();

  for (
    let rowIndex = 0;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = recordValue(
      rows[rowIndex],
    );

    if (!row) {
      blockingReasons.push(
        `row:${rowIndex}:manifest_not_object`,
      );

      continue;
    }

    const manifestId = stringValue(
      row.id,
    );

    const manifestCode = stringValue(
      row.code,
    );

    if (
      !manifestId ||
      !manifestCode
    ) {
      blockingReasons.push(
        `row:${rowIndex}:manifest_identity_missing`,
      );

      continue;
    }

    const identity = `${manifestId}\u0000${manifestCode}`;

    if (
      seenManifestIdentities.has(
        identity,
      )
    ) {
      blockingReasons.push(
        `manifest:${manifestCode}:duplicate_exact_identity`,
      );

      continue;
    }

    seenManifestIdentities.add(
      identity,
    );

    if (
      stringValue(
        row.authoring_status,
      ) !==
        "validated"
    ) {
      ignoredUnvalidatedManifestCodes.push(
        manifestCode,
      );

      continue;
    }

    const irSpecValue = row.ir_spec;

    if (
      irSpecValue !==
        undefined &&
      irSpecValue !==
        null &&
      !recordValue(
        irSpecValue,
      )
    ) {
      blockingReasons.push(
        `manifest:${manifestCode}:ir_spec_not_object`,
      );

      continue;
    }

    const irSpec = recordValue(
      irSpecValue,
    );

    const bindingsValue = irSpec?.bindings;

    if (
      bindingsValue ===
        undefined ||
      bindingsValue ===
        null
    ) {
      manifestsWithoutBindings.push(
        manifestCode,
      );

      continue;
    }

    const bindings = recordValue(
      bindingsValue,
    );

    if (!bindings) {
      blockingReasons.push(
        `manifest:${manifestCode}:bindings_not_object`,
      );

      continue;
    }

    const bindingNames = Object.keys(
      bindings,
    ).sort();

    if (
      bindingNames.length ===
        0
    ) {
      manifestsWithoutBindings.push(
        manifestCode,
      );

      continue;
    }

    const runtimeFamilyLabel = stringValue(
      row.runtime_family,
    );

    const executionPhaseLabel = stringValue(
      row.execution_phase,
    );

    for (
      const bindingName of bindingNames
    ) {
      if (
        bindingName.trim().length ===
          0
      ) {
        blockingReasons.push(
          `manifest:${manifestCode}:binding_name_empty`,
        );

        continue;
      }

      const definition = recordValue(
        bindings[
          bindingName
        ],
      );

      if (!definition) {
        blockingReasons.push(
          `manifest:${manifestCode}:binding:${bindingName}:definition_not_object`,
        );

        continue;
      }

      const whereValue = definition.where;

      let whereClause: JsonRecord | null = null;

      if (
        whereValue !==
          undefined &&
        whereValue !==
          null
      ) {
        const whereRecord = recordValue(
          whereValue,
        );

        if (!whereRecord) {
          blockingReasons.push(
            `manifest:${manifestCode}:binding:${bindingName}:where_not_object`,
          );

          continue;
        }

        whereClause = cloneRecord(
          whereRecord,
        );
      }

      authorities.push({
        id: [
          "runtime-manifest-binding-definition-v1",
          idPart(
            manifestId,
          ),
          idPart(
            manifestCode,
          ),
          idPart(
            bindingName,
          ),
        ].join(":"),

        status: "candidate",

        manifestId,

        manifestCode,

        runtimeFamilyLabel,

        executionPhaseLabel,

        bindingName,

        bindingDefinition: cloneRecord(
          definition,
        ),

        entityLabel: stringValue(
          definition.entity,
        ),

        scopeLabel: stringValue(
          definition.scope,
        ),

        cardinalityLabel: stringValue(
          definition.cardinality,
        ),

        whereClause,

        rawManifestSnapshot: cloneRecord(
          row,
        ),

        governance: governance(),
      });
    }
  }

  const reasons = uniqueSorted(
    blockingReasons,
  );

  if (
    reasons.length >
      0
  ) {
    return {
      producer: CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1,

      producerVersion:
        CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1,

      status: "blocked",

      authorities: [],

      manifestsWithoutBindings: uniqueSorted(
        manifestsWithoutBindings,
      ),

      ignoredUnvalidatedManifestCodes: uniqueSorted(
        ignoredUnvalidatedManifestCodes,
      ),

      blockingReasons: reasons,
    };
  }

  return {
    producer: CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_V1,

    producerVersion:
      CANONICAL_RUNTIME_MANIFEST_BINDING_DEFINITION_AUTHORITY_VERSION_V1,

    status: "ready",

    authorities: authorities.sort(
      (a, b) =>
        a.id.localeCompare(
          b.id,
        ),
    ),

    manifestsWithoutBindings: uniqueSorted(
      manifestsWithoutBindings,
    ),

    ignoredUnvalidatedManifestCodes: uniqueSorted(
      ignoredUnvalidatedManifestCodes,
    ),

    blockingReasons: [],
  };
}
