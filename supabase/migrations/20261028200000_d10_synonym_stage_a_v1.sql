-- D10_synonym_stage_a_v1 (28.10.2026, agreed: stage A of the synonym verifier)
--
-- Prepares synonym candidates for verification. NO AI, NO network, NO
-- publication, NO change to the carousel, NO cron. Only the database.
--
--   candidate (synonym_candidate_queue, NAOB gloss of an expression)
--     -> source sense: the NAOB sense of the gloss (naob_slug#anchor)
--        -> public.semantic_senses (source 'NAOB')
--     -> target cards: target_entity_ids of the candidate (all parts of
--        speech / homograph cards, excluded cards left out)
--     -> target sense: ONE Ordbøkene article of the card (from the existing
--        cache public.ordbokene_article_cache), its explanations as the
--        definition -> public.semantic_senses (source 'Ordbokene')
--        a card without an article: its Lexin definition (entity_definitions nb)
--     -> one PAIR per (candidate, target card, target article):
--        public.synonym_pair_v1 with a snapshot (both sides: lemma, part of
--        speech, definition, translations uk/en, NAOB evidence) and its hash.
--
--   cheap rules before any AI (stage B):
--     self_relation                - the target is the source itself
--     incompatible_part_of_speech  - both parts of speech known and different
--     target_pos_unknown           - the target card has no part of speech
--     target_without_definition    - no article and no Lexin definition
--     too_many_target_senses       - more than 5 possible target senses
--     no_source_gloss              - the NAOB gloss is empty
--   a target article not in the cache -> status waiting_article_cache
--   (the stage B worker fills the cache, then the pair is prepared again).
--
--   events (no scan of the database):
--     after EVERY finished job, d10_synonym_after_job_v1 (pipeline-supervisor
--     hook, unchanged otherwise) now also calls
--     d10_synonym_prepare_for_job_v1(job):
--       - candidates of the job / of the child job that are ready
--         (enrichment_done, skipped_ready)
--       - candidates whose source or target card was in this job: their
--         snapshot is computed again; a changed hash resets the result
--         (the old one goes to the history of the pair), unchanged = nothing.
--
-- New: table synonym_pair_v1, functions d10_ordbokene_explanations_v1,
-- d10_synonym_source_pos_v1, d10_synonym_prepare_candidate_v1,
-- d10_synonym_prepare_for_job_v1. Replaced: d10_synonym_after_job_v1 (the same
-- body + one guarded call at the end). Nothing existing is deleted.
-- Guard: stops if d10_synonym_after_job_v1 is not the version read on
-- 28.10.2026 (query 250; whitespace ignored).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $guard$
DECLARE v_key text;
BEGIN
  SELECT md5(regexp_replace(p.prosrc, '\s+', '', 'g')) INTO v_key
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'd10_synonym_after_job_v1';
  IF v_key IS DISTINCT FROM '23442b172392063c80279fbec4ba2628' THEN
    RAISE EXCEPTION 'BASE_CHANGED: d10_synonym_after_job_v1 key %, expected 23442b172392063c80279fbec4ba2628', v_key;
  END IF;
  IF to_regclass('public.ordbokene_article_cache') IS NULL OR to_regclass('public.semantic_senses') IS NULL THEN
    RAISE EXCEPTION 'ordbokene_article_cache / semantic_senses missing; nothing changed';
  END IF;
END
$guard$;

-- ---------------------------------------------------------------------------
-- 1. Pairs to verify (queue + result of stage B; publication is stage C).
-- ---------------------------------------------------------------------------
CREATE TABLE public.synonym_pair_v1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.synonym_candidate_queue(id) ON DELETE CASCADE,
  source_entity_type text NOT NULL CHECK (source_entity_type IN ('lexeme','expression')),
  source_entity_id uuid NOT NULL,
  source_sense_id uuid REFERENCES public.semantic_senses(id) ON DELETE SET NULL,
  target_entity_type text NOT NULL CHECK (target_entity_type IN ('lexeme','expression')),
  target_entity_id uuid NOT NULL,
  target_article_key text NOT NULL,              -- Ordbøkene article id, or 'none'
  target_sense_id uuid REFERENCES public.semantic_senses(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('queued','waiting_article_cache','rejected_rule',
    'needs_manual_review','superseded','processing','retry_wait','done','failed')),
  rule_reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_hash text,
  snapshot_version integer NOT NULL DEFAULT 1 CHECK (snapshot_version >= 1),
  -- stage B (verifier) writes these; stage C publishes from them
  decision text CHECK (decision IN ('verified_synonym','contextual_synonym','near_synonym',
    'related','rejected','needs_manual_review')),
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  verification_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  history jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(history) = 'array'),
  verifier_version text,
  verified_at timestamptz,
  published boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, target_entity_type, target_entity_id, target_article_key)
);
CREATE INDEX synonym_pair_v1_status_idx ON public.synonym_pair_v1 (status, next_attempt_at, created_at);
CREATE INDEX synonym_pair_v1_source_idx ON public.synonym_pair_v1 (source_entity_type, source_entity_id);
CREATE INDEX synonym_pair_v1_target_idx ON public.synonym_pair_v1 (target_entity_type, target_entity_id);
ALTER TABLE public.synonym_pair_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_pair_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.synonym_pair_v1 TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Explanations of a cached Ordbøkene article (pure). Walks
--    body.definitions / elements, skips sub-articles (their own meaning,
--    e.g. "bare seg"), renders "$" placeholders like the AI worker:
--    article_ref -> its lemmas, usage -> its text, entity mots -> motsatt.
--    At most 12, duplicates removed, order kept.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_ordbokene_explanations_v1(p_payload jsonb)
RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'pg_catalog' AS $fn$
DECLARE
  v_out text[] := '{}';
  v_stack jsonb[] := ARRAY[coalesce(p_payload->'body'->'definitions', '[]'::jsonb)];
  v_node jsonb;
  v_child jsonb;
  v_parts text[];
  v_text text;
  v_item jsonb;
  v_i integer;
  v_guard integer := 0;
