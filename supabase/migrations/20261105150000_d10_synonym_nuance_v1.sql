-- 20261105150000_d10_synonym_nuance_v1.sql
-- D10_synonym_nuance_v1 (agreed 05.11.2026): label of a published CONTEXTUAL synonym, for the app.
--   style   - the same meaning, another style ("тот же смысл, другой стиль": fordre - formal, tok - dialect);
--   meaning - a close meaning ("близкий по смыслу": skravle, svær, prate - more casual).
-- Contrast test nuance_v1 (tested in eval, stable on 2 runs). The class of a pair (clean / contextual) is NOT
-- changed; clean pairs get no label. One answer per pair and content: a pair with the same content is never asked
-- again; when its content changes, it is asked once more (the old answer stays in history).
--  * private.synonym_nuance_v1: one row per pair (lease, label, styles of both words, answer, history).
--  * config: nuance_enabled (default true), daily_nuance_call_limit (default 10 calls / 24 h, one call = 20 pairs).
--  * d10_synonym_nuance_lease_v1 / d10_synonym_nuance_record_v1 (service role only).
--  * public.get_synonym_carousel_v4 = get_synonym_carousel_v3 + nuance_kind, nuance_style (style of the shown word,
--    only when it differs from the opened word). v3 is not changed (the app falls back to v3 if v4 is missing).
-- Guards: D10_synonym_nuance_eval_v1 and D10_synonym_r13_v1 installed; carousel v3 md5 as expected; reinstall -> STOP.
DROP TABLE IF EXISTS pg_temp.d10_nuance_report;
CREATE TEMP TABLE d10_nuance_report(part text, name text, info jsonb);
DO $g$
BEGIN
  IF to_regclass('private.synonym_nuance_v1') IS NOT NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_nuance_v1 already installed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'private.synonym_eval_result_v1'::regclass
      AND conname = 'synonym_eval_result_v1_stage_check' AND pg_get_constraintdef(oid) LIKE '%nuance%') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_nuance_eval_v1 is not installed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'synonym_verifier_config_v1' AND column_name = 'verifier_rules') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_r13_v1 is not installed';
  END IF;
  IF (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE oid = 'public.get_synonym_carousel_v3(uuid)'::regprocedure) <> '519b02655ea1df2129e14f39c02280fd' THEN
    RAISE EXCEPTION 'STOP: get_synonym_carousel_v3 differs from the expected version';
  END IF;
  IF to_regprocedure('public.get_synonym_carousel_v4(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'STOP: get_synonym_carousel_v4 already exists'; END IF;
END
$g$;

ALTER TABLE public.synonym_verifier_config_v1
  ADD COLUMN nuance_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN daily_nuance_call_limit integer NOT NULL DEFAULT 10 CHECK (daily_nuance_call_limit BETWEEN 0 AND 200);

CREATE TABLE private.synonym_nuance_v1 (
  pair_id uuid PRIMARY KEY REFERENCES public.synonym_pair_v1(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('leased', 'done')),
  snapshot_hash text,
  kind text CHECK (kind IN ('style', 'meaning')),
  register_source text CHECK (register_source IN ('neutral', 'colloquial', 'formal', 'literary_or_archaic', 'regional', 'technical')),
  register_target text CHECK (register_target IN ('neutral', 'colloquial', 'formal', 'literary_or_archaic', 'regional', 'technical')),
  answer jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  prompt_version text,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  lease_token uuid,
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (status <> 'done' OR (kind IS NOT NULL AND register_source IS NOT NULL AND register_target IS NOT NULL))
);
COMMENT ON TABLE private.synonym_nuance_v1 IS 'D10_synonym_nuance_v1: label of a published contextual synonym (style | meaning), contrast test nuance_v1';
REVOKE ALL ON private.synonym_nuance_v1 FROM PUBLIC;
DO $r$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON private.synonym_nuance_v1 FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON private.synonym_nuance_v1 FROM authenticated'; END IF;
END $r$;

-- lease: published contextual pairs without a label for their current content (at most p_limit, 1..20)
CREATE FUNCTION public.d10_synonym_nuance_lease_v1(p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $f$
DECLARE v_cfg public.synonym_verifier_config_v1%ROWTYPE; v_used integer; v_token uuid := gen_random_uuid(); v_items jsonb;
BEGIN
  SELECT * INTO v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  IF NOT coalesce(v_cfg.nuance_enabled, false) THEN RETURN jsonb_build_object('items', '[]'::jsonb, 'reason', 'disabled'); END IF;
  SELECT count(*) INTO v_used FROM public.synonym_verifier_calls_v1 WHERE reason LIKE '%nuance%' AND reason NOT LIKE 'eval%'
    AND created_at > now() - interval '24 hours';
  IF v_used >= v_cfg.daily_nuance_call_limit THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'reason', 'daily_limit', 'used_24h', v_used, 'limit', v_cfg.daily_nuance_call_limit);
  END IF;
  WITH cand AS (
    SELECT p.id, p.snapshot_hash FROM public.synonym_pair_v1 p
    LEFT JOIN private.synonym_nuance_v1 n ON n.pair_id = p.id
    WHERE p.published AND p.decision = 'contextual_synonym' AND p.snapshot_hash IS NOT NULL
      AND coalesce(p.verification_evidence->>'matched_text', '') <> ''
      AND (n.pair_id IS NULL
        OR (n.status = 'done' AND n.snapshot_hash IS DISTINCT FROM p.snapshot_hash)
        OR (n.status = 'leased' AND n.lease_until < now()))
    ORDER BY p.verified_at NULLS LAST, p.id
    LIMIT greatest(1, least(coalesce(p_limit, 20), 20))
  ), up AS (
    INSERT INTO private.synonym_nuance_v1 AS n (pair_id, status, snapshot_hash, lease_token, lease_until, attempts)
    SELECT id, 'leased', snapshot_hash, v_token, now() + interval '5 minutes', 1 FROM cand
    ON CONFLICT (pair_id) DO UPDATE SET status = 'leased', lease_token = v_token, lease_until = now() + interval '5 minutes',
      attempts = n.attempts + 1,
      -- the old label (other content) goes to history before the pair is asked again
      history = CASE WHEN n.status = 'done' THEN n.history || jsonb_build_array(jsonb_build_object('snapshot_hash', n.snapshot_hash,
        'kind', n.kind, 'register_source', n.register_source, 'register_target', n.register_target, 'model', n.model,
        'prompt_version', n.prompt_version, 'decided_at', n.decided_at)) ELSE n.history END,
      snapshot_hash = EXCLUDED.snapshot_hash, kind = NULL, register_source = NULL, register_target = NULL, decided_at = NULL
    WHERE n.status = 'done' OR n.lease_until < now()
    RETURNING n.pair_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'pair_id', p.id, 'snapshot_hash', p.snapshot_hash,
    'source_lemma', p.snapshot->'source'->>'lemma', 'source_pos', p.snapshot->'source'->>'part_of_speech',
    'source_meaning', coalesce(nullif(p.snapshot->'source'->>'definition_nb', ''), p.snapshot->'source'->'sense_context'->>'focus_gloss'),
    'target_lemma', p.snapshot->'target'->>'lemma', 'target_pos', p.snapshot->'target'->>'part_of_speech',
    'target_meaning', p.verification_evidence->>'matched_text', 'example_nb', p.verification_evidence->>'example_nb')
    ORDER BY p.id), '[]'::jsonb) INTO v_items
  FROM up JOIN public.synonym_pair_v1 p ON p.id = up.pair_id;
  RETURN jsonb_build_object('items', v_items, 'lease_token', v_token, 'model', v_cfg.model, 'thinking', v_cfg.verifier_thinking,
    'reason', CASE WHEN jsonb_array_length(v_items) = 0 THEN 'nothing_queued' END);
