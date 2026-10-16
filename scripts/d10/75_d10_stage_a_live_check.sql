-- 75_d10_stage_a_live_check.sql
-- Read only. Stage A live check on the NEWEST job whose text starts with
-- "Er tiden. Jeg husker" (created after the stage A deploy, 13.10.2026).
-- One result set: section | name | detail
--   1_job        status, supervisor stage, last error
--   2_huske      every huske item: POS, stage, promotion / admission, and the
--                Ordbokene evidence (A1: expect article_selection
--                bound_lexeme_article_set with article_ids 24686, 24687 for the verb)
--   3_function   Jeg / det items (A3: rejected function words)
--   4_audit      d10_job_gray_family_audit_v1 for this job (A3: function words
--                in excluded_function_word_count, not in blocked_count)
WITH job AS (
  SELECT j.* FROM public.lexeme_processing_jobs j
  WHERE j.input_text ILIKE 'Er tiden. Jeg husker%'
    AND j.created_at > '2026-10-13 14:55:00+00'
  ORDER BY j.created_at DESC
  LIMIT 1
),
items AS (
  SELECT i.* FROM public.lexeme_processing_items i JOIN job j ON j.id = i.job_id
)
SELECT '1_job' AS section, j.status AS name,
       jsonb_build_object('job_id', j.id, 'created_at', j.created_at,
         'total_items', j.total_items,
         'supervisor_stage', s.stage, 'supervisor_last_error', s.last_error) AS detail
FROM job j LEFT JOIN public.pipeline_supervisor_state s ON s.job_id = j.id
UNION ALL
SELECT '2_huske', coalesce(i.pos, '?') || ' / ' || i.current_stage,
       jsonb_build_object('item_id', i.id, 'raw', i.raw_input, 'lexeme_id', i.lexeme_id,
         'promotion_status', i.result_summary->>'promotion_status',
         'admission_status', i.result_summary->>'admission_status',
         'admission_reason', i.result_summary->>'admission_reason',
         'clone_of', i.result_summary->>'cloned_from_item_id',
         'ordbokene', (SELECT jsonb_build_object(
             'status', sc.status, 'found', sc.found, 'label', sc.evidence->>'evidence_label',
             'article_ids', sc.evidence->'raw_preview'->'article_ids',
             'article_selection', sc.evidence->'raw_preview'->>'article_selection',
             'candidate_article_ids', sc.evidence->'raw_preview'->'candidate_article_ids',
             'bound_article_ids', sc.evidence->'raw_preview'->'bound_article_ids')
           FROM public.lexeme_source_checks sc
           WHERE sc.item_id = i.id AND sc.source = 'Ordbokene' LIMIT 1))
FROM items i WHERE i.normalized_lemma = 'huske'
UNION ALL
SELECT '3_function', i.normalized_lemma,
       jsonb_build_object('item_id', i.id, 'stage', i.current_stage,
         'admission_status', i.result_summary->>'admission_status',
         'admission_reason', i.result_summary->>'admission_reason')
FROM items i WHERE i.normalized_lemma IN ('jeg', 'det')
UNION ALL
SELECT '4_audit', 'family_audit', public.d10_job_gray_family_audit_v1(j.id, '{}'::uuid[])
FROM job j
ORDER BY 1, 2;
