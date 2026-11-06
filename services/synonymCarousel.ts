// Read-only synonym views: one item per pair of meanings; actions keep the canonical card ID.
import { synonymClass, SYNONYM_COLORS, SYNONYM_TEXT, type SynonymClass } from './synonymPresentation';
import { supabase } from '@/services/supabase';
import type { Lexeme360CarouselItem } from '@/components/Lexeme360Carousel';

export type SynonymCarouselItem = Lexeme360CarouselItem & {
  displayClass?: SynonymClass;
  decision?: 'verified_synonym' | 'contextual_synonym' | string;
  // D10 30.10.2026 (point 5): the sense of the opened word this synonym belongs to
  senseKey?: string | null;
  senseNo?: number;
  // D10 30.10.2026 (after review): every sense of the opened word this synonym belongs to
  senseKeys?: string[];
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

export type SynonymSense = {
  key: string; no: number; text: string; uk: string; en: string;
  // Original dictionary path is metadata; the UI uses unique sequential numbers.
  label: string;
};
// word: the general translation of the opened word itself (shown above its senses)
export type SynonymSenseCarousel = { items: SynonymCarouselItem[]; senses: SynonymSense[]; word?: { uk: string; en: string } };

export function senseLabel(sense: Pick<SynonymSense, 'no'>): string {
  return String(sense.no);
}

type Lang = 'ua' | 'en' | 'no' | string;

// D10_synonym_nuance_v1 (05.11.2026, agreed): label of a contextual synonym -
// style = the same meaning, another style; meaning = a close meaning. Plus the style of the synonym itself,
// when it differs from the opened word (e.g. "close meaning · colloquial").
const NUANCE_TEXT: Record<'ua' | 'en' | 'no', { style: string; meaning: string; reg: Record<string, string> }> = {
  ua: { style: 'Той самий зміст, інший стиль', meaning: 'Близьке значення',
    reg: { neutral: 'нейтральне', colloquial: 'розмовне', formal: 'офіційне', literary_or_archaic: 'книжне, застаріле',
      regional: 'діалектне', technical: 'фахове' } },
  en: { style: 'Same meaning, different style', meaning: 'Close meaning',
    reg: { neutral: 'neutral', colloquial: 'colloquial', formal: 'formal', literary_or_archaic: 'literary, old-fashioned',
      regional: 'dialect', technical: 'technical' } },
  no: { style: 'Samme betydning, annen stil', meaning: 'Nær betydning',
    reg: { neutral: 'nøytralt', colloquial: 'muntlig', formal: 'formelt', literary_or_archaic: 'litterært, gammeldags',
      regional: 'dialekt', technical: 'fagord' } },
};

// one label for all contextual checks of a card in one sense: meaning if any check says meaning, style only if all
// labelled checks say style; no label while a check has none yet (the hint stays the general one)
function nuanceLabel(rows: any[], lang: 'ua' | 'en' | 'no'): string | null {
  const ctx = rows.filter((r) => text(r.decision) === 'contextual_synonym');
  if (!ctx.length || ctx.some((r) => !text(r.nuance_kind))) return null;
  const t = NUANCE_TEXT[lang];
  const kind = ctx.some((r) => text(r.nuance_kind) === 'meaning') ? 'meaning' : 'style';
  const styles = [...new Set(ctx.map((r) => text(r.nuance_style)).filter(Boolean))];
  const reg = styles.length === 1 ? t.reg[styles[0]] ?? '' : '';
  return reg ? `${t[kind]} · ${reg}` : t[kind];
}


export async function fetchSynonymSenseCarousel(
  lexemeId?: string | null,
  lemma?: string | null,
  lang: Lang = 'ua',
  // D10 05.11.2026: contextual synonyms only when the setting is on; one-way never
  options: { includeContextual?: boolean } = {},
): Promise<SynonymSenseCarousel> {
  const id = text(lexemeId);
  if (!id) return { items: [], senses: [] };

  // D10 30.10.2026 (agreed): translation of the opened word for the window header
  const wordPromise = supabase.rpc('get_canonical_lexeme_translations_v1', { p_lexeme_ids: [id] });
  // D10_synonym_nuance_v1: v4 = v3 + label; v3 when the database part is not installed yet
  let { data, error } = await supabase.rpc('get_synonym_carousel_v4', { p_lexeme_id: id });
  if (error) {
    // D10_synonym_nuance_chip_v1: the fallback is visible in the Metro log (labels are missing then)
    console.warn('[synonyms] carousel v4 failed, using v3 (no labels):', error.message);
    ({ data, error } = await supabase.rpc('get_synonym_carousel_v3', { p_lexeme_id: id }));
  }
  const word = { uk: '', en: '' };
  try {
    const w = await wordPromise;
    for (const row of (w.data ?? []) as any[]) {
      if (row.language_code === 'uk' && !word.uk) word.uk = text(row.translation);
      if (row.language_code === 'en' && !word.en) word.en = text(row.translation);
    }
  } catch {
    // header without translation
  }
  if (error) {
    throw new Error(`Synonym meanings could not be loaded: ${error.message}`);
  }
  // Filter before building groups so no empty contextual-only groups are shown.
  const includeContextual = options.includeContextual === true;
  // D10 05.11.2026 (agreed): a sense of the opened word = article + sense number (as in the dictionary and in the
  // v12 check), not every definition line. One card per synonym and sense; it is clean only when EVERY check of it
  // in this sense (both directions) is clean, otherwise contextual; any one-way check -> one-way (never shown).
  const all = (data ?? []) as any[];
  const groupKey = (row: any) => {
    const key = text(row.my_sense_key);
    const path = text(row.my_sense_path);
    const article = key.includes(':') ? key.slice(0, key.indexOf(':')) : '';
    return article && path ? `${article}:${path}` : key;
  };
  type Merged = { cardId: string; group: string; rows: any[]; kind: SynonymClass };
  const merged = new Map<string, Merged>();
  for (const row of all) {
    const cardId = text(row.card_id);
    const group = groupKey(row);
    if (!cardId || !text(row.lemma) || !group) continue;
    const k = `${cardId}|${group}`;
    if (!merged.has(k)) merged.set(k, { cardId, group, rows: [], kind: 'strict' });
    merged.get(k)!.rows.push(row);
  }
  for (const m of merged.values()) {
    const kinds = m.rows.map((row) => synonymClass(row));
    m.kind = kinds.includes('one_way') ? 'one_way' : kinds.every((k) => k === 'strict') ? 'strict' : 'contextual';
  }
  // Filter after merging, so a contextual check is never hidden behind a clean one.
  const visible = [...merged.values()].filter((m) => m.kind === 'strict' || (includeContextual && m.kind === 'contextual'));

  // senses of the opened word (only those with a visible synonym), in the order of the article
  const senseInfo = new Map<string, { ord: number; texts: { ord: number; t: string }[]; path: string }>();
  const visibleGroups = new Set(visible.map((m) => m.group));
  // all definition lines of a shown sense, also from synonyms not shown
  for (const m of [...merged.values()].filter((x) => visibleGroups.has(x.group))) {
    for (const row of m.rows) {
      const info = senseInfo.get(m.group) ?? { ord: Number.MAX_SAFE_INTEGER, texts: [], path: text(row.my_sense_path) };
      info.ord = Math.min(info.ord, Number(row.my_sense_ord ?? Number.MAX_SAFE_INTEGER));
      const t = text(row.my_sense);
      if (t && !info.texts.some((x) => x.t === t)) info.texts.push({ ord: Number(row.my_sense_ord ?? Number.MAX_SAFE_INTEGER), t });
      senseInfo.set(m.group, info);
    }
  }
  const senses: SynonymSense[] = [...senseInfo.entries()]
    .sort((a, b) => a[1].ord - b[1].ord || a[0].localeCompare(b[0]))
    .map(([key, info], i) => ({ key, no: i + 1, text: info.texts.sort((x, y) => x.ord - y.ord).map((x) => x.t).join('; '),
      uk: '', en: '', label: info.path }));
  const senseByKey = new Map(senses.map((s) => [s.key, s]));

  // Canonical card translations are read only, for the explicitly labelled details panel.
  const cardIds = [...new Set(visible.map((m) => m.cardId))];
  const translationMap = new Map<string, { uk: string; en: string }>();
  if (cardIds.length) {
    const translations = await supabase.rpc('get_canonical_lexeme_translations_v1', { p_lexeme_ids: cardIds });
    if (translations.error) console.error('Synonym translations failed:', translations.error);
    for (const row of (translations.data ?? []) as any[]) {
      const key = text(row.lexeme_id);
      if (!key) continue;
      if (!translationMap.has(key)) translationMap.set(key, { uk: '', en: '' });
      const entry = translationMap.get(key)!;
      if (row.language_code === 'uk' && !entry.uk) entry.uk = text(row.translation);
      if (row.language_code === 'en' && !entry.en) entry.en = text(row.translation);
    }
  }

  const ui = SYNONYM_TEXT[lang === 'en' || lang === 'no' ? lang : 'ua'];
  const nuanceLang: 'ua' | 'en' | 'no' = lang === 'en' || lang === 'no' ? lang : 'ua';
  const items: SynonymCarouselItem[] = [];
  for (const [index, m] of visible.entries()) {
    const kind = m.kind;
    // the row shown: one of the merged class (a contextual check when the card is contextual)
    const row = m.rows.find((r) => synonymClass(r) === kind) ?? m.rows[0];
    const cardId = m.cardId;
    const synLemma = text(row.lemma);
    const own = senseByKey.get(m.group);
    const theirSenses = [...new Set(m.rows.map((r) => text(r.their_sense)).filter(Boolean))].join('; ');
    const general = translationMap.get(cardId) ?? { uk: '', en: '' };
    const known = m.rows.every((r) => typeof r.can_replace_opened === 'boolean' && typeof r.can_replace_target === 'boolean');
    const label = kind === 'contextual' ? nuanceLabel(m.rows, nuanceLang) : null;
    const hint = kind === 'strict' ? ui.strictHint : label ?? ui.contextHint;
    const reasons = [...new Set(m.rows.map((r) => text(r.reason)).filter(Boolean))];
    const details = [
      row.level === 'dictionary' ? ui.dictionary : ui.checked,
      label ?? '',
      // D10_synonym_nuance_chip_v1: the general hint of a labelled contextual synonym moves here from the card
      label ? ui.contextHint : '',
      `${ui.source}: «${text(lemma)}»: ${own?.text ?? text(row.my_sense)}`,
      `${ui.target}: «${synLemma}»: ${theirSenses}`,
      `${ui.canonical}: ${[general.uk, general.en].filter(Boolean).join(' · ')}`,
      !known ? ui.unknown : '', ...reasons,
    ].filter(Boolean).join('\n');
    items.push({
      // UI identity differs from the real card identity used by Open/Add.
      id: `${cardId}:${m.group}`,
      cardId, lemma: synLemma, pos: text(row.pos) || undefined,
      sourceMeaningCaption: lang === 'ua' ? `«${text(lemma)}» у значенні` : lang === 'no' ? `«${text(lemma)}» i betydningen` : `«${text(lemma)}» in the sense`,
      sourceMeaning: own?.text ?? text(row.my_sense),
      translation_ua: general.uk,
      translation_en: general.en,
      translationCaption: ui.canonical,
      example: '', example_translation_uk: '',
      hint,
      // D10_synonym_nuance_chip_v1: the label as a chip next to the badge
      tag: label ?? undefined,
      relation_type: kind === 'strict' ? 'synonym' : 'contextual_synonym',
      displayClass: kind, accentColor: SYNONYM_COLORS[kind],
      decision: kind === 'strict' ? 'verified_synonym' : 'contextual_synonym', senseKey: own?.key ?? null,
      senseKeys: own ? [own.key] : [], senseNo: own?.no ?? 0,
      labelPrefix: own ? `${own.no}  ` : '', details,
      // clean synonyms always come first in the carousel, then contextual ones
      importance_score: (kind === 'strict' ? 20000 : 10000) - (own?.no ?? 99) * 100 - index,
      status: 'ready', canOpen: true, canAdd: true,
    });
  }
  return { items, senses, word };
}
