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

Deno.test('v1.41 canonical candidate lattice preserves ambiguity and graph invariants', () => {
const surface = buildCanonicalSurfaceDocumentV1('passer hus ville xyz');

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

const registry: CanonicalMorphRegistryEntryV1[] = [
  { pos: 'noun', form_key: 'singular_indefinite', form_scope: 'token', canonical_features: { Number: 'Sing', Definite: 'Ind' } },
  { pos: 'noun', form_key: 'plural_indefinite', form_scope: 'token', canonical_features: { Number: 'Plur', Definite: 'Ind' } },
  { pos: 'verb', form_key: 'present', form_scope: 'token', canonical_features: { VerbForm: 'Fin', Tense: 'Pres' } },
  { pos: 'verb', form_key: 'past', form_scope: 'token', canonical_features: { VerbForm: 'Fin', Tense: 'Past' } },
  { pos: 'verb', form_key: 'infinitive', form_scope: 'token', canonical_features: { VerbForm: 'Inf' } },
  { pos: 'verb', form_key: 'present_perfect', form_scope: 'construction', canonical_features: { TenseProfile: 'PresentPerfect' } },
];

const patch = buildCanonicalCandidateLatticePatchV1(surface, batch, registry);
const summary = summarizeCanonicalCandidateLatticePatchV1(patch);

assert(summary.lexicalCandidates === 4, `lexicalCandidates=${summary.lexicalCandidates}`);
assert(summary.posCandidates === 4, `posCandidates=${summary.posCandidates}`);
assert(summary.morphCandidates === 6, `morphCandidates=${summary.morphCandidates}`);
assert(summary.unknownWordTokens === 1, `unknownWordTokens=${summary.unknownWordTokens}`);
assert(summary.resolvedFacts === 0, `resolvedFacts=${summary.resolvedFacts}`);

assert(
  !(patch.nodes ?? []).some((n) =>
    n.type === 'morph_reading' &&
    n.features.formKey === 'present_perfect'
  ),
  'construction-scoped present_perfect must not become token morphology',
);

assert(
  (patch.nodes ?? []).every((n) => n.status === 'candidate'),
  'v1.41 must not resolve/reject candidate nodes',
);
assert(
  (patch.edges ?? []).every((e) => e.status === 'candidate'),
  'v1.41 must not resolve/reject candidate edges',
);
assert(
  (patch.alternativeSets ?? []).every((s) =>
    s.status === 'open' && s.resolvedMemberIds.length === 0
  ),
  'all v1.41 alternative sets must remain open',
);

const hus = surface.tokens.find((t) => t.normalizedSurface === 'hus');
assert(hus, 'missing hus token');
const husLexSet = (patch.alternativeSets ?? []).find((s) => s.id === `alt:lexical:${hus.id}`);
assert(husLexSet?.memberIds.length === 1, 'hus lexical set should preserve single candidate as open');
assert(husLexSet.status === 'open', 'single lexical candidate must not auto-resolve');

let graph = createCanonicalLanguageGraphV1(surface);
graph = applyGraphPatchV1(graph, patch);
const graphErrors = assertCanonicalLanguageGraphV1(graph);
assert(graphErrors.length === 0, `graph invariant errors: ${graphErrors.join(', ')}`);

console.log(JSON.stringify({ ok: true, summary, graphErrors }, null, 2));
});
