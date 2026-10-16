-- 101_d10_homograph_pin_check.sql
-- Read only. After migration 20261015092000: expected T1 and T2 = PASS.
SELECT 'T1 helper exists' AS test,
       CASE WHEN to_regprocedure('public.d10_injected_card_rank_v1(uuid,uuid)') IS NOT NULL
            THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
SELECT 'T2 promotion uses it (once)',
       CASE WHEN (SELECT count(*) FROM regexp_matches(
              pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure),
              'd10_injected_card_rank_v1', 'g')) = 1
            THEN 'PASS' ELSE 'FAIL' END;
