export type FormsReadModel = 'legacy' | 'v2';

export type FormsBundle = {
  verb_forms: Record<string, string>;
  noun_forms: Record<string, string>;
  adjective_forms: Record<string, string>;
  form_primary: Record<string, string[]>;
  form_alternatives: Record<string, string[]>;
  has_form_alternatives: boolean;
  regularity_marker: 'regular' | 'irregular' | 'suppletive' | 'unknown';
  forms_read_model: FormsReadModel;
};

export type LegacyFormRow = {
  id: string;
  lexeme_id: string;
  form_key: string | null;
  value: string;
  normalized_value: string | null;
  is_primary: boolean | null;
  variant_rank: number | null;
  source_priority: number | null;
  verification_status: string | null;
};

export type V2FormRow = {
  lexeme_id: string;
  form_key: string;
  primary_values: string[] | null;
  alternative_values: string[] | null;
  regularity_marker: FormsBundle['regularity_marker'] | null;
  display_order?: number | null;
};

const FORM_KEY_ALIASES: Record<string, string> = {
  infinitiv: 'infinitiv',
  infinitive: 'infinitiv',
  presens: 'presens',
  present: 'presens',
  preteritum: 'preteritum',
  preterite: 'preteritum',
  past: 'preteritum',
  perfektum: 'perfektum',
  present_perfect: 'perfektum',
  past_participle: 'perfektum',
  imperative: 'imperative',
  positiv: 'positiv',
  positive_singular_indefinite_common: 'positiv',
  intetkjonn: 'intetkjonn',
  positive_singular_indefinite_neuter: 'intetkjonn',
  flertall: 'flertall',
  positive_plural_indefinite: 'flertall',
  komparativ: 'komparativ',
  comparative: 'komparativ',
  superlativ: 'superlativ',
  superlative: 'superlativ',
  best_superlativ: 'best_superlativ',
  superlative_definite: 'best_superlativ',
  ubest_entall: 'ubest_entall',
  noun_singular_indefinite: 'ubest_entall',
  best_entall: 'best_entall',
  noun_singular_definite: 'best_entall',
  ubest_flertall: 'ubest_flertall',
  noun_plural_indefinite: 'ubest_flertall',
  best_flertall: 'best_flertall',
  noun_plural_definite: 'best_flertall',
};

const VERB_FORM_KEYS = new Set([
  'infinitiv',
  'presens',
  'preteritum',
  'perfektum',
  'imperative',
]);
const ADJECTIVE_FORM_KEYS = new Set([
  'positiv',
  'intetkjonn',
  'flertall',
  'komparativ',
  'superlativ',
  'best_superlativ',
]);
const NOUN_FORM_KEYS = new Set([
  'ubest_entall',
  'best_entall',
  'ubest_flertall',
  'best_flertall',
]);

export function buildV2Bundles(rows: V2FormRow[]): Map<string, FormsBundle> {
  const result = new Map<string, FormsBundle>();

  const orderedRows = rows
    .map((row, inputOrder) => ({ row, inputOrder }))
    .sort((left, right) =>
      left.row.lexeme_id.localeCompare(right.row.lexeme_id) ||
      nullableNumber(left.row.display_order ?? null) -
        nullableNumber(right.row.display_order ?? null) ||
      left.inputOrder - right.inputOrder,
    );

  for (const { row } of orderedRows) {
    const canonical = canonicalFormKey(row.form_key);
    if (!canonical) continue;
    const bundle = result.get(row.lexeme_id) ?? emptyBundle('v2');
    const primary = uniqueStrings(row.primary_values ?? []);
    const alternatives = uniqueStrings(row.alternative_values ?? []);

    const mergedPrimary = uniqueStrings([
      ...(bundle.form_primary[canonical] ?? []),
      ...primary,
    ]);
    const mergedAlternatives = uniqueStrings([
      ...(bundle.form_alternatives[canonical] ?? []),
      ...alternatives,
    ]).filter((value) => !mergedPrimary.includes(value));

    bundle.form_primary[canonical] = mergedPrimary;
    bundle.form_alternatives[canonical] = mergedAlternatives;
    bundle.has_form_alternatives ||= mergedAlternatives.length > 0;
    bundle.regularity_marker = combineRegularity(
      bundle.regularity_marker,
      row.regularity_marker ?? 'unknown',
    );
    // Compatibility fields intentionally expose only the first ordered
    // primary value. The complete source-backed arrays remain available via
    // form_primary/form_alternatives for a later, explicit UI design.
    setCompatibilityValue(bundle, canonical, mergedPrimary[0] ?? '');
    result.set(row.lexeme_id, bundle);
  }

  return result;
}

