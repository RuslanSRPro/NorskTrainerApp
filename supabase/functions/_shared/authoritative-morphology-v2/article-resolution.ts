import type { FormDisplayGroup } from "./types.ts";

export type ArticleProjectionStatus =
  | "no_source_article"
  | "single_source_article"
  | "equivalent_source_articles"
  | "ambiguous_source_articles";

export type ArticleProjectionResolution = {
  status: ArticleProjectionStatus;
  articleIds: string[];
  publishable: boolean;
  primaryCount: number;
  alternativeCount: number;
};

/**
 * Same-POS dictionary articles remain separate source identities. When every
 * article exposes the exact same learner-facing forms and tiers, shadow reads
 * may compare their shared projection without choosing a sense. Persistence is
 * still blocked until the schema can retain all contributing article IDs.
 */
export function resolveArticleProjection(
  groups: readonly FormDisplayGroup[],
): ArticleProjectionResolution {
  const groupsByArticle = new Map<string, FormDisplayGroup[]>();
  for (const group of groups) {
    const current = groupsByArticle.get(group.articleId) ?? [];
    current.push(group);
    groupsByArticle.set(group.articleId, current);
  }

  const articleIds = [...groupsByArticle.keys()].sort(compareArticleIds);
  if (articleIds.length === 0) {
    return {
      status: "no_source_article",
      articleIds,
      publishable: false,
      primaryCount: 0,
      alternativeCount: 0,
    };
  }

  const signatures = articleIds.map((articleId) =>
    articleSignature(groupsByArticle.get(articleId) ?? [])
  );
  const equivalent = signatures.every((signature) =>
    signature === signatures[0]
  );
  const referenceGroups = groupsByArticle.get(articleIds[0]) ?? [];
  const counts = uniqueTierCounts(referenceGroups);

  if (articleIds.length === 1) {
    return {
      status: "single_source_article",
      articleIds,
      publishable: true,
      ...counts,
    };
  }

  return {
    status: equivalent
      ? "equivalent_source_articles"
      : "ambiguous_source_articles",
    articleIds,
    // Current V2 persistence has one article_id per display row. Never discard
    // the other identities just to make an equivalent projection publishable.
    publishable: false,
    primaryCount: equivalent ? counts.primaryCount : 0,
    alternativeCount: equivalent ? counts.alternativeCount : 0,
  };
}

function articleSignature(groups: readonly FormDisplayGroup[]): string {
  return JSON.stringify(
    [...groups].map((group) => ({
      formKey: group.formKey,
      primary: uniqueSorted(group.primary.map((form) => form.normalizedValue)),
      alternatives: uniqueSorted(
        group.alternatives.map((form) => form.normalizedValue),
      ),
      regularityMarker: group.regularityMarker,
      policyVersion: group.policyVersion,
    })).sort((left, right) => left.formKey.localeCompare(right.formKey)),
  );
}

function uniqueTierCounts(groups: readonly FormDisplayGroup[]) {
  const primary = new Set<string>();
  const alternatives = new Set<string>();
  for (const group of groups) {
    for (const form of group.primary) {
      primary.add(`${group.formKey}|${form.normalizedValue}`);
    }
    for (const form of group.alternatives) {
      alternatives.add(`${group.formKey}|${form.normalizedValue}`);
    }
  }
  return { primaryCount: primary.size, alternativeCount: alternatives.size };
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function compareArticleIds(left: string, right: string): number {
  return left.localeCompare(right, "en", { numeric: true });
}
