export type WorkerOutcome = {
  requestOk: boolean;
  comparisonOk: boolean;
};

// A completed comparison may legitimately report source ambiguity, not_found,
// or V1/V2 differences through body.ok=false. Those are audit results, not an
// HTTP transport failure. Only a failed HTTP call or invalid JSON is a failed
// comparison request.
export function classifyWorkerOutcome(
  httpOk: boolean,
  validJson: boolean,
  body: unknown,
): WorkerOutcome {
  const requestOk = httpOk && validJson;
  const semanticOk = !isRecord(body) || body.ok !== false;
  return {
    requestOk,
    comparisonOk: requestOk && semanticOk,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
