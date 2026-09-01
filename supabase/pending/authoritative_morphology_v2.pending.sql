-- D10 / SOURCE-ONLY AUTHORITATIVE MORPHOLOGY V2
-- PENDING ONLY. Do not apply before D09 is closed and this file is promoted
-- through `supabase migration new` into a reviewed migration.

create table public.authoritative_morphology_snapshots_v2 (
  id uuid primary key default gen_random_uuid(),
  lookup_query text not null check (btrim(lookup_query) <> ''),
  normalized_query text not null check (btrim(normalized_query) <> ''),
  requested_pos text not null default 'any'
    check (requested_pos in ('any', 'verb', 'noun', 'adjective', 'determiner')),
  dictionaries text[] not null
    check (cardinality(dictionaries) > 0 and dictionaries <@ array['bm', 'nn']::text[]),
  scope_used text not null check (scope_used in ('e', 'i')),
  resolver_version text not null,
  state text not null default 'building'
    check (state in ('building', 'ready', 'failed', 'superseded')),
  is_complete boolean not null default false,
  is_active boolean not null default false,
  expected_article_count integer not null default 0
    check (expected_article_count >= 0),
  fetched_article_count integer not null default 0
    check (fetched_article_count >= 0),
  source_error_count integer not null default 0
    check (source_error_count >= 0),
  source_errors jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_errors) = 'array'),
  checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  superseded_at timestamptz,
  check (not is_active or (state = 'ready' and is_complete)),
  check (fetched_article_count <= expected_article_count)
);

create unique index authoritative_morphology_snapshots_v2_one_active_idx
  on public.authoritative_morphology_snapshots_v2 (
    normalized_query,
    requested_pos,
    dictionaries
  )
  where is_active;

create index authoritative_morphology_snapshots_v2_state_created_idx
  on public.authoritative_morphology_snapshots_v2 (state, created_at desc);

create table public.authoritative_morphology_paradigms_v2 (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null
    references public.authoritative_morphology_snapshots_v2(id)
    on delete cascade,
  dictionary_code text not null check (dictionary_code in ('bm', 'nn')),
  article_id bigint not null check (article_id > 0),
  pos text not null
    check (pos in ('verb', 'noun', 'adjective', 'determiner')),
  paradigm_id text not null check (btrim(paradigm_id) <> ''),
  identity text not null check (btrim(identity) <> ''),
  lemma text not null check (btrim(lemma) <> ''),
  source_name text not null default 'Ordbokene'
    check (source_name = 'Ordbokene'),
  source_url text not null check (source_url ~ '^https://ord[.]uib[.]no/'),
  source_article_version text,
  paradigm_tags text[] not null default '{}'::text[],
  inflection_group text,
  standardisation text,
  regularity_marker text not null default 'unknown'
    check (regularity_marker in ('regular', 'irregular', 'suppletive', 'unknown')),
  preference jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, dictionary_code, article_id, pos, paradigm_id),
  unique (snapshot_id, identity),
  check (preference is null or jsonb_typeof(preference) = 'object')
);

-- PostgreSQL does not create indexes for FK columns automatically.
create index authoritative_morphology_paradigms_v2_snapshot_id_idx
  on public.authoritative_morphology_paradigms_v2 (snapshot_id);

create index authoritative_morphology_paradigms_v2_identity_idx
  on public.authoritative_morphology_paradigms_v2 (identity);

create table public.authoritative_morphology_forms_v2 (
  id uuid primary key default gen_random_uuid(),
  paradigm_id uuid not null
    references public.authoritative_morphology_paradigms_v2(id)
    on delete cascade,
  form_key text not null check (btrim(form_key) <> ''),
  value text not null check (btrim(value) <> ''),
  normalized_value text not null check (btrim(normalized_value) <> ''),
  tags text[] not null default '{}'::text[],
  source_ordinal integer not null check (source_ordinal >= 0),
  created_at timestamptz not null default now(),
  unique (paradigm_id, source_ordinal)
);

create index authoritative_morphology_forms_v2_paradigm_id_idx
  on public.authoritative_morphology_forms_v2 (paradigm_id);

create index authoritative_morphology_forms_v2_normalized_value_idx
  on public.authoritative_morphology_forms_v2 (normalized_value);

