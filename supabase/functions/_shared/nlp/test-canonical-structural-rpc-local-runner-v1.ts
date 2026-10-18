import { captureSyntheticStructuralRpcV1, saveSyntheticEvidenceV1 } from "./canonical-structural-rpc-local-runner-v1.ts";
const ID = "22222222-2222-4222-8222-222222222222";
function assert(value: unknown, message: string) { if (!value) throw new Error(message); }

Deno.test("R048C pairs exact synthetic RPC arguments and returned output", async () => {
  const args = { rpcTokens: [{ legacy_index: 0, canonical_token_id: "s0:t0" }], structuralReleaseCode: "synthetic", sentenceIndex: 0 };
  const output = { clause_build_v1: { clauses: [{ id: "c0" }] } };
  let called = 0;
  const evidence = await captureSyntheticStructuralRpcV1(args, async received => {
    called++;
    assert(received === args, "RPC received altered args");
    return output;
  }, ID);
  assert(called === 1, "RPC was not called exactly once");
  assert(evidence.captureId === ID && evidence.input === args && evidence.output === output, "paired evidence mismatch");
});

Deno.test("R048C does not emit evidence when synthetic RPC fails", async () => {
  let rejected = false;
  try { await captureSyntheticStructuralRpcV1({ rpcTokens: [], structuralReleaseCode: "synthetic", sentenceIndex: 0 }, async () => { throw new Error("rpc_failed"); }, ID); }
  catch (e) { rejected = e instanceof Error && e.message === "rpc_failed"; }
  assert(rejected, "RPC failure was not propagated");
});

Deno.test("R048C rejects invalid args before calling RPC", async () => {
  let called = false;
  let rejected = false;
  try { await captureSyntheticStructuralRpcV1({ rpcTokens: [], structuralReleaseCode: "", sentenceIndex: 0 }, async () => { called = true; return {}; }, ID); }
  catch { rejected = true; }
  assert(rejected && !called, "invalid args reached RPC");
});

Deno.test("R048C rejects output path without synthetic suffix before I/O", async () => {
  let rejected = false;
  try { await saveSyntheticEvidenceV1("never-write-real-evidence.json", {}); }
  catch (e) { rejected = e instanceof Error && e.message === "synthetic_output_suffix_required"; }
  assert(rejected, "non-synthetic output path accepted");
});
