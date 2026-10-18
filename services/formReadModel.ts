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

  const forms = await fetchV2FormsMap(ids);
  // D10 15.10.2026: a compound word without its own Ordbøkene article gets
  // forms built from its head card (vinterjakke <- jakke). Read only for
  // words with no V2 rows at all, so one word never mixes two sources.
  const withoutForms = ids.filter((id) => !forms.has(id));
  if (withoutForms.length > 0) {
    try {
      for (const [id, bundle] of await fetchCompoundHeadFormsMap(withoutForms)) {
        forms.set(id, bundle);
      }
    } catch (error) {
      // An addition only: without it the word simply has no forms, as before.
      console.warn('[forms] compound head forms unavailable', error);
    }
  }
  // D10 16.10.2026: a noun with neither of the above gets the forms NAOB
  // lists in its article (brenne <- brennen, brenner). Same rule: read only
  // for words with no forms yet, never mixed with another source.
  const withoutAny = ids.filter((id) => !forms.has(id));
  if (withoutAny.length > 0) {
    try {
      for (const [id, bundle] of await fetchNaobFormsMap(withoutAny)) {
        forms.set(id, bundle);
      }
    } catch (error) {
      // An addition only: without it the word simply has no forms, as before.
      console.warn('[forms] NAOB forms unavailable', error);
    }
  }
  return forms;
}

async function fetchNaobFormsMap(
  lexemeIds: string[],
): Promise<Map<string, FormsBundle>> {
  const rows: V2FormRow[] = [];
  for (const idBatch of chunkValues(lexemeIds, FORM_QUERY_ID_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('lexeme_naob_forms_v1')
      .select(
        'lexeme_id, form_key, primary_values, alternative_values, accepted_articles, regularity_marker, display_order',
      )
      .in('lexeme_id', idBatch)
      .order('lexeme_id', { ascending: true })
      .order('display_order', { ascending: true });
    if (error) throw new Error(`fetchNaobFormsMap failed: ${error.message}`);
    for (const row of (data ?? []) as any[]) {
      rows.push({ ...row, is_compound: false, morphology_source_lemma: null } as V2FormRow);
    }
  }
  const bundles = buildV2Bundles(rows);
  for (const bundle of bundles.values()) bundle.forms_source = 'naob';
  return bundles;
}

async function fetchCompoundHeadFormsMap(
  lexemeIds: string[],
): Promise<Map<string, FormsBundle>> {
  const rows: V2FormRow[] = [];
  for (const idBatch of chunkValues(lexemeIds, FORM_QUERY_ID_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from('lexeme_compound_head_forms_v1')
      .select(
        'lexeme_id, form_key, primary_values, alternative_values, accepted_articles, regularity_marker, display_order, compound_parts, headword',
      )
      .in('lexeme_id', idBatch)
      .order('lexeme_id', { ascending: true })
      .order('display_order', { ascending: true });
    if (error) throw new Error(`fetchCompoundHeadFormsMap failed: ${error.message}`);
    for (const row of (data ?? []) as any[]) {
      rows.push({ ...row, is_compound: true, morphology_source_lemma: null } as V2FormRow);
    }
  }
  const bundles = buildV2Bundles(rows);
  for (const bundle of bundles.values()) bundle.forms_by_head = true;
  return bundles;
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
          'lexeme_id, form_key, primary_values, alternative_values, accepted_articles, regularity_marker, display_order, is_compound, compound_parts, headword, morphology_source_lemma',
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
