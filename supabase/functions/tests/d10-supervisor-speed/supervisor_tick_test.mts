// D10 27.10.2026 (agreed, speed): when may a supervisor tick start another step of a job.
// Run from the project root:
//   node --experimental-strip-types --test supabase/functions/tests/d10-supervisor-speed/supervisor_tick_test.mts
import test from 'node:test';
import assert from 'node:assert/strict';
const t = await import('../../_shared/d10-supervisor-tick.ts');

test('continue after a plain success of any stage (orchestrator, enrichment, audit)', () => {
  assert.equal(t.continueAfterStep({ stage: 'enrichment', step: 'enrichment[ordbokene]', classification: 'success' }), true);
  assert.equal(t.continueAfterStep({ stage: 'orchestrator', step: 'job-orchestrator', classification: 'success',
    orchestrator_incomplete: true, source_checks_remaining: 40 }), true);
  assert.equal(t.continueAfterStep({ stage: 'audit', step: 'expression-root-refresh', classification: 'success' }), true);
});

test('stop on a wait or an error: retry cooldown, retryable / blocked, lock of another run', () => {
  assert.equal(t.continueAfterStep({ stage: 'enrichment', classification: 'retryable_error', retry_after_cooldown: true }), false);
  assert.equal(t.continueAfterStep({ stage: 'enrichment', classification: 'success', retry_after_cooldown: true }), false);
  assert.equal(t.continueAfterStep({ stage: 'orchestrator', classification: 'success', orchestrator_skipped: true }), false);
  assert.equal(t.continueAfterStep({ stage: 'audit', classification: 'blocked_manual_review' }), false);
  assert.equal(t.continueAfterStep({ job_id: 'x', error: 'boom' }), false);
});

test('stop at a terminal stage or when there is nothing to do', () => {
  assert.equal(t.continueAfterStep({ stage: 'done', classification: 'success' }), false);
  assert.equal(t.continueAfterStep({ stage: 'needs_manual_review', classification: 'success' }), false);
  assert.equal(t.continueAfterStep({ stage: 'done', action: 'skipped', reason: 'already terminal' }), false);
  assert.equal(t.continueAfterStep({ stage: 'audit', action: 'no-op', classification: 'success' }), false);
  assert.equal(t.continueAfterStep(null), false);
});
