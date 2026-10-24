-- 170: D10 where the translation of var (pus, 33c1d30e) lives and where it came from.
-- Read only, one result table.
--   t: every row of public.entity_translations for this card (the app reads only these)
--   l: old translation columns on the lexeme row itself (not shown by the app)
select 't ' || coalesce(t.language_code, '-') || ' ' || coalesce(t.translation_type, '-') as k,
       left((to_jsonb(t) - 'lexeme_id')::text, 900) as v
from public.entity_translations t
where t.lexeme_id = '33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8'
union all
select 'l ' || e.key, left(e.value::text, 300)
from public.lexemes l
cross join lateral jsonb_each(to_jsonb(l)) e
where l.id = '33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8'
  and (e.key ilike '%transl%' or e.key ilike '%ukr%' or e.key in ('notes', 'example', 'source', 'enrichment_status'))
order by 1;
