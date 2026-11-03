// D10 16.10.2026 (agreed: "если нет форм в Ordbøkene то смотреть в НАОБ").
// Reading the noun forms NAOB shows in the "BØYNING" block of an article.
// Pure functions: no network, no database. Used by naob-forms-worker.
//
// Article page (static HTML):
//   <span class="oppslagsord">brenne</span>&#160;
//   <div class="ordklasseledd inline-eske"><span>substantiv</span></div>
//   ... <div class="table-body-cell boeyningsform-ledetekst td">bestemt form entall</div>
//       <div class="table-body-cell boeyningsform-i-skjema td">brennen</div>
// Search page:
//   <a class="page_wordLink__X" href="/ordbok/brenne_2">brenne</a></h3>
//   <div class="page_shortHtml__X"><div class="shortform">
//   <span class="ordklasse-shortform">substantiv</span>
//
// Only what NAOB shows is taken. A form NAOB does not list (brenne: no
// "bestemt form flertall") is not built.

import { decideHomographs, type HomographDecision, type ParsedArticle } from './d10-homograph-cards.ts';

export const NAOB_NOUN_FORM_KEYS = [
  'noun_singular_indefinite',
  'noun_singular_definite',
  'noun_plural_indefinite',
  'noun_plural_definite',
] as const;
export type NaobNounFormKey = typeof NAOB_NOUN_FORM_KEYS[number];

// D10 26.10.2026 (agreed): verbs and adjectives too. The keys are the ones the
// app already reads for Ordbøkene forms (formReadModelCore aliases).
export const NAOB_VERB_FORM_KEYS = ['infinitive', 'present', 'past', 'past_participle'] as const;
export const NAOB_ADJECTIVE_FORM_KEYS = [
  'positive_singular_indefinite_common',
  'positive_singular_indefinite_neuter',
  'positive_definite',
  'positive_plural_indefinite',
  'comparative',
  'superlative',
  'superlative_definite',
] as const;
export type NaobVerbFormKey = typeof NAOB_VERB_FORM_KEYS[number];
export type NaobAdjectiveFormKey = typeof NAOB_ADJECTIVE_FORM_KEYS[number];
export type NaobFormKey = NaobNounFormKey | NaobVerbFormKey | NaobAdjectiveFormKey;

export type NaobForm = {
  form_key: NaobFormKey;
  primary_values: string[];
  alternative_values: string[];
  // D10 26.10.2026 (agreed): set only on a form built by us from the forms
  // NAOB lists (not taken from the source). The app shows "≈" next to it.
  derived_rule?: NaobDerivedRule;
};

export type NaobDerivedRule = 'present_infinitive_plus_r' | 'definite_equals_plural' | 'superlative_plus_e';

export type NaobListingEntry = { slug: string; headword: string; pos: string };

export type NaobListing = {
  entries: NaobListingEntry[];
  shown: number | null;
  total: number | null;
};

export type NaobArticle = {
  status: 'ok' | 'no_article' | 'multiple_paradigms' | 'invalid_value';
  headword: string | null;
  pos: string | null;
  genus: string | null;
  articles: string[];
  forms: NaobForm[];
  unknown_labels: string[];
  invalid_values: string[];
  // D10 24.10.2026: the article's own explanations ("avsvidd skoggrunn;
  // rydningsplass etter skogbrann"), quotes and examples left out. Empty =
  // no own meaning (proof needed for a separate card, rule R9).
  definitions: string[];
};

const ROW_LABELS: Record<string, NaobNounFormKey> = {
  'ubestemt form entall': 'noun_singular_indefinite',
  'bestemt form entall': 'noun_singular_definite',
  'ubestemt form flertall': 'noun_plural_indefinite',
  'bestemt form flertall': 'noun_plural_definite',
};

