-- 20261102260000_d10_synonym_eval_v1.sql
-- D10_synonym_eval_v1 (agreed 02.11.2026): test harness for the relation check v11 and the translation check
-- sense_fit_v2, plus cost limits for the extra AI checks. Production decisions and publication do NOT change:
-- the verifier keeps v10 / sense_fit_v1; v11 / sense_fit_v2 run only in the eval mode ({"mode":"eval"}), whose
-- results go to private.synonym_eval_result_v1.
--  * synonym_verifier_config_v1: daily_ai_fit_limit (translation-fit rows per 24 h, default 400) and
--    daily_eval_call_limit (eval AI calls per 24 h, default 20); usage in private.synonym_ai_extra_budget_v1;
--  * d10_synonym_fit_lease_v1 respects daily_ai_fit_limit;
--  * private.synonym_target_senses_v1 / synonym_sense_examples_v1: target senses with sense group and examples;
--  * test cases private.synonym_eval_case_v1 (3 known errors, 7 correct pairs, 5 negatives) and RPCs
--    d10_synonym_eval_start_v1 / _cases_v1 / _record_v1 (service role only).
-- Guards: md5 of d10_synonym_fit_lease_v1; reinstall -> STOP. Rollback: optional/..._ROLLBACK.sql

DROP TABLE IF EXISTS pg_temp.d10_eval_report;
CREATE TEMP TABLE d10_eval_report(part text, name text, info jsonb);
DO $mig$
BEGIN
  IF to_regclass('private.synonym_eval_case_v1') IS NOT NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_eval_v1 already installed'; END IF;
  IF to_regprocedure('private.synonym_render_quote_v1(jsonb)') IS NULL THEN RAISE EXCEPTION 'STOP: private.synonym_render_quote_v1(jsonb) not found'; END IF;
END
$mig$;

