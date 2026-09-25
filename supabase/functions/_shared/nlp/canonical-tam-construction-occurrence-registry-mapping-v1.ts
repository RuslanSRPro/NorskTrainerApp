import type {
  CanonicalTamConstructionRegistryMappingCandidateV1,
  CanonicalTamConstructionSourceSelectorV1,
} from "./canonical-tam-construction-registry-mapping-authority-v1.ts";

import type {
  CanonicalTamConstructionRegistryBindingRuleV1,
} from "./canonical-tam-construction-registry-binding-v1.ts";

export const CANONICAL_TAM_CONSTRUCTION_OCCURRENCE_REGISTRY_MAPPING_V1_PRODUCER =
  "canonical_tam_construction_occurrence_registry_mapping_v1" as const;

export const CANONICAL_TAM_CONSTRUCTION_OCCURRENCE_REGISTRY_MAPPING_V1_VERSION =
  "1" as const;

/**
 * Explicit occurrence envelope around the real A8.7 selector contract.
 *
 * A8.7 deliberately emits a selector without construction occurrence
 * identity. This envelope does not infer that identity from selector data.
 * The caller must provide the exact constructionId/projectionId of the
 * occurrence from which the selector was produced.
 */
export type CanonicalTamConstructionOccurrenceSelectorEnvelopeV1 = {
  constructionId: string;
  projectionId: string;
  selector: CanonicalTamConstructionSourceSelectorV1;
};

