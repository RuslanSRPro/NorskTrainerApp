-- D10 / AUTHORITATIVE MORPHOLOGY V2.2 SOURCE CATALOG (PENDING)
-- Store each fetched Ordbokene revision once, then bind any number of
-- lexeme-specific snapshots to that immutable source evidence. This file must
-- be promoted with `supabase migration new` before production application.

create table private.authoritative_morphology_source_revisions_v2 (
  id uuid primary key default gen_random_uuid(),
  dictionary_code text not null check (dictionary_code = 'bm'),
  article_id bigint not null check (article_id > 0),
  source_url text not null check (source_url ~ '^https://ord[.]uib[.]no/'),
  source_article_version text,
  parser_version text not null check (btrim(parser_version) <> ''),
  source_payload jsonb not null check (jsonb_typeof(source_payload) = 'object'),
  payload_fingerprint text not null
    check (payload_fingerprint ~ '^[0-9a-f]{32}$'),
  first_checked_at timestamptz not null,
  last_checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (last_checked_at >= first_checked_at),
  constraint am_source_revision_identity_v2_key
    unique (dictionary_code, article_id, payload_fingerprint, parser_version),
  constraint am_source_revision_payload_hash_v2_check
    check (payload_fingerprint = md5(source_payload::text))
);

create index authoritative_morphology_source_revisions_v2_article_idx
  on private.authoritative_morphology_source_revisions_v2 (
    dictionary_code, article_id, last_checked_at desc
  );

create table private.authoritative_morphology_source_headwords_v2 (
  id uuid primary key default gen_random_uuid(),
  source_revision_id uuid not null references
    private.authoritative_morphology_source_revisions_v2(id) on delete cascade,
  lemma text not null check (btrim(lemma) <> ''),
  normalized_lemma text not null check (btrim(normalized_lemma) <> ''),
  created_at timestamptz not null default now(),
  constraint am_source_headword_identity_v2_key
    unique (source_revision_id, normalized_lemma)
);

create index authoritative_morphology_source_headwords_v2_revision_idx
  on private.authoritative_morphology_source_headwords_v2 (source_revision_id);
create index authoritative_morphology_source_headwords_v2_lemma_idx
  on private.authoritative_morphology_source_headwords_v2 (normalized_lemma);

create table private.authoritative_morphology_source_paradigms_v2 (
  id uuid primary key default gen_random_uuid(),
  source_headword_id uuid not null references
    private.authoritative_morphology_source_headwords_v2(id) on delete cascade,
  pos text not null
    check (pos in ('verb', 'noun', 'adjective', 'determiner')),
  paradigm_id text not null check (btrim(paradigm_id) <> ''),
  identity text not null check (btrim(identity) <> ''),
  paradigm_tags text[] not null default '{}'::text[],
  inflection_group text,
  standardisation text,
  created_at timestamptz not null default now(),
  constraint am_source_paradigm_dimensions_v2_key
    unique (source_headword_id, pos, paradigm_id),
  constraint am_source_paradigm_identity_v2_key
    unique (source_headword_id, identity)
);

create index authoritative_morphology_source_paradigms_v2_headword_idx
  on private.authoritative_morphology_source_paradigms_v2 (source_headword_id);

create table private.authoritative_morphology_source_forms_v2 (
  id uuid primary key default gen_random_uuid(),
  source_paradigm_id uuid not null references
    private.authoritative_morphology_source_paradigms_v2(id) on delete cascade,
  form_key text not null check (btrim(form_key) <> ''),
  value text not null check (btrim(value) <> ''),
  normalized_value text not null check (btrim(normalized_value) <> ''),
  tags text[] not null default '{}'::text[],
  source_ordinal integer not null check (source_ordinal >= 0),
  created_at timestamptz not null default now(),
  constraint am_source_form_ordinal_v2_key
    unique (source_paradigm_id, source_ordinal)
);

create index authoritative_morphology_source_forms_v2_paradigm_idx
  on private.authoritative_morphology_source_forms_v2 (source_paradigm_id);
create index authoritative_morphology_source_forms_v2_normalized_value_idx
  on private.authoritative_morphology_source_forms_v2 (normalized_value);

