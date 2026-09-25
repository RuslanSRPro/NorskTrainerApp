import {
  assert,
  assertEquals,
} from 'jsr:@std/assert';

import {
  CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_PRODUCER,
  CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_VERSION,
  deriveCanonicalTamDeclarativeMappingAuthorityV1,
  type CanonicalTamDeclarativeMappingAuthorityRecordV1,
} from './canonical-tam-declarative-mapping-authority-v1.ts';

function record(
  overrides:
    Partial<CanonicalTamDeclarativeMappingAuthorityRecordV1> = {},
): CanonicalTamDeclarativeMappingAuthorityRecordV1 {
  return {
    id: 'authority:1',
    authoritySourceId: 'source:grammar-authority:1',
    sourceKind: 'source-kind',
    sourceKey: 'feature-key',
    sourceValue: 'feature-value',
    scope: 'construction',
    dimension: 'tam-dimension',
    value: 'tam-value',
    provenanceIds: ['prov:authority:1'],
    ...overrides,
  };
}

Deno.test(
  'A8.15.3 converts explicit authority into real A2 mapping rule',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record(),
      ]);

    assertEquals(result.rejections, []);
    assertEquals(result.candidates.length, 1);

    const candidate = result.candidates[0];

    assertEquals(
      candidate.mappingRule,
      {
        id: 'tam-source-mapping-authority:authority:1',
        sourceKind: 'source-kind',
        sourceKey: 'feature-key',
        sourceValue: 'feature-value',
        scope: 'construction',
        dimension: 'tam-dimension',
        value: 'tam-value',
        provenanceIds: ['prov:authority:1'],
      },
    );
  },
);

Deno.test(
  'A8.15.3 preserves authority identity separately from A2 rule',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record(),
      ]);

    const candidate = result.candidates[0];

    assertEquals(
      candidate.authorityRecordId,
      'authority:1',
    );

    assertEquals(
      candidate.authoritySourceId,
      'source:grammar-authority:1',
    );
  },
);

Deno.test(
  'A8.15.3 identifies generic authority producer and version',
  () => {
    const candidate =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record(),
      ]).candidates[0];

    assertEquals(
      candidate.producer,
      CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_PRODUCER,
    );

    assertEquals(
      candidate.version,
      CANONICAL_TAM_DECLARATIVE_MAPPING_AUTHORITY_V1_VERSION,
    );

    assertEquals(candidate.status, 'candidate');
  },
);

Deno.test(
  'A8.15.3 preserves explicit dimension and value opaquely',
  () => {
    const candidate =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          dimension: 'opaque-dimension',
          value: 'opaque-value',
        }),
      ]).candidates[0];

    assertEquals(
      candidate.mappingRule.dimension,
      'opaque-dimension',
    );

    assertEquals(
      candidate.mappingRule.value,
      'opaque-value',
    );
  },
);

Deno.test(
  'A8.15.3 preserves exact source selector opaquely',
  () => {
    const candidate =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          sourceKind: 'Exact Kind',
          sourceKey: 'Exact Key',
          sourceValue: 'Exact Value',
        }),
      ]).candidates[0];

    assertEquals(
      candidate.mappingRule.sourceKind,
      'Exact Kind',
    );

    assertEquals(
      candidate.mappingRule.sourceKey,
      'Exact Key',
    );

    assertEquals(
      candidate.mappingRule.sourceValue,
      'Exact Value',
    );
  },
);

Deno.test(
  'A8.15.3 preserves authority provenance in A2 rule',
  () => {
    const candidate =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          provenanceIds: [
            'prov:a',
            'prov:b',
            'prov:a',
          ],
        }),
      ]).candidates[0];

    assertEquals(
      candidate.mappingRule.provenanceIds,
      ['prov:a', 'prov:b'],
    );

    assertEquals(
      candidate.provenanceIds,
      ['prov:a', 'prov:b'],
    );
  },
);

Deno.test(
  'A8.15.3 carries authority source as evidence without inventing semantic evidence',
  () => {
    const candidate =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record(),
      ]).candidates[0];

    assertEquals(
      candidate.evidenceIds,
      [
        'authority:1',
        'source:grammar-authority:1',
      ],
    );
  },
);

Deno.test(
  'A8.15.3 missing provenance fails closed',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          provenanceIds: [],
        }),
      ]);

    assertEquals(result.candidates, []);

    assertEquals(
      result.rejections[0].reason,
      'authority_missing_provenance',
    );
  },
);

