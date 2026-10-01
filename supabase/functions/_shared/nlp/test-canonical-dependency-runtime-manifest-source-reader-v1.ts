import {
  CANONICAL_DEPENDENCY_RUNTIME_MANIFEST_SOURCE_COLUMNS_V1,
  CANONICAL_DEPENDENCY_RUNTIME_MANIFEST_SOURCE_TABLE_V1,
  readCanonicalDependencyRuntimeManifestAuthorityRowsV1,
} from "./canonical-dependency-runtime-manifest-source-reader-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("A3.7F manifest source reader is lossless transport without semantic filtering", async () => {
  const calls: Array<{ table?: string; columns?: string }> = [];
  const sourceRows = [
    {
      id: "manifest-1",
      code: "ir.example.one",
      authoring_status: "validated",
      runtime_family: "structural",
      execution_phase: "analysis",
      constraint_strength: "strong",
      actions: [{ action: "create_dependency", relation: "opaque" }],
      ir_spec: { source: { primary_candidate_code: "candidate-1" } },
      ignored_column: "must_not_be_projected",
    },
    {
      id: "manifest-2",
      code: "ir.example.two",
      authoring_status: "draft",
      runtime_family: "structural",
      execution_phase: "analysis",
      constraint_strength: null,
      actions: [{ action: "set_role" }],
      ir_spec: { source: { supporting_candidate_codes: ["candidate-2"] } },
      ignored_column: "must_not_be_projected",
    },
  ];

  const client = {
    from(table: string) {
      calls.push({ table });

      return {
        select(columns: string) {
          calls[calls.length - 1].columns = columns;

          return Promise.resolve({
            data: sourceRows,
            error: null,
          });
        },
      };
    },
  };

  const rows = await readCanonicalDependencyRuntimeManifestAuthorityRowsV1(
    client,
  );

  assert(calls.length === 1, "reader must issue exactly one table read");
  assert(
    calls[0].table === CANONICAL_DEPENDENCY_RUNTIME_MANIFEST_SOURCE_TABLE_V1,
    "reader must use the canonical manifest source table",
  );
  assert(
    calls[0].columns ===
      CANONICAL_DEPENDENCY_RUNTIME_MANIFEST_SOURCE_COLUMNS_V1.join(","),
    "reader must project exactly the authority row contract columns",
  );
  assert(
    rows.length === 2,
    "reader must not filter draft/validated or action families",
  );
  assert(
    rows[0].authoring_status === "validated" &&
      rows[1].authoring_status === "draft",
    "authoring status must be preserved for the authority producer",
  );
  assert(
    rows[0].actions === sourceRows[0].actions &&
      rows[1].ir_spec === sourceRows[1].ir_spec,
    "JSON authority inputs must be preserved without interpretation",
  );
  assert(
    !("ignored_column" in rows[0]),
    "reader must expose only the canonical authority row contract",
  );
});

Deno.test("A3.7F manifest source reader fails closed on database errors", async () => {
  const client = {
    from(_table: string) {
      return {
        select(_columns: string) {
          return Promise.resolve({
            data: null,
            error: { message: "db unavailable" },
          });
        },
      };
    },
  };

  let thrown = "";

  try {
    await readCanonicalDependencyRuntimeManifestAuthorityRowsV1(client);
  } catch (error) {
    thrown = error instanceof Error ? error.message : String(error);
  }

  assert(
    thrown ===
      "canonical_dependency_runtime_manifest_source_reader_v1:db unavailable",
    "database error must fail closed with reader provenance",
  );
});
