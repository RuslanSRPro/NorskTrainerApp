-- 20261102200000_d10_synonym_stable_v2.sql
-- D10_synonym_stable_v2 (on top of D10_synonym_stable_v1, after review):
--  1. the code never raises the AI's own category: a more permissive result from the substitution answers means
--     the answer contradicts itself -> needs_manual_review (old answers reclassified by code go back to the AI:
--     test words now, the rest parked until the whole base is rerun);
--  2. AND of publication per SENSE pair: only the reverse pair with the same two senses (stable sense ids:
--     card + Ordboekene article + path + definition number) can block a link; other senses of the cards cannot;
--  3. relation key (reuse of a relation answer) = exactly the fields the AI sees (context label, sense group,
--     examples of the sense included; translations and general examples not);
--  4. translation fit keyed by card + stable sense id + part of speech + translations + check version;
--     the old text-keyed rows are retired (kept, status failed);
--  5. v10 decisions can be copied to waiting pairs with the same content.
-- Guards: v1 installed, v2 not installed, md5 of the 6 replaced functions. Reinstall -> STOP.
-- Rollback: optional/20261102200000_d10_synonym_stable_v2_ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_stable2_report;
CREATE TEMP TABLE d10_stable2_report(part text, name text, info jsonb);

DO $mig$
BEGIN
  IF to_regclass('private.synonym_sense_fit_v1') IS NULL OR to_regclass('private.synonym_pair_v1_backup_d10_stable') IS NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_stable_v1 is not installed';
  END IF;
  IF to_regprocedure('private.synonym_sense_key_v1(text,uuid,bigint,text,text)') IS NOT NULL
     OR to_regclass('private.synonym_pair_v1_backup_d10_stable_v2') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: D10_synonym_stable_v2 already installed';
  END IF;
  IF to_regprocedure('public.d10_synonym_sense_path_v1(bigint,text)') IS NULL THEN
    RAISE EXCEPTION 'STOP: public.d10_synonym_sense_path_v1(bigint,text) not found';
  END IF;
END
$mig$;

-- backups for rollback
CREATE TABLE private.synonym_pair_v1_backup_d10_stable_v2 AS
  SELECT id, status, decision, verifier_version, verification_evidence, published, force_recheck, rule_reason, next_attempt_at,
         now() AS saved_at
  FROM public.synonym_pair_v1;
CREATE TABLE private.synonym_sense_fit_v1_backup_d10_stable_v2 AS
  SELECT fit_key, status, last_error, now() AS saved_at FROM private.synonym_sense_fit_v1;
CREATE TABLE private.synonym_relations_backup_d10_stable_v2 AS
  SELECT * FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier';
REVOKE ALL ON TABLE private.synonym_pair_v1_backup_d10_stable_v2 FROM PUBLIC;
REVOKE ALL ON TABLE private.synonym_sense_fit_v1_backup_d10_stable_v2 FROM PUBLIC;
REVOKE ALL ON TABLE private.synonym_relations_backup_d10_stable_v2 FROM PUBLIC;

