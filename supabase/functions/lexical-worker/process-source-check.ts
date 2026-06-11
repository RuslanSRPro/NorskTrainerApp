import type { SourceCheck, LookupResult } from './types.ts';
import { getCachedLookup, saveLookupCache } from './cache.ts';
import { lookupSource } from './adapters.ts';

export async function processSourceCheck(
  supabase: any,
  check: SourceCheck,
): Promise<void> {
  let result: LookupResult | null = await getCachedLookup(supabase, check);

  if (!result) {
    result = await lookupSource(check);
    await saveLookupCache(supabase, check, result);
  }

  const evidence = {
    ...(result.evidence ?? {}),
    registered_entry: result.registered_entry ?? false,
    whole_unit_match: result.whole_unit_match ?? false,
    component_match: result.component_match ?? false,
    usage_match: result.usage_match ?? false,
  };

  const { error } = await supabase.rpc('update_lexeme_source_check_status', {
    p_check_id: check.id,
    p_status: result.status,
    p_quality: result.quality,
    p_found: result.found,
    p_error_code: result.error ? 'lookup_error' : null,
    p_error_message: result.error ?? null,
    p_evidence: evidence,
    p_urls: result.urls ?? [],
  });

  if (error) {
    throw new Error(
      `update_lexeme_source_check_status failed for ${check.id}: ${error.message}`,
    );
  }
}