create or replace function public.run_subordinate_clause_foundation_shadow_comparator_v1(
 p_release_code text default 'runtime-structural-v1.22',
 p_parent_release_code text default 'runtime-structural-v1.21',
 p_corpus_version text default 'shadow-corpus-v2.0'
)
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
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v21','grammar-structural-shadow-v22',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,
  jsonb_build_object('comparison_contract','grammar-shadow-comparison-v2.2','evaluation_contract','grammar-shadow-comparator-v2.2','comparison_mode','parent_child_subordinate_clause_foundation_causal','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Subordinate Clause Foundation V1','legacy_is_oracle',false,'child_projection','common semantic projection excludes subordinate_clause_foundation_v1'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
  begin
   pd:=public.analyze_text_structural_shadow_v21(c.input_text,p_parent_release_code);
   cd:=public.analyze_text_structural_shadow_v22(c.input_text,p_release_code);
   pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
   ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
   ca:=jsonb_set(ca,'{language_graph}',coalesce(ca->'language_graph','{}'::jsonb)-'subordinate_clause_foundation_v1',true);
   pp:=public.project_structural_grammar_shadow_v2(pa);
   cp:=public.project_structural_grammar_shadow_v2(ca);
   cmp:=public.compare_grammar_shadow_v2(pp,cp);
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
   values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,pp,cp,cmp,'grammar-structural-shadow-v21','grammar-structural-shadow-v22');
  exception when others then
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
   values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v21','grammar-structural-shadow-v22',sqlerrm);
  end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch);
 return batch;
end;
$$;