export type CanonicalTamConstructionOccurrenceRegistryMappingCandidateV1 = {
  id: string;

  producer:
    typeof CANONICAL_TAM_CONSTRUCTION_OCCURRENCE_REGISTRY_MAPPING_V1_PRODUCER;

  version:
    typeof CANONICAL_TAM_CONSTRUCTION_OCCURRENCE_REGISTRY_MAPPING_V1_VERSION;

  status: "candidate";

  constructionId: string;
  projectionId: string;

  selectorKind: string;
  selectorValue: string;

  registryFormKey: string;

  mappingCandidateId: string;
  sourceId: string;
  authoritySourceId: string;

  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalTamConstructionOccurrenceRegistryMappingRejectionReasonV1 =
  | "invalid_occurrence_envelope"
  | "selector_missing_provenance"
  | "mapping_candidate_not_found"
  | "ambiguous_mapping_candidate"
  | "mapping_candidate_invalid"
  | "mapping_candidate_missing_provenance";

export type CanonicalTamConstructionOccurrenceRegistryMappingRejectionV1 = {
  constructionId: string;
  projectionId: string;
  reason: CanonicalTamConstructionOccurrenceRegistryMappingRejectionReasonV1;
};

export type CanonicalTamConstructionOccurrenceRegistryMappingResultV1 = {
  candidates: CanonicalTamConstructionOccurrenceRegistryMappingCandidateV1[];
  rejections: CanonicalTamConstructionOccurrenceRegistryMappingRejectionV1[];
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

function validSelector(
  selector: CanonicalTamConstructionSourceSelectorV1,
): boolean {
  return (
    nonEmpty(selector.selectorKind) &&
    nonEmpty(selector.selectorValue) &&
    nonEmpty(selector.sourceId)
  );
}

function validEnvelope(
  envelope: CanonicalTamConstructionOccurrenceSelectorEnvelopeV1,
): boolean {
  return (
    nonEmpty(envelope.constructionId) &&
    nonEmpty(envelope.projectionId) &&
    envelope.selector !== null &&
    typeof envelope.selector === "object" &&
    validSelector(envelope.selector)
  );
}

function validMappingCandidate(
  mapping: CanonicalTamConstructionRegistryMappingCandidateV1,
): boolean {
  return (
    nonEmpty(mapping.id) &&
    mapping.status === "candidate" &&
    nonEmpty(mapping.selectorKind) &&
    nonEmpty(mapping.selectorValue) &&
    nonEmpty(mapping.registryFormKey) &&
    nonEmpty(mapping.sourceId) &&
    nonEmpty(mapping.authoritySourceId)
  );
}

/**
 * Compose an occurrence-local A8.7 selector with a real A8.5 mapping
 * candidate.
 *
 * Exact join:
 *   selectorKind
 *   selectorValue
 *   sourceId
 *
 * constructionId/projectionId are preserved only from the explicit
 * occurrence envelope. They are never reconstructed from the mapping.
 */
export function bindCanonicalTamConstructionOccurrenceRegistryMappingV1(
  envelopes:
    readonly CanonicalTamConstructionOccurrenceSelectorEnvelopeV1[],
  mappings:
    readonly CanonicalTamConstructionRegistryMappingCandidateV1[],
): CanonicalTamConstructionOccurrenceRegistryMappingResultV1 {
  const candidates:
    CanonicalTamConstructionOccurrenceRegistryMappingCandidateV1[] = [];

  const rejections:
    CanonicalTamConstructionOccurrenceRegistryMappingRejectionV1[] = [];

  for (const envelope of envelopes) {
    if (!validEnvelope(envelope)) {
      rejections.push({
        constructionId: envelope.constructionId,
        projectionId: envelope.projectionId,
        reason: "invalid_occurrence_envelope",
      });
      continue;
    }

    const selector = envelope.selector;

    if (!hasProvenance(selector.provenanceIds)) {
      rejections.push({
        constructionId: envelope.constructionId,
        projectionId: envelope.projectionId,
        reason: "selector_missing_provenance",
      });
      continue;
    }

    const exactMappings = mappings.filter((mapping) =>
      mapping.selectorKind === selector.selectorKind &&
      mapping.selectorValue === selector.selectorValue &&
      mapping.sourceId === selector.sourceId
    );

    if (exactMappings.length === 0) {
      rejections.push({
        constructionId: envelope.constructionId,
        projectionId: envelope.projectionId,
        reason: "mapping_candidate_not_found",
      });
      continue;
    }

    if (exactMappings.length !== 1) {
      rejections.push({
        constructionId: envelope.constructionId,
        projectionId: envelope.projectionId,
        reason: "ambiguous_mapping_candidate",
      });
      continue;
    }

    const mapping = exactMappings[0];

    if (!validMappingCandidate(mapping)) {
      rejections.push({
        constructionId: envelope.constructionId,
        projectionId: envelope.projectionId,
        reason: "mapping_candidate_invalid",
      });
      continue;
    }

    if (!hasProvenance(mapping.provenanceIds)) {
      rejections.push({
        constructionId: envelope.constructionId,
        projectionId: envelope.projectionId,
        reason: "mapping_candidate_missing_provenance",
      });
      continue;
    }

    candidates.push({
      id:
        `tam-construction-occurrence-registry-mapping:` +
        `${envelope.constructionId}:` +
        `${envelope.projectionId}:` +
        `${mapping.id}`,

      producer:
        CANONICAL_TAM_CONSTRUCTION_OCCURRENCE_REGISTRY_MAPPING_V1_PRODUCER,

      version:
        CANONICAL_TAM_CONSTRUCTION_OCCURRENCE_REGISTRY_MAPPING_V1_VERSION,

      status: "candidate",

      constructionId: envelope.constructionId,
      projectionId: envelope.projectionId,

      selectorKind: selector.selectorKind,
      selectorValue: selector.selectorValue,

      registryFormKey: mapping.registryFormKey,

      mappingCandidateId: mapping.id,
      sourceId: mapping.sourceId,
      authoritySourceId: mapping.authoritySourceId,

      evidenceIds: unique([
        ...mapping.evidenceIds,
      ]),

      provenanceIds: unique([
        ...selector.provenanceIds,
        ...mapping.provenanceIds,
      ]),
    });
  }

  return { candidates, rejections };
}

/**
 * Mechanical A8.12.2 -> A8.2 rule conversion.
 *
 * No selector interpretation, registry interpretation, TAM semantics,
 * or construction-name inference occurs here.
 */
export function toCanonicalTamConstructionRegistryBindingRuleV1(
  candidate: CanonicalTamConstructionOccurrenceRegistryMappingCandidateV1,
): CanonicalTamConstructionRegistryBindingRuleV1 {
  return {
    id: `tam-construction-registry-binding-rule:${candidate.id}`,
    constructionId: candidate.constructionId,
    projectionId: candidate.projectionId,
    registryFormKey: candidate.registryFormKey,
    provenanceIds: [...candidate.provenanceIds],
  };
}

