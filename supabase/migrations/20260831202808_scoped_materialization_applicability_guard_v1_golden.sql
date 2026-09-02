create or replace function public.run_scoped_materialization_applicability_golden_v1(p_release_code text default 'runtime-structural-v1.33')
returns jsonb language plpgsql set search_path to 'public','pg_catalog' as $$
declare b jsonb; h text; inh jsonb; rel record; active_nrg int; child_rules int; f jsonb; sm jsonb; pp jsonb; failures jsonb:='[]'::jsonb; total int:=0; passed int:=0;
begin
 b:=public.plan_scoped_manifest_batch_dry_run_v2('word_order.subordinate_schema_b_core.v1',p_release_code);
 h:=public.grammar_source_graph_semantic_hash_v1();
 select * into rel from public.grammar_runtime_releases where code=p_release_code;
 inh:=public.validate_runtime_child_release_inheritance_v1(p_release_code,rel.metadata->>'parent_release');
 select count(*) into active_nrg from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
 select count(*) into child_rules from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id join public.grammar_rules gr on gr.id=rr.rule_id where r.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code=rel.metadata->>'parent_release' and pr.rule_id=rr.rule_id);
 f:=public.run_forms_tenses_degrees_golden_v1(p_release_code);
 sm:=public.run_sentence_model_golden_v2(p_release_code);
 pp:=public.run_pedagogical_projection_golden_v1(p_release_code);

 create temporary table if not exists tmp_app_guard_checks(name text,ok boolean,detail jsonb) on commit drop;
 truncate tmp_app_guard_checks;
 insert into tmp_app_guard_checks values
 ('batch.candidate_count',coalesce((b->>'candidate_count')::int,0)=6,b),
 ('batch.allowed_zero',coalesce((b->>'materialization_allowed_count')::int,-1)=0,b),
 ('batch.blocked_six',coalesce((b->>'materialization_blocked_count')::int,-1)=6,b),
 ('batch.state_blocked',b->>'batch_state'='blocked_applicability',b),
 ('batch.no_write',coalesce((b->>'write_performed')::boolean,true)=false,b),
 ('source.hash_immutable',h='4eb3a4d7503ce1aef7a4a21ea630af600da1bd80b3c937c4907e396a6c511bc2',jsonb_build_object('hash',h)),
 ('architecture.inheritance',coalesce((inh->>'valid')::boolean,false),inh),
 ('architecture.child_rules_zero',child_rules=0,jsonb_build_object('child_rules',child_rules)),
 ('architecture.active_nrg_zero',active_nrg=0,jsonb_build_object('active_nrg',active_nrg)),
 ('hot_path.isolated',coalesce((public.runtime_hot_path_isolation_audit_v1('analyze_text_structural_shadow_v32')->>'pass')::boolean,false),public.runtime_hot_path_isolation_audit_v1('analyze_text_structural_shadow_v32')),
 ('forms.regression',coalesce((f->>'failed')::int,-1)=0 and coalesce((f->>'passed')::int,0)=52,f),
 ('sentence_model.regression',coalesce((sm->>'failed')::int,-1)=0 and coalesce((sm->>'passed')::int,0)=36,sm),
 ('pedagogy.regression',coalesce((pp->>'failed')::int,-1)=0 and coalesce((pp->>'passed')::int,0)=36,pp),
 ('guard.causal_present',exists(select 1 from public.grammar_applicability_requirement_registry_v1 where requirement_code='semantic_use.causal' and status='blocked'),null),
 ('guard.compound_for_at_present',exists(select 1 from public.grammar_applicability_requirement_registry_v1 where requirement_code='compound_subjunction.for_at' and status='blocked'),null),
 ('guard.compound_slik_at_present',exists(select 1 from public.grammar_applicability_requirement_registry_v1 where requirement_code='compound_subjunction.slik_at' and status='blocked'),null),
 ('guard.predicative_present',exists(select 1 from public.grammar_applicability_requirement_registry_v1 where requirement_code='function.predicative' and status='blocked'),null),
 ('guard.matrix_copula_present',exists(select 1 from public.grammar_applicability_requirement_registry_v1 where requirement_code='matrix_copula.vere' and status='blocked'),null);
 select count(*),count(*) filter(where ok) into total,passed from tmp_app_guard_checks;
 select coalesce(jsonb_agg(jsonb_build_object('name',name,'detail',detail) order by name) filter(where not ok),'[]'::jsonb) into failures from tmp_app_guard_checks;
 return jsonb_build_object('version','scoped-materialization-applicability-golden-v1','release_code',p_release_code,'total',total,'passed',passed,'failed',total-passed,'failures',failures,'batch',b);
end;
$$;

create or replace function public.run_scoped_materialization_applicability_shadow_comparator_v1(p_release_code text default 'runtime-structural-v1.33',p_parent_release_code text default 'runtime-structural-v1.32',p_corpus_version text default 'shadow-corpus-v2.0')
returns uuid language plpgsql set search_path to 'public','pg_catalog' as $$
declare child_id uuid; cs text; ps text; expected int; batch uuid; c record; pd jsonb; cd jsonb; pa jsonb; ca jsonb; ppj jsonb; cpj jsonb; cmp jsonb;
begin
 select id,status into child_id,cs from public.grammar_runtime_releases where code=p_release_code;
 select status into ps from public.grammar_runtime_releases where code=p_parent_release_code;
 if cs not in ('golden','shadow') then raise exception 'Child must be golden/shadow'; end if;
 if ps<>'shadow' then raise exception 'Parent must be shadow'; end if;
 select count(*)::int into expected from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active;
 insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v32','grammar-structural-shadow-v33',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,jsonb_build_object('comparison_mode','parent_child_scoped_materialization_applicability_v1','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Scoped Materialization Applicability Guard V1'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
   begin
     pd:=public.analyze_text_structural_shadow_v32(c.input_text,p_parent_release_code);
     cd:=public.analyze_text_structural_shadow_v32(c.input_text,p_release_code);
     pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb); ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb);
     ppj:=public.project_structural_grammar_shadow_v2(pa); cpj:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(ppj,cpj);
     insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
     values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,ppj,cpj,cmp,'grammar-structural-shadow-v32','grammar-structural-shadow-v33');
   exception when others then
     insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
     values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v32','grammar-structural-shadow-v33',sqlerrm);
   end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;
$$;
