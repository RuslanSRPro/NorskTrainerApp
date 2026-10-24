-- 171: D10 fix of one translation (agreed 24.10.2026): var (en var, "pus",
-- card 33c1d30e, Ordbøkene article 66620) was translated by AI as слиз / mucus.
-- The two AI rows in public.entity_translations become
--   uk 'гній' / en 'pus', source 'manual_verified'.
-- Why the source changes: AI enrichment deletes and rewrites only its own
-- 'ai_fallback' rows, and 'manual_verified' is shown first everywhere, so a
-- later run does not bring "слиз" back.
-- The old columns lexemes.translation_ua / translation_en ("був" / "was",
-- not read by the app) get the same values. Nothing else changes.
-- Previous values are saved in private.d10_manual_translation_fixes_v1.
-- Stops without changes if the rows are not exactly as seen in 170.

create table if not exists private.d10_manual_translation_fixes_v1 (
  entity_translation_id uuid primary key,
  lexeme_id uuid not null,
  reason text not null,
  previous jsonb not null,
  fixed_at timestamptz not null default now()
);
revoke all on table private.d10_manual_translation_fixes_v1 from public, anon, authenticated;

do $fix$
declare
  c_lexeme constant uuid := '33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8';
  c_uk constant uuid := 'd0692808-323c-4990-bed7-e1fb8b04ec5f';
  c_en constant uuid := '82fa8b60-128a-4c80-b456-a6bf8cb9ad8e';
  v_n integer;
begin
  if exists (select 1 from private.d10_manual_translation_fixes_v1 f where f.entity_translation_id in (c_uk, c_en)) then
    raise notice 'already fixed; nothing changed';
    return;
  end if;

  select count(*) into v_n from public.lexemes l
  where l.id = c_lexeme and l.lemma = 'var' and l.pos = 'noun';
  if v_n <> 1 then raise exception 'card var noun 33c1d30e not found; nothing changed'; end if;

  select count(*) into v_n from public.entity_translations t
  where t.lexeme_id = c_lexeme and t.translation_type = 'primary' and t.expression_id is null;
  if v_n <> 2 then raise exception 'expected 2 primary rows, found %; nothing changed', v_n; end if;

  select count(*) into v_n from public.entity_translations t
  where (t.id = c_uk and t.lexeme_id = c_lexeme and t.language_code = 'uk' and t.translation = 'слиз' and t.source = 'ai_fallback')
     or (t.id = c_en and t.lexeme_id = c_lexeme and t.language_code = 'en' and t.translation = 'mucus' and t.source = 'ai_fallback');
  if v_n <> 2 then raise exception 'rows differ from 170 (found % of 2); nothing changed', v_n; end if;

  insert into private.d10_manual_translation_fixes_v1 (entity_translation_id, lexeme_id, reason, previous)
  select t.id, c_lexeme, 'd10_var_pus_ai_mistranslation_20261024', to_jsonb(t)
  from public.entity_translations t where t.id in (c_uk, c_en);

  insert into private.d10_manual_translation_fixes_v1 (entity_translation_id, lexeme_id, reason, previous)
  select c_lexeme, c_lexeme, 'd10_var_pus_old_columns_20261024',
    jsonb_build_object('translation_ua', l.translation_ua, 'translation_en', l.translation_en)
  from public.lexemes l where l.id = c_lexeme;

  update public.entity_translations t
  set translation = case t.language_code when 'uk' then 'гній' else 'pus' end,
      source = 'manual_verified',
      confidence = 'high',
      notes = 'Manual fix 24.10.2026: Ordbøkene article 66620 (en var, pus); AI had "'
              || t.translation || '"',
      updated_at = now()
  where t.id in (c_uk, c_en);

  update public.lexemes l
  set translation_ua = 'гній', translation_en = 'pus', updated_at = now()
  where l.id = c_lexeme;
end
$fix$;

-- result: what the app shows now (expected uk гній, en pus)
select 'shown ' || t.language_code as k, t.translation as v
from public.get_canonical_lexeme_translations_v1(array['33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8'::uuid]) t
union all
select 'saved for undo', count(*)::text
from private.d10_manual_translation_fixes_v1 f
where f.lexeme_id = '33c1d30e-cb48-48e2-b770-b6fa0f2cc4a8'
order by 1;
