-- 149: D10_naob_forms_v1 check. Read only.
-- A: objects installed (all PASS).
-- B: NAOB forms written (after the probe or a run).
-- C: words sent for review.
-- D: "brennen" in a text -> brenne (noun).
with a as (
  select 'A1 table' as k, to_regclass('public.lexeme_naob_forms_v1') is not null as ok
  union all select 'A2 review table', to_regclass('private.d10_naob_forms_review_v1') is not null
  union all select 'A3 publish fn', to_regprocedure('public.d10_publish_naob_forms_v1(uuid,jsonb,jsonb)') is not null
  union all select 'A4 review fn', to_regprocedure('public.d10_record_naob_forms_review_v1(uuid,text,jsonb)') is not null
  union all select 'A5 block C', position('lexeme_naob_forms_v1' in pg_get_functiondef('public.collect_surface_candidates(text)'::regprocedure)) > 0
  union all select 'A6 block B kept', position('lexeme_compound_head_forms_v1' in pg_get_functiondef('public.collect_surface_candidates(text)'::regprocedure)) > 0
)
select k, case when ok then 'PASS' else 'FAIL' end as res from a
union all
select 'B ' || n.lemma || ' ' || n.form_key,
  array_to_string(n.primary_values, ',')
  || coalesce(nullif(' (' || array_to_string(n.alternative_values, ',') || ')', ' ()'), '')
  || ' [' || array_to_string(n.accepted_articles, ',') || '] ' || array_to_string(n.naob_slugs, ',')
from public.lexeme_naob_forms_v1 n
union all
select 'C ' || l.lemma || ' ' || l.pos, r.reason || ' ' || left(r.detail::text, 200)
from private.d10_naob_forms_review_v1 r join public.lexemes l on l.id = r.lexeme_id
union all
select 'D brennen', c.lemma || ' ' || c.pos || ' ' || c.form_type || ' ' || c.source || ' ' || c.match_priority
from public.collect_surface_candidates('brennen') c
order by 1;
