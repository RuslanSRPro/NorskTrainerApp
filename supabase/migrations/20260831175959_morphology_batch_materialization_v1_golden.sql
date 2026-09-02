create or replace function public.run_morphology_batch_materialization_golden_v1(p_release_code text default 'runtime-structural-v1.28')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare tests jsonb:='[]'::jsonb; c int; pc int; rd jsonb; fd jsonb; x jsonb; passc int;
begin
 select count(*) into c from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id where r.code=p_release_code;
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.rule_count_24','passed',c=24,'actual',c));
 select count(*) into c from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases r on r.id=rr.release_id where r.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code='runtime-structural-v1.27' and pr.rule_id=rr.rule_id);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.child_rules_6','passed',c=6,'actual',c));
 select count(*) into c from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p on p.id=pr.release_id where p.code='runtime-structural-v1.27' and not exists(select 1 from public.grammar_runtime_release_rules cr join public.grammar_runtime_releases ch on ch.id=cr.release_id where ch.code=p_release_code and cr.rule_id=pr.rule_id);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.parent_rules_all_inherited','passed',c=0,'missing',c));
 select count(*) into c from public.grammar_runtime_manifests where validated_by='morphology-batch-v1' and authoring_status='validated';
 tests:=tests||jsonb_build_array(jsonb_build_object('code','manifests.six_validated','passed',c=6,'actual',c));
 select count(*) into c from public.grammar_rules gr join public.grammar_runtime_manifests m on m.id=gr.runtime_manifest_id where m.validated_by='morphology-batch-v1';
 tests:=tests||jsonb_build_array(jsonb_build_object('code','rules.six_materialized','passed',c=6,'actual',c));
 select count(*) into c from public.grammar_rules gr join public.grammar_runtime_manifests m on m.id=gr.runtime_manifest_id where m.validated_by='morphology-batch-v1' and gr.is_active;
 tests:=tests||jsonb_build_array(jsonb_build_object('code','rules.six_globally_inactive','passed',c=0,'actual_active',c));
 select count(*) into c from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id join public.grammar_runtime_manifests m on m.id=gr.runtime_manifest_id where m.validated_by='morphology-batch-v1' and gs.verification_status='source_verified';
 tests:=tests||jsonb_build_array(jsonb_build_object('code','provenance.six_source_links','passed',c=6,'actual',c));
 select count(distinct gs.candidate_id) into c from public.grammar_rule_sources gs join public.grammar_rules gr on gr.id=gs.grammar_rule_id join public.grammar_runtime_manifests m on m.id=gr.runtime_manifest_id where m.validated_by='morphology-batch-v1';
 tests:=tests||jsonb_build_array(jsonb_build_object('code','provenance.three_candidates','passed',c=3,'actual',c));
 select count(*) into c from public.grammar_rules gr join public.grammar_runtime_manifests m on m.id=gr.runtime_manifest_id where m.validated_by='morphology-batch-v1' and coalesce((public.assess_runtime_rule_execution_v5(gr.id)->>'ready_without_runtime_code_change')::boolean,false);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','execution.six_ready','passed',c=6,'actual',c));
 x:=public.dispatch_morphological_rules_v1('blåere','blå',p_release_code); tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.regular_comparative','passed',x#>>'{selected,rule_code}'='nrg_rt_v1.adjective.degree.suffix.regular_endings.comparative'));
 x:=public.dispatch_morphological_rules_v1('blåest','blå',p_release_code); tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.regular_superlative','passed',x#>>'{selected,rule_code}'='nrg_rt_v1.adjective.degree.suffix.regular_endings.superlative'));
 x:=public.dispatch_morphological_rules_v1('enklere','enkel',p_release_code); tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.el_en_er_comparative','passed',x#>>'{selected,rule_code}'='nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.comparative'));
 x:=public.dispatch_morphological_rules_v1('enklest','enkel',p_release_code); tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.el_en_er_superlative','passed',x#>>'{selected,rule_code}'='nrg_rt_v1.adjective.degree.suffix.el_en_er_vowel_deletion.superlative'));
 x:=public.dispatch_morphological_rules_v1('ektere','ekte',p_release_code); tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.final_e_comparative','passed',x#>>'{selected,rule_code}'='nrg_rt_v1.adjective.degree.suffix.unstressed_e_deletion.comparative'));
 x:=public.dispatch_morphological_rules_v1('ektest','ekte',p_release_code); tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.final_e_superlative','passed',x#>>'{selected,rule_code}'='nrg_rt_v1.adjective.degree.suffix.unstressed_e_deletion.superlative'));
 x:=public.dispatch_morphological_rules_v1('bedre',null,p_release_code); tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.irregular_bedre_not_claimed','passed',x->>'status'='no_match'));
 x:=public.dispatch_morphological_rules_v1('vakrere','vakker',p_release_code); tests:=tests||jsonb_build_array(jsonb_build_object('code','degree.composition_heavy_vakker_deferred','passed',x->>'status'='no_match'));
 rd:=public.rule_activation_readiness_summary_v2(p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','readiness.activation_ready_20','passed',(rd#>>'{summary,activation_ready}')::int=20,'actual',rd#>>'{summary,activation_ready}'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','readiness.needs_manifest_1702','passed',(rd#>>'{summary,needs_manifest}')::int=1702,'actual',rd#>>'{summary,needs_manifest}'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','readiness.zero_blocked','passed',(rd#>>'{summary,blocked_by_runtime_capability}')::int=0 and (rd#>>'{summary,operator_ready_not_canonical_integrated}')::int=0));
 fd:=public.run_forms_tenses_degrees_golden_v1(p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','regression.forms_tenses_degrees_52_52','passed',(fd#>>'{summary,passed}')::int=52 and (fd#>>'{summary,failed}')::int=0,'actual',fd#>'{summary}'));
 select count(*) into c from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.active_nrg_zero','passed',c=0,'actual',c));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_tokenizer_simple','passed',md5(pg_get_functiondef('public.tokenize_text_simple(text)'::regprocedure))='40819fa48cc6e48372cbf42275f2bb0c'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_core','passed',md5(pg_get_functiondef('public.analyze_text_structural_shadow_core_v1(text,text)'::regprocedure))='b15193a826907ea6082a1aae52f15fec'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_tokenizer_v2','passed',md5(pg_get_functiondef('public.tokenize_text_v2(text)'::regprocedure))='f76f85eee4469e74079a101da442ec52'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','deterministic','passed',public.dispatch_morphological_rules_v1('enklere','enkel',p_release_code)=public.dispatch_morphological_rules_v1('enklere','enkel',p_release_code)));
 select count(*) into passc from jsonb_array_elements(tests) t where coalesce((t->>'passed')::boolean,false);
 return jsonb_build_object('version','morphology-batch-materialization-golden-v1','release_code',p_release_code,'tests',tests,'summary',jsonb_build_object('total',jsonb_array_length(tests),'passed',passc,'failed',jsonb_array_length(tests)-passc),'readiness',rd#>'{summary}','forms_tenses_degrees',fd#>'{summary}');
end;
$$;