-- Staged snapshots are invisible. Finalization takes a per-lookup advisory
-- lock, verifies completeness, and atomically switches the active snapshot.
-- Old paradigms remain historical but can never appear in the active view.
create or replace function public.finalize_authoritative_morphology_snapshot_v2(
  p_snapshot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_snapshot public.authoritative_morphology_snapshots_v2%rowtype;
  v_paradigm_count integer;
  v_empty_paradigm_count integer;
begin
  select snapshot.*
  into v_snapshot
  from public.authoritative_morphology_snapshots_v2 as snapshot
  where snapshot.id = p_snapshot_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'SNAPSHOT_NOT_FOUND';
  end if;

  if v_snapshot.state <> 'building' then
    raise exception using errcode = '55000', message = 'SNAPSHOT_NOT_BUILDING';
  end if;

  if not v_snapshot.is_complete
     or v_snapshot.source_error_count <> 0
     or v_snapshot.expected_article_count = 0
     or v_snapshot.fetched_article_count <> v_snapshot.expected_article_count then
    raise exception using errcode = '55000', message = 'SNAPSHOT_INCOMPLETE';
  end if;

  select
    count(*),
    count(*) filter (where not exists (
      select 1
      from public.authoritative_morphology_forms_v2 as form
      where form.paradigm_id = paradigm.id
    ))
  into v_paradigm_count, v_empty_paradigm_count
  from public.authoritative_morphology_paradigms_v2 as paradigm
  where paradigm.snapshot_id = p_snapshot_id;

  if v_paradigm_count = 0 or v_empty_paradigm_count <> 0 then
    raise exception using errcode = '55000', message = 'SNAPSHOT_FORMS_INCOMPLETE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_snapshot.normalized_query || '|' || v_snapshot.requested_pos || '|' ||
        pg_catalog.array_to_string(v_snapshot.dictionaries, ','),
      0
    )
  );

  update public.authoritative_morphology_snapshots_v2 as previous
  set
    state = 'superseded',
    is_active = false,
    superseded_at = now()
  where previous.normalized_query = v_snapshot.normalized_query
    and previous.requested_pos = v_snapshot.requested_pos
    and previous.dictionaries = v_snapshot.dictionaries
    and previous.is_active
    and previous.id <> p_snapshot_id;

  update public.authoritative_morphology_snapshots_v2 as current_snapshot
  set
    state = 'ready',
    is_active = true,
    finalized_at = now()
  where current_snapshot.id = p_snapshot_id;

  return p_snapshot_id;
end;
$function$;

create view public.active_authoritative_morphology_forms_v2
with (security_invoker = true)
as
select
  snapshot.id as snapshot_id,
  snapshot.normalized_query,
  snapshot.requested_pos,
  snapshot.scope_used,
  snapshot.resolver_version,
  snapshot.checked_at,
  paradigm.id as paradigm_row_id,
  paradigm.identity,
  paradigm.dictionary_code,
  paradigm.article_id,
  paradigm.pos,
  paradigm.paradigm_id,
  paradigm.lemma,
  paradigm.source_name,
  paradigm.source_url,
  paradigm.source_article_version,
  paradigm.paradigm_tags,
  paradigm.inflection_group,
  paradigm.standardisation,
  paradigm.regularity_marker,
  paradigm.preference,
  form.id as form_id,
  form.form_key,
  form.value,
  form.normalized_value,
  form.tags,
  form.source_ordinal
from public.authoritative_morphology_snapshots_v2 as snapshot
join public.authoritative_morphology_paradigms_v2 as paradigm
  on paradigm.snapshot_id = snapshot.id
join public.authoritative_morphology_forms_v2 as form
  on form.paradigm_id = paradigm.id
where snapshot.is_active
  and snapshot.state = 'ready'
  and snapshot.is_complete;

alter table public.authoritative_morphology_snapshots_v2 enable row level security;
alter table public.authoritative_morphology_snapshots_v2 force row level security;
alter table public.authoritative_morphology_paradigms_v2 enable row level security;
alter table public.authoritative_morphology_paradigms_v2 force row level security;
alter table public.authoritative_morphology_forms_v2 enable row level security;
alter table public.authoritative_morphology_forms_v2 force row level security;

revoke all on table public.authoritative_morphology_snapshots_v2
  from public, anon, authenticated;
revoke all on table public.authoritative_morphology_paradigms_v2
  from public, anon, authenticated;
revoke all on table public.authoritative_morphology_forms_v2
  from public, anon, authenticated;
revoke all on table public.active_authoritative_morphology_forms_v2
  from public, anon, authenticated;
revoke execute on function public.finalize_authoritative_morphology_snapshot_v2(uuid)
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.authoritative_morphology_snapshots_v2 to service_role;
grant select, insert, update, delete
  on table public.authoritative_morphology_paradigms_v2 to service_role;
grant select, insert, update, delete
  on table public.authoritative_morphology_forms_v2 to service_role;
grant select on table public.active_authoritative_morphology_forms_v2
  to service_role;
grant execute on function public.finalize_authoritative_morphology_snapshot_v2(uuid)
  to service_role;

comment on table public.authoritative_morphology_snapshots_v2 is
  'D10 source-only morphology snapshots; service-role-only, no application cutover yet.';
comment on function public.finalize_authoritative_morphology_snapshot_v2(uuid) is
  'Atomically activates one complete source snapshot and excludes stale paradigms.';
