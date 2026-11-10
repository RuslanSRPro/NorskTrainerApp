-- D10_naob_family_v6 (07.11.2026), test gripe: 6 NAOB expressions became active cards with
-- dictionary_entry, but stayed out of learning (is_learning_lexeme = false), so the 360 screen
-- shows them grey (candidates, 8 ready instead of 14) without translation/example.
-- The learning admission (d10_admit_own_article_job_expressions_page_v2) knew only expressions
-- with their own Ordbøkene sub-article. It now also admits NAOB uttrykk (branch eligible_naob);
-- the Ordbøkene branch is unchanged. Then the expressions of the latest gripe jobs are admitted once.

CREATE OR REPLACE FUNCTION public.d10_admit_own_article_job_expressions_page_v2(p_job_id uuid, p_offset integer, p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
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
  ), eligible_ordbokene AS MATERIALIZED (
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
      AND article.article_count = 1 AND article.parent_count >= 1
      AND upper(l.verification_evidence->'Ordbokene'->>'dictionary_code') = 'BM'
      AND l.verification_evidence->'Ordbokene'->>'article_id' = article.article_id
      AND EXISTS (SELECT 1 FROM public.ordbokene_expression_candidates bound
        WHERE bound.promoted_expression_id=e.id
          AND bound.candidate_article_id::text=article.article_id
          AND bound.parent_article_id::text=l.verification_evidence->'Ordbokene'->>'parent_article_id'
          AND lower(btrim(bound.normalized_key))=lower(btrim(e.normalized_key))
          AND upper(bound.candidate_dictionary_code)='BM'
          AND upper(bound.parent_dictionary_code)='BM'
          AND bound.candidate_kind='expression' AND bound.status IN ('promoted','duplicate'))
      AND l.verification_evidence->'Ordbokene'->'evidence'->>'article_id' = article.article_id
      AND EXISTS (
        SELECT 1 FROM private.lexeme360_expression_roots_v1 b
        WHERE b.expression_id = e.id
          AND b.dictionary_code = 'bm'
          AND b.source_article_id::text = l.verification_evidence->'Ordbokene'->>'parent_article_id'
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
        AND EXISTS (SELECT 1 FROM public.ordbokene_expression_candidates checked_parent
          WHERE checked_parent.promoted_expression_id=e.id
            AND checked_parent.candidate_article_id::text=article.article_id
            AND checked_parent.parent_article_id::text=sc.evidence->'raw_preview'->>'parent_article_id'
            AND lower(btrim(checked_parent.normalized_key))=lower(btrim(e.normalized_key))
            AND upper(checked_parent.candidate_dictionary_code)='BM'
            AND upper(checked_parent.parent_dictionary_code)='BM'
            AND checked_parent.candidate_kind='expression'
            AND checked_parent.status IN ('promoted','duplicate'))
          AND CASE
            WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
            THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
              AND sc.evidence->'raw_preview'->'article_ids'->>0 = article.article_id
            ELSE false
          END
      )
  ),
  -- D10 07.11.2026 (D10_naob_family_v6): a NAOB uttrykk of the verb's article (family 360 from
  -- NAOB) is admitted to learning on the same footing: dictionary-verified expression, active
  -- card with a dictionary tier, binding from NAOB, and this job's NAOB check answered from
  -- the uttrykk evidence (found, registered, whole unit; lexical-worker D10_naob_family_v4).
  eligible_naob AS MATERIALIZED (
    SELECT e.id AS expression_id, e.lexeme_id
    FROM page p
    JOIN public.expression_catalog e ON e.id = p.id
    JOIN public.lexemes l ON l.id = e.lexeme_id
    WHERE e.source_naob IS TRUE
      AND e.verification_status IN ('authoritative', 'multi_source')
      AND l.pos = 'expression'
      AND l.verification_tier IN ('dictionary_match', 'dictionary_entry')
      AND l.dictionary_status = 'active'
      AND l.dictionary_exclusion_reason IS NULL
      AND l.is_learning_lexeme = false
      AND lower(btrim(translate(l.lemma, '[]', ''))) = lower(btrim(translate(e.lemma, '[]', '')))
      AND EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 b
        WHERE b.expression_id = e.id AND b.evidence ? 'naob')
      AND EXISTS (
        SELECT 1
        FROM public.lexeme_processing_items own_item
        JOIN public.lexeme_source_checks sc ON sc.item_id = own_item.id
        WHERE own_item.job_id = p_job_id
          AND own_item.expression_id = e.id
          AND own_item.result_summary->>'promotion_status' = 'expression_promoted'
          AND sc.job_id = p_job_id
          AND sc.source = 'NAOB' AND sc.query_type = 'expression'
          AND sc.status = 'done' AND sc.found IS TRUE
          AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
          AND sc.evidence->'raw_preview'->>'naob_uttrykk' = 'true')
  ), eligible AS MATERIALIZED (
    SELECT expression_id, lexeme_id FROM eligible_ordbokene
    UNION
    SELECT expression_id, lexeme_id FROM eligible_naob
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
    'has_more', v_has_more, 'version', 'd10_expression_own_article_admission_v3');
END;
$function$;

-- once: the jobs of today that contain NAOB family expressions (gripe test)
DO $$
DECLARE v_job uuid; v_off integer; v_res jsonb;
BEGIN
  FOR v_job IN
    SELECT DISTINCT i.job_id FROM public.lexeme_processing_items i
    JOIN public.expression_catalog e ON e.id = i.expression_id AND e.source_naob IS TRUE
    WHERE i.created_at > now() - interval '1 day'
  LOOP
    v_off := 0;
    LOOP
      v_res := public.d10_admit_own_article_job_expressions_page_v2(v_job, v_off, 10);
      EXIT WHEN coalesce((v_res->>'has_more')::boolean, false) IS NOT TRUE;
      v_off := (v_res->>'next_offset')::integer;
    END LOOP;
  END LOOP;
  PERFORM public.lexeme360_refresh_drain_v1(500);
END $$;

SELECT 'd10_naob_family_v6 installed' AS result, l.lexeme360_ready_count AS gripe_ready,
  l.lexeme360_candidate_count AS gripe_candidates
FROM public.lexemes l WHERE l.lemma = 'gripe' AND l.pos = 'verb';