// D10 26.10.2026: verb and adjective rows of the BØYNING block (seen on
// naob.no 26.10.2026: bare_2, kaste_4, bar_3, stor). "verbalsubstantiv"
// (baring) is not a form of the paradigm and is left out.
const VERB_ROW_LABELS: Record<string, NaobVerbFormKey> = {
  'infinitiv': 'infinitive',
  'presens': 'present',
  'preteritum': 'past',
  'perfektum partisipp': 'past_participle',
};
const ADJECTIVE_ROW_LABELS: Record<string, NaobAdjectiveFormKey> = {
  'nøytrum': 'positive_singular_indefinite_neuter',
  'bestemt form': 'positive_definite',
  'flertall': 'positive_plural_indefinite',
  'komparativ': 'comparative',
  'superlativ': 'superlative',
};
const VERB_SUMMARY_CLASSES: Record<string, NaobVerbFormKey> = {
  VerbPres: 'present',
  VerbPret: 'past',
  VerbPerfPart: 'past_participle',
};
const ADJECTIVE_SUMMARY_CLASSES: Record<string, NaobAdjectiveFormKey> = {
  AdjArtPronNoeytrum: 'positive_singular_indefinite_neuter',
  AdjArtPronFlertall: 'positive_plural_indefinite',
  AdjKomparativ: 'comparative',
  AdjSuperlativ: 'superlative',
};
const IGNORED_LABELS = new Set(['verbalsubstantiv', 'presens partisipp', 'imperativ']);

type NaobPosKind = 'noun' | 'verb' | 'adjective';
// NAOB part of speech -> which rows are read. Anything else is read as before
// (noun rows only), so nothing changes for other parts of speech.
export function naobPosKind(pos: string | null): NaobPosKind {
  if (pos === 'verb') return 'verb';
  if (pos === 'adjektiv') return 'adjective';
  return 'noun';
}
// Card POS -> NAOB part of speech of its articles.
export const NAOB_POS_OF_CARD: Record<string, string> = { noun: 'substantiv', verb: 'verb', adjective: 'adjektiv' };
const KEYS_OF: Record<NaobPosKind, readonly NaobFormKey[]> = {
  noun: NAOB_NOUN_FORM_KEYS, verb: NAOB_VERB_FORM_KEYS, adjective: NAOB_ADJECTIVE_FORM_KEYS,
};
// The headword itself: indefinite singular / infinitive / positive.
const HEADWORD_KEY: Record<NaobPosKind, NaobFormKey> = {
  noun: 'noun_singular_indefinite', verb: 'infinitive', adjective: 'positive_singular_indefinite_common',
};

const SUMMARY_CLASSES: Record<string, NaobNounFormKey> = {
  SubstUbestEntall: 'noun_singular_indefinite',
  SubstBestEntall: 'noun_singular_definite',
  SubstUbestFlertall: 'noun_plural_indefinite',
  SubstBestFlertall: 'noun_plural_definite',
};

const ARTICLES = ['en', 'ei', 'et'];
const WORD = /^[a-zæøåàáâäèéêëìíîïòóôöùúûüçñ]+(?:-[a-zæøåàáâäèéêëìíîïòóôöùúûüçñ]+)*$/;

const NAMED: Record<string, string> = {
  aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', oacute: 'ó', ograve: 'ò', ocirc: 'ô',
  uuml: 'ü', ouml: 'ö', auml: 'ä', nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED[name] ?? m)
    .replace(/ /g, ' ');
}

