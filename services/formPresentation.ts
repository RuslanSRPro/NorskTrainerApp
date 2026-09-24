export type MorphologyRegularity =
  | 'regular'
  | 'irregular'
  | 'suppletive'
  | 'unknown';

export type FormVariantGroup = {
  formKey: string;
  primaryValues: string[];
  alternativeValues: string[];
};

type FormWord = {
  form_primary?: Record<string, unknown> | null;
  form_alternatives?: Record<string, unknown> | null;
  regularity_marker?: string | null;
  forms_read_model?: string | null;
  accepted_articles?: unknown;
  type?: string | null;
  category?: string | null;
  pos?: string | null;
};

const NOUN_ARTICLE_ORDER = ['en', 'ei', 'et'] as const;

export function acceptedNounArticles(
  word: FormWord | null | undefined,
): string[] {
  const source = Array.isArray(word?.accepted_articles)
    ? word.accepted_articles.map(String)
    : [];
  const normalized = new Set(
    source.map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  return NOUN_ARTICLE_ORDER.filter((article) => normalized.has(article));
}

export function formatInfinitive(value: string): string {
  const bare = String(value || '').trim().replace(/^å\s+/i, '');
  return bare ? `å ${bare}` : '';
}

export function formatNounIndefinite(
  value: string,
  word: FormWord | null | undefined,
): string {
  const raw = String(value || '').trim();
  const bare = raw.replace(/^(en|ei|et)\s+/i, '').trim();
  const articles = acceptedNounArticles(word);
  return bare && articles.length > 0 ? `${articles.join('/')} ${bare}` : raw;
}

export function formatDisplayLemma(
  value: string,
  word: FormWord | null | undefined,
): string {
  const pos = String(word?.pos || word?.type || word?.category || '')
    .trim()
    .toLowerCase();
  if (pos.includes('verb')) return formatInfinitive(value);
  if (pos.includes('noun')) return formatNounIndefinite(value, word);
  return String(value || '').trim();
}

export function getFormTierValues(
  word: FormWord | null | undefined,
  formKey: string,
  fallbackValue = '',
): Pick<FormVariantGroup, 'primaryValues' | 'alternativeValues'> {
  if (word?.forms_read_model !== 'v2') {
    return {
      primaryValues: uniqueStrings([fallbackValue]),
      alternativeValues: [],
    };
  }

  const primaryValues = uniqueStrings(
    asStringArray(word?.form_primary?.[formKey]),
  );
  const resolvedPrimary = primaryValues.length > 0
    ? primaryValues
    : uniqueStrings([fallbackValue]);
  const primarySet = new Set(resolvedPrimary.map(normalizeValue));
  const alternativeValues = uniqueStrings(
    asStringArray(word?.form_alternatives?.[formKey]),
  ).filter((value) => !primarySet.has(normalizeValue(value)));

  return {
    primaryValues: resolvedPrimary,
    alternativeValues,
  };
}

export function collectFormVariantGroups(
  word: FormWord | null | undefined,
): FormVariantGroup[] {
  if (word?.forms_read_model !== 'v2') return [];

  const primary = word?.form_primary ?? {};
  const alternatives = word?.form_alternatives ?? {};
  const keys = [...new Set([...Object.keys(primary), ...Object.keys(alternatives)])]
    .sort();

  return keys.flatMap((formKey) => {
    const values = getFormTierValues(word, formKey);
    if (
      values.primaryValues.length < 2 &&
      values.alternativeValues.length === 0
    ) {
      return [];
    }
    return [{ formKey, ...values }];
  });
}

export function hasFormVariants(word: FormWord | null | undefined): boolean {
  return collectFormVariantGroups(word).length > 0;
}

export function isIrregularMorphology(
  word: FormWord | null | undefined,
): boolean {
  return word?.forms_read_model === 'v2' &&
    (word?.regularity_marker === 'irregular' ||
      word?.regularity_marker === 'suppletive');
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function uniqueStrings(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const rawValue of values) {
    const value = String(rawValue).trim();
    const normalized = normalizeValue(value);
    if (!value || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }
  return result;
}

function normalizeValue(value: string): string {
  return value.normalize('NFC').trim().toLocaleLowerCase('nb-NO');
}
