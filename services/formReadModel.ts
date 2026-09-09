import { supabase } from './supabase';
import {
  buildV2Bundles,
  chunkValues,
  collectPagedRows,
  type FormsBundle,
  type FormsReadModel,
  type V2FormRow,
} from './formReadModelCore';

export type { FormsBundle, FormsReadModel } from './formReadModelCore';

const FORM_QUERY_ID_BATCH_SIZE = 100;
const FORM_QUERY_PAGE_SIZE = 1000;

export function configuredFormsReadModel(): FormsReadModel {
  return 'v2';
}

export async function fetchFormsMap(
  lexemeIds: string[],
): Promise<Map<string, FormsBundle>> {
  const ids = [...new Set(lexemeIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  return await fetchV2FormsMap(ids);
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
