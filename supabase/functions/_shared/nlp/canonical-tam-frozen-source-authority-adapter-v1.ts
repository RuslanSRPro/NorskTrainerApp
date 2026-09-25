import type {
  CanonicalTamDeclarativeMappingAuthorityRecordV1,
} from './canonical-tam-declarative-mapping-authority-v1.ts';

export const CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_V1 =
  'canonical_tam_frozen_source_authority_adapter_v1';

export const CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_VERSION_V1 =
  '1';

type Json = Record<string, unknown>;

export type CanonicalTamFrozenSourceSnapshotV1 = {
  snapshotId: string;

  readOnly: boolean;
  writePerformed: boolean;
  frozenGrammarImmutable: boolean;

  candidates: readonly unknown[];
};

export type CanonicalTamFrozenSourceAuthorityRejectionReasonV1 =
  | 'invalid_snapshot'
  | 'snapshot_not_read_only'
  | 'snapshot_write_performed'
  | 'snapshot_not_frozen'
  | 'invalid_candidate'
  | 'candidate_not_source_verified'
  | 'candidate_requires_human_verification'
  | 'invalid_semantic_assertion'
  | 'semantic_assertion_missing_provenance';

export type CanonicalTamFrozenSourceAuthorityRejectionV1 = {
  sourceCandidateId?: string;
  sourceCandidateCode?: string;

  reason:
    CanonicalTamFrozenSourceAuthorityRejectionReasonV1;
};

export type CanonicalTamFrozenSourceAuthorityAdapterResultV1 = {
  adapter:
    typeof CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_V1;

  adapterVersion:
    typeof CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_VERSION_V1;

  authorityRecords:
    CanonicalTamDeclarativeMappingAuthorityRecordV1[];

  rejections:
    CanonicalTamFrozenSourceAuthorityRejectionV1[];
};

function asRecord(
  value: unknown,
): Json | undefined {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  return value as Json;
}

function exactString(
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
}

function exactStringArray(
  value: unknown,
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values: string[] = [];

  for (const item of value) {
    const itemString = exactString(item);

    if (!itemString) {
      return undefined;
    }

    values.push(itemString);
  }

  return values;
}

function unique(
  values: readonly string[],
): string[] {
  return [...new Set(values)];
}

function semanticAssertions(
  payload: Json,
): unknown[] {
  const value =
    payload.semantic_assertions;

  return Array.isArray(value)
    ? value
    : [];
}

export function adaptCanonicalTamFrozenSourceAuthorityV1(
  snapshot:
    CanonicalTamFrozenSourceSnapshotV1,
): CanonicalTamFrozenSourceAuthorityAdapterResultV1 {
  const authorityRecords:
    CanonicalTamDeclarativeMappingAuthorityRecordV1[] = [];

  const rejections:
    CanonicalTamFrozenSourceAuthorityRejectionV1[] = [];

  if (
    !exactString(snapshot.snapshotId) ||
    !Array.isArray(snapshot.candidates)
  ) {
    return {
      adapter:
        CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_V1,

      adapterVersion:
        CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_VERSION_V1,

      authorityRecords: [],

      rejections: [
        {
          reason: 'invalid_snapshot',
        },
      ],
    };
  }

  if (snapshot.readOnly !== true) {
    rejections.push({
      reason: 'snapshot_not_read_only',
    });
  }

  if (snapshot.writePerformed !== false) {
    rejections.push({
      reason: 'snapshot_write_performed',
    });
  }

  if (
    snapshot.frozenGrammarImmutable !== true
  ) {
    rejections.push({
      reason: 'snapshot_not_frozen',
    });
  }

  if (rejections.length > 0) {
    return {
      adapter:
        CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_V1,

      adapterVersion:
        CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_VERSION_V1,

      authorityRecords: [],

      rejections,
    };
  }

  for (const candidateValue of snapshot.candidates) {
    const candidate =
      asRecord(candidateValue);

    if (!candidate) {
      rejections.push({
        reason: 'invalid_candidate',
      });

      continue;
    }

    const candidateId =
      exactString(
        candidate.candidate_id ??
          candidate.candidateId,
      );

    const candidateCode =
      exactString(
        candidate.candidate_code ??
          candidate.candidateCode,
      );

    if (!candidateId || !candidateCode) {
      rejections.push({
        sourceCandidateId: candidateId,
        sourceCandidateCode: candidateCode,
        reason: 'invalid_candidate',
      });

      continue;
    }

    if (
      exactString(candidate.status) !==
        'source_verified'
    ) {
      rejections.push({
        sourceCandidateId: candidateId,
        sourceCandidateCode: candidateCode,
        reason: 'candidate_not_source_verified',
      });

      continue;
    }

    if (
      candidate.requires_human_verification === true ||
      candidate.requiresHumanVerification === true
    ) {
      rejections.push({
        sourceCandidateId: candidateId,
        sourceCandidateCode: candidateCode,
        reason:
          'candidate_requires_human_verification',
      });

      continue;
    }

    const payload =
      asRecord(
        candidate.extracted_payload ??
          candidate.extractedPayload,
      ) ?? {};

    const assertions =
      semanticAssertions(payload);

    for (
      let assertionIndex = 0;
      assertionIndex < assertions.length;
      assertionIndex++
    ) {
      const assertion =
        asRecord(assertions[assertionIndex]);

      if (!assertion) {
        rejections.push({
          sourceCandidateId: candidateId,
          sourceCandidateCode: candidateCode,
          reason: 'invalid_semantic_assertion',
        });

        continue;
      }

      if (
        exactString(assertion.domain) !== 'tam'
      ) {
        continue;
      }

      const assertionId =
        exactString(assertion.id);

      const sourceKind =
        exactString(assertion.sourceKind);

      const sourceKey =
        exactString(assertion.sourceKey);

      const sourceValue =
        exactString(assertion.sourceValue);

      const scope =
        exactString(assertion.scope);

      const dimension =
        exactString(assertion.dimension);

      const value =
        exactString(assertion.value);

      const provenanceIds =
        exactStringArray(
          assertion.provenanceIds,
        );

      if (
        !assertionId ||
        !sourceKind ||
        !sourceKey ||
        !sourceValue ||
        !scope ||
        !dimension ||
        !value
      ) {
        rejections.push({
          sourceCandidateId: candidateId,
          sourceCandidateCode: candidateCode,
          reason: 'invalid_semantic_assertion',
        });

        continue;
      }

      if (
        scope !== 'token' &&
        scope !== 'predicate' &&
        scope !== 'construction'
      ) {
        rejections.push({
          sourceCandidateId: candidateId,
          sourceCandidateCode: candidateCode,
          reason: 'invalid_semantic_assertion',
        });

        continue;
      }

      if (
        !provenanceIds ||
        provenanceIds.length === 0
      ) {
        rejections.push({
          sourceCandidateId: candidateId,
          sourceCandidateCode: candidateCode,
          reason:
            'semantic_assertion_missing_provenance',
        });

        continue;
      }

      authorityRecords.push({
        id: [
          'tam-authority',
          candidateId,
          assertionId,
        ].join(':'),

        authoritySourceId: [
          'frozen-grammar',
          snapshot.snapshotId,
          candidateId,
          assertionId,
        ].join(':'),

        sourceKind,
        sourceKey,
        sourceValue,

        scope,

        dimension,
        value,

        provenanceIds:
          unique(provenanceIds),
      });
    }
  }

  authorityRecords.sort(
    (a, b) => a.id.localeCompare(b.id),
  );

  return {
    adapter:
      CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_V1,

    adapterVersion:
      CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_VERSION_V1,

    authorityRecords,
    rejections,
  };
}