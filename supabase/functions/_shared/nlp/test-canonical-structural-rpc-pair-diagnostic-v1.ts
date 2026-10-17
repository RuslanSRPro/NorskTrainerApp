import { inspectCanonicalStructuralRpcPairV1 } from './canonical-structural-rpc-pair-diagnostic-v1.ts';
function assert(x: unknown, msg: string) { if (!x) throw new Error(msg); }
Deno.test('R047A reports one linked in-memory input/output pair without returning raw data', () => {
  const rpcTokens = [{ index: 0, surface: 'Katten' }];
  const envelope = { requestText: 'Katten sover.', sentenceIndex: 0, rpcTokens };
  const output = { language_graph: { clause_build_v1: { clauses: [{ subject_token_index: 0, predicate_phrase_id: 'p1' }] } } };
  const report = inspectCanonicalStructuralRpcPairV1('local:s0', envelope as never, rpcTokens, output);
  assert(report.issues.length === 0, 'expected no issues');
  assert(report.subjectTokenIndexCount === 1 && report.predicatePhraseIdCount === 1, 'counts');
  assert(!JSON.stringify(report).includes('Katten'), 'report must not contain input text');
});
Deno.test('R047A flags nonidentical tokens and absent producer output', () => {
  const envelope = { sentenceIndex: 0, rpcTokens: [{ index: 0 }] };
  const report = inspectCanonicalStructuralRpcPairV1('local:s0', envelope as never, [{ index: 0 }], {});
  assert(report.issues.includes('rpc_tokens_reference_mismatch'), 'identity mismatch');
  assert(report.issues.includes('clause_layer_missing'), 'missing layer');
});
