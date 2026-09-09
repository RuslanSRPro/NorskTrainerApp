const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONFIRMATION = "PERSIST_D10_V2_CANARY";
const MAX_ALLOWLIST_ENTRIES = 20;

export type PersistCanaryRequest = {
  lexemeId: string;
};

export type PersistWorkerOutcome = {
  requestOk: boolean;
  persistenceConfirmed: boolean;
};

export function isPersistCanaryRuntimeIsolated(
  canaryEnabled: string | undefined,
  persistenceEnabled: string | undefined,
  pipelineShadowEnabled: string | undefined,
): boolean {
  return canaryEnabled === "true" &&
    persistenceEnabled === "true" &&
    pipelineShadowEnabled !== "true";
}

export function parsePersistCanaryRequest(
  payload: unknown,
): PersistCanaryRequest {
  if (!isRecord(payload)) throw new Error("JSON_OBJECT_REQUIRED");
  if (payload.confirmation !== CONFIRMATION) {
    throw new Error("PERSIST_CONFIRMATION_REQUIRED");
  }

  const lexemeId = typeof payload.lexemeId === "string"
    ? payload.lexemeId.trim().toLowerCase()
    : "";
  if (!UUID_PATTERN.test(lexemeId)) throw new Error("LEXEME_ID_REQUIRED");
  return { lexemeId };
}

export function isPersistCanaryLexemeAllowed(
  lexemeId: string,
  rawAllowlist: string | undefined,
): boolean {
  if (!UUID_PATTERN.test(lexemeId)) return false;
  const entries = (rawAllowlist ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (
    entries.length === 0 ||
    entries.length > MAX_ALLOWLIST_ENTRIES ||
    entries.some((value) => !UUID_PATTERN.test(value))
  ) {
    return false;
  }

  return entries.includes(lexemeId.toLowerCase());
}

export function classifyPersistWorkerOutcome(
  httpOk: boolean,
  validJson: boolean,
  body: unknown,
  expectedLexemeId: string,
): PersistWorkerOutcome {
  const requestOk = httpOk && validJson;
  if (!requestOk || !isRecord(body)) {
    return { requestOk, persistenceConfirmed: false };
  }

  const results = Array.isArray(body.results) ? body.results : [];
  const result = results.length === 1 && isRecord(results[0])
    ? results[0]
    : null;
  const missing = Array.isArray(body.missingLexemeIds)
    ? body.missingLexemeIds
    : [];
  const eligibleStatus = result?.status === "resolved" ||
    result?.status === "resolved_equivalent_source_articles" ||
    result?.status === "resolved_bound_source_article";

  return {
    requestOk,
    persistenceConfirmed: body.ok === true &&
      body.mode === "persist" &&
      body.processed === 1 &&
      body.failed === 0 &&
      missing.length === 0 &&
      result?.lexemeId === expectedLexemeId &&
      result?.persisted === true &&
      eligibleStatus,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
