-- Materialized Lexeme360 family availability.
--
-- The application reads these fields with the lexeme and performs no
-- background family lookup. Recalculation occurs only when expression_catalog
-- changes, plus once during this migration for the initial projection.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create or replace function private.normalize_lexeme360_root_v1(value text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select nullif(
    btrim(
      regexp_replace(
        lower(coalesce(value, '')),
        '^å[[:space:]]+',
        ''
      )
    ),
    ''
  );
$$;

revoke all on function private.normalize_lexeme360_root_v1(text) from public;
revoke all on function private.normalize_lexeme360_root_v1(text) from anon;
revoke all on function private.normalize_lexeme360_root_v1(text) from authenticated;

create or replace function private.lexeme360_subtype_is_displayable_v1(
  subtype text,
  allow_empty boolean default true
)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select case
    when nullif(btrim(subtype), '') is null then allow_empty
    else lower(btrim(subtype)) = any(array[
      'particle_variant',
      'expression_family',
      'idiom_extension',
      'grammar_pattern',
      'prepositional_verb',
      'reflexive_expression',
      'collocation_with_shift',
      'particle_verb',
      'reflexive_particle_verb',
      'reflexive_construction',
      'verb_expression',
      'idiom',
      'ordbokene_sub_article',
      'has_expression'
    ])
  end;
$$;

revoke all on function private.lexeme360_subtype_is_displayable_v1(text, boolean)
  from public;
revoke all on function private.lexeme360_subtype_is_displayable_v1(text, boolean)
  from anon;
revoke all on function private.lexeme360_subtype_is_displayable_v1(text, boolean)
  from authenticated;

create or replace function private.lexeme360_candidate_is_displayable_v1(
  candidate jsonb
)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select
    candidate ->> 'verification_status' = 'candidate'
    and nullif(btrim(candidate ->> 'lexeme_id'), '') is null
    and nullif(btrim(candidate ->> 'lemma'), '') is not null
    and candidate ->> 'ordbokene_status' = 'sub_article'
    and private.lexeme360_subtype_is_displayable_v1(
      candidate ->> 'expression_subtype',
      false
    )
    and (
      nullif(btrim(candidate ->> 'ordbokene_article_id'), '') is not null
      or coalesce(candidate -> 'verification_evidence', 'null'::jsonb)::text
        ~ '"article_id"[[:space:]]*:[[:space:]]*"?[0-9]+'
    );
$$;

revoke all on function private.lexeme360_candidate_is_displayable_v1(jsonb)
  from public;
revoke all on function private.lexeme360_candidate_is_displayable_v1(jsonb)
  from anon;
revoke all on function private.lexeme360_candidate_is_displayable_v1(jsonb)
  from authenticated;

alter table public.lexemes
  add column if not exists lexeme360_root_lemma text,
  add column if not exists lexeme360_ready_count integer not null default 0,
  add column if not exists lexeme360_candidate_count integer not null default 0,
  add column if not exists lexeme360_display_relation_count integer
    generated always as (
      lexeme360_ready_count + lexeme360_candidate_count
    ) stored,
  add column if not exists lexeme360_available boolean
    generated always as (
      lexeme360_ready_count + lexeme360_candidate_count > 0
    ) stored,
  add column if not exists lexeme360_policy_version text
    not null default 'lexeme360-family/v1',
  add column if not exists lexeme360_refreshed_at timestamptz;

alter table public.lexemes
  drop constraint if exists lexemes_lexeme360_nonnegative_counts;

alter table public.lexemes
  add constraint lexemes_lexeme360_nonnegative_counts
  check (
    lexeme360_ready_count >= 0
    and lexeme360_candidate_count >= 0
  );

create index if not exists expression_catalog_lexeme360_root_v1_idx
  on public.expression_catalog (
    private.normalize_lexeme360_root_v1(root_lemma)
  )
  where nullif(btrim(root_lemma), '') is not null;

create index if not exists lexemes_lexeme360_lemma_v1_idx
  on public.lexemes (
    private.normalize_lexeme360_root_v1(lemma)
  )
  where is_learning_lexeme is not false
    and coalesce(dictionary_status, 'active') = 'active';

create index if not exists lexemes_lexeme360_available_v1_idx
  on public.lexemes (id)
  where lexeme360_available;

create or replace function private.refresh_lexeme360_family_v1(input_root text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  normalized_root text;
  root_lexeme_count integer := 0;
  root_lexeme_id uuid;
  ready_count integer := 0;
  candidate_count integer := 0;
  member_ids uuid[] := '{}'::uuid[];
begin
  normalized_root := private.normalize_lexeme360_root_v1(input_root);

  if normalized_root is null then
    return;
  end if;

  select count(*), (array_agg(l.id order by l.id))[1]
  into root_lexeme_count, root_lexeme_id
  from public.lexemes l
  where private.normalize_lexeme360_root_v1(l.lemma) = normalized_root
    and l.is_learning_lexeme is not false
    and coalesce(l.dictionary_status, 'active') = 'active';

  -- Ready members use exact expression_catalog.lexeme_id identity.
  select
    count(distinct ec.id),
    coalesce(
      array_agg(distinct ec.lexeme_id)
        filter (where ec.lexeme_id is not null),
      '{}'::uuid[]
    )
  into ready_count, member_ids
  from public.expression_catalog ec
  join public.lexemes target
    on target.id = ec.lexeme_id
  where private.normalize_lexeme360_root_v1(ec.root_lemma) = normalized_root
    and ec.verification_status in (
      'multi_source',
      'authoritative',
      'usage_verified'
    )
    and nullif(btrim(ec.lemma), '') is not null
    and private.lexeme360_subtype_is_displayable_v1(
      ec.expression_subtype,
      true
    )
    and target.is_learning_lexeme is not false
    and coalesce(target.dictionary_status, 'active') = 'active';

  -- Candidate expressions are attached only to one unambiguous active root.
  -- They remain candidates/grey cards; this projection does not promote them.
  if root_lexeme_count = 1 then
    select count(distinct ec.id)
    into candidate_count
    from public.expression_catalog ec
    where private.normalize_lexeme360_root_v1(ec.root_lemma) =
      normalized_root
      and private.lexeme360_candidate_is_displayable_v1(to_jsonb(ec));

    if not root_lexeme_id = any(member_ids) then
      member_ids := array_append(member_ids, root_lexeme_id);
    end if;
  else
    candidate_count := 0;
    root_lexeme_id := null;
  end if;

  -- Remove a stale projection from rows no longer belonging to the family.
  update public.lexemes l
  set
    lexeme360_root_lemma = null,
    lexeme360_ready_count = 0,
    lexeme360_candidate_count = 0,
    lexeme360_policy_version = 'lexeme360-family/v1',
    lexeme360_refreshed_at = clock_timestamp()
  where private.normalize_lexeme360_root_v1(l.lexeme360_root_lemma) =
      normalized_root
    and not (l.id = any(member_ids));

  -- Every exact ready member receives the family projection.
  -- The unique root also receives qualified candidate counts.
  update public.lexemes l
  set
    lexeme360_root_lemma = normalized_root,
    lexeme360_ready_count = ready_count,
    lexeme360_candidate_count = candidate_count,
    lexeme360_policy_version = 'lexeme360-family/v1',
    lexeme360_refreshed_at = clock_timestamp()
  where l.id = any(member_ids);
end;
$$;

revoke all on function private.refresh_lexeme360_family_v1(text) from public;
revoke all on function private.refresh_lexeme360_family_v1(text) from anon;
revoke all on function private.refresh_lexeme360_family_v1(text)
  from authenticated;

create or replace function private.refresh_lexeme360_family_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_lexeme360_family_v1(old.root_lemma);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if tg_op <> 'UPDATE'
      or private.normalize_lexeme360_root_v1(new.root_lemma)
        is distinct from
        private.normalize_lexeme360_root_v1(old.root_lemma)
      or to_jsonb(new) is distinct from to_jsonb(old)
    then
      perform private.refresh_lexeme360_family_v1(new.root_lemma);
    end if;
  end if;

  return null;
end;
$$;

revoke all on function private.refresh_lexeme360_family_trigger_v1()
  from public;
revoke all on function private.refresh_lexeme360_family_trigger_v1()
  from anon;
revoke all on function private.refresh_lexeme360_family_trigger_v1()
  from authenticated;

-- Bulk initial projection: each source table is scanned a bounded number of times.
-- Normal operation remains expression_catalog-triggered for one affected root.
update public.lexemes
set
  lexeme360_root_lemma = null,
  lexeme360_ready_count = 0,
  lexeme360_candidate_count = 0,
  lexeme360_policy_version = 'lexeme360-family/v1',
  lexeme360_refreshed_at = clock_timestamp();

with
families as (
  select distinct
    private.normalize_lexeme360_root_v1(ec.root_lemma) as root_lemma
  from public.expression_catalog ec
  where private.normalize_lexeme360_root_v1(ec.root_lemma) is not null
),
active_roots as (
  select
    private.normalize_lexeme360_root_v1(l.lemma) as root_lemma,
    count(*)::integer as root_count,
    (array_agg(l.id order by l.id))[1] as root_lexeme_id
  from public.lexemes l
  where l.is_learning_lexeme is not false
    and coalesce(l.dictionary_status, 'active') = 'active'
    and private.normalize_lexeme360_root_v1(l.lemma) is not null
  group by private.normalize_lexeme360_root_v1(l.lemma)
),
ready_families as (
  select
    private.normalize_lexeme360_root_v1(ec.root_lemma) as root_lemma,
    count(distinct ec.id)::integer as ready_count,
    coalesce(
      array_agg(distinct ec.lexeme_id)
        filter (where ec.lexeme_id is not null),
      '{}'::uuid[]
    ) as ready_member_ids
  from public.expression_catalog ec
  join public.lexemes target
    on target.id = ec.lexeme_id
  where ec.verification_status in (
      'multi_source',
      'authoritative',
      'usage_verified'
    )
    and nullif(btrim(ec.lemma), '') is not null
    and private.normalize_lexeme360_root_v1(ec.root_lemma) is not null
    and private.lexeme360_subtype_is_displayable_v1(
      ec.expression_subtype,
      true
    )
    and target.is_learning_lexeme is not false
    and coalesce(target.dictionary_status, 'active') = 'active'
  group by private.normalize_lexeme360_root_v1(ec.root_lemma)
),
candidate_families as (
  select
    private.normalize_lexeme360_root_v1(ec.root_lemma) as root_lemma,
    count(distinct ec.id)::integer as candidate_count
  from public.expression_catalog ec
  where private.normalize_lexeme360_root_v1(ec.root_lemma) is not null
    and private.lexeme360_candidate_is_displayable_v1(to_jsonb(ec))
  group by private.normalize_lexeme360_root_v1(ec.root_lemma)
),
family_projection as (
  select
    f.root_lemma,
    coalesce(r.ready_count, 0) as ready_count,
    case
      when ar.root_count = 1 then coalesce(c.candidate_count, 0)
      else 0
    end as candidate_count,
    array_remove(
      array_cat(
        coalesce(r.ready_member_ids, '{}'::uuid[]),
        case
          when ar.root_count = 1
            then array[ar.root_lexeme_id]::uuid[]
          else '{}'::uuid[]
        end
      ),
      null
    ) as member_ids
  from families f
  left join active_roots ar
    on ar.root_lemma = f.root_lemma
  left join ready_families r
    on r.root_lemma = f.root_lemma
  left join candidate_families c
    on c.root_lemma = f.root_lemma
),
expanded_projection as (
  select distinct
    fp.root_lemma,
    fp.ready_count,
    fp.candidate_count,
    unnest(fp.member_ids) as lexeme_id
  from family_projection fp
)
update public.lexemes l
set
  lexeme360_root_lemma = p.root_lemma,
  lexeme360_ready_count = p.ready_count,
  lexeme360_candidate_count = p.candidate_count,
  lexeme360_policy_version = 'lexeme360-family/v1',
  lexeme360_refreshed_at = clock_timestamp()
from expanded_projection p
where l.id = p.lexeme_id;

drop trigger if exists refresh_lexeme360_family_v1
  on public.expression_catalog;

create trigger refresh_lexeme360_family_v1
after insert or update or delete
on public.expression_catalog
for each row
execute function private.refresh_lexeme360_family_trigger_v1();

comment on column public.lexemes.lexeme360_available is
  'Materialized Lexeme360 icon availability; no client-side family polling.';

comment on column public.lexemes.lexeme360_candidate_count is
  'Qualified grey candidate expressions; does not imply authoritative status.';

comment on function private.refresh_lexeme360_family_v1(text) is
  'Internal event-driven projection refresh for one normalized family root.';