import { dependencyPatchFromLegacyV11 } from './legacy-language-graph-adapter-v1.ts';
import { applyGraphPatchV1 } from './canonical-language-graph-core-v1.ts';
import fixture from './r048r-production-rpc-fixture.json' with { type: 'json' };
function assert(ok: unknown, msg: string): asserts ok { if (!ok) throw Error(msg); }
const diagnostics: any[] = [];
const ctx = {
  sentenceIndex: 0, diagnostics, surface: {} as any,
  sqlMap: { tokens: [
    { legacyIndex: 1, canonicalTokenId: 'tok:0:0:6' },
    { legacyIndex: 2, canonicalTokenId: 'tok:1:7:12' },
  ] } as any,
};
const patch = dependencyPatchFromLegacyV11(fixture, ctx);
const subjects = (patch.edges ?? []).filter(e => e.relation === 'subject_of');
assert(subjects.length === 1, 'expected exactly one canonical subject_of edge');
const subject = subjects[0];
assert(subject.sourceId === 'tok:0:0:6', 'incorrect canonical subject token');
assert(subject.targetId === 'predicate:0:pred1:simple:2', 'incorrect canonical predicate');
const ruleEvidence = (patch.evidence ?? []).filter(e => e.kind === 'source_rule' && e.producer === 'grammar_rule_execution_evidence_v1');
assert(ruleEvidence.length === 1, 'expected one grammar rule evidence');
assert(subject.evidenceIds.includes(ruleEvidence[0].id), 'rule evidence not linked to edge');
assert((patch.evidence ?? []).some(e => e.producer === 'legacy_dependency_adapter_v1' && subject.evidenceIds.includes(e.id)), 'original legacy evidence lost');
const ruleProv = (patch.provenance ?? []).filter(p => p.id === ruleEvidence[0].provenanceIds[0]);
assert(ruleProv.length === 1 && ruleProv[0].sourceType === 'source_rule', 'missing source_rule provenance');
assert(subject.provenanceIds.includes(ruleProv[0].id), 'rule provenance not linked to edge');
assert(subject.provenanceIds.length >= 2, 'original provenance lost');
assert(ruleEvidence[0].payload.compileHash === 'bd82ab98c85e71050b5162e2001a658168b45c6b1bb391a3ae4a47afb59e570e', 'wrong production compile hash');
const empty = {version:'test',nodes:[],edges:[],evidence:[],provenance:[],alternativeSets:[],constraintTrace:[],producerState:{}} as any;
const once = applyGraphPatchV1(empty, patch);
const twice = applyGraphPatchV1(once, patch);
for (const field of ['edges','evidence','provenance'] as const) {
  assert(JSON.stringify(once[field]) === JSON.stringify(twice[field]), `non-idempotent ${field}`);
}
const noParity = structuredClone(fixture);
noParity.language_graph.rule_execution_plane_v1.dependency_pattern_executions[0].dependencies[0].canonical_v2_parity = false;
const rejected = dependencyPatchFromLegacyV11(noParity, {...ctx,diagnostics:[]});
assert(!(rejected.evidence ?? []).some(e => e.producer === 'grammar_rule_execution_evidence_v1'), 'parity=false must reject rule evidence');
console.log('R048R REAL RPC INTEGRATION PASS');
