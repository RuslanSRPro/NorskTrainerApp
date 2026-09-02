create or replace function public.run_morphological_rule_dispatcher_shadow_comparator_v1(p_release_code text default 'runtime-structural-v1.27',p_parent_release_code text default 'runtime-structural-v1.26',p_corpus_version text default 'shadow-corpus-v2.0')
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
 insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v26-context','grammar-structural-shadow-v27',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,jsonb_build_object('comparison_contract','grammar-shadow-comparison-v2.2','comparison_mode','parent_child_morphological_dispatcher','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Morphological Rule Dispatcher V1','intended_change','only source-verified adjective morphology may gain runtime-rule resolution'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
  begin
   pd:=public.analyze_text_structural_shadow_v23(c.input_text,p_parent_release_code); cd:=public.analyze_text_structural_shadow_v27(c.input_text,p_release_code);
   pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb); ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
   pp:=public.project_structural_grammar_shadow_v2(pa); cp:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(pp,cp);
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
   values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,pp,cp,cmp,'grammar-structural-shadow-v26-context','grammar-structural-shadow-v27');
  exception when others then
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
   values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v26-context','grammar-structural-shadow-v27',sqlerrm);
  end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;
$$;

create or replace function public.promote_morphological_rule_dispatcher_release_to_shadow_v1(p_batch uuid,p_release_code text default 'runtime-structural-v1.27')
returns jsonb
language plpgsql
set search_path to 'public','pg_catalog'
as $$
declare g jsonb; rs jsonb; rel record; completed int; errors int; nonparity int; activec int; childc int;
begin
 select * into rel from public.grammar_runtime_releases where code=p_release_code for update;
 if rel.status<>'golden' then raise exception 'release must be golden'; end if;
 g:=public.run_morphological_rule_dispatcher_golden_v1(p_release_code);
 if (g#>>'{summary,failed}')::int<>0 then raise exception 'dispatcher golden failed'; end if;
 rs:=public.rule_activation_readiness_summary_v2(p_release_code);
 if (rs#>>'{summary,blocked_by_runtime_capability}')::int<>0 or (rs#>>'{summary,operator_ready_not_canonical_integrated}')::int<>0 then raise exception 'readiness v2 blockers remain'; end if;
 select count(*) filter(where execution_status='completed'),count(*) filter(where execution_status='error'),count(*) filter(where execution_status='completed' and classification<>'parity') into completed,errors,nonparity from public.grammar_shadow_v2_comparisons where batch_id=p_batch;
 if completed<>34 or errors<>0 then raise exception 'comparator incomplete/errors: %/%',completed,errors; end if;
 -- Current corpus is expected to remain semantic parity; targeted morphology gains are covered by Golden fixtures.
 if nonparity<>0 then raise exception 'unexpected comparator nonparity: %',nonparity; end if;
 select count(*) into activec from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
 if activec<>0 then raise exception 'active NRG rules must remain zero'; end if;
 select count(*) into childc from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id where r.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code='runtime-structural-v1.26' and pr.rule_id=rr.rule_id);
 if childc<>0 then raise exception 'v1.27 must add zero child grammar rules'; end if;
 if md5(pg_get_functiondef('public.tokenize_text_simple(text)'::regprocedure))<>'40819fa48cc6e48372cbf42275f2bb0c' or md5(pg_get_functiondef('public.analyze_text_structural_shadow_core_v1(text,text)'::regprocedure))<>'b15193a826907ea6082a1aae52f15fec' or md5(pg_get_functiondef('public.tokenize_text_v2(text)'::regprocedure))<>'f76f85eee4469e74079a101da442ec52' then raise exception 'immutable hash mismatch'; end if;
 update public.grammar_runtime_releases set status='shadow',metadata=metadata||jsonb_build_object('promotion_gate','morphological-rule-dispatcher-v1-shadow-gate-v1','dispatcher_golden','17/17','readiness_v2',rs#>'{summary}','comparator_batch',p_batch,'comparator_parity','34/34') where id=rel.id;
 update public.grammar_shadow_v2_batches set status='reviewed' where id=p_batch;
 return jsonb_build_object('status','promoted','release_code',p_release_code,'comparator_batch',p_batch,'golden','17/17','parity','34/34');
end;
$$;
