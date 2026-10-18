/** Offline synthetic demonstration: must not be used as producer-execution evidence. */
import { captureSyntheticStructuralRpcV1, saveSyntheticEvidenceV1 } from "./canonical-structural-rpc-local-runner-v1.ts";
const path = Deno.args[0];
if (!path || Deno.args.length !== 1) throw new Error("expected exactly one local *.synthetic.json output path");
const evidence = await captureSyntheticStructuralRpcV1(
  { rpcTokens: [{ legacy_index: 0, canonical_token_id: "s0:t0" }], structuralReleaseCode: "synthetic-only", sentenceIndex: 0 },
  async () => ({ clause_build_v1: { clauses: [{ id: "synthetic-clause" }] } }),
  crypto.randomUUID(),
);
await saveSyntheticEvidenceV1(path, evidence);
console.log("R048C SYNTHETIC EVIDENCE SAVED (not a real producer fixture)");
