-- Lexeme360 root identity v2.
--
-- A family is attached to one or more exact root lexemes. Verification and
-- candidate/ready state remain owned exclusively by expression_catalog.

create table private.lexeme360_expression_roots_v1 (
  expression_id uuid not null references public.expression_catalog(id)
    on delete cascade,
  root_lexeme_id uuid not null references public.lexemes(id)
    on delete cascade,
  source_kind text not null,
  dictionary_code text,
  source_article_id bigint,
  source_pos text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (expression_id, root_lexeme_id),
  check (btrim(source_kind) <> ''),
  check (source_article_id is null or source_article_id > 0)
);

alter table private.lexeme360_expression_roots_v1 enable row level security;
alter table private.lexeme360_expression_roots_v1 force row level security;

revoke all on table private.lexeme360_expression_roots_v1 from public;
revoke all on table private.lexeme360_expression_roots_v1 from anon;
revoke all on table private.lexeme360_expression_roots_v1 from authenticated;

create index lexeme360_expression_roots_v1_root_idx
  on private.lexeme360_expression_roots_v1 (root_lexeme_id, expression_id);

-- Source-exact backfill. One promoted expression may have more than one
-- parent candidate, so every unambiguous article binding is retained.
with source_bindings as (
  select
    candidate.promoted_expression_id as expression_id,
    lower(btrim(candidate.parent_dictionary_code)) as dictionary_code,
    candidate.parent_article_id as source_article_id,
    min(alias.pos) as source_pos,
    min(alias.lexeme_id::text)::uuid as root_lexeme_id,
    count(distinct alias.lexeme_id) as root_count
  from public.ordbokene_expression_candidates candidate
  join public.expression_catalog source_expression
    on source_expression.id = candidate.promoted_expression_id
  join public.lexeme_headword_aliases_v2 alias
    on alias.dictionary_code = lower(btrim(candidate.parent_dictionary_code))
   and alias.article_id = candidate.parent_article_id
   and alias.normalized_headword =
     private.normalize_lexeme360_root_v1(candidate.parent_lemma)
   and alias.is_active
  where candidate.promoted_expression_id is not null
    and candidate.status in ('promoted', 'duplicate')
  group by
    candidate.promoted_expression_id,
    lower(btrim(candidate.parent_dictionary_code)),
    candidate.parent_article_id
), exact_source_bindings as (
  select *
  from source_bindings
  where root_count = 1
)
insert into private.lexeme360_expression_roots_v1 (
  expression_id,
  root_lexeme_id,
  source_kind,
  dictionary_code,
  source_article_id,
  source_pos,
  evidence
)
select
  binding.expression_id,
  binding.root_lexeme_id,
  'ordbokene_parent_article',
  binding.dictionary_code,
  binding.source_article_id,
  binding.source_pos,
  jsonb_build_object(
    'resolver', 'lexeme_headword_aliases_v2',
    'policy', 'exact_article_headword_identity'
  )
from exact_source_bindings binding
on conflict (expression_id, root_lexeme_id) do nothing;

-- Legacy fallback is allowed only for one active learning root. Ambiguous
-- roots remain deliberately unbound and fail closed.
with active_roots as (
  select
    private.normalize_lexeme360_root_v1(lemma) as normalized_root,
    min(id::text)::uuid as root_lexeme_id,
    count(*) as root_count
  from public.lexemes
  where is_learning_lexeme is not false
    and coalesce(dictionary_status, 'active') = 'active'
    and private.normalize_lexeme360_root_v1(lemma) is not null
  group by private.normalize_lexeme360_root_v1(lemma)
)
insert into private.lexeme360_expression_roots_v1 (
  expression_id,
  root_lexeme_id,
  source_kind,
  evidence
)
select
  expression.id,
  root.root_lexeme_id,
  'unique_legacy_root_lemma',
  jsonb_build_object(
    'resolver', 'normalize_lexeme360_root_v1',
    'policy', 'unique_active_learning_root'
  )
from public.expression_catalog expression
join active_roots root
  on root.normalized_root =
    private.normalize_lexeme360_root_v1(expression.root_lemma)
 and root.root_count = 1
where not exists (
  select 1
  from private.lexeme360_expression_roots_v1 existing
  where existing.expression_id = expression.id
)
on conflict (expression_id, root_lexeme_id) do nothing;

