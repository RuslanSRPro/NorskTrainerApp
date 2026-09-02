import { buildCanonicalSurfaceDocumentV1 } from './canonical-surface-boundary-v1.ts';
import {
  applyGraphPatchV1,
  assertCanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
} from './canonical-language-graph-core-v1.ts';
import {
  buildCanonicalCandidateLatticePatchV1,
  summarizeCanonicalCandidateLatticePatchV1,
  type CanonicalMorphRegistryEntryV1,
  type CanonicalSurfaceCandidateBatchRowV1,
} from './canonical-candidate-lattice-v1.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const registry: CanonicalMorphRegistryEntryV1[] = [
  { pos: 'noun', form_key: 'singular_indefinite', form_scope: 'token', canonical_features: { Number: 'Sing', Definite: 'Ind' } },
  { pos: 'noun', form_key: 'plural_indefinite', form_scope: 'token', canonical_features: { Number: 'Plur', Definite: 'Ind' } },
  { pos: 'verb', form_key: 'present', form_scope: 'token', canonical_features: { VerbForm: 'Fin', Tense: 'Pres' } },
  { pos: 'verb', form_key: 'past', form_scope: 'token', canonical_features: { VerbForm: 'Fin', Tense: 'Past' } },
  { pos: 'verb', form_key: 'infinitive', form_scope: 'token', canonical_features: { VerbForm: 'Inf' } },
  { pos: 'adjective', form_key: 'positive_common', form_scope: 'token', canonical_features: { Degree: 'Pos', Gender: 'Com' } },
  { pos: 'adjective', form_key: 'positive_plural', form_scope: 'token', canonical_features: { Degree: 'Pos', Number: 'Plur' } },
  { pos: 'verb', form_key: 'present_perfect', form_scope: 'construction', canonical_features: { TenseProfile: 'PresentPerfect' } },
];

function assertPatchGate(
  text: string,
  batch: CanonicalSurfaceCandidateBatchRowV1[],
) {
  const surface = buildCanonicalSurfaceDocumentV1(text);
  const patch = buildCanonicalCandidateLatticePatchV1(surface, batch, registry);
  const summary = summarizeCanonicalCandidateLatticePatchV1(patch);

  assert(summary.resolvedFacts === 0, `resolvedFacts=${summary.resolvedFacts}`);
  assert(
    (patch.nodes ?? []).every((n) => n.status === 'candidate'),
    'v1.41 must keep every lattice node candidate',
  );
  assert(
    (patch.edges ?? []).every((e) => e.status === 'candidate'),
    'v1.41 must keep every lattice edge candidate',
  );
  assert(
    (patch.alternativeSets ?? []).every((s) =>
      s.status === 'open' && s.resolvedMemberIds.length === 0
    ),
    'v1.41 alternative sets must remain open',
  );
  assert(
    !(patch.nodes ?? []).some((n) =>
      n.type === 'morph_reading' && n.features.formScope === 'construction'
    ),
    'construction-scoped forms must never become token morphology',
  );

  let graph = createCanonicalLanguageGraphV1(surface);
  graph = applyGraphPatchV1(graph, patch);
  const graphErrors = assertCanonicalLanguageGraphV1(graph);
  assert(graphErrors.length === 0, `graph invariant errors: ${graphErrors.join(', ')}`);

  return { surface, patch, summary, graphErrors };
}

