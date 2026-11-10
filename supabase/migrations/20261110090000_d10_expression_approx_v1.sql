-- D10_expression_approx_v1 (09.11.2026, agreed: NAOB variant 2)
-- An expression confirmed by a dictionary as a whole unit, but without its own
-- explanation in Ordbøkene or NAOB (also after following "se ..."), gets an AI
-- translation marked "≈" (enrichment_evidence.status = 'ai_reviewed_no_definition').
-- 1) publish: such rows are written with confidence 'low' (otherwise unchanged);
-- 2) "≈" marker: also for expression cards whose shown translation is such a row.
-- Re-running is a no-op.
BEGIN;

CREATE OR REPLACE FUNCTION public.d10_publish_expression_enrichment_v2(
  p_expression_id uuid, p_translations jsonb, p_example jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public' AS $$
DECLARE tr jsonb;
BEGIN
  IF jsonb_array_length(p_translations)<>2 OR
    (SELECT count(DISTINCT x->>'language_code') FROM jsonb_array_elements(p_translations) x WHERE x->>'language_code' IN ('uk','en'))<>2
    THEN RAISE EXCEPTION 'EXPRESSION_TWO_LANGUAGES_REQUIRED'; END IF;
  PERFORM 1 FROM public.expression_catalog WHERE id=p_expression_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXPRESSION_NOT_FOUND'; END IF;
  FOR tr IN SELECT value FROM jsonb_array_elements(p_translations) LOOP
    IF nullif(btrim(tr->>'translation'),'') IS NULL OR
       (tr#>>'{enrichment_evidence,expression_binding,expression_id}') IS DISTINCT FROM p_expression_id::text OR
       (tr#>>'{enrichment_evidence,expression_binding,translation}') IS DISTINCT FROM (tr->>'translation') OR
       (tr#>>'{enrichment_evidence,review,status}') IS DISTINCT FROM 'accepted' OR
       (tr#>>'{enrichment_evidence,expression_review_version}') IS DISTINCT FROM 'd10_expression_review_v2'
       THEN RAISE EXCEPTION 'EXPRESSION_TRANSLATION_REVIEW_REQUIRED'; END IF;
  END LOOP;
  IF nullif(btrim(p_example->>'example_text'),'') IS NULL OR nullif(btrim(p_example->>'translation_uk'),'') IS NULL OR
     (p_example#>>'{enrichment_evidence,expression_binding,expression_id}') IS DISTINCT FROM p_expression_id::text OR
     (p_example#>>'{enrichment_evidence,review,status}') IS DISTINCT FROM 'accepted' OR
     (p_example#>>'{enrichment_evidence,example_highlights,nb,text}') IS DISTINCT FROM (p_example->>'example_text') OR
     (p_example#>>'{enrichment_evidence,example_highlights,uk,text}') IS DISTINCT FROM (p_example->>'translation_uk')
     THEN RAISE EXCEPTION 'EXPRESSION_EXAMPLE_REVIEW_REQUIRED'; END IF;
  -- Both translations and the example commit together. Source-extracted rows remain intact.
  DELETE FROM public.entity_translations WHERE expression_id=p_expression_id AND source='ai_fallback'
    AND language_code IN ('uk','en') AND translation_type IN ('primary','expression_primary');
  DELETE FROM public.entity_examples WHERE expression_id=p_expression_id AND source='ai_fallback' AND language_code='nb';
  FOR tr IN SELECT value FROM jsonb_array_elements(p_translations) LOOP
    INSERT INTO public.entity_translations(expression_id,language_code,translation,translation_type,translation_rank,source,source_pos,confidence,enrichment_evidence,updated_at)
    VALUES(p_expression_id,tr->>'language_code',tr->>'translation','expression_primary',1,'ai_fallback','expression',
      -- D10 09.11.2026: no explanation anywhere -> "≈", low confidence
      CASE WHEN tr#>>'{enrichment_evidence,status}'='ai_reviewed_no_definition' THEN 'low' ELSE 'medium' END,
      tr->'enrichment_evidence',now());
  END LOOP;
  INSERT INTO public.entity_examples(expression_id,language_code,example_text,translation_uk,source,source_type,enrichment_evidence,updated_at)
  VALUES(p_expression_id,'nb',p_example->>'example_text',p_example->>'translation_uk','ai_fallback','ai_example',p_example->'enrichment_evidence',now());
  RETURN jsonb_build_object('translations_written',2,'example_written',true);
END;
$$;
REVOKE ALL ON FUNCTION public.d10_publish_expression_enrichment_v2(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.d10_publish_expression_enrichment_v2(uuid,jsonb,jsonb) TO service_role;

-- Same signature and word branch as v1 (20261015100000); the expression branch
-- follows get_canonical_lexeme_translations_v1: a current expression row is the
-- one shown, so "≈" when the shown current row has no explanation behind it.
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
    )
  UNION
  SELECT e.lexeme_id, t.language_code
  FROM public.expression_catalog e
  JOIN public.entity_translations t ON t.expression_id = e.id AND t.lexeme_id IS NULL
  WHERE e.lexeme_id = ANY (coalesce(p_lexeme_ids, '{}'::uuid[]))
    AND t.language_code IN ('uk', 'en')
    AND t.translation_type IN ('primary', 'expression_primary')
    AND t.enrichment_evidence->>'expression_review_version' = 'd10_expression_review_v2'
    AND t.enrichment_evidence->'review'->>'status' = 'accepted'
    AND t.enrichment_evidence->>'status' = 'ai_reviewed_no_definition'
    AND nullif(btrim(t.translation), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.expression_catalog e2
      JOIN public.entity_translations o ON o.expression_id = e2.id AND o.lexeme_id IS NULL
      WHERE e2.lexeme_id = e.lexeme_id
        AND o.language_code = t.language_code
        AND o.translation_type IN ('primary', 'expression_primary')
        AND o.enrichment_evidence->>'expression_review_version' = 'd10_expression_review_v2'
        AND o.enrichment_evidence->'review'->>'status' = 'accepted'
        AND o.enrichment_evidence->>'status' IS DISTINCT FROM 'ai_reviewed_no_definition'
        AND nullif(btrim(o.translation), '') IS NOT NULL
    );
$body$;

REVOKE ALL ON FUNCTION public.get_lexeme_translation_approx_v1(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_lexeme_translation_approx_v1(uuid[]) TO anon, authenticated, service_role;

COMMIT;

SELECT 'D10_expression_approx_v1 installed' AS result,
  (SELECT count(*) FROM public.entity_translations
    WHERE enrichment_evidence->>'status'='ai_reviewed_no_definition') AS approx_expression_rows;
