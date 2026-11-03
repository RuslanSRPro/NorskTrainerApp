-- D10_expression_resolver_v1 (29.10.2026, agreed in chat: variant A)
--
-- A NAOB synonym that is an expression NOT in expression_catalog is resolved
-- through Ordbøkene before it goes to a child job:
--   1. synonym-verifier (resolver step, no AI): Ordbøkene phrase search
--      (articles?w=…&dict=bm&scope=e) -> the article must be exactly this
--      expression (isExactExpressionArticle, as for "dra ut") -> its head
--      word articles ("referers", e.g. holde øye med -> øye 42942).
--   2. the head word card bound to that article exists -> the existing
--      ordbokene-lexeme-pipeline-worker extracts and promotes the expressions
--      of that article (same as the ordbokene chain does for every word).
--      No card yet -> the head word goes to a synonym child job as a normal
--      word (one round); after it the resolver looks again.
--   3. the expression is in the catalog -> its candidates go back to
--      'pending' and are dispatched as a known expression (path of dra ut).
--   Not an own Ordbøkene expression article -> NAOB explanation
--   (rejected 'naob_explanation', not a problem word, no child job).
--   Anything else (no head word article, extraction without the expression,
--   3 network failures) -> 'not_dispatchable' with the reason: listed with the
--   problem words for a re-run.
-- Only the expression the synonym asked for can become a card; the other
-- expressions of the head word article get catalog entries, not cards
-- (exactly as when that word is analysed today).
-- Woken by the existing supervisor wake of synonym-verifier (pending count
-- now includes the resolver). No cron, no pg_net.
-- Guards: whitespace-stripped md5 of d10_synonym_dispatch_v1 (D10_synonym_
-- expressions_v1) and d10_synonym_verifier_pending_v1 (D10_synonym_verifier_
-- b_v1); the dispatch_status check constraint must exist. Else STOP.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE v_md5 text;
BEGIN
  SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'd10_synonym_dispatch_v1';
  IF v_md5 IS DISTINCT FROM 'cbc3b41442f54c760a3e32e95224c009' THEN
    RAISE EXCEPTION 'STOP: d10_synonym_dispatch_v1 is not the expected version (md5 %); nothing changed', v_md5;
  END IF;
  SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'd10_synonym_verifier_pending_v1';
  IF v_md5 IS DISTINCT FROM 'f81da64e981fe3244df00178a5611b53' THEN
    RAISE EXCEPTION 'STOP: d10_synonym_verifier_pending_v1 is not the expected version (md5 %) - is D10_synonym_verifier_b_v1 installed? nothing changed', v_md5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'synonym_candidate_queue_dispatch_status_check'
                 AND conrelid = 'public.synonym_candidate_queue'::regclass) THEN
    RAISE EXCEPTION 'STOP: constraint synonym_candidate_queue_dispatch_status_check not found; nothing changed';
  END IF;
  IF to_regclass('public.synonym_expression_resolution_v1') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_expression_resolver_v1 is already installed; nothing changed';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- 1. New candidate state: waiting for the expression resolver
-- ---------------------------------------------------------------------------
ALTER TABLE public.synonym_candidate_queue DROP CONSTRAINT synonym_candidate_queue_dispatch_status_check;
ALTER TABLE public.synonym_candidate_queue ADD CONSTRAINT synonym_candidate_queue_dispatch_status_check
  CHECK (dispatch_status IN ('pending','in_child_job','skipped_ready','enrichment_done','not_dispatchable',
    'deferred_depth','awaiting_parent'));

