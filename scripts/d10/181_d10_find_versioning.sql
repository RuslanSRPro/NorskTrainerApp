-- 181: find the existing (switched off) versioning. Read only, changes nothing.
-- 1) switched off triggers  2) history/log/version tables with size and last write
-- 3) functions that write into such tables  4) triggers that call them
with hist as (
  select c.oid, n.nspname || '.' || c.relname as tbl, c.reltuples::bigint as rows_est,
         pg_size_pretty(pg_total_relation_size(c.oid)) as size
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname in ('public','private')
    and c.relname ~* '(hist|change_log|version|snapshot|audit|_log$|backup)'
),
writers as (
  select p.oid, n.nspname || '.' || p.proname as fn,
         (select string_agg(distinct m[1], ', ')
            from regexp_matches(p.prosrc, 'insert\s+into\s+([a-z_\.]*(?:hist|change_log|version|snapshot|audit|_log)[a-z_0-9]*)', 'gi') as m) as writes
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private')
    and p.prosrc ~* 'insert\s+into\s+[a-z_\.]*(hist|change_log|version|snapshot|audit|_log)'
)
select '1_disabled_trigger' as part,
       format('%s ON %s.%s -> %s  enabled=%s', t.tgname, n.nspname, c.relname, pr.proname, t.tgenabled) as v
from pg_trigger t
join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
join pg_proc pr on pr.oid = t.tgfoid
where not t.tgisinternal and t.tgenabled = 'D' and n.nspname in ('public','private')
union all
select '2_history_table', format('%s  rows~%s  size=%s', tbl, rows_est, size) from hist
union all
select '3_writer_function', format('%s  writes: %s', fn, writes) from writers
union all
select '4_trigger_on_writer',
       format('%s ON %s.%s -> %s  enabled=%s', t.tgname, n.nspname, c.relname, w.fn, t.tgenabled)
from pg_trigger t
join writers w on w.oid = t.tgfoid
join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
order by 1, 2;
