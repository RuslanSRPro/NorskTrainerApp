-- D10_synonym_child_job_v1 (27.10.2026, agreed in chat)
--
-- Synonym candidates from NAOB go through the normal analysis pipeline, as
-- one CHILD job, after the user's job has ended. The user's text analysis is
-- not changed and not slowed down.
--
--   user job ends (pipeline-supervisor, updateJobStatus hook)
--     -> d10_synonym_after_job_v1(job)
--        1. collect: the NAOB glosses (gloss_type 'direct') of the job's
--           expression items -> synonym_candidate_queue, with the group of
--           the NAOB sense (synonym_group_key = naob_slug#anchor_id) and its
--           root (root_synonym_lemma = the expression). Always on, no network.
--        2. if the finished job is a child job: its candidates get
--           'enrichment_done' + the cards of the target; cards CREATED by the
--           child job are marked deferred_by_policy (no family 360, no own
--           synonyms) and are listed with the problem words.
--           if it is a normal job: deferred marks of its cards are removed
--           (a normal job processes everything, family 360 included).
--        3. dispatch (agreed 27.10.2026): all pending depth-0 candidates
--           -> child job(s) (input_type 'synonym_candidate') right after the
--           user's job, up to dispatcher_batch_size targets each (set to 50;
--           a remainder becomes the next child job at once), at most
--           daily_job_limit child jobs per 24 h (set to 50; a remainder
--           waits for the next finished job). No wait for another active
--           child job. pipeline_enabled stays as the switch; set on here.
--   child job: normal path (source checks, cards, homographs R8/R9,
--   translations, forms, examples), WITHOUT family 360 (job-orchestrator).
--   Candidates collected inside a child job are kept (origin_depth 1) but
--   never dispatched: no second generation.
--
-- Not in this package: the pair verifier (stage 2), publication rules, cron,
-- backfill of the old 540 relations. No existing row is changed by this
-- migration; get_active_pipeline_jobs is replaced (user jobs first, child
-- jobs limited), everything else is added.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ---------------------------------------------------------------------------
-- 0. Preflight: the replaced function is the expected version.
-- ---------------------------------------------------------------------------
DO $pre$
DECLARE v_def text;
BEGIN
  IF to_regclass('public.synonym_candidate_queue') IS NULL
     OR to_regclass('public.synonym_pipeline_config') IS NULL THEN
    RAISE EXCEPTION 'synonym_stage1_v1 is not installed; nothing changed';
  END IF;
  v_def := pg_get_functiondef('public.get_active_pipeline_jobs(integer)'::regprocedure);
  IF position('ORDER BY j.created_at LIMIT greatest(1,least(coalesce(p_limit,200),200));' IN v_def) = 0
     OR position('d10_synonym' IN v_def) > 0 THEN
    RAISE EXCEPTION 'get_active_pipeline_jobs is not the expected version; nothing changed';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- 1. Candidate: group of the NAOB sense, source job/item, dispatch state.
-- ---------------------------------------------------------------------------
ALTER TABLE public.synonym_candidate_queue
  ADD COLUMN synonym_group_key text,
  ADD COLUMN root_synonym_lemma text,
  ADD COLUMN source_job_id uuid REFERENCES public.lexeme_processing_jobs(id) ON DELETE SET NULL,
  ADD COLUMN source_item_id uuid,
  ADD COLUMN dispatch_status text NOT NULL DEFAULT 'pending' CHECK (dispatch_status IN
    ('pending','in_child_job','skipped_ready','enrichment_done','not_dispatchable','deferred_depth')),
  ADD COLUMN child_job_id uuid REFERENCES public.lexeme_processing_jobs(id) ON DELETE SET NULL,
  ADD COLUMN dispatched_at timestamptz,
  ADD COLUMN enrichment_done_at timestamptz,
  ADD COLUMN target_entity_ids jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(target_entity_ids) = 'array');
