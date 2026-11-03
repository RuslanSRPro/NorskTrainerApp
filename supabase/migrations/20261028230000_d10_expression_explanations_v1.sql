-- D10_expression_explanations_v1 (28.10.2026, agreed in chat: variant B)
--
-- 1. d10_synonym_gloss_terms_v1: a NAOB gloss part with a bracket INSIDE the
--    phrase is skipped (cutting the bracket out gave phrases that are not in
--    the language: "treffe med harpunen", "sende i mål"). Brackets at the
--    start / end are cut as before. Only new collections are affected.
-- 2. d10_synonym_prepare_candidate_v1: an expression synonym without a card
--    whose Ordbøkene check in the child job ran (done) without an own article
--    is a NAOB explanation: candidate 'rejected', stage_a.reason
--    'naob_explanation'. A failed (technical) check keeps 'no_target_card'.
-- 3. d10_synonym_unresolved_v1: NAOB explanations are not problem words.
-- lexical-worker (edge, same package): an expression check without a catalog
-- entry is answered at once (no own article bound -> not found) instead of
-- staying in 'processing' until three timeouts.
-- No AI, no network, no cron. Guards: whitespace-stripped md5 of the three
-- live functions; any difference -> STOP, nothing changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $pre$
DECLARE r record; v_expected jsonb := jsonb_build_object(
  'd10_synonym_gloss_terms_v1', '595d36af035073f79f5d7d4a526330cd',
  'd10_synonym_prepare_candidate_v1', '0fc5c864008925d35db66a345e1951dc',
  'd10_synonym_unresolved_v1', '8107a995594bb37d7af8b3e6a38a1e08');
  v_name text;
  v_md5 text;
BEGIN
  FOR v_name IN SELECT jsonb_object_keys(v_expected) LOOP
    SELECT md5(regexp_replace(p.prosrc, '\s', '', 'g')) INTO v_md5
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name;
    IF v_md5 IS DISTINCT FROM v_expected->>v_name THEN
      RAISE EXCEPTION 'STOP: % is not the expected version (md5 %); nothing changed', v_name, v_md5;
    END IF;
  END LOOP;
END
$pre$;

CREATE OR REPLACE FUNCTION public.d10_synonym_gloss_terms_v1(p_gloss text, p_source text)
RETURNS TABLE(term text, ord integer)
LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $fn$
  WITH parts AS (
    SELECT btrim(regexp_replace(regexp_replace(lower(p.part), '\([^)]*\)', ' ', 'g'), '\s+', ' ', 'g'),
             ' .,:!?') AS t, p.ord::integer AS ord
    FROM unnest(string_to_array(coalesce(p_gloss, ''), ';')) WITH ORDINALITY AS p(part, ord)
    -- D10 28.10.2026 (agreed): a bracket INSIDE the phrase (words before and
    -- after it: "treffe (sjødyr) med harpunen") is skipped - cutting it out
    -- makes a phrase that is not in the language. A bracket at the start or
    -- the end ("(prøve å) bringe på det rene", "gjøre lavere (i pris)") is cut.
    WHERE p.part !~ '\S\s*\([^)]*\)\s*\S'
  )
  SELECT t, ord FROM parts
  WHERE t ~ '^[a-zæøåéèêóòôüä-]+( [a-zæøåéèêóòôüä-]+){0,3}$'
    AND length(t) BETWEEN 2 AND 80
    AND t !~ '^(se|jf|jamfør|sml|el|eller|dvs|f\.eks) '
    AND t <> lower(btrim(regexp_replace(coalesce(p_source, ''), '\s+', ' ', 'g')))
  ORDER BY ord
  LIMIT 12;
$fn$;

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
  v_explanation boolean := false;
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
  -- D10 28.10.2026 (agreed, variant B): an expression without a card whose
  -- Ordbøkene check in the child job really ran (done) and found no own
  -- article is an explanation from NAOB, not a lexical unit: rejected
  -- 'naob_explanation' (out of the problem words). A check that failed
  -- (technical) keeps 'no_target_card' (stays in the list for a re-run).
  v_explanation := c.target_kind = 'expression' AND c.child_job_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.lexeme_processing_items i
    JOIN public.lexeme_source_checks s ON s.item_id = i.id AND s.source = 'Ordbokene'
    WHERE i.job_id = c.child_job_id AND i.match_type = 'expression'
      AND lower(btrim(i.normalized_lemma)) = lower(btrim(c.target_text))
      AND s.status = 'done' AND coalesce(s.whole_unit_match, false) = false);
  UPDATE public.synonym_candidate_queue q SET stage1_status = s.new_status,
    verification_evidence = q.verification_evidence || jsonb_build_object('stage_a',
      jsonb_build_object('reason', s.reason, 'prepared_at', now())),
    updated_at = now()
  FROM (
    SELECT CASE
        WHEN bool_or(p.status IN ('queued','waiting_article_cache','processing','retry_wait')) THEN 'verification_queued'
        WHEN bool_or(p.status = 'needs_manual_review') THEN 'needs_manual_review'
        WHEN count(p.id) = 0 AND v_explanation THEN 'rejected'
        WHEN count(p.id) = 0 THEN 'needs_manual_review'
        WHEN bool_and(p.status = 'rejected_rule') THEN 'rejected'
        ELSE NULL END AS new_status,
      CASE WHEN count(p.id) = 0 AND v_explanation THEN 'naob_explanation'
        WHEN count(p.id) = 0 THEN 'no_target_card'
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
    -- D10 28.10.2026: explanations from NAOB are not problem words
    AND coalesce(c.verification_evidence->'stage_a'->>'reason', '') <> 'naob_explanation'
  GROUP BY 1, 2, 3
  ORDER BY max(c.updated_at) DESC, 1
  LIMIT least(greatest(coalesce(p_limit, 300), 1), 1000);
$function$;

COMMIT;
