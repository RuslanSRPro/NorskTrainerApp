import { withSupabase } from "@supabase/server";
import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";

import { aggregateAssessmentPages } from "../_shared/completion-contract/v1/aggregate.ts";
import type {
  AssessmentPage,
  EntityEvidenceSnapshot,
} from "../_shared/completion-contract/v1/contract.ts";
import { evaluateCompletion } from "../_shared/completion-contract/v1/evaluator.ts";
import assessmentSchema from "../_shared/completion-contract/v1/assessment.schema.json" with {
  type: "json",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type SchemaValidator = ((data: unknown) => boolean) & { errors?: unknown };
interface AjvInstance {
  compile(schema: unknown): SchemaValidator;
}
type AjvConstructor = new (options: Record<string, unknown>) => AjvInstance;
type AddFormats = (instance: AjvInstance) => void;
const Ajv2020 = (
  (Ajv2020Module as unknown as { default?: unknown }).default ?? Ajv2020Module
) as unknown as AjvConstructor;
const addFormats = (
  (addFormatsModule as unknown as { default?: unknown }).default ??
    addFormatsModule
) as unknown as AddFormats;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateAssessment = ajv.compile(assessmentSchema);

interface ShadowRequest {
  job_id?: unknown;
  page_limit?: unknown;
  max_pages?: unknown;
  include_assessments?: unknown;
}

interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_completion_evidence_snapshot_v1: {
        Args: {
          p_job_id: string;
          p_cursor: string | null;
          p_limit: number;
          p_expected_snapshot_token: string | null;
        };
        Returns: SnapshotRpcResult;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

interface SnapshotRpcResult {
  snapshot_version: string;
  snapshot_token: string;
  captured_at: string;
  execution_state: string;
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

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function integerInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`INTEGER_RANGE:${min}:${max}`);
  }
  return Number(value);
}

function errorStatus(message: string): number {
  if (message.includes("SNAPSHOT_CHANGED")) return 409;
  if (
    message.includes("JOB_ID_REQUIRED") ||
    message.includes("JOB_NOT_FOUND") ||
    message.includes("TERMINAL_JOB_REQUIRED") ||
    message.includes("INTEGER_RANGE") ||
    message.includes("INVALID_JSON")
  ) return 400;
  return 500;
}

Deno.serve(
  withSupabase<Database>(
    { auth: "secret:completion-shadow", cors: "disabled" },
    async (request, context) => {
      if (request.method !== "POST") {
        return json({ error: "METHOD_NOT_ALLOWED" }, 405);
      }

      try {
        let input: ShadowRequest;
        try {
          input = await request.json() as ShadowRequest;
        } catch {
          throw new Error("INVALID_JSON");
        }

        const jobId = typeof input.job_id === "string"
          ? input.job_id.trim()
          : "";
        if (!UUID_PATTERN.test(jobId)) throw new Error("JOB_ID_REQUIRED");
        const pageLimit = integerInRange(input.page_limit, 20, 1, 50);
        const maxPages = integerInRange(input.max_pages, 100, 1, 1000);
        const includeAssessments = input.include_assessments === true;

        const pages: AssessmentPage[] = [];
        let expectedSnapshotToken: string | null = null;
        let cursor: string | null = null;
        let sourceCounts: SnapshotRpcResult["counts"] | null = null;
        let unresolvedItems: unknown[] = [];

        for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
          const { data, error } = await context.supabaseAdmin.rpc(
            "get_completion_evidence_snapshot_v1",
            {
              p_job_id: jobId,
              p_cursor: cursor,
              p_limit: pageLimit,
              p_expected_snapshot_token: expectedSnapshotToken,
            },
          );
          if (error) throw new Error(`SNAPSHOT_RPC_FAILED:${error.message}`);

          const snapshot = data as SnapshotRpcResult;
          if (
            !snapshot || !snapshot.page ||
            !Array.isArray(snapshot.page.entities)
          ) {
            throw new Error("INVALID_SNAPSHOT_RESPONSE");
          }
          if (
            expectedSnapshotToken &&
            snapshot.snapshot_token !== expectedSnapshotToken
          ) {
            throw new Error("SNAPSHOT_CHANGED");
          }
          expectedSnapshotToken = snapshot.snapshot_token;
          sourceCounts ??= snapshot.counts;
          unresolvedItems = snapshot.unresolved_items ?? [];

          const assessments = snapshot.page.entities.map((entity) => {
            const assessment = evaluateCompletion(entity);
            if (!validateAssessment(assessment)) {
              throw new Error(
                `ASSESSMENT_SCHEMA_FAILED:${
                  JSON.stringify(validateAssessment.errors)
                }`,
              );
            }
            return assessment;
          });
          pages.push({
            snapshot_token: snapshot.snapshot_token,
            cursor: snapshot.page.cursor,
            next_cursor: snapshot.page.next_cursor,
            has_more: snapshot.page.has_more,
            assessments,
          });

          if (!snapshot.page.has_more) break;
          if (
            !snapshot.page.next_cursor || snapshot.page.next_cursor === cursor
          ) {
            throw new Error("INVALID_PAGE_CURSOR");
          }
          cursor = snapshot.page.next_cursor;
        }

        if (pages.at(-1)?.has_more) throw new Error("MAX_PAGES_EXCEEDED");
        const aggregate = aggregateAssessmentPages(pages);
        const report = includeAssessments
          ? aggregate
          : { ...aggregate, assessments: undefined };

        return json({
          shadow_mode: true,
          writes_performed: 0,
          job_id: jobId,
          snapshot_token: aggregate.snapshot_token,
          source_counts: sourceCounts,
          unresolved_items: unresolvedItems,
          unresolved_items_block_completion: unresolvedItems.length > 0,
          report,
        });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "UNKNOWN_ERROR";
        console.error("completion-contract-shadow", { message });
        return json({ error: message }, errorStatus(message));
      }
    },
  ),
);
