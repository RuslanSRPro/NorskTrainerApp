-- 197: cards of job 51a66573 after the verification. Read only.
-- Every card should show an accepted status (authoritative / multi_source ...)
-- or a "for review" mark.
with job as (select id from public.lexeme_processing_jobs where id::text like '51a66573%')
select distinct l.lemma || ' (' || l.pos || ') ' || left(l.id::text, 8) as card,
  coalesce(l.verification_status, 'NULL') || ' / ' || coalesce(l.verification_tier, '-')
  || ' / run=' || coalesce(l.last_verification_run, '-')
  || ' / bound=' || coalesce((l.verification_evidence->'Ordbokene_bound_article'->'article_ids')::text, '-')
  || ' / mark=' || coalesce((select r.reason from private.d10_ai_review_rejections_v1 r where r.lexeme_id = l.id), '-') as v
from public.lexeme_processing_items i join job on i.job_id = job.id
join public.lexemes l on l.id = i.lexeme_id
order by 1;
