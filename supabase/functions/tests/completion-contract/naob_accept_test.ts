// D10 25.10.2026 (variant A): a card without an Ordbøkene article but with
// NAOB forms is "ready with a mark" and does not block the job.
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateJobCompletion, type SnapshotRpcResult } from "../../_shared/completion-contract/v1/runtime.ts";
import { evaluateCompletion } from "../../_shared/completion-contract/v1/evaluator.ts";
import type { EntityEvidenceSnapshot } from "../../_shared/completion-contract/v1/contract.ts";
import { baseSnapshot } from "./golden-corpus-v1.ts";

const JOB = "10000000-0000-4000-8000-000000000001";
function page(entities: EntityEvidenceSnapshot[]): SnapshotRpcResult {
  return { snapshot_version: entities[0].snapshot_version, snapshot_token: entities[0].snapshot_token,
    captured_at: entities[0].captured_at, execution_state: "completed",
    counts: { total_items: entities.length, total_entities: entities.length, unresolved_items: 0 },
    unresolved_items: [], page: { cursor: null, next_cursor: null, has_more: false, entities } };
}
function naobCard(naob: boolean, extra: Partial<EntityEvidenceSnapshot> = {}) {
  const b = baseSnapshot();
  // the golden-corpus card itself (its translations are bound to it), with the
  // Ordbøkene identity and forms taken away, as a NAOB-divided noun has them
  return baseSnapshot({
    identity: { ...b.identity, accepted: false, verification_status: "candidate", ...(naob ? { naob_forms: true } : {}) } as any,
    forms: [], ...extra });
}

test("the NAOB card alone has only the Ordbøkene identity/forms gaps", () => {
  const codes = [...new Set(evaluateCompletion(naobCard(true)).blockers.map((i) => i.code))].sort();
  assert.ok(codes.length > 0);
  assert.ok(codes.every((c) => ["IDENTITY_NOT_VERIFIED", "REQUIRED_FORMS_MISSING", "PARADIGM_UNKNOWN", "AI_ONLY_TRANSLATION"].includes(c)), codes.join(","));
});

test("NAOB forms: the job is learner-ready, the card is accepted with a mark (not 'for review')", async () => {
  const r = await evaluateJobCompletion(async () => page([naobCard(true)]), JOB);
  assert.equal(r.learner_ready, true);
  assert.equal(r.quality_state, "ready");
  assert.deepEqual(r.naob_accepted_entities, [baseSnapshot().entity_key]);
  assert.deepEqual(r.review_marked_entities, []);
});

test("without NAOB forms the same card still blocks (fail closed)", async () => {
  const r = await evaluateJobCompletion(async () => page([naobCard(false)]), JOB);
  assert.equal(r.learner_ready, false);
  assert.deepEqual(r.naob_accepted_entities, []);
});

test("NAOB card with a missing translation still blocks", async () => {
  const r = await evaluateJobCompletion(async () => page([naobCard(true, { translations: [] })]), JOB);
  assert.equal(r.learner_ready, false);
});
