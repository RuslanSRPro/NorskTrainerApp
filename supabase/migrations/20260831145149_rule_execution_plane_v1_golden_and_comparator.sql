create or replace function public.run_rule_execution_plane_golden_v1(p_release_code text default 'runtime-structural-v1.18')
returns jsonb
language plpgsql
stable
security invoker
set search_path='public','pg_catalog'
as $function$
declare v_results jsonb:='[]'::jsonb; v_case jsonb; v_doc jsonb; v_layer jsonb; v_pass boolean; v_batch uuid:=gen_random_uuid(); v_rule uuid;
begin
 for v_case in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_build_object('code','inheritance_contract','text','Han reiser.','check','inheritance'),
  jsonb_build_object('code','registry_11_actions','text','Han reiser.','check','registry'),
  jsonb_build_object('code','unknown_action_explicit','text','Han reiser.','check','unknown_action'),
  jsonb_build_object('code','candidate_match','text','Han går inn.','check','candidate_match'),
  jsonb_build_object('code','candidate_score_parity','text','Han går inn.','check','candidate_score'),
  jsonb_build_object('code','candidate_protect_parity','text','Han går inn.','check','candidate_protect'),
  jsonb_build_object('code','candidate_trace_materialized','text','Han går inn.','check','candidate_trace'),
  jsonb_build_object('code','candidate_no_match','text','Han reiser.','check','candidate_no_match'),
  jsonb_build_object('code','phrase_ap_operator','text','En stor bil.','check','phrase_ap'),
  jsonb_build_object('code','phrase_np_operator','text','Jeg ser en bil.','check','phrase_np'),
  jsonb_build_object('code','phrase_vp_operator','text','Han har gått.','check','phrase_vp'),
  jsonb_build_object('code','phrase_all_registered','text','Jeg ser en bil.','check','phrase_all'),
  jsonb_build_object('code','dependency_subject_edge','text','Han reiser.','check','dep_edge'),
  jsonb_build_object('code','dependency_v2_parity','text','Han reiser.','check','dep_parity'),
  jsonb_build_object('code','dependency_trace','text','Han reiser.','check','dep_trace'),
  jsonb_build_object('code','dependency_no_hardcoded_rule','text','Han reiser.','check','dep_no_hardcode'),
  jsonb_build_object('code','dependency_entity_upgrade','text','Han reiser.','check','dep_adapter'),
  jsonb_build_object('code','dependency_unresolved_no_false_edge','text','Han er sky.','check','dep_unresolved'),
  jsonb_build_object('code','pilot_families_closed','text','Han går inn.','check','closed'),
  jsonb_build_object('code','representative_suite_ready','text','Han går inn.','check','rep_ready'),
  jsonb_build_object('code','bulk_activation_still_false','text','Han går inn.','check','bulk_false'),
  jsonb_build_object('code','global_rules_inactive','text','Han går inn.','check','global_inactive'),
  jsonb_build_object('code','child_only_zero','text','Han går inn.','check','child_zero'),
  jsonb_build_object('code','canonical_parent_layers_immutable','text','Han vil kunne gå.','check','immutable'),
  jsonb_build_object('code','multi_sentence_isolation','text','Han går inn. Jeg ser en bil.','check','multi'),
  jsonb_build_object('code','deterministic','text','Han reiser.','check','deterministic'),
  jsonb_build_object('code','release_code','text','Han reiser.','check','release_code'),
  jsonb_build_object('code','operator_registry_contract','text','Han reiser.','check','registry_contract')
 )) loop
  v_doc:=public.analyze_text_structural_shadow_v18(v_case->>'text',p_release_code);
  v_layer:=v_doc#>'{document_graph,sentences,0,analysis,language_graph,rule_execution_plane_v1}';
  v_pass:=case v_case->>'check'
   when 'inheritance' then coalesce((public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.17')->>'valid')::boolean,false)
   when 'registry' then jsonb_array_length(public.rule_action_operator_registry_v1()->'operators')=11
   when 'unknown_action' then jsonb_array_length(public.execute_scalar_rule_actions_v1('[{"action":"future_action"}]'::jsonb)->'unsupported_actions')=1 and not (public.execute_scalar_rule_actions_v1('[{"action":"future_action"}]'::jsonb)->>'fully_supported')::boolean
   when 'candidate_match' then (v_layer#>>'{candidate_constraint_executions,0,match_count}')::int=1
   when 'candidate_score' then coalesce((v_layer#>>'{candidate_constraint_executions,0,matches,0,score_parity}')::boolean,false)
   when 'candidate_protect' then coalesce((v_layer#>>'{candidate_constraint_executions,0,matches,0,protected_parity}')::boolean,false)
   when 'candidate_trace' then coalesce((v_layer#>>'{candidate_constraint_executions,0,trace_action_materialized}')::boolean,false) and jsonb_array_length(v_layer#>'{candidate_constraint_executions,0,matches,0,effects,traces}')=1
   when 'candidate_no_match' then (v_layer#>>'{candidate_constraint_executions,0,match_count}')::int=0
   when 'phrase_ap' then exists(select 1 from jsonb_array_elements(v_layer->'phrase_operator_validations') x where x->>'build_strategy'='head_only' and (x->>'valid')::boolean)
   when 'phrase_np' then exists(select 1 from jsonb_array_elements(v_layer->'phrase_operator_validations') x where x->>'build_strategy'='head_plus_left_dependents' and (x->>'valid')::boolean)
   when 'phrase_vp' then exists(select 1 from jsonb_array_elements(v_layer->'phrase_operator_validations') x where x->>'build_strategy'='finite_head_plus_following_nonfinite' and (x->>'valid')::boolean)
   when 'phrase_all' then not exists(select 1 from jsonb_array_elements(v_layer->'phrase_operator_validations') x where not (x->>'valid')::boolean)
   when 'dep_edge' then (v_layer#>>'{dependency_pattern_executions,0,dependency_count}')::int=1 and v_layer#>>'{dependency_pattern_executions,0,dependencies,0,relation}'='subject_of'
   when 'dep_parity' then coalesce((v_layer#>>'{dependency_pattern_executions,0,dependencies,0,canonical_v2_parity}')::boolean,false)
   when 'dep_trace' then coalesce((v_layer#>>'{dependency_pattern_executions,0,trace_action_materialized}')::boolean,false)
   when 'dep_no_hardcode' then not coalesce((v_layer#>>'{dependency_pattern_executions,0,hardcoded_rule_code}')::boolean,true)
   when 'dep_adapter' then exists(select 1 from jsonb_array_elements(v_layer#>'{dependency_pattern_executions,0,adapter_events}') x where x->>'entity_upgrade'='phrase->predicate' and x->>'v2_ref'='clause.predicate_id')
   when 'dep_unresolved' then (v_layer#>>'{dependency_pattern_executions,0,dependency_count}')::int=0
   when 'closed' then coalesce((v_layer#>>'{summary,pilot_families_closed}')::boolean,false)
   when 'rep_ready' then coalesce((v_layer#>>'{summary,representative_20_rule_suite_ready}')::boolean,false)
   when 'bulk_false' then not coalesce((v_layer#>>'{summary,bulk_activation_ready}')::boolean,true)
   when 'global_inactive' then (select count(*) from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active)=0
   when 'child_zero' then (select count(*) from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases c on c.id=rr.release_id where c.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code='runtime-structural-v1.17' and pr.rule_id=rr.rule_id))=0
   when 'immutable' then (public.analyze_text_structural_shadow_v17(v_case->>'text',p_release_code)#>'{document_graph,sentences,0,analysis,language_graph}')=(coalesce(v_doc#>'{document_graph,sentences,0,analysis,language_graph}','{}'::jsonb)-'rule_execution_plane_v1')
   when 'multi' then jsonb_array_length(v_doc#>'{document_graph,sentences}')=2 and (v_doc#>>'{document_graph,sentences,0,analysis,language_graph,rule_execution_plane_v1,candidate_constraint_executions,0,match_count}')::int=1 and exists(select 1 from jsonb_array_elements(v_doc#>'{document_graph,sentences,1,analysis,language_graph,rule_execution_plane_v1,phrase_operator_validations}') x where x->>'build_strategy'='head_plus_left_dependents' and (x->>'valid')::boolean)
   when 'deterministic' then v_layer=(public.analyze_text_structural_shadow_v18(v_case->>'text',p_release_code)#>'{document_graph,sentences,0,analysis,language_graph,rule_execution_plane_v1}')
   when 'release_code' then v_layer->>'release_code'=p_release_code
   when 'registry_contract' then public.rule_action_operator_registry_v1()->>'unknown_action_policy'='explicit_unsupported' and public.phrase_operator_contract_v1()->>'extension_policy' like 'new build strategy%'
   else false end;
  v_results:=v_results||jsonb_build_array(jsonb_build_object('code',v_case->>'code','passed',v_pass));
 end loop;
 return jsonb_build_object('version','rule-execution-plane-golden-v1','batch_id',v_batch,'total',jsonb_array_length(v_results),'passed',(select count(*) from jsonb_array_elements(v_results) x where (x->>'passed')::boolean),'failed',(select count(*) from jsonb_array_elements(v_results) x where not (x->>'passed')::boolean),'failures',coalesce((select jsonb_agg(x) from jsonb_array_elements(v_results) x where not (x->>'passed')::boolean),'[]'::jsonb));
end;
$function$;

create or replace function public.run_rule_execution_plane_shadow_comparator_v1(p_release_code text default 'runtime-structural-v1.18',p_parent_release_code text default 'runtime-structural-v1.17',p_corpus_version text default 'shadow-corpus-v2.0')
returns uuid
language plpgsql
security invoker
set search_path='public','pg_catalog'
as $function$
declare child_id uuid; child_status text; parent_status text; expected int; batch uuid; c record; pd jsonb; cd jsonb; pa jsonb; ca jsonb; pp jsonb; cp jsonb; cmp jsonb;
begin
 select id,status into child_id,child_status from public.grammar_runtime_releases where code=p_release_code; select status into parent_status from public.grammar_runtime_releases where code=p_parent_release_code;
 if child_id is null or child_status not in ('golden','shadow') then raise exception 'Child must be golden/shadow'; end if; if parent_status<>'shadow' then raise exception 'Parent must be shadow'; end if;
 select count(*)::int into expected from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active; if expected<>34 then raise exception 'Expected 34 corpus cases, got %',expected; end if;
 insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v17','grammar-structural-shadow-v18',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,jsonb_build_object('comparison_contract','grammar-shadow-comparison-v2.2','evaluation_contract','grammar-shadow-comparator-v2.2','comparison_mode','parent_child_rule_execution_plane_causal','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Rule Execution Plane V1 Closure','legacy_is_oracle',false,'child_projection','common semantic projection excludes rule_execution_plane_v1'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
  begin
   pd:=public.analyze_text_structural_shadow_v17(c.input_text,p_parent_release_code); cd:=public.analyze_text_structural_shadow_v18(c.input_text,p_release_code);
   pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb); ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
   ca:=jsonb_set(ca,'{language_graph}',coalesce(ca->'language_graph','{}'::jsonb)-'rule_execution_plane_v1',true);
   pp:=public.project_structural_grammar_shadow_v2(pa); cp:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(pp,cp);
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
   values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,pp,cp,cmp,'grammar-structural-shadow-v17','grammar-structural-shadow-v18');
  exception when others then
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
   values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v17','grammar-structural-shadow-v18',sqlerrm);
  end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;
$function$;
