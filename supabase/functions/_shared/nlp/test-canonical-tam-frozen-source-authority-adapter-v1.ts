import {
  adaptCanonicalTamFrozenSourceAuthorityV1,
  CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_V1,
  CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_VERSION_V1,
  type CanonicalTamFrozenSourceSnapshotV1,
} from './canonical-tam-frozen-source-authority-adapter-v1.ts';

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(
  actual: unknown,
  expected: unknown,
): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  assert(
    actualJson === expectedJson,
    `Expected ${expectedJson}, got ${actualJson}`,
  );
}

function snapshot(
  candidateOverrides:
    Record<string, unknown> = {},
): CanonicalTamFrozenSourceSnapshotV1 {
  return {
    snapshotId: 'snapshot:1',
    readOnly: true,
    writePerformed: false,
    frozenGrammarImmutable: true,

    candidates: [
      {
        candidate_id: 'candidate:1',
        candidate_code: 'opaque.candidate',
        status: 'source_verified',
        requires_human_verification: false,

        extracted_payload: {
          semantic_assertions: [
            {
              id: 'assertion:1',
              domain: 'tam',
              sourceKind: 'opaque_source_kind',
              sourceKey: 'opaque_source_key',
              sourceValue: 'opaque_source_value',
              scope: 'construction',
              dimension: 'opaque_dimension',
              value: 'opaque_value',
              provenanceIds: [
                'prov:source:semantic',
              ],
            },
          ],
        },

        ...candidateOverrides,
      },
    ],
  };
}

Deno.test(
  'A8.15.7 emits explicit TAM authority without semantic inference',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot(),
      );

    assertEquals(result.rejections, []);

    assertEquals(
      result.authorityRecords.length,
      1,
    );

    const record =
      result.authorityRecords[0];

    assertEquals(
      {
        sourceKind: record.sourceKind,
        sourceKey: record.sourceKey,
        sourceValue: record.sourceValue,
        scope: record.scope,
        dimension: record.dimension,
        value: record.value,
      },
      {
        sourceKind: 'opaque_source_kind',
        sourceKey: 'opaque_source_key',
        sourceValue: 'opaque_source_value',
        scope: 'construction',
        dimension: 'opaque_dimension',
        value: 'opaque_value',
      },
    );
  },
);

Deno.test(
  'A8.15.7 preserves frozen source and assertion identity',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot(),
      );

    const record =
      result.authorityRecords[0];

    assertEquals(
      record.id,
      'tam-authority:candidate:1:assertion:1',
    );

    assertEquals(
      record.authoritySourceId,
      'frozen-grammar:snapshot:1:candidate:1:assertion:1',
    );
  },
);

Deno.test(
  'A8.15.7 preserves explicit source provenance without fabrication',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot(),
      );

    assertEquals(
      result.authorityRecords[0]
        .provenanceIds,
      [
        'prov:source:semantic',
      ],
    );
  },
);

Deno.test(
  'A8.15.7 emits nothing when explicit semantic assertions are absent',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot({
          extracted_payload: {},
        }),
      );

    assertEquals(
      result.authorityRecords,
      [],
    );

    assertEquals(result.rejections, []);
  },
);

Deno.test(
  'A8.15.7 ignores non-TAM semantic assertions',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot({
          extracted_payload: {
            semantic_assertions: [
              {
                id: 'assertion:other',
                domain: 'other-domain',
                sourceKind: 'opaque',
                sourceKey: 'opaque',
                sourceValue: 'opaque',
                scope: 'construction',
                dimension: 'opaque',
                value: 'opaque',
                provenanceIds: ['prov:other'],
              },
            ],
          },
        }),
      );

    assertEquals(
      result.authorityRecords,
      [],
    );

    assertEquals(result.rejections, []);
  },
);

Deno.test(
  'A8.15.7 does not derive TAM semantics from candidate code',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot({
          candidate_code:
            'verb.tense.forms.present_perfect',
          extracted_payload: {},
        }),
      );

    assertEquals(
      result.authorityRecords,
      [],
    );
  },
);

