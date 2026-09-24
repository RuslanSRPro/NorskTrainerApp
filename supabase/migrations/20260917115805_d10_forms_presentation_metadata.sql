-- D10 presentation metadata: materialize accepted Bokmal noun articles from
-- the authoritative Ordbokene paradigm tags. The client never infers gender.

alter table public.lexeme_form_display_v2
  add column accepted_articles text[] not null default '{}'::text[];

alter table public.lexeme_form_display_v2
  add constraint lexeme_form_display_v2_accepted_articles_check
  check (
    accepted_articles <@ array['en', 'ei', 'et']::text[]
    and cardinality(accepted_articles) <= 3
  );

create or replace function private.authoritative_noun_articles_v2(
  p_snapshot_id uuid,
  p_lemma text
)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  with source_articles(article) as (
    select distinct case
      when upper(tag.value) = 'MASC' then 'en'
      when upper(tag.value) = 'FEM' then 'ei'
      when upper(tag.value) = 'NEUTER' then 'et'
      else null
    end
    from private.authoritative_morphology_snapshot_sources_v2 as snapshot_source
    join private.authoritative_morphology_source_headwords_v2 as headword
      on headword.source_revision_id = snapshot_source.source_revision_id
    join private.authoritative_morphology_source_paradigms_v2 as paradigm
      on paradigm.source_headword_id = headword.id
    cross join lateral unnest(paradigm.paradigm_tags) as tag(value)
    where snapshot_source.snapshot_id = p_snapshot_id
      and paradigm.pos = 'noun'
      and headword.normalized_lemma = lower(btrim(p_lemma))
  )
  select coalesce(
    array_agg(article order by case article
      when 'en' then 1 when 'ei' then 2 when 'et' then 3 else 4 end)
      filter (where article is not null),
    '{}'::text[]
  )
  from source_articles;
$function$;

revoke all on function private.authoritative_noun_articles_v2(uuid, text)
  from public, anon, authenticated;

create or replace function private.set_authoritative_noun_articles_v2()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.accepted_articles := case
    when new.pos = 'noun' then private.authoritative_noun_articles_v2(
      new.snapshot_id,
      new.lemma
    )
    else '{}'::text[]
  end;
  return new;
end;
$function$;

revoke all on function private.set_authoritative_noun_articles_v2()
  from public, anon, authenticated;

create trigger set_authoritative_noun_articles_v2
before insert or update of snapshot_id, pos, lemma
on public.lexeme_form_display_v2
for each row execute function private.set_authoritative_noun_articles_v2();

update public.lexeme_form_display_v2 as display
set accepted_articles = case
  when display.pos = 'noun' then private.authoritative_noun_articles_v2(
    display.snapshot_id,
    display.lemma
  )
  else '{}'::text[]
end;

comment on column public.lexeme_form_display_v2.accepted_articles is
  'Ordered Bokmal articles materialized only from authoritative Ordbokene paradigm tags: en, ei, et.';

comment on function private.authoritative_noun_articles_v2(uuid, text) is
  'Internal source-structural noun article projection; never callable by application roles.';
