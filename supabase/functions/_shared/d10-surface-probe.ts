// D10 27.10.2026 (agreed): "surface as lemma" probe.
//
// A checked word that the database knows only as a FORM of other lemmas
// (bar -> bære preteritum, bare imperativ) is also asked as a headword of its
// own: Ordbøkene may have articles with exactly that headword (bar noun, bar
// adjective) that the job would otherwise never query, because the source
// checks ask the lemmas found in the database (bære, bare), not the word.
//
// Flow:
//   analyze-text (word_list + audit)  planSurfaceLemmaProbes -> one item per
//     such token, match_strategy 'surface_as_lemma_probe',
//     current_stage 'surface_probe', status 'pending', NO source checks.
//   job-orchestrator (before the lexical worker)  one OrdbokeneClient.lookup
//     per probe -> surfaceProbeDecision -> SQL d10_resolve_surface_probe_v1:
//       split        one clone per part of speech of the exact-headword
//                    articles (noun / verb / adjective), normal path from
//                    source_checks; the probe itself is closed;
//       no_headword  the word is not a headword (scope "i", nothing found,
//                    only other parts of speech) -> the probe is closed;
//       retry        Ordbøkene did not answer -> attempt + 1; at max_attempts
//                    the probe is closed as surface_probe_lookup_failed.
//   A closed probe: status done, admission_gate, admission_status rejected,
//   admission_reason surface_probe_*, rule_type surface_probe. It is excluded
//   from the completion snapshot (v2) and from the gate review split of
//   pipeline-supervisor (isSurfaceProbeItem), like a function word: never
//   "for review", never a blocker, never a card.
//
// No AI, no Deno imports here (unit tests run under node).

import { normalizeNorwegian } from './authoritative-morphology-v2/parser.ts';
import type { OrdbokeneArticle, OrdbokeneLookup } from './authoritative-morphology-v2/types.ts';

export const SURFACE_PROBE_STRATEGY = 'surface_as_lemma_probe';
export const SURFACE_PROBE_CLONE_STRATEGY = 'surface_as_lemma_probe_clone';
export const SURFACE_PROBE_STAGE = 'surface_probe';
export const SURFACE_PROBE_REASON_PREFIX = 'surface_probe_';
// Same parts of speech whose path is proven (bare, spille, vare). Determiner
// and adverb headwords are not probed (agreed 27.10.2026).
export const SURFACE_PROBE_POS: readonly string[] = ['noun', 'verb', 'adjective'];

type PlannedLike = {
  match_type: string;
  normalized_input: string;
  normalized_lemma: string;
  surface_form: string;
  raw_input: string;
  token_start: number;
  token_end: number;
  expression_id: string | null;
  resolved?: { lemma?: string | null } | null;
  match_strategy?: string | null;
};

export type SurfaceProbePlan = {
  raw_input: string;
  normalized_input: string;
  normalized_lemma: string;
  surface_form: string;
  token_start: number;
  token_end: number;
};

// One probe per token position where every token item was resolved from the
// database AND none of the found lemmas is the word itself. A position with an
// unresolved token item (no database candidate) already asks the sources for
// the word itself, so it gets no probe. `normalize` is the planner's own
// normalisation (analyze-text normalizeExpression), so "Bar" and "bar" compare
// equal; articles / "å" are removed by the app before the word reaches the job.
export function planSurfaceLemmaProbes(
  items: readonly PlannedLike[],
  normalize: (value: string) => string,
): SurfaceProbePlan[] {
  const byPosition = new Map<string, PlannedLike[]>();
  for (const item of items) {
    if (item.match_type !== 'token' || item.expression_id) continue;
    if (item.match_strategy === SURFACE_PROBE_STRATEGY) continue;
    if (item.token_start !== item.token_end) continue;
    const key = `${item.token_start}`;
    byPosition.set(key, [...(byPosition.get(key) ?? []), item]);
  }
  const probes: SurfaceProbePlan[] = [];
  for (const group of byPosition.values()) {
    const first = group[0];
    const word = normalize(first.normalized_input || first.surface_form || '');
    if (!word || word.length < 2 || /\s/.test(word)) continue;
    if (group.some((item) => !item.resolved)) continue;
    const lemmaIsWord = group.some((item) =>
      normalize(String(item.resolved?.lemma ?? item.normalized_lemma ?? '')) === word);
    if (lemmaIsWord) continue;
    probes.push({
      raw_input: first.raw_input,
      normalized_input: first.normalized_input,
      normalized_lemma: word,
      surface_form: first.surface_form,
      token_start: first.token_start,
      token_end: first.token_end,
    });
  }
  return probes.sort((a, b) => a.token_start - b.token_start);
}

