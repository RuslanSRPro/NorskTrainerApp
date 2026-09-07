import { supabase } from './supabase';
import {
  buildLegacyBundles,
  buildV2Bundles,
  chunkValues,
  collectPagedRows,
  type FormsBundle,
  type FormsReadModel,
  type LegacyFormRow,
  type V2FormRow,
} from './formReadModelCore';

export type { FormsBundle, FormsReadModel } from './formReadModelCore';

const FORM_QUERY_ID_BATCH_SIZE = 100;
const FORM_QUERY_PAGE_SIZE = 1000;

export function configuredFormsReadModel(): FormsReadModel {
  return process.env.EXPO_PUBLIC_FORMS_READ_MODEL === 'v2' ? 'v2' : 'legacy';
}

export async function fetchFormsMap(
  lexemeIds: string[],
): Promise<Map<string, FormsBundle>> {
  const ids = [...new Set(lexemeIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  return configuredFormsReadModel() === 'v2'
    ? await fetchV2FormsMap(ids)
    : await fetchLegacyFormsMap(ids);
}

async function fetchV2FormsMap(
  lexemeIds: string[],
): Promise<Map<string, FormsBundle>> {
  const rows: V2FormRow[] = [];

  for (const idBatch of chunkValues(lexemeIds, FORM_QUERY_ID_BATCH_SIZE)) {
    const batchRows = await collectPagedRows<V2FormRow>(async (from, to) => {
      const { data, error } = await supabase
        .from('lexeme_form_display_v2')
        .select(
          'lexeme_id, form_key, primary_values, alternative_values, regularity_marker, display_order',
        )
        .in('lexeme_id', idBatch)
        .eq('dictionary_code', 'bm')
        .order('lexeme_id', { ascending: true })
        .order('display_order', { ascending: true })
        .order('form_key', { ascending: true })
        .range(from, to);

      if (error) {
        // Deliberately no legacy fallback: one application request uses
        // exactly one read model and can never mix V1/V2 forms.
        throw new Error(`fetchV2FormsMap failed: ${error.message}`);
      }
      return (data ?? []) as V2FormRow[];
    }, FORM_QUERY_PAGE_SIZE);
    rows.push(...batchRows);
  }

  return buildV2Bundles(rows);
}

async function fetchLegacyFormsMap(
  lexemeIds: string[],
): Promise<Map<string, FormsBundle>> {
  const rows: LegacyFormRow[] = [];

  for (const idBatch of chunkValues(lexemeIds, FORM_QUERY_ID_BATCH_SIZE)) {
    const batchRows = await collectPagedRows<LegacyFormRow>(async (from, to) => {
      const { data, error } = await supabase
        .from('lexeme_form_variants')
        .select(
          'id, lexeme_id, form_key, value, normalized_value, is_primary, variant_rank, source_priority, verification_status',
        )
        .in('lexeme_id', idBatch)
        // PostgreSQL row order is undefined without ORDER BY. These
        // tie-breakers keep legacy behavior deterministic until its readers
        // are retired.
        .order('lexeme_id', { ascending: true })
        .order('form_key', { ascending: true })
        .order('is_primary', { ascending: false, nullsFirst: false })
        .order('variant_rank', { ascending: true, nullsFirst: false })
        .order('source_priority', { ascending: true, nullsFirst: false })
        .order('normalized_value', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`fetchLegacyFormsMap failed: ${error.message}`);
      }
      return (data ?? []) as LegacyFormRow[];
    }, FORM_QUERY_PAGE_SIZE);
    rows.push(...batchRows);
  }

  return buildLegacyBundles(rows);
}