-- ---------------------------------------------------------------------------
-- 2. One resolution per expression text (shared by its candidates)
-- ---------------------------------------------------------------------------
CREATE TABLE public.synonym_expression_resolution_v1 (
  norm_text text PRIMARY KEY CHECK (length(btrim(norm_text)) > 0),
  status text NOT NULL CHECK (status IN ('queued','processing','parent_needed','parent_waiting',
    'resolved','explanation','retry_wait','failed')),
  own_article_id bigint,
  parent_article_id bigint,
  parent_lemma text,
  parent_job_id uuid REFERENCES public.lexeme_processing_jobs(id) ON DELETE SET NULL,
  expression_id uuid,
  rounds integer NOT NULL DEFAULT 0 CHECK (rounds >= 0),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX synonym_expression_resolution_v1_status_idx ON public.synonym_expression_resolution_v1 (status, next_attempt_at);
ALTER TABLE public.synonym_expression_resolution_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_expression_resolution_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.synonym_expression_resolution_v1 TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Dispatch (changed: the "not in the catalog" branch only)
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
-- 4. A card bound to an Ordbøkene bm article (bindings + morphology snapshots,
--    the same sources as d10_lexeme_article_ids_v1, read the other way)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_lexeme_for_article_v1(p_article_id bigint)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
  SELECT jsonb_build_object('lexeme_id', l.id, 'lemma', l.lemma, 'pos', l.pos)
  FROM public.lexemes l
  WHERE l.id IN (
      SELECT b.lexeme_id FROM private.authoritative_morphology_article_bindings_v2 b
      WHERE b.article_id = p_article_id AND b.is_active AND b.dictionary_code = 'bm'
      UNION
      SELECT ms.lexeme_id FROM private.authoritative_morphology_snapshots_v2 ms
      WHERE ms.is_active AND p_article_id = ANY (ms.source_article_ids))
    AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown')
  ORDER BY (coalesce(l.dictionary_status, '') = 'active') DESC, l.created_at, l.id
  LIMIT 1;
$fn$;

-- ---------------------------------------------------------------------------
-- 5. What the database already knows for a found expression article
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_expr_resolver_state_v1(p_norm text, p_own_article_id bigint,
  p_parent_article_ids bigint[])
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_expr uuid;
  v_parent jsonb;
  v_art bigint;
BEGIN
  SELECT x.id INTO v_expr FROM public.expression_catalog x
  WHERE x.normalized_key = lower(btrim(p_norm)) ORDER BY (x.lexeme_id IS NULL), x.id LIMIT 1;
  IF v_expr IS NULL AND p_own_article_id IS NOT NULL THEN
    SELECT c.promoted_expression_id INTO v_expr FROM public.ordbokene_expression_candidates c
    WHERE c.candidate_article_id = p_own_article_id AND upper(c.candidate_dictionary_code) = 'BM'
      AND c.promoted_expression_id IS NOT NULL
    ORDER BY c.created_at LIMIT 1;
  END IF;
  FOREACH v_art IN ARRAY coalesce(p_parent_article_ids, '{}'::bigint[]) LOOP
    v_parent := public.d10_lexeme_for_article_v1(v_art);
    IF v_parent IS NOT NULL THEN
      v_parent := v_parent || jsonb_build_object('article_id', v_art);
      EXIT;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('expression_id', v_expr, 'parent', v_parent);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 6. Lease (a finished head word job puts its rows back to 'queued')
-- ---------------------------------------------------------------------------
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
    RETURNING r.norm_text, r.lease_token, r.rounds, r.attempts
  )
  SELECT coalesce(jsonb_agg(to_jsonb(upd)), '[]'::jsonb) INTO v_rows FROM upd;
  RETURN jsonb_build_object('ok', true, 'rows', v_rows);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 7. Outcome of one resolution
