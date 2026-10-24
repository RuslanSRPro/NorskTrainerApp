-- 171c: D10 (agreed 24.10.2026) clears the wrong note of var (en var, pus,
-- 33c1d30e): "Форма минулого часу від дієслова 'være' (бути)." is left from the
-- time var was taken as a form of være. The example "ha var i øyekroken" stays.
-- The old note is added to the undo record of 171. Stops without changes if the
-- note is not exactly that text (already cleared or changed by someone).
do $fix$
declare
  c_lexeme constant uuid := '33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8';
  v_notes text;
begin
  select l.notes into v_notes from public.lexemes l
  where l.id = c_lexeme and l.lemma = 'var' and l.pos = 'noun';
  if not found then raise exception 'card var noun 33c1d30e not found; nothing changed'; end if;
  if v_notes is null then raise notice 'note already empty; nothing changed'; return; end if;
  if v_notes not like 'Форма минулого часу від дієслова%' then
    raise exception 'note differs: %; nothing changed', v_notes;
  end if;

  update private.d10_manual_translation_fixes_v1 f
  set previous = f.previous || jsonb_build_object('notes_before_171c', v_notes)
  where f.entity_translation_id = c_lexeme and f.reason = 'd10_var_pus_old_columns_20261024';
  if not found then raise exception '171 undo record not found; nothing changed'; end if;

  update public.lexemes l set notes = null, updated_at = now() where l.id = c_lexeme;
end
$fix$;

-- result: expected note '-', example kept
select 'note' as k, coalesce(l.notes, '-') as v from public.lexemes l where l.id = '33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8'
union all
select 'example', coalesce(l.example, '-') from public.lexemes l where l.id = '33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8'
union all
select 'undo has old note', (f.previous ? 'notes_before_171c')::text
from private.d10_manual_translation_fixes_v1 f
where f.entity_translation_id = '33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8'
order by 1;
