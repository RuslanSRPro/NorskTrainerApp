import {
  containsExactPhrase,
  countTokenHits,
  fetchWithTimeout,
  getTokens,
  includesAny,
  makeLookup,
  normalizeHtmlText,
  preview,
  type SourceLookupResult,
} from './shared.ts';

export async function checkSpraakradetLive(
  lemma: string,
  displayForm: string,
): Promise<SourceLookupResult> {
  const query = lemma || displayForm;
  const encoded = encodeURIComponent(query);
  const svarUrl = `https://sprakradet.no/?s=${encoded}`;
  const urls = [svarUrl];

  try {
    const res = await fetchWithTimeout(svarUrl);

    if (!res.ok) {
      return {
        source: 'Språkrådet',
        checked: true,
        found: null,
        quality: 'error',
        registered_entry: false,
        whole_unit_match: false,
        component_match: false,
        usage_match: false,
        urls,
        evidence_label: `Språkrådet HTTP ${res.status}`,
        error: `HTTP ${res.status}`,
      };
    }

    const html = await res.text();
    const text = normalizeHtmlText(html);
    const exact = containsExactPhrase(text, query);
    const tokens = getTokens(query);
    const tokenHits = countTokenHits(text, tokens);

    const noResults =
      /ingen\s+treff\s+på/i.test(text) ||
      /ingen\s+resultater\s+for/i.test(text) ||
      /0\s+treff/i.test(text) ||
      text.includes('søket gav ingen treff') ||
      text.includes('fant ingen treff');

    const emptyPage = text.length < 500;

    const normativeMarkers = includesAny(text, [
      'språkspørsmål og svar',
      'korrekt språk',
      'rettskriving',
      'skriveregler',
      'ordbøkene',
      'bokmålsordboka',
      'nynorskordboka',
      'klarspråk',
      'språkrådet svarer',
      'normering',
      'skrivemåte',
    ]);

    if (noResults || emptyPage) {
      return makeLookup(
        'Språkrådet',
        false,
        'not_found',
        false,
        false,
        false,
        false,
        urls,
        'Språkrådet: no normative reference found',
        '',
      );
    }

    if (exact && normativeMarkers) {
      return {
        source: 'Språkrådet',
        checked: true,
        found: true,
        quality: 'normative_reference',
        registered_entry: false,
        whole_unit_match: false,
        component_match: false,
        usage_match: true,
        urls,
        evidence_label: 'Språkrådet: exact normative reference found',
        raw_preview: preview(text.slice(0, 700)),
      };
    }

    if (tokens.length >= 2 && tokenHits >= 2 && normativeMarkers) {
      return {
        source: 'Språkrådet',
        checked: true,
        found: true,
        quality: 'normative_reference',
        registered_entry: false,
        whole_unit_match: false,
        component_match: true,
        usage_match: true,
        urls,
        evidence_label: `Språkrådet: normative token match ${tokenHits}/${tokens.length}`,
        raw_preview: preview(text.slice(0, 700)),
      };
    }

    if (exact) {
      return {
        source: 'Språkrådet',
        checked: true,
        found: true,
        quality: 'search_page_match',
        registered_entry: false,
        whole_unit_match: false,
        component_match: false,
        usage_match: true,
        urls,
        evidence_label: 'Språkrådet: exact search-page match, not enough normative markers',
        raw_preview: preview(text.slice(0, 700)),
      };
    }
  } catch (e) {
    return {
      source: 'Språkrådet',
      checked: true,
      found: null,
      quality: 'error',
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: false,
      urls,
      evidence_label: 'Språkrådet lookup failed',
      error: e instanceof Error ? e.message : String(e),
    };
  }

  return makeLookup(
    'Språkrådet',
    false,
    'not_found',
    false,
    false,
    false,
    false,
    urls,
    'Språkrådet: no normative reference found',
    '',
  );
}