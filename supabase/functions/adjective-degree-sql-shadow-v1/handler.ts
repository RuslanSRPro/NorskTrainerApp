import { hasInternalSecretApiKey, hasInternalServiceAuthorization } from "../_shared/authoritative-morphology-v2/internal-authorization.ts";

type SqlResult = Record<string, unknown>;
export type SqlRuleCaller = (lexemeId: string) => Promise<unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export async function handleAdjectiveDegreeSqlShadowV1(
  request: Request,
  serviceRoleKey: string,
  secretKeysJson: string | undefined,
  callSql: SqlRuleCaller,
): Promise<Response> {
  const authorized = hasInternalServiceAuthorization(request.headers.get("authorization"), serviceRoleKey) ||
    hasInternalSecretApiKey(request.headers.get("apikey"), secretKeysJson);
  if (!authorized) return json({ ok: false, error: "unauthorized" }, 401);
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const lexemeId = body && typeof body === "object" && !Array.isArray(body) &&
    typeof (body as Record<string, unknown>).lexemeId === "string"
    ? (body as { lexemeId: string }).lexemeId : "";
  if (!UUID.test(lexemeId)) return json({ ok: false, error: "invalid_lexeme_id" }, 400);

  let result: unknown;
  try { result = await callSql(lexemeId); }
  catch { return json({ ok: false, error: "sql_shadow_call_failed" }, 503); }
  if (!result || typeof result !== "object" || Array.isArray(result))
    return json({ ok: false, error: "sql_shadow_response_invalid" }, 503);
  const row = result as SqlResult;
  if (row.status === "withheld" && typeof row.reason === "string") {
    return json({ ok: true, mode: "shadow", status: "withheld", reason: row.reason,
      candidate: null, activationAuthority: false, graphMutation: false });
  }
  if (row.status !== "candidate" || row.lexemeId !== lexemeId ||
      typeof row.candidate !== "string" || typeof row.positiveForm !== "string" ||
      typeof row.manifestCode !== "string" || typeof row.ruleCode !== "string" ||
      row.activationAuthority !== false || row.graphMutation !== false) {
    return json({ ok: false, error: "sql_shadow_response_invalid" }, 503);
  }
  return json({ ok: true, mode: "shadow", status: "candidate", lexemeId,
    candidate: row.candidate, positiveForm: row.positiveForm,
    ruleCode: row.ruleCode, manifestCode: row.manifestCode,
    sourceCandidateId: row.sourceCandidateId, positiveSnapshotId: row.positiveSnapshotId,
    articleId: row.articleId, classEvidenceId: row.classEvidenceId,
    stressEvidenceId: row.stressEvidenceId, exceptionDecisionId: row.exceptionDecisionId,
    activationAuthority: false, graphMutation: false });
}
