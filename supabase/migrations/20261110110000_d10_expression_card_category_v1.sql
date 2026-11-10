-- D10_expression_category_label_v2 (10.11.2026, agreed): the card shows the expression category.
-- Read-only helper for the app: the checked category (expression_catalog.category) of each requested
-- expression card. New function only; nothing existing is changed. Re-running is a no-op.
CREATE OR REPLACE FUNCTION public.get_expression_card_categories_v1(p_lexeme_ids uuid[])
RETURNS TABLE(lexeme_id uuid, category text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
  SELECT DISTINCT ON (e.lexeme_id) e.lexeme_id, e.category
  FROM public.expression_catalog e
  WHERE e.lexeme_id = ANY (coalesce(p_lexeme_ids, '{}'::uuid[]))
    AND nullif(btrim(e.category), '') IS NOT NULL
  ORDER BY e.lexeme_id, e.category_updated_at DESC NULLS LAST, e.id;
$body$;
REVOKE ALL ON FUNCTION public.get_expression_card_categories_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_expression_card_categories_v1(uuid[]) TO anon, authenticated, service_role;

SELECT category, count(*) AS cards
FROM public.get_expression_card_categories_v1(ARRAY(SELECT id FROM public.lexemes WHERE pos = 'expression'))
GROUP BY category ORDER BY 2 DESC;
