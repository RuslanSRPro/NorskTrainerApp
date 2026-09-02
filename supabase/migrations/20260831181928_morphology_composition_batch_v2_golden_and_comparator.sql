create or replace function public.run_morphology_composition_batch_golden_v2(p_release_code text default 'runtime-structural-v1.29')
returns jsonb language plpgsql volatile security invoker set search_path='public','pg_catalog' as $$
declare tests jsonb:='[]'::jsonb; r record; d jsonb; rd jsonb; ftd jsonb; raw text; adj text; c int; active_nrg int; child_count int; rule_count int; manifest_count int;
begin
 select rule_count,manifest_count into rule_count,manifest_count from public.grammar_runtime_releases where code=p_release_code;
 select count(*) into child_count from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases rel on rel.id=rr.release_id where rel.code=p_release_code and coalesce((rr.metadata->>'child_rule')::boolean,false);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.rule_count_27','actual',rule_count,'passed',rule_count=27));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.manifest_count_26','actual',manifest_count,'passed',manifest_count=26));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.child_rules_3','actual',child_count,'passed',child_count=3));
 select count(*) into c from public.grammar_runtime_manifests where code in ('ir.adjective.agreement.strong.class1.neuter_t','ir.adjective.agreement.class1.neuter_double_consonant_simplification','ir.adjective.degree.suffix.post_deletion_consonant_simplification') and authoring_status='validated';
 tests:=tests||jsonb_build_array(jsonb_build_object('code','manifests.three_validated','actual',c,'passed',c=3));
 select count(*) into c from public.grammar_rules where code in ('nrg_rt_v1.adjective.agreement.strong.class1.neuter_t','nrg_rt_v1.adjective.agreement.class1.neuter_double_consonant_simplification','nrg_rt_v1.adjective.degree.suffix.post_deletion_consonant_simplification');
 tests:=tests||jsonb_build_array(jsonb_build_object('code','rules.three_materialized','actual',c,'passed',c=3));
 select count(*) into c from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.active_nrg_zero','actual',c,'passed',c=0));
 d:=public.dispatch_morphological_rules_v2('grønt','grønn',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','agreement.gront_composed','passed',d#>>'{selected,execution_path}'='composed_two_step' and d#>>'{selected,composition_group}'='class1_neuter_t' and d#>>'{selected,composition_rule_code}'='nrg_rt_v1.adjective.agreement.class1.neuter_double_consonant_simplification'));
 d:=public.dispatch_morphological_rules_v2('blått','blå',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','agreement.blaatt_direct_isolated','passed',d#>>'{selected,execution_path}'='direct' and d#>>'{selected,rule_code}'='nrg_rt_v1.adjective.agreement.class1.neuter_stressed_vowel_tt'));
 d:=public.dispatch_morphological_rules_v2('spisst','spiss',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','agreement.spisst_direct_base_t','passed',d#>>'{selected,rule_code}'='nrg_rt_v1.adjective.agreement.strong.class1.neuter_t' and d#>>'{selected,execution_path}'='direct'));
 select public.apply_morph_string_operation_v1('sikker',gr.pattern) into raw from public.grammar_rules gr where gr.code='nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.comparative';
 select public.apply_morph_string_operation_v1(raw,gr.pattern) into adj from public.grammar_rules gr where gr.code='nrg_rt_v1.adjective.degree.suffix.post_deletion_consonant_simplification';
 tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.sikker_two_step_operator','raw',raw,'final',adj,'passed',raw='sikkrere' and adj='sikrere'));
 select count(*) into c from public.lexemes l join public.lexeme_form_variants pc on pc.lexeme_id=l.id and pc.form_key='positive_common' and pc.verification_status='source_verified' join public.lexeme_form_variants cmp on cmp.lexeme_id=l.id and cmp.form_key='comparative' and cmp.verification_status='source_verified' where l.pos='adjective' and pc.value ~ '(el|en|er)$' and public.simplify_first_double_consonant_v1(left(pc.value,length(pc.value)-2)||right(pc.value,1)||'ere')=cmp.value and (left(pc.value,length(pc.value)-2)||right(pc.value,1)||'ere')<>cmp.value;
 tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.no_fabricated_canonical_fixture','verified_fixture_count',c,'passed',c=0));
 select count(*) into c from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases rel on rel.id=rr.release_id join public.grammar_rules gr on gr.id=rr.rule_id where rel.code='runtime-structural-v1.28' and gr.code like 'nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.%' and (rr.metadata ? 'composition_group' or rr.metadata ? 'composition_domain');
 tests:=tests||jsonb_build_array(jsonb_build_object('code','inheritance.parent_v28_semantics_unchanged','actual',c,'passed',c=0));
 select count(*) into c from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases rel on rel.id=rr.release_id join public.grammar_rules gr on gr.id=rr.rule_id where rel.code=p_release_code and gr.code like 'nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.%' and rr.metadata->>'composition_group'='suffix_post_deletion' and rr.metadata->>'composition_domain'='adjective_degree';
 tests:=tests||jsonb_build_array(jsonb_build_object('code','composition.degree_group_bound','actual',c,'passed',c=2));
 rd:=public.rule_activation_readiness_summary_v2(p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','readiness.activation_ready_23','actual',rd->>'activation_ready','passed',(rd->>'activation_ready')::int=23));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','readiness.needs_manifest_1699','actual',rd->>'needs_manifest','passed',(rd->>'needs_manifest')::int=1699));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','readiness.zero_blocked','passed',coalesce((rd->>'blocked_by_runtime_capability')::int,0)=0));
 ftd:=public.run_forms_tenses_degrees_golden_v1(p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','regression.forms_tenses_degrees_52_52','actual',jsonb_build_object('total',ftd->'total','passed',ftd->'passed','failed',ftd->'failed','batch_id',ftd->'batch_id'),'passed',(ftd->>'total')::int=52 and (ftd->>'passed')::int=52 and (ftd->>'failed')::int=0));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_tokenizer_simple','passed',md5(pg_get_functiondef('public.tokenize_text_simple(text)'::regprocedure))='40819fa48cc6e48372cbf42275f2bb0c'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_core','passed',md5(pg_get_functiondef('public.analyze_text_structural_shadow_core_v1(text,text)'::regprocedure))='b15193a826907ea6082a1aae52f15fec'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_tokenizer_v2','passed',md5(pg_get_functiondef('public.tokenize_text_v2(text)'::regprocedure))='f76f85eee4469e74079a101da442ec52'));
 d:=public.dispatch_morphological_rules_v2('grønt','grønn',p_release_code); rd:=public.dispatch_morphological_rules_v2('grønt','grønn',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','deterministic','passed',d=rd));
 select count(*) filter(where not coalesce((x->>'passed')::boolean,false)),count(*) filter(where coalesce((x->>'passed')::boolean,false)) into c,active_nrg from jsonb_array_elements(tests) x;
 return jsonb_build_object('version','morphology-composition-batch-golden-v2','release_code',p_release_code,'tests',tests,'summary',jsonb_build_object('total',jsonb_array_length(tests),'passed',active_nrg,'failed',c),'readiness',public.rule_activation_readiness_summary_v2(p_release_code),'forms_tenses_degrees',ftd);
end;$$;

create or replace function public.run_morphology_composition_shadow_comparator_v2(p_release_code text default 'runtime-structural-v1.29',p_parent_release_code text default 'runtime-structural-v1.28',p_corpus_version text default 'shadow-corpus-v2.0')
returns uuid language plpgsql volatile security invoker set search_path='public','pg_catalog' as $$
declare child_id uuid; child_status text; parent_status text; expected int; batch uuid; c record; pd jsonb; cd jsonb; pa jsonb; ca jsonb; pp jsonb; cp jsonb; cmp jsonb;
begin
 select id,status into child_id,child_status from public.grammar_runtime_releases where code=p_release_code; select status into parent_status from public.grammar_runtime_releases where code=p_parent_release_code;
 if child_status not in ('golden','shadow') then raise exception 'Child must be golden/shadow'; end if; if parent_status<>'shadow' then raise exception 'Parent must be shadow'; end if;
 select count(*)::int into expected from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active; if expected<>34 then raise exception 'Expected 34 corpus cases, got %',expected; end if;
 insert into public.grammar_shadow_v2_batches(runtime_release_id,corpus_version,baseline_name,baseline_version,shadow_engine_version,active_legacy_rule_checksum,status,expected_cases,metadata,started_at)
 values(child_id,p_corpus_version,p_parent_release_code,'grammar-structural-shadow-v27/release-v1.28','grammar-structural-shadow-v29',public.grammar_shadow_v2_legacy_rule_checksum(),'running',expected,jsonb_build_object('comparison_mode','parent_child_morphology_composition_v2','parent_release',p_parent_release_code,'child_release',p_release_code,'single_capability','Morphology Composition Batch V2'),clock_timestamp()) returning id into batch;
 for c in select id,code,input_text from public.grammar_shadow_v2_corpus_cases where corpus_version=p_corpus_version and is_active order by code loop
  begin
   pd:=public.analyze_text_structural_shadow_v27(c.input_text,p_parent_release_code); cd:=public.analyze_text_structural_shadow_v29(c.input_text,p_release_code);
   pa:=coalesce(pd#>'{document_graph,sentences,0,analysis}','{}'::jsonb); ca:=coalesce(cd#>'{document_graph,sentences,0,analysis}','{}'::jsonb); pp:=public.project_structural_grammar_shadow_v2(pa); cp:=public.project_structural_grammar_shadow_v2(ca); cmp:=public.compare_grammar_shadow_v2(pp,cp);
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version)
   values(batch,c.id,c.code,c.input_text,'completed',cmp->>'classification',coalesce(cmp->'labels','[]'::jsonb),pa,ca,pp,cp,cmp,'grammar-structural-shadow-v27/release-v1.28','grammar-structural-shadow-v29');
  exception when others then
   insert into public.grammar_shadow_v2_comparisons(batch_id,case_id,case_code,input_text,execution_status,classification,labels,baseline_result,shadow_result,baseline_projection,shadow_projection,comparison,baseline_version,shadow_version,error_message)
   values(batch,c.id,c.code,c.input_text,'error',null,'[]','{}','{}','{}','{}','{}','grammar-structural-shadow-v27/release-v1.28','grammar-structural-shadow-v29',sqlerrm);
  end;
 end loop;
 perform public.finalize_grammar_shadow_v2_batch(batch); return batch;
end;$$;
