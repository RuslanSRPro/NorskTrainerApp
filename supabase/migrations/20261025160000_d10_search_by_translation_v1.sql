-- D10 25.10.2026 (agreed): reverse search in the app ("книга" / "book" ->
-- the cards whose translation is exactly that word). Read only.
-- A card matches when one of its primary translation rows (uk or en) is the
-- word, ignoring case and spaces (canonical_translation or translation, the
-- same fields the app shows). Expression translations count for their card.
-- Only learning cards, at most 20.
CREATE OR REPLACE FUNCTION public.d10_lexemes_by_translation_v1(p_text text, p_language text)
RETURNS TABLE(lexeme_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
  WITH wanted AS (
    SELECT lower(regexp_replace(btrim(coalesce(p_text, '')), '\s+', ' ', 'g')) AS w
  ), hits AS (
    SELECT coalesce(t.lexeme_id, x.lexeme_id) AS lexeme_id
    FROM public.entity_translations t
    LEFT JOIN public.expression_catalog x ON x.id = t.expression_id AND t.lexeme_id IS NULL
    CROSS JOIN wanted
    WHERE p_language IN ('uk', 'en') AND wanted.w <> ''
      AND t.language_code = p_language
      AND t.translation_type IN ('primary', 'expression_primary')
      AND (lower(regexp_replace(btrim(coalesce(nullif(t.canonical_translation, ''), t.translation)), '\s+', ' ', 'g')) = wanted.w
        OR lower(regexp_replace(btrim(t.translation), '\s+', ' ', 'g')) = wanted.w)
  )
  SELECT DISTINCT h.lexeme_id
  FROM hits h
  JOIN public.lexemes l ON l.id = h.lexeme_id AND l.is_learning_lexeme
  LIMIT 20;
$body$;
REVOKE ALL ON FUNCTION public.d10_lexemes_by_translation_v1(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.d10_lexemes_by_translation_v1(text, text) TO authenticated, service_role;