--    resolved      {expression_id}        -> candidates pending + dispatch
--    explanation   {searched_article_ids}  -> candidates rejected naob_explanation
--    parent_needed {parent_lemma, parent_article_id, own_article_id}
--    failed        {reason}               -> candidates not_dispatchable (problem words)
--    retry         {error}                -> retry_wait; the 3rd time = failed
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 8. Head words that need a card: ONE synonym child job for all of them
--    (same item shape as the dispatcher's words; same daily job limit).
--    A head word card that is already ready but not bound to the article the
--    expression lives in -> failed 'head_word_other_article' (problem words).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_expr_resolver_parent_jobs_v1()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_cfg public.synonym_pipeline_config%rowtype;
  v_today integer;
  v_job uuid;
  v_user text;
  v_lemma text;
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

  FOR v_lemma IN
    SELECT DISTINCT r.parent_lemma FROM public.synonym_expression_resolution_v1 r
    WHERE r.status = 'parent_needed' AND coalesce(r.parent_lemma, '') <> '' ORDER BY 1 LIMIT 50
  LOOP
    SELECT count(*) FILTER (WHERE NOT (coalesce(l.dictionary_status, '') = 'active' AND coalesce(l.verification_status, '') = ANY (v_accepted))),
           count(*)
      INTO v_unready, v_known
    FROM public.lexemes l
    WHERE lower(btrim(l.lemma)) = v_lemma AND coalesce(l.homograph_key, '') = ''
      AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown');
    IF v_known > 0 AND v_unready = 0 THEN
      -- ready cards exist, none bound to the article of the expression
      UPDATE public.synonym_expression_resolution_v1 SET status = 'failed', last_error = 'head_word_other_article',
        updated_at = now() WHERE status = 'parent_needed' AND parent_lemma = v_lemma;
      UPDATE public.synonym_candidate_queue c SET dispatch_status = 'not_dispatchable', stage1_status = 'needs_manual_review',
        verification_evidence = c.verification_evidence || jsonb_build_object('stage_a',
          jsonb_build_object('reason', 'resolver_head_word_other_article', 'prepared_at', now(), 'by', 'expression_resolver')),
        updated_at = now()
      FROM public.synonym_expression_resolution_v1 r
      WHERE r.parent_lemma = v_lemma AND r.status = 'failed' AND r.last_error = 'head_word_other_article'
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
      WHERE r.status = 'parent_needed' AND r.parent_lemma = v_lemma
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
        WHERE lower(btrim(l.lemma)) = v_lemma AND coalesce(l.homograph_key, '') = ''
          AND coalesce(l.pos, '') NOT IN ('', 'expression', 'unknown')
          AND NOT (coalesce(l.dictionary_status, '') = 'active' AND coalesce(l.verification_status, '') = ANY (v_accepted))
        ORDER BY l.pos, l.id
      LOOP
        INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
          normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
        VALUES (v_job, NULL, NULL, v_lemma, v_lemma, lower(btrim(v_card.lemma)), v_lemma,
          v_card.pos, 'token', 'pending', 'source_checks', 0, 3,
          jsonb_build_object('ingestion_version', 'd10_expression_resolver_v1', 'token_start', v_pos, 'token_end', v_pos,
            'match_strategy', 'expression_head_word', 'origin_type', 'synonym_candidate', 'origin_depth', 1,
            'resolved_lexeme_id', v_card.id, 'resolved_lemma', v_card.lemma, 'resolved_pos', v_card.pos))
        RETURNING id INTO v_item;
        INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
          query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
        SELECT v_job, v_item, v_card.id, s, 'lemma', lower(btrim(v_card.lemma)), v_lemma, 'token', 'pending', 0, 3,
          '{}'::jsonb, '[]'::jsonb, 1
        FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
        v_items := v_items + 1;
      END LOOP;
    ELSE
      INSERT INTO public.lexeme_processing_items (job_id, expression_id, lexeme_id, raw_input, normalized_input,
        normalized_lemma, surface_form, pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
      VALUES (v_job, NULL, NULL, v_lemma, v_lemma, v_lemma, v_lemma,
        NULL, 'token', 'pending', 'source_checks', 0, 3,
        jsonb_build_object('ingestion_version', 'd10_expression_resolver_v1', 'token_start', v_pos, 'token_end', v_pos,
          'match_strategy', 'expression_head_word', 'origin_type', 'synonym_candidate', 'origin_depth', 1))
      RETURNING id INTO v_item;
      INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
        query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
      SELECT v_job, v_item, NULL, s, 'lemma', v_lemma, v_lemma, 'token', 'pending', 0, 3,
        '{}'::jsonb, '[]'::jsonb, 1
      FROM unnest(ARRAY['NAOB','Ordbokene','Lexin','Språkrådet','Wiktionary']) AS s;
      v_items := v_items + 1;
    END IF;
    v_pos := v_pos + 1;
    UPDATE public.synonym_expression_resolution_v1 SET status = 'parent_waiting', parent_job_id = v_job, updated_at = now()
    WHERE status = 'parent_needed' AND parent_lemma = v_lemma;
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

-- ---------------------------------------------------------------------------
-- 9. Wake check of the supervisor: pairs (stage B) + resolutions due
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_pending_v1()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
  SELECT (SELECT count(*)::integer FROM public.synonym_pair_v1 p
          WHERE p.status = 'queued'
             OR (p.status = 'retry_wait' AND coalesce(p.next_attempt_at, now()) <= now())
             OR (p.status = 'processing' AND p.lease_until <= now()))
       + (SELECT count(*)::integer FROM public.synonym_expression_resolution_v1 r
          WHERE r.status IN ('queued', 'parent_needed')
             OR (r.status = 'retry_wait' AND coalesce(r.next_attempt_at, now()) <= now())
             OR (r.status = 'processing' AND r.lease_until <= now())
             OR (r.status = 'parent_waiting' AND (r.parent_job_id IS NULL OR EXISTS (
                  SELECT 1 FROM public.lexeme_processing_jobs j WHERE j.id = r.parent_job_id
                    AND j.status IN ('completed', 'needs_manual_review', 'failed', 'cancelled')))));
$fn$;

-- ---------------------------------------------------------------------------
-- 10. Expression synonyms without a card go through the resolver once:
--     back to 'pending' (they are dispatched -> resolver after the next
--     finished job or the next resolver run).
-- ---------------------------------------------------------------------------
UPDATE public.synonym_candidate_queue
SET dispatch_status = 'pending', stage1_status = 'candidate', updated_at = now(),
    verification_evidence = (verification_evidence - 'stage_a') || jsonb_build_object('released',
      jsonb_build_object('by', 'd10_expression_resolver_v1', 'at', now(), 'was', dispatch_status))
WHERE origin_depth = 0 AND target_kind = 'expression' AND target_entity_ids = '[]'::jsonb
  AND dispatch_status IN ('enrichment_done', 'not_dispatchable');

-- ---------------------------------------------------------------------------
-- 11. Rights: service_role only
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.d10_lexeme_for_article_v1(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_expr_resolver_state_v1(text, bigint, bigint[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_expr_resolver_lease_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_expr_resolver_record_v1(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_expr_resolver_parent_jobs_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_lexeme_for_article_v1(bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_expr_resolver_state_v1(text, bigint, bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_expr_resolver_lease_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_expr_resolver_record_v1(text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_expr_resolver_parent_jobs_v1() TO service_role;

COMMIT;
