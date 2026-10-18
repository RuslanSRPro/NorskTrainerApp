import { validateClauseProducerJoinR047C } from "./canonical-structural-rpc-clause-producer-join-v1.ts";
function check(ok: unknown, msg: string) { if (!ok) throw Error(msg); }
function fixture() {
  const rpcTokens = [{ legacy_index: 1, canonical_token_id: "ct1", kind: "word", surface: "Katten" }, { legacy_index: 2, canonical_token_id: "ct2", kind: "word", surface: "sover" }];
  return {
    captureId: "synthetic:s0", outputCaptureId: "synthetic:s0",
    envelope: { sentenceIndex: 0, requestText: "Katten sover", rpcTokens },
    actualRpcTokens: rpcTokens,
    sqlAnalysis: { language_graph: {
      tokens: [{ token_index: 1, canonical_token_id: "ct1" }, { token_index: 2, canonical_token_id: "ct2" }],
      clauses: [{ finite_token_index: 2, subject_token_index: 1 }],
      predicate_build_v1: { predicates: [{ id: "pred1", status: "resolved", finite_token_index: 2 }] },
      clause_build_v1: { clauses: [{ status: "resolved", finite_token_index: 2, subject_token_index: 1, predicate_id: "pred1" }] }
    } }
  };
}
Deno.test("R047C complete synthetic join passes locally, never claims producer proof", () => {
 const r = validateClauseProducerJoinR047C(fixture() as never);
 check(r.status === "LOCAL_JOIN_PASS", JSON.stringify(r.issues));
 check(r.producerExecutionProof === "NOT_ESTABLISHED" && !r.subjectOfPredicateReady, "proof must not be promoted");
 check(!JSON.stringify(r).includes("Katten"), "no surface in report");
});
Deno.test("R047C blocks predicate mismatch", () => {
 const f = fixture(); f.sqlAnalysis.language_graph.clause_build_v1.clauses[0].predicate_id = "other";
 check(validateClauseProducerJoinR047C(f as never).status === "BLOCKED", "mismatch");
});
Deno.test("R047C blocks missing canonical mapping", () => {
 const f = fixture(); f.sqlAnalysis.language_graph.tokens[0].canonical_token_id = "";
 check(validateClauseProducerJoinR047C(f as never).issues.includes("canonical_subject_mapping_not_unique"), "mapping");
});
Deno.test("R047C blocks mismatched capture identity", () => {
 const f = fixture(); f.outputCaptureId = "other";
 check(validateClauseProducerJoinR047C(f as never).status === "BLOCKED", "identity");
});

Deno.test("R047D blocks zero-based SQL token index", () => {
 const f = fixture(); f.sqlAnalysis.language_graph.tokens[0].token_index = 0;
 const r = validateClauseProducerJoinR047C(f as never);
 check(r.status === "BLOCKED" && r.issues.includes("sql_token_index_invalid"), "zero index must be blocked");
});
Deno.test("R047D blocks zero-based subject index", () => {
 const f = fixture(); f.sqlAnalysis.language_graph.clause_build_v1.clauses[0].subject_token_index = 0;
 const r = validateClauseProducerJoinR047C(f as never);
 check(r.status === "BLOCKED", "zero subject must be blocked");
});
Deno.test("R047D blocks obsolete legacy_index-only output", () => {
 const f = fixture();
 const t = f.sqlAnalysis.language_graph.tokens[0] as {token_index?: number; legacy_index?: number};
 t.legacy_index = t.token_index; delete t.token_index;
 const r = validateClauseProducerJoinR047C(f as never);
 check(r.status === "BLOCKED" && r.issues.includes("sql_token_index_invalid"), "legacy_index output must be blocked");
});
