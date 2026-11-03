-- 20261102190000_d10_synonym_stable_v1.sql
-- D10_synonym_stable_v1: honest, repeatable synonym categories.
--  * the AI decides only the RELATION (matched definition, substitution both ways, construction, restriction);
--    the category is set by fixed code rules: verified (clean) / contextual / one_way_synonym (new) / near /
--    related / rejected / needs_manual_review;
--  * translation fit is evaluated ONCE per card+sense (private.synonym_sense_fit_v1): the AI only picks one of
--    the EXISTING pipeline translations (by index) or none; shared by both pair directions and every recheck;
--  * a link is published only if every decided direction between the two entries is publishable (AND);
--  * a recheck with unchanged content keeps its decision without AI; relation answers are reused when only
--    translations/examples changed ('prior');
--  * window sense translations come from the fits (pipeline), the AI sense labels (sense-labels path) are removed
--    (table archived to private, function definitions saved);
--  * decided pairs are reclassified by code from their stored v5..v9 answers; old answers without them -> v10 AI.
-- Requires the v10 synonym-verifier deploy right after this migration (see README). Any STOP -> nothing changed.
-- Rollback: optional/20261102190000_d10_synonym_stable_v1_ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_stable_report;
CREATE TEMP TABLE d10_stable_report(part text, name text, info jsonb);

DO $mig$
DECLARE v_list text; v_def text;
BEGIN
  IF to_regclass('private.synonym_sense_fit_v1') IS NOT NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_stable_v1 already installed'; END IF;
  SELECT string_agg(d.reg || '=' || coalesce(md5(replace(p.prosrc, E'\r', '')), 'MISSING'), ', ') INTO v_list
  FROM (VALUES ('public.d10_synonym_verifier_version_v1()', 'f9fea559f158e1172a7587084dece52b'), ('private.synonym_publishable_v1(public.synonym_pair_v1)', '3879e61bc937ee714ee5066a87285fcf'), ('public.d10_synonym_publish_link_v1(text,uuid,text,uuid)', '658226678e610dde0a1591f1901adcc2'), ('public.d10_synonym_record_decision_v1(uuid,uuid,text,text,numeric,jsonb,text)', '8db28d4ea43fca520a570d96a1e86c80'), ('public.d10_synonym_copy_decisions_v1(text)', '3157fd3b2eab20566bc614c14ba4a647'), ('public.d10_synonym_lease_pairs_v1(integer)', '7fe1e638989d1d2400d5f2aecdeaa8a5'), ('public.get_synonym_carousel_v3(uuid)', '359732ebcd11e21332788f21f9ee3e88'), ('public.d10_synonym_verifier_pending_v1()', '8a147f396f941c7e10bea7e5a85f9095')) d(reg, md5)
  LEFT JOIN pg_proc p ON p.oid = to_regprocedure(d.reg)
  WHERE p.oid IS NULL OR md5(replace(p.prosrc, E'\r', '')) <> d.md5;
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'STOP: base version differs (changed since export 290): %', v_list; END IF;
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
  WHERE conrelid = 'public.synonym_pair_v1'::regclass AND conname = 'synonym_pair_v1_decision_check';
  IF v_def IS DISTINCT FROM $c$CHECK ((decision = ANY (ARRAY['verified_synonym'::text, 'contextual_synonym'::text, 'near_synonym'::text, 'related'::text, 'rejected'::text, 'needs_manual_review'::text])))$c$ THEN RAISE EXCEPTION 'STOP: decision check differs: %', v_def; END IF;
  SELECT string_agg(x, ', ') INTO v_list FROM unnest(ARRAY['public.d10_synonym_sense_labels_enqueue_v1()', 'public.d10_synonym_sense_lease_v1(integer)', 'public.d10_synonym_sense_record_v1(uuid,jsonb,text,text)', 'public.get_synonym_carousel_v2(uuid)']) x WHERE to_regprocedure(x) IS NULL;
  IF v_list IS NOT NULL THEN RAISE EXCEPTION 'STOP: objects to remove not found: %', v_list; END IF;
  IF to_regclass('public.synonym_sense_label_v1') IS NULL THEN RAISE EXCEPTION 'STOP: public.synonym_sense_label_v1 not found'; END IF;
  -- nothing else may use the removed objects
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_list FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog','information_schema')
    AND p.prosrc ~ '(synonym_sense_label_v1|d10_synonym_sense_labels_enqueue_v1|d10_synonym_sense_lease_v1|d10_synonym_sense_record_v1|get_synonym_carousel_v2)'
    AND p.oid NOT IN (to_regprocedure('public.d10_synonym_sense_labels_enqueue_v1()'), to_regprocedure('public.d10_synonym_sense_lease_v1(integer)'), to_regprocedure('public.d10_synonym_sense_record_v1(uuid,jsonb,text,text)'), to_regprocedure('public.get_synonym_carousel_v2(uuid)'));
  SELECT concat_ws(', ', v_list, (SELECT string_agg(schemaname||'.'||viewname, ', ') FROM pg_views WHERE definition ~ 'synonym_sense_label_v1')) INTO v_list;
  IF v_list <> '' THEN RAISE EXCEPTION 'STOP: still used by: %', v_list; END IF;
END
$mig$;

-- backups for rollback
CREATE TABLE private.synonym_pair_v1_backup_d10_stable AS
  SELECT id, status, decision, verifier_version, verification_evidence, published, force_recheck, rule_reason, now() AS saved_at
  FROM public.synonym_pair_v1;
CREATE TABLE private.d10_stable_dropped_functions_v1 AS
  SELECT p.oid::regprocedure::text AS name, pg_get_functiondef(p.oid) AS def, now() AS saved_at
  FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.d10_synonym_sense_labels_enqueue_v1()'), to_regprocedure('public.d10_synonym_sense_lease_v1(integer)'), to_regprocedure('public.d10_synonym_sense_record_v1(uuid,jsonb,text,text)'), to_regprocedure('public.get_synonym_carousel_v2(uuid)'));
REVOKE ALL ON TABLE private.synonym_pair_v1_backup_d10_stable FROM PUBLIC;
REVOKE ALL ON TABLE private.d10_stable_dropped_functions_v1 FROM PUBLIC;
-- the published verifier synonyms as they are now (rollback restores exactly these rows)
CREATE TABLE private.synonym_relations_backup_d10_stable AS
  SELECT * FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier';
REVOKE ALL ON TABLE private.synonym_relations_backup_d10_stable FROM PUBLIC;

