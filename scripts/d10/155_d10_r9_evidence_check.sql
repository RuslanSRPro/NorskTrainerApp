-- 155: D10_r9_evidence_v1 check. Read only.
-- A: functions patched (all PASS).
-- B: homograph articles held back for review by the new rule (after a run).
-- C: bære II status (after 154b: excluded, learning=false).
select 'A1 gray: never changes a card' as k,
  case when position('d10_gray_existing_card_v2' in pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure)) > 0
        and position('verification_tier = ''ai_candidate'',' in pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure)) = 0
       then 'PASS' else 'FAIL' end as v
union all
select 'A2 homograph: skips excluded',
  case when position('d10_skip_excluded' in pg_get_functiondef('public.d10_existing_homograph_cards_for_job_v1(uuid)'::regprocedure)) > 0
       then 'PASS' else 'FAIL' end
union all
select 'B ' || l.lemma || ' ' || l.pos || ' art ' || d.article_id, d.evidence->>'reason'
from private.d10_homograph_article_decisions_v1 d
join public.lexemes l on l.id = d.main_lexeme_id
where d.evidence->>'reason' in ('r9_guard_no_own_forms', 'r9_guard_no_own_meaning')
union all
select 'C ' || l.lemma || ' ' || l.pos || ' ' || l.homograph_key,
  coalesce(l.dictionary_status, '-') || ' learning=' || coalesce(l.is_learning_lexeme::text, '-')
from public.lexemes l
where l.lemma = 'bære' and l.pos = 'verb'
order by 1;
