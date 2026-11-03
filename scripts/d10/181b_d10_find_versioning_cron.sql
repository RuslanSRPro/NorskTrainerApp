-- 181b: scheduled jobs (pg_cron), including switched off ones. Read only.
-- If it fails with "relation cron.job does not exist", pg_cron is not used: skip it.
select jobid, jobname, schedule, active, left(command, 300) as command
from cron.job
order by active, jobname;
