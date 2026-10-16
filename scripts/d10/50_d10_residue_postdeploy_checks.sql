-- D10 residue patch: read-only post-deploy acceptance checks.
-- Expected: every check in section A returns true; sections B-D are evidence.

select
  to_regprocedure('public.d10_claim_enrichment_residue_v1(uuid,text,uuid[],integer)') is not null as claim_rpc,
  to_regprocedure('public.d10_record_enrichment_outcome_v1(uuid,text,uuid,text,text,text,jsonb,integer)') is not null as outcome_rpc,
  to_regprocedure('public.d10_enrichment_residue_summary_v1(uuid,text,uuid[])') is not null as summary_rpc,
  to_regprocedure('public.d10_job_enrichment_failures_v1(uuid)') is not null as failures_rpc,
  to_regprocedure('public.d10_job_family_item_ids_v1(uuid,uuid[])') is not null as family_selector_rpc,
  to_regprocedure('public.get_lexeme360_examples_v1(uuid[],uuid[])') is not null as examples_rpc,
  to_regclass('private.d10_job_enrichment_item_state_v1') is not null as residue_table;

select chain, status, count(*) as item_count,
       min(started_at) as oldest_started_at,
       max(finished_at) as newest_finished_at
from private.d10_job_enrichment_item_state_v1
group by chain, status
order by chain, status;

select job_id, chain, item_id, lexeme_id, expression_id, attempt_count, outcome_code, last_error,
       started_at, finished_at
from private.d10_job_enrichment_item_state_v1
where status = 'failed'
order by finished_at desc nulls last
limit 100;

select job_id, chain, item_id, attempt_count, started_at
from private.d10_job_enrichment_item_state_v1
where status = 'processing'
  and started_at < now() - interval '5 minutes'
order by started_at;
