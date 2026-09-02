create or replace function public.runtime_execution_role_operator_registry_v1(p_release_code text default 'runtime-structural-v1.30')
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $$
with mapped as (
 select e.execution_contract#>>'{execution,role}' execution_role,
        gr.pattern_type,gr.rule_type,count(distinct gr.id) rule_count
 from public.grammar_knowledge_candidate_execution_v e
 join public.grammar_rule_sources gs on gs.candidate_id=e.candidate_id
 join public.grammar_rules gr on gr.id=gs.grammar_rule_id
 join public.grammar_runtime_release_rules rr on rr.rule_id=gr.id
 join public.grammar_runtime_releases rel on rel.id=rr.release_id
 where rel.code=p_release_code and rr.is_enabled and e.execution_contract#>>'{execution,role}' is not null
 group by 1,2,3
), role_rows as (
 select execution_role,
        jsonb_agg(jsonb_build_object('pattern_type',pattern_type,'rule_type',rule_type,'rule_count',rule_count) order by pattern_type,rule_type) mappings,
        count(distinct pattern_type) pattern_type_count
 from mapped group by execution_role
)
select jsonb_build_object('version','runtime-execution-role-operator-registry-v1','release_code',p_release_code,
 'roles',coalesce(jsonb_agg(jsonb_build_object('execution_role',execution_role,'mapping_status',case when pattern_type_count=1 then 'unique_existing_mapping' else 'multi_pattern_existing_mapping' end,'mappings',mappings) order by execution_role),'[]'::jsonb))
from role_rows;$$;

create or replace function public.assess_candidate_operator_capability_v1(p_candidate_id uuid,p_release_code text default 'runtime-structural-v1.30')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare e record; role text; mappings jsonb; n int; state text;
begin
 select * into e from public.grammar_knowledge_candidate_execution_v where candidate_id=p_candidate_id;
 if e.candidate_id is null then return jsonb_build_object('status','candidate_not_found','candidate_id',p_candidate_id); end if;
 role:=e.execution_contract#>>'{execution,role}';
 select x->'mappings' into mappings from jsonb_array_elements(public.runtime_execution_role_operator_registry_v1(p_release_code)->'roles') x where x->>'execution_role'=role limit 1;
 n:=coalesce(jsonb_array_length(mappings),0);
 state:=case when not coalesce(e.runtime_eligible,false) then 'not_runtime_target' when n=1 then 'operator_mapped' when n>1 then 'operator_mapping_ambiguous' else 'operator_mapping_missing' end;
 return jsonb_build_object('version','candidate-operator-capability-v1','candidate_id',p_candidate_id,'candidate_code',e.candidate_code,'execution_role',role,'runtime_eligible',coalesce(e.runtime_eligible,false),'capability_state',state,'mappings',coalesce(mappings,'[]'::jsonb));
end;$$;

create or replace function public.universal_operator_capability_matrix_v1(p_release_code text default 'runtime-structural-v1.30')
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_catalog'
as $$
with c as (
 select e.candidate_id,e.runtime_eligible,
        public.assess_candidate_operator_capability_v1(e.candidate_id,p_release_code) a,
        public.assess_candidate_activation_readiness_v2(e.candidate_id,p_release_code) r
 from public.grammar_knowledge_candidate_execution_v e
), g as (
 select a->>'capability_state' capability_state,r->>'readiness_state' readiness_state,count(*) n from c group by 1,2
)
select jsonb_build_object('version','universal-operator-capability-matrix-v1','release_code',p_release_code,
 'summary',jsonb_build_object(
   'total_candidates',(select count(*) from c),
   'runtime_candidates',(select count(*) from c where runtime_eligible),
   'operator_mapped',(select count(*) from c where a->>'capability_state'='operator_mapped'),
   'operator_mapping_ambiguous',(select count(*) from c where a->>'capability_state'='operator_mapping_ambiguous'),
   'operator_mapping_missing',(select count(*) from c where a->>'capability_state'='operator_mapping_missing'),
   'activation_ready',(select count(*) from c where r->>'readiness_state'='activation_ready'),
   'needs_manifest',(select count(*) from c where r->>'readiness_state'='needs_manifest')
 ),
 'state_counts',coalesce((select jsonb_agg(jsonb_build_object('capability_state',capability_state,'readiness_state',readiness_state,'count',n) order by capability_state,readiness_state) from g),'[]'::jsonb));$$;

