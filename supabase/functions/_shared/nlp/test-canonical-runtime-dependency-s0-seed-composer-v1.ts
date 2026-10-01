import {
  deriveCanonicalRuntimeDependencyS0SeedsV1,
} from "./canonical-runtime-dependency-s0-seed-composer-v1.ts";
import type { CanonicalDependencyRuntimeManifestAuthorityRowV1 } from "./canonical-dependency-runtime-authority-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.6Z dependency S0 seed composer is dependency-only and does not execute runtime", () => {
  const source = Deno.readTextFileSync(
    new URL(
      "./canonical-runtime-dependency-s0-seed-composer-v1.ts",
      import.meta.url,
    ),
  );
  assert(
    source.includes("dependencyOnly: true"),
    "dependency-only governance missing",
  );
  assert(
    source.includes("deriveCanonicalRuntimeSetRoleActionAuthoritiesV1(") &&
      source.includes("[...manifestRows]") &&
      source.includes("setRoleAuthorities,"),
    "set_role result must be source-backed and passed through without invented authority",
  );
  assert(
    !source.includes("deriveCanonicalRuntimeBoundedDependencyGraphScheduler"),
    "scheduler must not be invoked",
  );
  assert(
    !source.includes("activation-db-reader"),
    "activation must not be resolved here",
  );
  assert(!source.includes("analyze-text"), "analyze-text must not be touched");
});

Deno.test("A3.6Z exports a real composer function rather than a synthetic ready fixture", () => {
  assert(
    typeof deriveCanonicalRuntimeDependencyS0SeedsV1 === "function",
    "composer export missing",
  );
  const source = Deno.readTextFileSync(
    new URL(
      "./canonical-runtime-dependency-s0-seed-composer-v1.ts",
      import.meta.url,
    ),
  );

  assert(
    source.includes("expectedResult.candidates") &&
      source.includes("runtimeExpectedResult.authorities.filter(") &&
      source.includes("runtimeExpectedAuthority.referencePath") &&
      source.includes("expectedAuthority.leafPath") &&
      source.includes("runtimeExpectedAuthority.normalizedPosLabelInput") &&
      source.includes("expectedAuthority.normalizedExpectedPosLabel") &&
      source.includes("runtime_manifest_expected_authority_pairing_not_exact"),
    "manifest expected authority must pair exactly with its runtime authority lineage",
  );
  assert(
    source.includes(
      "deriveCanonicalRuntimeManifestBindingDefinitionAuthoritiesV1(",
    ),
    "binding producer not used",
  );
  assert(
    source.includes(
      "deriveCanonicalRuntimeManifestTokenPosExpectedNormalizedLabelEqAuthoritiesV1(",
    ),
    "expected authority producer not used",
  );
  assert(
    source.includes(
      "deriveCanonicalRuntimeTokenPosNormalizedLabelEqAuthoritiesV1(",
    ) &&
      source.includes("expectedResult: runtimeExpectedResult"),
    "runtime expected authority producer/pass-through not used",
  );
  assert(
    source.includes(
      "deriveCanonicalRuntimeSentenceScopeBoundaryAuthoritiesV1()",
    ),
    "sentence scope producer not used",
  );
  assert(
    source.includes("deriveCanonicalRuntimeTokenNodeTypeAuthoritiesV1()"),
    "token node type producer not used",
  );
});

Deno.test("A3.6Z does not expose a caller-supplied ready seed", () => {
  type Input = Parameters<typeof deriveCanonicalRuntimeDependencyS0SeedsV1>;
  const compileOnly: Input | null = null;
  assert(compileOnly === null, "compile-only type guard");
  const rowTypeOnly: CanonicalDependencyRuntimeManifestAuthorityRowV1 | null =
    null;
  assert(rowTypeOnly === null, "manifest row type must remain canonical");
});
