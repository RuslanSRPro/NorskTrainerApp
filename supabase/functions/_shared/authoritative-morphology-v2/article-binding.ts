import { normalizeNorwegian } from "./parser.ts";
import type {
  AuthoritativeParadigm,
  DictionaryCode,
  FormDisplayGroup,
  MorphologyPos,
  ResolveResult,
} from "./types.ts";

export const ARTICLE_BINDING_PROVIDER_VERSION =
  "authoritative-article-binding/v1" as const;

export type AuthoritativeArticleBinding = {
  dictionaryCode: DictionaryCode;
  articleId: string;
  normalizedLemma: string;
  pos: MorphologyPos;
  evidenceIds: string[];
  providerVersion: string;
};

export type AppliedArticleBinding = {
  resolution: ResolveResult;
  displayGroups: FormDisplayGroup[];
  articleIds: string[];
  evidenceIds: string[];
  providerVersion: string;
};

/**
 * Narrows an already source-resolved result to an explicit learner-to-article
 * binding. The binding may only select articles present in the exact lookup,
 * with the same dictionary, lemma and POS. It cannot add or synthesize forms.
 */
export function applyAuthoritativeArticleBindings(
  resolution: ResolveResult,
  displayGroups: readonly FormDisplayGroup[],
  bindings: readonly AuthoritativeArticleBinding[],
): AppliedArticleBinding | null {
  if (bindings.length === 0 || !resolution.requestedPos) return null;

  const normalizedQuery = resolution.lookup.normalizedQuery;
  const uniqueArticleIds = new Set<string>();
  const evidenceIds = new Set<string>();
  let providerVersion: string | null = null;

  for (const binding of bindings) {
    if (
      binding.dictionaryCode !== "bm" ||
      binding.pos !== resolution.requestedPos ||
      normalizeNorwegian(binding.normalizedLemma) !== normalizedQuery ||
      !/^[1-9][0-9]*$/.test(binding.articleId) ||
      binding.evidenceIds.length === 0 ||
      !binding.providerVersion.trim()
    ) {
      return null;
    }
    if (providerVersion && providerVersion !== binding.providerVersion) {
      return null;
    }
    providerVersion = binding.providerVersion;
    uniqueArticleIds.add(binding.articleId);
    for (const evidenceId of binding.evidenceIds) {
      if (!evidenceId.trim()) return null;
      evidenceIds.add(evidenceId);
    }
  }

  const articleIds = [...uniqueArticleIds].sort(compareArticleIds);
  const lookupArticleIds = new Set(
    resolution.lookup.articles
      .filter((article) => article.dictionaryCode === "bm")
      .map((article) => article.articleId),
  );
  if (articleIds.some((articleId) => !lookupArticleIds.has(articleId))) {
    return null;
  }

  const paradigms = resolution.paradigms.filter((paradigm) =>
    matchesBinding(paradigm, articleIds, normalizedQuery, resolution.requestedPos!)
  );
  const selectedGroups = displayGroups.filter((group) =>
    articleIds.includes(group.articleId) &&
    group.dictionaryCode === "bm" &&
    group.pos === resolution.requestedPos &&
    normalizeNorwegian(group.lemma) === normalizedQuery
  );

  if (
    paradigms.length === 0 ||
    selectedGroups.length === 0 ||
    articleIds.some((articleId) =>
      !paradigms.some((paradigm) => paradigm.articleId === articleId) ||
      !selectedGroups.some((group) => group.articleId === articleId)
    )
  ) {
    return null;
  }

  return {
    resolution: { ...resolution, paradigms },
    displayGroups: selectedGroups,
    articleIds,
    evidenceIds: [...evidenceIds].sort(),
    providerVersion: providerVersion!,
  };
}

function matchesBinding(
  paradigm: AuthoritativeParadigm,
  articleIds: readonly string[],
  normalizedQuery: string,
  pos: MorphologyPos,
): boolean {
  return paradigm.dictionaryCode === "bm" &&
    articleIds.includes(paradigm.articleId) &&
    paradigm.pos === pos &&
    normalizeNorwegian(paradigm.lemma) === normalizedQuery;
}

function compareArticleIds(left: string, right: string): number {
  return left.localeCompare(right, "en", { numeric: true });
}
