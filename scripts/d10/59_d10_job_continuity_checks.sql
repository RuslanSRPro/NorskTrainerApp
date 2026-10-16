-- 59_d10_job_continuity_checks.sql
-- Read-only, one statement. Run after applying migration
-- 20261011213000_d10_job_continuity_v1.sql (all "ok" must be true), and again
-- after any job finishes to see what it could not complete.
--   1_function         : new functions exist, executable only by service_role
--   2_last_jobs        : last 5 jobs, supervisor stage, last error and the
--                        continuity report fields written on needs_manual_review
--   3_continuity_state : supervisor counters/skips of the last 5 jobs
with fn as (
  select f.sig, to_regprocedure(f.sig) as proc
  from (values
    ('public.d10_fail_stalled_promotion_items_v1(uuid,integer)'),
    ('public.d10_job_promotion_failures_v1(uuid)'),
    ('public.d10_job_enrichment_failures_v1(uuid)')
  ) f(sig)
), last_jobs as (
  select j.id, j.created_at, j.status, j.summary, s.stage, s.last_error, s.enrichment_offsets
  from public.lexeme_processing_jobs j
  left join public.pipeline_supervisor_state s on s.job_id = j.id
  order by j.created_at desc
  limit 5
)
select '1_function' as section, fn.sig as name,
  jsonb_build_object(
    'ok', fn.proc is not null
      and has_function_privilege('service_role', fn.proc, 'EXECUTE')
      and not has_function_privilege('anon', fn.proc, 'EXECUTE')
      and not has_function_privilege('authenticated', fn.proc, 'EXECUTE'),
    'exists', fn.proc is not null) as detail
from fn
union all
select '2_last_jobs', lj.id::text,
  jsonb_build_object(
    'created_at', lj.created_at, 'job_status', lj.status, 'stage', lj.stage,
    'last_error', lj.last_error,
    'promotion_failed_items', lj.summary -> 'promotion_failed_items',
    'enrichment_failed_items', lj.summary -> 'enrichment_failed_items',
    'enrichment_skipped_pages', lj.summary -> 'enrichment_skipped_pages',
    'pre_admission_skipped_pages', lj.summary -> 'pre_admission_skipped_pages',
    'family_injection_skipped', lj.summary -> 'family_injection_skipped')
from last_jobs lj
union all
select '3_continuity_state', lj.id::text,
  coalesce((
    select jsonb_object_agg(o.key, o.value)
    from jsonb_each(coalesce(to_jsonb(lj.enrichment_offsets), '{}'::jsonb)) o
    where o.key like '__d10_promotion_%' or o.key like '__d10_family_injection_%'
       or o.key like '__d10_skipped_page__%' or o.key like '__d10_pre_admission_skipped_page__%'
       or o.key like '__d10_failed_page__%'
  ), '{}'::jsonb)
from last_jobs lj
order by 1, 2;
