import { evaluateJobCompletion, type CompletionEvaluation, type FetchSnapshotPage } from "./runtime.ts";
import { evaluateCompletion } from "./evaluator.ts";
import { aggregateAssessmentPages } from "./aggregate.ts";
import type { AggregateAssessment, AssessmentPage } from "./contract.ts";

export async function evaluateAuditCompletion(fetchPage: FetchSnapshotPage, jobId: string) {
  const contentPages: AssessmentPage[] = [];
  const completion = await evaluateJobCompletion(async (request) => {
    const snapshot = await fetchPage(request);
    // Diagnostic content view only. The original runtime applies execution gates
    // and validates all page tokens/cursors. Its learner readiness is unchanged.
    contentPages.push({snapshot_token: snapshot.snapshot_token,
      cursor: snapshot.page.cursor, next_cursor: snapshot.page.next_cursor,
      has_more: snapshot.page.has_more,
      assessments: snapshot.page.entities.map(entity => evaluateCompletion({
        ...entity, execution_state: "completed",
      })),
    });
    return snapshot;
  }, jobId);
  return {completion, content: aggregateAssessmentPages(contentPages)};
}

export interface ReviewItem {
  id: string;
  normalized_lemma: string | null;
  pos: string | null;
  current_stage: string | null;
  status: string | null;
  lexeme_id: string | null;
  expression_id: string | null;
  result_summary: Record<string, unknown> | null;
}

// Display projection only. Does not relax learner readiness or mutate job state.
export function buildAuditReport(completion: CompletionEvaluation, reviews: ReviewItem[], content: AggregateAssessment) {
  const expected = new Set(completion.unresolved_items.map((item) => {
    if (!item || typeof item !== "object" || !("item_id" in item) ||
        typeof item.item_id !== "string") throw new Error("REPORT_UNRESOLVED_ID_REQUIRED");
    return item.item_id;
  }));
  if (expected.size !== completion.unresolved_items.length || reviews.length !== expected.size)
    throw new Error("REPORT_REVIEW_ITEMS_CHANGED");
  const seen = new Set<string>();
  const candidates = reviews.map((item) => {
    if (!expected.has(item.id) || seen.has(item.id) || item.lexeme_id || item.expression_id)
      throw new Error("REPORT_REVIEW_ITEMS_CHANGED");
    seen.add(item.id);
    const summary = item.result_summary ?? {};
    return {
      item_id: item.id, lemma: item.normalized_lemma, pos: item.pos,
      kind: summary.clone_version === "d10_pos_isolation_v1" && summary.candidate_provenance
        ? "additional_pos_candidate" : "unresolved_input",
      status: item.current_stage === "admission_gate" ? "needs_review" : "pending",
      admission_reason: typeof summary.admission_reason === "string" ? summary.admission_reason : null,
      admission_status: typeof summary.admission_status === "string" ? summary.admission_status : null,
      promotion_status: typeof summary.promotion_status === "string" ? summary.promotion_status : null,
      candidate_provenance: summary.candidate_provenance ?? null,
    };
  });
  if (content.snapshot_token !== completion.report.snapshot_token ||
      content.total_entities !== completion.report.total_entities ||
      content.assessments.some((a, i) => a.entity_key !== completion.report.assessments[i]?.entity_key))
    throw new Error("REPORT_CONTENT_SNAPSHOT_CHANGED");
  const counts = content.quality_counts;
  const total = completion.report.total_entities;
  // Zero promoted entities is never a successful empty result.
  const entityState = total === 0 ? "empty" : counts.blocked > 0 ? "blocked"
    : counts.needs_review > 0 ? "needs_review" : counts.provisional > 0 ? "provisional"
    : counts.ready === total ? "ready" : "blocked";
  return {
    version: "d10_completion_report_v1",
    snapshot_token: completion.report.snapshot_token,
    execution_state: completion.execution_state,
    overall_learner_ready: completion.learner_ready,
    scope: {
      readiness: "completion-contract/v1",
      entity_content_view: "execution_gate_excluded_for_diagnostics_only",
      example_content_quality: "not_assessed_by_this_contract",
      ai_review_provenance: "exact_translation_binding_assessed_for_ai_fallback_lexemes",
    },
    entities: {
      state: entityState, total, quality_counts: counts,
      identity_accepted: content.assessments.filter(a =>
        a.capabilities.analysis_ready.status === "ready").length,
      all_ready_by_contract: entityState === "ready",
      capability_counts: content.capability_counts,
      execution_gate_applied: false,
      items: content.assessments.map(a => ({
        entity_id: a.entity_id, kind: a.entity_kind, lemma: a.lemma, pos: a.pos,
        identity_accepted: a.capabilities.analysis_ready.status === "ready",
        quality_stage: a.quality_stage, capabilities: a.capabilities,
        blockers: a.blockers, warnings: a.warnings,
      })),
    },
    execution_blockers: completion.report.assessments.flatMap(a =>
      a.blockers.filter(b => b.code.startsWith("EXECUTION_")).map(b => ({entity_id:a.entity_id,...b}))),
    candidates: {
      total: candidates.length,
      needs_review: candidates.filter(i => i.status === "needs_review").length,
      pending: candidates.filter(i => i.status === "pending").length,
      additional_pos: candidates.filter(i => i.kind === "additional_pos_candidate").length,
      items: candidates,
    },
    intentional_exclusions: completion.source_counts.excluded_items ?? 0,
    message_code: entityState === "empty" ? "NO_PROMOTED_ENTITIES"
      : entityState === "ready" && candidates.length > 0 ? "ENTITIES_READY_CANDIDATES_UNRESOLVED"
      : entityState === "ready" ? "ENTITIES_READY_BY_CONTRACT"
      : "ENTITY_REQUIREMENTS_NOT_MET",
  };
}
