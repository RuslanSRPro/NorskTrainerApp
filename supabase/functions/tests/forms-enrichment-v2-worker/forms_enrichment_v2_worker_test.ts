import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { readBody } from "../../forms-enrichment-v2-worker/index.ts";

function request(body: unknown): Request {
  return new Request("http://local.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("V2 backfill accepts a bounded persistent page", async () => {
  assertEquals(
    await readBody(request({
      backfill: true,
      persist: true,
      offset: 50,
      limit: 25,
      verifyPersisted: false,
    })),
    {
      backfill: true,
      persist: true,
      offset: 50,
      limit: 25,
      verifyPersisted: false,
    },
  );
});

Deno.test("persisted verification accepts explicit IDs without persistence", async () => {
  assertEquals(
    await readBody(request({
      lexemeIds: ["lexeme-a", "lexeme-a", "lexeme-b"],
      verifyPersisted: true,
    })),
    {
      lexemeIds: ["lexeme-a", "lexeme-b"],
      persist: false,
      verifyPersisted: true,
    },
  );
});

Deno.test("persisted verification rejects persistence", async () => {
  await assertRejects(
    () =>
      readBody(request({
        lexemeIds: ["lexeme-a"],
        verifyPersisted: true,
        persist: true,
      })),
    Error,
    "VERIFY_PERSISTED_CANNOT_PERSIST",
  );
});

Deno.test("persisted verification rejects implicit backfill pages", async () => {
  await assertRejects(
    () =>
      readBody(request({
        backfill: true,
        verifyPersisted: true,
        offset: 0,
        limit: 25,
      })),
    Error,
    "VERIFY_PERSISTED_REQUIRES_EXPLICIT_LEXEME_IDS",
  );
});

Deno.test("V2 backfill rejects pages above the worker ceiling", async () => {
  await assertRejects(
    () => readBody(request({ backfill: true, persist: true, limit: 26 })),
    Error,
    "BACKFILL_LIMIT_MUST_BE_1_TO_25",
  );
});

Deno.test("manual lookup remains non-persistent", async () => {
  await assertRejects(
    () =>
      readBody(request({
        lookupWord: "bok",
        lookupPos: "noun",
        persist: true,
      })),
    Error,
    "MANUAL_LOOKUP_CANNOT_PERSIST",
  );
});