export type SurfaceProbeDecision = {
  outcome: 'split' | 'no_headword' | 'retry';
  pos: string[];
  evidence: Record<string, unknown>;
};

// Decision from one Ordbøkene lookup of the probe word. Only articles whose
// headword IS the word (scope "e", parsed headword equal to the word) count;
// an inflection hit (scope "i": gikk -> gå, bar -> bære) is never a headword.
// Any article that could not be read -> retry (a missing article could hide a
// part of speech).
export function surfaceProbeDecision(word: string, lookup: OrdbokeneLookup): SurfaceProbeDecision {
  const asked = normalizeNorwegian(word);
  const evidence: Record<string, unknown> = {
    query: asked,
    scope: lookup.scopeUsed,
    article_ids: lookup.articleReferences.map((r) => r.articleId),
    version: 'd10_surface_probe_v1',
  };
  if (lookup.errors.length > 0) {
    return { outcome: 'retry', pos: [], evidence: { ...evidence,
      error: `article_fetch_failed: ${lookup.errors.map((e) => e.articleId).join(',')}` } };
  }
  if (lookup.scopeUsed !== 'e' || lookup.articles.length === 0) {
    return { outcome: 'no_headword', pos: [], evidence: { ...evidence, reason: 'no_exact_headword' } };
  }
  const found = new Map<string, Set<string>>();
  for (const article of lookup.articles) {
    if (article.dictionaryCode !== 'bm') continue;
    for (const p of articleHeadwordPos(article, asked)) {
      const ids = found.get(p) ?? new Set<string>();
      ids.add(String(article.articleId));
      found.set(p, ids);
    }
  }
  const pos = SURFACE_PROBE_POS.filter((p) => found.has(p));
  const headwordPos = Object.fromEntries([...found.entries()].map(([p, ids]) => [p, [...ids].sort()]));
  if (pos.length === 0) {
    return { outcome: 'no_headword', pos: [], evidence: { ...evidence, headword_pos: headwordPos,
      reason: found.size ? 'headword_pos_not_probed' : 'no_parsed_headword' } };
  }
  return { outcome: 'split', pos, evidence: { ...evidence, headword_pos: headwordPos } };
}

// Parts of speech of one article for the headword `asked`. Read from the tags
// of the paradigms of the matching lemma (not from the parsed forms: an
// indeclinable word has a paradigm without forms, e.g. spille noun), with the
// article word class as the fallback when the lemma has no paradigm.
const TAG_POS: Record<string, string> = { VERB: 'verb', NOUN: 'noun', SUBST: 'noun', ADJ: 'adjective', DET: 'determiner' };

function tagPos(tags: unknown): string | null {
  const list = Array.isArray(tags) ? tags.map((t) => String(t).toUpperCase()) : [];
  for (const key of ['VERB', 'NOUN', 'SUBST', 'ADJ', 'DET']) if (list.includes(key)) return TAG_POS[key];
  return null;
}

export function articleHeadwordPos(article: OrdbokeneArticle, asked: string): string[] {
  const payload = (article.payload ?? {}) as Record<string, unknown>;
  const lemmas = Array.isArray(payload.lemmas) ? payload.lemmas as Array<Record<string, unknown>> : [];
  const found = new Set<string>();
  let headwordMatched = false;
  for (const lemma of lemmas) {
    const value = String(lemma?.lemma ?? lemma?.final_lexeme ?? '');
    if (normalizeNorwegian(value) !== asked) continue;
    headwordMatched = true;
    const paradigms = Array.isArray(lemma.paradigm_info) ? lemma.paradigm_info as Array<Record<string, unknown>> : [];
    for (const paradigm of paradigms) {
      const p = tagPos(paradigm?.tags);
      if (p) found.add(p);
    }
  }
  if (headwordMatched && found.size === 0) {
    const p = tagPos([payload.word_class]);
    if (p) found.add(p);
  }
  return [...found];
}

// The closed-probe test used by pipeline-supervisor is isSurfaceProbeItem in
// d10-review-decisions.ts (the one list of gate decisions).
