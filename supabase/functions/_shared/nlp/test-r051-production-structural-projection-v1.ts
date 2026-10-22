import { buildCanonicalSurfaceDocumentV1 } from './canonical-surface-boundary-v1.ts';
import { createCanonicalLanguageGraphV1 } from './canonical-language-graph-core-v1.ts';
import { buildSqlStructuralCompatibilityMapV1 } from './sql-structural-compatibility-map-v1.ts';
import { projectLegacyNonPhraseStructureIntoCanonicalGraphV143 } from './legacy-language-graph-adapter-v1.ts';
import evidence from '../../../../grammar-evidence/artifacts/R051-current-production-structural-rpc-smoke.json' with { type: 'json' };

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}

const surface = buildCanonicalSurfaceDocumentV1('Katten sover');
const sqlMap = buildSqlStructuralCompatibilityMapV1(surface, 0);
const input = evidence.rpc_input.rpcTokens;
assert(input.length === sqlMap.tokens.length, 'input token count changed');
for (let i = 0; i < input.length; i++) {
  assert(input[i].legacy_index === sqlMap.tokens[i].legacyIndex, 'legacy index changed');
  assert(input[i].canonical_token_id === sqlMap.tokens[i].canonicalTokenId, 'canonical token ID changed');
}

const projection = projectLegacyNonPhraseStructureIntoCanonicalGraphV143(
  createCanonicalLanguageGraphV1(surface),
  evidence.rpc_output,
  surface,
  0,
  sqlMap,
);
const graph = projection.graph;
const subject = graph.edges.filter(edge => edge.relation === 'subject_of' && edge.status === 'resolved' && edge.targetId === 'predicate:0:pred1:simple:2');
assert(subject.length === 1, 'expected exactly one subject-to-predicate edge');
assert(subject[0].sourceId === 'tok:0:0:6', 'subject canonical identity changed');
const clauseSubject = graph.edges.filter(edge => edge.relation === 'subject_of' && edge.status === 'resolved' && edge.targetId === 'clause:0:clb1:finite:pred1:simple:2');
assert(clauseSubject.length === 1 && clauseSubject[0].sourceId === 'tok:0:0:6', 'subject-to-clause edge changed');
const clause = graph.nodes.find(node => node.id === 'clause:0:clb1:finite:pred1:simple:2');
assert(clause?.status === 'resolved', 'resolved clause missing');
assert(clause.span?.startTokenId === 'tok:0:0:6' && clause.span?.endTokenId === 'tok:1:7:12', 'clause canonical span changed');
assert(clause.evidenceIds.length > 0 && clause.provenanceIds.length > 0, 'clause evidence or provenance missing');
assert(graph.nodes.some(node => node.id === subject[0].targetId), 'predicate node missing');
assert(subject[0].evidenceIds.length > 0 && subject[0].provenanceIds.length > 0, 'subject evidence or provenance missing');
const ruleEvidence = graph.evidence.filter(item => item.kind === 'source_rule' && item.producer === 'grammar_rule_execution_evidence_v1');
assert(ruleEvidence.length === 1, 'expected one source rule evidence');
assert(subject[0].evidenceIds.includes(ruleEvidence[0].id), 'rule evidence not attached to predicate edge');
assert(ruleEvidence[0].provenanceIds.every(id => subject[0].provenanceIds.includes(id)), 'rule provenance not attached to predicate edge');
console.log('R051 PRODUCTION STRUCTURAL PROJECTION PASS');
