import {
  CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_V1,
  CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_VERSION_V1,
  deriveCanonicalRuntimeMultiSiteS0InitialEpochAggregationBoundaryV1,
} from "./canonical-runtime-multi-site-s0-initial-epoch-aggregation-boundary-v1.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("A3.6Q multi-site S0 aggregation fails closed on empty token site domain", async () => {
  const result =
    await deriveCanonicalRuntimeMultiSiteS0InitialEpochAggregationBoundaryV1({
      seed: {} as never,
      tokenNodeIds: [],
    });

  assert(result.status === "blocked", "empty token site domain must block");
  assert(result.stage === "site_domain", "must block at site_domain");
  assert(
    result.blockingReasons.includes("token_node_ids:empty"),
    "must expose empty-domain reason",
  );
  assert(
    result.governance.tokenWinnerSelected === false,
    "must not select token winner",
  );
});

Deno.test("A3.6Q multi-site S0 aggregation fails closed on duplicate token IDs before evaluation", async () => {
  const result =
    await deriveCanonicalRuntimeMultiSiteS0InitialEpochAggregationBoundaryV1({
      seed: {} as never,
      tokenNodeIds: ["token:a", "token:a"],
    });

  assert(result.status === "blocked", "duplicate token IDs must block");
  assert(result.stage === "site_domain", "must block at site_domain");
  assert(
    result.blockingReasons.includes("token_node_id:duplicate:token:a"),
    "must expose duplicate token ID",
  );
});

Deno.test("A3.6Q boundary identity is stable and does not claim scheduler or activation", () => {
  assert(
    CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_V1 ===
      "a3.6q:canonical-runtime-multi-site-s0-initial-epoch-aggregation-boundary-v1",
    "producer ID mismatch",
  );
  assert(
    CANONICAL_RUNTIME_MULTI_SITE_S0_INITIAL_EPOCH_AGGREGATION_BOUNDARY_VERSION_V1 ===
      "1.0.0",
    "producer version mismatch",
  );
});
