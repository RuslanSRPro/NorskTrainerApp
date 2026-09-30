import {
  type CanonicalRuntimeDependencyActionActivationDbClientV1,
  type CanonicalRuntimeDependencyActionActivationDbQueryResultV1,
  readCanonicalRuntimeDependencyActionActivationFromDbV1,
} from "./canonical-runtime-dependency-action-activation-db-reader-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fakeClient(
  result: CanonicalRuntimeDependencyActionActivationDbQueryResultV1,
  observed: string[],
): CanonicalRuntimeDependencyActionActivationDbClientV1 {
  return {
    from(table: string) {
      observed.push(`from:${table}`);
      return {
        select(columns: string) {
          observed.push(`select:${columns}`);
          return {
            eq(column1: string, value1: string) {
              observed.push(`eq:${column1}:${value1}`);
              return {
                eq(column2: string, value2: string) {
                  observed.push(`eq:${column2}:${value2}`);
                  return Promise.resolve(result);
                },
              };
            },
          };
        },
      };
    },
  };
}

const scope = {
  manifestId: "manifest-1",
  dependencyActionAuthorityId: "dependency-action-1",
} as const;

Deno.test("A3.6D zero rows reach canonical source reader without inferred activation", async () => {
  const observed: string[] = [];
  const result = await readCanonicalRuntimeDependencyActionActivationFromDbV1(
    fakeClient({ data: [], error: null }, observed),
    scope,
  );
  assert(result.status === "ready", "zero-row query must be a ready DB read");
  assert(result.sourceRows.length === 0, "zero rows must stay zero rows");
  assert(result.sourceResolution !== null, "A2.3 must receive zero rows");
  assert(
    observed.filter((value) => value.startsWith("eq:")).length === 2,
    "query must use exactly two exact-scope filters",
  );
  assert(
    !observed.some((value) => /order|limit|is_active/i.test(value)),
    "DB reader must not infer current/activation",
  );
});

Deno.test("A3.6D exact rows are mapped losslessly and all rows reach A2.3", async () => {
  const observed: string[] = [];
  const rows = [
    {
      authority_id: "authority-1",
      manifest_id: "manifest-1",
      dependency_action_authority_id: "dependency-action-1",
      version: "v1",
      decision: "granted",
      provenance: { source: "author" },
      supersedes_authority_id: null,
    },
    {
      authority_id: "authority-2",
      manifest_id: "manifest-1",
      dependency_action_authority_id: "dependency-action-1",
      version: "v2",
      decision: "denied",
      provenance: { source: "author-2" },
      supersedes_authority_id: "authority-1",
    },
  ];
  const result = await readCanonicalRuntimeDependencyActionActivationFromDbV1(
    fakeClient({ data: rows, error: null }, observed),
    scope,
  );
  assert(result.status === "ready", "valid exact rows must be ready");
  assert(result.sourceRows.length === 2, "all exact rows must reach A2.3");
  assert(
    JSON.stringify(result.sourceRows) === JSON.stringify(rows),
    "row projection must be lossless",
  );
});

Deno.test("A3.6D DB errors fail closed", async () => {
  const result = await readCanonicalRuntimeDependencyActionActivationFromDbV1(
    fakeClient({ data: null, error: { message: "db failure" } }, []),
    scope,
  );
  assert(result.status === "blocked", "DB error must block");
  assert(result.sourceResolution === null, "DB error must not call A2.3");
});

Deno.test("A3.6D malformed or foreign rows fail closed", async () => {
  const malformed =
    await readCanonicalRuntimeDependencyActionActivationFromDbV1(
      fakeClient({
        data: [{
          authority_id: "authority-1",
          manifest_id: "manifest-1",
          dependency_action_authority_id: "dependency-action-1",
          version: "v1",
          decision: "maybe",
          provenance: {},
          supersedes_authority_id: null,
        }],
        error: null,
      }, []),
      scope,
    );
  assert(malformed.status === "ready", "DB transport read must remain ready");
  assert(
    malformed.sourceResolution.status === "unresolved_source_rows",
    "A2.3 must fail closed on invalid decision",
  );

  const foreign = await readCanonicalRuntimeDependencyActionActivationFromDbV1(
    fakeClient({
      data: [{
        authority_id: "authority-1",
        manifest_id: "foreign-manifest",
        dependency_action_authority_id: "dependency-action-1",
        version: "v1",
        decision: "granted",
        provenance: {},
        supersedes_authority_id: null,
      }],
      error: null,
    }, []),
    scope,
  );
  assert(foreign.status === "blocked", "foreign scope must block");
});
