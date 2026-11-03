-- 20261102250000_d10_synonym_concurrency_v1.sql
-- D10_synonym_concurrency_v1 (agreed 02.11.2026): the synonym dispatcher applies synonym_pipeline_config.max_concurrent_jobs.
-- A new child job is opened only while fewer than max_concurrent_jobs child jobs run (not finished, not the job that
-- is just ending, started in the last 6 h). Targets that do not fit stay 'pending' and go with a later dispatch
-- (maintenance tick every 5 min, end of a child job). Everything else of the dispatcher (forced re-dispatch after a
-- text analysis, batch size, daily limit) is unchanged.
-- Changes: public.d10_synonym_dispatch_v1(uuid). Guard: md5; reinstall -> STOP.
-- Rollback: optional/20261102250000_d10_synonym_concurrency_v1_ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_conc_report;
CREATE TEMP TABLE d10_conc_report(part text, name text, info jsonb);
INSERT INTO d10_conc_report SELECT '01_config', 'synonym_pipeline_config', jsonb_build_object('max_concurrent_jobs', max_concurrent_jobs,
  'dispatcher_batch_size', dispatcher_batch_size, 'daily_job_limit', daily_job_limit) FROM public.synonym_pipeline_config WHERE singleton;
INSERT INTO d10_conc_report SELECT '01_child_jobs_running', 'now', jsonb_build_object('jobs', count(*)) FROM public.lexeme_processing_jobs j
  WHERE j.input_type = 'synonym_candidate' AND j.finished_at IS NULL
    AND coalesce(j.status, '') NOT IN ('completed', 'needs_manual_review', 'failed', 'cancelled', 'done', 'partial')
    AND j.created_at > now() - interval '6 hours';

DO $mig$
DECLARE r record; v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_md5 text; v_body text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.d10_synonym_dispatch_v1(uuid)', $h_dispatch$CREATE OR REPLACE FUNCTION public.d10_synonym_dispatch_v1(p_exclude_job_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_dispatch$, '86c1727083aeecf35789a441d2f337c8', 'faf994c52b8420164602051b2a915e9b', $b_dispatch$
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
  v_force boolean := false;
  v_active integer := 0;
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
  -- D10_synonym_concurrency_v1 (02.11.2026, agreed): max_concurrent_jobs is applied. Child jobs still running
  -- (not finished, not the job that is just ending, started in the last 6 h so a lost job cannot block forever)
  -- count; a new child job is opened only while fewer than max_concurrent_jobs run. Targets that do not fit stay
  -- 'pending' and are dispatched by a later call (maintenance tick, end of a child job).
  SELECT count(*) INTO v_active FROM public.lexeme_processing_jobs j
  WHERE j.input_type = 'synonym_candidate' AND j.finished_at IS NULL
    AND coalesce(j.status, '') NOT IN ('completed', 'needs_manual_review', 'failed', 'cancelled', 'done', 'partial')
    AND j.id IS DISTINCT FROM p_exclude_job_id AND j.created_at > now() - interval '6 hours';

  FOR v_target IN
    SELECT lower(btrim(c.target_text)) AS norm, c.target_kind AS kind, min(c.created_at) AS first_at
    FROM public.synonym_candidate_queue c
    WHERE c.dispatch_status = 'pending' AND c.source_active AND c.origin_depth = 0
      AND c.pipeline_version = v_cfg.pipeline_version AND c.target_kind IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 3, 1
  LOOP
    -- the same target already waits in an active child job: join it
    UPDATE public.synonym_candidate_queue c SET dispatch_status = 'in_child_job',
      child_job_id = o.child_job_id, dispatched_at = now(), stage1_status = 'waiting_enrichment', updated_at = now(),
      verification_evidence = CASE WHEN c.verification_evidence ? 'force_dispatch_job'
        THEN (c.verification_evidence - 'force_dispatch_job') || jsonb_build_object('forced_child_job', o.child_job_id)
        ELSE c.verification_evidence END
    FROM (SELECT c2.child_job_id FROM public.synonym_candidate_queue c2
          JOIN public.lexeme_processing_jobs j2 ON j2.id = c2.child_job_id
          LEFT JOIN public.pipeline_supervisor_state s2 ON s2.job_id = j2.id
          WHERE c2.dispatch_status = 'in_child_job' AND lower(btrim(c2.target_text)) = v_target.norm
            AND c2.child_job_id IS DISTINCT FROM p_exclude_job_id  -- the job that is just ending
            AND c2.target_kind = v_target.kind
            AND (s2.stage IS NULL OR s2.stage NOT IN ('done','needs_manual_review'))
          ORDER BY c2.dispatched_at LIMIT 1) o
    WHERE c.dispatch_status = 'pending' AND c.source_active AND c.origin_depth = 0
      AND lower(btrim(c.target_text)) = v_target.norm AND c.target_kind = v_target.kind;
    IF FOUND THEN CONTINUE; END IF;

    -- D10_synonym_force_dispatch_v1: a target sent again by a text analysis is processed even when it is ready
    v_force := EXISTS (SELECT 1 FROM public.synonym_candidate_queue c
      WHERE c.dispatch_status = 'pending' AND c.source_active AND c.origin_depth = 0
        AND lower(btrim(c.target_text)) = v_target.norm AND c.target_kind = v_target.kind
        AND c.verification_evidence ? 'force_dispatch_job');

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
          WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
            AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'expression';
        ELSE
          UPDATE public.synonym_candidate_queue SET dispatch_status = 'awaiting_parent',
            stage1_status = 'awaiting_target_resolution', updated_at = now()
          WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
            AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'expression';
        END IF;
        v_new_expr := v_new_expr + 1;
        CONTINUE;
      ELSIF coalesce(v_card.verification_status, '') = ANY (v_accepted) AND NOT v_force THEN
        UPDATE public.synonym_candidate_queue SET dispatch_status = 'skipped_ready',
          stage1_status = 'waiting_enrichment', enrichment_done_at = now(),
          target_entity_ids = public.d10_synonym_target_entities_v1(v_target.norm, 'expression'), updated_at = now()
        WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
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
      IF v_known > 0 AND v_unready = 0 AND NOT v_force THEN
        UPDATE public.synonym_candidate_queue SET dispatch_status = 'skipped_ready',
          stage1_status = 'waiting_enrichment', enrichment_done_at = now(),
          target_entity_ids = public.d10_synonym_target_entities_v1(v_target.norm, 'lexeme'), updated_at = now()
        WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
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
        WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
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
      EXIT WHEN v_active >= v_cfg.max_concurrent_jobs;
      v_today := v_today + 1;
      v_active := v_active + 1;
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
            AND (v_force OR NOT (coalesce(l.dictionary_status, '') = 'active' AND coalesce(l.verification_status, '') = ANY (v_accepted)))
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
      dispatched_at = now(), stage1_status = 'waiting_enrichment', updated_at = now(),
      -- D10_synonym_force_dispatch_v1: the force mark is used once
      verification_evidence = CASE WHEN verification_evidence ? 'force_dispatch_job'
        THEN (verification_evidence - 'force_dispatch_job') || jsonb_build_object('forced_child_job', v_job)
        ELSE verification_evidence END
    WHERE dispatch_status = 'pending' AND source_active AND origin_depth = 0
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
    'daily_limit_reached', v_today >= v_cfg.daily_job_limit,
    'active_child_jobs', v_active, 'max_concurrent_jobs', v_cfg.max_concurrent_jobs);
