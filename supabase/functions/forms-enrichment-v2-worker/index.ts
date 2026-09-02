import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import {
  buildAuthoritativeDisplayGroups,
  type FormDisplayGroup,
  type MorphologyPos,
  normalizeNorwegian,
  OrdbokeneClient,
  resolveAuthoritativeMorphology,
} from "../_shared/authoritative-morphology-v2/mod.ts";

const FUNCTION_NAME = "forms-enrichment-v2-worker";
const MAX_LEXEMES = 25;
const CONCURRENCY = 5;
const ALLOWED_POS = new Set<MorphologyPos>([
  "verb",
  "noun",
  "adjective",
  "determiner",
]);

type LexemeRow = {
  id: string;
  lemma: string;
  display_form: string | null;
  pos: MorphologyPos;
};

type LegacyRow = {
  lexeme_id: string;
  form_key: string | null;
  form_type: string;
  value: string;
};

type RequestBody = {
  lexemeIds?: string[];
  lookupWord?: string;
  lookupPos?: MorphologyPos;
  persist?: boolean;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }
  if (!/^Bearer\s+\S+$/i.test(request.headers.get("authorization") ?? "")) {
    return json({ ok: false, error: "Missing bearer JWT" }, 401);
  }

  try {
    const body = await readBody(request);
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (body.lookupWord) {
      const result = await resolveOne({
        id: "manual-lookup",
        lemma: body.lookupWord,
        display_form: body.lookupWord,
        pos: body.lookupPos!,
      }, []);
      return json({
        ok: result.status === "resolved",
        worker: FUNCTION_NAME,
        mode: "manual",
        persisted: false,
        result,
      }, result.status === "source_error" ? 502 : 200);
    }

    const lexemeIds = body.lexemeIds!;
    const { data: lexemeData, error: lexemeError } = await supabase
      .from("lexemes")
      .select("id, lemma, display_form, pos")
      .in("id", lexemeIds)
      .in("pos", [...ALLOWED_POS]);
    if (lexemeError) {
      throw new Error(`LEXEME_LOAD_FAILED:${lexemeError.message}`);
    }

    const lexemes = (lexemeData ?? []) as LexemeRow[];
    const { data: legacyData, error: legacyError } = await supabase
      .from("lexeme_form_variants")
      .select("lexeme_id, form_key, form_type, value")
      .in("lexeme_id", lexemes.map((lexeme) => lexeme.id));
    if (legacyError) {
      throw new Error(`LEGACY_COMPARE_LOAD_FAILED:${legacyError.message}`);
    }

    const legacyRows = (legacyData ?? []) as LegacyRow[];
    const results = await mapWithConcurrency(
      lexemes,
      CONCURRENCY,
      async (lexeme) => {
        const result = await resolveOne(
          lexeme,
          legacyRows.filter((row) => row.lexeme_id === lexeme.id),
        );
        if (body.persist && result.status === "resolved") {
          const { error } = await supabase.rpc(
            "publish_authoritative_morphology_snapshot_v2",
            {
              p_lexeme_id: lexeme.id,
              p_resolution: result.resolution,
              p_display_groups: result.displayGroups,
              p_comparison: result.comparison,
            },
          );
          if (error) {
            return {
              ...compactResult(result),
              status: "persistence_error",
              persisted: false,
              error: compactError(error.message),
            };
          }
          return { ...compactResult(result), persisted: true };
        }
        return { ...compactResult(result), persisted: false };
      },
    );

    const missingIds = lexemeIds.filter(
      (id) => !lexemes.some((lexeme) => lexeme.id === id),
    );
    const failed = results.filter((result) =>
      result.status !== "resolved"
    ).length +
      missingIds.length;

    return json({
      ok: failed === 0,
      worker: FUNCTION_NAME,
      mode: body.persist ? "persist" : "shadow",
      dictionaries: ["bm"],
      processed: results.length,
      failed,
      missingLexemeIds: missingIds,
      results,
    }, 200);
  } catch (error) {
    return json({
      ok: false,
      worker: FUNCTION_NAME,
      error: compactError(
        error instanceof Error ? error.message : String(error),
      ),
    }, 400);
  }
});

