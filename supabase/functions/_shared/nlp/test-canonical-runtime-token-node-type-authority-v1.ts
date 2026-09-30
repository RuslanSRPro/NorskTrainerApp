import {
  CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_ID_V1,
  CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_PRODUCER_V1,
  CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_PRODUCER_VERSION_V1,
  deriveCanonicalRuntimeTokenNodeTypeAuthoritiesV1,
} from "./canonical-runtime-token-node-type-authority-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.6W derives the source-backed canonical token node type authority", () => {
  const authorities = deriveCanonicalRuntimeTokenNodeTypeAuthoritiesV1();

  assert(
    authorities.length === 1,
    "must derive exactly one supported node type",
  );
  const authority = authorities[0];
  assert(authority !== undefined, "token node type authority must exist");
  assert(
    authority.authorityId === CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_ID_V1,
    "authority id must preserve the existing regression fixture contract",
  );
  assert(authority.status === "proven", "token node type must be proven");
  assert(authority.nodeType === "token", "node type must be token");
  assert(
    authority.source ===
      CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_PRODUCER_V1,
    "source must be canonical language graph core",
  );
});

Deno.test("A3.6W does not silently claim other graph node types", () => {
  const authorities = deriveCanonicalRuntimeTokenNodeTypeAuthoritiesV1();
  assert(
    authorities.every((authority) => authority.nodeType === "token"),
    "this producer must only claim token",
  );
  assert(
    CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_PRODUCER_VERSION_V1 === "1.0.0",
    "producer version mismatch",
  );
});
