do $migration$
declare c text; checks text[]:=array[
 'compiler_manifest_count_14','compiler_manifest_exact_14','compiler_outputs_15','compiler_outputs_exact_15','compiler_plans_14','compiler_closed',
 'materializer_separate','materializer_default_inactive','pattern_types_7','execution_rules_15','execution_ready_7','execution_blocked_8','execution_unsupported_0',
 'representative_compiled_8','representative_ready_6','representative_blocked_2','representative_runtime_source_uncompiled_6','representative_new_capability_5','representative_reference_1',
 'inheritance_pass','child_rules_0','global_active_nrg_0','materializer_conflict_no_write','bulk_activation_false'
 ];
begin
 foreach c in array checks loop
   insert into public.grammar_golden_tests(code,test_type,sentence,is_grammatical,status,test_layer,input_fixture,expected_language_graph)
   values('compiler-execution-v2.'||c,'regression','[architecture audit]',true,'implemented','pipeline_integration',jsonb_build_object('check',c),jsonb_build_object('expected',true))
   on conflict(code) do update set status='implemented',test_layer='pipeline_integration',input_fixture=excluded.input_fixture,expected_language_graph=excluded.expected_language_graph,updated_at=now();
 end loop;
end;
$migration$;

create or replace function public.run_compiler_execution_closure_golden_v2(p_release_code text default 'runtime-structural-v1.20')
returns jsonb
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_release_id uuid; v_batch uuid:=gen_random_uuid(); g record; s jsonb; rep jsonb; ex jsonb; inh jsonb; v_pass boolean; v_actual jsonb; v_mat jsonb; v_before int; v_after int; v_total int:=0; v_passed int:=0; v_failed int:=0; v_failures jsonb:='[]'::jsonb;
begin
 select id into v_release_id from public.grammar_runtime_releases where code=p_release_code;
 if v_release_id is null then raise exception 'Release % not found',p_release_code; end if;
 s:=public.compiler_execution_closure_summary_v2(p_release_code); rep:=s->'representative_suite'; ex:=s->'execution'; inh:=s->'inheritance';
 for g in select * from public.grammar_golden_tests where code like 'compiler-execution-v2.%' and status='implemented' order by code loop
   v_total:=v_total+1; v_pass:=false; v_actual:='{}'::jsonb;
   case g.input_fixture->>'check'
    when 'compiler_manifest_count_14' then v_actual:=jsonb_build_object('value',(s#>>'{compiler,manifest_count}')::int); v_pass:=(s#>>'{compiler,manifest_count}')::int=14;
    when 'compiler_manifest_exact_14' then v_actual:=jsonb_build_object('value',(s#>>'{compiler,exact_parity_manifests}')::int); v_pass:=(s#>>'{compiler,exact_parity_manifests}')::int=14;
    when 'compiler_outputs_15' then v_actual:=jsonb_build_object('value',(s#>>'{compiler,compiled_output_count}')::int); v_pass:=(s#>>'{compiler,compiled_output_count}')::int=15;
    when 'compiler_outputs_exact_15' then v_actual:=jsonb_build_object('value',(s#>>'{compiler,exact_parity_outputs}')::int); v_pass:=(s#>>'{compiler,exact_parity_outputs}')::int=15;
    when 'compiler_plans_14' then v_actual:=jsonb_build_object('value',(s#>>'{compiler,validated_compiler_plans}')::int); v_pass:=(s#>>'{compiler,validated_compiler_plans}')::int=14;
    when 'compiler_closed' then v_actual:=jsonb_build_object('value',s#>'{compiler,compiler_closed}'); v_pass:=coalesce((s#>>'{compiler,compiler_closed}')::boolean,false);
    when 'materializer_separate' then v_actual:=jsonb_build_object('value',s#>'{compiler,materializer_separate}'); v_pass:=coalesce((s#>>'{compiler,materializer_separate}')::boolean,false);
    when 'materializer_default_inactive' then v_actual:=jsonb_build_object('value',s#>'{compiler,materializer_default_activation}'); v_pass:=not coalesce((s#>>'{compiler,materializer_default_activation}')::boolean,true);
    when 'pattern_types_7' then v_actual:=jsonb_build_object('value',(ex#>>'{summary,pattern_types_covered}')::int); v_pass:=(ex#>>'{summary,pattern_types_covered}')::int=7;
    when 'execution_rules_15' then v_actual:=jsonb_build_object('value',(ex#>>'{summary,rule_count}')::int); v_pass:=(ex#>>'{summary,rule_count}')::int=15;
    when 'execution_ready_7' then v_actual:=jsonb_build_object('value',(ex#>>'{summary,ready_without_runtime_code_change}')::int); v_pass:=(ex#>>'{summary,ready_without_runtime_code_change}')::int=7;
    when 'execution_blocked_8' then v_actual:=jsonb_build_object('value',(ex#>>'{summary,registered_but_blocked}')::int); v_pass:=(ex#>>'{summary,registered_but_blocked}')::int=8;
    when 'execution_unsupported_0' then v_actual:=jsonb_build_object('value',(ex#>>'{summary,unsupported_or_unmapped}')::int); v_pass:=(ex#>>'{summary,unsupported_or_unmapped}')::int=0;
    when 'representative_compiled_8' then v_actual:=jsonb_build_object('value',(rep#>>'{summary,compiled_candidates}')::int); v_pass:=(rep#>>'{summary,compiled_candidates}')::int=8;
    when 'representative_ready_6' then v_actual:=jsonb_build_object('value',(rep#>>'{summary,compiled_candidates_ready_without_runtime_code_change}')::int); v_pass:=(rep#>>'{summary,compiled_candidates_ready_without_runtime_code_change}')::int=6;
    when 'representative_blocked_2' then v_actual:=jsonb_build_object('value',(rep#>>'{summary,compiled_candidates_blocked}')::int); v_pass:=(rep#>>'{summary,compiled_candidates_blocked}')::int=2;
    when 'representative_runtime_source_uncompiled_6' then v_actual:=jsonb_build_object('value',(rep#>>'{summary,runtime_or_source_without_compiled_rule}')::int); v_pass:=(rep#>>'{summary,runtime_or_source_without_compiled_rule}')::int=6;
    when 'representative_new_capability_5' then v_actual:=jsonb_build_object('value',(rep#>>'{summary,new_generic_capability_required}')::int); v_pass:=(rep#>>'{summary,new_generic_capability_required}')::int=5;
    when 'representative_reference_1' then v_actual:=jsonb_build_object('value',(rep#>>'{summary,reference_or_interpretive}')::int); v_pass:=(rep#>>'{summary,reference_or_interpretive}')::int=1;
    when 'inheritance_pass' then v_actual:=inh; v_pass:=coalesce((inh->>'valid')::boolean,false);
    when 'child_rules_0' then select count(*) into v_before from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases cr on cr.id=rr.release_id where cr.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code='runtime-structural-v1.19' and pr.rule_id=rr.rule_id); v_actual:=jsonb_build_object('value',v_before); v_pass:=v_before=0;
    when 'global_active_nrg_0' then select count(*) into v_before from public.grammar_rules where is_active and code like 'nrg_rt_v1.%'; v_actual:=jsonb_build_object('value',v_before); v_pass:=v_before=0;
    when 'materializer_conflict_no_write' then
      select count(*) into v_before from public.grammar_rules;
      v_mat:=public.materialize_grammar_runtime_manifest_v1((select id from public.grammar_runtime_manifests where code='ir.preposition.complementless_category'));
      select count(*) into v_after from public.grammar_rules;
      v_actual:=jsonb_build_object('materializer',v_mat,'before',v_before,'after',v_after); v_pass:=v_mat->>'status'='conflict_existing_rule_code' and coalesce((v_mat->>'no_write')::boolean,false) and v_before=v_after;
    when 'bulk_activation_false' then v_actual:=jsonb_build_object('value',s#>'{summary,bulk_activation_ready}'); v_pass:=not coalesce((s#>>'{summary,bulk_activation_ready}')::boolean,true);
    else v_pass:=false; v_actual:=jsonb_build_object('error','unknown_check');
   end case;
   insert into public.grammar_golden_test_runs(golden_test_id,runtime_release_id,evaluator_version,engine_version,passed,input_snapshot,actual_result,diff,finished_at,run_batch_id)
   values(g.id,v_release_id,'compiler-execution-closure-golden-v2','grammar-structural-shadow-v20',v_pass,g.input_fixture,v_actual,case when v_pass then '{}'::jsonb else jsonb_build_object('expected',g.expected_language_graph,'actual',v_actual) end,now(),v_batch);
   if v_pass then v_passed:=v_passed+1; else v_failed:=v_failed+1; v_failures:=v_failures||jsonb_build_array(jsonb_build_object('code',g.code,'actual',v_actual)); end if;
 end loop;
 return jsonb_build_object('version','compiler-execution-closure-golden-v2','batch_id',v_batch,'total',v_total,'passed',v_passed,'failed',v_failed,'failures',v_failures);
end;
$function$;

create or replace function public.run_compiler_execution_closure_shadow_comparator_v2(
 p_release_code text default 'runtime-structural-v1.20',p_parent_release_code text default 'runtime-structural-v1.19',p_corpus_version text default 'shadow-corpus-v2.0')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare child_id uuid; child_status text; parent_status text; expected int; batch uuid; c record; pd jsonb; cd jsonb; pa jsonb; ca jsonb; pp jsonb; cp jsonb; cmp jsonb;
begin
 select id,status into child_id,child_status from public.grammar_runtime_releases where code=p_release_code;
 select status into parent_status from public.grammar_runtime_releases where code=p_parent_release_code;
 if child_id is null or child_status not in ('golden','shadow') then raise exception 'Child must be golden/shadow'; end if;
 if parent_status<>'shadow' then raise exception 'Parent must be shadow'; end if;
 select count(*)::int into expected from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active;
 if expected<>34 then raise exception 'Expected 34 corpus cases, got %',expected; end if;
 insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v19','grammar-structural-shadow-v20',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,
  jsonb_build_object('comparison_contract','grammar-shadow-comparison-v2.2','evaluation_contract','grammar-shadow-comparator-v2.2','comparison_mode','parent_child_compiler_execution_closure_causal','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Compiler + Execution Capability Closure V2','legacy_is_oracle',false,'child_projection','sentence semantic projection unchanged; document runtime_build_audit_v2 additive'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
  begin
   pd:=public.analyze_text_structural_shadow_v19(c.input_text,p_parent_release_code); cd:=public.analyze_text_structural_shadow_v20(c.input_text,p_release_code);
   pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb); ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
   pp:=public.project_structural_grammar_shadow_v2(pa); cp:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(pp,cp);
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
   values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,pp,cp,cmp,'grammar-structural-shadow-v19','grammar-structural-shadow-v20');
  exception when others then
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
   values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v19','grammar-structural-shadow-v20',sqlerrm);
  end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;
$function$;
