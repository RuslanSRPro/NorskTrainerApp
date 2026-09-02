-- D10 / AUTHORITATIVE MORPHOLOGY V2
-- Canonical Bokmål-only morphology storage and application projection.

create schema if not exists private;

create table private.authoritative_morphology_snapshots_v2 (
  id uuid primary key default gen_random_uuid(),
  lexeme_id uuid not null references public.lexemes(id) on delete cascade,
  lookup_query text not null check (btrim(lookup_query) <> ''),
  normalized_query text not null check (btrim(normalized_query) <> ''),
  requested_pos text not null
    check (requested_pos in ('verb', 'noun', 'adjective', 'determiner')),
  dictionaries text[] not null
    check (cardinality(dictionaries) > 0 and dictionaries <@ array['bm', 'nn']::text[]),
  scope_used text not null check (scope_used in ('e', 'i')),
  resolver_version text not null,
  policy_version text not null,
  state text not null default 'building'
    check (state in ('building', 'ready', 'superseded')),
  is_complete boolean not null default false,
  is_active boolean not null default false,
  expected_article_count integer not null check (expected_article_count > 0),
  fetched_article_count integer not null check (fetched_article_count >= 0),
  checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  superseded_at timestamptz,
  check (fetched_article_count <= expected_article_count),
  check (not is_active or (state = 'ready' and is_complete))
);

create unique index authoritative_morphology_snapshots_v2_one_active_idx
  on private.authoritative_morphology_snapshots_v2 (lexeme_id)
  where is_active;

create index authoritative_morphology_snapshots_v2_lexeme_created_idx
  on private.authoritative_morphology_snapshots_v2 (lexeme_id, created_at desc);

create table private.authoritative_morphology_paradigms_v2 (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null
    references private.authoritative_morphology_snapshots_v2(id) on delete cascade,
  dictionary_code text not null check (dictionary_code in ('bm', 'nn')),
  article_id bigint not null check (article_id > 0),
  pos text not null check (pos in ('verb', 'noun', 'adjective', 'determiner')),
  paradigm_id text not null check (btrim(paradigm_id) <> ''),
  identity text not null check (btrim(identity) <> ''),
  lemma text not null check (btrim(lemma) <> ''),
  source_name text not null default 'Ordbokene' check (source_name = 'Ordbokene'),
  source_url text not null check (source_url ~ '^https://ord[.]uib[.]no/'),
  source_article_version text,
  paradigm_tags text[] not null default '{}'::text[],
  inflection_group text,
  standardisation text,
  regularity_marker text not null default 'unknown'
    check (regularity_marker in ('regular', 'irregular', 'suppletive', 'unknown')),
  preference jsonb check (preference is null or jsonb_typeof(preference) = 'object'),
  created_at timestamptz not null default now(),
  unique (snapshot_id, identity),
  unique (snapshot_id, dictionary_code, article_id, pos, paradigm_id)
);

create index authoritative_morphology_paradigms_v2_snapshot_id_idx
  on private.authoritative_morphology_paradigms_v2 (snapshot_id);

create index authoritative_morphology_paradigms_v2_article_idx
  on private.authoritative_morphology_paradigms_v2 (dictionary_code, article_id, pos);

create table private.authoritative_morphology_forms_v2 (
  id uuid primary key default gen_random_uuid(),
  paradigm_id uuid not null
    references private.authoritative_morphology_paradigms_v2(id) on delete cascade,
  form_key text not null check (btrim(form_key) <> ''),
  value text not null check (btrim(value) <> ''),
  normalized_value text not null check (btrim(normalized_value) <> ''),
  tags text[] not null default '{}'::text[],
  source_ordinal integer not null check (source_ordinal >= 0),
  created_at timestamptz not null default now(),
  unique (paradigm_id, source_ordinal)
);

create index authoritative_morphology_forms_v2_paradigm_id_idx
  on private.authoritative_morphology_forms_v2 (paradigm_id);

create index authoritative_morphology_forms_v2_normalized_value_idx
  on private.authoritative_morphology_forms_v2 (normalized_value);

create table private.authoritative_morphology_comparisons_v2 (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null unique
    references private.authoritative_morphology_snapshots_v2(id) on delete cascade,
  lexeme_id uuid not null references public.lexemes(id) on delete cascade,
  comparison jsonb not null check (jsonb_typeof(comparison) = 'object'),
  created_at timestamptz not null default now()
);

create index authoritative_morphology_comparisons_v2_lexeme_id_idx
  on private.authoritative_morphology_comparisons_v2 (lexeme_id);

