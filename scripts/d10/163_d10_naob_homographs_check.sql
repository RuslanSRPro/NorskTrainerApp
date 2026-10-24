-- 163: D10_naob_homographs_v1 check. Read only.
-- A: objects installed (all PASS).
-- B: NAOB division of each noun: article -> decision -> card.
-- C: the cards of brenne (noun) with their canonical translation.
-- D: items of the last job for nouns divided by NAOB.
with a as (
  select 'A1 table cards' as k, to_regclass('private.d10_naob_homograph_cards_v1') is not null as ok
  union all select 'A2 table job ledger', to_regclass('private.d10_job_naob_split_v1') is not null
  union all select 'A3 candidates fn', to_regprocedure('public.d10_naob_split_candidates_for_job_v1(uuid,integer)') is not null
  union all select 'A4 record fn', to_regprocedure('public.d10_record_naob_homograph_v1(uuid,text,text,integer,text,jsonb,uuid)') is not null
  union all select 'A5 binding fn', to_regprocedure('public.d10_naob_card_binding_v1(uuid)') is not null
  union all select 'A6 grey link by key', position($m$v_item.result_summary->>'homograph_key'$m$ in
      pg_get_functiondef('public.d10_promote_gray_pos_clones_v1(uuid)'::regprocedure)) > 0
)
select k, case when ok then 'PASS' else 'FAIL' end as v from a
union all
select 'B ' || m.lemma || ' ' || c.slug,
  c.decision || coalesce(' -> ' || nullif(coalesce(cl.homograph_key, ''), ''), case when c.card_lexeme_id = c.main_lexeme_id then ' -> main' else '' end)
  || ' | ' || coalesce(c.evidence->>'reason', '') || ' | ' || coalesce(left(c.definition, 80), '-')
from private.d10_naob_homograph_cards_v1 c
join public.lexemes m on m.id = c.main_lexeme_id
left join public.lexemes cl on cl.id = c.card_lexeme_id
union all
select 'C brenne noun ' || coalesce(nullif(l.homograph_key, ''), 'I') || ' ' || t.language_code, left(t.translation, 80)
from public.lexemes l
cross join lateral public.get_canonical_lexeme_translations_v1(array[l.id]) t
where l.lemma = 'brenne' and l.pos = 'noun'
union all
select 'C brenne noun ' || coalesce(nullif(l.homograph_key, ''), 'I') || ' forms',
  coalesce((select string_agg(n.form_key || '=' || array_to_string(n.primary_values, '/'), '; ' order by n.display_order)
            from public.lexeme_naob_forms_v1 n where n.lexeme_id = l.id), '-')
from public.lexemes l where l.lemma = 'brenne' and l.pos = 'noun'
union all
select 'D ' || coalesce(i.normalized_lemma, '?') || ' ' || coalesce(i.result_summary->>'homograph_key', 'I'),
  i.current_stage || ' ' || coalesce(i.result_summary->>'promotion_status', '') || ' '
  || coalesce(i.result_summary->>'promotion_version', '') || ' ' || left(coalesce(i.lexeme_id::text, '-'), 8)
from public.lexeme_processing_items i
where i.job_id = (select j.job_id from public.lexeme_processing_items j order by j.created_at desc limit 1)
  and i.pos = 'noun'
  and exists (select 1 from private.d10_naob_homograph_cards_v1 c join public.lexemes m on m.id = c.main_lexeme_id
              where m.lemma = i.normalized_lemma)
order by 1;
