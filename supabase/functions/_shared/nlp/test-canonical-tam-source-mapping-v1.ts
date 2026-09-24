import {
  mapCanonicalTamSourceFactsV1,
  type CanonicalTamSourceFactV1,
  type CanonicalTamSourceMappingRuleV1,
} from './canonical-tam-source-mapping-v1.ts';

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sourceFact(
  overrides:
    Partial<CanonicalTamSourceFactV1> = {},
): CanonicalTamSourceFactV1 {
  return {
    id: 'source-fact:1',
    predicateId: 'predicate:1',
    headTokenId: 'token:1',
    sourceKind: 'opaque_source_kind',
    sourceKey: 'opaque_source_key',
    sourceValue: 'opaque_source_value',
    sourceId: 'source:1',
    evidenceIds: ['evidence:1'],
    provenanceIds: ['provenance:source'],
    ...overrides,
  };
}

function mapping(
  overrides:
    Partial<
      CanonicalTamSourceMappingRuleV1
    > = {},
): CanonicalTamSourceMappingRuleV1 {
  return {
    id: 'mapping:1',
    sourceKind: 'opaque_source_kind',
    sourceKey: 'opaque_source_key',
    sourceValue: 'opaque_source_value',
    scope: 'construction',
    dimension: 'opaque_dimension',
    value: 'opaque_tam_value',
    provenanceIds: [
      'provenance:mapping',
    ],
    ...overrides,
  };
}

Deno.test(
  'TAM A2 maps only an exact explicit source selector',
  () => {
    const result =
      mapCanonicalTamSourceFactsV1(
        [sourceFact()],
        [mapping()],
      );

    assert(
      result.evidenceFacts.length === 1,
      'exact explicit mapping must produce one evidence fact',
    );

    assert(
      result.rejected.length === 0,
      'exact explicit mapping must not be rejected',
    );

    const evidence =
      result.evidenceFacts[0];

    assert(
      evidence.dimension ===
        'opaque_dimension' &&
      evidence.value ===
        'opaque_tam_value',
      'explicit TAM dimension/value must be preserved exactly',
    );

    assert(
      evidence.status ===
        'candidate',
      'A2 must not resolve TAM',
    );

    assert(
      evidence.predicateId ===
        'predicate:1' &&
      evidence.headTokenId ===
        'token:1',
      'occurrence identity must be preserved',
    );
  },
);

Deno.test(
  'TAM A2 does not infer from near-match source values',
  () => {
    const result =
      mapCanonicalTamSourceFactsV1(
        [
          sourceFact({
            sourceValue:
              'opaque_source_value_extra',
          }),
        ],
        [mapping()],
      );

    assert(
      result.evidenceFacts.length === 0,
      'near-match source value must not map',
    );

    assert(
      result.rejected.length === 1 &&
      result.rejected[0].reason ===
        'no_exact_mapping',
      'near match must fail closed',
    );
  },
);

Deno.test(
  'TAM A2 does not infer from source names or substrings',
  () => {
    const result =
      mapCanonicalTamSourceFactsV1(
        [
          sourceFact({
            sourceKind:
              'opaque_source_kind_present_perfect',
            sourceKey:
              'TenseProfile',
            sourceValue:
              'PresentPerfect',
          }),
        ],
        [],
      );

    assert(
      result.evidenceFacts.length === 0,
      'TAM-looking strings must not fabricate TAM',
    );

    assert(
      result.rejected.length === 1 &&
      result.rejected[0].reason ===
        'no_exact_mapping',
      'absence of explicit mapping must fail closed',
    );
  },
);

Deno.test(
  'TAM A2 reports an invalid exact mapping instead of disguising it as missing',
  () => {
    const result =
      mapCanonicalTamSourceFactsV1(
        [sourceFact()],
        [
          mapping({
            dimension: '',
          }),
        ],
      );

    assert(
      result.evidenceFacts.length === 0,
      'invalid exact mapping must not produce evidence',
    );

    assert(
      result.rejected.length === 1 &&
      result.rejected[0].reason ===
        'invalid_mapping',
      'invalid exact mapping must remain distinguishable from no mapping',
    );
  },
);

Deno.test(
  'TAM A2 rejects mapping without provenance',
  () => {
    const result =
      mapCanonicalTamSourceFactsV1(
        [sourceFact()],
        [
          mapping({
            provenanceIds: [],
          }),
        ],
      );

    assert(
      result.evidenceFacts.length === 0,
      'unproven mapping must not produce TAM evidence',
    );

    assert(
      result.rejected.length === 1 &&
      result.rejected[0].reason ===
        'mapping_missing_provenance',
      'mapping provenance is mandatory',
    );
  },
);

Deno.test(
  'TAM A2 rejects ambiguous exact mappings instead of choosing a winner',
  () => {
    const result =
      mapCanonicalTamSourceFactsV1(
        [sourceFact()],
        [
          mapping({
            id: 'mapping:a',
          }),
          mapping({
            id: 'mapping:b',
            dimension:
              'another_dimension',
            value:
              'another_value',
          }),
        ],
      );

    assert(
      result.evidenceFacts.length === 0,
      'ambiguous mappings must not produce evidence',
    );

    assert(
      result.rejected.length === 1 &&
      result.rejected[0].reason ===
        'ambiguous_exact_mapping',
      'A2 must not choose an implicit winner',
    );
  },
);

Deno.test(
  'TAM A2 preserves source and mapping provenance',
  () => {
    const result =
      mapCanonicalTamSourceFactsV1(
        [sourceFact()],
        [mapping()],
      );

    const evidence =
      result.evidenceFacts[0];

    assert(
      evidence.provenanceIds?.includes(
        'provenance:source',
      ),
      'source provenance must survive',
    );

    assert(
      evidence.provenanceIds?.includes(
        'provenance:mapping',
      ),
      'mapping provenance must survive',
    );

    assert(
      evidence.sourceIds?.includes(
        'source:1',
      ) &&
      evidence.sourceIds?.includes(
        'mapping:1',
      ),
      'source and mapping identities must survive',
    );
  },
);

Deno.test(
  'TAM A2 preserves dimension and value without cross-axis fabrication',
  () => {
    const result =
      mapCanonicalTamSourceFactsV1(
        [sourceFact()],
        [
          mapping({
            dimension:
              'dimension:a',
            value:
              'value:a',
          }),
        ],
      );

    assert(
      result.evidenceFacts.length === 1,
      'expected one mapped fact',
    );

    const evidence =
      result.evidenceFacts[0];

    assert(
      evidence.dimension ===
        'dimension:a',
      'dimension must come only from explicit mapping',
    );

    assert(
      evidence.value ===
        'value:a',
      'value must come only from explicit mapping',
    );
  },
);

