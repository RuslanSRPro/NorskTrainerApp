import { createClient } from "@supabase/supabase-js";
import {
  applyAuthoritativeArticleBindings,
  type AuthoritativeArticleBinding,
  buildAuthoritativeDisplayGroups,
  compareAuthoritativeAndLegacyForms,
  hasInternalSecretApiKey,
  hasInternalServiceAuthorization,
  lexemeDictionaryLookupQuery,
  type MorphologyPos,
  normalizeNorwegian,
  OrdbokeneClient,
  resolveArticleProjection,
  resolveAuthoritativeMorphology,
} from "../_shared/authoritative-morphology-v2/mod.ts";
import {
  comparePersistedProjection,
  type PersistedFormDisplayRow,
} from "../_shared/authoritative-morphology-v2/persisted-parity.ts";

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

type ArticleBindingRow = {
  lexeme_id: string;
  dictionary_code: "bm";
  article_id: number | string;
  normalized_lemma: string;
  pos: MorphologyPos;
  evidence_ids: string[];
  provider_version: string;
};

type RequestBody = {
  lexemeIds?: string[];
  lookupWord?: string;
  lookupPos?: MorphologyPos;
  persist?: boolean;
  verifyPersisted?: boolean;
  backfill?: boolean;
  offset?: number;
  limit?: number;
};

