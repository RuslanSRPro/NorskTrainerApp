import type {
  CanonicalDependencyRuntimeManifestAuthorityRowV1,
} from "./canonical-dependency-runtime-authority-v1.ts";

export const CANONICAL_DEPENDENCY_RUNTIME_MANIFEST_SOURCE_READER_V1 =
  "canonical_dependency_runtime_manifest_source_reader_v1";

export const CANONICAL_DEPENDENCY_RUNTIME_MANIFEST_SOURCE_TABLE_V1 =
  "grammar_runtime_manifests";

export const CANONICAL_DEPENDENCY_RUNTIME_MANIFEST_SOURCE_COLUMNS_V1 = [
  "id",
  "code",
  "authoring_status",
  "runtime_family",
  "execution_phase",
  "constraint_strength",
  "actions",
  "ir_spec",
] as const;

type SourceQueryResult = {
  data: unknown[] | null;
  error: {
    message?: unknown;
  } | null;
};

type SourceQuery = PromiseLike<SourceQueryResult>;

export type CanonicalDependencyRuntimeManifestSourceClientV1 = {
  from(
    table: string,
  ): {
    select(
      columns: string,
    ): SourceQuery;
  };
};

export async function readCanonicalDependencyRuntimeManifestAuthorityRowsV1(
  supabase: CanonicalDependencyRuntimeManifestSourceClientV1,
): Promise<CanonicalDependencyRuntimeManifestAuthorityRowV1[]> {
  const { data, error } = await supabase
    .from(CANONICAL_DEPENDENCY_RUNTIME_MANIFEST_SOURCE_TABLE_V1)
    .select(CANONICAL_DEPENDENCY_RUNTIME_MANIFEST_SOURCE_COLUMNS_V1.join(","));

  if (error) {
    const message = typeof error.message === "string" && error.message.trim()
      ? error.message.trim()
      : "unknown";

    throw new Error(
      `canonical_dependency_runtime_manifest_source_reader_v1:${message}`,
    );
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return {};
    }

    const source = row as Record<string, unknown>;

    return {
      id: source.id,
      code: source.code,
      authoring_status: source.authoring_status,
      runtime_family: source.runtime_family,
      execution_phase: source.execution_phase,
      constraint_strength: source.constraint_strength,
      actions: source.actions,
      ir_spec: source.ir_spec,
    };
  });
}
