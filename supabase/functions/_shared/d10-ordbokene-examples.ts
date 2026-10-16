// Ordbokene article examples are structured nodes, not plain strings:
//   { type_: 'example', quote: { content: 'han $ ofte', items: [{ type_: 'usage', text: 'er' }] } }
// Each `$` in `content` is replaced by the next item. The rendering rules are the
// same as in ai-enrichment-worker/pos-sense-guard.ts. A quote with an unknown
// placeholder is skipped instead of being saved with a hole in it.
// Nested sub_article nodes belong to other dictionary entries and are not read.

export function renderOrdbokeneContent(node: unknown): string | null {
  const value = node as { content?: unknown; items?: unknown[] } | null;
  if (!value || typeof value.content !== 'string') return null;
  let index = 0;
  let unresolved = false;
  const text = value.content.replace(/\$/g, () => {
    const item = (value.items ?? [])[index++] as Record<string, unknown> | undefined;
    if (item?.type_ === 'article_ref') {
      const labels = ((item.lemmas ?? []) as Array<Record<string, unknown>>)
        .map((entry) => entry?.lemma)
        .filter((lemma): lemma is string => typeof lemma === 'string' && lemma.trim().length > 0);
      if (labels.length) return labels.join(' / ');
    }
    if (item?.type_ === 'usage' && typeof item.text === 'string') return item.text;
    if (item?.type_ === 'entity' && item.id === 'mots') return 'motsatt';
    unresolved = true;
    return '';
  }).replace(/\s+/g, ' ').trim();
  return !unresolved && text ? text : null;
}

export function collectOrdbokeneArticleExamples(
  node: unknown,
  output: Set<string> = new Set(),
  isRoot = true,
): Set<string> {
  if (Array.isArray(node)) {
    for (const entry of node) collectOrdbokeneArticleExamples(entry, output, false);
    return output;
  }
  if (!node || typeof node !== 'object') return output;
  const record = node as Record<string, unknown>;
  if (!isRoot && record.type_ === 'sub_article') return output;
  if (record.type_ === 'example') {
    const text = renderOrdbokeneContent(record.quote);
    if (text) output.add(text);
    return output;
  }
  for (const nested of Object.values(record)) {
    collectOrdbokeneArticleExamples(nested, output, false);
  }
  return output;
}
