import type { SourceCheck, LookupResult } from './types.ts';

const LOOKUP_CACHE_ADAPTER_VERSION =
  'lexical-worker-v2-authoritative-relations';

export async function getCachedLookup(
  supabase: any,
  check: SourceCheck,
): Promise<LookupResult | null> {
  const { data, error } = await supabase.rpc(
    'get_cached_source_lookup',
    {
      p_source: check.source,
      p_query: check.query,
      p_query_type: check.query_type,
      p_adapter_version:
        LOOKUP_CACHE_ADAPTER_VERSION,
    },
  );

  if (error || !data) {
    return null;
  }

  const result =
    data.result_json as
      | (LookupResult & {
          cache_schema_version?: number;
        })
      | null;

  if (!result) {
    return null;
  }

  // hard invalidate old cache payloads
  if (result.cache_schema_version !== 2) {
    return null;
  }

  // safety for old payloads
  if (!('authoritative_relations' in result)) {
    return null;
  }

  return result;
}

export async function saveLookupCache(
  supabase: any,
  check: SourceCheck,
  result: LookupResult,
): Promise<void> {
  await supabase.rpc(
    'save_source_lookup_cache',
    {
      p_source: check.source,

      p_query: check.query,

      p_query_type: check.query_type,

      p_status: result.status,

      p_quality: result.quality,

      p_result_json: {
        ...result,

        authoritative_relations:
          result.authoritative_relations ?? [],

        cache_schema_version: 2,
      },

      p_error_message:
        result.error ?? null,

      p_adapter_version:
        LOOKUP_CACHE_ADAPTER_VERSION,
    },
  );
}