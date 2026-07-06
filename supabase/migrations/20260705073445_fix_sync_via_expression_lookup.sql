-- ============================================================================
-- 20260705110000_fix_sync_via_expression_lookup_not_lexeme_id_write.sql
--
-- ИСПРАВЛЯЕТ ПОДХОД из 20260705100000_..., который нарушал constraint
-- entity_translations_single_entity (строка не может иметь ОДНОВРЕМЕННО
-- lexeme_id и expression_id — только одно из двух).
--
-- Прежний backfill пытался проставить lexeme_id в строки, у которых уже
-- есть expression_id — это невозможно по дизайну схемы, отсюда ошибка
-- SQLSTATE 23514 при попытке применить миграцию.
--
-- Правильный подход: НЕ писать lexeme_id в entity_translations/entity_examples
-- для expression-строк вообще. Вместо этого триггеры синхронизации сами
-- смотрят: если у изменившейся строки есть expression_id (а lexeme_id
-- всегда null для таких строк) — резолвят lexeme_id через
-- expression_catalog.lexeme_id и синхронизируют ЕГО lexemes.translation_ua/
-- en/example, не пытаясь модифицировать саму entity_translations строку.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. sync_lexeme_translation_columns — расширяем, чтобы учитывать оба
--    источника перевода для лексемы: строки с lexeme_id = X (обычные слова)
--    И строки с expression_id, где expression_catalog.lexeme_id = X
--    (переводы выражения, которое стало лексемой).
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
  from (
    select translation, source, translation_rank
    from public.entity_translations
    where lexeme_id = p_lexeme_id
      and language_code = 'uk'
      and translation_type in ('primary', 'expression_primary')

    union all

    select et.translation, et.source, et.translation_rank
    from public.entity_translations et
    join public.expression_catalog ec on ec.id = et.expression_id
    where ec.lexeme_id = p_lexeme_id
      and et.language_code = 'uk'
      and et.translation_type in ('primary', 'expression_primary')
  ) combined
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
  from (
    select translation, source, translation_rank
    from public.entity_translations
    where lexeme_id = p_lexeme_id
      and language_code = 'en'
      and translation_type in ('primary', 'expression_primary')

    union all

    select et.translation, et.source, et.translation_rank
    from public.entity_translations et
    join public.expression_catalog ec on ec.id = et.expression_id
    where ec.lexeme_id = p_lexeme_id
      and et.language_code = 'en'
      and et.translation_type in ('primary', 'expression_primary')
  ) combined
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
-- 2. Триггерная функция — теперь резолвит lexeme_id ЧЕРЕЗ expression_catalog,
--    если у изменившейся строки есть expression_id, а не lexeme_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_lexeme_translation_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
declare
  v_lexeme_id uuid;
  v_old_lexeme_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_old_lexeme_id := OLD.lexeme_id;
    if v_old_lexeme_id is null and OLD.expression_id is not null then
      select lexeme_id into v_old_lexeme_id
      from public.expression_catalog
      where id = OLD.expression_id;
    end if;
    perform public.sync_lexeme_translation_columns(v_old_lexeme_id);
    return OLD;
  end if;

  v_lexeme_id := NEW.lexeme_id;
  if v_lexeme_id is null and NEW.expression_id is not null then
    select lexeme_id into v_lexeme_id
    from public.expression_catalog
    where id = NEW.expression_id;
  end if;

  perform public.sync_lexeme_translation_columns(v_lexeme_id);

  if TG_OP = 'UPDATE' then
    v_old_lexeme_id := OLD.lexeme_id;
    if v_old_lexeme_id is null and OLD.expression_id is not null then
      select lexeme_id into v_old_lexeme_id
      from public.expression_catalog
      where id = OLD.expression_id;
    end if;

    if v_old_lexeme_id is distinct from v_lexeme_id then
      perform public.sync_lexeme_translation_columns(v_old_lexeme_id);
    end if;
  end if;

  return NEW;
end;
$function$;


-- ----------------------------------------------------------------------------
-- 3. То же самое расширение для example-синхронизации.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_lexeme_example_column(p_lexeme_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
declare
  v_best_example text;
begin
  if p_lexeme_id is null then
    return;
  end if;

  select example_text into v_best_example
  from (
    select example_text, source, created_at
    from public.entity_examples
    where lexeme_id = p_lexeme_id
      and language_code = 'nb'

    union all

    select ee.example_text, ee.source, ee.created_at
    from public.entity_examples ee
    join public.expression_catalog ec on ec.id = ee.expression_id
    where ec.lexeme_id = p_lexeme_id
      and ee.language_code = 'nb'
  ) combined
  order by
    case lower(coalesce(source, ''))
      when 'manual_verified' then 1
      when 'naob' then 2
      when 'ordbokene' then 2
      when 'lexin' then 3
      when 'ai_fallback' then 4
      else 9
    end,
    created_at
  limit 1;

  update public.lexemes
  set
    example = coalesce(v_best_example, example),
    updated_at = now()
  where id = p_lexeme_id
    and example is distinct from coalesce(v_best_example, example);
end;
$function$;


CREATE OR REPLACE FUNCTION public.trg_sync_lexeme_example_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
declare
  v_lexeme_id uuid;
  v_old_lexeme_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_old_lexeme_id := OLD.lexeme_id;
    if v_old_lexeme_id is null and OLD.expression_id is not null then
      select lexeme_id into v_old_lexeme_id
      from public.expression_catalog
      where id = OLD.expression_id;
    end if;
    perform public.sync_lexeme_example_column(v_old_lexeme_id);
    return OLD;
  end if;

  v_lexeme_id := NEW.lexeme_id;
  if v_lexeme_id is null and NEW.expression_id is not null then
    select lexeme_id into v_lexeme_id
    from public.expression_catalog
    where id = NEW.expression_id;
  end if;

  perform public.sync_lexeme_example_column(v_lexeme_id);

  if TG_OP = 'UPDATE' then
    v_old_lexeme_id := OLD.lexeme_id;
    if v_old_lexeme_id is null and OLD.expression_id is not null then
      select lexeme_id into v_old_lexeme_id
      from public.expression_catalog
      where id = OLD.expression_id;
    end if;

    if v_old_lexeme_id is distinct from v_lexeme_id then
      perform public.sync_lexeme_example_column(v_old_lexeme_id);
    end if;
  end if;

  return NEW;
end;
$function$;


DROP TRIGGER IF EXISTS entity_examples_sync_lexeme_example ON public.entity_examples;

CREATE TRIGGER entity_examples_sync_lexeme_example
AFTER INSERT OR UPDATE OR DELETE ON public.entity_examples
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_lexeme_example_column();


-- ----------------------------------------------------------------------------
-- 4. Пересчёт для всех уже существующих expression_catalog.lexeme_id —
--    НИКАКОГО backfill-UPDATE в entity_translations/entity_examples не
--    делаем (это и было причиной ошибки). Просто пересчитываем lexemes
--    через уже готовую функцию, которая теперь сама умеет искать через
--    expression_id.
-- ----------------------------------------------------------------------------
DO $$
declare
  v_lexeme_id uuid;
begin
  for v_lexeme_id in
    select distinct lexeme_id
    from public.expression_catalog
    where lexeme_id is not null
  loop
    perform public.sync_lexeme_translation_columns(v_lexeme_id);
    perform public.sync_lexeme_example_column(v_lexeme_id);
  end loop;
end $$;