-- examples of one sense (definition node at a path) of an Ordbokene article; same traversal as
-- public.d10_synonym_source_context_v1, for any path
CREATE OR REPLACE FUNCTION private.synonym_sense_examples_v1(p_article bigint, p_path text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE payload jsonb; nodes jsonb[]; paths text[] := ARRAY['']; node jsonb; child jsonb; path text; d integer; k integer;
  i integer; n integer; guard integer := 0; examples jsonb;
BEGIN
  SELECT a.payload INTO payload FROM public.ordbokene_article_cache a
  WHERE a.article_id = p_article AND lower(a.dictionary_code) = 'bm' ORDER BY a.updated_at DESC LIMIT 1;
  IF payload IS NULL THEN RETURN '[]'::jsonb; END IF;
  nodes := ARRAY[coalesce(payload->'body'->'definitions', '[]'::jsonb)];
  WHILE coalesce(array_length(nodes, 1), 0) > 0 AND guard < 4000 LOOP
    guard := guard + 1; n := array_length(nodes, 1); node := nodes[n]; path := paths[n];
    nodes := nodes[1:n-1]; paths := paths[1:n-1];
    IF jsonb_typeof(node) = 'array' THEN
      SELECT count(*) INTO d FROM jsonb_array_elements(node) e WHERE e->>'type_' = 'definition'; k := d + 1;
      FOR i IN REVERSE jsonb_array_length(node) - 1 .. 0 LOOP
        child := node->i;
        IF child->>'type_' = 'definition' THEN
          k := k - 1; nodes := nodes || child;
          paths := paths || CASE WHEN d = 1 THEN path WHEN path = '' THEN k::text ELSE path || '.' || k END;
        ELSE nodes := nodes || child; paths := paths || path; END IF;
      END LOOP;
      CONTINUE;
    END IF;
    IF jsonb_typeof(node) <> 'object' OR node->>'type_' IN ('sub_article', 'example') THEN CONTINUE; END IF;
    IF node->>'type_' = 'definition' AND path = coalesce(p_path, '') THEN
      SELECT coalesce(jsonb_agg(q.txt ORDER BY q.ord), '[]'::jsonb) INTO examples FROM (
        SELECT private.synonym_render_quote_v1(e->'quote') txt, ord
        FROM jsonb_array_elements(coalesce(node->'elements', '[]'::jsonb)) WITH ORDINALITY a(e, ord)
        WHERE e->>'type_' = 'example' AND nullif(e->'quote'->>'content', '') IS NOT NULL
          AND private.synonym_render_quote_v1(e->'quote') IS NOT NULL ORDER BY ord LIMIT 6) q;
      RETURN examples;
    END IF;
    child := coalesce(node->'elements', node->'definitions');
    IF child IS NOT NULL THEN nodes := nodes || child; paths := paths || path; END IF;
  END LOOP;
  RETURN '[]'::jsonb;
END
$f$;

-- the target definitions of a pair as senses: for each definition n its sense group (all explanations of the same
-- sense path) and that sense's examples; definitions not found in the article keep only their text
CREATE OR REPLACE FUNCTION private.synonym_target_senses_v1(p_article bigint, p_defs jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  WITH a AS (SELECT k.payload FROM public.ordbokene_article_cache k
             WHERE p_article IS NOT NULL AND k.article_id = p_article AND lower(k.dictionary_code) = 'bm'
             ORDER BY k.updated_at DESC LIMIT 1),
  paths AS (SELECT x.sense_path, x.def_ord, x.txt FROM a CROSS JOIN LATERAL public.d10_synonym_target_paths_v1(a.payload) x),
  defs AS (SELECT (o - 1)::int AS n, btrim(d) AS txt FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(p_defs) = 'array' THEN p_defs ELSE '[]'::jsonb END) WITH ORDINALITY t(d, o)),
  m AS (SELECT d.n, d.txt, (SELECT p.sense_path FROM paths p WHERE p.txt = d.txt ORDER BY p.def_ord LIMIT 1) AS path FROM defs d)
  SELECT coalesce(jsonb_agg(jsonb_build_object('n', m.n, 'text', m.txt, 'path', m.path,
    'group', CASE WHEN m.path IS NULL THEN '[]'::jsonb ELSE (SELECT coalesce(jsonb_agg(p.txt ORDER BY p.def_ord), '[]'::jsonb) FROM paths p WHERE p.sense_path = m.path) END,
    'examples', CASE WHEN m.path IS NULL THEN '[]'::jsonb ELSE private.synonym_sense_examples_v1(p_article, m.path) END) ORDER BY m.n), '[]'::jsonb)
  FROM m;
$f$;
REVOKE ALL ON FUNCTION private.synonym_sense_examples_v1(bigint, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.synonym_target_senses_v1(bigint, jsonb) FROM PUBLIC;

-- D10_synonym_eval_v1: cost limits for the extra AI checks and the test harness for v11 / sense_fit_v2
ALTER TABLE public.synonym_verifier_config_v1
  ADD COLUMN daily_ai_fit_limit integer NOT NULL DEFAULT 400 CHECK (daily_ai_fit_limit BETWEEN 0 AND 5000),
  ADD COLUMN daily_eval_call_limit integer NOT NULL DEFAULT 20 CHECK (daily_eval_call_limit BETWEEN 0 AND 200);

CREATE TABLE private.synonym_ai_extra_budget_v1 (
  id bigserial PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('fit', 'eval')), units integer NOT NULL CHECK (units > 0),
  ref text, reserved_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX synonym_ai_extra_budget_v1_idx ON private.synonym_ai_extra_budget_v1 (kind, reserved_at);
REVOKE ALL ON TABLE private.synonym_ai_extra_budget_v1 FROM PUBLIC;

CREATE TABLE private.synonym_eval_case_v1 (
  case_id text PRIMARY KEY, label text NOT NULL, source_lemma text NOT NULL, target_lemma text NOT NULL,
  expected text NOT NULL, note text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE private.synonym_eval_run_v1 (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), started_at timestamptz NOT NULL DEFAULT now(), planned_calls integer NOT NULL,
  model text, finished_at timestamptz, summary jsonb);
CREATE TABLE private.synonym_eval_result_v1 (
  id bigserial PRIMARY KEY, run_id uuid NOT NULL REFERENCES private.synonym_eval_run_v1(run_id), case_id text NOT NULL,
  pair_id uuid, stage text NOT NULL CHECK (stage IN ('relation', 'fit_source', 'fit_target')), prompt_version text NOT NULL,
  answer jsonb, final text, guard text, created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON TABLE private.synonym_eval_case_v1, private.synonym_eval_run_v1, private.synonym_eval_result_v1 FROM PUBLIC;

-- test cases (by source -> target lemma; the newest decided pair is used). expected: verified | not_verified |
-- one_way_or_contextual | fit_no_match (the relation may be right, a translation must not be accepted)
INSERT INTO private.synonym_eval_case_v1 (case_id, label, source_lemma, target_lemma, expected, note) VALUES
  ('E1', 'error', 'svaer', 'grov', 'not_verified', 'svaer "tung, grov" was matched to grov "unyansert, lite noyaktig"; right sense: storbygd, tykk, kraftig'),
  ('E2', 'error', 'snakke', 'skravle', 'one_way_or_contextual', 'skravle = snakke mye (added component)'),
  ('E3', 'error', 'prate', 'tove', 'fit_no_match', 'prate "tove, vrovle" accepted with "rozmovlyaty / talk"'),
  ('C1', 'correct', 'stor', 'svaer', 'verified', NULL),
  ('C2', 'correct', 'svaer', 'stor', 'verified', NULL),
  ('C3', 'correct', 'kreve', 'fordre', 'verified', NULL),
  ('C4', 'correct', 'god', 'bra', 'verified', NULL),
  ('C5', 'correct', 'samtale', 'konversasjon', 'verified', NULL),
  ('C6', 'correct', 'tok', 'tosk', 'verified', NULL),
  ('C7', 'correct', 'hente', 'samle', 'verified', NULL),
  ('N1', 'negative', 'ta', 'stjele', 'not_verified', 'ta "stjele": brati / take does not render steal'),
  ('N2', 'negative', 'god', 'stor', 'not_verified', 'god "stor, romslig": khoroshyi / good does not render large'),
  ('N3', 'negative', 'stjele', 'naske', 'one_way_or_contextual', 'naske = stjele smaating'),
  ('N4', 'negative', 'god', 'utmerket', 'one_way_or_contextual', 'utmerket = svaert god (intensity)'),
  ('N5', 'negative', 'snakke', 'sladre', 'not_verified', 'sladre = tell tales');
UPDATE private.synonym_eval_case_v1 SET source_lemma = replace(source_lemma, 'svaer', 'sv' || chr(230) || 'r'),
  target_lemma = replace(target_lemma, 'svaer', 'sv' || chr(230) || 'r');
UPDATE private.synonym_eval_case_v1 SET target_lemma = 't' || chr(248) || 've' WHERE case_id = 'E3';

-- start a run: refused when the daily eval call limit would be passed
CREATE FUNCTION public.d10_synonym_eval_start_v1(p_planned_calls integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE v_cfg public.synonym_verifier_config_v1%rowtype; v_used integer; v_run uuid;
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  PERFORM pg_advisory_xact_lock(20261102, 8);
  SELECT coalesce(sum(units), 0) INTO v_used FROM private.synonym_ai_extra_budget_v1 WHERE kind = 'eval' AND reserved_at > now() - interval '24 hours';
  IF p_planned_calls IS NULL OR p_planned_calls < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PLAN'); END IF;
  IF v_used + p_planned_calls > v_cfg.daily_eval_call_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_eval_limit', 'used_24h', v_used, 'limit', v_cfg.daily_eval_call_limit);
  END IF;
  INSERT INTO private.synonym_eval_run_v1 (planned_calls, model) VALUES (p_planned_calls, v_cfg.model) RETURNING run_id INTO v_run;
  INSERT INTO private.synonym_ai_extra_budget_v1 (kind, units, ref) VALUES ('eval', p_planned_calls, v_run::text);
  RETURN jsonb_build_object('ok', true, 'run_id', v_run, 'model', v_cfg.model, 'used_24h', v_used + p_planned_calls);
END
$f$;

-- the cases with everything the test needs: snapshot, target senses (group + examples), the current decision, and
-- both senses with the card's pipeline translations for the fit check. Nothing is changed.
CREATE FUNCTION public.d10_synonym_eval_cases_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
  SELECT coalesce(jsonb_agg(jsonb_build_object('case_id', c.case_id, 'label', c.label, 'expected', c.expected,
    'source_lemma', c.source_lemma, 'target_lemma', c.target_lemma, 'found', p.id IS NOT NULL, 'pair_id', p.id,
    'snapshot', p.snapshot,
    'target_senses', CASE WHEN p.target_article_key ~ '^[0-9]+$' THEN private.synonym_target_senses_v1(p.target_article_key::bigint, p.snapshot->'target'->'definitions_nb') ELSE '[]'::jsonb END,
    'current', jsonb_build_object('decision', p.decision, 'published', p.published, 'verifier', p.verifier_version,
      'ai_decision', p.verification_evidence->>'ai_decision', 'matched_text', p.verification_evidence->>'matched_text',
      'fwd', p.verification_evidence->'substitution_forward', 'rev', p.verification_evidence->'substitution_reverse',
      'source_fit', (SELECT jsonb_build_object('fit', f.fit, 'uk', f.chosen_uk, 'en', f.chosen_en) FROM private.synonym_sense_fit_v1 f WHERE f.fit_key = p.verification_evidence->>'source_fit_key'),
      'target_fit', (SELECT jsonb_build_object('fit', f.fit, 'uk', f.chosen_uk, 'en', f.chosen_en) FROM private.synonym_sense_fit_v1 f WHERE f.fit_key = p.verification_evidence->>'target_fit_key')),
    'source_card', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('lemma', p.snapshot->'source'->>'lemma', 'pos', p.snapshot->'source'->>'part_of_speech',
      'sense', coalesce(nullif(btrim(p.snapshot->'source'->'sense_context'->>'focus_gloss'), ''), p.snapshot->'source'->>'definition_nb'),
      'contexts', coalesce(p.snapshot->'source'->'sense_context'->'group_definitions', '[]'::jsonb),
      'tr', private.synonym_card_translations_v1(p.source_entity_type, p.source_entity_id)) END,
    'target_card', CASE WHEN p.id IS NOT NULL THEN jsonb_build_object('lemma', p.snapshot->'target'->>'lemma', 'pos', p.snapshot->'target'->>'part_of_speech',
      'tr', private.synonym_card_translations_v1(p.target_entity_type, p.target_entity_id)) END)
    ORDER BY c.case_id), '[]'::jsonb)
  FROM private.synonym_eval_case_v1 c
  LEFT JOIN LATERAL (SELECT q.* FROM public.synonym_pair_v1 q
    WHERE q.snapshot->'source'->>'lemma' = c.source_lemma AND q.snapshot->'target'->>'lemma' = c.target_lemma
      AND q.status IN ('done', 'queued', 'retry_wait', 'needs_manual_review') AND q.decision IS NOT NULL
    ORDER BY (q.status = 'done') DESC, q.verified_at DESC NULLS LAST LIMIT 1) p ON true;
$f$;

CREATE FUNCTION public.d10_synonym_eval_record_v1(p_run uuid, p_rows jsonb, p_summary jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE n integer;
BEGIN
  INSERT INTO private.synonym_eval_result_v1 (run_id, case_id, pair_id, stage, prompt_version, answer, final, guard)
  SELECT p_run, r->>'case_id', nullif(r->>'pair_id', '')::uuid, r->>'stage', r->>'prompt_version', r->'answer', r->>'final', r->>'guard'
  FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE private.synonym_eval_run_v1 SET finished_at = now(), summary = p_summary WHERE run_id = p_run;
  RETURN jsonb_build_object('ok', true, 'rows', n);
END
$f$;

REVOKE ALL ON FUNCTION public.d10_synonym_eval_start_v1(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_eval_cases_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_eval_record_v1(uuid, jsonb, jsonb) FROM PUBLIC;
DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.d10_synonym_eval_start_v1(integer) TO service_role;
    GRANT EXECUTE ON FUNCTION public.d10_synonym_eval_cases_v1() TO service_role;
    GRANT EXECUTE ON FUNCTION public.d10_synonym_eval_record_v1(uuid, jsonb, jsonb) TO service_role;
  END IF;
END
$g$;

DO $mig$
DECLARE r record; v_oid oid; v_secdef boolean; v_secdef2 boolean; v_cfg text[]; v_cfg2 text[]; v_md5 text; v_body text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('public.d10_synonym_fit_lease_v1(text[],integer)', $h_fit_lease$CREATE OR REPLACE FUNCTION public.d10_synonym_fit_lease_v1(p_keys text[], p_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
$h_fit_lease$, 'f2b9a4a3542ed9ba18c09f156ecda17c', '9840b0d4cdbf5c26e1f85489352b8e14', $b_fit_lease$
DECLARE v_token uuid := gen_random_uuid(); v_rows jsonb; v_cfg public.synonym_verifier_config_v1%rowtype; v_left integer;
BEGIN
  -- the same switch and model as the pair verifier
  SELECT * INTO STRICT v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  IF NOT v_cfg.enabled THEN RETURN jsonb_build_object('ok', true, 'rows', '[]'::jsonb, 'reason', 'disabled'); END IF;
  -- D10_synonym_eval_v1 (02.11.2026, agreed): own daily limit for translation-fit AI checks (rows leased in 24 h)
  PERFORM pg_advisory_xact_lock(20261102, 7);
  v_left := v_cfg.daily_ai_fit_limit - coalesce((SELECT sum(b.units) FROM private.synonym_ai_extra_budget_v1 b
              WHERE b.kind = 'fit' AND b.reserved_at > now() - interval '24 hours'), 0);
  IF v_left <= 0 THEN RETURN jsonb_build_object('ok', true, 'rows', '[]'::jsonb, 'reason', 'daily_fit_limit'); END IF;
  UPDATE private.synonym_sense_fit_v1 SET status = 'failed', last_error = coalesce(last_error, 'lease_attempts_exhausted'),
    lease_token = NULL, lease_until = NULL
  WHERE status = 'processing' AND lease_until <= now() AND attempts >= 3;
  WITH picked AS (
    SELECT f.fit_key FROM private.synonym_sense_fit_v1 f
    WHERE (f.status = 'queued' OR (f.status = 'processing' AND f.lease_until <= now()))
      AND (p_keys IS NULL OR f.fit_key = ANY (p_keys))
    ORDER BY f.created_at, f.fit_key
    LIMIT least(greatest(coalesce(p_limit, 20), 1), 40, v_left)
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
  IF jsonb_array_length(v_rows) > 0 THEN
    INSERT INTO private.synonym_ai_extra_budget_v1(kind, units, ref) VALUES ('fit', jsonb_array_length(v_rows), v_token::text);
  END IF;
  RETURN jsonb_build_object('ok', true, 'fit_budget_left', v_left - jsonb_array_length(v_rows), 'lease_token', CASE WHEN jsonb_array_length(v_rows) > 0 THEN v_token END, 'rows', v_rows,
    'model', v_cfg.model);
END
$b_fit_lease$)
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
    INSERT INTO d10_eval_report VALUES ('02_function', r.reg, jsonb_build_object('md5_no_cr', v_md5, 'secdef', v_secdef2, 'config', v_cfg2));
  END LOOP;
END
$mig$;

DO $probe$
DECLARE v jsonb; v_msg text; v_fit jsonb; v_eval jsonb;
BEGIN
  -- P1 test cases: which have a decided pair now
  INSERT INTO d10_eval_report SELECT '03_cases', x->>'case_id' || ' ' || (x->>'source_lemma') || ' -> ' || (x->>'target_lemma'),
    jsonb_build_object('found', x->'found', 'expected', x->'expected', 'current', x->'current'->'decision',
      'target_senses', jsonb_array_length(coalesce(x->'target_senses', '[]'::jsonb)),
      'senses_with_examples', (SELECT count(*) FROM jsonb_array_elements(coalesce(x->'target_senses', '[]'::jsonb)) s WHERE jsonb_array_length(s->'examples') > 0))
  FROM jsonb_array_elements(public.d10_synonym_eval_cases_v1()) x;
  -- P2 limits (rolled back): fit limit 0 -> no rows; eval plan above the limit -> refused
  BEGIN
    UPDATE public.synonym_verifier_config_v1 SET daily_ai_fit_limit = 0, daily_eval_call_limit = 2 WHERE singleton;
    v_fit := public.d10_synonym_fit_lease_v1(NULL, 20);
    v_eval := public.d10_synonym_eval_start_v1(3);
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
    IF v_msg <> 'D10_PROBE_DONE' THEN RAISE EXCEPTION 'STOP: probe failed: %', v_msg; END IF;
  END;
  IF coalesce(v_fit->>'reason', '') <> 'daily_fit_limit' OR coalesce(v_eval->>'error', '') <> 'daily_eval_limit' THEN
    RAISE EXCEPTION 'STOP: probe limits: fit %, eval %', v_fit, v_eval;
  END IF;
  INSERT INTO d10_eval_report VALUES ('04_probe_limits', 'rolled back', jsonb_build_object('fit_lease_with_limit_0', v_fit->>'reason', 'eval_over_limit', v_eval->>'error'));
  INSERT INTO d10_eval_report SELECT '05_config', 'limits', jsonb_build_object('daily_ai_pair_limit', daily_ai_pair_limit,
    'daily_ai_fit_limit', daily_ai_fit_limit, 'daily_eval_call_limit', daily_eval_call_limit) FROM public.synonym_verifier_config_v1 WHERE singleton;
END
$probe$;

SELECT part, name, info FROM d10_eval_report ORDER BY 1, 2;
