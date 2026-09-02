import { classifyWorkerOutcome } from "./contract.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

Deno.test("semantic audit differences keep the request successful", () => {
  assertEquals(classifyWorkerOutcome(true, true, { ok: false, failed: 1 }), {
    requestOk: true,
    comparisonOk: false,
  });
});

Deno.test("successful worker result passes both gates", () => {
  assertEquals(classifyWorkerOutcome(true, true, { ok: true, failed: 0 }), {
    requestOk: true,
    comparisonOk: true,
  });
});

Deno.test("worker HTTP failure fails the request gate", () => {
  assertEquals(classifyWorkerOutcome(false, true, { ok: false }), {
    requestOk: false,
    comparisonOk: false,
  });
});

Deno.test("invalid worker JSON fails the request gate", () => {
  assertEquals(classifyWorkerOutcome(true, false, null), {
    requestOk: false,
    comparisonOk: false,
  });
});