END
$f$;

-- record: only with the lease token, only while the content of the pair is the same
CREATE FUNCTION public.d10_synonym_nuance_record_v1(p_pair_id uuid, p_lease_token uuid, p_snapshot_hash text, p_kind text,
  p_register_source text, p_register_target text, p_answer jsonb, p_model text, p_prompt_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private AS $f$
DECLARE v_n integer;
BEGIN
  IF p_kind NOT IN ('style', 'meaning') THEN RETURN jsonb_build_object('applied', false, 'error', 'BAD_KIND'); END IF;
  UPDATE private.synonym_nuance_v1 n SET status = 'done', kind = p_kind, register_source = p_register_source,
    register_target = p_register_target, answer = coalesce(p_answer, '{}'::jsonb), model = p_model, prompt_version = p_prompt_version,
    lease_token = NULL, lease_until = NULL, decided_at = now()
  WHERE n.pair_id = p_pair_id AND n.status = 'leased' AND n.lease_token = p_lease_token AND n.lease_until >= now()
    AND n.snapshot_hash = p_snapshot_hash
    AND EXISTS (SELECT 1 FROM public.synonym_pair_v1 p WHERE p.id = p_pair_id AND p.snapshot_hash = p_snapshot_hash);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('applied', v_n = 1, 'error', CASE WHEN v_n = 0 THEN 'STALE_OR_NOT_LEASED' END);
END
$f$;
REVOKE ALL ON FUNCTION public.d10_synonym_nuance_lease_v1(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.d10_synonym_nuance_record_v1(uuid, uuid, text, text, text, text, jsonb, text, text) FROM PUBLIC;
DO $r$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.d10_synonym_nuance_lease_v1(integer) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.d10_synonym_nuance_record_v1(uuid, uuid, text, text, text, text, jsonb, text, text) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.d10_synonym_nuance_lease_v1(integer) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.d10_synonym_nuance_record_v1(uuid, uuid, text, text, text, text, jsonb, text, text) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.d10_synonym_nuance_lease_v1(integer) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.d10_synonym_nuance_record_v1(uuid, uuid, text, text, text, text, jsonb, text, text) TO service_role';
  END IF;
END $r$;

-- carousel v4 = v3 text + two columns (text edits checked; v3 stays as it is)
DO $c$
DECLARE v_def text; v_n integer; e text[];
  edits text[][] := ARRAY[
    ARRAY['public.get_synonym_carousel_v3(p_lexeme_id uuid)', 'public.get_synonym_carousel_v4(p_lexeme_id uuid)'],
    ARRAY['can_replace_target boolean, same_construction boolean)', 'can_replace_target boolean, same_construction boolean, nuance_kind text, nuance_style text)'],
    ARRAY[E'  CASE WHEN jsonb_typeof(i.e->''same_construction'')=''boolean'' THEN (i.e->>''same_construction'')::boolean END\nFROM info i',
          E'  CASE WHEN jsonb_typeof(i.e->''same_construction'')=''boolean'' THEN (i.e->>''same_construction'')::boolean END,\n'
          || E'  -- D10_synonym_nuance_v1: label of a contextual pair; style of the shown word only when it differs from the opened word\n'
          || E'  nu.kind, CASE WHEN nu.shown_reg IS DISTINCT FROM nu.opened_reg THEN nu.shown_reg END\nFROM info i'],
    ARRAY[E'WHERE card.cid <> p_lexeme_id AND l.dictionary_status IS DISTINCT FROM ''excluded''',
          E'LEFT JOIN LATERAL (\n'
          || E'  SELECT nv.kind,\n'
          || E'    CASE WHEN pp.target_entity_type = i.tt AND pp.target_entity_id = i.ti THEN nv.register_target ELSE nv.register_source END AS shown_reg,\n'
          || E'    CASE WHEN pp.target_entity_type = i.tt AND pp.target_entity_id = i.ti THEN nv.register_source ELSE nv.register_target END AS opened_reg\n'
          || E'  FROM private.synonym_nuance_v1 nv JOIN public.synonym_pair_v1 pp ON pp.id = nv.pair_id\n'
          || E'  WHERE nv.pair_id = i.pair_id AND nv.status = ''done'' AND nv.snapshot_hash = pp.snapshot_hash) nu ON true\n'
          || E'WHERE card.cid <> p_lexeme_id AND l.dictionary_status IS DISTINCT FROM ''excluded''']];
BEGIN
  v_def := replace(pg_get_functiondef('public.get_synonym_carousel_v3(uuid)'::regprocedure), E'\r', '');
  FOREACH e SLICE 1 IN ARRAY edits LOOP
    v_n := (length(v_def) - length(replace(v_def, e[1], ''))) / length(e[1]);
    IF v_n <> 1 THEN RAISE EXCEPTION 'STOP: carousel edit found % times: %', v_n, left(e[1], 80); END IF;
    v_def := replace(v_def, e[1], e[2]);
  END LOOP;
  EXECUTE v_def;
  INSERT INTO d10_nuance_report VALUES ('01_object', 'get_synonym_carousel_v4', jsonb_build_object('md5',
    (SELECT md5(replace(prosrc, E'\r', '')) FROM pg_proc WHERE oid = 'public.get_synonym_carousel_v4(uuid)'::regprocedure)));
END
$c$;
GRANT EXECUTE ON FUNCTION public.get_synonym_carousel_v4(uuid) TO PUBLIC;

-- probes (rolled back): lease, record, second record refused, lease again skips it, v4 vs v3 rows
DO $p$
DECLARE v_l jsonb; v_l2 jsonb; v_it jsonb; v_r1 jsonb; v_r2 jsonb; v_lex uuid; v3n bigint; v4n bigint; v_lbl jsonb;
BEGIN
  BEGIN
    UPDATE public.synonym_verifier_config_v1 SET nuance_enabled = true WHERE singleton;
    v_l := public.d10_synonym_nuance_lease_v1(2);
    v_it := v_l->'items'->0;
    IF v_it IS NOT NULL THEN
      v_r1 := public.d10_synonym_nuance_record_v1((v_it->>'pair_id')::uuid, (v_l->>'lease_token')::uuid, v_it->>'snapshot_hash',
        'meaning', 'neutral', 'colloquial', '{"probe":true}', 'probe', 'nuance_v1');
      v_r2 := public.d10_synonym_nuance_record_v1((v_it->>'pair_id')::uuid, (v_l->>'lease_token')::uuid, v_it->>'snapshot_hash',
        'style', 'neutral', 'neutral', '{}', 'probe', 'nuance_v1');
      v_l2 := public.d10_synonym_nuance_lease_v1(20);
      SELECT p.source_entity_id INTO v_lex FROM public.synonym_pair_v1 p WHERE p.id = (v_it->>'pair_id')::uuid AND p.source_entity_type = 'lexeme';
      IF v_lex IS NOT NULL THEN
        SELECT count(*) INTO v3n FROM public.get_synonym_carousel_v3(v_lex);
        SELECT count(*), jsonb_agg(DISTINCT jsonb_build_object('kind', nuance_kind, 'style', nuance_style)) INTO v4n, v_lbl
        FROM public.get_synonym_carousel_v4(v_lex);
      END IF;
    END IF;
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
  END;
  INSERT INTO d10_nuance_report VALUES
    ('02_probe', 'a lease', jsonb_build_object('items', jsonb_array_length(coalesce(v_l->'items', '[]')), 'reason', v_l->'reason', 'first', v_it->>'source_lemma' || ' -> ' || (v_it->>'target_lemma'))),
    ('02_probe', 'b record', coalesce(v_r1, '{}'::jsonb)),
    ('02_probe', 'c record again refused', coalesce(v_r2, '{}'::jsonb)),
    ('02_probe', 'd lease again skips it', jsonb_build_object('contains_first', coalesce(v_l2->'items', '[]') @> jsonb_build_array(jsonb_build_object('pair_id', v_it->>'pair_id')))),
    ('02_probe', 'e carousel v3 / v4 rows', jsonb_build_object('lexeme', v_lex, 'v3', v3n, 'v4', v4n, 'labels', v_lbl));
END
$p$;
INSERT INTO d10_nuance_report SELECT '03_queue', 'contextual published pairs', jsonb_build_object(
  'pairs', count(*), 'with_matched_text', count(*) FILTER (WHERE coalesce(verification_evidence->>'matched_text', '') <> ''),
  'calls_needed', ceil(count(*)::numeric / 20))
FROM public.synonym_pair_v1 WHERE published AND decision = 'contextual_synonym';
SELECT part, name, info FROM d10_nuance_report ORDER BY 1, 2;
