import {
  containsExactPhrase,
  fetchWithTimeout,
  getTokens,
  makeLookup,
  normalizeForMatch,
  preview,
  type SourceLookupResult,
} from './shared.ts';

export async function checkLexinLive(
  lemma: string,
  displayForm: string,
): Promise<SourceLookupResult> {
  const query = lemma || displayForm;
  const encoded = encodeURIComponent(query);
  const tokens = getTokens(query);
  const isSingleToken = tokens.length === 1;

  const uaUrl = `https://editorportal.oslomet.no/api/v1/findwords?searchWord=${encoded}&lang=bokm%C3%A5l-ukrainsk&page=1&selectLang=bokm%C3%A5l-ukrainsk&includeEngLang=0`;

  const noUrl = `https://editorportal.oslomet.no/api/v1/findwords?searchWord=${encoded}&lang=bokm%C3%A5l-bokm%C3%A5l&page=1&selectLang=bokm%C3%A5l-bokm%C3%A5l&includeEngLang=0`;

  const urls = [uaUrl, noUrl];
  const errors: string[] = [];

  for (const [url, label] of [
    [uaUrl, 'nob-ukr'],
    [noUrl, 'nob-nob'],
  ] as [string, string][]) {
    try {
      const text = await fetchLexinText(url);

      if (!text || text.length < 5 || text === '[]' || text === '{}') {
        continue;
      }

      let hasExactLemmaEntry = false;
      let hasExactTextMatch = false;
      let translationUa: string | null = null;

      try {
        const data = JSON.parse(text);
        const result =
          data?.result ??
          data?.results ??
          data?.data ??
          data?.words ??
          data;

        const items = Array.isArray(result) ? result : [];
        const normalizedQuery = normalizeForMatch(query);

        for (const group of items) {
          const entries = Array.isArray(group) ? group : [group];

          let groupExactLemma = false;

          for (const entry of entries) {
            if (!entry || typeof entry !== 'object') continue;

            const e = entry as Record<string, string>;
            const entryText = normalizeForMatch(e.text ?? '');

            if (e.type === 'E-lem') {
              const lemmaText = entryText;
              const lemmaClean = lemmaText.replace(/^å\s+/, '').trim();
              const queryClean = normalizedQuery.replace(/^å\s+/, '').trim();

              if (lemmaText === normalizedQuery || lemmaClean === queryClean) {
                groupExactLemma = true;
                hasExactLemmaEntry = true;
              }
            }

            if (entryText === normalizedQuery) {
              hasExactTextMatch = true;
            }

            if (groupExactLemma && (e.type === 'E-ukr' || e.type === 'ukr')) {
              translationUa = e.text ?? e.value ?? null;
            }
          }
        }
      } catch {
        hasExactTextMatch = containsExactPhrase(
          normalizeForMatch(text),
          query,
        );
      }

      if (hasExactLemmaEntry) {
        const uaNote = translationUa
          ? ` | UA: ${translationUa.slice(0, 50)}`
          : '';

        return {
          source: 'Lexin',
          checked: true,
          found: true,
          quality: 'learner_dictionary',
          registered_entry: isSingleToken,
          whole_unit_match: isSingleToken,
          component_match: false,
          usage_match: !isSingleToken,
          urls: [url],
          evidence_label: isSingleToken
            ? `Lexin OsloMet (${label}): exact lemma entry found${uaNote}`
            : `Lexin OsloMet (${label}): exact multiword learner signal found${uaNote}`,
          raw_preview: preview(text.slice(0, 500)),
        };
      }

      if (hasExactTextMatch) {
        return {
          source: 'Lexin',
          checked: true,
          found: true,
          quality: 'learner_dictionary',
          registered_entry: false,
          whole_unit_match: false,
          component_match: false,
          usage_match: true,
          urls: [url],
          evidence_label: `Lexin OsloMet (${label}): exact text learner/usage signal found`,
          raw_preview: preview(text.slice(0, 500)),
        };
      }
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (
    errors.length > 0 &&
    errors.every((e) => e.includes('HTTP') || e.includes('abort'))
  ) {
    return {
      source: 'Lexin',
      checked: true,
      found: null,
      quality: 'error',
      registered_entry: false,
      whole_unit_match: false,
      component_match: false,
      usage_match: false,
      urls,
      evidence_label: 'Lexin unavailable',
      error: errors.slice(0, 3).join(' | '),
    };
  }

  return makeLookup(
    'Lexin',
    false,
    'not_found',
    false,
    false,
    false,
    false,
    urls,
    'Lexin: no match found',
    '',
  );
}

async function fetchLexinText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      Origin: 'https://lexin.oslomet.no',
      Referer: 'https://lexin.oslomet.no/',
      'Cache-Control': 'no-cache',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Lexin HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  return await res.text();
}