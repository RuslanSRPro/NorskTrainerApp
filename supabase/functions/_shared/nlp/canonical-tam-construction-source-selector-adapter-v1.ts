import type {
  CanonicalTamConstructionSourceSelectorV1,
} from './canonical-tam-construction-registry-mapping-authority-v1.ts';

export const CANONICAL_TAM_CONSTRUCTION_SOURCE_SELECTOR_ADAPTER_V1 =
  'canonical_tam_construction_source_selector_adapter_v1' as const;

export const CANONICAL_TAM_CONSTRUCTION_SOURCE_SELECTOR_ADAPTER_VERSION_V1 =
  '1' as const;

export type CanonicalTamConstructionSelectorOccurrenceV1 = {
  constructionId: string;
  projectionId: string;
  sourceCandidateCodes: string[];
  provenanceIds: string[];
};

export type CanonicalTamConstructionSelectorProvenanceV1 = {
  id: string;
  sourceType: string;
  sourceId: string;
};

export type CanonicalTamConstructionSourceSelectorRejectionReasonV1 =
  | 'invalid_construction_occurrence'
  | 'source_candidate_not_proven'
  | 'ambiguous_source_candidate';

export type CanonicalTamConstructionSourceSelectorRejectionV1 = {
  constructionId: string;
  projectionId: string;
  reason: CanonicalTamConstructionSourceSelectorRejectionReasonV1;
};

export type CanonicalTamConstructionSourceSelectorAdapterResultV1 = {
  selectors: CanonicalTamConstructionSourceSelectorV1[];
  rejections: CanonicalTamConstructionSourceSelectorRejectionV1[];
};

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function adaptCanonicalTamConstructionSourceSelectorsV1(
  occurrences: CanonicalTamConstructionSelectorOccurrenceV1[],
  provenance: CanonicalTamConstructionSelectorProvenanceV1[],
): CanonicalTamConstructionSourceSelectorAdapterResultV1 {
  const selectors: CanonicalTamConstructionSourceSelectorV1[] = [];
  const rejections: CanonicalTamConstructionSourceSelectorRejectionV1[] = [];

  const provenanceById = new Map(
    provenance.map((item) => [item.id, item]),
  );

  for (const occurrence of occurrences) {
    const identity = {
      constructionId: occurrence.constructionId,
      projectionId: occurrence.projectionId,
    };

    if (
      !nonEmpty(occurrence.constructionId) ||
      !nonEmpty(occurrence.projectionId) ||
      occurrence.sourceCandidateCodes.length === 0 ||
      occurrence.provenanceIds.length === 0
    ) {
      rejections.push({
        ...identity,
        reason: 'invalid_construction_occurrence',
      });
      continue;
    }

    const occurrenceProvenance = occurrence.provenanceIds
      .map((id) => provenanceById.get(id))
      .filter(
        (
          item,
        ): item is CanonicalTamConstructionSelectorProvenanceV1 =>
          Boolean(item),
      );

    const provenCodes = unique(
      occurrence.sourceCandidateCodes
        .filter(nonEmpty)
        .filter((code) =>
          occurrenceProvenance.some((item) =>
            item.sourceType === 'source_rule' &&
            item.sourceId === code
          )
        ),
    );

    if (provenCodes.length === 0) {
      rejections.push({
        ...identity,
        reason: 'source_candidate_not_proven',
      });
      continue;
    }

    if (provenCodes.length !== 1) {
      rejections.push({
        ...identity,
        reason: 'ambiguous_source_candidate',
      });
      continue;
    }

    const sourceCandidateCode = provenCodes[0];

    const sourceProvenanceIds = unique(
      occurrenceProvenance
        .filter((item) =>
          item.sourceType === 'source_rule' &&
          item.sourceId === sourceCandidateCode
        )
        .map((item) => item.id),
    );

    selectors.push({
      selectorKind: 'frozen_grammar_source_candidate_code',
      selectorValue: sourceCandidateCode,
      sourceId: sourceCandidateCode,
      provenanceIds: sourceProvenanceIds,
    });
  }

  return {
    selectors,
    rejections,
  };
}
