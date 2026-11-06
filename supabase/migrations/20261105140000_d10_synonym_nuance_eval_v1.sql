-- 20261105140000_d10_synonym_nuance_eval_v1.sql
-- D10_synonym_nuance_eval_v1 (agreed 05.11.2026): first step of the two labels for contextual synonyms
--   style   - "the same meaning, another style" (prate - colloquial, passiare - old-fashioned);
--   meaning - "a close meaning" (skravle - talk a lot).
-- This migration only lets the TEST store the answers of the contrast test: the stage check of
-- private.synonym_eval_result_v1 also accepts 'nuance'. Nothing in the working check, nothing published changes.
-- Guards: the check must be exactly the D10 one; reinstall -> STOP.
DROP TABLE IF EXISTS pg_temp.d10_nuance_report;
CREATE TEMP TABLE d10_nuance_report(part text, name text, info jsonb);
DO $m$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
  WHERE conrelid = 'private.synonym_eval_result_v1'::regclass AND conname = 'synonym_eval_result_v1_stage_check';
  IF v_def IS NULL THEN RAISE EXCEPTION 'STOP: synonym_eval_result_v1_stage_check not found'; END IF;
  IF v_def LIKE '%nuance%' THEN RAISE EXCEPTION 'STOP: D10_synonym_nuance_eval_v1 already installed'; END IF;
  IF v_def <> 'CHECK ((stage = ANY (ARRAY[''relation''::text, ''fit_source''::text, ''fit_target''::text])))' THEN
    RAISE EXCEPTION 'STOP: unexpected stage check: %', v_def;
  END IF;
  ALTER TABLE private.synonym_eval_result_v1 DROP CONSTRAINT synonym_eval_result_v1_stage_check;
  ALTER TABLE private.synonym_eval_result_v1 ADD CONSTRAINT synonym_eval_result_v1_stage_check
    CHECK (stage IN ('relation', 'fit_source', 'fit_target', 'nuance'));
  INSERT INTO d10_nuance_report VALUES ('01_check', 'stage', jsonb_build_object('before', v_def,
    'after', (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'private.synonym_eval_result_v1'::regclass
      AND conname = 'synonym_eval_result_v1_stage_check')));
END
$m$;
-- probe (rolled back): a 'nuance' row is accepted, an unknown stage is refused
DO $p$
DECLARE v_ok text := 'not inserted'; v_bad text := 'not refused'; v_run uuid := gen_random_uuid();
BEGIN
  BEGIN
    INSERT INTO private.synonym_eval_run_v1(run_id, planned_calls, model) VALUES (v_run, 1, 'probe');
    INSERT INTO private.synonym_eval_result_v1(run_id, case_id, stage, prompt_version, final, answer)
    VALUES (v_run, 'U01', 'nuance', 'nuance_v1', 'style', '{}');
    v_ok := 'inserted';
    BEGIN
      INSERT INTO private.synonym_eval_result_v1(run_id, case_id, stage, prompt_version, final, answer)
      VALUES (v_run, 'U01', 'other', 'x', 'x', '{}');
    EXCEPTION WHEN check_violation THEN v_bad := 'refused';
    END;
    RAISE EXCEPTION 'D10_PROBE_DONE';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'D10_PROBE_DONE' THEN RAISE; END IF;
  END;
  INSERT INTO d10_nuance_report VALUES ('02_probe', 'a nuance row', jsonb_build_object('result', v_ok)),
    ('02_probe', 'b unknown stage', jsonb_build_object('result', v_bad));
END
$p$;
SELECT part, name, info FROM d10_nuance_report ORDER BY 1, 2;
