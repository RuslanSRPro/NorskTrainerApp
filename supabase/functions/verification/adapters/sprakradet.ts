import {
  containsExactPhrase,
  fetchWithTimeout,
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

    const noResults =
      /ingen\s+treff\s+på/i.test(text) ||
      /ingen\s+resultater\s+for/i.test(text) ||
      /0\s+treff/i.test(text) ||
      /gav\s+ingen\s+treff/i.test(text) ||
      text.includes('fant ingen treff');

    const emptyPage = text.length < 500;

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

    if (exact) {
      return {
        source: 'Språkrådet',
        checked: true,
        found: true,
        quality: 'search_page_match',
        registered_entry: false,
        whole_unit_match: false,
        component_match: false,
        usage_match: false,
        urls,
        evidence_label: 'Språkrådet: search-page echo only; no independent usage evidence',
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