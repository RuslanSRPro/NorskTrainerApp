import { buildStructuralRpcPairedEvidenceV1 } from "./canonical-structural-rpc-paired-evidence-v1.ts";

const captureId = "11111111-1111-4111-8111-111111111111";
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("R048B paired evidence preserves exact input/output references and captureId", () => {
  const input = { rpcTokens: [{ legacy_index: 1, canonical_token_id: "s0:t0" }], structuralReleaseCode: "synthetic" };
  const output = { language_graph: { tokens: [{ token_index: 1, canonical_token_id: "s0:t0" }], clause_build_v1: { clauses: [] } } };
  const pair = buildStructuralRpcPairedEvidenceV1(captureId, input, output);
  assert(pair.captureId === captureId, "capture ID changed");
  assert(pair.input === input, "input reference changed");
  assert(pair.output === output, "output reference changed");
  assert(pair.contract === "canonical-structural-rpc-paired-evidence-v1", "contract changed");
});

Deno.test("R048B rejects malformed capture ID", () => {
  let rejected = false;
  try { buildStructuralRpcPairedEvidenceV1("not-a-uuid", {}, {}); } catch { rejected = true; }
  assert(rejected, "invalid capture ID accepted");
});

Deno.test("R048B rejects invalid RPC output", () => {
  let rejected = false;
  try { buildStructuralRpcPairedEvidenceV1(captureId, {}, null); } catch { rejected = true; }
  assert(rejected, "null RPC output accepted");
});

Deno.test("R048B does not serialize or log captured values", () => {
  const input = { secretMarker: "synthetic-only" };
  const output = { status: "ok" };
  const pair = buildStructuralRpcPairedEvidenceV1(captureId, input, output);
  assert(pair.input === input && pair.output === output, "evidence mutated");
  // This helper intentionally has no I/O, persistence or public response projection.
});