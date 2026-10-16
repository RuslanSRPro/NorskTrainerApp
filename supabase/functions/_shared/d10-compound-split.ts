// D10 15.10.2026 (agreed): dictionary split of a compound word that has no
// own Ordbøkene article (vinterjakke = vinter + jakke).
//
// Rule:
//   - every cut of the lemma is tried; a linking element -s- or -e- may sit
//     at the end of the first part (arbeid+s+plass, barn+e+hage);
//   - the head (last part) must be a card in our base with article-backed
//     forms and the same part of speech;
//   - the first part must be an Ordbøkene headword;
//   - exactly one split -> written; several -> review; none -> nothing.
// Pure logic: database and network access come in through `deps`.

export type CompoundLink = '' | 's' | 'e';

export type SplitCandidate = {
  prefixSurface: string; // first part as written in the lemma (incl. link)
  base: string; // first part without the link
  link: CompoundLink;
  head: string;
};

export type HeadInfo = {
  lexemeIds: string[];
  // all head cards give the same forms (homographs may differ)
  formsAgree: boolean;
};

export type SplitDeps = {
  headInfo: (heads: string[], pos: string) => Promise<Map<string, HeadInfo>>;
  isHeadword: (base: string) => Promise<boolean>;
};

export type SplitDecision =
  | { status: 'split'; parts: [string, string]; links: [CompoundLink]; head: string;
      headLexemeIds: string[]; prefixSurface: string; checkedBases: string[] }
  | { status: 'ambiguous'; reason: string; candidates: Array<Record<string, unknown>> }
  | { status: 'no_split'; reason: string };

export const MIN_PREFIX = 2;
export const MIN_HEAD = 3;

function norm(value: string): string {
  return String(value ?? '').normalize('NFC').toLocaleLowerCase('nb-NO').trim();
}

export function enumerateSplits(lemma: string): SplitCandidate[] {
  const word = norm(lemma);
  if (!/^[a-zæøåéèêóòôüäö]+$/.test(word)) return [];
  const out: SplitCandidate[] = [];
  for (let i = MIN_PREFIX; i <= word.length - MIN_HEAD; i += 1) {
    const prefix = word.slice(0, i);
    const head = word.slice(i);
    out.push({ prefixSurface: prefix, base: prefix, link: '', head });
    const last = prefix.slice(-1);
    if ((last === 's' || last === 'e') && prefix.length - 1 >= MIN_PREFIX) {
      out.push({ prefixSurface: prefix, base: prefix.slice(0, -1), link: last as CompoundLink, head });
    }
  }
  return out;
}

export async function decideSplit(lemma: string, pos: string, deps: SplitDeps): Promise<SplitDecision> {
  const candidates = enumerateSplits(lemma);
  if (candidates.length === 0) return { status: 'no_split', reason: 'not_a_simple_word' };

  const heads = [...new Set(candidates.map((c) => c.head))];
  const headMap = await deps.headInfo(heads, pos);
  const viable = candidates.filter((c) => (headMap.get(c.head)?.lexemeIds.length ?? 0) > 0);
  if (viable.length === 0) return { status: 'no_split', reason: 'no_head_card_with_forms' };

  const known = new Map<string, boolean>();
  const checkedBases: string[] = [];
  for (const c of viable) {
    if (!known.has(c.base)) {
      known.set(c.base, await deps.isHeadword(c.base));
      checkedBases.push(c.base);
    }
  }
  const valid = viable.filter((c) => known.get(c.base) === true);
  if (valid.length === 0) return { status: 'no_split', reason: 'first_part_not_a_headword' };

  // Same written parts with and without a link (syke / syk+e) colour and
  // inflect the same: one split. Prefer the reading without a link.
  const groups = new Map<string, SplitCandidate[]>();
  for (const c of valid) {
    const key = `${c.prefixSurface}|${c.head}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const chosen = [...groups.values()].map((g) => g.find((c) => c.link === '') ?? g[0]);

  if (chosen.length > 1) {
    return {
      status: 'ambiguous', reason: 'several_splits',
      candidates: chosen.map((c) => ({ parts: [c.base, c.head], link: c.link })),
    };
  }
  const c = chosen[0];
  const head = headMap.get(c.head)!;
  if (!head.formsAgree) {
    return {
      status: 'ambiguous', reason: 'head_homographs_differ',
      candidates: [{ parts: [c.base, c.head], link: c.link, head_lexeme_ids: head.lexemeIds }],
    };
  }
  return {
    status: 'split', parts: [c.base, c.head], links: [c.link], head: c.head,
    headLexemeIds: head.lexemeIds, prefixSurface: c.prefixSurface, checkedBases,
  };
}

// NAOB etymology notes -> parts. "sammensatt av vinter og jakke" gives both
// parts; "annet ledd hus" gives the head only (first part = lemma - head).
export function naobAnnetLeddParts(lemma: string, targetText: string):
  { parts: [string, string]; links: [CompoundLink] } | null {
  const m = /^annet ledd\s+([a-zæøåéèêóòôüäö-]+)$/i.exec(norm(targetText));
  if (!m) return null;
  const word = norm(lemma);
  const head = m[1].replace(/-+$/, '');
  if (head.length < MIN_HEAD || !word.endsWith(head)) return null;
  const prefix = word.slice(0, word.length - head.length);
  if (prefix.length < MIN_PREFIX || /[\s-]/.test(prefix)) return null;
  return { parts: [prefix, head], links: [''] };
}
