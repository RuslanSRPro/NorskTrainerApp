// D10 07.11.2026 (agreed, D10_lexin_ru_fallback_v1, variant A):
// Lexin "bokmål-russisk" for words the Ukrainian Lexin does not have.
//   * One request gives English (B-*) AND Russian (Ru-*): the English of the
//     Lexin English dictionary is the same B-* data that the Ukrainian request
//     already brings (includeEngLang=1), so no separate English request.
//   * lexin-enrichment-worker: when the Ukrainian Lexin found NO entry of this
//     headword (and part of speech), the English B-lem / B-idi of the Russian
//     response is written as an ordinary Lexin translation (en). A dictionary
//     en translation removes "≈" for en, and AI no longer translates en.
//   * ai-enrichment-worker: for "≈" translations (no Ordbøkene article / article
//     without explanation) the Russian (and English) of this headword is given
//     to AI as a hint ("Lexin_ru" source). "≈" stays.
// Only entries whose headword (E-lem / N-lem) equals the lemma and whose part of
// speech equals the card's are used (Lexin also returns entries that only
// mention the word: postnummer, adressere for "adresse"). Pure functions.

import { cleanTranslationSenseGroups, cleanTranslationText } from './lexin-translation-text.ts';
import { lexinEntryFitsCard, parseLexinMorphology } from './d10-lexin-homograph-forms.ts';

export const LEXIN_UK_LANG = 'bokmål-ukrainsk';
export const LEXIN_RU_LANG = 'bokmål-russisk';
export const LEXIN_RU_HINT_VERSION = 'd10_lexin_ru_hint_v1';

export type LexinNode = { id: number; sub_id?: number | null; type: string; text: string; index?: number | null };

export function lexinUrl(base: string, query: string, lang: string, includeEng: boolean): string {
  const l = encodeURIComponent(lang);
  return `${base}?searchWord=${encodeURIComponent(query)}&lang=${l}&page=1&selectLang=${l}` +
    (includeEng ? '&includeEngLang=1' : '');
}

// Flat node list of a Lexin response (result = one section with all nodes).
export function lexinNodes(data: any): LexinNode[] {
  const result = data?.result ?? data?.results ?? data?.data ?? data?.words ?? data;
  const sections: unknown[] = Array.isArray(result) ? result : [];
  return sections.flatMap((section) => (Array.isArray(section) ? section : [])) as LexinNode[];
}

