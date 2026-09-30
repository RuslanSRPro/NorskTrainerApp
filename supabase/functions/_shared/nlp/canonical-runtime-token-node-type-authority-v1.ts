import type {
  CanonicalRuntimeManifestGraphNodeTypeAuthorityV1,
} from "./canonical-runtime-manifest-binding-entity-compatibility-v1.ts";

export const CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_PRODUCER_V1 =
  "canonical_language_graph_core_v1" as const;
export const CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_PRODUCER_VERSION_V1 =
  "1.0.0" as const;
export const CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_ID_V1 =
  "canonical-node-type:token" as const;

export function deriveCanonicalRuntimeTokenNodeTypeAuthoritiesV1(): readonly CanonicalRuntimeManifestGraphNodeTypeAuthorityV1[] {
  return [{
    authorityId: CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_ID_V1,
    status: "proven",
    nodeType: "token",
    source: CANONICAL_RUNTIME_TOKEN_NODE_TYPE_AUTHORITY_PRODUCER_V1,
  }];
}
