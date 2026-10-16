-- 106_d10_ordbokene_resilience_check.sql
-- Read only. After migration 20261015110000: expected T1 and T2 = PASS.
SELECT 'T1 source check retry patched (once)' AS test,
       CASE WHEN (SELECT count(*) FROM regexp_matches(
              pg_get_functiondef('public.update_lexeme_source_check_status(uuid,text,text,boolean,text,text,jsonb,jsonb,jsonb)'::regprocedure),
              'd10_ordbokene_server_failure', 'g')) = 1
            THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
SELECT 'T2 known-article helper callable by workers',
       CASE WHEN has_function_privilege('service_role', 'public.d10_lexeme_article_ids_v1(uuid)', 'EXECUTE')
            THEN 'PASS' ELSE 'FAIL' END;
