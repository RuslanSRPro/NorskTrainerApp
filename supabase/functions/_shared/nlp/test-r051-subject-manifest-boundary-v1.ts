import { buildCanonicalSurfaceDocumentV1 } from './canonical-surface-boundary-v1.ts';
import { createCanonicalLanguageGraphV1 } from './canonical-language-graph-core-v1.ts';
import { buildSqlStructuralCompatibilityMapV1 } from './sql-structural-compatibility-map-v1.ts';
import { projectLegacyNonPhraseStructureIntoCanonicalGraphV143 } from './legacy-language-graph-adapter-v1.ts';
import capture from '../../../../grammar-evidence/artifacts/R051-current-production-structural-rpc-smoke.json' with { type: 'json' };
import manifest from '../../../../grammar-evidence/artifacts/R051-current-subject-manifest-snapshot.json' with { type: 'json' };

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

const surface = buildCanonicalSurfaceDocumentV1('Katten sover');
const map = buildSqlStructuralCompatibilityMapV1(surface, 0);
const raw = capture.rpc_output.language_graph;
const legacyClause = raw.clauses.find(item => item.type === 'finite');
assert(legacyClause?.predicate_phrase_id === 'vp:2', 'V32 phrase reference changed');
assert(raw.phrases.some(item => item.id === legacyClause.predicate_phrase_id), 'V32 phrase reference is dangling');

const resolvedClause = raw.clause_build_v1.clauses.find(item => item.status === 'resolved');
assert(resolvedClause?.predicate_id === 'pred1:simple:2', 'resolved predicate reference changed');
assert(!('predicate_phrase_id' in resolvedClause), 'resolved clause unexpectedly gained phrase reference');
assert(!('type' in resolvedClause), 'resolved clause unexpectedly gained legacy type');

const graph = projectLegacyNonPhraseStructureIntoCanonicalGraphV143(
  createCanonicalLanguageGraphV1(surface), capture.rpc_output, surface, 0, map,
).graph;
const clause = graph.nodes.find(item => item.id === 'clause:0:clb1:finite:pred1:simple:2');
assert(clause?.type === 'clause' && clause.subtype === 'finite', 'canonical clause shape changed');
assert(!('predicate_phrase_id' in clause.features), 'canonical resolved clause unexpectedly gained phrase reference');
assert(graph.nodes.some(item => item.id === 'predicate:0:pred1:simple:2' && item.type === 'predicate'), 'predicate occurrence missing');
assert(!graph.nodes.some(item => item.type === 'phrase' && item.id.endsWith(':vp:2')), 'legacy V32 phrase was unexpectedly projected');

assert(manifest.bindings.clause.where.left.ref === 'clause.type', 'manifest clause reference changed');
assert(manifest.bindings.predicate.where.left.ref === 'clause.predicate_phrase_id', 'manifest predicate reference changed');
assert(manifest.bindings.predicate.entity === 'phrase', 'manifest predicate entity changed');
assert(manifest.actions[0].action === 'create_dependency' && manifest.actions[0].value.target_ref === 'predicate', 'manifest action changed');

// This test establishes the boundary mismatch. It does not execute the R048M
// binding evaluator or prove absence of native phrase candidates elsewhere.
console.log('R051 SUBJECT MANIFEST BOUNDARY MISMATCH CONFIRMED');
