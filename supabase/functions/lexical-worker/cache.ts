import type { SourceCheck, LookupResult } from './types.ts';

// ФИКС (полная перезапись базы, 2026-07-08): версия адаптера бампнута,
// чтобы форсировать полную инвалидацию кэша на время массовой
// переверификации через seed_verification_refresh_batches.
//
// Причина: get_cached_source_lookup требует точного совпадения
// adapter_version (условие `c.adapter_version = p_adapter_version` в RPC).
// TTL (expires_at) в source_lookup_cache реально используется (не null),
// но на момент проверки только ~2% записей (309 из 19233) были просрочены
// — то есть подавляющее большинство кэша всё ещё считалось бы свежим и
// getCachedLookup отдавал бы СТАРЫЕ результаты вместо реального похода в
// источники, несмотря на цель "перепроверить и записать актуальные данные"
// по всей базе (которая на сегодня собрана из пяти разных этапов развития
// приложения).
//
// Смена версии здесь не трогает саму таблицу source_lookup_cache и не
// удаляет старые записи — они просто перестают совпадать по
// adapter_version и больше не выбираются RPC, поэтому лежат в базе как
// историческая органика. Новые lookup'ы, сделанные под этой версией,
// пишутся отдельным слоем и постепенно её заменяют.
//
// ВАЖНО: после того как массовая перезапись будет завершена и подтверждена
// — эту строку менять больше не нужно на постоянной основе. Держите эту
// версию как основную (не откатывайте на 'lexical-worker-v2-authoritative-
// relations') — иначе следующий обычный analyze-text снова начнёт
// совпадать со старым, потенциально устаревшим кэшем.
const LOOKUP_CACHE_ADAPTER_VERSION =
  'lexical-worker-v2-full-refresh-2026-07-08';

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