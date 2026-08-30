import type { CompletionEvaluation, FetchSnapshotPage } from "./runtime.ts";
import { evaluateJobCompletion } from "./runtime.ts";

export const COMPLETION_SHADOW_SUMMARY_FIELD =
  "completion_contract_shadow_v1" as const;

export interface CompletionShadowSummary {
  shadow_mode: true;
  enforcement_applied: false;
  contract_version: string;
  snapshot_token: string;
  execution_state: CompletionEvaluation["execution_state"];
  quality_state: CompletionEvaluation["quality_state"];
  learner_ready: boolean;
  source_counts: CompletionEvaluation["source_counts"];
  unresolved_items_count: number;
  unresolved_items_block_completion: boolean;
  quality_counts: CompletionEvaluation["report"]["quality_counts"];
  capability_counts: CompletionEvaluation["report"]["capability_counts"];
  observed_at: string;
}

export interface ObserveCompletionShadowOptions {
  job_id: string;
  fetch_page: FetchSnapshotPage;
  persist_summary: (
    field: typeof COMPLETION_SHADOW_SUMMARY_FIELD,
    summary: CompletionShadowSummary,
  ) => Promise<void>;
  now?: () => Date;
  page_limit?: number;
  max_pages?: number;
}

export interface CompletionShadowObservation {
  summary_field: typeof COMPLETION_SHADOW_SUMMARY_FIELD;
  writes_performed: 1;
  summary: CompletionShadowSummary;
}

export function buildCompletionShadowSummary(
  evaluation: CompletionEvaluation,
  observedAt: string,
): CompletionShadowSummary {
  return {
    shadow_mode: true,
    enforcement_applied: false,
    contract_version: evaluation.report.contract_version,
    snapshot_token: evaluation.report.snapshot_token,
    execution_state: evaluation.execution_state,
    quality_state: evaluation.quality_state,
    learner_ready: evaluation.learner_ready,
    source_counts: evaluation.source_counts,
    unresolved_items_count: evaluation.unresolved_items.length,
    unresolved_items_block_completion:
      evaluation.unresolved_items_block_completion,
    quality_counts: evaluation.report.quality_counts,
    capability_counts: evaluation.report.capability_counts,
    observed_at: observedAt,
  };
}

export async function observeCompletionShadow(
  options: ObserveCompletionShadowOptions,
): Promise<CompletionShadowObservation> {
  const evaluation = await evaluateJobCompletion(
    options.fetch_page,
    options.job_id,
    {
      page_limit: options.page_limit,
      max_pages: options.max_pages,
    },
  );
  const summary = buildCompletionShadowSummary(
    evaluation,
    (options.now ?? (() => new Date()))().toISOString(),
  );

  await options.persist_summary(COMPLETION_SHADOW_SUMMARY_FIELD, summary);

  return {
    summary_field: COMPLETION_SHADOW_SUMMARY_FIELD,
    writes_performed: 1,
    summary,
  };
}
