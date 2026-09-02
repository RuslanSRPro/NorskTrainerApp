const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_CANARY_JOB_IDS = 500;

export function isD10FormsV2CanaryEnabled(
  jobId: string,
  shadowEnabled: string | undefined,
  rawCanaryJobIds: string | undefined,
): boolean {
  if (shadowEnabled !== "true" || !UUID_PATTERN.test(jobId)) return false;

  const entries = (rawCanaryJobIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // Fail closed for a missing, malformed, or unexpectedly broad allowlist.
  if (
    entries.length === 0 ||
    entries.length > MAX_CANARY_JOB_IDS ||
    entries.some((value) => !UUID_PATTERN.test(value))
  ) {
    return false;
  }

  const normalizedJobId = jobId.toLowerCase();
  return entries.some((value) => value.toLowerCase() === normalizedJobId);
}
