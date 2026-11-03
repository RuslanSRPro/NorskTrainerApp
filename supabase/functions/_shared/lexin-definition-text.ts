// D10 27.10.2026 (agreed): a Lexin Ukrainian DEFINITION (Ukr-def) is one
// sentence, not a list of translation variants. Before this file the worker
// passed it through cleanTranslationSenseGroups (the translation splitter:
// "|", ";" and "," outside parentheses), so "написаний ... зі сторінками,
// скріпленими з одного боку" became two rows (512 cards, 756 definitions
// -> 2063 rows on 27.10.2026, query 228).
//
// Rule: the whole definition text is ONE row. Lexin cross-references to a
// Norwegian word are written as ^word^ ("протилежне до ^stenge^"); they are
// kept as «word». Translations (Ukr-lem / B-lem) do NOT use this function.
// Pure function, no network, no database.

export function cleanLexinDefinitionText(text: unknown): string | null {
  const normalized = String(text ?? '')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return null;

  const cleaned = normalized
    .replace(/\^([^^]+)\^/g, (_m, word: string) => `«${word.trim()}»`)
    .replace(/\^/g, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return /\p{L}/u.test(cleaned) ? cleaned : null;
}
