-- 154: bære II before hiding it. Read only.
-- C: the card itself. R: every table with a lexeme column that points to it
-- (user progress, learning lists, expressions, translations, links...).
-- Only tables with at least one row are listed.
with card as (
  select l.id from public.lexemes l
  where l.lemma = 'bære' and l.pos = 'verb' and l.homograph_key = 'II'
),
cols as (
  select c.table_schema, c.table_name, c.column_name
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema in ('public', 'private')
    and c.data_type = 'uuid'
    and (c.column_name like '%lexeme_id' or c.column_name like '%lexeme_ids')
    and not (c.table_schema = 'public' and c.table_name = 'lexemes')
),
counts as (
  select k.table_schema || '.' || k.table_name || '.' || k.column_name as ref,
    (xpath('/row/n/text()', query_to_xml(format(
      'select count(*) as n from %I.%I where %I = %L::uuid',
      k.table_schema, k.table_name, k.column_name, (select id from card limit 1)),
      false, true, '')))[1]::text::integer as n
  from cols k
  where (select count(*) from card) = 1
)
select 'C ' || left(l.id::text, 8) as k,
  l.lemma || ' ' || l.pos || ' ' || l.homograph_key || ' status=' || coalesce(l.dictionary_status, '-')
  || ' learning=' || coalesce(l.is_learning_lexeme::text, '-') as v
from public.lexemes l join card on card.id = l.id
union all
select 'R ' || ref, n::text from counts where n > 0
union all
select 'X cards found', (select count(*) from card)::text
order by 1;
