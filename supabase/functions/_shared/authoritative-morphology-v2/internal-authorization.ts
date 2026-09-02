export function hasInternalServiceAuthorization(
  authorizationHeader: string | null,
  serviceRoleKey: string,
): boolean {
  if (!authorizationHeader || !serviceRoleKey) return false;
  return authorizationHeader.trim() === `Bearer ${serviceRoleKey}`;
}

export function isD10PersistenceEnabled(value: string | undefined): boolean {
  return value === "true";
}
