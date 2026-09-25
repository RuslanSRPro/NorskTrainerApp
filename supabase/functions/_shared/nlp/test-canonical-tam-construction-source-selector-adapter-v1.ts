import {
  adaptCanonicalTamConstructionSourceSelectorsV1,
  type CanonicalTamConstructionSelectorOccurrenceV1,
  type CanonicalTamConstructionSelectorProvenanceV1,
} from './canonical-tam-construction-source-selector-adapter-v1.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function occurrence():
  CanonicalTamConstructionSelectorOccurrenceV1 {
  return {
    constructionId: 'construction:17',
    projectionId: 'projection:17',
    sourceCandidateCodes: ['grammar-source:17'],
    provenanceIds: ['prov:source-rule:17'],
  };
}

function provenance():
  CanonicalTamConstructionSelectorProvenanceV1[] {
  return [{
    id: 'prov:source-rule:17',
    sourceType: 'source_rule',
    sourceId: 'grammar-source:17',
  }];
}

Deno.test('TAM A8.7 emits selector from exact proven source candidate', () => {
  const result =
    adaptCanonicalTamConstructionSourceSelectorsV1(
      [occurrence()],
      provenance(),
    );

  assert(result.selectors.length === 1, 'expected one selector');
  assert(result.rejections.length === 0, 'expected no rejection');

  const selector = result.selectors[0];

  assert(
    selector.selectorKind ===
      'frozen_grammar_source_candidate_code',
    'selector kind must identify source authority',
  );
  assert(
    selector.selectorValue === 'grammar-source:17',
    'source candidate identity must survive exactly',
  );
  assert(
    selector.sourceId === 'grammar-source:17',
    'source id must remain source-backed',
  );
  assert(
    selector.provenanceIds.includes('prov:source-rule:17'),
    'source provenance must survive',
  );
});

Deno.test('TAM A8.7 rejects candidate code without matching source-rule provenance', () => {
  const result =
    adaptCanonicalTamConstructionSourceSelectorsV1(
      [occurrence()],
      [{
        id: 'prov:source-rule:17',
        sourceType: 'runtime_fact',
        sourceId: 'grammar-source:17',
      }],
    );

  assert(result.selectors.length === 0, 'unproven code must fail');
  assert(
    result.rejections[0]?.reason === 'source_candidate_not_proven',
    'expected source provenance rejection',
  );
});

Deno.test('TAM A8.7 rejects unrelated source-rule provenance', () => {
  const result =
    adaptCanonicalTamConstructionSourceSelectorsV1(
      [occurrence()],
      [{
        id: 'prov:source-rule:17',
        sourceType: 'source_rule',
        sourceId: 'grammar-source:other',
      }],
    );

  assert(result.selectors.length === 0, 'unrelated provenance must fail');
  assert(
    result.rejections[0]?.reason === 'source_candidate_not_proven',
    'expected exact source identity check',
  );
});

Deno.test('TAM A8.7 uses only provenance referenced by the occurrence', () => {
  const result =
    adaptCanonicalTamConstructionSourceSelectorsV1(
      [occurrence()],
      [{
        id: 'prov:not-referenced',
        sourceType: 'source_rule',
        sourceId: 'grammar-source:17',
      }],
    );

  assert(result.selectors.length === 0, 'global provenance must not authorize');
  assert(
    result.rejections[0]?.reason === 'source_candidate_not_proven',
    'expected occurrence-local provenance requirement',
  );
});

Deno.test('TAM A8.7 fails closed when multiple source candidates are proven', () => {
  const source = occurrence();
  source.sourceCandidateCodes = [
    'grammar-source:17',
    'grammar-source:18',
  ];
  source.provenanceIds = [
    'prov:source-rule:17',
    'prov:source-rule:18',
  ];

  const result =
    adaptCanonicalTamConstructionSourceSelectorsV1(
      [source],
      [
        ...provenance(),
        {
          id: 'prov:source-rule:18',
          sourceType: 'source_rule',
          sourceId: 'grammar-source:18',
        },
      ],
    );

  assert(result.selectors.length === 0, 'ambiguity must fail closed');
  assert(
    result.rejections[0]?.reason === 'ambiguous_source_candidate',
    'expected ambiguity rejection',
  );
});

Deno.test('TAM A8.7 rejects occurrence without source candidate identity', () => {
  const source = occurrence();
  source.sourceCandidateCodes = [];

  const result =
    adaptCanonicalTamConstructionSourceSelectorsV1(
      [source],
      provenance(),
    );

  assert(result.selectors.length === 0, 'missing source identity must fail');
  assert(
    result.rejections[0]?.reason === 'invalid_construction_occurrence',
    'expected invalid occurrence',
  );
});

Deno.test('TAM A8.7 rejects occurrence without provenance references', () => {
  const source = occurrence();
  source.provenanceIds = [];

  const result =
    adaptCanonicalTamConstructionSourceSelectorsV1(
      [source],
      provenance(),
    );

  assert(result.selectors.length === 0, 'missing provenance must fail');
  assert(
    result.rejections[0]?.reason === 'invalid_construction_occurrence',
    'expected invalid occurrence',
  );
});

Deno.test('TAM A8.7 does not use construction or projection naming as selector', () => {
  const source = occurrence();
  source.constructionId = 'present_perfect';
  source.projectionId = 'past_perfect';

  const result =
    adaptCanonicalTamConstructionSourceSelectorsV1(
      [source],
      provenance(),
    );

  assert(result.selectors.length === 1, 'source-backed selector expected');
  assert(
    result.selectors[0].selectorValue === 'grammar-source:17',
    'selector must come only from source candidate identity',
  );
});

Deno.test('TAM A8.7 does not create registry or TAM semantics', () => {
  const result =
    adaptCanonicalTamConstructionSourceSelectorsV1(
      [occurrence()],
      provenance(),
    );

  const selector =
    result.selectors[0] as unknown as Record<string, unknown>;

  assert(!('registryFormKey' in selector), 'must not map registry key');
  assert(!('aspect' in selector), 'must not create aspect');
  assert(!('tense' in selector), 'must not create tense');
  assert(!('mood' in selector), 'must not create mood');
  assert(!('tamStatus' in selector), 'must not resolve TAM');
});
