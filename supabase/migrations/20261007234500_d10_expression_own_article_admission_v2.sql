-- Admit existing non-learning expression lexemes only from their own exact BM
-- article and job-scoped source check. dictionary_entry is valid when it
-- belongs to that own article. No token or homonym logic is changed.
BEGIN;

CREATE OR REPLACE FUNCTION public.d10_admit_own_article_job_expressions_page_v2(
  p_job_id uuid, p_offset integer, p_limit integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_expression_ids uuid[] := '{}'::uuid[];
  v_next_offset integer;
  v_has_more boolean;
BEGIN
  IF p_job_id IS NULL OR p_offset IS NULL OR p_offset < 0
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'INVALID_OWN_ARTICLE_ADMISSION_PAGE';
  END IF;

  WITH job_expressions AS MATERIALIZED (
    SELECT DISTINCT i.expression_id AS id
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.expression_id IS NOT NULL
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
  ), page AS MATERIALIZED (
    SELECT id FROM job_expressions ORDER BY id OFFSET p_offset LIMIT p_limit
  ), eligible AS MATERIALIZED (
    SELECT e.id AS expression_id, e.lexeme_id
    FROM page p
    JOIN public.expression_catalog e ON e.id = p.id
    JOIN public.lexemes l ON l.id = e.lexeme_id
    CROSS JOIN LATERAL (
      SELECT count(DISTINCT c.candidate_article_id::text) AS article_count,
        count(DISTINCT c.parent_article_id::text) AS parent_count,
        min(c.candidate_article_id::text) AS article_id,
        min(c.parent_article_id::text) AS parent_article_id
      FROM public.ordbokene_expression_candidates c
      WHERE c.promoted_expression_id = e.id
        AND lower(btrim(c.normalized_key)) = lower(btrim(e.normalized_key))
        AND upper(c.candidate_dictionary_code) = 'BM'
        AND upper(c.parent_dictionary_code) = 'BM'
        AND c.candidate_kind = 'expression'
        AND c.status IN ('promoted', 'duplicate')
        AND c.candidate_article_id IS NOT NULL
        AND c.parent_article_id IS NOT NULL
    ) article
    WHERE (e.expression_subtype = 'ordbokene_sub_article'
           OR e.expression_subtype IS NULL)
      AND e.verification_status IN ('authoritative', 'multi_source')
      AND l.pos = 'expression'
      AND l.verification_tier IN ('dictionary_match', 'dictionary_entry')
      AND l.dictionary_status = 'active'
      AND l.dictionary_exclusion_reason IS NULL
      AND l.is_learning_lexeme = false
      AND lower(btrim(l.lemma)) = lower(btrim(e.lemma))
      AND article.article_count = 1 AND article.parent_count = 1
      AND upper(l.verification_evidence->'Ordbokene'->>'dictionary_code') = 'BM'
      AND l.verification_evidence->'Ordbokene'->>'article_id' = article.article_id
      AND l.verification_evidence->'Ordbokene'->>'parent_article_id' = article.parent_article_id
      AND l.verification_evidence->'Ordbokene'->'evidence'->>'article_id' = article.article_id
      AND EXISTS (
        SELECT 1 FROM private.lexeme360_expression_roots_v1 b
        WHERE b.expression_id = e.id
          AND b.dictionary_code = 'bm'
          AND b.source_article_id::text = article.parent_article_id
      )
      AND EXISTS (
        SELECT 1
        FROM public.lexeme_processing_items own_item
        JOIN public.lexeme_source_checks sc ON sc.item_id = own_item.id
        WHERE own_item.job_id = p_job_id
          AND own_item.expression_id = e.id
          AND own_item.result_summary->>'promotion_status' = 'expression_promoted'
          AND sc.job_id = p_job_id
          AND sc.source = 'Ordbokene' AND sc.query_type = 'expression'
          AND sc.status = 'done' AND sc.found IS TRUE
          AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
          AND lower(btrim(sc.query)) = lower(btrim(e.lemma))
          AND lower(btrim(sc.evidence->>'canonical_query')) = lower(btrim(e.lemma))
          AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
          AND sc.evidence->'raw_preview'->>'lookup_scope' = 'candidate_article'
          AND sc.evidence->'raw_preview'->>'parent_article_id' = article.parent_article_id
          AND CASE
            WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
            THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
              AND sc.evidence->'raw_preview'->'article_ids'->>0 = article.article_id
            ELSE false
          END
      )
  ), enabled AS (
    UPDATE public.lexemes l
    SET is_learning_lexeme = true, updated_at = now()
    FROM eligible e
    WHERE l.id = e.lexeme_id AND l.is_learning_lexeme = false
    RETURNING e.expression_id
  )
  SELECT coalesce(array_agg(expression_id), '{}'::uuid[])
  INTO v_expression_ids FROM enabled;

  IF cardinality(v_expression_ids) > 0 THEN
    PERFORM private.refresh_lexeme360_binding_set_v1(
      '{}'::uuid[], v_expression_ids
    );
  END IF;

  WITH job_expressions AS MATERIALIZED (
    SELECT DISTINCT i.expression_id AS id
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.expression_id IS NOT NULL
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
  ), page AS (
    SELECT id FROM job_expressions ORDER BY id OFFSET p_offset LIMIT p_limit
  )
  SELECT p_offset + count(*)::integer,
    EXISTS (SELECT 1 FROM job_expressions ORDER BY id
            OFFSET (p_offset + p_limit) LIMIT 1)
  INTO v_next_offset, v_has_more FROM page;

  RETURN jsonb_build_object('ok', true, 'job_id', p_job_id,
    'admitted', cardinality(v_expression_ids), 'next_offset', v_next_offset,
    'has_more', v_has_more, 'version', 'd10_expression_own_article_admission_v2');
END;
$function$;

REVOKE ALL ON FUNCTION public.d10_admit_own_article_job_expressions_page_v2(uuid,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_admit_own_article_job_expressions_page_v2(uuid,integer,integer)
  TO service_role;

-- The reviewed canary already completed its chains. Reuse the same strict
-- admission guard and refresh only these four expression projections.
DO $backfill$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.d10_admit_own_article_job_expressions_page_v2(
    '37f10b68-fc30-4540-b9c5-7cf7e0641723'::uuid, 0, 10
  );
  IF v_result->>'admitted' <> '4'
     OR v_result->>'has_more' <> 'false' THEN
    RAISE EXCEPTION 'STOP: canary admission changed: %', v_result;
  END IF;
END;
$backfill$;
COMMIT;
