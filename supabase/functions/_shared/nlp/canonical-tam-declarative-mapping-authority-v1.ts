import type {
  CanonicalTamSourceMappingRuleV1,
  CanonicalTamSourceScopeV1,
} from './canonical-tam-source-mapping-v1.ts';

export const CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_PRODUCER =
  'canonical_tam_declarative_mapping_authority_v1' as const;

export const CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_VERSION =
  '1' as const;

export type CanonicalTamDeclarativeMappingAuthorityRecordV1 = {
  id: string;
  authoritySourceId: string;

  sourceKind: string;
  sourceKey: string;
  sourceValue: string;
  scope: CanonicalTamSourceScopeV1;

  dimension: string;
  value: string;

  provenanceIds: string[];
};

export type CanonicalTamDeclarativeMappingAuthorityCandidateV1 = {
  id: string;

  producer:
    typeof CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_PRODUCER;

  version:
    typeof CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_VERSION;

  status: 'candidate';

  authorityRecordId: string;
  authoritySourceId: string;

  mappingRule: CanonicalTamSourceMappingRuleV1;

  evidenceIds: string[];
  provenanceIds: string[];
};

export type CanonicalTamDeclarativeMappingAuthorityRejectionReasonV1 =
  | 'invalid_authority_record'
  | 'authority_missing_provenance'
  | 'duplicate_authority_record_id'
  | 'ambiguous_exact_authority';

export type CanonicalTamDeclarativeMappingAuthorityRejectionV1 = {
  authorityRecordId: string;
  reason:
    CanonicalTamDeclarativeMappingAuthorityRejectionReasonV1;
};

export type CanonicalTamDeclarativeMappingAuthorityResultV1 = {
  candidates:
    CanonicalTamDeclarativeMappingAuthorityCandidateV1[];

  rejections:
    CanonicalTamDeclarativeMappingAuthorityRejectionV1[];
};

function exactString(
  value: string,
): string | undefined {
  return value.trim().length > 0
    ? value
    : undefined;
}

function unique(
  values: readonly string[],
): string[] {
  return [...new Set(values)];
}

function validScope(
  scope: CanonicalTamSourceScopeV1,
): boolean {
  return (
    scope === 'token' ||
    scope === 'predicate' ||
    scope === 'construction'
  );
}

function validRecord(
  record:
    CanonicalTamDeclarativeMappingAuthorityRecordV1,
): boolean {
  return Boolean(
    exactString(record.id) &&
    exactString(record.authoritySourceId) &&
    exactString(record.sourceKind) &&
    exactString(record.sourceKey) &&
    exactString(record.sourceValue) &&
    validScope(record.scope) &&
    exactString(record.dimension) &&
    exactString(record.value),
  );
}

function exactSemanticDimensionKey(
  record:
    CanonicalTamDeclarativeMappingAuthorityRecordV1,
): string {
  return [
    record.sourceKind,
    record.sourceKey,
    record.sourceValue,
    record.scope,
    record.dimension,
  ].join('\u0000');
}

/**
 * Validates explicit declarative TAM mapping authority and mechanically
 * converts each unambiguous authority record into the existing A2 mapping
 * rule contract.
 *
 * This boundary does not infer semantics from source names, feature names,
 * source values, morphology labels, construction identities, or language
 * conventions. Semantic dimension/value pairs must already be explicit in
 * the declarative authority record.
 */
export function deriveCanonicalTamDeclarativeMappingAuthorityV1(
  records:
    readonly CanonicalTamDeclarativeMappingAuthorityRecordV1[],
): CanonicalTamDeclarativeMappingAuthorityResultV1 {
  const candidates:
    CanonicalTamDeclarativeMappingAuthorityCandidateV1[] = [];

  const rejections:
    CanonicalTamDeclarativeMappingAuthorityRejectionV1[] = [];

  const idCounts = new Map<string, number>();

  for (const record of records) {
    idCounts.set(
      record.id,
      (idCounts.get(record.id) ?? 0) + 1,
    );
  }

  const semanticDimensionCounts =
    new Map<string, number>();

  for (const record of records) {
    if (!validRecord(record)) {
      continue;
    }

    if (
      record.provenanceIds.length === 0 ||
      !record.provenanceIds.every(
        (id) => Boolean(exactString(id)),
      )
    ) {
      continue;
    }

    const key =
      exactSemanticDimensionKey(record);

    semanticDimensionCounts.set(
      key,
      (semanticDimensionCounts.get(key) ?? 0) + 1,
    );
  }

  for (
    const record of
      [...records].sort(
        (a, b) => a.id.localeCompare(b.id),
      )
  ) {
    const authorityRecordId =
      exactString(record.id) ?? record.id;

    if (!validRecord(record)) {
      rejections.push({
        authorityRecordId,
        reason: 'invalid_authority_record',
      });
      continue;
    }

    if (
      record.provenanceIds.length === 0 ||
      !record.provenanceIds.every(
        (id) => Boolean(exactString(id)),
      )
    ) {
      rejections.push({
        authorityRecordId,
        reason: 'authority_missing_provenance',
      });
      continue;
    }

    if ((idCounts.get(record.id) ?? 0) !== 1) {
      rejections.push({
        authorityRecordId,
        reason: 'duplicate_authority_record_id',
      });
      continue;
    }

    const semanticDimensionKey =
      exactSemanticDimensionKey(record);

    if (
      (
        semanticDimensionCounts.get(
          semanticDimensionKey,
        ) ?? 0
      ) !== 1
    ) {
      rejections.push({
        authorityRecordId,
        reason: 'ambiguous_exact_authority',
      });
      continue;
    }

    const provenanceIds =
      unique(record.provenanceIds);

    const mappingRule:
      CanonicalTamSourceMappingRuleV1 = {
        id:
          `tam-source-mapping-authority:${record.id}`,
        sourceKind: record.sourceKind,
        sourceKey: record.sourceKey,
        sourceValue: record.sourceValue,
        scope: record.scope,
        dimension: record.dimension,
        value: record.value,
        provenanceIds,
      };

    candidates.push({
      id:
        `tam-declarative-authority:${record.id}`,
      producer:
        CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_PRODUCER,
      version:
        CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_VERSION,
      status: 'candidate',
      authorityRecordId: record.id,
      authoritySourceId:
        record.authoritySourceId,
      mappingRule,
      evidenceIds: unique([
        record.id,
        record.authoritySourceId,
      ]),
      provenanceIds,
    });
  }

  return {
    candidates,
    rejections,
  };
}
