-- 176: D10 point 4 backtest. Read only. For every needs_manual_review job of
-- the last 30 days: what the new rule would say.
--   review_gate      words at the gate with a review reason (would be listed)
--   blocking_gate    other gate words (function words not counted)
--   review_enrich    enrichment failures with a review code
--   other_enrich     enrichment failures with any other error (technical)
--   technical_step   the supervisor stopped on a step (worker/timeout/...)
-- would_be: completed_with_review | still_needs_manual_review
with jobs as (
  select j.id, j.created_at, j.summary
  from public.lexeme_processing_jobs j
  where j.status = 'needs_manual_review' and j.created_at > now() - interval '30 days'
), gate as (
  select i.job_id,
    count(*) filter (where i.result_summary->>'admission_reason' in ('AMBIGUOUS_POS_WITHOUT_ARTICLE',
      'CONFIRMED_ORDBOKENE_POS_CONFLICT', 'CONFIRMED_ARTICLE_POS_CONFLICT',
      'NO_CONFIRMED_WHOLE_UNIT_REGISTRATION', 'unknown_pos_requires_review') and i.status = 'done') as review_gate,
    count(*) filter (where not (coalesce(i.result_summary->>'admission_reason', '') in ('AMBIGUOUS_POS_WITHOUT_ARTICLE',
      'CONFIRMED_ORDBOKENE_POS_CONFLICT', 'CONFIRMED_ARTICLE_POS_CONFLICT',
      'NO_CONFIRMED_WHOLE_UNIT_REGISTRATION', 'unknown_pos_requires_review') and i.status = 'done')
      and not (i.result_summary->>'admission_status' = 'rejected'
               and coalesce(i.result_summary->>'admission_reason', '') like 'function_word_%')) as blocking_gate
  from public.lexeme_processing_items i
  join jobs j on j.id = i.job_id
  where i.current_stage = 'admission_gate' and i.lexeme_id is null and i.expression_id is null
    and i.result_summary->>'promotion_status' = 'not_promoted'
  group by i.job_id
), enrich as (
  select j.id as job_id,
    count(*) filter (where f::text ~ 'AI_POS_SENSE_REVIEW_REJECTED|AI_SINGLE_TRANSLATION_REQUIRED|AI_REQUESTED_EXAMPLE_MISSING|AI_SOURCE_PERIOD_CHANGED_TO_NEW_MOON|pos_mismatch_filtered|SELECTED_BM_ARTICLE_REQUIRED|SELECTED_ARTICLE_DEFINITION_MISSING') as review_enrich,
    count(*) filter (where f::text !~ 'AI_POS_SENSE_REVIEW_REJECTED|AI_SINGLE_TRANSLATION_REQUIRED|AI_REQUESTED_EXAMPLE_MISSING|AI_SOURCE_PERIOD_CHANGED_TO_NEW_MOON|pos_mismatch_filtered|SELECTED_BM_ARTICLE_REQUIRED|SELECTED_ARTICLE_DEFINITION_MISSING') as other_enrich
  from jobs j
  cross join lateral jsonb_array_elements(case when jsonb_typeof(j.summary->'enrichment_failed_items') = 'array'
    then j.summary->'enrichment_failed_items' else '[]'::jsonb end) f
  group by j.id
)
select to_char(j.created_at at time zone 'Europe/Oslo', 'MM-DD HH24:MI') as created,
       left(j.id::text, 8) as job,
       coalesce(g.review_gate, 0) as review_gate,
       coalesce(g.blocking_gate, 0) as blocking_gate,
       coalesce(e.review_enrich, 0) as review_enrich,
       coalesce(e.other_enrich, 0) as other_enrich,
       coalesce(j.summary->>'supervisor_failed_step', '-') as technical_step,
       case when coalesce(g.blocking_gate, 0) = 0 and coalesce(e.other_enrich, 0) = 0
              and j.summary->>'supervisor_failed_step' is null
              and coalesce(j.summary->>'supervisor_last_error', '') !~ 'promotion|timeout|deferred retries|No official Bokm'
            then 'completed_with_review' else 'still_needs_manual_review' end as would_be
from jobs j
left join gate g on g.job_id = j.id
left join enrich e on e.job_id = j.id
order by j.created_at desc;
