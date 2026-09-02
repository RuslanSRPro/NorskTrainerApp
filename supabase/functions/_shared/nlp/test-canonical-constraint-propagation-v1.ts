import { buildCanonicalSurfaceDocumentV1 } from './canonical-surface-boundary-v1.ts';
import {
  applyGraphPatchV1,
  assertCanonicalLanguageGraphV1,
  createCanonicalLanguageGraphV1,
  type CanonicalLanguageGraphV1,
  type LanguageGraphProvenanceV1,
} from './canonical-language-graph-core-v1.ts';
import {
  buildCanonicalCandidateLatticePatchV1,
  type CanonicalMorphRegistryEntryV1,
  type CanonicalSurfaceCandidateBatchRowV1,
} from './canonical-candidate-lattice-v1.ts';
import {
  buildCanonicalConstraintPropagationPatchV1,
  type CanonicalConstraintEvaluationV1,
} from './canonical-constraint-propagation-v1.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const registry: CanonicalMorphRegistryEntryV1[] = [
  { pos: 'noun', form_key: 'plural_indefinite', form_scope: 'token', canonical_features: { Number: 'Plur', Definite: 'Ind' } },
  { pos: 'noun', form_key: 'singular_indefinite', form_scope: 'token', canonical_features: { Number: 'Sing', Definite: 'Ind' } },
  { pos: 'verb', form_key: 'present', form_scope: 'token', canonical_features: { VerbForm: 'Fin', Tense: 'Pres' } },
];

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
        identity_basis: 'dedicated_form_table',
        identity_strength: 'strong_form_support',
      },
      {
        lexeme_id: '00000000-0000-0000-0000-000000000002',
        lemma: 'passe',
        source_pos: 'verb',
        form_types: ['present'],
        sources: ['verb_forms'],
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
        sources: ['noun_forms'],
        identity_basis: 'mixed_form_evidence',
        identity_strength: 'strong_form_support',
      },
    ],
  },
];

function buildGraph(): CanonicalLanguageGraphV1 {
  const surface = buildCanonicalSurfaceDocumentV1('passer hus');
  let graph = createCanonicalLanguageGraphV1(surface);
  graph = applyGraphPatchV1(
    graph,
    buildCanonicalCandidateLatticePatchV1(surface, batch, registry),
  );
  return graph;
}

function lexicalByLemma(graph: CanonicalLanguageGraphV1, lemma: string) {
  return graph.nodes.find((n) =>
    n.type === 'lexical_reading' &&
    n.subtype === 'lexical_candidate' &&
    n.features.lemma === lemma
  );
}

function sourceRuleProvenance(code: string): LanguageGraphProvenanceV1[] {
  return [{
    id: `prov:test:source_rule:${code}`,
    sourceType: 'source_rule',
    sourceId: `fixture:${code}`,
    payload: { fixtureOnly: true, linguisticRule: false },
  }];
}

function evaluation(
  code: string,
  outcome: CanonicalConstraintEvaluationV1['outcome'],
  strength: CanonicalConstraintEvaluationV1['strength'],
  affectedIds: string[],
  extra: Partial<CanonicalConstraintEvaluationV1> = {},
): CanonicalConstraintEvaluationV1 {
  return {
    constraintCode: code,
    outcome,
    strength,
    inputIds: affectedIds,
    affectedIds,
    provenance: sourceRuleProvenance(code),
    ...extra,
  };
}

Deno.test('v1.42 hard reject + strong support resolves only the proven survivor', () => {
  const graph = buildGraph();
  const noun = lexicalByLemma(graph, 'pass');
  const verb = lexicalByLemma(graph, 'passe');
  assert(noun && verb, 'missing passer lexical candidates');

  const result = buildCanonicalConstraintPropagationPatchV1(
    graph,
    () => [
      evaluation('fixture.reject.a', 'reject', 'categorical', [noun.id]),
      evaluation('fixture.support.b', 'support', 'strong', [verb.id]),
    ],
  );
  const next = applyGraphPatchV1(graph, result.patch);

  assert(next.nodes.find((n) => n.id === noun.id)?.status === 'rejected', 'noun must be rejected');
  assert(next.nodes.find((n) => n.id === verb.id)?.status === 'resolved', 'verb must resolve');

  const tokenId = verb.span?.tokenIds?.[0];
  assert(tokenId, 'missing token id');
  const lexicalSet = next.alternativeSets.find((x) => x.id === `alt:lexical:${tokenId}`);
  assert(lexicalSet?.status === 'resolved', 'lexical set must resolve');
  assert(lexicalSet?.resolvedMemberIds[0] === verb.id, 'wrong lexical winner');
  assert(result.summary.reject === 1, `reject=${result.summary.reject}`);
  assert(result.summary.support === 1, `support=${result.summary.support}`);
  assert(result.summary.resolve === 1, `resolve=${result.summary.resolve}`);
  assert(assertCanonicalLanguageGraphV1(next).length === 0, 'graph invariants failed');
});

