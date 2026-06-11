import type { SourceCheck, LookupResult } from './types.ts';

export async function getCachedLookup(
  supabase: any,
  check: SourceCheck,
): Promise<LookupResult | null> {
  const { data, error } = await supabase.rpc('get_cached_source_lookup', {
    p_source: check.source,
    p_query_type: check.query_type,
    p_normalized_query: check.query,
  });

  if (error || !data) return null;

  return data.result_json as LookupResult;
}

export async function saveLookupCache(
  supabase: any,
  check: SourceCheck,
  result: LookupResult,
): Promise<void> {
  await supabase.rpc('save_source_lookup_cache', {
    p_source: check.source,
    p_query_type: check.query_type,
    p_normalized_query: check.query,
    p_status: result.status,
    p_quality: result.quality,
    p_result_json: result,
  });
}