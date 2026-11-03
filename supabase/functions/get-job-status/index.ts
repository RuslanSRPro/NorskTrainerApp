import { buildAuditReport, evaluateAuditCompletion, type ReviewItem } from "../_shared/completion-contract/v1/audit-report.ts";
import { withSupabase } from "@supabase/server";

import {
  type SnapshotRpcResult,
} from "../_shared/completion-contract/v1/runtime.ts";
import type {
  ExecutionState,
} from "../_shared/completion-contract/v1/contract.ts";
import { ownsJob, supervisorStillRunning } from "../_shared/job-status-policy.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface StatusRequest {
  job_id?: unknown;
  include_chain_progress?: unknown;
}

interface JobRow {
  id: string;
  user_id: string | null;
  status: string | null;
  total_items: number | null;
  done_items: number | null;
  partial_items: number | null;
  failed_items: number | null;
  skipped_items: number | null;
  summary: unknown;
  created_at: string;
  updated_at: string;
}

interface ProgressRow {
  status?: string | null;
  ready_for_promotion?: boolean | null;
  [key: string]: unknown;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function readRequest(request: Request): Promise<{
  jobId: string;
  includeChainProgress: boolean;
}> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    return {
      jobId: (url.searchParams.get("job_id") ?? "").trim(),
      includeChainProgress:
        url.searchParams.get("include_chain_progress") === "true",
    };
  }
  if (request.method !== "POST") throw new Error("METHOD_NOT_ALLOWED");

  let input: StatusRequest;
  try {
    input = await request.json() as StatusRequest;
  } catch {
    throw new Error("INVALID_JSON");
  }
  return {
    jobId: typeof input.job_id === "string" ? input.job_id.trim() : "",
    includeChainProgress: input.include_chain_progress === true,
  };
}

function errorStatus(message: string): number {
  if (message.includes("METHOD_NOT_ALLOWED")) return 405;
  if (
    message.includes("JOB_ID_REQUIRED") ||
    message.includes("INVALID_JSON") ||
    message.includes("INTEGER_RANGE")
  ) return 400;
  if (message.includes("JOB_NOT_FOUND")) return 404;
  if (message.includes("SNAPSHOT_CHANGED")) return 409;
  return 500;
}

function inferExecutionState(
  job: JobRow,
  progress: ProgressRow,
): ExecutionState {
  const jobStatus = String(job.status ?? "").toLowerCase();
  const progressStatus = String(progress.status ?? "").toLowerCase();

  if (jobStatus === "failed" || progressStatus === "failed") return "failed";
  if (
    jobStatus === "needs_manual_review" ||
    progressStatus === "needs_manual_review"
  ) {
    return "needs_manual_review";
  }
  if (
    progress.ready_for_promotion === true ||
    ["ready", "done", "completed"].includes(progressStatus) ||
    ["done", "completed"].includes(jobStatus)
  ) {
    return "completed";
  }
  if (["processing", "running", "in_progress"].includes(progressStatus)) {
    return "running";
  }
  if (["pending", "queued", "not_started"].includes(jobStatus)) {
    return "pending";
  }
  return "running";
}

// pipeline_supervisor_state.stage of the job, or null when there is no row or
// it cannot be read (then the previous status logic applies unchanged).
async function loadSupervisorStage(admin: any, jobId: string): Promise<string | null> {
  try {
    const { data, error } = await admin
      .from("pipeline_supervisor_state")
      .select("stage")
      .eq("job_id", jobId)
      .maybeSingle();
    if (error) {
      console.error("get-job-status: supervisor stage read failed", jobId, error.message);
      return null;
    }
    const stage = typeof data?.stage === "string" ? data.stage.trim() : "";
    return stage || null;
  } catch (error) {
    console.error("get-job-status: supervisor stage read failed", jobId, String(error));
    return null;
  }
}

function publicJob(job: JobRow): Omit<JobRow, "user_id"> {
  const { user_id: _owner, ...safeJob } = job;
  return safeJob;
}

