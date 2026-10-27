-- After separately authorized migration application only. No worker/backfill RPC calls.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT pipeline_enabled,publish_verified_only,daily_job_limit,dispatcher_batch_size,
  max_concurrent_jobs,max_auto_origin_depth,pipeline_version,normalization_version
FROM public.synonym_pipeline_config WHERE singleton;
SELECT c.relname,c.relrowsecurity FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('semantic_senses','synonym_pipeline_config','synonym_gloss_queue',
  'synonym_candidate_queue','synonym_target_queue','synonym_verification_queue') ORDER BY c.relname;
SELECT c.relname,r.role_name,p.privilege,
  has_table_privilege(r.role_name,c.oid,p.privilege) AS allowed
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'),('authenticated')) r(role_name)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(privilege)
WHERE n.nspname='public' AND c.relname IN
 ('semantic_senses','synonym_pipeline_config','synonym_gloss_queue',
  'synonym_candidate_queue','synonym_target_queue','synonym_verification_queue')
ORDER BY c.relname,r.role_name,p.privilege;
SELECT proname,prosecdef,proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('enqueue_naob_synonym_gloss_v1','d10_synonym_backfill_v1');
SELECT tgname,pg_get_triggerdef(oid) FROM pg_catalog.pg_trigger
WHERE tgrelid='public.naob_expression_glosses'::regclass AND NOT tgisinternal;
SELECT column_name,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='authoritative_semantic_relations'
 AND column_name IN ('source_sense_id','target_sense_id','relation_class',
 'recognition_level','verification_evidence','verifier_version','verified_at') ORDER BY column_name;
-- No scans of glosses or existing relation contents, no counts over Production data.
-- cron schema may not exist; the statement below inspects only object availability.
SELECT to_regclass('cron.job') AS cron_catalog;
-- If pg_cron exists, inspect ONLY the known job separately:
-- SELECT jobid,jobname,active FROM cron.job WHERE jobname='naob-synonym-resolver-daily';
ROLLBACK;
