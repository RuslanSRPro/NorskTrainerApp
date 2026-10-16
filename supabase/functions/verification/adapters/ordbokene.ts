import {
  delay,
  extractOrdbokeneArticleIds,
  extractOrdbokeneSuggestExactTerms,
  fetchJson,
  getTokens,
  normalizeForMatch,
  ordbokenePayloadHasExactMatch,
  shouldCheckOrdbokeneComponent,
  type SourceLookupResult,
} from './shared.ts';
import { OrdbokeneClient, isOrdbokeneServerError } from '../../_shared/authoritative-morphology-v2/client.ts';
import {
  normalizeNorwegian,
  parseOrdbokeneArticles,
} from '../../_shared/authoritative-morphology-v2/parser.ts';
import { isAuthoritativeLookupForm } from '../../_shared/authoritative-morphology-v2/lookup-identity.ts';
import { isExactExpressionArticle, type ExpressionArticleIdentity } from './expression-article.ts';

const MORPHOLOGY_POS = new Set(['verb', 'noun', 'adjective', 'determiner']);

function matchedAuthoritativeForm(
  query: string,
  paradigms: ReturnType<typeof parseOrdbokeneArticles>,
): { canonicalLemma: string | null; matchedForm: string | null; matchedFormKey: string | null } {
  const normalizedQuery = normalizeNorwegian(query);
  const lemmas = [...new Set(
    paradigms.map((paradigm) => normalizeNorwegian(paradigm.lemma)).filter(Boolean),
  )];
  const canonicalLemma = lemmas.length === 1
    ? paradigms.find((paradigm) => normalizeNorwegian(paradigm.lemma) === lemmas[0])?.lemma ?? null
    : null;

  for (const paradigm of paradigms) {
    if (normalizeNorwegian(paradigm.lemma) === normalizedQuery) {
      return { canonicalLemma, matchedForm: paradigm.lemma, matchedFormKey: 'lemma' };
    }
    for (const form of paradigm.forms) {
      if ((form.normalizedValue || normalizeNorwegian(form.value)) === normalizedQuery) {
        return { canonicalLemma, matchedForm: form.value, matchedFormKey: form.formKey };
      }
    }
  }
  return { canonicalLemma, matchedForm: null, matchedFormKey: null };
}

function norwegianLemmaVariants(word: string): string[] {
  const variants = new Set<string>([word]);
  const w = word.toLowerCase().trim();

  if (w.endsWith('et')) variants.add(w.slice(0, -2));
  if (w.endsWith('en')) variants.add(w.slice(0, -2));
  if (w.endsWith('a')) variants.add(w.slice(0, -1));
  if (w.endsWith('ene')) variants.add(w.slice(0, -3));
  if (w.endsWith('er')) variants.add(w.slice(0, -2));
  if (w.endsWith('landet')) variants.add(w.slice(0, -3));

  variants.add(word.charAt(0).toUpperCase() + word.slice(1));

  return [...variants].filter((v) => v.length >= 2);
}

export type OrdbokeneArticleSelection =
  | 'single_article' | 'bound_lexeme_article' | 'bound_lexeme_article_set';

// Pure selection rule for several Bokmål articles with the same POS. Only
// candidates bound to the resolved lexeme are kept; with no bound candidate
// the candidate list is returned unchanged (still ambiguous if > 1).
export function selectBoundHomonymArticles(
  candidateArticleIds: readonly string[],
  boundTokenArticleIds?: readonly (string | number)[] | null,
): { articleIds: string[]; articleSelection: OrdbokeneArticleSelection } {
  const candidates = [...candidateArticleIds].map(String);
  if (candidates.length > 1 && boundTokenArticleIds?.length) {
    const bound = new Set(boundTokenArticleIds.map(String));
    const chosen = candidates.filter((id) => bound.has(id));
    if (chosen.length === 1) return { articleIds: chosen, articleSelection: 'bound_lexeme_article' };
    if (chosen.length > 1) return { articleIds: chosen, articleSelection: 'bound_lexeme_article_set' };
  }
  return { articleIds: candidates, articleSelection: 'single_article' };
}