END
$b_dispatch$)
  ) t(reg, hdr, md5_before, md5_after, body) LOOP
    v_body := replace(r.body, E'\r', '');
    IF md5(v_body) <> r.md5_after THEN RAISE EXCEPTION 'STOP: file body of % damaged (md5 %)', r.reg, md5(v_body); END IF;
    SELECT p.oid, p.prosecdef, p.proconfig, md5(replace(p.prosrc, E'\r', '')) INTO v_oid, v_secdef, v_cfg, v_md5
    FROM pg_proc p WHERE p.oid = to_regprocedure(r.reg);
    IF v_oid IS NULL THEN RAISE EXCEPTION 'STOP: % not found', r.reg; END IF;
    IF v_md5 <> r.md5_before THEN RAISE EXCEPTION 'STOP: % has md5 %, expected %', r.reg, v_md5, r.md5_before; END IF;
    EXECUTE replace(r.hdr, E'\r', '') || 'AS ' || quote_literal(v_body);
    SELECT p.prosecdef, p.proconfig, md5(replace(p.prosrc, E'\r', '')) INTO v_secdef2, v_cfg2, v_md5 FROM pg_proc p WHERE p.oid = v_oid;
    IF v_md5 <> r.md5_after OR v_secdef2 IS DISTINCT FROM v_secdef OR v_cfg2 IS DISTINCT FROM v_cfg THEN
      RAISE EXCEPTION 'STOP: % after replace: md5 %, secdef %, config %', r.reg, v_md5, v_secdef2, v_cfg2;
    END IF;
    INSERT INTO d10_conc_report VALUES ('02_function', r.reg, jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
  END LOOP;
END
$mig$;

DO $probe$
DECLARE v jsonb; v2 jsonb; v_msg text; v_info jsonb; n_pending int;
BEGIN
  BEGIN
    -- 40 ready test targets are made pending with a force mark; with max_concurrent_jobs = 1 and nothing running,
    -- ONE child job may be opened; a second dispatch while it runs opens none (rolled back)
    UPDATE public.synonym_pipeline_config SET max_concurrent_jobs = 1 WHERE singleton;
    UPDATE public.lexeme_processing_jobs SET finished_at = now() WHERE input_type = 'synonym_candidate' AND finished_at IS NULL;
    UPDATE public.synonym_candidate_queue c SET dispatch_status = 'pending', verification_evidence = c.verification_evidence || '{"force_dispatch_job":"probe"}'
    WHERE c.id IN (SELECT id FROM public.synonym_candidate_queue WHERE source_active AND origin_depth = 0
                   AND dispatch_status IN ('enrichment_done', 'skipped_ready') ORDER BY id LIMIT 40);
    v := public.d10_synonym_dispatch_v1(NULL);
    v2 := public.d10_synonym_dispatch_v1(NULL);
    SELECT count(*) INTO n_pending FROM public.synonym_candidate_queue WHERE dispatch_status = 'pending' AND verification_evidence ? 'force_dispatch_job';
    v_info := jsonb_build_object('first_dispatch_jobs', jsonb_array_length(v->'child_job_ids'), 'first_targets', v->'targets',
      'second_dispatch_jobs', jsonb_array_length(v2->'child_job_ids'), 'targets_left_pending', n_pending,
      'active_seen_by_second', v2->'active_child_jobs');
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'D10_PROBE_DONE' THEN RAISE EXCEPTION 'STOP: probe failed: %', v_msg; END IF;
  END;
  IF (v_info->>'first_dispatch_jobs')::int > 1 OR (v_info->>'second_dispatch_jobs')::int > 0 THEN
    RAISE EXCEPTION 'STOP: probe: more child jobs than allowed: %', v_info;
  END IF;
  INSERT INTO d10_conc_report VALUES ('03_probe', 'max_concurrent_jobs = 1 (rolled back)', v_info);
END
$probe$;

SELECT part, name, info FROM d10_conc_report ORDER BY 1, 2;
