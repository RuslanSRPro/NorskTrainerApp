-- D10: admit exact BM expression articles, then refresh affected families once.
-- No job is resumed by this migration.
CREATE OR REPLACE FUNCTION public.admit_verified_job_expressions_v1(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_enabled_ids uuid[] := '{}'::uuid[];
  v_root_ids uuid[] := '{}'::uuid[];
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'job_id required';
  END IF;

  WITH job_expressions AS MATERIALIZED (
    SELECT DISTINCT e.id AS expression_id, e.lexeme_id, e.normalized_key,
      l.verification_evidence
    FROM public.lexeme_processing_items i
    JOIN public.expression_catalog e ON e.id = i.expression_id
    JOIN public.lexemes l ON l.id = e.lexeme_id
    WHERE i.job_id = p_job_id
      AND i.expression_id IS NOT NULL
      AND i.result_summary->>'promotion_status' = 'expression_promoted'
      AND (e.expression_subtype = 'ordbokene_sub_article'
           OR e.expression_subtype IS NULL)
      AND e.verification_status IN ('authoritative', 'multi_source')
      AND l.pos = 'expression'
      AND l.verification_tier = 'dictionary_match'
      AND l.dictionary_status = 'active'
      AND l.dictionary_exclusion_reason IS NULL
      AND l.is_learning_lexeme = false
  ), exact_articles AS (
    SELECT j.expression_id, j.lexeme_id, j.verification_evidence,
      count(DISTINCT c.candidate_article_id::text) AS article_count,
      min(c.candidate_article_id::text) AS article_id
    FROM job_expressions j
    JOIN public.ordbokene_expression_candidates c
      ON c.promoted_expression_id = j.expression_id
     AND lower(btrim(c.normalized_key)) = lower(btrim(j.normalized_key))
     AND upper(c.candidate_dictionary_code) = 'BM'
     AND c.candidate_kind = 'expression'
     AND c.status IN ('promoted', 'duplicate')
     AND c.candidate_article_id IS NOT NULL
     AND c.parent_article_id IS NOT NULL
    GROUP BY j.expression_id, j.lexeme_id, j.verification_evidence
  ), eligible AS (
    SELECT DISTINCT a.lexeme_id
    FROM exact_articles a
    WHERE a.article_count = 1
      AND coalesce(
        a.verification_evidence->'Ordbokene'->'evidence'->>'article_id',
        a.verification_evidence->'Ordbokene'->>'article_id'
      ) = a.article_id
      AND EXISTS (
        SELECT 1 FROM private.lexeme360_expression_roots_v1 b
        WHERE b.expression_id = a.expression_id
      )
  ), enabled AS (
    UPDATE public.lexemes l
    SET is_learning_lexeme = true, updated_at = now()
    FROM eligible e
    WHERE l.id = e.lexeme_id AND l.is_learning_lexeme = false
    RETURNING l.id
  )
  SELECT coalesce(array_agg(id), '{}'::uuid[])
  INTO v_enabled_ids FROM enabled;

  SELECT coalesce(array_agg(root_lexeme_id), '{}'::uuid[])
  INTO v_root_ids
  FROM (
    SELECT DISTINCT b.root_lexeme_id
    FROM private.lexeme360_expression_roots_v1 b
    JOIN public.expression_catalog e ON e.id = b.expression_id
    WHERE e.lexeme_id = ANY(v_enabled_ids)
  ) roots;

  -- Reuse the already deployed set refresh. It calculates every affected
  -- projection in one statement instead of refreshing the whole family per root.
  IF cardinality(v_root_ids) > 0 THEN
    PERFORM private.refresh_lexeme360_binding_set_v1(
      v_root_ids, '{}'::uuid[]
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'job_id', p_job_id,
    'admitted', cardinality(v_enabled_ids),
    'refreshed_roots', cardinality(v_root_ids)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admit_verified_job_expressions_v1(uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_verified_job_expressions_v1(uuid)
  TO service_role;