export function buildLegacyBundles(
  rows: LegacyFormRow[],
): Map<string, FormsBundle> {
  const grouped = new Map<string, LegacyFormRow[]>();
  for (const row of rows) {
    if (!row.lexeme_id || !row.form_key || !row.value) continue;
    const key = `${row.lexeme_id}|${canonicalFormKey(row.form_key) ?? ''}`;
    if (key.endsWith('|')) continue;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const result = new Map<string, FormsBundle>();
  for (const rowsForKey of grouped.values()) {
    rowsForKey.sort(compareLegacyRows);
    const first = rowsForKey[0];
    const canonical = canonicalFormKey(first.form_key ?? '');
    if (!canonical) continue;
    const bundle = result.get(first.lexeme_id) ?? emptyBundle('legacy');
    const primary = uniqueStrings(
      rowsForKey.filter((row) => row.is_primary === true).map((row) => row.value),
    );
    const selectedPrimary = primary.length > 0 ? primary : [first.value];
    const alternatives = uniqueStrings(
      rowsForKey
        .filter((row) => !selectedPrimary.includes(row.value))
        .map((row) => row.value),
    );

    bundle.form_primary[canonical] = selectedPrimary;
    bundle.form_alternatives[canonical] = alternatives;
    bundle.has_form_alternatives ||= alternatives.length > 0;
    setCompatibilityValue(bundle, canonical, selectedPrimary[0]);
    result.set(first.lexeme_id, bundle);
  }

  return result;
}

export function chunkValues<T>(values: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('Chunk size must be a positive integer');
  }

  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function collectPagedRows<T>(
  loadPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error('Page size must be a positive integer');
  }

  const rows: T[] = [];
  let from = 0;
  while (true) {
    const page = await loadPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
    from += pageSize;
  }
}

function compareLegacyRows(left: LegacyFormRow, right: LegacyFormRow): number {
  return booleanRank(right.is_primary) - booleanRank(left.is_primary) ||
    verificationRank(left.verification_status) -
      verificationRank(right.verification_status) ||
    nullableNumber(left.variant_rank) - nullableNumber(right.variant_rank) ||
    nullableNumber(left.source_priority) - nullableNumber(right.source_priority) ||
    String(left.normalized_value ?? left.value).localeCompare(
      String(right.normalized_value ?? right.value),
    ) || left.id.localeCompare(right.id);
}

function emptyBundle(readModel: FormsReadModel): FormsBundle {
  return {
    verb_forms: {},
    noun_forms: {},
    adjective_forms: {},
    form_primary: {},
    form_alternatives: {},
    has_form_alternatives: false,
    regularity_marker: 'unknown',
    forms_read_model: readModel,
  };
}

function setCompatibilityValue(
  bundle: FormsBundle,
  key: string,
  value: string,
): void {
  if (!value) return;
  if (VERB_FORM_KEYS.has(key)) bundle.verb_forms[key] ||= value;
  else if (ADJECTIVE_FORM_KEYS.has(key)) bundle.adjective_forms[key] ||= value;
  else if (NOUN_FORM_KEYS.has(key)) bundle.noun_forms[key] ||= value;
}

function canonicalFormKey(sourceKey: string): string | undefined {
  const exact = FORM_KEY_ALIASES[sourceKey];
  if (exact) return exact;

  // Ordbokene can attach gender/feature suffixes to noun and adjective
  // inflections. The compact product model groups those official variants
  // under one display row while retaining every value in form_primary.
  if (sourceKey.startsWith('noun_singular_indefinite_')) return 'ubest_entall';
  if (sourceKey.startsWith('noun_singular_definite_')) return 'best_entall';
  if (sourceKey.startsWith('noun_plural_indefinite_')) return 'ubest_flertall';
  if (sourceKey.startsWith('noun_plural_definite_')) return 'best_flertall';
  if (sourceKey.startsWith('positive_singular_indefinite_neuter')) {
    return 'intetkjonn';
  }
  if (sourceKey.startsWith('positive_singular_indefinite_')) return 'positiv';
  if (sourceKey.startsWith('positive_plural_indefinite')) return 'flertall';

  return undefined;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
}

function booleanRank(value: boolean | null): number {
  return value === true ? 2 : value === false ? 1 : 0;
}

function verificationRank(value: string | null): number {
  if (value === 'source_verified' || value === 'multi_source_verified') return 0;
  if (value === 'candidate') return 1;
  if (value === 'needs_review') return 2;
  return 3;
}

function nullableNumber(value: number | null): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : Number.MAX_SAFE_INTEGER;
}

function combineRegularity(
  current: FormsBundle['regularity_marker'],
  next: FormsBundle['regularity_marker'],
): FormsBundle['regularity_marker'] {
  const priority: FormsBundle['regularity_marker'][] = [
    'unknown',
    'regular',
    'irregular',
    'suppletive',
  ];
  return priority.indexOf(next) > priority.indexOf(current) ? next : current;
}
