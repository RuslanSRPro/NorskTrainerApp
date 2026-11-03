CREATE OR REPLACE FUNCTION public.d10_problem_cards_v1(p_limit integer DEFAULT 300)
 RETURNS TABLE(lexeme_id uuid, lemma text, pos text, display_form text, homograph_key text, missing_translation boolean, missing_example boolean, review_reason text, legacy boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  WITH learning AS (
    SELECT l.id FROM public.lexemes l WHERE l.is_learning_lexeme
  ), translated AS (
    SELECT DISTINCT t.lexeme_id
    FROM public.get_canonical_lexeme_translations_v1((SELECT coalesce(array_agg(id), '{}'::uuid[]) FROM learning)) t
    WHERE nullif(btrim(t.translation), '') IS NOT NULL
  ), cards AS (
    SELECT l.id, l.lemma, l.pos, l.display_form, coalesce(l.homograph_key, '') AS homograph_key, l.created_at,
      NOT EXISTS (SELECT 1 FROM translated tr WHERE tr.lexeme_id = l.id) AS missing_translation,
      NOT EXISTS (
        SELECT 1 FROM public.entity_examples e
        WHERE ((e.lexeme_id = l.id AND e.expression_id IS NULL)
          OR (e.expression_id IS NOT NULL AND e.lexeme_id IS NULL AND EXISTS (
            SELECT 1 FROM public.expression_catalog x WHERE x.id = e.expression_id AND x.lexeme_id = l.id)))
          AND e.language_code = 'nb'
          AND e.example_text ~ '[[:alpha:]]'
          AND e.example_text !~* '^[[:space:]]*(https?://|<)') AS missing_example
    FROM public.lexemes l
    WHERE l.is_learning_lexeme
  )
  SELECT c.id, c.lemma, c.pos, c.display_form, c.homograph_key, c.missing_translation, c.missing_example,
    rr.reason, coalesce(c.pos, 'unknown') = 'unknown'
  FROM cards c
  LEFT JOIN private.d10_ai_review_rejections_v1 rr ON rr.lexeme_id = c.id
  WHERE c.missing_translation OR c.missing_example
  ORDER BY c.missing_translation DESC, (coalesce(c.pos, 'unknown') = 'unknown'), c.created_at DESC, c.id
  LIMIT least(greatest(coalesce(p_limit, 300), 1), 1000);
$function$

