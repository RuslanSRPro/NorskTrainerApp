-- R059: install the dormant one-rule admission boundary after local P1 parity.
-- This migration creates no grant and does not activate or expose a rule to the app.
-- The caller must supply a precomputed sentence from the unchanged v1.37 release.

create schema if not exists grammar_pilot_private;
revoke all on schema grammar_pilot_private from public, anon, authenticated;
grant usage on schema grammar_pilot_private to service_role;

create table grammar_pilot_private.rule_grants_v1 (
  grant_id bigint generated always as identity primary key,
  release_code text not null,
  rule_code text not null,
  compiled_hash text not null,
  granted_by text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > granted_at)
);

create table grammar_pilot_private.rule_revocations_v1 (
  grant_id bigint primary key references grammar_pilot_private.rule_grants_v1(grant_id),
  revoked_by text not null,
  revoked_at timestamptz not null default now()
);

alter table grammar_pilot_private.rule_grants_v1 enable row level security;
alter table grammar_pilot_private.rule_revocations_v1 enable row level security;
create or replace function grammar_pilot_private.reject_event_mutation_v1()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  raise exception 'PILOT_EVENTS_APPEND_ONLY';
end;
$function$;
create trigger rule_grants_immutable_v1 before update or delete
  on grammar_pilot_private.rule_grants_v1 for each row
  execute function grammar_pilot_private.reject_event_mutation_v1();
create trigger rule_revocations_immutable_v1 before update or delete
  on grammar_pilot_private.rule_revocations_v1 for each row
  execute function grammar_pilot_private.reject_event_mutation_v1();
revoke all on grammar_pilot_private.rule_grants_v1 from public, anon, authenticated, service_role;
revoke all on grammar_pilot_private.rule_revocations_v1 from public, anon, authenticated, service_role;
grant select on grammar_pilot_private.rule_grants_v1 to service_role;
grant select on grammar_pilot_private.rule_revocations_v1 to service_role;

create or replace function grammar_pilot_private.run_one_rule_v1(
  p_sentence jsonb,
  p_release_code text,
  p_rule_code text
) returns jsonb
language plpgsql volatile security invoker
set search_path = ''
as $function$
declare
  v_rule_id uuid;
  v_compiled_hash text;
  v_rule_count integer;
  v_grant_hash text;
  v_grant_count integer;
  v_result jsonb;
  v_now timestamptz := clock_timestamp();
begin
  if p_sentence is null or p_sentence #> '{analysis,language_graph,clause_build_v1,clauses}' is null
     or p_sentence #> '{analysis,language_graph,predicate_build_v1,predicates}' is null
     or p_sentence #> '{analysis,language_graph,tokens}' is null then
    raise exception 'PILOT_INPUT_INCOMPLETE';
  end if;
  if p_rule_code <> 'nrg_rt_v1.structural.dependency.subject_of_predicate' then
    raise exception 'PILOT_RULE_NOT_ALLOWED';
  end if;
  if p_release_code is distinct from 'runtime-structural-v1.37' then
    raise exception 'PILOT_RELEASE_NOT_ALLOWED';
  end if;

  select count(*), (array_agg(gr.id))[1], min(rr.compiled_hash)
    into v_rule_count, v_rule_id, v_compiled_hash
  from public.grammar_runtime_releases rel
  join public.grammar_runtime_release_rules rr on rr.release_id = rel.id
  join public.grammar_rules gr on gr.id = rr.rule_id
  where rel.code = p_release_code
    and rel.status = 'shadow'
    and coalesce(rel.metadata->'pilot_rule_codes', '[]'::jsonb) ? p_rule_code
    and rr.is_enabled
    and gr.code = p_rule_code
    and gr.pattern_type = 'dependency_pattern'
    and rr.compiled_hash = gr.compile_hash;
  if v_rule_count <> 1 or v_compiled_hash is null then
    raise exception 'PILOT_MEMBERSHIP_INVALID';
  end if;

  select count(*), min(g.compiled_hash)
    into v_grant_count, v_grant_hash
  from grammar_pilot_private.rule_grants_v1 g
  where g.release_code = p_release_code
    and g.rule_code = p_rule_code
    and g.granted_at <= v_now
    and g.expires_at > v_now
    and not exists (
      select 1 from grammar_pilot_private.rule_revocations_v1 x
      where x.grant_id = g.grant_id and x.revoked_at <= v_now
    );
  if v_grant_count <> 1 or v_grant_hash is distinct from v_compiled_hash then
    raise exception 'PILOT_GRANT_INVALID';
  end if;

  v_result := public.execute_dependency_pattern_rule_v2(p_sentence, v_rule_id);
  if v_result->>'rule_code' is distinct from p_rule_code
     or v_result->>'compile_hash' is distinct from v_compiled_hash
     or v_result->>'status' is distinct from 'executed'
     or coalesce((v_result->>'actions_fully_supported')::boolean, false) is not true
     or coalesce((v_result->>'hardcoded_rule_code')::boolean, true) is not false then
    raise exception 'PILOT_EXECUTION_INVALID';
  end if;
  return v_result;
end;
$function$;

revoke all on function grammar_pilot_private.run_one_rule_v1(jsonb,text,text)
  from public, anon, authenticated;
grant execute on function grammar_pilot_private.run_one_rule_v1(jsonb,text,text)
  to service_role;

do $verify$
begin
  if (select count(*) from grammar_pilot_private.rule_grants_v1) <> 0
     or (select count(*) from grammar_pilot_private.rule_revocations_v1) <> 0 then
    raise exception 'R059_GRANT_TABLE_NOT_EMPTY';
  end if;
  if has_schema_privilege('anon','grammar_pilot_private','USAGE')
     or has_schema_privilege('authenticated','grammar_pilot_private','USAGE')
     or has_function_privilege('anon','grammar_pilot_private.run_one_rule_v1(jsonb,text,text)','EXECUTE')
     or has_function_privilege('authenticated','grammar_pilot_private.run_one_rule_v1(jsonb,text,text)','EXECUTE')
     or not has_function_privilege('service_role','grammar_pilot_private.run_one_rule_v1(jsonb,text,text)','EXECUTE')
     or has_table_privilege('service_role','grammar_pilot_private.rule_grants_v1','INSERT')
     or has_table_privilege('service_role','grammar_pilot_private.rule_revocations_v1','INSERT') then
    raise exception 'R059_PILOT_ACL_MISMATCH';
  end if;
end;
$verify$;
