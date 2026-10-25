// D10 15.10.2026 (agreed): Read mode, word not in the database -> preview
// from the authoritative dictionaries, on tap, one word at a time.
//   Ordbøkene: exact lemma, else the word form (bøkene -> bok); lemma, part
//              of speech, forms (same selection as the forms chain), first
//              explanations.
//   Lexin:     Ukrainian / English translation when Lexin has the word.
// Nothing is written anywhere; no AI.
//
// D10 25.10.2026 (agreed): the preview shows the cards the audit would make,
// with THE SAME rule functions as the pipeline (no AI, no 360, no synonyms):
//   - Ordbøkene articles of one lemma + POS: decideHomographs (R8 one card,
//     R9 own card, review = no card); main card = lowest homograph number;
//   - Lexin translation of a card: entries of its POS; with sibling cards
//     only the entries whose inflection fits the card (stage D3 +
//     selectR9Entries), none fits -> no translation (the explanation shows);
//   - no Ordbøkene article: nouns divided by NAOB (planNaobHomographs).
// The old fields (articles, lexin) stay for older app builds.

import {
  decideHomographs,
  parseHomographArticle,
  type ParsedArticle,
} from '../_shared/d10-homograph-cards.ts';
import { cardFormWords, lexinEntryFitsCard, parseLexinMorphology } from '../_shared/d10-lexin-homograph-forms.ts';
import { selectR9Entries } from '../_shared/d10-lexin-r9.ts';
import { cleanTranslationSenseGroups } from '../_shared/lexin-translation-text.ts';
import { normalizeWord, planNaobHomographs, type NaobArticle } from '../_shared/d10-naob-forms.ts';
import { loadNaobNounArticles } from '../naob-forms-worker/index.ts';
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
  // parsed for the homograph rule (not sent to the app)
  _parsed?: ParsedArticle | null;
};

export type PreviewCard = {
  lemma: string;
  pos: string;
  source: 'ordbokene' | 'naob';
  role: 'main' | 'second';
  article_id: number | null;
  naob_slug: string | null;
  hgno: number | null;
  merged_article_ids: number[];       // R8: same forms, one card
  accepted_articles: string[];
  forms: PreviewArticle['forms'];
  definitions: string[];
  translation: { uk: string[]; en: string[]; status: 'lexin' | 'none'; review: string | null };
};

// uk/en: every variant (Lexin worker parsing); firstUk/firstEn: the variant the
// card shows for this entry (sense 1, rank 1); order: Lexin's own order.
export type LexinEntry = { id: number; pos: string | null; uk: string[]; en: string[]; forms: string[];
  firstUk: string | null; firstEn: string | null; order: number };

export type WordPreview = {
  ok: true;
  word: string;
  ordbokene: { status: 'found' | 'not_found' | 'error'; scope: string | null; articles: PreviewArticle[]; more_articles: number; error?: string };
  lexin: { status: 'found' | 'not_found' | 'error'; lemma: string | null; entries: Array<{ pos: string | null; uk: string[]; en: string[] }>; error?: string };
  cards: PreviewCard[];
  naob: { status: 'not_needed' | 'found' | 'not_found' | 'review' | 'error'; reason?: string; error?: string };
};

const MAX_ARTICLES = 4;
const MAX_DEFINITIONS = 3;
const MAX_CARDS = 6;
// as get_canonical_lexeme_translations_v1 shows a card: uk 3, en 2
const MAX_UK = 3;
const MAX_EN = 2;
const HOMOGRAPH_POS = new Set(['noun', 'verb', 'adjective', 'determiner']);
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
  const all = await ordbokeneAllArticles(word, fetchImpl);
  if (all.status !== 'found') return all;
  return { ...all, articles: all.articles.slice(0, MAX_ARTICLES).map(({ _parsed, ...a }) => a),
    more_articles: Math.max(0, all.articles.length - MAX_ARTICLES) };
}

// Every article of the word (sorted: exact lemma first, then homograph number),
// each with its parsed form for the homograph rule.
async function ordbokeneAllArticles(word: string, fetchImpl?: FetchLike): Promise<WordPreview['ordbokene']> {
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
          _parsed: HOMOGRAPH_POS.has(pos)
            ? parseHomographArticle(article.payload, Number(article.articleId), lemma, pos) : null,
        });
      }
    }
    // exact lemma first, then by homograph number
    const exact = normalizeNorwegian(word);
    articles.sort((a, b) =>
      Number(normalizeNorwegian(b.lemma) === exact) - Number(normalizeNorwegian(a.lemma) === exact) ||
      (a.hgno ?? 0) - (b.hgno ?? 0) || a.article_id - b.article_id);
    return { status: 'found', scope: lookup.scopeUsed, articles, more_articles: 0 };
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

// D10 25.10.2026: the same parsing as lexin-enrichment-worker (moved to
// _shared/lexin-translation-text.ts): `|` preferred variants first, `;`
// senses, infinitives separated by spaces.
function senseGroups(bucket: any[], type: string): string[][] {
  return bucket.filter((e) => e.type === type && e.text?.trim()).flatMap((e) => cleanTranslationSenseGroups(String(e.text)));
}

