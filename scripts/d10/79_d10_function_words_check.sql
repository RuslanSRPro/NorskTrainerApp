-- 79_d10_function_words_check.sql
-- Read only. After migration 20261013200300 (plan F3).
--   1_marked   du / dere are excluded function words now (is_learning_lexeme false)
--   2_ved_paa  the two lexemes deliberately NOT changed (shown for the F1/F2 decision)
--   3_app_keys what the app now loads as function-word keys (F4): lexemes
--              marked as function words + function_word rule values
SELECT '1_marked' AS section, l.lemma AS name,
       jsonb_build_object('id', l.id, 'pos', l.pos, 'dictionary_status', l.dictionary_status,
         'reason', l.dictionary_exclusion_reason, 'is_learning_lexeme', l.is_learning_lexeme) AS detail
FROM public.lexemes l
WHERE l.id IN ('2ee88925-e282-4679-80a1-a4bf966d0471', '60348e0f-cdef-4778-9eb0-84c711eee26f')
UNION ALL
SELECT '2_ved_paa', l.lemma || ' (' || l.pos || ')',
       jsonb_build_object('id', l.id, 'dictionary_status', l.dictionary_status,
         'reason', l.dictionary_exclusion_reason, 'is_learning_lexeme', l.is_learning_lexeme,
         'learning_progress_rows', (SELECT count(*) FROM public.learning_progress lp WHERE lp.lexeme_id = l.id))
FROM public.lexemes l
WHERE l.id IN ('35307a11-56dd-4ed3-a0f3-5225c47282e7', '2bb6433f-0695-4d46-85e8-dc39bd70b19f')
UNION ALL
SELECT '3_app_keys', 'count',
       jsonb_build_object(
         'lexeme_keys', (SELECT count(*) FROM public.lexemes l
            WHERE l.dictionary_status = 'excluded' AND NOT l.is_learning_lexeme
              AND l.dictionary_exclusion_reason LIKE 'function_word_%'),
         'rule_keys', (SELECT count(*) FROM public.dictionary_admission_rules r
            WHERE r.rule_type = 'function_word' AND r.is_active AND r.pos IS NULL))
ORDER BY 1, 2;
