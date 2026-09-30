import {
  type CanonicalRuntimeDependencyActionActivationSourceRowV1,
  readCanonicalRuntimeDependencyActionActivationSourceRowsV1,
} from "./canonical-runtime-dependency-action-activation-source-reader-v1.ts";

export const CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_PRODUCER_V1 =
  "canonical-runtime-dependency-action-activation-db-reader-v1" as const;

export const CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_VERSION_V1 =
  "1.0.0" as const;

export type CanonicalRuntimeDependencyActionActivationDbScopeV1 = {
  readonly manifestId: string;
  readonly dependencyActionAuthorityId: string;
};

export type CanonicalRuntimeDependencyActionActivationDbQueryResultV1 = {
  readonly data: readonly Record<string, unknown>[] | null;
  readonly error: unknown | null;
};

export type CanonicalRuntimeDependencyActionActivationDbClientV1 = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(
          column: string,
          value: string,
        ): PromiseLike<
          CanonicalRuntimeDependencyActionActivationDbQueryResultV1
        >;
      };
    };
  };
};

export type CanonicalRuntimeDependencyActionActivationDbReaderResultV1 =
  | {
    readonly producer:
      typeof CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_PRODUCER_V1;
    readonly producerVersion:
      typeof CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_VERSION_V1;
    readonly status: "ready";
    readonly scope: CanonicalRuntimeDependencyActionActivationDbScopeV1;
    readonly sourceRows:
      readonly CanonicalRuntimeDependencyActionActivationSourceRowV1[];
    readonly sourceResolution: ReturnType<
      typeof readCanonicalRuntimeDependencyActionActivationSourceRowsV1
    >;
    readonly blockingReasons: readonly [];
  }
  | {
    readonly producer:
      typeof CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_PRODUCER_V1;
    readonly producerVersion:
      typeof CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_VERSION_V1;
    readonly status: "blocked";
    readonly scope: CanonicalRuntimeDependencyActionActivationDbScopeV1;
    readonly sourceRows: readonly [];
    readonly sourceResolution: null;
    readonly blockingReasons: readonly string[];
  };

function asRequiredString(
  row: Record<string, unknown>,
  key: string,
): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mapExactRow(
  row: Record<string, unknown>,
): CanonicalRuntimeDependencyActionActivationSourceRowV1 | null {
  const authorityId = asRequiredString(row, "authority_id");
  const manifestId = asRequiredString(row, "manifest_id");
  const dependencyActionAuthorityId = asRequiredString(
    row,
    "dependency_action_authority_id",
  );
  const version = asRequiredString(row, "version");
  const decision = asRequiredString(row, "decision");
  const supersedes = row["supersedes_authority_id"];
  if (
    authorityId === null ||
    manifestId === null ||
    dependencyActionAuthorityId === null ||
    version === null ||
    decision === null
  ) {
    return null;
  }

  return {
    authority_id: authorityId,
    manifest_id: manifestId,
    dependency_action_authority_id: dependencyActionAuthorityId,
    version,
    decision,
    provenance: row["provenance"],
    supersedes_authority_id: supersedes,
  };
}

export async function readCanonicalRuntimeDependencyActionActivationFromDbV1(
  client: CanonicalRuntimeDependencyActionActivationDbClientV1,
  scope: CanonicalRuntimeDependencyActionActivationDbScopeV1,
): Promise<CanonicalRuntimeDependencyActionActivationDbReaderResultV1> {
  let result: CanonicalRuntimeDependencyActionActivationDbQueryResultV1;
  try {
    result = await client
      .from("canonical_dependency_action_activation_authority_v1")
      .select(
        "authority_id:id,manifest_id,dependency_action_authority_id,version,decision,provenance,supersedes_authority_id:supersedes",
      )
      .eq("manifest_id", scope.manifestId)
      .eq(
        "dependency_action_authority_id",
        scope.dependencyActionAuthorityId,
      );
  } catch {
    return {
      producer:
        CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_PRODUCER_V1,
      producerVersion:
        CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_VERSION_V1,
      status: "blocked",
      scope,
      sourceRows: [],
      sourceResolution: null,
      blockingReasons: ["activation_db_query_failed"],
    };
  }

  if (result.error !== null) {
    return {
      producer:
        CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_PRODUCER_V1,
      producerVersion:
        CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_VERSION_V1,
      status: "blocked",
      scope,
      sourceRows: [],
      sourceResolution: null,
      blockingReasons: ["activation_db_query_failed"],
    };
  }

  const rawRows = result.data ?? [];
  const sourceRows: CanonicalRuntimeDependencyActionActivationSourceRowV1[] =
    [];
  for (const rawRow of rawRows) {
    const mapped = mapExactRow(rawRow);
    if (mapped === null) {
      return {
        producer:
          CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_PRODUCER_V1,
        producerVersion:
          CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_VERSION_V1,
        status: "blocked",
        scope,
        sourceRows: [],
        sourceResolution: null,
        blockingReasons: ["activation_db_row_invalid"],
      };
    }
    if (
      mapped.manifest_id !== scope.manifestId ||
      mapped.dependency_action_authority_id !==
        scope.dependencyActionAuthorityId
    ) {
      return {
        producer:
          CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_PRODUCER_V1,
        producerVersion:
          CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_VERSION_V1,
        status: "blocked",
        scope,
        sourceRows: [],
        sourceResolution: null,
        blockingReasons: ["activation_db_scope_mismatch"],
      };
    }
    sourceRows.push(mapped);
  }

  return {
    producer:
      CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_PRODUCER_V1,
    producerVersion:
      CANONICAL_RUNTIME_DEPENDENCY_ACTION_ACTIVATION_DB_READER_VERSION_V1,
    status: "ready",
    scope,
    sourceRows,
    sourceResolution:
      readCanonicalRuntimeDependencyActionActivationSourceRowsV1(
        scope,
        sourceRows,
      ),
    blockingReasons: [],
  };
}