create table private.authoritative_morphology_snapshot_sources_v2 (
  snapshot_id uuid not null references
    private.authoritative_morphology_snapshots_v2(id) on delete cascade,
  source_revision_id uuid not null references
    private.authoritative_morphology_source_revisions_v2(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint am_snapshot_source_v2_pkey
    primary key (snapshot_id, source_revision_id)
);

create index authoritative_morphology_snapshot_sources_v2_revision_idx
  on private.authoritative_morphology_snapshot_sources_v2 (source_revision_id);

create table public.lexeme_headword_aliases_v2 (
  dictionary_code text not null check (dictionary_code = 'bm'),
  article_id bigint not null check (article_id > 0),
  normalized_headword text not null check (btrim(normalized_headword) <> ''),
  pos text not null
    check (pos in ('verb', 'noun', 'adjective', 'determiner')),
  headword text not null check (btrim(headword) <> ''),
  lexeme_id uuid not null references public.lexemes(id) on delete cascade,
  source_revision_id uuid not null references
    private.authoritative_morphology_source_revisions_v2(id) on delete restrict,
  is_primary boolean not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lexeme_headword_aliases_v2_pkey
    primary key (dictionary_code, article_id, normalized_headword, pos)
);

create unique index lexeme_headword_aliases_v2_one_primary_idx
  on public.lexeme_headword_aliases_v2 (
    lexeme_id, dictionary_code, article_id, pos
  )
  where is_active and is_primary;
create index lexeme_headword_aliases_v2_lookup_idx
  on public.lexeme_headword_aliases_v2 (normalized_headword, pos)
  where is_active;
create index lexeme_headword_aliases_v2_lexeme_idx
  on public.lexeme_headword_aliases_v2 (lexeme_id);
create index lexeme_headword_aliases_v2_source_revision_idx
  on public.lexeme_headword_aliases_v2 (source_revision_id);

alter table private.authoritative_morphology_source_revisions_v2
  enable row level security;
alter table private.authoritative_morphology_source_revisions_v2
  force row level security;
alter table private.authoritative_morphology_source_headwords_v2
  enable row level security;
alter table private.authoritative_morphology_source_headwords_v2
  force row level security;
alter table private.authoritative_morphology_source_paradigms_v2
  enable row level security;
alter table private.authoritative_morphology_source_paradigms_v2
  force row level security;
alter table private.authoritative_morphology_source_forms_v2
  enable row level security;
alter table private.authoritative_morphology_source_forms_v2
  force row level security;
alter table private.authoritative_morphology_snapshot_sources_v2
  enable row level security;
alter table private.authoritative_morphology_snapshot_sources_v2
  force row level security;
alter table public.lexeme_headword_aliases_v2 enable row level security;
alter table public.lexeme_headword_aliases_v2 force row level security;

revoke all on table
  private.authoritative_morphology_source_revisions_v2,
  private.authoritative_morphology_source_headwords_v2,
  private.authoritative_morphology_source_paradigms_v2,
  private.authoritative_morphology_source_forms_v2,
  private.authoritative_morphology_snapshot_sources_v2
from public, anon, authenticated, service_role;

revoke all on table public.lexeme_headword_aliases_v2
from public, anon, authenticated, service_role;
grant select on table public.lexeme_headword_aliases_v2
to authenticated, service_role;

create policy lexeme_headword_aliases_v2_authenticated_read
on public.lexeme_headword_aliases_v2
for select
to authenticated
using (true);

create or replace function public.publish_authoritative_morphology_snapshot_v2(
  p_lexeme_id uuid,
  p_resolution jsonb,
  p_display_groups jsonb,
  p_comparison jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_lexeme public.lexemes%rowtype;
  v_lookup jsonb := p_resolution -> 'lookup';
  v_paradigms jsonb := p_resolution -> 'paradigms';
  v_snapshot_id uuid;
  v_source_article jsonb;
  v_source_payload jsonb;
  v_source_fingerprint text;
  v_source_revision_id uuid;
  v_source_headword_id uuid;
  v_source_paradigm_id uuid;
  v_bound_lexeme_id uuid;
  v_paradigm jsonb;
  v_form jsonb;
  v_group jsonb;
  v_article_ids bigint[];
  v_paradigm_article_ids bigint[];
  v_article_resolution text;
  v_projection_signature_count integer;
  v_expected_count integer;
  v_fetched_count integer;
  v_display_order integer := 0;
  v_evidence_ids text[];
begin
  if jsonb_typeof(p_resolution) is distinct from 'object'
     or jsonb_typeof(v_lookup) is distinct from 'object'
     or jsonb_typeof(v_paradigms) is distinct from 'array'
     or jsonb_typeof(p_display_groups) is distinct from 'array'
     or jsonb_typeof(p_comparison) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'INVALID_PUBLISH_PAYLOAD';
  end if;

  if btrim(coalesce(p_resolution ->> 'version', '')) = ''
     or jsonb_array_length(v_paradigms) = 0
     or jsonb_array_length(p_display_groups) = 0 then
    raise exception using errcode = '22023', message = 'INVALID_PUBLISH_PAYLOAD';
  end if;

  select lexeme.* into v_lexeme
  from public.lexemes as lexeme
  where lexeme.id = p_lexeme_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'LEXEME_NOT_FOUND';
  end if;

  if p_resolution ->> 'status' is distinct from 'resolved'
     or jsonb_typeof(v_lookup -> 'errors') is distinct from 'array' then
    raise exception using errcode = '55000', message = 'SOURCE_RESULT_INCOMPLETE';
  end if;

  if jsonb_array_length(v_lookup -> 'errors') <> 0 then
    raise exception using errcode = '55000', message = 'SOURCE_RESULT_INCOMPLETE';
  end if;

  if v_lookup -> 'requestedDictionaries' is distinct from '["bm"]'::jsonb then
    raise exception using errcode = '55000', message = 'BOKMAL_ONLY_REQUIRED';
  end if;

  if p_resolution ->> 'requestedPos' is distinct from v_lexeme.pos then
    raise exception using errcode = '55000', message = 'LEXEME_POS_MISMATCH';
  end if;

  if lower(btrim(v_lookup ->> 'normalizedQuery')) is distinct from
     lower(btrim(regexp_replace(coalesce(v_lexeme.display_form, v_lexeme.lemma),
       '^(å|en|ei|et)[[:space:]]+', '', 'i'))) then
    raise exception using errcode = '55000', message = 'LEXEME_QUERY_MISMATCH';
  end if;

  if jsonb_typeof(v_lookup -> 'articleReferences') is distinct from 'array'
     or jsonb_typeof(v_lookup -> 'articles') is distinct from 'array' then
    raise exception using errcode = '55000', message = 'SOURCE_ARTICLES_INCOMPLETE';
  end if;

  v_expected_count := jsonb_array_length(v_lookup -> 'articleReferences');
  v_fetched_count := jsonb_array_length(v_lookup -> 'articles');
  if v_expected_count = 0 or v_expected_count <> v_fetched_count then
    raise exception using errcode = '55000', message = 'SOURCE_ARTICLES_INCOMPLETE';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_lookup -> 'articles') as source_article
    where source_article ->> 'dictionaryCode' is distinct from 'bm'
       or coalesce(source_article ->> 'articleId', '') !~ '^[1-9][0-9]*$'
       or coalesce(source_article ->> 'sourceUrl', '') !~
          '^https://ord[.]uib[.]no/'
       or jsonb_typeof(source_article -> 'payload') is distinct from 'object'
       or jsonb_typeof(source_article #> '{payload,lemmas}') is distinct from
          'array'
       or jsonb_array_length(
         case
           when jsonb_typeof(source_article #> '{payload,lemmas}') = 'array'
             then source_article #> '{payload,lemmas}'
           else '[]'::jsonb
         end
       ) = 0
  ) then
    raise exception using errcode = '55000',
      message = 'INVALID_SOURCE_ARTICLE_PAYLOAD';
  end if;

  if (
    select count(distinct concat_ws(
      ':',
      source_article ->> 'dictionaryCode',
      source_article ->> 'articleId'
    ))
    from jsonb_array_elements(v_lookup -> 'articles') as source_article
  ) <> v_fetched_count then
    raise exception using errcode = '55000',
      message = 'DUPLICATE_SOURCE_ARTICLE';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_lookup -> 'articleReferences') as reference
    where reference ->> 'dictionaryCode' is distinct from 'bm'
       or coalesce(reference ->> 'articleId', '') !~ '^[1-9][0-9]*$'
       or not exists (
      select 1
      from jsonb_array_elements(v_lookup -> 'articles') as source_article
      where source_article ->> 'dictionaryCode' =
            reference ->> 'dictionaryCode'
        and source_article ->> 'articleId' = reference ->> 'articleId'
    )
  ) then
    raise exception using errcode = '55000',
      message = 'SOURCE_ARTICLE_REFERENCE_MISMATCH';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_lookup -> 'articles') as source_article
    where not exists (
      select 1
      from jsonb_array_elements(v_lookup -> 'articleReferences') as reference
      where reference ->> 'dictionaryCode' =
            source_article ->> 'dictionaryCode'
        and reference ->> 'articleId' = source_article ->> 'articleId'
    )
  ) then
    raise exception using errcode = '55000',
      message = 'SOURCE_ARTICLE_REFERENCE_MISMATCH';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as item
    where item ->> 'dictionaryCode' is distinct from 'bm'
       or item ->> 'pos' is distinct from v_lexeme.pos
       or lower(btrim(item ->> 'lemma')) is distinct from
          lower(btrim(v_lookup ->> 'normalizedQuery'))
       or coalesce(item ->> 'articleId', '') !~ '^[1-9][0-9]*$'
       or btrim(coalesce(item ->> 'formKey', '')) = ''
       or jsonb_typeof(item -> 'primary') is distinct from 'array'
       or jsonb_array_length(
         case when jsonb_typeof(item -> 'primary') = 'array'
           then item -> 'primary' else '[]'::jsonb end
       ) = 0
       or jsonb_typeof(item -> 'alternatives') is distinct from 'array'
       or jsonb_typeof(item -> 'evidenceIds') is distinct from 'array'
       or jsonb_array_length(
         case when jsonb_typeof(item -> 'evidenceIds') = 'array'
           then item -> 'evidenceIds' else '[]'::jsonb end
       ) = 0
       or btrim(coalesce(item ->> 'policyVersion', '')) = ''
       or coalesce(item ->> 'regularityMarker', 'unknown') not in
          ('regular', 'irregular', 'suppletive', 'unknown')
  ) then
    raise exception using errcode = '55000', message = 'INVALID_DISPLAY_GROUPS';
  end if;

  if (
    select count(distinct item ->> 'policyVersion')
    from jsonb_array_elements(p_display_groups) as item
  ) <> 1 then
    raise exception using errcode = '55000', message = 'DISPLAY_POLICY_VERSION_MISMATCH';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as item
    cross join lateral jsonb_array_elements(
      (item -> 'primary') || (item -> 'alternatives')
    ) as selected
    where jsonb_typeof(selected) is distinct from 'object'
       or btrim(coalesce(selected ->> 'value', '')) = ''
       or btrim(coalesce(selected ->> 'normalizedValue', '')) = ''
  ) then
    raise exception using errcode = '55000', message = 'INVALID_DISPLAY_FORMS';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as item
    group by (item ->> 'articleId')::bigint, item ->> 'formKey'
    having count(*) <> 1
  ) then
    raise exception using errcode = '55000', message = 'DUPLICATE_DISPLAY_GROUP';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as item
    where exists (
      select 1
      from jsonb_array_elements(item -> 'primary') as primary_form
      join jsonb_array_elements(item -> 'alternatives') as alternative_form
        on alternative_form ->> 'normalizedValue' = primary_form ->> 'normalizedValue'
    )
    or exists (
      select 1
      from jsonb_array_elements(item -> 'primary') as selected
      group by selected ->> 'normalizedValue'
      having count(*) > 1
    )
    or exists (
      select 1
      from jsonb_array_elements(item -> 'alternatives') as selected
      group by selected ->> 'normalizedValue'
      having count(*) > 1
    )
  ) then
    raise exception using errcode = '55000', message = 'DUPLICATE_OR_OVERLAPPING_DISPLAY_FORM';
  end if;

  select array_agg(
    distinct (item ->> 'articleId')::bigint
    order by (item ->> 'articleId')::bigint
  )
  into v_article_ids
  from jsonb_array_elements(p_display_groups) as item;

  v_article_resolution := case
    when cardinality(v_article_ids) = 1 then 'single_source_article'
    else 'equivalent_source_articles'
  end;

  select count(distinct projection.signature)
  into v_projection_signature_count
  from (
    select
      (item ->> 'articleId')::bigint as article_id,
      jsonb_agg(
        jsonb_build_object(
          'formKey', item ->> 'formKey',
          'lemma', item ->> 'lemma',
          'primary', (
            select jsonb_agg(
              jsonb_build_object(
                'value', selected.value ->> 'value',
                'normalizedValue', selected.value ->> 'normalizedValue'
              )
              order by selected.ordinality
            )
            from jsonb_array_elements(item -> 'primary')
              with ordinality as selected(value, ordinality)
          ),
          'alternatives', (
            select jsonb_agg(
              jsonb_build_object(
                'value', selected.value ->> 'value',
                'normalizedValue', selected.value ->> 'normalizedValue'
              )
              order by selected.ordinality
            )
            from jsonb_array_elements(item -> 'alternatives')
              with ordinality as selected(value, ordinality)
          ),
          'regularityMarker', coalesce(item ->> 'regularityMarker', 'unknown'),
          'policyVersion', item ->> 'policyVersion'
        )
        order by item ->> 'formKey'
      ) as signature
    from jsonb_array_elements(p_display_groups) as item
    group by (item ->> 'articleId')::bigint
  ) as projection;

  if v_projection_signature_count <> 1 then
    raise exception using errcode = '55000', message = 'SOURCE_ARTICLE_PROJECTIONS_DIVERGE';
  end if;

  select array_agg(
    distinct (item ->> 'articleId')::bigint
    order by (item ->> 'articleId')::bigint
  )
  into v_paradigm_article_ids
  from jsonb_array_elements(v_paradigms) as item;

  if v_paradigm_article_ids is distinct from v_article_ids then
    raise exception using errcode = '55000', message = 'PARADIGM_ARTICLE_SET_MISMATCH';
  end if;

  -- The exact lookup lemma must always be represented. Additional official
  -- co-headwords are accepted only when the same fetched article names them.
  if not exists (
    select 1
    from jsonb_array_elements(v_paradigms) as paradigm
    where lower(btrim(paradigm ->> 'lemma')) =
      lower(btrim(v_lookup ->> 'normalizedQuery'))
  ) then
    raise exception using errcode = '55000', message = 'LOOKUP_LEMMA_PARADIGM_REQUIRED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_paradigms) as paradigm
    where lower(btrim(paradigm ->> 'lemma')) <>
      lower(btrim(v_lookup ->> 'normalizedQuery'))
      and not exists (
        select 1
        from jsonb_array_elements(v_lookup -> 'articles') as source_article
        cross join lateral jsonb_array_elements(
          case
            when jsonb_typeof(source_article #> '{payload,lemmas}') = 'array'
              then source_article #> '{payload,lemmas}'
            else '[]'::jsonb
          end
        ) as source_lemma
        where source_article ->> 'dictionaryCode' =
              paradigm ->> 'dictionaryCode'
          and source_article ->> 'articleId' = paradigm ->> 'articleId'
          and lower(btrim(coalesce(
            nullif(btrim(source_lemma ->> 'final_lexeme'), ''),
            source_lemma ->> 'lemma'
          ))) = lower(btrim(paradigm ->> 'lemma'))
      )
  ) then
    raise exception using errcode = '55000',
      message = 'COHEADWORD_LEMMA_NOT_IN_SOURCE_ARTICLE';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_paradigms) as paradigm
    where paradigm ->> 'dictionaryCode' is distinct from 'bm'
       or paradigm ->> 'pos' is distinct from v_lexeme.pos
       or paradigm ->> 'source' is distinct from 'Ordbokene'
       or btrim(coalesce(paradigm ->> 'lemma', '')) = ''
       or coalesce(paradigm ->> 'articleId', '') !~ '^[1-9][0-9]*$'
       or coalesce(paradigm ->> 'articleUrl', '') !~ '^https://ord[.]uib[.]no/'
       or btrim(coalesce(paradigm ->> 'identity', '')) = ''
       or btrim(coalesce(paradigm ->> 'paradigmId', '')) = ''
       or jsonb_typeof(paradigm -> 'paradigmTags') is distinct from 'array'
       or jsonb_typeof(paradigm -> 'forms') is distinct from 'array'
       or jsonb_array_length(
         case when jsonb_typeof(paradigm -> 'forms') = 'array'
           then paradigm -> 'forms' else '[]'::jsonb end
       ) = 0
       or not exists (
         select 1
         from jsonb_array_elements(v_lookup -> 'articles') as source_article
         where source_article ->> 'dictionaryCode' = paradigm ->> 'dictionaryCode'
           and source_article ->> 'articleId' = paradigm ->> 'articleId'
       )
  ) then
    raise exception using errcode = '55000', message = 'PARADIGM_IDENTITY_MISMATCH';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_paradigms) as paradigm
    cross join lateral jsonb_array_elements(paradigm -> 'forms') as source_form
    where jsonb_typeof(source_form) is distinct from 'object'
       or btrim(coalesce(source_form ->> 'formKey', '')) = ''
       or btrim(coalesce(source_form ->> 'value', '')) = ''
       or btrim(coalesce(source_form ->> 'normalizedValue', '')) = ''
       or jsonb_typeof(source_form -> 'tags') is distinct from 'array'
       or coalesce(source_form ->> 'sourceOrdinal', '') !~ '^[0-9]+$'
  ) then
    raise exception using errcode = '55000', message = 'INVALID_SOURCE_FORMS';
  end if;

  -- A selected value must be backed by an exact form in the same source
  -- article and form group. The publisher never accepts invented forms.
  if exists (
    select 1
    from jsonb_array_elements(p_display_groups) as display_group
    cross join lateral jsonb_array_elements(
      (display_group -> 'primary') || (display_group -> 'alternatives')
    ) as selected
    where not exists (
      select 1
      from jsonb_array_elements(v_paradigms) as paradigm
      cross join lateral jsonb_array_elements(paradigm -> 'forms') as source_form
      where paradigm ->> 'articleId' = display_group ->> 'articleId'
        and paradigm ->> 'dictionaryCode' = display_group ->> 'dictionaryCode'
        and paradigm ->> 'pos' = display_group ->> 'pos'
        and source_form ->> 'formKey' = display_group ->> 'formKey'
        and source_form ->> 'normalizedValue' = selected ->> 'normalizedValue'
        and source_form ->> 'value' = selected ->> 'value'
    )
  ) then
    raise exception using errcode = '55000', message = 'DISPLAY_FORM_NOT_IN_SOURCE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_lexeme_id::text, 0)
  );

  insert into private.authoritative_morphology_snapshots_v2 (
    lexeme_id, lookup_query, normalized_query, requested_pos, dictionaries,
    scope_used, resolver_version, policy_version, is_complete,
    expected_article_count, fetched_article_count, checked_at,
    source_article_ids, article_resolution
  ) values (
    p_lexeme_id,
    v_lookup ->> 'query',
    v_lookup ->> 'normalizedQuery',
    p_resolution ->> 'requestedPos',
    array(select jsonb_array_elements_text(v_lookup -> 'requestedDictionaries')),
    v_lookup ->> 'scopeUsed',
    p_resolution ->> 'version',
    p_display_groups -> 0 ->> 'policyVersion',
    true,
    v_expected_count,
    v_fetched_count,
    (v_lookup ->> 'checkedAt')::timestamptz,
    v_article_ids,
    v_article_resolution
  ) returning id into v_snapshot_id;

  -- A source revision is shared by every lexeme snapshot produced from the
  -- same article payload and parser version.
  for v_source_article in
    select value from jsonb_array_elements(v_lookup -> 'articles')
  loop
    v_source_payload := v_source_article -> 'payload';
    v_source_fingerprint := md5(v_source_payload::text);

    insert into private.authoritative_morphology_source_revisions_v2 (
      dictionary_code, article_id, source_url, source_article_version,
      parser_version, source_payload, payload_fingerprint,
      first_checked_at, last_checked_at
    ) values (
      v_source_article ->> 'dictionaryCode',
      (v_source_article ->> 'articleId')::bigint,
      v_source_article ->> 'sourceUrl',
      coalesce(
        nullif(v_source_payload ->> 'version', ''),
        nullif(v_source_payload ->> 'v', '')
      ),
      p_resolution ->> 'version',
      v_source_payload,
      v_source_fingerprint,
      (v_lookup ->> 'checkedAt')::timestamptz,
      (v_lookup ->> 'checkedAt')::timestamptz
    )
    on conflict (
      dictionary_code, article_id, payload_fingerprint, parser_version
    ) do update set
      source_url = excluded.source_url,
      source_article_version = coalesce(
        excluded.source_article_version,
        private.authoritative_morphology_source_revisions_v2.source_article_version
      ),
      first_checked_at = least(
        private.authoritative_morphology_source_revisions_v2.first_checked_at,
        excluded.first_checked_at
      ),
      last_checked_at = greatest(
        private.authoritative_morphology_source_revisions_v2.last_checked_at,
        excluded.last_checked_at
      )
    returning id into v_source_revision_id;

    insert into private.authoritative_morphology_snapshot_sources_v2 (
      snapshot_id, source_revision_id
    ) values (v_snapshot_id, v_source_revision_id);
  end loop;

  -- Alias rows are a rebuildable learner-facing projection. Re-publication
  -- deactivates the previous source set inside the same transaction.
  update public.lexeme_headword_aliases_v2 as existing_alias
  set is_active = false, updated_at = now()
  where existing_alias.lexeme_id = p_lexeme_id
    and existing_alias.pos = v_lexeme.pos
    and existing_alias.is_active;

  for v_paradigm in select value from jsonb_array_elements(v_paradigms)
  loop
    select
      source_revision.id
    into v_source_revision_id
    from private.authoritative_morphology_source_revisions_v2 as source_revision
    join lateral (
      select source_article.value
      from jsonb_array_elements(v_lookup -> 'articles') as source_article
      where source_article ->> 'dictionaryCode' =
            v_paradigm ->> 'dictionaryCode'
        and source_article ->> 'articleId' = v_paradigm ->> 'articleId'
      limit 1
    ) as matched_article on true
    where source_revision.dictionary_code =
          v_paradigm ->> 'dictionaryCode'
      and source_revision.article_id =
          (v_paradigm ->> 'articleId')::bigint
      and source_revision.parser_version = p_resolution ->> 'version'
      and source_revision.payload_fingerprint =
          md5((matched_article.value -> 'payload')::text);

    if v_source_revision_id is null then
      raise exception using errcode = '55000',
        message = 'SOURCE_REVISION_BINDING_FAILED';
    end if;

    insert into private.authoritative_morphology_source_headwords_v2 (
      source_revision_id, lemma, normalized_lemma
    ) values (
      v_source_revision_id,
      v_paradigm ->> 'lemma',
      lower(btrim(v_paradigm ->> 'lemma'))
    )
    on conflict (source_revision_id, normalized_lemma) do update set
      lemma = excluded.lemma
    returning id into v_source_headword_id;

    v_bound_lexeme_id := null;
    insert into public.lexeme_headword_aliases_v2 (
      dictionary_code, article_id, normalized_headword, pos, headword,
      lexeme_id, source_revision_id, is_primary, is_active, updated_at
    ) values (
      v_paradigm ->> 'dictionaryCode',
      (v_paradigm ->> 'articleId')::bigint,
      lower(btrim(v_paradigm ->> 'lemma')),
      v_paradigm ->> 'pos',
      v_paradigm ->> 'lemma',
      p_lexeme_id,
      v_source_revision_id,
      lower(btrim(v_paradigm ->> 'lemma')) =
        lower(btrim(v_lookup ->> 'normalizedQuery')),
      true,
      now()
    )
    on conflict (
      dictionary_code, article_id, normalized_headword, pos
    ) do update set
      headword = excluded.headword,
      source_revision_id = excluded.source_revision_id,
      is_primary = excluded.is_primary,
      is_active = true,
      updated_at = excluded.updated_at
    where public.lexeme_headword_aliases_v2.lexeme_id = excluded.lexeme_id
    returning lexeme_id into v_bound_lexeme_id;

    if v_bound_lexeme_id is null then
      raise exception using errcode = '55000',
        message = 'SOURCE_HEADWORD_ALREADY_BOUND';
    end if;

    insert into private.authoritative_morphology_source_paradigms_v2 (
      source_headword_id, pos, paradigm_id, identity, paradigm_tags,
      inflection_group, standardisation
    ) values (
      v_source_headword_id,
      v_paradigm ->> 'pos',
      v_paradigm ->> 'paradigmId',
      v_paradigm ->> 'identity',
      array(select jsonb_array_elements_text(v_paradigm -> 'paradigmTags')),
      v_paradigm ->> 'inflectionGroup',
      v_paradigm ->> 'standardisation'
    )
    on conflict (source_headword_id, pos, paradigm_id) do update set
      identity = excluded.identity,
      paradigm_tags = excluded.paradigm_tags,
      inflection_group = excluded.inflection_group,
      standardisation = excluded.standardisation
    returning id into v_source_paradigm_id;

    for v_form in select value from jsonb_array_elements(v_paradigm -> 'forms')
    loop
      insert into private.authoritative_morphology_source_forms_v2 (
        source_paradigm_id, form_key, value, normalized_value, tags,
        source_ordinal
      ) values (
        v_source_paradigm_id,
        v_form ->> 'formKey',
        v_form ->> 'value',
        v_form ->> 'normalizedValue',
        array(select jsonb_array_elements_text(v_form -> 'tags')),
        (v_form ->> 'sourceOrdinal')::integer
      )
      on conflict (source_paradigm_id, source_ordinal) do update set
        form_key = excluded.form_key,
        value = excluded.value,
        normalized_value = excluded.normalized_value,
        tags = excluded.tags;
    end loop;
  end loop;

  insert into private.authoritative_morphology_comparisons_v2 (
    snapshot_id, lexeme_id, comparison
  ) values (v_snapshot_id, p_lexeme_id, p_comparison);

  update private.authoritative_morphology_snapshots_v2 as previous
  set state = 'superseded', is_active = false, superseded_at = now()
  where previous.lexeme_id = p_lexeme_id
    and previous.is_active
    and previous.id <> v_snapshot_id;

  delete from public.lexeme_form_display_v2 as display
  where display.lexeme_id = p_lexeme_id;

  -- Every source article has already been proven to have the same ordered
  -- projection. Select one deterministic representative for the values, but
  -- persist the complete article ID set and never label one article primary.
  for v_group in
    select distinct on (value ->> 'formKey') value
    from jsonb_array_elements(p_display_groups)
    order by value ->> 'formKey', (value ->> 'articleId')::bigint
  loop
    select array_agg(distinct evidence.value order by evidence.value)
    into v_evidence_ids
    from jsonb_array_elements(p_display_groups) as same_group
    cross join lateral jsonb_array_elements_text(same_group -> 'evidenceIds') as evidence(value)
    where same_group ->> 'formKey' = v_group ->> 'formKey';

    insert into public.lexeme_form_display_v2 (
      lexeme_id, snapshot_id, dictionary_code, article_id, article_ids, pos,
      lemma, form_key, primary_values, alternative_values,
      regularity_marker, evidence_ids, policy_version, display_order
    ) values (
      p_lexeme_id,
      v_snapshot_id,
      v_group ->> 'dictionaryCode',
      case when cardinality(v_article_ids) = 1 then v_article_ids[1] else null end,
      v_article_ids,
      v_group ->> 'pos',
      v_group ->> 'lemma',
      v_group ->> 'formKey',
      array(select form ->> 'value' from jsonb_array_elements(v_group -> 'primary') as form),
      array(select form ->> 'value' from jsonb_array_elements(v_group -> 'alternatives') as form),
      coalesce(v_group ->> 'regularityMarker', 'unknown'),
      v_evidence_ids,
      v_group ->> 'policyVersion',
      v_display_order
    );
    v_display_order := v_display_order + 1;
  end loop;

  update private.authoritative_morphology_snapshots_v2
  set state = 'ready', is_active = true, finalized_at = now()
  where id = v_snapshot_id;

  delete from private.authoritative_morphology_snapshots_v2 as expired
  where expired.id in (
    select old.id
    from private.authoritative_morphology_snapshots_v2 as old
    where old.lexeme_id = p_lexeme_id and old.state = 'superseded'
    order by old.superseded_at desc nulls last, old.created_at desc
    offset 3
  );

  return v_snapshot_id;