Deno.test('v1.41 core lattice preserves lexical/POS/morph ambiguity', () => {
  const batch: CanonicalSurfaceCandidateBatchRowV1[] = [
    {
      normalized_surface: 'passer',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000001',
          lemma: 'pass',
          source_pos: 'noun',
          form_types: ['plural_indefinite'],
          sources: ['noun_forms'],
          evidence: [],
          identity_basis: 'dedicated_form_table',
          identity_strength: 'strong_form_support',
        },
        {
          lexeme_id: '00000000-0000-0000-0000-000000000002',
          lemma: 'passe',
          source_pos: 'verb',
          form_types: ['present'],
          sources: ['verb_forms'],
          evidence: [],
          identity_basis: 'dedicated_form_table',
          identity_strength: 'strong_form_support',
        },
      ],
    },
    {
      normalized_surface: 'hus',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000003',
          lemma: 'hus',
          source_pos: 'noun',
          form_types: ['singular_indefinite', 'plural_indefinite'],
          sources: ['noun_forms', 'lexeme_form_variants'],
          evidence: [],
          identity_basis: 'mixed_form_evidence',
          identity_strength: 'strong_form_support',
        },
      ],
    },
    {
      normalized_surface: 'ville',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000004',
          lemma: 'ville',
          source_pos: 'verb',
          form_types: ['past', 'infinitive', 'present_perfect'],
          sources: ['verb_forms'],
          evidence: [],
          identity_basis: 'dedicated_form_table',
          identity_strength: 'strong_form_support',
        },
      ],
    },
    { normalized_surface: 'xyz', candidates: [] },
  ];

  const { surface, patch, summary, graphErrors } =
    assertPatchGate('passer hus ville xyz', batch);

  assert(summary.lexicalCandidates === 4, `lexicalCandidates=${summary.lexicalCandidates}`);
  assert(summary.posCandidates === 4, `posCandidates=${summary.posCandidates}`);
  assert(summary.morphCandidates === 6, `morphCandidates=${summary.morphCandidates}`);
  assert(summary.unknownWordTokens === 1, `unknownWordTokens=${summary.unknownWordTokens}`);

  const passer = surface.tokens.find((t) => t.normalizedSurface === 'passer');
  assert(passer, 'missing passer token');
  const passerLex = (patch.nodes ?? []).filter((n) =>
    n.type === 'lexical_reading' &&
    n.subtype === 'lexical_candidate' &&
    n.span?.tokenIds?.includes(passer.id)
  );
  assert(passerLex.length === 2, `passer lexical candidates=${passerLex.length}`);

  const passerPos = new Set(
    (patch.nodes ?? [])
      .filter((n) =>
        n.type === 'lexical_reading' &&
        n.subtype === 'pos_candidate' &&
        n.span?.tokenIds?.includes(passer.id)
      )
      .map((n) => n.features.pos),
  );
  assert(passerPos.has('noun') && passerPos.has('verb'), 'passer must preserve noun+verb POS hypotheses');

  const hus = surface.tokens.find((t) => t.normalizedSurface === 'hus');
  assert(hus, 'missing hus token');
  const husLexSet = (patch.alternativeSets ?? []).find((s) => s.id === `alt:lexical:${hus.id}`);
  assert(husLexSet?.memberIds.length === 1, 'hus lexical set should keep its singleton candidate');
  assert(husLexSet.status === 'open', 'single lexical candidate must not auto-resolve');

  assert(
    !(patch.nodes ?? []).some((n) =>
      n.type === 'morph_reading' && n.features.formKey === 'present_perfect'
    ),
    'present_perfect construction must not become token morphology',
  );

  console.log(JSON.stringify({ case: 'core', ok: true, summary, graphErrors }, null, 2));
});

Deno.test('v1.41 suspicious and incomplete source observations remain evidence, not truth', () => {
  const batch: CanonicalSurfaceCandidateBatchRowV1[] = [
    {
      normalized_surface: 'finne',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000011',
          lemma: 'finne',
          source_pos: 'noun',
          form_types: ['singular_indefinite'],
          sources: ['noun_forms'],
          identity_basis: 'dedicated_form_table',
          identity_strength: 'strong_form_support',
        },
        {
          lexeme_id: '00000000-0000-0000-0000-000000000012',
          lemma: 'finne',
          source_pos: 'verb',
          form_types: ['infinitive'],
          sources: ['verb_forms'],
          identity_basis: 'dedicated_form_table',
          identity_strength: 'strong_form_support',
        },
      ],
    },
    {
      normalized_surface: 'finner',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000013',
          lemma: 'finne',
          source_pos: 'noun',
          form_types: ['plural_indefinite'],
          sources: ['noun_forms'],
          identity_basis: 'dedicated_form_table',
          identity_strength: 'strong_form_support',
        },
        {
          lexeme_id: '00000000-0000-0000-0000-000000000014',
          lemma: 'finne',
          source_pos: 'verb',
          form_types: ['present'],
          sources: ['verb_forms'],
          identity_basis: 'dedicated_form_table',
          identity_strength: 'strong_form_support',
        },
      ],
    },
    {
      normalized_surface: 'greie',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000015',
          lemma: 'gre',
          source_pos: 'verb',
          form_types: ['infinitive'],
          sources: ['lexeme_form_variants'],
          identity_basis: 'variant_only',
          identity_strength: 'tentative_form_mapping',
          requires_sense_validation: true,
        },
      ],
    },
    {
      normalized_surface: 'på',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000016',
          lemma: 'på',
          source_pos: 'noun',
          form_types: [],
          sources: ['lexemes'],
          identity_basis: 'exact_surface_lexeme',
          identity_strength: 'direct_surface_identity',
        },
      ],
    },
  ];

  const { surface, patch, summary, graphErrors } =
    assertPatchGate('finne finner greie på', batch);

  for (const word of ['finne', 'finner']) {
    const token = surface.tokens.find((t) => t.normalizedSurface === word);
    assert(token, `missing ${word}`);
    const posSet = (patch.alternativeSets ?? []).find((s) => s.id === `alt:pos:${token.id}`);
    assert(posSet?.memberIds.length === 2, `${word} must preserve two POS hypotheses`);
    assert(posSet.status === 'open', `${word} POS must remain open in v1.41`);
  }

  const greie = surface.tokens.find((t) => t.normalizedSurface === 'greie');
  assert(greie, 'missing greie');
  const greieLex = (patch.nodes ?? []).find((n) =>
    n.type === 'lexical_reading' &&
    n.subtype === 'lexical_candidate' &&
    n.span?.tokenIds?.includes(greie.id)
  );
  assert(greieLex, 'greie candidate missing');
  assert(greieLex.features.requiresSenseValidation === true, 'variant-only greie mapping must retain sense-validation requirement');
  const greieSet = (patch.alternativeSets ?? []).find((s) => s.id === `alt:lexical:${greie.id}`);
  assert(greieSet?.status === 'open', 'suspicious singleton must not become truth');

  const paa = surface.tokens.find((t) => t.normalizedSurface === 'på');
  assert(paa, 'missing på');
  const paaSet = (patch.alternativeSets ?? []).find((s) => s.id === `alt:lexical:${paa.id}`);
  assert(paaSet?.memberIds.length === 1 && paaSet.status === 'open', 'incomplete på source must remain an open singleton candidate');

  console.log(JSON.stringify({ case: 'source_uncertainty', ok: true, summary, graphErrors }, null, 2));
});

