const REFLEXIVE_MAP = new Map<string, string>([
  ['meg', 'seg'],
  ['deg', 'seg'],
  ['seg', 'seg'],
  ['oss', 'seg'],
  ['dere', 'seg'],
  ['ham', 'seg'],
  ['henne', 'seg'],
  ['dem', 'seg'],
]);

const AUXILIARY_VERBS = new Set([
  'har',
  'hadde',
  'skal',
  'vil',
  'kommer',
  'kom',
]);

export function normalizeCompoundTokens(
  tokens: string[],
  presensToInfinitiv: Map<string, string>,
  perfektumToInfinitiv: Map<string, string>,
): string[] {
  const normalized: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];

    // strip infinitive marker
    if (token === 'å') {
      continue;
    }

    // strip auxiliaries
    if (AUXILIARY_VERBS.has(token)) {
      continue;
    }

    // special handling:
    // kommer til å
    if (
      token === 'til' &&
      i > 0 &&
      tokens[i - 1] === 'kommer'
    ) {
      continue;
    }

    // reflexive normalization
    if (REFLEXIVE_MAP.has(token)) {
      normalized.push(
        REFLEXIVE_MAP.get(token)!,
      );
      continue;
    }

    // present → infinitive
    if (presensToInfinitiv.has(token)) {
      normalized.push(
        presensToInfinitiv.get(token)!,
      );
      continue;
    }

    // perfect → infinitive
    if (perfektumToInfinitiv.has(token)) {
      normalized.push(
        perfektumToInfinitiv.get(token)!,
      );
      continue;
    }

    normalized.push(token);
  }

  return normalized;
}