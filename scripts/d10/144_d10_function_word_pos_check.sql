-- 144: function-word rule and part of speech (D10_function_word_pos_v1). Read only.
SELECT 'A promote uses d10_admission_decision_v1' AS check_name,
       CASE WHEN position('d10_admission_decision_v1(' in pg_get_functiondef('public.promote_verification_results_for_job(uuid,integer)'::regprocedure)) > 0
            THEN 'PASS' ELSE 'FAIL' END AS result
UNION ALL
SELECT 'B ved noun + Ordbokene noun article -> allowed',
       CASE WHEN public.d10_admission_decision_v1(
         '{"Ordbokene":{"found":true,"registered_entry":true,"evidence":{"raw_preview":{"dictionary_code":"bm","pos":"noun","article_ids":["1"]}}}}'::jsonb,
         'ved', 'ved', 'noun', 'token', null)->>'admit' = 'true' THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'C ved preposition -> rejected as before',
       CASE WHEN public.d10_admission_decision_v1(null, 'ved', 'ved', 'preposition', 'token', null)->>'admit' = 'false' THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'D ved noun without Ordbokene article -> rejected as before',
       CASE WHEN public.d10_admission_decision_v1('{}'::jsonb, 'ved', 'ved', 'noun', 'token', null)->>'admit' = 'false' THEN 'PASS' ELSE 'FAIL' END;
