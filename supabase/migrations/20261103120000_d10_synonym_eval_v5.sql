-- 20261103120000_d10_synonym_eval_v5.sql
-- D10_synonym_eval_v5 (03.11.2026): the eval test can also run on an OpenAI model (gpt-...), to compare providers on
-- the same cases. Test only: production (config model, Gemini, verifier v10 / sense_fit_v1, decisions, translations,
-- publication) does NOT change.
--  * public.d10_synonym_eval_start_v3(p_planned_calls, p_model): like v2, but also accepts gpt-... model names.
--    The same daily eval call limit applies. v1 and v2 stay as they were (not removed).
-- Guards: D10_synonym_eval_v3 installed, v5 not installed; reinstall -> STOP.

DROP TABLE IF EXISTS pg_temp.d10_eval5_report;
CREATE TEMP TABLE d10_eval5_report(part text, name text, info jsonb);
DO $mig$
BEGIN
  IF to_regprocedure('public.d10_synonym_eval_start_v2(integer,text)') IS NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_eval_v3 is not installed'; END IF;
  IF to_regprocedure('public.d10_synonym_eval_start_v3(integer,text)') IS NOT NULL THEN RAISE EXCEPTION 'STOP: D10_synonym_eval_v5 already installed'; END IF;
END
$mig$;

-- start a run on a chosen model: refused when the name is not a Gemini or OpenAI (gpt-) model name or the daily eval limit would be passed
CREATE FUNCTION public.d10_synonym_eval_start_v3(p_planned_calls integer, p_model text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $f$
DECLARE v_cfg public.synonym_verifier_config_v1%rowtype; v_used integer; v_run uuid; v_model text;
BEGIN
  SELECT * INTO STRICT v_cfg FROM public.synonym_verifier_config_v1 WHERE singleton;
  v_model := coalesce(nullif(btrim(p_model), ''), v_cfg.model);
  IF v_model IS NULL OR length(v_model) > 60 OR (v_model !~ '^gemini-[0-9]+(\.[0-9]+)?-[a-z0-9.-]+$' AND v_model !~ '^gpt-[0-9]+(\.[0-9]+)?(-[a-z0-9.-]+)?$') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MODEL', 'model', p_model);
  END IF;
  PERFORM pg_advisory_xact_lock(20261102, 8);
  SELECT coalesce(sum(units), 0) INTO v_used FROM private.synonym_ai_extra_budget_v1 WHERE kind = 'eval' AND reserved_at > now() - interval '24 hours';
  IF p_planned_calls IS NULL OR p_planned_calls < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'INVALID_PLAN'); END IF;
  IF v_used + p_planned_calls > v_cfg.daily_eval_call_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_eval_limit', 'used_24h', v_used, 'limit', v_cfg.daily_eval_call_limit);
  END IF;
  INSERT INTO private.synonym_eval_run_v1 (planned_calls, model) VALUES (p_planned_calls, v_model) RETURNING run_id INTO v_run;
  INSERT INTO private.synonym_ai_extra_budget_v1 (kind, units, ref) VALUES ('eval', p_planned_calls, v_run::text);
  RETURN jsonb_build_object('ok', true, 'run_id', v_run, 'model', v_model, 'used_24h', v_used + p_planned_calls);
END
$f$;
REVOKE ALL ON FUNCTION public.d10_synonym_eval_start_v3(integer, text) FROM PUBLIC;
DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.d10_synonym_eval_start_v3(integer, text) TO service_role;
  END IF;
END
$g$;

-- probes (rolled back): a bad name is refused; a good name is recorded on the run
DO $p$
DECLARE r1 jsonb; r2 jsonb; m text;
BEGIN
  BEGIN
    r1 := public.d10_synonym_eval_start_v3(1, 'gpt-x; drop');
    r2 := public.d10_synonym_eval_start_v3(1, 'gpt-6-luna');
    SELECT model INTO m FROM private.synonym_eval_run_v1 WHERE run_id = (r2->>'run_id')::uuid;
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
  END;
  INSERT INTO d10_eval5_report VALUES ('01_probe', 'bad_model_refused', r1);
  INSERT INTO d10_eval5_report VALUES ('01_probe', 'model_recorded (rolled back)', coalesce(r2, '{}'::jsonb) || jsonb_build_object('run_model', m));
END
$p$;
INSERT INTO d10_eval5_report SELECT '02_limit', 'eval_calls_24h', jsonb_build_object(
  'used_24h', (SELECT coalesce(sum(units), 0) FROM private.synonym_ai_extra_budget_v1 WHERE kind = 'eval' AND reserved_at > now() - interval '24 hours'),
  'limit', (SELECT daily_eval_call_limit FROM public.synonym_verifier_config_v1 WHERE singleton),
  'config_model_unchanged', (SELECT model FROM public.synonym_verifier_config_v1 WHERE singleton));
INSERT INTO d10_eval5_report SELECT '03_function', 'd10_synonym_eval_start_v3', jsonb_build_object('exists',
  to_regprocedure('public.d10_synonym_eval_start_v3(integer,text)') IS NOT NULL, 'v1_kept', to_regprocedure('public.d10_synonym_eval_start_v1(integer)') IS NOT NULL, 'v2_kept', to_regprocedure('public.d10_synonym_eval_start_v2(integer,text)') IS NOT NULL);
SELECT part, name, info FROM d10_eval5_report ORDER BY 1, 2;
