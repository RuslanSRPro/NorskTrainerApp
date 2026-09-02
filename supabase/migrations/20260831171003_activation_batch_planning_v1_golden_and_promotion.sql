create or replace function public.run_activation_batch_planning_golden_v1(p_release_code text default 'runtime-structural-v1.24')
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_catalog
as $$
declare p jsonb; a jsonb; d jsonb; t jsonb; tests jsonb:='[]'::jsonb; total int:=0; passed int:=0; failed int:=0; ok boolean;
begin
 p:=public.activation_batch_plan_v1(p_release_code);
 a:=public.activation_batch_plan_family_v1('adjective_forms_and_agreement');
 d:=public.activation_batch_plan_family_v1('degrees_of_comparison');
 t:=public.activation_batch_plan_family_v1('tense_form_core');

 -- helper pattern repeated intentionally to keep evaluator self-contained.
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
 ok=(select count(*) from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id where r.code=p_release_code and rr.metadata->>'inherited_from_parent' is null)=0; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','child_rules.zero','passed',ok));
 ok=(select count(*) from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active)=0; total:=total+1; passed:=passed+case when ok then 1 else 0 end; failed:=failed+case when ok then 0 else 1 end; tests:=tests||jsonb_build_array(jsonb_build_object('code','active_nrg.zero','passed',ok));
 return jsonb_build_object('version','activation-batch-planning-golden-v1','total',total,'passed',passed,'failed',failed,'tests',tests,'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(tests) x where not (x->>'passed')::boolean));
end
$$;

create or replace function public.promote_activation_batch_planning_release_to_shadow_v1(p_release_code text default 'runtime-structural-v1.24')
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
declare g jsonb; f jsonb; r record;
begin
 g:=public.run_activation_batch_planning_golden_v1(p_release_code);
 if (g->>'failed')::int<>0 then raise exception 'activation batch planning golden failed: %',g; end if;
 f:=public.run_forms_tenses_degrees_golden_v1(p_release_code);
 if (f->>'failed')::int<>0 then raise exception 'forms/tenses/degrees regression failed: %',f; end if;
 if public.rule_activation_readiness_summary_v1(p_release_code)->'counts' is null then raise exception 'readiness summary unavailable'; end if;
 if (select count(*) from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active)<>0 then raise exception 'active NRG rules must remain zero'; end if;
 update public.grammar_runtime_releases
 set status='shadow', golden_passed_at=now(), metadata=metadata||jsonb_build_object(
   'promotion_gate','activation-batch-planning-v1-shadow-gate-v1',
   'activation_batch_planning_golden',(g->>'passed')||'/'||(g->>'total'),
   'forms_tenses_degrees_golden',(f->>'passed')||'/'||(f->>'total'),
   'bulk_activation_ready',false,
   'next_layer','Activation Batch Materialization Pilot V1'
 )
 where code=p_release_code;
 select code,status,rule_count,manifest_count,checksum into r from public.grammar_runtime_releases where code=p_release_code;
 return jsonb_build_object('status','promoted','release_code',r.code,'release_status',r.status,'rule_count',r.rule_count,'manifest_count',r.manifest_count,'checksum',r.checksum,'planning_golden',(g->>'passed')||'/'||(g->>'total'),'forms_tenses_degrees',(f->>'passed')||'/'||(f->>'total'),'bulk_activation_ready',false,'next_layer','Activation Batch Materialization Pilot V1');
end
$$;