function key(value: unknown): string {
  return String(value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}
function sameHeadword(text: unknown, lemma: string): boolean {
  const t = key(text);
  const l = key(lemma);
  return t === l || t.replace(/^å\s+/, '') === l.replace(/^å\s+/, '');
}

const POS: Record<string, string> = {
  verb: 'verb', substantiv: 'noun', noun: 'noun', adjektiv: 'adjective', adjective: 'adjective', adj: 'adjective',
  adverb: 'adverb', adv: 'adverb', preposisjon: 'preposition', preposition: 'preposition',
  pronomen: 'pronoun', pronoun: 'pronoun', konjunksjon: 'conjunction', conjunction: 'conjunction',
  subjunksjon: 'subjunction', subjunction: 'subjunction', interjeksjon: 'interjection', interjection: 'interjection',
  determinativ: 'determiner', determiner: 'determiner', artikkel: 'article', article: 'article',
  tallord: 'numeral', numeral: 'numeral',
};
export function lexinPos(value: unknown): string | null {
  const v = key(value).replace(/[.:;,]+$/g, '');
  if (!v) return null;
  if (POS[v]) return POS[v];
  for (const token of v.split(/[^\p{L}]+/u)) if (POS[token]) return POS[token];
  return null;
}

// Card POS for Lexin: an expression / unknown card has no POS filter.
export function cardPosForLexin(pos: string | null | undefined): string | null {
  return pos && !['expression', 'unknown', ''].includes(pos) ? pos : null;
}

function byId(nodes: LexinNode[]): Map<number, LexinNode[]> {
  const map = new Map<number, LexinNode[]>();
  for (const n of nodes) {
    if (n?.id == null) continue;
    const list = map.get(n.id) ?? [];
    list.push(n);
    map.set(n.id, list);
  }
  return map;
}
const of = (bucket: LexinNode[], ...types: string[]) => bucket.filter((n) => types.includes(n.type));
const filled = (n: LexinNode) => typeof n?.text === 'string' && n.text.trim().length > 0;

export type EntryFilter = { cardForms?: Set<string> | null; allowUnknownPos?: boolean };

// Entries whose headword is the lemma and whose part of speech is the card's.
export function headwordEntries(nodes: LexinNode[], lemma: string, pos: string | null,
  filter: EntryFilter = {}): Array<{ id: number; bucket: LexinNode[] }> {
  const out: Array<{ id: number; bucket: LexinNode[] }> = [];
  for (const [id, bucket] of byId(nodes)) {
    if (!of(bucket, 'E-lem', 'N-lem').some((n) => sameHeadword(n.text, lemma))) continue;
    const entryPos = lexinPos(of(bucket, 'E-kat', 'N-kat', 'B-kat').find(filled)?.text);
    if (pos && !entryPos && !filter.allowUnknownPos) continue;
    if (pos && entryPos && entryPos !== pos) continue;
    if (filter.cardForms) {
      const forms = parseLexinMorphology(of(bucket, 'E-mor').map((n) => String(n.text ?? '')).join(' '));
      if (!lexinEntryFitsCard(forms, filter.cardForms)) continue;
    }
    out.push({ id, bucket });
  }
  return out;
}

function idiomText(text: string): string {
  const paren = text.indexOf('(');
  return (paren === -1 ? text : text.slice(0, paren)).trim();
}

// Expressions found inside an entry (E-idi = lemma) with the paired B-idi / Ru-idi.
export function idiomMatches(nodes: LexinNode[], lemma: string):
  Array<{ id: number; idi: LexinNode; en: LexinNode | null; ru: LexinNode | null }> {
  const out: Array<{ id: number; idi: LexinNode; en: LexinNode | null; ru: LexinNode | null }> = [];
  for (const [id, bucket] of byId(nodes)) {
    const eIdi = of(bucket, 'E-idi');
    const bIdi = of(bucket, 'B-idi');
    const ruIdi = of(bucket, 'Ru-idi');
    eIdi.forEach((idi, i) => {
      if (!filled(idi) || key(idiomText(idi.text)) !== key(lemma)) return;
      const pair = (list: LexinNode[]) => list.find((n) => n.index != null && n.index === idi.index) ?? list[i] ?? null;
      out.push({ id, idi, en: pair(bIdi), ru: pair(ruIdi) });
    });
  }
  return out;
}

export type EnglishFallbackRow = {
  translation: string; sense_rank: number; source_entry_id: number; source_sub_id: number | null;
  surface_form: string; via: 'lem' | 'idi';
};

// English translations (B-lem of headword entries, B-idi of matching expressions).
export function englishFallback(nodes: LexinNode[], lemma: string, pos: string | null,
  filter: EntryFilter = {}): EnglishFallbackRow[] {
  const rows: EnglishFallbackRow[] = [];
  for (const { id, bucket } of headwordEntries(nodes, lemma, pos, filter)) {
    for (const b of of(bucket, 'B-lem').filter(filled)) {
      cleanTranslationSenseGroups(b.text).forEach((group, senseIndex) => {
        for (const variant of group) {
          rows.push({ translation: variant, sense_rank: senseIndex + 1, source_entry_id: b.id ?? id,
            source_sub_id: b.sub_id ?? null, surface_form: b.text.trim(), via: 'lem' });
        }
      });
    }
  }
  for (const m of idiomMatches(nodes, lemma)) {
    if (!m.en || !filled(m.en)) continue;
    const value = cleanTranslationText(idiomText(m.en.text));
    if (value) rows.push({ translation: value, sense_rank: 1, source_entry_id: m.en.id ?? m.id,
      source_sub_id: m.en.sub_id ?? null, surface_form: m.en.text.trim(), via: 'idi' });
  }
  return rows;
}

// Hint text for AI: Russian and English of the headword entries / expressions.
export function russianHint(nodes: LexinNode[], lemma: string, pos: string | null,
  filter: EntryFilter = {}): string | null {
  const parts: string[] = [];
  for (const { bucket } of headwordEntries(nodes, lemma, pos, filter)) {
    const pick = (type: string) => of(bucket, type).filter(filled).map((n) => n.text.trim()).join('; ');
    const fields = [
      ['ru', pick('Ru-lem')], ['en', pick('B-lem')], ['no_def', pick('E-def')], ['ru_def', pick('Ru-def')],
    ].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    if (fields.some((f) => f.startsWith('ru: ') || f.startsWith('en: '))) parts.push(fields.join('; '));
  }
  for (const m of idiomMatches(nodes, lemma)) {
    const fields = [['ru', m.ru?.text], ['en', m.en?.text]]
      .filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => `${k}: ${String(v).trim()}`);
    if (fields.length) parts.push(`${idiomText(m.idi.text)} — ${fields.join('; ')}`);
  }
  if (!parts.length) return null;
  const label = pos ?? 'expression';
  return `Lexin ${LEXIN_RU_LANG} (${lemma}, ${label}): ${parts.join(' | ')}`.slice(0, 1500);
}
