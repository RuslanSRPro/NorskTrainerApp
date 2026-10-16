-- D10 15.10.2026 (agreed, rule R12): marker "≈" for an AI translation of a
-- word without its own Ordbøkene article.
-- Read-only helper for the app: for each requested lexeme and language, true
-- when the word's translation in that language comes ONLY from such an AI
-- translation (enrichment_evidence.status = 'ai_reviewed_no_article') and no
-- other source (Lexin, manual ...) has a translation in that language.
-- New function only; nothing existing is changed. Re-running is a no-op.

CREATE OR REPLACE FUNCTION public.get_lexeme_translation_approx_v1(p_lexeme_ids uuid[])
RETURNS TABLE(lexeme_id uuid, language_code text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
  SELECT DISTINCT t.lexeme_id, t.language_code
  FROM public.entity_translations t
  WHERE t.lexeme_id = ANY (coalesce(p_lexeme_ids, '{}'::uuid[]))
    AND t.expression_id IS NULL
    AND t.language_code IN ('uk', 'en')
    AND t.source = 'ai_fallback'
    AND t.translation_type = 'primary'
    AND t.enrichment_evidence->>'status' = 'ai_reviewed_no_article'
    AND nullif(btrim(t.translation), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.entity_translations o
      WHERE o.lexeme_id = t.lexeme_id
        AND o.expression_id IS NULL
        AND o.language_code = t.language_code
        AND o.translation_type IN ('primary', 'expression_primary')
        AND o.source IS DISTINCT FROM 'ai_fallback'
        AND nullif(btrim(o.translation), '') IS NOT NULL
    );
$body$;

REVOKE ALL ON FUNCTION public.get_lexeme_translation_approx_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lexeme_translation_approx_v1(uuid[]) TO anon, authenticated, service_role;
