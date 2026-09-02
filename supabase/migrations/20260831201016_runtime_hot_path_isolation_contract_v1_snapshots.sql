create table if not exists public.grammar_runtime_release_dependency_facts_v1 (
  release_id uuid not null references public.grammar_runtime_releases(id) on delete cascade,
  fact_type text not null,
  fact_key text not null,
  source_kind text not null,
  provenance jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(release_id,fact_type,fact_key,source_kind)
);
alter table public.grammar_runtime_release_dependency_facts_v1 enable row level security;
drop policy if exists grammar_runtime_release_dependency_facts_read on public.grammar_runtime_release_dependency_facts_v1;
create policy grammar_runtime_release_dependency_facts_read on public.grammar_runtime_release_dependency_facts_v1 for select to anon,authenticated using(true);
revoke insert,update,delete on public.grammar_runtime_release_dependency_facts_v1 from anon,authenticated;
grant select on public.grammar_runtime_release_dependency_facts_v1 to anon,authenticated;

create table if not exists public.grammar_runtime_source_facts_v1 (
  fact_code text primary key,
  fact_type text not null,
  payload jsonb not null,
  provenance jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.grammar_runtime_source_facts_v1 enable row level security;
drop policy if exists grammar_runtime_source_facts_read on public.grammar_runtime_source_facts_v1;
create policy grammar_runtime_source_facts_read on public.grammar_runtime_source_facts_v1 for select to anon,authenticated using(true);
revoke insert,update,delete on public.grammar_runtime_source_facts_v1 from anon,authenticated;
grant select on public.grammar_runtime_source_facts_v1 to anon,authenticated;

create or replace function public.runtime_release_dependency_fact_v1(p_release_code text,p_fact_type text,p_fact_key text default null)
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
select coalesce(jsonb_agg(jsonb_build_object('fact_type',f.fact_type,'fact_key',f.fact_key,'source_kind',f.source_kind,'provenance',f.provenance) order by f.fact_key,f.source_kind),'[]'::jsonb)
from public.grammar_runtime_release_dependency_facts_v1 f join public.grammar_runtime_releases r on r.id=f.release_id
where r.code=p_release_code and f.is_enabled and f.fact_type=p_fact_type and (p_fact_key is null or f.fact_key=p_fact_key);
$$;

create or replace function public.runtime_source_fact_v1(p_fact_code text)
returns jsonb language sql stable set search_path to 'public','pg_catalog' as $$
select coalesce(jsonb_build_object('fact_code',fact_code,'fact_type',fact_type,'payload',payload,'provenance',provenance),'{}'::jsonb) from public.grammar_runtime_source_facts_v1 where fact_code=p_fact_code;
$$;