-- stable sense id: card + Ordbokene article + sense path + definition number; when the text is not found in the
-- article (NAOB meanings, expressions), card + normalized text (+ context label)
CREATE FUNCTION private.synonym_sense_key_v1(p_type text, p_id uuid, p_article bigint, p_text text, p_context text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  SELECT CASE WHEN p_type IS NULL OR p_id IS NULL OR btrim(coalesce(p_text, '')) = '' THEN NULL ELSE
    p_type || ':' || p_id::text || ':' || coalesce(
      (SELECT 'a' || p_article::text || ':' || coalesce(s.sense_path, '') || ':' || s.def_ord::text
       FROM public.d10_synonym_sense_path_v1(p_article, p_text) s WHERE p_article IS NOT NULL LIMIT 1),
      't' || md5(lower(btrim(regexp_replace(p_text, '\s+', ' ', 'g'))) || '|' || lower(btrim(coalesce(p_context, '')))))
  END;
$f$;

-- the two senses of a pair: source = its focus gloss / meaning, target = the matched definition
CREATE FUNCTION private.synonym_pair_senses_v1(p_snapshot jsonb, p_s_type text, p_s_id uuid, p_t_type text, p_t_id uuid,
  p_t_article text, p_matched_text text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  WITH s AS (
    SELECT coalesce(nullif(btrim(p_snapshot->'source'->'sense_context'->>'focus_gloss'), ''),
                    nullif(btrim(p_snapshot->'source'->>'definition_nb'), '')) AS txt,
           CASE WHEN (p_snapshot->'source'->'sense_context'->>'article_id') ~ '^[0-9]+$'
                  THEN (p_snapshot->'source'->'sense_context'->>'article_id')::bigint
                WHEN (p_snapshot->'source'->>'naob_slug') ~ '^bm:[0-9]+$'
                  THEN substring(p_snapshot->'source'->>'naob_slug' from '^bm:([0-9]+)$')::bigint END AS art,
           nullif(btrim(p_snapshot->'source'->>'context_label'), '') AS ctx,
           nullif(btrim(p_matched_text), '') AS ttxt,
           CASE WHEN p_t_article ~ '^[0-9]+$' THEN p_t_article::bigint
                WHEN (p_snapshot->'target'->>'article_id') ~ '^[0-9]+$' THEN (p_snapshot->'target'->>'article_id')::bigint END AS tart
  )
  SELECT jsonb_build_object(
    'source_sense_key', private.synonym_sense_key_v1(p_s_type, p_s_id, s.art, s.txt, s.ctx),
    'target_sense_key', private.synonym_sense_key_v1(p_t_type, p_t_id, s.tart, s.ttxt, NULL),
    'source_sense_text', s.txt, 'source_article', s.art, 'source_context', s.ctx,
    'target_sense_text', s.ttxt, 'target_article', s.tart)
  FROM s;
$f$;

-- fit key v2: stable sense id + part of speech + pipeline translations + fit check version
CREATE FUNCTION private.synonym_fit_key_v2(p_sense_key text, p_pos text, p_tr jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $f$
  SELECT md5(jsonb_build_array('fit-v2', 'sense_fit_v1', p_sense_key, lower(coalesce(p_pos, '')), p_tr->'uk', p_tr->'en')::text);
$f$;

ALTER TABLE private.synonym_sense_fit_v1 ADD COLUMN sense_key text;
CREATE INDEX synonym_sense_fit_v1_sense_idx ON private.synonym_sense_fit_v1 (sense_key);

REVOKE ALL ON FUNCTION private.synonym_sense_key_v1(text, uuid, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.synonym_pair_senses_v1(jsonb, text, uuid, text, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.synonym_fit_key_v2(text, text, jsonb) FROM PUBLIC;

INSERT INTO d10_stable2_report SELECT '01_before', 'published', jsonb_build_object(
  'published_pairs', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published), 'verifier_relations', (SELECT count(*) FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier' AND relation_type = 'synonym'),
  'fits', (SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) n FROM private.synonym_sense_fit_v1 GROUP BY 1) z));

DO $mig$
DECLARE r record; v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_md5 text; v_body text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('private.synonym_relation_key_v1(jsonb,uuid,text)', $h_relation_key$CREATE OR REPLACE FUNCTION private.synonym_relation_key_v1(p_snapshot jsonb, p_target uuid, p_article text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
$h_relation_key$, '16e55deffa4b1d5084bcdadb0f462b59', '88e58d3c5648bf320ec6425f9f99588d', $b_relation_key$
  -- D10_synonym_stable_v2 (02.11.2026): exactly the fields the relation verifier shows to the AI (pairInput in
  -- verifier-core.ts): source word, part of speech, meaning, context label, sense group (article, path, focus,
  -- group definitions, group examples); target word, part of speech, definitions, article. Not included:
  -- translations and general examples (the AI does not see them).
  SELECT md5(jsonb_build_object('contract', 'relation-v2',
    's_type', p_snapshot->'source'->'entity_type', 's_id', p_snapshot->'source'->'entity_id',
    's_lemma', p_snapshot->'source'->'lemma', 's_pos', p_snapshot->'source'->'part_of_speech',
    's_def', p_snapshot->'source'->'definition_nb', 's_context', p_snapshot->'source'->'context_label',
    's_sense', p_snapshot->'source'->'sense_context',
    't_type', p_snapshot->'target'->'entity_type', 't_id', p_target,
    't_lemma', p_snapshot->'target'->'lemma', 't_pos', p_snapshot->'target'->'part_of_speech',
    't_defs', p_snapshot->'target'->'definitions_nb', 't_article', p_snapshot->'target'->'article_id',
    'article', p_article)::text);
$b_relation_key$),
    ('private.synonym_relation_category_v1(text,text,boolean,boolean,boolean,boolean,boolean,boolean)', $h_category$CREATE OR REPLACE FUNCTION private.synonym_relation_category_v1(p_ai text, p_pattern text, p_matched_ok boolean, p_fwd boolean, p_rev boolean, p_same boolean, p_restriction boolean, p_has_definitions boolean)
 RETURNS TABLE(final text, guard text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
$h_category$, '968e0efa0a08a32470cc32f04b6aaaea', 'bc08d5b24cf176b6cd032f9baed5e2b4', $b_category$
  -- D10_synonym_stable_v2 (02.11.2026): the code never RAISES the AI's own category. If the substitution answers
  -- give a more permissive category than the AI named (order: verified > contextual > one_way > near), the answer
  -- contradicts itself -> needs_manual_review (guard ai_category_contradiction). Stricter results are kept.
  SELECT CASE WHEN y.contradiction THEN 'needs_manual_review' ELSE y.final END,
         CASE WHEN y.contradiction THEN 'ai_category_contradiction'
              WHEN y.guard IS NOT NULL THEN y.guard WHEN y.final IS DISTINCT FROM p_ai THEN 'code_category' END
  FROM (SELECT x.final, x.guard,
          (x.guard IS NULL AND p_ai IN ('contextual_synonym','near_synonym','one_way_synonym')
           AND x.final IN ('verified_synonym','contextual_synonym','one_way_synonym','near_synonym')
           AND (CASE x.final WHEN 'verified_synonym' THEN 4 WHEN 'contextual_synonym' THEN 3 WHEN 'one_way_synonym' THEN 2 ELSE 1 END)
             > (CASE p_ai WHEN 'verified_synonym' THEN 4 WHEN 'contextual_synonym' THEN 3 WHEN 'one_way_synonym' THEN 2 ELSE 1 END)) AS contradiction
  FROM (SELECT
    CASE
      WHEN NOT coalesce(p_has_definitions, false) THEN 'needs_manual_review'
      WHEN p_ai IN ('verified_synonym','contextual_synonym','near_synonym','one_way_synonym') THEN
        CASE
          WHEN NOT coalesce(p_matched_ok, false) THEN 'needs_manual_review'
          WHEN p_pattern = 'target_other_sense' THEN 'needs_manual_review'
          WHEN coalesce(p_fwd,false) AND coalesce(p_rev,false) AND coalesce(p_same,false)
               AND NOT coalesce(p_restriction, true) AND p_pattern = 'same_meaning' THEN 'verified_synonym'
          WHEN coalesce(p_fwd,false) AND coalesce(p_rev,false) THEN 'contextual_synonym'
          WHEN coalesce(p_fwd,false) <> coalesce(p_rev,false) THEN 'one_way_synonym'
          ELSE 'near_synonym'
        END
      WHEN p_ai = 'rejected' AND coalesce(p_matched_ok,false) AND p_pattern = 'same_meaning' THEN 'needs_manual_review'
      ELSE p_ai
    END AS final,
    CASE
      WHEN NOT coalesce(p_has_definitions, false) THEN 'target_without_sense_evidence'
      WHEN p_ai IN ('verified_synonym','contextual_synonym','near_synonym','one_way_synonym') AND NOT coalesce(p_matched_ok,false)
        THEN 'synonym_without_matching_definition'
      WHEN p_ai IN ('verified_synonym','contextual_synonym','near_synonym','one_way_synonym') AND p_pattern = 'target_other_sense'
        THEN 'synonym_but_other_sense'
      WHEN p_ai = 'rejected' AND coalesce(p_matched_ok,false) AND p_pattern = 'same_meaning' THEN 'rejected_but_same_meaning'
    END AS guard) x) y;
$b_category$),
    ('public.d10_synonym_fit_request_v1(jsonb)', $h_fit_request$CREATE OR REPLACE FUNCTION public.d10_synonym_fit_request_v1(p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_fit_request$, '52aea63f2933f996d24c58dc7c7ff1ce', 'a6642e3157b11e88350c4ddfe5bf020a', $b_fit_request$
DECLARE r jsonb; v_tr jsonb; v_key text; v_out jsonb := '[]'::jsonb; v_row private.synonym_sense_fit_v1%rowtype;
  v_type text; v_id uuid; v_sense text; v_lemma text; v_pos text; v_sense_key text; v_article bigint;
BEGIN
  -- D10_synonym_stable_v2 (02.11.2026): one evaluation per card + STABLE sense id (Ordbokene article + path +
  -- definition number; text only when the sense is not in an article), part of speech, the pipeline translation
  -- list and the fit check version. The same sense described from either side of a pair gets the same key.
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
    v_key := private.synonym_fit_key_v2(v_sense_key, v_pos, v_tr);
    INSERT INTO private.synonym_sense_fit_v1 (fit_key, sense_key, entity_type, entity_id, card_lexeme_id, lemma, part_of_speech, sense_text,
      contexts, tr_uk, tr_en, status, fit, decided_at, prompt_version)
    SELECT v_key, v_sense_key, v_type, v_id, (v_tr->>'card')::uuid, v_lemma, v_pos, v_sense,
      CASE WHEN jsonb_typeof(r->'contexts') = 'array' THEN r->'contexts' ELSE '[]'::jsonb END,
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
$b_fit_request$),
    ('public.d10_synonym_record_decision_v1(uuid,uuid,text,text,numeric,jsonb,text)', $h_record$CREATE OR REPLACE FUNCTION public.d10_synonym_record_decision_v1(p_pair_id uuid, p_lease_token uuid, p_snapshot_hash text, p_decision text, p_confidence numeric, p_evidence jsonb, p_verifier_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_record$, '91286a8affd6870814f1f0b9e3f8b19a', 'd8088e1ae06b859935c4f9fb33f543b4', $b_record$
DECLARE
  v_n integer;
  v_p record; v_senses jsonb; v_res jsonb; v_ev jsonb := coalesce(p_evidence, '{}'::jsonb);
BEGIN
  -- D10_synonym_stable_v1 (02.11.2026): one_way_synonym; v10 contract check; relation_key / decided_content_key stored
  IF p_decision IS NULL OR p_decision NOT IN ('verified_synonym','contextual_synonym','near_synonym','one_way_synonym',
       'related','rejected','needs_manual_review') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_DECISION');
  END IF;
  -- D10_synonym_stable_v1: a v10 decision must come from the v10 verifier (relation only; translation fit by keys)
  IF p_verifier_version LIKE 'ai:synonym_pair_v10:%' AND coalesce(p_evidence->>'contract', '') <> 'v10' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'OLD_VERIFIER_FOR_V10', 'applied', false, 'stale', true);
  END IF;
  -- D10_synonym_stable_v2 (02.11.2026): every decision stores the stable ids of its two senses
  -- (private.synonym_pair_senses_v1: card + article + path + definition number); the AND rule of publication
  -- compares only the reverse pair with the SAME two senses. A v10 verified decision requests the translation fit
  -- for both senses by these ids, so one sense always has one evaluation, from whichever side it is described.
  SELECT p.snapshot, p.source_entity_type, p.source_entity_id, p.target_entity_type, p.target_entity_id, p.target_article_key INTO v_p
  FROM public.synonym_pair_v1 p
  WHERE p.id = p_pair_id AND p.status = 'processing' AND p.lease_token = p_lease_token
    AND p.snapshot_hash IS NOT DISTINCT FROM p_snapshot_hash;
  IF FOUND THEN
    v_senses := private.synonym_pair_senses_v1(v_p.snapshot, v_p.source_entity_type, v_p.source_entity_id,
      v_p.target_entity_type, v_p.target_entity_id, v_p.target_article_key, p_evidence->>'matched_text');
    v_ev := v_ev - 'source_fit_key' - 'target_fit_key' - 'source_sense_key' - 'target_sense_key' - 'fit_missing'
      || jsonb_strip_nulls(jsonb_build_object('source_sense_key', v_senses->>'source_sense_key',
                                              'target_sense_key', v_senses->>'target_sense_key'));
    IF p_decision = 'verified_synonym' AND p_verifier_version LIKE 'ai:synonym_pair_v10:%' THEN
      IF v_senses->>'source_sense_key' IS NOT NULL AND v_senses->>'target_sense_key' IS NOT NULL THEN
        v_res := public.d10_synonym_fit_request_v1(jsonb_build_array(
          jsonb_build_object('ref', 's', 'entity_type', v_p.source_entity_type, 'entity_id', v_p.source_entity_id,
            'sense_key', v_senses->>'source_sense_key', 'sense_text', v_senses->>'source_sense_text',
            'contexts', coalesce(v_p.snapshot->'source'->'sense_context'->'group_definitions', '[]'::jsonb)),
          jsonb_build_object('ref', 't', 'entity_type', v_p.target_entity_type, 'entity_id', v_p.target_entity_id,
            'sense_key', v_senses->>'target_sense_key', 'sense_text', v_senses->>'target_sense_text',
            'contexts', jsonb_build_array(v_senses->>'target_sense_text'))));
        v_ev := v_ev || jsonb_strip_nulls(jsonb_build_object('source_fit_key', v_res->0->>'fit_key', 'target_fit_key', v_res->1->>'fit_key'));
      ELSE
        v_ev := v_ev || jsonb_build_object('fit_missing', 'sense_text_missing');
      END IF;
    END IF;
  END IF;
  UPDATE public.synonym_pair_v1
  SET status = 'done', force_recheck=false, decision = p_decision,
      confidence = least(greatest(coalesce(p_confidence, 0), 0), 1),
      verification_evidence = v_ev
        || jsonb_build_object('snapshot_hash', p_snapshot_hash, 'dry_run', true,
             'relation_key', private.synonym_relation_key_v1(snapshot, target_entity_id, target_article_key),
             'decided_content_key', public.d10_synonym_pair_content_key_v1(snapshot, target_entity_id, target_article_key)),
      verifier_version = p_verifier_version, verified_at = now(), published = false,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
  WHERE id = p_pair_id AND status = 'processing' AND lease_token = p_lease_token
    AND snapshot_hash IS NOT DISTINCT FROM p_snapshot_hash;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  -- D10 29.10.2026 (agreed, v2): waiting pairs with the same content get it too
  IF v_n = 1 THEN PERFORM public.d10_synonym_copy_decisions_v1(p_verifier_version); END IF;
  RETURN jsonb_build_object('ok', true, 'applied', v_n = 1, 'stale', v_n = 0);
END
$b_record$),
    ('public.d10_synonym_publish_link_v1(text,uuid,text,uuid)', $h_publish_link$CREATE OR REPLACE FUNCTION public.d10_synonym_publish_link_v1(p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_publish_link$, '4fbdcf72bcdd1095f6d709183d8d0e76', '27648869a65c32542bea97b4cb24fa58', $b_publish_link$
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
    -- D10_synonym_stable_v2 (02.11.2026): AND per SENSE pair. A publishable pair counts only if the reverse pair for
    -- the SAME two senses (stable sense ids), when decided, is publishable too. Other senses of the same two cards
    -- do not block it.
    AND NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 q
      WHERE q.status = 'done' AND q.decision IS NOT NULL
        AND q.source_entity_type = p.target_entity_type AND q.source_entity_id = p.target_entity_id
        AND q.target_entity_type = p.source_entity_type AND q.target_entity_id = p.source_entity_id
        AND q.verification_evidence->>'source_sense_key' = p.verification_evidence->>'target_sense_key'
        AND q.verification_evidence->>'target_sense_key' = p.verification_evidence->>'source_sense_key'
        AND EXISTS (SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id = q.candidate_id AND c.source_active)
        AND NOT private.synonym_publishable_v1(q));

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

  UPDATE public.synonym_pair_v1 p SET published = (private.synonym_publishable_v1(p)
    AND EXISTS(SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id=p.candidate_id AND c.source_active)
    AND private.synonym_endpoint_visible_v1(p_a_type,p_a_id)
    AND private.synonym_endpoint_visible_v1(p_b_type,p_b_id)),
    updated_at = now()
  WHERE ((p.source_entity_id = p_a_id AND p.target_entity_id = p_b_id) OR (p.source_entity_id = p_b_id AND p.target_entity_id = p_a_id))
    AND p.published IS DISTINCT FROM (private.synonym_publishable_v1(p)
    AND EXISTS(SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id=p.candidate_id AND c.source_active)
    AND private.synonym_endpoint_visible_v1(p_a_type,p_a_id)
    AND private.synonym_endpoint_visible_v1(p_b_type,p_b_id));
  RETURN 'published';
END
$b_publish_link$),
    ('public.d10_synonym_copy_decisions_v1(text)', $h_copy$CREATE OR REPLACE FUNCTION public.d10_synonym_copy_decisions_v1(p_version text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_copy$, '5bad64ecdfb44990a540e2d823cb47dd', '61a7eac1066b3b126f41ff1a42043327', $b_copy$
DECLARE v_n integer; v_kept integer;
BEGIN
  -- D10_synonym_stable_v2 (02.11.2026): v10 decisions (no publication_ready flag) can be copied as well
  WITH decided AS (
    SELECT DISTINCT ON (public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key))
      public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key) AS k,
      d.id, d.decision, d.confidence, d.verification_evidence, d.verifier_version
    FROM public.synonym_pair_v1 d
    WHERE d.status = 'done' AND d.decision IS NOT NULL
      AND ((d.verifier_version = p_version
        AND jsonb_typeof(d.verification_evidence->'substitution_forward') = 'boolean'
        AND jsonb_typeof(d.verification_evidence->'substitution_reverse') = 'boolean'
        AND jsonb_typeof(d.verification_evidence->'same_construction') = 'boolean'
 AND (jsonb_typeof(d.verification_evidence->'publication_ready') = 'boolean' OR d.verification_evidence->>'contract' = 'v10')
 AND jsonb_typeof(d.verification_evidence->'additional_restriction') = 'boolean'))
    ORDER BY public.d10_synonym_pair_content_key_v1(d.snapshot, d.target_entity_id, d.target_article_key), d.verified_at DESC
  )
  UPDATE public.synonym_pair_v1 p
  SET status = 'done', decision = x.decision, confidence = x.confidence,
      verification_evidence = (x.verification_evidence - 'copied_from')
        || jsonb_build_object('copied_from', x.id, 'snapshot_hash', p.snapshot_hash, 'dry_run', true),
      verifier_version = x.verifier_version, verified_at = now(), published = false,
      lease_token = NULL, lease_until = NULL, last_error = NULL, updated_at = now()
  FROM decided x
  WHERE p.status IN ('queued', 'retry_wait') AND NOT p.force_recheck AND p.id <> x.id
    AND public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) = x.k;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  -- D10_synonym_stable_v1 (02.11.2026): a pair sent back for recheck whose content did not change since its
  -- own decision (same content key, same verifier) keeps that decision without AI: same input -> same result.
  UPDATE public.synonym_pair_v1 p
  SET status = 'done', force_recheck = false, verified_at = now(), published = false,
      lease_token = NULL, lease_until = NULL, last_error = NULL, rule_reason = NULL, updated_at = now(),
      verification_evidence = p.verification_evidence || jsonb_build_object('kept_unchanged_at', now())
  WHERE p.status IN ('queued', 'retry_wait') AND p.decision IS NOT NULL
    AND p.verifier_version = p_version
    AND p.verification_evidence->>'decided_content_key'
        = public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key);
  GET DIAGNOSTICS v_kept = ROW_COUNT;
  RETURN v_n + v_kept;
END
$b_copy$)
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
    INSERT INTO d10_stable2_report VALUES ('02_function', r.reg, jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
  END LOOP;
END
$mig$;

-- D10_synonym_stable_v2: data. Every decided pair gets the stable ids of its two senses; v10 relation keys are
-- recomputed with the full input; code-reclassified answers that contradict themselves go back to the AI
-- (test words now, the rest parked until the whole base is rerun); translation fits move to the stable keys.
DO $reclass$
DECLARE p record; v_s jsonb; v_res jsonb; v_cat record; v_matched int; v_ndefs int;
  n_keys int := 0; n_rel int := 0; n_contra_q int := 0; n_contra_park int := 0; n_contra_manual int := 0;
  n_fit_pairs int := 0; n_fit_missing int := 0; n_superseded int := 0;
  v_test text[] := ARRAY['snakke','stor','tok','god','kreve','straffe','stjele','samtale','hente','sv' || chr(230) || 'r','ta'];
BEGIN
  -- 1. sense ids for every pair with a decision
  FOR p IN SELECT * FROM public.synonym_pair_v1 WHERE decision IS NOT NULL ORDER BY id LOOP
    v_s := private.synonym_pair_senses_v1(p.snapshot, p.source_entity_type, p.source_entity_id, p.target_entity_type,
      p.target_entity_id, p.target_article_key, coalesce(nullif(p.verification_evidence->>'matched_text', ''),
        CASE WHEN (p.verification_evidence->>'matched_definition') ~ '^\d+$'
             THEN p.snapshot->'target'->'definitions_nb'->>((p.verification_evidence->>'matched_definition')::int)
             WHEN (p.verification_evidence->>'matched_definition') !~ '^-?\d+$' THEN p.verification_evidence->>'matched_definition' END));
    UPDATE public.synonym_pair_v1 SET verification_evidence = verification_evidence - 'source_sense_key' - 'target_sense_key'
        || jsonb_strip_nulls(jsonb_build_object('source_sense_key', v_s->>'source_sense_key', 'target_sense_key', v_s->>'target_sense_key'))
    WHERE id = p.id;
    n_keys := n_keys + 1;
  END LOOP;

  -- 2. v10 relation keys with the full AI input
  UPDATE public.synonym_pair_v1 SET verification_evidence = verification_evidence
      || jsonb_build_object('relation_key', private.synonym_relation_key_v1(snapshot, target_entity_id, target_article_key))
  WHERE verification_evidence->>'contract' = 'v10' AND verification_evidence ? 'relation_key';
  GET DIAGNOSTICS n_rel = ROW_COUNT;

  -- 3. self-contradicting answers (the code would raise the AI's category)
  FOR p IN SELECT * FROM public.synonym_pair_v1
           WHERE status = 'done' AND verifier_version LIKE 'ai:synonym_pair_v10:%' AND verification_evidence->>'contract' = 'v10'
             AND jsonb_typeof(verification_evidence->'substitution_forward') = 'boolean' ORDER BY id LOOP
    v_ndefs := CASE WHEN jsonb_typeof(p.snapshot->'target'->'definitions_nb') = 'array' THEN jsonb_array_length(p.snapshot->'target'->'definitions_nb') ELSE 0 END;
    v_matched := CASE WHEN (p.verification_evidence->>'matched_definition') ~ '^-?\d+$' THEN (p.verification_evidence->>'matched_definition')::int ELSE -1 END;
    SELECT * INTO v_cat FROM private.synonym_relation_category_v1(
      coalesce(p.verification_evidence->>'ai_decision', p.decision), p.verification_evidence->>'pattern',
      v_matched >= 0 AND v_matched < v_ndefs,
      (p.verification_evidence->>'substitution_forward')::boolean, (p.verification_evidence->>'substitution_reverse')::boolean,
      (p.verification_evidence->>'same_construction')::boolean,
      CASE WHEN jsonb_typeof(p.verification_evidence->'additional_restriction') = 'boolean' THEN (p.verification_evidence->>'additional_restriction')::boolean END,
      v_ndefs > 0);
    CONTINUE WHEN v_cat.guard IS DISTINCT FROM 'ai_category_contradiction';
    IF p.verification_evidence ? 'reclassified_from' THEN
      -- an old answer reclassified by code: ask the v10 AI (test words now, the rest with the whole base)
      UPDATE public.synonym_pair_v1 SET force_recheck = true, rule_reason = 'stable_v2_contradiction', published = false,
        status = CASE WHEN snapshot->'source'->>'lemma' = ANY (v_test) OR snapshot->'target'->>'lemma' = ANY (v_test) THEN 'queued' ELSE 'retry_wait' END,
        next_attempt_at = CASE WHEN snapshot->'source'->>'lemma' = ANY (v_test) OR snapshot->'target'->>'lemma' = ANY (v_test) THEN next_attempt_at ELSE 'infinity'::timestamptz END,
        lease_token = NULL, lease_until = NULL, updated_at = now()
      WHERE id = p.id;
      IF p.snapshot->'source'->>'lemma' = ANY (v_test) OR p.snapshot->'target'->>'lemma' = ANY (v_test) THEN n_contra_q := n_contra_q + 1;
      ELSE n_contra_park := n_contra_park + 1; END IF;
    ELSE
      UPDATE public.synonym_pair_v1 SET decision = 'needs_manual_review', published = false, updated_at = now(),
        verification_evidence = verification_evidence || jsonb_build_object('guard', 'ai_category_contradiction',
          'decision_before_v2', p.decision)
      WHERE id = p.id;
      n_contra_manual := n_contra_manual + 1;
    END IF;
  END LOOP;

  -- 4. translation fits on stable sense ids; the old text-keyed rows are retired (kept, status failed)
  UPDATE private.synonym_sense_fit_v1 SET status = 'failed', last_error = 'superseded_stable_v2', lease_token = NULL, lease_until = NULL
  WHERE sense_key IS NULL AND status IN ('queued', 'processing');
  GET DIAGNOSTICS n_superseded = ROW_COUNT;
  FOR p IN SELECT * FROM public.synonym_pair_v1 WHERE status = 'done' AND decision = 'verified_synonym' ORDER BY id LOOP
    v_s := private.synonym_pair_senses_v1(p.snapshot, p.source_entity_type, p.source_entity_id, p.target_entity_type,
      p.target_entity_id, p.target_article_key, coalesce(nullif(p.verification_evidence->>'matched_text', ''),
        CASE WHEN (p.verification_evidence->>'matched_definition') ~ '^\d+$'
             THEN p.snapshot->'target'->'definitions_nb'->>((p.verification_evidence->>'matched_definition')::int)
             WHEN (p.verification_evidence->>'matched_definition') !~ '^-?\d+$' THEN p.verification_evidence->>'matched_definition' END));
    IF v_s->>'source_sense_key' IS NULL OR v_s->>'target_sense_key' IS NULL THEN
      UPDATE public.synonym_pair_v1 SET verification_evidence = verification_evidence - 'source_fit_key' - 'target_fit_key'
        || jsonb_build_object('fit_missing', 'sense_text_missing') WHERE id = p.id;
      n_fit_missing := n_fit_missing + 1;
      CONTINUE;
    END IF;
    v_res := public.d10_synonym_fit_request_v1(jsonb_build_array(
      jsonb_build_object('ref', 's', 'entity_type', p.source_entity_type, 'entity_id', p.source_entity_id,
        'sense_key', v_s->>'source_sense_key', 'sense_text', v_s->>'source_sense_text',
        'contexts', coalesce(p.snapshot->'source'->'sense_context'->'group_definitions', '[]'::jsonb)),
      jsonb_build_object('ref', 't', 'entity_type', p.target_entity_type, 'entity_id', p.target_entity_id,
        'sense_key', v_s->>'target_sense_key', 'sense_text', v_s->>'target_sense_text',
        'contexts', jsonb_build_array(v_s->>'target_sense_text'))));
    UPDATE public.synonym_pair_v1 SET verification_evidence = verification_evidence - 'fit_missing'
      || jsonb_build_object('source_fit_key', v_res->0->>'fit_key', 'target_fit_key', v_res->1->>'fit_key',
           'source_sense_key', v_s->>'source_sense_key', 'target_sense_key', v_s->>'target_sense_key', 'fit_v2_at', now())
    WHERE id = p.id;
    n_fit_pairs := n_fit_pairs + 1;
  END LOOP;

  -- 5. publication with the per-sense AND
  FOR p IN SELECT DISTINCT source_entity_type a_t, source_entity_id a_i, target_entity_type b_t, target_entity_id b_i
           FROM public.synonym_pair_v1 WHERE status = 'done' LOOP
    PERFORM public.d10_synonym_publish_link_v1(p.a_t, p.a_i, p.b_t, p.b_i);
  END LOOP;

  INSERT INTO d10_stable2_report VALUES ('04_data', 'pairs', jsonb_build_object('sense_ids_set', n_keys,
    'relation_keys_recomputed', n_rel, 'contradiction_requeued_test_words', n_contra_q,
    'contradiction_parked', n_contra_park, 'contradiction_manual_review', n_contra_manual,
    'verified_pairs_with_fits', n_fit_pairs, 'verified_without_sense', n_fit_missing, 'old_fit_rows_retired', n_superseded));
END
$reclass$;


DO $probe$
DECLARE v_bad int; v_list text;
BEGIN
  -- P1 SQL category rules = the case table of the node test of verifier-core.ts
  SELECT count(*), string_agg(c.i::text || ':' || coalesce(x.final, 'null') || '/' || coalesce(x.guard, 'null'), ', ') INTO v_bad, v_list
  FROM (VALUES
    (0, 'verified_synonym', 'same_meaning', true, true, true, true, false, true, 'verified_synonym', NULL),
    (1, 'verified_synonym', 'same_meaning', true, true, true, true, true, true, 'contextual_synonym', 'code_category'),
    (2, 'verified_synonym', 'same_meaning', true, true, true, true, NULL, true, 'contextual_synonym', 'code_category'),
    (3, 'verified_synonym', 'same_meaning', true, true, true, false, false, true, 'contextual_synonym', 'code_category'),
    (4, 'verified_synonym', 'narrow_context', true, true, true, true, false, true, 'contextual_synonym', 'code_category'),
    (5, 'verified_synonym', 'same_meaning', true, true, false, true, false, true, 'one_way_synonym', 'code_category'),
    (6, 'contextual_synonym', 'broader_or_narrower', true, false, true, true, false, true, 'one_way_synonym', 'code_category'),
    (7, 'contextual_synonym', 'same_meaning', true, true, true, true, false, true, 'needs_manual_review', 'ai_category_contradiction'),
    (8, 'contextual_synonym', 'same_meaning', true, false, false, true, false, true, 'near_synonym', 'code_category'),
    (9, 'near_synonym', 'different_construction', true, false, false, false, true, true, 'near_synonym', NULL),
    (10, 'near_synonym', 'same_meaning', true, true, true, true, false, true, 'needs_manual_review', 'ai_category_contradiction'),
    (11, 'verified_synonym', 'same_meaning', false, true, true, true, false, true, 'needs_manual_review', 'synonym_without_matching_definition'),
    (12, 'verified_synonym', 'target_other_sense', true, true, true, true, false, true, 'needs_manual_review', 'synonym_but_other_sense'),
    (13, 'verified_synonym', 'same_meaning', true, true, true, true, false, false, 'needs_manual_review', 'target_without_sense_evidence'),
    (14, 'rejected', 'insufficient_data', false, false, false, false, true, false, 'needs_manual_review', 'target_without_sense_evidence'),
    (15, 'rejected', 'same_meaning', true, false, false, false, true, true, 'needs_manual_review', 'rejected_but_same_meaning'),
    (16, 'rejected', 'target_other_sense', false, false, false, false, true, true, 'rejected', NULL),
    (17, 'related', 'broader_or_narrower', true, false, false, false, true, true, 'related', NULL),
    (18, 'needs_manual_review', 'insufficient_data', false, false, false, false, true, true, 'needs_manual_review', NULL),
    (19, 'one_way_synonym', 'same_meaning', true, true, true, true, false, true, 'needs_manual_review', 'ai_category_contradiction'),
    (20, 'near_synonym', 'same_meaning', true, true, true, true, true, true, 'needs_manual_review', 'ai_category_contradiction'),
    (21, 'one_way_synonym', 'same_meaning', true, true, true, true, true, true, 'needs_manual_review', 'ai_category_contradiction'),
    (22, 'near_synonym', 'same_meaning', true, true, false, true, false, true, 'needs_manual_review', 'ai_category_contradiction'),
    (23, 'contextual_synonym', 'same_meaning', true, true, false, true, true, true, 'one_way_synonym', 'code_category'),
    (24, 'contextual_synonym', 'same_meaning', true, true, true, true, true, true, 'contextual_synonym', NULL),
    (25, 'one_way_synonym', 'same_meaning', true, false, true, true, false, true, 'one_way_synonym', NULL),
    (26, 'one_way_synonym', 'same_meaning', true, false, false, true, true, true, 'near_synonym', 'code_category'),
    (27, 'contextual_synonym', 'target_other_sense', true, true, true, true, false, true, 'needs_manual_review', 'synonym_but_other_sense')
  ) c(i, ai, pattern, matched_ok, fwd, rev, same, restriction, has_defs, expect, expect_guard)
  CROSS JOIN LATERAL private.synonym_relation_category_v1(c.ai, c.pattern, c.matched_ok, c.fwd, c.rev, c.same, c.restriction, c.has_defs) x
  WHERE x.final IS DISTINCT FROM c.expect OR x.guard IS DISTINCT FROM c.expect_guard;
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P1 category rules differ from the case table: %', v_list; END IF;
  INSERT INTO d10_stable2_report VALUES ('05_probe_category_rules', 'cases', jsonb_build_object('cases', 28, 'mismatches', 0));

  -- P2 every published relation has a publishable pair not contradicted by the reverse pair of the same senses
  SELECT count(*) INTO v_bad FROM public.authoritative_semantic_relations r
  WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym'
    AND NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 p
      WHERE private.synonym_publishable_v1(p)
        AND ((p.source_entity_id = r.source_entity_id AND p.target_entity_id = r.target_entity_id)
          OR (p.source_entity_id = r.target_entity_id AND p.target_entity_id = r.source_entity_id))
        AND NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 q
          WHERE q.status = 'done' AND q.decision IS NOT NULL
            AND q.source_entity_id = p.target_entity_id AND q.target_entity_id = p.source_entity_id
            AND q.verification_evidence->>'source_sense_key' = p.verification_evidence->>'target_sense_key'
            AND q.verification_evidence->>'target_sense_key' = p.verification_evidence->>'source_sense_key'
            AND EXISTS (SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id = q.candidate_id AND c.source_active)
            AND NOT private.synonym_publishable_v1(q)));
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P2 % published relations without an uncontradicted publishable sense pair', v_bad; END IF;

  -- P3 every published relation has its reverse
  SELECT count(*) INTO v_bad FROM public.authoritative_semantic_relations r
  WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym'
    AND NOT EXISTS (SELECT 1 FROM public.authoritative_semantic_relations q
                    WHERE q.source = 'synonym-verifier' AND q.relation_type = 'synonym'
                      AND q.source_entity_id = r.target_entity_id AND q.target_entity_id = r.source_entity_id);
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P3 % published relations without reverse', v_bad; END IF;
  INSERT INTO d10_stable2_report VALUES ('05_probe_publication', 'AND per sense + symmetry', jsonb_build_object('contradicted', 0, 'without_reverse', 0));

  INSERT INTO d10_stable2_report SELECT '06_after', 'decisions', jsonb_object_agg(k, n)
  FROM (SELECT coalesce(decision, '-') || CASE WHEN status <> 'done' THEN ':' || status ELSE '' END k, count(*) n
        FROM public.synonym_pair_v1 GROUP BY 1) z;
  INSERT INTO d10_stable2_report SELECT '06_after', 'sense ids', jsonb_build_object(
    'pairs_with_both', (SELECT count(*) FROM public.synonym_pair_v1 WHERE verification_evidence ? 'source_sense_key' AND verification_evidence ? 'target_sense_key'),
    'source_by_article', (SELECT count(*) FROM public.synonym_pair_v1 WHERE verification_evidence->>'source_sense_key' ~ ':a[0-9]+:'),
    'target_by_article', (SELECT count(*) FROM public.synonym_pair_v1 WHERE verification_evidence->>'target_sense_key' ~ ':a[0-9]+:'));
  INSERT INTO d10_stable2_report SELECT '06_after', 'translation fits', jsonb_build_object(
    'waiting_for_verifier', public.d10_synonym_fit_pending_v1(),
    'by_status', (SELECT jsonb_object_agg(k, n) FROM (SELECT status || CASE WHEN sense_key IS NULL THEN ':v1' ELSE ':v2' END k, count(*) n
                  FROM private.synonym_sense_fit_v1 GROUP BY 1) z),
    'published_now', (SELECT count(*) FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier' AND relation_type = 'synonym'));
  INSERT INTO d10_stable2_report SELECT '06_after', 'queue', jsonb_object_agg(k, n)
  FROM (SELECT coalesce(rule_reason, '-') || ':' || status || CASE WHEN next_attempt_at = 'infinity' THEN ':parked' ELSE '' END k, count(*) n
        FROM public.synonym_pair_v1 WHERE status IN ('queued', 'processing', 'retry_wait') GROUP BY 1) z;
END
$probe$;

SELECT part, name, info FROM d10_stable2_report ORDER BY 1, 2;
