-- 153: D10_translation_cards_v1 check. Read only.
-- A: objects installed (all PASS).
-- B: items of the last job linked to an existing card (variant A).
-- C: Lexin R9 marks "for review".
-- D: AI "for review" marks of the last day.
-- E: canonical translations of the brenne verbs (after a new run).
with a as (
  select 'A1 gray fn variant A' as k,
    position('d10_gray_existing_card_v1' in pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure)) > 0 as ok
  union all select 'A2 clone path kept',
    position('multi_pos_evidence_expansion_known_pos' in pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure)) > 0
  union all select 'A3 lexin r9 table', to_regclass('private.d10_lexin_r9_review_v1') is not null
  union all select 'A4 lexin r9 record fn', to_regprocedure('public.d10_record_lexin_r9_review_v1(uuid,text,jsonb)') is not null
  union all select 'A5 lexin r9 clear fn', to_regprocedure('public.d10_clear_lexin_r9_review_v1(uuid)') is not null
  union all select 'A6 ai review mark fn', to_regprocedure('public.d10_record_ai_review_rejection_v1(uuid,text,jsonb,uuid)') is not null
),
last_job as (
  select i.job_id from public.lexeme_processing_items i order by i.created_at desc limit 1
)
select k, case when ok then 'PASS' else 'FAIL' end as res from a
union all
select 'B ' || i.normalized_lemma || ' ' || coalesce(i.pos, '?'),
  i.current_stage || ' ' || coalesce(i.result_summary->>'promotion_status', '') || ' '
  || coalesce(i.result_summary->>'promotion_version', '') || ' ' || left(coalesce(i.lexeme_id::text, ''), 8)
from public.lexeme_processing_items i, last_job j
where i.job_id = j.job_id
  and (i.current_stage = 'admission_gate' or i.result_summary->>'promotion_status' = 'promoted_gray')
union all
select 'C ' || l.lemma || ' ' || l.pos || ' ' || left(l.id::text, 8), r.reason || ' ' || left(r.detail::text, 200)
from private.d10_lexin_r9_review_v1 r join public.lexemes l on l.id = r.lexeme_id
union all
select 'D ' || l.lemma || ' ' || l.pos || ' ' || left(l.id::text, 8), r.reason
from private.d10_ai_review_rejections_v1 r join public.lexemes l on l.id = r.lexeme_id
where r.recorded_at > now() - interval '1 day'
union all
select 'E ' || l.lemma || ' ' || l.pos || ' ' || left(l.id::text, 8) || ' ' || c.language_code, left(c.translation, 80)
from public.lexemes l
cross join lateral public.get_canonical_lexeme_translations_v1(array[l.id]) c
where l.lemma = 'brenne' and l.pos = 'verb'
order by 1;