export type OrdbokeneLookupPath = 'token' | 'expression' | 'legacy';

// D10 14.10.2026: the path is chosen by the real number of words. getTokens()
// drops words shorter than two letters, so "i tide" (and "sette i", "ta i")
// looked like one word and was checked as a part-of-speech article instead of
// its own expression article. getTokens() itself is unchanged (NAOB, Lexin and
// Wiktionary use it). normalizeForMatch() still drops a leading infinitive
// marker "å", exactly as before.
export function ordbokeneLookupPath(query: string, pos?: string | null): OrdbokeneLookupPath {
  const words = normalizeForMatch(query).split(/\s+/).filter(Boolean).length;
  const tokens = getTokens(query);
  if (words === 1 && tokens.length === 1 && (!pos || MORPHOLOGY_POS.has(pos))) return 'token';
  if (words > 1) return 'expression';
  return 'legacy';
}

export async function checkOrdbokeneLive(
  lemma: string,
  displayForm: string,
  pos?: string | null,
expectedExpressionArticle?: ExpressionArticleIdentity | null,
  boundTokenArticleIds?: string[] | null,
  cachedSearch?: { articleIds: string[]; checkedAt: string | null } | null,
): Promise<SourceLookupResult> {
  const query = lemma || displayForm;
  const tokens = getTokens(query);
  const lookupPath = ordbokeneLookupPath(query, pos);

  // Token verification must use the same Bokmål article search as D10:
  // exact lookup, inflected-form fallback, article fetch, POS and form check.
  // Do not treat a suggestion or a truncated spelling variant as this POS.
  if (lookupPath === 'token') {
    // D10 15.10.2026: when the Ordbøkene SEARCH fails (HTTP 5xx, timeout) and
    // the resolved lexeme already has its article(s), those articles are
    // fetched directly. Same POS and form checks, exact lemma only. The
    // fallback never answers "not found" or "ambiguous": in that case the
    // original search error is raised and the check is retried later.
    const client = new OrdbokeneClient();
    let lookup: Awaited<ReturnType<OrdbokeneClient['lookup']>>;
    let searchError: unknown = null;
    let fallbackKind: 'known_article_ids' | 'cached_search_article_ids' | null = null;
    try {
      lookup = await client.lookup(query, ['bm']);
    } catch (error) {
      // D10 15.10.2026: known articles of the lexeme first; otherwise the
      // article numbers of our last successful exact search (cache level).
      const knownIds = boundTokenArticleIds?.length ? boundTokenArticleIds
        : cachedSearch?.articleIds?.length ? cachedSearch.articleIds : null;
      if (!isOrdbokeneServerError(error) || !knownIds) throw error;
      // A cached search with several articles was ambiguous for this word;
      // the cache never resolves it (a binding would be needed).
      if (!boundTokenArticleIds?.length && new Set(knownIds.map(String)).size > 1) throw error;
      searchError = error;
      fallbackKind = boundTokenArticleIds?.length ? 'known_article_ids' : 'cached_search_article_ids';
      lookup = await client.lookupKnownArticles(query, knownIds, ['bm']);
    }
    const lookupFallback = searchError !== null;
    const paradigms = parseOrdbokeneArticles(lookup.articles).filter(
      (paradigm) =>
        (!pos || paradigm.pos === pos) &&
        isAuthoritativeLookupForm(query, [paradigm], normalizeNorwegian) &&
        (!lookupFallback || normalizeNorwegian(paradigm.lemma) === normalizeNorwegian(query)),
    );
    const candidateArticleIds = [...new Set(paradigms.map((paradigm) => paradigm.articleId))];
    // Several Bokmål articles with this POS (homonyms): keep only the
    // candidates already bound to the resolved lexeme by its authoritative
    // forms projection (lexeme_form_display_v2.article_ids).
    //   - one bound candidate (være 'be' vs være 'sniff'): that article;
    //   - several bound candidates (huske 24686 + 24687: identical forms,
    //     one card, plan D10_homonym_pos_plan_v1 R8): the whole bound set
    //     confirms this lexeme and POS; the sense inside it stays open.
    // No bound candidate -> unchanged "ambiguous" result.
    // The set rule is limited to an exact lemma lookup (scope 'e'): an
    // inflected-form lookup (scope 'i') needs a single article to derive the
    // promotion lemma (d10_verified_ordbokene_promotion_lemma).
    const selection =
      selectBoundHomonymArticles(candidateArticleIds, boundTokenArticleIds);
    const { articleIds, articleSelection } =
      selection.articleSelection === 'bound_lexeme_article_set' && lookup.scopeUsed !== 'e'
        ? { articleIds: candidateArticleIds.map(String), articleSelection: 'single_article' as const }
        : selection;
    const homonymSelection = articleSelection !== 'single_article';
    const selectedParadigms = paradigms.filter((paradigm) =>
      articleIds.some((id) => String(id) === String(paradigm.articleId)));
    if (lookupFallback && (lookup.errors.length > 0 ||
        !(articleIds.length === 1 || articleSelection === 'bound_lexeme_article_set'))) {
      throw searchError;
    }
    if (lookup.errors.length) {
      return {
        source: 'Ordbokene', checked: true, found: false,
        quality: 'error', registered_entry: false,
        whole_unit_match: false, component_match: false, usage_match: false,
        urls: lookup.errors.map((error) => error.url),
        evidence_label: 'Ordbokene article fetch incomplete',
        error: lookup.errors.map((error) => error.message).join('; '),
      };
    }
    if (articleIds.length === 1 || articleSelection === 'bound_lexeme_article_set') {
      const matchedForm = matchedAuthoritativeForm(query, selectedParadigms);
      return {
        source: 'Ordbokene',
        checked: true,
        found: true,
        quality: 'registered_entry',
        registered_entry: true,
        whole_unit_match: true,
        component_match: false,
        usage_match: false,
        urls: [...new Set(selectedParadigms.map((paradigm) => paradigm.articleUrl))],
        evidence_label: (articleSelection === 'bound_lexeme_article_set'
          ? `Ordbokene Bokmål ${pos ?? selectedParadigms[0].pos}: ${articleIds.join(', ')} (homonym articles bound to the resolved lexeme)`
          : articleSelection === 'bound_lexeme_article'
          ? `Ordbokene Bokmål ${pos ?? selectedParadigms[0].pos}: ${articleIds[0]} (homonym article bound to the resolved lexeme)`
          : `Ordbokene Bokmål ${pos ?? selectedParadigms[0].pos}: ${articleIds[0]}`)
          + (fallbackKind === 'known_article_ids' ? ' (search unavailable; known article fetched directly)'
            : fallbackKind === 'cached_search_article_ids'
            ? ` (search unavailable; article numbers from the last search${cachedSearch?.checkedAt ? ' of ' + String(cachedSearch.checkedAt).slice(0, 10) : ''}, articles fetched now)`
            : ''),
        raw_preview: {
          dictionary_code: 'bm',
          pos: pos ?? selectedParadigms[0].pos,
          article_ids: articleIds,
          article_selection: articleSelection,
          ...(homonymSelection
            ? { candidate_article_ids: candidateArticleIds } : {}),
          lookup_scope: lookup.scopeUsed,
          canonical_lemma: matchedForm.canonicalLemma,
          matched_form: matchedForm.matchedForm,
          matched_form_key: matchedForm.matchedFormKey,
          candidate_article_count: lookup.articleReferences.length,
          ...(fallbackKind ? { lookup_fallback: fallbackKind } : {}),
          ...(fallbackKind === 'cached_search_article_ids' ? { cached_search_checked_at: cachedSearch?.checkedAt ?? null } : {}),
        },
      };
    }
    return {
      source: 'Ordbokene', checked: true, found: false,
      quality: 'not_found', registered_entry: false,
      whole_unit_match: false, component_match: false, usage_match: false,
      urls: lookup.articleReferences.map((reference) =>
        `https://ord.uib.no/${reference.dictionaryCode}/article/${reference.articleId}.json`
      ),
      evidence_label: articleIds.length > 1
        ? 'Ambiguous Bokmål articles; no article selected'
        : `No matching Bokmål ${pos ?? 'part of speech'} article or official form`,
      raw_preview: { dictionary_code: 'bm', pos, lookup_scope: lookup.scopeUsed,
        candidate_article_ids: articleIds,
        // Diagnostics: which articles were bound to the resolved lexeme.
        bound_article_ids: boundTokenArticleIds?.length ? boundTokenArticleIds.map(String) : [] },
    };
  }

  // Expression identity must come from its own exact Bokmål article. The
  // legacy recursive ID extractor below also sees unrelated nested IDs and
  // Nynorsk articles, so it cannot establish whole-expression identity.
  if (lookupPath === 'expression') {
    if (expectedExpressionArticle) {
      const { articleId, parentArticleId } = expectedExpressionArticle;
      const url = `https://ord.uib.no/bm/article/${encodeURIComponent(articleId)}.json`;
      const payload = await fetchJson(url);
      const matches = isExactExpressionArticle(payload, articleId, query);
      return {
        source: 'Ordbokene', checked: true, found: matches,
        quality: matches ? 'registered_entry' : 'not_found',
        registered_entry: matches, whole_unit_match: matches,
        component_match: false, usage_match: false, urls: [url],
        evidence_label: matches ? 'Own exact Bokmål expression article' : 'Expression article identity mismatch',
        raw_preview: matches ? {
          dictionary_code: 'bm', lookup_scope: 'candidate_article',
          article_ids: [articleId], parent_article_id: parentArticleId,
          parent_article_ids: expectedExpressionArticle.parentArticleIds ?? [parentArticleId],
          canonical_lemma: query, matched_form: query, matched_form_key: 'lemma',
        } : { dictionary_code: 'bm', candidate_article_id: articleId },
      };
    }
    // No uniquely bound candidate: remain on review. Never infer identity
    // from nested IDs in a broad search result.
    return {
      source: 'Ordbokene', checked: true, found: false,
      quality: 'not_found', registered_entry: false, whole_unit_match: false,
      component_match: false, usage_match: false, urls: [],
      evidence_label: 'No unique bound Bokmål expression article',
    };

  }

  const exactArticlesUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(
    query,
  )}&dict=bm,nn&scope=e`;

  const exactSuggestUrl = `https://ord.uib.no/api/suggest?q=${encodeURIComponent(
    query,
  )}&dict=bm,nn&include=eif&n=20`;

  let articlePayload = await fetchJson(exactArticlesUrl);
  const suggestPayload = await fetchJson(exactSuggestUrl);

  let articleIds = extractOrdbokeneArticleIds(articlePayload);

  if (articleIds.length === 0 && tokens.length === 1) {
    for (const variant of norwegianLemmaVariants(query)) {
      if (variant === query) continue;

      const variantUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(
        variant,
      )}&dict=bm,nn&scope=e`;

      const variantPayload = await fetchJson(variantUrl);
      const variantIds = extractOrdbokeneArticleIds(variantPayload);

      if (variantIds.length > 0) {
        articlePayload = variantPayload;
        articleIds = variantIds;
        break;
      }

      await delay(50);
    }
  }

  const exactSuggestTerms = extractOrdbokeneSuggestExactTerms(suggestPayload);

  const exactSuggest = exactSuggestTerms.some(
    (t) => normalizeForMatch(t) === normalizeForMatch(query),
  );

  const extendedExact = exactSuggestTerms.filter((t) => {
    const nt = normalizeForMatch(t);
    const nq = normalizeForMatch(query);
    return nt !== nq && nt.includes(nq);
  });

  // Confirmed via the article endpoint itself — the only branch allowed
  // to claim registered_entry: true. See system_architecture_v3.md, "Fix 1".
  if (articleIds.length > 0) {
    return {
      source: 'Ordbokene',
      checked: true,
      found: true,
      quality: 'registered_entry',
      registered_entry: true,
      whole_unit_match: true,
      component_match: false,
      usage_match: false,
      urls: [exactArticlesUrl, exactSuggestUrl],
      evidence_label: `Ordbokene registered entry: ${articleIds
        .slice(0, 5)
        .join(', ')}`,
      raw_preview: {
        article_ids: articleIds.slice(0, 10),
      },
    };
  }

  // Exact match from the suggest endpoint only (article lookup found
  // nothing) — NOT a confirmed registered entry, regardless of whether the
  // query is a single word or a multi-word expression. Single-token
  // suggest matches previously had their own branch here that incorrectly
  // claimed registered_entry: true; that branch is removed (Fix 1) so both
  // cases now get the same, correctly weaker classification.
  if (exactSuggest) {
    return {
      source: 'Ordbokene',
      checked: true,
      found: true,
      quality: 'search_page_match',
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: false,
      urls: [exactArticlesUrl, exactSuggestUrl],
      evidence_label: 'Ordbokene exact search suggestion; article not confirmed',
      raw_preview: {
        exact_suggestions: exactSuggestTerms,
      },
    };
  }

  if (extendedExact.length > 0) {
    return {
      source: 'Ordbokene',
      checked: true,
      found: true,
      quality: 'usage_example_match',
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: true,
      urls: [exactArticlesUrl, exactSuggestUrl],
      evidence_label: `Ordbokene extended: ${extendedExact.slice(0, 3).join(', ')}`,
      raw_preview: {
        extended_exact: extendedExact.slice(0, 10),
      },
    };
  }

  const componentUrls: string[] = [];
  const matchedComponents: string[] = [];

  for (const token of tokens) {
    if (!shouldCheckOrdbokeneComponent(token)) continue;

    const cUrl = `https://ord.uib.no/api/articles?w=${encodeURIComponent(
      token,
    )}&dict=bm,nn&scope=e`;

    const sUrl = `https://ord.uib.no/api/suggest?q=${encodeURIComponent(
      token,
    )}&dict=bm,nn&include=eif&n=10`;

    componentUrls.push(cUrl, sUrl);

    const cData = await fetchJson(cUrl);
    const sData = await fetchJson(sUrl);

    if (
      extractOrdbokeneArticleIds(cData).length > 0 ||
      ordbokenePayloadHasExactMatch(sData, token)
    ) {
      matchedComponents.push(token);
    }

    await delay(75);
  }

  if (tokens.length > 1 && matchedComponents.length > 0) {
    return {
      source: 'Ordbokene',
      checked: true,
      found: true,
      quality: 'component_match',
      registered_entry: false,
      whole_unit_match: false,
      component_match: true,
      usage_match: false,
      urls: [exactArticlesUrl, exactSuggestUrl, ...componentUrls],
      evidence_label: `Ordbokene components: ${matchedComponents.join(', ')}`,
    };
  }

  return {
    source: 'Ordbokene',
    checked: true,
    found: false,
    quality: 'not_found',
    registered_entry: false,
    whole_unit_match: false,
    component_match: false,
    usage_match: false,
    urls: [exactArticlesUrl, exactSuggestUrl, ...componentUrls],
    evidence_label: 'Ordbokene: no match found',
  };
}
