export type SourceName =
  | 'NAOB'
  | 'Ordbokene'
  | 'Wiktionary'
  | 'Språkrådet'
  | 'Lexin';

export type EvidenceQuality =
  | 'registered_entry'
  | 'structured_entry_match'
  | 'exact_expression_match'
  | 'normative_reference'
  | 'learner_dictionary'
  | 'search_page_match'
  | 'usage_example_match'
  | 'component_match'
  | 'not_found'
  | 'not_checked'
  | 'error';

export type SourceLookupResult = {
  source: SourceName;
  checked: boolean;
  found: boolean | null;
  quality: EvidenceQuality;
  registered_entry: boolean;
  whole_unit_match: boolean;
  component_match: boolean;
  usage_match: boolean;
  urls: string[];
  evidence_label?: string;
  note?: string;
  error?: string;
  raw_preview?: unknown;
};

const LIVE_LOOKUP_TIMEOUT_MS = 9000;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = LIVE_LOOKUP_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 NorskTrainerApp/1.0 lexical-worker',
        ...(init.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

export async function fetchJson(url: string): Promise<unknown> {
  const res = await fetchWithTimeout(url, {
    headers: { Accept: 'application/json, text/plain, */*' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export function cleanLemma(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[“”"]/g, '')
    .trim();
}

export function normalizeHtmlText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

export function normalizeForMatch(value: string): string {
  return cleanLemma(value)
    .toLowerCase()
    .replace(/^å\s+/i, '')
    .replace(/[.,!?;:()[\]{}"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getTokens(value: string): string[] {
  return normalizeForMatch(value)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function containsExactPhrase(text: string, phrase: string): boolean {
  const normalizedText = normalizeForMatch(text);
  const normalizedPhrase = normalizeForMatch(phrase);
  if (!normalizedPhrase) return false;

  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i').test(normalizedText);
}

export function includesAny(text: string, needles: string[]): boolean {
  const normalized = normalizeForMatch(text);
  return needles.some((n) => normalized.includes(normalizeForMatch(n)));
}

export function countTokenHits(text: string, tokens: string[]): number {
  const normalized = normalizeForMatch(text);
  return tokens.filter((token) => normalized.includes(normalizeForMatch(token))).length;
}

export function preview(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  return raw.slice(0, 700);
}

export function makeLookup(
  source: SourceName,
  found: boolean,
  quality: EvidenceQuality,
  registered: boolean,
  whole: boolean,
  component: boolean,
  usage: boolean,
  urls: string[],
  label: string,
  raw: unknown,
): SourceLookupResult {
  return {
    source,
    checked: true,
    found,
    quality,
    registered_entry: registered,
    whole_unit_match: whole,
    component_match: component,
    usage_match: usage,
    urls,
    evidence_label: label,
    raw_preview: preview(raw),
  };
}

export function extractOrdbokeneArticleIds(payload: unknown): string[] {
  const ids = new Set<string>();

  function walk(value: unknown): void {
    if (!value) return;

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      for (const key of ['article_id', 'articleId', 'id', 'art_id']) {
        const v = obj[key];
        if (typeof v === 'string' || typeof v === 'number') ids.add(String(v));
      }

      for (const v of Object.values(obj)) walk(v);
    }
  }

  walk(payload);
  return [...ids];
}

export function extractOrdbokeneSuggestExactTerms(payload: unknown): string[] {
  const terms = new Set<string>();

  function walk(value: unknown): void {
    if (!value) return;

    if (typeof value === 'string') {
      terms.add(value);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      for (const key of ['word', 'lemma', 'text', 'label', 'title']) {
        const v = obj[key];
        if (typeof v === 'string') terms.add(v);
      }

      for (const v of Object.values(obj)) walk(v);
    }
  }

  walk(payload);
  return [...terms].filter((t) => t.length > 0);
}

export function ordbokenePayloadHasExactMatch(payload: unknown, query: string): boolean {
  const terms = extractOrdbokeneSuggestExactTerms(payload);
  return terms.some((t) => normalizeForMatch(t) === normalizeForMatch(query));
}

export function shouldCheckOrdbokeneComponent(token: string): boolean {
  const stop = new Set([
    'og',
    'i',
    'på',
    'til',
    'for',
    'av',
    'med',
    'å',
    'en',
    'et',
    'ei',
    'det',
    'den',
    'de',
  ]);

  const normalized = normalizeForMatch(token);
  return normalized.length >= 3 && !stop.has(normalized);
}