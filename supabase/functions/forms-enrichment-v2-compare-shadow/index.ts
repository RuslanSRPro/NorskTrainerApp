import { withSupabase } from "@supabase/server";
import { classifyWorkerOutcome } from "./contract.ts";

const FUNCTION_NAME = "forms-enrichment-v2-compare-shadow";
const WORKER_NAME = "forms-enrichment-v2-worker";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL_JOB_STATUSES = new Set(["completed", "needs_manual_review"]);
const ELIGIBLE_POS = new Set(["verb", "noun", "adjective", "determiner"]);
const MAX_LEXEMES = 25;
const WORKER_TIMEOUT_MS = 55_000;

type CompareRequest = {
  jobId: string;
  offset: number;
  limit: number;
};

Deno.serve(withSupabase(
  { auth: "secret:completionshadow", cors: "disabled" },
  async (request, context) => {
    if (request.method !== "POST") {
      return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    }

    try {
      const input = await readBody(request);
      const admin = context.supabaseAdmin;
      const { data: job, error: jobError } = await admin
        .from("lexeme_processing_jobs")
        .select("id, status")
        .eq("id", input.jobId)
        .maybeSingle();
      if (jobError) throw new Error(`JOB_READ_FAILED:${jobError.message}`);
      if (!job) return json({ ok: false, error: "JOB_NOT_FOUND" }, 404);
      if (!TERMINAL_JOB_STATUSES.has(String(job.status))) {
        return json({
          ok: false,
          error: "TERMINAL_JOB_REQUIRED",
          jobId: input.jobId,
          jobStatus: job.status,
        }, 409);
      }

      const { data: items, error: itemError, count } = await admin
        .from("lexeme_processing_items")
        .select("id, lexeme_id", { count: "exact" })
        .eq("job_id", input.jobId)
        .eq("current_stage", "semantic_audit")
        .eq("match_type", "token")
        .not("lexeme_id", "is", null)
        .order("id", { ascending: true })
        .range(input.offset, input.offset + input.limit - 1);
      if (itemError) {
        throw new Error(`JOB_ITEMS_READ_FAILED:${itemError.message}`);
      }

      const candidateIds: string[] = [
        ...new Set<string>(
          (items ?? []).map((item: { lexeme_id: string | null }) =>
            item.lexeme_id
          ).filter((id: string | null): id is string => Boolean(id)),
        ),
      ];
      let eligibleIds: string[] = [];
      if (candidateIds.length > 0) {
        const { data: lexemes, error: lexemeError } = await admin
          .from("lexemes")
          .select("id, pos")
          .in("id", candidateIds);
        if (lexemeError) {
          throw new Error(`LEXEME_READ_FAILED:${lexemeError.message}`);
        }
        const allowed = new Set<string>(
          (lexemes ?? [])
            .filter((row: { pos: string }) => ELIGIBLE_POS.has(row.pos))
            .map((row: { id: string }) => row.id),
        );
        eligibleIds = candidateIds.filter((id) => allowed.has(id));
      }
      const hasMore = Number(count ?? 0) > input.offset + input.limit;

      if (eligibleIds.length === 0) {
        return json({
          ok: true,
          function: FUNCTION_NAME,
          mode: "comparison_shadow",
          jobId: input.jobId,
          jobStatus: job.status,
          persisted: false,
          offset: input.offset,
          selectedItems: (items ?? []).length,
          eligibleLexemes: 0,
          totalItems: count ?? 0,
          hasMore,
          nextOffset: hasMore ? input.offset + input.limit : null,
          result: { ok: true, processed: 0, failed: 0, results: [] },
        });
      }

      const workerResult = await callComparisonWorker(eligibleIds);
      return json({
        ok: workerResult.requestOk,
        comparisonOk: workerResult.comparisonOk,
        function: FUNCTION_NAME,
        mode: "comparison_shadow",
        jobId: input.jobId,
        jobStatus: job.status,
        persisted: false,
        offset: input.offset,
        selectedItems: (items ?? []).length,
        eligibleLexemes: eligibleIds.length,
        totalItems: count ?? 0,
        hasMore,
        nextOffset: hasMore ? input.offset + input.limit : null,
        workerStatus: workerResult.status,
        result: workerResult.data,
      }, workerResult.requestOk ? 200 : 502);
    } catch (error) {
      return json({
        ok: false,
        function: FUNCTION_NAME,
        mode: "comparison_shadow",
        persisted: false,
        error: compactError(error),
      }, 400);
    }
  },
));

async function callComparisonWorker(lexemeIds: string[]) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/${WORKER_NAME}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ lexemeIds, persist: false }),
        signal: controller.signal,
      },
    );
    const text = await response.text();
    let data: unknown;
    let validJson = true;
    try {
      data = JSON.parse(text);
    } catch {
      validJson = false;
      data = {
        ok: false,
        error: "INVALID_WORKER_RESPONSE",
        body: text.slice(0, 500),
      };
    }
    return {
      ...classifyWorkerOutcome(response.ok, validJson, data),
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      requestOk: false,
      comparisonOk: false,
      status: 0,
      data: { error: `WORKER_CALL_FAILED:${compactError(error)}` },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readBody(request: Request): Promise<CompareRequest> {
  const payload: unknown = await request.json();
  if (!isRecord(payload)) throw new Error("JSON_OBJECT_REQUIRED");
  const jobId = typeof payload.jobId === "string" ? payload.jobId.trim() : "";
  if (!UUID_PATTERN.test(jobId)) throw new Error("JOB_ID_REQUIRED");
  const offset = integerInRange(payload.offset, 0, 0, 1_000_000);
  const limit = integerInRange(payload.limit, MAX_LEXEMES, 1, MAX_LEXEMES);
  return { jobId, offset, limit };
}

function integerInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`INTEGER_RANGE:${min}:${max}`);
  }
  return Number(value);
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
}

function compactError(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
