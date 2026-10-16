-- D10 15.10.2026 (agreed): cache level of the Ordbøkene outage fallback.
-- Article numbers of the LAST SUCCESSFUL exact Ordbøkene search of a word and
-- POS, from our lookup cache (public.source_lookup_cache, written by
-- lexical-worker). Expiry is ignored on purpose: it is used only while the
-- live search fails with a server error, and the articles themselves are
-- fetched fresh. Results of an outage fallback and inflected-form searches
-- (scope 'i') are not used. Read only; new function, nothing else changes.

CREATE OR REPLACE FUNCTION public.d10_last_ordbokene_search_v1(p_query text, p_pos text)
RETURNS TABLE(article_ids text[], checked_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
  SELECT ids.article_ids, c.checked_at
  FROM public.source_lookup_cache c
  CROSS JOIN LATERAL (
    SELECT array_agg(DISTINCT x ORDER BY x) AS article_ids
    FROM (
      SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(c.result_json->'evidence'->'raw_preview'->'article_ids') = 'array'
               THEN c.result_json->'evidence'->'raw_preview'->'article_ids' ELSE '[]'::jsonb END) AS x
      UNION
      SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(c.result_json->'evidence'->'raw_preview'->'candidate_article_ids') = 'array'
               THEN c.result_json->'evidence'->'raw_preview'->'candidate_article_ids' ELSE '[]'::jsonb END)
    ) s
    WHERE x ~ '^[1-9][0-9]*$'
  ) ids
  WHERE c.source = 'Ordbokene'
    AND c.query_type = 'token'
    AND c.normalized_query = lower(btrim(p_query))
    AND c.adapter_version = 'lexical-worker-ordbokene-bm-pos-v1:' || coalesce(p_pos, 'unknown')
    AND c.status IN ('done', 'partial')
    AND c.result_json->'evidence'->'raw_preview'->>'dictionary_code' = 'bm'
    AND c.result_json->'evidence'->'raw_preview'->>'lookup_scope' = 'e'
    AND coalesce(c.result_json->'evidence'->'raw_preview'->>'lookup_fallback', '') = ''
    AND cardinality(ids.article_ids) > 0
  ORDER BY c.checked_at DESC
  LIMIT 1;
$body$;

REVOKE ALL ON FUNCTION public.d10_last_ordbokene_search_v1(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_last_ordbokene_search_v1(text, text) TO service_role;
