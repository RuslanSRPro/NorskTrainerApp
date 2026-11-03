-- D10_synonym_senses_v1 (30.10.2026, agreed in chat, point 5): senses in the synonym window.
-- Every published synonym link knows the sense on both sides:
--   head word (the word whose NAOB / Bokmålsordboka gloss item listed the synonym): that gloss item;
--   synonym (target of the pair): the definition the verifier matched (matched_text / matched_definition:
--   a number for AI decisions, the text itself for rule decisions).
-- 1. synonym_sense_label_v1: a short Ukrainian (+ English) translation of a word IN ONE SENSE,
--    made once by synonym-verifier (same model as the pairs) and kept; never translated twice.
-- 2. get_synonym_carousel_v2(lexeme): the synonyms of a card with my sense / their sense, their
--    translations, the level of proof and the verifier's reason. get_synonym_carousel_v1 stays.
-- 3. d10_synonym_verifier_pending_v1: + waiting sense labels (so the verifier is woken for them).
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $pre$
BEGIN
  IF to_regclass('public.synonym_sense_label_v1') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_senses_v1 is already installed; nothing changed';
  END IF;
  IF to_regprocedure('public.get_synonym_carousel_v1(uuid)') IS NULL
     OR to_regprocedure('public.d10_synonym_publish_siblings_v1(uuid)') IS NULL THEN
    RAISE EXCEPTION 'STOP: stage D / same-gloss rule are not installed; nothing changed';
  END IF;
  IF (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE oid = 'public.d10_synonym_verifier_pending_v1()'::regprocedure)
     IS DISTINCT FROM 'c5759070cc8f79d9e6c8e0529ae2c0a3' THEN
    RAISE EXCEPTION 'STOP: d10_synonym_verifier_pending_v1 differs from the version this package was built on; nothing changed';
  END IF;
END
$pre$;

