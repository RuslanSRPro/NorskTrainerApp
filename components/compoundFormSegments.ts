// D10 07.11.2026 (agreed, D10_compound_colors_v1): colours of a FORM of a
// compound word in the forms list (vinterjakken, vinterjakkene, vedtok):
//   * the first part(s) (modifier, "vinter", "ved") - plain theme colour;
//   * the rest of the word (head with its ending, "jakken", "tok") - head colour;
//   * articles (en / ei / et) - head colour, as in the word title;
//   * everything else ("å", "har", "/", ",", spaces) - plain text colour.
// A word that does not start with the modifier stays plain. Pure function.

export type FormSegment = { text: string; kind: 'head' | 'component' | 'plain' };

const norm = (value: string) => String(value || '').normalize('NFC').toLocaleLowerCase('nb-NO');

export function compoundFormSegments(value: string, parts: string[]): FormSegment[] | null {
  const clean = (parts ?? []).map((p) => String(p || '').trim()).filter(Boolean);
  if (clean.length < 2) return null;
  const modifier = norm(clean.slice(0, -1).join(''));
  const head = norm(clean[clean.length - 1]);
  if (!modifier) return null;
  const source = String(value ?? '');
  const out: FormSegment[] = [];
  // words and the separators between them
  for (const token of source.split(/(\s+|\/|,)/)) {
    if (!token) continue;
    if (/^(\s+|\/|,)$/.test(token)) { out.push({ text: token, kind: 'plain' }); continue; }
    const lower = norm(token);
    if (/^(en|ei|et)$/.test(lower)) { out.push({ text: token, kind: 'head' }); continue; }
    if (lower.startsWith(modifier) && lower.length > modifier.length) {
      // a linking letter (arbeid-s-plassen, gutt-e-klær) stays with the first
      // part when the head word follows right after it
      let cut = modifier.length;
      if (head && /^[se]$/.test(lower[cut] ?? '') && lower.startsWith(head, cut + 1)) cut += 1;
      out.push({ text: token.slice(0, cut), kind: 'component' });
      out.push({ text: token.slice(cut), kind: 'head' });
      continue;
    }
    out.push({ text: token, kind: 'plain' });
  }
  // "en/ei": the slash between two articles takes the head colour too
  for (let i = 1; i < out.length - 1; i++) {
    const isArticle = (seg: FormSegment) => seg.kind === 'head' && /^(en|ei|et)$/.test(norm(seg.text));
    if (out[i].text === '/' && isArticle(out[i - 1]) && isArticle(out[i + 1])) out[i] = { text: '/', kind: 'head' };
  }
  return out.some((s) => s.kind === 'component') ? out : null;
}
