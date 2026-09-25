export const CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_PRODUCER =
  'canonical_tam_construction_registry_mapping_authority_v1' as const;

export const CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_VERSION =
  '1' as const;

/**
 * A source-backed selector supplied by an upstream grammar authority.
 *
 * selectorKind and selectorValue are opaque here. This contract does not
 * interpret construction names, projection codes, candidate codes, or
 * linguistic labels.
 */
export type CanonicalTamConstructionSourceSelectorV1 = {
  selectorKind: string;
  selectorValue: string;
  sourceId: string;
  provenanceIds: string[];
};

/**
 * Declarative authority record.
 *
 * It authorizes one exact source selector to point at one exact
 * construction-scoped registry form key. It does not itself bind a runtime
 * construction occurrence and does not interpret registry features as TAM.
 */
export type CanonicalTamConstructionRegistryMappingAuthorityRecordV1 = {
  id: string;
  selectorKind: string;
  selectorValue: string;
  registryFormKey: string;
  authoritySourceId: string;
  provenanceIds: string[];
};

export type CanonicalTamConstructionRegistryMappingCandidateV1 = {
  id: string;
  producer:
    typeof CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_PRODUCER;
  version:
    typeof CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_VERSION;
  status: 'candidate';
  selectorKind: string;
  selectorValue: string;
  registryFormKey: string;
  sourceId: string;
  authoritySourceId: string;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalTamConstructionRegistryMappingRejectionReasonV1 =
  | 'invalid_source_selector'
  | 'no_exact_mapping'
  | 'ambiguous_exact_mapping'
  | 'invalid_mapping'
  | 'mapping_missing_provenance';

export type CanonicalTamConstructionRegistryMappingRejectionV1 = {
  selectorKind: string;
  selectorValue: string;
  reason: CanonicalTamConstructionRegistryMappingRejectionReasonV1;
};

export type CanonicalTamConstructionRegistryMappingResultV1 = {
  candidates: CanonicalTamConstructionRegistryMappingCandidateV1[];
  rejections: CanonicalTamConstructionRegistryMappingRejectionV1[];
};

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function validSelector(
  selector: CanonicalTamConstructionSourceSelectorV1,
): boolean {
  return (
    nonEmpty(selector.selectorKind) &&
    nonEmpty(selector.selectorValue) &&
    nonEmpty(selector.sourceId) &&
    selector.provenanceIds.length > 0 &&
    selector.provenanceIds.every(nonEmpty)
  );
}

function validMapping(
  mapping: CanonicalTamConstructionRegistryMappingAuthorityRecordV1,
): boolean {
  return (
    nonEmpty(mapping.id) &&
    nonEmpty(mapping.selectorKind) &&
    nonEmpty(mapping.selectorValue) &&
    nonEmpty(mapping.registryFormKey) &&
    nonEmpty(mapping.authoritySourceId)
  );
}

/**
 * Resolves only an explicit declarative selector -> registry form-key
 * authority relation.
 *
 * Exact matching is mandatory. No substring matching, naming convention,
 * linguistic interpretation, runtime occurrence binding, registry lookup,
 * TAM resolution, or graph mutation occurs here.
 */
export function mapCanonicalTamConstructionRegistryAuthorityV1(
  selectors: CanonicalTamConstructionSourceSelectorV1[],
  mappings: CanonicalTamConstructionRegistryMappingAuthorityRecordV1[],
): CanonicalTamConstructionRegistryMappingResultV1 {
  const candidates: CanonicalTamConstructionRegistryMappingCandidateV1[] = [];
  const rejections: CanonicalTamConstructionRegistryMappingRejectionV1[] = [];

  for (const selector of selectors) {
    const identity = {
      selectorKind: selector.selectorKind,
      selectorValue: selector.selectorValue,
    };

    if (!validSelector(selector)) {
      rejections.push({
        ...identity,
        reason: 'invalid_source_selector',
      });
      continue;
    }

    const exact = mappings.filter((mapping) =>
      mapping.selectorKind === selector.selectorKind &&
      mapping.selectorValue === selector.selectorValue
    );

    if (exact.length === 0) {
      rejections.push({
        ...identity,
        reason: 'no_exact_mapping',
      });
      continue;
    }

    if (exact.length !== 1) {
      rejections.push({
        ...identity,
        reason: 'ambiguous_exact_mapping',
      });
      continue;
    }

    const mapping = exact[0];

    if (!validMapping(mapping)) {
      rejections.push({
        ...identity,
        reason: 'invalid_mapping',
      });
      continue;
    }

    if (
      mapping.provenanceIds.length === 0 ||
      !mapping.provenanceIds.every(nonEmpty)
    ) {
      rejections.push({
        ...identity,
        reason: 'mapping_missing_provenance',
      });
      continue;
    }

    candidates.push({
      id:
        `tam-construction-registry-map:${mapping.id}:` +
        `${selector.selectorKind}:${selector.selectorValue}`,
      producer:
        CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_PRODUCER,
      version:
        CANONICAL_TAM_CONSTRUCTION_REGISTRY_MAPPING_AUTHORITY_V1_VERSION,
      status: 'candidate',
      selectorKind: selector.selectorKind,
      selectorValue: selector.selectorValue,
      registryFormKey: mapping.registryFormKey,
      sourceId: selector.sourceId,
      authoritySourceId: mapping.authoritySourceId,
      evidenceIds: unique([
        selector.sourceId,
        mapping.id,
        mapping.authoritySourceId,
      ]),
      provenanceIds: unique([
        ...selector.provenanceIds,
        ...mapping.provenanceIds,
      ]),
    });
  }

  return { candidates, rejections };
}
