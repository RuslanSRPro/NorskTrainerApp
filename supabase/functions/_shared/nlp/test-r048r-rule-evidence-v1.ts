import { dependencyPatchFromLegacyV11 } from './legacy-language-graph-adapter-v1.ts';

function assert(ok: unknown, msg: string): asserts ok { if (!ok) throw Error(msg); }
const ruleId = '1786f164-c711-4abf-8a29-6c4dcd389142';
const ruleCode = 'nrg_rt_v1.structural.dependency.subject_of_predicate';
const base = {
  language_graph: {
    dependency_build_v2: { dependencies: [{
      id: 'legacy-subject', status: 'resolved', relation: 'subject_of',
      source_entity: 'token', source_token_index: 1,
      target_entity: 'predicate', target_id: 'pred1:simple:2',
    }] },
    rule_execution_plane_v1: {
      status: 'ready', release_code: 'runtime-structural-v1.37',
      dependency_pattern_executions: [{
        status: 'executed', rule_id: ruleId, rule_code: ruleCode,
        version: 'dependency-pattern-executor-v2', compile_hash: 'hash',
        actions_fully_supported: true, trace_action_materialized: true,
        dependencies: [{
          id: 'rexec:dep:subject_of:t1:pred1:simple:2', status: 'resolved',
          rule_id: ruleId, rule_code: ruleCode, relation: 'subject_of',
          source_entity: 'token', source_token_index: 1,
          target_entity: 'predicate', target_id: 'pred1:simple:2',
          canonical_v2_parity: true, trace_events: [{reason_code:'test'}],
        }],
      }],
    },
  },
};
const ctx = () => ({sentenceIndex:0, diagnostics:[], surface:{} as any, sqlMap: {
  tokens:[{legacyIndex:1,canonicalTokenId:'tok:0:0:6'}],
} as any});
const patch = dependencyPatchFromLegacyV11(base,ctx());
assert(patch.edges?.length === 1, 'must preserve exactly one canonical edge');
assert(patch.evidence?.length === 2, 'must retain legacy evidence and add rule evidence');
assert(patch.provenance?.some(p=>p.sourceType==='source_rule'), 'missing rule provenance');
assert(patch.edges[0].evidenceIds.length === 2, 'rule evidence not linked to edge');
assert(patch.edges[0].provenanceIds.length >= 2, 'legacy provenance overwritten');
const second = dependencyPatchFromLegacyV11(base,ctx());
assert(JSON.stringify(patch) === JSON.stringify(second), 'non-deterministic patch');
const noRule = structuredClone(base);
noRule.language_graph.rule_execution_plane_v1.dependency_pattern_executions[0].dependencies[0].canonical_v2_parity = false;
const rejected = dependencyPatchFromLegacyV11(noRule,ctx());
assert(rejected.evidence?.length === 1, 'parity failure must not attach rule evidence');
console.log('R048R PASS');