-- The only morphology object read by V2 application code. Each row contains
-- ordered arrays; clients never infer a primary form from row arrival order.
create table public.lexeme_form_display_v2 (
  lexeme_id uuid not null references public.lexemes(id) on delete cascade,
  snapshot_id uuid not null
    references private.authoritative_morphology_snapshots_v2(id) on delete cascade,
  dictionary_code text not null default 'bm' check (dictionary_code = 'bm'),
  article_id bigint not null check (article_id > 0),
  pos text not null check (pos in ('verb', 'noun', 'adjective', 'determiner')),
  lemma text not null check (btrim(lemma) <> ''),
  form_key text not null check (btrim(form_key) <> ''),
  primary_values text[] not null check (cardinality(primary_values) > 0),
  alternative_values text[] not null default '{}'::text[],
  regularity_marker text not null default 'unknown'
    check (regularity_marker in ('regular', 'irregular', 'suppletive', 'unknown')),
  evidence_ids text[] not null check (cardinality(evidence_ids) > 0),
  policy_version text not null check (btrim(policy_version) <> ''),
  display_order integer not null check (display_order >= 0),
  updated_at timestamptz not null default now(),
  primary key (lexeme_id, form_key)
);

create index lexeme_form_display_v2_snapshot_id_idx
  on public.lexeme_form_display_v2 (snapshot_id);

create index lexeme_form_display_v2_dictionary_pos_idx
  on public.lexeme_form_display_v2 (dictionary_code, pos, lexeme_id);

alter table private.authoritative_morphology_snapshots_v2 enable row level security;
alter table private.authoritative_morphology_snapshots_v2 force row level security;
alter table private.authoritative_morphology_paradigms_v2 enable row level security;
alter table private.authoritative_morphology_paradigms_v2 force row level security;
alter table private.authoritative_morphology_forms_v2 enable row level security;
alter table private.authoritative_morphology_forms_v2 force row level security;
alter table private.authoritative_morphology_comparisons_v2 enable row level security;
alter table private.authoritative_morphology_comparisons_v2 force row level security;
alter table public.lexeme_form_display_v2 enable row level security;
alter table public.lexeme_form_display_v2 force row level security;

revoke all on table
  private.authoritative_morphology_snapshots_v2,
  private.authoritative_morphology_paradigms_v2,
  private.authoritative_morphology_forms_v2,
  private.authoritative_morphology_comparisons_v2
from public, anon, authenticated, service_role;
revoke all on table public.lexeme_form_display_v2 from public, anon, authenticated;
grant select on table public.lexeme_form_display_v2 to authenticated;

create policy lexeme_form_display_v2_authenticated_read
on public.lexeme_form_display_v2
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
  v_paradigm_id uuid;
  v_paradigm jsonb;
  v_form jsonb;
  v_group jsonb;
  v_article_ids bigint[];
  v_expected_count integer;
  v_fetched_count integer;
  v_display_order integer := 0;