CREATE INDEX synonym_candidate_group_idx ON public.synonym_candidate_queue(synonym_group_key);
CREATE INDEX synonym_candidate_dispatch_idx ON public.synonym_candidate_queue(dispatch_status, origin_depth, created_at);
CREATE INDEX synonym_candidate_child_job_idx ON public.synonym_candidate_queue(child_job_id) WHERE child_job_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Cards with enrichment deliberately left out (deferred_by_policy).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.d10_deferred_enrichment_v1 (
  lexeme_id uuid PRIMARY KEY REFERENCES public.lexemes(id) ON DELETE CASCADE,
  facets text[] NOT NULL,
  reason text NOT NULL,
  job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE private.d10_deferred_enrichment_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE private.d10_deferred_enrichment_v1 TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Gloss text -> target terms (pure). ';' separates the parts of a direct
--    gloss (the extractor joins inline boxes with ';'). Commas are NOT split.
--    Dropped: references ("se X"), comparisons ("jf. X"), explanations longer
--    than four words, anything that is not plain letters, the source itself.
--    At most 12 terms per gloss.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_gloss_terms_v1(p_gloss text, p_source text)
RETURNS TABLE(term text, ord integer)
LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $fn$
  WITH parts AS (
    SELECT btrim(regexp_replace(regexp_replace(lower(p.part), '\([^)]*\)', ' ', 'g'), '\s+', ' ', 'g'),
             ' .,:!?') AS t, p.ord::integer AS ord
    FROM unnest(string_to_array(coalesce(p_gloss, ''), ';')) WITH ORDINALITY AS p(part, ord)
  )
  SELECT t, ord FROM parts
  WHERE t ~ '^[a-zæøåéèêóòôüä-]+( [a-zæøåéèêóòôüä-]+){0,3}$'
    AND length(t) BETWEEN 2 AND 80
    AND t !~ '^(se|jf|jamfør|sml|el|eller|dvs|f\.eks) '
    AND t <> lower(btrim(regexp_replace(coalesce(p_source, ''), '\s+', ' ', 'g')))
  ORDER BY ord
  LIMIT 12;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Collect: candidates of one job (idempotent, no network).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_collect_job_v1(p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_version text;
  v_depth integer;
  v_count integer;
BEGIN
  SELECT pipeline_version INTO STRICT v_version FROM public.synonym_pipeline_config WHERE singleton;
  SELECT CASE WHEN j.input_type = 'synonym_candidate' THEN 1 ELSE 0 END INTO v_depth
  FROM public.lexeme_processing_jobs j WHERE j.id = p_job_id;
  IF v_depth IS NULL THEN RETURN 0; END IF;

  WITH src AS (
    SELECT DISTINCT ON (i.expression_id, g.id)
      i.id AS item_id, i.expression_id, g.id AS gloss_id, g.naob_slug, g.anchor_id,
      g.gloss_text, g.context_label, g.normalized_key
    FROM public.lexeme_processing_items i
    JOIN public.naob_expression_glosses g
      ON g.normalized_key = lower(btrim(regexp_replace(coalesce(i.normalized_lemma, ''), '\s+', ' ', 'g')))
     AND g.gloss_type = 'direct' AND g.gloss_text IS NOT NULL
    WHERE i.job_id = p_job_id AND i.match_type = 'expression' AND i.expression_id IS NOT NULL
    ORDER BY i.expression_id, g.id, i.id
  ), ins AS (
    INSERT INTO public.synonym_candidate_queue AS c (
      gloss_id, pipeline_version, source_entity_type, source_entity_id,
      source_sense_anchor, naob_slug, naob_gloss, context_label,
      target_text, target_kind, origin_depth, stage1_status,
      synonym_group_key, root_synonym_lemma, source_job_id, source_item_id, dispatch_status,
      verification_evidence)
    SELECT s.gloss_id, v_version, 'expression', s.expression_id,
      s.anchor_id, s.naob_slug, s.gloss_text, s.context_label,
      t.term, CASE WHEN t.term ~ ' ' THEN 'expression' ELSE 'lexeme' END, v_depth,
      CASE WHEN t.term ~ ' ' THEN 'awaiting_target_resolution' ELSE 'candidate' END,
      s.naob_slug || '#' || coalesce(s.anchor_id, ''), s.normalized_key, p_job_id, s.item_id,
      CASE WHEN v_depth > 0 THEN 'deferred_depth' ELSE 'pending' END,
      jsonb_build_object('collected_by', 'd10_synonym_collect_job_v1', 'gloss_part', t.ord,
        'pos_policy', 'not_guessed_verifier_decides')
    FROM src s CROSS JOIN LATERAL public.d10_synonym_gloss_terms_v1(s.gloss_text, s.normalized_key) t
    ON CONFLICT (gloss_id, lower(btrim(target_text)), pipeline_version) WHERE gloss_id IS NOT NULL
    DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO v_count FROM ins;
  RETURN v_count;
END
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Cards of a target (all parts of speech / the expression).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_target_entities_v1(p_target text, p_kind text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
  SELECT coalesce(jsonb_agg(e ORDER BY e->>'pos', e->>'homograph_key', e->>'id'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('entity_type', 'lexeme', 'id', l.id, 'pos', l.pos,
      'homograph_key', coalesce(l.homograph_key, ''), 'verification_status', l.verification_status,
      'dictionary_status', l.dictionary_status) AS e
    FROM public.lexemes l
    WHERE p_kind = 'lexeme' AND lower(btrim(l.lemma)) = p_target AND coalesce(l.pos, '') <> 'expression'
    UNION ALL
    SELECT jsonb_build_object('entity_type', 'expression', 'id', x.id, 'pos', 'expression',
      'verification_status', x.verification_status, 'lexeme_id', x.lexeme_id)
    FROM public.expression_catalog x
    WHERE p_kind = 'expression' AND x.normalized_key = p_target
  ) q;
$fn$;

-- ---------------------------------------------------------------------------
-- 6a. A filled child job: counters and the list of its targets.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_close_child_job_v1(p_job_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
  UPDATE public.lexeme_processing_jobs j SET
    total_items = (SELECT count(*) FROM public.lexeme_processing_items i WHERE i.job_id = p_job_id),
    input_text = coalesce((SELECT string_agg(DISTINCT lower(btrim(c.target_text)), E'\n')
                  FROM public.synonym_candidate_queue c WHERE c.child_job_id = p_job_id), ''),
    summary = j.summary || jsonb_build_object('total_items',
      (SELECT count(*) FROM public.lexeme_processing_items i WHERE i.job_id = p_job_id)),
    updated_at = now()
  WHERE j.id = p_job_id;
$fn$;

-- ---------------------------------------------------------------------------
-- 6. Dispatch: pending depth-0 candidates -> one child job.
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
      IF NOT FOUND THEN
        -- not a known expression: kept for review, never matched by text alone
        UPDATE public.synonym_candidate_queue SET dispatch_status = 'not_dispatchable',
          stage1_status = 'awaiting_target_resolution', updated_at = now()
        WHERE dispatch_status = 'pending' AND origin_depth = 0
          AND lower(btrim(target_text)) = v_target.norm AND target_kind = 'expression';
        v_not := v_not + 1; CONTINUE;
      END IF;
      IF coalesce(v_card.verification_status, '') = ANY (v_accepted) THEN
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
      VALUES (v_job, v_card.id, NULL, v_target.norm, v_target.norm, v_card.normalized_key, v_target.norm,
        'expression', 'expression', 'pending', 'source_checks', 0, 3,
        jsonb_build_object('ingestion_version', 'd10_synonym_child_job_v1', 'token_start', v_pos, 'token_end', v_pos,
          'match_strategy', 'synonym_candidate', 'origin_type', 'synonym_candidate', 'origin_depth', 1))
      RETURNING id INTO v_item;
      INSERT INTO public.lexeme_source_checks (job_id, item_id, lexeme_id, source, stage, query, surface_form,
        query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
      SELECT v_job, v_item, NULL, s, 'lemma', v_card.normalized_key, v_target.norm, 'expression', 'pending', 0, 3,
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
    'targets', v_targets, 'items', v_items, 'skipped_ready', v_ready, 'not_dispatchable', v_not,
    'daily_limit_reached', v_today >= v_cfg.daily_job_limit);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 7. After a job (pipeline-supervisor hook). Never raises: returns ok=false.
--    May run several times for one job (provisional 'completed', then the
--    final status): every step is idempotent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_after_job_v1(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_job public.lexeme_processing_jobs%rowtype;
  v_collected integer := 0;
  v_done integer := 0;
  v_deferred integer := 0;
  v_cleared integer := 0;
  v_dispatch jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO v_job FROM public.lexeme_processing_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'JOB_NOT_FOUND'); END IF;

  v_collected := public.d10_synonym_collect_job_v1(p_job_id);

  IF v_job.input_type = 'synonym_candidate' THEN
    UPDATE public.synonym_candidate_queue c SET dispatch_status = 'enrichment_done',
      enrichment_done_at = now(),
      target_entity_ids = public.d10_synonym_target_entities_v1(lower(btrim(c.target_text)), c.target_kind),
      updated_at = now()
    WHERE c.child_job_id = p_job_id AND c.dispatch_status = 'in_child_job';
    GET DIAGNOSTICS v_done = ROW_COUNT;
    -- cards CREATED by this child job: no family 360, no own synonyms yet
    INSERT INTO private.d10_deferred_enrichment_v1 (lexeme_id, facets, reason, job_id)
    SELECT DISTINCT i.lexeme_id, ARRAY['family_360','synonyms'], 'synonym_child_job', p_job_id
    FROM public.lexeme_processing_items i
    JOIN public.lexemes l ON l.id = i.lexeme_id
    WHERE i.job_id = p_job_id AND i.lexeme_id IS NOT NULL AND l.created_at >= v_job.created_at
    ON CONFLICT (lexeme_id) DO NOTHING;
    GET DIAGNOSTICS v_deferred = ROW_COUNT;
  ELSE
    -- a normal job processes everything (family 360 included)
    DELETE FROM private.d10_deferred_enrichment_v1 d
    USING public.lexeme_processing_items i
    WHERE i.job_id = p_job_id AND i.lexeme_id = d.lexeme_id;
    GET DIAGNOSTICS v_cleared = ROW_COUNT;
  END IF;

  v_dispatch := public.d10_synonym_dispatch_v1(p_job_id);
  RETURN jsonb_build_object('ok', true, 'collected', v_collected, 'enrichment_done', v_done,
    'deferred_marked', v_deferred, 'deferred_cleared', v_cleared, 'dispatch', v_dispatch);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 8. Supervisor discovery: user jobs first, then child jobs (oldest first).
--    Otherwise unchanged.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_pipeline_jobs(p_limit integer DEFAULT 200)
 RETURNS TABLE(id uuid, status text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  WITH cutoff AS (
    SELECT (value #>> '{}')::timestamptz AS installed_at
    FROM private.d10_runtime_settings_v1 WHERE key='enrichment_residue_cutoff'
  ), active AS (
    SELECT j.id,j.status,j.created_at,(j.input_type='synonym_candidate') AS is_child
    FROM public.lexeme_processing_jobs j
    LEFT JOIN public.pipeline_supervisor_state s ON s.job_id=j.id
    LEFT JOIN cutoff ON true
    WHERE j.status IN ('pending','processing','ready','done','retry_scheduled','partial')
      AND (s.stage IS NULL OR s.stage NOT IN ('done','needs_manual_review'))
      AND (j.status<>'partial' OR j.created_at>=coalesce(cutoff.installed_at,'infinity'::timestamptz))
  )
  -- d10_synonym_child_job_v1: child jobs go after user jobs
  SELECT a.id,a.status,a.created_at
  FROM active a
  ORDER BY a.is_child, a.created_at LIMIT greatest(1,least(coalesce(p_limit,200),200));
$function$;

-- ---------------------------------------------------------------------------
-- 9. Problem words v2 = v1 + cards with deferred enrichment.
--    v1 stays unchanged (the app switches to v2).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_problem_cards_v2(p_limit integer DEFAULT 300)
 RETURNS TABLE(lexeme_id uuid, lemma text, pos text, display_form text, homograph_key text,
   missing_translation boolean, missing_example boolean, review_reason text, legacy boolean,
   deferred_by_policy boolean, deferred_facets text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  WITH base AS (
    SELECT * FROM public.d10_problem_cards_v1(1000)
  ), deferred AS (
    SELECT d.lexeme_id, d.facets, l.lemma, l.pos, l.display_form, coalesce(l.homograph_key, '') AS homograph_key,
      l.created_at
    FROM private.d10_deferred_enrichment_v1 d
    JOIN public.lexemes l ON l.id = d.lexeme_id
    WHERE l.is_learning_lexeme
  ), merged AS (
    SELECT b.lexeme_id, b.lemma, b.pos, b.display_form, b.homograph_key, b.missing_translation,
      b.missing_example, b.review_reason, b.legacy, (d.lexeme_id IS NOT NULL) AS deferred_by_policy,
      d.facets AS deferred_facets, 0 AS grp
    FROM base b LEFT JOIN deferred d ON d.lexeme_id = b.lexeme_id
    UNION ALL
    SELECT d.lexeme_id, d.lemma, d.pos, d.display_form, d.homograph_key, false, false, NULL::text,
      false, true, d.facets, 1
    FROM deferred d
    WHERE NOT EXISTS (SELECT 1 FROM base b WHERE b.lexeme_id = d.lexeme_id)
  )
  SELECT lexeme_id, lemma, pos, display_form, homograph_key, missing_translation, missing_example,
    review_reason, legacy, deferred_by_policy, deferred_facets
  FROM merged
  ORDER BY grp, missing_translation DESC, legacy, lemma, lexeme_id
  LIMIT least(greatest(coalesce(p_limit, 300), 1), 1000);
$function$;

CREATE OR REPLACE FUNCTION public.d10_problem_cards_count_v2()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT count(*)::integer FROM public.d10_problem_cards_v2(1000);
$function$;

-- ---------------------------------------------------------------------------
-- 10. Rights: internal functions only for service_role; the problem list as v1.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.d10_synonym_gloss_terms_v1(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_collect_job_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_target_entities_v1(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_dispatch_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_close_child_job_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_close_child_job_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.d10_synonym_after_job_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_gloss_terms_v1(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_collect_job_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_target_entities_v1(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_dispatch_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_after_job_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.get_active_pipeline_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_pipeline_jobs(integer) TO service_role;

DO $grants$
DECLARE r record;
BEGIN
  -- the v2 problem list gets exactly the rights v1 has
  FOR r IN SELECT DISTINCT grantee FROM information_schema.routine_privileges
           WHERE routine_schema = 'public' AND routine_name = 'd10_problem_cards_v1' AND privilege_type = 'EXECUTE'
  LOOP
    CONTINUE WHEN r.grantee = 'PUBLIC';  -- PUBLIC keeps the default, as for v1
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.d10_problem_cards_v2(integer) TO %I', r.grantee);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.d10_problem_cards_count_v2() TO %I', r.grantee);
  END LOOP;
END
$grants$;

-- ---------------------------------------------------------------------------
-- 11. Switch on, 50 targets per child job, 50 child jobs per 24 h
--     (agreed 27.10.2026). Off again:
--     update public.synonym_pipeline_config set pipeline_enabled = false where singleton;
-- ---------------------------------------------------------------------------
UPDATE public.synonym_pipeline_config SET pipeline_enabled = true, dispatcher_batch_size = 50,
  daily_job_limit = 50, updated_at = now() WHERE singleton;

COMMIT;
