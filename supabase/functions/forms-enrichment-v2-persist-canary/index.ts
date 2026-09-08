import { withSupabase } from "@supabase/server";
import {
  classifyPersistWorkerOutcome,
  isPersistCanaryLexemeAllowed,
  isPersistCanaryRuntimeIsolated,
  parsePersistCanaryRequest,
} from "./contract.ts";

const FUNCTION_NAME = "forms-enrichment-v2-persist-canary";
const WORKER_NAME = "forms-enrichment-v2-worker";
const WORKER_TIMEOUT_MS = 55_000;
const ALLOWED_POS = new Set(["verb", "noun", "adjective", "determiner"]);

Deno.serve(withSupabase(
  { auth: "secret:completionshadow", cors: "disabled" },
  async (request, context) => {
    if (request.method !== "POST") {
      return json(
        { ok: false, persisted: false, error: "METHOD_NOT_ALLOWED" },
        405,
      );
    }

    try {
      const canaryEnabled = Deno.env.get("D10_FORMS_V2_PERSIST_CANARY_ENABLED");
      const persistenceEnabled = Deno.env.get("D10_FORMS_V2_PERSIST_ENABLED");
      const pipelineShadowEnabled = Deno.env.get("D10_FORMS_V2_SHADOW_ENABLED");
      if (canaryEnabled !== "true") {
        return json({
          ok: false,
          persisted: false,
          error: "D10_PERSIST_CANARY_DISABLED",
        }, 403);
      }
      if (persistenceEnabled !== "true") {
        return json({
          ok: false,
          persisted: false,
          error: "D10_PERSISTENCE_DISABLED",
        }, 403);
      }
      if (
        !isPersistCanaryRuntimeIsolated(
          canaryEnabled,
          persistenceEnabled,
          pipelineShadowEnabled,
        )
      ) {
        return json({
          ok: false,
          persisted: false,
          error: "PIPELINE_SHADOW_MUST_BE_DISABLED",
        }, 409);
      }

      const input = parsePersistCanaryRequest(await request.json());
      if (
        !isPersistCanaryLexemeAllowed(
          input.lexemeId,
          Deno.env.get("D10_FORMS_V2_PERSIST_CANARY_LEXEME_IDS"),
        )
      ) {
        return json({
          ok: false,
          persisted: false,
          error: "LEXEME_NOT_IN_PERSIST_CANARY_ALLOWLIST",
        }, 403);
      }

      const { data: lexemeData, error: lexemeError } = await context
        .supabaseAdmin
        .from("lexemes")
        .select("id, lemma, display_form, pos")
        .eq("id", input.lexemeId)
        .maybeSingle();
      if (lexemeError) {
        throw new Error(`LEXEME_READ_FAILED:${lexemeError.message}`);
      }
      const lexeme = lexemeData as unknown as {
        id: string;
        lemma: string;
        display_form: string | null;
        pos: string;
      } | null;
      if (!lexeme) {
        return json(
          { ok: false, persisted: false, error: "LEXEME_NOT_FOUND" },
          404,
        );
      }
      if (!ALLOWED_POS.has(String(lexeme.pos))) {
        return json({
          ok: false,
          persisted: false,
          error: "LEXEME_POS_NOT_SUPPORTED",
          lexemeId: input.lexemeId,
          pos: lexeme.pos,
        }, 409);
      }

      const worker = await callWorker(input.lexemeId);
      const outcome = classifyPersistWorkerOutcome(
        worker.httpOk,
        worker.validJson,
        worker.body,
        input.lexemeId,
      );
      if (!outcome.persistenceConfirmed) {
        return json({
          ok: false,
          function: FUNCTION_NAME,
          persisted: false,
          persistenceState: "unconfirmed",
          requiresDatabaseVerification: true,
          lexeme,
          workerStatus: worker.status,
          worker: worker.body,
        }, outcome.requestOk ? 409 : 502);
      }

      return json({
        ok: true,
        function: FUNCTION_NAME,
        persisted: true,
        persistenceState: "confirmed",
        lexeme,
        workerStatus: worker.status,
        worker: worker.body,
      });
    } catch (error) {
      return json({
        ok: false,
        function: FUNCTION_NAME,
        persisted: false,
        error: compactError(error),
      }, 400);
    }
  },
));

async function callWorker(lexemeId: string) {
  const supabaseUrl = requiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${WORKER_NAME}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ lexemeIds: [lexemeId], persist: true }),
      signal: controller.signal,
    });
    const text = await response.text();
    try {
      return {
        httpOk: response.ok,
        validJson: true,
        status: response.status,
        body: JSON.parse(text) as unknown,
      };
    } catch {
      return {
        httpOk: response.ok,
        validJson: false,
        status: response.status,
        body: { error: "INVALID_WORKER_RESPONSE", body: text.slice(0, 500) },
      };
    }
  } catch (error) {
    return {
      httpOk: false,
      validJson: true,
      status: 0,
      body: { error: `WORKER_CALL_FAILED:${compactError(error)}` },
    };
  } finally {
    clearTimeout(timer);
  }
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
}

function compactError(error: unknown): string {
  const value = error instanceof Error ? error.message : String(error);
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
