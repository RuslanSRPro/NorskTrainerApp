-- Appended example evidence; no new data tables. No CASCADE: unexpected dependencies abort migration.
BEGIN;
DROP FUNCTION public.get_lexeme360_examples_v1(uuid[],uuid[]);
CREATE OR REPLACE FUNCTION public.get_lexeme360_examples_v1(
  p_lexeme_ids uuid[] DEFAULT '{}'::uuid[],
  p_expression_ids uuid[] DEFAULT '{}'::uuid[]
) RETURNS TABLE(lexeme_id uuid, expression_id uuid, id uuid,
  example_text text, translation_uk text, source text, cefr_level text, enrichment_evidence jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public'
AS $body$
  WITH requested_lexemes AS (
    SELECT DISTINCT id FROM unnest(coalesce(p_lexeme_ids,'{}'::uuid[])) id
  ), requested_expressions AS (
    SELECT DISTINCT id FROM unnest(coalesce(p_expression_ids,'{}'::uuid[])) id
  ), candidates AS (
    SELECT coalesce(e.lexeme_id, mapped.lexeme_id) AS resolved_lexeme_id,
      e.expression_id,e.id,e.example_text,e.translation_uk,e.source,NULL::text AS cefr_level,e.enrichment_evidence,
      row_number() OVER (PARTITION BY coalesce(e.lexeme_id,mapped.lexeme_id),e.expression_id
      ORDER BY CASE WHEN e.source='ai_fallback' THEN 10 ELSE 0 END,
        CASE WHEN e.translation_uk ~ '[[:alpha:]]' THEN 0 ELSE 2 END,e.id) AS rank
    FROM public.entity_examples e
    LEFT JOIN public.expression_catalog mapped ON mapped.id=e.expression_id
    WHERE e.language_code='nb' AND e.example_text ~ '[[:alpha:]]'
      AND e.example_text !~* '^[[:space:]]*(https?://|<)'
      AND (coalesce(e.lexeme_id,mapped.lexeme_id) IN (SELECT id FROM requested_lexemes)
        OR e.expression_id IN (SELECT id FROM requested_expressions))
  )
  SELECT c.resolved_lexeme_id,c.expression_id,c.id,c.example_text,c.translation_uk,c.source,c.cefr_level,c.enrichment_evidence
  FROM candidates c WHERE c.rank<=3
  ORDER BY coalesce(c.resolved_lexeme_id,c.expression_id),c.rank;
$body$;
REVOKE ALL ON FUNCTION public.get_lexeme360_examples_v1(uuid[],uuid[]) FROM PUBLIC;
-- Preserve the live function's existing grants (including anon).
GRANT EXECUTE ON FUNCTION public.get_lexeme360_examples_v1(uuid[],uuid[]) TO anon,authenticated,service_role;
COMMIT;
