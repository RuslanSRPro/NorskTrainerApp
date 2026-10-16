-- 139: grey POS clone cards (D10_gray_pos_clone_v1). Read only.
-- A: functions installed. B: POS clones of the last job and where they ended.
SELECT 'A promote function' AS part,
       CASE WHEN to_regprocedure('public.d10_promote_gray_pos_clones_v1(uuid)') IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS value,
       NULL::text AS stage, NULL::smallint AS stars
UNION ALL
SELECT 'A audit has clone count',
       CASE WHEN pg_get_functiondef('public.d10_job_gray_family_audit_v1(uuid,uuid[])'::regprocedure) LIKE '%gray_pos_clone_count%' THEN 'OK' ELSE 'MISSING' END,
       NULL, NULL
UNION ALL
SELECT 'B ' || i.normalized_lemma || ' (' || i.pos || ')',
       coalesce(i.result_summary->>'promotion_status', '-') || ' | ' || coalesce(i.result_summary->>'gray_reason', i.result_summary->>'admission_status', '-'),
       i.current_stage,
       v.stars
FROM public.lexeme_processing_items i
LEFT JOIN public.verification_stars_v1 v ON v.entity_type = 'lexeme' AND v.entity_id = i.lexeme_id
WHERE i.result_summary->>'clone_reason' = 'multi_pos_evidence_expansion_known_pos'
  AND i.job_id = (SELECT j.id FROM public.lexeme_processing_jobs j ORDER BY j.created_at DESC LIMIT 1)
ORDER BY 1;
