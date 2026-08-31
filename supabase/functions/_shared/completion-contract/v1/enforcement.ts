import type { CompletionEvaluation, FetchSnapshotPage } from "./runtime.ts";
import { evaluateJobCompletion } from "./runtime.ts";

export const COMPLETION_ENFORCEMENT_SUMMARY_FIELD =
  "completion_contract_enforcement_v1" as const;

export const COMPLETION_ENFORCEMENT_MODE_ENV =
  "COMPLETION_CONTRACT_ENFORCEMENT_MODE" as const;
export const COMPLETION_ENFORCEMENT_CANARY_JOB_IDS_ENV =
  "COMPLETION_CONTRACT_CANARY_JOB_IDS" as const;

export type CompletionEnforcementRolloutMode = "shadow" | "canary" | "all";
export type CompletionEnforcementDecision =
  | "allow_completed"
  | "needs_manual_review";

export interface CompletionEnforcementRollout {
  mode: CompletionEnforcementRolloutMode;
  enforce: boolean;
  reason: "shadow_default" | "canary_match" | "canary_miss" | "all_jobs";
}

export interface CompletionEnforcementSummary {
  shadow_mode: false;
  enforcement_applied: false;
  decision: CompletionEnforcementDecision;
  decision_reason: string;
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
  evaluated_at: string;
}

export interface CompletionEnforcementFailureSummary {
  shadow_mode: false;
  enforcement_applied: true;
  rollout_mode: CompletionEnforcementRolloutMode;
  decision: "needs_manual_review";
  decision_reason: "contract_evaluation_failed";
  learner_ready: false;
  enforced_status: "needs_manual_review";
  error: string;
  evaluated_at: string;
  enforced_at: string;
}

export interface EvaluateCompletionEnforcementOptions {
  job_id: string;
  fetch_page: FetchSnapshotPage;
  persist_summary: (
    field: typeof COMPLETION_ENFORCEMENT_SUMMARY_FIELD,
    summary: CompletionEnforcementSummary,
  ) => Promise<void>;
  now?: () => Date;
  page_limit?: number;
  max_pages?: number;
}

export interface CompletionEnforcementEvaluation {
  summary_field: typeof COMPLETION_ENFORCEMENT_SUMMARY_FIELD;
  writes_performed: 1;
  summary: CompletionEnforcementSummary;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCompletionEnforcementMode(
  rawMode: string | undefined,
): CompletionEnforcementRolloutMode {
  const mode = rawMode?.trim();
  return mode === "canary" || mode === "all" ? mode : "shadow";
}

export function parseCompletionCanaryJobIds(
  rawJobIds: string | undefined,
): ReadonlySet<string> {
  return new Set(
    (rawJobIds ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => UUID_PATTERN.test(value)),
  );
}

export function resolveCompletionEnforcementRollout(
  jobId: string,
  rawMode: string | undefined,
  rawCanaryJobIds: string | undefined,
): CompletionEnforcementRollout {
  const mode = parseCompletionEnforcementMode(rawMode);

  if (mode === "all") {
    return { mode, enforce: true, reason: "all_jobs" };
  }

  if (mode === "canary") {
    const enforce = parseCompletionCanaryJobIds(rawCanaryJobIds).has(
      jobId.trim().toLowerCase(),
    );
    return {
      mode,
      enforce,
      reason: enforce ? "canary_match" : "canary_miss",
    };
  }

  return { mode, enforce: false, reason: "shadow_default" };
}

export function deriveCompletionEnforcementDecisionReason(
  evaluation: CompletionEvaluation,
): string {
  if (evaluation.learner_ready) return "learner_ready";
  if (evaluation.execution_state !== "completed") {
    return `execution_state:${evaluation.execution_state}`;
  }
  if (evaluation.unresolved_items_block_completion) {
    return "unresolved_items";
  }
  if (evaluation.quality_state !== "ready") {
    return `quality_state:${evaluation.quality_state}`;
  }
  return "entity_readiness_mismatch";
}

export function buildCompletionEnforcementSummary(
  evaluation: CompletionEvaluation,
  evaluatedAt: string,
): CompletionEnforcementSummary {
  return {
    shadow_mode: false,
    enforcement_applied: false,
    decision: evaluation.learner_ready
      ? "allow_completed"
      : "needs_manual_review",
    decision_reason: deriveCompletionEnforcementDecisionReason(evaluation),
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
    evaluated_at: evaluatedAt,
  };
}

export function buildCompletionEnforcementFailureSummary(
  error: string,
  rolloutMode: CompletionEnforcementRolloutMode,
  now: Date = new Date(),
): CompletionEnforcementFailureSummary {
  const timestamp = now.toISOString();
  return {
    shadow_mode: false,
    enforcement_applied: true,
    rollout_mode: rolloutMode,
    decision: "needs_manual_review",
    decision_reason: "contract_evaluation_failed",
    learner_ready: false,
    enforced_status: "needs_manual_review",
    error,
    evaluated_at: timestamp,
    enforced_at: timestamp,
  };
}

export async function evaluateCompletionEnforcement(
  options: EvaluateCompletionEnforcementOptions,
): Promise<CompletionEnforcementEvaluation> {
  const evaluation = await evaluateJobCompletion(
    options.fetch_page,
    options.job_id,
    {
      page_limit: options.page_limit,
      max_pages: options.max_pages,
    },
  );
  const summary = buildCompletionEnforcementSummary(
    evaluation,
    (options.now ?? (() => new Date()))().toISOString(),
  );

  await options.persist_summary(COMPLETION_ENFORCEMENT_SUMMARY_FIELD, summary);

  return {
    summary_field: COMPLETION_ENFORCEMENT_SUMMARY_FIELD,
    writes_performed: 1,
    summary,
  };
}
