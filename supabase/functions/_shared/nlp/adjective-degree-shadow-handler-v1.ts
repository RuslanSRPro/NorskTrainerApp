import { hasInternalSecretApiKey, hasInternalServiceAuthorization } from "../authoritative-morphology-v2/internal-authorization.ts";
import { deriveComparativeFromPositiveDisplayRowV1, type PositiveDisplayRowV1 } from "./adjective-degree-display-row-adapter-v1.ts";
import { evaluateCuratedAdjectiveClassV1 } from "./adjective-degree-curated-class-v1.ts";

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
  secretKeysJson?: string,
): Promise<Response> {
  const legacyService = hasInternalServiceAuthorization(request.headers.get("authorization"), serviceRoleKey);
  const namedSecret = hasInternalSecretApiKey(request.headers.get("apikey"), secretKeysJson);
  if (!legacyService && !namedSecret) {
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
  const exceptionDecision = result.status === "derived_candidate" && composition?.sourceCandidateIds.length === 1
    ? evaluateCuratedAdjectiveClassV1({
      lexeme_id: rows[0].lexeme_id,
      lemma: rows[0].lemma,
      pos: rows[0].pos,
      dictionary_code: rows[0].dictionary_code,
      article_id: rows[0].article_id,
      snapshot_id: rows[0].snapshot_id,
      rule_source_candidate_id: composition.sourceCandidateIds[0],
    })
    : null;
  return json({
    ok: true,
    mode: "shadow",
    status: result.status === "derived_candidate" ? "candidate" : result.status,
    reason: exceptionDecision?.class === "regular_confirmed"
      ? "one_rule_derived_class_confirmed" : result.reason,
    lexemeId,
    candidate: composition?.candidate ?? null,
    intermediate: composition?.intermediate ?? null,
    appliedRuleCodes: composition?.appliedRuleCodes ?? [],
    sourceCandidateIds: composition?.sourceCandidateIds ?? [],
    evidenceIds: composition?.evidenceIds ?? [],
    sourceSnapshotId: result.sourceSnapshotId ?? null,
    sourceArticleId: result.sourceArticleId ?? null,
    exceptionCheckRequired: exceptionDecision?.exceptionCheckRequired ?? true,
    exceptionClass: exceptionDecision?.class ?? "unknown",
    exceptionDecisionIds: exceptionDecision?.decisionIds ?? [],
    exceptionEvidenceIds: exceptionDecision?.sourceEvidenceIds ?? [],
    activationAuthority: false,
    graphMutation: false,
  });
}
