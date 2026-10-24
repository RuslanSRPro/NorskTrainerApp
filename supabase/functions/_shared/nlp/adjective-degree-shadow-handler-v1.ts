import { hasInternalServiceAuthorization } from "../authoritative-morphology-v2/internal-authorization.ts";
import { deriveComparativeFromPositiveDisplayRowV1, type PositiveDisplayRowV1 } from "./adjective-degree-display-row-adapter-v1.ts";

const PILOT_LEXEME_IDS = new Set([
  "81a6cba3-26d1-4bf1-9cb3-41997911dd50", // åpen
  "41a02dd7-544a-43cf-b186-61275a4d39d9", // sikker
]);

export type PositiveRowReaderV1 = (lexemeId: string) => Promise<PositiveDisplayRowV1[]>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function handleAdjectiveDegreeShadowV1(
  request: Request,
  serviceRoleKey: string,
  readPositiveRows: PositiveRowReaderV1,
): Promise<Response> {
  if (!hasInternalServiceAuthorization(request.headers.get("authorization"), serviceRoleKey)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const lexemeId = typeof body === "object" && body !== null && !Array.isArray(body) &&
    typeof (body as Record<string, unknown>).lexemeId === "string"
    ? (body as { lexemeId: string }).lexemeId : "";
  if (!PILOT_LEXEME_IDS.has(lexemeId)) return json({ ok: false, error: "lexeme_not_in_shadow_scope" }, 400);

  let rows: PositiveDisplayRowV1[];
  try { rows = await readPositiveRows(lexemeId); }
  catch { return json({ ok: false, error: "positive_source_read_failed" }, 503); }
  if (rows.length !== 1) {
    return json({ ok: true, mode: "shadow", status: "not_observed",
      reason: "positive_source_row_missing_or_ambiguous", activationAuthority: false });
  }
  const result = deriveComparativeFromPositiveDisplayRowV1(rows[0]);
  const composition = result.composition;
  return json({
    ok: true,
    mode: "shadow",
    status: result.status === "derived_candidate" ? "candidate" : result.status,
    reason: result.reason,
    lexemeId,
    candidate: composition?.candidate ?? null,
    intermediate: composition?.intermediate ?? null,
    appliedRuleCodes: composition?.appliedRuleCodes ?? [],
    sourceCandidateIds: composition?.sourceCandidateIds ?? [],
    evidenceIds: composition?.evidenceIds ?? [],
    sourceSnapshotId: result.sourceSnapshotId ?? null,
    sourceArticleId: result.sourceArticleId ?? null,
    exceptionCheckRequired: composition?.exceptionCheckRequired ?? true,
    activationAuthority: false,
    graphMutation: false,
  });
}