-- pipeline translation string -> list (split on , ; /), trimmed, de-duplicated, order kept
CREATE FUNCTION private.synonym_tr_list_v1(p text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $f$
  SELECT coalesce(array_agg(t ORDER BY o), '{}'::text[])
  FROM (SELECT DISTINCT ON (lower(t)) t, o
        FROM (SELECT btrim(s.t) t, s.o FROM regexp_split_to_table(coalesce(p, ''), '\s*[,;/]\s*') WITH ORDINALITY s(t, o)) z
        WHERE t <> '' ORDER BY lower(t), o) w;
$f$;

-- canonical pipeline translations of the card behind an entity: {"uk":[..],"en":[..]}
CREATE FUNCTION private.synonym_card_translations_v1(p_type text, p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  WITH card AS (SELECT CASE WHEN p_type = 'expression' THEN (SELECT x.lexeme_id FROM public.expression_catalog x WHERE x.id = p_id) ELSE p_id END AS id),
  tr AS (SELECT t.language_code, string_agg(t.translation, ', ') AS s
         FROM card, public.get_canonical_lexeme_translations_v1(CASE WHEN card.id IS NULL THEN '{}'::uuid[] ELSE ARRAY[card.id] END) t
         GROUP BY t.language_code)
  SELECT jsonb_build_object(
    'uk', to_jsonb(private.synonym_tr_list_v1((SELECT s FROM tr WHERE language_code = 'uk'))),
    'en', to_jsonb(private.synonym_tr_list_v1((SELECT s FROM tr WHERE language_code = 'en'))),
    'card', (SELECT id FROM card));
$f$;

-- what the RELATION decision depends on (no translations, no examples)
CREATE FUNCTION private.synonym_relation_key_v1(p_snapshot jsonb, p_target uuid, p_article text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $f$
  SELECT md5(jsonb_build_object('contract', 'relation-v1',
    's_type', p_snapshot->'source'->'entity_type', 's_id', p_snapshot->'source'->'entity_id',
    's_lemma', p_snapshot->'source'->'lemma', 's_pos', p_snapshot->'source'->'part_of_speech',
    's_def', p_snapshot->'source'->'definition_nb', 's_focus', p_snapshot->'source'->'sense_context'->'focus_gloss',
    's_group', p_snapshot->'source'->'sense_context'->'group_definitions',
    't_id', p_target, 't_lemma', p_snapshot->'target'->'lemma', 't_pos', p_snapshot->'target'->'part_of_speech',
    't_defs', p_snapshot->'target'->'definitions_nb', 't_article', p_snapshot->'target'->'article_id',
    'article', p_article)::text);
$f$;

-- category by fixed code rules (mirror of applyGuards v10 in verifier-core.ts)
CREATE FUNCTION private.synonym_relation_category_v1(p_ai text, p_pattern text, p_matched_ok boolean,
  p_fwd boolean, p_rev boolean, p_same boolean, p_restriction boolean, p_has_definitions boolean)
RETURNS TABLE(final text, guard text) LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $f$
  SELECT x.final, CASE WHEN x.guard IS NOT NULL THEN x.guard WHEN x.final IS DISTINCT FROM p_ai THEN 'code_category' END
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
    END AS guard) x;
$f$;

CREATE TABLE private.synonym_sense_fit_v1 (
  fit_key text PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('lexeme','expression')),
  entity_id uuid NOT NULL,
  card_lexeme_id uuid,
  lemma text,
  part_of_speech text,
  sense_text text NOT NULL,
  contexts jsonb NOT NULL DEFAULT '[]'::jsonb,
  tr_uk text[] NOT NULL,
  tr_en text[] NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed')),
  fit text CHECK (fit IN ('match','no_match')),
  chosen_uk text,
  chosen_en text,
  model text,
  prompt_version text,
  attempts integer NOT NULL DEFAULT 0,
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (fit IS DISTINCT FROM 'match' OR (chosen_uk = ANY (tr_uk) AND chosen_en = ANY (tr_en)))
);
CREATE INDEX synonym_sense_fit_v1_status_idx ON private.synonym_sense_fit_v1 (status, created_at);
CREATE INDEX synonym_sense_fit_v1_entity_idx ON private.synonym_sense_fit_v1 (entity_type, entity_id);
COMMENT ON TABLE private.synonym_sense_fit_v1 IS
  'D10_synonym_stable_v1: which EXISTING pipeline translation of a card expresses one sense of it (or none). One evaluation per card+sense+translations, shared by both pair directions and all rechecks.';

CREATE TABLE private.synonym_sense_fit_events_v1 (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fit_key text NOT NULL,
  event text NOT NULL,
  after_row jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX synonym_sense_fit_events_v1_key_idx ON private.synonym_sense_fit_events_v1 (fit_key, id);
REVOKE ALL ON TABLE private.synonym_sense_fit_v1 FROM PUBLIC;
REVOKE ALL ON TABLE private.synonym_sense_fit_events_v1 FROM PUBLIC;

-- key: entity + normalized sense text + the translation lists offered
CREATE FUNCTION private.synonym_fit_key_v1(p_type text, p_id uuid, p_sense text, p_tr jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $f$
  SELECT md5(jsonb_build_array('fit-v1', p_type, p_id, lower(btrim(regexp_replace(coalesce(p_sense, ''), '\s+', ' ', 'g'))),
                               p_tr->'uk', p_tr->'en')::text);
$f$;

-- items: [{ref, entity_type, entity_id, sense_text, contexts}] -> [{ref, fit_key, status, fit, chosen_uk, chosen_en}]
-- New card+sense rows are created 'queued'; a card without uk or en pipeline translations is decided at once (no_match, no AI).
CREATE FUNCTION public.d10_synonym_fit_request_v1(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE r jsonb; v_tr jsonb; v_key text; v_out jsonb := '[]'::jsonb; v_row private.synonym_sense_fit_v1%rowtype;
  v_type text; v_id uuid; v_sense text; v_lemma text; v_pos text;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) LOOP
    v_type := r->>'entity_type'; v_id := (r->>'entity_id')::uuid; v_sense := btrim(coalesce(r->>'sense_text', ''));
    IF v_type NOT IN ('lexeme','expression') OR v_id IS NULL OR v_sense = '' THEN
      v_out := v_out || jsonb_build_array(jsonb_build_object('ref', r->'ref', 'error', 'invalid_item'));
      CONTINUE;
    END IF;
    v_tr := private.synonym_card_translations_v1(v_type, v_id);
    v_key := private.synonym_fit_key_v1(v_type, v_id, v_sense, v_tr);
    IF v_type = 'expression' THEN SELECT x.lemma, 'expression' INTO v_lemma, v_pos FROM public.expression_catalog x WHERE x.id = v_id;
    ELSE SELECT l.lemma, l.pos INTO v_lemma, v_pos FROM public.lexemes l WHERE l.id = v_id; END IF;
    INSERT INTO private.synonym_sense_fit_v1 (fit_key, entity_type, entity_id, card_lexeme_id, lemma, part_of_speech, sense_text,
      contexts, tr_uk, tr_en, status, fit, decided_at, prompt_version)
    SELECT v_key, v_type, v_id, (v_tr->>'card')::uuid, v_lemma, v_pos, v_sense,
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
    v_out := v_out || jsonb_build_array(jsonb_build_object('ref', r->'ref', 'fit_key', v_key, 'status', v_row.status,
      'fit', v_row.fit, 'chosen_uk', v_row.chosen_uk, 'chosen_en', v_row.chosen_en));
  END LOOP;
  RETURN v_out;
END
$f$;

-- lease rows to evaluate: the given keys, or (p_keys NULL) the oldest waiting ones
CREATE FUNCTION public.d10_synonym_fit_lease_v1(p_keys text[], p_limit integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE v_token uuid := gen_random_uuid(); v_rows jsonb; v_cfg public.synonym_verifier_config_v1%rowtype;
BEGIN
  -- the same switch and model as the pair verifier
  SELECT * INTO STRICT v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  IF NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok', true, 'rows', '[]'::jsonb, 'reason', 'disabled'); END IF;
  UPDATE private.synonym_sense_fit_v1 SET status = 'failed', last_error = coalesce(last_error, 'lease_attempts_exhausted'),
    lease_token = NULL, lease_until = NULL
  WHERE status = 'processing' AND lease_until <= now() AND attempts >= 3;
  WITH picked AS (
    SELECT f.fit_key FROM private.synonym_sense_fit_v1 f
    WHERE (f.status = 'queued' OR (f.status = 'processing' AND f.lease_until <= now()))
      AND (p_keys IS NULL OR f.fit_key = ANY (p_keys))
    ORDER BY f.created_at, f.fit_key
    LIMIT least(greatest(coalesce(p_limit, 20), 1), 40)
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE private.synonym_sense_fit_v1 f SET status = 'processing', lease_token = v_token,
      lease_until = now() + interval '180 seconds', attempts = f.attempts + 1
    FROM picked WHERE f.fit_key = picked.fit_key
    RETURNING f.fit_key, f.lemma, f.part_of_speech, f.sense_text, f.contexts, f.tr_uk, f.tr_en
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('fit_key', fit_key, 'lemma', lemma, 'part_of_speech', part_of_speech,
    'sense', sense_text, 'contexts', contexts, 'tr_uk', to_jsonb(tr_uk), 'tr_en', to_jsonb(tr_en)) ORDER BY fit_key), '[]'::jsonb)
  INTO v_rows FROM upd;
  RETURN jsonb_build_object('ok', true, 'lease_token', CASE WHEN jsonb_array_length(v_rows) > 0 THEN v_token END, 'rows', v_rows,
    'model', v_cfg.model);
END
$f$;

-- rows: [{fit_key, uk_index, en_index}] (index into tr_uk / tr_en, -1 = none). The chosen translation is taken
-- from the stored list by index, so nothing outside the pipeline list can be written. Match = both languages chosen.
-- Leased rows without a valid answer go back to the queue. Pairs that use the recorded keys are re-published.
CREATE FUNCTION public.d10_synonym_fit_record_v1(p_lease_token uuid, p_rows jsonb, p_model text, p_prompt_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE v_done integer := 0; v_back integer; v_keys text[]; r record; v_pub integer := 0;
BEGIN
  WITH ans AS (
    SELECT a->>'fit_key' AS k, (a->>'uk_index')::int AS ui, (a->>'en_index')::int AS ei
    FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) a
    WHERE (a->>'uk_index') ~ '^-?\d+$' AND (a->>'en_index') ~ '^-?\d+$'
  ), upd AS (
    UPDATE private.synonym_sense_fit_v1 f SET
      status = 'done',
      fit = CASE WHEN ans.ui BETWEEN 0 AND cardinality(f.tr_uk) - 1 AND ans.ei BETWEEN 0 AND cardinality(f.tr_en) - 1
                 THEN 'match' ELSE 'no_match' END,
      chosen_uk = CASE WHEN ans.ui BETWEEN 0 AND cardinality(f.tr_uk) - 1 THEN f.tr_uk[ans.ui + 1] END,
      chosen_en = CASE WHEN ans.ei BETWEEN 0 AND cardinality(f.tr_en) - 1 THEN f.tr_en[ans.ei + 1] END,
      model = p_model, prompt_version = p_prompt_version, decided_at = now(),
      lease_token = NULL, lease_until = NULL, last_error = NULL
    FROM ans
    WHERE f.fit_key = ans.k AND f.lease_token = p_lease_token AND f.status = 'processing'
      AND ans.ui >= -1 AND ans.ei >= -1 AND ans.ui < cardinality(f.tr_uk) AND ans.ei < cardinality(f.tr_en)
    RETURNING f.*
  ), ev AS (
    INSERT INTO private.synonym_sense_fit_events_v1 (fit_key, event, after_row)
    SELECT u.fit_key, 'decided', to_jsonb(u) FROM upd u RETURNING fit_key
  )
  SELECT count(*), array_agg(fit_key) INTO v_done, v_keys FROM ev;

  UPDATE private.synonym_sense_fit_v1 SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
    lease_token = NULL, lease_until = NULL, last_error = 'no valid answer'
  WHERE lease_token = p_lease_token AND status = 'processing';
  GET DIAGNOSTICS v_back = ROW_COUNT;

  IF v_keys IS NOT NULL THEN
    FOR r IN SELECT DISTINCT p.source_entity_type a_t, p.source_entity_id a_i, p.target_entity_type b_t, p.target_entity_id b_i
             FROM public.synonym_pair_v1 p
             WHERE p.status = 'done' AND (p.verification_evidence->>'source_fit_key' = ANY (v_keys)
                                          OR p.verification_evidence->>'target_fit_key' = ANY (v_keys))
    LOOP
      PERFORM public.d10_synonym_publish_link_v1(r.a_t, r.a_i, r.b_t, r.b_i);
      v_pub := v_pub + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('ok', true, 'done', v_done, 'back', v_back, 'links_republished', v_pub);
END
$f$;

CREATE FUNCTION public.d10_synonym_fit_pending_v1()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, private
AS $f$ SELECT count(*)::integer FROM private.synonym_sense_fit_v1 WHERE status IN ('queued','processing'); $f$;

REVOKE ALL ON FUNCTION public.d10_synonym_fit_request_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_fit_lease_v1(text[], integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_fit_record_v1(uuid, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_fit_pending_v1() FROM PUBLIC;
DO $mig$
DECLARE r text; f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.d10_synonym_fit_request_v1(jsonb)', 'public.d10_synonym_fit_lease_v1(text[], integer)',
                           'public.d10_synonym_fit_record_v1(uuid, jsonb, text, text)', 'public.d10_synonym_fit_pending_v1()'] LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', f, r); END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f); END IF;
  END LOOP;
END
$mig$;

ALTER TABLE public.synonym_pair_v1 DROP CONSTRAINT synonym_pair_v1_decision_check,
  ADD CONSTRAINT synonym_pair_v1_decision_check CHECK (decision = ANY (ARRAY['verified_synonym'::text, 'contextual_synonym'::text, 'near_synonym'::text, 'one_way_synonym'::text, 'related'::text, 'rejected'::text, 'needs_manual_review'::text]));

DO $mig$
DECLARE r record; v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_md5 text; v_body text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.d10_synonym_verifier_version_v1()', $h_version$CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_version_v1()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
$h_version$, 'f9fea559f158e1172a7587084dece52b', '8e16238f3c01f398b24661ac9fcd43dd', $b_version$
 SELECT 'ai:synonym_pair_v10:'||model FROM public.synonym_verifier_config_v1 WHERE singleton
$b_version$),
    ('private.synonym_publishable_v1(public.synonym_pair_v1)', $h_publishable$CREATE OR REPLACE FUNCTION private.synonym_publishable_v1(p synonym_pair_v1)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_publishable$, '3879e61bc937ee714ee5066a87285fcf', 'dfdb1136ecaee757d6c5f9a7cb068f3e', $b_publishable$
 -- D10_synonym_stable_v1 (02.11.2026): clean synonym, relation checks true, BOTH translation fits = match
 -- (one evaluation per card+sense, private.synonym_sense_fit_v1), both cards ready. The AI no longer sets
 -- translation flags inside a pair. Dictionary rule decisions (mutual reference) need the fits as well.
 SELECT coalesce(p.status='done' AND p.decision='verified_synonym'
 AND (p.verifier_version LIKE 'rule:%' OR (
       p.verification_evidence->>'substitution_forward'='true'
   AND p.verification_evidence->>'substitution_reverse'='true'
   AND p.verification_evidence->>'same_construction'='true'
   AND p.verification_evidence->>'additional_restriction'='false'))
 AND EXISTS (SELECT 1 FROM private.synonym_sense_fit_v1 f WHERE f.fit_key = p.verification_evidence->>'source_fit_key' AND f.status='done' AND f.fit='match')
 AND EXISTS (SELECT 1 FROM private.synonym_sense_fit_v1 f WHERE f.fit_key = p.verification_evidence->>'target_fit_key' AND f.status='done' AND f.fit='match')
 AND private.synonym_card_ready_v1(p.source_entity_type,p.source_entity_id)
 AND private.synonym_card_ready_v1(p.target_entity_type,p.target_entity_id),false)
$b_publishable$),
    ('public.d10_synonym_publish_link_v1(text,uuid,text,uuid)', $h_publish_link$CREATE OR REPLACE FUNCTION public.d10_synonym_publish_link_v1(p_a_type text, p_a_id uuid, p_b_type text, p_b_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_publish_link$, '658226678e610dde0a1591f1901adcc2', '4fbdcf72bcdd1095f6d709183d8d0e76', $b_publish_link$
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
      OR (p.source_entity_type = p_b_type AND p.source_entity_id = p_b_id AND p.target_entity_type = p_a_type AND p.target_entity_id = p_a_id));

  -- D10_synonym_stable_v1 (02.11.2026): AND over directions. If ANY decided direction between the two
  -- entries (active candidate, visible endpoints) is not publishable, the link is not published at all.
  IF EXISTS (SELECT 1 FROM public.synonym_pair_v1 p
             WHERE p.status = 'done' AND p.decision IS NOT NULL
               AND EXISTS (SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id = p.candidate_id AND c.source_active)
               AND ((p.source_entity_type = p_a_type AND p.source_entity_id = p_a_id AND p.target_entity_type = p_b_type AND p.target_entity_id = p_b_id)
                 OR (p.source_entity_type = p_b_type AND p.source_entity_id = p_b_id AND p.target_entity_type = p_a_type AND p.target_entity_id = p_a_id))
               AND NOT private.synonym_publishable_v1(p)) THEN
    v_pairs := NULL;
  END IF;
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
    ('public.d10_synonym_record_decision_v1(uuid,uuid,text,text,numeric,jsonb,text)', $h_record$CREATE OR REPLACE FUNCTION public.d10_synonym_record_decision_v1(p_pair_id uuid, p_lease_token uuid, p_snapshot_hash text, p_decision text, p_confidence numeric, p_evidence jsonb, p_verifier_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_record$, '8db28d4ea43fca520a570d96a1e86c80', '91286a8affd6870814f1f0b9e3f8b19a', $b_record$
DECLARE
  v_n integer;
  v_p record; v_src_sense text; v_tgt_sense text; v_res jsonb; v_ev jsonb := coalesce(p_evidence, '{}'::jsonb);
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
  -- D10_synonym_stable_v1: a v10 verified decision gets translation-fit requests (card+sense). The sense texts are
  -- taken here, by the same rule as the reclassification (source: focus gloss or NAOB meaning; target: the matched
  -- definition), so one card+sense always gives the same fit key. Without both senses the pair stays unpublishable.
  IF p_decision = 'verified_synonym' AND p_verifier_version LIKE 'ai:synonym_pair_v10:%' THEN
    SELECT p.snapshot, p.source_entity_type, p.source_entity_id, p.target_entity_type, p.target_entity_id INTO v_p
    FROM public.synonym_pair_v1 p
    WHERE p.id = p_pair_id AND p.status = 'processing' AND p.lease_token = p_lease_token
      AND p.snapshot_hash IS NOT DISTINCT FROM p_snapshot_hash;
    IF FOUND THEN
      v_src_sense := coalesce(nullif(btrim(v_p.snapshot->'source'->'sense_context'->>'focus_gloss'), ''),
                              nullif(btrim(v_p.snapshot->'source'->>'definition_nb'), ''));
      v_tgt_sense := nullif(btrim(p_evidence->>'matched_text'), '');
      v_ev := v_ev - 'source_fit_key' - 'target_fit_key';
      IF v_src_sense IS NOT NULL AND v_tgt_sense IS NOT NULL THEN
        v_res := public.d10_synonym_fit_request_v1(jsonb_build_array(
          jsonb_build_object('ref', 's', 'entity_type', v_p.source_entity_type, 'entity_id', v_p.source_entity_id,
            'sense_text', v_src_sense, 'contexts', coalesce(v_p.snapshot->'source'->'sense_context'->'group_definitions', '[]'::jsonb)),
          jsonb_build_object('ref', 't', 'entity_type', v_p.target_entity_type, 'entity_id', v_p.target_entity_id,
            'sense_text', v_tgt_sense, 'contexts', jsonb_build_array(v_tgt_sense))));
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
    ('public.d10_synonym_copy_decisions_v1(text)', $h_copy$CREATE OR REPLACE FUNCTION public.d10_synonym_copy_decisions_v1(p_version text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_copy$, '3157fd3b2eab20566bc614c14ba4a647', '5bad64ecdfb44990a540e2d823cb47dd', $b_copy$
DECLARE v_n integer; v_kept integer;
BEGIN
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
 AND jsonb_typeof(d.verification_evidence->'publication_ready') = 'boolean'
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
$b_copy$),
    ('public.d10_synonym_lease_pairs_v1(integer)', $h_lease$CREATE OR REPLACE FUNCTION public.d10_synonym_lease_pairs_v1(p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_lease$, '7fe1e638989d1d2400d5f2aecdeaa8a5', '0a160942856842a8191d1efebbbc88a1', $b_lease$
DECLARE
  v_cfg public.synonym_verifier_config_v1%rowtype;
  v_used integer;
  v_live integer;
  v_budget integer;
  v_rows jsonb;
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  IF NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok', true, 'pairs', '[]'::jsonb, 'reason', 'disabled'); END IF;
  PERFORM pg_advisory_xact_lock(20261028, 3);
  -- Reserve budget at lease time. A crash or a failed log cannot erase a paid attempt.
  SELECT (SELECT count(*) FROM private.synonym_ai_budget_v1 WHERE reserved_at>now()-interval '24 hours')
   + (SELECT coalesce(sum(pairs),0) FROM public.synonym_verifier_calls_v1
      WHERE created_at>now()-interval '24 hours'
      AND created_at<(SELECT started_at FROM private.synonym_ai_budget_epoch_v1 WHERE singleton))
   INTO v_used;
  v_live:=0;
  UPDATE public.synonym_pair_v1 SET status='failed',last_error='lease_attempts_exhausted',
   lease_token=NULL,lease_until=NULL,updated_at=now()
  WHERE status='processing' AND lease_until<=now() AND attempts>=v_cfg.max_attempts;

 UPDATE public.synonym_pair_v1 p SET status='needs_manual_review',rule_reason='standard_enrichment_not_ready',
 lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE p.status IN ('queued','retry_wait') AND
 (NOT private.synonym_card_ready_v1(p.source_entity_type,p.source_entity_id)
 OR NOT private.synonym_card_ready_v1(p.target_entity_type,p.target_entity_id));
  PERFORM public.d10_synonym_copy_decisions_v1(public.d10_synonym_verifier_version_v1());
  v_budget := greatest(v_cfg.daily_ai_pair_limit - v_used - v_live, 0);
  IF v_budget = 0 THEN
    RETURN jsonb_build_object('ok', true, 'pairs', '[]'::jsonb, 'reason', 'daily_limit', 'used_24h', v_used);
  END IF;

  -- D10 29.10.2026 (agreed, v2): a pair with the same content as a pair that
  -- is already decided gets that decision without AI (copied_from); of several
  -- waiting pairs with the same content only ONE goes to the AI.
  -- v3: decisions are copied only from the CURRENT verifier (model) or the rule

 UPDATE public.synonym_pair_v1 p SET status='needs_manual_review',rule_reason='standard_enrichment_not_ready',
 lease_token=NULL,lease_until=NULL,updated_at=now()
 WHERE p.status IN ('queued','retry_wait') AND
 (NOT private.synonym_card_ready_v1(p.source_entity_type,p.source_entity_id)
 OR NOT private.synonym_card_ready_v1(p.target_entity_type,p.target_entity_id));
  PERFORM public.d10_synonym_copy_decisions_v1(public.d10_synonym_verifier_version_v1());
  WITH due AS (
    SELECT p.id, p.status, p.created_at, public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) AS k
    FROM public.synonym_pair_v1 p
    WHERE p.status = 'queued'
       OR (p.status = 'retry_wait' AND coalesce(p.next_attempt_at, now()) <= now())
       OR (p.status = 'processing' AND p.lease_until <= now())
  ), one_per_content AS (
    SELECT DISTINCT ON (d.k) d.id, d.status, d.created_at FROM due d
    WHERE NOT EXISTS (SELECT 1 FROM public.synonym_pair_v1 o
      WHERE o.status = 'processing' AND o.lease_until > now()
        AND public.d10_synonym_pair_content_key_v1(o.snapshot, o.target_entity_id, o.target_article_key) = d.k)
    ORDER BY d.k, (d.status = 'queued') DESC, d.created_at
  ), picked AS (
    SELECT p.id FROM public.synonym_pair_v1 p JOIN one_per_content c ON c.id = p.id
    ORDER BY (c.status = 'queued') DESC, c.created_at
    LIMIT least(greatest(coalesce(p_limit, v_cfg.pairs_per_call), 1), v_cfg.pairs_per_call, v_budget)
    FOR UPDATE OF p SKIP LOCKED
  ), upd AS (
    UPDATE public.synonym_pair_v1 p
    SET status = 'processing', lease_token = gen_random_uuid(),
        lease_until = now() + make_interval(secs => v_cfg.lease_seconds),
        attempts = p.attempts + 1, updated_at = now()
    FROM picked WHERE p.id = picked.id
    RETURNING p.id, p.lease_token, p.snapshot, p.snapshot_hash, p.attempts,
      public.d10_synonym_pair_content_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) AS content_key,
      private.synonym_relation_key_v1(p.snapshot, p.target_entity_id, p.target_article_key) AS relation_key
  )
  -- D10_synonym_stable_v1 (02.11.2026): 'prior' = the relation answer already given by the CURRENT verifier for
  -- the same relation content (same senses / definitions; translations and examples do not count). The verifier
  -- reuses it instead of asking the AI again; only the translation fit is (re)evaluated.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'lease_token', u.lease_token, 'snapshot', u.snapshot,
    'snapshot_hash', u.snapshot_hash, 'attempts', u.attempts, 'content_key', u.content_key, 'relation_key', u.relation_key,
    'prior', (SELECT d.verification_evidence || jsonb_build_object('confidence', d.confidence, 'prior_pair_id', d.id)
              FROM public.synonym_pair_v1 d
              WHERE d.decision IS NOT NULL AND d.verifier_version = public.d10_synonym_verifier_version_v1()
                AND d.verification_evidence->>'relation_key' = u.relation_key
                AND d.verification_evidence->>'contract' = 'v10'
              ORDER BY d.verified_at DESC NULLS LAST LIMIT 1))), '[]'::jsonb) INTO v_rows FROM upd u;
  INSERT INTO private.synonym_ai_budget_v1(pair_id,lease_token,model)
  SELECT (r->>'id')::uuid,(r->>'lease_token')::uuid,v_cfg.model FROM jsonb_array_elements(v_rows) r;
  RETURN jsonb_build_object('ok', true, 'pairs', v_rows, 'budget_left', v_budget - jsonb_array_length(v_rows),
    'used_24h', v_used, 'model', v_cfg.model, 'verifier_version', public.d10_synonym_verifier_version_v1());
END
$b_lease$),
    ('public.get_synonym_carousel_v3(uuid)', $h_carousel3$CREATE OR REPLACE FUNCTION public.get_synonym_carousel_v3(p_lexeme_id uuid)
 RETURNS TABLE(card_id uuid, lemma text, pos text, decision text, level text, target_entity_type text, target_entity_id uuid, my_sense text, my_sense_key text, my_sense_uk text, my_sense_en text, their_sense text, their_sense_uk text, their_sense_en text, reason text, my_sense_path text, my_sense_ord integer, pair_id uuid, can_replace_opened boolean, can_replace_target boolean, same_construction boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
$h_carousel3$, '359732ebcd11e21332788f21f9ee3e88', '519b02655ea1df2129e14f39c02280fd', $b_carousel3$
WITH me AS (
  SELECT 'lexeme'::text t, p_lexeme_id i WHERE p_lexeme_id IS NOT NULL
  UNION SELECT 'expression', x.id FROM public.expression_catalog x WHERE x.lexeme_id = p_lexeme_id
), oriented AS (
  SELECT x.*, m.t = x.head_type AND m.i = x.head_id AS forward,
    p.verification_evidence e
  FROM private.synonym_stored_pair_sides_v1 x
  
  JOIN public.synonym_pair_v1 p ON p.id=x.pair_id AND p.published
  JOIN me m ON (m.t=x.head_type AND m.i=x.head_id) OR (m.t=x.target_type AND m.i=x.target_id)
  WHERE EXISTS (SELECT 1 FROM public.authoritative_semantic_relations r
    WHERE r.source_entity_type=m.t AND r.source_entity_id=m.i
      AND r.target_entity_type=CASE WHEN m.t=x.head_type AND m.i=x.head_id THEN x.target_type ELSE x.head_type END
      AND r.target_entity_id=CASE WHEN m.t=x.head_type AND m.i=x.head_id THEN x.target_id ELSE x.head_id END
      AND r.relation_type='synonym' AND r.status='verified' AND r.source='synonym-verifier')
), info AS (
  SELECT o.*,
    CASE WHEN forward THEN target_type ELSE head_type END tt,
    CASE WHEN forward THEN target_id ELSE head_id END ti,
    CASE WHEN forward THEN head_lemma ELSE target_lemma END ml,
    CASE WHEN forward THEN head_sense ELSE target_sense END ms,
    CASE WHEN forward THEN head_article ELSE target_article END ma,
    CASE WHEN forward THEN target_lemma ELSE head_lemma END tl,
    CASE WHEN forward THEN head_path ELSE target_path END ms_path,
    CASE WHEN forward THEN head_ord ELSE target_ord END ms_ord,
    CASE WHEN forward THEN target_sense ELSE head_sense END ts,
    CASE WHEN forward THEN e->'substitution_forward' ELSE e->'substitution_reverse' END f,
    CASE WHEN forward THEN e->'substitution_reverse' ELSE e->'substitution_forward' END r
  FROM oriented o
)
SELECT
  card.cid, i.tl, coalesce(l.pos, CASE WHEN i.tt='expression' THEN 'expression' END),
  i.decision, CASE WHEN i.verifier_version LIKE 'rule:%' THEN 'dictionary' ELSE 'ai' END,
  i.tt, i.ti, i.ms,
  coalesce(i.ma::text, 'unknown') || ':' || public.d10_synonym_sense_key_v1(i.ml, i.ms),
  -- D10_synonym_stable_v1: sense translations = the pipeline translation chosen for this card+sense (or NULL)
  mf.chosen_uk, mf.chosen_en, i.ts, tf.chosen_uk, tf.chosen_en, i.reason, sp.sense_path, sp.def_ord, i.pair_id,
  CASE WHEN jsonb_typeof(i.f)='boolean' THEN i.f::text::boolean END,
  CASE WHEN jsonb_typeof(i.r)='boolean' THEN i.r::text::boolean END,
  CASE WHEN jsonb_typeof(i.e->'same_construction')='boolean' THEN (i.e->>'same_construction')::boolean END
FROM info i
CROSS JOIN LATERAL (SELECT CASE WHEN i.tt='lexeme' THEN i.ti
  ELSE (SELECT x.lexeme_id FROM public.expression_catalog x WHERE x.id=i.ti) END cid) card
JOIN public.lexemes l ON l.id=card.cid


LEFT JOIN LATERAL (SELECT i.ms_path sense_path,i.ms_ord def_ord) sp ON true
LEFT JOIN private.synonym_sense_fit_v1 mf ON mf.fit = 'match'
  AND mf.fit_key = i.e->>(CASE WHEN i.forward THEN 'source_fit_key' ELSE 'target_fit_key' END)
LEFT JOIN private.synonym_sense_fit_v1 tf ON tf.fit = 'match'
  AND tf.fit_key = i.e->>(CASE WHEN i.forward THEN 'target_fit_key' ELSE 'source_fit_key' END)
WHERE card.cid <> p_lexeme_id AND l.dictionary_status IS DISTINCT FROM 'excluded'
ORDER BY i.pair_id,card.cid,i.ms;
$b_carousel3$),
    ('public.d10_synonym_verifier_pending_v1()', $h_pending$CREATE OR REPLACE FUNCTION public.d10_synonym_verifier_pending_v1()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_pending$, '8a147f396f941c7e10bea7e5a85f9095', '8920daa481c69b61ab318a363f076f43', $b_pending$
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
       -- D10_synonym_stable_v1 (02.11.2026): translation fits (card+sense) waiting for evaluation
       + (SELECT count(*)::integer FROM private.synonym_sense_fit_v1 f
          WHERE f.status = 'queued' OR (f.status = 'processing' AND f.lease_until <= now()))
       ;
$b_pending$)
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
    INSERT INTO d10_stable_report VALUES ('02_function', r.reg, jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
  END LOOP;
END
$mig$;

-- sense-labels path removed: functions dropped (definitions saved above), table archived to private
DROP FUNCTION public.d10_synonym_sense_labels_enqueue_v1(), public.d10_synonym_sense_lease_v1(integer), public.d10_synonym_sense_record_v1(uuid,jsonb,text,text), public.get_synonym_carousel_v2(uuid);
ALTER TABLE public.synonym_sense_label_v1 RENAME TO synonym_sense_label_v1_archived_d10;
ALTER TABLE public.synonym_sense_label_v1_archived_d10 SET SCHEMA private;
REVOKE ALL ON TABLE private.synonym_sense_label_v1_archived_d10 FROM PUBLIC;
INSERT INTO d10_stable_report SELECT '03_removed', name, jsonb_build_object('saved', true) FROM private.d10_stable_dropped_functions_v1;
INSERT INTO d10_stable_report VALUES ('03_removed', 'public.synonym_sense_label_v1',
  jsonb_build_object('archived_as', 'private.synonym_sense_label_v1_archived_d10', 'rows', (SELECT count(*) FROM private.synonym_sense_label_v1_archived_d10)));

INSERT INTO d10_stable_report SELECT '01_before', 'published', jsonb_build_object(
  'published_pairs', (SELECT count(*) FROM public.synonym_pair_v1 WHERE published),
  'verifier_relations', (SELECT count(*) FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier' AND relation_type = 'synonym'));

-- Reclassify DECIDED pairs (status done) by the code rules, using the relation answers already stored (v5..v9:
-- substitution_forward / substitution_reverse / same_construction booleans). No AI for the relation.
-- verified_synonym results get translation-fit requests (card+sense); publication waits for those fits.
-- Pairs without stored booleans (old AI versions) go back to the queue for the v10 verifier.
DO $reclass$
DECLARE
  p record; v_new record; v_ndefs int; v_matched int; v_items jsonb; v_res jsonb; v_src_key text; v_tgt_key text;
  v_ver text := public.d10_synonym_verifier_version_v1(); v_src_sense text; v_tgt_sense text;
  n_reclass int := 0; n_requeued int := 0; n_rule int := 0;
BEGIN
  FOR p IN SELECT * FROM public.synonym_pair_v1
           WHERE status = 'done' AND decision IS NOT NULL ORDER BY id LOOP
    v_ndefs := CASE WHEN jsonb_typeof(p.snapshot->'target'->'definitions_nb') = 'array' THEN jsonb_array_length(p.snapshot->'target'->'definitions_nb') ELSE 0 END;
    v_src_sense := coalesce(nullif(btrim(p.snapshot->'source'->'sense_context'->>'focus_gloss'), ''), nullif(btrim(p.snapshot->'source'->>'definition_nb'), ''));

    IF p.verifier_version LIKE 'rule:%' THEN
      -- dictionary decision stays; it gets the translation fits it now needs for publication
      v_tgt_sense := nullif(btrim(p.verification_evidence->>'matched_definition'), '');
      IF p.decision = 'verified_synonym' AND v_src_sense IS NOT NULL AND v_tgt_sense IS NOT NULL THEN
        v_res := public.d10_synonym_fit_request_v1(jsonb_build_array(
          jsonb_build_object('ref', 's', 'entity_type', p.source_entity_type, 'entity_id', p.source_entity_id, 'sense_text', v_src_sense,
                             'contexts', coalesce(p.snapshot->'source'->'sense_context'->'group_definitions', '[]'::jsonb)),
          jsonb_build_object('ref', 't', 'entity_type', p.target_entity_type, 'entity_id', p.target_entity_id, 'sense_text', v_tgt_sense,
                             'contexts', jsonb_build_array(v_tgt_sense))));
        UPDATE public.synonym_pair_v1 SET verification_evidence = verification_evidence || jsonb_build_object(
            'source_fit_key', v_res->0->>'fit_key', 'target_fit_key', v_res->1->>'fit_key', 'fit_added_at', now()),
          updated_at = now()
        WHERE id = p.id;
        n_rule := n_rule + 1;
      END IF;
      CONTINUE;
    END IF;

    IF p.verifier_version NOT LIKE 'ai:%' THEN CONTINUE; END IF;

    IF jsonb_typeof(p.verification_evidence->'substitution_forward') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p.verification_evidence->'substitution_reverse') IS DISTINCT FROM 'boolean'
       OR jsonb_typeof(p.verification_evidence->'same_construction') IS DISTINCT FROM 'boolean' THEN
      UPDATE public.synonym_pair_v1 SET status = 'queued', force_recheck = true, rule_reason = 'stable_v1_needs_ai',
        published = false, lease_token = NULL, lease_until = NULL, updated_at = now()
      WHERE id = p.id;
      n_requeued := n_requeued + 1;
      CONTINUE;
    END IF;

    v_matched := CASE WHEN (p.verification_evidence->>'matched_definition') ~ '^-?\d+$' THEN (p.verification_evidence->>'matched_definition')::int ELSE -1 END;
    -- answers before v9 never checked the additional restriction: if everything else says "clean", the clean
    -- category cannot be proven from stored data -> ask the v10 verifier instead of guessing either way
    IF jsonb_typeof(p.verification_evidence->'additional_restriction') IS DISTINCT FROM 'boolean'
       AND (p.verification_evidence->>'substitution_forward')::boolean AND (p.verification_evidence->>'substitution_reverse')::boolean
       AND (p.verification_evidence->>'same_construction')::boolean AND p.verification_evidence->>'pattern' = 'same_meaning'
       AND v_matched >= 0 AND v_matched < v_ndefs THEN
      UPDATE public.synonym_pair_v1 SET status = 'queued', force_recheck = true, rule_reason = 'stable_v1_restriction_unknown',
        published = false, lease_token = NULL, lease_until = NULL, updated_at = now()
      WHERE id = p.id;
      n_requeued := n_requeued + 1;
      CONTINUE;
    END IF;
    SELECT * INTO v_new FROM private.synonym_relation_category_v1(
      coalesce(p.verification_evidence->>'ai_decision', p.decision), p.verification_evidence->>'pattern',
      v_matched >= 0 AND v_matched < v_ndefs,
      (p.verification_evidence->>'substitution_forward')::boolean, (p.verification_evidence->>'substitution_reverse')::boolean,
      (p.verification_evidence->>'same_construction')::boolean,
      CASE WHEN jsonb_typeof(p.verification_evidence->'additional_restriction') = 'boolean'
           THEN (p.verification_evidence->>'additional_restriction')::boolean ELSE true END,
      v_ndefs > 0);

    v_src_key := NULL; v_tgt_key := NULL;
    IF v_new.final = 'verified_synonym' THEN
      v_tgt_sense := nullif(btrim(coalesce(p.verification_evidence->>'matched_text', p.snapshot->'target'->'definitions_nb'->>v_matched)), '');
      IF v_src_sense IS NOT NULL AND v_tgt_sense IS NOT NULL THEN
        v_res := public.d10_synonym_fit_request_v1(jsonb_build_array(
          jsonb_build_object('ref', 's', 'entity_type', p.source_entity_type, 'entity_id', p.source_entity_id, 'sense_text', v_src_sense,
                             'contexts', coalesce(p.snapshot->'source'->'sense_context'->'group_definitions', '[]'::jsonb)),
          jsonb_build_object('ref', 't', 'entity_type', p.target_entity_type, 'entity_id', p.target_entity_id, 'sense_text', v_tgt_sense,
                             'contexts', jsonb_build_array(v_tgt_sense))));
        v_src_key := v_res->0->>'fit_key'; v_tgt_key := v_res->1->>'fit_key';
      END IF;
    END IF;

    UPDATE public.synonym_pair_v1 SET
      decision = CASE WHEN v_new.final = 'verified_synonym' AND (v_src_key IS NULL OR v_tgt_key IS NULL) THEN 'needs_manual_review' ELSE v_new.final END,
      verifier_version = v_ver,
      verification_evidence = (verification_evidence - 'source_translation_matches' - 'target_translation_matches' - 'publication_ready')
        || jsonb_build_object('contract', 'v10', 'reclassified_from', p.verifier_version, 'reclassified_decision_from', p.decision,
             'reclassified_at', now(), 'guard', v_new.guard,
             'direction', CASE WHEN v_new.final = 'one_way_synonym' THEN
                CASE WHEN (verification_evidence->>'substitution_forward')::boolean THEN 'target_replaces_source' ELSE 'source_replaces_target' END END,
             'source_fit_key', v_src_key, 'target_fit_key', v_tgt_key,
             'relation_key', private.synonym_relation_key_v1(snapshot, target_entity_id, target_article_key),
             'decided_content_key', public.d10_synonym_pair_content_key_v1(snapshot, target_entity_id, target_article_key)),
      published = false, updated_at = now()
    WHERE id = p.id;
    n_reclass := n_reclass + 1;
  END LOOP;
  INSERT INTO d10_stable_report VALUES ('04_reclassified', 'pairs', jsonb_build_object(
    'reclassified_by_code', n_reclass, 'requeued_for_ai_v10', n_requeued, 'rule_pairs_with_fits', n_rule));
END
$reclass$;


-- Probes (read-only checks)
DO $probe$
DECLARE v_bad int; v_list text;
BEGIN
  -- P1 SQL category rules = the case table shared with the node test of verifier-core.ts
  SELECT count(*), string_agg(c.i::text || ':' || coalesce(x.final, 'null') || '/' || coalesce(x.guard, 'null'), ', ') INTO v_bad, v_list
  FROM (VALUES
    (0, 'verified_synonym', 'same_meaning', true, true, true, true, false, true, 'verified_synonym', NULL),
    (1, 'verified_synonym', 'same_meaning', true, true, true, true, true, true, 'contextual_synonym', 'code_category'),
    (2, 'verified_synonym', 'same_meaning', true, true, true, true, NULL, true, 'contextual_synonym', 'code_category'),
    (3, 'verified_synonym', 'same_meaning', true, true, true, false, false, true, 'contextual_synonym', 'code_category'),
    (4, 'verified_synonym', 'narrow_context', true, true, true, true, false, true, 'contextual_synonym', 'code_category'),
    (5, 'verified_synonym', 'same_meaning', true, true, false, true, false, true, 'one_way_synonym', 'code_category'),
    (6, 'contextual_synonym', 'broader_or_narrower', true, false, true, true, false, true, 'one_way_synonym', 'code_category'),
    (7, 'contextual_synonym', 'same_meaning', true, true, true, true, false, true, 'verified_synonym', 'code_category'),
    (8, 'contextual_synonym', 'same_meaning', true, false, false, true, false, true, 'near_synonym', 'code_category'),
    (9, 'near_synonym', 'different_construction', true, false, false, false, true, true, 'near_synonym', NULL),
    (10, 'near_synonym', 'same_meaning', true, true, true, true, false, true, 'verified_synonym', 'code_category'),
    (11, 'verified_synonym', 'same_meaning', false, true, true, true, false, true, 'needs_manual_review', 'synonym_without_matching_definition'),
    (12, 'verified_synonym', 'target_other_sense', true, true, true, true, false, true, 'needs_manual_review', 'synonym_but_other_sense'),
    (13, 'verified_synonym', 'same_meaning', true, true, true, true, false, false, 'needs_manual_review', 'target_without_sense_evidence'),
    (14, 'rejected', 'insufficient_data', false, false, false, false, true, false, 'needs_manual_review', 'target_without_sense_evidence'),
    (15, 'rejected', 'same_meaning', true, false, false, false, true, true, 'needs_manual_review', 'rejected_but_same_meaning'),
    (16, 'rejected', 'target_other_sense', false, false, false, false, true, true, 'rejected', NULL),
    (17, 'related', 'broader_or_narrower', true, false, false, false, true, true, 'related', NULL),
    (18, 'needs_manual_review', 'insufficient_data', false, false, false, false, true, true, 'needs_manual_review', NULL),
    (19, 'one_way_synonym', 'same_meaning', true, true, true, true, false, true, 'verified_synonym', 'code_category')
  ) c(i, ai, pattern, matched_ok, fwd, rev, same, restriction, has_defs, expect, expect_guard)
  CROSS JOIN LATERAL private.synonym_relation_category_v1(c.ai, c.pattern, c.matched_ok, c.fwd, c.rev, c.same, c.restriction, c.has_defs) x
  WHERE x.final IS DISTINCT FROM c.expect OR x.guard IS DISTINCT FROM c.expect_guard;
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P1 category rules differ from the shared case table: %', v_list; END IF;
  INSERT INTO d10_stable_report VALUES ('05_probe_category_rules', 'cases', jsonb_build_object('cases', 20, 'mismatches', 0));

  -- P2 no published link while a decided direction between the same entries is not publishable (AND)
  SELECT count(*) INTO v_bad FROM public.authoritative_semantic_relations r
  WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym'
    AND EXISTS (SELECT 1 FROM public.synonym_pair_v1 p
                WHERE p.status = 'done' AND p.decision IS NOT NULL
                  AND EXISTS (SELECT 1 FROM public.synonym_candidate_queue c WHERE c.id = p.candidate_id AND c.source_active)
                  AND ((p.source_entity_id = r.source_entity_id AND p.target_entity_id = r.target_entity_id)
                    OR (p.source_entity_id = r.target_entity_id AND p.target_entity_id = r.source_entity_id))
                  AND NOT private.synonym_publishable_v1(p));
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P2 % published relations contradicted by a decided direction', v_bad; END IF;

  -- P3 every published relation has its reverse
  SELECT count(*) INTO v_bad FROM public.authoritative_semantic_relations r
  WHERE r.source = 'synonym-verifier' AND r.relation_type = 'synonym'
    AND NOT EXISTS (SELECT 1 FROM public.authoritative_semantic_relations q
                    WHERE q.source = 'synonym-verifier' AND q.relation_type = 'synonym'
                      AND q.source_entity_id = r.target_entity_id AND q.target_entity_id = r.source_entity_id);
  IF v_bad > 0 THEN RAISE EXCEPTION 'STOP: probe P3 % published relations without reverse', v_bad; END IF;
  INSERT INTO d10_stable_report VALUES ('05_probe_publication', 'AND + symmetry', jsonb_build_object('contradicted', 0, 'without_reverse', 0));

  INSERT INTO d10_stable_report SELECT '06_after', 'decisions', jsonb_object_agg(k, n)
  FROM (SELECT coalesce(decision, '-') || CASE WHEN status <> 'done' THEN ':' || status ELSE '' END k, count(*) n
        FROM public.synonym_pair_v1 GROUP BY 1) z;
  INSERT INTO d10_stable_report SELECT '06_after', 'transitions (old -> new)', jsonb_object_agg(k, n)
  FROM (SELECT (verification_evidence->>'reclassified_decision_from') || ' -> ' || decision k, count(*) n
        FROM public.synonym_pair_v1 WHERE verification_evidence ? 'reclassified_from' GROUP BY 1) z;
  INSERT INTO d10_stable_report SELECT '06_after', 'translation fits', jsonb_build_object(
    'waiting_for_verifier', public.d10_synonym_fit_pending_v1(),
    'decided_without_ai', (SELECT count(*) FROM private.synonym_sense_fit_v1 WHERE status = 'done'),
    'published_now', (SELECT count(*) FROM public.authoritative_semantic_relations WHERE source = 'synonym-verifier' AND relation_type = 'synonym'));
END
$probe$;

SELECT part, name, info FROM d10_stable_report ORDER BY 1, 2;
