// D10 07.11.2026 (agreed, D10_analysis_skip_since_v1): a whole-text analysis
// does not process again a card that was fully processed by a text analysis
// on or after the configured date (public.analysis_skip_config_v1.skip_since).
// The decision which cards are "fully processed" is made only in SQL
// (public.d10_analysis_skip_cards_v1); this module only collects the ids of
// the planned items and drops the items whose card was returned.
//
// Never skipped: word lists (Check of one word, saving selected words: they
// always run in full), surface probes, items without a resolved card.

export type SkipPlannedItem = {
  match_type?: string | null;
  match_strategy?: string | null;
  expression_id?: string | null;
  resolved?: { lexeme_id?: string | null } | null;
  normalized_lemma?: string | null;
  surface_form?: string | null;
};

export type SkipIds = { lexemeIds: string[]; expressionIds: string[] };

// token item -> its resolved card; expression item -> its catalog entry
export function skipKeyOf(item: SkipPlannedItem, probeStrategy: string): { kind: 'lexeme' | 'expression'; id: string } | null {
  if (!item || item.match_strategy === probeStrategy) return null;
  if (item.match_type === 'expression') {
    return item.expression_id ? { kind: 'expression', id: String(item.expression_id) } : null;
  }
  const lexemeId = item.resolved?.lexeme_id;
  return lexemeId ? { kind: 'lexeme', id: String(lexemeId) } : null;
}

export function collectSkipIds(items: SkipPlannedItem[], probeStrategy: string): SkipIds {
  const lexemes = new Set<string>();
  const expressions = new Set<string>();
  for (const item of items) {
    const key = skipKeyOf(item, probeStrategy);
    if (!key) continue;
    (key.kind === 'lexeme' ? lexemes : expressions).add(key.id);
  }
  return { lexemeIds: [...lexemes], expressionIds: [...expressions] };
}

// Splits the plan into the items to write and the skipped ones.
export function splitSkipped<T extends SkipPlannedItem>(
  items: T[], skipLexemes: Set<string>, skipExpressions: Set<string>, probeStrategy: string,
): { keep: T[]; skipped: T[] } {
  const keep: T[] = [];
  const skipped: T[] = [];
  for (const item of items) {
    const key = skipKeyOf(item, probeStrategy);
    const hit = key && (key.kind === 'lexeme' ? skipLexemes.has(key.id) : skipExpressions.has(key.id));
    (hit ? skipped : keep).push(item);
  }
  return { keep, skipped };
}

// Short list for the job summary (words, no duplicates, at most `max`).
export function skippedWords(items: SkipPlannedItem[], max = 200): string[] {
  const words = new Set<string>();
  for (const item of items) {
    const word = String(item.normalized_lemma ?? item.surface_form ?? '').trim();
    if (word) words.add(word);
    if (words.size >= max) break;
  }
  return [...words];
}
