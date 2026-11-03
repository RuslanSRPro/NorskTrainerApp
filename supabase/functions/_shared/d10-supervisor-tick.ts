// D10 27.10.2026 (agreed, speed): may a supervisor tick start another step of
// the same job after this step result? Only after a plain success that is not
// a wait (retry cooldown, lock of another run, terminal stage, nothing to do).
// Pure function, shared by pipeline-supervisor and its tests.
export function continueAfterStep(result: Record<string, unknown> | null | undefined): boolean {
  if (!result || result.classification !== 'success') return false;
  if (result.action === 'skipped' || result.action === 'no-op') return false;
  if (result.orchestrator_skipped === true) return false;
  if (result.retry_after_cooldown === true) return false;
  const stage = String(result.stage ?? '');
  if (stage === 'done' || stage === 'needs_manual_review') return false;
  return true;
}
