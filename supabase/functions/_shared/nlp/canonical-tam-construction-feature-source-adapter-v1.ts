import type {
  CanonicalTamConstructionTenseRegistryBridgeCandidateV1,
} from "./canonical-tam-construction-tense-registry-bridge-v1.ts";

import type {
  CanonicalTamSourceFactV1,
} from "./canonical-tam-source-mapping-v1.ts";

export const CANONICAL_TAM_CONSTRUCTION_FEATURE_SOURCE_ADAPTER_V1_PRODUCER =
  "canonical_tam_construction_feature_source_adapter_v1" as const;

export const CANONICAL_TAM_CONSTRUCTION_FEATURE_SOURCE_ADAPTER_V1_VERSION =
  "1" as const;

export type CanonicalTamConstructionFeatureSourceRequestV1 = {
  bridgeCandidateId: string;
  sourceKey: string;
};

export type CanonicalTamConstructionFeatureSourceRejectionReasonV1 =
  | "invalid_request"
  | "bridge_candidate_not_found"
  | "ambiguous_bridge_candidate"
  | "invalid_bridge_candidate"
  | "feature_not_found"
  | "feature_value_not_string"
  | "feature_value_empty"
  | "missing_provenance";

export type CanonicalTamConstructionFeatureSourceRejectionV1 = {
  bridgeCandidateId: string;
  sourceKey: string;
  reason: CanonicalTamConstructionFeatureSourceRejectionReasonV1;
};

export type CanonicalTamConstructionFeatureSourceResultV1 = {
  sourceFacts: CanonicalTamSourceFactV1[];
  rejections: CanonicalTamConstructionFeatureSourceRejectionV1[];
};

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(nonEmpty))];
}

function validBridgeCandidate(
  candidate: CanonicalTamConstructionTenseRegistryBridgeCandidateV1,
): boolean {
  return (
    candidate.status === "candidate" &&
    nonEmpty(candidate.id) &&
    nonEmpty(candidate.constructionId) &&
    nonEmpty(candidate.projectionId) &&
    nonEmpty(candidate.predicateId) &&
    nonEmpty(candidate.auxiliaryTokenId) &&
    nonEmpty(candidate.registrySourceId) &&
    candidate.canonicalFeatures !== null &&
    typeof candidate.canonicalFeatures === "object"
  );
}

/**
 * Structural extraction only.
 *
 * The caller supplies an exact sourceKey. This adapter:
 *
 *   1. finds one exact A8.13.3 bridge candidate by id,
 *   2. reads canonicalFeatures[sourceKey] exactly,
 *   3. requires the value to be a non-empty string,
 *   4. emits the real A2 CanonicalTamSourceFactV1 shape.
 *
 * A8.14.2.1 proved that A8.13.3 auxiliaryTokenId is the canonical
 * predicate head identity inherited from A8.11 predicate ownership.
 *
 * registryAnchorTokenId is deliberately NOT used as headTokenId.
 *
 * This adapter does not decide whether sourceKey/sourceValue has TAM
 * meaning. Semantic authority remains in explicit A2 mapping rules.
 */
export function adaptCanonicalTamConstructionFeaturesToSourceFactsV1(
  bridgeCandidates:
    readonly CanonicalTamConstructionTenseRegistryBridgeCandidateV1[],
  requests: readonly CanonicalTamConstructionFeatureSourceRequestV1[],
): CanonicalTamConstructionFeatureSourceResultV1 {
  const sourceFacts: CanonicalTamSourceFactV1[] = [];
  const rejections: CanonicalTamConstructionFeatureSourceRejectionV1[] = [];

  for (const request of requests) {
    if (
      !nonEmpty(request.bridgeCandidateId) ||
      !nonEmpty(request.sourceKey)
    ) {
      rejections.push({
        bridgeCandidateId: request.bridgeCandidateId,
        sourceKey: request.sourceKey,
        reason: "invalid_request",
      });
      continue;
    }

    const matches = bridgeCandidates.filter(
      (candidate) => candidate.id === request.bridgeCandidateId,
    );

    if (matches.length === 0) {
      rejections.push({
        bridgeCandidateId: request.bridgeCandidateId,
        sourceKey: request.sourceKey,
        reason: "bridge_candidate_not_found",
      });
      continue;
    }

    if (matches.length !== 1) {
      rejections.push({
        bridgeCandidateId: request.bridgeCandidateId,
        sourceKey: request.sourceKey,
        reason: "ambiguous_bridge_candidate",
      });
      continue;
    }

    const candidate = matches[0];

    if (!validBridgeCandidate(candidate)) {
      rejections.push({
        bridgeCandidateId: request.bridgeCandidateId,
        sourceKey: request.sourceKey,
        reason: "invalid_bridge_candidate",
      });
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(
      candidate.canonicalFeatures,
      request.sourceKey,
    )) {
      rejections.push({
        bridgeCandidateId: request.bridgeCandidateId,
        sourceKey: request.sourceKey,
        reason: "feature_not_found",
      });
      continue;
    }

    const sourceValue = candidate.canonicalFeatures[request.sourceKey];

    if (typeof sourceValue !== "string") {
      rejections.push({
        bridgeCandidateId: request.bridgeCandidateId,
        sourceKey: request.sourceKey,
        reason: "feature_value_not_string",
      });
      continue;
    }

    if (!nonEmpty(sourceValue)) {
      rejections.push({
        bridgeCandidateId: request.bridgeCandidateId,
        sourceKey: request.sourceKey,
        reason: "feature_value_empty",
      });
      continue;
    }

    const provenanceIds = unique(candidate.provenanceIds);

    if (provenanceIds.length === 0) {
      rejections.push({
        bridgeCandidateId: request.bridgeCandidateId,
        sourceKey: request.sourceKey,
        reason: "missing_provenance",
      });
      continue;
    }

    sourceFacts.push({
      id:
        `tam-construction-feature-source:` +
        `${candidate.id}:` +
        `${request.sourceKey}`,

      predicateId: candidate.predicateId,

      headTokenId: candidate.auxiliaryTokenId,

      sourceKind:
        CANONICAL_TAM_CONSTRUCTION_FEATURE_SOURCE_ADAPTER_V1_PRODUCER,

      sourceKey: request.sourceKey,
      sourceValue,

      sourceId: candidate.registrySourceId,

      evidenceIds: unique(candidate.evidenceIds),
      provenanceIds,
    });
  }

  return {
    sourceFacts,
    rejections,
  };
}
