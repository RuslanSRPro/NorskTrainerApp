-- D10_naob_family_v5 (07.11.2026), test gripe: "gripe dypt i [pungen|lommene]" stayed at the gate.
-- The analysis puts the expression into the job without the square brackets
-- ("gripe dypt i pungen|lommene"), so the exact comparison in d10_naob_registered_expression_v1
-- failed. Now [ and ] are ignored when the item text is compared with the catalog lemma.
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
    AND lower(btrim(regexp_replace(translate(e.lemma, '[]', ''), '\s+', ' ', 'g')))
      = lower(btrim(regexp_replace(translate(p_query, '[]', ''), '\s+', ' ', 'g')))
    AND EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 b
                WHERE b.expression_id = e.id AND b.evidence ? 'naob')
$function$;
REVOKE ALL ON FUNCTION public.d10_naob_registered_expression_v1(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_naob_registered_expression_v1(uuid, text) TO service_role;

SELECT 'd10_naob_family_v5 installed' AS result,
  (SELECT public.d10_naob_registered_expression_v1(e.id, 'gripe dypt i pungen|lommene')
   FROM public.expression_catalog e WHERE e.lemma = 'gripe dypt i [pungen|lommene]' LIMIT 1) AS gripe_dypt_check;
