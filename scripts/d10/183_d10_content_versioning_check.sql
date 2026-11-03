-- 183: content versioning check. Read only.
-- 1) the migration objects exist  2) "before" captured for the latest jobs
-- 3) content_version rows of the latest jobs (only changed parts)
-- 4) compute_changed_fields body (how the journal decides "changed")
select '1_objects' as part,
       format('table=%s  content_fn=%s  capture_fn=%s  log_fn=%s',
         to_regclass('private.d10_job_content_before_v1') is not null,
         to_regprocedure('public.d10_entity_content_v1(text,uuid)') is not null,
         to_regprocedure('public.d10_capture_job_content_before_v1(uuid)') is not null,
         to_regprocedure('public.d10_log_job_content_changes_v1(uuid)') is not null) as v,
       null::timestamptz as at
union all
select '2_before_captured', format('job %s  entities=%s', b.job_id, count(*)), max(b.captured_at)
from private.d10_job_content_before_v1 b
group by b.job_id
union all
select '3_content_version',
       format('%s | job %s | %s | old=%s | new=%s', c.lemma, c.job_id, c.changed_fields,
              left(c.old_values::text, 300), left(c.new_values::text, 300)),
       c.created_at
from public.lexicon_change_log c
where c.change_type = 'content_version'
union all
select '4_compute_changed_fields',
       (select left(string_agg(pg_get_functiondef(p.oid), E'\n---\n'), 3000)
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'compute_changed_fields'),
       null
order by 1, 3 desc nulls last
limit 60;
