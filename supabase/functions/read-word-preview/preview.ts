// D10 15.10.2026 (agreed): Read mode, word not in the database -> preview
// from the authoritative dictionaries, on tap, one word at a time.
//   Ordbøkene: exact lemma, else the word form (bøkene -> bok); lemma, part
//              of speech, forms (same selection as the forms chain), first
//              explanations.
//   Lexin:     Ukrainian / English translation when Lexin has the word.
// Nothing is written anywhere; no AI.

import {
  buildAuthoritativeDisplayGroups,
  normalizeNorwegian,
  OrdbokeneClient,
  parseOrdbokeneArticles,
} from '../_shared/authoritative-morphology-v2/mod.ts';

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type PreviewArticle = {
  article_id: number;
  lemma: string;
  hgno: number | null;
  pos: string;
  accepted_articles: string[];
  forms: Array<{ form_key: string; primary_values: string[]; alternative_values: string[]; display_order: number }>;
  definitions: string[];
};

export type WordPreview = {
  ok: true;
  word: string;
  ordbokene: { status: 'found' | 'not_found' | 'error'; scope: string | null; articles: PreviewArticle[]; more_articles: number; error?: string };
  lexin: { status: 'found' | 'not_found' | 'error'; lemma: string | null; entries: Array<{ pos: string | null; uk: string[]; en: string[] }>; error?: string };
};

const MAX_ARTICLES = 4;
const MAX_DEFINITIONS = 3;
const LEXIN_URL = 'https://editorportal.oslomet.no/api/v1/findwords';
const GENDER_ARTICLE: Record<string, string> = { Masc: 'en', Fem: 'ei', Neuter: 'et' };
const ARTICLE_ORDER = ['en', 'ei', 'et'];

