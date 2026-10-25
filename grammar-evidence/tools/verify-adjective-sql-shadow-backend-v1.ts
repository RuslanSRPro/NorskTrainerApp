import { handleAdjectiveDegreeSqlShadowV1 } from "../../supabase/functions/adjective-degree-sql-shadow-v1/handler.ts";

const lexemeId = "81a6cba3-26d1-4bf1-9cb3-41997911dd50";
const otherId = "41a02dd7-544a-43cf-b186-61275a4d39d9";
const secret = "sb_secret_test_key";
const url = "https://example.invalid/adjective-degree-sql-shadow-v1";
let calls = 0;
let checks = 0;
function check(ok: boolean, label: string) { checks++; if (!ok) throw new Error(label); }
function request(id: string, apiKey = secret, method = "POST") {
  return new Request(url, { method, headers: { apikey: apiKey, "content-type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify({ lexemeId: id }) } : {}) });
}
const result = { status: "candidate", lexemeId, candidate: "åpnere", positiveForm: "åpen",
  manifestCode: "shadow.adjective.degree.apen.en_deletion.v1", ruleCode: "rule",
  activationAuthority: false, graphMutation: false };
const sql = async (id: string): Promise<unknown> => {
  calls++;
  return id === lexemeId ? result : { status: "withheld", reason: "manifest_not_admitted" };
};
const denied = await handleAdjectiveDegreeSqlShadowV1(request(lexemeId, "wrong"), "service", JSON.stringify({ a: secret }), sql);
check(denied.status === 401 && calls === 0, "unauthorized denied before SQL");
const method = await handleAdjectiveDegreeSqlShadowV1(request(lexemeId, secret, "GET"), "service", JSON.stringify({ a: secret }), sql);
check(method.status === 405 && calls === 0, "method denied before SQL");
const invalid = await handleAdjectiveDegreeSqlShadowV1(request("invalid"), "service", JSON.stringify({ a: secret }), sql);
check(invalid.status === 400 && calls === 0, "invalid ID denied before SQL");
const positive = await handleAdjectiveDegreeSqlShadowV1(request(lexemeId), "service", JSON.stringify({ a: secret }), sql);
const p = await positive.json();
check(positive.status === 200 && p.status === "candidate" && p.candidate === "åpnere", "positive candidate");
check(p.activationAuthority === false && p.graphMutation === false, "no activation or mutation");
const negative = await handleAdjectiveDegreeSqlShadowV1(request(otherId), "service", JSON.stringify({ a: secret }), sql);
const n = await negative.json();
check(negative.status === 200 && n.status === "withheld" && n.candidate === null, "unlisted lexeme withheld");
const mismatch = await handleAdjectiveDegreeSqlShadowV1(request(otherId), "service", JSON.stringify({ a: secret }), async () => result);
check(mismatch.status === 503, "cross-lexeme candidate rejected");
const malformed = await handleAdjectiveDegreeSqlShadowV1(request(lexemeId), "service", JSON.stringify({ a: secret }), async () => ({ status: "candidate" }));
check(malformed.status === 503, "malformed SQL result rejected");
const error = await handleAdjectiveDegreeSqlShadowV1(request(lexemeId), "service", JSON.stringify({ a: secret }), async () => { throw Error("db"); });
check(error.status === 503, "SQL failure denied");
check(calls === 2, "only authorized valid calls reached SQL");
console.log(`ADJECTIVE_SQL_SHADOW_BACKEND=PASS checks=${checks}`);
