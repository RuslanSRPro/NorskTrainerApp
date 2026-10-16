-- 54_d10_forms_v2_resolver_checks.sql
-- Read-only, one statement. Run BEFORE and AFTER migration 20261011140000.
--   A  rows left in the legacy form tables (expected 0 since the V2 cutover)
--   B  size of the canonical V2 forms projection
--   C  which source collect_surface_candidates reads (after: v2_forms)
--   D  of 300 V2 form values, how many resolve to their own lexeme
--      (before: only base forms equal to the lemma; after: expected 300)
--   E  candidates for a few inflected words (lemma / POS / form / source)

with sample as (
  select f.lexeme_id, v.value
  from public.lexeme_form_display_v2 f
  cross join lateral unnest(f.primary_values) as v(value)
  where f.dictionary_code = 'bm'
  order by f.lexeme_id, f.form_key, v.value
  limit 300
)
select 'A_legacy_rows' as check_name, 'verb_forms' as detail, (select count(*) from public.verb_forms)::text as value
union all select 'A_legacy_rows', 'noun_forms', (select count(*) from public.noun_forms)::text
union all select 'A_legacy_rows', 'adjective_forms', (select count(*) from public.adjective_forms)::text
union all select 'A_legacy_rows', 'lexeme_form_variants', (select count(*) from public.lexeme_form_variants)::text
union all select 'B_v2_forms', 'rows / lexemes',
  (select count(*)::text || ' / ' || count(distinct lexeme_id)::text from public.lexeme_form_display_v2 where dictionary_code = 'bm')
union all select 'C_collector_source', 'collect_surface_candidates',
  case
    when pg_get_functiondef('public.collect_surface_candidates(text)'::regprocedure) like '%lexeme_form_display_v2%'
     and pg_get_functiondef('public.collect_surface_candidates(text)'::regprocedure) not like '%from public.verb_forms%'
    then 'v2_forms' else 'legacy_tables' end
union all select 'D_v2_values_resolved', 'own lexeme found / sampled',
  (select count(*) filter (where exists (
      select 1 from public.resolve_surface_form_v2(s.value) r where r.lexeme_id = s.lexeme_id
    ))::text || ' / ' || count(*)::text
   from sample s)
union all
select 'E_example', q.word,
  coalesce((select string_agg(r.lemma || ' ' || r.pos || ' ' || coalesce(r.form_types::text, '') || ' ' || coalesce(r.sources::text, ''), ' | ')
            from public.resolve_surface_form_v2(q.word) r), '(no candidates)')
from (values ('gikk'), ('huset'), ('barna'), ('tok'), ('fint'), ('bedre')) q(word)
order by 1, 2;
