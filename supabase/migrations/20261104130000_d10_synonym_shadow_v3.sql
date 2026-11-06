-- 20261104130000_d10_synonym_shadow_v3.sql
-- D10_synonym_shadow_v3 (04.11.2026): a shadow run is refused while another one is still running (started less
-- than 5 min ago, not finished): overlapping runs picked the same pairs twice. Only d10_synonym_shadow_start_v1
-- changes (same signature, grants kept). Test only: production does NOT change.
-- Guards: the function must be exactly as installed by D10_synonym_shadow_v1 (md5); reinstall -> STOP.

DO $mig$
DECLARE v_md5 text;
BEGIN
  SELECT md5(replace(p.prosrc, chr(13), '')) INTO v_md5 FROM pg_proc p
  WHERE p.oid = to_regprocedure('public.d10_synonym_shadow_start_v1(integer,integer)');
  IF v_md5 IS NULL THEN RAISE EXCEPTION 'STOP: d10_synonym_shadow_start_v1 not found'; END IF;
  IF strpos((SELECT prosrc FROM pg_proc WHERE oid = to_regprocedure('public.d10_synonym_shadow_start_v1(integer,integer)')), 'shadow_run_in_progress') > 0 THEN
    RAISE EXCEPTION 'STOP: D10_synonym_shadow_v3 already installed';
  END IF;
  IF v_md5 <> '628b9663494322940d01f80c0244e6ef' THEN RAISE EXCEPTION 'STOP: d10_synonym_shadow_start_v1 differs from the expected version (%)', v_md5; END IF;
END
$mig$;

CREATE OR REPLACE FUNCTION public.d10_synonym_shadow_start_v1(p_pairs integer, p_calls_per_variant integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE v_cfg public.synonym_verifier_config_v1%rowtype; v_used integer; v_run uuid; v_planned integer;
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  IF NOT v_cfg.shadow_enabled THEN RETURN jsonb_build_object('ok', false, 'error', 'shadow_disabled'); END IF;
  IF p_pairs IS NULL OR p_pairs < 1 OR p_calls_per_variant IS NULL OR p_calls_per_variant < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PLAN');
  END IF;
  IF jsonb_typeof(v_cfg.shadow_variants) <> 'array' OR jsonb_array_length(v_cfg.shadow_variants) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_variants');
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_cfg.shadow_variants) v
             WHERE coalesce(v->>'model', '') !~ '^(gemini-[0-9]+(\.[0-9]+)?-[a-z0-9.-]+|gpt-[0-9]+(\.[0-9]+)?(-[a-z0-9.-]+)?)$'
                OR (v ? 'thinking' AND jsonb_typeof(v->'thinking') <> 'null' AND v->>'thinking' NOT IN ('minimal', 'none', 'low', 'medium', 'high'))) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_VARIANT');
  END IF;
  v_planned := p_calls_per_variant * jsonb_array_length(v_cfg.shadow_variants);
  PERFORM pg_advisory_xact_lock(20261102, 9);
  -- D10_synonym_shadow_v3: one shadow run at a time (a run that started less than 5 min ago and has not finished);
  -- otherwise two runs pick the same pairs and pay for them twice. An older open run is treated as dead.
  IF EXISTS (SELECT 1 FROM private.synonym_shadow_run_v1 WHERE finished_at IS NULL AND started_at > now() - interval '5 minutes') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'shadow_run_in_progress');
  END IF;
  SELECT coalesce(sum(units), 0) INTO v_used FROM private.synonym_ai_extra_budget_v1 WHERE kind = 'shadow' AND reserved_at > now() - interval '24 hours';
  IF v_used + v_planned > v_cfg.daily_shadow_call_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_shadow_limit', 'used_24h', v_used, 'planned', v_planned, 'limit', v_cfg.daily_shadow_call_limit);
  END IF;
  INSERT INTO private.synonym_shadow_run_v1 (pairs, planned_calls, variants) VALUES (p_pairs, v_planned, v_cfg.shadow_variants) RETURNING run_id INTO v_run;
  INSERT INTO private.synonym_ai_extra_budget_v1 (kind, units, ref) VALUES ('shadow', v_planned, v_run::text);
  RETURN jsonb_build_object('ok', true, 'run_id', v_run, 'variants', v_cfg.shadow_variants, 'planned_calls', v_planned, 'used_24h', v_used + v_planned);
END
$f$;


-- probe (rolled back): an open run blocks the next one
DO $p$
DECLARE r1 jsonb; r2 jsonb;
BEGIN
  BEGIN
    r1 := public.d10_synonym_shadow_start_v1(1, 1);
    r2 := public.d10_synonym_shadow_start_v1(1, 1);
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
  END;
  CREATE TEMP TABLE IF NOT EXISTS d10_shadow3_report(part text, name text, info jsonb);
  INSERT INTO d10_shadow3_report VALUES ('01_probe', 'first run (rolled back)', r1), ('01_probe', 'second run refused', r2);
END
$p$;
INSERT INTO d10_shadow3_report SELECT '02_limit', 'shadow_calls_24h', jsonb_build_object(
  'used_24h', (SELECT coalesce(sum(units), 0) FROM private.synonym_ai_extra_budget_v1 WHERE kind = 'shadow' AND reserved_at > now() - interval '24 hours'),
  'limit', (SELECT daily_shadow_call_limit FROM public.synonym_verifier_config_v1 WHERE singleton),
  'published_not_shadow_checked', (SELECT count(*) FROM public.synonym_pair_v1 q WHERE q.published AND NOT EXISTS (
     SELECT 1 FROM private.synonym_shadow_result_v1 r WHERE r.pair_id = q.id AND r.stage = 'relation' AND r.variant = 'gpt-6-luna@medium'
       AND r.snapshot_hash IS NOT DISTINCT FROM q.snapshot_hash)));
SELECT part, name, info FROM d10_shadow3_report ORDER BY 1, 2;
