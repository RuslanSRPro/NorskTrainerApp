// D10 15.10.2026: words marked "for review" (AI translation rejected twice).
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateJobCompletion, type SnapshotRpcResult } from "../../_shared/completion-contract/v1/runtime.ts";
import type { EntityEvidenceSnapshot } from "../../_shared/completion-contract/v1/contract.ts";
import { baseSnapshot } from "./golden-corpus-v1.ts";

const JOB = "10000000-0000-4000-8000-000000000001";
function page(entities: EntityEvidenceSnapshot[]): SnapshotRpcResult {
  return { snapshot_version: entities[0].snapshot_version, snapshot_token: entities[0].snapshot_token,
    captured_at: entities[0].captured_at, execution_state: "completed",
    counts: { total_items: entities.length, total_entities: entities.length, unresolved_items: 0 },
    unresolved_items: [], page: { cursor: null, next_cursor: null, has_more: false, entities } };
}
function like(marked: boolean, extra: Partial<EntityEvidenceSnapshot> = {}) {
  const b = baseSnapshot();
  return baseSnapshot({ entity_key: "lexeme:20000000-0000-4000-8000-000000000002",
    entity_id: "20000000-0000-4000-8000-000000000002", lemma: "like",
    identity: { ...b.identity, ...(marked ? { ai_review_rejected: true } : {}) } as any,
    translations: [], ...extra });
}
test("marked word whose only gap is the translation does not block the job", async () => {
  const e = await evaluateJobCompletion(async () => page([baseSnapshot(), like(true)]), JOB);
  assert.equal(e.learner_ready, true);
  assert.equal(e.quality_state, "ready");
  assert.deepEqual(e.review_marked_entities, ["lexeme:20000000-0000-4000-8000-000000000002"]);
  assert.equal(e.report.learner_ready_entities, 1); // the word itself stays not ready
});
test("unmarked word without translation still blocks", async () => {
  const e = await evaluateJobCompletion(async () => page([baseSnapshot(), like(false)]), JOB);
  assert.equal(e.learner_ready, false);
  assert.deepEqual(e.review_marked_entities, []);
});
test("marked word with another gap (no forms) still blocks", async () => {
  const e = await evaluateJobCompletion(async () => page([baseSnapshot(), like(true, { forms: [] })]), JOB);
  assert.equal(e.learner_ready, false);
});
