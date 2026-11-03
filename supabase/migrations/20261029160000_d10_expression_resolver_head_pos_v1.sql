-- D10_expression_resolver_head_pos_v1 (29.10.2026)
-- What the first run showed (query 261/263):
--   fyre av   - "referers" lists every article that points to the expression
--               (avfyre, avfyring, fyre, skuddløsning); the resolver took avfyre.
--               Edge (expression-resolver.ts): a head word that is a word of the
--               expression comes first, the others are not used when there is one.
--   folde ut, strekke til - the head word went without a part of speech; folde /
--               strekke have two Ordbøkene articles -> gate: unknown_pos_requires_review.
--               The head word now goes with the part of speech of the article the
--               expression lives in (parent_pos, read from that article).
--   ta seg i vare - the expression lives in another homograph article of "vare";
--               stays in the problem words (head_word_other_article).
-- Database: column parent_pos; record (stores parent_pos); parent jobs (item with
-- that part of speech; only cards of that part of speech count). The three
-- expressions above (not vare) go through the resolver again.
-- Guards: md5 of both replaced functions; column must not exist.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE v_md5 text;
BEGIN
  SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5 FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.d10_expr_resolver_record_v1(text,uuid,text,jsonb)');
  IF v_md5 IS DISTINCT FROM 'e39ae4be34f2f630160a988c5319f055' THEN
    RAISE EXCEPTION 'STOP: d10_expr_resolver_record_v1 is not the expected version (md5 %); nothing changed', v_md5;
  END IF;
  SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5 FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.d10_expr_resolver_parent_jobs_v1()');
  IF v_md5 IS DISTINCT FROM '87bb59b03908f2384b016699eb495f85' THEN
    RAISE EXCEPTION 'STOP: d10_expr_resolver_parent_jobs_v1 is not the expected version (md5 %); nothing changed', v_md5;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'synonym_expression_resolution_v1' AND column_name = 'parent_pos') THEN
    RAISE EXCEPTION 'STOP: parent_pos already exists; nothing changed';
  END IF;
END
$pre$;

ALTER TABLE public.synonym_expression_resolution_v1 ADD COLUMN parent_pos text;

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
BEGIN
  SELECT * INTO r FROM public.synonym_expression_resolution_v1
  WHERE norm_text = p_norm AND status = 'processing' AND lease_token = p_lease_token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'applied', false, 'stale', true); END IF;
  p_data := coalesce(p_data, '{}'::jsonb);

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
    WHERE dispatch_status = 'awaiting_parent' AND origin_depth = 0 AND target_kind = 'expression'
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
    WHERE dispatch_status = 'awaiting_parent' AND origin_depth = 0 AND target_kind = 'expression'
      AND lower(btrim(target_text)) = p_norm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF v_outcome = 'parent_needed' THEN
    UPDATE public.synonym_expression_resolution_v1 SET status = 'parent_needed',
      parent_lemma = lower(btrim(p_data->>'parent_lemma')), parent_article_id = (p_data->>'parent_article_id')::bigint,
      parent_pos = nullif(btrim(p_data->>'parent_pos'), ''),
      own_article_id = (p_data->>'own_article_id')::bigint, rounds = rounds + 1, evidence = evidence || p_data,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
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
    WHERE dispatch_status = 'awaiting_parent' AND origin_depth = 0 AND target_kind = 'expression'
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
  v_accepted constant text[] := ARRAY['multi_source','usage_verified','authoritative','verified',
    'source_verified','multi_source_verified'];
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_pipeline_config WHERE singleton;
  IF NOT v_cfg.pipeline_enabled THEN RETURN jsonb_build_object('ok', true, 'job', NULL, 'reason', 'pipeline_disabled'); END IF;
  PERFORM pg_advisory_xact_lock(20261027, 2);   -- the dispatcher's lock
  IF NOT EXISTS (SELECT 1 FROM public.synonym_expression_resolution_v1 WHERE status = 'parent_needed') THEN
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
  RETURN jsonb_build_object('ok', true, 'job', v_job, 'items', v_items, 'head_word_other_article', v_failed);
END
$fn$;

-- the expressions that failed on the head word step go through the resolver again
UPDATE public.synonym_candidate_queue c
SET dispatch_status = 'awaiting_parent', stage1_status = 'awaiting_target_resolution',
    verification_evidence = c.verification_evidence - 'stage_a', updated_at = now()
FROM public.synonym_expression_resolution_v1 r
WHERE r.status = 'failed' AND r.last_error IN ('head_word_card_not_bound', 'not_extracted_from_head_word')
  AND c.dispatch_status = 'not_dispatchable' AND c.origin_depth = 0 AND c.target_kind = 'expression'
  AND lower(btrim(c.target_text)) = r.norm_text
  AND c.verification_evidence->'stage_a'->>'reason' IN ('resolver_head_word_card_not_bound', 'resolver_not_extracted_from_head_word');

UPDATE public.synonym_expression_resolution_v1
SET status = 'queued', attempts = 0, rounds = 0, next_attempt_at = NULL, last_error = NULL,
    parent_lemma = NULL, parent_article_id = NULL, parent_job_id = NULL,
    lease_token = NULL, lease_until = NULL, updated_at = now()
WHERE status = 'failed' AND last_error IN ('head_word_card_not_bound', 'not_extracted_from_head_word');

COMMIT;