Deno.test('v1.41 repeated normalized surfaces keep separate token identity and punctuation is untouched', () => {
  const batch: CanonicalSurfaceCandidateBatchRowV1[] = [
    {
      normalized_surface: 'på',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000021',
          lemma: 'på',
          source_pos: 'noun',
          form_types: [],
          sources: ['lexemes'],
          identity_basis: 'exact_surface_lexeme',
          identity_strength: 'direct_surface_identity',
        },
      ],
    },
  ];

  const { surface, patch, summary, graphErrors } =
    assertPatchGate('På på.', batch);

  const wordTokens = surface.tokens.filter((t) => t.kind === 'word');
  assert(wordTokens.length === 2, `wordTokens=${wordTokens.length}`);
  assert(wordTokens[0].normalizedSurface === 'på' && wordTokens[1].normalizedSurface === 'på', 'normalized surfaces mismatch');
  assert(wordTokens[0].id !== wordTokens[1].id, 'repeated surface tokens must keep distinct stable IDs');

  const lexicalSets = (patch.alternativeSets ?? []).filter((s) => s.id.startsWith('alt:lexical:'));
  assert(lexicalSets.length === 2, `lexicalSets=${lexicalSets.length}`);

  const punctuation = surface.tokens.find((t) => t.kind === 'punctuation');
  assert(punctuation, 'punctuation token missing');
  assert(
    !(patch.nodes ?? []).some((n) => n.span?.tokenIds?.includes(punctuation.id)),
    'v1.41 must not create lexical/POS/morph candidates for punctuation',
  );

  console.log(JSON.stringify({ case: 'surface_identity', ok: true, summary, graphErrors }, null, 2));
});

Deno.test('v1.41 adjective and verb morphology stays packed and token-scoped', () => {
  const batch: CanonicalSurfaceCandidateBatchRowV1[] = [
    {
      normalized_surface: 'store',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000031',
          lemma: 'stor',
          source_pos: 'adjective',
          form_types: ['positive_common', 'positive_plural'],
          sources: ['adjective_forms'],
          identity_basis: 'dedicated_form_table',
          identity_strength: 'strong_form_support',
        },
      ],
    },
    {
      normalized_surface: 'ville',
      candidates: [
        {
          lexeme_id: '00000000-0000-0000-0000-000000000032',
          lemma: 'ville',
          source_pos: 'verb',
          form_types: ['past', 'infinitive', 'present_perfect'],
          sources: ['verb_forms'],
          identity_basis: 'dedicated_form_table',
          identity_strength: 'strong_form_support',
        },
      ],
    },
  ];

  const { surface, patch, summary, graphErrors } =
    assertPatchGate('store ville', batch);

  const store = surface.tokens.find((t) => t.normalizedSurface === 'store');
  assert(store, 'missing store');
  const storeMorph = (patch.nodes ?? []).filter((n) =>
    n.type === 'morph_reading' && n.span?.tokenIds?.includes(store.id)
  );
  assert(storeMorph.length === 2, `store morph candidates=${storeMorph.length}`);
  const storeLex = (patch.nodes ?? []).find((n) =>
    n.type === 'lexical_reading' &&
    n.subtype === 'lexical_candidate' &&
    n.span?.tokenIds?.includes(store.id)
  );
  assert(storeLex, 'missing store lexical candidate');
  const storeMorphSet = (patch.alternativeSets ?? []).find((s) => s.id === `alt:morph:${storeLex.id}`);
  assert(storeMorphSet?.memberIds.length === 2 && storeMorphSet.status === 'open', 'store morphology must remain packed/open');

  const ville = surface.tokens.find((t) => t.normalizedSurface === 'ville');
  assert(ville, 'missing ville');
  const villeMorphKeys = new Set(
    (patch.nodes ?? [])
      .filter((n) => n.type === 'morph_reading' && n.span?.tokenIds?.includes(ville.id))
      .map((n) => n.features.formKey),
  );
  assert(villeMorphKeys.has('past'), 'ville past candidate missing');
  assert(villeMorphKeys.has('infinitive'), 'ville infinitive candidate missing');
  assert(!villeMorphKeys.has('present_perfect'), 'ville present_perfect must remain construction-scoped');

  console.log(JSON.stringify({ case: 'morph_packing', ok: true, summary, graphErrors }, null, 2));
});
