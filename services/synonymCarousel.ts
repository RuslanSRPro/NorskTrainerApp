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


export async function fetchSynonymSenseCarousel(
  lexemeId?: string | null,
  lemma?: string | null,
  lang: Lang = 'ua',
): Promise<SynonymSenseCarousel> {
  const id = text(lexemeId);
  if (!id) return { items: [], senses: [] };

  // D10 30.10.2026 (agreed): translation of the opened word for the window header
  const wordPromise = supabase.rpc('get_canonical_lexeme_translations_v1', { p_lexeme_ids: [id] });
  const { data, error } = await supabase.rpc('get_synonym_carousel_v3', { p_lexeme_id: id });
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
  const rows = ((data ?? []) as any[]).filter(row => synonymClass(row) === 'strict');

  // senses of the opened word, in the order of the article (numbered ones first)
  const senseRows = new Map<string, any>();
  for (const row of rows) {
    const key = text(row.my_sense_key);
    if (key && !senseRows.has(key)) senseRows.set(key, row);
  }
  const senses: SynonymSense[] = [...senseRows.entries()]
    .sort((a, b) => {
      const oa = Number(a[1].my_sense_ord ?? Number.MAX_SAFE_INTEGER);
      const ob = Number(b[1].my_sense_ord ?? Number.MAX_SAFE_INTEGER);
      return oa - ob || text(a[1].my_sense).localeCompare(text(b[1].my_sense));
    })
    .map(([key, row], i) => ({ key, no: i + 1, text: text(row.my_sense), uk: '',
      en: '', label: text(row.my_sense_path) }));
  const senseByKey = new Map(senses.map((s) => [s.key, s]));

  // Canonical card translations are read only, for the explicitly labelled details panel.
  const cardIds = [...new Set(rows.map(row => text(row.card_id)).filter(Boolean))];
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
  const items: SynonymCarouselItem[] = [];
  // Keep each source/target meaning and its own verdict. Never promote all senses of a card.
  for (const [index, row] of rows.entries()) {
    const cardId = text(row.card_id);
    const synLemma = text(row.lemma);
    if (!cardId || !synLemma) continue;
    const own = senseByKey.get(text(row.my_sense_key));
    const kind = synonymClass(row);
    const theirSense = text(row.their_sense);
    const general = translationMap.get(cardId) ?? { uk: '', en: '' };
    const known = typeof row.can_replace_opened === 'boolean' && typeof row.can_replace_target === 'boolean';
    const direction = kind === 'one_way'
      ? row.can_replace_opened ? `${text(lemma)} → ${synLemma}` : `${synLemma} → ${text(lemma)}`
      : '';
    const hint = direction || (kind === 'strict' ? ui.strictHint : ui.contextHint);
    const details = [
      row.level === 'dictionary' ? ui.dictionary : ui.checked,
      `${ui.source}: «${text(lemma)}»: ${text(row.my_sense)}`,
      `${ui.target}: «${synLemma}»: ${theirSense}`,
      `${ui.canonical}: ${[general.uk, general.en].filter(Boolean).join(' · ')}`,
      direction, !known ? ui.unknown : '', text(row.reason),
    ].filter(Boolean).join('\n');
    items.push({
      // UI identity differs from the real card identity used by Open/Add.
      id: `${cardId}:${text(row.pair_id)}:${text(row.my_sense_key)}`,
      cardId, lemma: synLemma, pos: text(row.pos) || undefined,
      sourceMeaningCaption: lang === 'ua' ? `«${text(lemma)}» у значенні` : lang === 'no' ? `«${text(lemma)}» i betydningen` : `«${text(lemma)}» in the sense`,
      sourceMeaning: text(row.my_sense),
      translation_ua: general.uk,
      translation_en: general.en,
      translationCaption: ui.canonical,
      example: '', example_translation_uk: '',
      hint,
      relation_type: kind === 'strict' ? 'synonym' : kind === 'one_way' ? 'one_way_replacement' : 'contextual_synonym',
      displayClass: kind, accentColor: SYNONYM_COLORS[kind],
      decision: text(row.decision), senseKey: own?.key ?? null,
      senseKeys: own ? [own.key] : [], senseNo: own?.no ?? 0,
      labelPrefix: own ? `${own.no}  ` : '', details,
      importance_score: 10000 - (own?.no ?? 99) * 100 - index,
      status: 'ready', canOpen: true, canAdd: true,
    });
  }
  return { items, senses, word };
}
