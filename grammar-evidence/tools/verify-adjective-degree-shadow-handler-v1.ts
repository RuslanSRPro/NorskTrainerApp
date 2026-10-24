import { handleAdjectiveDegreeShadowV1 } from "../../supabase/functions/_shared/nlp/adjective-degree-shadow-handler-v1.ts";

let checks = 0;
function check(value: boolean, label: string) { checks++; if (!value) throw new Error(label); }
const fixture = JSON.parse(await Deno.readTextFile("grammar-evidence/artifacts/R105-adjective-positive-display-rows.json"));
const key = "test-service-role-key";
const url = "https://example.invalid/adjective-degree-rule-shadow-v1";
const request = (lexemeId: string, authorization?: string, method = "POST") =>
  new Request(url, { method, headers: { ...(authorization ? { authorization } : {}), "content-type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify({ lexemeId }) } : {}) });
let reads = 0;
const reader = async (lexemeId: string) => {
  reads++;
  return fixture.rows.filter((row: { lexeme_id: string }) => row.lexeme_id === lexemeId);
};
const noAuth = await handleAdjectiveDegreeShadowV1(request(fixture.rows[0].lexeme_id), key, reader);
check(noAuth.status === 401 && reads === 0, "no authorization blocks before DB read");
const wrongAuth = await handleAdjectiveDegreeShadowV1(request(fixture.rows[0].lexeme_id, "Bearer wrong"), key, reader);
check(wrongAuth.status === 401 && reads === 0, "wrong authorization blocks before DB read");
const outOfScope = await handleAdjectiveDegreeShadowV1(request("00000000-0000-0000-0000-000000000000", `Bearer ${key}`), key, reader);
check(outOfScope.status === 400 && reads === 0, "out-of-scope lexeme blocks before DB read");
const wrongMethod = await handleAdjectiveDegreeShadowV1(request(fixture.rows[0].lexeme_id, `Bearer ${key}`, "GET"), key, reader);
check(wrongMethod.status === 405 && reads === 0, "only POST accepted");
const secret = "sb_secret_test_key";
const secretRequest = (apiKey: string) => new Request(url, { method: "POST",
  headers: { apikey: apiKey, "content-type": "application/json" },
  body: JSON.stringify({ lexemeId: fixture.rows[0].lexeme_id }) });
const validSecret = await handleAdjectiveDegreeShadowV1(secretRequest(secret), key, reader,
  JSON.stringify({ default: secret }));
check(validSecret.status === 200 && (await validSecret.json()).status === "candidate",
  "named secret key authorizes read-only candidate");
const readsAfterSecret = reads;
const invalidSecret = await handleAdjectiveDegreeShadowV1(secretRequest("sb_secret_wrong"), key, reader,
  JSON.stringify({ default: secret }));
check(invalidSecret.status === 401 && reads === readsAfterSecret, "wrong secret blocks before DB read");
for (const row of fixture.rows) {
  const response = await handleAdjectiveDegreeShadowV1(request(row.lexeme_id, `Bearer ${key}`), key, reader);
  const result = await response.json();
  check(response.status === 200 && result.status === "candidate", `${row.lemma}: candidate only`);
  check(result.mode === "shadow" && result.activationAuthority === false && result.graphMutation === false,
    `${row.lemma}: no activation or graph mutation`);
  check(result.exceptionCheckRequired === (row.lemma !== "åpen"), `${row.lemma}: scoped exception decision`);
  check(result.exceptionClass === (row.lemma === "åpen" ? "regular_confirmed" : "unknown"),
    `${row.lemma}: class kept separate from candidate`);
  check(row.lemma !== "åpen" ||
    (result.exceptionDecisionIds.includes("r109-apen-suffix-rule-article-1033") &&
      result.exceptionEvidenceIds.some((id: string) => id.startsWith("ndla:adjective-degree:section-3:"))),
    `${row.lemma}: independent class evidence returned`);
  check(result.sourceSnapshotId === row.snapshot_id && result.sourceArticleId === String(row.article_id),
    `${row.lemma}: source identity preserved`);
  check(result.candidate === (row.lemma === "åpen" ? "åpnere" : "sikrere"),
    `${row.lemma}: graph-first candidate`);
}
const missing = await handleAdjectiveDegreeShadowV1(request(fixture.rows[0].lexeme_id, `Bearer ${key}`), key, async () => []);
check((await missing.json()).status === "not_observed", "missing source abstains");
const duplicate = await handleAdjectiveDegreeShadowV1(request(fixture.rows[0].lexeme_id, `Bearer ${key}`), key,
  async () => [fixture.rows[0], fixture.rows[0]]);
check((await duplicate.json()).status === "not_observed", "ambiguous source abstains");
const broken = await handleAdjectiveDegreeShadowV1(request(fixture.rows[0].lexeme_id, `Bearer ${key}`), key,
  async () => { throw new Error("database down"); });
check(broken.status === 503, "DB read failure is closed");
const malformed = await handleAdjectiveDegreeShadowV1(request(fixture.rows[0].lexeme_id, `Bearer ${key}`), key,
  async () => [null as never]);
check((await malformed.json()).status === "not_applicable", "malformed source row cannot derive");
const changedSnapshot = await handleAdjectiveDegreeShadowV1(request(fixture.rows[0].lexeme_id, `Bearer ${key}`), key,
  async () => [{ ...fixture.rows[0], snapshot_id: "changed-snapshot" }]);
const changedResult = await changedSnapshot.json();
check(changedResult.status === "candidate" && changedResult.exceptionClass === "unknown" &&
  changedResult.exceptionCheckRequired === true, "source snapshot drift keeps candidate unadmitted");
console.log(JSON.stringify({ status: "PASS", checks, dbReadsBeforeAuthorization: 0 }));
