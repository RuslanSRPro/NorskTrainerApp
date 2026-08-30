import { aggregateAssessmentPages } from "./aggregate.ts";
import type {
  AggregateAssessment,
  AssessmentPage,
  EntityEvidenceSnapshot,
  ExecutionState,
  QualityStage,
} from "./contract.ts";
import { evaluateCompletion } from "./evaluator.ts";

export interface SnapshotRpcResult {
  snapshot_version: string;
  snapshot_token: string;
  captured_at: string;
  execution_state: ExecutionState;
  counts: {
    total_items: number;
    total_entities: number;
    unresolved_items: number;
  };
  unresolved_items: unknown[];
  page: {
    cursor: string | null;
    next_cursor: string | null;
    has_more: boolean;
    entities: EntityEvidenceSnapshot[];
  };
}

export interface SnapshotPageRequest {
  job_id: string;
  cursor: string | null;
  limit: number;
  expected_snapshot_token: string | null;
}

export type FetchSnapshotPage = (
  request: SnapshotPageRequest,
) => Promise<SnapshotRpcResult>;

export interface CompletionEvaluation {
  execution_state: ExecutionState;
  quality_state: QualityStage;
  learner_ready: boolean;
  source_counts: SnapshotRpcResult["counts"];
  unresolved_items: unknown[];
  unresolved_items_block_completion: boolean;
  report: AggregateAssessment;
}

export interface EvaluateJobOptions {
  page_limit?: number;
  max_pages?: number;
}

function integerInRange(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`INTEGER_RANGE:${min}:${max}`);
  }
  return value;
}

export function deriveQualityState(
  report: AggregateAssessment,
  unresolvedItems: readonly unknown[],
): QualityStage {
  if (unresolvedItems.length > 0 || report.quality_counts.needs_review > 0) {
    return "needs_review";
  }
  if (report.quality_counts.blocked > 0) return "blocked";
  if (report.quality_counts.provisional > 0) return "provisional";
  if (report.quality_counts.ready === report.total_entities) return "ready";
  return "blocked";
}

export async function evaluateJobCompletion(
  fetchPage: FetchSnapshotPage,
  jobId: string,
  options: EvaluateJobOptions = {},
): Promise<CompletionEvaluation> {
  const pageLimit = integerInRange(options.page_limit, 20, 1, 50);
  const maxPages = integerInRange(options.max_pages, 100, 1, 1000);
  const pages: AssessmentPage[] = [];
  let cursor: string | null = null;
  let expectedSnapshotToken: string | null = null;
  let executionState: ExecutionState | null = null;
  let sourceCounts: SnapshotRpcResult["counts"] | null = null;
  let unresolvedItems: unknown[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const snapshot = await fetchPage({
      job_id: jobId,
      cursor,
      limit: pageLimit,
      expected_snapshot_token: expectedSnapshotToken,
    });

    if (!snapshot?.page || !Array.isArray(snapshot.page.entities)) {
      throw new Error("INVALID_SNAPSHOT_RESPONSE");
    }
    if (
      expectedSnapshotToken !== null &&
      snapshot.snapshot_token !== expectedSnapshotToken
    ) {
      throw new Error("SNAPSHOT_CHANGED");
    }
    if (executionState && snapshot.execution_state !== executionState) {
      throw new Error("EXECUTION_STATE_CHANGED");
    }

    expectedSnapshotToken = snapshot.snapshot_token;
    executionState ??= snapshot.execution_state;
    sourceCounts ??= snapshot.counts;
    unresolvedItems = snapshot.unresolved_items ?? [];

    pages.push({
      snapshot_token: snapshot.snapshot_token,
      cursor: snapshot.page.cursor,
      next_cursor: snapshot.page.next_cursor,
      has_more: snapshot.page.has_more,
      assessments: snapshot.page.entities.map(evaluateCompletion),
    });

    if (!snapshot.page.has_more) break;
    if (!snapshot.page.next_cursor || snapshot.page.next_cursor === cursor) {
      throw new Error("INVALID_PAGE_CURSOR");
    }
    cursor = snapshot.page.next_cursor;
  }

  if (pages.at(-1)?.has_more) throw new Error("MAX_PAGES_EXCEEDED");
  if (!executionState || !sourceCounts) {
    throw new Error("INVALID_SNAPSHOT_RESPONSE");
  }

  const report = aggregateAssessmentPages(pages);
  const qualityState = deriveQualityState(report, unresolvedItems);
  const unresolvedItemsBlockCompletion = unresolvedItems.length > 0;
  const learnerReady = executionState === "completed" &&
    !unresolvedItemsBlockCompletion && qualityState === "ready" &&
    report.learner_ready_entities === report.total_entities;

  return {
    execution_state: executionState,
    quality_state: qualityState,
    learner_ready: learnerReady,
    source_counts: sourceCounts,
    unresolved_items: unresolvedItems,
    unresolved_items_block_completion: unresolvedItemsBlockCompletion,
    report,
  };
}
