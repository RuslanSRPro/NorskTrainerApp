import {
  containsExactPhrase,
  countTokenHits,
  delay,
  fetchJson,
  fetchText,
  getTokens,
  includesAny,
  makeLookup,
  normalizeHtmlText,
  type EvidenceQuality,
  type SourceLookupResult,
} from './shared.ts';

export async function checkNAOBLive(
  lemma: string,
  displayForm: string,
): Promise<SourceLookupResult> {
  const query = (lemma || displayForm).trim();
  const queryNoAa = query.replace(/^å\s+/i, '').trim();
  const variants = Array.from(new Set([query, queryNoAa].filter(Boolean)));

  const [htmlResult, apiResult] = await Promise.allSettled([
    checkNAOBHtml(query, variants),
    checkNAOBApi(query, variants),
  ]);

  const html = htmlResult.status === 'fulfilled' ? htmlResult.value : null;
  const api = apiResult.status === 'fulfilled' ? apiResult.value : null;

  const qualityRank: Record<EvidenceQuality, number> = {
    registered_entry: 5,
    structured_entry_match: 4,
    learner_dictionary: 4,
    exact_expression_match: 3,
    normative_reference: 2,
    usage_example_match: 2,
    search_page_match: 1,
    component_match: 1,
    not_found: -1,
    not_checked: -2,
    error: -3,
  };

  const htmlRank = html ? qualityRank[html.quality] ?? -2 : -2;
  const apiRank = api ? qualityRank[api.quality] ?? -2 : -2;

  const winner = apiRank >= htmlRank ? api : html;
  const loser = apiRank >= htmlRank ? html : api;

  if (
    !winner ||
    winner.quality === 'not_found' ||
    winner.quality === 'not_checked'
  ) {
    return {
      source: 'NAOB',
      checked: true,
      found: false,
      quality: 'not_found',
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: false,
      urls: [...(html?.urls ?? []), ...(api?.urls ?? [])],
      evidence_label: 'NAOB: both HTML and API lookup completed; no match found',
      raw_preview: {
        html_result: html?.evidence_label,
        api_result: api?.evidence_label,
      },
    };
  }

  return {
    ...winner,
    evidence_label: `NAOB (${apiRank >= htmlRank ? 'API' : 'HTML'} primary): ${
      winner.evidence_label
    }${loser ? ` | crosscheck: ${loser.evidence_label}` : ''}`,
    urls: [...new Set([...(winner.urls ?? []), ...(loser?.urls ?? [])])],
  };
}

