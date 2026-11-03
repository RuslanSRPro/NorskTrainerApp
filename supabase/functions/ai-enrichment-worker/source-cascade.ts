// D10 26.10.2026 (agreed): a word WITH its own Ordbøkene article of its part of
// speech, but WITHOUT an explanation in it (bare verb: the meaning is only in
// "bare seg"; spille noun: only in "gå til spille"). AI gets help from the
// other sources, each ONLY for the same part of speech, in this order:
//   1. Ordbøkene  - its own explanation (missing, that is why we are here)
//   2. NAOB       - the article(s) of the same part of speech:
//                   one article -> its explanation;
//                   several with the same forms (R8) -> all explanations;
//                   several with different forms -> "for review"
//   3. Wiktionary - only when the Norwegian section has this part of speech
//                   and no other one (otherwise the excerpt may describe another)
//   4. Lexin      - only the entries with this word class (E-kat)
//   5. text       - not used yet (needs the sentence context of the job)
//   6. nothing    - AI from lemma + part of speech only
// The first step that gives something is used. An excerpt of another part of
// speech is never given to AI. The result is an AI translation with "≈".
// Pure functions: no network, no database.

import {
  formsSignature,
  inflectedFormCount,
  normalizeWord,
  type NaobArticle,
} from '../_shared/d10-naob-forms.ts';

// card POS -> NAOB / Lexin / Wiktionary (Norwegian) name of the part of speech
export const NORWEGIAN_POS: Record<string, string> = {
  noun: 'substantiv', verb: 'verb', adjective: 'adjektiv', adverb: 'adverb',
};

export type CascadeStep = 'naob' | 'naob_r8' | 'wiktionary' | 'lexin' | 'none';

export type NaobSenses =
  | { status: 'none' }
  | { status: 'one' | 'r8'; text: string; slugs: string[];
      // D10 27.10.2026 (agreed, variant B): R8 with options.chooseOne -> the
      // one article given to AI and why (all_slugs = every R8 article)
      choice?: { slug: string; reason: 'sub_article_word' | 'lowest_number'; all_slugs: string[] } }
  | { status: 'several'; slugs: string[] };

// D10 27.10.2026 (agreed, variant B): several NAOB articles with the same
// forms (R8) used to go to AI together, and AI picked one meaning by chance
// (bare: "присипати ялиновими гілками" one run, "утримуватися" the next).
// Now ONE article is chosen, the same every run:
//   1. the Ordbøkene article has no explanation, its meaning is in its
//      sub-articles (bare -> "bare seg"): the NAOB article whose explanation
//      contains an extra word of a sub-article ("seg": bare_3 "dy seg (for)")
//      when exactly one article does;
//   2. otherwise the article with the lowest number (bare_2 before bare_3).
export function chooseR8Article<T extends { slug: string; article: NaobArticle }>(
  lemma: string,
  articles: T[],
  subArticles: string[],
): { chosen: T; reason: 'sub_article_word' | 'lowest_number' } {
  const want = normalizeWord(lemma);
  const extras = [...new Set(subArticles.flatMap((s) => normalizeWord(s).split(/\s+/))
    .filter((w) => w.length >= 2 && w !== want))];
  const hasWord = (text: string, word: string) =>
    new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu').test(text);
  const matching = extras.length
    ? articles.filter((a) => a.article.definitions.some((d) => extras.some((w) => hasWord(d, w))))
    : [];
  if (matching.length === 1) return { chosen: matching[0], reason: 'sub_article_word' };
  const number = (slug: string) => {
    const m = slug.match(/_(\d+)$/);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
  };
  const sorted = [...articles].sort((a, b) => number(a.slug) - number(b.slug) || a.slug.localeCompare(b.slug));
  return { chosen: sorted[0], reason: 'lowest_number' };
}