Deno.test(
  'A8.15.3 invalid empty authority source fails closed',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          authoritySourceId: '',
        }),
      ]);

    assertEquals(result.candidates, []);

    assertEquals(
      result.rejections[0].reason,
      'invalid_authority_record',
    );
  },
);

Deno.test(
  'A8.15.3 invalid empty source selector fails closed',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          sourceKey: '',
        }),
      ]);

    assertEquals(result.candidates, []);

    assertEquals(
      result.rejections[0].reason,
      'invalid_authority_record',
    );
  },
);

Deno.test(
  'A8.15.3 invalid empty semantic value fails closed',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          value: '',
        }),
      ]);

    assertEquals(result.candidates, []);

    assertEquals(
      result.rejections[0].reason,
      'invalid_authority_record',
    );
  },
);

Deno.test(
  'A8.15.3 duplicate authority record id fails closed',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record(),
        record({
          sourceValue: 'another-source-value',
        }),
      ]);

    assertEquals(result.candidates, []);

    assertEquals(
      result.rejections.map(
        (item) => item.reason,
      ),
      [
        'duplicate_authority_record_id',
        'duplicate_authority_record_id',
      ],
    );
  },
);

Deno.test(
  'A8.15.3 allows independent semantic dimensions for one exact selector',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          id: 'authority:tense',
          dimension: 'tense-axis',
          value: 'tense-value',
        }),
        record({
          id: 'authority:aspect',
          dimension: 'aspect-axis',
          value: 'aspect-value',
        }),
      ]);

    assertEquals(result.rejections, []);

    assertEquals(
      result.candidates.map(
        (candidate) => ({
          dimension:
            candidate.mappingRule.dimension,
          value:
            candidate.mappingRule.value,
        }),
      ),
      [
        {
          dimension: 'aspect-axis',
          value: 'aspect-value',
        },
        {
          dimension: 'tense-axis',
          value: 'tense-value',
        },
      ],
    );
  },
);

Deno.test(
  'A8.15.3 conflicting authorities inside one dimension fail closed',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          id: 'authority:a',
          dimension: 'same-axis',
          value: 'value:a',
        }),
        record({
          id: 'authority:b',
          dimension: 'same-axis',
          value: 'value:b',
        }),
      ]);

    assertEquals(result.candidates, []);

    assertEquals(
      result.rejections.map(
        (item) => item.reason,
      ),
      [
        'ambiguous_exact_authority',
        'ambiguous_exact_authority',
      ],
    );
  },
);

Deno.test(
  'A8.15.3 missing provenance does not create false authority ambiguity',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          id: 'authority:valid',
          dimension: 'same-axis',
          value: 'value:valid',
        }),
        record({
          id: 'authority:no-provenance',
          dimension: 'same-axis',
          value: 'value:other',
          provenanceIds: [],
        }),
      ]);

    assertEquals(
      result.candidates.length,
      1,
    );

    assertEquals(
      result.candidates[0]
        .authorityRecordId,
      'authority:valid',
    );

    assertEquals(
      result.rejections,
      [
        {
          authorityRecordId:
            'authority:no-provenance',
          reason:
            'authority_missing_provenance',
        },
      ],
    );
  },
);
Deno.test(
  'A8.15.3 independent selectors remain independent',
  () => {
    const result =
      deriveCanonicalTamDeclarativeMappingAuthorityV1([
        record({
          id: 'authority:a',
          sourceValue: 'source:a',
        }),
        record({
          id: 'authority:b',
          sourceValue: 'source:b',
        }),
      ]);

    assertEquals(result.rejections, []);
    assertEquals(result.candidates.length, 2);

    assertEquals(
      result.candidates.map(
        (candidate) =>
          candidate.mappingRule.sourceValue,
      ),
      ['source:a', 'source:b'],
    );
  },
);

Deno.test(
  'A8.15.3 does not mutate declarative authority records',
  () => {
    const input = record({
      provenanceIds: [
        'prov:a',
        'prov:a',
      ],
    });

    const before =
      JSON.stringify(input);

    deriveCanonicalTamDeclarativeMappingAuthorityV1([
      input,
    ]);

    assertEquals(
      JSON.stringify(input),
      before,
    );
  },
);