BEGIN
  WHILE array_length(v_stack, 1) > 0 AND v_guard < 2000 LOOP
    v_guard := v_guard + 1;
    v_node := v_stack[array_length(v_stack, 1)];
    v_stack := v_stack[1:array_length(v_stack, 1) - 1];
    IF jsonb_typeof(v_node) = 'array' THEN
      -- push in reverse so the first element is visited first
      FOR v_i IN REVERSE jsonb_array_length(v_node) - 1 .. 0 LOOP
        v_stack := v_stack || (v_node -> v_i);
      END LOOP;
      CONTINUE;
    END IF;
    IF jsonb_typeof(v_node) <> 'object' THEN CONTINUE; END IF;
    IF v_node->>'type_' = 'sub_article' THEN CONTINUE; END IF;
    IF v_node->>'type_' = 'explanation' AND jsonb_typeof(v_node->'content') = 'string' THEN
      v_parts := string_to_array(v_node->>'content', '$');
      v_text := v_parts[1];
      FOR v_i IN 2 .. coalesce(array_length(v_parts, 1), 1) LOOP
        v_item := v_node->'items'->(v_i - 2);
        v_text := v_text || CASE
          WHEN v_item->>'type_' = 'article_ref' THEN coalesce((
            SELECT string_agg(l->>'lemma', ' / ') FROM jsonb_array_elements(coalesce(v_item->'lemmas', '[]'::jsonb)) l
            WHERE coalesce(l->>'lemma', '') <> ''), '')
          WHEN v_item->>'type_' = 'usage' THEN coalesce(v_item->>'text', '')
          WHEN v_item->>'type_' = 'entity' AND v_item->>'id' = 'mots' THEN 'motsatt'
          ELSE '' END || v_parts[v_i];
      END LOOP;
      v_text := btrim(regexp_replace(v_text, '\s+', ' ', 'g'));
      IF v_text <> '' AND NOT (v_text = ANY (v_out)) AND coalesce(array_length(v_out, 1), 0) < 12 THEN
        v_out := v_out || v_text;
      END IF;
      CONTINUE;
    END IF;
    IF v_node->>'type_' = 'example' THEN CONTINUE; END IF;
    v_child := coalesce(v_node->'elements', v_node->'definitions');
    IF v_child IS NOT NULL THEN v_stack := v_stack || v_child; END IF;
  END LOOP;
  RETURN v_out;
