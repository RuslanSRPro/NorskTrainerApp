-- 67_d10_live_runtime_snapshot.sql
-- Read-only, one statement. Snapshot of what is really installed in the live
-- database for the D10 text-analysis pipeline (sources only show what was
-- written, not what is applied).
--   1_cutoff        : enrichment_residue_cutoff row (old partial jobs are not
--                     resumed when it exists) and the live get_active_pipeline_jobs
--                     uses it
--   2_functions     : every D10 pipeline function: exists, SECURITY DEFINER,
--                     executable by app roles (must be false) and a hash of the
--                     live definition (to compare with the source files)
--   3_legacy_keys   : non-terminal jobs whose supervisor state still holds the
--                     old deferred/isolated page keys (they decide whether the
--                     legacy isolate/replay code can be removed safely)
--   4_active_jobs   : jobs the supervisor would pick up now
--   5_unique        : unique indexes on lexemes
--   6_migrations    : D10 rows in supabase_migrations.schema_migrations
--                     (informative: SQL Editor runs are not recorded there)
with fn(name) as (values
  ('get_active_pipeline_jobs'),
  ('d10_claim_enrichment_residue_v1'),
  ('d10_record_enrichment_outcome_v1'),
  ('d10_enrichment_residue_summary_v1'),
  ('d10_job_enrichment_failures_v1'),
  ('d10_job_family_item_ids_v1'),
  ('d10_family_enrichment_items_page_v1'),
  ('d10_job_gray_family_audit_v1'),
  ('get_completion_evidence_snapshot_v2'),
  ('d10_fail_stalled_promotion_items_v1'),
  ('d10_job_promotion_failures_v1'),
  ('get_lexeme360_examples_v1'),
  ('get_canonical_lexeme_examples_v1'),
  ('collect_surface_candidates'),
  ('resolve_surface_form_v2'),
  ('d10_inject_verified_job_family_page_v1'),
  ('recalculate_lexeme_processing_job')
), procs as (
  select fn.name, p.oid
  from fn
  left join pg_proc p on p.proname = fn.name
   and p.pronamespace = 'public'::regnamespace
)
select '1_cutoff' as section, 'enrichment_residue_cutoff' as name,
  jsonb_build_object(
    'row', (select to_jsonb(s) from private.d10_runtime_settings_v1 s where s.key = 'enrichment_residue_cutoff'),
    'active_jobs_fn_uses_cutoff',
      coalesce(pg_get_functiondef(to_regprocedure('public.get_active_pipeline_jobs(integer)')) like '%enrichment_residue_cutoff%', false)) as detail
union all
select '2_functions', pr.name || coalesce('(' || pg_get_function_identity_arguments(pr.oid) || ')', ''),
  case when pr.oid is null then jsonb_build_object('exists', false)
  else jsonb_build_object(
    'exists', true,
    'security_definer', (select p.prosecdef from pg_proc p where p.oid = pr.oid),
    'anon', has_function_privilege('anon', pr.oid, 'EXECUTE'),
    'authenticated', has_function_privilege('authenticated', pr.oid, 'EXECUTE'),
    'definition_md5', md5(pg_get_functiondef(pr.oid))) end
from procs pr
union all
select '3_legacy_keys', s.job_id::text,
  jsonb_build_object('stage', s.stage, 'job_status', j.status,
    'legacy_keys', (select jsonb_agg(k) from jsonb_object_keys(to_jsonb(s.enrichment_offsets)) k
                    where k like '__d10_retry_page__%' or k like '__d10_isolate_page__%'
                       or k = '__d10_isolation_replay_from__'))
from public.pipeline_supervisor_state s
join public.lexeme_processing_jobs j on j.id = s.job_id
where s.stage not in ('done', 'needs_manual_review')
  and exists (select 1 from jsonb_object_keys(to_jsonb(s.enrichment_offsets)) k
              where k like '__d10_retry_page__%' or k like '__d10_isolate_page__%'
                 or k = '__d10_isolation_replay_from__')
union all
select '4_active_jobs', a.id::text, jsonb_build_object('status', a.status, 'created_at', a.created_at)
from public.get_active_pipeline_jobs(200) a
union all
select '5_unique', ix.indexname, jsonb_build_object('definition', ix.indexdef)
from pg_indexes ix
where ix.schemaname = 'public' and ix.tablename = 'lexemes' and ix.indexdef ilike '%unique%'
union all
select '6_migrations', m.version, jsonb_build_object('name', m.name)
from supabase_migrations.schema_migrations m
where m.version >= '20261009000000'
order by 1, 2;
