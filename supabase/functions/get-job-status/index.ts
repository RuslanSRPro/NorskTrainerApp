import { withSupabase } from "@supabase/server";

import {
  evaluateJobCompletion,
  type SnapshotRpcResult,
} from "../_shared/completion-contract/v1/runtime.ts";
import type {
  ExecutionState,
} from "../_shared/completion-contract/v1/contract.ts";
import { ownsJob } from "../_shared/job-status-policy.ts";

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

  const lexemeIds = [
    ...new Set(
      (items ?? []).map((item: any) => item.lexeme_id).filter(Boolean),
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

    const { data: translations, error: translationError } = await admin
      .from("entity_translations")
      .select("lexeme_id, language_code, translation")
      .in("lexeme_id", lexemeIds)
      .eq("source", "lexin")
      .eq("translation_type", "primary")
      .eq("sense_rank", 1)
      .eq("translation_rank", 1);
    if (translationError) {
      throw new Error(
        `TRANSLATIONS_READ_FAILED:${translationError.message}`,
      );
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

  return (items ?? []).map((item: any) => {
    const lexeme = item.lexeme_id ? lexemeMap.get(item.lexeme_id) : null;
    const translation = item.lexeme_id
      ? translationMap.get(item.lexeme_id)
      : null;
    return {
      ...item,
      cefr_level: lexeme?.cefr_level ?? null,
      frequency_rank: lexeme?.frequency_rank ?? null,
      frequency_ipm: lexeme?.frequency_ipm ?? null,
      translation_uk: translation?.uk || null,
      translation_en: translation?.en || null,
    };
  });
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

        if (
          inferredExecutionState !== "completed" &&
          inferredExecutionState !== "needs_manual_review"
        ) {
          const status = inferredExecutionState === "failed"
            ? "needs_manual_review"
            : "processing";
          return json({
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

        let completion;
        try {
          completion = await evaluateJobCompletion(
            async ({
              job_id,
              cursor,
              limit,
              expected_snapshot_token,
            }) => {
              const { data, error } = await admin.rpc(
                "get_completion_evidence_snapshot_v1",
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

        const report = {
          ...completion.report,
          assessments: undefined,
        };
        const response: Record<string, unknown> = {
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
