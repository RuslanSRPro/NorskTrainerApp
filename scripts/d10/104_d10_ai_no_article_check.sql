-- 104_d10_ai_no_article_check.sql
-- Read only. After migration 20261015100000: expected T1 and T2 = PASS.
SELECT 'T1 approx function exists' AS test,
       CASE WHEN to_regprocedure('public.get_lexeme_translation_approx_v1(uuid[])') IS NOT NULL
            THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
SELECT 'T2 app can call it',
       CASE WHEN has_function_privilege('authenticated', 'public.get_lexeme_translation_approx_v1(uuid[])', 'EXECUTE')
             AND has_function_privilege('anon', 'public.get_lexeme_translation_approx_v1(uuid[])', 'EXECUTE')
            THEN 'PASS' ELSE 'FAIL' END;