export function cleanWord(value: unknown): string | null {
  const word = String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('nb-NO')
    .replace(/^å\s+/, '').replace(/^(en|ei|et)\s+/, '');
  if (!word || word.length > 60 || !/^[\p{L}][\p{L}\s'-]*$/u.test(word)) return null;
  return word;
}

// Text of an explanation with "$" placeholders resolved; null if unresolved.
function renderNode(node: any): string | null {
  if (!node || typeof node.content !== 'string') return null;
  let index = 0;
  let unresolved = false;
  const text = node.content.replace(/\$/g, () => {
    const item = node.items?.[index++];
    if (item?.type_ === 'article_ref') {
      const labels = (item.lemmas ?? []).map((x: any) => x.lemma).filter((x: any) => typeof x === 'string' && x.trim());
      if (labels.length) return labels.join(' / ');
    }
    if (item?.type_ === 'usage' && typeof item.text === 'string') return item.text;
    if (item?.type_ === 'entity') return '';
    unresolved = true;
    return '';
  }).replace(/\s+/g, ' ').replace(/^[\s:,;]+/, '').trim();
  return !unresolved && text ? text : null;
}

export function articleDefinitions(payload: any): string[] {
  const out: string[] = [];
  const visit = (x: any) => {
    if (out.length >= MAX_DEFINITIONS) return;
    if (Array.isArray(x)) { x.forEach(visit); return; }
    if (!x || typeof x !== 'object' || x.type_ === 'sub_article' || x.type_ === 'example') return;
    if (x.type_ === 'explanation') {
      const text = renderNode(x);
      if (text && !out.includes(text)) out.push(text);
      return;
    }
    if (x.elements) visit(x.elements);
  };
  visit(payload?.body?.definitions);
  return out;
}

export async function ordbokenePreview(word: string, fetchImpl?: FetchLike): Promise<WordPreview['ordbokene']> {
  try {
    const lookup = await new OrdbokeneClient(fetchImpl ? { fetchImpl } : {}).lookup(word, ['bm']);
    if (lookup.articles.length === 0) {
      return lookup.errors.length
        ? { status: 'error', scope: lookup.scopeUsed, articles: [], more_articles: 0, error: lookup.errors[0].message }
        : { status: 'not_found', scope: lookup.scopeUsed, articles: [], more_articles: 0 };
    }
    const articles: PreviewArticle[] = [];
    for (const article of lookup.articles) {
      const paradigms = parseOrdbokeneArticles([article]);
      const lemmas = Array.isArray((article.payload as any)?.lemmas) ? (article.payload as any).lemmas : [];
      const head = lemmas[0] ?? {};
      const byPos = new Map<string, typeof paradigms>();
      for (const p of paradigms) byPos.set(p.pos, [...(byPos.get(p.pos) ?? []), p]);
      // a word class without inflection (adverb, preposition...) has no paradigm
      const entries = byPos.size ? [...byPos.entries()] : [[String((article.payload as any)?.word_class ?? '').toLowerCase() || 'unknown', []] as const];
      for (const [pos, list] of entries) {
        const lemma = (list as any[])[0]?.lemma ?? String(head.lemma ?? word);
        const groups = (list as any[]).length
          ? buildAuthoritativeDisplayGroups(list as any, normalizeNorwegian(lemma)) as any[] : [];
        const genders = new Set<string>();
        for (const p of list as any[]) for (const tag of p.paradigmTags ?? []) if (GENDER_ARTICLE[tag]) genders.add(GENDER_ARTICLE[tag]);
        articles.push({
          article_id: Number(article.articleId),
          lemma,
          hgno: Number.isInteger(head.hgno) && head.hgno > 0 ? head.hgno : null,
          pos,
          accepted_articles: ARTICLE_ORDER.filter((a) => genders.has(a)),
          forms: groups.map((g, i) => ({
            form_key: g.formKey,
            primary_values: (g.primary ?? []).map((f: any) => f.value),
            alternative_values: (g.alternatives ?? []).map((f: any) => f.value),
            display_order: i,
          })).filter((f) => f.primary_values.length > 0),
          definitions: articleDefinitions(article.payload),
        });
      }
    }
    // exact lemma first, then by homograph number
    const exact = normalizeNorwegian(word);
    articles.sort((a, b) =>
      Number(normalizeNorwegian(b.lemma) === exact) - Number(normalizeNorwegian(a.lemma) === exact) ||
      (a.hgno ?? 0) - (b.hgno ?? 0) || a.article_id - b.article_id);
    return { status: 'found', scope: lookup.scopeUsed, articles: articles.slice(0, MAX_ARTICLES),
      more_articles: Math.max(0, articles.length - MAX_ARTICLES) };
  } catch (error) {
    return { status: 'error', scope: null, articles: [], more_articles: 0,
      error: error instanceof Error ? error.message : String(error) };
  }
}

const LEXIN_POS: Record<string, string> = {
  verb: 'verb', substantiv: 'noun', adjektiv: 'adjective', adverb: 'adverb', preposisjon: 'preposition',
  pronomen: 'pronoun', konjunksjon: 'conjunction', subjunksjon: 'subjunction', interjeksjon: 'interjection',
  determinativ: 'determiner', tallord: 'numeral',
};

function splitTranslations(text: string): string[] {
  return text.split(/[;,]/).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export async function lexinPreview(lemma: string, fetchImpl: FetchLike = fetch): Promise<WordPreview['lexin']> {
  const url = `${LEXIN_URL}?searchWord=${encodeURIComponent(lemma)}&lang=bokm%C3%A5l-ukrainsk&page=1&selectLang=bokm%C3%A5l-ukrainsk&includeEngLang=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json, text/plain, */*', Origin: 'https://lexin.oslomet.no', Referer: 'https://lexin.oslomet.no/' },
      signal: controller.signal,
    });
    if (!response.ok) return { status: 'error', lemma, entries: [], error: `Lexin HTTP ${response.status}` };
    const text = await response.text();
    if (!text || text.length < 5 || text === '[]' || text === '{}') return { status: 'not_found', lemma, entries: [] };
    const data = JSON.parse(text);
    const result = data?.result ?? data?.results ?? data?.data ?? data?.words ?? data;
    const flat: any[] = (Array.isArray(result) ? result : []).flatMap((s: any) => Array.isArray(s) ? s : []);
    const buckets = new Map<number, any[]>();
    for (const e of flat) if (e?.id != null) buckets.set(e.id, [...(buckets.get(e.id) ?? []), e]);
    const key = lemma.toLowerCase().trim();
    const entries: WordPreview['lexin']['entries'] = [];
    for (const bucket of buckets.values()) {
      const lem = bucket.filter((e) => e.type === 'E-lem' || e.type === 'N-lem')
        .some((e) => String(e.text ?? '').toLowerCase().trim().replace(/^å\s+/, '') === key);
      if (!lem) continue;
      const cat = bucket.find((e) => ['E-kat', 'N-kat', 'B-kat'].includes(e.type) && e.text?.trim())?.text ?? '';
      const pos = LEXIN_POS[String(cat).toLowerCase().replace(/[.:;,]+$/, '').trim()] ?? null;
      const uk = bucket.filter((e) => e.type === 'Ukr-lem' && e.text?.trim()).flatMap((e) => splitTranslations(e.text));
      const en = bucket.filter((e) => e.type === 'B-lem' && e.text?.trim()).flatMap((e) => splitTranslations(e.text));
      if (uk.length || en.length) entries.push({ pos, uk: [...new Set(uk)], en: [...new Set(en)] });
    }
    return entries.length ? { status: 'found', lemma, entries } : { status: 'not_found', lemma, entries: [] };
  } catch (error) {
    return { status: 'error', lemma, entries: [], error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

export async function buildPreview(word: string, fetchImpl?: FetchLike): Promise<WordPreview> {
  const ordbokene = await ordbokenePreview(word, fetchImpl);
  const lemma = ordbokene.articles[0]?.lemma ?? word;
  const lexin = await lexinPreview(lemma, fetchImpl ?? fetch);
  return { ok: true, word, ordbokene, lexin };
}
