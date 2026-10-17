import { validateLinkedStructuralRpcPairV1 } from './canonical-structural-rpc-linked-pair-validation-v1.ts';
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }
function fixture() {
 const rpcTokens = [{ index: 0, surface: 'Katten' }];
 return { captureId: 'local:s0', outputCaptureId: 'local:s0',
 envelope: { requestText: 'Katten sover.', sentenceIndex: 0, rpcTokens }, actualRpcTokens: rpcTokens,
 sqlAnalysis: { language_graph: { clause_build_v1: { clauses: [{ subject_token_index: 0, predicate_phrase_id: 'p1' }] } } } };
}
Deno.test('R047B accepts linked structural shape without claiming producer proof', () => {
 const result = validateLinkedStructuralRpcPairV1(fixture() as never);
 assert(result.status === 'STRUCTURE_ONLY_PASS', 'structure check');
 assert(!JSON.stringify(result).includes('Katten'), 'no raw text in report');
});
Deno.test('R047B rejects mismatched call identity', () => {
 const pair = fixture(); pair.outputCaptureId = 'other:s0';
 assert(validateLinkedStructuralRpcPairV1(pair as never).issues.includes('capture_id_mismatch'), 'id mismatch');
});
Deno.test('R047B rejects absent clause layer and changed token object', () => {
 const pair = fixture(); pair.sqlAnalysis = {} as never; pair.actualRpcTokens = [];
 const result = validateLinkedStructuralRpcPairV1(pair as never);
 assert(result.status === 'BLOCKED', 'must block');
 assert(result.issues.includes('clause_layer_missing'), 'missing layer');
 assert(result.issues.includes('rpc_tokens_reference_mismatch'), 'token reference mismatch');
});
