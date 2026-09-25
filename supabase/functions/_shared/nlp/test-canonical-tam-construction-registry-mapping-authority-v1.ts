import {
  mapCanonicalTamConstructionRegistryAuthorityV1,
  type CanonicalTamConstructionRegistryMappingAuthorityRecordV1,
  type CanonicalTamConstructionSourceSelectorV1,
} from './canonical-tam-construction-registry-mapping-authority-v1.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const selector = (): CanonicalTamConstructionSourceSelectorV1 => ({
  selectorKind: 'source-contract-key',
  selectorValue: 'source-value-17',
  sourceId: 'source-selector:17',
  provenanceIds: ['prov:source-selector:17'],
});

const mapping = ():
  CanonicalTamConstructionRegistryMappingAuthorityRecordV1 => ({
    id: 'mapping:17',
    selectorKind: 'source-contract-key',
    selectorValue: 'source-value-17',
    registryFormKey: 'registry-form:17',
    authoritySourceId: 'mapping-authority:17',
    provenanceIds: ['prov:mapping-authority:17'],
  });

Deno.test('TAM A8.5 maps an exact explicit source selector to registry form key', () => {
  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [selector()],
    [mapping()],
  );

  assert(result.candidates.length === 1, 'expected one candidate');
  assert(result.rejections.length === 0, 'expected no rejection');

  const candidate = result.candidates[0];

  assert(candidate.status === 'candidate', 'must remain candidate');
  assert(
    candidate.registryFormKey === 'registry-form:17',
    'registry form key must be preserved exactly',
  );
  assert(
    candidate.sourceId === 'source-selector:17',
    'selector source identity must survive',
  );
  assert(
    candidate.authoritySourceId === 'mapping-authority:17',
    'mapping authority identity must survive',
  );
});

Deno.test('TAM A8.5 fails closed without an explicit mapping', () => {
  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [selector()],
    [],
  );

  assert(result.candidates.length === 0, 'implicit mapping is forbidden');
  assert(
    result.rejections[0]?.reason === 'no_exact_mapping',
    'expected no_exact_mapping',
  );
});

Deno.test('TAM A8.5 requires exact selector kind and value', () => {
  const wrong = mapping();
  wrong.selectorValue = 'different-value';

  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [selector()],
    [wrong],
  );

  assert(result.candidates.length === 0, 'non-exact selector must not map');
  assert(
    result.rejections[0]?.reason === 'no_exact_mapping',
    'expected exact-match failure',
  );
});

Deno.test('TAM A8.5 fails closed on ambiguous exact mappings', () => {
  const second = mapping();
  second.id = 'mapping:18';
  second.registryFormKey = 'registry-form:18';

  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [selector()],
    [mapping(), second],
  );

  assert(result.candidates.length === 0, 'ambiguous mapping must fail');
  assert(
    result.rejections[0]?.reason === 'ambiguous_exact_mapping',
    'expected ambiguity rejection',
  );
});

Deno.test('TAM A8.5 requires source-selector provenance', () => {
  const source = selector();
  source.provenanceIds = [];

  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [source],
    [mapping()],
  );

  assert(result.candidates.length === 0, 'unproven selector must fail');
  assert(
    result.rejections[0]?.reason === 'invalid_source_selector',
    'expected selector rejection',
  );
});

Deno.test('TAM A8.5 requires mapping provenance', () => {
  const authority = mapping();
  authority.provenanceIds = [];

  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [selector()],
    [authority],
  );

  assert(result.candidates.length === 0, 'unproven mapping must fail');
  assert(
    result.rejections[0]?.reason === 'mapping_missing_provenance',
    'expected mapping provenance rejection',
  );
});

Deno.test('TAM A8.5 rejects an invalid explicit mapping', () => {
  const authority = mapping();
  authority.registryFormKey = '';

  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [selector()],
    [authority],
  );

  assert(result.candidates.length === 0, 'invalid mapping must fail');
  assert(
    result.rejections[0]?.reason === 'invalid_mapping',
    'expected invalid_mapping',
  );
});

Deno.test('TAM A8.5 does not map similar selector strings', () => {
  const source = selector();
  source.selectorValue = 'source-value-17-extra';

  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [source],
    [mapping()],
  );

  assert(result.candidates.length === 0, 'substring matching is forbidden');
  assert(
    result.rejections[0]?.reason === 'no_exact_mapping',
    'expected exact matching only',
  );
});

Deno.test('TAM A8.5 contains no built-in Norwegian construction mapping', () => {
  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [{
      selectorKind: 'construction-label',
      selectorValue: 'present_perfect',
      sourceId: 'source:pp',
      provenanceIds: ['prov:pp'],
    }],
    [],
  );

  assert(result.candidates.length === 0, 'no built-in mapping is allowed');
  assert(
    result.rejections[0]?.reason === 'no_exact_mapping',
    'explicit authority must be supplied',
  );
});

Deno.test('TAM A8.5 does not create TAM semantics or runtime binding', () => {
  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [selector()],
    [mapping()],
  );

  const candidate =
    result.candidates[0] as unknown as Record<string, unknown>;

  assert(!('aspect' in candidate), 'must not create aspect');
  assert(!('tense' in candidate), 'must not create tense');
  assert(!('mood' in candidate), 'must not create mood');
  assert(!('constructionId' in candidate), 'must not bind occurrence');
  assert(!('projectionId' in candidate), 'must not bind projection');
  assert(!('tamStatus' in candidate), 'must not resolve TAM');
});

Deno.test('TAM A8.5 preserves both selector and authority provenance', () => {
  const result = mapCanonicalTamConstructionRegistryAuthorityV1(
    [selector()],
    [mapping()],
  );

  const provenance = result.candidates[0].provenanceIds;

  assert(
    provenance.includes('prov:source-selector:17'),
    'selector provenance missing',
  );
  assert(
    provenance.includes('prov:mapping-authority:17'),
    'authority provenance missing',
  );
});
