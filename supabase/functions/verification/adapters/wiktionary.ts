import {
  containsExactPhrase,
  countTokenHits,
  fetchText,
  getTokens,
  includesAny,
  makeLookup,
  normalizeHtmlText,
  type EvidenceQuality,
  type SourceLookupResult,
} from './shared.ts';

export async function checkWiktionaryLive(
  lemma: string,
  displayForm: string,
): Promise<SourceLookupResult> {
  const query = lemma || displayForm;
  const slug = encodeURIComponent(query.replace(/\s+/g, '_'));

  const noUrl = `https://no.wiktionary.org/wiki/${slug}`;
  const enUrl = `https://en.wiktionary.org/wiki/${slug}`;

  const [noResult, enResult] = await Promise.allSettled([
    checkWiktionaryDomain(query, noUrl, ['norsk', 'bokmål', 'nynorsk'], true),
    checkWiktionaryDomain(
      query,
      enUrl,
      ['norwegian bokmål', 'norwegian nynorsk', 'bokmål', 'nynorsk'],
      false,
    ),
  ]);

  const no = noResult.status === 'fulfilled' ? noResult.value : null;
  const en = enResult.status === 'fulfilled' ? enResult.value : null;

  const qualityRank: Partial<Record<EvidenceQuality, number>> = {
    registered_entry: 4,
    exact_expression_match: 3,
    component_match: 1,
    search_page_match: 0,
    not_found: -1,
    not_checked: -2,
    error: -3,
  };

  const noRank = no ? qualityRank[no.quality] ?? -2 : -2;
  const enRank = en ? qualityRank[en.quality] ?? -2 : -2;

  const winner = noRank >= enRank ? no : en;
  const loser = noRank >= enRank ? en : no;

  if (
    !winner ||
    winner.quality === 'not_found' ||
    winner.quality === 'not_checked'
  ) {
    return makeLookup(
      'Wiktionary',
      false,
      'not_found',
      false,
      false,
      false,
      false,
      [...(no?.urls ?? []), ...(en?.urls ?? [])],
      'Wiktionary: both no. and en. checked; no Norwegian match found',
      '',
    );
  }

  return {
    ...winner,
    source: 'Wiktionary',
    evidence_label: `Wiktionary (${noRank >= enRank ? 'no.' : 'en.'} domain): ${
      winner.evidence_label
    }${
      loser && loser.quality !== 'not_found'
        ? ` | crosscheck: ${loser.evidence_label}`
        : ''
    }`,
    urls: [...new Set([...(winner.urls ?? []), ...(loser?.urls ?? [])])],
  };
}

async function checkWiktionaryDomain(
  query: string,
  url: string,
  norwegianMarkers: string[],
  isNoDomain: boolean,
): Promise<SourceLookupResult> {
  const html = await fetchText(url).catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);

    if (
      msg.includes('404') ||
      msg.includes('Not Found') ||
      msg.includes('HTTP 404')
    ) {
      return '';
    }

    throw e;
  });

  if (!html) {
    return makeLookup(
      'Wiktionary',
      false,
      'not_found',
      false,
      false,
      false,
      false,
      [url],
      `${isNoDomain ? 'no.' : 'en.'}wiktionary: page not found`,
      '',
    );
  }

  const text = normalizeHtmlText(html);

  const isSearchPage =
    text.includes('opprett siden') ||
    text.includes('ble funnet i søket') ||
    text.includes('avansert søk') ||
    text.includes('search results') ||
    text.includes('create the page') ||
    text.includes('special:søk') ||
    text.includes('special:search');

  if (isSearchPage) {
    return makeLookup(
      'Wiktionary',
      false,
      'not_found',
      false,
      false,
      false,
      false,
      [url],
      `Wiktionary ${isNoDomain ? 'no.' : 'en.'}: search page only, no registered entry`,
      text,
    );
  }

  const exact = containsExactPhrase(text, query);
  const norwegianScoped = includesAny(text, norwegianMarkers);
  const tokens = getTokens(query);
  const tokenHits = countTokenHits(text, tokens);
  const isMultiword = tokens.length > 1;

  const entryMarkers = includesAny(text, [
    'substantiv',
    'verb',
    'adjektiv',
    'adverb',
    'uttrykk',
    'bokmål',
    'nynorsk',
    'noun',
    'verb',
    'adjective',
  ]);

  const hasStrictNorwegianHeading =
    /==\s*Norwegian\s+Bokmål\s*==/i.test(html) ||
    /==\s*Norwegian\s+Nynorsk\s*==/i.test(html);

  const hasNorwegianSection = isNoDomain
    ? norwegianScoped
    : hasStrictNorwegianHeading;

  const strongNorwegianEntry =
    exact && hasNorwegianSection && entryMarkers && !isMultiword;

  if (strongNorwegianEntry) {
    return makeLookup(
      'Wiktionary',
      true,
      'registered_entry',
      true,
      true,
      false,
      false,
      [url],
      `Wiktionary ${isNoDomain ? 'no.' : 'en.'}: Norwegian single-word entry exact match`,
      text,
    );
  }

  if (exact && hasNorwegianSection && isMultiword) {
    return makeLookup(
      'Wiktionary',
      true,
      'exact_expression_match',
      false,
      false,
      false,
      true,
      [url],
      `Wiktionary ${isNoDomain ? 'no.' : 'en.'}: Norwegian multiword exact supporting signal`,
      text,
    );
  }

  if (exact && hasNorwegianSection) {
    return makeLookup(
      'Wiktionary',
      true,
      'exact_expression_match',
      false,
      false,
      false,
      true,
      [url],
      `Wiktionary ${isNoDomain ? 'no.' : 'en.'}: Norwegian scoped exact supporting signal`,
      text,
    );
  }

  if (isMultiword && tokenHits > 0 && hasNorwegianSection) {
    return makeLookup(
      'Wiktionary',
      true,
      'component_match',
      false,
      false,
      true,
      false,
      [url],
      `Wiktionary ${isNoDomain ? 'no.' : 'en.'}: Norwegian component evidence`,
      text,
    );
  }

  return makeLookup(
    'Wiktionary',
    false,
    'not_found',
    false,
    false,
    false,
    false,
    [url],
    `Wiktionary ${isNoDomain ? 'no.' : 'en.'}: no Norwegian match`,
    text,
  );
}