begin
  if jsonb_typeof(p_resolution) <> 'object'
     or jsonb_typeof(v_lookup) <> 'object'
     or jsonb_typeof(v_paradigms) <> 'array'
     or jsonb_typeof(p_display_groups) <> 'array'
     or jsonb_typeof(p_comparison) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_PUBLISH_PAYLOAD';
  end if;

  select lexeme.* into v_lexeme
  from public.lexemes as lexeme
  where lexeme.id = p_lexeme_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'LEXEME_NOT_FOUND';
  end if;

  if p_resolution ->> 'status' <> 'resolved'
     or coalesce(jsonb_array_length(v_lookup -> 'errors'), 0) <> 0 then
    raise exception using errcode = '55000', message = 'SOURCE_RESULT_INCOMPLETE';
  end if;

  if v_lookup -> 'requestedDictionaries' <> '["bm"]'::jsonb then
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

  v_expected_count := jsonb_array_length(v_lookup -> 'articleReferences');
  v_fetched_count := jsonb_array_length(v_lookup -> 'articles');
  if v_expected_count = 0 or v_expected_count <> v_fetched_count then
    raise exception using errcode = '55000', message = 'SOURCE_ARTICLES_INCOMPLETE';
  end if;

  select array_agg(distinct (item ->> 'articleId')::bigint order by (item ->> 'articleId')::bigint)
  into v_article_ids
  from jsonb_array_elements(p_display_groups) as item
  where item ->> 'dictionaryCode' = 'bm'
    and item ->> 'pos' = v_lexeme.pos;

  if cardinality(v_article_ids) is distinct from 1 then
    raise exception using errcode = '55000', message = 'AMBIGUOUS_SOURCE_ARTICLES';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_display_groups) as item
    where item ->> 'dictionaryCode' <> 'bm'
       or item ->> 'pos' <> v_lexeme.pos
       or jsonb_typeof(item -> 'primary') <> 'array'
       or jsonb_array_length(item -> 'primary') = 0
       or jsonb_typeof(item -> 'alternatives') <> 'array'
  ) then
    raise exception using errcode = '55000', message = 'INVALID_DISPLAY_GROUPS';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_lexeme_id::text, 0)
  );

  insert into private.authoritative_morphology_snapshots_v2 (
    lexeme_id, lookup_query, normalized_query, requested_pos, dictionaries,
    scope_used, resolver_version, policy_version, is_complete,
    expected_article_count, fetched_article_count, checked_at
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
    (v_lookup ->> 'checkedAt')::timestamptz
  ) returning id into v_snapshot_id;

  for v_paradigm in select value from jsonb_array_elements(v_paradigms)
  loop
    if v_paradigm ->> 'dictionaryCode' <> 'bm'
       or v_paradigm ->> 'pos' <> v_lexeme.pos
       or v_paradigm ->> 'source' <> 'Ordbokene'
       or lower(btrim(v_paradigm ->> 'lemma')) <>
          lower(btrim(v_lookup ->> 'normalizedQuery'))
       or (v_paradigm ->> 'articleId')::bigint <> v_article_ids[1] then
      raise exception using errcode = '55000', message = 'PARADIGM_IDENTITY_MISMATCH';
    end if;

    insert into private.authoritative_morphology_paradigms_v2 (
      snapshot_id, dictionary_code, article_id, pos, paradigm_id, identity,
      lemma, source_url, source_article_version, paradigm_tags,
      inflection_group, standardisation, regularity_marker, preference
    ) values (
      v_snapshot_id,
      v_paradigm ->> 'dictionaryCode',
      (v_paradigm ->> 'articleId')::bigint,
      v_paradigm ->> 'pos',
      v_paradigm ->> 'paradigmId',
      v_paradigm ->> 'identity',
      v_paradigm ->> 'lemma',
      v_paradigm ->> 'articleUrl',
      v_paradigm ->> 'articleVersion',
      array(select jsonb_array_elements_text(v_paradigm -> 'paradigmTags')),
      v_paradigm ->> 'inflectionGroup',
      v_paradigm ->> 'standardisation',
      coalesce(v_paradigm -> 'preference' ->> 'regularity', 'unknown'),
      nullif(v_paradigm -> 'preference', 'null'::jsonb)
    ) returning id into v_paradigm_id;

    for v_form in select value from jsonb_array_elements(v_paradigm -> 'forms')
    loop
      insert into private.authoritative_morphology_forms_v2 (
        paradigm_id, form_key, value, normalized_value, tags, source_ordinal
      ) values (
        v_paradigm_id,
        v_form ->> 'formKey',
        v_form ->> 'value',
        v_form ->> 'normalizedValue',
        array(select jsonb_array_elements_text(v_form -> 'tags')),
        (v_form ->> 'sourceOrdinal')::integer
      );
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

  for v_group in
    select value
    from jsonb_array_elements(p_display_groups)
    order by value ->> 'formKey'
  loop
    insert into public.lexeme_form_display_v2 (
      lexeme_id, snapshot_id, dictionary_code, article_id, pos, lemma,
      form_key, primary_values, alternative_values, regularity_marker,
      evidence_ids, policy_version, display_order
    ) values (
      p_lexeme_id,
      v_snapshot_id,
      v_group ->> 'dictionaryCode',
      (v_group ->> 'articleId')::bigint,
      v_group ->> 'pos',
      v_group ->> 'lemma',
      v_group ->> 'formKey',
      array(select form ->> 'value' from jsonb_array_elements(v_group -> 'primary') as form),
      array(select form ->> 'value' from jsonb_array_elements(v_group -> 'alternatives') as form),
      coalesce(v_group ->> 'regularityMarker', 'unknown'),
      array(select jsonb_array_elements_text(v_group -> 'evidenceIds')),
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

comment on table public.lexeme_form_display_v2 is
  'Canonical Bokmål-only morphology read model. Ordered primary and alternative arrays come only from Ordbøkene-backed D10 snapshots.';
comment on function public.publish_authoritative_morphology_snapshot_v2(uuid, jsonb, jsonb, jsonb) is
  'Service-role-only atomic D10 publisher; rejects partial, Nynorsk and ambiguous source results.';
