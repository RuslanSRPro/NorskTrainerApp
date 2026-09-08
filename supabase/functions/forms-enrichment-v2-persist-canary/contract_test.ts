import {
  classifyPersistWorkerOutcome,
  isPersistCanaryLexemeAllowed,
  isPersistCanaryRuntimeIsolated,
  parsePersistCanaryRequest,
} from "./contract.ts";

const LEXEME_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, received ${
        JSON.stringify(actual)
      }`,
    );
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  try {
    fn();
  } catch (error) {
    assertEquals(
      error instanceof Error ? error.message : String(error),
      message,
    );
    return;
  }
  throw new Error(`Expected ${message}`);
}

Deno.test("canary request requires exact confirmation and one UUID", () => {
  assertEquals(
    parsePersistCanaryRequest({
      lexemeId: LEXEME_ID.toUpperCase(),
      confirmation: "PERSIST_D10_V2_CANARY",
    }),
    { lexemeId: LEXEME_ID },
  );
  assertThrows(
    () => parsePersistCanaryRequest({ lexemeId: LEXEME_ID }),
    "PERSIST_CONFIRMATION_REQUIRED",
  );
  assertThrows(
    () =>
      parsePersistCanaryRequest({
        lexemeId: "not-a-uuid",
        confirmation: "PERSIST_D10_V2_CANARY",
      }),
    "LEXEME_ID_REQUIRED",
  );
});

Deno.test("canary allowlist fails closed", () => {
  assertEquals(isPersistCanaryLexemeAllowed(LEXEME_ID, undefined), false);
  assertEquals(isPersistCanaryLexemeAllowed(LEXEME_ID, "not-a-uuid"), false);
  assertEquals(isPersistCanaryLexemeAllowed(LEXEME_ID, OTHER_ID), false);
  assertEquals(
    isPersistCanaryLexemeAllowed(LEXEME_ID, LEXEME_ID.toUpperCase()),
    true,
  );
  const oversized = Array.from(
    { length: 21 },
    (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  );
  assertEquals(
    isPersistCanaryLexemeAllowed(LEXEME_ID, oversized.join(",")),
    false,
  );
});

Deno.test("canary runtime requires both write flags and disabled pipeline shadow", () => {
  assertEquals(isPersistCanaryRuntimeIsolated("true", "true", "false"), true);
  assertEquals(isPersistCanaryRuntimeIsolated("true", "true", undefined), true);
  assertEquals(isPersistCanaryRuntimeIsolated("false", "true", "false"), false);
  assertEquals(isPersistCanaryRuntimeIsolated("true", "false", "false"), false);
  assertEquals(isPersistCanaryRuntimeIsolated("true", "true", "true"), false);
});

Deno.test("worker persistence requires one exact successful result", () => {
  const success = {
    ok: true,
    mode: "persist",
    processed: 1,
    failed: 0,
    missingLexemeIds: [],
    results: [{
      lexemeId: LEXEME_ID,
      status: "resolved_equivalent_source_articles",
      persisted: true,
    }],
  };
  assertEquals(
    classifyPersistWorkerOutcome(true, true, success, LEXEME_ID),
    { requestOk: true, persistenceConfirmed: true },
  );
  assertEquals(
    classifyPersistWorkerOutcome(true, true, {
      ...success,
      results: [{ ...success.results[0], persisted: false }],
    }, LEXEME_ID),
    { requestOk: true, persistenceConfirmed: false },
  );
  assertEquals(
    classifyPersistWorkerOutcome(true, true, success, OTHER_ID),
    { requestOk: true, persistenceConfirmed: false },
  );
  assertEquals(
    classifyPersistWorkerOutcome(false, true, success, LEXEME_ID),
    { requestOk: false, persistenceConfirmed: false },
  );
  assertEquals(
    classifyPersistWorkerOutcome(true, false, success, LEXEME_ID),
    { requestOk: false, persistenceConfirmed: false },
  );
});
