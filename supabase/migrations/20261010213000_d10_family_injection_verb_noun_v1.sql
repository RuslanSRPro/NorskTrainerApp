-- Record the production definition of d10_inject_verified_job_family_page_v1
-- (verified verb and noun roots) in repository history. The body below is the
-- live definition exported on 2026-10-10, unchanged: evidence POS must equal
-- the root lexeme POS. CREATE OR REPLACE keeps the existing privileges.
BEGIN;
CREATE OR REPLACE FUNCTION public.d10_inject_verified_job_family_page_v1(p_job_id uuid, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_status text;
  v_candidate record;
  v_item_id uuid;
  v_claimed integer;
  v_added integer := 0;
  v_has_more boolean;
BEGIN
  IF p_job_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'INVALID_FAMILY_PAGE_REQUEST';
  END IF;
  -- Serialize the ledger and job count with every retry for this job.
  SELECT j.status::text INTO v_status
  FROM public.lexeme_processing_jobs j WHERE j.id = p_job_id FOR UPDATE;
  IF v_status IS NULL OR v_status NOT IN ('processing', 'ready', 'done', 'partial') THEN
    RAISE EXCEPTION 'FAMILY_JOB_NOT_PROCESSING';
  END IF;

  FOR v_candidate IN
    WITH verified_roots AS MATERIALIZED (
      SELECT DISTINCT i.lexeme_id AS root_lexeme_id,
        (sc.evidence->'raw_preview'->'article_ids'->>0)::bigint AS article_id
      FROM public.lexeme_processing_items i
      JOIN public.lexemes l ON l.id = i.lexeme_id AND l.pos IN ('verb', 'noun')
      JOIN public.lexeme_source_checks sc ON sc.item_id = i.id
        AND sc.job_id = p_job_id AND sc.source = 'Ordbokene'
        AND sc.status = 'done' AND sc.found IS TRUE
        AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
        AND sc.query_type = 'token'
      WHERE i.job_id = p_job_id AND i.match_type = 'token'
        AND i.status = 'done' AND i.current_stage = 'semantic_audit'
        AND i.result_summary->>'promotion_status' = 'promoted'
        AND lower(btrim(i.normalized_lemma)) = lower(btrim(l.lemma))
        AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
        AND sc.evidence->'raw_preview'->>'pos' = l.pos
        AND lower(btrim(sc.evidence->'raw_preview'->>'canonical_lemma')) = lower(btrim(l.lemma))
        AND CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
          THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
          ELSE false END
        AND sc.evidence->'raw_preview'->'article_ids'->>0 ~ '^[0-9]+$'
    ), candidates AS (
      SELECT DISTINCT ON (b.expression_id) b.expression_id,
        b.root_lexeme_id, b.source_article_id AS root_article_id,
        e.lemma, e.expression_subtype
      FROM verified_roots root
      JOIN private.lexeme360_expression_roots_v1 b
        ON b.root_lexeme_id = root.root_lexeme_id
       AND b.source_article_id = root.article_id
       AND b.dictionary_code = 'bm'
       AND b.source_kind = 'ordbokene_parent_article'
      JOIN public.expression_catalog e ON e.id = b.expression_id
      WHERE nullif(btrim(e.lemma), '') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.lexeme_processing_items existing
          WHERE existing.job_id = p_job_id AND existing.expression_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM private.d10_job_family_injections_v1 prior
          WHERE prior.job_id = p_job_id AND prior.expression_id = e.id)
      ORDER BY b.expression_id, b.root_lexeme_id, b.source_article_id
    )
    SELECT * FROM candidates ORDER BY expression_id LIMIT p_limit
  LOOP
    INSERT INTO private.d10_job_family_injections_v1 (
      job_id, expression_id, root_lexeme_id, root_article_id
    ) VALUES (
      p_job_id, v_candidate.expression_id, v_candidate.root_lexeme_id,
      v_candidate.root_article_id
    ) ON CONFLICT (job_id, expression_id) DO NOTHING;
    GET DIAGNOSTICS v_claimed = ROW_COUNT;
    IF v_claimed = 0 THEN CONTINUE; END IF;

    INSERT INTO public.lexeme_processing_items (
      job_id, expression_id, lexeme_id, raw_input, normalized_input,
      normalized_lemma, surface_form, pos, match_type, status,
      current_stage, attempt_count, max_attempts, result_summary
    ) VALUES (
      p_job_id, v_candidate.expression_id, NULL, v_candidate.lemma,
      lower(btrim(v_candidate.lemma)), lower(btrim(v_candidate.lemma)),
      v_candidate.lemma, 'expression', 'expression', 'pending',
      'source_checks', 0, 3,
      jsonb_build_object('match_strategy', 'lexeme360_family_injection',
        'expression_subtype', v_candidate.expression_subtype,
        'root_lexeme_id', v_candidate.root_lexeme_id,
        'root_article_id', v_candidate.root_article_id,
        'identity_source', 'ordbokene_parent_article_binding_v1')
    ) RETURNING id INTO v_item_id;

    UPDATE private.d10_job_family_injections_v1 SET item_id = v_item_id
    WHERE job_id = p_job_id AND expression_id = v_candidate.expression_id;

    INSERT INTO public.lexeme_source_checks (
      job_id, item_id, lexeme_id, source, stage, query, surface_form,
      query_type, status, attempt_count, max_attempts, evidence, urls,
      verification_version
    ) SELECT p_job_id, v_item_id, NULL, source_name, 'lemma',
      lower(btrim(v_candidate.lemma)), v_candidate.lemma, 'expression',
      'pending', 0, 3, '{}'::jsonb, '[]'::jsonb, 1
    FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS sources(source_name);
    v_added := v_added + 1;
  END LOOP;

  IF v_added > 0 THEN
    UPDATE public.lexeme_processing_jobs j
    SET total_items = (SELECT count(*) FROM public.lexeme_processing_items i
                       WHERE i.job_id = p_job_id), updated_at = now()
    WHERE j.id = p_job_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.lexeme_processing_items i
    JOIN public.lexemes l ON l.id = i.lexeme_id AND l.pos IN ('verb', 'noun')
    JOIN public.lexeme_source_checks sc ON sc.item_id = i.id
      AND sc.job_id = p_job_id AND sc.source = 'Ordbokene'
      AND sc.status = 'done' AND sc.found IS TRUE
      AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
      AND sc.query_type = 'token'
    JOIN private.lexeme360_expression_roots_v1 b ON b.root_lexeme_id = l.id
      AND b.dictionary_code = 'bm'
      AND b.source_kind = 'ordbokene_parent_article'
      AND b.source_article_id::text = sc.evidence->'raw_preview'->'article_ids'->>0
    JOIN public.expression_catalog e ON e.id = b.expression_id
    WHERE i.job_id = p_job_id AND i.match_type = 'token'
      AND i.status = 'done' AND i.current_stage = 'semantic_audit'
      AND i.result_summary->>'promotion_status' = 'promoted'
      AND lower(btrim(i.normalized_lemma)) = lower(btrim(l.lemma))
      AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
      AND sc.evidence->'raw_preview'->>'pos' = l.pos
      AND lower(btrim(sc.evidence->'raw_preview'->>'canonical_lemma')) = lower(btrim(l.lemma))
      AND CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
        THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
        ELSE false END
      AND nullif(btrim(e.lemma), '') IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.lexeme_processing_items existing
        WHERE existing.job_id = p_job_id AND existing.expression_id = e.id)
      AND NOT EXISTS (SELECT 1 FROM private.d10_job_family_injections_v1 prior
        WHERE prior.job_id = p_job_id AND prior.expression_id = e.id)
  ) INTO v_has_more;

  RETURN jsonb_build_object('ok', true, 'added', v_added,
    'has_more', v_has_more, 'version', 'd10_verified_noun_family_after_promotion_v2');
END;
$function$;
COMMIT;
