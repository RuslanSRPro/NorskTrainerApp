-- 20261102210000_d10_synonym_stable_v3.sql
-- D10_synonym_stable_v3 (on top of stable_v2, second review):
--  1. one rule for publication (private.synonym_pair_counts_v1): publishable AND the reverse pair of the same two
--     senses not contradicting. Used for the link AND for the published flag of each pair (the carousel shows
--     published pairs), so a contradicted sense pair is never marked published.
--  2. translation fit key v3 also holds the CONTENT of the sense (normalized text + sense group from the article,
--     or the given context): a refined definition or context -> new key -> new evaluation. Same content already
--     evaluated under v2 is carried over (no new AI call).
-- Guards: v2 installed, v3 not installed, md5 of the 2 replaced functions. Reinstall -> STOP.
-- Rollback: optional/20261102210000_d10_synonym_stable_v3_ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_stable3_report;
CREATE TEMP TABLE d10_stable3_report(part text, name text, info jsonb);

DO $mig$
BEGIN
  IF to_regclass('private.synonym_pair_v1_backup_d10_stable_v2') IS NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_stable_v2 is not installed'; END IF;
  IF to_regprocedure('private.synonym_pair_counts_v1(public.synonym_pair_v1)') IS NOT NULL
     OR to_regclass('private.synonym_pair_v1_backup_d10_stable_v3') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_stable_v3 already installed';
  END IF;
  IF to_regprocedure('public.d10_synonym_target_paths_v1(jsonb)') IS NULL THEN RAISE EXCEPTION 'STOP: public.d10_synonym_target_paths_v1(jsonb) not found'; END IF;
END
$mig$;

CREATE TABLE private.synonym_pair_v1_backup_d10_stable_v3 AS
  SELECT id, verification_evidence, published, now() AS saved_at FROM public.synonym_pair_v1;
CREATE TABLE private.synonym_sense_fit_v1_backup_d10_stable_v3 AS
  SELECT fit_key, status, fit, chosen_uk, chosen_en, model, prompt_version, decided_at, last_error, now() AS saved_at FROM private.synonym_sense_fit_v1;
CREATE TABLE private.synonym_relations_backup_d10_stable_v3 AS
  SELECT * FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier';
REVOKE ALL ON TABLE private.synonym_pair_v1_backup_d10_stable_v3 FROM PUBLIC;
REVOKE ALL ON TABLE private.synonym_sense_fit_v1_backup_d10_stable_v3 FROM PUBLIC;
REVOKE ALL ON TABLE private.synonym_relations_backup_d10_stable_v3 FROM PUBLIC;

