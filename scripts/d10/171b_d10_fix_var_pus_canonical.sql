-- 171b: D10 completes 171. The app shows coalesce(canonical_translation, translation);
-- 171 changed translation, but canonical_translation of the same two rows still
-- holds "слиз" / "mucus". This sets canonical_translation of ONLY those two rows
-- (already source manual_verified by 171). The old value is added to the undo
-- record of 171. Stops without changes if 171 has not been applied.
do $fix$
declare
  c_uk constant uuid := 'd0692808-323c-4990-bed7-e1fb8b04ec5f';
  c_en constant uuid := '82fa8b60-128a-4c80-b456-a6bf8cb9ad8e';
  v_n integer;
begin
  select count(*) into v_n
  from public.entity_translations t
  join private.d10_manual_translation_fixes_v1 f on f.entity_translation_id = t.id
  where t.id in (c_uk, c_en) and t.source = 'manual_verified'
    and t.translation = case t.language_code when 'uk' then 'гній' else 'pus' end;
  if v_n <> 2 then raise exception '171 not applied as expected (found % of 2); nothing changed', v_n; end if;

  update private.d10_manual_translation_fixes_v1 f
  set previous = f.previous || jsonb_build_object('canonical_translation_before_171b', t.canonical_translation)
  from public.entity_translations t
  where t.id = f.entity_translation_id and t.id in (c_uk, c_en)
    and not (f.previous ? 'canonical_translation_before_171b');

  update public.entity_translations t
  set canonical_translation = t.translation, updated_at = now()
  where t.id in (c_uk, c_en)
    and t.canonical_translation is distinct from t.translation;
end
$fix$;

-- result: expected shown uk гній, shown en pus
select 'shown ' || t.language_code as k, t.translation as v
from public.get_canonical_lexeme_translations_v1(array['33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8'::uuid]) t
union all
select 'row ' || t.language_code, 'translation=' || t.translation || ' canonical=' || coalesce(t.canonical_translation, '-') || ' source=' || t.source
from public.entity_translations t
where t.id in ('d0692808-323c-4990-bed7-e1fb8b04ec5f', '82fa8b60-128a-4c80-b456-a6bf8cb9ad8e')
order by 1;
