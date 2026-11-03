// services/definitionText.ts
// D10 27.10.2026 (agreed, help "lightbulb" points 1-5, variant c): which
// dictionary definition the help popup shows, and how its text is cleaned.
// Pure functions (no React Native, no network) so they are tested in node.
//
//   - the definition in the app language: ua -> Lexin uk, en -> en, no -> nb;
//   - none in that language -> the Norwegian one (nb), marked "in Norwegian";
//   - parts separated by ";" are separate items, at most MAX_ITEMS;
//   - Lexin references ^word^ -> «word»; the Nynorsk twin of a reference
//     ("^stenge^ (BM), ^stengje^ (NN)") is dropped, the "(BM)" mark too.

export type DefinitionRow = {
  lang: string;            // 'uk' | 'en' | 'nb'
  text: string | null;
};

export type DefinitionHint = {
  items: string[];
  lang: 'uk' | 'en' | 'nb';
  isFallback: boolean;     // true: not the app language, shown in Norwegian
};

export const MAX_ITEMS = 4;

const TARGET: Record<string, 'uk' | 'en' | 'nb'> = { ua: 'uk', en: 'en', no: 'nb' };

export function cleanDefinitionText(text: unknown): string {
  return String(text ?? '')
    .replace(/ /g, ' ')
    .replace(/,?\s*\^[^^]+\^\s*\(NN\)/g, '')        // Nynorsk twin of a reference
    .replace(/\s*\(BM\)/g, '')                        // the Bokmål mark itself
    .replace(/\^([^^]+)\^/g, (_m, w: string) => `«${w.trim()}»`)
    .replace(/\^/g, '')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;]+$/g, '')
    .trim();
}

// ";" outside parentheses separates the parts of one definition
export function splitDefinitionParts(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) { parts.push(current); current = ''; }
    else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => /\p{L}/u.test(p));
}

function itemsOf(rows: DefinitionRow[], lang: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    if (row.lang !== lang) continue;
    for (const part of splitDefinitionParts(cleanDefinitionText(row.text))) {
      const key = part.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(part);
      if (out.length >= MAX_ITEMS) return out;
    }
  }
  return out;
}

// rows are expected in display order (the caller sorts them)
export function pickDefinitionHint(rows: DefinitionRow[], appLang: string | null | undefined): DefinitionHint | null {
  const target = TARGET[String(appLang ?? 'ua')] ?? 'uk';
  const own = itemsOf(rows, target);
  if (own.length) return { items: own, lang: target, isFallback: false };
  if (target !== 'nb') {
    const nb = itemsOf(rows, 'nb');
    if (nb.length) return { items: nb, lang: 'nb', isFallback: true };
  }
  return null;
}
