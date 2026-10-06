BEGIN;
DO $guard$
BEGIN
  IF to_regprocedure('public.get_canonical_lexeme_examples_v1(uuid[])') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: canonical example RPC already exists; inspect instead of overwriting';
  END IF;
END;
$guard$;
CREATE FUNCTION public.get_canonical_lexeme_examples_v1(p_lexeme_ids uuid[])
RETURNS TABLE(lexeme_id uuid,id uuid,expression_id uuid,language_code text,example_text text,translation_uk text,source text,enrichment_evidence jsonb)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = ''
AS $example_rpc$
BEGIN
  IF p_lexeme_ids IS NULL OR cardinality(p_lexeme_ids)>200 OR array_position(p_lexeme_ids,NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'EXAMPLE_RPC_EXPLICIT_IDS_REQUIRED';
  END IF;
  RETURN QUERY
  SELECT scoped.id::uuid,e.id::uuid,e.expression_id::uuid,e.language_code::text,e.example_text::text,e.translation_uk::text,e.source::text,e.enrichment_evidence::jsonb
  FROM (SELECT DISTINCT u.id FROM unnest(p_lexeme_ids)AS u(id))AS requested
  JOIN public.lexemes AS scoped ON scoped.id=requested.id
  JOIN LATERAL (
    SELECT candidate.* FROM public.entity_examples AS candidate
    WHERE candidate.lexeme_id=scoped.id AND candidate.expression_id IS NULL
      AND candidate.language_code='nb'
      AND candidate.example_text ~ '[[:alpha:]]'
      AND candidate.example_text !~* '^[[:space:]]*(https?://|<)'
    ORDER BY (CASE WHEN candidate.source='ai_fallback' THEN 10 ELSE 0 END)
      +(CASE WHEN candidate.translation_uk ~ '[[:alpha:]]'
        AND candidate.translation_uk !~* '^[[:space:]]*(https?://|<)' THEN 0 ELSE 2 END), candidate.id
    LIMIT 1
  )AS e ON true
  ORDER BY scoped.id;
END;
$example_rpc$;
REVOKE ALL ON FUNCTION public.get_canonical_lexeme_examples_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_canonical_lexeme_examples_v1(uuid[]) TO anon,authenticated,service_role;
COMMIT;