async function resolveOne(lexeme: LexemeRow, legacyRows: LegacyRow[]) {
  const query = cleanLookupWord(lexeme.display_form || lexeme.lemma);
  const resolution = await resolveAuthoritativeMorphology({
    request: { query, pos: lexeme.pos, dictionaries: ["bm"] },
    client: new OrdbokeneClient(),
  });
  const displayGroups = buildAuthoritativeDisplayGroups(resolution.paradigms);
  const relevantArticles = new Set(
    resolution.paradigms
      .filter((paradigm) =>
        paradigm.dictionaryCode === "bm" && paradigm.pos === lexeme.pos
      )
      .map((paradigm) => paradigm.articleId),
  );

  let status = resolution.status as string;
  if (resolution.status === "resolved" && relevantArticles.size !== 1) {
    status = relevantArticles.size > 1
      ? "ambiguous_source_articles"
      : "not_found";
  }
  if (
    resolution.lookup.requestedDictionaries.some((dictionary) =>
      dictionary !== "bm"
    )
  ) {
    status = "dictionary_scope_error";
  }
  if (
    resolution.paradigms.some((paradigm) =>
      normalizeNorwegian(paradigm.lemma) !== resolution.lookup.normalizedQuery
    )
  ) {
    status = "source_lemma_mismatch";
  }

  const comparison = compareForms(displayGroups, legacyRows);
  return {
    lexemeId: lexeme.id,
    lemma: lexeme.lemma,
    pos: lexeme.pos,
    status,
    articleIds: [...relevantArticles],
    displayGroups,
    comparison,
    resolution,
  };
}

function compareForms(groups: FormDisplayGroup[], legacyRows: LegacyRow[]) {
  const v2 = new Set(
    groups.flatMap((group) => [...group.primary, ...group.alternatives])
      .map((form) => `${form.formKey}|${form.normalizedValue}`),
  );
  const legacy = new Set(
    legacyRows
      .filter((row) => (row.form_key || row.form_type) && row.value)
      .map((row) =>
        `${normalizeLegacyKey(row.form_key || row.form_type)}|${
          normalizeNorwegian(row.value)
        }`
      ),
  );
  return {
    matches: setEquals(v2, legacy),
    v2Count: v2.size,
    legacyCount: legacy.size,
    onlyV2: [...v2].filter((value) => !legacy.has(value)).sort().slice(0, 20),
    onlyLegacy: [...legacy].filter((value) => !v2.has(value)).sort().slice(
      0,
      20,
    ),
  };
}

function compactResult(result: Awaited<ReturnType<typeof resolveOne>>) {
  return {
    lexemeId: result.lexemeId,
    lemma: result.lemma,
    pos: result.pos,
    status: result.status,
    articleIds: result.articleIds,
    primaryCount: result.displayGroups.reduce(
      (sum, group) => sum + group.primary.length,
      0,
    ),
    alternativeCount: result.displayGroups.reduce(
      (sum, group) => sum + group.alternatives.length,
      0,
    ),
    comparison: result.comparison,
  };
}

async function readBody(
  request: Request,
): Promise<Required<Pick<RequestBody, "persist">> & RequestBody> {
  const payload: unknown = await request.json();
  if (!isRecord(payload)) throw new Error("JSON_OBJECT_REQUIRED");
  const persist = payload.persist === true;
  const lookupWord = typeof payload.lookupWord === "string"
    ? payload.lookupWord.trim()
    : undefined;
  const lookupPos = parsePos(payload.lookupPos);
  if (lookupWord) {
    if (!lookupPos) throw new Error("LOOKUP_POS_REQUIRED");
    if (persist) throw new Error("MANUAL_LOOKUP_CANNOT_PERSIST");
    return { lookupWord, lookupPos, persist };
  }

  if (!Array.isArray(payload.lexemeIds)) throw new Error("LEXEME_IDS_REQUIRED");
  const lexemeIds = [...new Set(payload.lexemeIds.map(String).filter(Boolean))];
  if (lexemeIds.length === 0 || lexemeIds.length > MAX_LEXEMES) {
    throw new Error(`LEXEME_IDS_MUST_CONTAIN_1_TO_${MAX_LEXEMES}`);
  }
  return { lexemeIds, persist };
}

function parsePos(value: unknown): MorphologyPos | undefined {
  return typeof value === "string" && ALLOWED_POS.has(value as MorphologyPos)
    ? value as MorphologyPos
    : undefined;
}

function normalizeLegacyKey(value: string): string {
  const aliases: Record<string, string> = {
    infinitiv: "infinitive",
    presens: "present",
    preteritum: "preterite",
    past: "preterite",
    perfektum: "past_participle",
    present_perfect: "past_participle",
  };
  return aliases[value] ?? value;
}

function cleanLookupWord(value: string): string {
  return value.trim().replace(/^å\s+/i, "").replace(/^(en|ei|et)\s+/i, "");
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
}

function setEquals<T>(left: Set<T>, right: Set<T>): boolean {
  return left.size === right.size &&
    [...left].every((value) => right.has(value));
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        results[index] = await mapper(values[index]);
      }
    }),
  );
  return results;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactError(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
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
