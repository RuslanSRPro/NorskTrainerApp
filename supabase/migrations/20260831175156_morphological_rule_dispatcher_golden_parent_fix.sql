create or replace function public.run_morphological_rule_dispatcher_golden_v1(p_release_code text default 'runtime-structural-v1.27')
returns jsonb
language plpgsql
stable
set search_path to 'public','pg_catalog'
as $$
declare tests jsonb:='[]'::jsonb; d jsonb; p jsonb; c int; passc int; ps jsonb; ds jsonb;
begin
 tests:=tests||jsonb_build_array(jsonb_build_object('code','contract.release_aware','passed',(public.morphological_rule_dispatcher_contract_v1()->>'release_aware')::boolean));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.exact_inheritance','passed',(public.validate_runtime_child_release_inheritance_v1(p_release_code,'runtime-structural-v1.26')->>'valid')::boolean));
 select count(*) into c from public.grammar_runtime_release_rules rr join public.grammar_runtime_releases rel on rel.id=rr.release_id where rel.code=p_release_code and not exists(select 1 from public.grammar_runtime_release_rules pr join public.grammar_runtime_releases p2 on p2.id=pr.release_id where p2.code='runtime-structural-v1.26' and pr.rule_id=rr.rule_id);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','release.zero_child_rules','passed',c=0,'actual',c));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','composition.gammle_to_gamle','passed',public.simplify_first_double_consonant_v1('gammle')='gamle'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','composition.vakkrere_to_vakrere','passed',public.simplify_first_double_consonant_v1('vakkrere')='vakrere'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','transform.regular_comparative','passed',public.apply_morph_string_operation_v1('stor',jsonb_build_object('morph_operation','append_suffix','suffix','ere'))='storere'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','transform.final_e_deletion','passed',public.apply_morph_string_operation_v1('stille',jsonb_build_object('morph_operation','delete_final_e_then_suffix','suffix','ere'))='stillere'));
 d:=public.analyze_text_structural_shadow_v27('De er morsomme.',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','canonical.morsomme_resolved','passed',exists(select 1 from jsonb_array_elements(d#>'{document_graph,sentences,0,analysis,language_graph,morphology_v1}') x where x->>'surface'='morsomme' and x->>'status'='resolved_by_runtime_rule_evidence')));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','canonical.morsomme_sentence_model','passed',exists(select 1 from jsonb_array_elements(d#>'{document_graph,sentences,0,analysis,language_graph,sentence_model_v2,tokens}') x where x->>'surface'='morsomme' and x#>>'{morphology,status}'='resolved_by_runtime_rule_evidence')));
 d:=public.analyze_text_structural_shadow_v27('En enkle bil.',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','safety.conflict_not_overridden','passed',exists(select 1 from jsonb_array_elements(d#>'{document_graph,sentences,0,analysis,language_graph,morphology_v1}') x where x->>'surface'='enkle' and x->>'status'='conflict')));
 d:=public.analyze_text_structural_shadow_v27('Et blått hus.',p_release_code);
 tests:=tests||jsonb_build_array(jsonb_build_object('code','safety.resolved_not_rewritten','passed',exists(select 1 from jsonb_array_elements(d#>'{document_graph,sentences,0,analysis,language_graph,morphology_v1}') x where x->>'surface'='blått' and x->>'status'='resolved_by_evidence')));
 p:=public.analyze_text_structural_shadow_v23('Han reiser. Han har gått.','runtime-structural-v1.26'); d:=public.analyze_text_structural_shadow_v27('Han reiser. Han har gått.',p_release_code);
 select jsonb_agg((x#>'{analysis,language_graph,sentence_model_v2}')-'release_code' order by (x->>'sentence_index')::int) into ps from jsonb_array_elements(p#>'{document_graph,sentences}') x;
 select jsonb_agg((x#>'{analysis,language_graph,sentence_model_v2}')-'release_code' order by (x->>'sentence_index')::int) into ds from jsonb_array_elements(d#>'{document_graph,sentences}') x;
 tests:=tests||jsonb_build_array(jsonb_build_object('code','non_adjective.sentence_model_semantic_parity','passed',ps=ds));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','deterministic','passed',public.analyze_text_structural_shadow_v27('De er morsomme.',p_release_code)=public.analyze_text_structural_shadow_v27('De er morsomme.',p_release_code)));
 select count(*) into c from public.grammar_rules where code like 'nrg_rt_v1.%' and is_active;
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.active_nrg_zero','passed',c=0,'actual',c));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_tokenizer_simple','passed',md5(pg_get_functiondef('public.tokenize_text_simple(text)'::regprocedure))='40819fa48cc6e48372cbf42275f2bb0c'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_core','passed',md5(pg_get_functiondef('public.analyze_text_structural_shadow_core_v1(text,text)'::regprocedure))='b15193a826907ea6082a1aae52f15fec'));
 tests:=tests||jsonb_build_array(jsonb_build_object('code','architecture.immutable_tokenizer_v2','passed',md5(pg_get_functiondef('public.tokenize_text_v2(text)'::regprocedure))='f76f85eee4469e74079a101da442ec52'));
 select count(*) into passc from jsonb_array_elements(tests) x where coalesce((x->>'passed')::boolean,false);
 return jsonb_build_object('version','morphological-rule-dispatcher-golden-v1','release_code',p_release_code,'tests',tests,'summary',jsonb_build_object('total',jsonb_array_length(tests),'passed',passc,'failed',jsonb_array_length(tests)-passc));
end;
$$;