if (import.meta.main) {
  Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceRoleKey) {
      return json(
        { ok: false, error: "MISSING_SUPABASE_SERVICE_ROLE_KEY" },
        500,
      );
    }
    if (
      !hasInternalSecretApiKey(
        request.headers.get("apikey"),
        Deno.env.get("SUPABASE_SECRET_KEYS"),
      ) &&
      !hasInternalServiceAuthorization(
        request.headers.get("authorization"),
        serviceRoleKey,
      )
    ) {
      return json({ ok: false, error: "INTERNAL_SERVICE_AUTH_REQUIRED" }, 403);
    }

    try {
      const body = await readBody(request);
      const supabaseUrl = requiredEnv("SUPABASE_URL");
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      if (body.lookupWord) {
        const result = await resolveOne(
          {
            id: "manual-lookup",
            lemma: body.lookupWord,
            display_form: body.lookupWord,
            pos: body.lookupPos!,
          },
          [],
          cleanLookupWord(body.lookupWord),
        );
        return json({
          ok: isShadowResolvedStatus(result.status),
          worker: FUNCTION_NAME,
          mode: "manual",
          persisted: false,
          result,
        }, result.status === "source_error" ? 502 : 200);
      }

      let lexemeIds = body.lexemeIds ?? [];
      let total: number | null = null;
      let lexemeQuery = supabase
        .from("lexemes")
        .select("id, lemma, display_form, pos", { count: "exact" })
        .in("pos", [...ALLOWED_POS]);
      if (body.backfill) {
        lexemeQuery = lexemeQuery
          .order("id", { ascending: true })
          .range(body.offset!, body.offset! + body.limit! - 1);
      } else {
        lexemeQuery = lexemeQuery.in("id", lexemeIds);
      }
      const { data: lexemeData, error: lexemeError, count } = await lexemeQuery;
      if (lexemeError) {
        throw new Error(`LEXEME_LOAD_FAILED:${lexemeError.message}`);
      }

      const lexemes = (lexemeData ?? []) as LexemeRow[];
      if (body.backfill) {
        lexemeIds = lexemes.map((lexeme) => lexeme.id);
        total = count ?? 0;
      }

      let bindingRows: ArticleBindingRow[] = [];
      if (lexemes.length > 0) {
        const { data: bindingData, error: bindingError } = await supabase.rpc(
          "get_authoritative_morphology_article_bindings_v2",
          { p_lexeme_ids: lexemes.map((lexeme) => lexeme.id) },
        );
        if (bindingError) {
          throw new Error(
            `ARTICLE_BINDING_LOAD_FAILED:${bindingError.message}`,
          );
        }
        bindingRows = (bindingData ?? []) as ArticleBindingRow[];
      }
      let persistedRows: PersistedFormDisplayRow[] = [];
      if (body.verifyPersisted && lexemes.length > 0) {
        const { data, error } = await supabase
          .from("lexeme_form_display_v2")
          .select(
            "lexeme_id,dictionary_code,article_id,article_ids,pos,lemma,form_key,primary_values,alternative_values,regularity_marker,policy_version",
          )
          .in("lexeme_id", lexemes.map((lexeme) => lexeme.id));
        if (error) {
          throw new Error(`PERSISTED_PROJECTION_LOAD_FAILED:${error.message}`);
        }
        persistedRows = (data ?? []) as PersistedFormDisplayRow[];
      }
      const results = await mapWithConcurrency(
        lexemes,
        CONCURRENCY,
        async (lexeme) => {
          const result = await resolveOne(
            lexeme,
            bindingRows.filter((row) => row.lexeme_id === lexeme.id).map(
              toArticleBinding,
            ),
          );
          if (body.verifyPersisted) {
            return {
              ...compactResult(result),
              persisted: false,
              parity: comparePersistedProjection(
                result.displayGroups,
                persistedRows.filter((row) => row.lexeme_id === lexeme.id),
                result.status,
                result.articleProjection.publishable,
                result.articleIds,
              ),
            };
          }
          if (
            body.persist && isPersistenceEligibleStatus(result.status) &&
            result.articleProjection.publishable
          ) {
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
          if (body.persist && result.status === "ambiguous_source_articles") {
            return {
              ...compactResult(result),
              status: "persistence_blocked_source_identity",
              persisted: false,
              error: "SOURCE_ARTICLE_PROJECTIONS_DIVERGE",
            };
          }
          return { ...compactResult(result), persisted: false };
        },
      );

      const missingIds = lexemeIds.filter(
        (id) => !lexemes.some((lexeme) => lexeme.id === id),
      );
      const failed = results.filter((result) =>
        !isShadowResolvedStatus(result.status)
      ).length +
        missingIds.length;

      const nextOffset = body.backfill &&
          body.offset! + lexemes.length < (total ?? 0)
        ? body.offset! + lexemes.length
        : null;
      return json({
        ok: failed === 0,
        worker: FUNCTION_NAME,
        mode: body.verifyPersisted
          ? "verify_persisted"
          : body.persist
          ? "persist"
          : "shadow",
        dictionaries: ["bm"],
        processed: results.length,
        failed,
        missingLexemeIds: missingIds,
        total,
        hasMore: nextOffset !== null,
        nextOffset,
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
}

async function resolveOne(
  lexeme: LexemeRow,
  articleBindings: AuthoritativeArticleBinding[] = [],
  lookupQuery = lexemeDictionaryLookupQuery(lexeme),
) {
  const query = lookupQuery;
  const resolution = await resolveAuthoritativeMorphology({
    request: { query, pos: lexeme.pos, dictionaries: ["bm"] },
    client: new OrdbokeneClient(),
  });
  let displayGroups = buildAuthoritativeDisplayGroups(
    resolution.paradigms,
    resolution.lookup.normalizedQuery,
  );
  const unboundProjection = resolveArticleProjection(displayGroups);
  const appliedBinding = articleBindings.length > 0
    ? applyAuthoritativeArticleBindings(
      resolution,
      displayGroups,
      articleBindings,
    )
    : null;
  const effectiveResolution = appliedBinding?.resolution ?? resolution;
  displayGroups = appliedBinding?.displayGroups ?? displayGroups;
  const articleProjection = appliedBinding
    ? {
      ...resolveArticleProjection(displayGroups),
      status: "bound_source_article" as const,
      bindingEvidenceIds: appliedBinding.evidenceIds,
      bindingProviderVersion: appliedBinding.providerVersion,
    }
    : articleBindings.length > 0
    ? {
      ...unboundProjection,
      status: "invalid_article_binding" as const,
      publishable: false,
      primaryCount: 0,
      alternativeCount: 0,
    }
    : unboundProjection;

  let status = resolution.status as string;
  if (resolution.status === "resolved") {
    if (articleProjection.status === "no_source_article") {
      status = "not_found";
    } else if (articleProjection.status === "equivalent_source_articles") {
      status = "resolved_equivalent_source_articles";
    } else if (articleProjection.status === "bound_source_article") {
      status = "resolved_bound_source_article";
    } else if (articleProjection.status === "invalid_article_binding") {
      status = "invalid_article_binding";
    } else if (articleProjection.status === "ambiguous_source_articles") {
      status = "ambiguous_source_articles";
    }
  }
  if (
    resolution.lookup.requestedDictionaries.some((dictionary) =>
      dictionary !== "bm"
    )
  ) {
    status = "dictionary_scope_error";
  }
  if (
    effectiveResolution.paradigms.length > 0 &&
    !effectiveResolution.paradigms.some((paradigm) =>
      normalizeNorwegian(paradigm.lemma) ===
        effectiveResolution.lookup.normalizedQuery
    )
  ) {
    status = "source_lemma_mismatch";
  }

  const comparison = {
    ...compareAuthoritativeAndLegacyForms(displayGroups, []),
    mode: "authoritative_source_only",
    legacyCompared: false,
  };
  return {
    lexemeId: lexeme.id,
    lemma: lexeme.lemma,
    pos: lexeme.pos,
    status,
    articleIds: articleProjection.articleIds,
    articleProjection,
    displayGroups,
    comparison,
    resolution: effectiveResolution,
  };
}

function compactResult(result: Awaited<ReturnType<typeof resolveOne>>) {
  return {
    lexemeId: result.lexemeId,
    lemma: result.lemma,
    pos: result.pos,
    status: result.status,
    articleIds: result.articleIds,
    articleProjection: result.articleProjection,
    primaryCount: result.articleProjection.primaryCount,
    alternativeCount: result.articleProjection.alternativeCount,
    comparison: result.comparison,
  };
}

export async function readBody(
  request: Request,
): Promise<
  Required<Pick<RequestBody, "persist" | "verifyPersisted">> & RequestBody
> {
  const payload: unknown = await request.json();
  if (!isRecord(payload)) throw new Error("JSON_OBJECT_REQUIRED");
  const persist = payload.persist === true;
  const verifyPersisted = payload.verifyPersisted === true;
  const backfill = payload.backfill === true;
  if (persist && verifyPersisted) {
    throw new Error("VERIFY_PERSISTED_CANNOT_PERSIST");
  }
  if (backfill && verifyPersisted) {
    throw new Error("VERIFY_PERSISTED_REQUIRES_EXPLICIT_LEXEME_IDS");
  }
  const lookupWord = typeof payload.lookupWord === "string"
    ? payload.lookupWord.trim()
    : undefined;
  const lookupPos = parsePos(payload.lookupPos);
  if (lookupWord) {
    if (!lookupPos) throw new Error("LOOKUP_POS_REQUIRED");
    if (persist) throw new Error("MANUAL_LOOKUP_CANNOT_PERSIST");
    if (verifyPersisted) {
      throw new Error("MANUAL_LOOKUP_CANNOT_VERIFY_PERSISTED");
    }
    return { lookupWord, lookupPos, persist, verifyPersisted };
  }

  if (backfill) {
    const offset = Number(payload.offset ?? 0);
    const limit = Number(payload.limit ?? MAX_LEXEMES);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error("BACKFILL_OFFSET_MUST_BE_NON_NEGATIVE_INTEGER");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LEXEMES) {
      throw new Error(`BACKFILL_LIMIT_MUST_BE_1_TO_${MAX_LEXEMES}`);
    }
    return { backfill, offset, limit, persist, verifyPersisted };
  }

  if (!Array.isArray(payload.lexemeIds)) throw new Error("LEXEME_IDS_REQUIRED");
  const lexemeIds = [...new Set(payload.lexemeIds.map(String).filter(Boolean))];
  if (lexemeIds.length === 0 || lexemeIds.length > MAX_LEXEMES) {
    throw new Error(`LEXEME_IDS_MUST_CONTAIN_1_TO_${MAX_LEXEMES}`);
  }
  return { lexemeIds, persist, verifyPersisted };
}

function parsePos(value: unknown): MorphologyPos | undefined {
  return typeof value === "string" && ALLOWED_POS.has(value as MorphologyPos)
    ? value as MorphologyPos
    : undefined;
}

function cleanLookupWord(value: string): string {
  return value.trim().replace(/^å\s+/i, "").replace(/^(en|ei|et)\s+/i, "");
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
}

function isShadowResolvedStatus(status: string): boolean {
  return status === "resolved" ||
    status === "resolved_equivalent_source_articles" ||
    status === "resolved_bound_source_article";
}

function toArticleBinding(row: ArticleBindingRow): AuthoritativeArticleBinding {
  return {
    dictionaryCode: row.dictionary_code,
    articleId: String(row.article_id),
    normalizedLemma: row.normalized_lemma,
    pos: row.pos,
    evidenceIds: row.evidence_ids,
    providerVersion: row.provider_version,
  };
}

function isPersistenceEligibleStatus(status: string): boolean {
  return isShadowResolvedStatus(status);
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
