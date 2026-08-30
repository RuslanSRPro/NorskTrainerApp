import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateCompletion } from "../../_shared/completion-contract/v1/evaluator.ts";
import { GOLDEN_CORPUS_V1 } from "./golden-corpus-v1.ts";

for (const fixture of GOLDEN_CORPUS_V1) {
  test(fixture.name, () => {
    const first = evaluateCompletion(structuredClone(fixture.snapshot));
    const second = evaluateCompletion(structuredClone(fixture.snapshot));

    assert.deepEqual(
      first,
      second,
      "same snapshot must produce byte-equivalent data",
    );
    assert.equal(first.quality_stage, fixture.expected.quality);
    assert.equal(first.paradigm_type, fixture.expected.paradigm);
    assert.equal(
      first.capabilities.dictionary_ready_uk.status,
      fixture.expected.uk,
    );
    assert.equal(
      first.capabilities.dictionary_ready_en.status,
      fixture.expected.en,
    );
    assert.equal(first.evaluated_at, fixture.snapshot.captured_at);
  });
}

test("unsupported snapshot versions fail closed", () => {
  const snapshot = structuredClone(GOLDEN_CORPUS_V1[0].snapshot);
  Object.assign(snapshot, {
    snapshot_version: "completion-evidence-snapshot/v2",
  });
  assert.throws(
    () => evaluateCompletion(snapshot),
    /UNSUPPORTED_SNAPSHOT_VERSION/,
  );
});

test("Lexeme360 becomes ready only for a trusted, bilingual expression relation", () => {
  const snapshot = structuredClone(GOLDEN_CORPUS_V1[0].snapshot);
  const expressionId = "30000000-0000-4000-8000-000000000009";
  snapshot.relations = [{
    id: "50000000-0000-4000-8000-000000000009",
    relation_type: "has_expression",
    status: "trusted",
    needs_review: false,
    expression_id: expressionId,
    source_refs: ["ordbokene:relation:9"],
    translations: (["uk", "en"] as const).map((locale) => ({
      id: `relation-translation:${locale}`,
      locale,
      value: locale === "uk" ? "вираз" : "expression",
      provider: "lexin",
      canonical: false,
      needs_review: false,
      source_refs: [`lexin:relation-translation:${locale}`],
      lexeme_id: null,
      expression_id: expressionId,
    })),
  }];

  const assessment = evaluateCompletion(snapshot);
  assert.equal(assessment.capabilities.lexeme360_ready.status, "ready");
  assert.equal(assessment.quality_stage, "ready");
});

test("Lexeme360 candidates remain optional and do not block base readiness", () => {
  const snapshot = structuredClone(GOLDEN_CORPUS_V1[0].snapshot);
  snapshot.relations = [{
    id: "50000000-0000-4000-8000-000000000010",
    relation_type: "has_expression",
    status: "candidate",
    needs_review: true,
    expression_id: "30000000-0000-4000-8000-000000000010",
    source_refs: [],
    translations: [],
  }];

  const assessment = evaluateCompletion(snapshot);
  assert.equal(assessment.capabilities.lexeme360_ready.status, "provisional");
  assert.equal(assessment.quality_stage, "ready");
  assert.ok(
    assessment.warnings.some((issue) =>
      issue.code === "LEXEME360_RELATION_PROVISIONAL"
    ),
  );
});
