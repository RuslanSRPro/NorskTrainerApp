export function hasInternalServiceAuthorization(
  authorizationHeader: string | null,
  serviceRoleKey: string,
): boolean {
  if (!authorizationHeader || !serviceRoleKey) return false;
  return authorizationHeader.trim() === `Bearer ${serviceRoleKey}`;
}

export function hasInternalSecretApiKey(
  apiKeyHeader: string | null,
  secretKeysJson: string | undefined,
): boolean {
  const apiKey = apiKeyHeader?.trim();
  if (!apiKey?.startsWith("sb_secret_") || !secretKeysJson) return false;

  try {
    const secretKeys: unknown = JSON.parse(secretKeysJson);
    if (
      typeof secretKeys !== "object" || secretKeys === null ||
      Array.isArray(secretKeys)
    ) {
      return false;
    }
    return Object.values(secretKeys).some((value) => value === apiKey);
  } catch {
    return false;
  }
}

export function isD10PersistenceEnabled(value: string | undefined): boolean {
  return value === "true";
}
