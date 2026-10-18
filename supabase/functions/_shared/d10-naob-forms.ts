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

export const NAOB_NOUN_FORM_KEYS = [
  'noun_singular_indefinite',
  'noun_singular_definite',
  'noun_plural_indefinite',
  'noun_plural_definite',
] as const;
export type NaobNounFormKey = typeof NAOB_NOUN_FORM_KEYS[number];

export type NaobForm = {
  form_key: NaobNounFormKey;
  primary_values: string[];
  alternative_values: string[];
};

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
};

const ROW_LABELS: Record<string, NaobNounFormKey> = {
  'ubestemt form entall': 'noun_singular_indefinite',
  'bestemt form entall': 'noun_singular_definite',
  'ubestemt form flertall': 'noun_plural_indefinite',
  'bestemt form flertall': 'noun_plural_definite',
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
    forms: [], unknown_labels: [], invalid_values: [],
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

  const byKey = new Map<NaobNounFormKey, { primary: string[]; alternative: string[] }>();
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
    const key = ROW_LABELS[label];
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
      const key = SUMMARY_CLASSES[m[1]];
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

  // The headword itself is the indefinite singular of a noun.
  if (headword && !byKey.has('noun_singular_indefinite') && byKey.size > 0) {
    byKey.set('noun_singular_indefinite', { primary: [headword], alternative: [] });
  }

  result.forms = NAOB_NOUN_FORM_KEYS.filter((k) => byKey.has(k)).map((k) => ({
    form_key: k,
    primary_values: byKey.get(k)!.primary,
    alternative_values: byKey.get(k)!.alternative,
  }));
  if (result.invalid_values.length) result.status = 'invalid_value';
  return result;
}

// Forms beyond the headword itself.
export function inflectedFormCount(article: NaobArticle): number {
  return article.forms.filter((f) => f.form_key !== 'noun_singular_indefinite').length;
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
): NaobDecision {
  const want = normalizeWord(lemma);
  const usable: Array<{ slug: string; article: NaobArticle }> = [];
  const ignored: string[] = [];
  for (const p of parsed) {
    const a = p.article;
    if (a.status === 'multiple_paradigms' || a.status === 'invalid_value') {
      return { status: 'review', reason: `naob_article_${a.status}`, detail: { slug: p.slug, invalid: a.invalid_values } };
    }
    if (a.status !== 'ok' || a.headword !== want || a.pos !== 'substantiv') {
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
