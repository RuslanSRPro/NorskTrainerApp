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
    })),
    {
      backfill: true,
      persist: true,
      offset: 50,
      limit: 25,
    },
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
