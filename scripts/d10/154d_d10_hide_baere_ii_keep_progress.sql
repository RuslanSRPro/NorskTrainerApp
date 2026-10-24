-- 154d: hide bære II (agreed 20.10.2026, option a), for the case seen in 157:
--   * the user has bære I in learning too -> progress and reviews of bære II
--     are NOT moved and NOT deleted (they stay as history);
--   * expressions rooted at bære II get bære I as a root too (a new row,
--     the old one stays), so the 360 family of bære is complete;
--   * the card: dictionary_status 'excluded', is_learning_lexeme = false
--     (training and lists read only learning cards).
-- Nothing is deleted. Previous values + added rows are saved in
-- private.d10_hidden_cards_v1 (undo: 154e).
-- Stops if bære I / II are not found exactly once, or if some user learns
-- bære II WITHOUT bære I.

create table if not exists private.d10_hidden_cards_v1 (
  lexeme_id uuid primary key references public.lexemes(id) on delete cascade,
  reason text not null,
  previous jsonb not null,
  hidden_at timestamptz not null default now()
);
revoke all on table private.d10_hidden_cards_v1 from public, anon, authenticated;

do $hide$
declare
  v_main uuid;
  v_card uuid;
  v_n integer;
  v_roots jsonb;
begin
  select count(*) into v_n from public.lexemes l where l.lemma = 'bære' and l.pos = 'verb' and coalesce(l.homograph_key, '') = '';
  if v_n <> 1 then raise exception 'bære I found % times (expected 1); nothing changed', v_n; end if;
  select count(*) into v_n from public.lexemes l where l.lemma = 'bære' and l.pos = 'verb' and l.homograph_key = 'II';
  if v_n <> 1 then raise exception 'bære II found % times (expected 1); nothing changed', v_n; end if;
  select l.id into v_main from public.lexemes l where l.lemma = 'bære' and l.pos = 'verb' and coalesce(l.homograph_key, '') = '';
  select l.id into v_card from public.lexemes l where l.lemma = 'bære' and l.pos = 'verb' and l.homograph_key = 'II';

  if exists (select 1 from private.d10_hidden_cards_v1 h where h.lexeme_id = v_card) then
    raise notice 'bære II already hidden; nothing changed';
    return;
  end if;

  select count(*) into v_n
  from public.learning_progress p
  where p.lexeme_id = v_card
    and not exists (select 1 from public.learning_progress q where q.lexeme_id = v_main and q.user_id = p.user_id);
  if v_n > 0 then
    raise exception '% user(s) learn bære II without bære I; nothing changed. Ask before moving progress.', v_n;
  end if;

  -- expressions of bære II also rooted at bære I (new rows only)
  with added as (
    insert into private.lexeme360_expression_roots_v1
      (expression_id, root_lexeme_id, source_kind, dictionary_code, source_article_id, source_pos, evidence)
    select e.expression_id, v_main, e.source_kind, e.dictionary_code, e.source_article_id, e.source_pos,
      e.evidence || jsonb_build_object('d10_copied_from_hidden_card', v_card, 'd10_copied_at', now())
    from private.lexeme360_expression_roots_v1 e
    where e.root_lexeme_id = v_card
    on conflict (expression_id, root_lexeme_id) do nothing
    returning expression_id
  )
  select coalesce(jsonb_agg(expression_id), '[]'::jsonb) into v_roots from added;

  insert into private.d10_hidden_cards_v1 (lexeme_id, reason, previous)
  select l.id, 'd10_r9_false_card_no_own_forms_8440',
    jsonb_build_object('dictionary_status', l.dictionary_status,
      'dictionary_exclusion_reason', l.dictionary_exclusion_reason,
      'is_learning_lexeme', l.is_learning_lexeme,
      'main_lexeme_id', v_main,
      'added_root_expression_ids', v_roots)
  from public.lexemes l where l.id = v_card;

  update public.lexemes l
  set dictionary_status = 'excluded',
      dictionary_exclusion_reason = 'd10_r9_false_card_no_own_forms_8440',
      is_learning_lexeme = false,
      updated_at = now()
  where l.id = v_card;
end
$hide$;

-- result (shown in the SQL Editor)
select 'hidden ' || left(h.lexeme_id::text, 8) as k,
  'roots added to bære I: ' || jsonb_array_length(h.previous->'added_root_expression_ids')
  || ' | before: status=' || coalesce(h.previous->>'dictionary_status', '-')
  || ' learning=' || coalesce(h.previous->>'is_learning_lexeme', '-') as v
from private.d10_hidden_cards_v1 h
where h.reason = 'd10_r9_false_card_no_own_forms_8440'
union all
select 'now ' || coalesce(nullif(l.homograph_key, ''), 'I'),
  coalesce(l.dictionary_status, '-') || ' learning=' || coalesce(l.is_learning_lexeme::text, '-')
from public.lexemes l where l.lemma = 'bære' and l.pos = 'verb'
order by 1;
