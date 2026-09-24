// Norsk Trainer — Canonical TAM Source Mapping V1
//
// v1.48 A2
//
// Explicit source-to-TAM mapping contract.
//
// This layer does NOT infer TAM from:
//   - construction names;
//   - candidate codes;
//   - lemmas;
//   - substrings;
//   - morphology labels by convention.
//
// A mapping must explicitly name the exact source selector,
// TAM dimension, TAM value, scope, and provenance.
//
// This layer does NOT resolve TAM and does NOT mutate the graph.

import type {
  CanonicalTamEvidenceFactV1,
} from './canonical-tam-evidence-boundary-v1.ts';

export const CANONICAL_TAM_SOURCE_MAPPING_PRODUCER_V1 =
  'canonical_tam_source_mapping_v1';

export const CANONICAL_TAM_SOURCE_MAPPING_VERSION_V1 =
  '1';

export type CanonicalTamSourceScopeV1 =
  | 'token'
  | 'predicate'
  | 'construction';

export type CanonicalTamSourceFactV1 = {
  id: string;

  predicateId: string;
  headTokenId: string;

  sourceKind: string;
  sourceKey: string;
  sourceValue: string;

  sourceId: string;

  evidenceIds?: string[];
  provenanceIds?: string[];
};

export type CanonicalTamSourceMappingRuleV1 = {
  id: string;

  sourceKind: string;
  sourceKey: string;
  sourceValue: string;

  scope: CanonicalTamSourceScopeV1;

  dimension: string;
  value: string;

  provenanceIds: string[];
};

export type CanonicalTamSourceMappingRejectionReasonV1 =
  | 'invalid_source_fact'
  | 'no_exact_mapping'
  | 'invalid_mapping'
  | 'mapping_missing_provenance'
  | 'ambiguous_exact_mapping';

export type CanonicalTamSourceMappingRejectionV1 = {
  sourceFactId: string;
  reason:
    CanonicalTamSourceMappingRejectionReasonV1;
};

export type CanonicalTamSourceMappingResultV1 = {
  producer:
    typeof CANONICAL_TAM_SOURCE_MAPPING_PRODUCER_V1;

  producerVersion:
    typeof CANONICAL_TAM_SOURCE_MAPPING_VERSION_V1;

  evidenceFacts:
    CanonicalTamEvidenceFactV1[];

  rejected:
    CanonicalTamSourceMappingRejectionV1[];
};

function exactString(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function uniqueStrings(
  values: readonly string[] | undefined,
): string[] {
  return [
    ...new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].sort();
}

function validSourceFact(
  fact: CanonicalTamSourceFactV1,
): boolean {
  return Boolean(
    exactString(fact.id) &&
    exactString(fact.predicateId) &&
    exactString(fact.headTokenId) &&
    exactString(fact.sourceKind) &&
    exactString(fact.sourceKey) &&
    exactString(fact.sourceValue) &&
    exactString(fact.sourceId),
  );
}

function validMapping(
  mapping:
    CanonicalTamSourceMappingRuleV1,
): boolean {
  return Boolean(
    exactString(mapping.id) &&
    exactString(mapping.sourceKind) &&
    exactString(mapping.sourceKey) &&
    exactString(mapping.sourceValue) &&
    exactString(mapping.dimension) &&
    exactString(mapping.value) &&
    (
      mapping.scope === 'token' ||
      mapping.scope === 'predicate' ||
      mapping.scope === 'construction'
    ),
  );
}

function exactMappingMatch(
  fact: CanonicalTamSourceFactV1,
  mapping:
    CanonicalTamSourceMappingRuleV1,
): boolean {
  return (
    fact.sourceKind === mapping.sourceKind &&
    fact.sourceKey === mapping.sourceKey &&
    fact.sourceValue === mapping.sourceValue
  );
}

export function mapCanonicalTamSourceFactsV1(
  sourceFacts:
    readonly CanonicalTamSourceFactV1[],
  mappings:
    readonly CanonicalTamSourceMappingRuleV1[],
): CanonicalTamSourceMappingResultV1 {
  const evidenceFacts:
    CanonicalTamEvidenceFactV1[] = [];

  const rejected:
    CanonicalTamSourceMappingRejectionV1[] = [];

  const orderedFacts =
    [...sourceFacts].sort(
      (a, b) => a.id.localeCompare(b.id),
    );

  for (const fact of orderedFacts) {
    const factId =
      exactString(fact.id) ?? fact.id;

    if (!validSourceFact(fact)) {
      rejected.push({
        sourceFactId: factId,
        reason: 'invalid_source_fact',
      });
      continue;
    }

    const exactMatches =
      mappings.filter(
        (mapping) =>
          exactMappingMatch(
            fact,
            mapping,
          ),
      );

    if (exactMatches.length === 0) {
      rejected.push({
        sourceFactId: factId,
        reason: 'no_exact_mapping',
      });
      continue;
    }

    if (exactMatches.length > 1) {
      rejected.push({
        sourceFactId: factId,
        reason:
          'ambiguous_exact_mapping',
      });
      continue;
    }

    const mapping = exactMatches[0];

    if (!validMapping(mapping)) {
      rejected.push({
        sourceFactId: factId,
        reason: 'invalid_mapping',
      });
      continue;
    }

    const mappingProvenance =
      uniqueStrings(
        mapping.provenanceIds,
      );

    if (
      mappingProvenance.length === 0
    ) {
      rejected.push({
        sourceFactId: factId,
        reason:
          'mapping_missing_provenance',
      });
      continue;
    }

    const sourceProvenance =
      uniqueStrings([
        fact.sourceId,
        ...(fact.provenanceIds ?? []),
        ...mappingProvenance,
      ]);

    evidenceFacts.push({
      id:
        `tam:mapped:${mapping.id}:${fact.id}`,

      predicateId:
        fact.predicateId,

      headTokenId:
        fact.headTokenId,

      dimension:
        mapping.dimension,

      value:
        mapping.value,

      status: 'candidate',

      sourceIds:
        uniqueStrings([
          fact.sourceId,
          mapping.id,
        ]),

      evidenceIds:
        uniqueStrings(
          fact.evidenceIds,
        ),

      provenanceIds:
        sourceProvenance,

      payload: {
        mappingId: mapping.id,
        sourceFactId: fact.id,
        sourceKind: fact.sourceKind,
        sourceKey: fact.sourceKey,
        sourceValue:
          fact.sourceValue,
        sourceScope:
          mapping.scope,
      },
    });
  }

  return {
    producer:
      CANONICAL_TAM_SOURCE_MAPPING_PRODUCER_V1,

    producerVersion:
      CANONICAL_TAM_SOURCE_MAPPING_VERSION_V1,

    evidenceFacts,
    rejected,
  };
}

