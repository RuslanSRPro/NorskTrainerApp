create or replace function public.run_activation_batch_planning_golden_v1(p_release_code text default 'runtime-structural-v1.24')
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare p jsonb; a jsonb; d jsonb; t jsonb; tests jsonb:='[]'::jsonb; total int:=0; passed int:=0; failed int:=0; ok boolean; inh jsonb;
begin
 p:=public.activation_batch_plan_v1(p_release_code);
 a:=public.activation_batch_plan_family_v1('adjective_forms_and_agreement');
 d:=public.activation_batch_plan_family_v1('degrees_of_comparison');
 t:=public.activation_batch_plan_family_v1('tense_form_core');
 inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.23');

 ok=(p->'summary'->>'candidate_count')::int=1708; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','scope.1708','passed',ok));
 ok=(p->'summary'->>'program_family_count')::int=8; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','families.8','passed',ok));
 ok=(p->'summary'->>'operator_batch_count')::int=1083; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','operator_batches.1083','passed',ok));
 ok=(p->>'activation_allowed')::boolean=false; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','activation.disabled','passed',ok));
 ok=(select sum((x->>'candidate_count')::int) from jsonb_array_elements(p->'program_families') x)=1708; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','family.coverage_exact','passed',ok));
 ok=(select count(*)=count(distinct x->>'batch_id') from jsonb_array_elements(p->'operator_batches') x); total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','batch_ids.unique','passed',ok));
 ok=(select sum((x->>'candidate_count')::int) from jsonb_array_elements(a->'batches') x)=22; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','adjective_forms.22','passed',ok));
 ok=(select sum((x->>'candidate_count')::int) from jsonb_array_elements(d->'batches') x)=18; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','degrees.18','passed',ok));
 ok=(select sum((x->>'candidate_count')::int) from jsonb_array_elements(t->'batches') x)=28; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','tense_core.28','passed',ok));
 ok=(select count(*) from jsonb_array_elements(a->'batches'))=5; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','adjective_forms.batches_5','passed',ok));
 ok=(select count(*) from jsonb_array_elements(d->'batches'))=7; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','degrees.batches_7','passed',ok));
 ok=(select count(*) from jsonb_array_elements(t->'batches'))=3; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','tense_core.batches_3','passed',ok));
 ok=exists(select 1 from jsonb_array_elements(d->'batches') x where x->>'execution_role'='adjective_degree_rule' and (x->>'candidate_count')::int=7); total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','degrees.rule_batch_7','passed',ok));
 ok=exists(select 1 from jsonb_array_elements(t->'batches') x where x->>'execution_role'='tense_form' and (x->>'candidate_count')::int=6); total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','tense.form_batch_6','passed',ok));
 ok=exists(select 1 from jsonb_array_elements(a->'batches') x where x->>'execution_role'='adjective_agreement_rule' and (x->>'candidate_count')::int=13); total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','agreement.rule_batch_13','passed',ok));
 ok=not exists(select 1 from jsonb_array_elements(p->'operator_batches') x where x->>'activation_status'<>'not_allowed_v1'); total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','all_batches.nonactivating','passed',ok));
 ok=public.activation_batch_plan_v1(p_release_code)=public.activation_batch_plan_v1(p_release_code); total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','deterministic','passed',ok));
 ok=coalesce((inh->>'valid')::boolean,false) and (inh->>'extra_child_rules')::int=0 and (inh->>'missing_parent_rules')::int=0; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','inheritance.exact_parent_v123','passed',ok,'actual',inh));
 ok=(select count(*) from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active)=0; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','active_nrg.zero','passed',ok));
 return jsonb_build_object('version','activation-batch-planning-golden-v1','total',total,'passed',passed,'failed',failed,'tests',tests,'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(tests) x where not (x->>'passed')::boolean));
end
$$;
