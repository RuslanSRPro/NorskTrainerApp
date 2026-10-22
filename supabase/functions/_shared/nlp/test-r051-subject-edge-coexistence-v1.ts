import { buildCanonicalSurfaceDocumentV1 } from './canonical-surface-boundary-v1.ts';
import { applyGraphPatchV1, createCanonicalLanguageGraphV1 } from './canonical-language-graph-core-v1.ts';
import { buildSqlStructuralCompatibilityMapV1 } from './sql-structural-compatibility-map-v1.ts';
import { projectLegacyNonPhraseStructureIntoCanonicalGraphV143 } from './legacy-language-graph-adapter-v1.ts';
import evidence from '../../../../grammar-evidence/artifacts/R051-current-production-structural-rpc-smoke.json' with { type: 'json' };

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

const surface = buildCanonicalSurfaceDocumentV1('Katten sover');
const map = buildSqlStructuralCompatibilityMapV1(surface, 0);
const first = projectLegacyNonPhraseStructureIntoCanonicalGraphV143(
  createCanonicalLanguageGraphV1(surface), evidence.rpc_output, surface, 0, map,
).graph;
const subject = first.edges.filter(edge =>
  edge.relation === 'subject_of' && edge.status === 'resolved' &&
  edge.sourceId === 'tok:0:0:6' && edge.targetId === 'predicate:0:pred1:simple:2'
);
assert(subject.length === 1, 'R048R subject-to-predicate edge must be unique');
const firstEvidence = subject[0].evidenceIds.length;
const replay = projectLegacyNonPhraseStructureIntoCanonicalGraphV143(
  first, evidence.rpc_output, surface, 0, map,
).graph;
const repeated = replay.edges.filter(edge => edge.id === subject[0].id);
assert(repeated.length === 1, 'R048R replay duplicated an edge ID');
assert(repeated[0].evidenceIds.length === firstEvidence, 'R048R replay changed rule evidence');

// R048M D7.14 uses a plan-based edge ID and token-node endpoints. Model that
// graph-patch shape without claiming that its scheduler is deployed or admitted.
const tokenPatch = (planId: string) => ({
  producer: 'canonical_runtime_dependency_execution_graph_patch_boundary_v1',
  producerVersion: 'test',
  edges: [{
    id: `edge:runtime-dependency-execution-v1:${planId}`,
    relation: 'subject_of', sourceId: 'tok:0:0:6', targetId: 'tok:1:7:12',
    status: 'resolved' as const, features: {}, producer: 'r048m-shape',
    evidenceIds: [], provenanceIds: [],
  }],
});
const once = applyGraphPatchV1(replay, tokenPatch('plan-one'));
const twiceSamePlan = applyGraphPatchV1(once, tokenPatch('plan-one'));
assert(twiceSamePlan.edges.length === once.edges.length, 'same plan ID duplicated an edge');
const twiceDifferentPlan = applyGraphPatchV1(once, tokenPatch('plan-two'));
const tokenSubjects = twiceDifferentPlan.edges.filter(edge =>
  edge.relation === 'subject_of' && edge.sourceId === 'tok:0:0:6' &&
  edge.targetId === 'tok:1:7:12'
);
assert(tokenSubjects.length === 2, 'different plan IDs unexpectedly deduplicated a relation');
assert(twiceDifferentPlan.edges.some(edge => edge.id === subject[0].id), 'R048R edge was overwritten');
console.log('R051 SUBJECT EDGE COEXISTENCE PASS');