async function loadLearnerItems(
  admin: any,
  jobId: string,
): Promise<unknown[]> {
  const { data: items, error: itemsError } = await admin
    .from("lexeme_processing_items")
    .select(`
      id, raw_input, normalized_input, normalized_lemma,
      surface_form, pos, match_type, expression_id, lexeme_id,
      status, current_stage, result_summary
    `)
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  if (itemsError) throw new Error(`ITEMS_READ_FAILED:${itemsError.message}`);

  const expressionIds = [...new Set((items ?? []).map((item: any) => item.expression_id).filter(Boolean))];
  const mirrors = new Map<string, string>();
  if (expressionIds.length) {
    const {data, error} = await admin.from("expression_catalog").select("id,lexeme_id").in("id", expressionIds);
    if (error) throw new Error(`EXPRESSION_IDENTITIES_READ_FAILED:${error.message}`);
    for (const row of data ?? []) if (row.lexeme_id) mirrors.set(row.id, row.lexeme_id);
  }
  const displayLexemeId = (item: any): string | null =>
    item.lexeme_id ?? mirrors.get(item.expression_id) ?? null;
  const lexemeIds = [
    ...new Set(
      (items ?? []).map(displayLexemeId).filter(Boolean),
    ),
  ] as string[];
  const lexemeMap = new Map<string, any>();
  const translationMap = new Map<string, { uk: string; en: string }>();

  if (lexemeIds.length > 0) {
    const { data: lexemes, error: lexemeError } = await admin
      .from("lexemes")
      .select("id, lemma, pos, cefr_level, frequency_rank, frequency_ipm")
      .in("id", lexemeIds);
    if (lexemeError) {
      throw new Error(`LEXEMES_READ_FAILED:${lexemeError.message}`);
    }
    for (const lexeme of lexemes ?? []) lexemeMap.set(lexeme.id, lexeme);

    for (let offset = 0; offset < lexemeIds.length; offset += 150) {
      const { data: translations, error: translationError } = await admin.rpc(
        "get_canonical_lexeme_translations_v1",
        {p_lexeme_ids: lexemeIds.slice(offset, offset + 150)},
      );
      if (translationError) {
        throw new Error(`TRANSLATIONS_READ_FAILED:${translationError.message}`);
      }
      for (const translation of translations ?? []) {
      if (!translationMap.has(translation.lexeme_id)) {
        translationMap.set(translation.lexeme_id, { uk: "", en: "" });
      }
      const entry = translationMap.get(translation.lexeme_id)!;
      if (translation.language_code === "uk") {
        entry.uk = translation.translation;
      }
      if (translation.language_code === "en") {
        entry.en = translation.translation;
      }
      }
    }
  }

  return (items ?? []).map((item: any) => {
    const effectiveId = displayLexemeId(item);
    const lexeme = effectiveId ? lexemeMap.get(effectiveId) : null;
    const translation = effectiveId
      ? translationMap.get(effectiveId)
      : null;
    return {
      ...item,
      display_lexeme_id: effectiveId,
      cefr_level: lexeme?.cefr_level ?? null,
      frequency_rank: lexeme?.frequency_rank ?? null,
      frequency_ipm: lexeme?.frequency_ipm ?? null,
      translation_uk: translation?.uk || null,
      translation_en: translation?.en || null,
    };
  });
}

// D10 28.10.2026 (agreed): child jobs of a job (synonym candidates, see
// synonym_candidate_queue.source_job_id -> child_job_id), only those of the
// same owner; and how many candidates have no job yet. Read errors give an
// empty list (the status itself is not affected).
const WAITING_DISPATCH = new Set(["pending", "awaiting_parent"]);

async function loadChildJobs(admin: any, jobId: string, userId: string, parentCreatedAt: string): Promise<{
  child_jobs: Array<Record<string, unknown>>; synonym_candidates_without_job: number;
}> {
  try {
    const { data: queue, error } = await admin.from("synonym_candidate_queue")
      .select("child_job_id, dispatch_status").eq("source_job_id", jobId);
    if (error) throw error;
    const rows = (queue ?? []) as Array<{ child_job_id: string | null; dispatch_status: string | null }>;
    const ids = [...new Set(rows.map((r) => r.child_job_id).filter(Boolean))] as string[];
    // D10 30.10.2026 (agreed): only candidates still waiting for a job; final ones
    // (not_dispatchable = NAOB explanation, skipped_ready, enrichment_done, deferred_depth) are not counted.
    const withoutJob = rows.filter((r) => !r.child_job_id &&
      WAITING_DISPATCH.has(String(r.dispatch_status ?? "pending"))).length;
    if (!ids.length) return { child_jobs: [], synonym_candidates_without_job: withoutJob };
    const { data: jobs, error: jobsError } = await admin.from("lexeme_processing_jobs")
      .select("id, user_id, status, total_items, created_at").in("id", ids);
    if (jobsError) throw jobsError;
    const child_jobs = ((jobs ?? []) as Array<Record<string, any>>)
      .filter((j) => ownsJob(j.user_id, userId))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((j) => ({ id: j.id, kind: "synonyms", status: j.status, total_items: j.total_items, created_at: j.created_at,
        // A candidate retains the job that originally produced its card after a later audit.
        relationship: Date.parse(j.created_at) < Date.parse(parentCreatedAt) ? "reused_prior" : "child" }));
    return { child_jobs, synonym_candidates_without_job: withoutJob };
  } catch (error) {
    console.warn("get-job-status: child jobs read failed", error instanceof Error ? error.message : String(error));
    return { child_jobs: [], synonym_candidates_without_job: 0 };
  }
}

