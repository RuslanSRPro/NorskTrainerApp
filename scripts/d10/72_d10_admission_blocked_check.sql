-- 72_d10_admission_blocked_check.sql
-- Read only. What the supervisor's final admission check sees for three real
-- jobs. Run BEFORE and AFTER migration 20261013160000 (plan A3).
--   before: blocked_count counts function words (Jeg, det); no
--           excluded_function_word_count key
--   after : blocked_count without function words; excluded_function_word_count
--           shows them; gray_count / gray_ids unchanged
-- Expected after A3 (before re-running the text with A1):
--   3779546f "Er tiden. Jeg husker det": gray 3, blocked 1 (huske verb), excluded 2
--   0840b1fc "ta det med ro, ...":       blocked 1 (gang),             excluded 2
--   ae84dd94 "Er tiden. Tar mat":        blocked 1 (være verb),        excluded 0
SELECT j.id AS job_id, left(j.input_text, 40) AS input,
       public.d10_job_gray_family_audit_v1(j.id, '{}'::uuid[]) AS family_audit
FROM public.lexeme_processing_jobs j
WHERE j.id IN ('3779546f-5aa0-42f2-9e7b-d781a50eec9f',
               '0840b1fc-172e-4682-87eb-d4bcb7b2371c',
               'ae84dd94-eff9-44b1-8f8f-5792cadd0d07')
ORDER BY j.created_at;