end;
$function$;

revoke all on function public.publish_authoritative_morphology_snapshot_v2(
  uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.publish_authoritative_morphology_snapshot_v2(
  uuid, jsonb, jsonb, jsonb
) to service_role;

comment on table private.authoritative_morphology_source_revisions_v2 is
  'Immutable Ordbokene payload revisions shared by lexeme-specific D10 snapshots.';
comment on table private.authoritative_morphology_source_headwords_v2 is
  'Official source headwords within one Ordbokene article revision.';
comment on table private.authoritative_morphology_source_paradigms_v2 is
  'Source paradigms identified by article revision, official lemma, POS, and paradigm ID.';
comment on table private.authoritative_morphology_source_forms_v2 is
  'Verbatim normalized form rows parsed from one versioned source paradigm.';
comment on table private.authoritative_morphology_snapshot_sources_v2 is
  'Many-to-many provenance binding between learner projections and shared source revisions.';
comment on table public.lexeme_headword_aliases_v2 is
  'Authenticated D10 alias projection: official source headwords resolve to one canonical lexeme per article and POS.';

comment on function public.publish_authoritative_morphology_snapshot_v2(uuid, jsonb, jsonb, jsonb) is
  'Service-role-only atomic D10 publisher; reuses source revisions and permits source-verified co-headwords while rejecting missing exact lemmas, partial source results, Nynorsk, divergent projections, and invented forms.';
