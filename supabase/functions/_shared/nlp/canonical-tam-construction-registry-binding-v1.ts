export const CANONICAL_TAM_CONSTRUCTION_REGISTRY_BINDING_V1_PRODUCER =
  'canonical_tam_construction_registry_binding_v1' as const;

export const CANONICAL_TAM_CONSTRUCTION_REGISTRY_BINDING_V1_VERSION =
  '1' as const;

export type CanonicalTamConstructionOccurrenceV1 = {
  constructionId: string;
  projectionId: string;
  anchorTokenId: string;
  memberTokenIds: string[];
  provenanceIds: string[];
};

export type CanonicalTamConstructionRegistryEntryV1 = {
  formKey: string;
  formScope: 'token' | 'construction';
  canonicalFeatures: Record<string, string>;
  sourceId: string;
  provenanceIds: string[];
};

export type CanonicalTamConstructionRegistryBindingRuleV1 = {
  id: string;
  constructionId: string;
  projectionId: string;
  registryFormKey: string;
  provenanceIds: string[];
};

export type CanonicalTamConstructionRegistryBindingV1 = {
  id: string;
  producer: typeof CANONICAL_TAM_CONSTRUCTION_REGISTRY_BINDING_V1_PRODUCER;
  version: typeof CANONICAL_TAM_CONSTRUCTION_REGISTRY_BINDING_V1_VERSION;
  status: 'candidate';
  constructionId: string;
  projectionId: string;
  anchorTokenId: string;
  memberTokenIds: string[];
  registryFormKey: string;
  canonicalFeatures: Record<string, string>;
  registrySourceId: string;
  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalTamConstructionRegistryBindingRejectionV1 = {
  constructionId: string;
  projectionId: string;
  reason:
    | 'invalid_construction_occurrence'
    | 'no_exact_binding'
    | 'ambiguous_exact_binding'
    | 'binding_missing_provenance'
    | 'registry_entry_not_found'
    | 'registry_entry_not_construction_scoped'
    | 'registry_entry_missing_provenance';
};

export type CanonicalTamConstructionRegistryBindingResultV1 = {
  bindings: CanonicalTamConstructionRegistryBindingV1[];
  rejections: CanonicalTamConstructionRegistryBindingRejectionV1[];
};

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function validOccurrence(
  occurrence: CanonicalTamConstructionOccurrenceV1,
): boolean {
  return (
    nonEmpty(occurrence.constructionId) &&
    nonEmpty(occurrence.projectionId) &&
    nonEmpty(occurrence.anchorTokenId) &&
    occurrence.memberTokenIds.length > 0 &&
    occurrence.memberTokenIds.every(nonEmpty) &&
    occurrence.memberTokenIds.includes(occurrence.anchorTokenId) &&
    occurrence.provenanceIds.length > 0 &&
    occurrence.provenanceIds.every(nonEmpty)
  );
}

/**
 * Binds an exact construction occurrence to an explicitly supplied
 * construction-scoped registry form key.
 *
 * Registry identity must come from the binding rule. No string convention
 * is used to manufacture that identity.
 *
 * canonicalFeatures are transported as source evidence only. This boundary
 * does not interpret them as TAM semantics.
 */
export function bindCanonicalTamConstructionRegistryV1(
  occurrences: CanonicalTamConstructionOccurrenceV1[],
  registryEntries: CanonicalTamConstructionRegistryEntryV1[],
  rules: CanonicalTamConstructionRegistryBindingRuleV1[],
): CanonicalTamConstructionRegistryBindingResultV1 {
  const bindings: CanonicalTamConstructionRegistryBindingV1[] = [];
  const rejections: CanonicalTamConstructionRegistryBindingRejectionV1[] = [];

  for (const occurrence of occurrences) {
    const identity = {
      constructionId: occurrence.constructionId,
      projectionId: occurrence.projectionId,
    };

    if (!validOccurrence(occurrence)) {
      rejections.push({
        ...identity,
        reason: 'invalid_construction_occurrence',
      });
      continue;
    }

    const exactRules = rules.filter((rule) =>
      rule.constructionId === occurrence.constructionId &&
      rule.projectionId === occurrence.projectionId
    );

    if (exactRules.length === 0) {
      rejections.push({
        ...identity,
        reason: 'no_exact_binding',
      });
      continue;
    }

    if (exactRules.length !== 1) {
      rejections.push({
        ...identity,
        reason: 'ambiguous_exact_binding',
      });
      continue;
    }

    const rule = exactRules[0];

    if (
      !nonEmpty(rule.id) ||
      !nonEmpty(rule.registryFormKey) ||
      rule.provenanceIds.length === 0 ||
      !rule.provenanceIds.every(nonEmpty)
    ) {
      rejections.push({
        ...identity,
        reason: 'binding_missing_provenance',
      });
      continue;
    }

    const registryMatches = registryEntries.filter((entry) =>
      entry.formKey === rule.registryFormKey
    );

    if (registryMatches.length !== 1) {
      rejections.push({
        ...identity,
        reason: 'registry_entry_not_found',
      });
      continue;
    }

    const entry = registryMatches[0];

    if (entry.formScope !== 'construction') {
      rejections.push({
        ...identity,
        reason: 'registry_entry_not_construction_scoped',
      });
      continue;
    }

    if (
      !nonEmpty(entry.sourceId) ||
      entry.provenanceIds.length === 0 ||
      !entry.provenanceIds.every(nonEmpty)
    ) {
      rejections.push({
        ...identity,
        reason: 'registry_entry_missing_provenance',
      });
      continue;
    }

    bindings.push({
      id:
        `tam-construction-registry:${occurrence.constructionId}:` +
        `${occurrence.projectionId}:${entry.formKey}`,
      producer: CANONICAL_TAM_CONSTRUCTION_REGISTRY_BINDING_V1_PRODUCER,
      version: CANONICAL_TAM_CONSTRUCTION_REGISTRY_BINDING_V1_VERSION,
      status: 'candidate',
      constructionId: occurrence.constructionId,
      projectionId: occurrence.projectionId,
      anchorTokenId: occurrence.anchorTokenId,
      memberTokenIds: [...occurrence.memberTokenIds],
      registryFormKey: entry.formKey,
      canonicalFeatures: { ...entry.canonicalFeatures },
      registrySourceId: entry.sourceId,
      evidenceIds: unique([
        rule.id,
        entry.sourceId,
      ]),
      provenanceIds: unique([
        ...occurrence.provenanceIds,
        ...rule.provenanceIds,
        ...entry.provenanceIds,
      ]),
    });
  }

  return { bindings, rejections };
}
