import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCompletionEnforcementFailureSummary,
  COMPLETION_ENFORCEMENT_SUMMARY_FIELD,
  type CompletionEnforcementSummary,
  evaluateCompletionEnforcement,
  parseCompletionCanaryJobIds,
  parseCompletionEnforcementMode,
  resolveCompletionEnforcementRollout,
} from "../../_shared/completion-contract/v1/enforcement.ts";
import type {
  SnapshotRpcResult,
} from "../../_shared/completion-contract/v1/runtime.ts";
import { baseSnapshot } from "./golden-corpus-v1.ts";

const JOB_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_JOB_ID = "10000000-0000-4000-8000-000000000002";

function snapshot(
  overrides: Partial<SnapshotRpcResult> = {},
): SnapshotRpcResult {
  const entity = baseSnapshot();
  return {
    snapshot_version: entity.snapshot_version,
    snapshot_token: entity.snapshot_token,
    captured_at: entity.captured_at,
    execution_state: "completed",
    counts: {
      total_items: 1,
      total_entities: 1,
      unresolved_items: 0,
    },
    unresolved_items: [],
    page: {
      cursor: null,
      next_cursor: null,
      has_more: false,
      entities: [entity],
    },
    ...overrides,
  };
}

test("rollout defaults fail-safe to shadow", () => {
  assert.equal(parseCompletionEnforcementMode(undefined), "shadow");
  assert.equal(parseCompletionEnforcementMode(""), "shadow");
  assert.equal(parseCompletionEnforcementMode("enabled"), "shadow");
  assert.deepEqual(
    resolveCompletionEnforcementRollout(JOB_ID, "enabled", JOB_ID),
    { mode: "shadow", enforce: false, reason: "shadow_default" },
  );
});

test("canary enforces only an exact valid UUID allowlist match", () => {
  const allowlist = `${OTHER_JOB_ID}, invalid, ${JOB_ID.toUpperCase()}`;
  assert.deepEqual([...parseCompletionCanaryJobIds(allowlist)].sort(), [
    JOB_ID,
    OTHER_JOB_ID,
  ]);
  assert.deepEqual(
    resolveCompletionEnforcementRollout(JOB_ID, "canary", allowlist),
    { mode: "canary", enforce: true, reason: "canary_match" },
  );
  assert.deepEqual(
    resolveCompletionEnforcementRollout(
      "10000000-0000-4000-8000-000000000003",
      "canary",
      allowlist,
    ),
    { mode: "canary", enforce: false, reason: "canary_miss" },
  );
});

test("all mode enforces every job", () => {
  assert.deepEqual(
    resolveCompletionEnforcementRollout(JOB_ID, "all", undefined),
    { mode: "all", enforce: true, reason: "all_jobs" },
  );
});

test("learner-ready evidence allows completed and persists a compact summary", async () => {
  const writes: Array<
    { field: string; summary: CompletionEnforcementSummary }
  > = [];
  const evaluation = await evaluateCompletionEnforcement({
    job_id: JOB_ID,
    fetch_page: () => Promise.resolve(snapshot()),
    persist_summary: (field, summary) => {
      writes.push({ field, summary });
      return Promise.resolve();
    },
    now: () => new Date("2026-08-31T10:00:00.000Z"),
  });

  assert.equal(evaluation.summary_field, COMPLETION_ENFORCEMENT_SUMMARY_FIELD);
  assert.equal(evaluation.summary.decision, "allow_completed");
  assert.equal(evaluation.summary.decision_reason, "learner_ready");
  assert.equal(evaluation.summary.learner_ready, true);
  assert.equal(evaluation.summary.enforcement_applied, false);
  assert.equal(writes.length, 1);
  assert.equal("assessments" in evaluation.summary, false);
});

test("unresolved evidence fails closed to manual review", async () => {
  const evaluation = await evaluateCompletionEnforcement({
    job_id: JOB_ID,
    fetch_page: () =>
      Promise.resolve(snapshot({
        counts: {
          total_items: 2,
          total_entities: 1,
          unresolved_items: 1,
        },
        unresolved_items: [{ item_id: "unresolved" }],
      })),
    persist_summary: () => Promise.resolve(),
  });

  assert.equal(evaluation.summary.decision, "needs_manual_review");
  assert.equal(evaluation.summary.decision_reason, "unresolved_items");
  assert.equal(evaluation.summary.learner_ready, false);
});

test("evaluation failures produce an applied fail-closed summary", () => {
  const summary = buildCompletionEnforcementFailureSummary(
    "SNAPSHOT_CHANGED",
    "canary",
    new Date("2026-08-31T10:05:00.000Z"),
  );

  assert.equal(summary.enforcement_applied, true);
  assert.equal(summary.decision, "needs_manual_review");
  assert.equal(summary.decision_reason, "contract_evaluation_failed");
  assert.equal(summary.enforced_status, "needs_manual_review");
  assert.equal(summary.rollout_mode, "canary");
});
