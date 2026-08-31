import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveQualityState,
  evaluateJobCompletion,
  type SnapshotRpcResult,
} from "../../_shared/completion-contract/v1/runtime.ts";
import type {
  AggregateAssessment,
  EntityEvidenceSnapshot,
} from "../../_shared/completion-contract/v1/contract.ts";
import { baseSnapshot } from "./golden-corpus-v1.ts";

const JOB_ID = "10000000-0000-4000-8000-000000000001";

function result(
  entity: EntityEvidenceSnapshot,
  overrides: Partial<SnapshotRpcResult> = {},
): SnapshotRpcResult {
  return {
    snapshot_version: entity.snapshot_version,
    snapshot_token: entity.snapshot_token,
    captured_at: entity.captured_at,
    execution_state: entity.execution_state,
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

test("runtime marks a fully verified terminal snapshot learner-ready", async () => {
  const snapshot = result(baseSnapshot());
  const evaluation = await evaluateJobCompletion(async () => snapshot, JOB_ID);

  assert.equal(evaluation.execution_state, "completed");
  assert.equal(evaluation.quality_state, "ready");
  assert.equal(evaluation.learner_ready, true);
  assert.equal(evaluation.report.total_entities, 1);
});

test("unresolved items fail closed even when the entity is ready", async () => {
  const snapshot = result(baseSnapshot(), {
    counts: {
      total_items: 2,
      total_entities: 1,
      unresolved_items: 1,
    },
    unresolved_items: [{ item_id: "unresolved" }],
  });
  const evaluation = await evaluateJobCompletion(async () => snapshot, JOB_ID);

  assert.equal(evaluation.quality_state, "needs_review");
  assert.equal(evaluation.learner_ready, false);
  assert.equal(evaluation.unresolved_items_block_completion, true);
});

test("intentional function-word exclusions do not block readiness", async () => {
  const snapshot = result(baseSnapshot(), {
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
  });
  const evaluation = await evaluateJobCompletion(async () => snapshot, JOB_ID);

  assert.equal(evaluation.quality_state, "ready");
  assert.equal(evaluation.learner_ready, true);
  assert.equal(evaluation.unresolved_items_block_completion, false);
  assert.equal(evaluation.source_counts.excluded_items, 2);
});

test("AI-only translations stay provisional", async () => {
  const snapshot = structuredClone(baseSnapshot());
  snapshot.translations = snapshot.translations.map((translation) => ({
    ...translation,
    provider: "ai_fallback",
    canonical: false,
    source_refs: ["ai:run:runtime-test"],
  }));
  const evaluation = await evaluateJobCompletion(
    async () => result(snapshot),
    JOB_ID,
  );

  assert.equal(evaluation.quality_state, "provisional");
  assert.equal(evaluation.learner_ready, false);
});

test("runtime preserves snapshot-token consistency across pages", async () => {
  const first = baseSnapshot();
  const second = structuredClone(first);
  second.entity_id = "20000000-0000-4000-8000-000000000002";
  second.entity_key = `lexeme:${second.entity_id}`;
  second.snapshot_token = "sha256:changed";

  let call = 0;
  await assert.rejects(
    () =>
      evaluateJobCompletion(async () => {
        call += 1;
        if (call === 1) {
          return result(first, {
            page: {
              cursor: null,
              next_cursor: first.entity_key,
              has_more: true,
              entities: [first],
            },
          });
        }
        return result(second, {
          page: {
            cursor: first.entity_key,
            next_cursor: null,
            has_more: false,
            entities: [second],
          },
        });
      }, JOB_ID),
    /SNAPSHOT_CHANGED/,
  );
});

test("quality precedence is review, blocked, provisional, ready", () => {
  const aggregate = {
    total_entities: 1,
    learner_ready_entities: 0,
    quality_counts: {
      ready: 0,
      provisional: 0,
      needs_review: 0,
      blocked: 1,
    },
  } as AggregateAssessment;

  assert.equal(deriveQualityState(aggregate, []), "blocked");
  aggregate.quality_counts.blocked = 0;
  aggregate.quality_counts.provisional = 1;
  assert.equal(deriveQualityState(aggregate, []), "provisional");
  aggregate.quality_counts.provisional = 0;
  aggregate.quality_counts.needs_review = 1;
  assert.equal(deriveQualityState(aggregate, []), "needs_review");
  aggregate.quality_counts.needs_review = 0;
  aggregate.quality_counts.ready = 1;
  aggregate.learner_ready_entities = 1;
  assert.equal(deriveQualityState(aggregate, []), "ready");
});
