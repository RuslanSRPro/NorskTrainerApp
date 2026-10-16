-- D10 stage D2 (plan v3, build spec v2, rule R9-auto): second cards.
--
-- A second card is a lexeme with the same lemma and POS as the main card and
-- its own Ordbøkene article whose paradigm differs from the main card
-- (bok I "book" bøker / bok II "beech" boker). Its homograph_key is the
-- dictionary's Roman homograph number. The decision "forms differ" is made by
-- job-orchestrator from the Ordbøkene articles; this migration provides:
--   1. private.d10_homograph_article_decisions_v1 - one decision per main card
--      and article: r9_card (card created), r8_same_forms, main_article
--      (article chosen as the main card's own), skipped
--   2. public.d10_homograph_candidates_for_job_v1(job, limit) - promoted
--      tokens of the job and the homonym articles of the same POS that are
--      not decided yet: articles rejected in the main card's binding +
--      article candidates of the item's Ordbøkene check
--   3. public.d10_homograph_main_forms_v1(lexeme) - the main card's form values
--   4. public.d10_record_homograph_decision_v1(...) - stores a decision;
--      for r9_card creates the card (lexeme + article binding), for
--      main_article binds the main card to its article
--   5. public.d10_inject_homograph_item_v1(job, card) - adds the card to the
--      job as its own item with source checks; it then follows the normal
--      path (checks, promotion by article, all enrichment chains)
-- Cards can be created only after the old unique index (lemma, pos) is
-- dropped (last migration of this package); before that the function raises
-- HOMOGRAPH_CARDS_NOT_ENABLED and job-orchestrator skips the step.

CREATE TABLE IF NOT EXISTS private.d10_homograph_article_decisions_v1 (
  main_lexeme_id uuid NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
  dictionary_code text NOT NULL DEFAULT 'bm' CHECK (dictionary_code = 'bm'),
  article_id bigint NOT NULL CHECK (article_id > 0),
  decision text NOT NULL CHECK (decision IN ('r9_card', 'r8_same_forms', 'main_article', 'skipped')),
  hgno integer,
  card_lexeme_id uuid REFERENCES public.lexemes(id) ON DELETE SET NULL,
  job_id uuid,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (main_lexeme_id, dictionary_code, article_id)
);
ALTER TABLE private.d10_homograph_article_decisions_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.d10_homograph_article_decisions_v1 FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS private.d10_job_homograph_injections_v1 (
  job_id uuid NOT NULL REFERENCES public.lexeme_processing_jobs(id) ON DELETE CASCADE,
  card_lexeme_id uuid NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
  main_lexeme_id uuid NOT NULL REFERENCES public.lexemes(id) ON DELETE CASCADE,
  item_id uuid UNIQUE REFERENCES public.lexeme_processing_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job_id, card_lexeme_id)
);
ALTER TABLE private.d10_job_homograph_injections_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.d10_job_homograph_injections_v1 FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.d10_roman_v1(p_n integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $body$
  SELECT (ARRAY['I','II','III','IV','V','VI','VII','VIII','IX','X'])[p_n];
$body$;

CREATE OR REPLACE FUNCTION public.d10_homograph_candidates_for_job_v1(p_job_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE(item_id uuid, main_lexeme_id uuid, lemma text, pos text, main_article_ids bigint[], article_id bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  WITH tok AS (
    SELECT DISTINCT ON (i.lexeme_id) i.id AS item_id, l.id AS lexeme_id, l.lemma, l.pos
    FROM public.lexeme_processing_items i
    JOIN public.lexemes l ON l.id = i.lexeme_id
    WHERE i.job_id = p_job_id AND i.match_type = 'token'
      AND i.current_stage = 'semantic_audit'
      AND i.result_summary->>'promotion_status' = 'promoted'
      AND l.homograph_key = ''
      AND l.pos IN ('verb', 'noun', 'adjective', 'determiner')
    ORDER BY i.lexeme_id, i.id
  ),
  arts AS (
    -- rejected homographs of the main card's binding
    SELECT t.item_id, t.lexeme_id, x::bigint AS article_id
    FROM tok t
    JOIN private.authoritative_morphology_article_bindings_v2 b
      ON b.lexeme_id = t.lexeme_id AND b.is_active AND b.pos = t.pos
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(b.evidence->'rejectedHomographArticleIds') = 'array'
           THEN b.evidence->'rejectedHomographArticleIds' ELSE '[]'::jsonb END) x
    WHERE x ~ '^[1-9][0-9]*$'
    UNION
    -- article candidates of the Ordbøkene token check of this item
    SELECT t.item_id, t.lexeme_id, x::bigint
    FROM tok t
    JOIN public.lexeme_source_checks sc
      ON sc.item_id = t.item_id AND sc.source = 'Ordbokene' AND sc.query_type = 'token'
     AND sc.evidence->'raw_preview'->>'dictionary_code' = 'bm'
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(sc.evidence->'raw_preview'->'candidate_article_ids') = 'array'
           THEN sc.evidence->'raw_preview'->'candidate_article_ids' ELSE '[]'::jsonb END) x
    WHERE x ~ '^[1-9][0-9]*$'
  )
  SELECT a.item_id, a.lexeme_id, t.lemma, t.pos,
         public.d10_lexeme_article_ids_v1(a.lexeme_id), a.article_id
  FROM arts a JOIN tok t ON t.item_id = a.item_id
  WHERE NOT (a.article_id = ANY (public.d10_lexeme_article_ids_v1(a.lexeme_id)))
    AND NOT EXISTS (SELECT 1 FROM private.d10_homograph_article_decisions_v1 d
                    WHERE d.main_lexeme_id = a.lexeme_id AND d.article_id = a.article_id)
    AND NOT EXISTS (SELECT 1 FROM private.authoritative_morphology_article_bindings_v2 ob
                    JOIN public.lexemes ol ON ol.id = ob.lexeme_id
                    WHERE ob.article_id = a.article_id AND ob.is_active
                      AND ol.lemma = t.lemma AND ol.pos = t.pos)
  ORDER BY a.lexeme_id, a.article_id
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$body$;

CREATE OR REPLACE FUNCTION public.d10_homograph_main_forms_v1(p_lexeme_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $body$
  SELECT coalesce(array_agg(DISTINCT lower(btrim(v)) ORDER BY lower(btrim(v))), '{}'::text[])
  FROM public.lexeme_form_display_v2 f
  CROSS JOIN LATERAL unnest(f.primary_values || f.alternative_values) v
  WHERE f.lexeme_id = p_lexeme_id AND f.dictionary_code = 'bm'
    AND nullif(btrim(v), '') IS NOT NULL;
$body$;

-- Stores the decision of job-orchestrator for one (main card, article).
--   r9_card       creates the second card (lemma, pos, key = Roman hgno) and
--                 binds it to the article; returns the card id. Idempotent.
--   main_article  binds the MAIN card to this article (main card had no
--                 article: rule "Lexin forms, else lowest Roman number")
--   r8_same_forms / skipped  only recorded
CREATE OR REPLACE FUNCTION public.d10_record_homograph_decision_v1(
  p_main_lexeme_id uuid, p_article_id bigint, p_decision text, p_hgno integer,
  p_job_id uuid, p_evidence jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE
  v_main public.lexemes%rowtype;
  v_key text;
  v_card uuid;
  v_existing record;
BEGIN
  SELECT * INTO v_main FROM public.lexemes WHERE id = p_main_lexeme_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'HOMOGRAPH_MAIN_NOT_FOUND'; END IF;
  IF v_main.homograph_key <> '' OR v_main.pos NOT IN ('verb', 'noun', 'adjective', 'determiner') THEN
    RAISE EXCEPTION 'HOMOGRAPH_MAIN_INVALID';
  END IF;
  IF p_decision NOT IN ('r9_card', 'r8_same_forms', 'main_article', 'skipped') THEN
    RAISE EXCEPTION 'HOMOGRAPH_DECISION_INVALID';
  END IF;

  -- article already owned by a card of this lemma + POS: return it
  SELECT b.lexeme_id INTO v_card
  FROM private.authoritative_morphology_article_bindings_v2 b
  JOIN public.lexemes l ON l.id = b.lexeme_id
  WHERE b.article_id = p_article_id AND b.is_active AND l.lemma = v_main.lemma AND l.pos = v_main.pos
  LIMIT 1;

  IF p_decision = 'r9_card' AND v_card IS NULL THEN
    IF to_regclass('public.lexemes_lemma_pos_unique') IS NOT NULL THEN
      RAISE EXCEPTION 'HOMOGRAPH_CARDS_NOT_ENABLED';
    END IF;
    v_key := public.d10_roman_v1(p_hgno);
    IF v_key IS NULL THEN RAISE EXCEPTION 'HOMOGRAPH_HGNO_INVALID: %', p_hgno; END IF;
    SELECT l.id INTO v_card FROM public.lexemes l
    WHERE l.lemma = v_main.lemma AND l.pos = v_main.pos AND l.homograph_key = v_key;
    IF v_card IS NULL THEN
      INSERT INTO public.lexemes (lemma, pos, homograph_key, display_form, source,
        dictionary_status, is_learning_lexeme, status)
      VALUES (v_main.lemma, v_main.pos, v_key, v_main.lemma, 'd10_homograph_card',
        'active', true, 'New')
      RETURNING id INTO v_card;
    END IF;
    INSERT INTO private.authoritative_morphology_article_bindings_v2 (
      lexeme_id, dictionary_code, article_id, normalized_lemma, pos,
      evidence_ids, provider_version, evidence)
    VALUES (v_card, 'bm', p_article_id, lower(btrim(v_main.lemma)), v_main.pos,
      ARRAY['ordbokene:bm:' || p_article_id::text, 'd10:homograph-card:' || v_key],
      'd10-homograph-card/v1',
      jsonb_build_object('decision', 'r9_second_card', 'mainLexemeId', p_main_lexeme_id,
        'homographKey', v_key, 'hgno', p_hgno, 'jobId', p_job_id) || coalesce(p_evidence, '{}'::jsonb))
    ON CONFLICT DO NOTHING;
  ELSIF p_decision = 'main_article' AND v_card IS NULL THEN
    IF cardinality(public.d10_lexeme_article_ids_v1(p_main_lexeme_id)) > 0 THEN
      RAISE EXCEPTION 'HOMOGRAPH_MAIN_ALREADY_HAS_ARTICLE';
    END IF;
    INSERT INTO private.authoritative_morphology_article_bindings_v2 (
      lexeme_id, dictionary_code, article_id, normalized_lemma, pos,
      evidence_ids, provider_version, evidence)
    VALUES (p_main_lexeme_id, 'bm', p_article_id, lower(btrim(v_main.lemma)), v_main.pos,
      ARRAY['ordbokene:bm:' || p_article_id::text, 'd10:homograph-main-article'],
      'd10-homograph-card/v1',
      jsonb_build_object('decision', 'main_card_article', 'hgno', p_hgno, 'jobId', p_job_id)
        || coalesce(p_evidence, '{}'::jsonb))
    ON CONFLICT DO NOTHING;
    v_card := p_main_lexeme_id;
  END IF;

  INSERT INTO private.d10_homograph_article_decisions_v1 (
    main_lexeme_id, article_id, decision, hgno, card_lexeme_id, job_id, evidence)
  VALUES (p_main_lexeme_id, p_article_id, p_decision, p_hgno,
    CASE WHEN p_decision IN ('r9_card', 'main_article') THEN v_card END, p_job_id,
    coalesce(p_evidence, '{}'::jsonb))
  ON CONFLICT (main_lexeme_id, dictionary_code, article_id) DO NOTHING;

  RETURN CASE WHEN p_decision IN ('r9_card', 'main_article') THEN v_card END;
END
$body$;

CREATE OR REPLACE FUNCTION public.d10_inject_homograph_item_v1(
  p_job_id uuid, p_card_lexeme_id uuid, p_main_lexeme_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
DECLARE
  v_card public.lexemes%rowtype;
  v_item uuid;
  v_claimed integer;
BEGIN
  SELECT * INTO v_card FROM public.lexemes WHERE id = p_card_lexeme_id;
  IF NOT FOUND OR v_card.homograph_key = '' THEN RAISE EXCEPTION 'HOMOGRAPH_CARD_INVALID'; END IF;

  INSERT INTO private.d10_job_homograph_injections_v1 (job_id, card_lexeme_id, main_lexeme_id)
  VALUES (p_job_id, p_card_lexeme_id, p_main_lexeme_id)
  ON CONFLICT (job_id, card_lexeme_id) DO NOTHING;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  IF v_claimed = 0 THEN
    SELECT item_id INTO v_item FROM private.d10_job_homograph_injections_v1
    WHERE job_id = p_job_id AND card_lexeme_id = p_card_lexeme_id;
    RETURN v_item;
  END IF;

  INSERT INTO public.lexeme_processing_items (
    job_id, lexeme_id, raw_input, normalized_input, normalized_lemma, surface_form,
    pos, match_type, status, current_stage, attempt_count, max_attempts, result_summary)
  -- The item starts without lexeme_id, like a token from the text; its source
  -- checks carry the card, so the Ordbøkene check is bound to the card's
  -- article and promotion picks the card by that article.
  VALUES (p_job_id, NULL, v_card.lemma, lower(btrim(v_card.lemma)),
    lower(btrim(v_card.lemma)), v_card.lemma, v_card.pos, 'token', 'pending',
    'source_checks', 0, 3,
    jsonb_build_object('match_strategy', 'homograph_card', 'homograph_key', v_card.homograph_key,
      'main_lexeme_id', p_main_lexeme_id,
      'card_article_ids', to_jsonb(public.d10_lexeme_article_ids_v1(p_card_lexeme_id))))
  RETURNING id INTO v_item;

  UPDATE private.d10_job_homograph_injections_v1 SET item_id = v_item
  WHERE job_id = p_job_id AND card_lexeme_id = p_card_lexeme_id;

  INSERT INTO public.lexeme_source_checks (
    job_id, item_id, lexeme_id, source, stage, query, surface_form,
    query_type, status, attempt_count, max_attempts, evidence, urls, verification_version)
  SELECT p_job_id, v_item, p_card_lexeme_id, s, 'lemma', lower(btrim(v_card.lemma)), v_card.lemma,
    'token', 'pending', 0, 3, '{}'::jsonb, '[]'::jsonb, 1
  FROM unnest(ARRAY['NAOB', 'Ordbokene', 'Lexin', 'Språkrådet', 'Wiktionary']) AS s;

  UPDATE public.lexeme_processing_jobs j
  SET total_items = (SELECT count(*) FROM public.lexeme_processing_items i WHERE i.job_id = p_job_id),
      updated_at = now()
  WHERE j.id = p_job_id;
  RETURN v_item;
END
$body$;

REVOKE ALL ON FUNCTION public.d10_roman_v1(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.d10_homograph_candidates_for_job_v1(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_homograph_main_forms_v1(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_record_homograph_decision_v1(uuid, bigint, text, integer, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.d10_inject_homograph_item_v1(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_roman_v1(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.d10_homograph_candidates_for_job_v1(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_homograph_main_forms_v1(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_record_homograph_decision_v1(uuid, bigint, text, integer, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.d10_inject_homograph_item_v1(uuid, uuid, uuid) TO service_role;

-- Second cards that already exist (created in an earlier job) for the main
-- cards promoted in this job and not yet added to it: added again so the
-- learner sees them (purple) and their enrichment is refreshed (R9-auto).
CREATE OR REPLACE FUNCTION public.d10_existing_homograph_cards_for_job_v1(p_job_id uuid)
RETURNS TABLE(card_lexeme_id uuid, main_lexeme_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $body$
  SELECT DISTINCT c.id, m.id
  FROM public.lexeme_processing_items i
  JOIN public.lexemes m ON m.id = i.lexeme_id AND m.homograph_key = ''
  JOIN public.lexemes c ON c.lemma = m.lemma AND c.pos = m.pos AND c.homograph_key <> ''
  WHERE i.job_id = p_job_id AND i.match_type = 'token'
    AND i.current_stage = 'semantic_audit'
    AND i.result_summary->>'promotion_status' = 'promoted'
    AND NOT EXISTS (SELECT 1 FROM private.d10_job_homograph_injections_v1 j
                    WHERE j.job_id = p_job_id AND j.card_lexeme_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.lexeme_processing_items o
                    WHERE o.job_id = p_job_id AND o.lexeme_id = c.id);
$body$;
REVOKE ALL ON FUNCTION public.d10_existing_homograph_cards_for_job_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.d10_existing_homograph_cards_for_job_v1(uuid) TO service_role;
