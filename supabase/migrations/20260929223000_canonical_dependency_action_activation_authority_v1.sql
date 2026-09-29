-- ============================================================================
-- Canonical Dependency Action Activation Authority V1
--
-- Authored immutable source of truth for execution permission.
--
-- IMPORTANT:
--   validated != activated
--   compiled != activated
--   runtime_eligible != activated
--   activation_ready != activated
--   grammar_rules.is_active != activated
--   shadow/canary/promotion != activated
--
-- Permission exists only as an explicit authored decision for the exact:
--
--   manifest_id + dependency_action_authority_id
--
-- History is append-only.
-- A newer decision does not silently overwrite an older decision.
-- Supersession must be explicit.
-- ============================================================================

create table if not exists public.canonical_dependency_action_activation_authority_v1 (
    authority_id uuid primary key default gen_random_uuid(),

    manifest_id text not null,
    dependency_action_authority_id text not null,

    decision text not null
        check (decision in ('granted', 'denied')),

    provenance jsonb not null,

    authored_at timestamptz not null default now(),

    supersedes_authority_id uuid null
        references public.canonical_dependency_action_activation_authority_v1(authority_id),

    constraint canonical_dependency_action_activation_authority_v1_identity_unique
        unique (authority_id, manifest_id, dependency_action_authority_id),

    constraint canonical_dependency_action_activation_authority_v1_no_self_supersession
        check (
            supersedes_authority_id is null
            or supersedes_authority_id <> authority_id
        ),

    constraint canonical_dependency_action_activation_authority_v1_manifest_nonempty
        check (length(btrim(manifest_id)) > 0),

    constraint canonical_dependency_action_activation_authority_v1_action_nonempty
        check (length(btrim(dependency_action_authority_id)) > 0),

    constraint canonical_dependency_action_activation_authority_v1_provenance_object
        check (jsonb_typeof(provenance) = 'object')
);

comment on table public.canonical_dependency_action_activation_authority_v1 is
'Immutable authored execution-permission authority for one exact canonical manifest and dependency action authority. This table must never infer activation from is_active, validation, compilation, readiness, shadow, canary, promotion, candidate count, or runtime eligibility.';

comment on column public.canonical_dependency_action_activation_authority_v1.manifest_id is
'Exact canonical manifest identity.';

comment on column public.canonical_dependency_action_activation_authority_v1.dependency_action_authority_id is
'Exact CanonicalDependencyRuntimeActionAuthorityV1 identity.';

comment on column public.canonical_dependency_action_activation_authority_v1.decision is
'Explicit authored execution permission: granted or denied.';

comment on column public.canonical_dependency_action_activation_authority_v1.provenance is
'Authored provenance. Presence of provenance does not itself imply permission.';

comment on column public.canonical_dependency_action_activation_authority_v1.supersedes_authority_id is
'Explicit prior authority superseded by this authored decision. Null means this row does not claim to supersede another authority.';

-- --------------------------------------------------------------------------
-- Append-only protection.
-- Existing authority rows are historical source facts and may not be updated
-- or deleted through ordinary SQL operations.
-- --------------------------------------------------------------------------

create or replace function public.prevent_canonical_dependency_action_activation_authority_v1_mutation()
returns trigger
language plpgsql
as $$
begin
    raise exception
        'canonical_dependency_action_activation_authority_v1 is append-only; update/delete is forbidden';
end;
$$;

drop trigger if exists canonical_dependency_action_activation_authority_v1_append_only
on public.canonical_dependency_action_activation_authority_v1;

create trigger canonical_dependency_action_activation_authority_v1_append_only
before update or delete
on public.canonical_dependency_action_activation_authority_v1
for each row
execute function public.prevent_canonical_dependency_action_activation_authority_v1_mutation();

-- --------------------------------------------------------------------------
-- Exact authored insertion API.
--
-- This function authors permission; it does not infer permission.
-- It performs no grammar execution and no rule selection.
-- --------------------------------------------------------------------------

