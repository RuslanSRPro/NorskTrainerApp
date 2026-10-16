-- D10 residue recovery predeploy. READ ONLY.
-- B_migration is informative only: migrations applied through the SQL Editor
-- are not recorded in schema_migrations. Section A is the reliable check.
WITH required(signature) AS (VALUES
 ('public.d10_family_enrichment_items_page_v1(uuid,integer,integer)'),
 ('public.get_lexeme360_candidate_display_v1(uuid)'),
 ('public.get_lexeme360_root_options_v1(uuid)'),
 ('public.d10_job_gray_family_audit_v1(uuid,uuid[])'),
 ('public.get_completion_evidence_snapshot_v2(uuid,text,integer,text)'),
 ('public.d10_claim_enrichment_residue_v1(uuid,text,uuid[],integer)'),
 ('public.d10_record_enrichment_outcome_v1(uuid,text,uuid,text,text,text,jsonb,integer)'),
 ('public.d10_enrichment_residue_summary_v1(uuid,text,uuid[])'),
 ('public.d10_job_enrichment_failures_v1(uuid)'),
 ('public.d10_job_family_item_ids_v1(uuid,uuid[])'),
 ('public.get_lexeme360_examples_v1(uuid[],uuid[])')
), checks AS (
 SELECT 'A_function'::text AS check_name,signature AS detail,
   CASE WHEN to_regprocedure(signature) IS NULL THEN 'MISSING' ELSE 'present' END AS value,
   now() AS at FROM required
 UNION ALL
 SELECT 'B_migration','20261009223000',
   CASE WHEN EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261009223000')
     THEN 'applied' ELSE 'not_applied' END,now()
 UNION ALL
 SELECT 'B_migration','20261010210000',
   CASE WHEN EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261010210000')
     THEN 'applied' ELSE 'not_applied' END,now()
 UNION ALL
 SELECT 'B_migration','20261010213000',
   CASE WHEN EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261010213000')
     THEN 'applied' ELSE 'not_applied' END,now()
 UNION ALL
 SELECT 'C_recent_error',j.id::text||' | job='||j.status||' | stage='||coalesce(s.stage,'-'),
   left(coalesce(s.last_error,j.summary->>'supervisor_last_error','-'),300),coalesce(s.updated_at,j.created_at)
 FROM public.lexeme_processing_jobs j LEFT JOIN public.pipeline_supervisor_state s ON s.job_id=j.id
 WHERE j.created_at>=now()-interval '3 days' AND
   (coalesce(s.last_error,'')~*'FAMILY_ENRICHMENT|get_completion_evidence_snapshot_v2|Could not find the function'
    OR coalesce(j.summary::text,'')~*'FAMILY_ENRICHMENT|get_completion_evidence_snapshot_v2|Could not find the function')
 UNION ALL
 SELECT 'D_old_partial',j.id::text||' | stage='||s.stage,
   left(coalesce(s.last_error,'-'),300),j.created_at
 FROM public.lexeme_processing_jobs j JOIN public.pipeline_supervisor_state s ON s.job_id=j.id
 WHERE j.status='partial' AND s.stage IN ('orchestrator','enrichment','audit')
 UNION ALL
 SELECT 'E_last_job',j.id::text||' | job='||j.status||' | stage='||coalesce(s.stage,'-'),
   left(coalesce(s.last_error,'-'),300),j.created_at
 FROM (SELECT * FROM public.lexeme_processing_jobs ORDER BY created_at DESC LIMIT 5) j
 LEFT JOIN public.pipeline_supervisor_state s ON s.job_id=j.id
)
SELECT * FROM checks ORDER BY check_name,at DESC;
