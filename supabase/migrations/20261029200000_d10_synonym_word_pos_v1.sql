-- D10_synonym_pos_rules_v1, part 1 of 2 (29.10.2026, agreed in chat)
-- A NAOB synonym WORD that has no card yet went to the child job without a part
-- of speech; the admission gate stopped it (unknown_pos_requires_review: feste,
-- overstå, rangle). Now it first goes to the resolver (synonym-verifier, no AI):
-- its Ordbøkene articles (exact lemma) give the part(s) of speech -> one item per
-- part of speech in the child job, the normal path does the rest (homographs as
-- usual). Not in Ordbøkene / no part of speech -> problem words with the reason.
-- Synonym words without a card from earlier runs go through it once.
-- Guards: md5 of the five replaced functions.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
      ('public.d10_synonym_dispatch_v1(uuid)', 'ab35ea3137961566bb42029d3256255b'),
      ('public.d10_expr_resolver_record_v1(text,uuid,text,jsonb)', '021477d658d6c6c609c6d24cb9b544fd'),
      ('public.d10_expr_resolver_lease_v1(integer)', '30577fa2d242e66b8d2c876e080d7cea'),
      ('public.d10_expr_resolver_parent_jobs_v1()', 'a6d1bccd25c59d062f832c16a8b5126e'),
      ('public.d10_synonym_verifier_pending_v1()', '64e2bb384d7c163345cccecfd83ec0ad')) v(fn, md5)
  LOOP
    IF (SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) FROM pg_proc p WHERE p.oid = to_regprocedure(r.fn))
       IS DISTINCT FROM r.md5 THEN
      RAISE EXCEPTION 'STOP: % is not the expected version; nothing changed', r.fn;
    END IF;
  END LOOP;
END
$pre$;

ALTER TABLE public.synonym_expression_resolution_v1
  ADD COLUMN kind text NOT NULL DEFAULT 'expression' CHECK (kind IN ('expression', 'word')),
  ADD COLUMN word_pos text[];
ALTER TABLE public.synonym_expression_resolution_v1 DROP CONSTRAINT synonym_expression_resolution_v1_status_check;
ALTER TABLE public.synonym_expression_resolution_v1 ADD CONSTRAINT synonym_expression_resolution_v1_status_check
  CHECK (status IN ('queued','processing','parent_needed','parent_waiting','resolved','explanation','retry_wait',
    'failed','word_ready'));

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
  v_resolution text;
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
        -- D10 29.10.2026 (agreed, variant A): an expression that is not in the
        -- catalog first goes to the expression resolver (synonym-verifier):
        -- Ordbøkene phrase search -> its own article -> the head word article
        -- (referers) -> the expressions of that article are extracted by the
        -- existing ordbokene chain -> the expression comes back here as a
        -- catalog entry. Not found in Ordbøkene -> NAOB explanation.
        INSERT INTO public.synonym_expression_resolution_v1 AS r (norm_text, status)
        VALUES (v_target.norm, 'queued')
        ON CONFLICT (norm_text) DO UPDATE SET status = 'queued', attempts = 0, rounds = 0,
          next_attempt_at = NULL, last_error = NULL, lease_token = NULL, lease_until = NULL, updated_at = now()
        WHERE r.status IN ('failed', 'resolved')
        RETURNING r.status INTO v_resolution;
        IF v_resolution IS NULL THEN
          SELECT r.status INTO v_resolution FROM public.synonym_expression_resolution_v1 r WHERE r.norm_text = v_target.norm;
        END IF;
        IF v_resolution = 'explanation' THEN
          UPDATE public.synonym_candidate_queue SET dispatch_status = 'not_dispatchable', stage1_status = 'rejected',
            verification_evidence = verification_evidence || jsonb_build_object('stage_a',
              jsonb_build_object('reason', 'naob_explanation', 'prepared_at', now(), 'by', 'expression_resolver')),
            updated_at = now()
          WHERE dispatch_status = 'pending' AND origin_depth = 0
            AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'expression';
        ELSE
          UPDATE public.synonym_candidate_queue SET dispatch_status = 'awaiting_parent',
            stage1_status = 'awaiting_target_resolution', updated_at = now()
          WHERE dispatch_status = 'pending' AND origin_depth = 0
            AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'expression';
        END IF;
        v_new_expr := v_new_expr + 1;
        CONTINUE;
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
      IF v_known = 0 THEN
        -- D10 29.10.2026 (agreed): a word that has no card yet first goes to the
        -- resolver, which reads its Ordbøkene articles: one item per part of
        -- speech found (was: one item without part of speech -> the gate stopped
        -- it with unknown_pos_requires_review: feste, overstå, rangle).
        INSERT INTO public.synonym_expression_resolution_v1 AS r (norm_text, status, kind)
        VALUES (v_target.norm, 'queued', 'word')
        ON CONFLICT (norm_text) DO UPDATE SET status = 'queued', kind = 'word', attempts = 0, rounds = 0,
          next_attempt_at = NULL, last_error = NULL, lease_token = NULL, lease_until = NULL, updated_at = now()
        WHERE r.status IN ('failed', 'resolved');
        UPDATE public.synonym_candidate_queue SET dispatch_status = 'awaiting_parent',
          stage1_status = 'awaiting_target_resolution', updated_at = now()
        WHERE dispatch_status = 'pending' AND origin_depth = 0
          AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'lexeme';
        v_new_expr := v_new_expr + 1;
        CONTINUE;
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

