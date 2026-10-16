// D10 enrichment page contract (plan §2, §6), shared by pipeline-supervisor
// and job-enrichment-batch-worker. Pure functions, no I/O.
//
// 1. evaluateEnrichmentPage: how the supervisor reads one batch-worker answer.
//    - residue_waiting   : items of this page still without a final outcome;
//                         stay on the same page (only the remainder is retried)
//    - page_done         : every item of the page is done / no_data / failed;
//                         the chain may move on
//    - invalid           : not a valid page result (worker crash, page load
//                         error, timeout, malformed or foreign answer);
//                         retry the same page, never advance on it
//    Residue fields must be non-negative safe integers. null, strings,
//    negatives or a mismatching chain/offset are invalid, never "0".
//    A page answer WITHOUT residue fields is accepted only as an untracked
//    success (no item of this page needed this chain): ok, failed = 0.
//
// 2. aggregateChunkSize: how many residue items one aggregate batch call may
//    carry. A whole-batch failure has no item attribution, so the retry batch
//    shrinks (plan §2.3 "retry with a reduced batch"):
//      attempt 0 -> whole residue, attempt 1 -> half, attempt 2 (last) -> 1.
//    Single items are the last-resort diagnostic step only (plan §6), so one
//    poisonous item ends as failed alone and its neighbours succeed.

export type EnrichmentPageVerdict =
  | { kind: 'residue_waiting'; waiting: number; failed: number }
  | { kind: 'page_done'; failed: number; hasMore: boolean; nextOffset: number | null; tracked: boolean }
  | { kind: 'invalid'; reason: string };

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function evaluateEnrichmentPage(
  data: unknown,
  page: { chain: string; offset: number; networkError?: string | null },
): EnrichmentPageVerdict {
  if (page.networkError) return { kind: 'invalid', reason: `network: ${page.networkError}` };
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { kind: 'invalid', reason: 'answer is not an object' };
  }
  const d = data as Record<string, unknown>;
  if (d.chain !== page.chain) return { kind: 'invalid', reason: `chain mismatch: ${String(d.chain)}` };
  if (d.offset !== page.offset) return { kind: 'invalid', reason: `offset mismatch: ${String(d.offset)}` };
  if (!isCount(d.processed)) return { kind: 'invalid', reason: 'processed is not a count' };
  if (typeof d.has_more !== 'boolean') return { kind: 'invalid', reason: 'has_more is not boolean' };
  const nextOffset = d.next_offset === null || d.next_offset === undefined ? null : d.next_offset;
  if (d.has_more && !(isCount(nextOffset) && nextOffset > page.offset)) {
    return { kind: 'invalid', reason: 'has_more without a next_offset after this page' };
  }
  if (nextOffset !== null && !isCount(nextOffset)) {
    return { kind: 'invalid', reason: 'next_offset is not a count' };
  }

  const hasWaiting = Object.prototype.hasOwnProperty.call(d, 'residue_waiting');
  const hasFailed = Object.prototype.hasOwnProperty.call(d, 'residue_failed');
  if (hasWaiting || hasFailed) {
    if (!isCount(d.residue_waiting) || !isCount(d.residue_failed)) {
      return { kind: 'invalid', reason: 'residue fields are not non-negative integers' };
    }
    if (d.residue_waiting > 0) {
      return { kind: 'residue_waiting', waiting: d.residue_waiting, failed: d.residue_failed };
    }
    return { kind: 'page_done', failed: d.residue_failed, hasMore: d.has_more,
      nextOffset: nextOffset as number | null, tracked: true };
  }

  // No residue fields: only an untracked, fully successful page is accepted.
  if (d.ok === true && d.failed === 0) {
    return { kind: 'page_done', failed: 0, hasMore: d.has_more,
      nextOffset: nextOffset as number | null, tracked: false };
  }
  return { kind: 'invalid', reason: 'no residue fields and not an untracked success' };
}

export function aggregateChunkSize(residueSize: number, maxAttempt: number): number {
  if (!Number.isSafeInteger(residueSize) || residueSize <= 0) return 0;
  if (!Number.isSafeInteger(maxAttempt) || maxAttempt <= 0) return residueSize;
  if (maxAttempt === 1) return Math.max(1, Math.ceil(residueSize / 2));
  return 1;
}

export type ResidueLedgerEntry = { status: string | null; attempts: number };

// The next aggregate batch of a page: items without a terminal outcome in
// this chain, highest attempt first (the failing part of the last batch),
// sized by aggregateChunkSize.
export function selectAggregateBatch<T extends { id: string }>(
  items: readonly T[],
  ledger: ReadonlyMap<string, ResidueLedgerEntry>,
): T[] {
  const terminal = new Set(['done', 'no_data', 'failed']);
  const attemptOf = (item: T) => ledger.get(item.id)?.attempts ?? 0;
  const open = items.filter((item) => !terminal.has(ledger.get(item.id)?.status ?? ''));
  const maxAttempt = open.reduce((max, item) => Math.max(max, attemptOf(item)), 0);
  const ordered = [...open].sort((a, b) => attemptOf(b) - attemptOf(a) || a.id.localeCompare(b.id));
  return ordered.slice(0, aggregateChunkSize(ordered.length, maxAttempt));
}

export type EnrichmentPageStep = 'wait' | 'advance' | 'retry_page' | 'skip_page';

// Supervisor step for one verdict. priorPageAttempts counts earlier invalid
// answers for the same chain/page.
export function enrichmentPageStep(
  verdict: EnrichmentPageVerdict,
  priorPageAttempts: number,
  maxPageAttempts: number,
): EnrichmentPageStep {
  if (verdict.kind === 'residue_waiting') return 'wait';
  if (verdict.kind === 'page_done') return 'advance';
  return priorPageAttempts + 1 >= maxPageAttempts ? 'skip_page' : 'retry_page';
}

export type AggregateItemOutcome = {
  status: 'done' | 'no_data' | 'retry' | 'failed';
  code: string;
};

// Outcome of one item of an aggregate batch call.
//   - errors that name the item are attributed: retryable -> retry,
//     permanent -> failed (as before);
//   - a failure that names no item (ok:false / whole-batch error) is NOT
//     attributed while the batch has more than one item: every member gets
//     retry, whatever the error type, so the next batch is smaller
//     (aggregateChunkSize). Only a single-item batch attributes it:
//     retryable -> retry, permanent (e.g. HTTP 400) -> failed.
export function aggregateItemOutcome(input: {
  batchSize: number;
  matchedErrors: number;
  noData: boolean;
  unattributedFailure: boolean;
  retryable: boolean;
}): AggregateItemOutcome {
  if (input.noData) return { status: 'no_data', code: 'source_no_data' };
  if (input.matchedErrors > 0) {
    return input.retryable
      ? { status: 'retry', code: 'retryable_batch_error' }
      : { status: 'failed', code: 'permanent_batch_error' };
  }
  if (input.unattributedFailure) {
    if (input.batchSize > 1) return { status: 'retry', code: 'unattributed_batch_error_split' };
    return input.retryable
      ? { status: 'retry', code: 'retryable_batch_error' }
      : { status: 'failed', code: 'permanent_batch_error' };
  }
  return { status: 'done', code: 'batch_completed' };
}
