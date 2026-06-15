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
  normalizeForMatch,
  type AuthoritativeRelationCandidate,
  type EvidenceQuality,
  type SourceLookupResult,
} from './shared.ts';

function extractNAOBRelationCandidates(
  text: string,
  query: string,
  url: string,
): AuthoritativeRelationCandidate[] {
  const candidates: AuthoritativeRelationCandidate[] = [];
  const normalizedQuery = normalizeForMatch(query);

  const patterns: Array<{
    pattern: RegExp;
    relation_type: AuthoritativeRelationCandidate['relation_type'];
    label: string;
  }> = [
    {
      pattern:
        /(?:beslektet med|beslektet)\s+([a-zæøåA-ZÆØÅ][a-zæøåA-ZÆØÅ\s-]{2,50})/gi,
      relation_type: 'derived_candidate',
      label: 'NAOB related/derived reference',
    },
    {
      pattern:
        /(?:avledet av)\s+([a-zæøåA-ZÆØÅ][a-zæøåA-ZÆØÅ\s-]{2,50})/gi,
      relation_type: 'derived_candidate',
      label: 'NAOB derived reference',
    },
    {
      pattern:
        /(?:sammensetning av)\s+([a-zæøåA-ZÆØÅ][a-zæøåA-ZÆØÅ\s-]{2,50})/gi,
      relation_type: 'compound_component_candidate',
      label: 'NAOB compound component reference',
    },
  ];

  for (const { pattern, relation_type, label } of patterns) {
    for (const match of text.matchAll(pattern)) {
      const rawTarget = match[1] ?? '';

      const target = normalizeForMatch(rawTarget)
        .replace(/\b(?:og|eller|med|til|i|på|for|av)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!target) continue;
      if (target === normalizedQuery) continue;
      if (target.length < 3) continue;
      if (target.length > 80) continue;
      if (target.split(' ').length > 8) continue;

      candidates.push({
        relation_type,
        target_text: target,
        source: 'NAOB',
        confidence: 'medium',
        evidence_label: label,
        url,
      });
    }
  }

  const queryTokens = getTokens(query);

  if (queryTokens.length > 1) {
    const parentheticalPattern =
      /([a-zæøåA-ZÆØÅ][a-zæøåA-ZÆØÅ\s-]{2,50})\s+\(([^)]+)\)/gi;

    for (const match of text.matchAll(parentheticalPattern)) {
      const base = normalizeForMatch(match[1] ?? '');
      const particle = normalizeForMatch(match[2] ?? '');

      if (!base || !particle) continue;

      const combined = normalizeForMatch(`${base} ${particle}`);

      if (combined !== normalizedQuery) continue;
      if (base === normalizedQuery) continue;
      if (base.length < 3) continue;
      if (base.length > 80) continue;
      if (base.split(' ').length > 6) continue;

      candidates.push({
        relation_type: 'related_candidate',
        target_text: base,
        source: 'NAOB',
        confidence: 'medium',
        evidence_label: 'NAOB expression parenthetical variant',
        url,
      });
    }
  }

  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = `${candidate.relation_type}:${candidate.target_text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeRelations(
  ...groups: Array<AuthoritativeRelationCandidate[] | undefined>
): AuthoritativeRelationCandidate[] {
  const merged: AuthoritativeRelationCandidate[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const candidate of group ?? []) {
      const key = `${candidate.source}:${candidate.relation_type}:${candidate.target_text}`;
      if (seen.has(key)) continue;

      seen.add(key);
      merged.push(candidate);
    }
  }

  return merged;
}

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
      evidence_label:
        'NAOB: both HTML and API lookup completed; no match found',
      raw_preview: {
        html_result: html?.evidence_label,
        api_result: api?.evidence_label,
      },
      authoritative_relations: mergeRelations(
        html?.authoritative_relations,
        api?.authoritative_relations,
      ),
    };
  }

  return {
    ...winner,
    evidence_label: `NAOB (${apiRank >= htmlRank ? 'API' : 'HTML'} primary): ${
      winner.evidence_label
    }${loser ? ` | crosscheck: ${loser.evidence_label}` : ''}`,
    urls: [...new Set([...(winner.urls ?? []), ...(loser?.urls ?? [])])],
    authoritative_relations: mergeRelations(
      winner.authoritative_relations,
      loser?.authoritative_relations,
    ),
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
      authoritative_relations: [],
    };
  }

  const tokens = getTokens(query);
  const isMultiword = tokens.length > 1;

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

    const relations = extractNAOBRelationCandidates(text, query, url);

    if (url.includes('/ordbok/') && exact && entryMarkers) {
      return makeLookup(
        'NAOB',
        true,
        isMultiword ? 'exact_expression_match' : 'registered_entry',
        !isMultiword,
        true,
        false,
        includesAny(text, ['eksempel', 'sitat', 'sitater']),
        [url],
        isMultiword
          ? 'NAOB HTML: exact multiword signal on dictionary page; not registered entry'
          : 'NAOB HTML: registered entry page exact match',
        text,
        relations,
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

    const relations = extractNAOBRelationCandidates(text, query, url);

    if (isEntryUrl && strongEntryIndicators) {
      return makeLookup(
        'NAOB',
        true,
        isMultiword ? 'exact_expression_match' : 'registered_entry',
        !isMultiword,
        true,
        false,
        includesAny(text, ['eksempel', 'sitat', 'sitater']),
        [url],
        isMultiword
          ? 'NAOB HTML: inferred multiword dictionary-page signal; not registered entry'
          : 'NAOB HTML: inferred registered entry from dictionary structure',
        text,
        relations,
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
      relations,
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
    const relations = extractNAOBRelationCandidates(
      bestComponent.text,
      query,
      bestComponent.url,
    );

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
      relations,
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
    [],
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
          [],
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
          [],
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
          [],
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
    [],
  );
}