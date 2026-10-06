-- D10 admission pages: one bounded job slice per RPC. The old v1 RPC remains
-- for historical callers, but pipeline-supervisor switches to these RPCs.
CREATE OR REPLACE FUNCTION public.admit_verified_job_expressions_page_v1(
  p_job_id uuid, p_offset integer, p_limit integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_expression_ids uuid[] := '{}'::uuid[];
  v_next_offset integer;
  v_has_more boolean;
  v_admitted integer := 0;
BEGIN
  IF p_job_id IS NULL OR p_offset IS NULL OR p_offset < 0
     OR p_limit IS NULL OR p_limit < 1 OR p_limit > 10 THEN
    RAISE EXCEPTION 'invalid admission page arguments';
  END IF;
  WITH job_expressions AS MATERIALIZED (
    SELECT DISTINCT i.expression_id AS id
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id
      AND i.expression_id IS NOT NULL
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
  ), page AS MATERIALIZED (
    SELECT id FROM job_expressions ORDER BY id OFFSET p_offset LIMIT p_limit
  ), exact_articles AS (
    SELECT e.id AS expression_id, e.lexeme_id,
      count(DISTINCT c.candidate_article_id::text) AS article_count,
      min(c.candidate_article_id::text) AS article_id
    FROM page p
    JOIN public.expression_catalog e ON e.id = p.id
    JOIN public.lexemes l ON l.id = e.lexeme_id
    JOIN public.ordbokene_expression_candidates c
      ON c.promoted_expression_id = e.id
     AND lower(btrim(c.normalized_key)) = lower(btrim(e.normalized_key))
     AND upper(c.candidate_dictionary_code) = 'BM'
     AND c.candidate_kind = 'expression'
     AND c.status IN ('promoted', 'duplicate')
     AND c.candidate_article_id IS NOT NULL
     AND c.parent_article_id IS NOT NULL
    WHERE (e.expression_subtype = 'ordbokene_sub_article'
           OR e.expression_subtype IS NULL)
      AND e.verification_status IN ('authoritative', 'multi_source')
      AND l.pos = 'expression'
      AND l.verification_tier = 'dictionary_match'
      AND l.dictionary_status = 'active'
      AND l.dictionary_exclusion_reason IS NULL
      AND l.is_learning_lexeme = false
      AND EXISTS (
        SELECT 1 FROM private.lexeme360_expression_roots_v1 b
        WHERE b.expression_id = e.id
      )
    GROUP BY e.id, e.lexeme_id
  ), enabled AS (
    UPDATE public.lexemes l
    SET is_learning_lexeme = true, updated_at = now()
    FROM exact_articles a, public.expression_catalog e
    WHERE l.id = a.lexeme_id AND e.id = a.expression_id
      AND l.is_learning_lexeme = false
      AND a.article_count = 1
      AND coalesce(
        l.verification_evidence->'Ordbokene'->'evidence'->>'article_id',
        l.verification_evidence->'Ordbokene'->>'article_id'
      ) = a.article_id
    RETURNING e.id
  )
  SELECT coalesce(array_agg(id), '{}'::uuid[])
  INTO v_expression_ids FROM enabled;

  IF cardinality(v_expression_ids) > 0 THEN
    PERFORM private.refresh_lexeme360_binding_set_v1(
      '{}'::uuid[], v_expression_ids
    );
  END IF;

  WITH job_expressions AS MATERIALIZED (
    SELECT DISTINCT i.expression_id AS id
    FROM public.lexeme_processing_items i
    WHERE i.job_id = p_job_id
      AND i.expression_id IS NOT NULL
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
  ), page AS (
    SELECT id FROM job_expressions ORDER BY id OFFSET p_offset LIMIT p_limit
  )
  SELECT p_offset + count(*)::integer,
    EXISTS (SELECT 1 FROM job_expressions ORDER BY id
            OFFSET (p_offset + p_limit) LIMIT 1)
  INTO v_next_offset, v_has_more
  FROM page;
  v_admitted := cardinality(v_expression_ids);
  RETURN jsonb_build_object('ok', true, 'job_id', p_job_id,
    'admitted', v_admitted, 'next_offset', v_next_offset,
    'has_more', v_has_more);
END;
$function$;

REVOKE ALL ON FUNCTION public.admit_verified_job_expressions_page_v1(uuid, integer, integer)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_verified_job_expressions_page_v1(uuid, integer, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_verified_job_expression_root_page_v1(
  p_job_id uuid, p_offset integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_root_id uuid;
  v_has_more boolean;
BEGIN
  IF p_job_id IS NULL OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION 'invalid root refresh page arguments';
  END IF;
  SELECT roots.root_lexeme_id INTO v_root_id
  FROM (
    SELECT DISTINCT b.root_lexeme_id
    FROM public.lexeme_processing_items i
    JOIN private.lexeme360_expression_roots_v1 b
      ON b.expression_id = i.expression_id
    WHERE i.job_id = p_job_id
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
  ) roots ORDER BY roots.root_lexeme_id OFFSET p_offset LIMIT 1;

  IF v_root_id IS NOT NULL THEN
    PERFORM private.refresh_lexeme360_lexeme_v2(v_root_id);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT DISTINCT b.root_lexeme_id
      FROM public.lexeme_processing_items i
      JOIN private.lexeme360_expression_roots_v1 b
        ON b.expression_id = i.expression_id
      WHERE i.job_id = p_job_id
        AND i.result_summary->>'promotion_status' = 'expression_promoted'
    ) roots ORDER BY roots.root_lexeme_id OFFSET (p_offset + 1) LIMIT 1
  ) INTO v_has_more;

  RETURN jsonb_build_object('ok', true, 'job_id', p_job_id,
    'root_id', v_root_id, 'next_offset', p_offset + 1,
    'has_more', v_has_more);
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_verified_job_expression_root_page_v1(uuid, integer)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_verified_job_expression_root_page_v1(uuid, integer)
  TO service_role;
