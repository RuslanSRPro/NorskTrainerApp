-- 20261106090000_d10_synonym_eval_cases_v4.sql
-- D10_synonym_eval_cases_v4 (agreed 06.11.2026): test case E2 (snakke -> skravle in the sense of snakke that the
-- dictionary itself defines as "skravle") expects a CLEAN synonym: in that sense the words mean the same.
-- (U02 - snakke -> skravle in the general sense "speak" - stays contextual.) Only the test table changes.
-- Guard: E2 must still have the old expectation; rerun -> STOP.
DO $m$
DECLARE v_n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM private.synonym_eval_case_v1 WHERE case_id = 'E2') THEN RAISE EXCEPTION 'STOP: test case E2 not found'; END IF;
  IF EXISTS (SELECT 1 FROM private.synonym_eval_case_v1 WHERE case_id = 'E2' AND exp_class = 'verified_synonym') THEN
    RAISE EXCEPTION 'STOP: D10_synonym_eval_cases_v4 already installed';
  END IF;
  UPDATE private.synonym_eval_case_v1
  SET expected = 'verified', exp_class = 'verified_synonym', exp_publish = true, exp_status = 'confirmed', label = 'user',
      note = 'user 06.11.2026: in the sense "skravle" of snakke, skravle is a clean synonym (was: one_way_or_contextual)'
  WHERE case_id = 'E2' AND exp_class = 'one_way_synonym|contextual_synonym' AND expected = 'one_way_or_contextual';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN RAISE EXCEPTION 'STOP: E2 does not have the expected old values'; END IF;
END
$m$;
SELECT 'eval_case' AS part, case_id AS name, jsonb_build_object('expected', expected, 'exp_class', exp_class, 'exp_publish', exp_publish,
  'exp_status', exp_status, 'note', note) AS info
FROM private.synonym_eval_case_v1 WHERE case_id IN ('E2', 'U02') ORDER BY 2;
