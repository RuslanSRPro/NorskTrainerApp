-- ============================================================================
-- A2.2
-- Canonical Dependency Action Activation Authority V1
-- Authored opaque authority version
--
-- D6 requires version as a non-empty authored source value and preserves it
-- opaquely. Version is NOT used for ordering, latest-winner selection,
-- supersession, activation inference, or runtime execution.
-- ============================================================================

alter table public.canonical_dependency_action_activation_authority_v1
    add column version text;

-- Existing rows cannot be assigned an invented version.
-- Migration must fail if authority rows already exist.
do $$
begin
    if exists (
        select 1
        from public.canonical_dependency_action_activation_authority_v1
    ) then
        raise exception
            'cannot add required authored authority version to existing activation authorities without source-backed values';
    end if;
end;
$$;

alter table public.canonical_dependency_action_activation_authority_v1
    alter column version set not null;

alter table public.canonical_dependency_action_activation_authority_v1
    add constraint canonical_dependency_action_activation_authority_v1_version_nonempty
    check (length(btrim(version)) > 0);

comment on column public.canonical_dependency_action_activation_authority_v1.version is
'Required authored opaque authority version preserved by D6. It must not be used for implicit latest-version selection, ordering, supersession inference, readiness inference, or execution permission inference.';

-- Replace the authoring API so version must be explicitly authored.
drop function if exists public.author_canonical_dependency_action_activation_authority_v1(
    text,
    text,
    text,
    jsonb,
    uuid
);

create or replace function public.author_canonical_dependency_action_activation_authority_v1(
    p_manifest_id text,
    p_dependency_action_authority_id text,
    p_version text,
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
    if p_manifest_id is null
       or length(btrim(p_manifest_id)) = 0 then
        raise exception 'manifest_id is required';
    end if;

    if p_dependency_action_authority_id is null
       or length(btrim(p_dependency_action_authority_id)) = 0 then
        raise exception 'dependency_action_authority_id is required';
    end if;

    if p_version is null
       or length(btrim(p_version)) = 0 then
        raise exception 'version is required';
    end if;

    if p_decision is null
       or p_decision not in ('granted', 'denied') then
        raise exception 'decision must be granted or denied';
    end if;

    if p_provenance is null
       or jsonb_typeof(p_provenance) <> 'object' then
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
        version,
        decision,
        provenance,
        supersedes_authority_id
    )
    values (
        p_manifest_id,
        p_dependency_action_authority_id,
        p_version,
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
    text,
    jsonb,
    uuid
) is
'Authors one immutable exact activation authority including its required opaque source version. Version is preserved, never used to select a latest authority.';

-- Exact-scope reader for D6.
--
-- IMPORTANT:
-- This intentionally returns the COMPLETE authority history for the exact
-- manifest/action scope. D6 owns validation of explicit supersession,
-- ambiguity, invalid history, and final granted/denied resolution.
create or replace function public.read_canonical_dependency_action_activation_authorities_v1(
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
      and a.dependency_action_authority_id =
          p_dependency_action_authority_id;
$$;

comment on function public.read_canonical_dependency_action_activation_authorities_v1(
    text,
    text
) is
'Returns all authored activation authorities for one exact manifest/action scope. It performs no latest-version selection and no activation resolution; D6 resolves the complete history.';