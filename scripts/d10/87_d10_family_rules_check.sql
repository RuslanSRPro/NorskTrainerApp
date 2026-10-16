-- 87_d10_family_rules_check.sql
-- Read only. Run AFTER migrations 20261014120000 and 20261014120100.
-- One result set: check | result | detail
--   T1 family injection: verb roots only + subtype allowlist     expected PASS
--   T2 promotion: family members colored only when verified      expected PASS
--   T3 helper d10_family_unverified_expression_items_v1 exists    expected PASS
--   T4 job 18efc887 (info): family members the new rule would keep gray
WITH d AS (
  SELECT pg_get_functiondef('public.d10_inject_verified_job_family_page_v1(uuid,integer)'::regprocedure) AS inject,
         pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure) AS promote
)
SELECT 'T1 family injection verb only' AS check,
       CASE WHEN position($q$l.pos = 'verb'$q$ IN inject) > 0
             AND position($q$'noun'$q$ IN inject) = 0
             AND position('lexeme360_subtype_is_displayable_v1' IN inject) > 0
             AND position('d10_verified_verb_family_v3' IN inject) > 0
            THEN 'PASS' ELSE 'FAIL' END AS result,
       NULL::jsonb AS detail
FROM d
UNION ALL
SELECT 'T2 promotion family verified only',
       CASE WHEN position('family_unverified_items' IN promote) > 0
             AND position('FAMILY_EXPRESSION_NOT_VERIFIED' IN promote) > 0
            THEN 'PASS' ELSE 'FAIL' END, NULL
FROM d
UNION ALL
SELECT 'T3 helper function',
       CASE WHEN to_regprocedure('public.d10_family_unverified_expression_items_v1(uuid)') IS NOT NULL
            THEN 'PASS' ELSE 'FAIL' END, NULL
UNION ALL
SELECT 'T4 job 18efc887 unverified family (info)', 'INFO',
       (SELECT jsonb_agg(e.lemma || ' (' || coalesce(e.expression_review_status, '-') || ')' ORDER BY e.lemma)
        FROM public.d10_family_unverified_expression_items_v1('18efc887-22b8-406f-82c4-7a9c7e5d0224') u
        JOIN public.lexeme_processing_items i ON i.id = u.item_id
        JOIN public.expression_catalog e ON e.id = i.expression_id)
ORDER BY 1;