END
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Part of speech of a source expression: the part of speech of its root
--    when the root has exactly ONE learning part of speech (sette -> verb).
--    Otherwise NULL (the verifier decides; no rule rejects on it).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_source_pos_v1(p_entity_type text, p_entity_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
  SELECT CASE
    WHEN p_entity_type = 'lexeme' THEN (SELECT nullif(l.pos, '') FROM public.lexemes l WHERE l.id = p_entity_id)
    ELSE (
      SELECT CASE WHEN count(DISTINCT l.pos) = 1 THEN min(l.pos) END
      FROM public.expression_catalog x
      JOIN public.lexemes l ON lower(btrim(l.lemma)) = lower(btrim(coalesce(x.root_lemma, split_part(x.normalized_key, ' ', 1))))
      WHERE x.id = p_entity_id AND coalesce(l.homograph_key, '') = ''
        AND l.pos IN ('verb','noun','adjective','adverb') AND coalesce(l.dictionary_status, 'active') <> 'excluded')
  END;
$fn$;

-- ---------------------------------------------------------------------------
-- 4. Prepare the pairs of ONE candidate (idempotent).
--    p_dry_run = true: returns what would be written, writes nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_prepare_candidate_v1(p_candidate_id uuid, p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  c public.synonym_candidate_queue%rowtype;
  v_src_lemma text;
  v_src_lexeme uuid;
  v_src_pos text;
  v_src_tr jsonb;
  v_src_sense uuid;
  v_src jsonb;
  v_t jsonb;
  v_card record;
  v_art bigint;
  v_arts bigint[];
  v_payload jsonb;
  v_defs text[];
  v_tr jsonb;
  v_pairs jsonb := '[]'::jsonb;
  v_pair jsonb;
  v_status text;
  v_reason text;
  v_sense uuid;
  v_snapshot jsonb;
  v_hash text;
  v_open integer;
  v_written integer := 0;
  v_reset integer := 0;
  v_keys text[] := '{}';
  v_key text;
BEGIN
  SELECT * INTO c FROM public.synonym_candidate_queue WHERE id = p_candidate_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'CANDIDATE_NOT_FOUND'); END IF;
  IF c.dispatch_status NOT IN ('enrichment_done', 'skipped_ready') THEN
    RETURN jsonb_build_object('ok', true, 'skipped', 'not_ready', 'dispatch_status', c.dispatch_status);
  END IF;

  -- source side
  IF c.source_entity_type = 'expression' THEN
    SELECT x.lemma, x.lexeme_id INTO v_src_lemma, v_src_lexeme FROM public.expression_catalog x WHERE x.id = c.source_entity_id;
  ELSE
    SELECT l.lemma, l.id INTO v_src_lemma, v_src_lexeme FROM public.lexemes l WHERE l.id = c.source_entity_id;
  END IF;
  v_src_pos := public.d10_synonym_source_pos_v1(c.source_entity_type, c.source_entity_id);
  SELECT coalesce(jsonb_object_agg(t.language_code, t.translation), '{}'::jsonb) INTO v_src_tr
  FROM public.get_canonical_lexeme_translations_v1(CASE WHEN v_src_lexeme IS NULL THEN '{}'::uuid[] ELSE ARRAY[v_src_lexeme] END) t;
  v_src := jsonb_build_object('entity_type', c.source_entity_type, 'entity_id', c.source_entity_id,
    'lemma', v_src_lemma, 'part_of_speech', v_src_pos, 'definition_nb', c.naob_gloss,
    'context_label', c.context_label, 'naob_slug', c.naob_slug, 'anchor_id', c.source_sense_anchor,
    'translations', v_src_tr);

  IF NOT p_dry_run AND coalesce(btrim(c.naob_gloss), '') <> '' THEN
    INSERT INTO public.semantic_senses AS s (entity_type, entity_id, semantic_pos, source, source_article_id,
      source_sense_key, definition, context_label, definition_hash, evidence)
    VALUES (c.source_entity_type, c.source_entity_id, v_src_pos, 'NAOB', coalesce(c.naob_slug, '?'),
      coalesce(nullif(c.source_sense_anchor, ''), 'gloss:' || c.gloss_id::text), c.naob_gloss, c.context_label,
      md5(c.naob_gloss), jsonb_build_object('gloss_id', c.gloss_id, 'by', 'd10_synonym_prepare_candidate_v1'))
    ON CONFLICT (source, source_article_id, source_sense_key) DO UPDATE SET
      definition = EXCLUDED.definition, context_label = EXCLUDED.context_label,
      definition_hash = EXCLUDED.definition_hash, semantic_pos = EXCLUDED.semantic_pos, updated_at = now()
    RETURNING s.id INTO v_src_sense;
    UPDATE public.synonym_candidate_queue SET source_sense_id = v_src_sense,
      source_semantic_pos = coalesce(v_src_pos, source_semantic_pos), updated_at = now()
    WHERE id = c.id AND source_sense_id IS DISTINCT FROM v_src_sense;
  END IF;

  -- target side: every card of the target (not excluded), every article of it
  FOR v_t IN SELECT e FROM jsonb_array_elements(c.target_entity_ids) e LOOP
    FOR v_card IN
      SELECT CASE WHEN v_t->>'entity_type' = 'expression' THEN 'expression' ELSE 'lexeme' END AS etype,
             (v_t->>'id')::uuid AS eid,
             coalesce(l.id, x.lexeme_id) AS card_lexeme,
             coalesce(l.lemma, x.lemma) AS lemma,
             CASE WHEN v_t->>'entity_type' = 'expression' THEN 'expression' ELSE nullif(l.pos, '') END AS pos,
             coalesce(l.homograph_key, '') AS hk,
             coalesce(l.dictionary_status, 'active') AS dstatus,
             (x.verification_evidence->'Ordbokene'->>'article_id') AS expr_article
      FROM (SELECT 1) one
      LEFT JOIN public.lexemes l ON v_t->>'entity_type' = 'lexeme' AND l.id = (v_t->>'id')::uuid
      LEFT JOIN public.expression_catalog x ON v_t->>'entity_type' = 'expression' AND x.id = (v_t->>'id')::uuid
    LOOP
      CONTINUE WHEN v_card.lemma IS NULL OR v_card.dstatus = 'excluded';
      SELECT coalesce(jsonb_object_agg(t.language_code, t.translation), '{}'::jsonb) INTO v_tr
      FROM public.get_canonical_lexeme_translations_v1(CASE WHEN v_card.card_lexeme IS NULL THEN '{}'::uuid[] ELSE ARRAY[v_card.card_lexeme] END) t;
      v_arts := CASE WHEN v_card.etype = 'expression'
        THEN CASE WHEN v_card.expr_article ~ '^\d+$' THEN ARRAY[v_card.expr_article::bigint] ELSE '{}'::bigint[] END
        ELSE public.d10_lexeme_article_ids_v1(v_card.eid) END;
      IF coalesce(array_length(v_arts, 1), 0) = 0 THEN v_arts := ARRAY[NULL::bigint]; END IF;
      FOREACH v_art IN ARRAY v_arts LOOP
        v_defs := NULL; v_payload := NULL; v_status := 'queued'; v_reason := NULL;
        IF v_art IS NOT NULL THEN
          SELECT k.payload INTO v_payload FROM public.ordbokene_article_cache k
          WHERE k.article_id = v_art AND lower(k.dictionary_code) = 'bm' ORDER BY k.updated_at DESC LIMIT 1;
          IF v_payload IS NULL THEN v_status := 'waiting_article_cache';
          ELSE v_defs := public.d10_ordbokene_explanations_v1(v_payload); END IF;
        ELSE
          SELECT array_agg(d.definition ORDER BY d.source_entry_id NULLS LAST) INTO v_defs
          FROM public.entity_definitions d
          WHERE d.lexeme_id = v_card.card_lexeme AND d.expression_id IS NULL AND d.language_code = 'nb'
            AND coalesce(btrim(d.definition), '') <> '';
        END IF;
        -- cheap rules
        IF v_card.eid = c.source_entity_id OR (v_src_lexeme IS NOT NULL AND v_card.card_lexeme = v_src_lexeme) THEN
          v_status := 'rejected_rule'; v_reason := 'self_relation';
        ELSIF v_card.pos IS NULL OR v_card.pos = 'unknown' THEN
          v_status := 'needs_manual_review'; v_reason := 'target_pos_unknown';
        ELSIF v_src_pos IS NOT NULL AND v_card.pos IN ('verb','noun','adjective','adverb') AND v_card.pos <> v_src_pos THEN
          v_status := 'rejected_rule'; v_reason := 'incompatible_part_of_speech';
        ELSIF coalesce(btrim(c.naob_gloss), '') = '' THEN
          v_status := 'needs_manual_review'; v_reason := 'no_source_gloss';
        ELSIF v_status = 'queued' AND coalesce(array_length(v_defs, 1), 0) = 0 THEN
          v_status := 'needs_manual_review'; v_reason := 'target_without_definition';
        END IF;
        v_pairs := v_pairs || jsonb_build_object('etype', v_card.etype, 'eid', v_card.eid,
          'key', coalesce(v_art::text, 'none'), 'status', v_status, 'reason', v_reason,
          'target', jsonb_build_object('entity_type', v_card.etype, 'entity_id', v_card.eid, 'lemma', v_card.lemma,
            'homograph_key', v_card.hk, 'part_of_speech', v_card.pos, 'article_id', v_art,
            'definitions_nb', to_jsonb(coalesce(v_defs, '{}'::text[])),
            'definition_source', CASE WHEN v_art IS NULL THEN 'Lexin' ELSE 'Ordbokene' END,
            'translations', v_tr));
      END LOOP;
    END LOOP;
  END LOOP;

  -- more than 5 possible target senses after the rules -> manual review
  SELECT count(*) INTO v_open FROM jsonb_array_elements(v_pairs) p WHERE p->>'status' IN ('queued','waiting_article_cache');
  IF v_open > 5 THEN
    SELECT coalesce(jsonb_agg(CASE WHEN p->>'status' IN ('queued','waiting_article_cache')
      THEN p || jsonb_build_object('status', 'needs_manual_review', 'reason', 'too_many_target_senses') ELSE p END), '[]'::jsonb)
    INTO v_pairs FROM jsonb_array_elements(v_pairs) p;
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true, 'candidate_id', c.id, 'source', v_src, 'pairs', v_pairs);
  END IF;

  FOR v_pair IN SELECT p FROM jsonb_array_elements(v_pairs) p LOOP
    v_sense := NULL;
    IF v_pair->>'key' <> 'none' AND jsonb_array_length(v_pair->'target'->'definitions_nb') > 0 THEN
      INSERT INTO public.semantic_senses AS s (entity_type, entity_id, semantic_pos, source, source_article_id,
        source_sense_key, definition, definition_hash, evidence)
      VALUES (v_pair->>'etype', (v_pair->>'eid')::uuid, v_pair->'target'->>'part_of_speech', 'Ordbokene',
        v_pair->>'key', (v_pair->>'etype') || ':' || (v_pair->>'eid'),
        array_to_string(ARRAY(SELECT jsonb_array_elements_text(v_pair->'target'->'definitions_nb')), ' | '),
        md5((v_pair->'target'->'definitions_nb')::text), jsonb_build_object('by', 'd10_synonym_prepare_candidate_v1'))
      ON CONFLICT (source, source_article_id, source_sense_key) DO UPDATE SET
        definition = EXCLUDED.definition, definition_hash = EXCLUDED.definition_hash,
        semantic_pos = EXCLUDED.semantic_pos, updated_at = now()
      RETURNING s.id INTO v_sense;
    END IF;
    v_snapshot := jsonb_build_object('source', v_src, 'target', v_pair->'target',
      'candidate', jsonb_build_object('candidate_id', c.id, 'gloss_id', c.gloss_id, 'naob_gloss', c.naob_gloss,
        'target_text', c.target_text, 'source_job_id', c.source_job_id, 'child_job_id', c.child_job_id,
        'pipeline_version', c.pipeline_version));
    v_hash := md5(v_snapshot::text);
    v_key := (v_pair->>'etype') || ':' || (v_pair->>'eid') || ':' || (v_pair->>'key');
    v_keys := v_keys || v_key;
    INSERT INTO public.synonym_pair_v1 AS p (candidate_id, source_entity_type, source_entity_id, source_sense_id,
      target_entity_type, target_entity_id, target_article_key, target_sense_id, status, rule_reason, snapshot, snapshot_hash)
    VALUES (c.id, c.source_entity_type, c.source_entity_id, v_src_sense, v_pair->>'etype', (v_pair->>'eid')::uuid,
      v_pair->>'key', v_sense, v_pair->>'status', v_pair->>'reason', v_snapshot, v_hash)
    ON CONFLICT (candidate_id, target_entity_type, target_entity_id, target_article_key) DO UPDATE SET
      -- a changed snapshot resets the result; the old one goes to the history
      history = CASE WHEN p.decision IS NOT NULL OR p.status IN ('done','failed') THEN p.history || jsonb_build_array(
        jsonb_build_object('snapshot_hash', p.snapshot_hash, 'snapshot_version', p.snapshot_version, 'status', p.status,
          'decision', p.decision, 'confidence', p.confidence, 'verified_at', p.verified_at, 'published', p.published,
          'superseded_at', now())) ELSE p.history END,
      snapshot = EXCLUDED.snapshot, snapshot_hash = EXCLUDED.snapshot_hash,
      snapshot_version = p.snapshot_version + 1, status = EXCLUDED.status, rule_reason = EXCLUDED.rule_reason,
      source_sense_id = EXCLUDED.source_sense_id, target_sense_id = EXCLUDED.target_sense_id,
      decision = NULL, confidence = NULL, verification_evidence = '{}'::jsonb, verifier_version = NULL,
      verified_at = NULL, published = false, attempts = 0, next_attempt_at = NULL, last_error = NULL,
      lease_token = NULL, lease_until = NULL, updated_at = now()
    WHERE p.snapshot_hash IS DISTINCT FROM EXCLUDED.snapshot_hash OR p.status = 'superseded';
    IF FOUND THEN v_written := v_written + 1; END IF;
  END LOOP;

  -- pairs that are no longer possible (card excluded, article gone)
  UPDATE public.synonym_pair_v1 p SET status = 'superseded', published = false, updated_at = now(),
    history = p.history || jsonb_build_array(jsonb_build_object('superseded_at', now(), 'reason', 'pair_no_longer_possible',
      'decision', p.decision, 'snapshot_hash', p.snapshot_hash))
  WHERE p.candidate_id = c.id AND p.status <> 'superseded'
    AND NOT ((p.target_entity_type || ':' || p.target_entity_id::text || ':' || p.target_article_key) = ANY (v_keys));
  GET DIAGNOSTICS v_reset = ROW_COUNT;

  -- candidate status from its pairs (superseded pairs do not count):
  --   a pair to verify -> verification_queued; one for manual review ->
  --   needs_manual_review; NO target card at all (the child job made none,
  --   e.g. feste) -> needs_manual_review 'no_target_card'; only rule
  --   rejections -> rejected
  UPDATE public.synonym_candidate_queue q SET stage1_status = s.new_status,
    verification_evidence = q.verification_evidence || jsonb_build_object('stage_a',
      jsonb_build_object('reason', s.reason, 'prepared_at', now())),
    updated_at = now()
  FROM (
    SELECT CASE
        WHEN bool_or(p.status IN ('queued','waiting_article_cache','processing','retry_wait')) THEN 'verification_queued'
        WHEN bool_or(p.status = 'needs_manual_review') THEN 'needs_manual_review'
        WHEN count(p.id) = 0 THEN 'needs_manual_review'
        WHEN bool_and(p.status = 'rejected_rule') THEN 'rejected'
        ELSE NULL END AS new_status,
      CASE WHEN count(p.id) = 0 THEN 'no_target_card'
        WHEN bool_and(p.status = 'rejected_rule') THEN string_agg(DISTINCT p.rule_reason, ',')
        ELSE NULL END AS reason
    FROM public.synonym_pair_v1 p
    WHERE p.candidate_id = c.id AND p.status <> 'superseded'
  ) s
  WHERE q.id = c.id AND s.new_status IS NOT NULL
    AND q.stage1_status IN ('candidate','waiting_enrichment','verification_queued','needs_manual_review','rejected');

  RETURN jsonb_build_object('ok', true, 'candidate_id', c.id, 'pairs', jsonb_array_length(v_pairs),
    'written', v_written, 'superseded', v_reset);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 5. Event: a finished job. Candidates of the job / child job that are ready,
