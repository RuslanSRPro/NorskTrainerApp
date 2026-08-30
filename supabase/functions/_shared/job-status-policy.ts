export function ownsJob(
  jobOwnerId: string | null | undefined,
  authenticatedUserId: string,
): boolean {
  return authenticatedUserId.length > 0 &&
    typeof jobOwnerId === "string" &&
    jobOwnerId === authenticatedUserId;
}
