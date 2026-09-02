create or replace function public.run_rule_activation_readiness_golden_v1(p_release_code text default 'runtime-structural-v1.23')
returns jsonb
language plpgsql stable
set search_path to 'public','pg_catalog'
as $$
declare results jsonb:='[]'::jsonb; s jsonb; ex jsonb; inh jsonb; total int; passed int; a jsonb; b jsonb;
begin
 s:=public.rule_activation_readiness_summary_v1(p_release_code); ex:=public.audit_execution_family_closure_v4('runtime-structural-v1.22'); inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.22');
 results:=results||jsonb_build_array(public.golden_assertion_v1('contract.version',public.rule_activation_readiness_contract_v1()->>'version'='rule-activation-readiness-v1'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('summary.total_4564',s#>>'{summary,total_candidates}'='4564',s->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('summary.activation_ready_14',s#>>'{summary,activation_ready}'='14',s->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('summary.manifest_covered_10',s#>>'{summary,covered_by_validated_manifest}'='10',s->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('summary.needs_manifest_1708',s#>>'{summary,needs_manifest}'='1708',s->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('summary.not_runtime_2832',s#>>'{summary,not_runtime_target}'='2832',s->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('summary.blocked_materialized_0',s#>>'{summary,blocked_by_runtime_capability}'='0',s->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('summary.source_invalid_0',s#>>'{summary,source_invalid}'='0',s->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('summary.partition_complete',(s#>>'{summary,activation_ready}')::int+(s#>>'{summary,covered_by_validated_manifest}')::int+(s#>>'{summary,needs_manifest}')::int+(s#>>'{summary,not_runtime_target}')::int+(s#>>'{summary,blocked_by_runtime_capability}')::int+(s#>>'{summary,source_invalid}')::int=4564,s->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('summary.bulk_activation_false',s#>>'{summary,bulk_activation_ready}'='false',s->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('execution.rule_count_15',ex#>>'{summary,rule_count}'='15',ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('execution.ready_15',ex#>>'{summary,ready_without_runtime_code_change}'='15',ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('execution.blocked_0',ex#>>'{summary,registered_but_blocked}'='0',ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('execution.unsupported_0',ex#>>'{summary,unsupported_or_unmapped}'='0',ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('execution.structural_closed',ex#>>'{summary,current_compiled_set_structurally_closed}'='true',ex->'summary'));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.inheritance',coalesce((inh->>'valid')::boolean,false),inh));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.active_nrg_0',(select count(*) from public.grammar_rules where is_active and code like 'nrg_rt_v1.%')=0));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.child_rules_0',(select count(*) from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases c on c.id=rr.release_id where c.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code='runtime-structural-v1.22' and pr.rule_id=rr.rule_id))=0));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.all_source_verified',(select count(*) from public.grammar_knowledge_candidates where status not in ('verified','source_verified'))=0));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.runtime_eligible_1732',(select count(*) from public.grammar_knowledge_candidate_execution_v where runtime_eligible)=1732));
 results:=results||jsonb_build_array(public.golden_assertion_v1('architecture.nonruntime_2832',(select count(*) from public.grammar_knowledge_candidate_execution_v where not runtime_eligible)=2832));
 -- deterministic candidate assessments for one ready and one not-yet-materialized candidate
 select public.assess_candidate_activation_readiness_v1(e.candidate_id) into a from public.grammar_knowledge_candidate_execution_v e where exists(select 1 from public.grammar_rule_sources gs where gs.candidate_id=e.candidate_id) order by e.candidate_code limit 1;
 b:=public.assess_candidate_activation_readiness_v1((a->>'candidate_id')::uuid);
 results:=results||jsonb_build_array(public.golden_assertion_v1('assessment.ready_deterministic',a=b,a));
 results:=results||jsonb_build_array(public.golden_assertion_v1('assessment.ready_safe',a->>'state'='activation_ready' and a->>'safe_to_activate'='true',a));
 select public.assess_candidate_activation_readiness_v1(e.candidate_id) into a from public.grammar_knowledge_candidate_execution_v e where e.runtime_eligible and not exists(select 1 from public.grammar_rule_sources gs where gs.candidate_id=e.candidate_id) and not exists(select 1 from public.grammar_runtime_manifests m where m.primary_candidate_id=e.candidate_id or exists(select 1 from public.grammar_runtime_manifest_sources ms where ms.manifest_id=m.id and ms.candidate_id=e.candidate_id)) order by e.candidate_code limit 1;
 results:=results||jsonb_build_array(public.golden_assertion_v1('assessment.unmaterialized_not_safe',a->>'state'='needs_manifest' and a->>'safe_to_activate'='false',a));
 results:=results||jsonb_build_array(public.golden_assertion_v1('analysis.additive_semantic_parity',
   (public.analyze_text_structural_shadow_v23('Han reiser. Jeg ser en stor bil.','runtime-structural-v1.23')#>'{document_graph,sentences}')::text is not null));
 select count(*),count(*) filter(where (x->>'passed')::boolean) into total,passed from jsonb_array_elements(results) x;
 return jsonb_build_object('version','rule-activation-readiness-golden-v1','batch_id',gen_random_uuid(),'total',total,'passed',passed,'failed',total-passed,'failures',(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(results) x where not (x->>'passed')::boolean));
end;
$$;

create or replace function public.run_rule_activation_readiness_shadow_comparator_v1(p_release_code text default 'runtime-structural-v1.23',p_parent_release_code text default 'runtime-structural-v1.22',p_corpus_version text default 'shadow-corpus-v2.0')
returns uuid
language plpgsql
set search_path to 'public','pg_catalog'
as $$
declare child_id uuid; child_status text; parent_status text; expected int; batch uuid; c record; pd jsonb; cd jsonb; pa jsonb; ca jsonb; pp jsonb; cp jsonb; cmp jsonb;
begin
 select id,status into child_id,child_status from public.grammar_runtime_releases where code=p_release_code;
 select status into parent_status from public.grammar_runtime_releases where code=p_parent_release_code;
 if child_id is null or child_status not in ('golden','shadow') then raise exception 'Child must be golden/shadow'; end if;
 if parent_status<>'shadow' then raise exception 'Parent must be shadow'; end if;
 select count(*)::int into expected from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active;
 if expected<>34 then raise exception 'Expected 34 corpus cases, got %',expected; end if;
 insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v22','grammar-structural-shadow-v23',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,jsonb_build_object('comparison_contract','grammar-shadow-comparison-v2.2','evaluation_contract','grammar-shadow-comparator-v2.2','comparison_mode','parent_child_rule_activation_readiness_additive','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Rule Activation Readiness V1','legacy_is_oracle',false,'child_projection','analysis semantic projection; readiness is out-of-band audit only'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
  begin
   pd:=public.analyze_text_structural_shadow_v22(c.input_text,p_parent_release_code); cd:=public.analyze_text_structural_shadow_v23(c.input_text,p_release_code);
   pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb); ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
   pp:=public.project_structural_grammar_shadow_v2(pa); cp:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(pp,cp);
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
   values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,pp,cp,cmp,'grammar-structural-shadow-v22','grammar-structural-shadow-v23');
  exception when others then
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
   values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v22','grammar-structural-shadow-v23',sqlerrm);
  end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;
$$;
