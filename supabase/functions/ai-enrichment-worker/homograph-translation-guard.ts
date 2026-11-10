// D10 27.10.2026 (agreed): homograph cards of ONE lemma and part of speech
// (bar noun: main = pub, III = unit of pressure) must not get the same AI
// translation. Before this rule both got the bare word «бар» and the cards
// could not be told apart in training.
//
//   1. The AI request of such a card gets a translation constraint (the
//      existing translation_constraints of the source context, which the
//      generator and the second review already obey): the translations of
//      the other cards, and "if the same base word fits, add a short
//      clarification of THIS meaning in parentheses". Still ONE translation.
//   2. After the review the code compares the answer with the other cards'
//      translations (database + cards written earlier in the same run).
//      Same -> one more generation (with the updated list), then
//      "for review" HOMOGRAPH_SAME_TRANSLATION; nothing identical is written.
//
// D10 28.10.2026 (agreed, stricter): the same BASE word is not enough either.
// When another card's translation has the same base (бар / бар (одиниця
// тиску)), THIS translation must carry its own clarification in parentheses
// too: main «бар» -> «бар (заклад)». Identical translations stay forbidden.
//
// Only AI translations are checked: Lexin translations are the dictionary's
// own and are never touched (brenne verb: «burn» for two cards from Lexin).
// Pure functions, no network, no database.

export const HOMOGRAPH_CONSTRAINT_MARK = 'HOMOGRAPH_CARDS:';
export const HOMOGRAPH_SAME_TRANSLATION = 'HOMOGRAPH_SAME_TRANSLATION';

export type SiblingCard = { id: string; label: string; uk: string[]; en: string[] };

export function normTranslation(value: unknown): string {
  return String(value ?? '').normalize('NFC').toLocaleLowerCase('uk').replace(/\s+/g, ' ').trim();
}

// the word without a final clarification in parentheses: «бар (заклад)» -> «бар»
export function translationBase(value: unknown): string {
  return normTranslation(value).replace(/\s*\([^()]*\)\s*$/, '').trim();
}

export function hasClarification(value: unknown): boolean {
  return /\([^()]*\p{L}[^()]*\)\s*$/u.test(String(value ?? '').trim()) && translationBase(value).length > 0;
}

const quote = (values: string[]) => values.length ? values.map((v) => `«${v}»`).join(', ') : '—';

export function homographConstraint(lemma: string, pos: string | null, siblings: SiblingCard[]): string | null {
  if (!siblings.length) return null;
  const list = siblings.map((s) => `${s.label}: uk ${quote(s.uk)}; en ${quote(s.en)}`).join(' | ');
  return `${HOMOGRAPH_CONSTRAINT_MARK} «${lemma}» (${pos ?? '?'}) has other homograph cards of the same part of speech ` +
    `with OTHER meanings. Their current translations: ${list}. These describe OTHER meanings: never take a meaning ` +
    `from them, translate only the meaning of THIS card's own dictionary context. The translation of THIS card must not be identical ` +
    `to a translation of another card. If the same base word is the right translation, or another card's ` +
    `translation has the same base word (with or without a clarification), add a short clarification of THIS ` +
    `meaning in parentheses, 1-4 words, in the language of the translation: «бар (заклад)», «бар (одиниця тиску)», ` +
    `«bar (pub)», «bar (unit of pressure)». It stays ONE translation.`;
}

// The source context with the homograph constraint (a previous one replaced).
// A context that is not JSON is returned unchanged.
export function withHomographConstraint(context: string, constraint: string | null): string {
  let parsed: any;
  try { parsed = JSON.parse(context); } catch { return context; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return context;
  const kept = (Array.isArray(parsed.translation_constraints) ? parsed.translation_constraints : [])
    .filter((c: unknown) => !(typeof c === 'string' && c.startsWith(HOMOGRAPH_CONSTRAINT_MARK)));
  if (!constraint && kept.length === (parsed.translation_constraints ?? []).length) return context;
  parsed.translation_constraints = constraint ? [...kept, constraint] : kept;
  return JSON.stringify(parsed);
}

// The other cards' translations: database values, replaced by the values
// written for a card earlier in this run.
export function mergeSiblings(siblings: SiblingCard[], written: Map<string, { uk?: string[]; en?: string[] }>): SiblingCard[] {
  return siblings.map((s) => {
    const w = written.get(s.id);
    return w ? { ...s, uk: w.uk ?? s.uk, en: w.en ?? s.en } : s;
  });
}

// Values of the answer equal to a translation of another card (same language).
// Values of the answer that clash with another card (same language):
//   identical                        - the same translation;
//   same_base_without_clarification  - the same base word, and this value has
//                                      no clarification of its own.
export type HomographClash = { lang: 'uk' | 'en'; value: string; card: string;
  kind: 'identical' | 'same_base_without_clarification' };
export function sameAsSibling(values: { uk: string[]; en: string[] }, siblings: SiblingCard[]): HomographClash[] {
  const out: HomographClash[] = [];
  for (const lang of ['uk', 'en'] as const) {
    for (const value of values[lang]) {
      const key = normTranslation(value);
      if (!key) continue;
      const identical = siblings.find((s) => s[lang].some((v) => normTranslation(v) === key));
      if (identical) { out.push({ lang, value, card: identical.label, kind: 'identical' }); continue; }
      if (hasClarification(value)) continue;
      const base = translationBase(value);
      const sameBase = siblings.find((s) => s[lang].some((v) => translationBase(v) === base));
      if (sameBase) out.push({ lang, value, card: sameBase.label, kind: 'same_base_without_clarification' });
    }
  }
  return out;
}