Deno.test('v1.42 singleton remains open without positive constraint proof', () => {
  const graph = buildGraph();
  const hus = lexicalByLemma(graph, 'hus');
  assert(hus, 'missing hus candidate');

  const result = buildCanonicalConstraintPropagationPatchV1(graph, () => []);
  const next = applyGraphPatchV1(graph, result.patch);
  const tokenId = hus.span?.tokenIds?.[0];
  assert(tokenId, 'missing hus token');
  const lexicalSet = next.alternativeSets.find((x) => x.id === `alt:lexical:${tokenId}`);

  assert(next.nodes.find((n) => n.id === hus.id)?.status === 'candidate', 'singleton must remain candidate');
  assert(lexicalSet?.status === 'open', 'singleton alternative set must remain open');
  assert(result.summary.resolve === 0, 'singleton must not auto-resolve');
});

Deno.test('v1.42 preference support is evidence but not sufficient for resolution', () => {
  const graph = buildGraph();
  const hus = lexicalByLemma(graph, 'hus');
  assert(hus, 'missing hus candidate');

  const result = buildCanonicalConstraintPropagationPatchV1(
    graph,
    () => [evaluation('fixture.preference', 'support', 'preference', [hus.id])],
  );
  const next = applyGraphPatchV1(graph, result.patch);
  const tokenId = hus.span?.tokenIds?.[0];
  assert(tokenId, 'missing hus token');
  const lexicalSet = next.alternativeSets.find((x) => x.id === `alt:lexical:${tokenId}`);

  assert(next.nodes.find((n) => n.id === hus.id)?.status === 'candidate', 'preference must not resolve fact');
  assert(lexicalSet?.status === 'open', 'preference must not resolve set');
  assert(next.nodes.find((n) => n.id === hus.id)?.evidenceIds.some((id) => id.includes('canonical_constraint_propagation_v1')), 'support evidence missing');
});

Deno.test('v1.42 missing capability becomes no_change, never destructive pruning', () => {
  const graph = buildGraph();
  const noun = lexicalByLemma(graph, 'pass');
  assert(noun, 'missing noun candidate');

  const result = buildCanonicalConstraintPropagationPatchV1(
    graph,
    () => [
      evaluation('fixture.needs.future.capability', 'reject', 'hard', [noun.id], {
        requiredCapabilities: ['future_structural_capability'],
      }),
    ],
    { availableCapabilities: [] },
  );
  const next = applyGraphPatchV1(graph, result.patch);

  assert(next.nodes.find((n) => n.id === noun.id)?.status === 'candidate', 'missing capability must not reject');
  assert(result.summary.noChange === 1, `noChange=${result.summary.noChange}`);
  assert(next.constraintTrace.some((x) => x.constraintCode === 'fixture.needs.future.capability' && x.outcome === 'no_change'), 'missing no_change trace');
  const evidence = next.evidence.find((x) => x.payload?.constraintCode === 'fixture.needs.future.capability');
  assert(evidence?.payload?.learnerError === false, 'deferred capability must not become learner error');
});

Deno.test('v1.42 weak destructive request is downgraded to no_change', () => {
  const graph = buildGraph();
  const noun = lexicalByLemma(graph, 'pass');
  assert(noun, 'missing noun candidate');

  const result = buildCanonicalConstraintPropagationPatchV1(
    graph,
    () => [evaluation('fixture.weak.reject', 'reject', 'supporting', [noun.id])],
  );
  const next = applyGraphPatchV1(graph, result.patch);

  assert(next.nodes.find((n) => n.id === noun.id)?.status === 'candidate', 'supporting evidence cannot reject');
  assert(result.summary.noChange === 1, 'weak reject must be no_change');
});

Deno.test('v1.42 propagation can reach a bounded multi-iteration fixpoint', () => {
  const graph = buildGraph();
  const noun = lexicalByLemma(graph, 'pass');
  const verb = lexicalByLemma(graph, 'passe');
  assert(noun && verb, 'missing passer candidates');

  const result = buildCanonicalConstraintPropagationPatchV1(
    graph,
    ({ graph: current, iteration }) => {
      if (iteration === 0) {
        return [evaluation('fixture.iter0.reject', 'reject', 'categorical', [noun.id])];
      }
      if (current.nodes.find((n) => n.id === noun.id)?.status === 'rejected') {
        return [evaluation('fixture.iter1.support', 'support', 'strong', [verb.id])];
      }
      return [];
    },
    { maxIterations: 6 },
  );
  const next = applyGraphPatchV1(graph, result.patch);

  assert(next.nodes.find((n) => n.id === verb.id)?.status === 'resolved', 'second iteration must resolve survivor');
  assert(result.summary.converged, 'propagation must converge');
  assert(!result.summary.maxIterationsReached, 'must not hit iteration bound');
  assert(result.summary.iterations <= 4, `unexpected iterations=${result.summary.iterations}`);
});

Deno.test('v1.42 repeated identical evaluation cannot create an infinite loop', () => {
  const graph = buildGraph();
  const hus = lexicalByLemma(graph, 'hus');
  assert(hus, 'missing hus candidate');

  const repeated = evaluation('fixture.repeat', 'support', 'preference', [hus.id]);
  const result = buildCanonicalConstraintPropagationPatchV1(
    graph,
    () => [repeated],
    { maxIterations: 8 },
  );

  assert(result.summary.evaluationsApplied === 1, `evaluationsApplied=${result.summary.evaluationsApplied}`);
  assert(result.summary.converged, 'duplicate evaluation must converge');
  assert(!result.summary.maxIterationsReached, 'duplicate evaluation must not exhaust bound');
});
