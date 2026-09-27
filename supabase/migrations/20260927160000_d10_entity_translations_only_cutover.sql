-- Use entity_translations as the only translation store and expose one
-- deterministic batch read model for lexeme cards. Expression lexemes resolve
-- through expression_catalog.lexeme_id -> entity_translations.expression_id.
begin;

create or replace function public.get_canonical_lexeme_translations_v1(
  p_lexeme_ids uuid[]
)
returns table (
  lexeme_id uuid,
  language_code text,
  translation text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  with requested as (
    select distinct requested_id as lexeme_id
    from unnest(coalesce(p_lexeme_ids, '{}'::uuid[])) requested_id
    where requested_id is not null
  ), candidates as (
    select
      translation.lexeme_id,
      translation.language_code,
      coalesce(
        nullif(btrim(translation.canonical_translation), ''),
        btrim(translation.translation)
      ) as translation,
      translation.source,
      translation.sense_rank,
      translation.translation_rank,
      translation.id
    from public.entity_translations translation
    join requested on requested.lexeme_id = translation.lexeme_id
    where translation.expression_id is null
      and translation.language_code in ('uk', 'en')
      and translation.translation_type in ('primary', 'expression_primary')
      and nullif(btrim(translation.translation), '') is not null

    union all

    select
      expression.lexeme_id,
      translation.language_code,
      coalesce(
        nullif(btrim(translation.canonical_translation), ''),
        btrim(translation.translation)
      ) as translation,
      translation.source,
      translation.sense_rank,
      translation.translation_rank,
      translation.id
    from public.expression_catalog expression
    join requested on requested.lexeme_id = expression.lexeme_id
    join public.entity_translations translation
      on translation.expression_id = expression.id
    where translation.lexeme_id is null
      and translation.language_code in ('uk', 'en')
      and translation.translation_type in ('primary', 'expression_primary')
      and nullif(btrim(translation.translation), '') is not null
  ), ranked as (
    select
      candidates.*,
      row_number() over (
        partition by candidates.lexeme_id, candidates.language_code
        order by
          case lower(coalesce(candidates.source, ''))
            when 'manual_verified' then 1
            when 'lexin' then 2
            when 'ai_fallback' then 3
            else 9
          end,
          coalesce(candidates.sense_rank, 999),
          coalesce(candidates.translation_rank, 999),
          candidates.id
      ) as selection_rank
    from candidates
  )
  select ranked.lexeme_id, ranked.language_code, ranked.translation
  from ranked
  where ranked.selection_rank = 1
  order by ranked.lexeme_id, ranked.language_code;
$function$;

revoke all on function public.get_canonical_lexeme_translations_v1(uuid[])
  from public, anon;
grant execute on function public.get_canonical_lexeme_translations_v1(uuid[])
  to authenticated;

-- Remove both automatic and explicit bridges into lexemes.translation_ua/en.
drop trigger if exists entity_translations_sync_lexeme_columns
  on public.entity_translations;
drop function if exists public.trg_sync_lexeme_translation_columns();
drop function if exists public.sync_lexeme_translation_columns(uuid);

comment on column public.lexemes.translation_ua is
  'Deprecated D10 legacy column. Read translations from entity_translations through get_canonical_lexeme_translations_v1.';
comment on column public.lexemes.translation_en is
  'Deprecated D10 legacy column. Read translations from entity_translations through get_canonical_lexeme_translations_v1.';

commit;
