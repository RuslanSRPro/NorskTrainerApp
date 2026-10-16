-- 55_d10_app_test_jobs.sql
-- Read-only, one statement. Shows the 5 most recent analysis jobs with what
-- was written for them, to check the app test:
--   reading mode  -> analysing a text creates NO job;
--   "Save to database" -> one job, isolated word list, only the selected words;
--   audit mode    -> one job with every word of the text.
-- Per job: status, word-list flag, number of items, and surface -> lemma (POS)
-- for token items (shows that inflected forms resolve to their lemma) and the
-- expressions found.
select
  j.created_at,
  j.id as job_id,
  j.status,
  coalesce(s.stage, '-') as supervisor_stage,
  coalesce((j.summary->>'isolated_mode')::boolean, false) as word_list,
  left(coalesce(j.input_text, ''), 80) as input_text,
  (select count(*) from public.lexeme_processing_items i where i.job_id = j.id) as items,
  (select string_agg(distinct i.surface_form || '→' || coalesce(i.normalized_lemma, '?') || ' (' || coalesce(i.pos, '?') || ')', ', ')
     from public.lexeme_processing_items i
    where i.job_id = j.id and i.match_type = 'token') as tokens,
  (select string_agg(distinct coalesce(i.normalized_lemma, i.surface_form), ', ')
     from public.lexeme_processing_items i
    where i.job_id = j.id and i.match_type = 'expression') as expressions
from public.lexeme_processing_jobs j
left join public.pipeline_supervisor_state s on s.job_id = j.id
order by j.created_at desc
limit 5;
