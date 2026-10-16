-- 107_d10_ordbokene_cache_check.sql
-- Read only. After migration 20261015120000: T1 PASS. T2 shows how many
-- words the cache level can serve now (one cached article per word + POS).
SELECT 'T1 cache-level function exists' AS test,
       CASE WHEN to_regprocedure('public.d10_last_ordbokene_search_v1(text,text)') IS NOT NULL
             AND has_function_privilege('service_role', 'public.d10_last_ordbokene_search_v1(text,text)', 'EXECUTE')
            THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
SELECT 'T2 words with a usable cached search',
       count(DISTINCT c.normalized_query || '/' || c.adapter_version)::text
FROM public.source_lookup_cache c
WHERE c.source = 'Ordbokene' AND c.query_type = 'token'
  AND c.adapter_version LIKE 'lexical-worker-ordbokene-bm-pos-v1:%'
  AND c.status IN ('done', 'partial')
  AND c.result_json->'evidence'->'raw_preview'->>'lookup_scope' = 'e';
