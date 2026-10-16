import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  aggregateChunkSize,
  aggregateItemOutcome,
  enrichmentPageStep,
  evaluateEnrichmentPage,
  selectAggregateBatch,
  type ResidueLedgerEntry,
} from '../../_shared/d10-enrichment-page-contract.ts';

const page = { chain: 'naob', offset: 0 };
const answer = (extra: Record<string, unknown>) => ({
  ok: true, job_id: 'j', chain: 'naob', offset: 0, limit: 20,
  processed: 20, successful: 19, failed: 0, retryable: 0, permanent: 0,
  has_more: false, next_offset: null, total: 20, ...extra,
});

Deno.test('residue 1 keeps the page, then residue 0 advances it', () => {
  const waiting = evaluateEnrichmentPage(answer({ residue_waiting: 1, residue_failed: 0, ok: false, failed: 1, retryable: 1 }), page);
  assertEquals(waiting.kind, 'residue_waiting');
  assertEquals(enrichmentPageStep(waiting, 0, 3), 'wait');
  const done = evaluateEnrichmentPage(answer({ residue_waiting: 0, residue_failed: 1 }), page);
  assertEquals(done, { kind: 'page_done', failed: 1, hasMore: false, nextOffset: null, tracked: true });
  assertEquals(enrichmentPageStep(done, 0, 3), 'advance');
});

Deno.test('null, string or negative residue fields are invalid, never 0', () => {
  for (const bad of [
    { residue_waiting: null, residue_failed: null },
    { residue_waiting: 0, residue_failed: null },
    { residue_waiting: '0', residue_failed: 0 },
    { residue_waiting: -1, residue_failed: 0 },
    { residue_waiting: 0.5, residue_failed: 0 },
    { residue_waiting: 0 },
  ]) {
    assertEquals(evaluateEnrichmentPage(answer(bad), page).kind, 'invalid', JSON.stringify(bad));
  }
});

Deno.test('foreign chain or offset is invalid', () => {
  assertEquals(evaluateEnrichmentPage(answer({ chain: 'forms', residue_waiting: 0, residue_failed: 0 }), page).kind, 'invalid');
  assertEquals(evaluateEnrichmentPage(answer({ offset: 3, residue_waiting: 0, residue_failed: 0 }), page).kind, 'invalid');
  assertEquals(evaluateEnrichmentPage(answer({ offset: '0', residue_waiting: 0, residue_failed: 0 }), page).kind, 'invalid');
});

Deno.test('has_more needs a next_offset after this page', () => {
  assertEquals(evaluateEnrichmentPage(answer({ has_more: true, next_offset: null, residue_waiting: 0, residue_failed: 0 }), page).kind, 'invalid');
  assertEquals(evaluateEnrichmentPage(answer({ has_more: true, next_offset: 0, residue_waiting: 0, residue_failed: 0 }), page).kind, 'invalid');
  assertEquals(evaluateEnrichmentPage(answer({ has_more: true, next_offset: 20, residue_waiting: 0, residue_failed: 0 }), page),
    { kind: 'page_done', failed: 0, hasMore: true, nextOffset: 20, tracked: true });
});

Deno.test('missing residue fields: only an untracked full success is accepted', () => {
  // e.g. no item of this page needs the chain
  assertEquals(evaluateEnrichmentPage(answer({ processed: 0, successful: 0 }), page).kind, 'page_done');
  // page load error answer of the worker: failed 1, ok false, no residue
  assertEquals(evaluateEnrichmentPage(answer({ ok: false, processed: 0, failed: 1, retryable: 1 }), page).kind, 'invalid');
});

Deno.test('whole page crash: retried, skipped only after the attempts', () => {
  const crash = evaluateEnrichmentPage({ ok: false, stage: 'unhandled_exception', error: 'boom' }, page);
  assertEquals(crash.kind, 'invalid');
  assertEquals(enrichmentPageStep(crash, 0, 3), 'retry_page');
  assertEquals(enrichmentPageStep(crash, 1, 3), 'retry_page');
  assertEquals(enrichmentPageStep(crash, 2, 3), 'skip_page');
  assertEquals(evaluateEnrichmentPage(null, page).kind, 'invalid');
  assertEquals(evaluateEnrichmentPage(answer({}), { ...page, networkError: 'timeout' }).kind, 'invalid');
});

