export type ExpressionArticleIdentity = {
  articleId: string;
  parentArticleId: string;
  parentArticleIds?: string[];
};

function key(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('nb-NO').trim().replace(/\s+/g, ' ');
}

// Only the article's own headwords count. A reference in definitions or an
// occurrence in examples cannot establish expression identity.
export function isExactExpressionArticle(
  payload: unknown, articleId: string, expression: string,
): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const article = payload as Record<string, unknown>;
  if (String(article.article_id) !== articleId || !Array.isArray(article.lemmas)) return false;
  return article.lemmas.some((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const lemma = (entry as Record<string, unknown>).lemma;
    const paradigms = (entry as Record<string, unknown>).paradigm_info;
    return typeof lemma === 'string' && key(lemma) === key(expression) &&
      Array.isArray(paradigms) && paradigms.some((paradigm: unknown) => {
        if (!paradigm || typeof paradigm !== 'object' || Array.isArray(paradigm)) return false;
        const value = paradigm as Record<string, unknown>;
        return value.standardisation === 'REGISTERED' &&
          Array.isArray(value.tags) && value.tags.includes('EXPR');
      });
  });
}

// Article identity is its own article ID. Parents are provenance, not homonyms.
export function resolveExpressionArticleIdentity(
  candidates: Array<{ candidate_article_id?: unknown; parent_article_id?: unknown; normalized_key?: unknown }>,
  normalizedKey: string,
): ExpressionArticleIdentity | null {
  const articles = new Set<string>();
  const parents = new Set<string>();
  for (const candidate of candidates) {
    if (key(String(candidate.normalized_key ?? '')) !== key(normalizedKey)) continue;
    const article = String(candidate.candidate_article_id ?? '');
    const parent = String(candidate.parent_article_id ?? '');
    if (!/^[1-9]\d*$/.test(article) || !/^[1-9]\d*$/.test(parent)) continue;
    articles.add(article); parents.add(parent);
  }
  if (articles.size !== 1 || parents.size === 0) return null;
  const parentArticleIds = [...parents].sort((a,b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
  return {articleId: [...articles][0], parentArticleId: parentArticleIds[0], parentArticleIds};
}
