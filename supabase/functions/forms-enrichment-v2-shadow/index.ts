import { withSupabase } from "@supabase/server";
import {
  buildAuthoritativeDisplayGroups,
  type DictionaryCode,
  type MorphologyPos,
  OrdbokeneClient,
  resolveAuthoritativeMorphology,
} from "../_shared/authoritative-morphology-v2/mod.ts";

const FUNCTION_NAME = "forms-enrichment-v2-shadow";
const ALLOWED_POS = new Set<MorphologyPos>([
  "verb",
  "noun",
  "adjective",
  "determiner",
]);

Deno.serve(withSupabase(
  { auth: "secret:completionshadow", cors: "disabled" },
  async (request: Request) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    try {
      const body = await readBody(request);
      const result = await resolveAuthoritativeMorphology({
        request: body,
        client: new OrdbokeneClient(),
      });
      const displayGroups = buildAuthoritativeDisplayGroups(result.paradigms);

      return json({
        ok: result.status === "resolved" || result.status === "partial",
        function: FUNCTION_NAME,
        mode: "shadow",
        sourceOnly: true,
        persisted: false,
        result,
        displayGroups,
      }, result.status === "source_error" ? 502 : 200);
    } catch (error) {
      return json({
        ok: false,
        function: FUNCTION_NAME,
        mode: "shadow",
        sourceOnly: true,
        persisted: false,
        error: error instanceof Error ? error.message : String(error),
      }, 400);
    }
  },
));

async function readBody(request: Request): Promise<{
  query: string;
  pos?: MorphologyPos;
  dictionaries?: DictionaryCode[];
}> {
  const payload: unknown = await request.json();
  if (!isRecord(payload)) throw new Error("JSON object body is required");

  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) throw new Error("query is required");

  let pos: MorphologyPos | undefined;
  if (payload.pos !== undefined) {
    if (
      typeof payload.pos !== "string" ||
      !ALLOWED_POS.has(payload.pos as MorphologyPos)
    ) {
      throw new Error("pos must be verb, noun, adjective, or determiner");
    }
    pos = payload.pos as MorphologyPos;
  }

  let dictionaries: DictionaryCode[] | undefined;
  if (payload.dictionaries !== undefined) {
    if (!Array.isArray(payload.dictionaries)) {
      throw new Error("dictionaries must be an array");
    }
    dictionaries = [...new Set(payload.dictionaries)].map(String).filter(
      (dictionary): dictionary is DictionaryCode =>
        dictionary === "bm" || dictionary === "nn",
    );
    if (
      dictionaries.length !== payload.dictionaries.length ||
      dictionaries.length === 0
    ) {
      throw new Error("dictionaries may contain only unique bm and nn values");
    }
  }

  return { query, pos, dictionaries };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function corsHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type, apikey",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
