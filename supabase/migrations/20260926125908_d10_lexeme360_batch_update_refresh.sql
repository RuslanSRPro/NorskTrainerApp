-- Recompute Lexeme360 once per affected lexeme after a multi-row expression
-- UPDATE. INSERT/DELETE retain the existing row-level refresh behavior.
create or replace function private.refresh_lexeme360_expression_update_batch_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  affected_lexeme_id uuid;
begin
  for affected_lexeme_id in
    with changed_expressions as (
      select id from old_expression_rows
      union
      select id from new_expression_rows
    ),
    affected_roots as (
      select distinct binding.root_lexeme_id
      from private.lexeme360_expression_roots_v1 binding
      join changed_expressions changed on changed.id = binding.expression_id
    ),
    affected_lexemes as (
      select root_lexeme_id as id from affected_roots
      union
      select lexeme_id from old_expression_rows where lexeme_id is not null
      union
      select lexeme_id from new_expression_rows where lexeme_id is not null
      union
      select expression.lexeme_id
      from affected_roots root
      join private.lexeme360_expression_roots_v1 binding
        on binding.root_lexeme_id = root.root_lexeme_id
      join public.expression_catalog expression
        on expression.id = binding.expression_id
      where expression.lexeme_id is not null
    )
    select id from affected_lexemes order by id
  loop
    perform private.refresh_lexeme360_lexeme_v2(affected_lexeme_id);
  end loop;

  return null;
end;
$function$;

revoke all on function private.refresh_lexeme360_expression_update_batch_v1()
from public;

drop trigger if exists refresh_lexeme360_expression_v2
on public.expression_catalog;

create trigger refresh_lexeme360_expression_v2
after insert or delete on public.expression_catalog
for each row
execute function private.refresh_lexeme360_expression_trigger_v2();

create trigger refresh_lexeme360_expression_update_batch_v1
after update on public.expression_catalog
referencing old table as old_expression_rows new table as new_expression_rows
for each statement
execute function private.refresh_lexeme360_expression_update_batch_v1();
