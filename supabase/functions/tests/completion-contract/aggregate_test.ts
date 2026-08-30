import assert from "node:assert/strict";
import { test } from "node:test";

import { aggregateAssessmentPages } from "../../_shared/completion-contract/v1/aggregate.ts";
import type { AssessmentPage } from "../../_shared/completion-contract/v1/contract.ts";
import { evaluateCompletion } from "../../_shared/completion-contract/v1/evaluator.ts";
import { GOLDEN_CORPUS_V1 } from "./golden-corpus-v1.ts";

function twoPages(): AssessmentPage[] {
  const first = evaluateCompletion(GOLDEN_CORPUS_V1[0].snapshot);
  const secondSnapshot = structuredClone(GOLDEN_CORPUS_V1[2].snapshot);
  secondSnapshot.entity_id = "20000000-0000-4000-8000-000000000002";
  secondSnapshot.entity_key = `lexeme:${secondSnapshot.entity_id}`;
  secondSnapshot.item_ids = ["40000000-0000-4000-8000-000000000002"];
  secondSnapshot.translations = secondSnapshot.translations.map((
    translation,
  ) => ({
    ...translation,
    lexeme_id: secondSnapshot.entity_id,
  }));
  const second = evaluateCompletion(secondSnapshot);
  return [
    {
      snapshot_token: first.snapshot_token,
      cursor: null,
      next_cursor: first.entity_key,
      has_more: true,
      assessments: [first],
    },
    {
      snapshot_token: first.snapshot_token,
      cursor: first.entity_key,
      next_cursor: null,
      has_more: false,
      assessments: [second],
    },
  ];
}

test("aggregate is cumulative, ordered, and counts readiness", () => {
  const aggregate = aggregateAssessmentPages(twoPages());
  assert.equal(aggregate.total_entities, 2);
  assert.equal(aggregate.learner_ready_entities, 1);
  assert.equal(aggregate.quality_counts.ready, 1);
  assert.equal(aggregate.quality_counts.provisional, 1);
  assert.deepEqual(
    aggregate.assessments.map((assessment) => assessment.entity_key),
    [...aggregate.assessments.map((assessment) => assessment.entity_key)]
      .sort(),
  );
});

test("aggregate rejects snapshot drift", () => {
  const pages = twoPages();
  pages[1].snapshot_token = "sha256:changed";
  assert.throws(() => aggregateAssessmentPages(pages), /SNAPSHOT_CHANGED/);
});

test("aggregate rejects duplicate entities", () => {
  const pages = twoPages();
  pages[1].assessments = [pages[0].assessments[0]];
  assert.throws(() => aggregateAssessmentPages(pages), /DUPLICATE_ENTITY/);
});

test("aggregate rejects incomplete paging", () => {
  const pages = twoPages();
  pages.pop();
  assert.throws(
    () => aggregateAssessmentPages(pages),
    /INCOMPLETE_ASSESSMENT_PAGES/,
  );
});
