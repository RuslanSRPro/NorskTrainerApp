import { normalize } from './normalize.ts';

export const REFLEXIVE_PRONOUNS = new Set([
  'meg',
  'deg',
  'seg',
  'oss',
  'dere',
]);

export const AUXILIARY_VERBS = new Set([
  'har',
  'hadde',
  'er',
  'var',
  'blir',
  'ble',
  'blitt',
  'skal',
  'skulle',
  'vil',
  'ville',
  'kan',
  'kunne',
  'må',
  'måtte',
  'bør',
  'burde',
]);

export function normalizeCompoundTokens(
  tokens: string[],
  presensToInfinitiv: Map<string, string>,
  perfektumToInfinitiv: Map<string, string>,
): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = normalize(tokens[i]);

    if (AUXILIARY_VERBS.has(tok) && i + 1 < tokens.length) {
      const next = normalize(tokens[i + 1]);
      const inf = perfektumToInfinitiv.get(next);

      if (inf) {
        result.push(inf);
        i += 2;
        continue;
      }
    }

    if (REFLEXIVE_PRONOUNS.has(tok)) {
      result.push('seg');
      i++;
      continue;
    }

    if (result.length === 0 && presensToInfinitiv.has(tok)) {
      result.push(presensToInfinitiv.get(tok)!);
      i++;
      continue;
    }

    result.push(tok);
    i++;
  }

  return result;
}