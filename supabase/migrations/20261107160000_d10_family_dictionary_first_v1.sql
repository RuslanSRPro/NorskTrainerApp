-- D10 07.11.2026 (agreed, variant A): family 360 of a NEW verb gets into the job at the start.
--
-- Cause (queries 354-357): analyze-text adds the family of a root from expression_catalog
-- (works for verbs processed before, e.g. snakke). For a verb seen for the first time the
-- expressions and their bindings (private.lexeme360_expression_roots_v1) are created only
-- by the ordbokene enrichment chain, i.e. AFTER family injection has run -> nobody adds
-- them to a job (138 of 165 bound since 29.10 never processed, 1340 in total).
--
-- Fix: job-orchestrator, right before family injection, runs ordbokene-lexeme-pipeline-worker
-- (the same call the ordbokene chain makes) for promoted verb roots of the job that have no
-- bindings yet. Then the existing injection adds the expressions to the job (total_items grows,
-- the progress bar counts them). Up to 2 roots per call; a failure never stops the job.
-- Verbs only (agreed). Also: d10_family_backfill_job_v1 - one separate job for the verb family
-- expressions that are bound but never were an item of any job.

CREATE TABLE IF NOT EXISTS private.d10_family_dictionary_runs_v1 (
  root_lexeme_id uuid NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
  article_id bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('done', 'retry', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_job_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (root_lexeme_id, article_id)
);
REVOKE ALL ON private.d10_family_dictionary_runs_v1 FROM PUBLIC;

-- Verb roots of the job that still need the dictionary step. Same root rule as
-- d10_inject_verified_job_family_page_v1 (promoted token, exact bm article, verb).
CREATE OR REPLACE FUNCTION public.d10_family_dictionary_roots_page_v1(p_job_id uuid, p_limit integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_roots jsonb;
  v_total integer;
BEGIN
  IF p_job_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'INVALID_FAMILY_DICTIONARY_REQUEST';
  END IF;

  WITH verified_roots AS MATERIALIZED (
    SELECT DISTINCT l.id AS lexeme_id, l.lemma, l.pos::text AS pos,
      root_article.article_id::bigint AS article_id
    FROM public.lexeme_processing_items i
    JOIN public.lexemes l ON l.id = i.lexeme_id AND l.pos = 'verb'
    JOIN public.lexeme_source_checks sc ON sc.item_id = i.id
      AND sc.job_id = p_job_id AND sc.source = 'Ordbokene'
      AND sc.status = 'done' AND sc.found IS TRUE
      AND sc.registered_entry IS TRUE AND sc.whole_unit_match IS TRUE
      AND sc.query_type = 'token'
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
        THEN sc.evidence->'raw_preview'->'article_ids' ELSE '[]'::jsonb END
    ) AS root_article(article_id)
    WHERE i.job_id = p_job_id AND i.match_type = 'token'
      AND i.status = 'done' AND i.current_stage = 'semantic_audit'
      AND i.result_summary->>'promotion_status' = 'promoted'
      AND lower(btrim(i.normalized_lemma)) = lower(btrim(l.lemma))
      AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
      AND sc.evidence->'raw_preview'->>'pos' = l.pos
      AND lower(btrim(sc.evidence->'raw_preview'->>'canonical_lemma')) = lower(btrim(l.lemma))
      AND CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'article_ids') = 'array'
        THEN jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') = 1
          OR (jsonb_array_length(sc.evidence->'raw_preview'->'article_ids') > 1
              AND sc.evidence->'raw_preview'->>'article_selection' = 'bound_lexeme_article_set')
        ELSE false END
      AND root_article.article_id ~ '^[0-9]+$'
  ), need AS (
    SELECT r.* FROM verified_roots r
    WHERE NOT EXISTS (SELECT 1 FROM private.lexeme360_expression_roots_v1 b
        WHERE b.root_lexeme_id = r.lexeme_id AND b.source_article_id = r.article_id
          AND b.dictionary_code = 'bm' AND b.source_kind = 'ordbokene_parent_article')
      AND NOT EXISTS (SELECT 1 FROM private.d10_family_dictionary_runs_v1 d
        WHERE d.root_lexeme_id = r.lexeme_id AND d.article_id = r.article_id
          AND (d.status IN ('done', 'failed')
               OR (d.status = 'retry' AND d.updated_at > now() - interval '2 minutes')))
  )
  SELECT (SELECT count(*) FROM need),
    coalesce((SELECT jsonb_agg(jsonb_build_object('lexeme_id', n.lexeme_id, 'lemma', n.lemma,
        'pos', n.pos, 'article_id', n.article_id) ORDER BY n.lemma, n.article_id)
      FROM (SELECT * FROM need ORDER BY lemma, article_id LIMIT p_limit) n), '[]'::jsonb)
  INTO v_total, v_roots;

  RETURN jsonb_build_object('ok', true, 'roots', v_roots,
    'remaining', greatest(v_total - jsonb_array_length(v_roots), 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public.d10_family_dictionary_record_v1(
  p_job_id uuid, p_root_lexeme_id uuid, p_article_id bigint, p_ok boolean, p_detail jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_row private.d10_family_dictionary_runs_v1;
BEGIN
  IF p_root_lexeme_id IS NULL OR p_article_id IS NULL OR p_ok IS NULL THEN
    RAISE EXCEPTION 'INVALID_FAMILY_DICTIONARY_RECORD';
  END IF;
  INSERT INTO private.d10_family_dictionary_runs_v1 AS d
    (root_lexeme_id, article_id, status, attempts, last_job_id, detail)
  VALUES (p_root_lexeme_id, p_article_id, CASE WHEN p_ok THEN 'done' ELSE 'retry' END, 1, p_job_id,
    coalesce(p_detail, '{}'::jsonb))
  ON CONFLICT (root_lexeme_id, article_id) DO UPDATE
    SET attempts = d.attempts + 1,
        status = CASE WHEN p_ok THEN 'done' WHEN d.attempts + 1 >= 3 THEN 'failed' ELSE 'retry' END,
        last_job_id = p_job_id, detail = coalesce(p_detail, '{}'::jsonb), updated_at = now()
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', true, 'status', v_row.status, 'attempts', v_row.attempts);
END;
$function$;

-- One-off: verb family expressions that are bound but never were an item of any job
-- -> one separate job (the same items and checks as family injection, and the same ledger).
-- p_dry_run = true only counts and shows examples.
CREATE OR REPLACE FUNCTION public.d10_family_backfill_job_v1(p_dry_run boolean DEFAULT true, p_limit integer DEFAULT 2000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_job uuid;
  v_user uuid;
  v_c record;
  v_item uuid;
  v_added integer := 0;
  v_total integer;
  v_examples jsonb;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'INVALID_FAMILY_BACKFILL_LIMIT';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS d10_family_backfill_candidates_v1 (
    expression_id uuid, lemma text, expression_subtype text, root_lexeme_id uuid, root_article_id bigint
  ) ON COMMIT DROP;
  TRUNCATE d10_family_backfill_candidates_v1;

  INSERT INTO d10_family_backfill_candidates_v1
  SELECT DISTINCT ON (lower(btrim(e.lemma))) e.id, e.lemma, e.expression_subtype::text,
    b.root_lexeme_id, b.source_article_id
  FROM private.lexeme360_expression_roots_v1 b
  JOIN public.lexemes l ON l.id = b.root_lexeme_id AND l.pos = 'verb'
  JOIN public.expression_catalog e ON e.id = b.expression_id
  WHERE b.dictionary_code = 'bm' AND b.source_kind = 'ordbokene_parent_article'
    AND nullif(btrim(e.lemma), '') IS NOT NULL
    AND private.lexeme360_subtype_is_displayable_v1(e.expression_subtype, true)
    AND NOT EXISTS (SELECT 1 FROM public.lexeme_processing_items i WHERE i.expression_id = e.id)
  ORDER BY lower(btrim(e.lemma)), e.id, b.root_lexeme_id, b.source_article_id;

  SELECT count(*) INTO v_total FROM d10_family_backfill_candidates_v1;
  SELECT jsonb_agg(lemma) INTO v_examples
  FROM (SELECT lemma FROM d10_family_backfill_candidates_v1 ORDER BY lemma LIMIT 30) s;

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true, 'candidates', v_total,
      'would_add', least(v_total, p_limit), 'examples', coalesce(v_examples, '[]'::jsonb));
  END IF;
  IF v_total = 0 THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', false, 'added', 0);
  END IF;

  SELECT j.user_id INTO v_user FROM public.lexeme_processing_jobs j
  WHERE j.input_type = 'text' AND j.user_id IS NOT NULL ORDER BY j.created_at DESC LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'FAMILY_BACKFILL_NO_USER'; END IF;

  INSERT INTO public.lexeme_processing_jobs (user_id, input_type, input_text, status,
    total_items, done_items, partial_items, failed_items, skipped_items, summary, created_at, updated_at)
  VALUES (v_user, 'text', '', 'pending', 0, 0, 0, 0, 0,
    jsonb_build_object('created_by', 'd10_family_backfill_job_v1', 'origin_type', 'family_backfill',
      'ingestion_version', 'd10_family_dictionary_first_v1'), now(), now())
  RETURNING id INTO v_job;

  FOR v_c IN SELECT * FROM d10_family_backfill_candidates_v1 ORDER BY lemma LIMIT p_limit LOOP
    INSERT INTO private.d10_job_family_injections_v1 (job_id, expression_id, root_lexeme_id, root_article_id)
    VALUES (v_job, v_c.expression_id, v_c.root_lexeme_id, v_c.root_article_id)
    ON CONFLICT (job_id, expression_id) DO NOTHING;

    INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
      normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
    VALUES (v_job, v_c.expression_id, NULL, v_c.lemma, lower(btrim(v_c.lemma)), lower(btrim(v_c.lemma)),
      v_c.lemma, 'expression', 'expression', 'pending', 'source_checks', 0, 3,
      jsonb_build_object('match_strategy', 'lexeme360_family_injection',
        'expression_subtype', v_c.expression_subtype,
        'root_lexeme_id', v_c.root_lexeme_id, 'root_article_id', v_c.root_article_id,
        'identity_source', 'ordbokene_parent_article_binding_v1', 'family_backfill', true))
    RETURNING id INTO v_item;

    UPDATE private.d10_job_family_injections_v1 SET item_id = v_item
    WHERE job_id = v_job AND expression_id = v_c.expression_id;

    INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
      query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
    SELECT v_job, v_item, NULL, s, 'lemma', lower(btrim(v_c.lemma)), v_c.lemma, 'expression',
      'pending', 0, 3, '{}'::jsonb, '[]'::jsonb, 1
    FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
    v_added := v_added + 1;
  END LOOP;

  UPDATE public.lexeme_processing_jobs SET total_items = v_added, updated_at = now() WHERE id = v_job;
  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'job_id', v_job, 'added', v_added,
    'candidates', v_total);
END;
$function$;

REVOKE ALL ON FUNCTION public.d10_family_dictionary_roots_page_v1(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_family_dictionary_record_v1(uuid, uuid, bigint, boolean, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_family_backfill_job_v1(boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_family_dictionary_roots_page_v1(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_family_dictionary_record_v1(uuid, uuid, bigint, boolean, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_family_backfill_job_v1(boolean, integer) TO service_role;

SELECT 'd10_family_dictionary_first_v1 installed' AS result,
  (SELECT count(*) FROM pg_proc WHERE proname IN ('d10_family_dictionary_roots_page_v1',
     'd10_family_dictionary_record_v1', 'd10_family_backfill_job_v1')) AS functions;
