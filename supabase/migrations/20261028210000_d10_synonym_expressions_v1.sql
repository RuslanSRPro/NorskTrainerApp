-- D10_synonym_expressions_v1 (28.10.2026, agreed in chat: "давай сделаем")
--
-- 1. d10_synonym_dispatch_v1: a NAOB synonym that is an expression NOT in
--    expression_catalog no longer ends as 'not_dispatchable'. It goes to the
--    child job as written in NAOB, one item per expression, exactly like an
--    analyze-text expression candidate (pos/match_type 'expression',
--    expression_id NULL); the normal source checks decide whether it gets a
--    catalog entry and a card. Everything else in the function is unchanged.
-- 2. The 40 existing 'not_dispatchable' candidates go back to 'pending'; they
--    are dispatched after the next finished job (no extra trigger, no cron).
-- 3. Problem words: d10_synonym_unresolved_v1 / _count_v1 list synonyms that
--    did not get a card (not dispatched, or enriched without a card);
--    d10_synonym_rerun_v1(ids) sends the chosen ones to a child job again.
--    Same rights as d10_problem_cards_v1.
-- No AI, no network, no cron. Guard: the live dispatch function must be the
-- version from 20261027235000 (whitespace-stripped md5), else nothing changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE v_md5 text;
BEGIN
  SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'd10_synonym_dispatch_v1';
  IF v_md5 IS DISTINCT FROM 'b86e4644c13a53e1575968aaa714c389' THEN
    RAISE EXCEPTION 'STOP: d10_synonym_dispatch_v1 is not the expected version (md5 %); nothing changed', v_md5;
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- 1. Dispatch (changed: the "not in the catalog" branch, the item insert, the result)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_dispatch_v1(p_exclude_job_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_cfg public.synonym_pipeline_config%rowtype;
  v_job uuid;
  v_user text;
  v_target record;
  v_card record;
  v_item uuid;
  v_items integer := 0;
  v_targets integer := 0;
  v_ready integer := 0;
  v_not integer := 0;
  v_pos integer := 0;
  v_unready integer;
  v_today integer;
  v_in_job integer := 0;
  v_jobs jsonb := '[]'::jsonb;
  v_known integer;
  v_in_catalog boolean := true;
  v_new_expr integer := 0;
  v_accepted constant text[] := ARRAY['multi_source','usage_verified','authoritative','verified',
    'source_verified','multi_source_verified'];
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_pipeline_config WHERE singleton;
  IF NOT v_cfg.pipeline_enabled THEN RETURN jsonb_build_object('ok', true, 'dispatched', false, 'reason', 'pipeline_disabled'); END IF;
  PERFORM pg_advisory_xact_lock(20261027, 2);

  -- agreed 27.10.2026: no wait for another active child job. A target that
  -- already waits in an active child job is joined to it (no second item for
  -- the same word). dispatcher_batch_size targets per child job; the daily
  -- limit is checked before each new child job.
  SELECT count(*) INTO v_today FROM public.lexeme_processing_jobs j
  WHERE j.input_type = 'synonym_candidate' AND j.created_at > now() - interval '24 hours';

  FOR v_target IN
    SELECT lower(btrim(c.target_text)) AS norm, c.target_kind AS kind, min(c.created_at) AS first_at
    FROM public.synonym_candidate_queue c
    WHERE c.dispatch_status = 'pending' AND c.origin_depth = 0
      AND c.pipeline_version = v_cfg.pipeline_version AND c.target_kind IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 3, 1
  LOOP
    -- the same target already waits in an active child job: join it
    UPDATE public.synonym_candidate_queue c SET dispatch_status = 'in_child_job',
      child_job_id = o.child_job_id, dispatched_at = now(), stage1_status = 'waiting_enrichment', updated_at = now()
    FROM (SELECT c2.child_job_id FROM public.synonym_candidate_queue c2
          JOIN public.lexeme_processing_jobs j2 ON j2.id = c2.child_job_id
          LEFT JOIN public.pipeline_supervisor_state s2 ON s2.job_id = j2.id
          WHERE c2.dispatch_status = 'in_child_job' AND lower(btrim(c2.target_text)) = v_target.norm
            AND c2.child_job_id IS DISTINCT FROM p_exclude_job_id  -- the job that is just ending
            AND c2.target_kind = v_target.kind
            AND (s2.stage IS NULL OR s2.stage NOT IN ('done','needs_manual_review'))
          ORDER BY c2.dispatched_at LIMIT 1) o
    WHERE c.dispatch_status = 'pending' AND c.origin_depth = 0
      AND lower(btrim(c.target_text)) = v_target.norm AND c.target_kind = v_target.kind;
    IF FOUND THEN CONTINUE; END IF;

    IF v_target.kind = 'expression' THEN
      SELECT x.id, x.normalized_key, x.verification_status INTO v_card
      FROM public.expression_catalog x WHERE x.normalized_key = v_target.norm
      ORDER BY (x.lexeme_id IS NULL), x.id LIMIT 1;
      v_in_catalog := FOUND;
      IF NOT v_in_catalog THEN
        -- D10 28.10.2026 (agreed): an expression that is not in the catalog
        -- goes to the child job as written in NAOB, one item per expression,
        -- like an analyze-text expression candidate (expression_id NULL).
        -- The normal source checks decide whether it gets a catalog entry and
        -- a card; if not, the candidate is listed with the problem words.
        v_new_expr := v_new_expr + 1;
      ELSIF coalesce(v_card.verification_status, '') = ANY (v_accepted) THEN
        UPDATE public.synonym_candidate_queue SET dispatch_status = 'skipped_ready',
          stage1_status = 'waiting_enrichment', enrichment_done_at = now(),
          target_entity_ids = public.d10_synonym_target_entities_v1(v_target.norm, 'expression'), updated_at = now()
        WHERE dispatch_status = 'pending' AND origin_depth = 0
          AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'expression';
        v_ready := v_ready + 1; CONTINUE;
      END IF;
    ELSE
      -- a word: main cards with a known part of speech; ready when none of
      -- them needs work (active + accepted verification)
      SELECT count(*) FILTER (WHERE NOT (coalesce(l.dictionary_status, '') = 'active' AND coalesce(l.verification_status, '') = ANY (v_accepted))),
             count(*)
        INTO v_unready, v_known
      FROM public.lexemes l
      WHERE lower(btrim(l.lemma)) = v_target.norm AND coalesce(l.homograph_key, '') = ''
        AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown');
      IF v_known > 0 AND v_unready = 0 THEN
        UPDATE public.synonym_candidate_queue SET dispatch_status = 'skipped_ready',
          stage1_status = 'waiting_enrichment', enrichment_done_at = now(),
          target_entity_ids = public.d10_synonym_target_entities_v1(v_target.norm, 'lexeme'), updated_at = now()
        WHERE dispatch_status = 'pending' AND origin_depth = 0
          AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'lexeme';
        v_ready := v_ready + 1; CONTINUE;
      END IF;
    END IF;

    -- a full child job is closed; the next target opens a new one
    IF v_job IS NOT NULL AND v_in_job >= v_cfg.dispatcher_batch_size THEN
      PERFORM public.d10_synonym_close_child_job_v1(v_job);
      v_jobs := v_jobs || to_jsonb(v_job);
      v_job := NULL;
      v_in_job := 0;
    END IF;
    -- the child job is created with the first target that needs work
    IF v_job IS NULL THEN
      EXIT WHEN v_today >= v_cfg.daily_job_limit;
      v_today := v_today + 1;
      SELECT j.user_id INTO v_user FROM public.synonym_candidate_queue c
      JOIN public.lexeme_processing_jobs j ON j.id = c.source_job_id
      WHERE c.dispatch_status = 'pending' AND lower(btrim(c.target_text)) = v_target.norm
      ORDER BY c.created_at LIMIT 1;
      INSERT INTO public.lexeme_processing_jobs (user_id, input_type, input_text, status,
        total_items, done_items, partial_items, failed_items, skipped_items, summary, created_at, updated_at)
      VALUES (v_user, 'synonym_candidate', '', 'pending', 0, 0, 0, 0, 0,
        jsonb_build_object('created_by', 'd10_synonym_dispatch_v1', 'origin_type', 'synonym_candidate',
          'origin_depth', 1, 'pipeline_version', v_cfg.pipeline_version,
          'ingestion_version', 'd10_synonym_child_job_v1'), now(), now())
      RETURNING id INTO v_job;
    END IF;

    IF v_target.kind = 'expression' THEN
      INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
        normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
      VALUES (v_job, CASE WHEN v_in_catalog THEN v_card.id END, NULL, v_target.norm, v_target.norm,
        CASE WHEN v_in_catalog THEN v_card.normalized_key ELSE v_target.norm END, v_target.norm,
        'expression', 'expression', 'pending', 'source_checks', 0, 3,
        jsonb_build_object('ingestion_version', 'd10_synonym_child_job_v1', 'token_start', v_pos, 'token_end', v_pos,
          'match_strategy', 'synonym_candidate', 'origin_type', 'synonym_candidate', 'origin_depth', 1,
          'expression_in_catalog', v_in_catalog))
      RETURNING id INTO v_item;
      INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
        query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
      SELECT v_job, v_item, NULL, s, 'lemma', CASE WHEN v_in_catalog THEN v_card.normalized_key ELSE v_target.norm END,
        v_target.norm, 'expression', 'pending', 0, 3,
        '{}'::jsonb, '[]'::jsonb, 1
      FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
      v_items := v_items + 1; v_pos := v_pos + 1;
    ELSE
      -- like analyze-text for a single word: one item per known part of
      -- speech that still needs work (not the first homonym!), or one item
      -- without part of speech for a word that is not in the database yet
      IF v_known > 0 THEN
        FOR v_card IN
          SELECT l.id, l.lemma, l.pos FROM public.lexemes l
          WHERE lower(btrim(l.lemma)) = v_target.norm AND coalesce(l.homograph_key, '') = ''
            AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown')
            AND NOT (coalesce(l.dictionary_status, '') = 'active' AND coalesce(l.verification_status, '') = ANY (v_accepted))
          ORDER BY l.pos, l.id
        LOOP
          INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
            normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
          VALUES (v_job, NULL, NULL, v_target.norm, v_target.norm, lower(btrim(v_card.lemma)), v_target.norm,
            v_card.pos, 'token', 'pending', 'source_checks', 0, 3,
            jsonb_build_object('ingestion_version', 'd10_synonym_child_job_v1', 'token_start', v_pos, 'token_end', v_pos,
              'match_strategy', 'synonym_candidate', 'origin_type', 'synonym_candidate', 'origin_depth', 1,
              'resolved_lexeme_id', v_card.id, 'resolved_lemma', v_card.lemma, 'resolved_pos', v_card.pos))
          RETURNING id INTO v_item;
          INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
            query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
          SELECT v_job, v_item, v_card.id, s, 'lemma', lower(btrim(v_card.lemma)), v_target.norm, 'token', 'pending', 0, 3,
            '{}'::jsonb, '[]'::jsonb, 1
          FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
          v_items := v_items + 1;
        END LOOP;
      ELSE
        INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
          normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
        VALUES (v_job, NULL, NULL, v_target.norm, v_target.norm, v_target.norm, v_target.norm,
          NULL, 'token', 'pending', 'source_checks', 0, 3,
          jsonb_build_object('ingestion_version', 'd10_synonym_child_job_v1', 'token_start', v_pos, 'token_end', v_pos,
            'match_strategy', 'synonym_candidate', 'origin_type', 'synonym_candidate', 'origin_depth', 1))
        RETURNING id INTO v_item;
        INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
          query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
        SELECT v_job, v_item, NULL, s, 'lemma', v_target.norm, v_target.norm, 'token', 'pending', 0, 3,
          '{}'::jsonb, '[]'::jsonb, 1
        FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
        v_items := v_items + 1;
      END IF;
      v_pos := v_pos + 1;
    END IF;

    UPDATE public.synonym_candidate_queue SET dispatch_status = 'in_child_job', child_job_id = v_job,
      dispatched_at = now(), stage1_status = 'waiting_enrichment', updated_at = now()
    WHERE dispatch_status = 'pending' AND origin_depth = 0
      AND lower(btrim(target_text)) = v_target.norm AND target_kind = v_target.kind;
    v_targets := v_targets + 1;
    v_in_job := v_in_job + 1;
  END LOOP;

  IF v_job IS NOT NULL THEN
    PERFORM public.d10_synonym_close_child_job_v1(v_job);
    v_jobs := v_jobs || to_jsonb(v_job);
  END IF;
  RETURN jsonb_build_object('ok', true, 'dispatched', jsonb_array_length(v_jobs) > 0, 'child_job_ids', v_jobs,
    'targets', v_targets, 'items', v_items, 'skipped_ready', v_ready, 'not_dispatchable', v_not, 'new_expressions', v_new_expr,
    'daily_limit_reached', v_today >= v_cfg.daily_job_limit);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 2. Existing expression candidates that were stopped as not_dispatchable
-- ---------------------------------------------------------------------------
UPDATE public.synonym_candidate_queue
SET dispatch_status = 'pending', stage1_status = 'candidate', updated_at = now(),
    verification_evidence = verification_evidence || jsonb_build_object('released',
      jsonb_build_object('by', 'd10_synonym_expressions_v1', 'at', now(), 'was', 'not_dispatchable'))
WHERE dispatch_status = 'not_dispatchable' AND origin_depth = 0 AND target_kind = 'expression';

-- ---------------------------------------------------------------------------
-- 3. Synonyms without a card (problem words) + re-run
--    reason: not_dispatchable  - stopped before the child job
--            no_target_card    - the child job ended, no card / catalog entry
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_unresolved_v1(p_limit integer DEFAULT 300)
 RETURNS TABLE(target_text text, target_kind text, reason text, root_lemmas text[], naob_glosses text[],
   candidate_ids uuid[], child_job_id uuid, updated_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT lower(btrim(c.target_text)), c.target_kind,
    CASE WHEN c.dispatch_status = 'not_dispatchable' THEN 'not_dispatchable' ELSE 'no_target_card' END,
    array_remove(array_agg(DISTINCT c.root_synonym_lemma), NULL),
    array_remove(array_agg(DISTINCT c.naob_gloss), NULL),
    array_agg(c.id ORDER BY c.id),
    (array_agg(c.child_job_id ORDER BY c.updated_at DESC) FILTER (WHERE c.child_job_id IS NOT NULL))[1],
    max(c.updated_at)
  FROM public.synonym_candidate_queue c
  WHERE c.origin_depth = 0
    AND (c.dispatch_status = 'not_dispatchable'
      OR (c.dispatch_status IN ('enrichment_done', 'skipped_ready') AND c.target_entity_ids = '[]'::jsonb))
  GROUP BY 1, 2, 3
  ORDER BY max(c.updated_at) DESC, 1
  LIMIT least(greatest(coalesce(p_limit, 300), 1), 1000);
$function$;

CREATE OR REPLACE FUNCTION public.d10_synonym_unresolved_count_v1()
 RETURNS integer
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT count(*)::integer FROM public.d10_synonym_unresolved_v1(1000);
$function$;

-- The chosen candidates (only those listed above) go back to 'pending' and
-- the dispatcher runs at once (same limits: 50 per child job, 50 jobs / 24 h).
CREATE OR REPLACE FUNCTION public.d10_synonym_rerun_v1(p_candidate_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_reset integer;
  v_dispatch jsonb;
BEGIN
  IF coalesce(cardinality(p_candidate_ids), 0) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'reset', 0);
  END IF;
  IF cardinality(p_candidate_ids) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TOO_MANY_CANDIDATES');
  END IF;
  UPDATE public.synonym_candidate_queue c
  SET dispatch_status = 'pending', stage1_status = 'candidate', child_job_id = NULL,
      target_entity_ids = '[]'::jsonb, updated_at = now(),
      verification_evidence = c.verification_evidence || jsonb_build_object('rerun',
        jsonb_build_object('at', now(), 'was', c.dispatch_status, 'child_job_id', c.child_job_id))
  WHERE c.id = ANY (p_candidate_ids) AND c.origin_depth = 0
    AND (c.dispatch_status = 'not_dispatchable'
      OR (c.dispatch_status IN ('enrichment_done', 'skipped_ready') AND c.target_entity_ids = '[]'::jsonb));
  GET DIAGNOSTICS v_reset = ROW_COUNT;
  IF v_reset = 0 THEN
    RETURN jsonb_build_object('ok', true, 'reset', 0);
  END IF;
  v_dispatch := public.d10_synonym_dispatch_v1(NULL);
  RETURN jsonb_build_object('ok', true, 'reset', v_reset, 'dispatch', v_dispatch);
END
$function$;

REVOKE ALL ON FUNCTION public.d10_synonym_unresolved_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_unresolved_count_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_rerun_v1(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_unresolved_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_unresolved_count_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_rerun_v1(uuid[]) TO service_role;

DO $grants$
DECLARE r record;
BEGIN
  -- the same rights the problem list has (d10_problem_cards_v1)
  FOR r IN SELECT DISTINCT grantee FROM information_schema.routine_privileges
           WHERE routine_schema = 'public' AND routine_name = 'd10_problem_cards_v1' AND privilege_type = 'EXECUTE'
  LOOP
    CONTINUE WHEN r.grantee IN ('PUBLIC', 'anon');
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.d10_synonym_unresolved_v1(integer) TO %I', r.grantee);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.d10_synonym_unresolved_count_v1() TO %I', r.grantee);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.d10_synonym_rerun_v1(uuid[]) TO %I', r.grantee);
  END LOOP;
END
$grants$;

COMMIT;