export async function lexinPreview(lemma: string, fetchImpl: FetchLike = fetch): Promise<WordPreview['lexin']> {
  const r = await lexinEntries(lemma, fetchImpl);
  return { ...r, entries: r.entries.map(({ pos, uk, en }) => ({ pos, uk, en })) };
}

// Lexin entries of the lemma with entry id and inflection (E-mor), as the
// Lexin worker reads them for the stage D3 rule.
export async function lexinEntries(lemma: string, fetchImpl: FetchLike = fetch):
  Promise<Omit<WordPreview['lexin'], 'entries'> & { entries: LexinEntry[] }> {
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
    // Lexin's own order of the entries (resArray), as the Lexin worker's entry_order
    const lexinOrder = new Map<number, number>();
    for (const [key, val] of Object.entries(data?.resArray && typeof data.resArray === 'object' ? data.resArray : {})) {
      const id = (val as any)?.id;
      const position = Number(key);
      if (!Number.isFinite(position) || typeof id !== 'number') continue;
      if (!lexinOrder.has(id) || position < lexinOrder.get(id)!) lexinOrder.set(id, position);
    }
    const buckets = new Map<number, any[]>();
    for (const e of flat) if (e?.id != null) buckets.set(e.id, [...(buckets.get(e.id) ?? []), e]);
    const key = lemma.toLowerCase().trim();
    const entries: LexinEntry[] = [];
    for (const [id, bucket] of buckets) {
      const lem = bucket.filter((e) => e.type === 'E-lem' || e.type === 'N-lem')
        .some((e) => String(e.text ?? '').toLowerCase().trim().replace(/^å\s+/, '') === key);
      if (!lem) continue;
      const cat = bucket.find((e) => ['E-kat', 'N-kat', 'B-kat'].includes(e.type) && e.text?.trim())?.text ?? '';
      const pos = LEXIN_POS[String(cat).toLowerCase().replace(/[.:;,]+$/, '').trim()] ?? null;
      const ukGroups = senseGroups(bucket, 'Ukr-lem');
      const enGroups = senseGroups(bucket, 'B-lem');
      const uk = ukGroups.flat();
      const en = enGroups.flat();
      const forms = parseLexinMorphology(bucket.filter((e) => e.type === 'E-mor').map((e) => String(e.text ?? '')).join(' '));
      if (uk.length || en.length) entries.push({ id, pos, uk: [...new Set(uk)], en: [...new Set(en)], forms,
        firstUk: ukGroups[0]?.[0] ?? null, firstEn: enGroups[0]?.[0] ?? null, order: lexinOrder.get(id) ?? 100000 + entries.length });
    }
    return entries.length ? { status: 'found', lemma, entries } : { status: 'not_found', lemma, entries: [] };
  } catch (error) {
    return { status: 'error', lemma, entries: [], error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Cards (D10 25.10.2026): the same rules as the audit pipeline
// ---------------------------------------------------------------------------

type CardDraft = Omit<PreviewCard, 'translation'> & { formWords: Set<string> };

function formWordsOf(forms: PreviewArticle['forms']): Set<string> {
  return cardFormWords(forms.flatMap((f) => [...f.primary_values, ...f.alternative_values]));
}

// Ordbøkene: one group per lemma + POS; the homograph rule decides the cards.
export function ordbokeneCards(articles: PreviewArticle[]): CardDraft[] {
  const groups = new Map<string, PreviewArticle[]>();
  for (const a of articles) {
    const key = `${normalizeNorwegian(a.lemma)}|${a.pos}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const cards: CardDraft[] = [];
  for (const list of groups.values()) {
    const byId = new Map(list.map((a) => [a.article_id, a]));
    let mainId = list[0].article_id;
    const seconds: number[] = [];
    const merged: number[] = [];
    if (list.length > 1 && HOMOGRAPH_POS.has(list[0].pos)) {
      const decisions = decideHomographs([], list.map((a) => ({ articleId: a.article_id, parsed: a._parsed ?? null })));
      mainId = decisions.find((d) => d.decision === 'main_article')?.articleId ?? mainId;
      for (const d of decisions) {
        if (d.decision === 'r9_card') seconds.push(d.articleId);
        if (d.decision === 'r8_same_forms') merged.push(d.articleId);
      }
    } else {
      // one article, or a POS without homograph cards: one card
      merged.push(...list.slice(1).map((a) => a.article_id));
    }
    for (const id of [mainId, ...seconds]) {
      const a = byId.get(id);
      if (!a) continue;
      cards.push({
        lemma: a.lemma, pos: a.pos, source: 'ordbokene', role: id === mainId ? 'main' : 'second',
        article_id: a.article_id, naob_slug: null, hgno: a.hgno,
        merged_article_ids: id === mainId ? merged : [],
        accepted_articles: a.accepted_articles, forms: a.forms, definitions: a.definitions,
        formWords: formWordsOf(a.forms),
      });
    }
  }
  return cards;
}

// NAOB (noun without an Ordbøkene article): the same plan as naob-forms-worker.
export function naobCards(lemma: string, parsed: Array<{ slug: string; article: NaobArticle }>): CardDraft[] {
  const plan = planNaobHomographs(lemma, parsed);
  const cards: CardDraft[] = [];
  for (const entry of plan) {
    if ((entry.decision !== 'main_article' && entry.decision !== 'r9_card') || !entry.article) continue;
    const forms = entry.article.forms.map((f, i) => ({
      form_key: f.form_key, primary_values: f.primary_values, alternative_values: f.alternative_values, display_order: i,
    }));
    cards.push({
      lemma: normalizeWord(lemma), pos: 'noun', source: 'naob', role: entry.decision === 'main_article' ? 'main' : 'second',
      article_id: null, naob_slug: entry.slug, hgno: entry.hgno,
      merged_article_ids: [], accepted_articles: entry.article.articles, forms,
      definitions: entry.article.definitions,
      // A NAOB card has no Ordbøkene forms: with a sibling card no Lexin entry
      // is bound to it (as lexin-enrichment-worker does with the database).
      formWords: new Set<string>(),
    });
  }
  return cards;
}

// Lexin translation of each card, as lexin-enrichment-worker chooses it.
export function withTranslations(cards: CardDraft[], lexinByLemma: Map<string, LexinEntry[]>): PreviewCard[] {
  return cards.map((card) => {
    const entries = (lexinByLemma.get(normalizeNorwegian(card.lemma)) ?? []).filter((e) => e.pos === card.pos);
    const siblings = cards.filter((c) => c !== card && normalizeNorwegian(c.lemma) === normalizeNorwegian(card.lemma) && c.pos === card.pos);
    let taken = entries;
    let review: string | null = null;
    if (siblings.length > 0) {
      const selection = selectR9Entries(entries.map((e) => ({ id: e.id, forms: e.forms })), card.formWords,
        siblings.map((c) => c.formWords));
      review = selection.review;
      taken = entries.filter((e) => lexinEntryFitsCard(e.forms, card.formWords) &&
        (!selection.allowed || selection.allowed.includes(e.id)));
    }
    // one translation per Lexin entry (its first variant), entries in Lexin's
    // order, uk 3 / en 2: what the card shows after the Lexin step
    const ordered = [...taken].sort((a, b) => a.order - b.order);
    const uk = [...new Set(ordered.map((e) => e.firstUk).filter((t): t is string => !!t))].slice(0, MAX_UK);
    const en = [...new Set(ordered.map((e) => e.firstEn).filter((t): t is string => !!t))].slice(0, MAX_EN);
    const { formWords: _f, ...rest } = card;
    return { ...rest, translation: { uk, en, status: uk.length || en.length ? 'lexin' : 'none', review } };
  });
}

export async function buildPreview(word: string, fetchImpl?: FetchLike): Promise<WordPreview> {
  const all = await ordbokeneAllArticles(word, fetchImpl);
  const ordbokene: WordPreview['ordbokene'] = all.status === 'found'
    ? { ...all, articles: all.articles.slice(0, MAX_ARTICLES).map(({ _parsed, ...a }) => a),
        more_articles: Math.max(0, all.articles.length - MAX_ARTICLES) }
    : all;

  let drafts: CardDraft[] = all.status === 'found' ? ordbokeneCards(all.articles) : [];
  let naob: WordPreview['naob'] = { status: 'not_needed' };
  if (all.status === 'not_found') {
    // no Ordbøkene article at all: nouns by NAOB (as the pipeline's NAOB step)
    try {
      const loaded = await loadNaobNounArticles(normalizeWord(word), (fetchImpl ?? fetch) as any);
      if (loaded.status === 'ok') {
        drafts = naobCards(word, loaded.parsed);
        naob = drafts.length ? { status: 'found' } : { status: 'review', reason: 'naob_division_no_main_article' };
      } else if (loaded.status === 'review') {
        naob = { status: 'review', reason: loaded.reason };
      } else {
        naob = { status: 'not_found' };
      }
    } catch (error) {
      naob = { status: 'error', error: error instanceof Error ? error.message : String(error) };
    }
  }

  const lemmas = [...new Set([...(drafts.length ? drafts.map((c) => c.lemma) : []), all.articles[0]?.lemma ?? word]
    .map((l) => normalizeNorwegian(l)))];
  const lexinResults = await Promise.all(lemmas.map((l) => lexinEntries(l, fetchImpl ?? fetch)));
  const lexinByLemma = new Map(lemmas.map((l, i) => [l, lexinResults[i].entries]));
  const firstLemma = normalizeNorwegian(all.articles[0]?.lemma ?? word);
  const first = lexinResults[lemmas.indexOf(firstLemma)];
  const lexin: WordPreview['lexin'] = { ...first, entries: first.entries.map(({ pos, uk, en }) => ({ pos, uk, en })) };

  const cards = withTranslations(drafts.slice(0, MAX_CARDS), lexinByLemma);
  return { ok: true, word, ordbokene, lexin, cards, naob };
}
