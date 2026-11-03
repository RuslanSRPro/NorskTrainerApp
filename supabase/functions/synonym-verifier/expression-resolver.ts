// supabase/functions/synonym-verifier/expression-resolver.ts
// D10 29.10.2026 (agreed, variant A): resolves NAOB synonym expressions that
// are not in expression_catalog, through Ordbøkene (no AI):
//   phrase search (articles?w=…&dict=bm&scope=e) -> an article that is exactly
//   this expression (isExactExpressionArticle, the check used for "dra ut") ->
//   its head word articles (referers) -> the card bound to such an article ->
//   ordbokene-lexeme-pipeline-worker extracts and promotes the expressions of
//   that article -> the expression is in the catalog -> 'resolved'.
//   No exact article -> 'explanation' (NAOB explanation). No card for the head
//   word -> 'parent_needed' (the head word goes to a child job, one round).
// The network and database are passed in (deps) so the logic is tested in node.

import { isExactExpressionArticle } from '../verification/adapters/expression-article.ts';

export type ResolutionRow = { norm_text: string; lease_token: string; rounds: number; attempts: number; kind?: string };
export type HeadWord = { article_id: number; lemma: string | null };
export type ResolverState = {
  expression_id: string | null;
  parent: { lexeme_id: string; lemma: string; pos: string; article_id: number } | null;
};
export type Outcome =
  | { outcome: 'resolved'; data: Record<string, unknown> }
  | { outcome: 'explanation'; data: Record<string, unknown> }
  | { outcome: 'parent_needed'; data: Record<string, unknown> }
  | { outcome: 'failed'; data: Record<string, unknown> }
  | { outcome: 'retry'; data: Record<string, unknown> }
  | { outcome: 'word_pos'; data: Record<string, unknown> };

export type ResolverDeps = {
  searchArticleIds: (phrase: string) => Promise<number[]>;          // bm article ids
  fetchArticle: (articleId: number) => Promise<unknown>;            // bm article JSON
  state: (norm: string, ownArticleId: number | null, parentArticleIds: number[]) => Promise<ResolverState>;
  runHeadWordPipeline: (parent: NonNullable<ResolverState['parent']>) => Promise<{ ok: boolean; detail?: unknown }>;
};

export const MAX_SEARCH_ARTICLES = 3;
export const MAX_HEAD_WORD_ROUNDS = 1;

// bm article ids from the Ordbøkene search answer {"articles":{"bm":[...]}}
export function bmArticleIds(payload: unknown): number[] {
  const ids = (payload as any)?.articles?.bm;
  return Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0) : [];
}

// head words of an expression article ("referers"); the order of Ordbøkene is kept
export function headWords(article: unknown): HeadWord[] {
  const refs = (article as any)?.referers;
  if (!Array.isArray(refs)) return [];
  const seen = new Set<number>();
  const out: HeadWord[] = [];
  for (const ref of refs) {
    const id = Number(ref?.article_id);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({ article_id: id, lemma: typeof ref?.lemma === 'string' ? ref.lemma.trim().toLowerCase() : null });
  }
  return out;
}

// D10 29.10.2026 (agreed): "referers" are ALL articles that point to the
// expression (fyre av: avfyre, avfyring, fyre, skuddløsning), not only the one
// it lives in. A head word that is a word of the expression itself comes
// first; when there is such a word, the others are not used.
export function expressionWords(norm: string): Set<string> {
  return new Set(norm.toLowerCase().split(/\s+/).filter(Boolean));
}
export function orderHeadWords(heads: HeadWord[], norm: string): HeadWord[] {
  const words = expressionWords(norm);
  const inside = heads.filter((h) => h.lemma && words.has(h.lemma));
  return inside.length ? inside : heads;
}

// Part of speech of an Ordbøkene article (first tag of its paradigms), in the
// app's names. Several different ones, or an unknown tag -> null.
const ORDBOKENE_POS: Record<string, string> = {
  VERB: 'verb', NOUN: 'noun', ADJ: 'adjective', ADV: 'adverb', PRON: 'pronoun', DET: 'determiner',
  ADP: 'preposition', CCONJ: 'conjunction', INTJ: 'interjection', NUM: 'numeral',
};
export function articlePos(article: unknown): string | null {
  const found = new Set<string>();
  for (const entry of ((article as any)?.lemmas ?? []) as any[]) {
    for (const paradigm of (entry?.paradigm_info ?? []) as any[]) {
      const tag = Array.isArray(paradigm?.tags) ? String(paradigm.tags[0] ?? '') : '';
      if (tag) found.add(tag);
    }
  }
  if (found.size !== 1) return null;
  return ORDBOKENE_POS[[...found][0]] ?? null;
}