create or replace function private.lexeme360_roots_for_lexeme_v2(
  input_lexeme_id uuid
)
returns table (root_lexeme_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select input_lexeme_id
  where exists (
    select 1
    from private.lexeme360_expression_roots_v1 binding
    where binding.root_lexeme_id = input_lexeme_id
  )
  union
  select binding.root_lexeme_id
  from public.expression_catalog expression
  join private.lexeme360_expression_roots_v1 binding
    on binding.expression_id = expression.id
  where expression.lexeme_id = input_lexeme_id;
$$;

revoke all on function private.lexeme360_roots_for_lexeme_v2(uuid)
  from public, anon, authenticated;

create or replace function private.refresh_lexeme360_lexeme_v2(
  input_lexeme_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  ready_count integer := 0;
  candidate_count integer := 0;
  display_root text;
begin
  select
    count(distinct expression.id)::integer,
    min(private.normalize_lexeme360_root_v1(root.lemma))
  into ready_count, display_root
  from private.lexeme360_roots_for_lexeme_v2(input_lexeme_id) family
  join public.lexemes root on root.id = family.root_lexeme_id
  join private.lexeme360_expression_roots_v1 binding
    on binding.root_lexeme_id = family.root_lexeme_id
  join public.expression_catalog expression
    on expression.id = binding.expression_id
  join public.lexemes target on target.id = expression.lexeme_id
  where expression.verification_status in (
      'multi_source', 'authoritative', 'usage_verified'
    )
    and nullif(btrim(expression.lemma), '') is not null
    and private.lexeme360_subtype_is_displayable_v1(
      expression.expression_subtype,
      true
    )
    and target.is_learning_lexeme is not false
    and coalesce(target.dictionary_status, 'active') = 'active';

  select count(distinct expression.id)::integer
  into candidate_count
  from private.lexeme360_roots_for_lexeme_v2(input_lexeme_id) family
  join private.lexeme360_expression_roots_v1 binding
    on binding.root_lexeme_id = family.root_lexeme_id
  join public.expression_catalog expression
    on expression.id = binding.expression_id
  left join public.lexemes target on target.id = expression.lexeme_id
  where private.lexeme360_candidate_is_displayable_v1(to_jsonb(expression))
    or (
      expression.verification_status in (
        'multi_source', 'authoritative', 'usage_verified'
      )
      and target.id is not null
      and target.is_learning_lexeme is false
      and coalesce(target.dictionary_status, 'active') = 'active'
      and private.lexeme360_subtype_is_displayable_v1(
        expression.expression_subtype,
        true
      )
    );

  update public.lexemes
  set
    lexeme360_root_lemma = display_root,
    lexeme360_ready_count = ready_count,
    lexeme360_candidate_count = candidate_count,
    lexeme360_policy_version = 'lexeme360-family/v2-root-identity',
    lexeme360_refreshed_at = clock_timestamp()
  where id = input_lexeme_id;
end;
$$;

revoke all on function private.refresh_lexeme360_lexeme_v2(uuid)
  from public, anon, authenticated;

create or replace function private.refresh_lexeme360_root_v2(
  input_root_lexeme_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  affected_lexeme_id uuid;
begin
  perform private.refresh_lexeme360_lexeme_v2(input_root_lexeme_id);

  for affected_lexeme_id in
    select distinct expression.lexeme_id
    from private.lexeme360_expression_roots_v1 binding
    join public.expression_catalog expression
      on expression.id = binding.expression_id
    where binding.root_lexeme_id = input_root_lexeme_id
      and expression.lexeme_id is not null
  loop
    perform private.refresh_lexeme360_lexeme_v2(affected_lexeme_id);
  end loop;
end;
$$;

revoke all on function private.refresh_lexeme360_root_v2(uuid)
  from public, anon, authenticated;

create or replace function private.refresh_lexeme360_expression_trigger_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  affected_expression_id uuid;
  affected_root_id uuid;
begin
  affected_expression_id := case when tg_op = 'DELETE' then old.id else new.id end;

  for affected_root_id in
    select binding.root_lexeme_id
    from private.lexeme360_expression_roots_v1 binding
    where binding.expression_id = affected_expression_id
  loop
    perform private.refresh_lexeme360_root_v2(affected_root_id);
  end loop;

  if tg_op in ('UPDATE', 'DELETE') and old.lexeme_id is not null then
    perform private.refresh_lexeme360_lexeme_v2(old.lexeme_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.lexeme_id is not null then
    perform private.refresh_lexeme360_lexeme_v2(new.lexeme_id);
  end if;
  return null;
end;
$$;

revoke all on function private.refresh_lexeme360_expression_trigger_v2()
  from public, anon, authenticated;

create or replace function private.refresh_lexeme360_binding_trigger_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  expression_lexeme_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_lexeme360_root_v2(old.root_lexeme_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE')
    and (tg_op = 'INSERT' or new.root_lexeme_id is distinct from old.root_lexeme_id)
  then
    perform private.refresh_lexeme360_root_v2(new.root_lexeme_id);
  end if;

  select expression.lexeme_id into expression_lexeme_id
  from public.expression_catalog expression
  where expression.id = case
    when tg_op = 'DELETE' then old.expression_id
    else new.expression_id
  end;
  if expression_lexeme_id is not null then
    perform private.refresh_lexeme360_lexeme_v2(expression_lexeme_id);
  end if;
  return null;
end;
$$;

revoke all on function private.refresh_lexeme360_binding_trigger_v2()
  from public, anon, authenticated;

drop trigger if exists refresh_lexeme360_family_v1
  on public.expression_catalog;
drop trigger if exists refresh_lexeme360_expression_v2
  on public.expression_catalog;
create trigger refresh_lexeme360_expression_v2
after insert or update or delete on public.expression_catalog
for each row execute function private.refresh_lexeme360_expression_trigger_v2();

drop trigger if exists refresh_lexeme360_binding_v2
  on private.lexeme360_expression_roots_v1;
create trigger refresh_lexeme360_binding_v2
after insert or update or delete on private.lexeme360_expression_roots_v1
for each row execute function private.refresh_lexeme360_binding_trigger_v2();

-- Service-only writer used by Ordbokene workers. It resolves the parent
-- article to exactly one canonical lexeme and otherwise writes nothing.
create or replace function public.bind_lexeme360_expression_root_v2(
  p_expression_id uuid,
  p_parent_article_id bigint,
  p_dictionary_code text,
  p_parent_lemma text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  resolved_root_id uuid;
  resolved_pos text;
begin
  select min(alias.lexeme_id::text)::uuid, min(alias.pos)
  into resolved_root_id, resolved_pos
  from public.lexeme_headword_aliases_v2 alias
  where alias.dictionary_code = lower(btrim(p_dictionary_code))
    and alias.article_id = p_parent_article_id
    and alias.normalized_headword =
      private.normalize_lexeme360_root_v1(p_parent_lemma)
    and alias.is_active
  having count(distinct alias.lexeme_id) = 1;

  if resolved_root_id is null then
    return null;
  end if;

  insert into private.lexeme360_expression_roots_v1 (
    expression_id, root_lexeme_id, source_kind, dictionary_code,
    source_article_id, source_pos, evidence, updated_at
  ) values (
    p_expression_id, resolved_root_id, 'ordbokene_parent_article',
    lower(btrim(p_dictionary_code)), p_parent_article_id, resolved_pos,
    jsonb_build_object(
      'resolver', 'lexeme_headword_aliases_v2',
      'policy', 'exact_article_headword_identity'
    ), clock_timestamp()
  )
  on conflict (expression_id, root_lexeme_id) do update set
    source_kind = excluded.source_kind,
    dictionary_code = excluded.dictionary_code,
    source_article_id = excluded.source_article_id,
    source_pos = excluded.source_pos,
    evidence = excluded.evidence,
    updated_at = excluded.updated_at;

  return resolved_root_id;
end;
$$;

revoke all on function public.bind_lexeme360_expression_root_v2(
  uuid, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.bind_lexeme360_expression_root_v2(
  uuid, bigint, text, text
) to service_role;

create or replace function public.get_lexeme360_ready_expressions_v2(
  p_lexeme_id uuid
)
returns table (
  lexeme_id uuid,
  expression_id uuid,
  lemma text,
  pos text,
  expression_subtype text,
  verification_status text
)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select distinct
    expression.lexeme_id,
    expression.id,
    target.lemma,
    target.pos,
    expression.expression_subtype,
    expression.verification_status
  from private.lexeme360_roots_for_lexeme_v2(p_lexeme_id) family
  join private.lexeme360_expression_roots_v1 binding
    on binding.root_lexeme_id = family.root_lexeme_id
  join public.expression_catalog expression
    on expression.id = binding.expression_id
  join public.lexemes target on target.id = expression.lexeme_id
  where expression.verification_status in (
      'multi_source', 'authoritative', 'usage_verified'
    )
    and private.lexeme360_subtype_is_displayable_v1(
      expression.expression_subtype,
      true
    )
    and target.is_learning_lexeme is not false
    and coalesce(target.dictionary_status, 'active') = 'active'
  order by target.lemma, expression.id;
$$;

revoke all on function public.get_lexeme360_ready_expressions_v2(uuid)
  from public, anon;
grant execute on function public.get_lexeme360_ready_expressions_v2(uuid)
  to authenticated;

create or replace function public.get_lexeme360_candidate_expressions_v2(
  p_lexeme_id uuid
)
returns table (
  id uuid,
  lemma text,
  expression_subtype text,
  status text
)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select distinct
    expression.id,
    expression.lemma,
    expression.expression_subtype,
    expression.verification_status
  from private.lexeme360_roots_for_lexeme_v2(p_lexeme_id) family
  join private.lexeme360_expression_roots_v1 binding
    on binding.root_lexeme_id = family.root_lexeme_id
  join public.expression_catalog expression
    on expression.id = binding.expression_id
  left join public.lexemes target on target.id = expression.lexeme_id
  where private.lexeme360_candidate_is_displayable_v1(to_jsonb(expression))
    or (
      expression.verification_status in (
        'multi_source', 'authoritative', 'usage_verified'
      )
      and target.id is not null
      and target.is_learning_lexeme is false
      and coalesce(target.dictionary_status, 'active') = 'active'
      and private.lexeme360_subtype_is_displayable_v1(
        expression.expression_subtype,
        true
      )
    )
  order by expression.lemma, expression.id;
$$;

revoke all on function public.get_lexeme360_candidate_expressions_v2(uuid)
  from public, anon;
grant execute on function public.get_lexeme360_candidate_expressions_v2(uuid)
  to authenticated;

-- Bulk initial projection: bounded scans, no per-root/member loop.
update public.lexemes
set
  lexeme360_root_lemma = null,
  lexeme360_ready_count = 0,
  lexeme360_candidate_count = 0,
  lexeme360_policy_version = 'lexeme360-family/v2-root-identity',
  lexeme360_refreshed_at = clock_timestamp();

with
qualified_expressions as materialized (
  select
    expression.id as expression_id,
    expression.lexeme_id,
    (
      expression.verification_status in (
        'multi_source',
        'authoritative',
        'usage_verified'
      )
      and target.id is not null
      and target.is_learning_lexeme is not false
      and coalesce(target.dictionary_status, 'active') = 'active'
      and nullif(btrim(expression.lemma), '') is not null
      and private.lexeme360_subtype_is_displayable_v1(
        expression.expression_subtype,
        true
      )
    ) as is_ready,
    (
      private.lexeme360_candidate_is_displayable_v1(
        to_jsonb(expression)
      )
      or (
        expression.verification_status in (
          'multi_source',
          'authoritative',
          'usage_verified'
        )
        and target.id is not null
        and target.is_learning_lexeme is false
        and coalesce(target.dictionary_status, 'active') = 'active'
        and private.lexeme360_subtype_is_displayable_v1(
          expression.expression_subtype,
          true
        )
      )
    ) as is_candidate
  from public.expression_catalog expression
  left join public.lexemes target
    on target.id = expression.lexeme_id
),
roots_for_lexeme as (
  select distinct
    binding.root_lexeme_id as lexeme_id,
    binding.root_lexeme_id
  from private.lexeme360_expression_roots_v1 binding

  union

  select distinct
    expression.lexeme_id,
    binding.root_lexeme_id
  from private.lexeme360_expression_roots_v1 binding
  join public.expression_catalog expression
    on expression.id = binding.expression_id
  where expression.lexeme_id is not null
),
projection as (
  select
    family.lexeme_id,
    min(
      private.normalize_lexeme360_root_v1(root.lemma)
    ) as display_root,
    count(distinct qualified.expression_id)
      filter (where qualified.is_ready)::integer as ready_count,
    count(distinct qualified.expression_id)
      filter (where qualified.is_candidate)::integer as candidate_count
  from roots_for_lexeme family
  join public.lexemes root
    on root.id = family.root_lexeme_id
  join private.lexeme360_expression_roots_v1 binding
    on binding.root_lexeme_id = family.root_lexeme_id
  join qualified_expressions qualified
    on qualified.expression_id = binding.expression_id
  group by family.lexeme_id
)
update public.lexemes lexeme
set
  lexeme360_root_lemma = projection.display_root,
  lexeme360_ready_count = projection.ready_count,
  lexeme360_candidate_count = projection.candidate_count,
  lexeme360_policy_version = 'lexeme360-family/v2-root-identity',
  lexeme360_refreshed_at = clock_timestamp()
from projection
where lexeme.id = projection.lexeme_id;

comment on table private.lexeme360_expression_roots_v1 is
  'Many-to-many Lexeme360 root identity and provenance; status remains in expression_catalog.';
