-- ============================================================================
-- 20260704090000_sync_lexeme_translation_columns.sql
--
-- Проблема: lexemes.translation_ua/translation_en (прямые колонки, которые
-- читает основной экран приложения через LEXEME_SELECT) не были ничем
-- синхронизированы с entity_translations (таблица с source-трекингом,
-- в которую пишут lexin-enrichment-worker, naob-*, ordbokene-*, ai-fallback).
--
-- Решение: единый DB-триггер, срабатывающий на любое изменение
-- entity_translations, который пересчитывает лучший uk/en перевод
-- и кладёт его в lexemes.translation_ua/translation_en. Это устраняет
-- необходимость дублировать логику синхронизации в каждом воркере.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Функция выбора и записи лучшего перевода для одной лексемы
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_lexeme_translation_columns(p_lexeme_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
declare
  v_best_uk text;
  v_best_en text;
begin
  if p_lexeme_id is null then
    return;
  end if;

  select translation into v_best_uk
  from public.entity_translations
  where lexeme_id = p_lexeme_id
    and language_code = 'uk'
    and translation_type in ('primary', 'expression_primary')
  order by
    case lower(coalesce(source, ''))
      when 'manual_verified' then 1
      when 'lexin' then 2
      when 'ai_fallback' then 3
      else 9
    end,
    coalesce(translation_rank, 999)
  limit 1;

  select translation into v_best_en
  from public.entity_translations
  where lexeme_id = p_lexeme_id
    and language_code = 'en'
    and translation_type in ('primary', 'expression_primary')
  order by
    case lower(coalesce(source, ''))
      when 'manual_verified' then 1
      when 'lexin' then 2
      when 'ai_fallback' then 3
      else 9
    end,
    coalesce(translation_rank, 999)
  limit 1;

  update public.lexemes
  set
    translation_ua = coalesce(v_best_uk, translation_ua),
    translation_en = coalesce(v_best_en, translation_en),
    updated_at = now()
  where id = p_lexeme_id
    and (
      translation_ua is distinct from coalesce(v_best_uk, translation_ua)
      or translation_en is distinct from coalesce(v_best_en, translation_en)
    );
end;
$function$;


-- ----------------------------------------------------------------------------
-- 2. Триггерная функция — вызывается на INSERT/UPDATE/DELETE entity_translations
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_lexeme_translation_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  if TG_OP = 'DELETE' then
    perform public.sync_lexeme_translation_columns(OLD.lexeme_id);
    return OLD;
  end if;

  perform public.sync_lexeme_translation_columns(NEW.lexeme_id);

  -- на случай если lexeme_id у строки поменяли (редкий кейс) —
  -- пересчитать и старую лексему тоже
  if TG_OP = 'UPDATE' and OLD.lexeme_id is distinct from NEW.lexeme_id then
    perform public.sync_lexeme_translation_columns(OLD.lexeme_id);
  end if;

  return NEW;
end;
$function$;


-- ----------------------------------------------------------------------------
-- 3. Сам триггер
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS entity_translations_sync_lexeme_columns ON public.entity_translations;

CREATE TRIGGER entity_translations_sync_lexeme_columns
AFTER INSERT OR UPDATE OR DELETE ON public.entity_translations
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_lexeme_translation_columns();


-- ----------------------------------------------------------------------------
-- 4. Backfill — синхронизировать все существующие лексемы один раз,
--    чтобы устранить уже накопившийся рассинхрон (например, случаи,
--    когда translation_ua был записан напрямую в обход entity_translations
--    и с тех пор никогда не пересчитывался).
-- ----------------------------------------------------------------------------
DO $$
declare
  v_lexeme_id uuid;
begin
  for v_lexeme_id in
    select distinct lexeme_id
    from public.entity_translations
    where lexeme_id is not null
  loop
    perform public.sync_lexeme_translation_columns(v_lexeme_id);
  end loop;
end $$;