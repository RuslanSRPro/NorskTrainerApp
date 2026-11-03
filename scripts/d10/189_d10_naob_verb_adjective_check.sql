-- 189: NAOB forms of verbs and adjectives. Read only.
--   1_migration: the column and the new publish function are in place
--   2_candidates: up to 15 verb / adjective cards with no forms at all
--                 (no Ordbøkene forms, no compound forms, no NAOB forms):
--                 an Audit of one of them tests the package
--   3_published: verb / adjective cards that got NAOB forms, with the forms
--                (≈ = built by us)
--   4_review:    NAOB articles of a verb / adjective disagree (for review)
select '1_migration' as part,
  format('derived_rule column=%s  publish handles verbs=%s',
    exists (select 1 from information_schema.columns
            where table_schema = 'public' and table_name = 'lexeme_naob_forms_v1' and column_name = 'derived_rule'),
    position('derived_rule' in pg_get_functiondef('public.d10_publish_naob_forms_v1(uuid,jsonb,jsonb)'::regprocedure)) > 0) as v,
  null::timestamptz as at
union all
select * from (
  select '2_candidates', l.lemma || ' (' || l.pos || ') ' || left(l.id::text, 8), l.updated_at
  from public.lexemes l
  where l.pos in ('verb', 'adjective') and l.is_learning_lexeme
    and not exists (select 1 from public.lexeme_form_display_v2 f where f.lexeme_id = l.id)
    and not exists (select 1 from public.lexeme_compound_head_forms_v1 h where h.lexeme_id = l.id)
    and not exists (select 1 from public.lexeme_naob_forms_v1 n where n.lexeme_id = l.id)
    and l.lemma !~ '\s'
  order by l.updated_at desc
  limit 15) c
union all
select '3_published', n.lemma || ' (' || n.pos || ') ' || left(n.lexeme_id::text, 8) || ': ' ||
  string_agg(n.form_key || '=' || array_to_string(n.primary_values, '/') || case when n.derived_rule is not null then ' ≈' else '' end,
             '; ' order by n.display_order),
  max(n.updated_at)
from public.lexeme_naob_forms_v1 n
where n.pos in ('verb', 'adjective')
group by n.lemma, n.pos, n.lexeme_id
union all
select '4_review', l.lemma || ' (' || l.pos || '): ' || r.reason || ' ' || left(r.detail::text, 200), r.recorded_at
from private.d10_naob_forms_review_v1 r join public.lexemes l on l.id = r.lexeme_id
where l.pos in ('verb', 'adjective')
order by 1, 3 desc nulls last
limit 80;