// D10 29.10.2026 (agreed): a synonym WORD without a card. Its Ordbøkene
// articles with exactly this lemma give its part(s) of speech; the child job
// gets one item per part of speech (was: no part of speech -> gate review).
export const MAX_WORD_ARTICLES = 6;
export function articleHasLemma(article: unknown, word: string): boolean {
  const key = (v: string) => v.normalize('NFC').toLocaleLowerCase('nb-NO').trim();
  return ((article as any)?.lemmas ?? []).some((e: any) => typeof e?.lemma === 'string' && key(e.lemma) === key(word));
}
export async function resolveWord(row: ResolutionRow, deps: ResolverDeps): Promise<Outcome> {
  const word = row.norm_text;
  let ids: number[];
  try {
    ids = await deps.searchArticleIds(word);
  } catch (error) {
    return { outcome: 'retry', data: { error: `search: ${errorText(error)}` } };
  }
  const pos = new Set<string>();
  const matched: number[] = [];
  for (const id of ids.slice(0, MAX_WORD_ARTICLES)) {
    let article: unknown;
    try {
      article = await deps.fetchArticle(id);
    } catch (error) {
      return { outcome: 'retry', data: { error: `article ${id}: ${errorText(error)}` } };
    }
    if (!articleHasLemma(article, word)) continue;
    matched.push(id);
    const p = articlePos(article);
    if (p) pos.add(p);
  }
  if (!matched.length) return { outcome: 'failed', data: { reason: 'word_not_in_ordbokene', searched_article_ids: ids } };
  if (!pos.size) return { outcome: 'failed', data: { reason: 'word_pos_unknown', article_ids: matched } };
  return { outcome: 'word_pos', data: { pos: [...pos].sort(), article_ids: matched } };
}

export async function resolveOne(row: ResolutionRow, deps: ResolverDeps): Promise<Outcome> {
  if (row.kind === 'word') return resolveWord(row, deps);
  const norm = row.norm_text;
  let ids: number[];
  try {
    ids = await deps.searchArticleIds(norm);
  } catch (error) {
    return { outcome: 'retry', data: { error: `search: ${errorText(error)}` } };
  }

  let own: { id: number; article: unknown } | null = null;
  for (const id of ids.slice(0, MAX_SEARCH_ARTICLES)) {
    let article: unknown;
    try {
      article = await deps.fetchArticle(id);
    } catch (error) {
      return { outcome: 'retry', data: { error: `article ${id}: ${errorText(error)}` } };
    }
    if (isExactExpressionArticle(article, String(id), norm)) { own = { id, article }; break; }
  }
  if (!own) return { outcome: 'explanation', data: { searched_article_ids: ids, rule: 'no_own_ordbokene_expression_article' } };

  const heads = orderHeadWords(headWords(own.article), norm);
  const evidence = { own_article_id: own.id, head_words: heads };
  let state = await deps.state(norm, own.id, heads.map((h) => h.article_id));
  if (state.expression_id) return { outcome: 'resolved', data: { ...evidence, expression_id: state.expression_id, via: 'already_known' } };
  if (!heads.length) return { outcome: 'failed', data: { ...evidence, reason: 'no_head_word_article' } };

  if (state.parent) {
    const run = await deps.runHeadWordPipeline(state.parent);
    if (!run.ok) return { outcome: 'retry', data: { ...evidence, error: `head word pipeline: ${errorText(run.detail)}` } };
    state = await deps.state(norm, own.id, heads.map((h) => h.article_id));
    if (state.expression_id) {
      return { outcome: 'resolved', data: { ...evidence, expression_id: state.expression_id, via: 'head_word_pipeline',
        head_word: state.parent } };
    }
    return { outcome: 'failed', data: { ...evidence, reason: 'not_extracted_from_head_word', head_word: state.parent } };
  }

  if (row.rounds >= MAX_HEAD_WORD_ROUNDS) {
    return { outcome: 'failed', data: { ...evidence, reason: 'head_word_card_not_bound' } };
  }
  const head = heads.find((h) => h.lemma) ?? heads[0];
  if (!head.lemma) return { outcome: 'failed', data: { ...evidence, reason: 'head_word_without_lemma' } };
  // the head word goes to the child job with the part of speech of its article
  let parentPos: string | null = null;
  try {
    parentPos = articlePos(await deps.fetchArticle(head.article_id));
  } catch (error) {
    return { outcome: 'retry', data: { ...evidence, error: `head article ${head.article_id}: ${errorText(error)}` } };
  }
  return { outcome: 'parent_needed', data: { ...evidence, own_article_id: own.id, parent_lemma: head.lemma,
    parent_article_id: head.article_id, parent_pos: parentPos } };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  try { return typeof error === 'string' ? error : JSON.stringify(error); } catch { return String(error); }
}