create or replace function public.author_canonical_dependency_action_activation_authority_v1(
    p_manifest_id text,
    p_dependency_action_authority_id text,
    p_decision text,
    p_provenance jsonb,
    p_supersedes_authority_id uuid default null
)
returns public.canonical_dependency_action_activation_authority_v1
language plpgsql
as $$
declare
    v_prior public.canonical_dependency_action_activation_authority_v1;
    v_result public.canonical_dependency_action_activation_authority_v1;
begin
    if p_manifest_id is null or length(btrim(p_manifest_id)) = 0 then
        raise exception 'manifest_id is required';
    end if;

    if p_dependency_action_authority_id is null
       or length(btrim(p_dependency_action_authority_id)) = 0 then
        raise exception 'dependency_action_authority_id is required';
    end if;

    if p_decision is null or p_decision not in ('granted', 'denied') then
        raise exception 'decision must be granted or denied';
    end if;

    if p_provenance is null or jsonb_typeof(p_provenance) <> 'object' then
        raise exception 'provenance must be a JSON object';
    end if;

    if p_supersedes_authority_id is not null then
        select *
        into v_prior
        from public.canonical_dependency_action_activation_authority_v1
        where authority_id = p_supersedes_authority_id;

        if not found then
            raise exception 'superseded authority does not exist';
        end if;

        if v_prior.manifest_id <> p_manifest_id then
            raise exception
                'supersession manifest identity mismatch';
        end if;

        if v_prior.dependency_action_authority_id
           <> p_dependency_action_authority_id then
            raise exception
                'supersession dependency action authority identity mismatch';
        end if;

        if exists (
            select 1
            from public.canonical_dependency_action_activation_authority_v1
            where supersedes_authority_id = p_supersedes_authority_id
        ) then
            raise exception
                'superseded authority already has a direct successor';
        end if;
    end if;

    insert into public.canonical_dependency_action_activation_authority_v1 (
        manifest_id,
        dependency_action_authority_id,
        decision,
        provenance,
        supersedes_authority_id
    )
    values (
        p_manifest_id,
        p_dependency_action_authority_id,
        p_decision,
        p_provenance,
        p_supersedes_authority_id
    )
    returning *
    into v_result;

    return v_result;
end;
$$;

comment on function public.author_canonical_dependency_action_activation_authority_v1(
    text,
    text,
    text,
    jsonb,
    uuid
) is
'Authors one immutable explicit activation authority. Never derives permission from readiness, validation, compilation, is_active, shadow, canary, promotion, or candidate count.';

-- --------------------------------------------------------------------------
-- Current-authority reader.
--
-- "Current" is defined structurally:
-- an authority is current only if no later authored row explicitly
-- supersedes it.
--
-- This function does NOT use authored_at ordering to manufacture authority.
--
-- 0 current rows  -> absent
-- 1 current row   -> exact current authority
-- >1 current rows -> ambiguous; caller must fail closed
-- --------------------------------------------------------------------------

create or replace function public.read_current_canonical_dependency_action_activation_authority_v1(
    p_manifest_id text,
    p_dependency_action_authority_id text
)
returns setof public.canonical_dependency_action_activation_authority_v1
language sql
stable
as $$
    select a.*
    from public.canonical_dependency_action_activation_authority_v1 a
    where a.manifest_id = p_manifest_id
      and a.dependency_action_authority_id = p_dependency_action_authority_id
      and not exists (
          select 1
          from public.canonical_dependency_action_activation_authority_v1 successor
          where successor.supersedes_authority_id = a.authority_id
      );
$$;

comment on function public.read_current_canonical_dependency_action_activation_authority_v1(
    text,
    text
) is
'Returns structurally current authored activation authorities for one exact manifest/action identity. Multiple rows remain visible so the canonical runtime can classify ambiguity rather than selecting a winner.';

-- --------------------------------------------------------------------------
-- Security posture.
--
-- No blanket public execution grants are introduced here.
-- Existing project migration/RPC privilege policy must explicitly decide
-- who may author activation authority.
-- --------------------------------------------------------------------------