/** R048F offline, structural preflight only. Never authorizes or invokes an RPC. */
export type R048FManifest = {
  contract: 'r048f-offline-admission-v1';
  projectRef: string;
  rpcName: string;
  releaseCode: string;
  sentenceIndex: number;
  captureId: string;
  source: 'canonical-graph-shadow-v1';
  producerPath: 'clause_build_v1';
  provenanceStatus: 'STATIC_ONLY';
  credentialPresent: false;
  productionRpcAuthorized: false;
};
export function inspectR048FManifest(value: unknown): { structuralChecksPass: boolean; executionAdmission: 'HOLD'; reasons: string[] } {
  const m = value as Partial<R048FManifest> | null;
  const reasons: string[] = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {structuralChecksPass:false,executionAdmission:'HOLD',reasons:['manifest_invalid']};
  if (m.contract !== 'r048f-offline-admission-v1') reasons.push('contract_invalid');
  if (m.projectRef !== 'kevpkawrbtovrgyjkkvu') reasons.push('project_ref_mismatch');
  if (m.rpcName !== 'run_canonical_legacy_compatibility_v140') reasons.push('rpc_name_mismatch');
  if (typeof m.releaseCode !== 'string' || !m.releaseCode.trim()) reasons.push('release_code_missing');
  if (!Number.isInteger(m.sentenceIndex) || (m.sentenceIndex as number) < 0) reasons.push('sentence_index_invalid');
  if (typeof m.captureId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(m.captureId)) reasons.push('capture_id_invalid');
  if (m.source !== 'canonical-graph-shadow-v1') reasons.push('source_invalid');
  if (m.producerPath !== 'clause_build_v1') reasons.push('producer_path_invalid');
  if (m.provenanceStatus !== 'STATIC_ONLY') reasons.push('provenance_not_static');
  if (m.credentialPresent !== false) reasons.push('credentials_forbidden');
  if (m.productionRpcAuthorized !== false) reasons.push('authorization_not_granted');
  const keys = Object.keys(m);
  const allowed = ['contract','projectRef','rpcName','releaseCode','sentenceIndex','captureId','source','producerPath','provenanceStatus','credentialPresent','productionRpcAuthorized'];
  if (keys.some(k=>!allowed.includes(k))) reasons.push('unexpected_fields_forbidden');
  return {structuralChecksPass:reasons.length===0,executionAdmission:'HOLD',reasons};
}
