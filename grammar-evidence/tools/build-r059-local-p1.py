import json
import sys
from pathlib import Path

repo = Path(__file__).resolve().parents[2]
if len(sys.argv) != 2:
    raise SystemExit("usage: build-r059-local-p1.py OUTPUT_SQL_PATH")
rule = json.loads((repo / "grammar-evidence/artifacts/R059-production-subject-rule-snapshot.json").read_text(encoding="utf-8"))
fixture = json.loads((repo / "grammar-evidence/artifacts/R051-current-production-structural-rpc-smoke.json").read_text(encoding="utf-8"))
graph = fixture["rpc_output"]["language_graph"]
sentence = {"analysis": {"language_graph": graph}}
matches = [x for x in graph["rule_execution_plane_v1"]["dependency_pattern_executions"] if x["rule_code"] == rule["rule_code"]]
assert len(matches) == 1
expected = matches[0]

source = (repo / "supabase/migrations/20260831145026_rule_execution_plane_v1_closure.sql").read_text(encoding="utf-8")
def function(name):
    start = source.index("create or replace function public." + name + "(")
    end = source.find("create or replace function public.", start + 1)
    return source[start:end if end >= 0 else None].strip()

def q(value):
    value = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    assert "$json$" not in value
    return "$json$" + value + "$json$::jsonb"

schema = """
create table public.grammar_runtime_releases(id uuid primary key, code text not null, status text not null, metadata jsonb not null);
create table public.grammar_rules(id uuid primary key, code text not null, pattern_type text not null, pattern jsonb not null, actions jsonb not null, compiler_version text, compile_hash text);
create table public.grammar_runtime_release_rules(release_id uuid not null, rule_id uuid not null, compiled_hash text not null, is_enabled boolean not null);
"""
rows = f"""
insert into public.grammar_runtime_releases values ('{rule['release_id']}', '{rule['release_code']}', '{rule['status']}', {q(rule['metadata'])});
insert into public.grammar_rules values ('{rule['rule_id']}', '{rule['rule_code']}', '{rule['pattern_type']}', {q(rule['pattern'])}, {q(rule['actions'])}, '{rule['compiler_version']}', '{rule['compile_hash']}');
insert into public.grammar_runtime_release_rules values ('{rule['release_id']}', '{rule['rule_id']}', '{rule['compiled_hash']}', true);
"""

tests = f"""
do $test$
declare
  v_sentence jsonb := {q(sentence)};
  v_expected jsonb := {q(expected)};
  v_result jsonb;
  v_wrong_id bigint;
  v_good_id bigint;
  v_duplicate_id bigint;
begin
  begin
    perform grammar_pilot_private.run_one_rule_v1(v_sentence,'{rule['release_code']}','{rule['rule_code']}');
    raise exception 'NO_GRANT_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'PILOT_GRANT_INVALID' then raise; end if;
  end;
  raise notice 'NO_GRANT=PASS';

  insert into grammar_pilot_private.rule_grants_v1(release_code,rule_code,compiled_hash,granted_by,expires_at)
    values ('{rule['release_code']}','{rule['rule_code']}','wrong-hash','local-p1',now()+interval '1 hour') returning grant_id into v_wrong_id;
  begin
    perform grammar_pilot_private.run_one_rule_v1(v_sentence,'{rule['release_code']}','{rule['rule_code']}');
    raise exception 'WRONG_HASH_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'PILOT_GRANT_INVALID' then raise; end if;
  end;
  raise notice 'WRONG_HASH=PASS';
  insert into grammar_pilot_private.rule_revocations_v1(grant_id,revoked_by) values (v_wrong_id,'local-p1');

  insert into grammar_pilot_private.rule_grants_v1(release_code,rule_code,compiled_hash,granted_by,expires_at)
    values ('{rule['release_code']}','{rule['rule_code']}','{rule['compile_hash']}','local-p1',now()+interval '1 hour') returning grant_id into v_good_id;
  v_result := grammar_pilot_private.run_one_rule_v1(v_sentence,'{rule['release_code']}','{rule['rule_code']}');
  if v_result is distinct from v_expected then
    raise exception 'PARITY_MISMATCH actual=%, expected=%', v_result, v_expected;
  end if;
  if (v_result->>'dependency_count')::int <> 1
     or v_result#>>'{{dependencies,0,source_entity}}' <> 'token'
     or v_result#>>'{{dependencies,0,target_entity}}' <> 'predicate'
     or (v_result->>'trace_action_materialized')::boolean is not true then
    raise exception 'GRAPH_OUTPUT_INVALID';
  end if;
  raise notice 'R051_JSONB_PARITY=PASS';

  insert into grammar_pilot_private.rule_grants_v1(release_code,rule_code,compiled_hash,granted_by,expires_at)
    values ('{rule['release_code']}','{rule['rule_code']}','{rule['compile_hash']}','local-p1',now()+interval '1 hour') returning grant_id into v_duplicate_id;
  begin
    perform grammar_pilot_private.run_one_rule_v1(v_sentence,'{rule['release_code']}','{rule['rule_code']}');
    raise exception 'DUPLICATE_GRANT_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'PILOT_GRANT_INVALID' then raise; end if;
  end;
  raise notice 'DUPLICATE_GRANT=PASS';
  insert into grammar_pilot_private.rule_revocations_v1(grant_id,revoked_by) values (v_duplicate_id,'local-p1');

  update public.grammar_runtime_release_rules set compiled_hash='tampered';
  begin
    perform grammar_pilot_private.run_one_rule_v1(v_sentence,'{rule['release_code']}','{rule['rule_code']}');
    raise exception 'TAMPERED_MEMBERSHIP_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'PILOT_MEMBERSHIP_INVALID' then raise; end if;
  end;
  raise notice 'MEMBERSHIP_HASH=PASS';
  update public.grammar_runtime_release_rules set compiled_hash='{rule['compiled_hash']}';

  insert into grammar_pilot_private.rule_revocations_v1(grant_id,revoked_by) values (v_good_id,'local-p1');
  begin
    perform grammar_pilot_private.run_one_rule_v1(v_sentence,'{rule['release_code']}','{rule['rule_code']}');
    raise exception 'REVOKED_GRANT_ACCEPTED';
  exception when raise_exception then
    if sqlerrm <> 'PILOT_GRANT_INVALID' then raise; end if;
  end;
  raise notice 'REVOCATION=PASS';

  if has_schema_privilege('anon','grammar_pilot_private','USAGE')
     or has_schema_privilege('authenticated','grammar_pilot_private','USAGE')
     or has_function_privilege('anon','grammar_pilot_private.run_one_rule_v1(jsonb,text,text)','EXECUTE')
     or has_function_privilege('authenticated','grammar_pilot_private.run_one_rule_v1(jsonb,text,text)','EXECUTE') then
    raise exception 'APP_ROLE_ACCESS';
  end if;
  raise notice 'APP_ROLE_ACL=PASS';
end;
$test$;
"""

patch = (repo / "supabase/migrations/20261022162000_grammar_sql_one_rule_pilot_admission.sql").read_text(encoding="utf-8")
output = Path(sys.argv[1]).resolve()
output.write_text("\n".join([schema, function("execute_scalar_rule_actions_v1"), function("execute_dependency_pattern_rule_v2"), rows, patch, tests]), encoding="utf-8")
print(output)
