// R047B offline validation only. Never logs or returns raw payloads.
import { inspectCanonicalStructuralRpcPairV1 } from './canonical-structural-rpc-pair-diagnostic-v1.ts';
import type { CanonicalStructuralRpcCaptureEnvelopeV1 } from './canonical-structural-rpc-capture-envelope-v1.ts';
export type LinkedPairV1 = {
  captureId: string;
  outputCaptureId: string;
  envelope: CanonicalStructuralRpcCaptureEnvelopeV1;
  actualRpcTokens: unknown;
  sqlAnalysis: unknown;
};
export function validateLinkedStructuralRpcPairV1(pair: LinkedPairV1) {
  const report = inspectCanonicalStructuralRpcPairV1(pair.captureId, pair.envelope, pair.actualRpcTokens, pair.sqlAnalysis);
  const issues = [...report.issues];
  if (pair.captureId !== pair.outputCaptureId) issues.push('capture_id_mismatch');
  if (!Number.isInteger(pair.envelope.sentenceIndex) || pair.envelope.sentenceIndex < 0) issues.push('sentence_index_invalid');
  if (report.clauseCount === 0) issues.push('no_clause_fixture');
  return { contract: 'r047b-linked-pair-validation-v1' as const, captureId: pair.captureId,
    sentenceIndex: report.sentenceIndex, clauseCount: report.clauseCount,
    subjectTokenIndexCount: report.subjectTokenIndexCount,
    predicatePhraseIdCount: report.predicatePhraseIdCount,
    status: issues.length ? 'BLOCKED' as const : 'STRUCTURE_ONLY_PASS' as const, issues };
}