Deno.test(
  'A8.15.7 does not derive TAM semantics from TenseProfile-like payload',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot({
          extracted_payload: {
            TenseProfile: 'PresentPerfect',
          },
        }),
      );

    assertEquals(
      result.authorityRecords,
      [],
    );
  },
);

Deno.test(
  'A8.15.7 blocks unverified candidate authority',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot({
          status: 'pending',
        }),
      );

    assertEquals(
      result.authorityRecords,
      [],
    );

    assertEquals(
      result.rejections[0].reason,
      'candidate_not_source_verified',
    );
  },
);

Deno.test(
  'A8.15.7 blocks candidate requiring human verification',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot({
          requires_human_verification: true,
        }),
      );

    assertEquals(
      result.authorityRecords,
      [],
    );

    assertEquals(
      result.rejections[0].reason,
      'candidate_requires_human_verification',
    );
  },
);

Deno.test(
  'A8.15.7 blocks non-read-only snapshot',
  () => {
    const input = snapshot();

    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1({
        ...input,
        readOnly: false,
      });

    assertEquals(
      result.authorityRecords,
      [],
    );

    assertEquals(
      result.rejections[0].reason,
      'snapshot_not_read_only',
    );
  },
);

Deno.test(
  'A8.15.7 blocks snapshot reporting a write',
  () => {
    const input = snapshot();

    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1({
        ...input,
        writePerformed: true,
      });

    assertEquals(
      result.authorityRecords,
      [],
    );

    assertEquals(
      result.rejections[0].reason,
      'snapshot_write_performed',
    );
  },
);

Deno.test(
  'A8.15.7 blocks non-frozen grammar snapshot',
  () => {
    const input = snapshot();

    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1({
        ...input,
        frozenGrammarImmutable:
          false,
      });

    assertEquals(
      result.authorityRecords,
      [],
    );

    assertEquals(
      result.rejections[0].reason,
      'snapshot_not_frozen',
    );
  },
);

Deno.test(
  'A8.15.7 rejects invalid TAM assertion without partial fabrication',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot({
          extracted_payload: {
            semantic_assertions: [
              {
                id: 'assertion:1',
                domain: 'tam',
                sourceKind: 'opaque',
                sourceKey: 'opaque',
                sourceValue: 'opaque',
                scope: 'construction',
                dimension: 'opaque',
              },
            ],
          },
        }),
      );

    assertEquals(
      result.authorityRecords,
      [],
    );

    assertEquals(
      result.rejections[0].reason,
      'invalid_semantic_assertion',
    );
  },
);

Deno.test(
  'A8.15.7 rejects TAM assertion without provenance',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot({
          extracted_payload: {
            semantic_assertions: [
              {
                id: 'assertion:1',
                domain: 'tam',
                sourceKind: 'opaque',
                sourceKey: 'opaque',
                sourceValue: 'opaque',
                scope: 'construction',
                dimension: 'opaque',
                value: 'opaque',
                provenanceIds: [],
              },
            ],
          },
        }),
      );

    assertEquals(
      result.authorityRecords,
      [],
    );

    assertEquals(
      result.rejections[0].reason,
      'semantic_assertion_missing_provenance',
    );
  },
);

Deno.test(
  'A8.15.7 identifies adapter producer and version',
  () => {
    const result =
      adaptCanonicalTamFrozenSourceAuthorityV1(
        snapshot(),
      );

    assertEquals(
      result.adapter,
      CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_V1,
    );

    assertEquals(
      result.adapterVersion,
      CANONICAL_TAM_FROZEN_SOURCE_AUTHORITY_ADAPTER_VERSION_V1,
    );
  },
);

Deno.test(
  'A8.15.7 does not mutate frozen snapshot input',
  () => {
    const input = snapshot();

    const before =
      JSON.stringify(input);

    adaptCanonicalTamFrozenSourceAuthorityV1(
      input,
    );

    assertEquals(
      JSON.stringify(input),
      before,
    );
  },
);