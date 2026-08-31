import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COMPLETION_SHADOW_SUMMARY_FIELD,
  observeCompletionShadow,
  type CompletionShadowSummary,
} from "../../_shared/completion-contract/v1/shadow-observer.ts";
import type {
  SnapshotRpcResult,
} from "../../_shared/completion-contract/v1/runtime.ts";
import { baseSnapshot } from "./golden-corpus-v1.ts";

const JOB_ID = "10000000-0000-4000-8000-000000000001";

function readySnapshot(): SnapshotRpcResult {
  const entity = baseSnapshot();

  return {
    snapshot_version: entity.snapshot_version,
    snapshot_token: entity.snapshot_token,
    captured_at: entity.captured_at,
    execution_state: "completed",
    counts: {
      total_items: 3,
      total_entities: 1,
      unresolved_items: 0,
      excluded_items: 2,
    },
    unresolved_items: [],
    excluded_items: [
      { item_id: "excluded:jeg", admission_reason: "function_word_pronoun" },
      { item_id: "excluded:det", admission_reason: "function_word_pronoun" },
    ],
    page: {
      cursor: null,
      next_cursor: null,
      has_more: false,
      entities: [entity],
    },
  };
}

test("terminal shadow persists one non-enforcing diagnostic summary", async () => {
  const writes: Array<{
    field: string;
    summary: CompletionShadowSummary;
  }> = [];

  const observation = await observeCompletionShadow({
    job_id: JOB_ID,
    fetch_page: async () => readySnapshot(),
    persist_summary: async (field, summary) => {
      writes.push({ field, summary });
    },
    now: () => new Date("2026-08-30T15:00:00.000Z"),
  });

  assert.equal(observation.summary_field, COMPLETION_SHADOW_SUMMARY_FIELD);
  assert.equal(observation.writes_performed, 1);
  assert.equal(observation.summary.shadow_mode, true);
  assert.equal(observation.summary.enforcement_applied, false);
  assert.equal(observation.summary.execution_state, "completed");
  assert.equal(observation.summary.quality_state, "ready");
  assert.equal(observation.summary.learner_ready, true);
  assert.equal(observation.summary.source_counts.excluded_items, 2);
  assert.equal(observation.summary.observed_at, "2026-08-30T15:00:00.000Z");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].field, COMPLETION_SHADOW_SUMMARY_FIELD);
  assert.deepEqual(writes[0].summary, observation.summary);
  assert.equal("assessments" in observation.summary, false);
});

test("snapshot failure performs no diagnostic write", async () => {
  let writes = 0;

  await assert.rejects(
    () =>
      observeCompletionShadow({
        job_id: JOB_ID,
        fetch_page: async () => {
          throw new Error("TERMINAL_JOB_REQUIRED");
        },
        persist_summary: async () => {
          writes += 1;
        },
      }),
    /TERMINAL_JOB_REQUIRED/,
  );

  assert.equal(writes, 0);
});

test("diagnostic persistence failure is reported to the caller", async () => {
  await assert.rejects(
    () =>
      observeCompletionShadow({
        job_id: JOB_ID,
        fetch_page: async () => readySnapshot(),
        persist_summary: async () => {
          throw new Error("SUMMARY_WRITE_FAILED");
        },
      }),
    /SUMMARY_WRITE_FAILED/,
  );
});
