import assert from "node:assert/strict";
import { test } from "node:test";
import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";

import assessmentSchema from "../../_shared/completion-contract/v1/assessment.schema.json" with {
  type: "json",
};
import { evaluateCompletion } from "../../_shared/completion-contract/v1/evaluator.ts";
import { GOLDEN_CORPUS_V1 } from "./golden-corpus-v1.ts";

type SchemaValidator = ((data: unknown) => boolean) & { errors?: unknown };
interface AjvInstance {
  compile(schema: unknown): SchemaValidator;
}
type AjvConstructor = new (options: Record<string, unknown>) => AjvInstance;
type AddFormats = (instance: AjvInstance) => void;
const Ajv2020 = (
  (Ajv2020Module as unknown as { default?: unknown }).default ?? Ajv2020Module
) as unknown as AjvConstructor;
const addFormats = (
  (addFormatsModule as unknown as { default?: unknown }).default ??
    addFormatsModule
) as unknown as AddFormats;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(assessmentSchema);

for (const fixture of GOLDEN_CORPUS_V1) {
  test(`schema: ${fixture.name}`, () => {
    const assessment = evaluateCompletion(fixture.snapshot);
    assert.equal(
      validate(assessment),
      true,
      JSON.stringify(validate.errors, null, 2),
    );
  });
}

test("schema rejects an unknown capability status", () => {
  const assessment = structuredClone(
    evaluateCompletion(GOLDEN_CORPUS_V1[0].snapshot),
  );
  Object.assign(assessment.capabilities.analysis_ready, { status: "maybe" });
  assert.equal(validate(assessment), false);
});
