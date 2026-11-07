-- D10_synonym_full_run_limits_v1 (07.11.2026, agreed): synonym limits for the full run through text analysis.
--   daily_ai_fit_limit 400 -> 1000, daily_ai_pair_limit 800 -> 1000, daily_nuance_call_limit 10 -> 50
--   (synonym_verifier_config_v1); daily_job_limit 50 -> 150 (synonym_pipeline_config).
-- Only numbers in the two config rows; no code changes. Guards: current values must be the old ones,
-- a repeated install stops. Rollback: optional/rollback_d10_synonym_full_run_limits_v1.sql.
DO $mig$
DECLARE v record; p record;
BEGIN
  SELECT daily_ai_fit_limit, daily_ai_pair_limit, daily_nuance_call_limit INTO STRICT v
  FROM public.synonym_verifier_config_v1 WHERE singleton;
  SELECT daily_job_limit INTO STRICT p FROM public.synonym_pipeline_config WHERE singleton;
  IF v.daily_ai_fit_limit = 1000 AND v.daily_ai_pair_limit = 1000 AND v.daily_nuance_call_limit = 50
     AND p.daily_job_limit = 150 THEN
    RAISE EXCEPTION 'STOP: D10_synonym_full_run_limits_v1 is already installed';
  END IF;
  IF v.daily_ai_fit_limit <> 400 OR v.daily_ai_pair_limit <> 800 OR v.daily_nuance_call_limit <> 10
     OR p.daily_job_limit <> 50 THEN
    RAISE EXCEPTION 'STOP: unexpected current limits: fit %, pair %, nuance %, jobs %',
      v.daily_ai_fit_limit, v.daily_ai_pair_limit, v.daily_nuance_call_limit, p.daily_job_limit;
  END IF;
  UPDATE public.synonym_verifier_config_v1
  SET daily_ai_fit_limit = 1000, daily_ai_pair_limit = 1000, daily_nuance_call_limit = 50, updated_at = now()
  WHERE singleton;
  UPDATE public.synonym_pipeline_config SET daily_job_limit = 150, updated_at = now() WHERE singleton;
END
$mig$;

SELECT 'verifier'::text AS part, 'limits' AS name,
  jsonb_build_object('fit', daily_ai_fit_limit, 'pair', daily_ai_pair_limit, 'nuance', daily_nuance_call_limit) AS info
FROM public.synonym_verifier_config_v1 WHERE singleton
UNION ALL
SELECT 'pipeline', 'limits', jsonb_build_object('daily_job_limit', daily_job_limit, 'max_concurrent_jobs', max_concurrent_jobs)
FROM public.synonym_pipeline_config WHERE singleton
ORDER BY 1, 2;
