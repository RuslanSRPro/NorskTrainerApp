-- 154b: hide bære II from learning and the normal word lists (agreed
-- 20.10.2026, option a). Nothing is deleted: the card, its article binding
-- 8440, the homograph decision and every link stay. The previous values are
-- saved in private.d10_hidden_cards_v1, so it can be restored.
-- Stops if the card is not found exactly once or a user-progress table
-- of the app (public schema, name with progress / user / learn / srs)
-- points to it. Service tables (d10_*, review marks) do not block.
-- Run ONLY after 154 was checked.

create table if not exists private.d10_hidden_cards_v1 (
  lexeme_id uuid primary key references public.lexemes(id) on delete cascade,
  reason text not null,
  previous jsonb not null,
  hidden_at timestamptz not null default now()
);
revoke all on table private.d10_hidden_cards_v1 from public, anon, authenticated;

do $hide$
declare
  v_id uuid;
  v_n integer;
  v_prog integer := 0;
  r record;
begin
  select count(*) into v_n from public.lexemes l
  where l.lemma = 'bære' and l.pos = 'verb' and l.homograph_key = 'II';
  if v_n <> 1 then
    raise exception 'bære II found % times (expected 1); nothing changed', v_n;
  end if;
  select l.id into v_id from public.lexemes l
  where l.lemma = 'bære' and l.pos = 'verb' and l.homograph_key = 'II';

  for r in
    select c.table_schema, c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type = 'uuid'
      and c.column_name like '%lexeme_id'
      and c.table_name ~ '(progress|user|learn|srs)'
      and c.table_name !~ '^d10_'
  loop
    execute format('select count(*) from %I.%I where %I = $1', r.table_schema, r.table_name, r.column_name)
      into v_n using v_id;
    v_prog := v_prog + v_n;
  end loop;
  if v_prog > 0 then
    raise exception 'bære II is referenced by % user-progress rows; nothing changed. Send query 154.', v_prog;
  end if;

  insert into private.d10_hidden_cards_v1 (lexeme_id, reason, previous)
  select l.id, 'd10_r9_false_card_no_own_forms_8440',
    jsonb_build_object('dictionary_status', l.dictionary_status,
      'dictionary_exclusion_reason', l.dictionary_exclusion_reason,
      'is_learning_lexeme', l.is_learning_lexeme)
  from public.lexemes l where l.id = v_id
  on conflict (lexeme_id) do nothing;

  update public.lexemes l
  set dictionary_status = 'excluded',
      dictionary_exclusion_reason = 'd10_r9_false_card_no_own_forms_8440',
      is_learning_lexeme = false,
      updated_at = now()
  where l.id = v_id;

  raise notice 'bære II hidden (%), previous values saved in private.d10_hidden_cards_v1', v_id;
end
$hide$;