-- ---------------------------------------------------------------------------
-- 1. Sense labels
-- ---------------------------------------------------------------------------
CREATE TABLE public.synonym_sense_label_v1 (
  sense_key text PRIMARY KEY,                 -- md5(lower(lemma) | sense text)
  lemma text NOT NULL,
  sense_text text NOT NULL,
  uk text,
  en text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  model text,
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX synonym_sense_label_status_idx ON public.synonym_sense_label_v1 (status, created_at);
ALTER TABLE public.synonym_sense_label_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.synonym_sense_label_v1 FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.d10_synonym_sense_key_v1(p_lemma text, p_sense text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $fn$
  SELECT CASE WHEN btrim(coalesce(p_sense, '')) = '' THEN NULL
              ELSE md5(lower(btrim(coalesce(p_lemma, ''))) || '|' || btrim(p_sense)) END;
$fn$;

-- the sense of the synonym (pair target) the verifier matched
CREATE FUNCTION public.d10_synonym_target_sense_v1(p_evidence jsonb, p_snapshot jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'pg_catalog' AS $fn$
  SELECT nullif(btrim(coalesce(
    p_evidence->>'matched_text',
    CASE WHEN p_evidence->>'matched_definition' ~ '^\d+$'
         THEN p_snapshot->'target'->'definitions_nb'->>((p_evidence->>'matched_definition')::int)
         WHEN p_evidence->>'matched_definition' ~ '^-\d+$' THEN NULL
         ELSE p_evidence->>'matched_definition' END)), '');
$fn$;

-- one row per side of every published pair: (entity, lemma, sense)
CREATE FUNCTION public.d10_synonym_pair_sides_v1()
RETURNS TABLE (pair_id uuid, gloss_key uuid, head_type text, head_id uuid, head_lemma text, head_sense text,
               target_type text, target_id uuid, target_lemma text, target_sense text,
               decision text, verifier_version text, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
  SELECT p.id, coalesce(c.gloss_id, c.bm_gloss_id),
         p.source_entity_type, p.source_entity_id, public.d10_synonym_entity_lemma_v1(p.source_entity_type, p.source_entity_id),
         nullif(btrim(c.naob_gloss), ''),
         p.target_entity_type, p.target_entity_id, public.d10_synonym_entity_lemma_v1(p.target_entity_type, p.target_entity_id),
         public.d10_synonym_target_sense_v1(p.verification_evidence, p.snapshot),
         p.decision, p.verifier_version, p.verification_evidence->>'reason'
  FROM public.synonym_pair_v1 p
  JOIN public.synonym_candidate_queue c ON c.id = p.candidate_id
  WHERE p.status = 'done' AND p.decision IN ('verified_synonym', 'contextual_synonym');
$fn$;

-- every sense shown in a synonym window gets a label row (translated later by synonym-verifier)
CREATE FUNCTION public.d10_synonym_sense_labels_enqueue_v1()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE v_n integer;
BEGIN
  INSERT INTO public.synonym_sense_label_v1 (sense_key, lemma, sense_text)
  SELECT DISTINCT ON (k) k, lemma, sense FROM (
    SELECT public.d10_synonym_sense_key_v1(s.head_lemma, s.head_sense) k, s.head_lemma lemma, s.head_sense sense
    FROM public.d10_synonym_pair_sides_v1() s
    UNION ALL
    SELECT public.d10_synonym_sense_key_v1(s.target_lemma, s.target_sense), s.target_lemma, s.target_sense
    FROM public.d10_synonym_pair_sides_v1() s
  ) x
  WHERE k IS NOT NULL AND lemma IS NOT NULL
  ON CONFLICT (sense_key) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END
$fn$;

-- synonym-verifier: take labels to translate (with the model of the verifier config)
CREATE FUNCTION public.d10_synonym_sense_lease_v1(p_limit integer DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE v_token uuid := gen_random_uuid(); v_rows jsonb; v_queued integer;
BEGIN
  v_queued := public.d10_synonym_sense_labels_enqueue_v1();
  WITH pick AS (
    SELECT s.sense_key FROM public.synonym_sense_label_v1 s
    WHERE s.status = 'queued' OR (s.status = 'processing' AND s.lease_until <= now())
    ORDER BY s.created_at
    LIMIT greatest(1, least(coalesce(p_limit, 40), 80))
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.synonym_sense_label_v1 s SET status = 'processing', lease_token = v_token,
      lease_until = now() + interval '5 minutes', attempts = s.attempts + 1, updated_at = now()
    FROM pick WHERE s.sense_key = pick.sense_key
    RETURNING s.sense_key, s.lemma, s.sense_text
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('key', sense_key, 'lemma', lemma, 'sense', sense_text)), '[]'::jsonb)
  INTO v_rows FROM upd;
  RETURN jsonb_build_object('lease_token', v_token, 'rows', v_rows, 'enqueued', v_queued,
    'model', (SELECT c.model FROM public.synonym_verifier_config_v1 c WHERE c.singleton));
END
$fn$;

-- synonym-verifier: save the translations ([{key, uk, en}]); missing ones go back to the queue (3 tries)
CREATE FUNCTION public.d10_synonym_sense_record_v1(p_lease_token uuid, p_rows jsonb, p_model text, p_error text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
DECLARE v_done integer; v_back integer;
BEGIN
  UPDATE public.synonym_sense_label_v1 s SET status = 'done', uk = nullif(btrim(r->>'uk'), ''),
    en = nullif(btrim(r->>'en'), ''), model = p_model, lease_token = NULL, lease_until = NULL,
    last_error = NULL, updated_at = now()
  FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  WHERE s.lease_token = p_lease_token AND s.sense_key = r->>'key' AND btrim(coalesce(r->>'uk', '')) <> '';
  GET DIAGNOSTICS v_done = ROW_COUNT;
  UPDATE public.synonym_sense_label_v1 s SET status = CASE WHEN s.attempts >= 3 THEN 'failed' ELSE 'queued' END,
    lease_token = NULL, lease_until = NULL, last_error = coalesce(p_error, 'no answer'), updated_at = now()
  WHERE s.lease_token = p_lease_token AND s.status = 'processing';
  GET DIAGNOSTICS v_back = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'done', v_done, 'back', v_back);
END
$fn$;

-- ---------------------------------------------------------------------------
-- 2. The window: synonyms of a card with both senses
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.get_synonym_carousel_v2(p_lexeme_id uuid)
RETURNS TABLE (card_id uuid, lemma text, pos text, decision text, level text, target_entity_type text,
               target_entity_id uuid, my_sense text, my_sense_key text, my_sense_uk text, my_sense_en text,
               their_sense text, their_sense_uk text, their_sense_en text, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
  WITH me AS (
    SELECT 'lexeme'::text AS t, p_lexeme_id AS i WHERE p_lexeme_id IS NOT NULL
    UNION SELECT 'expression', x.id FROM public.expression_catalog x WHERE p_lexeme_id IS NOT NULL AND x.lexeme_id = p_lexeme_id
  ), rel AS (   -- the same links as the badge (lexemes.synonyms / get_synonym_carousel_v1)
    SELECT r.* FROM public.authoritative_semantic_relations r JOIN me ON me.t = r.source_entity_type AND me.i = r.source_entity_id
    WHERE r.relation_type = 'synonym' AND (NOT public.d10_synonym_publication_on_v1() OR r.status = 'verified')
  ), sides AS (SELECT * FROM public.d10_synonym_pair_sides_v1()),
  info AS (
    SELECT r.id AS rel_id, r.source, r.target_text, r.target_entity_type, r.target_entity_id, r.relation_class,
           r.verification_evidence, r.confidence, s.*
    FROM rel r
    LEFT JOIN LATERAL (
      -- verifier link: a pair between the two (either direction); I am head or target
      SELECT CASE WHEN x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id THEN x.head_sense ELSE x.target_sense END AS my_s,
             CASE WHEN x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id THEN x.head_lemma ELSE x.target_lemma END AS my_l,
             CASE WHEN x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id THEN x.target_sense ELSE x.head_sense END AS their_s,
             CASE WHEN x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id THEN x.target_lemma ELSE x.head_lemma END AS their_l,
             x.verifier_version AS vv, x.reason AS why
      FROM sides x
      WHERE r.source <> 'synonym-same-gloss'
        AND ((x.head_type = r.source_entity_type AND x.head_id = r.source_entity_id AND x.target_type = r.target_entity_type AND x.target_id = r.target_entity_id)
          OR (x.target_type = r.source_entity_type AND x.target_id = r.source_entity_id AND x.head_type = r.target_entity_type AND x.head_id = r.target_entity_id))
      UNION ALL
      -- same gloss item: both are targets of the same item; each one's matched sense
      SELECT a.target_sense, a.target_lemma, b.target_sense, b.target_lemma, 'rule:same_gloss_v1',
             'Обидва слова стоять в одному пункті тлумачення «' || a.head_lemma || '»: ' || coalesce(a.head_sense, '')
      FROM sides a JOIN sides b ON b.gloss_key = a.gloss_key
      WHERE r.source = 'synonym-same-gloss'
        AND a.target_type = r.source_entity_type AND a.target_id = r.source_entity_id
        AND b.target_type = r.target_entity_type AND b.target_id = r.target_entity_id
        AND r.verification_evidence->'gloss_ids' ? a.gloss_key::text
      ORDER BY 5 LIMIT 1
    ) s ON true
  )
  SELECT DISTINCT ON (coalesce(card.cid::text, lower(i.target_text)))
    card.cid, i.target_text,
    coalesce(l.pos, CASE WHEN i.target_entity_type = 'expression' THEN 'expression' END),
    i.relation_class,
    CASE WHEN i.source = 'synonym-same-gloss' THEN 'same_gloss'
         WHEN i.vv LIKE 'rule:%' THEN 'dictionary'
         ELSE 'ai' END,
    i.target_entity_type, i.target_entity_id,
    i.my_s, public.d10_synonym_sense_key_v1(i.my_l, i.my_s), ml.uk, ml.en,
    i.their_s, tl.uk, tl.en, i.why
  FROM info i
  CROSS JOIN LATERAL (SELECT CASE WHEN i.target_entity_type = 'lexeme' THEN i.target_entity_id
                                  ELSE (SELECT x.lexeme_id FROM public.expression_catalog x WHERE x.id = i.target_entity_id) END AS cid) card
  LEFT JOIN public.lexemes l ON l.id = card.cid
  LEFT JOIN public.synonym_sense_label_v1 ml ON ml.sense_key = public.d10_synonym_sense_key_v1(i.my_l, i.my_s) AND ml.status = 'done'
  LEFT JOIN public.synonym_sense_label_v1 tl ON tl.sense_key = public.d10_synonym_sense_key_v1(i.their_l, i.their_s) AND tl.status = 'done'
  WHERE card.cid IS DISTINCT FROM p_lexeme_id
  ORDER BY coalesce(card.cid::text, lower(i.target_text)), (i.relation_class = 'verified_synonym') DESC, i.my_s NULLS LAST;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. The verifier is woken also for sense labels
-- ---------------------------------------------------------------------------
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
                    AND j.status IN ('completed', 'needs_manual_review', 'failed', 'cancelled')))))
       -- D10 30.10.2026 (agreed, point 5): sense labels waiting for their translation
       + (SELECT count(*)::integer FROM public.synonym_sense_label_v1 s
          WHERE s.status = 'queued' OR (s.status = 'processing' AND s.lease_until <= now()));
$fn$;

REVOKE ALL ON FUNCTION public.d10_synonym_sense_key_v1(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_target_sense_v1(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_pair_sides_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_sense_labels_enqueue_v1() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_sense_lease_v1(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_synonym_sense_record_v1(uuid, jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_synonym_carousel_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.d10_synonym_sense_key_v1(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_target_sense_v1(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_pair_sides_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_sense_labels_enqueue_v1() TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_sense_lease_v1(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_synonym_sense_record_v1(uuid, jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_synonym_carousel_v2(uuid) TO authenticated, service_role;

SELECT public.d10_synonym_sense_labels_enqueue_v1() AS sense_labels_queued;

COMMIT;
