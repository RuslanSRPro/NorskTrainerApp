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
import { basePos, posScope, type PosScope, type PosScopedLookup } from './pos-scope.ts';

// D10 15.10.2026 (agreed, step B): only the Bokmål section counts.
//   no.wiktionary: language section "Norsk" / "Bokmål" (not "Nynorsk");
//   en.wiktionary: "Norwegian Bokmål" / "Norwegian" (not "Norwegian Nynorsk").
// Inside it, a "Nynorsk" sub-heading is skipped. The part-of-speech headings
// of the Bokmål section give pos_scope.
const BOKMAL_SECTIONS_NO = new Set(['norsk', 'bokmål', 'norsk bokmål', 'norsk (bokmål)']);
const BOKMAL_SECTIONS_EN = new Set(['norwegian bokmål', 'norwegian']);

export type WikiHeading = { level: number; text: string };

function decodeHeading(value: string): string {
  return value
    .replace(/<span[^>]*class="[^"]*mw-editsection[^"]*"[\s\S]*?<\/span>\s*<\/span>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&aring;/g, 'å').replace(/&oslash;/g, 'ø').replace(/&aelig;/g, 'æ')
    .replace(/&amp;/g, '&')
    .replace(/\[\s*(rediger|rediger kilde|edit|endre)[^\]]*\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

export function wikiHeadings(html: string): WikiHeading[] {
  const out: WikiHeading[] = [];
  for (const m of html.matchAll(/<h([2-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = decodeHeading(m[2]);
    if (text) out.push({ level: Number(m[1]), text });
  }
  return out;
}

// Bokmål section present? Which POS headings does it have?
export function bokmalSection(html: string, isNoDomain: boolean):
  { headingsFound: boolean; hasBokmal: boolean; hasNynorskOnly: boolean; pos: string[] } {
  const headings = wikiHeadings(html);
  const languages = isNoDomain ? BOKMAL_SECTIONS_NO : BOKMAL_SECTIONS_EN;
  const pos = new Set<string>();
  let hasBokmal = false;
  let hasNynorsk = false;
  let inBokmal = false;
  let skipBelow: number | null = null; // inside a "Nynorsk" sub-heading
  for (const h of headings) {
    if (h.level === 2) {
      inBokmal = languages.has(h.text);
      if (inBokmal) hasBokmal = true;
      if (/nynorsk/.test(h.text)) hasNynorsk = true;
      skipBelow = null;
      continue;
    }
    if (!inBokmal) continue;
    if (skipBelow !== null && h.level <= skipBelow) skipBelow = null;
    if (/^nynorsk$/.test(h.text)) { skipBelow = h.level; continue; }
    if (skipBelow !== null) continue;
    const p = basePos(h.text.replace(/\s*\d+$/, ''));
    if (p) pos.add(p);
  }
  return { headingsFound: headings.some((h) => h.level === 2), hasBokmal,
    hasNynorskOnly: hasNynorsk && !hasBokmal, pos: [...pos] };
}

export async function checkWiktionaryLive(
  lemma: string,
  displayForm: string,
  // D10 15.10.2026 (step B): card part of speech; optional, additive.
  pos?: string | null,
): Promise<PosScopedLookup> {
  const query = lemma || displayForm;
  const slug = encodeURIComponent(query.replace(/\s+/g, '_'));

  const noUrl = `https://no.wiktionary.org/wiki/${slug}`;
  const enUrl = `https://en.wiktionary.org/wiki/${slug}`;

  const [noResult, enResult] = await Promise.allSettled([
    checkWiktionaryDomain(query, noUrl, ['norsk', 'bokmål', 'nynorsk'], true, pos),
    checkWiktionaryDomain(
      query,
      enUrl,
      ['norwegian bokmål', 'norwegian nynorsk', 'bokmål', 'nynorsk'],
      false,
      pos,
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

  // D10 (step B): with a card POS, a domain that shows that POS ranks first.
  const posBonus = (r: PosScopedLookup | null) => (r && r.pos_scope?.pos_match === 'match' ? 10 : 0);
  const noRank = no ? (qualityRank[no.quality] ?? -2) + (no.quality === 'not_found' ? 0 : posBonus(no)) : -2;
  const enRank = en ? (qualityRank[en.quality] ?? -2) + (en.quality === 'not_found' ? 0 : posBonus(en)) : -2;

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

  // POS seen in either domain's Bokmål section.
  const allPos = [...(no?.pos_scope?.found_pos ?? []), ...(en?.pos_scope?.found_pos ?? [])];
  const pos_scope: PosScope = posScope(pos, allPos, allPos.length ? 'wiktionary_bokmal_section' : null);

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
    pos_scope,
  };
}

function withScope(result: SourceLookupResult, scope: PosScope, note: string | null = null): PosScopedLookup {
  return { ...result, ...(note ? { note } : {}), pos_scope: scope };
}

async function checkWiktionaryDomain(
  query: string,
  url: string,
  norwegianMarkers: string[],
  isNoDomain: boolean,
  pos?: string | null,
): Promise<PosScopedLookup> {
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

  // D10 (step B): Bokmål section only, from the page headings. A page whose
  // headings cannot be read keeps the old rule (and an unknown POS).
  const section = bokmalSection(html, isNoDomain);
  const legacyNorwegianSection = isNoDomain
    ? norwegianScoped
    : hasStrictNorwegianHeading;
  const hasNorwegianSection = section.headingsFound
    ? section.hasBokmal
    : legacyNorwegianSection;
  const scope = posScope(pos, section.hasBokmal ? section.pos : [],
    section.hasBokmal ? `wiktionary_${isNoDomain ? 'no' : 'en'}_bokmal_section` : null);

  const strongNorwegianEntry =
    exact && hasNorwegianSection && entryMarkers && !isMultiword;

  if (strongNorwegianEntry) {
    return withScope(makeLookup(
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
    ), scope);
  }

  if (exact && hasNorwegianSection && isMultiword) {
    return withScope(makeLookup(
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
    ), scope);
  }

  if (exact && hasNorwegianSection) {
    return withScope(makeLookup(
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
    ), scope);
  }

  if (isMultiword && tokenHits > 0 && hasNorwegianSection) {
    return withScope(makeLookup(
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
    ), scope);
  }

  return withScope(makeLookup(
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
  ), scope, section.hasNynorskOnly ? 'nynorsk_only: no Bokmål section' : null);
}