-- 20261105120000_d10_synonym_eval_cases_v3.sql
-- D10_synonym_eval_cases_v3 (05.11.2026): test cases with expectations CONFIRMED by the user, to watch the
-- clean / contextual boundary of the verifier over reruns:
--   U01 snakke -> prate   clean (confirmed by the user)
--   U02 snakke -> skravle contextual: skravle = talk a lot (confirmed by the user; the class changed between runs)
--   U03 flink  -> dyktig  clean (regression of the sibling sense context fix; proposed)
-- Test data only (private.synonym_eval_case_v1); production does not change. Guard: cases exist -> STOP.
DO $g$
BEGIN
  IF to_regclass('private.synonym_eval_case_v1') IS NULL THEN RAISE EXCEPTION 'STOP: eval case table not found'; END IF;
  IF EXISTS (SELECT 1 FROM private.synonym_eval_case_v1 WHERE case_id IN ('U01', 'U02', 'U03')) THEN
    RAISE EXCEPTION 'STOP: D10_synonym_eval_cases_v3 already installed';
  END IF;
END
$g$;
INSERT INTO private.synonym_eval_case_v1 (case_id, label, case_set, source_lemma, target_lemma, expected, note, exp_class, exp_publish, exp_status) VALUES
  ('U01', 'user', 'regression', 'snakke', 'prate', 'verified', 'user 05.11.2026: snakke - prate are clean synonyms', 'verified_synonym', true, 'confirmed'),
  ('U02', 'user', 'regression', 'snakke', 'skravle', 'not_verified', 'user 05.11.2026: skravle = talk a lot -> contextual', 'contextual_synonym', false, 'confirmed'),
  ('U03', 'user', 'regression', 'flink', 'dyktig', 'verified', 'sibling sense context fix 05.11.2026 (flink in its own sense)', 'verified_synonym', true, 'proposed');
SELECT 'eval_cases' AS part, case_id AS name, jsonb_build_object('source', source_lemma, 'target', target_lemma, 'exp_class', exp_class,
  'exp_publish', exp_publish, 'status', exp_status) AS info
FROM private.synonym_eval_case_v1 WHERE case_id IN ('U01', 'U02', 'U03') ORDER BY 2;
