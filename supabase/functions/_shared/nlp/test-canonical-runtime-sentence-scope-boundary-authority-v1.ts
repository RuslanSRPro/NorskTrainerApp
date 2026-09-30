import {
  CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_ID_V1,
  CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_PRODUCER_V1,
  CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_PRODUCER_VERSION_V1,
  deriveCanonicalRuntimeSentenceScopeBoundaryAuthoritiesV1,
} from "./canonical-runtime-sentence-scope-boundary-authority-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.6U derives the source-backed sentence scope boundary authority", () => {
  const authorities =
    deriveCanonicalRuntimeSentenceScopeBoundaryAuthoritiesV1();

  assert(
    authorities.length === 1,
    "must derive exactly one supported boundary",
  );
  const authority = authorities[0];
  assert(authority !== undefined, "sentence authority must exist");
  assert(
    authority.authorityId ===
      CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_ID_V1,
    "authority id must preserve the existing source-backed fixture contract",
  );
  assert(authority.boundaryLabel === "sentence", "boundary must be sentence");
  assert(authority.status === "proven", "sentence boundary must be proven");
  assert(
    authority.source ===
      CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_PRODUCER_V1,
    "source must preserve canonical sentence scope capability",
  );
});

Deno.test("A3.6U does not silently claim unsupported scope boundaries", () => {
  const authorities =
    deriveCanonicalRuntimeSentenceScopeBoundaryAuthoritiesV1();
  assert(
    authorities.every((authority) => authority.boundaryLabel === "sentence"),
    "only sentence scope is source-backed by this producer",
  );
  assert(
    CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_PRODUCER_VERSION_V1 ===
      "1.0.0",
    "producer version mismatch",
  );
});
