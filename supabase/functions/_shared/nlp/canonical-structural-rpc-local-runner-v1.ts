/** R048C: offline, synthetic-only paired evidence runner. No Supabase client or network. */
import { buildStructuralRpcPairedEvidenceV1 } from "./canonical-structural-rpc-paired-evidence-v1.ts";

export type StructuralRpcArgumentsV1 = {
  rpcTokens: unknown[];
  structuralReleaseCode: string;
  sentenceIndex: number;
};
export type SyntheticRpcV1 = (args: StructuralRpcArgumentsV1) => Promise<unknown>;

export async function captureSyntheticStructuralRpcV1(
  args: StructuralRpcArgumentsV1,
  rpc: SyntheticRpcV1,
  captureId: string,
) {
  if (!Array.isArray(args.rpcTokens) || typeof args.structuralReleaseCode !== "string" ||
      !args.structuralReleaseCode.trim() || !Number.isInteger(args.sentenceIndex) || args.sentenceIndex < 0) {
    throw new Error("synthetic_rpc_arguments_invalid");
  }
  const output = await rpc(args);
  return buildStructuralRpcPairedEvidenceV1(captureId, args, output);
}

/** Explicit local output only; never writes to the repository or HTTP response. */
export async function saveSyntheticEvidenceV1(path: string, evidence: unknown): Promise<void> {
  if (!path.endsWith(".synthetic.json")) throw new Error("synthetic_output_suffix_required");
  const content = JSON.stringify(evidence, null, 2) + "\n";
  const file = await Deno.open(path, { write: true, createNew: true, mode: 0o600 });
  try { await file.write(new TextEncoder().encode(content)); }
  finally { file.close(); }
}
