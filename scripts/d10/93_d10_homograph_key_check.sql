-- 93_d10_homograph_key_check.sql
-- Read only. Run AFTER migration 20261014180000.
--   T1 column homograph_key exists, every row ''          expected PASS
--   T2 both unique indexes exist (old stays until D2)      expected PASS
--   T3 sync_expression_to_lexemes uses the new target      expected PASS
--   T4 no other function still uses ON CONFLICT (lemma, pos) expected PASS
SELECT 'T1 column, all empty' AS check,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_schema = 'public' AND table_name = 'lexemes'
                           AND column_name = 'homograph_key')
             AND NOT EXISTS (SELECT 1 FROM public.lexemes WHERE homograph_key <> '')
            THEN 'PASS' ELSE 'FAIL' END AS result,
       (SELECT count(*)::text || ' lexemes' FROM public.lexemes) AS detail
UNION ALL
SELECT 'T2 unique indexes',
       CASE WHEN to_regclass('public.lexemes_lemma_pos_unique') IS NOT NULL
             AND to_regclass('public.lexemes_lemma_pos_homograph_unique') IS NOT NULL
            THEN 'PASS' ELSE 'FAIL' END,
       NULL
UNION ALL
SELECT 'T3 sync_expression_to_lexemes',
       CASE WHEN position('ON CONFLICT (lemma, pos, homograph_key)' IN
                 pg_get_functiondef('public.sync_expression_to_lexemes(uuid)'::regprocedure)) > 0
            THEN 'PASS' ELSE 'FAIL' END,
       NULL
UNION ALL
SELECT 'T4 other ON CONFLICT (lemma, pos)',
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
       string_agg(n.nspname || '.' || p.proname, ', ')
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'private')
  AND p.prosrc ~* 'on conflict\s*\(\s*lemma\s*,\s*pos\s*\)';