CREATE OR REPLACE FUNCTION public.d10_expr_resolver_lease_v1(p_limit integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_rows jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(20261029, 1);
  UPDATE public.synonym_expression_resolution_v1 r SET status = 'queued', updated_at = now()
  WHERE r.status = 'parent_waiting'
    AND (r.parent_job_id IS NULL OR EXISTS (
      SELECT 1 FROM public.lexeme_processing_jobs j
      WHERE j.id = r.parent_job_id AND j.status IN ('completed', 'needs_manual_review', 'failed', 'cancelled')));

  WITH picked AS (
    SELECT r.norm_text FROM public.synonym_expression_resolution_v1 r
    WHERE r.status = 'queued'
       OR (r.status = 'retry_wait' AND coalesce(r.next_attempt_at, now()) <= now())
       OR (r.status = 'processing' AND r.lease_until <= now())
    ORDER BY r.updated_at
    LIMIT least(greatest(coalesce(p_limit, 5), 1), 20)
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.synonym_expression_resolution_v1 r
    SET status = 'processing', lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes',
        attempts = r.attempts + 1, updated_at = now()
    FROM picked WHERE r.norm_text = picked.norm_text
    RETURNING r.norm_text, r.lease_token, r.rounds, r.attempts, r.kind
  )
  SELECT coalesce(jsonb_agg(to_jsonb(upd)), '[]'::jsonb) INTO v_rows FROM upd;
  RETURN jsonb_build_object('ok', true, 'rows', v_rows);
END
$fn$;

CREATE OR REPLACE FUNCTION public.d10_expr_resolver_record_v1(p_norm text, p_lease_token uuid, p_outcome text,
  p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  r public.synonym_expression_resolution_v1%rowtype;
  v_outcome text := p_outcome;
  v_reason text;
  v_dispatch jsonb;
  v_n integer := 0;
  v_kind text;
BEGIN
  SELECT * INTO r FROM public.synonym_expression_resolution_v1
  WHERE norm_text = p_norm AND status = 'processing' AND lease_token = p_lease_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'applied', false, 'stale', true); END IF;
  p_data := coalesce(p_data, '{}'::jsonb);
  -- D10 29.10.2026: words (kind 'word') are resolved here too; their candidates are lexeme targets
  v_kind := CASE WHEN r.kind = 'word' THEN 'lexeme' ELSE 'expression' END;

  IF v_outcome = 'retry' AND r.attempts >= 3 THEN
    v_outcome := 'failed';
    p_data := p_data || jsonb_build_object('reason', 'network');
  END IF;

  IF v_outcome = 'resolved' THEN
    UPDATE public.synonym_expression_resolution_v1 SET status = 'resolved',
      expression_id = (p_data->>'expression_id')::uuid, evidence = evidence || p_data,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
    WHERE norm_text = p_norm;
    UPDATE public.synonym_candidate_queue SET dispatch_status = 'pending', stage1_status = 'candidate',
      verification_evidence = (verification_evidence - 'stage_a') || jsonb_build_object('expression_resolver',
        jsonb_build_object('status', 'resolved', 'at', now(), 'expression_id', p_data->>'expression_id')),
      updated_at = now()
    WHERE dispatch_status = 'awaiting_parent' AND origin_depth = 0 AND target_kind = v_kind
      AND lower(btrim(target_text)) = p_norm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_dispatch := public.d10_synonym_dispatch_v1(NULL);
  ELSIF v_outcome = 'explanation' THEN
    UPDATE public.synonym_expression_resolution_v1 SET status = 'explanation', evidence = evidence || p_data,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
    WHERE norm_text = p_norm;
    UPDATE public.synonym_candidate_queue SET dispatch_status = 'not_dispatchable', stage1_status = 'rejected',
      verification_evidence = verification_evidence || jsonb_build_object('stage_a',
        jsonb_build_object('reason', 'naob_explanation', 'prepared_at', now(), 'by', 'expression_resolver')),
      updated_at = now()
    WHERE dispatch_status = 'awaiting_parent' AND origin_depth = 0 AND target_kind = v_kind
      AND lower(btrim(target_text)) = p_norm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF v_outcome = 'parent_needed' THEN
    UPDATE public.synonym_expression_resolution_v1 SET status = 'parent_needed',
      parent_lemma = lower(btrim(p_data->>'parent_lemma')), parent_article_id = (p_data->>'parent_article_id')::bigint,
      parent_pos = nullif(btrim(p_data->>'parent_pos'), ''),
      own_article_id = (p_data->>'own_article_id')::bigint, rounds = rounds + 1, evidence = evidence || p_data,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
    WHERE norm_text = p_norm;
  ELSIF v_outcome = 'word_pos' THEN
    UPDATE public.synonym_expression_resolution_v1 SET status = 'word_ready',
      word_pos = ARRAY(SELECT DISTINCT jsonb_array_elements_text(coalesce(p_data->'pos', '[]'::jsonb)) ORDER BY 1),
      evidence = evidence || p_data, lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
    WHERE norm_text = p_norm;
  ELSIF v_outcome = 'retry' THEN
    UPDATE public.synonym_expression_resolution_v1 SET status = 'retry_wait',
      next_attempt_at = now() + make_interval(mins => 10 * attempts), last_error = left(p_data->>'error', 500),
      lease_token = NULL, lease_until = NULL, updated_at = now()
    WHERE norm_text = p_norm;
  ELSIF v_outcome = 'failed' THEN
    v_reason := coalesce(p_data->>'reason', 'unknown');
    UPDATE public.synonym_expression_resolution_v1 SET status = 'failed', last_error = left(v_reason || coalesce(': ' || (p_data->>'error'), ''), 500),
      evidence = evidence || p_data, lease_token = NULL, lease_until = NULL, updated_at = now()
    WHERE norm_text = p_norm;
    UPDATE public.synonym_candidate_queue SET dispatch_status = 'not_dispatchable', stage1_status = 'needs_manual_review',
      verification_evidence = verification_evidence || jsonb_build_object('stage_a',
        jsonb_build_object('reason', 'resolver_' || v_reason, 'prepared_at', now(), 'by', 'expression_resolver')),
      updated_at = now()
    WHERE dispatch_status = 'awaiting_parent' AND origin_depth = 0 AND target_kind = v_kind
      AND lower(btrim(target_text)) = p_norm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_OUTCOME');
  END IF;
  RETURN jsonb_build_object('ok', true, 'applied', true, 'outcome', v_outcome, 'candidates', v_n,
    'dispatch', v_dispatch);
END
$fn$;

CREATE OR REPLACE FUNCTION public.d10_expr_resolver_parent_jobs_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_cfg public.synonym_pipeline_config%rowtype;
  v_today integer;
  v_job uuid;
  v_user text;
  v_head record;
  v_card record;
  v_item uuid;
  v_items integer := 0;
  v_known integer;
  v_unready integer;
  v_pos integer := 0;
  v_failed integer := 0;
  v_word record;
  v_wpos text;
  v_words integer := 0;
  v_accepted constant text[] := ARRAY['multi_source','usage_verified','authoritative','verified',
    'source_verified','multi_source_verified'];
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_pipeline_config WHERE singleton;
  IF NOT v_cfg.pipeline_enabled THEN RETURN jsonb_build_object('ok', true, 'job', NULL, 'reason', 'pipeline_disabled'); END IF;
  PERFORM pg_advisory_xact_lock(20261027, 2);   -- the dispatcher's lock
  IF NOT EXISTS (SELECT 1 FROM public.synonym_expression_resolution_v1 WHERE status IN ('parent_needed', 'word_ready')) THEN
    RETURN jsonb_build_object('ok', true, 'job', NULL);
  END IF;
  SELECT count(*) INTO v_today FROM public.lexeme_processing_jobs j
  WHERE j.input_type = 'synonym_candidate' AND j.created_at > now() - interval '24 hours';
  IF v_today >= v_cfg.daily_job_limit THEN
    RETURN jsonb_build_object('ok', true, 'job', NULL, 'reason', 'daily_limit');
  END IF;

  -- D10 29.10.2026 (agreed): the head word goes with the part of speech of the
  -- article the expression lives in (folde -> verb). Without it a word with
  -- several articles (folde, strekke) stopped at the gate with
  -- unknown_pos_requires_review. Only cards of THAT part of speech count.
  FOR v_head IN
    SELECT DISTINCT r.parent_lemma AS lemma, r.parent_pos AS pos FROM public.synonym_expression_resolution_v1 r
    WHERE r.status = 'parent_needed' AND coalesce(r.parent_lemma, '') <> '' ORDER BY 1, 2 LIMIT 50
  LOOP
    SELECT count(*) FILTER (WHERE NOT (coalesce(l.dictionary_status, '') = 'active' AND coalesce(l.verification_status, '') = ANY (v_accepted))),
           count(*)
      INTO v_unready, v_known
    FROM public.lexemes l
    WHERE lower(btrim(l.lemma)) = v_head.lemma AND coalesce(l.homograph_key, '') = ''
      AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown')
      AND (v_head.pos IS NULL OR l.pos = v_head.pos);
    IF v_known > 0 AND v_unready = 0 THEN
      -- ready cards (of this part of speech) exist, none bound to the article of the expression
      UPDATE public.synonym_expression_resolution_v1 SET status = 'failed', last_error = 'head_word_other_article',
        updated_at = now()
      WHERE status = 'parent_needed' AND parent_lemma = v_head.lemma AND parent_pos IS NOT DISTINCT FROM v_head.pos;
      UPDATE public.synonym_candidate_queue c SET dispatch_status = 'not_dispatchable', stage1_status = 'needs_manual_review',
        verification_evidence = c.verification_evidence || jsonb_build_object('stage_a',
          jsonb_build_object('reason', 'resolver_head_word_other_article', 'prepared_at', now(), 'by', 'expression_resolver')),
        updated_at = now()
      FROM public.synonym_expression_resolution_v1 r
      WHERE r.parent_lemma = v_head.lemma AND r.parent_pos IS NOT DISTINCT FROM v_head.pos
        AND r.status = 'failed' AND r.last_error = 'head_word_other_article'
        AND c.dispatch_status = 'awaiting_parent' AND c.target_kind = 'expression'
        AND lower(btrim(c.target_text)) = r.norm_text;
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    IF v_job IS NULL THEN
      SELECT j.user_id INTO v_user
      FROM public.synonym_expression_resolution_v1 r
      JOIN public.synonym_candidate_queue c ON lower(btrim(c.target_text)) = r.norm_text AND c.target_kind = 'expression'
      JOIN public.lexeme_processing_jobs j ON j.id = c.source_job_id
      WHERE r.status = 'parent_needed' AND r.parent_lemma = v_head.lemma
      ORDER BY c.created_at LIMIT 1;
      INSERT INTO public.lexeme_processing_jobs (user_id, input_type, input_text, status,
        total_items, done_items, partial_items, failed_items, skipped_items, summary, created_at, updated_at)
      VALUES (v_user, 'synonym_candidate', '', 'pending', 0, 0, 0, 0, 0,
        jsonb_build_object('created_by', 'd10_expr_resolver_parent_jobs_v1', 'origin_type', 'synonym_candidate',
          'origin_depth', 1, 'pipeline_version', v_cfg.pipeline_version, 'purpose', 'expression_head_words',
          'ingestion_version', 'd10_expression_resolver_v1'), now(), now())
      RETURNING id INTO v_job;
    END IF;

    IF v_known > 0 THEN
      FOR v_card IN
        SELECT l.id, l.lemma, l.pos FROM public.lexemes l
        WHERE lower(btrim(l.lemma)) = v_head.lemma AND coalesce(l.homograph_key, '') = ''
          AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown')
          AND (v_head.pos IS NULL OR l.pos = v_head.pos)
          AND NOT (coalesce(l.dictionary_status, '') = 'active' AND coalesce(l.verification_status, '') = ANY (v_accepted))
        ORDER BY l.pos, l.id
      LOOP
        INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
          normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
        VALUES (v_job, NULL, NULL, v_head.lemma, v_head.lemma, lower(btrim(v_card.lemma)), v_head.lemma,
          v_card.pos, 'token', 'pending', 'source_checks', 0, 3,
          jsonb_build_object('ingestion_version', 'd10_expression_resolver_v1', 'token_start', v_pos, 'token_end', v_pos,
            'match_strategy', 'expression_head_word', 'origin_type', 'synonym_candidate', 'origin_depth', 1,
            'resolved_lexeme_id', v_card.id, 'resolved_lemma', v_card.lemma, 'resolved_pos', v_card.pos))
        RETURNING id INTO v_item;
        INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
          query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
        SELECT v_job, v_item, v_card.id, s, 'lemma', lower(btrim(v_card.lemma)), v_head.lemma, 'token', 'pending', 0, 3,
          '{}'::jsonb, '[]'::jsonb, 1
        FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
        v_items := v_items + 1;
      END LOOP;
    ELSE
      -- no card of this part of speech yet: one item WITH the article's part
      -- of speech (NULL only when the article did not give one)
      INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
        normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
      VALUES (v_job, NULL, NULL, v_head.lemma, v_head.lemma, v_head.lemma, v_head.lemma,
        v_head.pos, 'token', 'pending', 'source_checks', 0, 3,
        jsonb_build_object('ingestion_version', 'd10_expression_resolver_v1', 'token_start', v_pos, 'token_end', v_pos,
          'match_strategy', 'expression_head_word', 'origin_type', 'synonym_candidate', 'origin_depth', 1,
          'head_word_pos_from_article', v_head.pos))
      RETURNING id INTO v_item;
      INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
        query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
      SELECT v_job, v_item, NULL, s, 'lemma', v_head.lemma, v_head.lemma, 'token', 'pending', 0, 3,
        '{}'::jsonb, '[]'::jsonb, 1
      FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
      v_items := v_items + 1;
    END IF;
    v_pos := v_pos + 1;
    UPDATE public.synonym_expression_resolution_v1 SET status = 'parent_waiting', parent_job_id = v_job, updated_at = now()
    WHERE status = 'parent_needed' AND parent_lemma = v_head.lemma AND parent_pos IS NOT DISTINCT FROM v_head.pos;
  END LOOP;

  -- D10 29.10.2026 (agreed): synonym WORDS without a card, with the parts of
  -- speech the resolver read from their Ordbøkene articles: one item per part
  -- of speech in the same child job; their candidates wait in this job.
  FOR v_word IN
    SELECT r.norm_text, r.word_pos FROM public.synonym_expression_resolution_v1 r
    WHERE r.status = 'word_ready' AND r.kind = 'word' AND coalesce(cardinality(r.word_pos), 0) > 0
    ORDER BY r.updated_at LIMIT 50
  LOOP
    IF v_job IS NULL THEN
      SELECT j.user_id INTO v_user
      FROM public.synonym_candidate_queue c JOIN public.lexeme_processing_jobs j ON j.id = c.source_job_id
      WHERE lower(btrim(c.target_text)) = v_word.norm_text AND c.target_kind = 'lexeme'
      ORDER BY c.created_at LIMIT 1;
      INSERT INTO public.lexeme_processing_jobs (user_id, input_type, input_text, status,
        total_items, done_items, partial_items, failed_items, skipped_items, summary, created_at, updated_at)
      VALUES (v_user, 'synonym_candidate', '', 'pending', 0, 0, 0, 0, 0,
        jsonb_build_object('created_by', 'd10_expr_resolver_parent_jobs_v1', 'origin_type', 'synonym_candidate',
          'origin_depth', 1, 'pipeline_version', v_cfg.pipeline_version, 'purpose', 'expression_head_words',
          'ingestion_version', 'd10_expression_resolver_v1'), now(), now())
      RETURNING id INTO v_job;
    END IF;
    FOREACH v_wpos IN ARRAY v_word.word_pos LOOP
      INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
        normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
      VALUES (v_job, NULL, NULL, v_word.norm_text, v_word.norm_text, v_word.norm_text, v_word.norm_text,
        v_wpos, 'token', 'pending', 'source_checks', 0, 3,
        jsonb_build_object('ingestion_version', 'd10_synonym_pos_rules_v1', 'token_start', v_pos, 'token_end', v_pos,
          'match_strategy', 'synonym_candidate', 'origin_type', 'synonym_candidate', 'origin_depth', 1,
          'pos_from_ordbokene_articles', v_word.word_pos))
      RETURNING id INTO v_item;
      INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
        query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
      SELECT v_job, v_item, NULL, s, 'lemma', v_word.norm_text, v_word.norm_text, 'token', 'pending', 0, 3,
        '{}'::jsonb, '[]'::jsonb, 1
      FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
      v_items := v_items + 1;
    END LOOP;
    v_pos := v_pos + 1;
    UPDATE public.synonym_candidate_queue SET dispatch_status = 'in_child_job', child_job_id = v_job,
      dispatched_at = now(), stage1_status = 'waiting_enrichment', updated_at = now()
    WHERE dispatch_status = 'awaiting_parent' AND origin_depth = 0 AND target_kind = 'lexeme'
      AND lower(btrim(target_text)) = v_word.norm_text;
    UPDATE public.synonym_expression_resolution_v1 SET status = 'resolved', parent_job_id = v_job, updated_at = now()
    WHERE norm_text = v_word.norm_text;
    v_words := v_words + 1;
  END LOOP;

  IF v_job IS NOT NULL THEN
    UPDATE public.lexeme_processing_jobs j SET
      total_items = (SELECT count(*) FROM public.lexeme_processing_items i WHERE i.job_id = v_job),
      input_text = coalesce((SELECT string_agg(DISTINCT lower(btrim(i.normalized_lemma)), E'\n')
                    FROM public.lexeme_processing_items i WHERE i.job_id = v_job), ''),
      summary = j.summary || jsonb_build_object('total_items',
        (SELECT count(*) FROM public.lexeme_processing_items i WHERE i.job_id = v_job)),
      updated_at = now()
    WHERE j.id = v_job;
  END IF;
  RETURN jsonb_build_object('ok', true, 'job', v_job, 'items', v_items, 'head_word_other_article', v_failed,
    'words', v_words);
END
$fn$;

CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_pending_v1()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
  SELECT (SELECT count(*)::integer FROM public.synonym_pair_v1 p
          WHERE p.status = 'queued'
             OR (p.status = 'retry_wait' AND coalesce(p.next_attempt_at, now()) <= now())
             OR (p.status = 'processing' AND p.lease_until <= now()))
       + (SELECT count(*)::integer FROM public.synonym_expression_resolution_v1 r
          WHERE r.status IN ('queued', 'parent_needed', 'word_ready')
             OR (r.status = 'retry_wait' AND coalesce(r.next_attempt_at, now()) <= now())
             OR (r.status = 'processing' AND r.lease_until <= now())
             OR (r.status = 'parent_waiting' AND (r.parent_job_id IS NULL OR EXISTS (
                  SELECT 1 FROM public.lexeme_processing_jobs j WHERE j.id = r.parent_job_id
                    AND j.status IN ('completed', 'needs_manual_review', 'failed', 'cancelled')))));
$fn$;

-- synonym words that ended without a card (no part of speech) go through the resolver once
UPDATE public.synonym_candidate_queue
SET dispatch_status = 'pending', stage1_status = 'candidate', updated_at = now(),
    verification_evidence = (verification_evidence - 'stage_a') || jsonb_build_object('released',
      jsonb_build_object('by', 'd10_synonym_word_pos_v1', 'at', now(), 'was', dispatch_status))
WHERE origin_depth = 0 AND target_kind = 'lexeme' AND target_entity_ids = '[]'::jsonb
  AND dispatch_status IN ('enrichment_done', 'not_dispatchable');

COMMIT;