Deno.test('aggregate batch size: whole, half, then single items', () => {
  assertEquals(aggregateChunkSize(20, 0), 20);
  assertEquals(aggregateChunkSize(20, 1), 10);
  assertEquals(aggregateChunkSize(5, 1), 3);
  assertEquals(aggregateChunkSize(7, 2), 1);
  assertEquals(aggregateChunkSize(0, 0), 0);
});

// Simulates the worker for one aggregate chain page: the claim rules of the
// ledger (retry with attempts >= 3 becomes failed and is not claimed again),
// batch selection and aggregateItemOutcome. Every batch that contains a
// poisonous item fails as a whole WITHOUT naming the item; the error is
// permanent (HTTP 400) or retryable (timeout).
function simulate(size: number, poison: Set<string>, retryableError: boolean) {
  const items = Array.from({ length: size }, (_, i) => ({ id: `p${String(i + 1).padStart(2, '0')}` }));
  const ledger = new Map<string, ResidueLedgerEntry>();
  let calls = 0;
  for (let guard = 0; guard < 200; guard++) {
    // claim: retry rows that reached 3 attempts become failed
    for (const [id, e] of ledger) if (e.status === 'retry' && e.attempts >= 3) ledger.set(id, { status: 'failed', attempts: e.attempts });
    const batch = selectAggregateBatch(items, ledger);
    if (!batch.length) break;
    calls++;
    const batchFails = batch.some((item) => poison.has(item.id));
    for (const item of batch) {
      const prev = ledger.get(item.id) ?? { status: null, attempts: 0 };
      const outcome = aggregateItemOutcome({
        batchSize: batch.length, matchedErrors: 0, noData: false,
        unattributedFailure: batchFails, retryable: retryableError,
      });
      const attempts = outcome.status === 'retry' || outcome.status === 'failed' ? prev.attempts + 1 : prev.attempts;
      ledger.set(item.id, { status: outcome.status, attempts });
    }
  }
  return { items, ledger, calls };
}

function summary(r: ReturnType<typeof simulate>) {
  return {
    failed: r.items.filter((i) => r.ledger.get(i.id)?.status === 'failed').map((i) => i.id),
    done: r.items.filter((i) => r.ledger.get(i.id)?.status === 'done').length,
  };
}

Deno.test('unattributed PERMANENT error (HTTP 400): poisonous item fails alone', () => {
  const r = simulate(20, new Set(['p07']), false);
  assertEquals(summary(r), { failed: ['p07'], done: 19 });
  assertEquals(r.calls <= 20, true);
});

Deno.test('unattributed RETRYABLE error: poisonous item fails alone', () => {
  const r = simulate(20, new Set(['p07']), true);
  assertEquals(summary(r), { failed: ['p07'], done: 19 });
  const innocents = r.items.filter((i) => i.id !== 'p07').map((i) => r.ledger.get(i.id)!.attempts);
  assertEquals(Math.max(...innocents) <= 2, true);
});

Deno.test('two poisonous items (permanent): only they fail', () => {
  assertEquals(summary(simulate(20, new Set(['p03', 'p15']), false)), { failed: ['p03', 'p15'], done: 18 });
});

Deno.test('healthy aggregate page is one batch call', () => {
  const r = simulate(20, new Set(), false);
  assertEquals(r.calls, 1);
  assertEquals([...r.ledger.values()].every((e) => e.status === 'done' && e.attempts === 0), true);
});

Deno.test('item outcome rules', () => {
  const base = { batchSize: 20, matchedErrors: 0, noData: false, unattributedFailure: false, retryable: false };
  assertEquals(aggregateItemOutcome({ ...base, unattributedFailure: true }).status, 'retry');
  assertEquals(aggregateItemOutcome({ ...base, unattributedFailure: true, batchSize: 1 }).status, 'failed');
  assertEquals(aggregateItemOutcome({ ...base, unattributedFailure: true, batchSize: 1, retryable: true }).status, 'retry');
  assertEquals(aggregateItemOutcome({ ...base, matchedErrors: 1 }).status, 'failed');
  assertEquals(aggregateItemOutcome({ ...base, matchedErrors: 1, retryable: true }).status, 'retry');
  assertEquals(aggregateItemOutcome({ ...base, noData: true, matchedErrors: 1 }).status, 'no_data');
  assertEquals(aggregateItemOutcome(base).status, 'done');
});
