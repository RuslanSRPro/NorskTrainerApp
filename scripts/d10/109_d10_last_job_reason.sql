-- 109_d10_last_job_reason.sql
-- Read only. Why the latest job ended with an error (needs_manual_review),
-- and the counter (app numbers) of that job. Short columns.
WITH job AS (
  SELECT j.* FROM public.lexeme_processing_jobs j ORDER BY j.created_at DESC LIMIT 1
)
SELECT 'job' AS part, to_char(job.created_at, 'MM-DD HH24:MI') || ' ' || job.status AS name,
       left(coalesce(to_jsonb(job)->>'input_text', ''), 40) AS detail
FROM job
UNION ALL
SELECT 'reason', coalesce(job.summary->'completion_contract_enforcement_v1'->>'decision', '-'),
       left(coalesce(job.summary->'completion_contract_enforcement_v1'->>'decision_reason', '')
            || ' | ' || coalesce(job.summary->>'supervisor_last_error', ''), 300)
FROM job
UNION ALL
SELECT 'quality', k, v::text
FROM job, jsonb_each(coalesce(job.summary->'completion_contract_enforcement_v1'->'quality_counts', '{}'::jsonb)) AS q(k, v)
UNION ALL
SELECT 'capability', k, left(v::text, 200)
FROM job, jsonb_each(coalesce(job.summary->'completion_contract_enforcement_v1'->'capability_counts', '{}'::jsonb)) AS c(k, v)
UNION ALL
SELECT 'unresolved', coalesce(job.summary->'completion_contract_enforcement_v1'->>'unresolved_items_count', '-'),
       coalesce(job.summary->'completion_contract_enforcement_v1'->>'unresolved_items_block_completion', '-')
FROM job
UNION ALL
SELECT 'counter', p.display_label, p.done_count || '/' || p.total_count
FROM job CROSS JOIN LATERAL public.get_job_chain_progress(job.id) p;
