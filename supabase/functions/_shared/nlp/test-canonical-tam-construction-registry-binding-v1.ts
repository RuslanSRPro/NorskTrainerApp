import {
  bindCanonicalTamConstructionRegistryV1,
  type CanonicalTamConstructionOccurrenceV1,
  type CanonicalTamConstructionRegistryBindingRuleV1,
  type CanonicalTamConstructionRegistryEntryV1,
} from './canonical-tam-construction-registry-binding-v1.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const occurrence = (): CanonicalTamConstructionOccurrenceV1 => ({
  constructionId: 'construction:17',
  projectionId: 'projection:31',
  anchorTokenId: 'token:2',
  memberTokenIds: ['token:1', 'token:2'],
  provenanceIds: ['prov:construction:17'],
});

const registry = (
  formScope: 'token' | 'construction' = 'construction',
): CanonicalTamConstructionRegistryEntryV1 => ({
  formKey: 'registry-form:perfect-17',
  formScope,
  canonicalFeatures: {
    TenseProfile: 'PresentPerfect',
  },
  sourceId: 'registry-source:perfect-17',
  provenanceIds: ['prov:registry:perfect-17'],
});

const rule = (): CanonicalTamConstructionRegistryBindingRuleV1 => ({
  id: 'binding-rule:17',
  constructionId: 'construction:17',
  projectionId: 'projection:31',
  registryFormKey: 'registry-form:perfect-17',
  provenanceIds: ['prov:binding-rule:17'],
});

Deno.test('TAM A8.2 binds exact construction occurrence to explicit construction registry key', () => {
  const result = bindCanonicalTamConstructionRegistryV1(
    [occurrence()],
    [registry()],
    [rule()],
  );

  assert(result.bindings.length === 1, 'expected one binding');
  assert(result.rejections.length === 0, 'expected no rejection');

  const bound = result.bindings[0];

  assert(bound.status === 'candidate', 'binding must remain candidate');
  assert(
    bound.registryFormKey === 'registry-form:perfect-17',
    'registry form key must be preserved exactly',
  );
  assert(
    bound.canonicalFeatures.TenseProfile === 'PresentPerfect',
    'source feature must be transported without semantic interpretation',
  );
  assert(
    bound.provenanceIds.includes('prov:construction:17') &&
      bound.provenanceIds.includes('prov:binding-rule:17') &&
      bound.provenanceIds.includes('prov:registry:perfect-17'),
    'all provenance layers must survive',
  );
});

Deno.test('TAM A8.2 fails closed without explicit binding rule', () => {
  const result = bindCanonicalTamConstructionRegistryV1(
    [occurrence()],
    [registry()],
    [],
  );

  assert(result.bindings.length === 0, 'must not bind implicitly');
  assert(
    result.rejections[0]?.reason === 'no_exact_binding',
    'expected no_exact_binding',
  );
});

Deno.test('TAM A8.2 requires exact construction and projection identity', () => {
  const wrongRule = rule();
  wrongRule.projectionId = 'projection:other';

  const result = bindCanonicalTamConstructionRegistryV1(
    [occurrence()],
    [registry()],
    [wrongRule],
  );

  assert(result.bindings.length === 0, 'wrong occurrence must not bind');
  assert(
    result.rejections[0]?.reason === 'no_exact_binding',
    'expected exact identity failure',
  );
});

Deno.test('TAM A8.2 fails closed on ambiguous exact bindings', () => {
  const second = rule();
  second.id = 'binding-rule:18';
  second.registryFormKey = 'registry-form:other';

  const result = bindCanonicalTamConstructionRegistryV1(
    [occurrence()],
    [registry()],
    [rule(), second],
  );

  assert(result.bindings.length === 0, 'ambiguous rules must not bind');
  assert(
    result.rejections[0]?.reason === 'ambiguous_exact_binding',
    'expected ambiguity rejection',
  );
});

Deno.test('TAM A8.2 requires binding provenance', () => {
  const missing = rule();
  missing.provenanceIds = [];

  const result = bindCanonicalTamConstructionRegistryV1(
    [occurrence()],
    [registry()],
    [missing],
  );

  assert(result.bindings.length === 0, 'unproven binding must fail');
  assert(
    result.rejections[0]?.reason === 'binding_missing_provenance',
    'expected binding provenance rejection',
  );
});

Deno.test('TAM A8.2 rejects token-scoped registry entry', () => {
  const result = bindCanonicalTamConstructionRegistryV1(
    [occurrence()],
    [registry('token')],
    [rule()],
  );

  assert(result.bindings.length === 0, 'token registry row must not bind');
  assert(
    result.rejections[0]?.reason === 'registry_entry_not_construction_scoped',
    'expected construction-scope rejection',
  );
});

Deno.test('TAM A8.2 requires registry provenance', () => {
  const entry = registry();
  entry.provenanceIds = [];

  const result = bindCanonicalTamConstructionRegistryV1(
    [occurrence()],
    [entry],
    [rule()],
  );

  assert(result.bindings.length === 0, 'unproven registry row must fail');
  assert(
    result.rejections[0]?.reason === 'registry_entry_missing_provenance',
    'expected registry provenance rejection',
  );
});

Deno.test('TAM A8.2 does not infer registry key from construction-like names', () => {
  const namedOccurrence = occurrence();
  namedOccurrence.constructionId = 'present_perfect';
  namedOccurrence.projectionId = 'present_perfect';

  const namedRegistry = registry();
  namedRegistry.formKey = 'present_perfect';

  const result = bindCanonicalTamConstructionRegistryV1(
    [namedOccurrence],
    [namedRegistry],
    [],
  );

  assert(result.bindings.length === 0, 'name equality must not create binding');
  assert(
    result.rejections[0]?.reason === 'no_exact_binding',
    'explicit binding must still be required',
  );
});

Deno.test('TAM A8.2 transports TenseProfile but does not create aspect semantics', () => {
  const result = bindCanonicalTamConstructionRegistryV1(
    [occurrence()],
    [registry()],
    [rule()],
  );

  const bound = result.bindings[0];

  assert(
    bound.canonicalFeatures.TenseProfile === 'PresentPerfect',
    'TenseProfile must remain source evidence',
  );
  assert(
    !('aspect' in bound.canonicalFeatures),
    'A8.2 must not synthesize aspect',
  );
  assert(
    !('tamStatus' in (bound as unknown as Record<string, unknown>)),
    'A8.2 must not resolve TAM',
  );
});
