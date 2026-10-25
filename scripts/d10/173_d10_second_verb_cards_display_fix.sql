-- 173: D10 (agreed 25.10.2026) display_form of the existing second VERB cards:
-- brenne I, være III, bære II (hidden) get 'å ' || lemma like their main card.
-- Nouns and adjectives are not touched. Previous values are saved in
-- private.d10_display_form_fixes_v1 (undo). Stops without changes if the
-- cards are not exactly the three seen in 172.
create table if not exists private.d10_display_form_fixes_v1 (
  lexeme_id uuid primary key,
  previous_display_form text,
  fixed_at timestamptz not null default now()
);
revoke all on table private.d10_display_form_fixes_v1 from public, anon, authenticated;

do $fix$
declare
  v_ids uuid[];
  v_n integer;
begin
  select array_agg(l.id order by l.lemma) into v_ids
  from public.lexemes l
  where l.pos = 'verb' and coalesce(l.homograph_key, '') <> ''
    and l.display_form = l.lemma;
  v_n := coalesce(cardinality(v_ids), 0);
  if v_n = 0 then raise notice 'no second verb card without å; nothing changed'; return; end if;

  if v_n <> 3 or (select count(*) from public.lexemes l where l.id = any(v_ids)
      and (l.lemma, l.homograph_key) in (('brenne', 'I'), ('være', 'III'), ('bære', 'II'))) <> 3 then
    raise exception 'expected brenne I, være III, bære II; found % card(s); nothing changed', v_n;
  end if;

  insert into private.d10_display_form_fixes_v1 (lexeme_id, previous_display_form)
  select l.id, l.display_form from public.lexemes l where l.id = any(v_ids)
  on conflict (lexeme_id) do nothing;

  update public.lexemes l set display_form = 'å ' || l.lemma, updated_at = now()
  where l.id = any(v_ids);
end
$fix$;

-- result: expected 3 rows "å brenne I", "å bære II", "å være III"
select l.display_form || ' ' || l.homograph_key as card, l.dictionary_status as status,
  coalesce(f.previous_display_form, '-') as was
from public.lexemes l
left join private.d10_display_form_fixes_v1 f on f.lexeme_id = l.id
where l.pos = 'verb' and coalesce(l.homograph_key, '') <> ''
order by 1;