function plain(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function normalizeWord(value: string | null | undefined): string {
  return String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('nb-NO').replace(/^å\s+/, '');
}

// The page HTML, or its copy inside the Next.js script when the page was
// delivered without the rendered part.
export function renderedHtml(html: string): string {
  if (/class="oppslagsord"|class="page_wordLink/.test(html)) return html;
  if (!/\\u003c/.test(html)) return html;
  return html
    .replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"').replace(/\\n/g, '\n');
}

// --------------------------------------------------------------------------
// Search page: the articles NAOB lists for the word (headword + POS).
// --------------------------------------------------------------------------
export function parseNaobSearch(html: string): NaobListing {
  const page = renderedHtml(html);
  const entries: NaobListingEntry[] = [];
  const seen = new Set<string>();
  const link = /<a class="page_wordLink[^"]*" href="\/ordbok\/([^"#?]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>\s*<div class="page_shortHtml[^"]*">\s*<div class="shortform">\s*<span class="ordklasse-shortform">([^<]*)<\/span>/g;
  for (const m of page.matchAll(link)) {
    const slug = m[1];
    if (!/^[A-Za-z0-9%._-]+$/.test(slug) || seen.has(slug)) continue;
    seen.add(slug);
    entries.push({ slug, headword: normalizeWord(plain(m[2])), pos: plain(m[3]).toLowerCase() });
  }
  // "Viser treff 1 til 4 av 4 totalt" (rendered with comments between numbers)
  const range = plain(page.replace(/<!--[\s\S]*?-->/g, ''))
    .match(/treff\s+\d+\s+til\s+(\d+)\s+av\s+(\d+)/i);
  return {
    entries,
    shown: range ? Number(range[1]) : null,
    total: range ? Number(range[2]) : null,
  };
}

// --------------------------------------------------------------------------
// Article page: headword, POS, genus, article and the listed forms.
// --------------------------------------------------------------------------
function splitValues(cell: string): { primary: string[]; alternative: string[]; invalid: string[] } {
  const text = plain(cell);
  const alternative: string[] = [];
  const outside = text.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    alternative.push(...inner.split(/\s*(?:,|\/|\beller\b|\bel\.)\s*/));
    return ' , ';
  });
  const primary = outside.split(/\s*(?:,|\/|\beller\b|\bel\.)\s*/);
  const clean = (list: string[]) => [...new Set(list.map(normalizeWord).filter(Boolean))];
  const p = clean(primary);
  const a = clean(alternative).filter((v) => !p.includes(v));
  const invalid = [...p, ...a].filter((v) => !WORD.test(v));
  return { primary: p, alternative: a, invalid };
}

export function parseNaobArticle(html: string): NaobArticle {
  const empty: NaobArticle = {
    status: 'no_article', headword: null, pos: null, genus: null, articles: [],
    forms: [], unknown_labels: [], invalid_values: [], definitions: [],
  };
  const page = renderedHtml(html);
  const start = page.indexOf('class="oppslagsord"');
  if (start < 0) return empty;
  // only the first article of the page, up to its meanings
  const endMarker = page.indexOf('BETYDNING OG BRUK', start);
  const nextHead = page.indexOf('class="oppslagsord"', start + 10);
  let end = endMarker > 0 ? endMarker : page.length;
  if (nextHead > 0 && nextHead < end) end = nextHead;
  const block = page.slice(start, end);

  const head = block.match(/^class="oppslagsord">([\s\S]*?)<\/span>/);
  const pos = block.match(/class="ordklasseledd[^"]*">\s*<span[^>]*>([^<]*)<\/span>/);
  const headword = head ? normalizeWord(plain(head[1].replace(/<sup[\s\S]*?<\/sup>/g, ''))) : null;
  const result: NaobArticle = { ...empty, status: 'ok', headword, pos: pos ? plain(pos[1]).toLowerCase() : null };

  const tables = block.match(/class="contents boeyningsskjema"/g) ?? [];
  if (tables.length > 1) return { ...result, status: 'multiple_paradigms' };

  const kind = naobPosKind(result.pos);
  const rowLabels: Record<string, NaobFormKey> = kind === 'verb' ? VERB_ROW_LABELS
    : kind === 'adjective' ? ADJECTIVE_ROW_LABELS : ROW_LABELS;
  const summaryClasses: Record<string, NaobFormKey> = kind === 'verb' ? VERB_SUMMARY_CLASSES
    : kind === 'adjective' ? ADJECTIVE_SUMMARY_CLASSES : SUMMARY_CLASSES;
  const byKey = new Map<NaobFormKey, { primary: string[]; alternative: string[] }>();
  const row = /boeyningsform-ledetekst td">([\s\S]*?)<\/div>\s*<div class="table-body-cell[^"]*td">([\s\S]*?)<\/div>/g;
  for (const m of block.matchAll(row)) {
    const label = plain(m[1]).toLowerCase();
    if (label === 'genus') {
      result.genus = plain(m[2]).toLowerCase() || null;
      continue;
    }
    if (label === 'ubestemt artikkel') {
      const found = [...m[2].matchAll(/<span class="genus">([^<]*)<\/span>/g)]
        .map((g) => plain(g[1]).toLowerCase());
      const words = (found.length ? found : plain(m[2]).toLowerCase().split(/\s*(?:,|\/|\beller\b)\s*/))
        .filter((w) => ARTICLES.includes(w));
      result.articles = ARTICLES.filter((a) => words.includes(a));
      continue;
    }
    const key = rowLabels[label];
    if (!key && kind !== 'noun' && IGNORED_LABELS.has(label)) continue;
    if (!key) {
      result.unknown_labels.push(label);
      continue;
    }
    const values = splitValues(m[2]);
    result.invalid_values.push(...values.invalid);
    if (values.primary.length) byKey.set(key, { primary: values.primary, alternative: values.alternative });
  }

  // No table rows: the forms of the BØYNING heading line.
  if (byKey.size === 0) {
    const summary = /<span class="boeyningsform ([A-Za-z]+)">([\s\S]*?)<\/span>/g;
    for (const m of block.matchAll(summary)) {
      const key = summaryClasses[m[1]];
      if (!key) continue;
      const values = splitValues(m[2]);
      result.invalid_values.push(...values.invalid);
      const prev = byKey.get(key);
      byKey.set(key, {
        primary: [...new Set([...(prev?.primary ?? []), ...values.primary])],
        alternative: [...new Set([...(prev?.alternative ?? []), ...values.alternative])],
      });
    }
    if (!result.articles.length) {
      const g = block.match(/class="overskrift">B&Oslash;YNING<\/span>\s*<span class="genus">([^<]*)<\/span>|class="overskrift">BØYNING<\/span>\s*<span class="genus">([^<]*)<\/span>/);
      const art = g ? plain(g[1] ?? g[2] ?? '').toLowerCase() : '';
      if (ARTICLES.includes(art)) result.articles = [art];
    }
  }

  // The headword itself is the indefinite singular of a noun (the infinitive
  // of a verb, the positive of an adjective).
  if (headword && !byKey.has(HEADWORD_KEY[kind]) && byKey.size > 0) {
    byKey.set(HEADWORD_KEY[kind], { primary: [headword], alternative: [] });
  }

  result.forms = (KEYS_OF[kind] as readonly NaobFormKey[]).filter((k) => byKey.has(k)).map((k) => ({
    form_key: k,
    primary_values: byKey.get(k)!.primary,
    alternative_values: byKey.get(k)!.alternative,
  }));
  if (result.invalid_values.length) result.status = 'invalid_value';
  result.definitions = parseNaobDefinitions(page, start);
  return result;
}

// Own explanations of the first article: the "inline-eske" texts of each
// "betydning", up to its first section (quotes, examples, expressions).
export function parseNaobDefinitions(page: string, start = 0): string[] {
  const from = page.indexOf('BETYDNING OG BRUK', start);
  if (from < 0) return [];
  const next = page.indexOf('class="oppslagsord"', from);
  const endArticle = page.indexOf('</article>', from);
  let end = page.length;
  if (next > 0) end = Math.min(end, next);
  if (endArticle > 0) end = Math.min(end, endArticle);
  const body = page.slice(from, end);
  const out: string[] = [];
  for (const chunk of body.split('class="betydning"').slice(1)) {
    const cut = chunk.search(/class="[^"]*(?:seksjon|underartikkel|uttrykk)[^"]*"/);
    const own = cut >= 0 ? chunk.slice(0, cut) : chunk;
    const parts = [...own.matchAll(/<div class="inline-eske">([\s\S]*?)<\/div>/g)]
      .map((m) => plain(m[1]).replace(/^[;,:\s]+/, '').trim())
      .filter(Boolean);
    const text = parts.join('; ').toLocaleLowerCase('nb-NO').replace(/\s+/g, ' ').trim();
    if (text) out.push(text);
  }
  return [...new Set(out)];
}

// Forms beyond the headword itself.
export function inflectedFormCount(article: NaobArticle): number {
  const headwordKey = HEADWORD_KEY[naobPosKind(article.pos)];
  return article.forms.filter((f) => f.form_key !== headwordKey).length;
}

export function formsSignature(article: NaobArticle): string {
  return [
    `art=${article.articles.join(',')}`,
    ...article.forms.map((f) => `${f.form_key}=${f.primary_values.join(',')}|${f.alternative_values.join(',')}`),
  ].join(';');
}

// --------------------------------------------------------------------------
// Decision for one card from the parsed NAOB articles of its part of speech.
// --------------------------------------------------------------------------
export type NaobDecision =
  | { status: 'forms'; forms: NaobForm[]; articles: string[]; genus: string | null; used: string[]; ignored: string[] }
  | { status: 'no_forms'; ignored: string[] }
  | { status: 'review'; reason: string; detail: unknown };

export function decideNaobForms(
  lemma: string,
  parsed: Array<{ slug: string; article: NaobArticle }>,
  naobPos = 'substantiv',
): NaobDecision {
  const want = normalizeWord(lemma);
  const usable: Array<{ slug: string; article: NaobArticle }> = [];
  const ignored: string[] = [];
  for (const p of parsed) {
    const a = p.article;
    if (a.status === 'multiple_paradigms' || a.status === 'invalid_value') {
      return { status: 'review', reason: `naob_article_${a.status}`, detail: { slug: p.slug, invalid: a.invalid_values } };
    }
    if (a.status !== 'ok' || a.headword !== want || a.pos !== naobPos) {
      ignored.push(p.slug);
      continue;
    }
    if (inflectedFormCount(a) === 0) {
      ignored.push(p.slug);   // only genus/article (vinterjakke): nothing to show
      continue;
    }
    usable.push(p);
  }
  if (!usable.length) return { status: 'no_forms', ignored };
  const signatures = new Set(usable.map((u) => formsSignature(u.article)));
  if (signatures.size > 1) {
    return {
      status: 'review', reason: 'naob_articles_forms_diverge',
      detail: usable.map((u) => ({ slug: u.slug, signature: formsSignature(u.article) })),
    };
  }
  const first = usable[0].article;
  return {
    status: 'forms', forms: first.forms, articles: first.articles, genus: first.genus,
    used: usable.map((u) => u.slug), ignored,
  };
}

// --------------------------------------------------------------------------
// D10 24.10.2026 (agreed): a noun without an Ordbøkene article is divided by
// its NAOB articles with THE SAME rule as Ordbøkene homographs
// (decideHomographs: R8 one card / R9 own card / review). Only the source
// differs: slug numbers, NAOB forms with the article (gender), NAOB
// explanations.
// --------------------------------------------------------------------------

export function slugNumber(slug: string): number {
  const m = String(slug).match(/_(\d+)$/);
  return m ? Number(m[1]) : 1;
}

// Forms of a NAOB article as one list: lemma, every listed value and the
// indefinite article as "#art:en" (different gender = different forms).
export function naobFormList(lemma: string, article: NaobArticle): string[] {
  const set = new Set<string>([normalizeWord(lemma)]);
  for (const f of article.forms) for (const v of [...f.primary_values, ...f.alternative_values]) set.add(v);
  for (const a of article.articles) set.add(`#art:${a}`);
  return [...set].sort();
}

// NAOB lists only some forms: the same article(s) and one list contained in
// the other = the same paradigm (R8).
export function naobSameForms(a: string[], b: string[]): boolean {
  const art = (x: string[]) => x.filter((v) => v.startsWith('#art:')).sort().join(',');
  if (art(a) !== art(b)) return false;
  // an article without own forms (only lemma + gender) is never "the same
  // paradigm": the R9 guard decides it (no own forms -> review)
  const words = (x: string[]) => x.filter((v) => !v.startsWith('#art:')).length;
  if (words(a) <= 1 || words(b) <= 1) return false;
  const sa = new Set(a), sb = new Set(b);
  return a.every((v) => sb.has(v)) || b.every((v) => sa.has(v));
}

export function naobParsedArticle(lemma: string, slug: string, article: NaobArticle): ParsedArticle | null {
  if (article.status !== 'ok' || article.headword !== normalizeWord(lemma) || article.pos !== 'substantiv') return null;
  return {
    articleId: slugNumber(slug),
    hgno: slugNumber(slug),
    forms: naobFormList(lemma, article),
    definitions: article.definitions,
    refArticleIds: [],
    uninflected: inflectedFormCount(article) === 0,
  };
}

export type NaobPlanEntry = HomographDecision & { slug: string; article: NaobArticle | null };

export function planNaobHomographs(
  lemma: string,
  parsed: Array<{ slug: string; article: NaobArticle }>,
): NaobPlanEntry[] {
  const bySlugNumber = new Map(parsed.map((p) => [slugNumber(p.slug), p]));
  const decisions = decideHomographs([], parsed.map((p) => ({
    articleId: slugNumber(p.slug), parsed: naobParsedArticle(lemma, p.slug, p.article),
  })), { sameForms: naobSameForms });
  return decisions.map((d) => {
    const p = bySlugNumber.get(d.articleId);
    return { ...d, slug: p?.slug ?? String(d.articleId), article: p?.article ?? null };
  });
}

// --------------------------------------------------------------------------
// D10 26.10.2026 (agreed): forms we build from the forms NAOB lists, each
// marked with its rule (shown with "≈"). Only these three; nothing else is
// invented. Not used to compare articles (R8/R9 compare source forms only).
//   verb:      presens = infinitive + r, only an infinitive in -e and not one
//              of the verbs with another presens (kan, vet, gjør, er ...);
//   adjective: bestemt form = flertall (store), bestemt superlativ =
//              superlativ + e (størst -> største), only a one-word -st form.
// An adjective without komparativ / superlativ in NAOB keeps no degrees:
// nothing is built for them (agreed: Norwegian has such adjectives).
// --------------------------------------------------------------------------
// infinitives in -e whose presens is not "+ r"
const OWN_PRESENT = new Set([
  'være', 'gjøre', 'spørre', 'vite', 'kunne', 'skulle', 'ville', 'måtte', 'burde', 'tørre',
]);
// adjectives whose bestemt form is not the flertall form (lille / små)
const OWN_DEFINITE = new Set(['liten']);

export function withDerivedNaobForms(lemma: string, naobPos: string, forms: NaobForm[]): NaobForm[] {
  const kind = naobPosKind(naobPos);
  const head = normalizeWord(lemma);
  const has = (key: NaobFormKey) => forms.some((f) => f.form_key === key);
  const get = (key: NaobFormKey) => forms.find((f) => f.form_key === key);
  const added: NaobForm[] = [];
  if (kind === 'verb') {
    if (!has('present') && (has('past') || has('past_participle')) && WORD.test(head) &&
        head.length > 2 && head.endsWith('e') && !OWN_PRESENT.has(head)) {
      added.push({ form_key: 'present', primary_values: [`${head}r`], alternative_values: [],
        derived_rule: 'present_infinitive_plus_r' });
    }
  }
  if (kind === 'adjective') {
    const plural = get('positive_plural_indefinite');
    if (!has('positive_definite') && plural && !OWN_DEFINITE.has(head)) {
      added.push({ form_key: 'positive_definite', primary_values: [...plural.primary_values],
        alternative_values: [...plural.alternative_values], derived_rule: 'definite_equals_plural' });
    }
    const sup = get('superlative');
    const st = (v: string) => WORD.test(v) && v.endsWith('st');
    if (!has('superlative_definite') && sup && sup.primary_values.length && sup.primary_values.every(st)) {
      added.push({ form_key: 'superlative_definite', primary_values: sup.primary_values.map((v) => `${v}e`),
        alternative_values: sup.alternative_values.filter(st).map((v) => `${v}e`),
        derived_rule: 'superlative_plus_e' });
    }
  }
  if (!added.length) return forms;
  const order = KEYS_OF[kind] as readonly NaobFormKey[];
  return [...forms, ...added].sort((a, b) => order.indexOf(a.form_key) - order.indexOf(b.form_key));
}
