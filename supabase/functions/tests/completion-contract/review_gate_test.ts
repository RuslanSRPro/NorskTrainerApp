// D10 25.10.2026 (point 4): a word stopped at the admission gate with a review
// reason is listed for review and does not block the job; any other
// unresolved item (unknown reason, still pending) blocks as before.
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateJobCompletion, type SnapshotRpcResult } from "../../_shared/completion-contract/v1/runtime.ts";
import { baseSnapshot } from "./golden-corpus-v1.ts";

const JOB = "10000000-0000-4000-8000-000000000001";
const gate = (id: string, reason: string, extra: Record<string, unknown> = {}) => ({
  item_id: id, status: "done", current_stage: "admission_gate",
  promotion_status: "not_promoted", admission_status: "pos_unverified", admission_reason: reason, ...extra,
});
function snap(unresolved: unknown[]): SnapshotRpcResult {
  const e = baseSnapshot();
  return { snapshot_version: e.snapshot_version, snapshot_token: e.snapshot_token, captured_at: e.captured_at,
    execution_state: "completed",
    counts: { total_items: 1 + unresolved.length, total_entities: 1, unresolved_items: unresolved.length },
    unresolved_items: unresolved, page: { cursor: null, next_cursor: null, has_more: false, entities: [e] } };
}

test("review reason at the gate: job learner-ready, word listed for review", async () => {
  const r = await evaluateJobCompletion(async () => snap([gate("a", "AMBIGUOUS_POS_WITHOUT_ARTICLE"),
    gate("b", "CONFIRMED_ORDBOKENE_POS_CONFLICT")]), JOB);
  assert.equal(r.unresolved_items_block_completion, false);
  assert.equal(r.quality_state, "ready");
  assert.equal(r.learner_ready, true);
  assert.deepEqual((r.review_items as any[]).map((i) => i.item_id), ["a", "b"]);
  assert.equal(r.unresolved_items.length, 2, "the full list stays for the audit report");
});

test("unknown reason, not done, or no reason: still blocks (fail closed)", async () => {
  for (const item of [gate("x", "SOMETHING_NEW"), gate("y", "AMBIGUOUS_POS_WITHOUT_ARTICLE", { status: "processing" }),
    { item_id: "z" }]) {
    const r = await evaluateJobCompletion(async () => snap([item]), JOB);
    assert.equal(r.unresolved_items_block_completion, true, JSON.stringify(item));
    assert.equal(r.learner_ready, false);
    assert.deepEqual(r.review_items, []);
  }
});

test("one review word + one blocking item: blocks, the review word is still listed", async () => {
  const r = await evaluateJobCompletion(async () => snap([gate("a", "unknown_pos_requires_review"), { item_id: "z" }]), JOB);
  assert.equal(r.learner_ready, false);
  assert.deepEqual((r.review_items as any[]).map((i) => i.item_id), ["a"]);
});
