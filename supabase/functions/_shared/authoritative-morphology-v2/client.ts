import { normalizeNorwegian } from "./parser.ts";
import type {
  ArticleReference,
  DictionaryCode,
  LookupScope,
  OrdbokeneArticle,
  OrdbokeneLookup,
  SourceError,
} from "./types.ts";

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type OrdbokeneClientOptions = {
  fetchImpl?: FetchLike;
  baseUrl?: string;
  timeoutMs?: number;
};

export class OrdbokeneClient {
  readonly #fetch: FetchLike;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;

  constructor(options: OrdbokeneClientOptions = {}) {
    this.#fetch = options.fetchImpl ?? fetch;
    this.#baseUrl = (options.baseUrl ?? "https://ord.uib.no").replace(
      /\/$/,
      "",
    );
    this.#timeoutMs = options.timeoutMs ?? 8_000;
  }

  async lookup(
    query: string,
    dictionaries: readonly DictionaryCode[] = ["bm", "nn"],
  ): Promise<OrdbokeneLookup> {
    const normalizedQuery = normalizeNorwegian(query);
    if (!normalizedQuery) throw new Error("Ordbokene lookup query is empty");

    const requestedDictionaries = uniqueDictionaries(dictionaries);
    if (requestedDictionaries.length === 0) {
      throw new Error("At least one Ordbokene dictionary is required");
    }

    let scopeUsed: LookupScope = "e";
    let articleReferences = await this.#lookupArticleReferences(
      normalizedQuery,
      requestedDictionaries,
      scopeUsed,
    );

    if (articleReferences.length === 0) {
      scopeUsed = "i";
      articleReferences = await this.#lookupArticleReferences(
        normalizedQuery,
        requestedDictionaries,
        scopeUsed,
      );
    }

    const settled = await Promise.allSettled(
      articleReferences.map((reference) => this.#fetchArticle(reference)),
    );
    const articles: OrdbokeneArticle[] = [];
    const errors: SourceError[] = [];

    for (let index = 0; index < settled.length; index += 1) {
      const result = settled[index];
      const reference = articleReferences[index];
      if (result.status === "fulfilled") {
        articles.push(result.value);
      } else {
        errors.push({
          ...reference,
          url: this.#articleUrl(reference),
          message: errorMessage(result.reason),
        });
      }
    }

    return {
      query,
      normalizedQuery,
      requestedDictionaries,
      scopeUsed,
      articleReferences,
      articles,
      errors,
      checkedAt: new Date().toISOString(),
    };
  }

  async #lookupArticleReferences(
    query: string,
    dictionaries: readonly DictionaryCode[],
    scope: LookupScope,
  ): Promise<ArticleReference[]> {
    const url = new URL(`${this.#baseUrl}/api/articles`);
    url.searchParams.set("w", query);
    url.searchParams.set("dict", dictionaries.join(","));
    url.searchParams.set("scope", scope);

    const payload = await this.#fetchJson(url.toString());
    const articles = isRecord(payload.articles) ? payload.articles : {};
    const references: ArticleReference[] = [];

    for (const dictionaryCode of dictionaries) {
      const ids = Array.isArray(articles[dictionaryCode])
        ? articles[dictionaryCode]
        : [];

      for (const id of ids) {
        if (typeof id !== "string" && typeof id !== "number") continue;
        references.push({ dictionaryCode, articleId: String(id) });
      }
    }

    return deduplicateReferences(references);
  }

  async #fetchArticle(reference: ArticleReference): Promise<OrdbokeneArticle> {
    const sourceUrl = this.#articleUrl(reference);
    const payload = await this.#fetchJson(sourceUrl);
    return { ...reference, sourceUrl, payload };
  }

  #articleUrl(reference: ArticleReference): string {
    return `${this.#baseUrl}/${reference.dictionaryCode}/article/${
      encodeURIComponent(reference.articleId)
    }.json`;
  }

  async #fetchJson(url: string): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await this.#fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Ordbokene returned HTTP ${response.status}`);
      }

      const payload: unknown = await response.json();
      if (!isRecord(payload)) {
        throw new Error("Ordbokene returned a non-object JSON payload");
      }
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function uniqueDictionaries(
  dictionaries: readonly DictionaryCode[],
): DictionaryCode[] {
  return [...new Set(dictionaries)].filter((dictionary) =>
    dictionary === "bm" || dictionary === "nn"
  );
}

function deduplicateReferences(
  references: readonly ArticleReference[],
): ArticleReference[] {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.dictionaryCode}:${reference.articleId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