Deno.serve(
  withSupabase(
    { auth: "user" },
    async (request, context) => {
      try {
        const { jobId, includeChainProgress } = await readRequest(request);
        if (!UUID_PATTERN.test(jobId)) throw new Error("JOB_ID_REQUIRED");

        const userId = context.userClaims?.id?.trim() ?? "";
        if (!userId) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
        // Generated Database types do not cover these internal tables/RPCs.
        // The response shapes are checked explicitly in this handler.
        const admin: any = context.supabaseAdmin;

        const { data: jobData, error: jobError } = await admin
          .from("lexeme_processing_jobs")
          .select(`
            id, user_id, status, total_items, done_items,
            partial_items, failed_items, skipped_items,
            summary, created_at, updated_at
          `)
          .eq("id", jobId)
          .maybeSingle();
        if (jobError) throw new Error(`JOB_READ_FAILED:${jobError.message}`);

        const job = jobData as JobRow | null;
        // A 404 for both missing and foreign jobs prevents job-id enumeration.
        // Historical NULL-owned jobs are intentionally not exposed.
        if (!job || !ownsJob(job.user_id, userId)) {
          throw new Error("JOB_NOT_FOUND");
        }
        // D10 28.10.2026: child jobs, added to every answer below
        const children = await loadChildJobs(admin, jobId, userId, job.created_at);

        const { data: progressData, error: progressError } = await admin.rpc(
          "get_job_progress",
          {
            p_job_id: jobId,
          },
        );
        if (progressError) {
          throw new Error(`PROGRESS_READ_FAILED:${progressError.message}`);
        }
        const progress = (progressData ?? {}) as ProgressRow;
        const inferredExecutionState = inferExecutionState(job, progress);

        let chainProgress: unknown[] | undefined;
        if (includeChainProgress) {
          const { data, error } = await admin.rpc(
            "get_job_chain_progress",
            { p_job_id: jobId },
          );
          if (error) {
            throw new Error(`CHAIN_PROGRESS_READ_FAILED:${error.message}`);
          }
          chainProgress = Array.isArray(data) ? data : [];
        }

        // D10 plan A2: while pipeline-supervisor has not finished (see
        // supervisorStillRunning), report processing and do not run the
        // completion check yet. No supervisor row or a read error keeps the
        // previous behaviour.
        const supervisorStage = inferredExecutionState === "completed" &&
            String(job.status ?? "").toLowerCase() === "done"
          ? await loadSupervisorStage(admin, jobId)
          : null;
        if (supervisorStillRunning(job.status, inferredExecutionState, supervisorStage)) {
          return json({
            ...children,
            ok: true,
            status: "processing",
            ready: false,
            execution_state: "running",
            quality_state: null,
            learner_ready: false,
            supervisor_stage: supervisorStage,
            job: publicJob(job),
            summary: job.summary,
            progress,
            chain_progress: chainProgress,
          });
        }

        if (
          inferredExecutionState !== "completed" &&
          inferredExecutionState !== "needs_manual_review"
        ) {
          const status = inferredExecutionState === "failed"
            ? "needs_manual_review"
            : "processing";
          return json({
            ...children,
            ok: true,
            status,
            ready: false,
            execution_state: inferredExecutionState,
            quality_state: inferredExecutionState === "failed"
              ? "blocked"
              : null,
            learner_ready: false,
            job: publicJob(job),
            summary: job.summary,
            progress,
            chain_progress: chainProgress,
          });
        }

        let evaluation;
        try {
          evaluation = await evaluateAuditCompletion(
            async ({
              job_id,
              cursor,
              limit,
              expected_snapshot_token,
            }) => {
              const { data, error } = await admin.rpc(
                "get_completion_evidence_snapshot_v2",
                {
                  p_job_id: job_id,
                  p_cursor: cursor,
                  p_limit: limit,
                  p_expected_snapshot_token: expected_snapshot_token,
                },
              );
              if (error) {
                throw new Error(`SNAPSHOT_RPC_FAILED:${error.message}`);
              }
              return data as SnapshotRpcResult;
            },
            jobId,
          );
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : String(error);
          if (message.includes("TERMINAL_JOB_REQUIRED")) {
            return json({
              ...children,
              ok: true,
              status: "processing",
              ready: false,
              execution_state: "running",
              quality_state: null,
              learner_ready: false,
              job: publicJob(job),
              summary: job.summary,
              progress,
              chain_progress: chainProgress,
            });
          }
          throw error;
        }

        const {completion, content} = evaluation;
        const unresolvedIds = completion.unresolved_items.map((item) =>
          (item as { item_id: string }).item_id);
        let candidateReviews: ReviewItem[] = [];
        if (unresolvedIds.length > 0) {
          const { data, error } = await admin.from("lexeme_processing_items")
            .select("id,normalized_lemma,pos,current_stage,status,lexeme_id,expression_id,result_summary")
            .eq("job_id", jobId).in("id", unresolvedIds);
          if (error) throw new Error(`REPORT_REVIEW_READ_FAILED:${error.message}`);
          candidateReviews = data ?? [];
        }
        const auditReport = buildAuditReport(completion, candidateReviews, content);

        // D10 25.10.2026 (agreed, point 4): words "for review" (they did not
        // become learning cards, the job is not stopped by them): admission
        // gate items with a review reason + lexemes with the translation mark.
        const reviewItems: Array<Record<string, unknown>> =
          ((completion.review_items ?? []) as Array<Record<string, unknown>>).map((item) => ({
            kind: "gate", item_id: item.item_id ?? null,
            word: item.normalized_lemma ?? item.normalized_input ?? item.raw_input ?? null,
            pos: item.pos ?? null, code: item.admission_reason ?? null,
          }));
        // D10 28.10.2026 (agreed): the supervisor also lists gate items that
        // HAVE an expression_id (an expression without a card, e.g. "dra
        // omsorg for"); the completion snapshot does not return them, so they
        // are taken from the job summary (no duplicates by item id).
        const summaryReview = Array.isArray((job.summary as any)?.review_items)
          ? ((job.summary as any).review_items as Array<Record<string, unknown>>) : [];
        const listedItemIds = new Set(reviewItems.map((item) => String(item.item_id ?? "")));
        for (const item of summaryReview) {
          if (item?.kind !== "gate") continue;
          const itemId = String(item.item_id ?? "");
          if (itemId && listedItemIds.has(itemId)) continue;
          if (itemId) listedItemIds.add(itemId);
          reviewItems.push({ kind: "gate", item_id: item.item_id ?? null, word: item.word ?? null,
            pos: item.pos ?? null, code: item.code ?? null });
        }
        const markedIds = (completion.review_marked_entities ?? [])
          .filter((key) => key.startsWith("lexeme:")).map((key) => key.slice("lexeme:".length));
        if (markedIds.length > 0) {
          const { data: marked, error: markedError } = await admin.from("lexemes")
            .select("id,lemma,pos").in("id", markedIds);
          if (markedError) throw new Error(`REVIEW_LEXEMES_READ_FAILED:${markedError.message}`);
          for (const l of (marked ?? []) as Array<Record<string, unknown>>) {
            reviewItems.push({ kind: "translation", lexeme_id: l.id, word: l.lemma ?? null,
              pos: l.pos ?? null, code: "TRANSLATION_REVIEW" });
          }
        }

        const report = {
          ...completion.report,
          assessments: undefined,
        };
        const response: Record<string, unknown> = {
          ...children,
          ok: true,
          status: completion.learner_ready
            ? "completed"
            : "needs_manual_review",
          ready: completion.learner_ready,
          execution_state: completion.execution_state,
          quality_state: completion.quality_state,
          learner_ready: completion.learner_ready,
          job: publicJob(job),
          summary: job.summary,
          progress,
          chain_progress: chainProgress,
          completion_report: auditReport,
          review_items: reviewItems,
          quality: {
            snapshot_token: completion.report.snapshot_token,
            source_counts: completion.source_counts,
            unresolved_items: completion.unresolved_items,
            unresolved_items_block_completion:
              completion.unresolved_items_block_completion,
            report,
          },
        };

        if (completion.learner_ready) {
          response.items = await loadLearnerItems(admin, jobId);
        }
        return json(response);
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "UNKNOWN_ERROR";
        console.error("get-job-status", { message });
        return json({ ok: false, error: message }, errorStatus(message));
      }
    },
  ),
);
