export function ownsJob(
  jobOwnerId: string | null | undefined,
  authenticatedUserId: string,
): boolean {
  return authenticatedUserId.length > 0 &&
    typeof jobOwnerId === "string" &&
    jobOwnerId === authenticatedUserId;
}

// D10 plan A2. job-orchestrator marks a job `done` before pipeline-supervisor
// has run enrichment and the final audit. The job is still processing while
// the supervisor stage is known and not terminal. Only the orchestrator status
// `done` is gated; the supervisor's own final statuses (completed /
// needs_manual_review) and jobs without a supervisor row are never changed.
export const SUPERVISOR_TERMINAL_STAGES: ReadonlySet<string> =
  new Set(["done", "needs_manual_review"]);

export function supervisorStillRunning(
  jobStatus: string | null | undefined,
  inferredExecutionState: string,
  supervisorStage: string | null | undefined,
): boolean {
  const stage = typeof supervisorStage === "string" ? supervisorStage.trim() : "";
  return inferredExecutionState === "completed" &&
    String(jobStatus ?? "").toLowerCase() === "done" &&
    stage.length > 0 &&
    !SUPERVISOR_TERMINAL_STAGES.has(stage);
}