// NAOB articles of the word -> the explanations of the card's part of speech.
export function selectNaobSenses(
  lemma: string,
  pos: string | null,
  parsed: Array<{ slug: string; article: NaobArticle }>,
  // D10 27.10.2026: chooseOne -> R8 gives ONE article (chooseR8Article);
  // without options the result is exactly as before
  options?: { chooseOne?: boolean; subArticles?: string[] },
): NaobSenses {
  const label = pos ? NORWEGIAN_POS[pos] : undefined;
  if (!label) return { status: 'none' };
  const want = normalizeWord(lemma);
  const same = parsed.filter((p) => p.article.status === 'ok' && p.article.headword === want &&
    p.article.pos === label && p.article.definitions.length > 0);
  if (!same.length) return { status: 'none' };
  const text = (list: typeof same) => list
    .map((p) => `NAOB ${p.slug} (${want}, ${label}): ${p.article.definitions.join('; ')}`).join('\n');
  if (same.length === 1) return { status: 'one', text: text(same), slugs: [same[0].slug] };
  // several articles of one part of speech: one card only when their forms
  // are the same (R8); without forms there is nothing to compare
  const signatures = new Set(same.map((p) => formsSignature(p.article)));
  const allHaveForms = same.every((p) => inflectedFormCount(p.article) > 0);
  if (allHaveForms && signatures.size === 1) {
    if (options?.chooseOne) {
      const { chosen, reason } = chooseR8Article(lemma, same, options.subArticles ?? []);
      return { status: 'r8', text: text([chosen]), slugs: [chosen.slug],
        choice: { slug: chosen.slug, reason, all_slugs: same.map((p) => p.slug) } };
    }
    return { status: 'r8', text: text(same), slugs: same.map((p) => p.slug) };
  }
  return { status: 'several', slugs: same.map((p) => p.slug) };
}

// Lexin raw preview (JSON, may be cut at the end): nodes {id, type, text}.
// The entries with E-kat = the part of speech; their definitions, examples
// and translations. Entries of another word class are left out.
export function lexinPosExcerpt(raw: string | null | undefined, pos: string | null): string | null {
  const label = pos ? NORWEGIAN_POS[pos] : undefined;
  if (!raw || !label) return null;
  const node = /\{"id":(\d+),"sub_id":-?\d+,"type":"([^"]+)","text":"((?:[^"\\]|\\.)*)"/g;
  const byId = new Map<string, Array<{ type: string; text: string }>>();
  for (const m of raw.matchAll(node)) {
    let text = m[3];
    try { text = JSON.parse(`"${m[3]}"`); } catch { /* keep the raw text */ }
    const list = byId.get(m[1]) ?? [];
    list.push({ type: m[2], text: String(text).trim() });
    byId.set(m[1], list);
  }
  const parts: string[] = [];
  for (const nodes of byId.values()) {
    const kat = nodes.find((n) => n.type === 'E-kat');
    if (!kat || kat.text.toLowerCase() !== label) continue;
    const content = nodes.filter((n) => n.type !== 'E-kat' && n.type !== 'E-lem' && n.text)
      .map((n) => `${n.type}: ${n.text}`);
    if (content.length) parts.push(content.join('; '));
  }
  return parts.length ? `Lexin (${label}): ${parts.join(' | ')}`.slice(0, 1500) : null;
}

const WIKTIONARY_NON_POS = new Set(['referanser', 'uttale', 'etymologi', 'oversettelser', 'synonymer',
  'antonymer', 'bøyning', 'andre', 'avledete', 'sammensetninger', 'se', 'eksterne', 'ordtak', 'uttrykk']);

// Wiktionary page text (table of contents first): used only when the
// Norwegian section has exactly ONE part of speech and it is the card's.
export function wiktionaryPosExcerpt(raw: string | null | undefined, pos: string | null): string | null {
  const label = pos ? NORWEGIAN_POS[pos] : undefined;
  if (!raw || !label) return null;
  const text = raw.replace(/\s+/g, ' ');
  const norsk = text.match(/\b1 norsk\b([\s\S]*?)(?:\b2 [a-zæøå]+ vis\/skjul|vis\/skjul innholdsfortegnelsen|$)/i);
  if (!norsk) return null;
  const headings = new Set([...norsk[1].matchAll(/\b1\.\d+ ([a-zæøå]+)/gi)]
    .map((m) => m[1].toLowerCase()).filter((h) => !WIKTIONARY_NON_POS.has(h)));
  if (headings.size !== 1 || !headings.has(label)) return null;
  const after = text.split(/vis\/skjul innholdsfortegnelsen/i)[1] ?? text;
  const excerpt = after.trim().slice(0, 1200);
  return excerpt ? `Wiktionary (norsk, ${label}): ${excerpt}` : null;
}