-- the sense group of a definition in its Ordbokene article (all explanations with the same sense path), or NULL
CREATE FUNCTION private.synonym_sense_group_v1(p_article bigint, p_text text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  WITH a AS (SELECT k.payload FROM public.ordbokene_article_cache k
             WHERE p_article IS NOT NULL AND k.article_id = p_article AND lower(k.dictionary_code) = 'bm'
             ORDER BY k.updated_at DESC LIMIT 1),
  paths AS (SELECT x.sense_path, x.def_ord, x.txt FROM a CROSS JOIN LATERAL public.d10_synonym_target_paths_v1(a.payload) x),
  me AS (SELECT sense_path FROM paths WHERE txt = btrim(p_text) ORDER BY def_ord LIMIT 1)
  SELECT CASE WHEN EXISTS (SELECT 1 FROM me) THEN
    (SELECT coalesce(jsonb_agg(p.txt ORDER BY p.def_ord), '[]'::jsonb) FROM paths p, me WHERE p.sense_path IS NOT DISTINCT FROM me.sense_path)
  END;
$f$;

-- fit key v3: stable sense id + part of speech + sense CONTENT (normalized text, context) + translations + version
CREATE FUNCTION private.synonym_fit_key_v3(p_sense_key text, p_pos text, p_text text, p_ctx jsonb, p_tr jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $f$
  SELECT md5(jsonb_build_array('fit-v3', 'sense_fit_v1', p_sense_key, lower(coalesce(p_pos, '')),
    lower(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'))), coalesce(p_ctx, '[]'::jsonb), p_tr->'uk', p_tr->'en')::text);
$f$;

-- D10_synonym_stable_v3: does this pair count for publication? publishable AND the reverse pair of the SAME two
-- senses (if decided, active candidate) is publishable too. One definition for the link and for the published flag.
CREATE FUNCTION private.synonym_pair_counts_v1(p public.synonym_pair_v1)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  SELECT private.synonym_publishable_v1(p)
    AND NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 q
      WHERE q.status = 'done' AND q.decision IS NOT NULL
        AND q.source_entity_type = p.target_entity_type AND q.source_entity_id = p.target_entity_id
        AND q.target_entity_type = p.source_entity_type AND q.target_entity_id = p.source_entity_id
        AND q.verification_evidence->>'source_sense_key' = p.verification_evidence->>'target_sense_key'
        AND q.verification_evidence->>'target_sense_key' = p.verification_evidence->>'source_sense_key'
        AND EXISTS (SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id = q.candidate_id AND c.source_active)
        AND NOT private.synonym_publishable_v1(q));
$f$;

REVOKE ALL ON FUNCTION private.synonym_sense_group_v1(bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.synonym_fit_key_v3(text, text, text, jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.synonym_pair_counts_v1(public.synonym_pair_v1) FROM PUBLIC;

INSERT INTO d10_stable3_report SELECT '01_before', 'state', jsonb_build_object(
  'published_pairs', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published), 'verifier_relations', (SELECT count(*) FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier' AND relation_type = 'synonym'),
  'published_but_contradicted', (SELECT count(*) FROM public.synonym_pair_v1 p WHERE p.published AND NOT private.synonym_pair_counts_v1(p)),
  'fits', (SELECT jsonb_object_agg(k, n) FROM (SELECT status || CASE WHEN sense_key IS NULL THEN ':v1' ELSE ':v2' END k, count(*) n FROM private.synonym_sense_fit_v1 GROUP BY 1) z));

DO $mig$
DECLARE r record; v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_md5 text; v_body text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.d10_synonym_publish_link_v1(text,uuid,text,uuid)', $h_publish_link$CREATE OR REPLACE FUNCTION public.d10_synonym_publish_link_v1(p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_publish_link$, '27648869a65c32542bea97b4cb24fa58', '7a9719b3c5f9bb853af763ae70164b8f', $b_publish_link$
DECLARE
  v_best text;
  v_pairs jsonb;
  v_version text;
  v_a_lemma text := public.d10_synonym_entity_lemma_v1(p_a_type, p_a_id);
  v_b_lemma text := public.d10_synonym_entity_lemma_v1(p_b_type, p_b_id);
BEGIN
  IF NOT public.d10_synonym_publication_on_v1() THEN RETURN 'publication_off'; END IF;
  SELECT CASE WHEN bool_or(p.decision = 'verified_synonym') THEN 'verified_synonym' ELSE 'contextual_synonym' END,
         jsonb_agg(jsonb_build_object('pair_id', p.id, 'decision', p.decision, 'confidence', p.confidence,
           'verifier', p.verifier_version, 'reason', p.verification_evidence->>'reason') ORDER BY p.verified_at DESC),
         (array_agg(p.verifier_version ORDER BY p.verified_at DESC))[1]
    INTO v_best, v_pairs, v_version
  FROM public.synonym_pair_v1 p
  WHERE private.synonym_publishable_v1(p)
    AND EXISTS(SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id=p.candidate_id AND c.source_active)
    AND private.synonym_endpoint_visible_v1(p_a_type,p_a_id)
    AND private.synonym_endpoint_visible_v1(p_b_type,p_b_id)
    AND ((p.source_entity_type = p_a_type AND p.source_entity_id = p_a_id AND p.target_entity_type = p_b_type AND p.target_entity_id = p_b_id)
      OR (p.source_entity_type = p_b_type AND p.source_entity_id = p_b_id AND p.target_entity_type = p_a_type AND p.target_entity_id = p_a_id))
    -- D10_synonym_stable_v3 (02.11.2026): AND per SENSE pair in ONE place (private.synonym_pair_counts_v1),
    -- used for the selection AND for the published flag of each pair (the carousel shows published pairs).
    AND private.synonym_pair_counts_v1(p);

  IF v_pairs IS NULL OR v_a_lemma IS NULL OR v_b_lemma IS NULL THEN
    DELETE FROM public.authoritative_semantic_relations r
    WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym'
      AND ((r.source_entity_type = p_a_type AND r.source_entity_id = p_a_id AND r.target_entity_type = p_b_type AND r.target_entity_id = p_b_id)
        OR (r.source_entity_type = p_b_type AND r.source_entity_id = p_b_id AND r.target_entity_type = p_a_type AND r.target_entity_id = p_a_id));
    UPDATE public.synonym_pair_v1 p SET published = false, updated_at = now()
    WHERE p.published AND ((p.source_entity_id = p_a_id AND p.target_entity_id = p_b_id) OR (p.source_entity_id = p_b_id AND p.target_entity_id = p_a_id));
    RETURN 'withdrawn';
  END IF;

  INSERT INTO public.authoritative_semantic_relations AS r (source_entity_type, source_entity_id, relation_type, target_text,
    source, confidence, status, evidence, target_entity_type, target_entity_id, relation_class, recognition_level,
    verification_evidence, verified_at, verifier_version)
  SELECT d.st, d.si, 'synonym', d.tt, 'synonym-verifier',
    CASE WHEN v_best = 'verified_synonym' THEN 'high' ELSE 'medium' END, 'verified',
    jsonb_build_object('published_by', 'd10_synonym_publish_link_v1'), d.tty, d.ti, v_best,
    CASE WHEN v_version LIKE 'rule:%' THEN 'rule' ELSE 'ai_verified' END,
    jsonb_build_object('pairs', v_pairs), now(), v_version
  FROM (VALUES (p_a_type, p_a_id, v_b_lemma, p_b_type, p_b_id), (p_b_type, p_b_id, v_a_lemma, p_a_type, p_a_id)) d(st, si, tt, tty, ti)
  ON CONFLICT (source_entity_type, source_entity_id, relation_type, target_text, source) DO UPDATE SET
    confidence = EXCLUDED.confidence, status = 'verified', target_entity_type = EXCLUDED.target_entity_type,
    target_entity_id = EXCLUDED.target_entity_id, relation_class = EXCLUDED.relation_class,
    recognition_level = EXCLUDED.recognition_level, verification_evidence = EXCLUDED.verification_evidence,
    verified_at = now(), verifier_version = EXCLUDED.verifier_version, updated_at = now();

  UPDATE public.synonym_pair_v1 p SET published = (private.synonym_pair_counts_v1(p)
    AND EXISTS(SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id=p.candidate_id AND c.source_active)
    AND private.synonym_endpoint_visible_v1(p_a_type,p_a_id)
    AND private.synonym_endpoint_visible_v1(p_b_type,p_b_id)),
    updated_at = now()
  WHERE ((p.source_entity_id = p_a_id AND p.target_entity_id = p_b_id) OR (p.source_entity_id = p_b_id AND p.target_entity_id = p_a_id))
    AND p.published IS DISTINCT FROM (private.synonym_pair_counts_v1(p)
    AND EXISTS(SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id=p.candidate_id AND c.source_active)
    AND private.synonym_endpoint_visible_v1(p_a_type,p_a_id)
    AND private.synonym_endpoint_visible_v1(p_b_type,p_b_id));
  RETURN 'published';
END
$b_publish_link$),
    ('public.d10_synonym_fit_request_v1(jsonb)', $h_fit_request$CREATE OR REPLACE FUNCTION public.d10_synonym_fit_request_v1(p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_fit_request$, 'a6642e3157b11e88350c4ddfe5bf020a', '4f0528628a2dcccb606dfe0df81c78d3', $b_fit_request$
DECLARE r jsonb; v_tr jsonb; v_key text; v_out jsonb := '[]'::jsonb; v_row private.synonym_sense_fit_v1%rowtype;
  v_type text; v_id uuid; v_sense text; v_lemma text; v_pos text; v_sense_key text; v_article bigint; v_ctx jsonb;
BEGIN
  -- D10_synonym_stable_v2 (02.11.2026): one evaluation per card + STABLE sense id (Ordbokene article + path +
  -- definition number; text only when the sense is not in an article), part of speech, the pipeline translation
  -- list and the fit check version. The same sense described from either side of a pair gets the same key.
  -- D10_synonym_stable_v3: the key also holds the CONTENT of the sense (normalized definition text and its
  -- context: the sense group from the article, or the given context for senses outside an article). A refined
  -- definition or context gives a new key -> a new evaluation; the old one is no longer used.
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    v_type := r->>'entity_type'; v_id := (r->>'entity_id')::uuid; v_sense := btrim(coalesce(r->>'sense_text', ''));
    IF v_type NOT IN ('lexeme','expression') OR v_id IS NULL OR v_sense = '' THEN
      v_out := v_out || jsonb_build_array(jsonb_build_object('ref', r->'ref', 'error', 'invalid_item'));
      CONTINUE;
    END IF;
    v_tr := private.synonym_card_translations_v1(v_type, v_id);
    IF v_type = 'expression' THEN SELECT x.lemma, 'expression' INTO v_lemma, v_pos FROM public.expression_catalog x WHERE x.id = v_id;
    ELSE SELECT l.lemma, l.pos INTO v_lemma, v_pos FROM public.lexemes l WHERE l.id = v_id; END IF;
    v_article := CASE WHEN (r->>'article_id') ~ '^[0-9]+$' THEN (r->>'article_id')::bigint END;
    v_sense_key := coalesce(nullif(r->>'sense_key', ''), private.synonym_sense_key_v1(v_type, v_id, v_article, v_sense, r->>'context'));
    v_article := coalesce(v_article, CASE WHEN v_sense_key ~ ':a[0-9]+:' THEN substring(v_sense_key from ':a([0-9]+):')::bigint END);
    v_ctx := coalesce(private.synonym_sense_group_v1(v_article, v_sense),
      CASE WHEN jsonb_typeof(r->'contexts') = 'array' THEN r->'contexts' ELSE '[]'::jsonb END
        || CASE WHEN nullif(btrim(r->>'context'), '') IS NOT NULL THEN jsonb_build_array('context: ' || btrim(r->>'context')) ELSE '[]'::jsonb END);
    v_key := private.synonym_fit_key_v3(v_sense_key, v_pos, v_sense, v_ctx, v_tr);
    INSERT INTO private.synonym_sense_fit_v1 (fit_key, sense_key, entity_type, entity_id, card_lexeme_id, lemma, part_of_speech, sense_text,
      contexts, tr_uk, tr_en, status, fit, decided_at, prompt_version)
    SELECT v_key, v_sense_key, v_type, v_id, (v_tr->>'card')::uuid, v_lemma, v_pos, v_sense,
      v_ctx,
      ARRAY(SELECT jsonb_array_elements_text(v_tr->'uk')), ARRAY(SELECT jsonb_array_elements_text(v_tr->'en')),
      CASE WHEN jsonb_array_length(v_tr->'uk') = 0 OR jsonb_array_length(v_tr->'en') = 0 THEN 'done' ELSE 'queued' END,
      CASE WHEN jsonb_array_length(v_tr->'uk') = 0 OR jsonb_array_length(v_tr->'en') = 0 THEN 'no_match' END,
      CASE WHEN jsonb_array_length(v_tr->'uk') = 0 OR jsonb_array_length(v_tr->'en') = 0 THEN now() END,
      CASE WHEN jsonb_array_length(v_tr->'uk') = 0 OR jsonb_array_length(v_tr->'en') = 0 THEN 'rule:no_pipeline_translation' END
    ON CONFLICT (fit_key) DO NOTHING;
    IF FOUND THEN
      INSERT INTO private.synonym_sense_fit_events_v1 (fit_key, event, after_row)
      SELECT v_key, 'created', to_jsonb(f) FROM private.synonym_sense_fit_v1 f WHERE f.fit_key = v_key;
    END IF;
    SELECT * INTO v_row FROM private.synonym_sense_fit_v1 WHERE fit_key = v_key;
    v_out := v_out || jsonb_build_array(jsonb_build_object('ref', r->'ref', 'fit_key', v_key, 'sense_key', v_sense_key, 'status', v_row.status,
      'fit', v_row.fit, 'chosen_uk', v_row.chosen_uk, 'chosen_en', v_row.chosen_en));
  END LOOP;
  RETURN v_out;
END
$b_fit_request$)
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
    INSERT INTO d10_stable3_report VALUES ('02_function', r.reg, jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
  END LOOP;
END
$mig$;

DO $reclass$
DECLARE p record; v_s jsonb; v_res jsonb; n_fit_pairs int := 0; n_missing int := 0; n_retired int := 0; n_copied int := 0;
BEGIN
  -- 1. queued fit rows with the v2 key are retired (rows kept, status failed)
  UPDATE private.synonym_sense_fit_v1 SET status = 'failed', last_error = 'superseded_stable_v3', lease_token = NULL, lease_until = NULL
  WHERE status IN ('queued', 'processing');
  GET DIAGNOSTICS n_retired = ROW_COUNT;

  -- 2. every verified pair requests its two fits with the v3 key (sense id + content)
  FOR p IN SELECT * FROM public.synonym_pair_v1 WHERE status = 'done' AND decision = 'verified_synonym' ORDER BY id LOOP
    v_s := private.synonym_pair_senses_v1(p.snapshot, p.source_entity_type, p.source_entity_id, p.target_entity_type,
      p.target_entity_id, p.target_article_key, coalesce(nullif(p.verification_evidence->>'matched_text', ''),
        CASE WHEN (p.verification_evidence->>'matched_definition') ~ '^\d+$'
             THEN p.snapshot->'target'->'definitions_nb'->>((p.verification_evidence->>'matched_definition')::int)
             WHEN (p.verification_evidence->>'matched_definition') !~ '^-?\d+$' THEN p.verification_evidence->>'matched_definition' END));
    IF v_s->>'source_sense_key' IS NULL OR v_s->>'target_sense_key' IS NULL THEN n_missing := n_missing + 1; CONTINUE; END IF;
    v_res := public.d10_synonym_fit_request_v1(jsonb_build_array(
      jsonb_build_object('ref', 's', 'entity_type', p.source_entity_type, 'entity_id', p.source_entity_id,
        'sense_key', v_s->>'source_sense_key', 'sense_text', v_s->>'source_sense_text',
        'contexts', coalesce(p.snapshot->'source'->'sense_context'->'group_definitions', '[]'::jsonb)),
      jsonb_build_object('ref', 't', 'entity_type', p.target_entity_type, 'entity_id', p.target_entity_id,
        'sense_key', v_s->>'target_sense_key', 'sense_text', v_s->>'target_sense_text',
        'contexts', jsonb_build_array(v_s->>'target_sense_text'))));
    UPDATE public.synonym_pair_v1 SET verification_evidence = verification_evidence
      || jsonb_build_object('source_fit_key', v_res->0->>'fit_key', 'target_fit_key', v_res->1->>'fit_key', 'fit_v3_at', now())
    WHERE id = p.id;
    n_fit_pairs := n_fit_pairs + 1;
  END LOOP;

  -- 3. an evaluation already made for exactly the same content (sense id, part of speech, text, context, translations)
  --    is carried over instead of asking again
  WITH src AS (
    SELECT DISTINCT ON (o.sense_key, o.part_of_speech, lower(btrim(o.sense_text)), o.contexts, o.tr_uk, o.tr_en)
      o.sense_key, o.part_of_speech, lower(btrim(o.sense_text)) AS t, o.contexts, o.tr_uk, o.tr_en, o.fit, o.chosen_uk, o.chosen_en, o.model, o.fit_key
    FROM private.synonym_sense_fit_v1 o
    WHERE o.status = 'done' AND o.sense_key IS NOT NULL AND o.fit IS NOT NULL AND o.prompt_version = 'sense_fit_v1'
    ORDER BY o.sense_key, o.part_of_speech, lower(btrim(o.sense_text)), o.contexts, o.tr_uk, o.tr_en, o.decided_at DESC
  ), upd AS (
    UPDATE private.synonym_sense_fit_v1 f SET status = 'done', fit = s.fit, chosen_uk = s.chosen_uk, chosen_en = s.chosen_en,
      model = s.model, prompt_version = 'sense_fit_v1', decided_at = now(), last_error = 'copied_from:' || s.fit_key
    FROM src s
    WHERE f.status = 'queued' AND f.sense_key = s.sense_key AND f.part_of_speech IS NOT DISTINCT FROM s.part_of_speech
      AND lower(btrim(f.sense_text)) = s.t AND f.contexts = s.contexts AND f.tr_uk = s.tr_uk AND f.tr_en = s.tr_en
      AND f.fit_key <> s.fit_key
    RETURNING f.fit_key
  )
  SELECT count(*) INTO n_copied FROM upd;

  -- 4. publication: one rule for the link and for the published flag
  FOR p IN SELECT DISTINCT source_entity_type a_t, source_entity_id a_i, target_entity_type b_t, target_entity_id b_i
           FROM public.synonym_pair_v1 WHERE status = 'done' LOOP
    PERFORM public.d10_synonym_publish_link_v1(p.a_t, p.a_i, p.b_t, p.b_i);
  END LOOP;

  INSERT INTO d10_stable3_report VALUES ('04_data', 'fits', jsonb_build_object('queued_v2_retired', n_retired,
    'verified_pairs_with_fits', n_fit_pairs, 'verified_without_sense', n_missing, 'carried_over_same_content', n_copied));
END
$reclass$;


DO $probe$
DECLARE v_bad int;
BEGIN
  -- P1 no pair is marked published unless it counts (publishable, not contradicted by the reverse sense pair)
  SELECT count(*) INTO v_bad FROM public.synonym_pair_v1 p WHERE p.published AND NOT private.synonym_pair_counts_v1(p);
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P1 % published pairs that do not count', v_bad; END IF;
  -- P2 every published relation has a pair that counts
  SELECT count(*) INTO v_bad FROM public.authoritative_semantic_relations r
  WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym'
    AND NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE private.synonym_pair_counts_v1(p)
      AND ((p.source_entity_id = r.source_entity_id AND p.target_entity_id = r.target_entity_id)
        OR (p.source_entity_id = r.target_entity_id AND p.target_entity_id = r.source_entity_id)));
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P2 % published relations without a pair that counts', v_bad; END IF;
  -- P3 symmetry
  SELECT count(*) INTO v_bad FROM public.authoritative_semantic_relations r
  WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym'
    AND NOT EXISTS (SELECT 1 FROM public.authoritative_semantic_relations q WHERE q.source = 'synonym-verifier' AND q.relation_type = 'synonym'
                    AND q.source_entity_id = r.target_entity_id AND q.target_entity_id = r.source_entity_id);
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P3 % published relations without reverse', v_bad; END IF;
  -- P4 every fit key of a verified pair exists and has the v3 form
  SELECT count(*) INTO v_bad FROM public.synonym_pair_v1 p
  WHERE p.status = 'done' AND p.decision = 'verified_synonym' AND p.verification_evidence ? 'source_fit_key'
    AND (NOT EXISTS (SELECT 1 FROM private.synonym_sense_fit_v1 f WHERE f.fit_key = p.verification_evidence->>'source_fit_key')
      OR NOT EXISTS (SELECT 1 FROM private.synonym_sense_fit_v1 f WHERE f.fit_key = p.verification_evidence->>'target_fit_key'));
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P4 % verified pairs with missing fit rows', v_bad; END IF;
  INSERT INTO d10_stable3_report VALUES ('05_probes', 'published flag / link / symmetry / fit rows', jsonb_build_object('P1', 0, 'P2', 0, 'P3', 0, 'P4', 0));
  -- P5 a changed definition gives a new fit key (same card, same sense id)
  IF private.synonym_fit_key_v3('k', 'verb', 'ta noe', '[]', '{"uk":["a"],"en":["b"]}')
     = private.synonym_fit_key_v3('k', 'verb', 'ta noe som tilhorer en annen', '[]', '{"uk":["a"],"en":["b"]}')
     OR private.synonym_fit_key_v3('k', 'verb', 'ta noe', '[]', '{"uk":["a"],"en":["b"]}')
     = private.synonym_fit_key_v3('k', 'verb', 'ta noe', '["kontekst"]', '{"uk":["a"],"en":["b"]}')
     OR private.synonym_fit_key_v3('k', 'verb', 'ta  noe', '[]', '{"uk":["a"],"en":["b"]}')
     <> private.synonym_fit_key_v3('k', 'verb', 'Ta noe', '[]', '{"uk":["a"],"en":["b"]}') THEN
    RAISE EXCEPTION 'STOP: probe P5 fit key does not follow the sense content';
  END IF;
  INSERT INTO d10_stable3_report VALUES ('05_probes', 'fit key follows content', jsonb_build_object('text_change', 'new key', 'context_change', 'new key', 'spacing_case', 'same key'));

  INSERT INTO d10_stable3_report SELECT '06_after', 'translation fits', jsonb_build_object(
    'waiting_for_verifier', public.d10_synonym_fit_pending_v1(),
    'by_status', (SELECT jsonb_object_agg(k, n) FROM (SELECT status || coalesce(':' || fit, '') k, count(*) n FROM private.synonym_sense_fit_v1 GROUP BY 1) z),
    'published_now', (SELECT count(*) FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier' AND relation_type = 'synonym'), 'published_pairs', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published));
END
$probe$;

SELECT part, name, info FROM d10_stable3_report ORDER BY 1, 2;
