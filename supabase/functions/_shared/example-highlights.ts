export type HighlightRange = { start: number; end: number };
export function fragmentRanges(text: string, fragments: unknown): HighlightRange[] | null {
  if (!Array.isArray(fragments) || fragments.length > 16) return null;
  const ranges: HighlightRange[] = [];
  for (const fragment of fragments) {
    if (typeof fragment !== 'string' || !fragment.trim() || fragment !== fragment.trim()) return null;
    const start = text.indexOf(fragment);
    // Ambiguous occurrences must not be guessed by the app.
    if (start < 0 || text.indexOf(fragment, start + 1) >= 0) return null;
    const end = start + fragment.length;
    if (/\p{L}|\p{N}/u.test(text[start - 1] ?? '') || /\p{L}|\p{N}/u.test(text[end] ?? '')) return null;
    ranges.push({ start, end });
  }
  ranges.sort((a, b) => a.start - b.start);
  if (ranges.some((r, i) => i > 0 && r.start < ranges[i - 1].end)) return null;
  return ranges;
}
export function proposalHighlights(answer: any) {
  const nb = String(answer?.example_nb ?? '').trim();
  const uk = String(answer?.example_translation_ua ?? '').trim();
  const nbRanges = fragmentRanges(nb, answer?.example_highlights_nb);
  const ukRanges = fragmentRanges(uk, answer?.example_highlights_uk);
  // A natural Ukrainian sentence may omit a copula (Hun er hjemme -> Вона вдома).
  // An empty, explicitly returned UK array is reviewable; an absent/invalid one is not.
  if (!nb || !uk || !nbRanges?.length || ukRanges === null) throw new Error('AI_EXAMPLE_HIGHLIGHTS_INVALID');
  return { version: 1, nb: { text: nb, fragments: answer.example_highlights_nb },
    uk: { text: uk, fragments: answer.example_highlights_uk } };
}
export function reviewedHighlights(review: any, nb: string, uk: string | null) {
  if (review?.status !== 'accepted') throw new Error('AI_EXAMPLE_HIGHLIGHTS_NOT_REVIEWED');
  const h = proposalHighlights(review?.approved_proposal?.answer);
  if (h.nb.text !== nb.trim() || h.uk.text !== uk?.trim()) throw new Error('AI_EXAMPLE_HIGHLIGHTS_TEXT_CHANGED');
  return h;
}
export function storedHighlightRanges(text: string, evidence: any, language: 'nb' | 'uk'): HighlightRange[] | null {
  const h = evidence?.example_highlights;
  if (h?.version !== 1 || h[language]?.text !== text || evidence?.review?.status !== 'accepted') return null;
  try {
    const reviewed = reviewedHighlights(evidence.review, h.nb.text, h.uk.text);
    // JSONB reorders object keys; compare values, not serialized object order.
    if (reviewed.nb.text !== h.nb.text || reviewed.uk.text !== h.uk.text ||
        JSON.stringify(reviewed.nb.fragments) !== JSON.stringify(h.nb.fragments) ||
        JSON.stringify(reviewed.uk.fragments) !== JSON.stringify(h.uk.fragments)) return null;
  } catch { return null; }
  return fragmentRanges(text, h[language].fragments);
}