async function checkNAOBHtml(
  query: string,
  variants: string[],
): Promise<SourceLookupResult> {
  const urls: string[] = [];
  const errors: string[] = [];
  const responses: Array<{ url: string; text: string }> = [];

  for (const variant of variants) {
    const encoded = encodeURIComponent(variant);
    const quoted = encodeURIComponent(`"${variant}"`);

    const candidateUrls = [
      `https://naob.no/ordbok/${encoded}`,
      `https://naob.no/s%C3%B8k?q=${encoded}`,
      `https://naob.no/s%C3%B8k?q=${quoted}`,
    ];

    for (const url of candidateUrls) {
      urls.push(url);

      try {
        const text = normalizeHtmlText(await fetchText(url));
        if (text) responses.push({ url, text });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${url}: ${msg}`);

        if (msg.includes('HTTP 429') || msg.includes('HTTP 503')) {
          await delay(500);
        }
      }

      await delay(100);
    }
  }

  if (!responses.length) {
    return {
      source: 'NAOB',
      checked: false,
      found: null,
      quality: 'not_checked',
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: false,
      urls,
      evidence_label: 'NAOB HTML unavailable',
      error: errors.slice(0, 4).join(' | '),
    };
  }

  const tokens = getTokens(query);

  for (const { url, text } of responses) {
    const exact = containsExactPhrase(text, query);
    const entryMarkers = includesAny(text, [
      'betydning og bruk',
      'innholdsfortegnelse',
      'full bokmålsnorm',
      'etymologi',
      'uttale',
      'bøyning',
      'ordbok',
    ]);

    if (url.includes('/ordbok/') && exact && entryMarkers) {
      return makeLookup(
        'NAOB',
        true,
        'registered_entry',
        true,
        true,
        false,
        includesAny(text, ['eksempel', 'sitat', 'sitater']),
        [url],
        'NAOB HTML: registered entry page exact match',
        text,
      );
    }
  }

  for (const { url, text } of responses) {
    if (!containsExactPhrase(text, query)) continue;

    const zeroTreff =
      text.includes('0 treff i artikler') ||
      text.includes('finnes ikke som oppslagsord') ||
      text.includes('0 treff');

    if (zeroTreff) continue;

    const isEntryUrl = url.includes('/ordbok/');

    const strongEntryIndicators = includesAny(text, [
      'substantiv',
      'verb',
      'adjektiv',
      'adverb',
      'preposisjon',
      'pronomen',
      'konjunksjon',
      'interjeksjon',
      'genus',
      'bøyning',
      'etymologi',
      'uttale',
      'betydning og bruk',
      'innholdsfortegnelse',
      'full bokmålsnorm',
    ]);

    if (isEntryUrl && strongEntryIndicators) {
      return makeLookup(
        'NAOB',
        true,
        'registered_entry',
        true,
        true,
        false,
        includesAny(text, ['eksempel', 'sitat', 'sitater']),
        [url],
        'NAOB HTML: inferred registered entry from dictionary structure',
        text,
      );
    }

    return makeLookup(
      'NAOB',
      true,
      'search_page_match',
      false,
      false,
      false,
      false,
      [url],
      'NAOB HTML: exact phrase on search page; not registered entry',
      text,
    );
  }

  let bestComponent: { url: string; text: string; hits: number } | null = null;

  for (const { url, text } of responses) {
    const hits = countTokenHits(text, tokens);
    if (!bestComponent || hits > bestComponent.hits) {
      bestComponent = { url, text, hits };
    }
  }

  if (tokens.length > 1 && bestComponent && bestComponent.hits > 0) {
    return makeLookup(
      'NAOB',
      true,
      'component_match',
      false,
      false,
      true,
      false,
      [bestComponent.url],
      `NAOB HTML: component evidence ${bestComponent.hits}/${tokens.length}`,
      bestComponent.text,
    );
  }

  return makeLookup(
    'NAOB',
    false,
    'not_found',
    false,
    false,
    false,
    false,
    urls,
    'NAOB HTML: no match found',
    '',
  );
}

async function checkNAOBApi(
  query: string,
  variants: string[],
): Promise<SourceLookupResult> {
  const urls: string[] = [];
  const errors: string[] = [];

  for (const variant of variants) {
    const encoded = encodeURIComponent(variant);
    const lemmaUrl = `https://naob.no/api/lemma/${encoded}`;
    const searchUrl = `https://naob.no/api/search?q=${encoded}&limit=10`;

    urls.push(lemmaUrl, searchUrl);

    try {
      const data = await fetchJson(lemmaUrl);
      const json = JSON.stringify(data);

      if (containsExactPhrase(json, variant)) {
        const isMultiword = getTokens(variant).length > 1;

        return makeLookup(
          'NAOB',
          true,
          isMultiword ? 'exact_expression_match' : 'registered_entry',
          !isMultiword,
          true,
          false,
          false,
          [lemmaUrl],
          isMultiword
            ? 'NAOB API: lemma endpoint exact multiword signal; not registered entry'
            : 'NAOB API: direct lemma endpoint registered entry',
          json.slice(0, 700),
        );
      }
    } catch (e) {
      errors.push(`lemma: ${e instanceof Error ? e.message : String(e)}`);
    }

    await delay(100);

    try {
      const data = await fetchJson(searchUrl);
      const json = JSON.stringify(data);

      if (containsExactPhrase(json, variant)) {
        return makeLookup(
          'NAOB',
          true,
          'search_page_match',
          false,
          false,
          false,
          false,
          [searchUrl],
          'NAOB API: search endpoint exact match; not registered entry',
          json.slice(0, 700),
        );
      }

      const tokens = getTokens(variant);
      const hits = countTokenHits(json, tokens);

      if (tokens.length > 1 && hits > 0) {
        return makeLookup(
          'NAOB',
          true,
          'component_match',
          false,
          false,
          true,
          false,
          [searchUrl],
          `NAOB API: component evidence ${hits}/${tokens.length}`,
          json.slice(0, 700),
        );
      }
    } catch (e) {
      errors.push(`search: ${e instanceof Error ? e.message : String(e)}`);
    }

    await delay(100);
  }

  return makeLookup(
    'NAOB',
    false,
    'not_found',
    false,
    false,
    false,
    false,
    urls,
    `NAOB API: no match. Errors: ${errors.slice(0, 3).join(', ')}`,
    '',
  );
}