--    and candidates whose source or target card was in this job (their
--    snapshot is computed again). No scan beyond these.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_prepare_for_job_v1(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog','public','private' AS $fn$
DECLARE
  v_id uuid;
  v_res jsonb;
  v_n integer := 0;
  v_written integer := 0;
  v_errors integer := 0;
BEGIN
  FOR v_id IN
    WITH job_cards AS (
      SELECT i.lexeme_id AS id FROM public.lexeme_processing_items i WHERE i.job_id = p_job_id AND i.lexeme_id IS NOT NULL
      UNION
      SELECT i.expression_id FROM public.lexeme_processing_items i WHERE i.job_id = p_job_id AND i.expression_id IS NOT NULL
    )
    SELECT c.id FROM public.synonym_candidate_queue c
    WHERE c.dispatch_status IN ('enrichment_done', 'skipped_ready')
      AND (c.source_job_id = p_job_id OR c.child_job_id = p_job_id
        OR c.source_entity_id IN (SELECT id FROM job_cards)
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(c.target_entity_ids) e
                   WHERE (e->>'id')::uuid IN (SELECT id FROM job_cards)))
    ORDER BY c.created_at
    LIMIT 500
  LOOP
    BEGIN
      v_res := public.d10_synonym_prepare_candidate_v1(v_id, false);
      v_n := v_n + 1;
      v_written := v_written + coalesce((v_res->>'written')::integer, 0);
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'd10_synonym_prepare_for_job_v1: candidate % failed: %', v_id, SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'candidates', v_n, 'pairs_written', v_written, 'errors', v_errors);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 6. d10_synonym_after_job_v1: the body read on 28.10.2026, unchanged, plus
--    the prepare call at the end (its own failure never breaks the job).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.d10_synonym_after_job_v1(p_job_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_job public.lexeme_processing_jobs%rowtype;
  v_collected integer := 0;
  v_done integer := 0;
  v_deferred integer := 0;
  v_cleared integer := 0;
  v_dispatch jsonb := '{}'::jsonb;
  v_pairs jsonb := '{}'::jsonb;
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

  -- D10 28.10.2026 (stage A): pairs for verification; never breaks the job
  BEGIN
    v_pairs := public.d10_synonym_prepare_for_job_v1(p_job_id);
  EXCEPTION WHEN OTHERS THEN
    v_pairs := jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
  END;

  RETURN jsonb_build_object('ok', true, 'collected', v_collected, 'enrichment_done', v_done,
    'deferred_marked', v_deferred, 'deferred_cleared', v_cleared, 'dispatch', v_dispatch, 'pairs', v_pairs);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLSTATE || ':' || SQLERRM);
END
$function$;

-- ---------------------------------------------------------------------------
-- 7. Rights: internal, service_role only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.d10_ordbokene_explanations_v1(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_source_pos_v1(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_prepare_candidate_v1(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_prepare_for_job_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_ordbokene_explanations_v1(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_source_pos_v1(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_prepare_candidate_v1(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_prepare_for_job_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.d10_synonym_after_job_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_synonym_after_job_v1(uuid) TO service_role;

COMMIT;
