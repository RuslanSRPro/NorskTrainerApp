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
};

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
