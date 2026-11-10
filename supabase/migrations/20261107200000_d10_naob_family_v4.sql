-- D10_naob_family_v4 (07.11.2026), test gripe:
-- 1) 7 NAOB expressions stayed at the admission gate "not found as a whole word or expression":
--    a NAOB uttrykk has no own article, so the live NAOB check by phrase finds nothing.
--    Now lexical-worker answers the NAOB check of such an expression from the dictionary
--    evidence (catalog entry from NAOB + binding to the verb): found, registered, whole unit.
--    This function gives lexical-worker that evidence.
-- 2) "gripe ut av luften" (NAOB) = "gripe ut av lufta" (Ordbøkene): the comparison key now
--    treats the definite endings -a / -en of the words after the verb as the same.

CREATE OR REPLACE FUNCTION public.d10_naob_registered_expression_v1(p_expression_id uuid, p_query text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT jsonb_build_object(
      'slugs', coalesce((SELECT jsonb_agg(DISTINCT s) FROM private.lexeme360_expression_roots_v1 b,
                 jsonb_array_elements_text(coalesce(b.evidence->'naob'->'slugs', '[]'::jsonb)) s
               WHERE b.expression_id = e.id), '[]'::jsonb),
      'url', to_jsonb(e.source_urls)->>0)
  FROM public.expression_catalog e
  WHERE e.id = p_expression_id
    AND e.source_naob IS TRUE
    AND lower(btrim(regexp_replace(e.lemma, '\s+', ' ', 'g'))) = lower(btrim(regexp_replace(p_query, '\s+', ' ', 'g')))
    AND EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 b
                WHERE b.expression_id = e.id AND b.evidence ? 'naob')
$function$;
REVOKE ALL ON FUNCTION public.d10_naob_registered_expression_v1(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_naob_registered_expression_v1(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION private.d10_expr_match_keys_v1(p_text text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE
  v text;
  k_with text;
  k_without text;
BEGIN
  IF p_text IS NULL THEN RETURN '{}'; END IF;
  v := regexp_replace(lower(btrim(p_text)), '\s+', ' ', 'g');
  v := regexp_replace(v, '^å ', '');
  v := regexp_replace(v, '\[([^]|]*)\|[^]]*\]', '\1', 'g');           -- [a|b] -> a
  v := regexp_replace(v, '([[:alpha:]æøå]+)(/[[:alpha:]æøå]+)+', '\1', 'g'); -- a/b -> a
  k_with := regexp_replace(replace(replace(v, '(', ''), ')', ''), '\s+', ' ', 'g');
  k_without := regexp_replace(regexp_replace(v, '\([^)]*\)', ' ', 'g'), '\s+', ' ', 'g');
  RETURN ARRAY(
    SELECT DISTINCT (
      SELECT string_agg(CASE WHEN t.n > 1 AND length(t.w) > 3 AND t.w ~ 'a$'
                             THEN regexp_replace(t.w, 'a$', 'en') ELSE t.w END, ' ' ORDER BY t.n)
      FROM unnest(regexp_split_to_array(k2, ' ')) WITH ORDINALITY AS t(w, n))
    FROM (
      SELECT btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
        regexp_replace(regexp_replace(' ' || k || ' ',
          ' frem ', ' fram ', 'g'), ' sten ', ' stein ', 'g'), ' efter ', ' etter ', 'g'),
          ' nu ', ' nå ', 'g'), ' sne ', ' snø ', 'g'), ' hvad ', ' hva ', 'g')) AS k2
      FROM unnest(ARRAY[k_with, k_without]) AS k WHERE btrim(k) <> '') keys);
END $$;
REVOKE ALL ON FUNCTION private.d10_expr_match_keys_v1(text) FROM PUBLIC;

SELECT 'd10_naob_family_v4 installed' AS result,
  private.d10_expr_match_keys_v1('gripe ut av luften') && private.d10_expr_match_keys_v1('gripe ut av lufta') AS luften_lufta,
  private.d10_expr_match_keys_v1('gripe (inn) i (hverandre)') && private.d10_expr_match_keys_v1('gripe inn i hverandre') AS optional_parts,
  NOT (private.d10_expr_match_keys_v1('gripe feil') && private.d10_expr_match_keys_v1('gripe inn')) AS different_stay_different;