create or replace function public.plan_manifest_batch_dry_run_v1(p_execution_role text,p_release_code text default 'runtime-structural-v1.30',p_limit int default 500)
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare reg jsonb; maps jsonb; candidates jsonb; n int;
begin
 select x into reg from jsonb_array_elements(public.runtime_execution_role_operator_registry_v1(p_release_code)->'roles') x where x->>'execution_role'=p_execution_role limit 1;
 maps:=coalesce(reg->'mappings','[]'::jsonb); n:=jsonb_array_length(maps);
 select coalesce(jsonb_agg(jsonb_build_object('candidate_id',candidate_id,'candidate_code',candidate_code,'source_status',status,'source_section',source_section) order by candidate_code),'[]'::jsonb)
 into candidates
 from (
  select c.id candidate_id,e.candidate_code,c.status,c.source_section
  from public.grammar_knowledge_candidates c join public.grammar_knowledge_candidate_execution_v e on e.candidate_id=c.id
  where e.runtime_eligible and e.execution_contract#>>'{execution,role}'=p_execution_role
    and (public.assess_candidate_activation_readiness_v2(c.id,p_release_code)->>'readiness_state')='needs_manifest'
  order by e.candidate_code limit greatest(1,least(coalesce(p_limit,500),2000))
 ) q;
 return jsonb_build_object('version','batch-manifest-factory-dry-run-v1','write_performed',false,'execution_role',p_execution_role,
   'operator_mapping_status',case when n=1 then 'factory_ready_unique_operator_mapping' when n>1 then 'blocked_ambiguous_operator_mapping' else 'blocked_missing_operator_mapping' end,
   'operator_mappings',maps,'candidate_count',jsonb_array_length(candidates),'candidates',candidates,
   'safety','dry-run only; source candidates are immutable; no manifests/rules/releases are written');
end;$$;

create or replace function public.universal_activation_gate_v1(p_release_code text default 'runtime-structural-v1.30')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $$
declare rel record; src_hash text; base_hash text; missing_sources int; invalid_patterns int; active_nrg int; inh jsonb; matrix jsonb;
begin
 select * into rel from public.grammar_runtime_releases where code=p_release_code;
 select semantic_hash into base_hash from public.grammar_source_graph_snapshots_v1 where snapshot_code='source-graph-4564-v1';
 src_hash:=public.grammar_source_graph_semantic_hash_v1();
 select count(*) into missing_sources
 from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id join public.grammar_rules gr on gr.id=rr.rule_id
 where r.code=p_release_code and rr.is_enabled and not exists(select 1 from public.grammar_rule_sources gs where gs.grammar_rule_id=gr.id and gs.verification_status='source_verified');
 select count(*) into invalid_patterns
 from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id join public.grammar_rules gr on gr.id=rr.rule_id
 where r.code=p_release_code and rr.is_enabled and not public.validate_grammar_rule_pattern_v2(gr.pattern_type,gr.pattern);
 select count(*) into active_nrg from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
 inh:=case when rel.parent_release_id is null then jsonb_build_object('status','root') else public.validate_runtime_child_release_inheritance_v1(p_release_code,(select code from public.grammar_runtime_releases where id=rel.parent_release_id)) end;
 matrix:=public.universal_operator_capability_matrix_v1(p_release_code);
 return jsonb_build_object('version','universal-activation-gate-v1','release_code',p_release_code,
  'checks',jsonb_build_object('source_graph_immutable',src_hash=base_hash,'source_graph_hash',src_hash,'baseline_source_graph_hash',base_hash,
    'missing_source_provenance_rules',missing_sources,'invalid_rule_patterns',invalid_patterns,'global_active_nrg_rules',active_nrg,'inheritance',inh,'operator_matrix',matrix),
  'gate_pass',src_hash=base_hash and missing_sources=0 and invalid_patterns=0 and active_nrg=0,
  'bulk_activation_ready',false,
  'note','Gate proves conveyor integrity for a release; bulk activation additionally requires batch-specific semantic/corpus/false-positive evidence.');
end;$$;
