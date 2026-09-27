-- Restore the D10 card display contract while keeping entity_translations as
-- the only translation store: words show up to 3 UK / 2 EN article meanings;
-- expression lexemes show one translation per language.
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
  ), request_kind as (
    select
      requested.lexeme_id,
      exists (
        select 1
        from public.expression_catalog expression
        where expression.lexeme_id = requested.lexeme_id
      ) as is_expression
    from requested
  ), candidates as (
    select
      translation.lexeme_id,
      translation.language_code,
      coalesce(
        nullif(btrim(translation.canonical_translation), ''),
        btrim(translation.translation)
      ) as translation,
      translation.source,
      translation.source_entry_id,
      translation.entry_order,
      translation.sense_rank,
      translation.translation_rank,
      translation.id,
      request_kind.is_expression
    from public.entity_translations translation
    join request_kind on request_kind.lexeme_id = translation.lexeme_id
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
      translation.source_entry_id,
      translation.entry_order,
      translation.sense_rank,
      translation.translation_rank,
      translation.id,
      true as is_expression
    from public.expression_catalog expression
    join requested on requested.lexeme_id = expression.lexeme_id
    join public.entity_translations translation
      on translation.expression_id = expression.id
    where translation.lexeme_id is null
      and translation.language_code in ('uk', 'en')
      and translation.translation_type in ('primary', 'expression_primary')
      and nullif(btrim(translation.translation), '') is not null
  ), article_ranked as (
    select
      candidates.*,
      row_number() over (
        partition by
          candidates.lexeme_id,
          candidates.language_code,
          candidates.source,
          coalesce(
            candidates.source_entry_id::text,
            case
              when candidates.source in ('ai_fallback', 'manual_verified')
                then candidates.source
              else candidates.id::text
            end
          )
        order by
          case when nullif(btrim(candidates.translation), '') is null then 1 else 0 end,
          coalesce(candidates.sense_rank, 999),
          coalesce(candidates.translation_rank, 999),
          candidates.id
      ) as article_rank
    from candidates
  ), article_winners as (
    select *
    from article_ranked
    where article_rank = 1
  ), deduplicated as (
    select
      article_winners.*,
      row_number() over (
        partition by
          article_winners.lexeme_id,
          article_winners.language_code,
          lower(btrim(article_winners.translation))
        order by
          case lower(coalesce(article_winners.source, ''))
            when 'manual_verified' then 1
            when 'lexin' then 2
            when 'ai_fallback' then 3
            else 9
          end,
          coalesce(article_winners.entry_order, 999999),
          coalesce(article_winners.sense_rank, 999),
          coalesce(article_winners.translation_rank, 999),
          article_winners.id
      ) as duplicate_rank
    from article_winners
  ), display_ranked as (
    select
      deduplicated.*,
      row_number() over (
        partition by deduplicated.lexeme_id, deduplicated.language_code
        order by
          case lower(coalesce(deduplicated.source, ''))
            when 'manual_verified' then 1
            when 'lexin' then 2
            when 'ai_fallback' then 3
            else 9
          end,
          coalesce(deduplicated.entry_order, 999999),
          coalesce(deduplicated.sense_rank, 999),
          coalesce(deduplicated.translation_rank, 999),
          deduplicated.id
      ) as display_rank
    from deduplicated
    where deduplicated.duplicate_rank = 1
  ), limited as (
    select *
    from display_ranked
    where display_rank <= case
      when is_expression then 1
      when language_code = 'uk' then 3
      else 2
    end
  )
  select
    limited.lexeme_id,
    limited.language_code,
    string_agg(limited.translation, ', ' order by limited.display_rank) as translation
  from limited
  group by limited.lexeme_id, limited.language_code
  order by limited.lexeme_id, limited.language_code;
$function$;

revoke all on function public.get_canonical_lexeme_translations_v1(uuid[])
  from public, anon;
grant execute on function public.get_canonical_lexeme_translations_v1(uuid[])
  to authenticated;

commit;
