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
import { OrdbokeneClient } from '../../_shared/authoritative-morphology-v2/client.ts';
import {
  normalizeNorwegian,
  parseOrdbokeneArticles,
} from '../../_shared/authoritative-morphology-v2/parser.ts';
import { isAuthoritativeLookupForm } from '../../_shared/authoritative-morphology-v2/lookup-identity.ts';

const MORPHOLOGY_POS = new Set(['verb', 'noun', 'adjective', 'determiner']);

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

export async function checkOrdbokeneLive(
  lemma: string,
  displayForm: string,
  pos?: string | null,
): Promise<SourceLookupResult> {
  const query = lemma || displayForm;
  const tokens = getTokens(query);

  // Token verification must use the same Bokmål article search as D10:
  // exact lookup, inflected-form fallback, article fetch, POS and form check.
  // Do not treat a suggestion or a truncated spelling variant as this POS.
  if (tokens.length === 1 && (!pos || MORPHOLOGY_POS.has(pos))) {
    const lookup = await new OrdbokeneClient().lookup(query, ['bm']);
    const paradigms = parseOrdbokeneArticles(lookup.articles).filter(
      (paradigm) =>
        (!pos || paradigm.pos === pos) &&
        isAuthoritativeLookupForm(query, [paradigm], normalizeNorwegian),
    );
    const articleIds = [...new Set(paradigms.map((paradigm) => paradigm.articleId))];
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
    if (articleIds.length === 1) {
      return {
        source: 'Ordbokene',
        checked: true,
        found: true,
        quality: 'registered_entry',
        registered_entry: true,
        whole_unit_match: true,
        component_match: false,
        usage_match: false,
        urls: [...new Set(paradigms.map((paradigm) => paradigm.articleUrl))],
        evidence_label: `Ordbokene Bokmål ${pos ?? paradigms[0].pos}: ${articleIds[0]}`,
        raw_preview: {
          dictionary_code: 'bm',
          pos: pos ?? paradigms[0].pos,
          article_ids: articleIds,
          lookup_scope: lookup.scopeUsed,
          candidate_article_count: lookup.articleReferences.length,
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
        candidate_article_ids: articleIds },
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
      quality: 'exact_expression_match',
      registered_entry: false,
      whole_unit_match: true,
      component_match: false,
      usage_match: false,
      urls: [exactArticlesUrl, exactSuggestUrl],
      evidence_label: 'Ordbokene exact suggestion match (not confirmed via article lookup)',
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