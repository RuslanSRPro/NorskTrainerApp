// D10 stage D3 (agreed 14.10.2026): which Lexin entry belongs to which card
// when two cards share lemma and POS (rule R9). Lexin gives the inflection in
// the E-mor entry, e.g. "ei (en) bok boka (boken) bøker bøkene". The entry
// belongs to the card when every inflected word of it is a form of the card.

const FUNCTION_WORDS = new Set(['en', 'ei', 'et', 'å', 'har', 'hadde', 'er', 'var', 'blir', 'ble']);

function words(text: string): string[] {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('nb-NO')
    .replace(/[(),;/]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w && !FUNCTION_WORDS.has(w));
}

export function parseLexinMorphology(text: string): string[] {
  return [...new Set(words(text))].sort();
}

export function cardFormWords(values: string[]): Set<string> {
  const result = new Set<string>();
  for (const value of values) for (const w of words(String(value ?? ''))) result.add(w);
  return result;
}

// No inflection -> no proof -> the entry is not taken (translation by AI).
export function lexinEntryFitsCard(lexinForms: string[], cardForms: Set<string>): boolean {
  if (lexinForms.length === 0 || cardForms.size === 0) return false;
  return lexinForms.every((form) => cardForms.has(form));
}
