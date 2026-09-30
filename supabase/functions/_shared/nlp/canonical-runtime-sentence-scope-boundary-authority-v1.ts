import type {
  CanonicalRuntimeManifestScopeBoundaryAuthorityV1,
} from "./canonical-runtime-manifest-binding-scope-compatibility-v1.ts";

export const CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_PRODUCER_V1 =
  "canonical_sentence_scope_boundary_capability_v1" as const;
export const CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_PRODUCER_VERSION_V1 =
  "1.0.0" as const;
export const CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_ID_V1 =
  "boundary:sentence" as const;

export function deriveCanonicalRuntimeSentenceScopeBoundaryAuthoritiesV1(): readonly CanonicalRuntimeManifestScopeBoundaryAuthorityV1[] {
  return [{
    authorityId: CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_ID_V1,
    boundaryLabel: "sentence",
    status: "proven",
    source: CANONICAL_RUNTIME_SENTENCE_SCOPE_BOUNDARY_AUTHORITY_PRODUCER_V1,
  }];
}
