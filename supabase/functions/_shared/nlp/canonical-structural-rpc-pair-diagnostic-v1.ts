// R047A local-only diagnostic. No endpoint import, logging, filesystem or network.
import type { CanonicalStructuralRpcCaptureEnvelopeV1 } from './canonical-structural-rpc-capture-envelope-v1.ts';

type JsonRecord = Record<string, unknown>;
function record(v: unknown): v is JsonRecord { return v !== null && typeof v === 'object' && !Array.isArray(v); }

export type StructuralRpcPairDiagnosticV1 = {
  contract: 'canonical-structural-rpc-pair-diagnostic-v1';
  captureId: string;
  sentenceIndex: number;
  inputTokenCount: number;
  clauseCount: number;
  clauseLayerPresent: boolean;
  subjectTokenIndexCount: number;
  predicatePhraseIdCount: number;
  issues: string[];
  // No requestText, surface, sqlMap, rpcTokens, or full RPC payload in the report.
};

/** Must be called with the EXACT p_tokens object passed to RPC, and the result of that same call. */
export function inspectCanonicalStructuralRpcPairV1(
  captureId: string,
  envelope: CanonicalStructuralRpcCaptureEnvelopeV1,
  actualRpcTokens: unknown,
  sqlAnalysis: unknown,
): StructuralRpcPairDiagnosticV1 {
  if (typeof captureId !== 'string' || !captureId.trim()) throw new Error('r047a_capture_id_invalid');
  const issues: string[] = [];
  if (envelope.rpcTokens !== actualRpcTokens) issues.push('rpc_tokens_reference_mismatch');
  if (!record(sqlAnalysis)) issues.push('rpc_payload_invalid');
  const languageGraph = record(sqlAnalysis) && record(sqlAnalysis.language_graph) ? sqlAnalysis.language_graph : null;
  const layer = languageGraph && record(languageGraph.clause_build_v1) ? languageGraph.clause_build_v1 : null;
  if (!layer) issues.push('clause_layer_missing');
  const clauses = layer && Array.isArray(layer.clauses) ? layer.clauses : [];
  if (layer && !Array.isArray(layer.clauses)) issues.push('clause_array_missing');
  let subjects = 0, predicates = 0;
  for (const [i, raw] of clauses.entries()) {
    if (!record(raw)) { issues.push(`clause_${i}_invalid`); continue; }
    if (Number.isInteger(raw.subject_token_index)) subjects++;
    if (typeof raw.predicate_phrase_id === 'string' && raw.predicate_phrase_id.length) predicates++;
  }
  return {
    contract: 'canonical-structural-rpc-pair-diagnostic-v1', captureId,
    sentenceIndex: envelope.sentenceIndex,
    inputTokenCount: Array.isArray(envelope.rpcTokens) ? envelope.rpcTokens.length : -1,
    clauseCount: clauses.length, clauseLayerPresent: !!layer,
    subjectTokenIndexCount: subjects, predicatePhraseIdCount: predicates, issues,
  };
}
