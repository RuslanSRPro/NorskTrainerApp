-- Project an expression's OWN exact Bokmål source check to its lexeme.
-- Never use the root lexeme or a catalog status alone as article evidence.
BEGIN;

CREATE OR REPLACE FUNCTION public.d10_project_expression_own_article_page_v1(
  p_job_id uuid, p_offset integer, p_limit integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_projected integer := 0;
BEGIN
  IF p_job_id IS NULL OR p_offset IS NULL OR p_offset < 0
     OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'invalid expression projection page';
  END IF;

  WITH job_expressions AS MATERIALIZED (
    SELECT DISTINCT i.expression_id AS id
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.expression_id IS NOT NULL
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
  ), page AS MATERIALIZED (
    SELECT id FROM job_expressions ORDER BY id OFFSET p_offset LIMIT p_limit
  ), eligible AS MATERIALIZED (
    SELECT e.id AS expression_id, e.lexeme_id, e.verification_status,
      e.source_verified, article.article_id, article.parent_article_id,
      own_check.evidence AS source_evidence
    FROM page p
    JOIN public.expression_catalog e ON e.id = p.id
    JOIN public.lexemes l ON l.id = e.lexeme_id
    CROSS JOIN LATERAL (
      SELECT count(DISTINCT c.candidate_article_id::text) AS article_count,
        count(DISTINCT c.parent_article_id::text) AS parent_count,
        min(c.candidate_article_id::text) AS article_id,
        min(c.parent_article_id::bigint) AS parent_article_id
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
    JOIN LATERAL (
      SELECT sc.evidence
      FROM public.lexeme_processing_items own_item
      JOIN public.lexeme_source_checks sc ON sc.item_id = own_item.id
      WHERE own_item.job_id = p_job_id
        AND own_item.expression_id = e.id
        AND sc.source = 'Ordbokene' AND sc.query_type = 'expression'
        AND sc.status = 'done' AND sc.found IS TRUE
        AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
        AND lower(btrim(sc.query)) = lower(btrim(e.lemma))
        AND lower(btrim(sc.evidence->>'canonical_query')) = lower(btrim(e.lemma))
        AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
        AND sc.evidence->'raw_preview'->>'lookup_scope' = 'candidate_article'
        AND sc.evidence->'raw_preview'->>'parent_article_id' = article.parent_article_id::text
        AND CASE
          WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
          THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
            AND sc.evidence->'raw_preview'->'article_ids'->>0 = article.article_id
          ELSE false
        END
      ORDER BY sc.id LIMIT 1
    ) own_check ON true
    WHERE article.article_count = 1 AND article.parent_count = 1
      AND (e.expression_subtype = 'ordbokene_sub_article'
           OR e.expression_subtype IS NULL)
      AND e.verification_status IN ('authoritative', 'multi_source')
      AND l.pos = 'expression'
      AND lower(btrim(l.lemma)) = lower(btrim(e.lemma))
      AND l.dictionary_status = 'active'
      AND l.dictionary_exclusion_reason IS NULL
      AND l.is_learning_lexeme IS FALSE
      AND l.verification_tier IS NULL
      AND EXISTS (
        SELECT 1 FROM private.lexeme360_expression_roots_v1 b
        WHERE b.expression_id = e.id
          AND b.dictionary_code = 'bm'
          AND b.source_article_id = article.parent_article_id
      )
      AND (SELECT count(DISTINCT tr.language_code)
           FROM public.entity_translations tr
           WHERE tr.expression_id = e.id
             AND tr.language_code IN ('uk', 'en')
             AND tr.translation_type IN ('primary', 'expression_primary')
             AND nullif(btrim(tr.translation), '') IS NOT NULL) = 2
  ), projected AS (
    UPDATE public.lexemes l
    SET verification_tier = 'dictionary_match',
        verification_status = eligible.verification_status,
        source_verified = coalesce(nullif(eligible.source_verified, ''), 'Ordbokene'),
        verification_evidence = coalesce(l.verification_evidence, '{}'::jsonb)
          || jsonb_build_object('Ordbokene', jsonb_build_object(
            'status', 'done', 'found', true, 'registered_entry', true,
            'whole_unit_match', true, 'article_id', eligible.article_id,
            'parent_article_id', eligible.parent_article_id,
            'dictionary_code', 'bm',
            'prior_evidence', l.verification_evidence->'Ordbokene',
            'evidence', jsonb_build_object(
              'article_id', eligible.article_id,
              'parent_article_id', eligible.parent_article_id,
              'dictionary_code', 'bm',
              'raw_preview', eligible.source_evidence->'raw_preview',
              'source_check_query', eligible.source_evidence->>'canonical_query'
            )
          )),
        updated_at = now()
    FROM eligible
    WHERE l.id = eligible.lexeme_id
      AND l.verification_tier IS NULL
    RETURNING l.id
  )
  SELECT count(*) INTO v_projected FROM projected;

  RETURN jsonb_build_object('ok', true, 'projected', v_projected,
    'job_id', p_job_id, 'offset', p_offset);
END;
$function$;

REVOKE ALL ON FUNCTION public.d10_project_expression_own_article_page_v1(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_project_expression_own_article_page_v1(uuid, integer, integer)
  TO service_role;

COMMIT;
