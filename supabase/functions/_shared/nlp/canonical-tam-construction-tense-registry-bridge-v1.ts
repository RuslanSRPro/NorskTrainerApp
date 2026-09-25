import type {
  CanonicalTamConstructionRegistryBindingV1,
} from "./canonical-tam-construction-registry-binding-v1.ts";

import type {
  CanonicalGenericTenseConstructionCandidateV1,
} from "./canonical-generic-tense-construction-operator-v1.ts";

export const CANONICAL_TAM_CONSTRUCTION_TENSE_REGISTRY_BRIDGE_V1_PRODUCER =
  "canonical_tam_construction_tense_registry_bridge_v1" as const;

export const CANONICAL_TAM_CONSTRUCTION_TENSE_REGISTRY_BRIDGE_V1_VERSION =
  "1" as const;

export type CanonicalTamConstructionTenseRegistryBridgeCandidateV1 = {
  id: string;

  producer:
    typeof CANONICAL_TAM_CONSTRUCTION_TENSE_REGISTRY_BRIDGE_V1_PRODUCER;

  version:
    typeof CANONICAL_TAM_CONSTRUCTION_TENSE_REGISTRY_BRIDGE_V1_VERSION;

  status: "candidate";

  constructionId: string;
  projectionId: string;

  predicateId: string;

  registryAnchorTokenId: string;
  auxiliaryTokenId: string;
  participleTokenId: string;

  registryFormKey: string;
  canonicalFeatures: Record<string, string>;

  registrySourceId: string;

  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalTamConstructionTenseRegistryBridgeRejectionReasonV1 =
  | "invalid_tense_candidate"
  | "registry_binding_not_found"
  | "ambiguous_registry_binding"
  | "invalid_registry_binding"
  | "missing_provenance";

export type CanonicalTamConstructionTenseRegistryBridgeRejectionV1 = {
  constructionId: string;
  projectionId: string;
  predicateId: string;
  reason: CanonicalTamConstructionTenseRegistryBridgeRejectionReasonV1;
};

export type CanonicalTamConstructionTenseRegistryBridgeResultV1 = {
  candidates: CanonicalTamConstructionTenseRegistryBridgeCandidateV1[];
  rejections: CanonicalTamConstructionTenseRegistryBridgeRejectionV1[];
};

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(nonEmpty))];
}

function hasProvenance(values: readonly string[]): boolean {
  return unique(values).length > 0;
}

function validTenseCandidate(
  candidate: CanonicalGenericTenseConstructionCandidateV1,
): boolean {
  return (
    candidate.status === "candidate" &&
    nonEmpty(candidate.constructionId) &&
    nonEmpty(candidate.projectionId) &&
    nonEmpty(candidate.predicateId) &&
    nonEmpty(candidate.auxiliaryTokenId) &&
    nonEmpty(candidate.participleTokenId)
  );
}

function validRegistryBinding(
  binding: CanonicalTamConstructionRegistryBindingV1,
): boolean {
  return (
    binding.status === "candidate" &&
    nonEmpty(binding.constructionId) &&
    nonEmpty(binding.projectionId) &&
    nonEmpty(binding.anchorTokenId) &&
    nonEmpty(binding.registryFormKey) &&
    nonEmpty(binding.registrySourceId) &&
    binding.canonicalFeatures !== null &&
    typeof binding.canonicalFeatures === "object"
  );
}

/**
 * Structural post-binding composition only.
 *
 * Exact occurrence join:
 *   registryBinding.constructionId === tenseCandidate.constructionId
 *   registryBinding.projectionId   === tenseCandidate.projectionId
 *
 * Deliberately NOT required:
 *   registryBinding.anchorTokenId === tenseCandidate.auxiliaryTokenId
 *
 * A8.13.2 did not prove that equality as an independent cross-boundary
 * authority invariant. Both identities are therefore preserved separately.
 *
 * This boundary does not interpret registryFormKey or canonicalFeatures.
 */
export function bridgeCanonicalTamConstructionTenseRegistryV1(
  tenseCandidates: readonly CanonicalGenericTenseConstructionCandidateV1[],
  registryBindings: readonly CanonicalTamConstructionRegistryBindingV1[],
): CanonicalTamConstructionTenseRegistryBridgeResultV1 {
  const candidates:
    CanonicalTamConstructionTenseRegistryBridgeCandidateV1[] = [];

  const rejections:
    CanonicalTamConstructionTenseRegistryBridgeRejectionV1[] = [];

  for (const tenseCandidate of tenseCandidates) {
    if (!validTenseCandidate(tenseCandidate)) {
      rejections.push({
        constructionId: tenseCandidate.constructionId,
        projectionId: tenseCandidate.projectionId,
        predicateId: tenseCandidate.predicateId,
        reason: "invalid_tense_candidate",
      });
      continue;
    }

    const exactBindings = registryBindings.filter((binding) =>
      binding.constructionId === tenseCandidate.constructionId &&
      binding.projectionId === tenseCandidate.projectionId
    );

    if (exactBindings.length === 0) {
      rejections.push({
        constructionId: tenseCandidate.constructionId,
        projectionId: tenseCandidate.projectionId,
        predicateId: tenseCandidate.predicateId,
        reason: "registry_binding_not_found",
      });
      continue;
    }

    if (exactBindings.length !== 1) {
      rejections.push({
        constructionId: tenseCandidate.constructionId,
        projectionId: tenseCandidate.projectionId,
        predicateId: tenseCandidate.predicateId,
        reason: "ambiguous_registry_binding",
      });
      continue;
    }

    const binding = exactBindings[0];

    if (!validRegistryBinding(binding)) {
      rejections.push({
        constructionId: tenseCandidate.constructionId,
        projectionId: tenseCandidate.projectionId,
        predicateId: tenseCandidate.predicateId,
        reason: "invalid_registry_binding",
      });
      continue;
    }

    if (
      !hasProvenance(tenseCandidate.provenanceIds) ||
      !hasProvenance(binding.provenanceIds)
    ) {
      rejections.push({
        constructionId: tenseCandidate.constructionId,
        projectionId: tenseCandidate.projectionId,
        predicateId: tenseCandidate.predicateId,
        reason: "missing_provenance",
      });
      continue;
    }

    candidates.push({
      id:
        `tam-construction-tense-registry-bridge:` +
        `${tenseCandidate.constructionId}:` +
        `${tenseCandidate.projectionId}:` +
        `${tenseCandidate.predicateId}:` +
        `${binding.id}:` +
        `${tenseCandidate.id}`,

      producer:
        CANONICAL_TAM_CONSTRUCTION_TENSE_REGISTRY_BRIDGE_V1_PRODUCER,

      version:
        CANONICAL_TAM_CONSTRUCTION_TENSE_REGISTRY_BRIDGE_V1_VERSION,

      status: "candidate",

      constructionId: tenseCandidate.constructionId,
      projectionId: tenseCandidate.projectionId,

      predicateId: tenseCandidate.predicateId,

      registryAnchorTokenId: binding.anchorTokenId,
      auxiliaryTokenId: tenseCandidate.auxiliaryTokenId,
      participleTokenId: tenseCandidate.participleTokenId,

      registryFormKey: binding.registryFormKey,

      canonicalFeatures: {
        ...binding.canonicalFeatures,
      },

      registrySourceId: binding.registrySourceId,

      evidenceIds: unique([
        ...binding.evidenceIds,
        ...tenseCandidate.evidenceIds,
      ]),

      provenanceIds: unique([
        ...binding.provenanceIds,
        ...tenseCandidate.provenanceIds,
      ]),
    });
  }

  return { candidates, rejections };
}
